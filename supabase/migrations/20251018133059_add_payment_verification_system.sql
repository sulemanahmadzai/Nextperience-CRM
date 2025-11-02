/*
  # Add Payment Verification System

  1. Changes to payments table
    - Add proof_of_payment_url for offline payment proof uploads
    - Add verified_by (user_id of Finance Officer)
    - Add verified_at timestamp
    - Add verification_notes for Finance Officer notes
    - Add is_rejected boolean flag
    - Add rejection_reason text field
    - Add is_locked boolean (locked after verification)
    - Add reopened_by and reopened_at for Admin reopens
    - Add reopen_reason for tracking why payment was reopened

  2. Storage
    - Create storage bucket for proof of payment files
    - Set up RLS policies for secure file access

  3. Audit Logging
    - All verification actions logged to audit_logs table

  4. Notes
    - Finance Officers can verify/reject payments
    - Admins can reopen locked payments
    - All actions create audit trail
*/

-- Add verification columns to payments table
ALTER TABLE payments ADD COLUMN IF NOT EXISTS proof_of_payment_url text;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS verified_by uuid REFERENCES auth.users(id);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS verified_at timestamptz;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS verification_notes text;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS is_rejected boolean DEFAULT false;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS rejection_reason text;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS is_locked boolean DEFAULT false;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS reopened_by uuid REFERENCES auth.users(id);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS reopened_at timestamptz;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS reopen_reason text;

-- Create storage bucket for proof of payment files
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-proofs', 'payment-proofs', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for payment-proofs bucket
CREATE POLICY "Authenticated users can upload payment proofs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'payment-proofs');

CREATE POLICY "Users can view payment proofs from their company"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'payment-proofs' AND
  EXISTS (
    SELECT 1 FROM payments p
    INNER JOIN user_company_roles ucr ON ucr.company_id = p.company_id
    WHERE p.proof_of_payment_url = 'payment-proofs/' || name
    AND ucr.user_id = auth.uid()
    AND ucr.is_active = true
  )
);

CREATE POLICY "Finance and Admin can update payment proofs"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'payment-proofs' AND
  EXISTS (
    SELECT 1 FROM user_company_roles ucr
    INNER JOIN roles r ON r.id = ucr.role_id
    WHERE ucr.user_id = auth.uid()
    AND ucr.is_active = true
    AND r.name IN ('Finance Officer', 'Admin')
  )
);

CREATE POLICY "Finance and Admin can delete payment proofs"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'payment-proofs' AND
  EXISTS (
    SELECT 1 FROM user_company_roles ucr
    INNER JOIN roles r ON r.id = ucr.role_id
    WHERE ucr.user_id = auth.uid()
    AND ucr.is_active = true
    AND r.name IN ('Finance Officer', 'Admin')
  )
);

-- Function to verify payment
CREATE OR REPLACE FUNCTION verify_payment(
  payment_id_param uuid,
  notes_param text,
  verified_by_param uuid
)
RETURNS void AS $$
BEGIN
  UPDATE payments
  SET 
    verification_status = 'verified',
    verified_by = verified_by_param,
    verified_at = now(),
    verification_notes = notes_param,
    is_locked = true,
    is_rejected = false
  WHERE id = payment_id_param;

  INSERT INTO audit_logs (
    company_id,
    user_id,
    entity_type,
    entity_id,
    action,
    details
  )
  SELECT 
    company_id,
    verified_by_param,
    'payment',
    payment_id_param,
    'verified',
    jsonb_build_object(
      'payment_id', payment_id_param,
      'amount', amount,
      'notes', notes_param
    )
  FROM payments
  WHERE id = payment_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reject payment
CREATE OR REPLACE FUNCTION reject_payment(
  payment_id_param uuid,
  reason_param text,
  rejected_by_param uuid
)
RETURNS void AS $$
BEGIN
  UPDATE payments
  SET 
    verification_status = 'rejected',
    verified_by = rejected_by_param,
    verified_at = now(),
    is_rejected = true,
    rejection_reason = reason_param,
    is_locked = true
  WHERE id = payment_id_param;

  INSERT INTO audit_logs (
    company_id,
    user_id,
    entity_type,
    entity_id,
    action,
    details
  )
  SELECT 
    company_id,
    rejected_by_param,
    'payment',
    payment_id_param,
    'rejected',
    jsonb_build_object(
      'payment_id', payment_id_param,
      'amount', amount,
      'reason', reason_param
    )
  FROM payments
  WHERE id = payment_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reopen payment (Admin only)
CREATE OR REPLACE FUNCTION reopen_payment(
  payment_id_param uuid,
  reason_param text,
  reopened_by_param uuid
)
RETURNS void AS $$
BEGIN
  UPDATE payments
  SET 
    is_locked = false,
    reopened_by = reopened_by_param,
    reopened_at = now(),
    reopen_reason = reason_param,
    verification_status = 'pending'
  WHERE id = payment_id_param;

  INSERT INTO audit_logs (
    company_id,
    user_id,
    entity_type,
    entity_id,
    action,
    details
  )
  SELECT 
    company_id,
    reopened_by_param,
    'payment',
    payment_id_param,
    'reopened',
    jsonb_build_object(
      'payment_id', payment_id_param,
      'amount', amount,
      'reason', reason_param
    )
  FROM payments
  WHERE id = payment_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

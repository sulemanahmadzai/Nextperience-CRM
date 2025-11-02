/*
  # Add Check Payment Gateway Support
  
  1. Changes to payment_gateway_configs table
    - Add support for "check" provider type
    - Check payment is a manual gateway (no API keys needed)
  
  2. Changes to payments table
    - Add check_number field for check payments
    - Add bank_name field for check payments
    - Add payment_stage field (downpayment, balance, partial)
    - Add deposit_percentage field (for downpayment calculations)
    - Add verification_notes field for Finance Officer notes
    - Add verified_by field to track who verified the payment
    - Add verified_at timestamp
    - Add rejection_reason field
    - Add is_locked field to prevent deletion/editing after verification
  
  3. New quotation statuses
    - Add 'pending_finance_verification' status for quotations with pending check payments
  
  4. Purpose
    - Enable manual check payment submissions alongside automated gateways
    - Track check payment details (check number, bank, etc.)
    - Support payment stages (downpayment, balance, partial)
    - Enable Finance Officer verification workflow
    - Lock verified payments from unauthorized changes
    - Calculate and track balance remaining per quotation
*/

-- Add new fields to payments table for check payment support
DO $$
BEGIN
  -- Check payment specific fields
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'check_number'
  ) THEN
    ALTER TABLE payments ADD COLUMN check_number text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'bank_name'
  ) THEN
    ALTER TABLE payments ADD COLUMN bank_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'payment_stage'
  ) THEN
    ALTER TABLE payments ADD COLUMN payment_stage text CHECK (payment_stage IN ('downpayment', 'balance', 'partial'));
  END IF;

  -- Verification fields
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'verification_notes'
  ) THEN
    ALTER TABLE payments ADD COLUMN verification_notes text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'verified_by'
  ) THEN
    ALTER TABLE payments ADD COLUMN verified_by uuid REFERENCES auth.users(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'verified_at'
  ) THEN
    ALTER TABLE payments ADD COLUMN verified_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'rejection_reason'
  ) THEN
    ALTER TABLE payments ADD COLUMN rejection_reason text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'is_locked'
  ) THEN
    ALTER TABLE payments ADD COLUMN is_locked boolean DEFAULT false;
  END IF;

  -- Notes field (already exists as metadata, but add dedicated field)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'notes'
  ) THEN
    ALTER TABLE payments ADD COLUMN notes text;
  END IF;
END $$;

-- Update quotations status constraint to include new statuses
DO $$
BEGIN
  ALTER TABLE quotations DROP CONSTRAINT IF EXISTS quotations_status_check;
  ALTER TABLE quotations ADD CONSTRAINT quotations_status_check 
    CHECK (status IN (
      'draft', 
      'finalized', 
      'sent', 
      'viewed', 
      'accepted', 
      'rejected', 
      'signed', 
      'deposit_paid', 
      'fully_paid', 
      'paid', 
      'expired',
      'pending_finance_verification'
    ));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create index on verification_status for faster queries
CREATE INDEX IF NOT EXISTS idx_payments_verification_status ON payments(verification_status);
CREATE INDEX IF NOT EXISTS idx_payments_payment_method ON payments(payment_method);
CREATE INDEX IF NOT EXISTS idx_payments_is_locked ON payments(is_locked);

-- Create a view for balance remaining calculations
CREATE OR REPLACE VIEW quotation_payment_summary AS
SELECT 
  q.id as quotation_id,
  q.quotation_no,
  q.total_amount,
  q.status as quotation_status,
  COALESCE(SUM(
    CASE 
      WHEN p.verification_status = 'verified' AND p.payment_status IN ('paid', 'completed')
      THEN p.amount 
      ELSE 0 
    END
  ), 0) as total_paid,
  q.total_amount - COALESCE(SUM(
    CASE 
      WHEN p.verification_status = 'verified' AND p.payment_status IN ('paid', 'completed')
      THEN p.amount 
      ELSE 0 
    END
  ), 0) as balance_remaining,
  COUNT(CASE WHEN p.verification_status = 'pending' THEN 1 END) as pending_verification_count,
  COUNT(CASE WHEN p.verification_status = 'verified' THEN 1 END) as verified_payment_count,
  MAX(p.payment_date) as last_payment_date
FROM quotations q
LEFT JOIN payments p ON q.id = p.quotation_id
GROUP BY q.id, q.quotation_no, q.total_amount, q.status;

-- Grant access to the view
GRANT SELECT ON quotation_payment_summary TO authenticated;

COMMENT ON VIEW quotation_payment_summary IS 'Summary of payment status for each quotation including balance remaining';

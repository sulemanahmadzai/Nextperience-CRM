/*
  # Add Partial Payment Support

  1. Changes
    - Add `payment_type` column to payments (deposit, full, partial)
    - Add `expected_amount` column to track total quotation amount
    - Add `is_deposit` boolean flag
    - Add `deposit_percentage` to track deposit percentage
    - Update quotation status to support 'deposit_paid' and 'fully_paid'

  2. Notes
    - Allows tracking of deposit payments (default 50%)
    - Supports flexible deposit amounts
    - Tracks remaining balance for full payment
*/

-- Add new columns to payments table
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_type text DEFAULT 'full' CHECK (payment_type IN ('deposit', 'full', 'partial'));
ALTER TABLE payments ADD COLUMN IF NOT EXISTS is_deposit boolean DEFAULT false;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS deposit_percentage decimal(5,2);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS expected_total decimal(15,2);

-- Update quotations status constraint to include new statuses
DO $$
BEGIN
  ALTER TABLE quotations DROP CONSTRAINT IF EXISTS quotations_status_check;
  ALTER TABLE quotations ADD CONSTRAINT quotations_status_check 
    CHECK (status IN ('draft', 'sent', 'viewed', 'accepted', 'rejected', 'signed', 'deposit_paid', 'fully_paid', 'paid', 'expired'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create function to calculate total paid amount for a quotation
CREATE OR REPLACE FUNCTION get_total_paid_for_quotation(quotation_id_param uuid)
RETURNS decimal AS $$
DECLARE
  total_paid decimal;
BEGIN
  SELECT COALESCE(SUM(amount), 0)
  INTO total_paid
  FROM payments
  WHERE quotation_id = quotation_id_param
    AND payment_status = 'completed'
    AND verification_status != 'rejected';
  
  RETURN total_paid;
END;
$$ LANGUAGE plpgsql;

-- Create function to get remaining balance for a quotation
CREATE OR REPLACE FUNCTION get_remaining_balance(quotation_id_param uuid)
RETURNS decimal AS $$
DECLARE
  total_amount decimal;
  total_paid decimal;
  remaining decimal;
BEGIN
  SELECT total_amount INTO total_amount
  FROM quotations
  WHERE id = quotation_id_param;
  
  SELECT get_total_paid_for_quotation(quotation_id_param) INTO total_paid;
  
  remaining := total_amount - total_paid;
  
  IF remaining < 0 THEN
    remaining := 0;
  END IF;
  
  RETURN remaining;
END;
$$ LANGUAGE plpgsql;

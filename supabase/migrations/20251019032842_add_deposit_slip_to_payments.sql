/*
  # Add deposit slip field to payments
  
  1. Changes
    - Add `deposit_slip_url` field to payments table for check payment uploads
    - This allows managers/sales reps to upload deposit slips for verification
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payments' AND column_name = 'deposit_slip_url'
  ) THEN
    ALTER TABLE payments ADD COLUMN deposit_slip_url text;
  END IF;
END $$;

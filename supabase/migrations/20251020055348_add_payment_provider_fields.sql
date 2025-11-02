/*
  # Add Payment Provider Fields

  1. Changes
    - Add `provider_ref` (text) - stores reference number from payment provider (e.g., Xendit reference)
    - Add `paid_at` (timestamptz) - actual payment completion timestamp from provider
    - Add `verification_type` (text) - 'auto' for gateway payments, 'manual' for check/cash
    - Add index on transaction_id for faster webhook lookups
  
  2. Notes
    - These fields help track gateway payment details
    - Supports idempotency checking in webhooks
    - Enables better audit trail for payments
*/

-- Add new columns if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payments' AND column_name = 'provider_ref'
  ) THEN
    ALTER TABLE payments ADD COLUMN provider_ref text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payments' AND column_name = 'paid_at'
  ) THEN
    ALTER TABLE payments ADD COLUMN paid_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payments' AND column_name = 'verification_type'
  ) THEN
    ALTER TABLE payments ADD COLUMN verification_type text DEFAULT 'manual' 
      CHECK (verification_type IN ('auto', 'manual'));
  END IF;
END $$;

-- Create index on transaction_id for faster webhook lookups
CREATE INDEX IF NOT EXISTS idx_payments_transaction_id ON payments(transaction_id);

-- Update payment_status constraint to include new statuses
DO $$
BEGIN
  ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_payment_status_check;
  ALTER TABLE payments ADD CONSTRAINT payments_payment_status_check 
    CHECK (payment_status IN ('pending', 'paid', 'completed', 'failed', 'expired', 'refunded'));
END $$;
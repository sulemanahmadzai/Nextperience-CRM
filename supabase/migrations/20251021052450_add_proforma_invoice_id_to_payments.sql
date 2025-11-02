/*
  # Add Proforma Invoice Support to Payments

  1. Changes
    - Add proforma_invoice_id column to payments table
    - Add foreign key constraint to proforma_invoices
    - Update check constraint to allow payments without quotation_id
*/

-- Add proforma_invoice_id column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'proforma_invoice_id'
  ) THEN
    ALTER TABLE payments ADD COLUMN proforma_invoice_id uuid REFERENCES proforma_invoices(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Update check constraint to allow either quotation_id or proforma_invoice_id
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_quotation_or_invoice_check;
ALTER TABLE payments ADD CONSTRAINT payments_quotation_or_invoice_check 
  CHECK (
    (quotation_id IS NOT NULL AND proforma_invoice_id IS NULL) OR
    (quotation_id IS NULL AND proforma_invoice_id IS NOT NULL)
  );

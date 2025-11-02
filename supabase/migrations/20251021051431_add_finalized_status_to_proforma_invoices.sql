/*
  # Add Finalized Status to Proforma Invoices

  1. Changes
    - Update status check constraint to include 'finalized' status
    - Finalized invoices cannot be edited but can still receive payments
*/

-- Drop the existing constraint
ALTER TABLE proforma_invoices DROP CONSTRAINT IF EXISTS proforma_invoices_status_check;

-- Add new constraint with finalized status
ALTER TABLE proforma_invoices ADD CONSTRAINT proforma_invoices_status_check 
  CHECK (status IN ('pending', 'paid', 'cancelled', 'overdue', 'finalized'));

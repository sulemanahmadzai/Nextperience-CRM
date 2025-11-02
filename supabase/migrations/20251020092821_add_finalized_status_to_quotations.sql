/*
  # Add 'finalized' status to quotations
  
  1. Changes
    - Update the quotations_status_check constraint to include 'finalized' status
    - This allows quotations to be marked as finalized (ready but not yet sent)
  
  2. Purpose
    - Enable workflow where quotations can be finalized to prevent edits
    - Provides clear distinction between draft (editable) and finalized (ready to send)
*/

DO $$
BEGIN
  ALTER TABLE quotations DROP CONSTRAINT IF EXISTS quotations_status_check;
  ALTER TABLE quotations ADD CONSTRAINT quotations_status_check 
    CHECK (status IN ('draft', 'finalized', 'sent', 'viewed', 'accepted', 'rejected', 'signed', 'deposit_paid', 'fully_paid', 'paid', 'expired'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

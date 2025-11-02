/*
  # Add Acknowledgment Field to Quotations

  1. Changes
    - Add `acknowledged` (boolean) - whether customer acknowledged terms
    - Add `acknowledged_at` (timestamptz) - when they acknowledged
    - Add `acknowledged_by` (text) - name of person who acknowledged
    - Add `acknowledged_text` (text) - the acknowledgment text shown to them

  2. Purpose
    - Track customer acknowledgment of terms and conditions
    - Store when and who acknowledged
    - Allow custom acknowledgment text per quotation
*/

-- Add acknowledgment fields to quotations table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'quotations' AND column_name = 'acknowledged'
  ) THEN
    ALTER TABLE quotations ADD COLUMN acknowledged boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'quotations' AND column_name = 'acknowledged_at'
  ) THEN
    ALTER TABLE quotations ADD COLUMN acknowledged_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'quotations' AND column_name = 'acknowledged_by'
  ) THEN
    ALTER TABLE quotations ADD COLUMN acknowledged_by text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'quotations' AND column_name = 'acknowledgment_text'
  ) THEN
    ALTER TABLE quotations ADD COLUMN acknowledgment_text text DEFAULT 'I hereby acknowledge that I have read, understand, and agree to the terms of this document relating to my group booking.';
  END IF;
END $$;

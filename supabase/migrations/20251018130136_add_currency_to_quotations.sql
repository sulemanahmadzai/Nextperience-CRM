/*
  # Add currency field to quotations

  1. Changes
    - Add `currency` column to quotations table (default 'PHP')
  
  2. Notes
    - This allows tracking the currency for each quotation
*/

ALTER TABLE quotations ADD COLUMN IF NOT EXISTS currency text DEFAULT 'PHP';

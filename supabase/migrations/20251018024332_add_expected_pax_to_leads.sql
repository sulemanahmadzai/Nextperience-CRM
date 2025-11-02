/*
  # Add Expected PAX field to Leads

  ## Changes
  - Add `expected_pax` (integer) - Number of expected participants/attendees
  
  ## Notes
  - Default value is NULL (not all events may have pax count)
  - Useful for event planning and capacity management
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'expected_pax'
  ) THEN
    ALTER TABLE leads ADD COLUMN expected_pax integer;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_leads_expected_pax ON leads(expected_pax) WHERE expected_pax IS NOT NULL;

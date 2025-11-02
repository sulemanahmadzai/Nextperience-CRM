/*
  # Add section_body to template_line_items

  1. Changes to `template_line_items` table
    - Add `section_body` column (text, optional)
    - Used for section items to store body/content text
    - Provides better formatting for section headers

  2. Notes
    - Section items now have both a name (header) and body (content)
    - Product items don't use this field
*/

-- Add section_body column to template_line_items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'template_line_items' AND column_name = 'section_body'
  ) THEN
    ALTER TABLE template_line_items
    ADD COLUMN section_body text;
  END IF;
END $$;

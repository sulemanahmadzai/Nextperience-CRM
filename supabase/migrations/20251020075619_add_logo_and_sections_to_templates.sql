/*
  # Add Logo and Custom Sections to Templates

  1. Changes to `quotation_templates` table
    - Add `logo_url` (text, URL or data URI for logo image)
    - Add `logo_position` (text, one of: 'left', 'center', 'right')
    - Add `logo_max_width` (integer, max width in pixels, default 200)
    - Add `custom_sections` (jsonb, array of additional sections with title and content)
  
  2. Notes
    - Logo fields are optional
    - Custom sections stored as JSON array: [{title: string, content: string, order: number}]
    - All fields maintain existing data
*/

-- Add logo fields to quotation_templates table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotation_templates' AND column_name = 'logo_url'
  ) THEN
    ALTER TABLE quotation_templates ADD COLUMN logo_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotation_templates' AND column_name = 'logo_position'
  ) THEN
    ALTER TABLE quotation_templates ADD COLUMN logo_position text DEFAULT 'left' CHECK (logo_position IN ('left', 'center', 'right'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotation_templates' AND column_name = 'logo_max_width'
  ) THEN
    ALTER TABLE quotation_templates ADD COLUMN logo_max_width integer DEFAULT 200 CHECK (logo_max_width >= 50 AND logo_max_width <= 500);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotation_templates' AND column_name = 'custom_sections'
  ) THEN
    ALTER TABLE quotation_templates ADD COLUMN custom_sections jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;

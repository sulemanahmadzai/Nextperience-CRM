/*
  # Add item_type to template_line_items

  1. Changes to `template_line_items` table
    - Add `item_type` column (text, either 'product' or 'section', default 'product')
    - Allows template line items to be either products or section headers
  
  2. Notes
    - Section items are used as visual separators/headers in quotations
    - Product items have pricing, quantity, etc.
    - Existing items default to 'product' type
*/

-- Add item_type column to template_line_items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'template_line_items' AND column_name = 'item_type'
  ) THEN
    ALTER TABLE template_line_items 
    ADD COLUMN item_type text DEFAULT 'product' CHECK (item_type IN ('product', 'section'));
  END IF;
END $$;

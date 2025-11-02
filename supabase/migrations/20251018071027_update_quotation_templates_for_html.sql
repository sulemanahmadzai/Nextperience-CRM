/*
  # Update Quotation Templates for HTML Support

  1. Modifications to `quotation_templates`
    - Add `body_html` (text) - rich HTML content for intro/body
    - Add `terms_html` (text) - policies/terms & conditions HTML
    - Add `is_default` (boolean) - whether this is the default template for the company
    - Rename `is_active` to `archived` (invert logic for consistency)

  2. Create `template_line_items` table
    - Stores preset line items for templates
    - Links to quotation_templates

  3. Update `quotations` table
    - Add `body_html`, `terms_html`, `template_id` columns

  4. Security
    - Add RLS policies for new template_line_items table
    - Update existing policies to use role joins
*/

-- Add new columns to quotation_templates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'quotation_templates' AND column_name = 'body_html'
  ) THEN
    ALTER TABLE quotation_templates ADD COLUMN body_html text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'quotation_templates' AND column_name = 'terms_html'
  ) THEN
    ALTER TABLE quotation_templates ADD COLUMN terms_html text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'quotation_templates' AND column_name = 'is_default'
  ) THEN
    ALTER TABLE quotation_templates ADD COLUMN is_default boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'quotation_templates' AND column_name = 'archived'
  ) THEN
    ALTER TABLE quotation_templates ADD COLUMN archived boolean DEFAULT false;
    UPDATE quotation_templates SET archived = NOT COALESCE(is_active, true);
  END IF;
END $$;

-- Create template_line_items table
CREATE TABLE IF NOT EXISTS template_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES quotation_templates(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text DEFAULT '',
  unit text DEFAULT 'unit',
  default_quantity decimal(10,2) DEFAULT 1,
  default_price decimal(10,2) DEFAULT 0,
  tax_code text DEFAULT '',
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Add columns to quotations table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'quotations' AND column_name = 'body_html'
  ) THEN
    ALTER TABLE quotations ADD COLUMN body_html text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'quotations' AND column_name = 'terms_html'
  ) THEN
    ALTER TABLE quotations ADD COLUMN terms_html text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'quotations' AND column_name = 'template_id'
  ) THEN
    ALTER TABLE quotations ADD COLUMN template_id uuid REFERENCES quotation_templates(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Enable RLS on template_line_items
ALTER TABLE template_line_items ENABLE ROW LEVEL SECURITY;

-- Drop existing policies on quotation_templates if they exist
DROP POLICY IF EXISTS "Users can view templates in their company" ON quotation_templates;
DROP POLICY IF EXISTS "Admins and managers can create templates" ON quotation_templates;
DROP POLICY IF EXISTS "Admins and managers can update templates" ON quotation_templates;
DROP POLICY IF EXISTS "Admins and managers can delete templates" ON quotation_templates;

-- Recreate policies for quotation_templates with correct role joins
CREATE POLICY "Users can view templates in their company"
  ON quotation_templates FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_company_roles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins and managers can create templates"
  ON quotation_templates FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT ucr.company_id 
      FROM user_company_roles ucr
      JOIN roles r ON r.id = ucr.role_id
      WHERE ucr.user_id = auth.uid() 
      AND r.name IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admins and managers can update templates"
  ON quotation_templates FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT ucr.company_id 
      FROM user_company_roles ucr
      JOIN roles r ON r.id = ucr.role_id
      WHERE ucr.user_id = auth.uid() 
      AND r.name IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admins and managers can delete templates"
  ON quotation_templates FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT ucr.company_id 
      FROM user_company_roles ucr
      JOIN roles r ON r.id = ucr.role_id
      WHERE ucr.user_id = auth.uid() 
      AND r.name IN ('admin', 'manager')
    )
  );

-- Policies for template_line_items
CREATE POLICY "Users can view template line items in their company"
  ON template_line_items FOR SELECT
  TO authenticated
  USING (
    template_id IN (
      SELECT id FROM quotation_templates 
      WHERE company_id IN (
        SELECT company_id FROM user_company_roles WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Admins and managers can create template line items"
  ON template_line_items FOR INSERT
  TO authenticated
  WITH CHECK (
    template_id IN (
      SELECT t.id FROM quotation_templates t
      WHERE t.company_id IN (
        SELECT ucr.company_id 
        FROM user_company_roles ucr
        JOIN roles r ON r.id = ucr.role_id
        WHERE ucr.user_id = auth.uid() 
        AND r.name IN ('admin', 'manager')
      )
    )
  );

CREATE POLICY "Admins and managers can update template line items"
  ON template_line_items FOR UPDATE
  TO authenticated
  USING (
    template_id IN (
      SELECT t.id FROM quotation_templates t
      WHERE t.company_id IN (
        SELECT ucr.company_id 
        FROM user_company_roles ucr
        JOIN roles r ON r.id = ucr.role_id
        WHERE ucr.user_id = auth.uid() 
        AND r.name IN ('admin', 'manager')
      )
    )
  );

CREATE POLICY "Admins and managers can delete template line items"
  ON template_line_items FOR DELETE
  TO authenticated
  USING (
    template_id IN (
      SELECT t.id FROM quotation_templates t
      WHERE t.company_id IN (
        SELECT ucr.company_id 
        FROM user_company_roles ucr
        JOIN roles r ON r.id = ucr.role_id
        WHERE ucr.user_id = auth.uid() 
        AND r.name IN ('admin', 'manager')
      )
    )
  );

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_quotation_templates_company ON quotation_templates(company_id, archived);
CREATE INDEX IF NOT EXISTS idx_template_line_items_template ON template_line_items(template_id, sort_order);

-- Create function to ensure only one default template per company
CREATE OR REPLACE FUNCTION ensure_single_default_template()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE quotation_templates 
    SET is_default = false 
    WHERE company_id = NEW.company_id 
    AND id != NEW.id 
    AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS ensure_single_default_template_trigger ON quotation_templates;
CREATE TRIGGER ensure_single_default_template_trigger
  BEFORE INSERT OR UPDATE ON quotation_templates
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_default_template();

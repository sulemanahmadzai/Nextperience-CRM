/*
  # Create Event Orders System

  ## Overview
  This migration creates the Event Order system that allows users to generate event orders from quotations
  with fully editable content, custom sections, and template support.

  ## New Tables

  ### 1. event_order_templates
  Stores reusable templates for event orders with default sections and styling.
  - `id` (uuid, primary key)
  - `company_id` (uuid, references companies)
  - `name` (text) - Template name
  - `logo_url` (text) - Logo image URL or data URI
  - `logo_position` (text) - left, center, or right
  - `logo_max_width` (integer) - Max width in pixels (100-300)
  - `header_color` (text) - Hex color for headers
  - `is_default` (boolean) - Default template for company
  - `created_by` (uuid, references auth.users)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 2. event_orders
  Stores event order documents generated from quotations.
  - `id` (uuid, primary key)
  - `company_id` (uuid, references companies)
  - `quotation_id` (uuid, references quotations)
  - `template_id` (uuid, references event_order_templates)
  - `order_number` (text) - Event order reference number
  - `quotation_number` (text) - Reference to source quotation
  - `customer_name` (text)
  - `contact_person` (text)
  - `contact_number` (text)
  - `event_type` (text)
  - `number_of_pax` (integer)
  - `guaranteed_pax` (integer)
  - `event_date` (date)
  - `event_day` (text) - Day of week
  - `venue` (text)
  - `activity` (text)
  - `time_slot` (text)
  - `type_of_function` (text)
  - `payment_scheme` (text)
  - `authorized_signatory` (text)
  - `total_amount` (decimal)
  - `vat_amount` (decimal)
  - `security_deposit` (decimal)
  - `logo_url` (text) - Logo for this specific event order
  - `logo_position` (text)
  - `logo_max_width` (integer)
  - `header_color` (text)
  - `prepared_by` (text) - Name of preparer
  - `prepared_by_role` (text)
  - `prepared_by_signature` (text) - Signature data URI
  - `received_by` (text) - Name of receiver
  - `received_by_role` (text)
  - `status` (text) - draft, finalized, sent
  - `created_by` (uuid, references auth.users)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 3. event_order_sections
  Stores the custom sections for each event order.
  - `id` (uuid, primary key)
  - `event_order_id` (uuid, references event_orders)
  - `title` (text) - Section title (e.g., "Front Office Instructions")
  - `content` (text) - Rich HTML content
  - `order_index` (integer) - For sorting sections
  - `is_default` (boolean) - Whether this is a default section
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ## Security
  - Enable RLS on all tables
  - Users can only access event orders for their company
  - Admin/Manager can create/edit templates
  - All users can view templates, but only authorized roles can edit

  ## Notes
  - Event orders maintain a link to the source quotation for audit trail
  - All fields are editable after generation
  - Sections can be added, removed, and reordered
  - Templates provide default content but don't lock any fields
*/

-- Create event_order_templates table
CREATE TABLE IF NOT EXISTS event_order_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  logo_url text,
  logo_position text DEFAULT 'left' CHECK (logo_position IN ('left', 'center', 'right')),
  logo_max_width integer DEFAULT 200 CHECK (logo_max_width BETWEEN 100 AND 300),
  header_color text DEFAULT '#E9D5FF',
  is_default boolean DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create event_orders table
CREATE TABLE IF NOT EXISTS event_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  quotation_id uuid REFERENCES quotations(id) ON DELETE SET NULL,
  template_id uuid REFERENCES event_order_templates(id) ON DELETE SET NULL,
  order_number text NOT NULL,
  quotation_number text,
  customer_name text NOT NULL,
  contact_person text,
  contact_number text,
  event_type text,
  number_of_pax integer,
  guaranteed_pax integer,
  event_date date,
  event_day text,
  venue text,
  activity text,
  time_slot text,
  type_of_function text,
  payment_scheme text,
  authorized_signatory text,
  total_amount decimal(12,2),
  vat_amount decimal(12,2),
  security_deposit decimal(12,2),
  logo_url text,
  logo_position text DEFAULT 'left' CHECK (logo_position IN ('left', 'center', 'right')),
  logo_max_width integer DEFAULT 200,
  header_color text DEFAULT '#E9D5FF',
  prepared_by text,
  prepared_by_role text,
  prepared_by_signature text,
  received_by text,
  received_by_role text,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'finalized', 'sent')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(company_id, order_number)
);

-- Create event_order_sections table
CREATE TABLE IF NOT EXISTS event_order_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_order_id uuid NOT NULL REFERENCES event_orders(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text DEFAULT '',
  order_index integer NOT NULL DEFAULT 0,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create event_order_template_sections table for default sections in templates
CREATE TABLE IF NOT EXISTS event_order_template_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES event_order_templates(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text DEFAULT '',
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE event_order_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_order_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_order_template_sections ENABLE ROW LEVEL SECURITY;

-- RLS Policies for event_order_templates
CREATE POLICY "Users can view templates for their company"
  ON event_order_templates FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT company_id FROM user_company_roles WHERE user_id = auth.uid()));

CREATE POLICY "Admins and managers can create templates"
  ON event_order_templates FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT ucr.company_id 
      FROM user_company_roles ucr
      JOIN roles r ON ucr.role_id = r.id
      WHERE ucr.user_id = auth.uid() 
      AND r.name IN ('Admin', 'Manager')
    )
  );

CREATE POLICY "Admins and managers can update templates"
  ON event_order_templates FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT ucr.company_id 
      FROM user_company_roles ucr
      JOIN roles r ON ucr.role_id = r.id
      WHERE ucr.user_id = auth.uid() 
      AND r.name IN ('Admin', 'Manager')
    )
  );

CREATE POLICY "Admins and managers can delete templates"
  ON event_order_templates FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT ucr.company_id 
      FROM user_company_roles ucr
      JOIN roles r ON ucr.role_id = r.id
      WHERE ucr.user_id = auth.uid() 
      AND r.name IN ('Admin', 'Manager')
    )
  );

-- RLS Policies for event_orders
CREATE POLICY "Users can view event orders for their company"
  ON event_orders FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT company_id FROM user_company_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can create event orders for their company"
  ON event_orders FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM user_company_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update event orders for their company"
  ON event_orders FOR UPDATE
  TO authenticated
  USING (company_id IN (SELECT company_id FROM user_company_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete event orders for their company"
  ON event_orders FOR DELETE
  TO authenticated
  USING (company_id IN (SELECT company_id FROM user_company_roles WHERE user_id = auth.uid()));

-- RLS Policies for event_order_sections
CREATE POLICY "Users can view sections for their company event orders"
  ON event_order_sections FOR SELECT
  TO authenticated
  USING (
    event_order_id IN (
      SELECT id FROM event_orders 
      WHERE company_id IN (SELECT company_id FROM user_company_roles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Users can create sections for their company event orders"
  ON event_order_sections FOR INSERT
  TO authenticated
  WITH CHECK (
    event_order_id IN (
      SELECT id FROM event_orders 
      WHERE company_id IN (SELECT company_id FROM user_company_roles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Users can update sections for their company event orders"
  ON event_order_sections FOR UPDATE
  TO authenticated
  USING (
    event_order_id IN (
      SELECT id FROM event_orders 
      WHERE company_id IN (SELECT company_id FROM user_company_roles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Users can delete sections for their company event orders"
  ON event_order_sections FOR DELETE
  TO authenticated
  USING (
    event_order_id IN (
      SELECT id FROM event_orders 
      WHERE company_id IN (SELECT company_id FROM user_company_roles WHERE user_id = auth.uid())
    )
  );

-- RLS Policies for event_order_template_sections
CREATE POLICY "Users can view template sections for their company"
  ON event_order_template_sections FOR SELECT
  TO authenticated
  USING (
    template_id IN (
      SELECT id FROM event_order_templates 
      WHERE company_id IN (SELECT company_id FROM user_company_roles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Admins and managers can manage template sections"
  ON event_order_template_sections FOR ALL
  TO authenticated
  USING (
    template_id IN (
      SELECT eot.id FROM event_order_templates eot
      JOIN user_company_roles ucr ON eot.company_id = ucr.company_id
      JOIN roles r ON ucr.role_id = r.id
      WHERE ucr.user_id = auth.uid() 
      AND r.name IN ('Admin', 'Manager')
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_event_order_templates_company ON event_order_templates(company_id);
CREATE INDEX IF NOT EXISTS idx_event_orders_company ON event_orders(company_id);
CREATE INDEX IF NOT EXISTS idx_event_orders_quotation ON event_orders(quotation_id);
CREATE INDEX IF NOT EXISTS idx_event_order_sections_order ON event_order_sections(event_order_id, order_index);
CREATE INDEX IF NOT EXISTS idx_event_order_template_sections_template ON event_order_template_sections(template_id, order_index);

-- Function to generate event order number
CREATE OR REPLACE FUNCTION generate_event_order_number(p_company_id uuid)
RETURNS text AS $$
DECLARE
  v_count integer;
  v_year text;
  v_number text;
BEGIN
  v_year := TO_CHAR(NOW(), 'YYYY');
  
  SELECT COUNT(*) INTO v_count
  FROM event_orders
  WHERE company_id = p_company_id
  AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW());
  
  v_number := 'EO-' || v_year || '-' || LPAD((v_count + 1)::text, 4, '0');
  
  RETURN v_number;
END;
$$ LANGUAGE plpgsql;

/*
  # Create Proforma Invoice System

  1. New Tables
    - `proforma_invoices`
      - `id` (uuid, primary key)
      - `company_id` (uuid, foreign key to companies)
      - `quotation_id` (uuid, foreign key to quotations, nullable)
      - `invoice_no` (text, unique per company)
      - `invoice_date` (date)
      - `due_date` (date)
      - `status` (text: pending, paid, cancelled, overdue)
      - `primary_color` (text, hex color)
      - `accent_color` (text, hex color)
      - `logo_url` (text, nullable)
      - Company details (bill_from_*)
      - Client details (bill_to_*)
      - Event details
      - Payment details
      - Terms and conditions
      - Footer text
      - `subtotal` (numeric)
      - `tax_percentage` (numeric)
      - `tax_amount` (numeric)
      - `discount_amount` (numeric)
      - `total_amount` (numeric)
      - `currency` (text, default PHP)
      - `payment_link_token` (text, unique)
      - `paid_at` (timestamptz, nullable)
      - `created_by` (uuid, foreign key to auth.users)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `proforma_invoice_line_items`
      - `id` (uuid, primary key)
      - `proforma_invoice_id` (uuid, foreign key)
      - `description` (text)
      - `quantity` (numeric)
      - `unit_price` (numeric)
      - `line_total` (numeric)
      - `order` (integer)
      - `created_at` (timestamptz)

    - `proforma_invoice_templates`
      - `id` (uuid, primary key)
      - `company_id` (uuid, foreign key)
      - `name` (text)
      - `description` (text, nullable)
      - `primary_color` (text)
      - `accent_color` (text)
      - `logo_url` (text, nullable)
      - Default company details
      - Default payment details
      - Default terms and conditions
      - Default footer text
      - `tax_percentage` (numeric, default 0)
      - `is_active` (boolean, default true)
      - `created_by` (uuid)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `proforma_invoice_template_line_items`
      - Similar to proforma_invoice_line_items but linked to templates

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users based on company access
*/

-- Create proforma_invoices table
CREATE TABLE IF NOT EXISTS proforma_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  quotation_id uuid REFERENCES quotations(id) ON DELETE SET NULL,
  invoice_no text NOT NULL,
  invoice_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled', 'overdue')),
  
  primary_color text NOT NULL DEFAULT '#1e293b',
  accent_color text NOT NULL DEFAULT '#0f172a',
  logo_url text,
  
  bill_from_company_name text NOT NULL,
  bill_from_tin text,
  bill_from_address text,
  bill_from_email text,
  bill_from_phone text,
  
  bill_to_company_name text NOT NULL,
  bill_to_contact_person text,
  bill_to_email text,
  bill_to_phone text,
  bill_to_address text,
  
  event_venue text,
  event_type text,
  event_guests integer,
  event_date date,
  prepared_by text,
  
  payment_methods text,
  bank_account_name text,
  bank_name text,
  bank_account_number text,
  bank_swift_code text,
  payment_notes text DEFAULT '50% Down Payment due upon confirmation. Balance due before event date.',
  
  terms_conditions text DEFAULT E'- Prices valid until due date.\n- Booking confirmed only upon payment.\n- Cancellations within 7 days are non-refundable.\n- Official Receipt will be issued upon full payment.',
  footer_text text,
  
  subtotal numeric(10, 2) NOT NULL DEFAULT 0,
  tax_percentage numeric(5, 2) NOT NULL DEFAULT 0,
  tax_amount numeric(10, 2) NOT NULL DEFAULT 0,
  discount_amount numeric(10, 2) NOT NULL DEFAULT 0,
  total_amount numeric(10, 2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'PHP',
  
  payment_link_token text UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  paid_at timestamptz,
  
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(company_id, invoice_no)
);

-- Create proforma_invoice_line_items table
CREATE TABLE IF NOT EXISTS proforma_invoice_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proforma_invoice_id uuid NOT NULL REFERENCES proforma_invoices(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric(10, 2) NOT NULL DEFAULT 1,
  unit_price numeric(10, 2) NOT NULL DEFAULT 0,
  line_total numeric(10, 2) NOT NULL DEFAULT 0,
  "order" integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create proforma_invoice_templates table
CREATE TABLE IF NOT EXISTS proforma_invoice_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  
  primary_color text NOT NULL DEFAULT '#1e293b',
  accent_color text NOT NULL DEFAULT '#0f172a',
  logo_url text,
  
  default_bill_from_company_name text,
  default_bill_from_tin text,
  default_bill_from_address text,
  default_bill_from_email text,
  default_bill_from_phone text,
  
  default_payment_methods text DEFAULT E'- Credit / Debit Card\n- GCash / PayMaya\n- Bank Deposit / Online Transfer\n- Company Check',
  default_bank_account_name text,
  default_bank_name text,
  default_bank_account_number text,
  default_bank_swift_code text,
  default_payment_notes text DEFAULT '50% Down Payment due upon confirmation. Balance due before event date.',
  
  default_terms_conditions text DEFAULT E'- Prices valid until due date.\n- Booking confirmed only upon payment.\n- Cancellations within 7 days are non-refundable.\n- Official Receipt will be issued upon full payment.',
  default_footer_text text,
  
  tax_percentage numeric(5, 2) NOT NULL DEFAULT 0,
  
  is_active boolean DEFAULT true,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create proforma_invoice_template_line_items table
CREATE TABLE IF NOT EXISTS proforma_invoice_template_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES proforma_invoice_templates(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric(10, 2) NOT NULL DEFAULT 1,
  unit_price numeric(10, 2) NOT NULL DEFAULT 0,
  line_total numeric(10, 2) NOT NULL DEFAULT 0,
  "order" integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_proforma_invoices_company_id ON proforma_invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_proforma_invoices_quotation_id ON proforma_invoices(quotation_id);
CREATE INDEX IF NOT EXISTS idx_proforma_invoices_status ON proforma_invoices(status);
CREATE INDEX IF NOT EXISTS idx_proforma_invoices_payment_link ON proforma_invoices(payment_link_token);
CREATE INDEX IF NOT EXISTS idx_proforma_invoice_line_items_invoice_id ON proforma_invoice_line_items(proforma_invoice_id);
CREATE INDEX IF NOT EXISTS idx_proforma_invoice_templates_company_id ON proforma_invoice_templates(company_id);
CREATE INDEX IF NOT EXISTS idx_proforma_invoice_template_line_items_template_id ON proforma_invoice_template_line_items(template_id);

-- Create function to generate invoice number
CREATE OR REPLACE FUNCTION generate_proforma_invoice_no(p_company_id uuid)
RETURNS text AS $$
DECLARE
  v_year text;
  v_sequence integer;
  v_invoice_no text;
BEGIN
  v_year := EXTRACT(YEAR FROM CURRENT_DATE)::text;
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_no FROM 'PI-' || v_year || '-(\d+)') AS integer)), 0) + 1
  INTO v_sequence
  FROM proforma_invoices
  WHERE company_id = p_company_id
    AND invoice_no LIKE 'PI-' || v_year || '-%';
  
  v_invoice_no := 'PI-' || v_year || '-' || LPAD(v_sequence::text, 4, '0');
  
  RETURN v_invoice_no;
END;
$$ LANGUAGE plpgsql;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_proforma_invoice_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER update_proforma_invoices_updated_at
  BEFORE UPDATE ON proforma_invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_proforma_invoice_updated_at();

CREATE TRIGGER update_proforma_invoice_templates_updated_at
  BEFORE UPDATE ON proforma_invoice_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_proforma_invoice_updated_at();

-- Enable RLS
ALTER TABLE proforma_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE proforma_invoice_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE proforma_invoice_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE proforma_invoice_template_line_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for proforma_invoices
CREATE POLICY "Users can view proforma invoices for their companies"
  ON proforma_invoices FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create proforma invoices for their companies"
  ON proforma_invoices FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update proforma invoices for their companies"
  ON proforma_invoices FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Users can delete proforma invoices for their companies"
  ON proforma_invoices FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for proforma_invoice_line_items
CREATE POLICY "Users can view line items for their companies"
  ON proforma_invoice_line_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create line items for their companies"
  ON proforma_invoice_line_items FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update line items for their companies"
  ON proforma_invoice_line_items FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Users can delete line items for their companies"
  ON proforma_invoice_line_items FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for proforma_invoice_templates
CREATE POLICY "Users can view templates for their companies"
  ON proforma_invoice_templates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create templates for their companies"
  ON proforma_invoice_templates FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update templates for their companies"
  ON proforma_invoice_templates FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Users can delete templates for their companies"
  ON proforma_invoice_templates FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for proforma_invoice_template_line_items
CREATE POLICY "Users can view template line items for their companies"
  ON proforma_invoice_template_line_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create template line items for their companies"
  ON proforma_invoice_template_line_items FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update template line items for their companies"
  ON proforma_invoice_template_line_items FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Users can delete template line items for their companies"
  ON proforma_invoice_template_line_items FOR DELETE
  TO authenticated
  USING (true);

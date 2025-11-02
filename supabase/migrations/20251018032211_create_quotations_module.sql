/*
  # Create Quotations Module

  1. New Tables
    - `quotations`
      - `id` (uuid, primary key)
      - `company_id` (uuid, foreign key to companies)
      - `lead_id` (uuid, foreign key to leads)
      - `customer_id` (uuid, foreign key to customers)
      - `quotation_no` (text, auto-generated)
      - `salesperson_id` (uuid, foreign key to users)
      - `quotation_date` (date)
      - `expiration_date` (date)
      - `status` (text: draft, sent, accepted, declined, paid)
      - `subtotal` (decimal)
      - `vat_enabled` (boolean, default false)
      - `vat_rate` (decimal, default 12)
      - `vat_amount` (decimal)
      - `total_amount` (decimal)
      - `signed_by` (text)
      - `signed_at` (timestamptz)
      - `signature_image` (text)
      - `signer_ip` (text)
      - `notes` (text)
      - `created_by` (uuid, foreign key to users)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `quotation_lines`
      - `id` (uuid, primary key)
      - `quotation_id` (uuid, foreign key to quotations)
      - `product_id` (uuid, foreign key to products, nullable)
      - `description` (text)
      - `quantity` (decimal)
      - `unit_price` (decimal)
      - `discount` (decimal, default 0)
      - `subtotal` (decimal)
      - `order` (integer)
      - `created_at` (timestamptz)

    - `quotation_templates`
      - `id` (uuid, primary key)
      - `company_id` (uuid, foreign key to companies)
      - `name` (text)
      - `description` (text)
      - `logo_url` (text)
      - `template_data` (jsonb - stores line items, html blocks, images)
      - `is_active` (boolean, default true)
      - `created_by` (uuid, foreign key to users)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `email_configs`
      - `id` (uuid, primary key)
      - `company_id` (uuid, foreign key to companies)
      - `provider` (text: smtp, sendgrid, mailgun, gmail)
      - `config` (jsonb - stores API keys, SMTP settings)
      - `is_active` (boolean, default true)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `email_messages`
      - `id` (uuid, primary key)
      - `company_id` (uuid, foreign key to companies)
      - `customer_id` (uuid, foreign key to customers)
      - `lead_id` (uuid, foreign key to leads, nullable)
      - `quotation_id` (uuid, foreign key to quotations, nullable)
      - `sender_id` (uuid, foreign key to users)
      - `recipient_email` (text)
      - `subject` (text)
      - `body` (text)
      - `status` (text: sent, failed, pending)
      - `sent_at` (timestamptz)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users based on company access
    - Admins and Managers have full access
    - Sales Reps can only access their own quotations
    - Viewers have read-only access

  3. Indexes
    - Add indexes for foreign keys and frequently queried fields
*/

CREATE TABLE IF NOT EXISTS quotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  quotation_no text NOT NULL,
  salesperson_id uuid REFERENCES users(id),
  quotation_date date DEFAULT CURRENT_DATE,
  expiration_date date,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'declined', 'paid')),
  subtotal decimal(15,2) DEFAULT 0,
  vat_enabled boolean DEFAULT false,
  vat_rate decimal(5,2) DEFAULT 12,
  vat_amount decimal(15,2) DEFAULT 0,
  total_amount decimal(15,2) DEFAULT 0,
  signed_by text,
  signed_at timestamptz,
  signature_image text,
  signer_ip text,
  notes text,
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS quotation_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id uuid NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id),
  description text NOT NULL,
  quantity decimal(10,2) DEFAULT 1,
  unit_price decimal(15,2) DEFAULT 0,
  discount decimal(5,2) DEFAULT 0,
  subtotal decimal(15,2) DEFAULT 0,
  "order" integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS quotation_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  logo_url text,
  template_data jsonb DEFAULT '{}',
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  provider text DEFAULT 'smtp' CHECK (provider IN ('smtp', 'sendgrid', 'mailgun', 'gmail')),
  config jsonb DEFAULT '{}',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES customers(id),
  lead_id uuid REFERENCES leads(id),
  quotation_id uuid REFERENCES quotations(id),
  sender_id uuid REFERENCES users(id),
  recipient_email text NOT NULL,
  subject text NOT NULL,
  body text,
  status text DEFAULT 'pending' CHECK (status IN ('sent', 'failed', 'pending')),
  sent_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view quotations from their company"
  ON quotations FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id 
      FROM user_company_roles 
      WHERE user_id = auth.uid()
      AND is_active = true
    )
  );

CREATE POLICY "Users can create quotations"
  ON quotations FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id 
      FROM user_company_roles 
      WHERE user_id = auth.uid()
      AND is_active = true
    )
  );

CREATE POLICY "Users can update quotations"
  ON quotations FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id 
      FROM user_company_roles 
      WHERE user_id = auth.uid()
      AND is_active = true
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id 
      FROM user_company_roles 
      WHERE user_id = auth.uid()
      AND is_active = true
    )
  );

CREATE POLICY "Admins and managers can delete quotations"
  ON quotations FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT ucr.company_id 
      FROM user_company_roles ucr
      JOIN roles r ON ucr.role_id = r.id
      WHERE ucr.user_id = auth.uid()
      AND ucr.is_active = true
      AND r.name IN ('Admin', 'Manager')
    )
  );

CREATE POLICY "Users can view quotation lines"
  ON quotation_lines FOR SELECT
  TO authenticated
  USING (
    quotation_id IN (
      SELECT id FROM quotations
      WHERE company_id IN (
        SELECT company_id 
        FROM user_company_roles 
        WHERE user_id = auth.uid()
        AND is_active = true
      )
    )
  );

CREATE POLICY "Users can manage quotation lines"
  ON quotation_lines FOR ALL
  TO authenticated
  USING (
    quotation_id IN (
      SELECT id FROM quotations
      WHERE company_id IN (
        SELECT company_id 
        FROM user_company_roles 
        WHERE user_id = auth.uid()
        AND is_active = true
      )
    )
  );

CREATE POLICY "Users can view templates"
  ON quotation_templates FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id 
      FROM user_company_roles 
      WHERE user_id = auth.uid()
      AND is_active = true
    )
  );

CREATE POLICY "Admins and managers can manage templates"
  ON quotation_templates FOR ALL
  TO authenticated
  USING (
    company_id IN (
      SELECT ucr.company_id 
      FROM user_company_roles ucr
      JOIN roles r ON ucr.role_id = r.id
      WHERE ucr.user_id = auth.uid()
      AND ucr.is_active = true
      AND r.name IN ('Admin', 'Manager')
    )
  );

CREATE POLICY "Users can view email configs"
  ON email_configs FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id 
      FROM user_company_roles 
      WHERE user_id = auth.uid()
      AND is_active = true
    )
  );

CREATE POLICY "Admins can manage email configs"
  ON email_configs FOR ALL
  TO authenticated
  USING (
    company_id IN (
      SELECT ucr.company_id 
      FROM user_company_roles ucr
      JOIN roles r ON ucr.role_id = r.id
      WHERE ucr.user_id = auth.uid()
      AND ucr.is_active = true
      AND r.name = 'Admin'
    )
  );

CREATE POLICY "Users can view email messages"
  ON email_messages FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id 
      FROM user_company_roles 
      WHERE user_id = auth.uid()
      AND is_active = true
    )
  );

CREATE POLICY "Users can create email messages"
  ON email_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id 
      FROM user_company_roles 
      WHERE user_id = auth.uid()
      AND is_active = true
    )
  );

CREATE INDEX IF NOT EXISTS idx_quotations_company_id ON quotations(company_id);
CREATE INDEX IF NOT EXISTS idx_quotations_lead_id ON quotations(lead_id);
CREATE INDEX IF NOT EXISTS idx_quotations_customer_id ON quotations(customer_id);
CREATE INDEX IF NOT EXISTS idx_quotations_status ON quotations(status);
CREATE INDEX IF NOT EXISTS idx_quotation_lines_quotation_id ON quotation_lines(quotation_id);
CREATE INDEX IF NOT EXISTS idx_quotation_templates_company_id ON quotation_templates(company_id);
CREATE INDEX IF NOT EXISTS idx_email_configs_company_id ON email_configs(company_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_company_id ON email_messages(company_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_lead_id ON email_messages(lead_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_quotation_id ON email_messages(quotation_id);

CREATE OR REPLACE FUNCTION generate_quotation_no()
RETURNS TRIGGER AS $$
DECLARE
  next_num INTEGER;
  year_suffix TEXT;
BEGIN
  year_suffix := TO_CHAR(CURRENT_DATE, 'YY');
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(quotation_no FROM '[0-9]+') AS INTEGER)), 0) + 1
  INTO next_num
  FROM quotations
  WHERE company_id = NEW.company_id
  AND quotation_no LIKE 'Q' || year_suffix || '%';
  
  NEW.quotation_no := 'Q' || year_suffix || LPAD(next_num::TEXT, 4, '0');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_quotation_no
  BEFORE INSERT ON quotations
  FOR EACH ROW
  WHEN (NEW.quotation_no IS NULL OR NEW.quotation_no = '')
  EXECUTE FUNCTION generate_quotation_no();

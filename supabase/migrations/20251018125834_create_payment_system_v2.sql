/*
  # Create Payment System

  1. New Tables
    - `payment_gateway_configs`
      - `id` (uuid, primary key)
      - `company_id` (uuid, foreign key to companies)
      - `provider` (text: paypal, xendit, custom)
      - `is_active` (boolean)
      - `is_test_mode` (boolean)
      - `config` (jsonb - stores API keys, credentials)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `payments`
      - `id` (uuid, primary key)
      - `company_id` (uuid, foreign key to companies)
      - `quotation_id` (uuid, foreign key to quotations)
      - `customer_id` (uuid, foreign key to customers)
      - `amount` (decimal)
      - `currency` (text)
      - `payment_method` (text: paypal, xendit, custom, test)
      - `payment_status` (text: pending, completed, failed, refunded)
      - `transaction_id` (text, external payment reference)
      - `payment_date` (timestamptz)
      - `verified_by` (uuid, foreign key to users, nullable)
      - `verified_at` (timestamptz, nullable)
      - `verification_status` (text: pending, verified, rejected, nullable)
      - `verification_notes` (text, nullable)
      - `metadata` (jsonb)
      - `created_by` (uuid, foreign key to users)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for company-based access
    - Finance Officers can verify payments

  3. Important Notes
    - Payment gateway credentials stored in config jsonb (encrypted in production)
    - Test mode allows simulation of payments
    - All payment actions logged to audit_logs
*/

-- Payment Gateway Configuration
CREATE TABLE IF NOT EXISTS payment_gateway_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('paypal', 'xendit', 'custom')),
  is_active boolean DEFAULT false,
  is_test_mode boolean DEFAULT true,
  config jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(company_id, provider)
);

-- Payments Table
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  quotation_id uuid NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  amount decimal(15,2) NOT NULL,
  currency text DEFAULT 'PHP',
  payment_method text NOT NULL,
  payment_status text DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),
  transaction_id text,
  payment_date timestamptz DEFAULT now(),
  verified_by uuid REFERENCES users(id) ON DELETE SET NULL,
  verified_at timestamptz,
  verification_status text CHECK (verification_status IN ('pending', 'verified', 'rejected')),
  verification_notes text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_payment_gateway_configs_company ON payment_gateway_configs(company_id);
CREATE INDEX IF NOT EXISTS idx_payments_company ON payments(company_id);
CREATE INDEX IF NOT EXISTS idx_payments_quotation ON payments(quotation_id);
CREATE INDEX IF NOT EXISTS idx_payments_customer ON payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(payment_status);
CREATE INDEX IF NOT EXISTS idx_payments_verification ON payments(verification_status);

-- Enable RLS
ALTER TABLE payment_gateway_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for payment_gateway_configs
CREATE POLICY "Users can view gateway configs in their company"
  ON payment_gateway_configs FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_company_roles
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage gateway configs"
  ON payment_gateway_configs FOR ALL
  TO authenticated
  USING (
    company_id IN (
      SELECT ucr.company_id FROM user_company_roles ucr
      JOIN roles r ON ucr.role_id = r.id
      WHERE ucr.user_id = auth.uid()
      AND r.name IN ('Admin', 'Super Admin')
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT ucr.company_id FROM user_company_roles ucr
      JOIN roles r ON ucr.role_id = r.id
      WHERE ucr.user_id = auth.uid()
      AND r.name IN ('Admin', 'Super Admin')
    )
  );

-- RLS Policies for payments
CREATE POLICY "Users can view payments in their company"
  ON payments FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_company_roles
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users with quotation access can create payments"
  ON payments FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_company_roles
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Finance Officers and Admins can update payments"
  ON payments FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT ucr.company_id FROM user_company_roles ucr
      JOIN roles r ON ucr.role_id = r.id
      WHERE ucr.user_id = auth.uid()
      AND r.name IN ('Admin', 'Super Admin', 'Finance Officer')
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT ucr.company_id FROM user_company_roles ucr
      JOIN roles r ON ucr.role_id = r.id
      WHERE ucr.user_id = auth.uid()
      AND r.name IN ('Admin', 'Super Admin', 'Finance Officer')
    )
  );

-- Get a default company_id for system roles
DO $$
DECLARE
  default_company_id uuid;
BEGIN
  SELECT id INTO default_company_id FROM companies ORDER BY created_at LIMIT 1;
  
  IF default_company_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM roles WHERE name = 'Finance Officer') THEN
    INSERT INTO roles (company_id, name, permissions, is_system)
    VALUES (
      default_company_id,
      'Finance Officer',
      jsonb_build_object(
        'customers', jsonb_build_object('read', true, 'create', false, 'update', false, 'delete', false),
        'leads', jsonb_build_object('read', true, 'create', false, 'update', false, 'delete', false),
        'quotations', jsonb_build_object('read', true, 'create', false, 'update', false, 'delete', false),
        'products', jsonb_build_object('read', true, 'create', false, 'update', false, 'delete', false),
        'activities', jsonb_build_object('read', true, 'create', true, 'update', false, 'delete', false),
        'templates', jsonb_build_object('read', true, 'create', false, 'update', false, 'delete', false),
        'payments', jsonb_build_object('read', true, 'create', false, 'update', true, 'delete', false),
        'settings', jsonb_build_object('read', false, 'create', false, 'update', false, 'delete', false)
      ),
      true
    );
  END IF;
END $$;

-- Update updated_at trigger for payment_gateway_configs
CREATE OR REPLACE FUNCTION update_payment_gateway_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER payment_gateway_configs_updated_at
  BEFORE UPDATE ON payment_gateway_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_payment_gateway_configs_updated_at();

-- Update updated_at trigger for payments
CREATE OR REPLACE FUNCTION update_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION update_payments_updated_at();

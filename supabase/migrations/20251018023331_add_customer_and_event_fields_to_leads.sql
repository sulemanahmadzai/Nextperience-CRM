/*
  # Add Customer Link and Event Fields to Leads

  ## Changes to Existing Tables
  
  ### leads table
  - Add `customer_id` (uuid, foreign key to customers, required)
  - Add `event_name` (text) - Name/title of the event
  - Add `event_date` (date) - Date of the event
  - Add `event_type` (text) - Type of event (Wedding, Corporate, etc.)
  - Add `event_value` (numeric) - Projected event value in PHP minor units (centavos)
  - Make `name`, `email`, `phone` nullable since they come from customer
  - Add index on customer_id for performance

  ## New Tables
  
  ### event_types
  Company-specific event type configurations
  - `id` (uuid, primary key)
  - `company_id` (uuid, foreign key to companies)
  - `name` (text) - Event type name
  - `is_active` (boolean) - Whether this type is active
  - `order` (integer) - Display order
  - `created_at` (timestamptz)

  ## Security
  - Enable RLS on event_types table
  - Users can view event types for their companies
  - Only admins can manage event types
*/

-- Create event_types table
CREATE TABLE IF NOT EXISTS event_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_active boolean DEFAULT true,
  "order" integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Add new fields to leads table
DO $$
BEGIN
  -- Add customer_id (will be populated later)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'customer_id'
  ) THEN
    ALTER TABLE leads ADD COLUMN customer_id uuid REFERENCES customers(id) ON DELETE SET NULL;
  END IF;

  -- Add event fields
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'event_name'
  ) THEN
    ALTER TABLE leads ADD COLUMN event_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'event_date'
  ) THEN
    ALTER TABLE leads ADD COLUMN event_date date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'event_type'
  ) THEN
    ALTER TABLE leads ADD COLUMN event_type text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'event_value'
  ) THEN
    ALTER TABLE leads ADD COLUMN event_value numeric(15, 2) DEFAULT 0;
  END IF;

  -- Make contact fields nullable (they now come from customer)
  ALTER TABLE leads ALTER COLUMN name DROP NOT NULL;
  ALTER TABLE leads ALTER COLUMN email DROP NOT NULL;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_leads_customer ON leads(customer_id);
CREATE INDEX IF NOT EXISTS idx_leads_event_date ON leads(event_date);
CREATE INDEX IF NOT EXISTS idx_event_types_company ON event_types(company_id);

-- Enable RLS on event_types
ALTER TABLE event_types ENABLE ROW LEVEL SECURITY;

-- RLS Policies for event_types
CREATE POLICY "Users can view event types for their companies"
  ON event_types FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_company_roles
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Admins can insert event types"
  ON event_types FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT ucr.company_id FROM user_company_roles ucr
      JOIN roles r ON r.id = ucr.role_id
      WHERE ucr.user_id = auth.uid() 
        AND ucr.is_active = true
        AND r.name = 'Admin'
    )
  );

CREATE POLICY "Admins can update event types"
  ON event_types FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT ucr.company_id FROM user_company_roles ucr
      JOIN roles r ON r.id = ucr.role_id
      WHERE ucr.user_id = auth.uid() 
        AND ucr.is_active = true
        AND r.name = 'Admin'
    )
  );

CREATE POLICY "Admins can delete event types"
  ON event_types FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT ucr.company_id FROM user_company_roles ucr
      JOIN roles r ON r.id = ucr.role_id
      WHERE ucr.user_id = auth.uid() 
        AND ucr.is_active = true
        AND r.name = 'Admin'
    )
  );

-- Insert default event types for all companies
INSERT INTO event_types (company_id, name, "order", is_active)
SELECT 
  c.id,
  type.name,
  type."order",
  true
FROM companies c
CROSS JOIN (
  VALUES
    ('Wedding', 0),
    ('Corporate Event', 1),
    ('School Tour', 2),
    ('Birthday', 3),
    ('Team Building', 4),
    ('Others', 5)
) AS type(name, "order")
WHERE NOT EXISTS (
  SELECT 1 FROM event_types et WHERE et.company_id = c.id
);

-- For existing leads without a customer, create a customer record from lead data
DO $$
DECLARE
  lead_record RECORD;
  new_customer_id uuid;
BEGIN
  FOR lead_record IN 
    SELECT id, company_id, name, email, phone, company_name, created_by
    FROM leads 
    WHERE customer_id IS NULL AND name IS NOT NULL
  LOOP
    -- Create a customer from the lead data
    INSERT INTO customers (
      company_id, 
      name, 
      email, 
      phone, 
      company_name,
      created_by,
      created_at
    )
    VALUES (
      lead_record.company_id,
      lead_record.name,
      lead_record.email,
      lead_record.phone,
      lead_record.company_name,
      lead_record.created_by,
      now()
    )
    RETURNING id INTO new_customer_id;

    -- Link the lead to the new customer
    UPDATE leads 
    SET customer_id = new_customer_id 
    WHERE id = lead_record.id;
  END LOOP;
END $$;

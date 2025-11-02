/*
  # Create Quotation Public Links and Customer Responses

  1. New Tables
    - `quotation_public_links`
      - `id` (uuid, primary key)
      - `quotation_id` (uuid, foreign key to quotations)
      - `token` (text, unique) - secure random token for the URL
      - `expires_at` (timestamptz) - when the link expires
      - `is_active` (boolean) - whether the link is still active
      - `created_at` (timestamptz)
      - `created_by` (uuid, foreign key to users)
    
    - `quotation_customer_responses`
      - `id` (uuid, primary key)
      - `quotation_id` (uuid, foreign key to quotations)
      - `public_link_id` (uuid, foreign key to quotation_public_links)
      - `response_type` (text) - 'approved' or 'rejected'
      - `customer_name` (text) - name of person responding
      - `customer_signature` (text) - signature data if approved
      - `rejection_reason` (text) - reason if rejected
      - `responded_at` (timestamptz)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Public links are readable by anyone with the token
    - Customer responses can be created by anyone (public)
    - Internal users can read all links and responses for their company
*/

-- Create quotation_public_links table
CREATE TABLE IF NOT EXISTS quotation_public_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id uuid NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES users(id)
);

-- Create quotation_customer_responses table
CREATE TABLE IF NOT EXISTS quotation_customer_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id uuid NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  public_link_id uuid REFERENCES quotation_public_links(id) ON DELETE SET NULL,
  response_type text NOT NULL CHECK (response_type IN ('approved', 'rejected')),
  customer_name text NOT NULL,
  customer_signature text,
  rejection_reason text,
  responded_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_quotation_public_links_quotation ON quotation_public_links(quotation_id);
CREATE INDEX IF NOT EXISTS idx_quotation_public_links_token ON quotation_public_links(token);
CREATE INDEX IF NOT EXISTS idx_quotation_customer_responses_quotation ON quotation_customer_responses(quotation_id);

-- Enable RLS
ALTER TABLE quotation_public_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_customer_responses ENABLE ROW LEVEL SECURITY;

-- RLS Policies for quotation_public_links

-- Authenticated users can view links for quotations in their company
CREATE POLICY "Users can view public links for company quotations"
  ON quotation_public_links FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM quotations q
      JOIN user_company_roles ucr ON ucr.company_id = q.company_id
      WHERE q.id = quotation_public_links.quotation_id
      AND ucr.user_id = auth.uid()
    )
  );

-- Authenticated users can create links for quotations in their company
CREATE POLICY "Users can create public links for company quotations"
  ON quotation_public_links FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM quotations q
      JOIN user_company_roles ucr ON ucr.company_id = q.company_id
      WHERE q.id = quotation_id
      AND ucr.user_id = auth.uid()
    )
  );

-- Authenticated users can update links they created
CREATE POLICY "Users can update their own public links"
  ON quotation_public_links FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- RLS Policies for quotation_customer_responses

-- Anyone can create a response (public access)
CREATE POLICY "Anyone can create customer responses"
  ON quotation_customer_responses FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Authenticated users can view responses for quotations in their company
CREATE POLICY "Users can view responses for company quotations"
  ON quotation_customer_responses FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM quotations q
      JOIN user_company_roles ucr ON ucr.company_id = q.company_id
      WHERE q.id = quotation_customer_responses.quotation_id
      AND ucr.user_id = auth.uid()
    )
  );

-- Update quotations table to track if it was approved via public link
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotations' AND column_name = 'customer_response_id'
  ) THEN
    ALTER TABLE quotations ADD COLUMN customer_response_id uuid REFERENCES quotation_customer_responses(id);
  END IF;
END $$;
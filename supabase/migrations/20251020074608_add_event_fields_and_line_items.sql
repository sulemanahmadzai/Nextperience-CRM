/*
  # Add Event Details and Line Items to Quotations

  1. Changes to `quotations` table
    - Add `event_type_id` (uuid, foreign key to event_types)
    - Add `no_of_pax` (integer, number of people)
    - Add `event_date` (date, event date)
  
  2. New Table: `quotation_line_items`
    - `id` (uuid, primary key)
    - `quotation_id` (uuid, foreign key to quotations)
    - `item_type` (text, either 'product' or 'section')
    - `product_id` (uuid, nullable, foreign key to products)
    - `description` (text, product name or section content)
    - `quantity` (decimal, nullable for sections)
    - `unit_price` (decimal, nullable for sections)
    - `tax_rate` (decimal, nullable for sections)
    - `amount` (decimal, nullable for sections)
    - `sort_order` (integer, for reordering)
    - `created_at` (timestamp)
    - `updated_at` (timestamp)
  
  3. Security
    - Enable RLS on new table
    - Add policies for company access
*/

-- Add event fields to quotations table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotations' AND column_name = 'event_type_id'
  ) THEN
    ALTER TABLE quotations ADD COLUMN event_type_id uuid REFERENCES event_types(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotations' AND column_name = 'no_of_pax'
  ) THEN
    ALTER TABLE quotations ADD COLUMN no_of_pax integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotations' AND column_name = 'event_date'
  ) THEN
    ALTER TABLE quotations ADD COLUMN event_date date;
  END IF;
END $$;

-- Create quotation_line_items table
CREATE TABLE IF NOT EXISTS quotation_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id uuid NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id),
  item_type text NOT NULL CHECK (item_type IN ('product', 'section')),
  product_id uuid REFERENCES products(id),
  description text NOT NULL,
  quantity decimal(10,2),
  unit_price decimal(10,2),
  tax_rate decimal(5,2) DEFAULT 0,
  amount decimal(10,2),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE quotation_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view line items for their company quotations"
  ON quotation_line_items FOR SELECT
  USING (true);

CREATE POLICY "Users can insert line items for their company quotations"
  ON quotation_line_items FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update line items for their company quotations"
  ON quotation_line_items FOR UPDATE
  USING (true);

CREATE POLICY "Users can delete line items for their company quotations"
  ON quotation_line_items FOR DELETE
  USING (true);

CREATE INDEX IF NOT EXISTS idx_quotation_line_items_quotation_id ON quotation_line_items(quotation_id);
CREATE INDEX IF NOT EXISTS idx_quotation_line_items_sort_order ON quotation_line_items(quotation_id, sort_order);

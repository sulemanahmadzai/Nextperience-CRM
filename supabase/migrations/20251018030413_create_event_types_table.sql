/*
  # Create Event Types Table

  1. New Tables
    - `event_types`
      - `id` (uuid, primary key)
      - `company_id` (uuid, foreign key to companies)
      - `name` (text, event type name like "Wedding", "Corporate", etc.)
      - `order` (integer, for custom ordering via drag-and-drop)
      - `is_active` (boolean, soft delete support)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `event_types` table
    - Add policy for authenticated users to read event types from their company
    - Add policy for managers and admins to create/update/delete event types

  3. Changes
    - Allows each company to manage their own list of event types
    - Supports custom ordering and soft deletion
*/

CREATE TABLE IF NOT EXISTS event_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  "order" integer NOT NULL DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE event_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view event types from their company"
  ON event_types FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id 
      FROM user_company_roles 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Managers and admins can create event types"
  ON event_types FOR INSERT
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

CREATE POLICY "Managers and admins can update event types"
  ON event_types FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT ucr.company_id 
      FROM user_company_roles ucr
      JOIN roles r ON ucr.role_id = r.id
      WHERE ucr.user_id = auth.uid() 
      AND r.name IN ('Admin', 'Manager')
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT ucr.company_id 
      FROM user_company_roles ucr
      JOIN roles r ON ucr.role_id = r.id
      WHERE ucr.user_id = auth.uid() 
      AND r.name IN ('Admin', 'Manager')
    )
  );

CREATE POLICY "Managers and admins can delete event types"
  ON event_types FOR DELETE
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

CREATE INDEX IF NOT EXISTS idx_event_types_company_id ON event_types(company_id);
CREATE INDEX IF NOT EXISTS idx_event_types_order ON event_types(company_id, "order");

INSERT INTO event_types (company_id, name, "order") 
VALUES 
  ('00000000-0000-0000-0000-000000000001', 'Wedding', 1),
  ('00000000-0000-0000-0000-000000000001', 'Corporate Event', 2),
  ('00000000-0000-0000-0000-000000000001', 'Birthday', 3),
  ('00000000-0000-0000-0000-000000000001', 'Debut', 4),
  ('00000000-0000-0000-0000-000000000001', 'School Tour', 5),
  ('00000000-0000-0000-0000-000000000001', 'Product Launch', 6)
ON CONFLICT DO NOTHING;

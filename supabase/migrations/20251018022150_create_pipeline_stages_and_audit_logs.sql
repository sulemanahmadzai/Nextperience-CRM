/*
  # Create Pipeline Stages and Audit Logs System

  ## New Tables
  
  ### 1. pipeline_stages
  Company-specific pipeline stages for the Kanban board
  - `id` (uuid, primary key)
  - `company_id` (uuid, foreign key to companies)
  - `name` (text) - Stage name (e.g., "New", "Qualified", "Proposal")
  - `color` (text) - Color code for the stage header
  - `order` (integer) - Display order of stages
  - `probability` (integer) - Win probability percentage (0-100)
  - `is_default` (boolean) - Whether this is a default stage
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 2. audit_logs
  Track all changes in the system
  - `id` (uuid, primary key)
  - `company_id` (uuid, foreign key to companies)
  - `user_id` (uuid, foreign key to auth.users)
  - `entity_type` (text) - Type of entity (lead, stage, etc.)
  - `entity_id` (uuid) - ID of the entity
  - `action` (text) - Action performed (created, updated, deleted, moved)
  - `old_value` (jsonb) - Previous value
  - `new_value` (jsonb) - New value
  - `created_at` (timestamptz)

  ## Changes to Existing Tables
  - Add `stage_id` to leads table
  - Remove old `stage` text column from leads

  ## Security
  - Enable RLS on all tables
  - Users can only view/edit stages for their companies
  - Audit logs are read-only for regular users
*/

-- Create pipeline_stages table
CREATE TABLE IF NOT EXISTS pipeline_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#6b7280',
  "order" integer NOT NULL DEFAULT 0,
  probability integer DEFAULT 0 CHECK (probability >= 0 AND probability <= 100),
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  action text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz DEFAULT now()
);

-- Add stage_id to leads table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'stage_id'
  ) THEN
    ALTER TABLE leads ADD COLUMN stage_id uuid REFERENCES pipeline_stages(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_company ON pipeline_stages(company_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_order ON pipeline_stages(company_id, "order");
CREATE INDEX IF NOT EXISTS idx_audit_logs_company ON audit_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_leads_stage ON leads(stage_id);

-- Enable RLS
ALTER TABLE pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for pipeline_stages
CREATE POLICY "Users can view stages for their companies"
  ON pipeline_stages FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_company_roles
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Admins can insert stages"
  ON pipeline_stages FOR INSERT
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

CREATE POLICY "Admins can update stages"
  ON pipeline_stages FOR UPDATE
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

CREATE POLICY "Admins can delete stages"
  ON pipeline_stages FOR DELETE
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

-- RLS Policies for audit_logs
CREATE POLICY "Users can view audit logs for their companies"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_company_roles
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "All authenticated users can insert audit logs"
  ON audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    company_id IN (
      SELECT company_id FROM user_company_roles
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Insert default pipeline stages for existing companies
INSERT INTO pipeline_stages (company_id, name, color, "order", probability, is_default)
SELECT 
  c.id,
  stage.name,
  stage.color,
  stage."order",
  stage.probability,
  true
FROM companies c
CROSS JOIN (
  VALUES
    ('New', '#6b7280', 0, 10),
    ('Qualified', '#3b82f6', 1, 30),
    ('Proposal', '#f59e0b', 2, 60),
    ('Negotiation', '#8b5cf6', 3, 80),
    ('Won', '#10b981', 4, 100),
    ('Lost', '#ef4444', 5, 0)
) AS stage(name, color, "order", probability)
WHERE NOT EXISTS (
  SELECT 1 FROM pipeline_stages ps WHERE ps.company_id = c.id
);

-- Migrate existing leads to use the new stage_id
UPDATE leads l
SET stage_id = (
  SELECT ps.id
  FROM pipeline_stages ps
  WHERE ps.company_id = l.company_id
    AND LOWER(ps.name) = LOWER(COALESCE(l.stage, 'New'))
  LIMIT 1
)
WHERE stage_id IS NULL;

-- Set default stage for leads without a match
UPDATE leads l
SET stage_id = (
  SELECT ps.id
  FROM pipeline_stages ps
  WHERE ps.company_id = l.company_id
    AND ps.is_default = true
  ORDER BY ps."order"
  LIMIT 1
)
WHERE stage_id IS NULL;

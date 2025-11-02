/*
  # The Nextperience Group CRM - Phase 1 Schema

  ## Overview
  Multi-company CRM system with strict company scoping, role-based access control,
  and comprehensive audit logging.

  ## New Tables
  
  ### 1. companies
  - `id` (uuid, primary key) - Unique company identifier
  - `name` (text) - Company name
  - `slug` (text, unique) - URL-friendly identifier
  - `logo_url` (text, nullable) - Company logo
  - `settings` (jsonb) - Company-specific settings
  - `is_active` (boolean) - Active status
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### 2. roles
  - `id` (uuid, primary key) - Role identifier
  - `company_id` (uuid, foreign key) - Company association
  - `name` (text) - Role name
  - `permissions` (jsonb) - Permission matrix {module: {create, read, update, delete}}
  - `is_system` (boolean) - System-defined role (cannot be deleted)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 3. user_company_roles
  - `id` (uuid, primary key)
  - `user_id` (uuid, foreign key to auth.users)
  - `company_id` (uuid, foreign key)
  - `role_id` (uuid, foreign key)
  - `permission_overrides` (jsonb) - User-specific permission overrides
  - `is_active` (boolean) - Active status
  - `created_at` (timestamptz)

  ### 4. teams
  - `id` (uuid, primary key)
  - `company_id` (uuid, foreign key)
  - `name` (text) - Team name
  - `description` (text, nullable)
  - `manager_id` (uuid, foreign key to auth.users)
  - `is_active` (boolean)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 5. team_members
  - `id` (uuid, primary key)
  - `team_id` (uuid, foreign key)
  - `user_id` (uuid, foreign key to auth.users)
  - `joined_at` (timestamptz)

  ### 6. customers
  - `id` (uuid, primary key)
  - `company_id` (uuid, foreign key)
  - `name` (text) - Customer name
  - `email` (text, nullable)
  - `phone` (text, nullable)
  - `company_name` (text, nullable)
  - `address` (jsonb) - Address details
  - `tags` (text[]) - Customer tags
  - `notes` (text, nullable)
  - `is_archived` (boolean)
  - `created_by` (uuid, foreign key to auth.users)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 7. leads
  - `id` (uuid, primary key)
  - `company_id` (uuid, foreign key)
  - `name` (text) - Lead name
  - `email` (text, nullable)
  - `phone` (text, nullable)
  - `company_name` (text, nullable)
  - `stage` (text) - Pipeline stage: new, qualified, proposal, won, lost
  - `value` (decimal, nullable) - Potential deal value
  - `source` (text, nullable) - Lead source
  - `assigned_to` (uuid, foreign key to auth.users)
  - `notes` (text, nullable)
  - `converted_to_customer_id` (uuid, nullable, foreign key to customers)
  - `is_archived` (boolean)
  - `created_by` (uuid, foreign key to auth.users)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 8. activities
  - `id` (uuid, primary key)
  - `company_id` (uuid, foreign key)
  - `type` (text) - Activity type: call, email, meeting, note, task
  - `title` (text) - Activity title
  - `description` (text, nullable)
  - `related_to_type` (text) - Entity type: customer, lead
  - `related_to_id` (uuid) - Related entity ID
  - `due_date` (timestamptz, nullable)
  - `completed` (boolean)
  - `assigned_to` (uuid, foreign key to auth.users)
  - `created_by` (uuid, foreign key to auth.users)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 9. products
  - `id` (uuid, primary key)
  - `company_id` (uuid, foreign key)
  - `name` (text) - Product name
  - `description` (text, nullable)
  - `sku` (text, nullable) - Stock keeping unit
  - `price` (decimal)
  - `currency` (text) - Currency code (USD, EUR, etc.)
  - `is_active` (boolean)
  - `created_by` (uuid, foreign key to auth.users)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 10. audit_logs
  - `id` (uuid, primary key)
  - `company_id` (uuid, foreign key)
  - `entity_type` (text) - Entity being changed
  - `entity_id` (uuid) - ID of changed entity
  - `action` (text) - Action: create, update, delete, archive
  - `changed_fields` (jsonb) - Before/after values
  - `user_id` (uuid, foreign key to auth.users)
  - `created_at` (timestamptz)

  ## Security
  - All tables have RLS enabled
  - Users can only access data from companies they belong to
  - Permissions are enforced through user_company_roles and role permissions
  - Audit logs are read-only for non-admin users

  ## Important Notes
  - Every data table includes company_id for strict multi-company isolation
  - No hard deletes - use is_archived flags
  - Audit logs track all data changes for compliance
*/

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. COMPANIES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  logo_url text,
  settings jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 2. ROLES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  permissions jsonb DEFAULT '{}'::jsonb,
  is_system boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(company_id, name)
);

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 3. USER_COMPANY_ROLES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS user_company_roles (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role_id uuid REFERENCES roles(id) ON DELETE SET NULL,
  permission_overrides jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, company_id)
);

ALTER TABLE user_company_roles ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_company_roles (must come before using it in other policies)
CREATE POLICY "Users can view their own company roles"
  ON user_company_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users with settings permission can manage user roles"
  ON user_company_roles FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_company_roles ucr
      LEFT JOIN roles r ON ucr.role_id = r.id
      WHERE ucr.user_id = auth.uid()
        AND ucr.company_id = user_company_roles.company_id
        AND ucr.is_active = true
        AND (
          (r.permissions->'settings'->>'update' = 'true')
          OR (ucr.permission_overrides->'settings'->>'update' = 'true')
        )
    )
  );

-- Now add RLS policies for companies (after user_company_roles exists)
CREATE POLICY "Users can view companies they belong to"
  ON companies FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT company_id FROM user_company_roles
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- RLS policies for roles
CREATE POLICY "Users can view roles in their companies"
  ON roles FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_company_roles
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Users with settings permission can manage roles"
  ON roles FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_company_roles ucr
      LEFT JOIN roles r ON ucr.role_id = r.id
      WHERE ucr.user_id = auth.uid()
        AND ucr.company_id = roles.company_id
        AND ucr.is_active = true
        AND (
          (r.permissions->'settings'->>'update' = 'true')
          OR (ucr.permission_overrides->'settings'->>'update' = 'true')
        )
    )
  );

-- =====================================================
-- 4. TEAMS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS teams (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  manager_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view teams in their companies"
  ON teams FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_company_roles
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- =====================================================
-- 5. TEAM_MEMBERS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS team_members (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at timestamptz DEFAULT now(),
  UNIQUE(team_id, user_id)
);

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view team members in their companies"
  ON team_members FOR SELECT
  TO authenticated
  USING (
    team_id IN (
      SELECT t.id FROM teams t
      INNER JOIN user_company_roles ucr ON t.company_id = ucr.company_id
      WHERE ucr.user_id = auth.uid() AND ucr.is_active = true
    )
  );

-- =====================================================
-- 6. CUSTOMERS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text,
  phone text,
  company_name text,
  address jsonb DEFAULT '{}'::jsonb,
  tags text[] DEFAULT ARRAY[]::text[],
  notes text,
  is_archived boolean DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view customers in their companies"
  ON customers FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT ucr.company_id FROM user_company_roles ucr
      LEFT JOIN roles r ON ucr.role_id = r.id
      WHERE ucr.user_id = auth.uid()
        AND ucr.is_active = true
        AND (
          (r.permissions->'customers'->>'read' = 'true')
          OR (ucr.permission_overrides->'customers'->>'read' = 'true')
        )
    )
  );

CREATE POLICY "Users can create customers with permission"
  ON customers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_company_roles ucr
      LEFT JOIN roles r ON ucr.role_id = r.id
      WHERE ucr.user_id = auth.uid()
        AND ucr.company_id = customers.company_id
        AND ucr.is_active = true
        AND (
          (r.permissions->'customers'->>'create' = 'true')
          OR (ucr.permission_overrides->'customers'->>'create' = 'true')
        )
    )
  );

CREATE POLICY "Users can update customers with permission"
  ON customers FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_company_roles ucr
      LEFT JOIN roles r ON ucr.role_id = r.id
      WHERE ucr.user_id = auth.uid()
        AND ucr.company_id = customers.company_id
        AND ucr.is_active = true
        AND (
          (r.permissions->'customers'->>'update' = 'true')
          OR (ucr.permission_overrides->'customers'->>'update' = 'true')
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_company_roles ucr
      LEFT JOIN roles r ON ucr.role_id = r.id
      WHERE ucr.user_id = auth.uid()
        AND ucr.company_id = customers.company_id
        AND ucr.is_active = true
        AND (
          (r.permissions->'customers'->>'update' = 'true')
          OR (ucr.permission_overrides->'customers'->>'update' = 'true')
        )
    )
  );

-- =====================================================
-- 7. LEADS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text,
  phone text,
  company_name text,
  stage text NOT NULL DEFAULT 'new' CHECK (stage IN ('new', 'qualified', 'proposal', 'won', 'lost')),
  value decimal(12,2),
  source text,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes text,
  converted_to_customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  is_archived boolean DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view leads in their companies"
  ON leads FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT ucr.company_id FROM user_company_roles ucr
      LEFT JOIN roles r ON ucr.role_id = r.id
      WHERE ucr.user_id = auth.uid()
        AND ucr.is_active = true
        AND (
          (r.permissions->'leads'->>'read' = 'true')
          OR (ucr.permission_overrides->'leads'->>'read' = 'true')
        )
    )
  );

CREATE POLICY "Users can create leads with permission"
  ON leads FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_company_roles ucr
      LEFT JOIN roles r ON ucr.role_id = r.id
      WHERE ucr.user_id = auth.uid()
        AND ucr.company_id = leads.company_id
        AND ucr.is_active = true
        AND (
          (r.permissions->'leads'->>'create' = 'true')
          OR (ucr.permission_overrides->'leads'->>'create' = 'true')
        )
    )
  );

CREATE POLICY "Users can update leads with permission"
  ON leads FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_company_roles ucr
      LEFT JOIN roles r ON ucr.role_id = r.id
      WHERE ucr.user_id = auth.uid()
        AND ucr.company_id = leads.company_id
        AND ucr.is_active = true
        AND (
          (r.permissions->'leads'->>'update' = 'true')
          OR (ucr.permission_overrides->'leads'->>'update' = 'true')
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_company_roles ucr
      LEFT JOIN roles r ON ucr.role_id = r.id
      WHERE ucr.user_id = auth.uid()
        AND ucr.company_id = leads.company_id
        AND ucr.is_active = true
        AND (
          (r.permissions->'leads'->>'update' = 'true')
          OR (ucr.permission_overrides->'leads'->>'update' = 'true')
        )
    )
  );

-- =====================================================
-- 8. ACTIVITIES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS activities (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('call', 'email', 'meeting', 'note', 'task')),
  title text NOT NULL,
  description text,
  related_to_type text CHECK (related_to_type IN ('customer', 'lead')),
  related_to_id uuid,
  due_date timestamptz,
  completed boolean DEFAULT false,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view activities in their companies"
  ON activities FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT ucr.company_id FROM user_company_roles ucr
      LEFT JOIN roles r ON ucr.role_id = r.id
      WHERE ucr.user_id = auth.uid()
        AND ucr.is_active = true
        AND (
          (r.permissions->'activities'->>'read' = 'true')
          OR (ucr.permission_overrides->'activities'->>'read' = 'true')
        )
    )
  );

CREATE POLICY "Users can create activities with permission"
  ON activities FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_company_roles ucr
      LEFT JOIN roles r ON ucr.role_id = r.id
      WHERE ucr.user_id = auth.uid()
        AND ucr.company_id = activities.company_id
        AND ucr.is_active = true
        AND (
          (r.permissions->'activities'->>'create' = 'true')
          OR (ucr.permission_overrides->'activities'->>'create' = 'true')
        )
    )
  );

CREATE POLICY "Users can update activities with permission"
  ON activities FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_company_roles ucr
      LEFT JOIN roles r ON ucr.role_id = r.id
      WHERE ucr.user_id = auth.uid()
        AND ucr.company_id = activities.company_id
        AND ucr.is_active = true
        AND (
          (r.permissions->'activities'->>'update' = 'true')
          OR (ucr.permission_overrides->'activities'->>'update' = 'true')
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_company_roles ucr
      LEFT JOIN roles r ON ucr.role_id = r.id
      WHERE ucr.user_id = auth.uid()
        AND ucr.company_id = activities.company_id
        AND ucr.is_active = true
        AND (
          (r.permissions->'activities'->>'update' = 'true')
          OR (ucr.permission_overrides->'activities'->>'update' = 'true')
        )
    )
  );

-- =====================================================
-- 9. PRODUCTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  sku text,
  price decimal(12,2) NOT NULL,
  currency text DEFAULT 'USD',
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view products in their companies"
  ON products FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT ucr.company_id FROM user_company_roles ucr
      LEFT JOIN roles r ON ucr.role_id = r.id
      WHERE ucr.user_id = auth.uid()
        AND ucr.is_active = true
        AND (
          (r.permissions->'products'->>'read' = 'true')
          OR (ucr.permission_overrides->'products'->>'read' = 'true')
        )
    )
  );

CREATE POLICY "Users can create products with permission"
  ON products FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_company_roles ucr
      LEFT JOIN roles r ON ucr.role_id = r.id
      WHERE ucr.user_id = auth.uid()
        AND ucr.company_id = products.company_id
        AND ucr.is_active = true
        AND (
          (r.permissions->'products'->>'create' = 'true')
          OR (ucr.permission_overrides->'products'->>'create' = 'true')
        )
    )
  );

CREATE POLICY "Users can update products with permission"
  ON products FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_company_roles ucr
      LEFT JOIN roles r ON ucr.role_id = r.id
      WHERE ucr.user_id = auth.uid()
        AND ucr.company_id = products.company_id
        AND ucr.is_active = true
        AND (
          (r.permissions->'products'->>'update' = 'true')
          OR (ucr.permission_overrides->'products'->>'update' = 'true')
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_company_roles ucr
      LEFT JOIN roles r ON ucr.role_id = r.id
      WHERE ucr.user_id = auth.uid()
        AND ucr.company_id = products.company_id
        AND ucr.is_active = true
        AND (
          (r.permissions->'products'->>'update' = 'true')
          OR (ucr.permission_overrides->'products'->>'update' = 'true')
        )
    )
  );

-- =====================================================
-- 10. AUDIT_LOGS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('create', 'update', 'delete', 'archive')),
  changed_fields jsonb DEFAULT '{}'::jsonb,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view audit logs in their companies"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_company_roles
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_user_company_roles_user_id ON user_company_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_company_roles_company_id ON user_company_roles(company_id);
CREATE INDEX IF NOT EXISTS idx_customers_company_id ON customers(company_id);
CREATE INDEX IF NOT EXISTS idx_leads_company_id ON leads(company_id);
CREATE INDEX IF NOT EXISTS idx_leads_stage ON leads(stage);
CREATE INDEX IF NOT EXISTS idx_activities_company_id ON activities(company_id);
CREATE INDEX IF NOT EXISTS idx_activities_related_to ON activities(related_to_type, related_to_id);
CREATE INDEX IF NOT EXISTS idx_products_company_id ON products(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_company_id ON audit_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);

-- =====================================================
-- UPDATED_AT TRIGGER FUNCTION
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to tables with updated_at
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_companies_updated_at') THEN
    CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_roles_updated_at') THEN
    CREATE TRIGGER update_roles_updated_at BEFORE UPDATE ON roles
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_teams_updated_at') THEN
    CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_customers_updated_at') THEN
    CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_leads_updated_at') THEN
    CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_activities_updated_at') THEN
    CREATE TRIGGER update_activities_updated_at BEFORE UPDATE ON activities
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_products_updated_at') THEN
    CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
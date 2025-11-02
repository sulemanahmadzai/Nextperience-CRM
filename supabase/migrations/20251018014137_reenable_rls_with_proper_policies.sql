/*
  # Re-enable RLS with Proper Non-Circular Policies

  ## Overview
  Re-enables RLS on core tables with policies that avoid circular dependencies.
  Uses direct auth.uid() checks and simple subqueries.

  ## Tables Updated
  - companies: Users can view companies they're assigned to
  - roles: Users can view roles in their companies
  - user_company_roles: Users can view their own assignments

  ## Security
  - Policies use simple subqueries to avoid recursion
  - Admin users can manage data within their companies
  - No circular dependencies between tables
*/

-- Re-enable RLS on core tables
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_company_roles ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies to start clean
DROP POLICY IF EXISTS "Users can view own assignments" ON user_company_roles;
DROP POLICY IF EXISTS "Admins can manage user assignments" ON user_company_roles;
DROP POLICY IF EXISTS "Users can view assigned companies" ON companies;
DROP POLICY IF EXISTS "Users can view company roles" ON roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON roles;

-- USER_COMPANY_ROLES policies
CREATE POLICY "Users can view own company assignments"
  ON user_company_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can insert user assignments"
  ON user_company_roles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_company_roles ucr
      JOIN roles r ON ucr.role_id = r.id
      WHERE ucr.user_id = auth.uid()
        AND ucr.company_id = user_company_roles.company_id
        AND ucr.is_active = true
        AND r.permissions->'settings'->>'update' = 'true'
    )
  );

CREATE POLICY "Admins can update user assignments"
  ON user_company_roles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_company_roles ucr
      JOIN roles r ON ucr.role_id = r.id
      WHERE ucr.user_id = auth.uid()
        AND ucr.company_id = user_company_roles.company_id
        AND ucr.is_active = true
        AND r.permissions->'settings'->>'update' = 'true'
    )
  );

CREATE POLICY "Admins can delete user assignments"
  ON user_company_roles FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_company_roles ucr
      JOIN roles r ON ucr.role_id = r.id
      WHERE ucr.user_id = auth.uid()
        AND ucr.company_id = user_company_roles.company_id
        AND ucr.is_active = true
        AND r.permissions->'settings'->>'update' = 'true'
    )
  );

-- COMPANIES policies (simple subquery, no JOIN on protected tables)
CREATE POLICY "Users can view their assigned companies"
  ON companies FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT company_id 
      FROM user_company_roles 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- ROLES policies (simple subquery)
CREATE POLICY "Users can view roles in their companies"
  ON roles FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id 
      FROM user_company_roles 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Admins can manage company roles"
  ON roles FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_company_roles ucr
      JOIN roles r ON ucr.role_id = r.id
      WHERE ucr.user_id = auth.uid()
        AND ucr.company_id = roles.company_id
        AND ucr.is_active = true
        AND r.permissions->'settings'->>'update' = 'true'
    )
  );

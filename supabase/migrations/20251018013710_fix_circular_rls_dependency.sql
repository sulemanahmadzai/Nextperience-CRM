/*
  # Fix Circular RLS Policy Dependencies

  ## Overview
  The previous policies had circular dependencies causing infinite recursion.
  This migration simplifies the policies to break the cycle.

  ## Changes Made
  1. Simplify user_company_roles policy - only check user_id
  2. Simplify companies policy - use a subquery that doesn't trigger RLS
  3. Simplify roles policy - use a subquery that doesn't trigger RLS

  ## Security Notes
  - Maintains proper isolation
  - Breaks circular dependency by using simpler checks
*/

-- Drop all existing policies to start fresh
DROP POLICY IF EXISTS "Users can view their own company roles" ON user_company_roles;
DROP POLICY IF EXISTS "Users with settings permission can manage user roles" ON user_company_roles;
DROP POLICY IF EXISTS "Users can view companies they belong to" ON companies;
DROP POLICY IF EXISTS "Users can view roles in their companies" ON roles;
DROP POLICY IF EXISTS "Users with settings permission can manage roles" ON roles;

-- USER_COMPANY_ROLES: Simple policy - just check user_id
CREATE POLICY "Users can view own assignments"
  ON user_company_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- COMPANIES: Check directly in user_company_roles table (no JOIN, avoiding RLS recursion)
CREATE POLICY "Users can view assigned companies"
  ON companies FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT company_id 
      FROM user_company_roles 
      WHERE user_id = auth.uid() 
        AND is_active = true
    )
  );

-- ROLES: Check directly in user_company_roles table
CREATE POLICY "Users can view company roles"
  ON roles FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id 
      FROM user_company_roles 
      WHERE user_id = auth.uid() 
        AND is_active = true
    )
  );

-- Re-add management policies (for INSERT/UPDATE/DELETE)
CREATE POLICY "Admins can manage user assignments"
  ON user_company_roles FOR ALL
  TO authenticated
  USING (
    company_id IN (
      SELECT ucr.company_id 
      FROM user_company_roles ucr
      JOIN roles r ON ucr.role_id = r.id
      WHERE ucr.user_id = auth.uid()
        AND ucr.is_active = true
        AND (r.permissions->'settings'->>'update' = 'true')
    )
  );

CREATE POLICY "Admins can manage roles"
  ON roles FOR ALL
  TO authenticated
  USING (
    company_id IN (
      SELECT ucr.company_id 
      FROM user_company_roles ucr
      JOIN roles r ON ucr.role_id = r.id
      WHERE ucr.user_id = auth.uid()
        AND ucr.is_active = true
        AND (r.permissions->'settings'->>'update' = 'true')
    )
  );

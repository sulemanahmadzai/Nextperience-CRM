/*
  # Fix Circular RLS Dependency

  ## Problem
  The roles table RLS policy references user_company_roles, which causes
  infinite recursion when querying user_company_roles with roles joined.

  ## Solution
  Simplify the roles SELECT policy to only check if the user has ANY
  active assignment to the company, without checking role permissions.
  This breaks the circular dependency while maintaining security.

  ## Changes
  - Drop the complex roles policy that checks permissions
  - Create a simple policy that only checks company membership
  - This allows user_company_roles.select('*, roles(*)') to work
*/

-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view roles in their companies" ON roles;
DROP POLICY IF EXISTS "Admins can manage company roles" ON roles;

-- Create a simple SELECT policy for roles
-- Users can view roles if they have ANY active assignment to that company
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

-- For managing roles (INSERT/UPDATE/DELETE), we need to check permissions
-- But we do it in a way that doesn't create recursion
CREATE POLICY "Admins can insert roles"
  ON roles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 
      FROM user_company_roles ucr
      WHERE ucr.user_id = auth.uid()
        AND ucr.company_id = roles.company_id
        AND ucr.is_active = true
        AND (
          SELECT r.permissions->'settings'->>'update'
          FROM roles r
          WHERE r.id = ucr.role_id
        )::boolean = true
    )
  );

CREATE POLICY "Admins can update roles"
  ON roles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM user_company_roles ucr
      WHERE ucr.user_id = auth.uid()
        AND ucr.company_id = roles.company_id
        AND ucr.is_active = true
        AND (
          SELECT r.permissions->'settings'->>'update'
          FROM roles r
          WHERE r.id = ucr.role_id
        )::boolean = true
    )
  );

CREATE POLICY "Admins can delete roles"
  ON roles FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM user_company_roles ucr
      WHERE ucr.user_id = auth.uid()
        AND ucr.company_id = roles.company_id
        AND ucr.is_active = true
        AND (
          SELECT r.permissions->'settings'->>'update'
          FROM roles r
          WHERE r.id = ucr.role_id
        )::boolean = true
    )
  );

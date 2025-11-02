/*
  # Fix User Company Roles Management Policies

  1. Policy Changes
    - Update SELECT policy to allow Admins to view all assignments in their company
    - Simplify INSERT/UPDATE/DELETE policies to avoid circular dependencies
    - Use Super Admin and Admin roles to bypass circular checks

  2. Security
    - Regular users can only view their own assignments
    - Admins and Super Admins can view and manage all assignments in their company
    - Maintains proper access control while enabling management features
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own company assignments" ON user_company_roles;
DROP POLICY IF EXISTS "Admins can insert user assignments" ON user_company_roles;
DROP POLICY IF EXISTS "Admins can update user assignments" ON user_company_roles;
DROP POLICY IF EXISTS "Admins can delete user assignments" ON user_company_roles;

-- Allow users to view their own assignments AND allow Admins to view all assignments in their company
CREATE POLICY "Users can view company assignments"
  ON user_company_roles FOR SELECT
  TO authenticated
  USING (
    -- Users can see their own assignments
    user_id = auth.uid()
    OR
    -- Admins can see all assignments in their company
    EXISTS (
      SELECT 1 FROM user_company_roles ucr
      JOIN roles r ON ucr.role_id = r.id
      WHERE ucr.user_id = auth.uid()
        AND ucr.company_id = user_company_roles.company_id
        AND ucr.is_active = true
        AND r.name IN ('Admin', 'Super Admin')
    )
  );

-- Simplify INSERT policy - use role name check to avoid circular dependency
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
        AND r.name IN ('Admin', 'Super Admin')
    )
  );

-- Simplify UPDATE policy
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
        AND r.name IN ('Admin', 'Super Admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_company_roles ucr
      JOIN roles r ON ucr.role_id = r.id
      WHERE ucr.user_id = auth.uid()
        AND ucr.company_id = user_company_roles.company_id
        AND ucr.is_active = true
        AND r.name IN ('Admin', 'Super Admin')
    )
  );

-- Simplify DELETE policy
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
        AND r.name IN ('Admin', 'Super Admin')
    )
  );

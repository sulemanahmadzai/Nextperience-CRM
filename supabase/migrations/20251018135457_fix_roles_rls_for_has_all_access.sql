/*
  # Fix RLS policies for has_all_access users on roles table

  1. Changes
    - Drop existing SELECT policy on roles
    - Create new policy that allows has_all_access users to see all roles
    - Keep existing policy logic for regular users
  
  2. Security
    - Users with has_all_access=true can view all roles
    - Regular users can only view roles in companies they're assigned to
*/

DROP POLICY IF EXISTS "Users can view roles in their companies" ON roles;

CREATE POLICY "Users can view roles in their companies"
  ON roles
  FOR SELECT
  TO authenticated
  USING (
    (EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND has_all_access = true
    ))
    OR
    (company_id IN (
      SELECT company_id
      FROM user_company_roles
      WHERE user_id = auth.uid()
        AND is_active = true
    ))
  );

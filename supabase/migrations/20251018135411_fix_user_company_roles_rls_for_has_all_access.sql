/*
  # Fix RLS policies for has_all_access users

  1. Changes
    - Drop existing SELECT policy on user_company_roles
    - Create new policy that allows has_all_access users to see all assignments
    - Keep existing policy logic for regular users
  
  2. Security
    - Users with has_all_access=true can view all company assignments
    - Regular users can only view their own assignments or assignments in companies they admin
*/

DROP POLICY IF EXISTS "Users can view company assignments" ON user_company_roles;

CREATE POLICY "Users can view company assignments"
  ON user_company_roles
  FOR SELECT
  TO authenticated
  USING (
    (user_id = auth.uid()) 
    OR 
    (EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND has_all_access = true
    ))
    OR 
    (EXISTS (
      SELECT 1
      FROM user_company_roles ucr
      JOIN roles r ON ucr.role_id = r.id
      WHERE ucr.user_id = auth.uid()
        AND ucr.company_id = user_company_roles.company_id
        AND ucr.is_active = true
        AND r.name IN ('Admin', 'Super Admin')
    ))
  );

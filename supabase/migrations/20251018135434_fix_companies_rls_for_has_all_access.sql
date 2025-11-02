/*
  # Fix RLS policies for has_all_access users on companies table

  1. Changes
    - Drop existing SELECT policy on companies
    - Create new policy that allows has_all_access users to see all companies
    - Keep existing policy logic for regular users
  
  2. Security
    - Users with has_all_access=true can view all companies
    - Regular users can only view companies they're assigned to
*/

DROP POLICY IF EXISTS "Users can view their assigned companies" ON companies;

CREATE POLICY "Users can view their assigned companies"
  ON companies
  FOR SELECT
  TO authenticated
  USING (
    (EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND has_all_access = true
    ))
    OR
    (id IN (
      SELECT company_id
      FROM user_company_roles
      WHERE user_id = auth.uid()
        AND is_active = true
    ))
  );

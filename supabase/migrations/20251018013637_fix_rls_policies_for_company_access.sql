/*
  # Fix RLS Policies for Company Access

  ## Overview
  This migration fixes the RLS policies to ensure users can properly access
  their company data when querying through user_company_roles.

  ## Changes Made
  1. Drop existing restrictive policies
  2. Add more permissive SELECT policies that allow:
     - Users to read their own user_company_roles entries
     - Users to read companies they're assigned to
     - Users to read roles within their companies

  ## Security Notes
  - Still maintains company isolation
  - Users can only see data for companies they're members of
  - No changes to INSERT/UPDATE/DELETE policies
*/

-- Drop and recreate user_company_roles SELECT policy to be clearer
DROP POLICY IF EXISTS "Users can view their own company roles" ON user_company_roles;

CREATE POLICY "Users can view their own company roles"
  ON user_company_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Drop and recreate companies SELECT policy
DROP POLICY IF EXISTS "Users can view companies they belong to" ON companies;

CREATE POLICY "Users can view companies they belong to"
  ON companies FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_company_roles
      WHERE user_company_roles.company_id = companies.id
        AND user_company_roles.user_id = auth.uid()
        AND user_company_roles.is_active = true
    )
  );

-- Drop and recreate roles SELECT policy
DROP POLICY IF EXISTS "Users can view roles in their companies" ON roles;

CREATE POLICY "Users can view roles in their companies"
  ON roles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_company_roles
      WHERE user_company_roles.company_id = roles.company_id
        AND user_company_roles.user_id = auth.uid()
        AND user_company_roles.is_active = true
    )
  );

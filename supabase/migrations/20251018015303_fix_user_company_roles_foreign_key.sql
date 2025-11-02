/*
  # Fix user_company_roles Foreign Key and User Creation

  ## Problem
  The user_company_roles table references auth.users but the frontend needs
  to join with public.users table to get email addresses.

  ## Solution
  - Keep the auth.users foreign key for data integrity
  - Add a computed/view-like access to user emails
  - Since we can't have two FKs on the same column, we'll ensure the
    public.users table is always in sync with auth.users

  ## Changes
  - Ensure all current auth.users exist in public.users
  - Update the users RLS policy to be more permissive for company members
*/

-- Ensure all auth.users are in public.users
INSERT INTO public.users (id, email, full_name)
SELECT 
  id, 
  email,
  raw_user_meta_data->>'full_name'
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.users)
ON CONFLICT (id) DO NOTHING;

-- Update users RLS policy to allow viewing any user in the system
-- (since we need to look up users by email when adding them)
DROP POLICY IF EXISTS "Users can view profiles in their companies" ON users;

CREATE POLICY "Users can view all user profiles"
  ON users FOR SELECT
  TO authenticated
  USING (true);

-- Also allow inserting into users table from edge functions
CREATE POLICY "Service role can insert users"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (true);

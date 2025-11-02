/*
  # Assign Existing Users to Default Company
  
  ## Overview
  This migration ensures all existing auth users are properly assigned
  to The Nextperience Group with the Admin role, fixing the issue where
  users could log in but had no company access.
  
  ## Actions
  1. Sync all auth.users to public.users table
  2. Assign all users to The Nextperience Group with Admin role
  
  ## Important
  - This is a one-time fix for existing users
  - Future users should be assigned through the application logic
*/

-- First, ensure all auth users exist in public.users
INSERT INTO public.users (id, email, full_name)
SELECT 
  id, 
  email,
  COALESCE(raw_user_meta_data->>'full_name', email)
FROM auth.users
ON CONFLICT (id) DO UPDATE
SET 
  email = EXCLUDED.email,
  full_name = COALESCE(EXCLUDED.full_name, users.full_name),
  updated_at = now();

-- Assign all users to The Nextperience Group with Admin role
INSERT INTO user_company_roles (user_id, company_id, role_id, is_active)
SELECT 
  u.id,
  '00000000-0000-0000-0000-000000000001'::uuid, -- The Nextperience Group
  '10000000-0000-0000-0000-000000000001'::uuid, -- Admin role
  true
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM user_company_roles ucr 
  WHERE ucr.user_id = u.id 
  AND ucr.company_id = '00000000-0000-0000-0000-000000000001'
)
ON CONFLICT DO NOTHING;

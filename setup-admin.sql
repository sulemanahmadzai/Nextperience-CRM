-- Setup script for admin user
-- This SQL should be run AFTER creating the admin user through Supabase Auth UI

-- Step 1: First, create the user through Supabase Dashboard Authentication tab:
--   Email: kay@thenextperience.com
--   Password: @Tng2025

-- Step 2: Replace 'YOUR_USER_ID_HERE' below with the actual user ID from the auth.users table
-- You can find this by running: SELECT id, email FROM auth.users WHERE email = 'kay@thenextperience.com';

-- Step 3: Run this SQL to assign the admin user to The Nextperience Group with Admin role:

INSERT INTO user_company_roles (
  user_id,
  company_id,
  role_id,
  is_active
) VALUES (
  'YOUR_USER_ID_HERE',  -- Replace with actual user ID
  '00000000-0000-0000-0000-000000000001',  -- The Nextperience Group company ID
  '10000000-0000-0000-0000-000000000001',  -- Admin role ID
  true
)
ON CONFLICT (user_id, company_id) DO NOTHING;

-- Verify the setup:
-- SELECT
--   u.email,
--   c.name as company,
--   r.name as role
-- FROM user_company_roles ucr
-- JOIN auth.users u ON u.id = ucr.user_id
-- JOIN companies c ON c.id = ucr.company_id
-- JOIN roles r ON r.id = ucr.role_id
-- WHERE u.email = 'kay@thenextperience.com';

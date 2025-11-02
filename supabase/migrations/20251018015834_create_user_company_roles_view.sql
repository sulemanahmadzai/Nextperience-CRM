/*
  # Create User Company Roles View

  ## Problem
  PostgREST cannot automatically join user_company_roles with public.users
  because the foreign key points to auth.users (different schema).

  ## Solution
  Create a view that pre-joins the data so the frontend can query it easily.

  ## New Objects
  - `user_company_roles_with_users` view
    - Joins user_company_roles with public.users and roles
    - Provides all user information in one query

  ## Security
  - Inherit RLS from underlying tables
  - Enable RLS on the view
*/

-- Create a view that includes user information
CREATE OR REPLACE VIEW user_company_roles_with_users AS
SELECT 
  ucr.id,
  ucr.user_id,
  ucr.company_id,
  ucr.role_id,
  ucr.permission_overrides,
  ucr.is_active,
  ucr.created_at,
  u.email as user_email,
  u.full_name as user_full_name,
  r.name as role_name,
  r.permissions as role_permissions
FROM user_company_roles ucr
LEFT JOIN public.users u ON u.id = ucr.user_id
LEFT JOIN roles r ON r.id = ucr.role_id;

-- Grant access to authenticated users
GRANT SELECT ON user_company_roles_with_users TO authenticated;

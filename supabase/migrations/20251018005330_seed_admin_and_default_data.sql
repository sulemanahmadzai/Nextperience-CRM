/*
  # Seed Admin User and Default Data

  ## Overview
  Creates the admin user kay@thenextperience.com with platform-level access,
  sets up The Nextperience Group as the first company, and creates default roles.

  ## Actions
  1. Create admin user (handled through Supabase auth signup process)
  2. Create The Nextperience Group company
  3. Create default roles: Admin, Manager, Sales Rep, Viewer
  4. Assign admin user to company with Admin role

  ## Important Notes
  - Password: @Tng2025
  - Admin has full permissions across all modules
  - System roles cannot be deleted
*/

-- Insert The Nextperience Group company
INSERT INTO companies (id, name, slug, is_active, settings)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'The Nextperience Group',
  'tng',
  true,
  '{"theme": "default", "timezone": "America/New_York"}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- Create default roles for The Nextperience Group
INSERT INTO roles (id, company_id, name, permissions, is_system) VALUES
(
  '10000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'Admin',
  '{
    "customers": {"create": true, "read": true, "update": true, "delete": true},
    "leads": {"create": true, "read": true, "update": true, "delete": true},
    "activities": {"create": true, "read": true, "update": true, "delete": true},
    "products": {"create": true, "read": true, "update": true, "delete": true},
    "settings": {"create": true, "read": true, "update": true, "delete": true}
  }'::jsonb,
  true
),
(
  '10000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  'Manager',
  '{
    "customers": {"create": true, "read": true, "update": true, "delete": false},
    "leads": {"create": true, "read": true, "update": true, "delete": false},
    "activities": {"create": true, "read": true, "update": true, "delete": false},
    "products": {"create": true, "read": true, "update": true, "delete": false},
    "settings": {"create": false, "read": true, "update": false, "delete": false}
  }'::jsonb,
  true
),
(
  '10000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000001',
  'Sales Rep',
  '{
    "customers": {"create": true, "read": true, "update": true, "delete": false},
    "leads": {"create": true, "read": true, "update": true, "delete": false},
    "activities": {"create": true, "read": true, "update": true, "delete": false},
    "products": {"create": false, "read": true, "update": false, "delete": false},
    "settings": {"create": false, "read": false, "update": false, "delete": false}
  }'::jsonb,
  true
),
(
  '10000000-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-000000000001',
  'Viewer',
  '{
    "customers": {"create": false, "read": true, "update": false, "delete": false},
    "leads": {"create": false, "read": true, "update": false, "delete": false},
    "activities": {"create": false, "read": true, "update": false, "delete": false},
    "products": {"create": false, "read": true, "update": false, "delete": false},
    "settings": {"create": false, "read": false, "update": false, "delete": false}
  }'::jsonb,
  true
)
ON CONFLICT (id) DO NOTHING;

-- Note: The admin user (kay@thenextperience.com) needs to be created through Supabase Auth signup
-- After signup, their user_id needs to be linked to the Admin role for The Nextperience Group
-- This will be handled in the application signup flow
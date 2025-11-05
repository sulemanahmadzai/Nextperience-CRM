/*
  # Add Super Admin role per company and restrict Admin from settings management

  - Creates/updates a 'Super Admin' role for every company with full permissions including settings (create/read/update/delete = 'all')
  - Updates existing 'Admin' roles to remove settings write permissions (read-only or empty)
  - Optional: turn off users.has_all_access flag usage by setting it to false for all users (kept non-breaking; column remains)
*/

DO $$
DECLARE
  c RECORD;
  super_perm jsonb;
  admin_perm jsonb;
  has_companies boolean;
  has_roles boolean;
  has_users boolean;
BEGIN
  -- Guard: ensure required tables exist, otherwise no-op
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'companies'
  ) INTO has_companies;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'roles'
  ) INTO has_roles;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'users'
  ) INTO has_users;

  IF NOT has_companies OR NOT has_roles THEN
    RAISE NOTICE 'Skipping Super Admin migration: required tables missing (companies: %, roles: %)', has_companies, has_roles;
    RETURN;
  END IF;
  super_perm := '{
    "dashboard": {"read": true},
    "customers": {"create":"all","read":"all","update":"all","delete":"all"},
    "leads": {"create":"all","read":"all","update":"all","delete":"all"},
    "activities": {"create":"all","read":"all","update":"all","delete":"all"},
    "products": {"create":"all","read":"all","update":"all","delete":"all"},
    "pipeline": {"create":"all","read":"all","update":"all","delete":"all"},
    "event_types": {"create":"all","read":"all","update":"all","delete":"all"},
    "quotations": {"create":"all","read":"all","update":"all","delete":"all"},
    "payment_verification": {"create":"all","read":"all","update":"all","delete":"all"},
    "templates": {"create":"all","read":"all","update":"all","delete":"all"},
    "settings": {"create":"all","read":"all","update":"all","delete":"all"}
  }'::jsonb;

  -- Admin: remove settings write (keep read only for visibility)
  admin_perm := '{
    "settings": {"read": true}
  }'::jsonb;

  FOR c IN SELECT id FROM public.companies LOOP
    -- Upsert Super Admin per company
    INSERT INTO public.roles (company_id, name, permissions, is_system)
    VALUES (c.id, 'Super Admin', super_perm, true)
    ON CONFLICT (company_id, name) DO UPDATE SET permissions = EXCLUDED.permissions, is_system = true;

    -- Update Admin: merge to ensure settings is read-only
    UPDATE public.roles r
    SET permissions = COALESCE(r.permissions, '{}'::jsonb) || admin_perm
    WHERE r.company_id = c.id AND r.name = 'Admin';
  END LOOP;

  -- Optional: disable global access flag usage by setting false (keeps column for compatibility)
  IF has_users THEN
    UPDATE public.users SET has_all_access = false WHERE has_all_access = true;
  END IF;
END $$;



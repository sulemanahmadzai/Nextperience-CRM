/*
  # Seed roles with scoped permissions per matrix
  Creates/updates 7 system roles with JSON scopes.
*/

DO $$
DECLARE
  cid uuid;
BEGIN
  -- pick first company as default target for system roles
  SELECT id INTO cid FROM companies ORDER BY created_at LIMIT 1;
  IF cid IS NULL THEN
    RAISE NOTICE 'No companies found to attach roles to';
    RETURN;
  END IF;

  -- Upsert helper
  PERFORM 1 FROM roles WHERE company_id = cid AND name = 'Admin';
  IF NOT FOUND THEN
    INSERT INTO roles (company_id, name, permissions, is_system)
    VALUES (cid, 'Admin',
      '{
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
      }'::jsonb, true);
  ELSE
    UPDATE roles SET permissions = '{
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
      }'::jsonb, is_system = true
    WHERE company_id = cid AND name = 'Admin';
  END IF;

  -- Sales Manager
  INSERT INTO roles (company_id, name, permissions, is_system)
  VALUES (cid, 'Sales Manager', '{
    "dashboard": {"read": true},
    "customers": {"create":"all","read":"own","update":"own","delete":false},
    "leads": {"create":"all","read":"own","update":"own","delete":false},
    "activities": {"create":"all","read":"own","update":"own","delete":false},
    "products": {"create":"all","read":"all","update":"all","delete":false},
    "pipeline": {"create":"all","read":"all","update":"all","delete":false},
    "event_types": {"create":"all","read":"all","update":"all","delete":false},
    "quotations": {"create":"all","read":"all","update":"all","delete":"all"},
    "payment_verification": {"read": true},
    "templates": {"create":"all","read":"all","update":"all","delete":false},
    "settings": {"read": true}
  }'::jsonb, true)
  ON CONFLICT (company_id, name) DO UPDATE SET permissions = EXCLUDED.permissions, is_system = true;

  -- Sales Rep
  INSERT INTO roles (company_id, name, permissions, is_system)
  VALUES (cid, 'Sales Rep', '{
    "dashboard": {"read": true},
    "customers": {"create":"all","read":"own","update":"own","delete":false},
    "leads": {"create":"all","read":"own","update":"own","delete":false},
    "activities": {"create":"all","read":"own","update":"own","delete":false},
    "products": {"create":"all","read":"all","update":"all","delete":false},
    "pipeline": {"create":"all","read":"ownDeals","update":"ownDeals","delete":false},
    "event_types": {"create":false,"read":"all","update":"all","delete":false},
    "quotations": {"create":"all","read":"own","update":"own","delete":false},
    "payment_verification": {"read": true},
    "templates": {"create":"all","read":"all","update":"all","delete":false},
    "settings": {}
  }'::jsonb, true)
  ON CONFLICT (company_id, name) DO UPDATE SET permissions = EXCLUDED.permissions, is_system = true;

  -- Reservations Officer
  INSERT INTO roles (company_id, name, permissions, is_system)
  VALUES (cid, 'Reservations Officer', '{
    "dashboard": {"read": true},
    "customers": {"create":"all","read":"own","update":"own","delete":false},
    "leads": {"create":"all","read":"own","update":"own","delete":false},
    "activities": {"create":"all","read":"own","update":"own","delete":false},
    "products": {"create":"all","read":"all","update":"all","delete":false},
    "pipeline": {"create":"all","read":"ownDeals","update":"ownDeals","delete":false},
    "event_types": {"create":false,"read":"all","update":"all","delete":false},
    "quotations": {"create":"all","read":"own","update":"own","delete":false},
    "payment_verification": {"read": true},
    "templates": {"create":"all","read":"all","update":"all","delete":false},
    "settings": {}
  }'::jsonb, true)
  ON CONFLICT (company_id, name) DO UPDATE SET permissions = EXCLUDED.permissions, is_system = true;

  -- Finance
  INSERT INTO roles (company_id, name, permissions, is_system)
  VALUES (cid, 'Finance', '{
    "dashboard": {"read": true},
    "customers": {"read":"all"},
    "leads": {"read":"all"},
    "activities": {"read":"all"},
    "products": {"read":"all"},
    "pipeline": {"read":"all"},
    "event_types": {"read":"all"},
    "quotations": {"read":"all"},
    "payment_verification": {"create":"all","read":"all","update":"all","delete":false},
    "templates": {"read":"all"},
    "settings": {}
  }'::jsonb, true)
  ON CONFLICT (company_id, name) DO UPDATE SET permissions = EXCLUDED.permissions, is_system = true;

  -- Support
  INSERT INTO roles (company_id, name, permissions, is_system)
  VALUES (cid, 'Support', '{
    "dashboard": {"read": true},
    "customers": {"read":"all"},
    "leads": {"read":"all"},
    "activities": {"read":"all"},
    "products": {"read":"all"},
    "pipeline": {"read":"all"},
    "event_types": {"read":"all"},
    "quotations": {"read":"all"},
    "payment_verification": {"read":"all"},
    "templates": {"read":"all"},
    "settings": {}
  }'::jsonb, true)
  ON CONFLICT (company_id, name) DO UPDATE SET permissions = EXCLUDED.permissions, is_system = true;

  -- Viewer
  INSERT INTO roles (company_id, name, permissions, is_system)
  VALUES (cid, 'Viewer', '{
    "dashboard": {"read": true},
    "customers": {"read":"all"},
    "leads": {"read":"all"},
    "activities": {"read":"all"},
    "products": {"read":"all"},
    "pipeline": {"read":"all"},
    "event_types": {"read":"all"},
    "quotations": {"read":"all"},
    "payment_verification": {"read":"all"},
    "templates": {"read":"all"},
    "settings": {"read":"all"}
  }'::jsonb, true)
  ON CONFLICT (company_id, name) DO UPDATE SET permissions = EXCLUDED.permissions, is_system = true;
END $$;



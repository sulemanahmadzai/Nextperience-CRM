/*
  # Create Super Admin User - lacapkatrian@gmail.com
  
  This migration creates a new super admin user with full system access.
  
  1. Creates auth user lacapkatrian@gmail.com with password @2025Tng
  2. Inserts user record with has_all_access = true
  3. Assigns Admin role to all active companies
  
  Security:
    - User has has_all_access flag set to true
    - Full Admin permissions across all companies
*/

DO $$
DECLARE
  new_user_id uuid := gen_random_uuid();
  existing_auth_user_id uuid;
  company_record record;
  admin_role_id uuid;
BEGIN
  -- Check if user already exists in auth.users
  SELECT id INTO existing_auth_user_id
  FROM auth.users
  WHERE email = 'lacapkatrian@gmail.com';

  IF existing_auth_user_id IS NOT NULL THEN
    RAISE NOTICE 'User already exists in auth.users with ID: %', existing_auth_user_id;
    new_user_id := existing_auth_user_id;
  ELSE
    -- Create the auth user
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      aud,
      role,
      created_at,
      updated_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change
    )
    VALUES (
      new_user_id,
      '00000000-0000-0000-0000-000000000000',
      'lacapkatrian@gmail.com',
      crypt('@2025Tng', gen_salt('bf')),
      NOW(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Katrian Lacap"}',
      'authenticated',
      'authenticated',
      NOW(),
      NOW(),
      '',
      '',
      '',
      ''
    );

    -- Insert into identities table
    INSERT INTO auth.identities (
      id,
      user_id,
      provider_id,
      provider,
      identity_data,
      last_sign_in_at,
      created_at,
      updated_at
    )
    VALUES (
      new_user_id,
      new_user_id,
      'lacapkatrian@gmail.com',
      'email',
      jsonb_build_object('sub', new_user_id, 'email', 'lacapkatrian@gmail.com'),
      NOW(),
      NOW(),
      NOW()
    );
  END IF;

  -- Insert or update users table with has_all_access
  INSERT INTO users (id, email, full_name, has_all_access, is_active)
  VALUES (new_user_id, 'lacapkatrian@gmail.com', 'Katrian Lacap', true, true)
  ON CONFLICT (id) DO UPDATE
  SET has_all_access = true, is_active = true;

  -- Assign Admin role for all active companies
  FOR company_record IN 
    SELECT id FROM companies WHERE is_active = true
  LOOP
    -- Get the Admin role for this company
    SELECT id INTO admin_role_id
    FROM roles
    WHERE company_id = company_record.id AND name = 'Admin'
    LIMIT 1;

    -- Insert user_company_role
    IF admin_role_id IS NOT NULL THEN
      INSERT INTO user_company_roles (user_id, company_id, role_id, is_active)
      VALUES (new_user_id, company_record.id, admin_role_id, true)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  RAISE NOTICE 'Super admin user created/updated: lacapkatrian@gmail.com with ID: %', new_user_id;
END $$;

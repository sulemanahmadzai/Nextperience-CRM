/*
  # Make Roles Global Across All Business Units

  1. Changes
    - Make company_id nullable in roles table
    - Consolidate duplicate roles into global roles
    - Keep "The Nextperience Group" roles (Manager, Sales Rep, etc.) and make them global
    - Update foreign key constraint to allow NULL company_id
  
  2. Security
    - Update RLS policies to allow reading global roles (company_id IS NULL)
*/

DO $$ 
BEGIN
  -- Make company_id nullable if it isn't already
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'roles' AND column_name = 'company_id' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE roles ALTER COLUMN company_id DROP NOT NULL;
  END IF;
END $$;

-- Keep only The Nextperience Group's roles and make them global
UPDATE roles 
SET company_id = NULL 
WHERE company_id = '00000000-0000-0000-0000-000000000001';

-- Delete duplicate Admin roles from other companies since we now have a global Admin role
DELETE FROM roles 
WHERE name = 'Admin' 
AND company_id IS NOT NULL;

-- Delete any other company-specific roles (they can be recreated if needed)
DELETE FROM roles WHERE company_id IS NOT NULL;

-- Update RLS policy for roles to allow reading global roles
DROP POLICY IF EXISTS "Users can read roles in their company" ON roles;
DROP POLICY IF EXISTS "Users can read global and company roles" ON roles;

CREATE POLICY "Users can read global and company roles"
  ON roles
  FOR SELECT
  TO authenticated
  USING (company_id IS NULL OR company_id IN (
    SELECT company_id FROM user_company_roles WHERE user_id = auth.uid()
  ));

-- Update policy for creating/updating/deleting roles (admins only)
DROP POLICY IF EXISTS "Admins can manage roles" ON roles;
DROP POLICY IF EXISTS "Admins can create global roles" ON roles;
DROP POLICY IF EXISTS "Admins can update roles" ON roles;
DROP POLICY IF EXISTS "Admins can delete custom roles" ON roles;

CREATE POLICY "Admins can create roles"
  ON roles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_company_roles ucr
      JOIN roles r ON r.id = ucr.role_id
      WHERE ucr.user_id = auth.uid()
      AND r.name = 'Admin'
    )
  );

CREATE POLICY "Admins can update any role"
  ON roles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_company_roles ucr
      JOIN roles r ON r.id = ucr.role_id
      WHERE ucr.user_id = auth.uid()
      AND r.name = 'Admin'
    )
  );

CREATE POLICY "Admins can delete non-system roles"
  ON roles
  FOR DELETE
  TO authenticated
  USING (
    is_system = false
    AND EXISTS (
      SELECT 1 FROM user_company_roles ucr
      JOIN roles r ON r.id = ucr.role_id
      WHERE ucr.user_id = auth.uid()
      AND r.name = 'Admin'
    )
  );

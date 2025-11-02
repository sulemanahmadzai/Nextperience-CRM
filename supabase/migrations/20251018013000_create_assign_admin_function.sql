/*
  # Create Admin Assignment Function

  ## Overview
  Creates a database function that can assign users to companies and roles,
  bypassing RLS policies. This is necessary for initial admin creation.

  ## New Functions
  - `assign_user_to_company_role` - Assigns a user to a company with a specific role
    - Parameters:
      - p_user_id (uuid) - The user's ID from auth.users
      - p_company_id (uuid) - The company ID
      - p_role_id (uuid) - The role ID
    - Returns: boolean (true on success)
    - Security: SECURITY DEFINER (runs with owner privileges, bypassing RLS)

  ## Important Notes
  - This function is marked as SECURITY DEFINER to bypass RLS
  - It's used for bootstrapping the admin user
  - Includes duplicate check to prevent errors
*/

-- Create function to assign user to company role
CREATE OR REPLACE FUNCTION assign_user_to_company_role(
  p_user_id uuid,
  p_company_id uuid,
  p_role_id uuid
)
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if assignment already exists
  IF EXISTS (
    SELECT 1 FROM user_company_roles
    WHERE user_id = p_user_id
      AND company_id = p_company_id
      AND role_id = p_role_id
  ) THEN
    -- Update to active if it exists
    UPDATE user_company_roles
    SET is_active = true
    WHERE user_id = p_user_id
      AND company_id = p_company_id
      AND role_id = p_role_id;
    RETURN true;
  END IF;

  -- Insert new assignment
  INSERT INTO user_company_roles (user_id, company_id, role_id, is_active)
  VALUES (p_user_id, p_company_id, p_role_id, true);

  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to assign user to company role: %', SQLERRM;
    RETURN false;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION assign_user_to_company_role(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION assign_user_to_company_role(uuid, uuid, uuid) TO anon;

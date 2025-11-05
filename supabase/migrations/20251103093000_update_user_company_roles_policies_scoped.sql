/*
  # Update user_company_roles and roles policies to scoped RBAC

  - Replace old boolean-permission checks with rbac_scope() using 'settings'
  - Allow admins (settings.update) to manage assignments and roles per company
  - Keep safe, non-recursive SELECT for basic visibility
*/

-- USER_COMPANY_ROLES
DROP POLICY IF EXISTS "Users can view their own company roles" ON user_company_roles;
DROP POLICY IF EXISTS "Users with settings permission can manage user roles" ON user_company_roles;
DROP POLICY IF EXISTS "Users can view own company assignments" ON user_company_roles;
DROP POLICY IF EXISTS "Admins can insert user assignments" ON user_company_roles;
DROP POLICY IF EXISTS "Admins can update user assignments" ON user_company_roles;
DROP POLICY IF EXISTS "Admins can delete user assignments" ON user_company_roles;
DROP POLICY IF EXISTS "Admins can manage user assignments" ON user_company_roles;

-- Basic visibility: each user can see their own assignments
CREATE POLICY "Users can view own company assignments"
  ON user_company_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Management (INSERT/UPDATE/DELETE) gated by settings.update scope for that company
CREATE POLICY "Users with settings.update can manage user roles"
  ON user_company_roles FOR ALL
  TO authenticated
  USING (
    case rbac_scope('settings','update', user_company_roles.company_id)
      when 'all' then true
      when 'true' then true  -- boolean true represented as text
      else false
    end
  )
  WITH CHECK (
    case rbac_scope('settings','update', user_company_roles.company_id)
      when 'all' then true
      when 'true' then true
      else false
    end
  );

-- ROLES management using the same scoped check
DROP POLICY IF EXISTS "Users can view roles in their companies" ON roles;
DROP POLICY IF EXISTS "Admins can manage company roles" ON roles;
DROP POLICY IF EXISTS "Admins can insert roles" ON roles;
DROP POLICY IF EXISTS "Admins can update roles" ON roles;
DROP POLICY IF EXISTS "Admins can delete roles" ON roles;

-- Keep simple SELECT: users see roles for companies they belong to
CREATE POLICY "Users can view roles in their companies"
  ON roles FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_company_roles
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Manage roles if settings.update allows
CREATE POLICY "Users with settings.update can manage company roles"
  ON roles FOR ALL
  TO authenticated
  USING (
    case rbac_scope('settings','update', roles.company_id)
      when 'all' then true
      when 'true' then true
      else false
    end
  )
  WITH CHECK (
    case rbac_scope('settings','update', roles.company_id)
      when 'all' then true
      when 'true' then true
      else false
    end
  );




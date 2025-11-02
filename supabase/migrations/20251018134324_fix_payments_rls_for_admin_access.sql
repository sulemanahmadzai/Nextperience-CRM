/*
  # Fix Payment RLS Policies for Admin and Finance Access

  1. Policy Updates
    - Update payments SELECT policy to include is_active check
    - Ensure Admin and Finance Officer roles can access all payment data
    - Fix potential circular dependency issues

  2. Notes
    - This ensures Admins and Finance Officers can view all payments in their company
    - Maintains security by checking is_active status
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view payments in their company" ON payments;
DROP POLICY IF EXISTS "Users with quotation access can create payments" ON payments;
DROP POLICY IF EXISTS "Finance Officers and Admins can update payments" ON payments;

-- Recreate SELECT policy with is_active check
CREATE POLICY "Users can view payments in their company"
  ON payments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_company_roles
      WHERE user_id = auth.uid()
      AND company_id = payments.company_id
      AND is_active = true
    )
  );

-- Recreate INSERT policy
CREATE POLICY "Users with quotation access can create payments"
  ON payments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_company_roles
      WHERE user_id = auth.uid()
      AND company_id = payments.company_id
      AND is_active = true
    )
  );

-- Recreate UPDATE policy for Finance Officers and Admins
CREATE POLICY "Finance Officers and Admins can update payments"
  ON payments FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_company_roles ucr
      JOIN roles r ON ucr.role_id = r.id
      WHERE ucr.user_id = auth.uid()
      AND ucr.company_id = payments.company_id
      AND ucr.is_active = true
      AND r.name IN ('Admin', 'Super Admin', 'Finance Officer')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_company_roles ucr
      JOIN roles r ON ucr.role_id = r.id
      WHERE ucr.user_id = auth.uid()
      AND ucr.company_id = payments.company_id
      AND ucr.is_active = true
      AND r.name IN ('Admin', 'Super Admin', 'Finance Officer')
    )
  );

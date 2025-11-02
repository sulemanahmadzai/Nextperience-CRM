/*
  # Add Role-Based Permissions and Payment Locking System

  1. Overview
    - Implements role-based access control for Leads and Quotations
    - Adds payment verification locking mechanism
    - Creates helper functions for permission checking

  2. Permission Rules
    - Admin, Manager, Sales Rep: Can edit, move, delete (with restrictions)
    - Finance, Viewer: View-only access
    - Records with verified payments: Locked from deletion for Manager/Sales Rep
    - Admin: Full access even with verified payments

  3. New Functions
    - `check_user_role`: Returns user's role name
    - `has_verified_payment`: Checks if lead/quotation has verified payment
    - `can_edit_record`: Checks if user can edit based on role
    - `can_delete_record`: Checks if user can delete (considers verified payments)
    - `log_audit_action`: Logs all actions to audit_logs table

  4. Security
    - All functions use auth.uid() for security
    - Proper role checking against user_company_roles
    - Audit trail for all modifications
*/

-- Function to get user's role name
CREATE OR REPLACE FUNCTION check_user_role()
RETURNS TEXT AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT r.name INTO user_role
  FROM user_company_roles ucr
  JOIN roles r ON r.id = ucr.role_id
  WHERE ucr.user_id = auth.uid()
  LIMIT 1;
  
  RETURN COALESCE(user_role, 'Viewer');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if a quotation has verified payment
CREATE OR REPLACE FUNCTION has_verified_payment_quotation(quotation_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  has_verified BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM payments
    WHERE quotation_id = quotation_uuid
    AND verification_status = 'verified'
  ) INTO has_verified;
  
  RETURN COALESCE(has_verified, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if a lead has verified payment (through quotations)
CREATE OR REPLACE FUNCTION has_verified_payment_lead(lead_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  has_verified BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM quotations q
    JOIN payments p ON p.quotation_id = q.id
    WHERE q.lead_id = lead_uuid
    AND p.verification_status = 'verified'
  ) INTO has_verified;
  
  RETURN COALESCE(has_verified, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user can edit records
CREATE OR REPLACE FUNCTION can_edit_record()
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
BEGIN
  user_role := check_user_role();
  
  RETURN user_role IN ('Admin', 'Manager', 'Sales Representative');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user can delete a lead
CREATE OR REPLACE FUNCTION can_delete_lead(lead_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
  has_payment BOOLEAN;
BEGIN
  user_role := check_user_role();
  has_payment := has_verified_payment_lead(lead_uuid);
  
  -- Admin can always delete
  IF user_role = 'Admin' THEN
    RETURN TRUE;
  END IF;
  
  -- Manager and Sales Rep can delete only if no verified payment
  IF user_role IN ('Manager', 'Sales Representative') THEN
    RETURN NOT has_payment;
  END IF;
  
  -- Other roles cannot delete
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user can delete a quotation
CREATE OR REPLACE FUNCTION can_delete_quotation(quotation_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
  has_payment BOOLEAN;
BEGIN
  user_role := check_user_role();
  has_payment := has_verified_payment_quotation(quotation_uuid);
  
  -- Admin can always delete
  IF user_role = 'Admin' THEN
    RETURN TRUE;
  END IF;
  
  -- Manager and Sales Rep can delete only if no verified payment
  IF user_role IN ('Manager', 'Sales Representative') THEN
    RETURN NOT has_payment;
  END IF;
  
  -- Other roles cannot delete
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enhanced audit logging function
CREATE OR REPLACE FUNCTION log_audit_action(
  p_table_name TEXT,
  p_record_id UUID,
  p_action TEXT,
  p_old_data JSONB DEFAULT NULL,
  p_new_data JSONB DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO audit_logs (
    table_name,
    record_id,
    action,
    old_data,
    new_data,
    user_id,
    created_at
  ) VALUES (
    p_table_name,
    p_record_id,
    p_action,
    p_old_data,
    p_new_data,
    auth.uid(),
    NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION check_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION has_verified_payment_quotation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION has_verified_payment_lead(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION can_edit_record() TO authenticated;
GRANT EXECUTE ON FUNCTION can_delete_lead(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION can_delete_quotation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION log_audit_action(TEXT, UUID, TEXT, JSONB, JSONB) TO authenticated;

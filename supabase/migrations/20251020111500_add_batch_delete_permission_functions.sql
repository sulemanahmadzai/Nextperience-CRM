/*
  # Add Batch Delete Permission Functions

  1. New Functions
    - `can_delete_leads_batch` - Check delete permissions for multiple leads at once
    - `can_delete_quotations_batch` - Check delete permissions for multiple quotations at once

  2. Purpose
    - Improve performance by reducing the number of database round trips
    - Return a JSONB object mapping entity IDs to boolean permission values
    - Significantly speeds up the Leads page and Quotations page loading

  3. Security
    - Functions use SECURITY DEFINER to check permissions properly
    - Reuse existing permission logic from individual check functions
*/

-- Batch function to check delete permissions for multiple leads
CREATE OR REPLACE FUNCTION can_delete_leads_batch(lead_uuids UUID[])
RETURNS JSONB AS $$
DECLARE
  user_role TEXT;
  result JSONB := '{}';
  lead_uuid UUID;
  has_payment BOOLEAN;
BEGIN
  user_role := check_user_role();

  -- If Admin, all leads can be deleted
  IF user_role = 'Admin' THEN
    FOREACH lead_uuid IN ARRAY lead_uuids
    LOOP
      result := result || jsonb_build_object(lead_uuid::TEXT, TRUE);
    END LOOP;
    RETURN result;
  END IF;

  -- For Manager and Sales Rep, check each lead for payment status
  IF user_role IN ('Manager', 'Sales Representative') THEN
    FOREACH lead_uuid IN ARRAY lead_uuids
    LOOP
      has_payment := has_verified_payment_lead(lead_uuid);
      result := result || jsonb_build_object(lead_uuid::TEXT, NOT has_payment);
    END LOOP;
    RETURN result;
  END IF;

  -- Other roles cannot delete anything
  FOREACH lead_uuid IN ARRAY lead_uuids
  LOOP
    result := result || jsonb_build_object(lead_uuid::TEXT, FALSE);
  END LOOP;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Batch function to check delete permissions for multiple quotations
CREATE OR REPLACE FUNCTION can_delete_quotations_batch(quotation_uuids UUID[])
RETURNS JSONB AS $$
DECLARE
  user_role TEXT;
  result JSONB := '{}';
  quotation_uuid UUID;
  has_payment BOOLEAN;
BEGIN
  user_role := check_user_role();

  -- If Admin, all quotations can be deleted
  IF user_role = 'Admin' THEN
    FOREACH quotation_uuid IN ARRAY quotation_uuids
    LOOP
      result := result || jsonb_build_object(quotation_uuid::TEXT, TRUE);
    END LOOP;
    RETURN result;
  END IF;

  -- For Manager and Sales Rep, check each quotation for payment status
  IF user_role IN ('Manager', 'Sales Representative') THEN
    FOREACH quotation_uuid IN ARRAY quotation_uuids
    LOOP
      has_payment := has_verified_payment_quotation(quotation_uuid);
      result := result || jsonb_build_object(quotation_uuid::TEXT, NOT has_payment);
    END LOOP;
    RETURN result;
  END IF;

  -- Other roles cannot delete anything
  FOREACH quotation_uuid IN ARRAY quotation_uuids
  LOOP
    result := result || jsonb_build_object(quotation_uuid::TEXT, FALSE);
  END LOOP;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION can_delete_leads_batch(UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION can_delete_quotations_batch(UUID[]) TO authenticated;

/*
  # Fix Template Line Items RLS Policy

  1. Problem
    - When inserting template_line_items for a NEW template, the policy fails because it tries to join with quotation_templates before the template is fully committed
    - The WITH CHECK clause needs to validate the user has permission, but the template might not be visible in the same transaction

  2. Solution
    - Simplify the INSERT policy to check if the template exists and belongs to a company the user has admin/manager access to
    - Use a more permissive check that doesn't cause circular dependency issues
*/

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Admins and managers can create template line items" ON template_line_items;

-- Create a new, simpler policy for INSERT
CREATE POLICY "Admins and managers can create template line items"
  ON template_line_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 
      FROM quotation_templates t
      JOIN user_company_roles ucr ON ucr.company_id = t.company_id
      JOIN roles r ON r.id = ucr.role_id
      WHERE t.id = template_line_items.template_id
      AND ucr.user_id = auth.uid()
      AND r.name IN ('admin', 'manager')
    )
  );

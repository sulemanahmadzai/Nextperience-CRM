/*
  # Fix Event Types RLS Policies

  1. Changes
    - Drop all existing event_types policies
    - Recreate clean, consistent policies
    - Ensure SELECT works for all users with active roles
    - Ensure INSERT/UPDATE/DELETE work for Admins and Managers

  2. Security
    - Maintains proper row level security
    - Consistent is_active checking across all policies
*/

DROP POLICY IF EXISTS "Users can view event types from their company" ON event_types;
DROP POLICY IF EXISTS "Users can view event types for their companies" ON event_types;
DROP POLICY IF EXISTS "Managers and admins can create event types" ON event_types;
DROP POLICY IF EXISTS "Managers and admins can update event types" ON event_types;
DROP POLICY IF EXISTS "Managers and admins can delete event types" ON event_types;
DROP POLICY IF EXISTS "Admins can insert event types" ON event_types;
DROP POLICY IF EXISTS "Admins can update event types" ON event_types;
DROP POLICY IF EXISTS "Admins can delete event types" ON event_types;

CREATE POLICY "Users can view event types"
  ON event_types FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id 
      FROM user_company_roles 
      WHERE user_id = auth.uid()
      AND is_active = true
    )
  );

CREATE POLICY "Admins and managers can create event types"
  ON event_types FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT ucr.company_id 
      FROM user_company_roles ucr
      JOIN roles r ON ucr.role_id = r.id
      WHERE ucr.user_id = auth.uid() 
      AND ucr.is_active = true
      AND r.name IN ('Admin', 'Manager')
    )
  );

CREATE POLICY "Admins and managers can update event types"
  ON event_types FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT ucr.company_id 
      FROM user_company_roles ucr
      JOIN roles r ON ucr.role_id = r.id
      WHERE ucr.user_id = auth.uid() 
      AND ucr.is_active = true
      AND r.name IN ('Admin', 'Manager')
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT ucr.company_id 
      FROM user_company_roles ucr
      JOIN roles r ON ucr.role_id = r.id
      WHERE ucr.user_id = auth.uid() 
      AND ucr.is_active = true
      AND r.name IN ('Admin', 'Manager')
    )
  );

CREATE POLICY "Admins and managers can delete event types"
  ON event_types FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT ucr.company_id 
      FROM user_company_roles ucr
      JOIN roles r ON ucr.role_id = r.id
      WHERE ucr.user_id = auth.uid() 
      AND ucr.is_active = true
      AND r.name IN ('Admin', 'Manager')
    )
  );

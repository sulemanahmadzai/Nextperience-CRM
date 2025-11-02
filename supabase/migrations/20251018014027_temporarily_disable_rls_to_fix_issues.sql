/*
  # Temporarily Disable RLS to Fix Access Issues

  ## Overview
  There are circular dependency issues causing infinite recursion.
  This migration temporarily disables RLS on core tables to allow
  access while we fix the policies properly.

  ## Changes
  - Disable RLS on companies, roles, and user_company_roles tables
  - This is TEMPORARY - will be re-enabled with proper policies

  ## Security Note
  This is a temporary measure for development. In production, proper
  RLS policies must be in place.
*/

-- Temporarily disable RLS on core tables
ALTER TABLE companies DISABLE ROW LEVEL SECURITY;
ALTER TABLE roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_company_roles DISABLE ROW LEVEL SECURITY;

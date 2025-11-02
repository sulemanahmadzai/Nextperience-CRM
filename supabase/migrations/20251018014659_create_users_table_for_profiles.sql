/*
  # Create Users Profile Table

  ## Overview
  Creates a public users table to store user profile information that can
  be queried with RLS. This syncs with auth.users automatically.

  ## New Tables
  - `users`
    - `id` (uuid, primary key, references auth.users)
    - `email` (text)
    - `full_name` (text, nullable)
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  ## Security
  - Enable RLS on users table
  - Users can read all user profiles in their companies
  - Users can update their own profile
  
  ## Triggers
  - Auto-sync when new users are created in auth.users
*/

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Users can view profiles of users in their companies
CREATE POLICY "Users can view profiles in their companies"
  ON users FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT DISTINCT ucr.user_id
      FROM user_company_roles ucr
      WHERE ucr.company_id IN (
        SELECT company_id
        FROM user_company_roles
        WHERE user_id = auth.uid() AND is_active = true
      )
    )
  );

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create user profile
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Insert existing users
INSERT INTO public.users (id, email, full_name)
SELECT 
  id, 
  email,
  raw_user_meta_data->>'full_name'
FROM auth.users
ON CONFLICT (id) DO UPDATE
SET email = EXCLUDED.email,
    full_name = EXCLUDED.full_name;

/*
  # Update Quotation Signatures and Email Tracking

  1. Updates to quotations table
    - Add `signed_by` (text) - name of person who signed
    - Add `signed_at` (timestamptz) - when the quotation was signed
    - Add `signature_image` (text) - base64 encoded signature image
  
  2. Updates to email_messages table
    - Add `direction` (text) - 'inbound' or 'outbound'
    - Add `from_address` (text)
    - Add `to_addresses` (text[])
    - Add `gmail_message_id` (text) - Gmail's message ID
    - Add `entity_type` (text) - for polymorphic relationships
    - Add `entity_id` (uuid) - for polymorphic relationships
  
  3. New google_tokens table
    - `id` (uuid, primary key)
    - `user_id` (uuid, foreign key to auth.users, unique)
    - `access_token` (text)
    - `refresh_token` (text)
    - `expires_at` (timestamptz)
    - `scope` (text)
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  4. Security
    - Enable RLS on new table
    - Add policies for authenticated users
*/

-- Add signature fields to quotations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotations' AND column_name = 'signed_by'
  ) THEN
    ALTER TABLE quotations ADD COLUMN signed_by text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotations' AND column_name = 'signed_at'
  ) THEN
    ALTER TABLE quotations ADD COLUMN signed_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotations' AND column_name = 'signature_image'
  ) THEN
    ALTER TABLE quotations ADD COLUMN signature_image text;
  END IF;
END $$;

-- Update email_messages table with new fields
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_messages' AND column_name = 'direction'
  ) THEN
    ALTER TABLE email_messages ADD COLUMN direction text DEFAULT 'outbound' CHECK (direction IN ('inbound', 'outbound'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_messages' AND column_name = 'from_address'
  ) THEN
    ALTER TABLE email_messages ADD COLUMN from_address text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_messages' AND column_name = 'to_addresses'
  ) THEN
    ALTER TABLE email_messages ADD COLUMN to_addresses text[];
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_messages' AND column_name = 'gmail_message_id'
  ) THEN
    ALTER TABLE email_messages ADD COLUMN gmail_message_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_messages' AND column_name = 'entity_type'
  ) THEN
    ALTER TABLE email_messages ADD COLUMN entity_type text CHECK (entity_type IN ('quotation', 'lead', 'customer'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_messages' AND column_name = 'entity_id'
  ) THEN
    ALTER TABLE email_messages ADD COLUMN entity_id uuid;
  END IF;
END $$;

-- Create google_tokens table
CREATE TABLE IF NOT EXISTS google_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  refresh_token text,
  expires_at timestamptz NOT NULL,
  scope text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on google_tokens
ALTER TABLE google_tokens ENABLE ROW LEVEL SECURITY;

-- Policies for google_tokens
DROP POLICY IF EXISTS "Users can view own Google tokens" ON google_tokens;
CREATE POLICY "Users can view own Google tokens"
  ON google_tokens FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own Google tokens" ON google_tokens;
CREATE POLICY "Users can insert own Google tokens"
  ON google_tokens FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own Google tokens" ON google_tokens;
CREATE POLICY "Users can update own Google tokens"
  ON google_tokens FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own Google tokens" ON google_tokens;
CREATE POLICY "Users can delete own Google tokens"
  ON google_tokens FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_messages_entity ON email_messages(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_gmail_id ON email_messages(gmail_message_id);
CREATE INDEX IF NOT EXISTS idx_google_tokens_user_id ON google_tokens(user_id);
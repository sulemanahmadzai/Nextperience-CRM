/*
  # Create Philippine Holidays Table

  1. New Tables
    - `philippine_holidays`
      - `id` (uuid, primary key)
      - `date` (date, unique) - The date of the holiday
      - `name` (text) - Name of the holiday
      - `type` (text) - Type: 'regular' or 'special'
      - `year` (integer) - Year of the holiday
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `philippine_holidays` table
    - Add policy for all authenticated users to read holidays
    - Only admins can insert/update holidays (will be managed via migrations)

  3. Data
    - Seed with 2025 Philippine holidays
*/

CREATE TABLE IF NOT EXISTS philippine_holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date UNIQUE NOT NULL,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('regular', 'special')),
  year integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE philippine_holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read holidays"
  ON philippine_holidays
  FOR SELECT
  TO authenticated
  USING (true);

-- Seed 2025 Philippine Holidays
INSERT INTO philippine_holidays (date, name, type, year) VALUES
  ('2025-01-01', 'New Year''s Day', 'regular', 2025),
  ('2025-01-29', 'Chinese New Year', 'special', 2025),
  ('2025-02-25', 'EDSA People Power Revolution Anniversary', 'special', 2025),
  ('2025-04-09', 'Araw ng Kagitingan (Day of Valor)', 'regular', 2025),
  ('2025-04-17', 'Maundy Thursday', 'regular', 2025),
  ('2025-04-18', 'Good Friday', 'regular', 2025),
  ('2025-04-19', 'Black Saturday', 'special', 2025),
  ('2025-05-01', 'Labor Day', 'regular', 2025),
  ('2025-06-12', 'Independence Day', 'regular', 2025),
  ('2025-08-21', 'Ninoy Aquino Day', 'special', 2025),
  ('2025-08-25', 'National Heroes Day', 'regular', 2025),
  ('2025-11-01', 'All Saints'' Day', 'special', 2025),
  ('2025-11-30', 'Bonifacio Day', 'regular', 2025),
  ('2025-12-08', 'Feast of the Immaculate Conception of Mary', 'special', 2025),
  ('2025-12-24', 'Christmas Eve', 'special', 2025),
  ('2025-12-25', 'Christmas Day', 'regular', 2025),
  ('2025-12-30', 'Rizal Day', 'regular', 2025),
  ('2025-12-31', 'New Year''s Eve', 'special', 2025)
ON CONFLICT (date) DO NOTHING;

-- Seed 2026 Philippine Holidays
INSERT INTO philippine_holidays (date, name, type, year) VALUES
  ('2026-01-01', 'New Year''s Day', 'regular', 2026),
  ('2026-02-17', 'Chinese New Year', 'special', 2026),
  ('2026-02-25', 'EDSA People Power Revolution Anniversary', 'special', 2026),
  ('2026-04-02', 'Maundy Thursday', 'regular', 2026),
  ('2026-04-03', 'Good Friday', 'regular', 2026),
  ('2026-04-04', 'Black Saturday', 'special', 2026),
  ('2026-04-09', 'Araw ng Kagitingan (Day of Valor)', 'regular', 2026),
  ('2026-05-01', 'Labor Day', 'regular', 2026),
  ('2026-06-12', 'Independence Day', 'regular', 2026),
  ('2026-08-21', 'Ninoy Aquino Day', 'special', 2026),
  ('2026-08-31', 'National Heroes Day', 'regular', 2026),
  ('2026-11-01', 'All Saints'' Day', 'special', 2026),
  ('2026-11-30', 'Bonifacio Day', 'regular', 2026),
  ('2026-12-08', 'Feast of the Immaculate Conception of Mary', 'special', 2026),
  ('2026-12-24', 'Christmas Eve', 'special', 2026),
  ('2026-12-25', 'Christmas Day', 'regular', 2026),
  ('2026-12-30', 'Rizal Day', 'regular', 2026),
  ('2026-12-31', 'New Year''s Eve', 'special', 2026)
ON CONFLICT (date) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_philippine_holidays_date ON philippine_holidays(date);
CREATE INDEX IF NOT EXISTS idx_philippine_holidays_year ON philippine_holidays(year);
#!/usr/bin/env node

/**
 * Verify that users exist in auth.users
 * Helps debug foreign key issues
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { readFile } from 'fs/promises';
import { join } from 'path';

dotenv.config();

const NEW_SUPABASE_URL = process.env.NEW_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const NEW_SUPABASE_SERVICE_ROLE_KEY = process.env.NEW_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!NEW_SUPABASE_URL || !NEW_SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(NEW_SUPABASE_URL, NEW_SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const USERS_FILE = join(process.cwd(), 'exports', 'users.json');

async function main() {
  console.log('🔍 Verifying users in auth.users...\n');

  const content = await readFile(USERS_FILE, 'utf-8');
  const users = JSON.parse(content);

  console.log(`Checking ${users.length} users...\n`);

  for (const user of users) {
    const { data, error } = await supabase.auth.admin.getUserById(user.id);
    
    if (error) {
      console.log(`❌ ${user.email} (${user.id}): ${error.message}`);
    } else {
      console.log(`✅ ${user.email} (${user.id}): EXISTS`);
    }
  }

  console.log('\n✅ Verification complete');
}

main().catch(console.error);


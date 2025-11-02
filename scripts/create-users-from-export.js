#!/usr/bin/env node

/**
 * Create users in auth.users from exported users.json
 * This extracts user IDs and emails from the users table export
 * and creates them in auth.users so foreign key constraints work
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

// Load environment variables
dotenv.config();

const NEW_SUPABASE_URL = process.env.NEW_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const NEW_SUPABASE_SERVICE_ROLE_KEY = process.env.NEW_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!NEW_SUPABASE_URL || !NEW_SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing environment variables:');
  console.error('   Required: NEW_SUPABASE_URL (or VITE_SUPABASE_URL)');
  console.error('   Required: NEW_SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_ROLE_KEY)');
  process.exit(1);
}

// Create Supabase client with service role key
const supabase = createClient(NEW_SUPABASE_URL, NEW_SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const EXPORT_DIR = join(process.cwd(), 'exports');
const USERS_FILE = join(EXPORT_DIR, 'users.json');

async function createUsersFromExport() {
  console.log('📤 Creating users in auth.users from exported users.json...\n');
  console.log('⚠️  Note: Passwords cannot be migrated');
  console.log('   Users will need to reset passwords or use OAuth\n');

  if (!existsSync(USERS_FILE)) {
    console.error(`❌ Users export file not found: ${USERS_FILE}`);
    console.error('   Please run export-data.js first');
    process.exit(1);
  }

  // Load exported users
  const content = await readFile(USERS_FILE, 'utf-8');
  const users = JSON.parse(content);

  if (!users || users.length === 0) {
    console.log('ℹ️  No users to create');
    return;
  }

  console.log(`📋 Found ${users.length} users to create\n`);

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errors = [];

  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    const progress = `[${i + 1}/${users.length}]`;

    try {
      // Check if user already exists
      const { data: existingUserData, error: checkError } = await supabase.auth.admin.getUserById(user.id);

      // Check if user exists (data will be null or { user: null } if not found)
      const existingUser = existingUserData?.user;

      if (checkError || !existingUser) {
        // User doesn't exist, create new one
        // Generate a temporary password (user must reset)
        const tempPassword = `Temp_${user.id.substring(0, 8)}!${Math.random().toString(36).slice(-8)}`;

        const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
          id: user.id, // Preserve original ID
          email: user.email,
          email_confirm: true, // Auto-confirm since they were users before
          user_metadata: {},
          app_metadata: {},
          password: tempPassword, // Temporary password
        });

        if (createError) {
          throw createError;
        }

        created++;
        if (created % 5 === 0) {
          console.log(`   ${progress} Created ${created} users...`);
        }
      } else {
        // User exists, verify the ID matches
        if (existingUser.id !== user.id) {
          console.warn(`   ⚠️  ${progress} User ${user.email} exists but with different ID`);
          console.warn(`      Expected: ${user.id}`);
          console.warn(`      Found: ${existingUser.id}`);
          console.warn(`      This will cause foreign key issues. Consider deleting and recreating.`);
          errors.push({
            email: user.email,
            expectedId: user.id,
            actualId: existingUser.id,
            error: 'ID mismatch',
          });
        } else {
          // User exists with correct ID, just update metadata if needed
          updated++;
        }
      }

    } catch (error) {
      console.error(`   ❌ ${progress} Error creating user ${user.email}:`, error.message);
      errors.push({
        email: user.email,
        id: user.id,
        error: error.message,
      });
    }

    // Small delay to avoid rate limiting
    if (i < users.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Users Creation Summary');
  console.log('='.repeat(60));
  console.log(`✅ Created: ${created} users`);
  console.log(`🔄 Updated: ${updated} users`);
  console.log(`⏭️  Skipped: ${skipped} users`);
  if (errors.length > 0) {
    console.log(`❌ Errors: ${errors.length} users`);
    errors.slice(0, 5).forEach(e => {
      console.log(`   - ${e.email}: ${e.error}`);
    });
    if (errors.length > 5) {
      console.log(`   ... and ${errors.length - 5} more`);
    }
  }

  console.log('\n⚠️  IMPORTANT NEXT STEPS:');
  console.log('   1. Users have temporary passwords (cannot be migrated)');
  console.log('   2. Users must reset passwords or use OAuth to login');
  console.log('   3. Now run: npm run migrate:import-data (again)');
  console.log('      This will import the users table and all dependent data');

  return {
    created,
    updated,
    skipped,
    errors: errors.length,
  };
}

async function main() {
  const startTime = Date.now();
  await createUsersFromExport();
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);
  console.log(`\n⏱️  Duration: ${duration}s`);
  console.log('\n✅ User creation completed!');
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});


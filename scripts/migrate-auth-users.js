#!/usr/bin/env node

/**
 * Migrate auth.users to new Supabase project
 * Creates users in new auth.users with same IDs to preserve relationships
 * Note: Users must reset passwords (cannot be migrated)
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { readFile, writeFile } from 'fs/promises';
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

// Create Supabase client with service role key (required for auth.admin)
const supabase = createClient(NEW_SUPABASE_URL, NEW_SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const EXPORT_DIR = join(process.cwd(), 'exports');
const AUTH_USERS_FILE = join(EXPORT_DIR, 'auth-users.json');

async function migrateAuthUsers() {
  console.log('📤 Migrating auth.users to new Supabase project...\n');
  console.log('⚠️  Note: Passwords cannot be migrated');
  console.log('   Users will receive password reset emails or can use OAuth\n');

  if (!existsSync(AUTH_USERS_FILE)) {
    console.error(`❌ Auth users export file not found: ${AUTH_USERS_FILE}`);
    console.error('   Please run export-auth-users.js first');
    process.exit(1);
  }

  // Load exported users
  const content = await readFile(AUTH_USERS_FILE, 'utf-8');
  const users = JSON.parse(content);

  if (!users || users.length === 0) {
    console.log('ℹ️  No users to migrate');
    return;
  }

  console.log(`📋 Found ${users.length} users to migrate\n`);

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errors = [];

  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    const progress = `[${i + 1}/${users.length}]`;

    try {
      // Check if user already exists
      const { data: existingUser, error: checkError } = await supabase.auth.admin.getUserById(user.id);

      if (checkError && checkError.message.includes('not found')) {
        // User doesn't exist, create new one
        // Generate a temporary password (user must reset)
        const tempPassword = `Temp_${user.id.substring(0, 8)}!${Math.random().toString(36).slice(-8)}`;

        const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
          id: user.id, // Preserve original ID
          email: user.email,
          phone: user.phone || undefined,
          email_confirm: !!user.email_confirmed_at, // Confirm if was confirmed before
          phone_confirm: !!user.phone_confirmed_at,
          user_metadata: user.user_metadata || {},
          app_metadata: user.app_metadata || {},
          password: tempPassword, // Temporary password
        });

        if (createError) {
          throw createError;
        }

        // Set email as confirmed if it was before
        if (user.email_confirmed_at) {
          await supabase.auth.admin.updateUserById(user.id, {
            email_confirm: true,
          });
        }

        // Update created_at if possible (may not work, but worth trying)
        // Note: Supabase may not allow updating created_at, but we try
        
        created++;
        if (created % 10 === 0) {
          console.log(`   ${progress} Created ${created} users...`);
        }
      } else if (existingUser) {
        // User exists, update metadata
        const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
          user_metadata: { ...existingUser.user.user_metadata, ...(user.user_metadata || {}) },
          app_metadata: { ...existingUser.user.app_metadata, ...(user.app_metadata || {}) },
        });

        if (updateError) {
          throw updateError;
        }

        updated++;
      } else {
        skipped++;
      }

    } catch (error) {
      console.error(`   ❌ ${progress} Error migrating user ${user.email}:`, error.message);
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
  console.log('📊 Auth Users Migration Summary');
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
  console.log('   1. Send password reset emails to all users');
  console.log('   2. Or configure OAuth providers and notify users to use OAuth');
  console.log('   3. Users cannot login with old passwords (they are encrypted and cannot be migrated)');

  // Save summary
  const summaryPath = join(EXPORT_DIR, 'auth-users-migration-summary.json');
  await writeFile(
    summaryPath,
    JSON.stringify({
      migrationDate: new Date().toISOString(),
      projectUrl: NEW_SUPABASE_URL,
      totals: {
        created,
        updated,
        skipped,
        errors: errors.length,
      },
      errors: errors.slice(0, 10), // Only save first 10 errors
      note: 'Users must reset passwords or use OAuth. Old passwords cannot be migrated.',
    }, null, 2),
    'utf-8'
  );

  console.log(`\n💾 Summary saved to: ${summaryPath}`);
  console.log('\n✅ Auth users migration completed!');
}

async function main() {
  const startTime = Date.now();
  await migrateAuthUsers();
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);
  console.log(`\n⏱️  Duration: ${duration}s`);
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});


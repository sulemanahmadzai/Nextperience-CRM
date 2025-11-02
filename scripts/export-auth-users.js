#!/usr/bin/env node

/**
 * Export auth.users data from old Supabase project
 * Note: Passwords cannot be exported (encrypted)
 * Users will need to reset passwords in new project
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

// Load environment variables
dotenv.config();

const OLD_SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const OLD_SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Check if using anon key (which won't work for auth export)
const usingAnonKey = process.env.VITE_SUPABASE_ANON_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!OLD_SUPABASE_URL) {
  console.error('❌ Missing environment variable: VITE_SUPABASE_URL');
  process.exit(1);
}

if (!OLD_SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing environment variable: SUPABASE_SERVICE_ROLE_KEY');
  console.error('\n⚠️  IMPORTANT: Service role key is REQUIRED to export auth.users');
  console.error('   The anon key does NOT have permission to access auth.admin API');
  console.error('\n📝 To get your service role key:');
  console.error('   1. Go to Supabase Dashboard → Project Settings → API');
  console.error('   2. Copy the "service_role" key (NOT the anon key)');
  console.error('   3. Add it to your .env file:');
  console.error('      SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here');
  console.error('\n💡 Note: If you cannot access the service role key, you can still:');
  console.error('   - Export users manually via SQL: SELECT * FROM auth.users;');
  console.error('   - Or create users fresh in new project and have them reset passwords');
  process.exit(1);
}

if (usingAnonKey) {
  console.warn('⚠️  WARNING: Using anon key detected. Service role key is required for auth export.');
}

// Create Supabase client with service role key (required for auth.admin)
const supabase = createClient(OLD_SUPABASE_URL, OLD_SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const EXPORT_DIR = join(process.cwd(), 'exports');

async function ensureExportDir() {
  if (!existsSync(EXPORT_DIR)) {
    await mkdir(EXPORT_DIR, { recursive: true });
  }
}

async function exportAuthUsers() {
  console.log('📤 Exporting auth.users...\n');
  console.log('⚠️  Note: Passwords cannot be exported (they are encrypted)');
  console.log('   Users will need to reset passwords or use OAuth in the new project\n');

  try {
    // List all users using Admin API
    let allUsers = [];
    let page = 1;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data: { users }, error } = await supabase.auth.admin.listUsers({
        page: page,
        perPage: pageSize,
      });

      if (error) {
        throw error;
      }

      if (users && users.length > 0) {
        // Extract only the data we can safely migrate
        const userData = users.map(user => ({
          id: user.id,
          email: user.email,
          email_confirmed_at: user.email_confirmed_at,
          phone: user.phone,
          phone_confirmed_at: user.phone_confirmed_at,
          confirmed_at: user.confirmed_at,
          last_sign_in_at: user.last_sign_in_at,
          created_at: user.created_at,
          updated_at: user.updated_at,
          user_metadata: user.user_metadata,
          app_metadata: user.app_metadata,
          // Note: encrypted_password is not accessible even with service role
        }));

        allUsers = allUsers.concat(userData);
        console.log(`   📊 Fetched ${allUsers.length} users...`);
      }

      hasMore = users && users.length === pageSize;
      page++;
    }

    // Save to JSON file
    const filePath = join(EXPORT_DIR, 'auth-users.json');
    await writeFile(filePath, JSON.stringify(allUsers, null, 2), 'utf-8');

    console.log(`\n✅ Exported ${allUsers.length} users to ${filePath}`);
    
    // Show summary
    const confirmed = allUsers.filter(u => u.email_confirmed_at).length;
    const withMetadata = allUsers.filter(u => u.user_metadata && Object.keys(u.user_metadata).length > 0).length;

    console.log('\n📊 User Summary:');
    console.log(`   Total users: ${allUsers.length}`);
    console.log(`   Email confirmed: ${confirmed}`);
    console.log(`   With metadata: ${withMetadata}`);
    console.log(`\n⚠️  IMPORTANT: Passwords cannot be migrated!`);
    console.log('   Users must reset passwords or use OAuth after migration.');

    return {
      rowCount: allUsers.length,
      confirmed,
      withMetadata,
      filePath,
    };

  } catch (error) {
    console.error(`❌ Error exporting auth.users:`, error.message);
    if (error.code === 'not_admin' || error.status === 403 || error.message.includes('not allowed')) {
      console.error('\n⚠️  AUTHENTICATION ERROR: Service role key is required');
      console.error('   The key you provided does not have admin permissions.');
      console.error('\n📝 Solutions:');
      console.error('   1. Get your service_role key from Supabase Dashboard:');
      console.error('      Project Settings → API → service_role key');
      console.error('   2. Add to .env: SUPABASE_SERVICE_ROLE_KEY=your-key');
      console.error('\n   3. OR skip auth export and create users manually:');
      console.error('      - Export users table data (already done ✅)');
      console.error('      - Create users in new project via admin UI');
      console.error('      - Or have users register/reset passwords');
      console.error('\n💡 Your regular data export succeeded, so you can proceed with that.');
    } else if (error.message.includes('JWT') || error.message.includes('service_role')) {
      console.error('\n⚠️  Make sure you are using SUPABASE_SERVICE_ROLE_KEY (not anon key)');
      console.error('   The service role key is required to access auth.admin.listUsers()');
    }
    throw error;
  }
}

async function main() {
  console.log('🚀 Starting auth.users export from old Supabase project...\n');
  console.log(`   Project URL: ${OLD_SUPABASE_URL}\n`);

  await ensureExportDir();

  try {
    const startTime = Date.now();
    const result = await exportAuthUsers();
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    // Save summary
    const summaryPath = join(EXPORT_DIR, 'auth-users-summary.json');
    await writeFile(
      summaryPath,
      JSON.stringify({
        exportDate: new Date().toISOString(),
        projectUrl: OLD_SUPABASE_URL,
        duration: `${duration}s`,
        ...result,
        note: 'Passwords cannot be exported. Users must reset passwords after migration.',
      }, null, 2),
      'utf-8'
    );

    console.log(`\n💾 Summary saved to: ${summaryPath}`);
    console.log(`⏱️  Duration: ${duration}s`);
    console.log('\n✅ Auth users export completed!');
  } catch (error) {
    // Save error summary
    const summaryPath = join(EXPORT_DIR, 'auth-users-summary.json');
    await writeFile(
      summaryPath,
      JSON.stringify({
        exportDate: new Date().toISOString(),
        projectUrl: OLD_SUPABASE_URL,
        error: error.message,
        errorCode: error.code,
        note: 'Auth export failed. You can still migrate by creating users manually in new project.',
      }, null, 2),
      'utf-8'
    );

    console.log(`\n💾 Error summary saved to: ${summaryPath}`);
    console.log('\n⚠️  Auth export failed, but you can still proceed:');
    console.log('   1. Your regular data export succeeded ✅');
    console.log('   2. Create users manually in new project');
    console.log('   3. Users will need to reset passwords anyway');
    console.log('\n📝 Alternative: Export auth.users via SQL in Supabase Dashboard SQL Editor:');
    console.log('   SELECT id, email, email_confirmed_at, phone, created_at, user_metadata, app_metadata');
    console.log('   FROM auth.users;');
    
    process.exit(1);
  }
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});


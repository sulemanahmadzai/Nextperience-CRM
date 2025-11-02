#!/usr/bin/env node

/**
 * Import storage files to new Supabase project
 * Uploads files from exports/storage/ to new project buckets
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { readFile, readdir, stat } from 'fs/promises';
import { existsSync, statSync } from 'fs';
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
const supabase = createClient(NEW_SUPABASE_URL, NEW_SUPABASE_SERVICE_ROLE_KEY);

const EXPORT_DIR = join(process.cwd(), 'exports', 'storage');

async function ensureBucketExists(bucketName) {
  // Check if bucket exists
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  
  if (listError) {
    throw listError;
  }

  const bucketExists = buckets?.some(b => b.name === bucketName);

  if (!bucketExists) {
    console.log(`   📦 Creating bucket: ${bucketName}...`);
    // Create bucket (private by default)
    const { error: createError } = await supabase.storage.createBucket(bucketName, {
      public: false,
      fileSizeLimit: 10485760, // 10MB
    });

    if (createError) {
      throw createError;
    }

    console.log(`   ✅ Created bucket: ${bucketName}`);
  }
}

async function uploadFile(bucketName, filePath, relativePath) {
  try {
    const fileBuffer = await readFile(filePath);
    
    const { error } = await supabase.storage
      .from(bucketName)
      .upload(relativePath, fileBuffer, {
        upsert: true, // Overwrite if exists
        contentType: 'application/octet-stream', // Will be detected automatically
      });

    if (error) {
      throw error;
    }

    return true;
  } catch (error) {
    throw error;
  }
}

async function uploadDirectory(bucketName, dirPath, basePath = '') {
  const entries = await readdir(dirPath);
  let uploaded = 0;
  let errors = 0;

  for (const entry of entries) {
    const fullPath = join(dirPath, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      const subDirUploaded = await uploadDirectory(
        bucketName,
        fullPath,
        basePath ? `${basePath}/${entry}` : entry
      );
      uploaded += subDirUploaded.uploaded;
      errors += subDirUploaded.errors;
    } else {
      const relativePath = basePath ? `${basePath}/${entry}` : entry;
      
      try {
        await uploadFile(bucketName, fullPath, relativePath);
        uploaded++;
        
        if (uploaded % 10 === 0) {
          console.log(`   📤 Uploaded ${uploaded} files...`);
        }
      } catch (error) {
        console.error(`   ❌ Error uploading ${relativePath}: ${error.message}`);
        errors++;
      }
    }
  }

  return { uploaded, errors };
}

async function importBucket(bucketName) {
  const bucketDir = join(EXPORT_DIR, bucketName);

  if (!existsSync(bucketDir)) {
    console.log(`⏭️  Skipping ${bucketName} (no export directory found)`);
    return { bucketName, uploaded: 0, skipped: true };
  }

  console.log(`📤 Importing bucket: ${bucketName}...`);

  try {
    // Ensure bucket exists
    await ensureBucketExists(bucketName);

    // Upload all files
    const { uploaded, errors } = await uploadDirectory(bucketName, bucketDir);

    console.log(`   ✅ Uploaded ${uploaded} files to ${bucketName}`);
    if (errors > 0) {
      console.log(`   ⚠️  ${errors} files failed to upload`);
    }

    return {
      bucketName,
      uploaded,
      errors,
      skipped: false,
    };

  } catch (error) {
    console.error(`   ❌ Error importing bucket ${bucketName}:`, error.message);
    return { bucketName, uploaded: 0, error: error.message, skipped: false };
  }
}

async function main() {
  console.log('🚀 Starting storage import to new Supabase project...\n');
  console.log(`   Project URL: ${NEW_SUPABASE_URL}\n`);

  if (!existsSync(EXPORT_DIR)) {
    console.error(`❌ Export directory not found: ${EXPORT_DIR}`);
    console.error('   Please run export-storage.js first');
    process.exit(1);
  }

  // Find all exported buckets
  const entries = await readdir(EXPORT_DIR);
  const buckets = entries.filter(entry => {
    const entryPath = join(EXPORT_DIR, entry);
    return statSync(entryPath).isDirectory() && entry !== 'node_modules';
  });

  if (buckets.length === 0) {
    console.log('ℹ️  No buckets found in export directory');
    return;
  }

  console.log(`📋 Found ${buckets.length} bucket(s) to import: ${buckets.join(', ')}\n`);

  const results = [];
  const startTime = Date.now();

  for (const bucket of buckets) {
    const result = await importBucket(bucket);
    results.push(result);
    console.log(''); // Empty line between buckets
  }

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  // Summary
  console.log('='.repeat(60));
  console.log('📊 Storage Import Summary');
  console.log('='.repeat(60));

  const successful = results.filter(r => !r.skipped && !r.error);
  const skipped = results.filter(r => r.skipped);
  const errors = results.filter(r => r.error);
  const totalFiles = results.reduce((sum, r) => sum + (r.uploaded || 0), 0);

  console.log(`✅ Successfully imported: ${successful.length} buckets`);
  if (skipped.length > 0) {
    console.log(`⏭️  Skipped: ${skipped.length} buckets`);
  }
  if (errors.length > 0) {
    console.log(`❌ Errors: ${errors.length} buckets`);
    errors.forEach(r => console.log(`   - ${r.bucketName}: ${r.error}`));
  }
  console.log(`📦 Total files uploaded: ${totalFiles.toLocaleString()}`);
  console.log(`⏱️  Duration: ${duration}s`);

  // Save summary
  const summaryPath = join(EXPORT_DIR, 'storage-import-summary.json');
  await writeFile(
    summaryPath,
    JSON.stringify({
      importDate: new Date().toISOString(),
      projectUrl: NEW_SUPABASE_URL,
      duration: `${duration}s`,
      buckets: results,
      totals: {
        successful: successful.length,
        skipped: skipped.length,
        errors: errors.length,
        totalFiles,
      },
    }, null, 2),
    'utf-8'
  );

  console.log(`\n💾 Summary saved to: ${summaryPath}`);
  console.log('\n✅ Storage import completed!');
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});


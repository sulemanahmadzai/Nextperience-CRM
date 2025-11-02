#!/usr/bin/env node

/**
 * Export all files from Supabase Storage buckets
 * Downloads files to local exports/storage/ directory
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';

// Load environment variables
dotenv.config();

const OLD_SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const OLD_SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!OLD_SUPABASE_URL || !OLD_SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing environment variables:');
  console.error('   Required: VITE_SUPABASE_URL');
  console.error('   Required: SUPABASE_SERVICE_ROLE_KEY (or VITE_SUPABASE_ANON_KEY as fallback)');
  process.exit(1);
}

// Create Supabase client with service role key
const supabase = createClient(OLD_SUPABASE_URL, OLD_SUPABASE_SERVICE_ROLE_KEY);

// Storage buckets to export
const BUCKETS = [
  'payment-proofs',
];

const EXPORT_DIR = join(process.cwd(), 'exports', 'storage');

async function ensureExportDir() {
  if (!existsSync(EXPORT_DIR)) {
    await mkdir(EXPORT_DIR, { recursive: true });
  }
}

async function exportBucket(bucketName) {
  console.log(`📤 Exporting bucket: ${bucketName}...`);

  try {
    // List all files in the bucket
    const { data: files, error: listError } = await supabase.storage
      .from(bucketName)
      .list('', {
        limit: 1000,
        offset: 0,
        sortBy: { column: 'name', order: 'asc' },
      });

    if (listError) {
      console.error(`   ❌ Error listing files: ${listError.message}`);
      return { bucketName, fileCount: 0, error: listError.message };
    }

    if (!files || files.length === 0) {
      console.log(`   ℹ️  Bucket ${bucketName} is empty`);
      return { bucketName, fileCount: 0 };
    }

    console.log(`   📋 Found ${files.length} files`);

    const bucketDir = join(EXPORT_DIR, bucketName);
    await mkdir(bucketDir, { recursive: true });

    let downloaded = 0;
    let errors = 0;

    // Download each file
    for (const file of files) {
      // Skip directories
      if (file.id === null) {
        continue;
      }

      const filePath = file.name;
      const localFilePath = join(bucketDir, filePath);

      // Create directory structure if needed
      const fileDir = dirname(localFilePath);
      if (!existsSync(fileDir)) {
        await mkdir(fileDir, { recursive: true });
      }

      try {
        // Download file
        const { data, error: downloadError } = await supabase.storage
          .from(bucketName)
          .download(filePath);

        if (downloadError) {
          console.error(`   ❌ Error downloading ${filePath}: ${downloadError.message}`);
          errors++;
          continue;
        }

        // Convert blob to buffer and save
        const arrayBuffer = await data.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        await writeFile(localFilePath, buffer);

        downloaded++;
        if (downloaded % 10 === 0) {
          console.log(`   📥 Downloaded ${downloaded}/${files.length} files...`);
        }

      } catch (error) {
        console.error(`   ❌ Error processing ${filePath}: ${error.message}`);
        errors++;
      }
    }

    console.log(`   ✅ Exported ${downloaded} files from ${bucketName}`);
    if (errors > 0) {
      console.log(`   ⚠️  ${errors} files failed to download`);
    }

    return {
      bucketName,
      fileCount: downloaded,
      errors,
      localPath: bucketDir,
    };

  } catch (error) {
    console.error(`   ❌ Error exporting bucket ${bucketName}:`, error.message);
    return { bucketName, fileCount: 0, error: error.message };
  }
}

async function main() {
  console.log('🚀 Starting storage export from old Supabase project...\n');
  console.log(`   Project URL: ${OLD_SUPABASE_URL}\n`);

  await ensureExportDir();

  const results = [];
  const startTime = Date.now();

  for (const bucket of BUCKETS) {
    const result = await exportBucket(bucket);
    results.push(result);
    console.log(''); // Empty line between buckets
  }

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  // Summary
  console.log('='.repeat(60));
  console.log('📊 Storage Export Summary');
  console.log('='.repeat(60));

  const successful = results.filter(r => !r.error && r.fileCount > 0);
  const empty = results.filter(r => !r.error && r.fileCount === 0);
  const errors = results.filter(r => r.error);
  const totalFiles = results.reduce((sum, r) => sum + (r.fileCount || 0), 0);

  console.log(`✅ Successfully exported: ${successful.length} buckets`);
  if (empty.length > 0) {
    console.log(`ℹ️  Empty buckets: ${empty.length}`);
  }
  if (errors.length > 0) {
    console.log(`❌ Errors: ${errors.length} buckets`);
    errors.forEach(r => console.log(`   - ${r.bucketName}: ${r.error}`));
  }
  console.log(`📦 Total files exported: ${totalFiles.toLocaleString()}`);
  console.log(`⏱️  Duration: ${duration}s`);
  console.log(`📁 Export directory: ${EXPORT_DIR}`);

  // Save summary
  const summaryPath = join(EXPORT_DIR, 'storage-export-summary.json');
  await writeFile(
    summaryPath,
    JSON.stringify({
      exportDate: new Date().toISOString(),
      projectUrl: OLD_SUPABASE_URL,
      duration: `${duration}s`,
      buckets: results,
      totals: {
        successful: successful.length,
        empty: empty.length,
        errors: errors.length,
        totalFiles,
      },
    }, null, 2),
    'utf-8'
  );

  console.log(`\n💾 Summary saved to: ${summaryPath}`);
  console.log('\n✅ Storage export completed!');
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});


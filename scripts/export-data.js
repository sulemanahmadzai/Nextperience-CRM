#!/usr/bin/env node

/**
 * Export all tables from old Supabase project
 * Uses service role key to bypass RLS for complete export
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

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

// Create Supabase client with service role key (bypasses RLS)
const supabase = createClient(OLD_SUPABASE_URL, OLD_SUPABASE_SERVICE_ROLE_KEY);

// Tables to export in dependency order
const TABLES = [
  // Base tables (no dependencies on other public tables)
  'companies',
  'users',
  'event_types',
  'philippine_holidays',
  
  // Dependencies on companies/users
  'roles',
  'user_company_roles',
  'customers',
  'products',
  'pipeline_stages',
  'teams',
  'team_members',
  
  // Business data
  'leads',
  'activities',
  'quotation_templates',
  'template_line_items',
  
  // Quotations
  'quotations',
  'quotation_lines',
  'quotation_public_links',
  'quotation_customer_responses',
  
  // Financial
  'payment_gateway_configs',
  'payments',
  'proforma_invoice_templates',
  'proforma_invoice_template_line_items',
  'proforma_invoices',
  'proforma_invoice_line_items',
  
  // Event orders
  'event_order_templates',
  'event_order_template_sections',
  'event_orders',
  'event_order_sections',
  
  // Support
  'email_configs',
  'email_messages',
  'google_tokens',
  
  // Audit (last, may reference all above)
  'audit_logs',
];

const EXPORT_DIR = join(process.cwd(), 'exports');

async function ensureExportDir() {
  if (!existsSync(EXPORT_DIR)) {
    await mkdir(EXPORT_DIR, { recursive: true });
  }
}

async function exportTable(tableName) {
  console.log(`📤 Exporting ${tableName}...`);
  
  try {
    // Get all data (no limit, using service role bypasses RLS)
    let allData = [];
    let from = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error, count } = await supabase
        .from(tableName)
        .select('*', { count: 'exact' })
        .range(from, from + pageSize - 1);

      if (error) {
        // If table doesn't exist or RLS blocks, skip it
        if (error.code === 'PGRST116' || error.message.includes('permission denied')) {
          console.log(`   ⚠️  Skipping ${tableName} (table doesn't exist or access denied)`);
          return { tableName, rowCount: 0, skipped: true };
        }
        throw error;
      }

      if (data && data.length > 0) {
        allData = allData.concat(data);
      }

      from += pageSize;
      hasMore = data && data.length === pageSize;

      if (count !== null) {
        console.log(`   📊 Progress: ${Math.min(from, count)} / ${count} rows`);
      }
    }

    // Save to JSON file
    const filePath = join(EXPORT_DIR, `${tableName}.json`);
    await writeFile(filePath, JSON.stringify(allData, null, 2), 'utf-8');

    console.log(`   ✅ Exported ${allData.length} rows to ${filePath}`);
    return { tableName, rowCount: allData.length, skipped: false };

  } catch (error) {
    console.error(`   ❌ Error exporting ${tableName}:`, error.message);
    return { tableName, rowCount: 0, error: error.message, skipped: false };
  }
}

async function main() {
  console.log('🚀 Starting data export from old Supabase project...\n');
  console.log(`   Project URL: ${OLD_SUPABASE_URL}\n`);

  await ensureExportDir();

  const results = [];
  const startTime = Date.now();

  for (const table of TABLES) {
    const result = await exportTable(table);
    results.push(result);
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Export Summary');
  console.log('='.repeat(60));
  
  const successful = results.filter(r => !r.skipped && !r.error);
  const skipped = results.filter(r => r.skipped);
  const errors = results.filter(r => r.error);
  const totalRows = results.reduce((sum, r) => sum + r.rowCount, 0);

  console.log(`✅ Successfully exported: ${successful.length} tables`);
  console.log(`⚠️  Skipped: ${skipped.length} tables`);
  if (errors.length > 0) {
    console.log(`❌ Errors: ${errors.length} tables`);
    errors.forEach(r => console.log(`   - ${r.tableName}: ${r.error}`));
  }
  console.log(`📦 Total rows exported: ${totalRows.toLocaleString()}`);
  console.log(`⏱️  Duration: ${duration}s`);
  console.log(`📁 Export directory: ${EXPORT_DIR}`);

  // Save summary
  const summaryPath = join(EXPORT_DIR, 'export-summary.json');
  await writeFile(
    summaryPath,
    JSON.stringify({
      exportDate: new Date().toISOString(),
      projectUrl: OLD_SUPABASE_URL,
      duration: `${duration}s`,
      tables: results,
      totals: {
        successful: successful.length,
        skipped: skipped.length,
        errors: errors.length,
        totalRows,
      },
    }, null, 2),
    'utf-8'
  );

  console.log(`\n💾 Summary saved to: ${summaryPath}`);
  console.log('\n✅ Export completed!');
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});


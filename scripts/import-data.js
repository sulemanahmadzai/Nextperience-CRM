#!/usr/bin/env node

/**
 * Import all tables to new Supabase project
 * Reads JSON files from exports/ directory and imports in dependency order
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { readFile, readdir, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";

// Load environment variables
dotenv.config();

const NEW_SUPABASE_URL =
  process.env.NEW_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const NEW_SUPABASE_SERVICE_ROLE_KEY =
  process.env.NEW_SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!NEW_SUPABASE_URL || !NEW_SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Missing environment variables:");
  console.error("   Required: NEW_SUPABASE_URL (or VITE_SUPABASE_URL)");
  console.error(
    "   Required: NEW_SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_ROLE_KEY)"
  );
  console.error("\n💡 Tip: Create .env.new file with new project credentials");
  process.exit(1);
}

// Create Supabase client with service role key
const supabase = createClient(NEW_SUPABASE_URL, NEW_SUPABASE_SERVICE_ROLE_KEY);

// Tables to import in dependency order (must match export order)
const TABLES = [
  // Base tables
  "companies",
  "users",
  "event_types",
  "philippine_holidays",

  // Dependencies
  "roles",
  "user_company_roles",
  "customers",
  "products",
  "pipeline_stages",
  "teams",
  "team_members",

  // Business data
  "leads",
  "activities",
  "quotation_templates",
  "template_line_items",

  // Quotations
  "quotations",
  "quotation_lines",
  "quotation_public_links",
  "quotation_customer_responses",

  // Financial
  "payment_gateway_configs",
  "payments",
  "proforma_invoice_templates",
  "proforma_invoice_template_line_items",
  "proforma_invoices",
  "proforma_invoice_line_items",

  // Event orders
  "event_order_templates",
  "event_order_template_sections",
  "event_orders",
  "event_order_sections",

  // Support
  "email_configs",
  "email_messages",
  "google_tokens",

  // Audit (last)
  "audit_logs",
];

const EXPORT_DIR = join(process.cwd(), "exports");

async function importTable(tableName, data) {
  if (!data || data.length === 0) {
    console.log(`   ℹ️  No data to import for ${tableName}`);
    return { tableName, imported: 0, skipped: true };
  }

  console.log(`📥 Importing ${tableName} (${data.length} rows)...`);

  try {
    // Use upsert to handle existing records (preserves UUIDs)
    // Process in batches to avoid timeouts
    const batchSize = 100;
    let imported = 0;
    let errors = 0;

    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      const { error } = await supabase.from(tableName).upsert(batch, {
        onConflict: "id",
        ignoreDuplicates: false,
      });

      if (error) {
        // Check if table doesn't exist
        if (
          error.message.includes("Could not find the table") ||
          error.message.includes("schema cache") ||
          (error.message.includes("relation") &&
            error.message.includes("does not exist"))
        ) {
          console.error(
            `   ❌ Table '${tableName}' does not exist in the new database!`
          );
          console.error(
            `   ⚠️  You must run migrations first. See MIGRATION_GUIDE.md`
          );
          return {
            tableName,
            imported: 0,
            error: "Table does not exist - run migrations first",
            skipped: false,
          };
        }

        // Handle foreign key violations for users table
        if (error.message.includes("users_id_fkey")) {
          console.error(
            `   ⚠️  Foreign key violation: Users must exist in auth.users first`
          );
          console.error(
            `   💡 Run: npm run migrate:create-users (to create users in auth.users)`
          );
          console.error(`   Then run this import again`);
          return {
            tableName,
            imported: 0,
            error:
              "Users must be created in auth.users first. Run: npm run migrate:create-users",
            skipped: false,
          };
        }

        // Try insert if upsert fails (some tables might not have upsert support)
        const { error: insertError } = await supabase
          .from(tableName)
          .insert(batch);

        if (insertError) {
          if (
            insertError.message.includes("Could not find the table") ||
            insertError.message.includes("schema cache")
          ) {
            console.error(
              `   ❌ Table '${tableName}' does not exist in the new database!`
            );
            console.error(
              `   ⚠️  You must run migrations first. See MIGRATION_GUIDE.md`
            );
            return {
              tableName,
              imported: 0,
              error: "Table does not exist - run migrations first",
              skipped: false,
            };
          }

          // Handle foreign key violations for users table
          if (
            insertError.message.includes("users_id_fkey") &&
            tableName === "users"
          ) {
            console.error(
              `   ⚠️  Foreign key violation: Users must exist in auth.users first`
            );
            console.error(
              `   💡 Run: npm run migrate:create-users (to create users in auth.users)`
            );
            console.error(`   Then run this import again`);
            return {
              tableName,
              imported: 0,
              error:
                "Users must be created in auth.users first. Run: npm run migrate:create-users",
              skipped: false,
            };
          }

          // Handle foreign key violations - might need to retry later
          if (insertError.message.includes("violates foreign key constraint")) {
            // For cascading foreign keys, log warning but continue with other batches
            // We'll need to re-run import after all dependencies are in place
            console.warn(
              `   ⚠️  Foreign key violation for ${tableName} (batch ${
                i / batchSize + 1
              })`
            );
            console.warn(
              `   This might be because dependent records don't exist yet`
            );
            console.warn(
              `   You may need to run import again after dependencies are imported`
            );
            errors += batch.length;
            continue;
          }

          // Handle duplicate key errors (might be seed data)
          if (
            insertError.message.includes("duplicate key") ||
            insertError.message.includes("unique constraint")
          ) {
            console.warn(
              `   ⚠️  Duplicate key error - data may already exist or conflict with seed data`
            );
            console.warn(
              `   This is OK if seed data was already run. Skipping...`
            );
            return {
              tableName,
              imported: 0,
              error: "Duplicate key - data may already exist",
              skipped: true,
            };
          }

          console.error(
            `   ❌ Error importing batch ${i / batchSize + 1}: ${
              insertError.message
            }`
          );
          errors += batch.length;
          continue;
        }
      }

      imported += batch.length;
      if ((i + batchSize) % 500 === 0 || i + batchSize >= data.length) {
        console.log(
          `   📊 Progress: ${Math.min(imported, data.length)} / ${
            data.length
          } rows`
        );
      }
    }

    if (errors > 0) {
      console.log(`   ⚠️  ${errors} rows failed to import`);
    } else {
      console.log(`   ✅ Imported ${imported} rows`);
    }

    return { tableName, imported, errors, skipped: false };
  } catch (error) {
    console.error(`   ❌ Error importing ${tableName}:`, error.message);
    return { tableName, imported: 0, error: error.message, skipped: false };
  }
}

async function loadTableData(tableName) {
  const filePath = join(EXPORT_DIR, `${tableName}.json`);

  if (!existsSync(filePath)) {
    return null; // File doesn't exist, skip
  }

  try {
    const content = await readFile(filePath, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    console.error(`   ⚠️  Error reading ${filePath}:`, error.message);
    return null;
  }
}

async function main() {
  console.log("🚀 Starting data import to new Supabase project...\n");
  console.log(`   Project URL: ${NEW_SUPABASE_URL}\n`);
  console.log(
    "⚠️  IMPORTANT: Make sure you have run all migrations on the new database first!"
  );
  console.log("   If tables don't exist, the import will fail.\n");

  if (!existsSync(EXPORT_DIR)) {
    console.error(`❌ Export directory not found: ${EXPORT_DIR}`);
    console.error("   Please run export-data.js first");
    process.exit(1);
  }

  // Quick check: try to query a common table to see if schema exists
  try {
    const { error } = await supabase.from("companies").select("id").limit(1);
    if (
      error &&
      (error.message.includes("Could not find the table") ||
        error.message.includes("schema cache") ||
        (error.message.includes("relation") &&
          error.message.includes("does not exist")))
    ) {
      console.error("❌ CRITICAL: Database schema does not exist!");
      console.error("\n📝 You must run migrations first:");
      console.error("   1. Go to Supabase Dashboard → SQL Editor");
      console.error(
        "   2. Run all migration files from supabase/migrations/ in chronological order"
      );
      console.error("   3. OR use Supabase CLI: supabase db push");
      console.error("\n   See MIGRATION_GUIDE.md for detailed instructions.\n");
      process.exit(1);
    }
  } catch (err) {
    // If we can't even check, proceed with warning
    console.warn(
      "⚠️  Could not verify schema existence. Proceeding with import...\n"
    );
  }

  const results = [];
  const startTime = Date.now();

  for (const table of TABLES) {
    const data = await loadTableData(table);
    if (data === null) {
      console.log(`⏭️  Skipping ${table} (no export file found)`);
      results.push({ tableName: table, imported: 0, skipped: true });
      continue;
    }

    const result = await importTable(table, data);
    results.push(result);

    // Small delay to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 Import Summary");
  console.log("=".repeat(60));

  const successful = results.filter((r) => !r.skipped && !r.error);
  const skipped = results.filter((r) => r.skipped);
  const errors = results.filter((r) => r.error);
  const totalImported = results.reduce((sum, r) => sum + (r.imported || 0), 0);

  console.log(`✅ Successfully imported: ${successful.length} tables`);
  console.log(`⏭️  Skipped: ${skipped.length} tables`);
  if (errors.length > 0) {
    console.log(`❌ Errors: ${errors.length} tables`);
    errors.forEach((r) => console.log(`   - ${r.tableName}: ${r.error}`));
  }
  console.log(`📦 Total rows imported: ${totalImported.toLocaleString()}`);
  console.log(`⏱️  Duration: ${duration}s`);

  // Save summary
  const summaryPath = join(EXPORT_DIR, "import-summary.json");
  await writeFile(
    summaryPath,
    JSON.stringify(
      {
        importDate: new Date().toISOString(),
        projectUrl: NEW_SUPABASE_URL,
        duration: `${duration}s`,
        tables: results,
        totals: {
          successful: successful.length,
          skipped: skipped.length,
          errors: errors.length,
          totalImported,
        },
      },
      null,
      2
    ),
    "utf-8"
  );

  console.log(`\n💾 Summary saved to: ${summaryPath}`);
  console.log("\n✅ Import completed!");
  console.log("\n⚠️  Next steps:");
  console.log("   1. Run migrate-auth-users.js to create users in auth.users");
  console.log("   2. Run import-storage.js to migrate storage files");
  console.log("   3. Verify data integrity");
}

main().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});

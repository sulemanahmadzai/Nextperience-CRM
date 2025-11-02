#!/usr/bin/env node

/**
 * List all migration files in chronological order
 * Helps you run migrations in the correct sequence
 */

import { readdir } from 'fs/promises';
import { join } from 'path';

const MIGRATIONS_DIR = join(process.cwd(), 'supabase', 'migrations');

async function main() {
  try {
    const files = await readdir(MIGRATIONS_DIR);
    
    // Filter SQL files and sort by name (chronological)
    const migrations = files
      .filter(f => f.endsWith('.sql'))
      .sort();

    console.log('📋 Migration files in chronological order:\n');
    
    migrations.forEach((file, index) => {
      console.log(`${(index + 1).toString().padStart(3, ' ')}. ${file}`);
    });

    console.log(`\n✅ Total: ${migrations.length} migration files`);
    console.log('\n💡 Instructions:');
    console.log('   1. Copy all migration files to Supabase SQL Editor');
    console.log('   2. Run them in this exact order (from top to bottom)');
    console.log('   3. Or use this one-liner to get all SQL:');
    console.log(`      cat ${MIGRATIONS_DIR}/*.sql | pbcopy`);
    console.log('\n📝 Quick SQL to run all migrations:');
    console.log('   (Go to Supabase Dashboard → SQL Editor and paste)');

  } catch (error) {
    console.error('❌ Error reading migrations directory:', error.message);
    process.exit(1);
  }
}

main();


# Migration Scripts

These scripts help migrate your Supabase project from an old instance to a new one.

## Quick Start

### Export from Old Project

```bash
# Export everything
npm run migrate:export-all

# Or export individually
npm run migrate:export-data      # Export all tables
npm run migrate:export-storage    # Export storage files
npm run migrate:export-auth       # Export auth users
```

### Import to New Project

**First, set up `.env.new` with new project credentials:**

```env
NEW_SUPABASE_URL=https://your-new-project.supabase.co
NEW_SUPABASE_SERVICE_ROLE_KEY=your-new-service-role-key
VITE_SUPABASE_URL=https://your-new-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-new-anon-key
```

**Then import:**

```bash
# Import everything
npm run migrate:import-all

# Or import individually
npm run migrate:import-data      # Import all tables
npm run migrate:auth-users       # Create users in auth.users
npm run migrate:import-storage   # Import storage files
```

## Script Details

### Export Scripts

- **export-data.js**: Exports all database tables as JSON files
  - Uses service role key to bypass RLS
  - Saves to `exports/` directory
  - Creates `export-summary.json` with statistics

- **export-storage.js**: Exports files from storage buckets
  - Downloads all files from `payment-proofs` bucket
  - Maintains directory structure
  - Saves to `exports/storage/`

- **export-auth-users.js**: Exports auth.users data
  - Requires service role key
  - Cannot export passwords (encrypted)
  - Saves user metadata and emails

### Import Scripts

- **import-data.js**: Imports all tables from JSON files
  - Reads from `exports/` directory
  - Imports in dependency order
  - Uses upsert to handle existing records
  - Preserves UUIDs

- **migrate-auth-users.js**: Creates users in new auth.users
  - Preserves user IDs to maintain relationships
  - Sets temporary passwords (users must reset)
  - Updates user metadata

- **import-storage.js**: Uploads files to new storage buckets
  - Creates buckets if they don't exist
  - Maintains file structure
  - Uploads from `exports/storage/`

## Environment Variables

### For Export (uses old project)
- `VITE_SUPABASE_URL` - Old project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Old service role key (or `VITE_SUPABASE_ANON_KEY` as fallback)

### For Import (uses new project)
- `NEW_SUPABASE_URL` - New project URL (or `VITE_SUPABASE_URL`)
- `NEW_SUPABASE_SERVICE_ROLE_KEY` - New service role key (or `SUPABASE_SERVICE_ROLE_KEY`)

**Tip**: Create `.env.new` file with new project credentials, then source it:
```bash
export $(cat .env.new | xargs)
npm run migrate:import-all
```

## Output Files

All exports are saved to `exports/` directory:
- `*.json` - Table data (one file per table)
- `storage/` - Storage files
- `*-summary.json` - Export/import summaries

## Troubleshooting

### "Missing environment variables"
Make sure your `.env` file has the required variables. For imports, you can also use `NEW_SUPABASE_URL` and `NEW_SUPABASE_SERVICE_ROLE_KEY`.

### "Permission denied" during export
You need the service role key (not anon key) to export all data. Check your environment variables.

### "Table doesn't exist"
Some tables might not exist in your database. The script will skip them gracefully.

### "Foreign key violation" during import
Make sure tables are imported in the correct dependency order. The script handles this automatically, but if you're importing manually, check the table list in the script.

### Users can't login after migration
Passwords cannot be migrated (they're encrypted). Users must reset passwords or use OAuth.


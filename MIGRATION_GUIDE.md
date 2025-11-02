# Supabase Project Migration Guide

This guide walks you through migrating from your old Supabase project to a new one while preserving all data.

## Prerequisites

1. **Old Project Credentials** (already have in `.env`):
   - `VITE_SUPABASE_URL` - Old project URL
   - `VITE_SUPABASE_ANON_KEY` or `SUPABASE_SERVICE_ROLE_KEY` - Old project key

2. **New Project Credentials**:
   - Create a new Supabase project
   - Get new project URL and keys

3. **Dependencies**:
   ```bash
   npm install
   ```

## Migration Steps

### Step 1: Export Data from Old Project

Export all data from your old Supabase project:

```bash
# Export all tables
npm run migrate:export-data

# Export storage files
npm run migrate:export-storage

# Export auth users
npm run migrate:export-auth

# Or export everything at once
npm run migrate:export-all
```

This will create JSON files in the `exports/` directory.

**Verify the export**:
- Check `exports/export-summary.json` for export statistics
- Verify all critical tables were exported successfully

### Step 2: Set Up New Project

1. **Create new Supabase project** (if not already created)
2. **Get new credentials**:
   - Project URL
   - Anon Key
   - Service Role Key

3. **Create `.env.new` file** with new project credentials:
   ```env
   # New Project Credentials
   NEW_SUPABASE_URL=https://your-new-project.supabase.co
   NEW_SUPABASE_SERVICE_ROLE_KEY=your-new-service-role-key
   VITE_SUPABASE_URL=https://your-new-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-new-anon-key
   ```

### Step 3: Run Schema Migrations on New Project

**⚠️ CRITICAL: You must complete this step before importing data!**

Run all migration files on the new database:

**Option A: Using Supabase Dashboard (Recommended)**:
1. List migration files in order:
   ```bash
   npm run migrate:list
   ```
2. Go to your new Supabase project → SQL Editor
3. Copy and paste each migration file's content in chronological order
   - Start with the earliest timestamp (e.g., `20251018005252_*`)
   - End with the latest timestamp
4. Run each SQL file one by one
5. Verify success (check for errors in output)

**Option B: Using Supabase CLI** (if configured):
```bash
supabase db push --project-ref <your-new-project-ref>
```

**Option C: Quick SQL Script** (Advanced):
If you have access to `psql` or Supabase CLI:
```bash
# Export all migrations as one file
cat supabase/migrations/*.sql > all-migrations.sql

# Then run in Supabase SQL Editor or via CLI
```

**Verify migrations succeeded**:
- Go to Table Editor in Supabase Dashboard
- You should see tables: `companies`, `users`, `quotations`, `payments`, etc.
- Check that functions and policies were created

### Step 4: Import Data to New Project

**Switch to new project environment**:
```bash
# Load new credentials
cp .env.new .env.temp
# Or manually update .env with new values for testing
```

**Import data**:
```bash
# Import all tables
npm run migrate:import-data

# Migrate auth users (creates users with same IDs)
npm run migrate:auth-users

# Import storage files
npm run migrate:import-storage
```

**Important Notes**:
- Data import preserves UUIDs to maintain relationships
- Auth users will need to reset passwords (cannot be migrated)
- Verify import success by checking `exports/import-summary.json`

### Step 5: Update Edge Functions

1. **Get Edge Function secrets** from old project (if accessible):
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`

2. **Set secrets in new project**:
   - Go to Supabase Dashboard → Project Settings → Edge Functions → Secrets
   - Set:
     - `SUPABASE_URL` = new project URL
     - `SUPABASE_SERVICE_ROLE_KEY` = new service role key
     - `SUPABASE_ANON_KEY` = new anon key
     - `GOOGLE_CLIENT_ID` = copy from old
     - `GOOGLE_CLIENT_SECRET` = copy from old

3. **Deploy Edge Functions**:
   ```bash
   supabase functions deploy create-user --project-ref <new-ref>
   supabase functions deploy google-oauth-start --project-ref <new-ref>
   supabase functions deploy google-oauth-callback --project-ref <new-ref>
   supabase functions deploy google-oauth-debug --project-ref <new-ref>
   supabase functions deploy xendit-create-invoice --project-ref <new-ref>
   supabase functions deploy xendit-webhook --project-ref <new-ref>
   ```

4. **Update Xendit webhook URL** to point to new function endpoint

### Step 6: Update Environment Variables

After verifying everything works:

1. **Backup old `.env`**:
   ```bash
   cp .env .env.old
   ```

2. **Switch to new credentials**:
   ```bash
   cp .env.new .env
   ```

3. **Or manually update `.env`**:
   ```env
   VITE_SUPABASE_URL=https://your-new-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-new-anon-key
   ```

### Step 7: Configure Authentication

1. **Verify users were migrated**:
   - Check `auth.users` table in new project
   - Verify user counts match

2. **Send password reset emails** to all users:
   - Users cannot login with old passwords
   - They must reset or use OAuth

3. **Configure OAuth**:
   - Update Google OAuth redirect URIs in Google Cloud Console
   - Update redirect URIs in new Supabase Auth settings

4. **Run admin setup** (if needed):
   - Create admin user or run `setup-admin.sql`
   - Assign admin role using new user ID

### Step 8: Regenerate TypeScript Types

Generate types from new schema:

```bash
npx supabase gen types typescript --project-id <new-project-id> > src/lib/database.types.ts
```

### Step 9: Testing

Comprehensive testing checklist:

- [ ] Authentication (login, OAuth)
- [ ] User roles and permissions
- [ ] CRUD operations (customers, leads, quotations)
- [ ] File uploads/downloads (payment proofs)
- [ ] Payment flows
- [ ] Email sending
- [ ] Edge Functions
- [ ] Data integrity (verify counts match)

### Step 10: Go Live

1. **Notify users** of the migration
2. **Monitor** for any issues
3. **Keep old project** active for a few days as backup
4. **Update** any external services pointing to old project

## Troubleshooting

### Export Issues

- **"Missing environment variables"**: Check `.env` has old project credentials
- **"Permission denied"**: Use service role key, not anon key
- **"Table doesn't exist"**: Some tables may not exist, that's OK

### Import Issues

- **"Foreign key violation"**: Make sure tables are imported in dependency order
- **"Duplicate key"**: Data already exists, use upsert (script handles this)
- **"Storage bucket not found"**: Bucket will be created automatically

### Auth User Issues

- **"User already exists"**: Script will update existing users
- **"Cannot create user"**: Check service role key is correct
- **Users can't login**: Passwords cannot be migrated, users must reset

## Rollback Plan

If something goes wrong:

1. Keep old project active
2. Restore `.env` from `.env.old`
3. Check `exports/` directory for all exported data
4. Verify old project still works

## File Structure

```
project-root/
├── scripts/
│   ├── export-data.js          # Export all tables
│   ├── export-storage.js        # Export storage files
│   ├── export-auth-users.js     # Export auth users
│   ├── import-data.js           # Import all tables
│   ├── import-storage.js        # Import storage files
│   └── migrate-auth-users.js    # Create users in new auth.users
├── exports/
│   ├── *.json                   # Exported table data
│   ├── storage/                 # Exported storage files
│   └── *-summary.json          # Export/import summaries
├── .env                         # Current credentials
├── .env.old                     # Backup of old credentials
└── .env.new                     # New project credentials
```

## Support

If you encounter issues:

1. Check export/import summaries in `exports/` directory
2. Review error messages in console output
3. Verify environment variables are correct
4. Check Supabase dashboard for any restrictions or errors


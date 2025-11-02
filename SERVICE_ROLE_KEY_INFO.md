# What is SUPABASE_SERVICE_ROLE_KEY?

## Quick Answer

The `SUPABASE_SERVICE_ROLE_KEY` is an **admin key** for your Supabase project. It has full database access and bypasses Row Level Security (RLS).

## Do You Need It in `.env`?

**For Edge Functions: NO** - It's automatically set as a secret when you deploy via Supabase CLI.

**For your scripts: YES (optional)** - Only if you're running data migration scripts locally.

## What It's Used For

### In Edge Functions:

1. **`google-oauth-callback`** - Stores Google OAuth tokens in the `google_tokens` table (needs admin access)
2. **`create-user`** - Creates users via `auth.admin.createUser()` API (requires service role key)
3. **`xendit-webhook`** - Processes payment webhooks and updates database (needs admin access)

### In Migration Scripts:

- `scripts/export-data.js` - Exports all data (bypasses RLS)
- `scripts/import-data.js` - Imports all data (bypasses RLS)
- `scripts/create-users-from-export.js` - Creates users via admin API

## Where to Find It

1. Go to **Supabase Dashboard** → Your Project
2. Click **Project Settings** (gear icon)
3. Go to **API** tab
4. Find **"service_role"** key (it's the secret one, not the "anon" key)
5. **⚠️ Keep it secret!** Never expose it in frontend code

## Key Differences

| Key Type                                           | Used In                        | Permissions                     | RLS             |
| -------------------------------------------------- | ------------------------------ | ------------------------------- | --------------- |
| **Anon Key** (`VITE_SUPABASE_ANON_KEY`)            | Frontend React app             | Limited (based on RLS policies) | ✅ Respects RLS |
| **Service Role Key** (`SUPABASE_SERVICE_ROLE_KEY`) | Edge Functions, Server scripts | Full admin access               | ❌ Bypasses RLS |

## Do You Need to Set It Manually?

### For Edge Functions Deployment:

**NO** - When you run `supabase link --project-ref YOUR_REF`, Supabase CLI automatically:

- Sets `SUPABASE_URL` secret
- Sets `SUPABASE_ANON_KEY` secret
- Sets `SUPABASE_SERVICE_ROLE_KEY` secret

You only need to manually set:

- `GOOGLE_CLIENT_ID` ⚠️
- `GOOGLE_CLIENT_SECRET` ⚠️

### For Running Scripts Locally:

**YES (optional)** - Add to `.env`:

```env
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

This allows scripts like `npm run migrate:export-data` to work locally.

## Security Warning

⚠️ **NEVER** commit `SUPABASE_SERVICE_ROLE_KEY` to git!

- Keep it in `.env` file (which should be in `.gitignore`)
- Only use it in server-side code (Edge Functions, scripts)
- Never expose it in your React frontend

## Summary

For **deploying Edge Functions**, you typically **don't need** to manually set `SUPABASE_SERVICE_ROLE_KEY` - it's auto-configured. Just focus on setting `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`!

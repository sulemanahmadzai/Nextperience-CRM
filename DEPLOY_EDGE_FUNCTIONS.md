# Deploy Supabase Edge Functions Guide

## Problem
When clicking "Connect with Google", you get:
```json
{"code":"NOT_FOUND","message":"Requested function was not found"}
```

This means the Edge Functions haven't been deployed to your Supabase project.

## Solution: Deploy Edge Functions

### Step 1: Install Supabase CLI

**Option A: Using Homebrew (macOS)**
```bash
brew install supabase/tap/supabase
```

**Option B: Using npm**
```bash
npm install -g supabase
```

**Option C: Direct download**
- Visit: https://github.com/supabase/cli/releases
- Download the binary for your OS
- Add to PATH

### Step 2: Login to Supabase

```bash
supabase login
```

This will open your browser to authenticate with Supabase.

### Step 3: Link Your Project

```bash
supabase link --project-ref YOUR_PROJECT_REF
```

**To find your Project Ref:**
- Go to your Supabase Dashboard
- The Project Ref is in your URL: `https://app.supabase.com/project/YOUR_PROJECT_REF`
- Or it's the subdomain: `YOUR_PROJECT_REF.supabase.co`

**Example:**
```bash
supabase link --project-ref oylgvcpwjsfecvspqfrl
```

### Step 4: Set Environment Variables (Secrets)

Set the required secrets for your Edge Functions:

```bash
# Set Google OAuth credentials
supabase secrets set GOOGLE_CLIENT_ID=your_google_client_id_here
supabase secrets set GOOGLE_CLIENT_SECRET=your_google_client_secret_here

# These are automatically set, but verify:
supabase secrets set SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
supabase secrets set SUPABASE_ANON_KEY=your_anon_key
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

**OR set them via Supabase Dashboard:**
1. Go to **Project Settings** → **Edge Functions** → **Secrets**
2. Add each secret:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `SUPABASE_URL` (usually auto-set)
   - `SUPABASE_ANON_KEY` (usually auto-set)
   - `SUPABASE_SERVICE_ROLE_KEY` (usually auto-set)

### Step 5: Deploy All Edge Functions

Deploy all Google OAuth functions:

```bash
# Deploy Google OAuth Start function
supabase functions deploy google-oauth-start

# Deploy Google OAuth Callback function
supabase functions deploy google-oauth-callback

# Deploy Google OAuth Debug function (optional, for debugging)
supabase functions deploy google-oauth-debug
```

**Deploy all functions at once:**
```bash
supabase functions deploy google-oauth-start
supabase functions deploy google-oauth-callback
supabase functions deploy google-oauth-debug
supabase functions deploy create-user
supabase functions deploy xendit-create-invoice
supabase functions deploy xendit-webhook
```

### Step 6: Verify Deployment

After deployment, verify functions are accessible:

1. **Check in Supabase Dashboard:**
   - Go to **Edge Functions** in your Supabase Dashboard
   - You should see all deployed functions listed

2. **Test the function:**
   ```bash
   curl https://YOUR_PROJECT_REF.supabase.co/functions/v1/google-oauth-start \
     -H "Authorization: Bearer YOUR_ANON_KEY"
   ```
   (This should not return NOT_FOUND)

### Step 7: Update Google OAuth Redirect URI

**Important:** Make sure your Google OAuth app has the correct redirect URI:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** → **Credentials**
3. Click on your OAuth 2.0 Client ID
4. Under **Authorized redirect URIs**, add:
   ```
   https://YOUR_PROJECT_REF.supabase.co/functions/v1/google-oauth-callback
   ```
5. Click **Save**

### Troubleshooting

#### Error: "Function not found"
- ✅ Make sure you've deployed the function: `supabase functions deploy google-oauth-start`
- ✅ Verify the function name matches exactly

#### Error: "GOOGLE_CLIENT_ID not configured"
- ✅ Set the secret: `supabase secrets set GOOGLE_CLIENT_ID=your_id`
- ✅ Or set it in Supabase Dashboard → Edge Functions → Secrets

#### Error: "Unauthorized" or 401
- ✅ Make sure you're passing the Authorization header
- ✅ Use a valid access token from Supabase Auth

#### Error: "redirect_uri_mismatch"
- ✅ Add the exact redirect URI to Google Cloud Console:
  `https://YOUR_PROJECT_REF.supabase.co/functions/v1/google-oauth-callback`

### Quick Deployment Script

Save this as `deploy-functions.sh`:

```bash
#!/bin/bash

# Set your project ref
PROJECT_REF="oylgvcpwjsfecvspqfrl"  # Replace with your actual project ref

# Link project
supabase link --project-ref $PROJECT_REF

# Deploy functions
echo "Deploying Google OAuth functions..."
supabase functions deploy google-oauth-start
supabase functions deploy google-oauth-callback
supabase functions deploy google-oauth-debug

echo "Deploying other functions..."
supabase functions deploy create-user
supabase functions deploy xendit-create-invoice
supabase functions deploy xendit-webhook

echo "✅ All functions deployed!"
echo "⚠️  Don't forget to set secrets if not already set!"
```

Make it executable:
```bash
chmod +x deploy-functions.sh
./deploy-functions.sh
```

## Alternative: Deploy via Supabase Dashboard

If you prefer using the dashboard:

1. Go to **Edge Functions** in Supabase Dashboard
2. Click **Create a new function**
3. For each function:
   - Name: `google-oauth-start` (must match folder name)
   - Copy content from `supabase/functions/google-oauth-start/index.ts`
   - Set secrets in the function settings
   - Deploy

**Note:** This is more tedious but works if CLI isn't available.


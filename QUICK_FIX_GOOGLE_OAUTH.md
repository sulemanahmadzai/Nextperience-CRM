# Quick Fix: Enable Google OAuth in Supabase

## Error You're Seeing

```
{"code":400,"error_code":"validation_failed","msg":"Unsupported provider: provider is not enabled"}
```

This means Google OAuth provider is not enabled in your Supabase project.

## Solution: Enable Google Provider in Supabase Dashboard

### Step 1: Go to Supabase Dashboard

1. Open [https://app.supabase.com/](https://app.supabase.com/)
2. Select your project

### Step 2: Navigate to Authentication Settings

1. Click **Authentication** in the left sidebar
2. Click **Providers** in the submenu
3. Find **Google** in the list of providers

### Step 3: Enable Google Provider

1. Toggle the switch next to **Google** to enable it
2. You'll see fields appear for:
   - **Client ID (for OAuth)**
   - **Client Secret (for OAuth)**

### Step 4: Get Google OAuth Credentials

If you don't have Google OAuth credentials yet, you need to create them:

#### Option A: Quick Setup (5 minutes)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select or create a project
3. Go to **APIs & Services** → **Credentials**
4. Click **+ CREATE CREDENTIALS** → **OAuth client ID**
5. If prompted to configure OAuth consent screen:
   - Choose **External**
   - Fill in app name: "The Nextperience Group CRM"
   - Enter your email for support
   - Save and continue through the steps
6. Create **Web application** OAuth client
7. Add **Authorized redirect URI**:
   ```
   https://YOUR_PROJECT_ID.supabase.co/auth/v1/callback
   ```
   Replace `YOUR_PROJECT_ID` with your Supabase project ID (found in your Supabase dashboard URL)
8. Copy the **Client ID** and **Client Secret**

#### Option B: If you already have credentials

- Use your existing Google OAuth Client ID and Client Secret

### Step 5: Enter Credentials in Supabase

1. Paste your **Client ID** in the Supabase form
2. Paste your **Client Secret** in the Supabase form
3. Click **Save**

### Step 6: Configure Site URLs (Important!)

1. Still in **Authentication**, go to **URL Configuration**
2. Under **Site URL**, enter your app URL:
   - For local development: `http://localhost:5173` (or your port)
   - For production: Your production URL
3. Under **Redirect URLs**, add:
   - `http://localhost:5173/**` (for local)
   - `https://yourdomain.com/**` (for production)
4. Click **Save**

### Step 7: Add Redirect URI in Google Console

Go back to Google Cloud Console and make sure you've added:

- `https://YOUR_SUPABASE_PROJECT_ID.supabase.co/auth/v1/callback`
- Your local URL: `http://localhost:5173` (for testing)
- Your production URL if applicable

## Test It Now

1. Go back to your app
2. Click "Sign in with Google" or "Sign up with Google"
3. It should now redirect to Google's OAuth screen

## Still Not Working?

### Check These:

1. ✅ Google provider is toggled ON in Supabase
2. ✅ Client ID and Secret are entered (no extra spaces)
3. ✅ Redirect URI in Google Console matches: `https://YOUR_PROJECT_ID.supabase.co/auth/v1/callback`
4. ✅ Site URL in Supabase matches your app URL
5. ✅ Your app is using the correct Supabase URL (check `.env` file)

### Common Issues:

**Error: "redirect_uri_mismatch"**

- Make sure you added the Supabase callback URL in Google Console
- Format must be: `https://YOUR_PROJECT_ID.supabase.co/auth/v1/callback`

**Error: "invalid_client"**

- Double-check Client ID and Secret in Supabase
- Make sure there are no extra spaces when copying

**Provider still not enabled**

- Try refreshing the Supabase dashboard
- Make sure you clicked "Save" after entering credentials
- Check that the toggle is actually ON (green/enabled)

## Find Your Supabase Project ID

Your Supabase project ID is in:

- Your Supabase dashboard URL: `https://app.supabase.com/project/YOUR_PROJECT_ID`
- Or in your `.env` file: `VITE_SUPABASE_URL` contains it

Example: If your URL is `https://abcdefghijklmnop.supabase.co`, then `abcdefghijklmnop` is your project ID.

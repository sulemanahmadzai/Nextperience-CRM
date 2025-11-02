# Google OAuth Setup Guide

This guide will walk you through setting up Google Sign-In for your Supabase project.

## Prerequisites
- A Supabase project (already set up)
- A Google Cloud Console account

## Step-by-Step Instructions

### Step 1: Create a Google OAuth Application

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project or create a new one
3. Navigate to **APIs & Services** > **Credentials**
4. Click **+ CREATE CREDENTIALS** > **OAuth client ID**
5. If prompted, configure the OAuth consent screen first:
   - Choose **External** (unless you have a Google Workspace account)
   - Fill in the required information:
     - App name: "The Nextperience Group CRM" (or your app name)
     - User support email: Your email
     - Developer contact: Your email
   - Click **Save and Continue**
   - On Scopes page, click **Save and Continue** (default scopes are fine)
   - Add test users if needed, then click **Save and Continue**
   - Click **Back to Dashboard**

### Step 2: Create OAuth Credentials

1. Back in **Credentials** page, click **+ CREATE CREDENTIALS** > **OAuth client ID**
2. Select **Web application** as the application type
3. Give it a name (e.g., "Nextperience CRM Web Client")
4. Add **Authorized redirect URIs**:
   - For local development: `http://localhost:5173` (or your local port)
   - For production: Your production URL (e.g., `https://yourdomain.com`)
   - **Important**: Also add your Supabase project URL with the callback path:
     - `https://YOUR_SUPABASE_PROJECT_ID.supabase.co/auth/v1/callback`
     - Replace `YOUR_SUPABASE_PROJECT_ID` with your actual Supabase project ID
5. Click **Create**
6. **Copy the Client ID and Client Secret** - you'll need these in the next step

### Step 3: Configure Supabase OAuth

1. Go to your [Supabase Dashboard](https://app.supabase.com/)
2. Select your project
3. Navigate to **Authentication** > **Providers**
4. Find **Google** in the list and click on it
5. Toggle **Enable Google provider** to ON
6. Enter your **Google Client ID** (from Step 2)
7. Enter your **Google Client Secret** (from Step 2)
8. (Optional) You can customize the scopes if needed - default is fine for basic auth
9. Click **Save**

### Step 4: Configure Redirect URLs in Supabase

1. Still in **Authentication** settings, go to **URL Configuration**
2. Add your site URL:
   - For local development: `http://localhost:5173`
   - For production: Your production URL (e.g., `https://yourdomain.com`)
3. Add redirect URLs (usually same as site URL):
   - `http://localhost:5173/**` (for local development)
   - `https://yourdomain.com/**` (for production)
4. Click **Save**

### Step 5: Test Google Sign-In

1. Start your development server: `npm run dev`
2. Navigate to the login page
3. Click the **"Sign in with Google"** or **"Sign up with Google"** button
4. You should be redirected to Google's OAuth consent screen
5. After authorizing, you'll be redirected back to your app

## Troubleshooting

### Common Issues

1. **"redirect_uri_mismatch" error**
   - Make sure you've added the Supabase callback URL in Google Console
   - Format: `https://YOUR_PROJECT_ID.supabase.co/auth/v1/callback`
   - Also ensure your site URL matches what's configured in Supabase

2. **"invalid_client" error**
   - Double-check your Client ID and Client Secret in Supabase settings
   - Make sure there are no extra spaces when copying

3. **User created but can't access company**
   - After Google sign-up, users still need to be assigned to a company
   - This is handled by your existing user management system
   - Users may see "No company access" message until admin assigns them

4. **OAuth not working in production**
   - Ensure production URL is added to both:
     - Google Console (Authorized redirect URIs)
     - Supabase (Site URL and Redirect URLs)

## Notes

- Google OAuth works for both sign-in and sign-up
- New users signing up with Google will need admin approval for company access (same as email sign-up)
- The Terms of Service and Privacy Policy checkboxes only appear for email/password sign-up, not Google OAuth (as Google handles the consent flow)

## Production Checklist

- [ ] Google OAuth client configured in Google Console
- [ ] Supabase Google provider enabled with credentials
- [ ] Production URL added to Google Console redirect URIs
- [ ] Production URL configured in Supabase settings
- [ ] OAuth consent screen published (if going public)
- [ ] Terms of Service and Privacy Policy pages created (see next section)


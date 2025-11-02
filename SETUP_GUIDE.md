# Complete Setup Guide: Terms of Service, Privacy Policy & Google Sign-In

This guide will help you complete the setup for:
1. ✅ Terms of Service and Privacy Policy checkboxes (already implemented)
2. ✅ Google Sign-In/Sign-Up (already implemented)
3. ⚠️ Supabase OAuth configuration (needs to be done)
4. ⚠️ Terms/Privacy pages (optional, but recommended)

## What's Already Done

### ✅ Terms of Service & Privacy Policy Checkboxes
- Added to sign-up form
- Required validation before account creation
- Links to `/terms-of-service` and `/privacy-policy` (you'll need to create these pages)

### ✅ Google Sign-In Implementation
- Added Google Sign-In button for both sign-in and sign-up views
- Styled with Google branding
- Integrated with Supabase OAuth

## Step-by-Step Setup Instructions

### Part 1: Configure Google OAuth in Supabase

Follow the detailed instructions in `GOOGLE_OAUTH_SETUP.md` for:
- Creating Google OAuth credentials
- Configuring Supabase authentication provider
- Setting up redirect URLs

**Quick Summary:**
1. Create OAuth app in Google Cloud Console
2. Get Client ID and Client Secret
3. Enable Google provider in Supabase Dashboard
4. Add credentials to Supabase
5. Configure redirect URLs

### Part 2: Create Terms of Service & Privacy Policy Pages (Optional but Recommended)

Currently, the checkboxes link to `/terms-of-service` and `/privacy-policy`. You have two options:

#### Option A: Create Simple Static Pages

Create two new components:
- `src/components/legal/TermsOfService.tsx`
- `src/components/legal/PrivacyPolicy.tsx`

Then update `App.tsx` to handle these routes:

```typescript
// In App.tsx, add these routes:
if (path === '/terms-of-service') {
  return <TermsOfService />;
}

if (path === '/privacy-policy') {
  return <PrivacyPolicy />;
}
```

#### Option B: Update Links to External URLs

If you have external pages, update the links in `LoginForm.tsx`:

```typescript
// Change from:
href="/terms-of-service"
// To:
href="https://yourdomain.com/terms-of-service"
```

#### Option C: Create Modal/Overlay Pages

Create modal components that open when users click the links.

## Testing Checklist

### Test Email Sign-Up with Terms/Privacy
1. [ ] Navigate to sign-up form
2. [ ] Fill in email, password, and confirm password
3. [ ] Try to submit without checking boxes → Should show error
4. [ ] Check Terms of Service checkbox only → Should show error about Privacy Policy
5. [ ] Check both boxes → Should allow submission
6. [ ] Click Terms of Service link → Should open (or show placeholder if not created)
7. [ ] Click Privacy Policy link → Should open (or show placeholder if not created)

### Test Google Sign-In/Sign-Up
1. [ ] Ensure Google OAuth is configured in Supabase (see `GOOGLE_OAUTH_SETUP.md`)
2. [ ] Click "Sign in with Google" → Should redirect to Google
3. [ ] Complete Google authentication → Should redirect back to app
4. [ ] Verify user is created/logged in
5. [ ] Test "Sign up with Google" → Should work the same way
6. [ ] Test with existing user → Should sign in
7. [ ] Test with new user → Should create account

### Test User Flow
1. [ ] New Google user signs up → Should be created
2. [ ] User sees "No company access" message (expected)
3. [ ] Admin assigns user to company → User can access app
4. [ ] Email sign-up creates account → Same company assignment needed

## Important Notes

### For Google OAuth Users
- Terms/Privacy checkboxes don't appear for Google OAuth (Google handles consent)
- New Google users still need admin approval for company access
- Same user management flow as email/password sign-up

### For Email/Password Users
- Must accept both Terms and Privacy Policy to sign up
- Validation happens before form submission
- Clear error messages guide users

## Troubleshooting

### Google Sign-In Not Working
- **Error: "redirect_uri_mismatch"**
  - Check Google Console → Add Supabase callback URL
  - Format: `https://YOUR_PROJECT_ID.supabase.co/auth/v1/callback`
  - Also add your site URL

- **Error: "invalid_client"**
  - Verify Client ID and Secret in Supabase settings
  - Check for extra spaces or copy errors

- **User Created But Can't Access**
  - Normal behavior - user needs company assignment
  - Use admin panel to assign user to company
  - Or use auto-assign feature if available

### Terms/Privacy Links Not Working
- Links currently point to `/terms-of-service` and `/privacy-policy`
- These routes need to be added to your routing system
- Or update links to point to external URLs
- See "Part 2" above for options

## Next Steps

1. **Configure Google OAuth** (Required for Google Sign-In)
   - Follow `GOOGLE_OAUTH_SETUP.md`
   - Test Google authentication flow

2. **Create Legal Pages** (Recommended)
   - Add Terms of Service page
   - Add Privacy Policy page
   - Or update links to external URLs

3. **Test Everything**
   - Test email sign-up with validation
   - Test Google sign-in/sign-up
   - Test error handling
   - Test user assignment flow

4. **Production Ready**
   - Update all URLs to production domains
   - Add production redirect URIs
   - Publish OAuth consent screen (if public)

## Code Changes Summary

### Files Modified:
- ✅ `src/components/auth/LoginForm.tsx`
  - Added Terms/Privacy checkboxes
  - Added Google Sign-In button
  - Added validation for checkboxes
  - Added `handleGoogleSignIn` function

### Files Created:
- ✅ `GOOGLE_OAUTH_SETUP.md` - Detailed OAuth setup guide
- ✅ `SETUP_GUIDE.md` - This file

### Files You May Need to Create:
- ⚠️ `src/components/legal/TermsOfService.tsx` (optional)
- ⚠️ `src/components/legal/PrivacyPolicy.tsx` (optional)
- Or update `App.tsx` to handle these routes

## Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review `GOOGLE_OAUTH_SETUP.md` for OAuth-specific issues
3. Check Supabase Dashboard → Authentication → Providers
4. Check browser console for errors
5. Verify environment variables are set correctly


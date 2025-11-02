#!/bin/bash

# Quick deployment script for Google OAuth Edge Functions
# Replace YOUR_PROJECT_REF with your actual Supabase project reference

echo "🚀 Deploying Google OAuth Edge Functions..."

# Step 1: Link your project (replace with your actual project ref)
# You can find this in your Supabase dashboard URL: https://app.supabase.com/project/YOUR_PROJECT_REF
PROJECT_REF="YOUR_PROJECT_REF"

echo "📋 Step 1: Linking to Supabase project..."
supabase link --project-ref $PROJECT_REF

echo ""
echo "📋 Step 2: Deploying google-oauth-start..."
supabase functions deploy google-oauth-start

echo ""
echo "📋 Step 3: Deploying google-oauth-callback..."
supabase functions deploy google-oauth-callback

echo ""
echo "📋 Step 4: Deploying google-oauth-debug (optional)..."
supabase functions deploy google-oauth-debug

echo ""
echo "✅ Deployment complete!"
echo ""
echo "⚠️  IMPORTANT: Set your secrets before testing:"
echo "   supabase secrets set GOOGLE_CLIENT_ID=your_client_id"
echo "   supabase secrets set GOOGLE_CLIENT_SECRET=your_client_secret"
echo ""
echo "   Or set them in Supabase Dashboard → Project Settings → Edge Functions → Secrets"


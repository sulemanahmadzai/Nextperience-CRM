import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");

    if (!code || !state) {
      return errorResponse("Missing code or state parameter");
    }

    const userId = state;

    const base = new URL(req.url).origin.replace("http://", "https://");
    const redirectUri = `${base}/functions/v1/google-oauth-callback`;

    const clientId = Deno.env.get("GOOGLE_CLIENT_ID") ?? Deno.env.get("VITE_GOOGLE_CLIENT_ID");
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET") ?? Deno.env.get("VITE_GOOGLE_CLIENT_SECRET");

    if (!clientId || !clientSecret) {
      return errorResponse("OAuth credentials not configured");
    }

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("[OAuth] Token exchange failed:", errorText);
      return errorResponse("Token exchange failed");
    }

    const tokens = await tokenResponse.json();

    const expiresAt = new Date(Date.now() + (tokens.expires_in * 1000));

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { error: upsertError } = await supabase
      .from("google_tokens")
      .upsert({
        user_id: userId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt.toISOString(),
        scope: tokens.scope,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "user_id"
      });

    if (upsertError) {
      console.error("[OAuth] Database error:", upsertError);
      return errorResponse("Failed to save tokens");
    }

    console.log("[OAuth] Tokens saved successfully for user:", userId);

    const html = `<!DOCTYPE html>
<html>
<head>
  <title>Connected to Google</title>
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }
    .container {
      text-align: center;
      padding: 2rem;
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
      border-radius: 20px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
    }
    .success-icon {
      font-size: 4rem;
      margin-bottom: 1rem;
    }
    h2 {
      margin: 0 0 0.5rem 0;
      font-size: 1.5rem;
    }
    p {
      margin: 0;
      opacity: 0.9;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="success-icon">✓</div>
    <h2>Connected Successfully!</h2>
    <p>You can now send emails. This window will close automatically...</p>
  </div>
  <script>
    (function() {
      try {
        const payload = {
          type: 'google-connected',
          success: true,
          timestamp: Date.now()
        };

        if (window.opener && !window.opener.closed) {
          console.log('[Callback] Posting success message to opener');
          window.opener.postMessage(payload, '*');

          setTimeout(() => {
            window.opener.postMessage(payload, '*');
          }, 100);
        } else {
          console.warn('[Callback] No valid opener window');
        }
      } catch (e) {
        console.error('[Callback] Error:', e);
      }

      setTimeout(() => {
        console.log('[Callback] Closing window');
        window.close();
      }, 2000);
    })();
  </script>
</body>
</html>`;

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'X-Content-Type-Options': 'nosniff'
      }
    });
  } catch (error) {
    console.error("[OAuth] Unexpected error:", error);
    return errorResponse(error.message);
  }
});

function errorResponse(message: string) {
  const html = `<!DOCTYPE html>
<html>
<head>
  <title>Connection Failed</title>
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
      color: white;
    }
    .container {
      text-align: center;
      padding: 2rem;
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
      border-radius: 20px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
    }
    .error-icon {
      font-size: 4rem;
      margin-bottom: 1rem;
    }
    h2 {
      margin: 0 0 0.5rem 0;
      font-size: 1.5rem;
    }
    p {
      margin: 0;
      opacity: 0.9;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="error-icon">✕</div>
    <h2>Connection Failed</h2>
    <p>${message}</p>
    <p style="margin-top: 1rem;">This window will close automatically...</p>
  </div>
  <script>
    (function() {
      try {
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage({
            type: 'google-error',
            error: '${message}'
          }, '*');
        }
      } catch (e) {
        console.error('[Callback] Error:', e);
      }

      setTimeout(() => {
        window.close();
      }, 3000);
    })();
  </script>
</body>
</html>`;

  return new Response(html, {
    status: 400,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}
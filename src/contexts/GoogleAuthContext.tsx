import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

interface GoogleAuthContextType {
  isConnected: boolean;
  loading: boolean;
  connectGoogle: () => void;
  disconnectGoogle: () => Promise<void>;
  sendEmail: (params: SendEmailParams) => Promise<void>;
}

interface SendEmailParams {
  to: string[];
  subject: string;
  body: string;
  attachments?: { filename: string; content: string; mimeType: string }[];
}

const GoogleAuthContext = createContext<GoogleAuthContextType | undefined>(undefined);

export function GoogleAuthProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      checkGoogleConnection();
    } else {
      setIsConnected(false);
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    function onMsg(e: MessageEvent) {
      console.log('[GoogleAuth] message received:', e.origin, e.data);

      const t = e?.data?.type;
      if (!t) return;

      // Allow both variations while stabilizing
      if (t !== 'gmail-connected' && t !== 'google-connected') return;

      // Allow known origins (relax during setup)
      const okOrigins = [
        'https://dgzhpyjcbjplrmtynrcb.supabase.co',
        'https://nexperience-crm-mul-xopl.bolt.host',
        'http://localhost:5173',
        'http://localhost:54321'
      ];
      const ok = okOrigins.some(o => (e.origin || '').startsWith(o));
      if (!ok) {
        console.warn('[GoogleAuth] Unexpected origin:', e.origin);
      }

      // Update states to mark as connected
      try {
        setIsConnected(true);
        console.log('[GoogleAuth] Connection confirmed!');
      } catch (err) {
        console.error('[GoogleAuth] Error updating state:', err);
      }
    }

    window.addEventListener('message', onMsg);
    console.log('[GoogleAuth] Message listener attached');

    return () => {
      window.removeEventListener('message', onMsg);
      console.log('[GoogleAuth] Message listener removed');
    };
  }, []);

  const checkGoogleConnection = async () => {
    if (!user) return;

    try {
      const localCheck = localStorage.getItem('google_connected');
      if (localCheck === 'true') {
        console.log('[GoogleAuth] LocalStorage indicates connected');
        setIsConnected(true);
      }

      const { data } = await supabase
        .from('google_tokens')
        .select('id, expires_at')
        .eq('user_id', user.id)
        .maybeSingle();

      if (data) {
        const expiresAt = new Date(data.expires_at);
        const connected = expiresAt > new Date();
        console.log('[GoogleAuth] Database check - connected:', connected);
        setIsConnected(connected);
        if (connected) {
          localStorage.setItem('google_connected', 'true');
        } else {
          localStorage.removeItem('google_connected');
        }
      } else {
        console.log('[GoogleAuth] No tokens found in database');
        setIsConnected(false);
        localStorage.removeItem('google_connected');
      }
    } catch (error) {
      console.error('[GoogleAuth] Error checking connection:', error);
      setIsConnected(false);
    } finally {
      setLoading(false);
    }
  };

  const connectGoogle = async () => {
    if (!user) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.error('[GoogleAuth] No active session');
        return;
      }

      const startUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-oauth-start`;

      const response = await fetch(startUrl, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (response.redirected) {
        const w = window.open(response.url, 'google-oauth', 'width=520,height=640');

        if (!w || w.closed || typeof w.closed === 'undefined') {
          window.location.href = response.url;
        }
      } else {
        const error = await response.json();
        console.error('[GoogleAuth] Failed to start OAuth:', error);
      }
    } catch (error) {
      console.error('[GoogleAuth] Error connecting to Google:', error);
    }
  };

  const disconnectGoogle = async () => {
    if (!user) return;

    try {
      await supabase
        .from('google_tokens')
        .delete()
        .eq('user_id', user.id);

      setIsConnected(false);
    } catch (error) {
      console.error('Error disconnecting Google:', error);
      throw error;
    }
  };

  const sendEmail = async (params: SendEmailParams) => {
    if (!user) throw new Error('User not authenticated');
    if (!isConnected) throw new Error('Google account not connected');

    const { data: tokenData } = await supabase
      .from('google_tokens')
      .select('access_token, refresh_token, expires_at')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!tokenData) throw new Error('No Google token found');

    let accessToken = tokenData.access_token;
    const expiresAt = new Date(tokenData.expires_at);

    if (expiresAt <= new Date()) {
      accessToken = await refreshAccessToken(tokenData.refresh_token);
    }

    const email = createEmailMessage(params);
    const base64Email = btoa(unescape(encodeURIComponent(email)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: base64Email }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to send email');
    }

    return await response.json();
  };

  const refreshAccessToken = async (refreshToken: string): Promise<string> => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    const clientSecret = import.meta.env.VITE_GOOGLE_CLIENT_SECRET;

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to refresh access token');
    }

    const data = await response.json();
    const expiresAt = new Date(Date.now() + data.expires_in * 1000);

    await supabase
      .from('google_tokens')
      .update({
        access_token: data.access_token,
        expires_at: expiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user!.id);

    return data.access_token;
  };

  const createEmailMessage = (params: SendEmailParams): string => {
    const boundary = '----=_Part_' + Date.now();
    let message = '';

    message += `To: ${params.to.join(', ')}\r\n`;
    message += `Subject: ${params.subject}\r\n`;
    message += `MIME-Version: 1.0\r\n`;

    if (params.attachments && params.attachments.length > 0) {
      message += `Content-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n`;
      message += `--${boundary}\r\n`;
      message += `Content-Type: text/html; charset=UTF-8\r\n\r\n`;
      message += `${params.body}\r\n\r\n`;

      for (const attachment of params.attachments) {
        message += `--${boundary}\r\n`;
        message += `Content-Type: ${attachment.mimeType}\r\n`;
        message += `Content-Transfer-Encoding: base64\r\n`;
        message += `Content-Disposition: attachment; filename="${attachment.filename}"\r\n\r\n`;
        message += `${attachment.content}\r\n\r\n`;
      }

      message += `--${boundary}--`;
    } else {
      message += `Content-Type: text/html; charset=UTF-8\r\n\r\n`;
      message += params.body;
    }

    return message;
  };

  return (
    <GoogleAuthContext.Provider
      value={{
        isConnected,
        loading,
        connectGoogle,
        disconnectGoogle,
        sendEmail,
      }}
    >
      {children}
    </GoogleAuthContext.Provider>
  );
}

export function useGoogleAuth() {
  const context = useContext(GoogleAuthContext);
  if (context === undefined) {
    throw new Error('useGoogleAuth must be used within a GoogleAuthProvider');
  }
  return context;
}

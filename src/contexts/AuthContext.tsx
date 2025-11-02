import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null; data?: { user: User | null } }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null; data?: { user: User | null } }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('[AuthContext] ===== INITIALIZING =====');
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      console.log('[AuthContext] getSession result:', {
        hasSession: !!session,
        userId: session?.user?.id,
        userEmail: session?.user?.email,
        error,
        hasError: !!error
      });
      setUser(session?.user ?? null);
      setLoading(false);
      console.log('[AuthContext] Initial session check complete');
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[AuthContext] Auth state changed:', {
        event,
        hasSession: !!session,
        userId: session?.user?.id,
        userEmail: session?.user?.email
      });
      setUser(session?.user ?? null);
    });

    return () => {
      console.log('[AuthContext] Cleaning up auth subscription');
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    console.log('[AuthContext] ===== SIGN IN ATTEMPT =====');
    console.log('[AuthContext] Email:', email);
    const { error, data } = await supabase.auth.signInWithPassword({ email, password });
    console.log('[AuthContext] Sign in result:', {
      success: !error,
      error: error ? error.message : null,
      userId: data?.user?.id,
      userEmail: data?.user?.email,
      errorDetails: error
    });
    return { error: error ? new Error(error.message) : null, data };
  };

  const signUp = async (email: string, password: string) => {
    const { error, data } = await supabase.auth.signUp({ email, password });
    return { error: error ? new Error(error.message) : null, data };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    window.location.reload();
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

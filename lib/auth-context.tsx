'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function ensureProfile(params: { id: string; email: string; fullName?: string }) {
  await supabase.from('profiles').upsert(
    {
      id: params.id,
      email: params.email,
      full_name: params.fullName ?? null,
    },
    { onConflict: 'id' }
  );
}

async function tryEnsureProfile(user: User | null, fullName?: string) {
  if (!user?.email) return;
  try {
    await ensureProfile({ id: user.id, email: user.email, fullName });
  } catch {
    // best-effort profile sync
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;

        const nextUser = data.session?.user ?? null;
        setUser(nextUser);
        setLoading(false);

        void tryEnsureProfile(nextUser);
      } catch {
        if (cancelled) return;
        setUser(null);
        setLoading(false);
      }
    }

    boot();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      setLoading(false);

      await tryEnsureProfile(nextUser);
    });

    return () => {
      cancelled = true;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string, fullName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (data.user && !error) {
      await tryEnsureProfile(data.user, fullName);
    }

    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, loading, signUp, signIn, signOut }}>
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

'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { Session, User } from '@supabase/supabase-js';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClientComponentClient();
  const router = useRouter();
  const initialLoad = useRef(true);

  // Single effect to handle auth state and redirects
  useEffect(() => {
    let mounted = true;
    let subscription: { unsubscribe: () => void } | null = null;

    const initializeAuth = async () => {
      try {
        const { data: { session: activeSession } } = await supabase.auth.getSession();
        
        if (!mounted) return;
        
        setSession(activeSession);
        setUser(activeSession?.user ?? null);

        // Handle initial redirect
        if (initialLoad.current) {
          if (activeSession?.user) {
            router.push('/discovery');
          } else if (window.location.pathname !== '/') {
            router.push('/');
          }
          initialLoad.current = false;
        }
      } catch (error) {
        console.error('Auth error:', error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    // Set up auth state change listener
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      
      setSession(session);
      setUser(session?.user ?? null);
      
      // Handle auth state changes
      if (event === 'SIGNED_IN') {
        router.push('/discovery');
      } else if (event === 'SIGNED_OUT') {
        router.push('/');
      }
    });

    // Store the subscription
    subscription = data;
    initializeAuth();

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, [supabase.auth, router]);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // Memoize the context value to prevent unnecessary re-renders
  const value = {
    session,
    user,
    loading,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

"use client";

import { createContext, useContext, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/store/store';

const AuthContext = createContext<any>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClientComponentClient();
  const router = useRouter();

  const {
    user,
    profile,
    setUser,
    setProfile,
    setAuthLoading,
    setAuthHydrated,
    isAuthHydrated,
    clearAuth,
    setCachedProfile
  } = useAppStore();

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        // Get current session
        const { data: { session } } = await supabase.auth.getSession();

        if (!mounted) return;

        if (session?.user) {
          setUser(session.user);

          // Fetch profile
          const { data: profileData } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', session.user.id)
            .single();

          if (mounted && profileData) {
            setProfile(profileData);
            setCachedProfile(session.user.id, profileData);
          }
        } else {
          setUser(null);
          setProfile(null);
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
      } finally {
        if (mounted) {
          setAuthLoading(false);
          setAuthHydrated(true);
        }
      }
    };

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        if (event === 'SIGNED_IN' && session?.user) {
          setUser(session.user);

          // Fetch profile
          const { data: profileData } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', session.user.id)
            .single();

          if (profileData) {
            setProfile(profileData);
            setCachedProfile(session.user.id, profileData);
          }
        } else if (event === 'SIGNED_OUT') {
          clearAuth();
        } else if (session?.user) {
          setUser(session.user);
        }
      }
    );

    initAuth();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase, setUser, setProfile, setAuthLoading, setAuthHydrated, clearAuth, setCachedProfile]);

  const value = {
    user,
    session: user ? { user } : null,
    loading: !isAuthHydrated,
    signOut: () => supabase.auth.signOut(),
    supabase,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import AuthForm from '@/components/auth/AuthForm';
// (types removed to avoid runtime import)

export default function AuthPage() {
  const router = useRouter();
  const supabase = createClientComponentClient();
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const checkUser = async () => {
      try {
        // If coming from Get Started with ?new=1, don't force sign-out.
        // We'll handle redirection based on session below.
        const isNew = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('new') === '1';

        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          setLoading(false);
          return;
        }
        if (session) {
          router.push('/discovery');
          return;
        }
        // If no session and isNew, just show the auth form (no redirect)
        if (isNew) {
          setLoading(false);
          return;
        }
      } catch (error) {
        // ignore
      } finally {
        setLoading(false);
      }
    };

    checkUser();
  }, [router, supabase]);
  
  // handleRoleSelect is no longer needed here as AuthForm handles redirection
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[100svh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  return (
    <div className="min-h-[100svh] flex items-center justify-center px-4 py-12 bg-background">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">Welcome to SUNOMSI</h1>
          <p className="mt-2 text-gray-600">Sign in or create an account to get started</p>
        </div>
        
        <AuthForm /> {/* No onRoleSelect prop needed */}
      </div>
    </div>
  );
}
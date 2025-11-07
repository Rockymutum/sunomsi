'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { UserRole } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

interface AuthFormProps {} // No props needed anymore

export default function AuthForm() {
  const router = useRouter();
  const supabase = createClientComponentClient();
  const { user, loading } = useAuth();
  const [showRoleSelection, setShowRoleSelection] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isEmailSent, setIsEmailSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsLoading(true);

    try {
      if (!isSignUp) {
        // Handle sign in
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          setErrorMsg(error.message || 'Sign in failed');
          setIsLoading(false);
          return;
        }

        if (data?.session) {
          // The AuthProvider will handle the redirection
          return;
        }
          
          // Redirect all successful sign-ins to discovery
          router.push('/discovery');
        } else {
          console.warn('[Auth] signIn returned no session');
          setErrorMsg('Sign in failed: no session');
          
          // Reset button
          if (saveButton) {
            saveButton.textContent = 'Sign In';
            saveButton.removeAttribute('disabled');
          }
        }
      } catch (err: any) {
        console.error('[Auth] signIn network error:', err);
        setErrorMsg(err?.message || 'Network error. Check Supabase env.');
        
        // Reset button
        const saveButton = document.querySelector('button[type="submit"]');
        if (saveButton) {
          saveButton.textContent = 'Sign In';
          saveButton.removeAttribute('disabled');
        }
      }
    } else {
      // Sign Up flow: create account with default role 'worker' and send verification email
      try {
        const saveButton = document.querySelector('button[type="submit"]');
        if (saveButton) {
          saveButton.textContent = 'Signing up...';
          saveButton.setAttribute('disabled', 'true');
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              role: 'worker',
              full_name: 'New User',
            },
            emailRedirectTo: window.location.origin + '/auth',
          },
        });

        if (error) {
          setErrorMsg(error.message || 'Sign up failed');
          if (saveButton) {
            saveButton.textContent = 'Sign Up';
            saveButton.removeAttribute('disabled');
          }
          return;
        }

        // Create profile row with default role 'worker' if user is immediately available
        if (data.user) {
          const { error: insertError } = await supabase.from('profiles').insert({
            user_id: data.user.id,
            full_name: 'New User',
            email: email,
            role: 'worker',
          });
          if (insertError) {
            // Non-fatal; user can complete profile later
            console.warn('[Auth] Profile creation warning:', insertError);
          }
        }

        setIsEmailSent(true);
        router.push('/auth/check-email');
      } catch (err: any) {
        setErrorMsg(err?.message || 'Network error. Check Supabase env.');
        const saveButton = document.querySelector('button[type="submit"]');
        if (saveButton) {
          saveButton.textContent = 'Sign Up';
          saveButton.removeAttribute('disabled');
        }
      }
    }
  };

  const handleResetPassword = async () => {
    setErrorMsg(null);
    if (!email) {
      setErrorMsg('Enter your email first to reset password.');
      return;
    }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: typeof window !== 'undefined' ? window.location.origin + '/auth/reset' : undefined,
      });
      if (error) {
        setErrorMsg(error.message || 'Failed to send reset email');
        return;
      }
      setIsEmailSent(true);
      router.push('/auth/check-email');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Network error while sending reset email');
    }
  };

  const handleRoleSelect = async (role: UserRole) => {
    setErrorMsg(null);
    
    // Show loading state
    const roleButtons = document.querySelectorAll('.role-button');
    roleButtons.forEach(btn => {
      btn.setAttribute('disabled', 'true');
    });
    
    try {
      console.log('[AuthForm] Attempting sign-up with:', { email, password: '***', role });
      
      // First check if user already exists
      const { data: existingUser } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (existingUser?.session) {
        // User already exists, just update their role and redirect
        console.log('[AuthForm] User already exists, updating role');
        
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ role: role })
          .eq('user_id', existingUser.session.user.id);
          
        if (updateError) {
          console.error('[Auth] Profile update error:', updateError);
          setErrorMsg('Could not update your profile. Please try again.');
          resetButtons();
          return;
        }
        
        // Redirect based on role
        if (role === 'poster') {
          router.push('/tasks/new');
        } else if (role === 'worker') {
          router.push('/discovery');
        } else {
          router.push('/profile/edit');
        }
        return;
      }
      
      // If user doesn't exist, create a new one
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            role,
            full_name: 'New User', // Initialize full_name
          },
          emailRedirectTo: window.location.origin + '/auth',
        },
      });
      
      if (error) {
        console.error('[Auth] signUp error:', error);
        setErrorMsg(error.message || 'Sign up failed');
        console.error('[Auth] Full signUp error object:', error);
        resetButtons();
        return;
      }
      
      if (data.user) {
        // Insert a profile entry for the new user
        const { error: insertError } = await supabase.from('profiles').insert({
          user_id: data.user.id,
          full_name: 'New User', // Default full_name
          email: email, // Add email to profile
          role: role,
        });

        if (insertError) {
          console.error('[Auth] Profile creation error:', insertError);
          setErrorMsg('Could not create a profile. Please try again.');
          resetButtons();
          return;
        }

        // If user exists, it means signup was successful, but email confirmation might be pending
        setIsEmailSent(true);
        router.push('/auth/check-email'); // Redirect to a page informing user to check email
      } else {
        console.warn('[Auth] signUp returned no user, but no error was reported.');
        setIsEmailSent(true);
        router.push('/auth/check-email');
      }
    } catch (err: any) {
      console.error('[Auth] signUp network error:', err);
      setErrorMsg(err?.message || 'Network error. Check Supabase env.');
      resetButtons();
    }
  };
  
  const resetButtons = () => {
    const roleButtons = document.querySelectorAll('.role-button');
    roleButtons.forEach(btn => {
      btn.removeAttribute('disabled');
    });
  };

  if (isEmailSent) {
    return (
      <div className="card max-w-md mx-auto p-6 text-center">

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
          <div className="p-8">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                {isSignUp ? 'Create an account' : 'Welcome back'}
              </h1>
              <p className="text-gray-600 dark:text-gray-300">
                {isSignUp ? 'Sign up to get started' : 'Sign in to your account'}
              </p>
            </div>
            <form onSubmit={handleAuth} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium mb-1">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium mb-1">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field"
                  required
                />
                <div className="mt-2 text-right">
                  <button type="button" onClick={handleResetPassword} className="text-xs text-primary hover:underline">
                    Forgot password?
                  </button>
                </div>
              </div>
              <button
                type="submit"
                className={`w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors duration-200 ${
                  isLoading ? 'opacity-75 cursor-not-allowed' : ''
                }`}
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {isSignUp ? 'Creating account...' : 'Signing in...'}
                  </span>
                ) : isSignUp ? (
                  'Create account'
                ) : (
                  'Sign in'
                )}
              </button>
              <button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-primary hover:underline"
              >
                {isSignUp ? 'Already have an account? Sign In' : 'Need an account? Sign Up'}
              </button>
            </form>
          </div>
        </div>
      </div>
      
      {/* Removed alternate provider login to keep a single login option */}
    </div>
  );
}
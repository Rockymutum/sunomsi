import { useState } from 'react';
import { useRouter } from 'next/navigation'; // Import useRouter
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { UserRole } from '@/lib/supabase';

interface AuthFormProps {} // No props needed anymore

export default function AuthForm() {
  const router = useRouter();
  const supabase = createClientComponentClient();
  const [showRoleSelection, setShowRoleSelection] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isEmailSent, setIsEmailSent] = useState(false); // New state for email confirmation

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    console.log('[AuthForm] handleAuth called. isSignUp:', isSignUp);

    if (!isSignUp) {
      try {
        console.log('[AuthForm] Attempting sign-in with:', { email, password: '***' });
        
        // Show loading state
        const saveButton = document.querySelector('button[type="submit"]');
        if (saveButton) {
          saveButton.textContent = 'Signing in...';
          saveButton.setAttribute('disabled', 'true');
        }
        
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        console.log('[AuthForm] signInWithPassword response - data:', data, 'error:', error);

        if (error) {
          console.error('[Auth] signIn error:', error);
          setErrorMsg(error.message || 'Sign in failed');
          
          // Reset button
          if (saveButton) {
            saveButton.textContent = 'Sign In';
            saveButton.removeAttribute('disabled');
          }
        } else if (data?.session) {
          console.log('[AuthForm] Sign-in successful, session:', data.session);
          
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
        <h2 className="text-2xl font-bold mb-4">Check Your Email</h2>
        <p className="text-gray-700 mb-6">
          A confirmation link has been sent to <span className="font-semibold">{email}</span>.
          Please click the link in the email to complete your signup.
        </p>
        <button onClick={() => router.push('/auth')} className="btn-primary">
          Back to Sign In
        </button>
      </div>
    );
  }

  // Role selection UI is deprecated; we no longer render it

  return (
    <div className="card max-w-md mx-auto">
      <h2 className="text-2xl font-bold mb-6 text-center">
        {isSignUp ? 'Create an Account' : 'Sign In'}
      </h2>
      {errorMsg && (
        <div className="mb-4 text-sm text-red-600">{errorMsg}</div>
      )}
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
        
        <button type="submit" className="btn-primary w-full">
          {isSignUp ? 'Sign Up' : 'Sign In'}
        </button>
      </form>
      
      <div className="mt-4 text-center">
        <button
          onClick={() => setIsSignUp(!isSignUp)}
          className="text-primary hover:underline"
        >
          {isSignUp ? 'Already have an account? Sign In' : 'Need an account? Sign Up'}
        </button>
      </div>
      
      {/* Removed alternate provider login to keep a single login option */}
    </div>
  );
}
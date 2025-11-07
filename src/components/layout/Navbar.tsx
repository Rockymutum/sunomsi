"use client";

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import Image from 'next/image';
import { BsGlobeAsiaAustralia, BsChatDots } from 'react-icons/bs';

// Cache for user data with session storage fallback
const CACHE_KEY = 'userDataCache';
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

const getCachedUserData = () => {
  if (typeof window === 'undefined') return null;
  
  const cached = sessionStorage.getItem(CACHE_KEY);
  if (!cached) return null;
  
  try {
    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp < CACHE_DURATION) {
      return data;
    }
  } catch (e) {
    console.error('Error parsing cached user data:', e);
  }
  return null;
};

const setCachedUserData = (data: any) => {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
  } catch (e) {
    console.error('Error caching user data:', e);
  }
};

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClientComponentClient();
  
  // State with initial values from cache if available
  const [authState, setAuthState] = useState(() => {
    const cached = getCachedUserData();
    return {
      isLoggedIn: cached?.isLoggedIn || false,
      userRole: cached?.userRole || null,
      avatarUrl: cached?.avatarUrl || null,
      isLoading: !cached
    };
  });
  
  const [showSearch, setShowSearch] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Memoized function to update user data
  const updateUserData = useCallback(async () => {
    try {
      // Check cache first
      const cached = getCachedUserData();
      if (cached) {
        setAuthState(prev => ({
          ...prev,
          ...cached,
          isLoading: false
        }));
        return;
      }

      setAuthState(prev => ({ ...prev, isLoading: true }));
      
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        cachedUserData = {
          isLoggedIn: false,
          userRole: null,
          avatarUrl: null,
          timestamp: Date.now()
        };
        setAuthState({
          isLoggedIn: false,
          userRole: null,
          avatarUrl: null,
          isLoading: false
        });
        return;
      }

      const uid = session.user.id;
      const [{ data: prof }, { data: worker }] = await Promise.all([
        supabase.from('profiles').select('avatar_url, updated_at').eq('user_id', uid).maybeSingle(),
        supabase.from('worker_profiles').select('id').eq('user_id', uid).maybeSingle(),
      ]);
      
      const avatar = prof?.avatar_url || null;
      const ts = prof?.updated_at ? `?t=${encodeURIComponent(prof.updated_at)}` : '';
      const avatarUrl = avatar ? `${avatar}${ts}` : null;
      const userRole = worker ? 'worker' : 'poster';
      
      // Update state and cache
      const newState = {
        isLoggedIn: true,
        userRole,
        avatarUrl,
        isLoading: false
      };
      
      setAuthState(newState);
      setCachedUserData(newState);
      
    } catch (error) {
      console.error('Error updating user data:', error);
      setAuthState(prev => ({
        ...prev,
        isLoading: false
      }));
    }
  }, [supabase]);

  useEffect(() => {
    let unsubAuth: { data: { subscription: { unsubscribe: () => void } } } | null = null;

    // Initial load
    updateUserData();

    // Set up auth state change listener
    unsubAuth = supabase.auth.onAuthStateChange((event) => {
      if (['SIGNED_IN', 'SIGNED_OUT', 'USER_UPDATED'].includes(event)) {
        // Clear cache on auth state changes
        cachedUserData = null;
        updateUserData();
      }
    }) as any;

    // Set up visibility change listener
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        updateUserData();
      }
    };
    
    // Add visibility change listener
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup function
    return () => {
      try { 
        if (unsubAuth?.data?.subscription?.unsubscribe) {
          unsubAuth.data.subscription.unsubscribe(); 
        }
      } catch (error) {
        console.error('Error unsubscribing from auth:', error);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [supabase]);

  // Apply stored/system theme on mount (no UI here)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const applyTheme = () => {
      const stored = localStorage.getItem('theme');
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const isDark = stored ? stored === 'dark' : prefersDark;
      document.documentElement.classList.toggle('dark', isDark);
    };
    
    applyTheme();
    
    // Listen for system theme changes
    const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    darkModeMediaQuery.addEventListener('change', applyTheme);
    
    return () => {
      darkModeMediaQuery.removeEventListener('change', applyTheme);
    };
  }, []);

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      // Clear cache on sign out
      cachedUserData = null;
      setAuthState({
        isLoggedIn: false,
        userRole: null,
        avatarUrl: null,
        isLoading: false
      });
      window.location.href = '/';
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };
  const goToWorkers = () => {
    router.push('/workers');
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchTerm.trim();
    const targetBase = pathname.startsWith('/workers') ? '/workers' : '/discovery';
    
    // Use shallow routing to prevent full page refresh
    if (!q) {
      router.push(targetBase, { scroll: false });
    } else {
      const searchParams = new URLSearchParams();
      searchParams.set('q', q);
      router.push(`${targetBase}?${searchParams.toString()}`, { scroll: false });
    }
    
    // Close search and reset input
    setShowSearch(false);
    setSearchTerm('');
    
    // Blur the search input to dismiss mobile keyboard
    const activeElement = document.activeElement as HTMLElement;
    if (activeElement) {
      activeElement.blur();
    }
  };

  return (
    <>
      <nav className={`bg-white ${showSearch ? 'shadow-md' : 'shadow-sm'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center gap-2 cursor-default select-none" aria-label="SUNOMSI brand">
                <div className="relative h-7 w-7">
                  <Image
                    src="/logo.png.PNG"
                    alt="SUNOMSI logo"
                    fill
                    sizes="28px"
                    className="object-contain"
                    priority
                  />
                </div>
                <span className="text-xl font-bold text-primary">SUNOMSI</span>
              </div>
              
              {/* Desktop Navigation */}
              <div className="hidden md:ml-6 md:flex md:space-x-5">
                <Link
                  href="/discovery"
                  aria-label="Discover Tasks"
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                    pathname === '/discovery'
                      ? 'border-primary text-gray-900'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  }`}
                >
                  <BsGlobeAsiaAustralia className="h-5 w-5" />
                  <span className="ml-1">Discover</span>
                </Link>
                <Link 
                  href="/workers"
                  aria-label="Find Workers"
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                    pathname === '/workers' 
                      ? 'border-primary text-gray-900' 
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20v-1a4 4 0 00-4-4H7a4 4 0 00-4 4v1M12 11a4 4 0 100-8 4 4 0 000 8m9 9v-1a6 6 0 00-5-5.91" />
                  </svg>
                  <span className="ml-1">Workers</span>
                </Link>
                <Link
                  href="/messages"
                  aria-label="Messages"
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                    pathname.startsWith('/messages')
                      ? 'border-primary text-gray-900'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  }`}
                >
                  <BsChatDots className="h-5 w-5" />
                  <span className="ml-1">Messages</span>
                </Link>
              </div>
            </div>

            {/* Search and Profile */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSearch((v) => !v)}
                aria-label="Search workers"
                className="p-2 rounded-md text-white bg-primary hover:bg-primary-dark"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
                </svg>
              </button>
              
              {authState.isLoading ? (
                <div className="h-8 w-8 rounded-full bg-gray-200 animate-pulse"></div>
              ) : authState.isLoggedIn ? (
                <Link href="/profile" aria-label="Profile" className="flex items-center">
                  <span className="h-8 w-8 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center">
                    {authState.avatarUrl ? (
                      <img 
                        src={authState.avatarUrl} 
                        alt="Profile" 
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          // Fallback to default avatar if image fails to load
                          const target = e.target as HTMLImageElement;
                          target.onerror = null;
                          target.src = '/default-avatar.png';
                        }}
                      />
                    ) : (
                      <svg 
                        xmlns="http://www.w3.org/2000/svg" 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        stroke="currentColor" 
                        className="h-5 w-5 text-gray-600"
                      >
                        <path 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                          strokeWidth="2" 
                          d="M17 20v-1a4 4 0 00-4-4H7a4 4 0 00-4 4v1M12 11a4 4 0 100-8 4 4 0 000 8" 
                        />
                      </svg>
                    )}
                  </span>
                </Link>
              ) : (
                <Link href="/auth" className="btn-primary">
                  Sign In
                </Link>
              )}
            </div>
          </div>

          {/* Search Bar */}
          <div
            className={`border-t border-gray-100 transition-all duration-300 ease-out overflow-hidden ${
              showSearch ? 'max-h-24 opacity-100' : 'max-h-0 opacity-0'
            }`}
          >
            <form onSubmit={handleSearchSubmit} className="w-full py-2">
              <input
                type="text"
                autoFocus={showSearch}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search workers or tasks"
                className="block w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </form>
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm shadow-[0_-2px_10px_rgba(0,0,0,0.05)] z-50 border-t border-gray-100">
        <div className="flex justify-around items-center h-16 px-2">
          <Link
            href="/discovery"
            aria-label="Discover Tasks"
            className={`relative flex flex-col items-center justify-center flex-1 h-full transition-all duration-200 ${
              pathname === '/discovery' 
                ? 'text-primary' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {pathname === '/discovery' && (
              <span className="absolute -top-1 w-1.5 h-1.5 bg-primary rounded-full"></span>
            )}
            <div className={`p-2.5 rounded-full transition-all duration-200 ${
              pathname === '/discovery' ? 'bg-primary/10' : 'hover:bg-gray-100'
            }`}>
              <BsGlobeAsiaAustralia className="h-5 w-5" />
            </div>
            <span className="text-[11px] font-medium mt-0.5">Discover</span>
          </Link>
          
          <Link 
            href="/workers"
            aria-label="Find Workers"
            className={`relative flex flex-col items-center justify-center flex-1 h-full transition-all duration-200 ${
              pathname === '/workers' 
                ? 'text-primary' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {pathname === '/workers' && (
              <span className="absolute -top-1 w-1.5 h-1.5 bg-primary rounded-full"></span>
            )}
            <div className={`p-2.5 rounded-full transition-all duration-200 ${
              pathname === '/workers' ? 'bg-primary/10' : 'hover:bg-gray-100'
            }`}>
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                className="h-5 w-5"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth="2" 
                  d="M17 20v-1a4 4 0 00-4-4H7a4 4 0 00-4 4v1m8-10a4 4 0 100-8 4 4 0 000 8z" 
                />
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth="2" 
                  d="M12 11a4 4 0 100-8 4 4 0 000 8zm9 9v-1a6 6 0 00-5-5.91" 
                />
              </svg>
            </div>
            <span className="text-[11px] font-medium mt-0.5">Workers</span>
          </Link>
          
          <Link
            href="/messages"
            aria-label="Messages"
            className={`relative flex flex-col items-center justify-center flex-1 h-full transition-all duration-200 ${
              pathname.startsWith('/messages') 
                ? 'text-primary' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {pathname.startsWith('/messages') && (
              <span className="absolute -top-1 w-1.5 h-1.5 bg-primary rounded-full"></span>
            )}
            <div className={`p-2.5 rounded-full transition-all duration-200 ${
              pathname.startsWith('/messages') ? 'bg-primary/10' : 'hover:bg-gray-100'
            }`}>
              <BsChatDots className="h-5 w-5" />
            </div>
            <span className="text-[11px] font-medium mt-0.5">Messages</span>
          </Link>
        </div>
      </nav>

      {/* Add padding to main content to account for bottom nav on mobile */}
      <style jsx global>{`
        @media (max-width: 767px) {
          body {
            padding-bottom: 4.5rem; /* Slightly more space for better spacing */
          }
          
          /* Smooth scrolling for better UX */
          html {
            scroll-behavior: smooth;
          }
          
          /* Better touch targets */
          @media (pointer: coarse) {
            a, button, [role="button"] {
              min-width: 44px;
              min-height: 44px;
            }
          }
        }
      `}</style>
    </>
  );
}
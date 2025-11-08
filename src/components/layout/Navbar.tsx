"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import Image from 'next/image';
import { BsGlobeAsiaAustralia, BsChatDots } from 'react-icons/bs';

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Cache for user data
interface CachedUserData {
  isLoggedIn: boolean;
  userRole: string | null;
  avatarUrl: string | null;
  timestamp: number;
}

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClientComponentClient();
  const cachedUserData = useRef<CachedUserData | null>(null);
  
  // State with initial values from cache if available
  const [authState, setAuthState] = useState(() => ({
    isLoggedIn: false,
    userRole: null as string | null,
    avatarUrl: null as string | null,
    isLoading: true
  }));
  
  const [showSearch, setShowSearch] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [lastScrollY, setLastScrollY] = useState(0);
  const [showNav, setShowNav] = useState(true);

  // Memoized function to update user data
  const updateUserData = useCallback(async () => {
    try {
      // Check cache first
      if (cachedUserData.current && (Date.now() - cachedUserData.current.timestamp) < CACHE_DURATION) {
        setAuthState(prev => ({
          ...prev,
          ...cachedUserData.current,
          isLoading: false
        }));
        return;
      }

      setAuthState(prev => ({ ...prev, isLoading: true }));
      
      // Get the current session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session?.user) {
        console.error('Session error:', sessionError);
        cachedUserData.current = {
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
      
      try {
        // Use the session to make authenticated requests
        const [profResponse, workerResponse] = await Promise.all([
          supabase
            .from('profiles')
            .select('avatar_url, updated_at')
            .eq('user_id', uid)
            .single(),
          supabase
            .from('worker_profiles')
            .select('id')
            .eq('user_id', uid)
            .maybeSingle()
        ]);

        if (profResponse.error) throw profResponse.error;
        if (workerResponse.error && workerResponse.error.code !== 'PGRST116') { // Ignore not found errors for worker_profiles
          throw workerResponse.error;
        }

        const avatar = profResponse.data?.avatar_url || null;
        const ts = profResponse.data?.updated_at ? `?t=${encodeURIComponent(profResponse.data.updated_at)}` : '';
        const avatarUrl = avatar ? `${avatar}${ts}` : null;
        const userRole = workerResponse.data ? 'worker' : 'poster';
        
        // Update cache
        cachedUserData.current = {
          isLoggedIn: true,
          userRole,
          avatarUrl,
          timestamp: Date.now()
        };
        
        setAuthState({
          isLoggedIn: true,
          userRole,
          avatarUrl,
          isLoading: false
        });
      } catch (error) {
        console.error('Error fetching user data:', error);
        // Don't cache failed requests
        cachedUserData.current = null;
        setAuthState(prev => ({
          ...prev,
          isLoading: false
        }));
      }
      
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
    let mounted = true;

    const initializeAuth = async () => {
      // Initial load
      await updateUserData();

      // Set up auth state change listener
      unsubAuth = supabase.auth.onAuthStateChange(async (event) => {
        if (mounted && ['SIGNED_IN', 'SIGNED_OUT', 'USER_UPDATED', 'TOKEN_REFRESHED'].includes(event)) {
          // Clear cache on auth state changes
          cachedUserData.current = null;
          await updateUserData();
        }
      }) as any;
    };

    initializeAuth().catch(console.error);

    // Set up visibility change listener
    const handleVisibilityChange = () => {
      if (mounted && document.visibilityState === 'visible') {
        updateUserData().catch(console.error);
      }
    };
    
    // Add visibility change listener
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup function
    return () => {
      mounted = false;
      try { 
        if (unsubAuth?.data?.subscription?.unsubscribe) {
          unsubAuth.data.subscription.unsubscribe(); 
        }
      } catch (error) {
        console.error('Error unsubscribing from auth:', error);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [updateUserData]);

  // Ensure light theme is applied
  useEffect(() => {
    document.documentElement.classList.remove('dark');
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme', 'light');
    }
  }, []);

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      // Clear cache on sign out by setting current to null
      if (cachedUserData.current) {
        cachedUserData.current = null;
      }
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
    if (!q) {
      router.push(targetBase);
    } else {
      router.push(`${targetBase}?q=${encodeURIComponent(q)}`);
    }
    setShowSearch(false);
  };

  // Add padding to the body to prevent content from being hidden behind the fixed navbar
  // Handle scroll behavior
  useEffect(() => {
    const controlNavbar = () => {
      if (typeof window !== 'undefined') {
        const currentScrollY = window.scrollY;
        
        // Always show navbar at the top of the page
        if (currentScrollY === 0) {
          setShowNav(true);
        } 
        // Scrolling down
        else if (currentScrollY > lastScrollY && currentScrollY > 100) {
          setShowNav(false);
        } 
        // Scrolling up
        else if (currentScrollY < lastScrollY - 10) {
          setShowNav(true);
        }
        
        setLastScrollY(currentScrollY);
      }
    };

    // Set CSS variables for safe area insets
    document.documentElement.style.setProperty('--safe-area-top', 'env(safe-area-inset-top, 0px)');
    document.body.style.paddingTop = 'calc(64px + var(--safe-area-top, 0px))';
    
    // Add meta tag for iOS viewport and safe area
    const meta = document.createElement('meta');
    meta.name = 'viewport';
    meta.content = 'width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1.0, user-scalable=0';
    
    // Add a style tag to handle the safe area background
    const style = document.createElement('style');
    style.id = 'safe-area-style';
    style.textContent = `
      html {
        background-color: white;
        height: 100%;
      }
      
      body {
        position: relative;
        background-color: white;
        min-height: 100%;
        padding-top: env(safe-area-inset-top);
        margin: 0;
      }
      
      /* Safe area background */
      body::before {
        content: '';
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        height: env(safe-area-inset-top);
        background-color: white;
        z-index: 9999;
      }
      
      /* Ensure the navbar respects the safe area */
      nav {
        padding-top: env(safe-area-inset-top);
        margin-top: calc(-1 * env(safe-area-inset-top, 0px));
      }
    `;
    
    document.head.appendChild(meta);
    document.head.appendChild(style);
    
    // Add scroll event listener
    window.addEventListener('scroll', controlNavbar, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', controlNavbar);
      document.body.style.paddingTop = '';
      document.documentElement.style.removeProperty('--safe-area-top');
      const existingMeta = document.querySelector('meta[name="viewport"]');
      const existingStyle = document.getElementById('safe-area-style');
      
      if (existingMeta) {
        document.head.removeChild(existingMeta);
      }
      if (existingStyle) {
        document.head.removeChild(existingStyle);
      }
    };
  }, [lastScrollY]);

  return (
    <>
      <nav 
        className={`bg-white ${showSearch ? 'shadow-md' : 'shadow-sm'} w-full fixed left-0 right-0 z-50 transition-transform duration-200 ease-in-out ${
          showNav ? 'translate-y-0' : '-translate-y-full'
        }`} 
        style={{
          top: 0,
          left: 0,
          right: 0,
          height: 'calc(64px + env(safe-area-inset-top, 0px))',
          paddingTop: 'env(safe-area-inset-top, 0px)',
          zIndex: 50,
          boxSizing: 'border-box',
          background: 'white',
          borderBottom: '1px solid #f0f0f0',
          willChange: 'transform',
          transform: showNav ? 'translateY(0)' : 'translateY(-100%)',
          transition: 'transform 0.2s ease-in-out'
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full h-full">
          <div className="flex justify-between items-center h-full">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center gap-2 cursor-default select-none" aria-label="SUNOMSI brand">
                <div className="relative h-7 w-7 flex-shrink-0">
                  <Image
                    src="/logo.png.PNG"
                    alt="SUNOMSI logo"
                    width={28}
                    height={28}
                    sizes="28px"
                    className="object-contain"
                    priority
                    loading="eager"
                    unoptimized={false}
                    onError={(e) => {
                      // Fallback to a simple text logo if image fails to load
                      const target = e.target as HTMLImageElement;
                      target.onerror = null;
                      target.src = '/logo-fallback.svg';
                    }}
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
        <div className="flex justify-around items-center h-14 px-2">
          <Link
            href="/discovery"
            aria-label="Discover Tasks"
            className={`flex flex-col items-center justify-center flex-1 h-full border-t-2 pt-1 ${
              pathname === '/discovery'
                ? 'border-primary text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <BsGlobeAsiaAustralia className="h-5 w-5" />
            <span className="text-[11px] font-medium mt-0.5">Discover</span>
          </Link>
          
          <Link 
            href="/workers"
            aria-label="Find Workers"
            className={`flex flex-col items-center justify-center flex-1 h-full border-t-2 pt-1 ${
              pathname === '/workers'
                ? 'border-primary text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
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
            <span className="text-[11px] font-medium mt-0.5">Workers</span>
          </Link>
          
          <Link
            href="/messages"
            aria-label="Messages"
            className={`flex flex-col items-center justify-center flex-1 h-full border-t-2 pt-1 ${
              pathname.startsWith('/messages')
                ? 'border-primary text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <BsChatDots className="h-5 w-5" />
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
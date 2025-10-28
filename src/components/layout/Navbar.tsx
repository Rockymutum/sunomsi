"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import Image from 'next/image';
import { BsGlobeAsiaAustralia } from 'react-icons/bs';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClientComponentClient();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    let unsubAuth: { data: { subscription: { unsubscribe: () => void } } } | null = null;

    const refreshUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsLoggedIn(!!session);
      if (session?.user) {
        const uid = session.user.id;
        const [{ data: prof }, { data: worker }] = await Promise.all([
          supabase.from('profiles').select('avatar_url, updated_at').eq('user_id', uid).maybeSingle(),
          supabase.from('worker_profiles').select('id').eq('user_id', uid).maybeSingle(),
        ]);
        const avatar = prof?.avatar_url || null;
        const ts = (prof as any)?.updated_at ? `?t=${encodeURIComponent((prof as any).updated_at)}` : '';
        setAvatarUrl(avatar ? `${avatar}${ts}` : null);
        setUserRole(worker ? 'worker' : 'poster');
      } else {
        setUserRole(null);
        setAvatarUrl(null);
      }
    };

    refreshUser();

    // Update on auth state change
    unsubAuth = supabase.auth.onAuthStateChange((_event, _session) => {
      refreshUser();
    }) as any;

    // Update on focus/visibility (helps after portfolio creation)
    const onFocus = () => refreshUser();
    const onVis = () => { if (document.visibilityState === 'visible') refreshUser(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVis);

    return () => {
      try { unsubAuth?.data?.subscription?.unsubscribe(); } catch {}
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [supabase]);

  // Apply stored/system theme on mount (no UI here)
  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('theme') : null;
    const prefersDark = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = stored ? stored === 'dark' : prefersDark;
    if (isDark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setIsLoggedIn(false);
    setUserRole(null);
    window.location.href = '/';
  };
  const goToWorkers = () => {
    router.push('/workers');
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchTerm.trim();
    const targetBase = pathname.startsWith('/workers') ? '/workers' : '/discovery';
    if (!q) router.push(targetBase);
    else router.push(`${targetBase}?q=${encodeURIComponent(q)}`);
    setShowSearch(false);
  };

  return (
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
            <div className="ml-4 flex space-x-5">
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
              </Link>
              
            </div>
          </div>
          <div className="ml-2 flex items-center gap-2">
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
              {/* Inline search removed to prevent layout shift */}
            </div>
            {isLoggedIn && (
              <Link href="/profile" aria-label="Profile" className="flex items-center">
                <span className="h-8 w-8 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center">
                  {avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatarUrl} alt="Profile" className="h-full w-full object-cover" />
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5 text-gray-600">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20v-1a4 4 0 00-4-4H7a4 4 0 00-4 4v1M12 11a4 4 0 100-8 4 4 0 000 8" />
                    </svg>
                  )}
                </span>
              </Link>
            )}
            {isLoggedIn ? (
              <></>
            ) : (
              <Link 
                href="/auth" 
                className="btn-primary"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </div>
      <div
        className={`border-t border-gray-100 transition-all duration-300 ease-out overflow-hidden ${
          showSearch ? 'max-h-24 opacity-100 shadow-sm' : 'max-h-0 opacity-0'
        }`}
      >
        <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${showSearch ? 'py-2' : 'py-0'}`}>
          <form onSubmit={handleSearchSubmit} className="w-full">
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
  );
}
"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { User } from '@supabase/supabase-js';
import Image from 'next/image';
import { BsGlobeAsiaAustralia, BsChatDots, BsPerson } from 'react-icons/bs';
import { sessionManager } from '@/utils/sessionPersistence';
import { useAuth } from '@/components/providers/AuthProvider';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { supabase } = useAuth(); // Get supabase from AuthProvider
  const [user, setUser] = useState<User | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [lastScrollY, setLastScrollY] = useState(0);
  const [showNav, setShowNav] = useState(true);

  // Initialize and subscribe to auth state changes
  useEffect(() => {
    const fetchUserAndProfile = async () => {
      const currentUser = await sessionManager.getCurrentUser();
      setUser(currentUser);

      if (currentUser) {
        // Try to load avatar from cache first
        const cachedAvatar = sessionStorage.getItem(`avatar_${currentUser.id}`);
        if (cachedAvatar) {
          setAvatarUrl(cachedAvatar);
        }

        // Fetch user profile (in background)
        const { data: profile } = await supabase
          .from('profiles')
          .select('avatar_url, updated_at')
          .eq('user_id', currentUser.id)
          .single();

        if (profile?.avatar_url) {
          const ts = profile.updated_at ? `?t=${encodeURIComponent(profile.updated_at)}` : '';
          const fullAvatarUrl = `${profile.avatar_url}${ts}`;
          setAvatarUrl(fullAvatarUrl);
          // Cache the avatar URL
          sessionStorage.setItem(`avatar_${currentUser.id}`, fullAvatarUrl);
        }
      } else {
        setAvatarUrl(null);
      }
    };

    fetchUserAndProfile();

    const unsubscribe = sessionManager.subscribe(async (updatedUser) => {
      setUser(updatedUser);
      if (updatedUser) {
        // Try to load avatar from cache first
        const cachedAvatar = sessionStorage.getItem(`avatar_${updatedUser.id}`);
        if (cachedAvatar) {
          setAvatarUrl(cachedAvatar);
        }

        // Fetch user profile on auth changes
        const { data: profile } = await supabase
          .from('profiles')
          .select('avatar_url, updated_at')
          .eq('user_id', updatedUser.id)
          .single();

        if (profile?.avatar_url) {
          const ts = profile.updated_at ? `?t=${encodeURIComponent(profile.updated_at)}` : '';
          const fullAvatarUrl = `${profile.avatar_url}${ts}`;
          setAvatarUrl(fullAvatarUrl);
          // Cache the avatar URL
          sessionStorage.setItem(`avatar_${updatedUser.id}`, fullAvatarUrl);
        }
      } else {
        setAvatarUrl(null);
      }
    });

    return () => unsubscribe();
  }, [supabase]);


  // Handle scroll behavior
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setShowNav(false);
      } else {
        setShowNav(true);
      }
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      router.push('/auth');
      router.refresh(); // Ensure the page reloads to reflect signed out state
    } catch (error) {
      console.error('Error signing out:', error);
    }
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
    setSearchTerm('');
  };


  return (
    <>
      <nav className={`bg-white ${showSearch ? 'shadow-md' : 'shadow-sm'} w-full fixed left-0 right-0 z-50 transition-transform duration-200 ease-in-out ${showNav ? 'translate-y-0' : '-translate-y-full'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center gap-2">
                <Image
                  src="/logo.png.PNG"
                  alt="SUNOMSI logo"
                  width={28}
                  height={28}
                  className="object-contain"
                />
                <span className="text-xl font-bold text-primary">SUNOMSI</span>
              </div>

              <div className="hidden md:ml-6 md:flex md:space-x-5">
                <Link
                  href="/discovery"
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${pathname === '/discovery' ? 'border-primary text-gray-900' : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                    }`}
                >
                  <BsGlobeAsiaAustralia className="h-5 w-5" />
                  <span className="ml-1">Discover</span>
                </Link>
                <Link
                  href="/workers"
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${pathname === '/workers' ? 'border-primary text-gray-900' : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                    }`}
                >
                  <BsPerson className="h-5 w-5" />
                  <span className="ml-1">Workers</span>
                </Link>
                <Link
                  href="/messages"
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${pathname.startsWith('/messages') ? 'border-primary text-gray-900' : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                    }`}
                >
                  <BsChatDots className="h-5 w-5" />
                  <span className="ml-1">Messages</span>
                </Link>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSearch((v) => !v)}
                className="p-2 rounded-md text-white bg-primary hover:bg-primary-dark"
              >
                🔍
              </button>

              {user ? (
                <Link href="/profile" className="flex items-center">
                  <div className="h-8 w-8 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center">
                    {avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={avatarUrl} alt="Profile" className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-5 w-5 text-gray-600">👤</div>
                    )}
                  </div>
                </Link>
              ) : (
                <Link href="/auth" className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark">
                  Sign In
                </Link>
              )}
            </div>
          </div>

          {/* Search Bar */}
          {showSearch && (
            <div className="border-t border-gray-100 py-2">
              <form onSubmit={handleSearchSubmit} className="w-full">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search workers or tasks"
                  className="block w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm placeholder-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </form>
            </div>
          )}
        </div>
      </nav>


      {/* Mobile Bottom Navigation - Floating Design */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 pointer-events-none">
        <div className="px-4 pb-4">
          <div className="bg-white/90 backdrop-blur-xl rounded-[24px] shadow-[0_8px_32px_rgba(0,0,0,0.12)] border border-gray-200/50 pointer-events-auto">
            <div className="flex justify-around items-center h-16 px-2">
              <Link
                href="/discovery"
                className={`flex flex-col items-center justify-center flex-1 h-full gap-1 rounded-2xl transition-all duration-200 ${pathname === '/discovery'
                  ? 'text-slate-900 scale-105'
                  : 'text-gray-500 hover:text-gray-700 active:scale-95'
                  }`}
              >
                <BsGlobeAsiaAustralia className={`h-6 w-6 transition-all ${pathname === '/discovery' ? 'text-slate-900' : ''}`} />
                <span className={`text-[10px] font-semibold transition-all ${pathname === '/discovery' ? 'text-slate-900' : ''}`}>
                  Discover
                </span>
                {pathname === '/discovery' && (
                  <div className="absolute bottom-1 w-1 h-1 rounded-full bg-slate-900" />
                )}
              </Link>

              <Link
                href="/workers"
                className={`flex flex-col items-center justify-center flex-1 h-full gap-1 rounded-2xl transition-all duration-200 ${pathname === '/workers'
                  ? 'text-slate-900 scale-105'
                  : 'text-gray-500 hover:text-gray-700 active:scale-95'
                  }`}
              >
                <BsPerson className={`h-6 w-6 transition-all ${pathname === '/workers' ? 'text-slate-900' : ''}`} />
                <span className={`text-[10px] font-semibold transition-all ${pathname === '/workers' ? 'text-slate-900' : ''}`}>
                  Workers
                </span>
                {pathname === '/workers' && (
                  <div className="absolute bottom-1 w-1 h-1 rounded-full bg-slate-900" />
                )}
              </Link>

              <Link
                href="/messages"
                className={`flex flex-col items-center justify-center flex-1 h-full gap-1 rounded-2xl transition-all duration-200 ${pathname.startsWith('/messages')
                  ? 'text-slate-900 scale-105'
                  : 'text-gray-500 hover:text-gray-700 active:scale-95'
                  }`}
              >
                <BsChatDots className={`h-6 w-6 transition-all ${pathname.startsWith('/messages') ? 'text-slate-900' : ''}`} />
                <span className={`text-[10px] font-semibold transition-all ${pathname.startsWith('/messages') ? 'text-slate-900' : ''}`}>
                  Messages
                </span>
                {pathname.startsWith('/messages') && (
                  <div className="absolute bottom-1 w-1 h-1 rounded-full bg-slate-900" />
                )}
              </Link>
            </div>
          </div>
        </div>
      </nav>
    </>
  );
}
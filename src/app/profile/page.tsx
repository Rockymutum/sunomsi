"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import Navbar from "@/components/layout/Navbar";
import Link from "next/link";
import { BsBehance, BsDribbble, BsLinkedin, BsInstagram } from "react-icons/bs";

export default function ProfileHomePage() {
  const router = useRouter();
  const supabase = createClientComponentClient();

  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [isWorker, setIsWorker] = useState<boolean>(false);
  const [social, setSocial] = useState<{ behance?: string | null; dribbble?: string | null; linkedin?: string | null; instagram?: string | null }>({});
  const [isDark, setIsDark] = useState<boolean>(false);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/auth");
        return;
      }
      setUserId(session.user.id);
      setEmail(session.user.email ?? null);

      const { data: prof } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", session.user.id)
        .maybeSingle();
      setProfile(prof || null);
      if (prof?.contact) {
        const contactStr = prof.contact as string;
        setSocial({
          behance: /behance\.net\//i.test(contactStr) ? contactStr.match(/https?:\/\/[^\s]*behance[^\s]*/i)?.[0] || null : null,
          dribbble: /dribbble\.com\//i.test(contactStr) ? contactStr.match(/https?:\/\/[^\s]*dribbble[^\s]*/i)?.[0] || null : null,
          linkedin: /linkedin\.com\//i.test(contactStr) ? contactStr.match(/https?:\/\/[^\s]*linkedin[^\s]*/i)?.[0] || null : null,
          instagram: /instagram\.com\//i.test(contactStr) ? contactStr.match(/https?:\/\/[^\s]*instagram[^\s]*/i)?.[0] || null : null,
        });
      } else {
        setSocial({});
      }

      // Check worker portfolio existence to infer role
      const { data: wp } = await supabase
        .from('worker_profiles')
        .select('id')
        .eq('user_id', session.user.id)
        .maybeSingle();
      setIsWorker(!!wp);
      setLoading(false);
    };
    init();
  }, [supabase, router]);

  // Initialize theme from localStorage and system preference
  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('theme') : null;
    const prefersDark = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialDark = stored ? stored === 'dark' : prefersDark;
    setIsDark(initialDark);
    if (initialDark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, []);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    if (next) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  if (loading) {
    return (
      <div className="min-h-[100svh] bg-background">
        <Navbar />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100svh] bg-background">
      <Navbar />
      <div className="max-w-sm sm:max-w-md md:max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="relative rounded-[28px] shadow-lg overflow-hidden bg-white md:bg-[rgb(var(--color-card))] md:shadow-sm">
          <div className="p-5 pb-20">
            <div className="flex items-center justify-end text-gray-500">
              <button onClick={toggleTheme} aria-label="Toggle dark mode" className="p-2 hover:bg-gray-100 rounded-full dark:text-gray-100 dark:hover:bg-gray-800">
                {isDark ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M21.752 15.002A9.718 9.718 0 0112.003 22C6.486 22 2 17.514 2 12a9.718 9.718 0 016.998-9.749.75.75 0 01.948.94 8.219 8.219 0 00.396 6.23 8.219 8.219 0 006.23 4.796.75.75 0 01.18 1.485z"/>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 3.75a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0V4.5A.75.75 0 0112 3.75zm0 13.5a3.75 3.75 0 100-7.5 3.75 3.75 0 000 7.5zM5.47 5.47a.75.75 0 011.06 0l1.06 1.06a.75.75 0 11-1.06 1.06L5.47 6.53a.75.75 0 010-1.06zm12 12a.75.75 0 011.06 0l1.06 1.06a.75.75 0 11-1.06 1.06l-1.06-1.06a.75.75 0 010-1.06zM3.75 12a.75.75 0 01.75-.75h1.5a.75.75 0 010 1.5H4.5A.75.75 0 013.75 12zm13.5 0a.75.75 0 01.75-.75h1.5a.75.75 0 010 1.5h-1.5a.75.75 0 01-.75-.75zM5.47 18.53a.75.75 0 010-1.06l1.06-1.06a.75.75 0 111.06 1.06L6.53 18.53a.75.75 0 01-1.06 0zM16.41 6.53a.75.75 0 010-1.06l1.06-1.06a.75.75 0 111.06 1.06L17.47 6.53a.75.75 0 01-1.06 0zM12 18a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0112 18z"/>
                  </svg>
                )}
              </button>
            </div>

            <div className="mt-2 flex justify-center">
              <div className="h-24 w-24 rounded-full overflow-hidden ring-2 ring-white shadow-md bg-gray-100">
                {profile?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.avatar_url} alt="Avatar" className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center bg-primary/10 text-primary font-bold text-2xl">
                    {(profile?.full_name?.charAt(0) || "U").toUpperCase()}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 text-center">
              <div className="text-lg font-semibold text-gray-900">{profile?.full_name || "User"}</div>
              <div className="mt-1">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${isWorker ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                  {isWorker ? 'Worker' : 'Poster'}
                </span>
              </div>
              {(social.behance || social.dribbble || social.linkedin || social.instagram) && (
                <div className="mt-3 flex items-center justify-center gap-3">
                  {social.behance && (
                    <Link href={social.behance} target="_blank" className="p-2 rounded-lg bg-gray-50 hover:bg-gray-100 text-[#1769FF]">
                      <BsBehance className="h-5 w-5" />
                    </Link>
                  )}
                  {social.dribbble && (
                    <Link href={social.dribbble} target="_blank" className="p-2 rounded-lg bg-gray-50 hover:bg-gray-100 text-[#EA4C89]">
                      <BsDribbble className="h-5 w-5" />
                    </Link>
                  )}
                  {social.linkedin && (
                    <Link href={social.linkedin} target="_blank" className="p-2 rounded-lg bg-gray-50 hover:bg-gray-100 text-[#0A66C2]">
                      <BsLinkedin className="h-5 w-5" />
                    </Link>
                  )}
                  {social.instagram && (
                    <Link href={social.instagram} target="_blank" className="p-2 rounded-lg bg-gray-50 hover:bg-gray-100 text-[#C13584]">
                      <BsInstagram className="h-5 w-5" />
                    </Link>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white text-gray-900 p-5 pt-6">
            <div className="mb-5">
              <div className="text-sm text-gray-600 mb-1">About</div>
              <div className="text-base font-medium whitespace-pre-line">{profile?.bio || '—'}</div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-600 mb-1">Place</div>
                <div className="text-base font-medium pb-2">{profile?.place || '—'}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">Contact</div>
                <div className="text-base font-medium pb-2 break-words">{(() => { const v = (profile?.contact || email || '').toString().replace(/https?:\/\/[^\s]*instagram[^\s]*/gi, '').replace(/\s{2,}/g, ' ').trim(); return v || '—'; })()}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">Joined</div>
                <div className="text-base font-medium pb-2">{profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : '—'}</div>
              </div>
            </div>

            <div className="mt-6 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:gap-3">
              <button onClick={() => router.push('/profile/edit')} className="btn-primary w-full sm:w-auto">Edit Profile</button>
              <button onClick={handleSignOut} className="btn-secondary w-full sm:w-auto sm:ml-auto">Log Out</button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 pb-10">
        <div className="card mt-4">
          <div className="flex flex-wrap justify-center gap-6 text-sm">
            <Link href="/about" className="text-gray-600 hover:text-primary">About</Link>
            <Link href="/terms" className="text-gray-600 hover:text-primary">Terms</Link>
            <Link href="/privacy" className="text-gray-600 hover:text-primary">Privacy</Link>
            <Link href="/contact" className="text-gray-600 hover:text-primary">Contact</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

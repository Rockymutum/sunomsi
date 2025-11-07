"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import Navbar from "@/components/layout/Navbar";
import Link from "next/link";
import { BsBehance, BsDribbble, BsLinkedin, BsInstagram } from "react-icons/bs";
import { FaFacebook } from "react-icons/fa";
import { FiEdit3, FiLogOut, FiMail, FiMapPin, FiCalendar } from "react-icons/fi";

export default function ProfileHomePage() {
  const router = useRouter();
  const supabase = createClientComponentClient();

  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [isWorker, setIsWorker] = useState<boolean>(false);
  const [social, setSocial] = useState<{
    behance?: string | null;
    dribbble?: string | null;
    linkedin?: string | null;
    instagram?: string | null;
    facebook?: string | null;
  }>({});

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
          facebook: /facebook\.com\//i.test(contactStr) ? contactStr.match(/https?:\/\/[^\s]*facebook[^\s]*/i)?.[0] || null : null,
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

  // Ensure light theme is applied
  useEffect(() => {
    document.documentElement.classList.remove('dark');
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme', 'light');
    }
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  const contactDisplay = (() => {
    const raw = (profile?.contact || email || "").toString();
    const sanitized = raw
      .replace(/https?:\/\/[^\s]*behance[^\s]*/gi, "")
      .replace(/https?:\/\/[^\s]*dribbble[^\s]*/gi, "")
      .replace(/https?:\/\/[^\s]*linkedin[^\s]*/gi, "")
      .replace(/https?:\/\/[^\s]*instagram[^\s]*/gi, "")
      .replace(/https?:\/\/[^\s]*facebook[^\s]*/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim();
    return sanitized || "—";
  })();

  const joinedDate = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";

  const hasSocialLinks = Boolean(
    social.behance || social.dribbble || social.linkedin || social.instagram || social.facebook
  );

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
      <main className="mx-auto w-full max-w-sm px-4 pb-12 pt-8 sm:max-w-md md:max-w-2xl sm:px-6 lg:px-8">
        <section className="relative overflow-hidden rounded-[28px] border border-slate-100 bg-white shadow-xl">
          <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-r from-primary/90 via-primary to-primary/70 opacity-90" aria-hidden="true" />

          <header className="relative p-5 pb-8">
            <div className="flex items-start justify-between">
              <span className="text-xs font-semibold uppercase tracking-[0.35em] text-white/80">
                Profile
              </span>
            </div>

            <div className="mt-10 flex flex-col items-center text-center">
              <div className="h-24 w-24 overflow-hidden rounded-full border-4 border-white bg-gray-100 shadow-lg">
                {profile?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.avatar_url} alt={profile?.full_name || "Avatar"} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-white text-3xl font-semibold text-primary">
                    {(profile?.full_name?.charAt(0) || "U").toUpperCase()}
                  </div>
                )}
              </div>

              <div className="mt-4 space-y-2">
                <h1 className="text-xl font-semibold text-gray-900">
                  {profile?.full_name || "User"}
                </h1>
                <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-medium uppercase tracking-wider">
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold ${
                      isWorker ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {isWorker ? "Worker" : "Poster"}
                  </span>
                  {email && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-3 py-1 text-[11px] font-semibold text-slate-600 shadow-sm backdrop-blur">
                      <FiMail className="h-3.5 w-3.5" />
                      {email}
                    </span>
                  )}
                </div>
              </div>

              {hasSocialLinks && (
                <div className="mt-5 flex w-full flex-wrap items-center justify-center gap-3">
                  {social.facebook && (
                    <Link
                      href={social.facebook}
                      target="_blank"
                      className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-[#0866FF] shadow-sm transition hover:-translate-y-0.5 hover:border-[#0866FF]/50 hover:bg-[#0866FF]/5"
                    >
                      <FaFacebook className="h-5 w-5" />
                    </Link>
                  )}
                  {social.behance && (
                    <Link
                      href={social.behance}
                      target="_blank"
                      className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-[#1769FF] shadow-sm transition hover:-translate-y-0.5 hover:border-[#1769FF]/50 hover:bg-[#1769FF]/5"
                    >
                      <BsBehance className="h-5 w-5" />
                    </Link>
                  )}
                  {social.dribbble && (
                    <Link
                      href={social.dribbble}
                      target="_blank"
                      className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-[#EA4C89] shadow-sm transition hover:-translate-y-0.5 hover:border-[#EA4C89]/50 hover:bg-[#EA4C89]/5"
                    >
                      <BsDribbble className="h-5 w-5" />
                    </Link>
                  )}
                  {social.linkedin && (
                    <Link
                      href={social.linkedin}
                      target="_blank"
                      className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-[#0A66C2] shadow-sm transition hover:-translate-y-0.5 hover:border-[#0A66C2]/50 hover:bg-[#0A66C2]/5"
                    >
                      <BsLinkedin className="h-5 w-5" />
                    </Link>
                  )}
                  {social.instagram && (
                    <Link
                      href={social.instagram}
                      target="_blank"
                      className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-[#C13584] shadow-sm transition hover:-translate-y-0.5 hover:border-[#C13584]/50 hover:bg-[#C13584]/5"
                    >
                      <BsInstagram className="h-5 w-5" />
                    </Link>
                  )}
                </div>
              )}
            </div>
          </header>

          <div className="relative border-t border-slate-100 bg-white p-5">
            <div className="space-y-5">
              <section className="bg-white">
                <h2 className="text-xs font-semibold uppercase tracking-[0.45em] text-slate-500">
                  About
                </h2>
                <div className="mt-2 rounded-2xl bg-white border border-slate-100 shadow-sm">
                  <p className="whitespace-pre-line px-4 py-3 text-sm font-medium text-slate-700">
                    {profile?.bio || "Share a short introduction to let others get to know you."}
                  </p>
                </div>
              </section>

              <section className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2 bg-white">
                <div className="flex items-start gap-2.5 rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                  <span className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-full bg-white text-primary shadow-sm">
                    <FiMapPin className="h-4 w-4" />
                  </span>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-500">Place</div>
                    <p className="mt-1 font-medium text-slate-800">
                      {profile?.place || "—"}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                  <span className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-full bg-white text-primary shadow-sm">
                    <FiMail className="h-4 w-4" />
                  </span>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-500">Contact</div>
                    <p className="mt-1 break-words font-medium text-slate-800">
                      {contactDisplay}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 sm:col-span-2">
                  <span className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-full bg-white text-primary shadow-sm">
                    <FiCalendar className="h-4 w-4" />
                  </span>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-500">Joined</div>
                    <p className="mt-1 font-medium text-slate-800">{joinedDate}</p>
                  </div>
                </div>
              </section>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <button
                  onClick={() => router.push("/profile/edit")}
                  className="btn-primary inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold sm:w-auto"
                >
                  <FiEdit3 className="h-4 w-4" />
                  Edit profile
                </button>
                <button
                  onClick={handleSignOut}
                  className="btn-secondary inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold sm:w-auto"
                >
                  <FiLogOut className="h-4 w-4" />
                  Log out
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

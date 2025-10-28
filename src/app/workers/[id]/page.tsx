"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import Navbar from "@/components/layout/Navbar";
import Link from "next/link";
import { BsBehance, BsDribbble, BsLinkedin, BsInstagram } from "react-icons/bs";

interface WorkerProfile {
  id: string;
  user_id: string;
  title: string | null;
  location: string | null;
  bio: string | null;
  skills: string[] | null;
  rating: number | null;
  created_at?: string;
  updated_at?: string;
}

export default function WorkerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClientComponentClient();

  const userId = (params?.id as string) || "";

  const [loading, setLoading] = useState(true);
  const [worker, setWorker] = useState<WorkerProfile | null>(null);
  const [profile, setProfile] = useState<{ id?: string; full_name?: string; avatar_url?: string; updated_at?: string } | null>(null);
  const [reviews, setReviews] = useState<Array<{ id: string; rating: number; comment: string; created_at: string; reviewer_id: string }>>([]);
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [pastJobs, setPastJobs] = useState<Array<{ id: string; title: string; location: string; created_at: string }>>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState<number>(5);
  const [reviewComment, setReviewComment] = useState<string>('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  // Optional social links if present in profiles table (non-breaking if absent)
  const [social, setSocial] = useState<{ behance?: string | null; dribbble?: string | null; linkedin?: string | null; instagram?: string | null }>({});

  useEffect(() => {
    const load = async () => {
      if (!userId) return;
      setLoading(true);
      // get current user id
      const { data: { session } } = await supabase.auth.getSession();
      setCurrentUserId(session?.user?.id ?? null);
      // Fetch worker profile by user_id
      const { data: w, error } = await supabase
        .from("worker_profiles")
        .select("id, user_id, title, location, bio, skills, rating, created_at, updated_at")
        .eq("user_id", userId)
        .maybeSingle();

      if (!error && w) {
        setWorker(w as WorkerProfile);
        // Fetch basic user profile for name/avatar (display only)
        const { data: p } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url, updated_at, contact")
          .eq("user_id", userId)
          .maybeSingle();
        setProfile(p || null);
        if (p) {
          const contactStr = (p as any).contact as string | null;
          setSocial({
            behance: contactStr && /behance\.net\//i.test(contactStr) ? contactStr.match(/https?:\/\/[^\s]*behance[^\s]*/i)?.[0] || null : null,
            dribbble: contactStr && /dribbble\.com\//i.test(contactStr) ? contactStr.match(/https?:\/\/[^\s]*dribbble[^\s]*/i)?.[0] || null : null,
            linkedin: contactStr && /linkedin\.com\//i.test(contactStr) ? contactStr.match(/https?:\/\/[^\s]*linkedin[^\s]*/i)?.[0] || null : null,
            instagram: contactStr && /instagram\.com\//i.test(contactStr) ? contactStr.match(/https?:\/\/[^\s]*instagram[^\s]*/i)?.[0] || null : null,
          });
        } else {
          setSocial({});
        }

        // Fetch reviews where this user is the reviewee
        const { data: revs } = await supabase
          .from("reviews")
          .select("id, rating, comment, created_at, reviewer_id")
          .eq("reviewee_id", userId)
          .order("created_at", { ascending: false })
          .limit(5);
        if (revs) {
          setReviews(revs as any);
          if (revs.length > 0) {
            const avg = (revs.reduce((s: number, r: any) => s + (r.rating || 0), 0) / revs.length);
            setAvgRating(Number(avg.toFixed(2)));
          } else {
            setAvgRating(null);
          }
        }

        // Fetch past accepted jobs: applications where worker is this user and status accepted, then fetch tasks by ids
        const { data: apps } = await supabase
          .from("applications")
          .select("task_id")
          .eq("worker_id", userId)
          .eq("status", "accepted")
          .order("created_at", { ascending: false })
          .limit(5);
        const taskIds = (apps || []).map((a: any) => a.task_id).filter(Boolean);
        if (taskIds.length > 0) {
          const { data: tasks } = await supabase
            .from("tasks")
            .select("id, title, location, created_at")
            .in("id", taskIds);
          setPastJobs((tasks || []) as any);
        } else {
          setPastJobs([]);
        }
      } else {
        setWorker(null);
      }
      setLoading(false);
    };
    load();
  }, [supabase, userId]);

  // Realtime updates: refresh when profiles or worker_profiles change for this user
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`worker-detail-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `user_id=eq.${userId}` }, () => {
        // refetch profile and keep other state
        (async () => {
          const { data: p } = await supabase
            .from('profiles')
            .select('id, full_name, avatar_url, updated_at, contact')
            .eq('user_id', userId)
            .maybeSingle();
          setProfile(p || null);
          if (p) {
            const contactStr = (p as any).contact as string | null;
            setSocial({
              behance: contactStr && /behance\.net\//i.test(contactStr) ? contactStr.match(/https?:\/\/[^\s]*behance[^\s]*/i)?.[0] || null : null,
              dribbble: contactStr && /dribbble\.com\//i.test(contactStr) ? contactStr.match(/https?:\/\/[^\s]*dribbble[^\s]*/i)?.[0] || null : null,
              linkedin: contactStr && /linkedin\.com\//i.test(contactStr) ? contactStr.match(/https?:\/\/[^\s]*linkedin[^\s]*/i)?.[0] || null : null,
              instagram: contactStr && /instagram\.com\//i.test(contactStr) ? contactStr.match(/https?:\/\/[^\s]*instagram[^\s]*/i)?.[0] || null : null,
            });
          }
        })();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'worker_profiles', filter: `user_id=eq.${userId}` }, () => {
        (async () => {
          const { data: w } = await supabase
            .from('worker_profiles')
            .select('id, user_id, title, location, bio, skills, rating, created_at, updated_at')
            .eq('user_id', userId)
            .maybeSingle();
          if (w) setWorker(w as any);
        })();
      })
      .subscribe();

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        // refresh both models on focus
        (async () => {
          const [{ data: w }, { data: p }] = await Promise.all([
            supabase
              .from('worker_profiles')
              .select('id, user_id, title, location, bio, skills, rating, created_at, updated_at')
              .eq('user_id', userId)
              .maybeSingle(),
            supabase
              .from('profiles')
              .select('id, full_name, avatar_url, updated_at, contact')
              .eq('user_id', userId)
              .maybeSingle(),
          ]);
          if (w) setWorker(w as any);
          setProfile(p || null);
          if (p) {
            const contactStr = (p as any).contact as string | null;
            setSocial({
              behance: contactStr && /behance\.net\//i.test(contactStr) ? contactStr.match(/https?:\/\/[^\s]*behance[^\s]*/i)?.[0] || null : null,
              dribbble: contactStr && /dribbble\.com\//i.test(contactStr) ? contactStr.match(/https?:\/\/[^\s]*dribbble[^\s]*/i)?.[0] || null : null,
              linkedin: contactStr && /linkedin\.com\//i.test(contactStr) ? contactStr.match(/https?:\/\/[^\s]*linkedin[^\s]*/i)?.[0] || null : null,
              instagram: contactStr && /instagram\.com\//i.test(contactStr) ? contactStr.match(/https?:\/\/[^\s]*instagram[^\s]*/i)?.[0] || null : null,
            });
          }
        })();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [supabase, userId]);

  const submitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserId || !worker) return;
    if (currentUserId === userId) {
      alert('You cannot review yourself.');
      return;
    }
    setReviewSubmitting(true);
    try {
      const { error } = await supabase
        .from('reviews')
        .insert({
          task_id: null,
          reviewer_id: currentUserId,
          reviewee_id: userId,
          rating: reviewRating,
          comment: reviewComment.trim() || null,
          created_at: new Date().toISOString()
        });
      if (error) throw error;
      setReviewComment('');
      setReviewRating(5);
      // refresh reviews
      const { data: revs } = await supabase
        .from("reviews")
        .select("id, rating, comment, created_at, reviewer_id")
        .eq("reviewee_id", userId)
        .order("created_at", { ascending: false })
        .limit(5);
      setReviews((revs || []) as any);
      if (revs && revs.length > 0) {
        const avg = (revs.reduce((s: number, r: any) => s + (r.rating || 0), 0) / revs.length);
        setAvgRating(Number(avg.toFixed(2)));
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to submit review');
    } finally {
      setReviewSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[100svh] bg-background">
        <Navbar />
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!worker) {
    return (
      <div className="min-h-[100svh] bg-background">
        <Navbar />
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="bg-white rounded-lg shadow-md p-6 text-center">
            <h1 className="text-xl font-semibold text-gray-900 mb-2">Worker portfolio not found</h1>
            <p className="text-gray-600 mb-4">This worker has not published a portfolio yet.</p>
            <button onClick={() => router.back()} className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50">Go Back</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100svh] bg-background">
      <Navbar />
      <div className="max-w-sm sm:max-w-md md:max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Card container mimicking the mock */}
        <div className="relative rounded-[28px] shadow-lg overflow-hidden bg-white border border-gray-200 md:border-0 md:bg-[rgb(var(--color-card))] md:shadow-sm">
          {/* Header area */}
          <div className="p-5 pb-20">
            <div className="flex items-center justify-between text-gray-500">
              <button onClick={() => router.back()} aria-label="Back" className="p-2 hover:bg-gray-100 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                  <path d="M10.828 12l4.95-4.95a.75.75 0 10-1.06-1.06l-5.48 5.47a.75.75 0 000 1.06l5.48 5.48a.75.75 0 101.06-1.06L10.828 12z" />
                </svg>
              </button>
              <button aria-label="More" className="p-2 hover:bg-gray-100 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                  <path d="M5 12a2 2 0 114 0 2 2 0 01-4 0zm5 0a2 2 0 114 0 2 2 0 01-4 0zm7-2a2 2 0 100 4 2 2 0 000-4z" />
                </svg>
              </button>
            </div>

            {/* Avatar */}
            <div className="mt-2 flex justify-center">
              <div className="h-24 w-24 rounded-full overflow-hidden ring-2 ring-white shadow-md bg-gray-100">
                {profile?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`${profile.avatar_url}${profile.updated_at ? `?t=${encodeURIComponent(profile.updated_at)}` : ''}`} alt={profile?.full_name || "Avatar"} className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center bg-primary/10 text-primary font-bold text-2xl">
                    {(profile?.full_name?.charAt(0) || "W").toUpperCase()}
                  </div>
                )}
              </div>
            </div>

            {/* Name + Title */}
            <div className="mt-4 text-center">
              <div className="text-lg font-semibold text-gray-900">{profile?.full_name || "Worker"}</div>
              <div className="text-sm text-gray-500">{worker?.title || '—'}</div>
            </div>

            {/* Social icons */}
            {(social.behance || social.dribbble || social.linkedin || social.instagram) && (
              <div className="mt-4 flex items-center justify-center gap-3">
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

          {/* Details section (flattened, light) */}
          <div className="bg-white text-gray-900 p-5 pt-6 border-t border-gray-200">
            {/* Skills */}
            {worker.skills && worker.skills.length > 0 && (
              <div className="mb-5">
                <div className="text-sm text-gray-600 mb-2">Skill</div>
                <div className="flex flex-wrap gap-2">
                  {worker.skills.map((s) => (
                    <span key={s} className="px-3 py-2 rounded-xl bg-white text-gray-900 text-sm font-semibold shadow-sm">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Profession / Title */}
            <div className="mb-5">
              <div className="text-sm text-gray-600 mb-1">Profession</div>
              <div className="text-base font-medium border-b border-gray-200 pb-2">{worker?.title || '—'}</div>
            </div>

            {/* Experience placeholder based on past jobs */}
            <div>
              <div className="text-sm text-gray-600 mb-2">Experience</div>
              {pastJobs.length > 0 ? (
                <div className="space-y-2">
                  {pastJobs.map((t) => (
                    <div key={t.id} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-100 border border-gray-200 text-gray-800 text-sm">
                      <span className="font-medium">{t.title}</span>
                      <span className="text-gray-500">{new Date(t.created_at).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-gray-500 text-sm">No experience listed.</div>
              )}
            </div>

            {/* Contact and location */}
            <div className="mt-6 flex flex-wrap gap-2">
              <button
                onClick={() => profile?.id ? (window.location.href = `/messages/${profile.id}`) : undefined}
                className="btn-primary"
              >
                Contact
              </button>
              {worker.location && (
                <div className="ml-auto flex items-center text-sm text-gray-600">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>{worker.location}</span>
                </div>
              )}
            </div>
          </div>

          {/* Details below dark section */}
          {worker.bio && (
            <div className="px-5 py-4 bg-white">
              <h2 className="text-sm font-medium text-gray-700 mb-1">About</h2>
              <p className="text-gray-800 text-sm whitespace-pre-line">{worker.bio}</p>
            </div>
          )}

          {/* Reviews */}
          <div className="px-5 py-5">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-medium text-gray-700">Reviews</h2>
              {typeof avgRating === 'number' && (
                <div className="text-sm text-gray-800">Avg rating: <span className="font-semibold">{avgRating}</span></div>
              )}
            </div>
            {reviews.length > 0 ? (
              <div className="space-y-3">
                {reviews.map((r) => (
                  <div key={r.id} className="border border-gray-100 rounded-md p-3">
                    <div className="text-sm font-medium text-gray-900">Rating: {r.rating}/5</div>
                    {r.comment && <div className="text-sm text-gray-700 mt-1">{r.comment}</div>}
                    <div className="text-xs text-gray-500 mt-1">{new Date(r.created_at).toLocaleDateString()}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-gray-500">No reviews yet.</div>
            )}

            {/* Leave a review form (visible if logged in and not own profile) */}
            {currentUserId && currentUserId !== userId && (
              <form onSubmit={submitReview} className="mt-4 border border-gray-100 rounded-md p-3">
                <div className="flex items-center gap-3">
                  <label className="text-sm text-gray-700">Rating</label>
                  <select
                    value={reviewRating}
                    onChange={(e) => setReviewRating(parseInt(e.target.value))}
                    className="border border-gray-300 rounded-md px-2 py-1 text-sm"
                  >
                    {[5,4,3,2,1].map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
                <textarea
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Write a short comment (optional)"
                  rows={3}
                  className="mt-2 w-full input-field"
                />
                <div className="mt-2 flex justify-end">
                  <button type="submit" className="btn-primary" disabled={reviewSubmitting}>
                    {reviewSubmitting ? 'Submitting...' : 'Leave a review'}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Past Jobs */}
          <div className="px-5 pb-6">
            <h2 className="text-sm font-medium text-gray-700 mb-2">Past Jobs</h2>
            {pastJobs.length > 0 ? (
              <div className="space-y-2">
                {pastJobs.map((t) => (
                  <div key={t.id} className="border border-gray-100 rounded-md p-3">
                    <div className="text-sm font-medium text-gray-900">{t.title}</div>
                    <div className="text-xs text-gray-600">{t.location}</div>
                    <div className="text-xs text-gray-500 mt-1">{new Date(t.created_at).toLocaleDateString()}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-gray-500">No past jobs yet.</div>
            )}
          </div>

          <div className="px-5 pb-5">
            <button onClick={() => router.back()} className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50">Back</button>
          </div>
        </div>
      </div>
    </div>
  );
}

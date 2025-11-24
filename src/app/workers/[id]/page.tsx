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
  portfolio_images?: any[];
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
  const [pastJobs, setPastJobs] = useState<Array<{ id: string; title: string; location: string; created_at: string }>>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState<number>(5);
  const [reviewComment, setReviewComment] = useState<string>('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviews, setReviews] = useState<Array<{ id: string; rating: number; comment: string | null; created_at: string; reviewer_id: string }>>([]);
  const [avgRating, setAvgRating] = useState<number | null>(null);
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
          .order("created_at", { ascending: false });
        if (revs) {
          setReviews(revs);
          if (revs.length > 0) {
            const avg = revs.reduce((sum, r) => sum + r.rating, 0) / revs.length;
            setAvgRating(Number(avg.toFixed(1)));
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
          } else {
            setSocial({});
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
          } else {
            setSocial({});
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
        const avgFixed = Number(avg.toFixed(2));
        setAvgRating(avgFixed);
        // Attempt to persist rating on worker_profiles so discovery cards reflect it
        // This may be blocked by RLS if the reviewer is not allowed to update the worker's profile; ignore errors
        try {
          await supabase
            .from('worker_profiles')
            .update({ rating: avgFixed, updated_at: new Date().toISOString() })
            .eq('user_id', userId);
        } catch (_) { }
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
    <div className="min-h-[100svh] bg-slate-50">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-20 pb-24 md:pb-8">
        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="mb-4 inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 font-medium transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back
        </button>

        {/* Main Profile Card */}
        <div className="bg-white rounded-[32px] shadow-2xl border border-slate-200 overflow-hidden mb-6">
          {/* Header with Gradient Background */}
          <div className="relative bg-gradient-to-br from-slate-800 via-slate-700 to-slate-900 pt-12 pb-24 px-6">
            {/* Avatar - Large and Centered */}
            <div className="flex justify-center mb-4">
              <div className="h-32 w-32 rounded-full overflow-hidden bg-white ring-4 ring-white/20 shadow-2xl">
                {profile?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`${profile.avatar_url}${profile.updated_at ? `?t=${encodeURIComponent(profile.updated_at)}` : ''}`}
                    alt={profile?.full_name || 'Avatar'}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/10 text-primary font-bold text-4xl">
                    {(profile?.full_name?.charAt(0) || 'W').toUpperCase()}
                  </div>
                )}
              </div>
            </div>

            {/* Name & Title */}
            <div className="text-center">
              <h1 className="text-3xl font-bold text-white mb-2">
                {profile?.full_name || 'Worker'}
              </h1>
              <p className="text-lg text-slate-300 font-medium mb-4">
                {worker?.title || 'Professional'}
              </p>

              {/* Rating Badge */}
              {typeof avgRating === 'number' && avgRating > 0 ? (
                <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full border border-white/20">
                  <div className="flex items-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <svg
                        key={i}
                        xmlns="http://www.w3.org/2000/svg"
                        className={`h-5 w-5 ${i < Math.floor(avgRating) ? 'text-yellow-400' : 'text-slate-400'}`}
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                  <span className="text-white font-bold">{avgRating.toFixed(1)}</span>
                  <span className="text-slate-300 text-sm">({reviews.length} {reviews.length === 1 ? 'review' : 'reviews'})</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full border border-white/20">
                  <span className="text-slate-300 text-sm">No reviews yet</span>
                </div>
              )}

              {/* Social Links */}
              {(social.behance || social.dribbble || social.linkedin || social.instagram) && (
                <div className="mt-6 flex items-center justify-center gap-3">
                  {social.behance && (
                    <Link href={social.behance} target="_blank" className="p-3 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 text-white transition-all hover:scale-110">
                      <BsBehance className="h-5 w-5" />
                    </Link>
                  )}
                  {social.dribbble && (
                    <Link href={social.dribbble} target="_blank" className="p-3 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 text-white transition-all hover:scale-110">
                      <BsDribbble className="h-5 w-5" />
                    </Link>
                  )}
                  {social.linkedin && (
                    <Link href={social.linkedin} target="_blank" className="p-3 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 text-white transition-all hover:scale-110">
                      <BsLinkedin className="h-5 w-5" />
                    </Link>
                  )}
                  {social.instagram && (
                    <Link href={social.instagram} target="_blank" className="p-3 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 text-white transition-all hover:scale-110">
                      <BsInstagram className="h-5 w-5" />
                    </Link>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Content Section */}
          <div className="px-6 py-6 sm:px-8 sm:py-8">
            {/* Location & Contact */}
            <div className="flex flex-wrap items-center justify-center gap-3 mb-8 pb-6 border-b border-slate-100">
              {worker.location && (
                <div className="flex items-center gap-2 text-slate-600 bg-slate-50 px-4 py-2 rounded-full">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="font-medium">{worker.location}</span>
                </div>
              )}
              <button
                onClick={() => userId ? router.push(`/messages/${userId}`) : undefined}
                className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-2.5 rounded-full font-semibold text-sm transition-all shadow-lg shadow-slate-900/20 hover:shadow-xl hover:scale-105"
              >
                Contact Worker
              </button>
            </div>

            {/* About Section */}
            {worker.bio && (
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <h2 className="text-lg font-bold text-slate-900">About</h2>
                </div>
                <p className="text-slate-600 leading-relaxed whitespace-pre-line">{worker.bio}</p>
              </div>
            )}

            {/* Skills Section */}
            {worker.skills && worker.skills.length > 0 && (
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                  </svg>
                  <h2 className="text-lg font-bold text-slate-900">Skills</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  {worker.skills.map((skill) => (
                    <span
                      key={skill}
                      className="px-4 py-2 rounded-full text-sm font-semibold bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 border border-blue-200"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Portfolio Gallery - Past Jobs */}
            {worker.portfolio_images && Array.isArray(worker.portfolio_images) && worker.portfolio_images.length > 0 && (
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <h2 className="text-lg font-bold text-slate-900">Past Jobs</h2>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {worker.portfolio_images.map((item: any, index: number) => (
                    <div key={index} className="group relative">
                      <div className="aspect-square rounded-lg overflow-hidden bg-gray-100 shadow-sm border border-slate-200">
                        <img
                          src={item.image}
                          alt={item.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                      </div>
                      <p className="mt-2 text-sm font-medium text-gray-900">{item.title}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reviews Section */}
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
                <h2 className="text-lg font-bold text-slate-900">Reviews</h2>
              </div>

              {reviews.length > 0 ? (
                <div className="space-y-4">
                  {reviews.map((review) => (
                    <div key={review.id} className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1">
                          {[...Array(5)].map((_, i) => (
                            <svg
                              key={i}
                              xmlns="http://www.w3.org/2000/svg"
                              className={`h-4 w-4 ${i < review.rating ? 'text-yellow-400' : 'text-slate-300'}`}
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                          ))}
                          <span className="ml-2 font-bold text-slate-900">{review.rating}/5</span>
                        </div>
                        <span className="text-xs text-slate-500">{new Date(review.created_at).toLocaleDateString()}</span>
                      </div>
                      {review.comment && (
                        <p className="text-sm text-slate-600 leading-relaxed">{review.comment}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 bg-slate-50 rounded-2xl border border-slate-200">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-slate-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                  <p className="text-sm text-slate-500">No reviews yet</p>
                </div>
              )}

              {/* Leave Review Form */}
              {currentUserId && currentUserId !== userId && (
                <form onSubmit={submitReview} className="mt-6 bg-slate-50 rounded-2xl p-5 border border-slate-200">
                  <h3 className="font-semibold text-slate-900 mb-4">Leave a Review</h3>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-700 mb-2">Rating</label>
                    <div className="flex gap-2">
                      {[5, 4, 3, 2, 1].map((rating) => (
                        <button
                          key={rating}
                          type="button"
                          onClick={() => setReviewRating(rating)}
                          className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${reviewRating === rating
                            ? 'bg-slate-900 text-white shadow-lg'
                            : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
                            }`}
                        >
                          {rating}★
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-700 mb-2">Comment (optional)</label>
                    <textarea
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      placeholder="Share your experience..."
                      rows={3}
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-500 resize-none"
                      style={{ wordWrap: 'break-word', overflowWrap: 'break-word' }}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={reviewSubmitting}
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-xl font-semibold transition-all shadow-lg shadow-slate-900/20 hover:shadow-xl disabled:opacity-50"
                  >
                    {reviewSubmitting ? 'Submitting...' : 'Submit Review'}
                  </button>
                </form>
              )}
            </div>

            {/* Past Jobs Section */}
            {pastJobs.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <h2 className="text-lg font-bold text-slate-900">Past Jobs</h2>
                </div>
                <div className="space-y-3">
                  {pastJobs.map((job) => (
                    <div key={job.id} className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
                      <h3 className="font-semibold text-slate-900 mb-1">{job.title}</h3>
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span>{job.location}</span>
                        <span className="text-slate-400">•</span>
                        <span>{new Date(job.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

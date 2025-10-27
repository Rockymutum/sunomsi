"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import Navbar from "@/components/layout/Navbar";

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
  const [profile, setProfile] = useState<{ id?: string; full_name?: string; avatar_url?: string } | null>(null);
  const [reviews, setReviews] = useState<Array<{ id: string; rating: number; comment: string; created_at: string; reviewer_id: string }>>([]);
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [pastJobs, setPastJobs] = useState<Array<{ id: string; title: string; location: string; created_at: string }>>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState<number>(5);
  const [reviewComment, setReviewComment] = useState<string>('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

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
          .select("id, full_name, avatar_url")
          .eq("user_id", userId)
          .maybeSingle();
        setProfile(p || null);

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
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full overflow-hidden bg-gray-100 flex-shrink-0">
              {profile?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatar_url} alt={profile?.full_name || "Avatar"} className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full flex items-center justify-center bg-primary/10 text-primary font-bold text-xl">
                  {(profile?.full_name?.charAt(0) || "W").toUpperCase()}
                </div>
              )}
            </div>
            <div>
              <div className="text-lg font-semibold text-gray-900">{profile?.full_name || "Worker"}</div>
              {typeof worker.rating === "number" && (
                <div className="text-sm text-gray-600">Rating: {worker.rating?.toFixed(1)}</div>
              )}
            </div>
          </div>

          {worker.title && (
            <div className="mt-4 text-base font-semibold text-gray-900">{worker.title}</div>
          )}

          {worker.location && (
            <div className="mt-1 flex items-center text-sm text-gray-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>{worker.location}</span>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={() => profile?.id ? (window.location.href = `/messages/${profile.id}`) : undefined}
              className="btn-primary"
            >
              Contact
            </button>
          </div>

          {worker.bio && (
            <div className="mt-4">
              <h2 className="text-sm font-medium text-gray-700 mb-1">About</h2>
              <p className="text-gray-800 text-sm whitespace-pre-line">{worker.bio}</p>
            </div>
          )}

          {worker.skills && worker.skills.length > 0 && (
            <div className="mt-4">
              <h2 className="text-sm font-medium text-gray-700 mb-2">Skills</h2>
              <div className="flex flex-wrap gap-2">
                {worker.skills.map((s) => (
                  <span key={s} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Reviews */}
          <div className="mt-6">
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
          <div className="mt-6">
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

          <div className="mt-6">
            <button onClick={() => router.back()} className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50">Back</button>
          </div>
        </div>
      </div>
    </div>
  );
}

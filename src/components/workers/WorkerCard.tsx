"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { WorkerProfile } from '@/lib/supabase';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

interface ExtendedWorkerProfile extends WorkerProfile {
  profiles?: {
    full_name?: string;
    avatar_url?: string;
    updated_at?: string;
  } | null;
  average_rating?: number;
  review_count?: number;
}

interface WorkerCardProps {
  worker: ExtendedWorkerProfile;
}

export default function WorkerCard({ worker }: WorkerCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<{ full_name?: string; avatar_url?: string; updated_at?: string } | null>(null);
  const supabase = createClientComponentClient();

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUserId(session?.user?.id ?? null);

      // Fetch user profile data
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, avatar_url, updated_at')
        .eq('user_id', worker.user_id)
        .maybeSingle();

      setUserProfile(profile);
    })();
  }, [supabase, worker.user_id]);

  const canDelete = userId && worker?.user_id === userId;
  const rawAverage = typeof (worker as any).average_rating === 'number' ? (worker as any).average_rating : Number((worker as any).rating ?? 0) || 0;
  const averageRating = Number.isFinite(rawAverage) ? Number(rawAverage.toFixed(1)) : 0;
  const reviewCount = typeof (worker as any).review_count === 'number' && (worker as any).review_count > 0
    ? (worker as any).review_count
    : (averageRating > 0 ? 1 : 0);

  const handleDelete = async () => {
    if (!canDelete || deleting) return;
    const ok = window.confirm('Delete this portfolio? This action cannot be undone.');
    if (!ok) return;
    setDeleting(true);

    const { error } = await supabase
      .from('worker_profiles')
      .delete()
      .eq('user_id', worker.user_id);

    if (error) {
      alert(error.message || 'Failed to delete portfolio');
    }

    setDeleting(false);
    if (!error) {
      setHidden(true);
    }
  };

  // Generate star rating display
  const renderStars = (rating: number) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;

    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(
          <svg key={i} xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        );
      } else if (i === fullStars && hasHalfStar) {
        stars.push(
          <svg key={i} xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        );
      } else {
        stars.push(
          <svg key={i} xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-300" viewBox="0 0 20 20" fill="currentColor">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        );
      }
    }

    return <div className="flex">{stars}</div>;
  };

  if (hidden) return null;

  return (
    <div
      className="bg-white rounded-[28px] shadow-xl border border-slate-200 overflow-hidden transition-all hover:shadow-2xl hover:scale-[1.02] mb-6"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Header Section with Avatar */}
      <div className="relative bg-gradient-to-br from-slate-50 to-slate-100 pt-8 pb-6 px-6">
        {/* Avatar - Large and Centered */}
        <Link href={`/profile/${worker.user_id}`} className="flex flex-col items-center">
          <div className="h-24 w-24 rounded-full overflow-hidden bg-white ring-4 ring-white shadow-lg mb-3">
            {userProfile?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`${userProfile.avatar_url}${userProfile.updated_at ? `?t=${encodeURIComponent(userProfile.updated_at)}` : ''}`}
                alt={userProfile.full_name || 'Avatar'}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/10 text-primary font-bold text-3xl">
                {(userProfile?.full_name?.charAt(0) || 'W').toUpperCase()}
              </div>
            )}
          </div>

          {/* Name */}
          <h3 className="text-xl font-bold text-slate-900 hover:underline text-center mb-1">
            {userProfile?.full_name || 'Worker'}
          </h3>

          {/* Title/Role */}
          {(worker as any).title && (
            <p className="text-sm font-medium text-slate-600 text-center mb-2">
              {(worker as any).title}
            </p>
          )}

          {/* Rating Badge */}
          {averageRating > 0 ? (
            <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-full shadow-sm border border-slate-200">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <span className="text-sm font-bold text-slate-900">{averageRating.toFixed(1)}</span>
              <span className="text-xs text-slate-500">({reviewCount})</span>
            </div>
          ) : (
            <div className="bg-white px-3 py-1.5 rounded-full shadow-sm border border-slate-200">
              <span className="text-xs text-slate-500">New worker</span>
            </div>
          )}
        </Link>
      </div>

      {/* Content Section */}
      <div className="px-6 py-5">
        {/* Location */}
        {worker.location && (
          <div className="flex items-center justify-center gap-1.5 text-sm text-slate-600 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="font-medium">{worker.location}</span>
          </div>
        )}

        {/* Bio */}
        {worker.bio && (
          <div className="mb-4">
            <p className="text-slate-600 text-sm leading-relaxed line-clamp-3 text-center">
              {worker.bio}
            </p>
          </div>
        )}

        {/* Skills */}
        {worker.skills && worker.skills.length > 0 && (
          <div className="mb-5">
            <div className="flex items-center justify-center gap-1.5 mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Skills</h4>
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              {worker.skills.slice(0, 6).map((skill, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 border border-blue-200"
                >
                  {skill}
                </span>
              ))}
              {worker.skills.length > 6 && (
                <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                  +{worker.skills.length - 6} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-4 border-t border-slate-100">
          <Link
            href={`/workers/${worker.user_id}`}
            className="flex-1 bg-slate-900 hover:bg-slate-800 text-white px-4 py-3 rounded-xl font-semibold text-sm transition-all shadow-lg shadow-slate-900/20 hover:shadow-xl hover:scale-105 text-center"
          >
            View Profile
          </Link>
          {canDelete && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="px-4 py-3 rounded-xl font-semibold text-sm border-2 border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
              title="Delete portfolio"
            >
              {deleting ? (
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
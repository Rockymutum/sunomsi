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
      className="bg-white rounded-[28px] shadow-xl border border-slate-200 overflow-hidden transition-shadow hover:shadow-2xl mb-6 card-interactive"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="p-6 sm:p-8">
        <Link href={`/profile/${worker.user_id}`} className="flex items-center gap-3 mb-4">
          <div className="h-14 w-14 rounded-full overflow-hidden bg-gray-100 ring-1 ring-gray-200 flex-shrink-0">
            {userProfile?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`${userProfile.avatar_url}${userProfile.updated_at ? `?t=${encodeURIComponent(userProfile.updated_at)}` : ''}`}
                alt={userProfile.full_name || 'Avatar'}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center bg-primary/10 text-primary font-bold">
                {(userProfile?.full_name?.charAt(0) || 'W').toUpperCase()}
              </div>
            )}
          </div>
          <div>
            <div className="font-medium text-gray-900 hover:underline">
              {userProfile?.full_name || 'Worker'}
            </div>
            <div className="flex items-center mt-0.5">
              {renderStars(averageRating)}
              {reviewCount > 0 ? (
                <span className="ml-1 text-[12px] text-gray-600">
                  {averageRating.toFixed(1)} · {reviewCount} {reviewCount === 1 ? 'review' : 'reviews'}
                </span>
              ) : (
                <span className="ml-1 text-[12px] text-gray-500">No reviews yet</span>
              )}
            </div>
          </div>
        </Link>
        {(worker as any).title && (
          <div className="text-sm font-medium text-gray-900 mb-2">{(worker as any).title}</div>
        )}

        {worker.location && (
          <div className="flex items-center text-sm text-gray-500 mb-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>{worker.location}</span>
          </div>
        )}

        {worker.bio && (
          <p className="text-gray-600 text-sm mb-4 line-clamp-2">{worker.bio}</p>
        )}

        {worker.skills && worker.skills.length > 0 && (
          <div className="mb-4">
            <h4 className="text-xs font-medium text-gray-500 mb-2">SKILLS</h4>
            <div className="flex flex-wrap gap-1">
              {worker.skills.map((skill, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <Link href={`/workers/${worker.user_id}`} className="btn-primary flex-1 text-center">
            View Profile
          </Link>
          {canDelete && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="btn-secondary-compact border-red-300 text-red-700 hover:bg-red-50"
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
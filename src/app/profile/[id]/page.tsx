"use client";

import { useEffect, useState } from 'react';
import Navbar from '@/components/layout/Navbar';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function ProfilePage({ params }: { params: { id: string } }) {
  const { id } = params;
  const supabase = createClientComponentClient();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', id)
        .maybeSingle();
      setProfile(data || null);
      setLoading(false);
    };
    load();
  }, [id, supabase]);

  return (
    <div className="min-h-[100svh] bg-background">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : !profile ? (
          <div className="text-center text-gray-600">Profile not found.</div>
        ) : (
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full overflow-hidden bg-gray-100">
                {profile.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.avatar_url} alt="Avatar" className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-gray-400 text-sm">No avatar</div>
                )}
              </div>
              <div>
                <div className="text-lg font-semibold text-gray-900">{profile.full_name || 'User'}</div>
                
                {profile.created_at && (
                  <div className="text-xs text-gray-500">Joined: {new Date(profile.created_at).toLocaleDateString()}</div>
                )}
              </div>
            </div>

            <div className="mt-6 grid gap-4">
              <div>
                <div className="text-sm font-medium text-gray-700">Bio</div>
                <div className="text-gray-800 text-sm whitespace-pre-line">{profile.bio || '—'}</div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium text-gray-700">Place</div>
                  <div className="text-gray-800 text-sm">{profile.place || '—'}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-700">Contact</div>
                  <div className="text-gray-800 text-sm">{profile.contact || profile.email || '—'}</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

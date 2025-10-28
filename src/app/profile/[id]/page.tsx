"use client";

import { useEffect, useState } from 'react';
import Navbar from '@/components/layout/Navbar';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import PageShell from '@/components/ui/PageShell';

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
      <div className="max-w-sm sm:max-w-md md:max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : !profile ? (
          <div className="text-center text-gray-600">Profile not found.</div>
        ) : (
          <PageShell
            header={(
              <div className="mt-2 flex flex-col items-center">
                <div className="h-24 w-24 rounded-full overflow-hidden ring-2 ring-white shadow-md bg-gray-100">
                  {profile.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={profile.avatar_url} alt={profile.full_name || 'Avatar'} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center bg-primary/10 text-primary font-bold text-2xl">
                      {(profile.full_name?.charAt(0) || 'U').toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="mt-4 text-center">
                  <div className="text-lg font-semibold text-gray-900">{profile.full_name || 'User'}</div>
                  {profile.created_at && (
                    <div className="text-xs text-gray-500">Joined: {new Date(profile.created_at).toLocaleDateString()}</div>
                  )}
                </div>
              </div>
            )}
            darkSection={(
              <div className="space-y-5">
                <div>
                  <div className="text-sm text-gray-600 mb-1">Place</div>
                  <div className="text-base font-medium border-b border-gray-200 pb-2">{profile.place || '—'}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 mb-1">Contact</div>
                  <div className="text-base font-medium border-b border-gray-200 pb-2">{profile.contact || profile.email || '—'}</div>
                </div>
              </div>
            )}
          >
            {profile.bio && (
              <div className="px-5 py-4 bg-white">
                <h2 className="text-sm font-medium text-gray-700 mb-1">About</h2>
                <p className="text-gray-800 text-sm whitespace-pre-line">{profile.bio}</p>
              </div>
            )}
          </PageShell>
        )}
      </div>
    </div>
  );
}

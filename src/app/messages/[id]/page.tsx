'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient, User } from '@supabase/auth-helpers-nextjs';
import dynamic from 'next/dynamic';

const NewChatWindow = dynamic<{
  otherUserId: string;
  otherUserName: string;
  onClose: () => void;
  className?: string;
}>(() => import('@/components/chat/NewChatWindow'), { ssr: false });

export default function DirectMessagePage({ params }: { params: { id: string } }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [otherUser, setOtherUser] = useState<{ id: string; full_name: string; avatar_url?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClientComponentClient();
  const router = useRouter();

  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
      return user;
    };

    const getOtherUser = async (id: string) => {
      try {
        // First try to find by user_id
        let { data, error } = await supabase
          .from('profiles')
          .select('id, user_id, full_name, avatar_url')
          .eq('user_id', id)
          .maybeSingle();

        // If not found by user_id, try by id
        if (!data) {
          const retry = await supabase
            .from('profiles')
            .select('id, user_id, full_name, avatar_url')
            .eq('id', id)
            .maybeSingle();

          if (retry.error) {
            console.error('Error fetching user:', retry.error);
            return null;
          }
          data = retry.data;
        }

        return data;
      } catch (error) {
        console.error('Error in getOtherUser:', error);
        return null;
      }
    };

    const initialize = async () => {
      try {
        const user = await getCurrentUser();
        if (!user) {
          router.push('/login');
          return;
        }

        let otherUserData = await getOtherUser(params.id);

        // If user doesn't have a profile, use a fallback
        if (!otherUserData) {
          otherUserData = {
            id: params.id,
            user_id: params.id,
            full_name: 'User',
            avatar_url: undefined
          };
        }

        setOtherUser(otherUserData);
      } catch (error) {
        console.error('Error initializing chat:', error);
      } finally {
        setLoading(false);
      }
    };

    initialize();
  }, [params.id, router]);

  if (loading) {
    return (
      <div className="min-h-[100svh] bg-background">
        <div className="flex justify-center items-center h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    router.push('/auth');
    return null;
  }

  if (!otherUser) {
    return (
      <div className="min-h-[100svh] bg-background flex flex-col items-center justify-center p-4">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">User not found</h2>
          <p className="text-gray-600 mb-4">The user you're trying to message doesn't exist or you don't have permission to view this conversation.</p>
          <button
            onClick={() => router.push('/messages')}
            className="btn-primary"
          >
            Back to Messages
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-white">
      <NewChatWindow
        key={otherUser.id}
        otherUserId={otherUser.id}
        otherUserName={otherUser.full_name || 'User'}
        onClose={() => router.push('/messages')}
        className="h-full"
      />
    </div>
  );
}
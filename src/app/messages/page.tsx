"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import Navbar from '@/components/layout/Navbar';
import { formatDistanceToNow } from '@/utils/dateUtils';

export default function MessagesPage() {
  const router = useRouter();
  const supabase = createClientComponentClient();

  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const fetchConversations = async () => {
      setLoading(true);

      try {
        // Check authentication status
        const { data: { session } } = await supabase.auth.getSession();
        const currentUserId = session?.user?.id;

        if (!currentUserId) {
          router.push('/auth');
          return;
        }

        setUserId(currentUserId);

        // Get all conversations where the user is either sender or receiver
        const { data: messagesData, error: messagesError } = await supabase
          .from('messages')
          .select(`
            id,
            sender_id,
            receiver_id,
            created_at,
            content,
            read
          `)
          .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`)
          .order('created_at', { ascending: false });

        if (messagesError) throw messagesError;

        // Process conversations
        const conversationMap = new Map();

        for (const message of messagesData || []) {
          const partnerId = message.sender_id === currentUserId ? message.receiver_id : message.sender_id;

          if (!conversationMap.has(partnerId)) {
            // Get partner's profile
            const { data: profile } = await supabase
              .from('profiles')
              .select('full_name, avatar_url')
              .eq('user_id', partnerId)
              .maybeSingle();

            conversationMap.set(partnerId, {
              partnerId,
              partnerName: profile?.full_name || 'Unknown User',
              partnerAvatar: profile?.avatar_url,
              lastMessage: message.content,
              lastMessageTime: message.created_at,
              unread: message.receiver_id === currentUserId && !message.read ? 1 : 0
            });
          }
        }

        setConversations(Array.from(conversationMap.values()));
      } catch (error) {
        console.error('Error fetching conversations:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchConversations();
  }, [router, supabase]);

  if (loading) {
    return (
      <div className="min-h-[100svh] bg-background">
        <Navbar />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 pt-20 pb-24 md:pb-12">
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

      <div className="max-w-2xl mx-auto pt-20 px-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h1 className="text-xl font-bold text-gray-900">Messages</h1>
          </div>

          {conversations.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {conversations.map((conversation) => (
                <div
                  key={conversation.partnerId}
                  onClick={() => router.push(`/messages/${conversation.partnerId}`)}
                  className="group p-3 flex gap-3 cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-100 ring-1 ring-gray-200 flex-shrink-0">
                    {conversation.partnerAvatar ? (
                      <img
                        src={conversation.partnerAvatar}
                        alt={conversation.partnerName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center bg-blue-100 text-blue-600 font-bold text-sm">
                        {conversation.partnerName?.charAt(0)?.toUpperCase() || 'U'}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-2">
                      <p className="text-gray-900 font-medium text-sm leading-snug truncate">
                        {conversation.partnerName || 'Unknown User'}
                      </p>
                      <span className="text-[10px] text-gray-400 whitespace-nowrap flex-shrink-0 mt-0.5">
                        {formatDistanceToNow(new Date(conversation.lastMessageTime))} ago
                      </span>
                    </div>
                    <div className="flex justify-between items-start mt-0.5">
                      <p className="text-gray-600 text-xs line-clamp-1 flex-1 mr-2">
                        {conversation.lastMessage}
                      </p>
                      {conversation.unread > 0 && (
                        <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-blue-600 flex-shrink-0">
                          <span className="text-[10px] font-medium text-white">
                            {conversation.unread}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900">No messages yet</h3>
              <p className="mt-1 text-sm text-gray-500">
                When you connect with other users, your conversations will appear here.
              </p>
              <button
                onClick={() => router.push('/discovery')}
                className="mt-4 px-4 py-2 bg-slate-800 text-white rounded-md hover:bg-slate-900 transition-colors"
              >
                Browse Tasks
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
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
      
      if (messagesError) {
        console.error('Error fetching messages:', messagesError);
        setLoading(false);
        return;
      }
      
      // Extract unique conversation partners
      const conversationPartners = new Map();
      
      for (const message of messagesData) {
        const partnerId = message.sender_id === currentUserId ? message.receiver_id : message.sender_id;
        
        if (!conversationPartners.has(partnerId)) {
          conversationPartners.set(partnerId, {
            partnerId,
            lastMessage: message.content,
            lastMessageTime: message.created_at,
            unread: message.sender_id !== currentUserId && message.read === false ? 1 : 0
          });
        }
      }
      
      // Fetch user details for all conversation partners
      const partnerIds = Array.from(conversationPartners.keys());
      
      if (partnerIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', partnerIds);
        
        if (profilesError) {
          console.error('Error fetching profiles:', profilesError);
        } else {
          // Combine conversation data with profile data
          const conversationsWithProfiles = partnerIds.map(partnerId => {
            const conversation = conversationPartners.get(partnerId);
            const profile = profilesData.find((p: any) => p.id === partnerId);
            
            return {
              ...conversation,
              partnerName: profile?.full_name || 'Unknown User',
              partnerAvatar: profile?.avatar_url
            };
          });
          
          setConversations(conversationsWithProfiles);
        }
      }
      
      setLoading(false);
    };
    
    fetchConversations();
  }, [router, supabase]);
  
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
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-4">Messages</h1>
        
        {conversations.length > 0 ? (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <ul className="divide-y divide-gray-200">
              {conversations.map((conversation) => (
                <li 
                  key={conversation.partnerId}
                  onClick={() => router.push(`/messages/${conversation.partnerId}`)}
                  className="hover:bg-gray-50 cursor-pointer"
                >
                  <div className="px-4 py-4 sm:px-6">
                    <div className="flex items-center">
                      <div className="h-10 w-10 rounded-full overflow-hidden bg-gray-100 flex-shrink-0">
                        {conversation.partnerAvatar ? (
                          <img 
                            src={conversation.partnerAvatar} 
                            alt={conversation.partnerName} 
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center bg-primary/10 text-primary font-bold text-sm">
                            {conversation.partnerName.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      
                      <div className="ml-4 flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {conversation.partnerName}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatDistanceToNow(new Date(conversation.lastMessageTime))}
                          </p>
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <p className="text-sm text-gray-500 truncate">
                            {conversation.lastMessage}
                          </p>
                          {conversation.unread > 0 && (
                            <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-primary">
                              <span className="text-xs font-medium text-white">
                                {conversation.unread}
                              </span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md p-6 text-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900">No messages yet</h3>
            <p className="mt-1 text-sm text-gray-500">
              When you connect with other users, your conversations will appear here.
            </p>
            <button 
              onClick={() => router.push('/discovery')}
              className="mt-4 btn-primary"
            >
              Browse Tasks
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
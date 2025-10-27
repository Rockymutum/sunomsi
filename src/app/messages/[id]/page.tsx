"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import Navbar from '@/components/layout/Navbar';
import { formatTimeAgo } from '@/utils/dateUtils';

interface ConversationParams {
  params: {
    id: string;
  };
}

export default function ConversationPage({ params }: ConversationParams) {
  const { id: partnerId } = params;
  const router = useRouter();
  const supabase = createClientComponentClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [partnerProfile, setPartnerProfile] = useState<any>(null);
  
  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      
      // Check authentication status
      const { data: { session } } = await supabase.auth.getSession();
      const currentUserId = session?.user?.id;
      
      if (!currentUserId) {
        router.push('/auth');
        return;
      }
      
      setUserId(currentUserId);
      
      // Fetch partner profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .eq('id', partnerId)
        .single();
      
      if (profileError) {
        console.error('Error fetching partner profile:', profileError);
        router.push('/messages');
        return;
      }
      
      setPartnerProfile(profileData);
      
      // Fetch messages between current user and partner
      const { data: messagesData, error: messagesError } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${currentUserId})`)
        .order('created_at', { ascending: true });
      
      if (messagesError) {
        console.error('Error fetching messages:', messagesError);
      } else {
        setMessages(messagesData || []);
      }
      
      // Mark messages as read
      const { error: updateError } = await supabase
        .from('messages')
        .update({ read: true })
        .eq('sender_id', partnerId)
        .eq('receiver_id', currentUserId)
        .eq('read', false);
      
      if (updateError) {
        console.error('Error marking messages as read:', updateError);
      }
      
      setLoading(false);
    };
    
    fetchData();
    
    // Set up real-time subscription for new messages
    const channel = supabase
      .channel('messages')
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'messages',
          filter: `or(and(sender_id=eq.${userId},receiver_id=eq.${partnerId}),and(sender_id=eq.${partnerId},receiver_id=eq.${userId}))`
        }, 
        (payload) => {
          const newMessage = payload.new;
          setMessages(prevMessages => [...prevMessages, newMessage]);
          
          // Mark message as read if it's from the partner
          if (newMessage.sender_id === partnerId && newMessage.receiver_id === userId) {
            supabase
              .from('messages')
              .update({ read: true })
              .eq('id', newMessage.id)
              .then(({ error }) => {
                if (error) console.error('Error marking message as read:', error);
              });
          }
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [partnerId, router, supabase, userId]);
  
  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !userId) return;
    
    setSending(true);
    
    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          sender_id: userId,
          receiver_id: partnerId,
          content: newMessage.trim(),
          read: false
        });
      
      if (error) {
        throw error;
      }
      
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };
  
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
      
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="card p-0 overflow-hidden">
          {/* Conversation header */}
          <div className="px-4 py-3 border-b border-gray-200 flex items-center">
            <button 
              onClick={() => router.push('/messages')}
              className="mr-4 text-gray-500 hover:text-gray-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
              </svg>
            </button>
            
            <div className="h-10 w-10 rounded-full overflow-hidden bg-gray-100 ring-1 ring-gray-200 flex-shrink-0">
              {partnerProfile?.avatar_url ? (
                <img 
                  src={partnerProfile.avatar_url} 
                  alt={partnerProfile.full_name} 
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center bg-primary/10 text-primary font-bold text-sm">
                  {partnerProfile?.full_name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-900">
                {partnerProfile?.full_name}
              </p>
              <button 
                onClick={() => router.push(`/profile/${partnerId}`)}
                className="text-xs text-primary hover:opacity-80"
              >
                View Profile
              </button>
            </div>
          </div>
          
          {/* Messages */}
          <div className="p-4 h-[calc(100svh-300px)] overflow-y-auto">
            {messages.length > 0 ? (
              <div className="space-y-4">
                {messages.map((message) => {
                  const isOwnMessage = message.sender_id === userId;
                  
                  return (
                    <div 
                      key={message.id}
                      className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                    >
                      <div 
                        className={`max-w-[70%] rounded-lg px-4 py-2 ${
                          isOwnMessage 
                            ? 'bg-primary text-white rounded-br-none' 
                            : 'bg-gray-100 text-gray-800 rounded-bl-none'
                        }`}
                      >
                        <p className="text-sm">{message.content}</p>
                        <p className={`text-xs mt-1 ${isOwnMessage ? 'text-white/80' : 'text-gray-500'}`}>
                          {formatTimeAgo(message.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <h3 className="text-lg font-medium text-gray-900">No messages yet</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Send a message to start the conversation.
                </p>
              </div>
            )}
          </div>
          
          {/* Message input */}
          <div className="border-t border-gray-200 p-4">
            <form onSubmit={sendMessage} className="flex items-center">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                className="input-field flex-1 py-2"
                disabled={sending}
              />
              <button
                type="submit"
                className="ml-2 btn-primary py-2"
                disabled={!newMessage.trim() || sending}
              >
                {sending ? (
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                  </svg>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
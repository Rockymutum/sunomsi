'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { format, formatDistanceToNow, isToday, isYesterday, isThisYear } from 'date-fns';

export interface NewChatWindowProps {
  otherUserId: string;
  otherUserName: string;
  onClose: () => void;
  className?: string;
}

export default function NewChatWindow({
  otherUserId,
  otherUserName,
  onClose,
  className = ''
}: NewChatWindowProps) {
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const supabase = createClientComponentClient();

  // Scroll to bottom of messages
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Fetch current user and messages
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      try {
        // Get current user
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
          console.error('Error getting current user:', userError || 'No user found');
          setLoading(false);
          return;
        }
        setCurrentUser(user);

        // First, verify the other user exists
        const { data: otherUserData, error: otherUserError } = await supabase
          .from('profiles')
          .select('id, user_id')
          .or(`user_id.eq.${otherUserId},id.eq.${otherUserId}`)
          .single();

        if (otherUserError || !otherUserData) {
          console.error('Error fetching other user:', otherUserError || 'User not found');
          setLoading(false);
          return;
        }

        const { data: messagesData, error: messagesError } = await supabase
          .from('messages')
          .select('*')
          .or(`and(sender_id.eq.${user.id},receiver_id.eq.${otherUserData.user_id || otherUserData.id}),and(sender_id.eq.${otherUserData.user_id || otherUserData.id},receiver_id.eq.${user.id})`)
          .order('created_at', { ascending: true });

        if (messagesError) {
          console.error('Error fetching messages:', messagesError);
          throw messagesError;
        }

        setMessages(messagesData || []);

        // Mark messages as read
        await supabase
          .from('messages')
          .update({ read: true })
          .eq('sender_id', otherUserId)
          .eq('receiver_id', user.id)
          .eq('read', false);

      } catch (error) {
        console.error('Error fetching messages:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [otherUserId, supabase]);

  // Set up real-time subscription for new messages
  useEffect(() => {
    if (!currentUser) return;

    // Function to fetch messages with retry logic
    const fetchMessages = async (attempt = 1) => {
      try {
        const { data: otherUserData, error: otherUserError } = await supabase
          .from('profiles')
          .select('id, user_id')
          .or(`user_id.eq.${otherUserId},id.eq.${otherUserId}`)
          .single();

        if (otherUserError || !otherUserData) {
          throw new Error('Other user not found');
        }

        const otherUserIdToUse = otherUserData.user_id || otherUserData.id;

        const { data: messagesData, error } = await supabase
          .from('messages')
          .select('*')
          .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${otherUserIdToUse}),and(sender_id.eq.${otherUserIdToUse},receiver_id.eq.${currentUser.id})`)
          .order('created_at', { ascending: true });

        if (error) throw error;

        setMessages(messagesData || []);

        // Mark messages as read
        if (messagesData && messagesData.length > 0) {
          const unreadMessages = messagesData.filter(
            msg => msg.sender_id === otherUserIdToUse &&
              msg.receiver_id === currentUser.id &&
              !msg.read
          );

          if (unreadMessages.length > 0) {
            await supabase
              .from('messages')
              .update({ read: true })
              .in('id', unreadMessages.map(msg => msg.id));
          }
        }

      } catch (error) {
        console.error('Error in fetchMessages:', error);
        if (attempt < 3) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
          setTimeout(() => fetchMessages(attempt + 1), delay);
        } else {
          setLoading(false);
        }
      }
    };

    fetchMessages();

    const setupSubscription = async () => {
      try {
        const { data: otherUserData, error: otherUserError } = await supabase
          .from('profiles')
          .select('id, user_id')
          .or(`user_id.eq.${otherUserId},id.eq.${otherUserId}`)
          .single();

        if (otherUserError || !otherUserData) return;

        const otherUserIdToUse = otherUserData.user_id || otherUserData.id;
        const channelName = `messages:${currentUser.id}:${otherUserIdToUse}`;

        const channel = supabase.channel(channelName, {
          config: {
            broadcast: { ack: true },
            presence: { key: channelName }
          }
        });

        channel
          .on('postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'messages'
            },
            (payload) => {
              const newMessage = payload.new;
              const isRelevant =
                (newMessage.sender_id === currentUser.id && newMessage.receiver_id === otherUserIdToUse) ||
                (newMessage.sender_id === otherUserIdToUse && newMessage.receiver_id === currentUser.id);

              if (!isRelevant) return;

              setMessages(prev => {
                if (!prev.some(msg => msg.id === newMessage.id)) {
                  return [...prev, newMessage];
                }
                return prev;
              });

              if (newMessage.sender_id === otherUserIdToUse &&
                newMessage.receiver_id === currentUser.id &&
                !newMessage.read) {
                supabase
                  .from('messages')
                  .update({ read: true })
                  .eq('id', newMessage.id);
              }
            }
          )
          .subscribe((status) => {
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              setTimeout(() => {
                channel.unsubscribe();
                channel.subscribe();
              }, 1000);
            }
          });

        return () => {
          channel.unsubscribe();
        };

      } catch (error) {
        console.error('Error setting up subscription:', error);
      }
    };

    setupSubscription();
  }, [currentUser, otherUserId, supabase]);

  // Group messages by date
  const groupMessagesByDate = useCallback((messages: any[]) => {
    if (!messages || messages.length === 0) return [];

    const grouped: { [key: string]: any[] } = {};

    messages.forEach(message => {
      if (!message?.created_at) return;

      const messageDate = new Date(message.created_at);
      let dateKey = '';

      if (isToday(messageDate)) {
        dateKey = 'Today';
      } else if (isYesterday(messageDate)) {
        dateKey = 'Yesterday';
      } else if (isThisYear(messageDate)) {
        dateKey = format(messageDate, 'MMMM d');
      } else {
        dateKey = format(messageDate, 'MMMM d, yyyy');
      }

      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }

      grouped[dateKey].push(message);
    });

    return Object.entries(grouped).map(([date, messages]) => ({
      date,
      messages: messages.sort((a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )
    }));
  }, []);

  const groupedMessages = groupMessagesByDate(messages);

  const formatMessageTime = (dateString: string) => {
    const date = new Date(dateString);
    return format(date, 'h:mm a');
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    const messageContent = newMessage.trim();
    if (!messageContent || !currentUser) return;

    setSending(true);

    try {
      const { data: otherUserData, error: userError } = await supabase
        .from('profiles')
        .select('id, user_id')
        .or(`user_id.eq.${otherUserId},id.eq.${otherUserId}`)
        .single();

      if (userError || !otherUserData) throw new Error('Recipient not found');

      const otherUserIdToUse = otherUserData.user_id || otherUserData.id;

      const tempId = `temp-${Date.now()}`;
      const tempMessage = {
        id: tempId,
        sender_id: currentUser.id,
        receiver_id: otherUserIdToUse,
        content: messageContent,
        read: false,
        created_at: new Date().toISOString(),
        isSending: true,
        temp: true
      };

      setMessages(prev => [...prev, tempMessage]);
      setNewMessage('');

      const { data, error } = await supabase
        .from('messages')
        .insert({
          sender_id: currentUser.id,
          receiver_id: otherUserIdToUse,
          content: messageContent,
          read: false
        })
        .select()
        .single();

      if (error) {
        setMessages(prev =>
          prev.map(msg =>
            msg.id === tempId
              ? {
                ...msg,
                error: 'Failed to send. Tap to retry.',
                isSending: false,
                retry: () => sendMessage(e)
              }
              : msg
          )
        );
        throw error;
      }

      setMessages(prev =>
        prev.map(msg =>
          msg.id === tempId
            ? {
              ...data,
              isSending: false,
              temp: undefined
            }
            : msg
        )
      );

      scrollToBottom();

    } catch (error: any) {
      console.error('Error in sendMessage:', error);
      if (error.message !== 'Recipient not found') {
        alert('Failed to send message. Please check your connection and try again.');
      }
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className={`flex flex-col h-full bg-white ${className}`}>
        <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse"></div>
            <div className="h-4 w-32 bg-gray-200 rounded animate-pulse"></div>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full bg-[#efeae2] md:pb-0 pb-24 ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 shadow-sm flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          {/* Back Button - Visible only on Mobile */}
          <button
            onClick={onClose}
            className="md:hidden p-2 -ml-2 rounded-full text-gray-600 hover:bg-gray-200 transition-colors"
            aria-label="Back"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold overflow-hidden">
            {otherUserName.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="font-semibold text-gray-900 leading-tight">{otherUserName}</h2>
            <p className="text-xs text-gray-500">
              {messages.length > 0 ? 'Online' : 'Start a conversation'}
            </p>
          </div>
        </div>

        {/* Actions (Video/Call icons could go here) */}
        <div className="flex gap-4 text-primary">
          {/* Placeholder for future actions */}
        </div>
      </div>

      {/* Messages Area - WhatsApp Background */}
      <div
        className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#efeae2]"
        style={{ backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")', backgroundRepeat: 'repeat', backgroundSize: '400px' }}
      >
        {groupedMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6">
            <div className="bg-white/80 backdrop-blur-sm p-4 rounded-xl shadow-sm max-w-xs">
              <p className="text-sm text-gray-600">
                Messages are end-to-end encrypted. No one outside of this chat, not even Sunomsi, can read or listen to them.
              </p>
            </div>
          </div>
        ) : (
          <>
            {groupedMessages.map(({ date, messages: dateMessages }) => (
              <div key={date} className="space-y-4">
                {/* Date header */}
                <div className="flex justify-center my-4">
                  <span className="px-3 py-1 text-xs font-medium text-gray-600 bg-white/90 rounded-lg shadow-sm border border-gray-100">
                    {date}
                  </span>
                </div>

                {/* Messages for this date */}
                <div className="space-y-1">
                  {dateMessages.map((message, index) => {
                    const isCurrentUser = message.sender_id === currentUser?.id;
                    const isLastInGroup = index === dateMessages.length - 1 ||
                      dateMessages[index + 1].sender_id !== message.sender_id;

                    return (
                      <div
                        key={message.id}
                        className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'} group mb-1`}
                      >
                        <div
                          className={`max-w-[85%] sm:max-w-[70%] px-3 py-1.5 rounded-lg relative shadow-sm text-[15px] leading-relaxed ${isCurrentUser
                            ? 'bg-[#d9fdd3] text-gray-900 rounded-tr-none'
                            : 'bg-white text-gray-900 rounded-tl-none'
                            }`}
                        >
                          <p className="whitespace-pre-wrap break-words">{message.content}</p>
                          <div className={`flex justify-end items-center gap-1 mt-0.5 select-none`}>
                            <span className="text-[11px] text-gray-500 min-w-[50px] text-right">
                              {formatMessageTime(message.created_at)}
                            </span>
                            {isCurrentUser && (
                              <span className={`text-[11px] ${message.read ? 'text-blue-500' : 'text-gray-400'}`}>
                                {message.isSending ? '🕒' : '✓✓'}
                              </span>
                            )}
                          </div>

                          {/* Triangle for bubble tail */}
                          {isLastInGroup && (
                            <div className={`absolute top-0 w-0 h-0 border-[6px] border-transparent ${isCurrentUser
                              ? 'right-[-6px] border-t-[#d9fdd3] border-l-[#d9fdd3]'
                              : 'left-[-6px] border-t-white border-r-white'
                              }`}></div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} className="h-2" />
          </>
        )}
      </div>

      {/* Message Input Area */}
      <div className="p-3 bg-gray-50 border-t border-gray-200 flex items-end gap-2">
        <form
          onSubmit={sendMessage}
          className="flex-1 flex items-end gap-2 max-w-4xl mx-auto w-full"
        >
          <div className="flex-1 bg-white rounded-2xl px-4 py-2 border border-gray-200 focus-within:border-gray-300 focus-within:ring-1 focus-within:ring-gray-300 transition-all shadow-sm">
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message"
              className="w-full bg-transparent border-none focus:ring-0 focus:outline-none text-gray-800 placeholder-gray-400 text-[15px] resize-none max-h-[120px] py-1"
              disabled={sending}
              rows={1}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = Math.min(target.scrollHeight, 120) + 'px';
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage(e);
                }
              }}
            />
          </div>
          <button
            type="submit"
            disabled={!newMessage.trim() || sending}
            className={`p-3 rounded-full flex-shrink-0 transition-all duration-200 ${newMessage.trim()
              ? 'bg-[#00a884] hover:bg-[#008f6f] text-white shadow-md transform hover:scale-105'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            aria-label="Send"
          >
            {sending ? (
              <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
              </svg>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

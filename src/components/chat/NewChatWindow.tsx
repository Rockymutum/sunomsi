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

        console.log('Current user ID:', user.id);
        console.log('Other user ID:', otherUserId);
        
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

        console.log('Other user found:', otherUserData);
        
        // Fetch existing messages with detailed logging
        console.log('Fetching messages with query:', {
          sender_id: user.id,
          receiver_id: otherUserData.user_id || otherUserData.id
        });

        const { data: messagesData, error: messagesError } = await supabase
          .from('messages')
          .select('*')
          .or(`and(sender_id.eq.${user.id},receiver_id.eq.${otherUserData.user_id || otherUserData.id}),and(sender_id.eq.${otherUserData.user_id || otherUserData.id},receiver_id.eq.${user.id})`)
          .order('created_at', { ascending: true });

        console.log('Raw query results:', { messagesData, error: messagesError });
        
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
    if (!currentUser) {
      console.log('No current user, skipping subscription setup');
      return;
    }

    console.log('Setting up real-time subscription for user:', currentUser.id, 'with other user ID:', otherUserId);
    
    // Function to fetch messages with retry logic
    const fetchMessages = async (attempt = 1) => {
      try {
        console.log(`[${new Date().toISOString()}] Fetching messages (attempt ${attempt})...`);
        
        // First, verify the other user exists
        const { data: otherUserData, error: otherUserError } = await supabase
          .from('profiles')
          .select('id, user_id')
          .or(`user_id.eq.${otherUserId},id.eq.${otherUserId}`)
          .single();

        if (otherUserError || !otherUserData) {
          console.error('Error fetching other user in subscription:', otherUserError || 'User not found');
          throw new Error('Other user not found');
        }

        const otherUserIdToUse = otherUserData.user_id || otherUserData.id;
        
        // Then fetch messages
        const { data: messagesData, error } = await supabase
          .from('messages')
          .select('*')
          .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${otherUserIdToUse}),and(sender_id.eq.${otherUserIdToUse},receiver_id.eq.${currentUser.id})`)
          .order('created_at', { ascending: true });

        if (error) {
          console.error('Error in subscription message fetch:', error);
          throw error;
        }
        
        console.log(`[${new Date().toISOString()}] Messages fetched:`, messagesData);
        setMessages(messagesData || []);

        // Mark messages as read
        if (messagesData && messagesData.length > 0) {
          const unreadMessages = messagesData.filter(
            msg => msg.sender_id === otherUserIdToUse && 
                  msg.receiver_id === currentUser.id && 
                  !msg.read
          );
          
          if (unreadMessages.length > 0) {
            console.log(`Marking ${unreadMessages.length} messages as read`);
            const { error: updateError } = await supabase
              .from('messages')
              .update({ read: true })
              .in('id', unreadMessages.map(msg => msg.id));
              
            if (updateError) {
              console.error('Error marking messages as read:', updateError);
            }
          }
        }
        
      } catch (error) {
        console.error('Error in fetchMessages:', error);
        
        // Retry with exponential backoff
        if (attempt < 3) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000); // Max 10s delay
          console.log(`Retrying in ${delay}ms...`);
          setTimeout(() => fetchMessages(attempt + 1), delay);
        } else {
          setLoading(false);
        }
      }
    };

    // Initial fetch
    fetchMessages();

    // Set up real-time subscription
    const setupSubscription = async () => {
      try {
        // Get the correct user ID for the other user
        const { data: otherUserData, error: otherUserError } = await supabase
          .from('profiles')
          .select('id, user_id')
          .or(`user_id.eq.${otherUserId},id.eq.${otherUserId}`)
          .single();

        if (otherUserError || !otherUserData) {
          console.error('Error fetching other user for subscription:', otherUserError || 'User not found');
          return;
        }

        const otherUserIdToUse = otherUserData.user_id || otherUserData.id;
        const channelName = `messages:${currentUser.id}:${otherUserIdToUse}`;
        
        console.log(`[${new Date().toISOString()}] Setting up subscription on channel: ${channelName}`);
        
        const channel = supabase.channel(channelName, {
          config: {
            broadcast: { ack: true },
            presence: { key: channelName }
          }
        });

        channel
          .on('broadcast', { event: 'test' }, (payload) => {
            console.log('Received broadcast test:', payload);
          })
          .on('postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'messages',
              filter: `or(and(sender_id=eq.${currentUser.id},receiver_id=eq.${otherUserIdToUse}),and(sender_id=eq.${otherUserIdToUse},receiver_id=eq.${currentUser.id}))`
            },
            (payload) => {
              console.log('New message received via realtime:', payload);
              const newMessage = payload.new;
              
              // Add new message to state if it doesn't exist
              setMessages(prev => {
                if (!prev.some(msg => msg.id === newMessage.id)) {
                  console.log('Adding new message to state:', newMessage);
                  return [...prev, newMessage];
                }
                return prev;
              });

              // Mark as read if it's a received message
              if (newMessage.sender_id === otherUserIdToUse && 
                  newMessage.receiver_id === currentUser.id && 
                  !newMessage.read) {
                console.log('Marking received message as read:', newMessage.id);
                supabase
                  .from('messages')
                  .update({ read: true })
                  .eq('id', newMessage.id)
                  .then(({ error }) => {
                    if (error) {
                      console.error('Error marking message as read:', error);
                    } else {
                      console.log('Successfully marked message as read');
                    }
                  });
              }
            }
          )
          .subscribe((status, err) => {
            console.log(`[${new Date().toISOString()}] Subscription status:`, status);
            if (err) console.error('Subscription error:', err);
            
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              console.log('Reconnecting in 1 second...');
              setTimeout(() => {
                console.log('Attempting to resubscribe...');
                channel.unsubscribe();
                channel.subscribe();
              }, 1000);
            }
          });

        // Send a test broadcast to verify the channel is working
        setTimeout(() => {
          channel.send({
            type: 'broadcast',
            event: 'test',
            payload: { message: 'Test message', timestamp: new Date().toISOString() }
          });
        }, 2000);

        // Clean up subscription on unmount
        return () => {
          console.log(`[${new Date().toISOString()}] Cleaning up subscription`);
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
    
    const grouped: {[key: string]: any[]} = {};
    
    messages.forEach(message => {
      if (!message?.created_at) return;
      
      const messageDate = new Date(message.created_at);
      let dateKey = '';
      
      if (isToday(messageDate)) {
        dateKey = 'Today';
      } else if (isYesterday(messageDate)) {
        dateKey = 'Yesterday';
      } else if (isThisYear(messageDate)) {
        dateKey = format(messageDate, 'MMMM d'); // e.g., "October 15"
      } else {
        dateKey = format(messageDate, 'MMMM d, yyyy'); // e.g., "October 15, 2023"
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
  
  // Format time for message timestamp
  const formatMessageTime = (dateString: string) => {
    const date = new Date(dateString);
    return format(date, 'h:mm a');
  };
  
  // Format relative time (e.g., "2 hours ago")
  const formatRelativeTime = (dateString: string) => {
    return formatDistanceToNow(new Date(dateString), { addSuffix: true });
  };
  
  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const messageContent = newMessage.trim();
    if (!messageContent || !currentUser) {
      console.log('Message content or user is missing');
      return;
    }
    
    console.log('Sending message to', otherUserId, ':', messageContent);
    setSending(true);
    
    try {
      // First, verify the other user exists
      const { data: otherUserData, error: userError } = await supabase
        .from('profiles')
        .select('id, user_id')
        .or(`user_id.eq.${otherUserId},id.eq.${otherUserId}`)
        .single();

      if (userError || !otherUserData) {
        console.error('Error fetching other user:', userError || 'User not found');
        throw new Error('Recipient not found');
      }

      const otherUserIdToUse = otherUserData.user_id || otherUserData.id;
      
      // Create a temporary message with a temporary ID
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
      
      console.log('Adding temporary message:', tempMessage);
      
      // Add the temporary message to the UI immediately
      setMessages(prev => [...prev, tempMessage]);
      setNewMessage('');
    
    // Then send the message to the server
    console.log('Sending message to server...');
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
      console.error('Error from Supabase when sending message:', error);
      // Update the UI to show the message failed to send
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
    
    console.log('Message sent successfully:', data);
    
    // Replace the temporary message with the real one from the server
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
    
    // Scroll to bottom to show the new message
    scrollToBottom();
    
  } catch (error: any) {
    console.error('Error in sendMessage:', error);
    
    // Only show alert if it's not a user-not-found error (already handled in the UI)
    if (error.message !== 'Recipient not found') {
      // Update the last message with error state if it's still a temp message
      setMessages(prev => {
        const lastMsg = prev[prev.length - 1];
        if (lastMsg?.temp) {
          return [
            ...prev.slice(0, -1),
            {
              ...lastMsg,
              error: 'Failed to send. Tap to retry.',
              isSending: false,
              retry: () => sendMessage(e as any)
            }
          ];
        }
        return prev;
      });
      
      alert('Failed to send message. Please check your connection and try again.');
    }
  } finally {
    setSending(false);
  }
};

  if (loading) {
    return (
      <div className={`flex flex-col h-full ${className}`}>
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center">
            <button 
              onClick={onClose}
              className="mr-2 text-gray-500 hover:text-gray-700"
              aria-label="Close"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </button>
            <h2 className="font-medium">{otherUserName}</h2>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center">
          <button 
            onClick={onClose}
            className="mr-2 text-gray-500 hover:text-gray-700"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </button>
          <h2 className="font-medium">{otherUserName}</h2>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {groupedMessages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-center text-gray-500">
            <div>
              <p>No messages yet</p>
              <p className="text-sm mt-1">Send a message to start the conversation</p>
            </div>
          </div>
        ) : (
          <>
            {groupedMessages.map(({ date, messages: dateMessages }) => (
              <div key={date} className="space-y-4">
                {/* Date header */}
                <div className="relative flex items-center justify-center my-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200"></div>
                  </div>
                  <div className="relative px-3 bg-white dark:bg-gray-900 text-xs text-gray-500 dark:text-gray-400 rounded-full border border-gray-200 dark:border-gray-700">
                    {date}
                  </div>
                </div>
                
                {/* Messages for this date */}
                <div className="space-y-4">
                  {dateMessages.map((message, index) => {
                    const isCurrentUser = message.sender_id === currentUser?.id;
                    const showTime = index === dateMessages.length - 1 || 
                      new Date(message.created_at).getTime() - new Date(dateMessages[index + 1]?.created_at).getTime() < -5 * 60 * 1000; // 5 minutes
                    
                    return (
                      <div key={message.id} className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}>
                        <div 
                          className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg relative group ${isCurrentUser 
                            ? `bg-blue-500 text-white rounded-br-none ${message.isSending ? 'opacity-70' : ''} ${message.error ? 'bg-red-100 border border-red-300' : ''}` 
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-bl-none'}`}
                        >
                          <p className="text-sm">{message.content}</p>
                          <div className="flex justify-between items-center mt-1">
                            <span className="text-xs opacity-75">
                              {message.error ? (
                                <span className="text-red-500">Failed to send</span>
                              ) : message.isSending ? (
                                <span className={isCurrentUser ? 'text-blue-200' : 'text-gray-500'}>
                                  Sending...
                                </span>
                              ) : null}
                            </span>
                            <span className="text-xs opacity-75">
                              {formatMessageTime(message.created_at)}
                            </span>
                          </div>
                          
                          {/* Hover timestamp */}
                          <div className="absolute -bottom-5 right-0 text-xs text-gray-500 dark:text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
                            {formatRelativeTime(message.created_at)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Message input */}
      <div className="p-4 border-t border-gray-200">
        <form onSubmit={sendMessage} className="flex items-center">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 border border-gray-300 rounded-l-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={sending}
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || sending}
            className={`px-4 py-2 rounded-r-lg ${newMessage.trim() ? 'bg-blue-500 hover:bg-blue-600' : 'bg-gray-300 cursor-not-allowed'} text-white`}
          >
            {sending ? (
              <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

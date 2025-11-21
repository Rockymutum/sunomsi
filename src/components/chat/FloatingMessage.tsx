'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { X, MessageSquare } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function FloatingMessage() {
  const [messages, setMessages] = useState<any[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [position, setPosition] = useState({ x: 20, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [connectionStatus, setConnectionStatus] = useState<string>('disconnected');
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const messageRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();
  const subscriptionRef = useRef<any>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectDelay = 2000; // 2 seconds

  // Dragging functionality
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!messageRef.current) return;

    const rect = messageRef.current.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
    setIsDragging(true);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;

    setPosition({
      x: e.clientX - dragOffset.x,
      y: e.clientY - dragOffset.y,
    });
  }, [isDragging, dragOffset]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Set up event listeners for dragging
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Handle reconnection logic
  // Set up the subscription with the current user ID
  const setupSubscriptionWithUser = useCallback(async (userId: string) => {
    if (!userId) {
      console.log('No user ID provided for subscription');
      return;
    }

    console.log('Setting up subscription for user:', userId);
    setConnectionStatus('connecting');

    // Clear any existing subscription
    if (subscriptionRef.current) {
      console.log('Removing existing subscription');
      supabase.removeChannel(subscriptionRef.current);
    }

    // Create a new subscription
    const channel = supabase
      .channel(`user_${userId}_messages`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `to_user_id=eq.${userId}`
        },
        (payload) => {
          console.log('New message received:', payload);
          setMessage(payload.new as any);
          setIsVisible(true);

          // Auto-hide after 5 seconds
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
          }
          timeoutRef.current = setTimeout(() => {
            setIsVisible(false);
          }, 5000);
        }
      )
      .subscribe((status: string, err?: Error) => {
        console.log('Subscription status:', status);

        switch (status) {
          case 'SUBSCRIBED':
            setConnectionStatus('connected');
            break;

          case 'CHANNEL_ERROR':
            console.error('Channel error:', err);
            setConnectionStatus('error');
            // Attempt to reconnect
            setTimeout(() => {
              setupSubscriptionWithUser(userId);
            }, 2000);
            break;

          case 'TIMED_OUT':
            console.log('Connection timed out, attempting to reconnect...');
            setConnectionStatus('reconnecting');
            // Try to refresh the session and reconnect
            (async () => {
              try {
                console.log('Attempting to refresh session...');
                const { data, error } = await supabase.auth.refreshSession();
                if (!error && data?.user?.id) {
                  await setupSubscriptionWithUser(data.user.id);
                }
              } catch (refreshError) {
                console.error('Error refreshing session:', refreshError);
                // If refresh fails, try reconnecting with the same user ID
                setTimeout(() => {
                  setupSubscriptionWithUser(userId);
                }, 2000);
              }
            })();
            break;

          case 'CLOSED':
            console.log('Connection closed, attempting to reconnect...');
            setConnectionStatus('reconnecting');
            setTimeout(() => {
              setupSubscriptionWithUser(userId);
            }, 2000);
            break;

          default:
            console.log('Unknown subscription status:', status);
        }
      });

    subscriptionRef.current = channel;
    return channel;
  }, []);

  const reconnectWithBackoff = useCallback(async (userId: string) => {
    if (reconnectAttempts.current >= maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      setConnectionStatus('disconnected');
      return;
    }

    const delay = Math.min(reconnectDelay * Math.pow(2, reconnectAttempts.current), 30000);
    reconnectAttempts.current++;

    console.log(`Attempting to reconnect (attempt ${reconnectAttempts.current}) in ${delay}ms`);

    await new Promise(resolve => setTimeout(resolve, delay));

    try {
      await setupSubscriptionWithUser(userId);
      reconnectAttempts.current = 0; // Reset on successful connection
      setConnectionStatus('connected');
    } catch (error) {
      console.error('Reconnection failed:', error);
      reconnectWithBackoff(userId);
    }
  }, [setupSubscriptionWithUser]);

  // Handle new message subscription
  useEffect(() => {
    console.log('FloatingMessage component mounted');

    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        return session?.user?.id;
      } catch (error) {
        console.error('Error getting session:', error);
        return null;
      }
    };

    // Set up the subscription with the current user ID
    const setupSubscriptionWithUser = async (userId: string) => {
      if (!userId) {
        console.log('No user ID provided for subscription');
        return;
      }

      console.log('Setting up subscription for user:', userId);
      setConnectionStatus('connecting');

      // Clear any existing subscription
      if (subscriptionRef.current) {
        console.log('Removing existing subscription');
        supabase.removeChannel(subscriptionRef.current);
      }

      // Create a new subscription
      const channel = supabase
        .channel(`user_${userId}_messages`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `receiver_id=eq.${userId}`,
          },
          (payload: any) => {
            console.log('New message received');
            setMessages(prev => [...prev, payload.new]);
          }
        )
        .subscribe((status: string, err?: Error) => {
          console.log('Subscription status:', status);

          switch (status) {
            case 'SUBSCRIBED':
              console.log('Successfully subscribed to messages');
              setConnectionStatus('connected');
              reconnectAttempts.current = 0;
              break;

            case 'CHANNEL_ERROR':
              console.error('Error with Supabase channel:', err);
              setConnectionStatus('error');
              if (err?.message?.includes('JWT expired') || err?.message?.includes('Invalid token')) {
                // Handle token refresh in an async IIFE
                (async () => {
                  try {
                    console.log('Attempting to refresh session...');
                    const { data, error } = await supabase.auth.refreshSession();
                    if (!error && data?.user?.id) {
                      await setupSubscriptionWithUser(data.user.id);
                    }
                  } catch (refreshError) {
                    console.error('Error refreshing session:', refreshError);
                    reconnectWithBackoff(userId);
                  }
                })();
              } else {
                reconnectWithBackoff(userId);
              }
              break;

            case 'TIMED_OUT':
              console.error('Supabase channel timed out');
              setConnectionStatus('reconnecting');
              reconnectWithBackoff(userId);
              break;

            case 'CLOSED':
              console.log('Channel closed, attempting to reconnect...');
              setConnectionStatus('reconnecting');
              reconnectWithBackoff(userId);
              break;

            default:
              console.log('Unknown subscription status:', status);
          }
        });

      subscriptionRef.current = channel;
      return channel;
    };

    // Handle initial setup
    const initialize = async () => {
      try {
        // Get initial user ID
        const userId = await getInitialSession();
        if (userId) {
          await setupSubscriptionWithUser(userId);
        }

        // Check for existing messages
        if (userId) {
          const { data: recentMessages } = await supabase
            .from('messages')
            .select('*')
            .eq('receiver_id', userId)
            .order('created_at', { ascending: false })
            .limit(1);

          if (recentMessages?.[0]) {
            console.log('Found recent message:', recentMessages[0]);
            setMessage(recentMessages[0]);
            setIsVisible(true);
          }
        }
      } catch (error) {
        console.error('Error in initialization:', error);
      }
    };

    // Initial setup
    initialize().catch(console.error);

    // Set up auth state change listener
    console.log('Setting up auth state change listener...');
    const { data: { subscription: authListener } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, 'Session:', session?.user?.id);
        if (event === 'SIGNED_IN' && session?.user?.id) {
          await setupSubscriptionWithUser(session.user.id);
        } else if (event === 'SIGNED_OUT') {
          setIsVisible(false);
          setMessage(null);
          if (subscriptionRef.current) {
            supabase.removeChannel(subscriptionRef.current);
            subscriptionRef.current = null;
          }
        }
      }
    );

    return () => {
      console.log('Cleaning up message subscription');
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
        subscriptionRef.current = null;
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = undefined;
      }
      if (authListener) {
        authListener.unsubscribe();
      }
      setConnectionStatus('disconnected');
    };
  }, []);

  // Always render the component

  // Show connection status for debugging
  if (connectionStatus !== 'connected') {
    console.log('Connection status:', connectionStatus);
  }

  console.log('Rendering FloatingMessage with messages:', messages.length);

  // Toggle between expanded and minimized states
  const toggleChat = () => {
    if (isExpanded) {
      setIsExpanded(false);
    } else {
      setIsExpanded(true);
      setUnreadCount(0); // Reset unread count when opening
    }
  };

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Fetch message history when expanded
  useEffect(() => {
    const fetchMessages = async () => {
      if (!isExpanded) return;

      try {
        setIsLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
          .order('created_at', { ascending: true });

        if (error) throw error;

        if (data) {
          setMessages(data);
          // Reset unread count when loading messages
          setUnreadCount(0);
        }
      } catch (error) {
        console.error('Error fetching messages:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMessages();
  }, [isExpanded]);

  // Handle new message when minimized
  useEffect(() => {
    if (messages.length > 0 && !isExpanded) {
      setUnreadCount(prev => prev + 1);
    }
  }, [messages, isExpanded]);

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex flex-col items-end space-y-2"
      style={{
        cursor: isDragging ? 'grabbing' : 'default',
      }}
    >
      {/* Chat Window */}
      {isExpanded && (
        <div
          ref={messageRef}
          className="w-80 h-[500px] bg-white dark:bg-gray-800 rounded-t-lg shadow-xl flex flex-col border border-gray-200 dark:border-gray-700 overflow-hidden"
        >
          {/* Header */}
          <div
            className="flex items-center justify-between bg-slate-800 text-white p-3 cursor-move"
            onMouseDown={handleMouseDown}
          >
            <div className="flex items-center space-x-2">
              <MessageSquare size={18} />
              <span className="font-medium">Messages</span>
              {unreadCount > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {unreadCount}
                </span>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setIsExpanded(false)}
                className="text-white hover:bg-slate-900 rounded-full p-1"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 p-4 overflow-y-auto">
            {isLoading ? (
              <div className="h-full flex items-center justify-center">
                <div className="animate-pulse text-gray-500">Loading messages...</div>
              </div>
            ) : messages.length > 0 ? (
              <div className="space-y-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`p-3 rounded-lg max-w-[80%] ${(async () => {
                        const { data: { session } } = await supabase.auth.getSession();
                        return msg.sender_id === session?.user?.id
                          ? 'ml-auto bg-blue-100 dark:bg-blue-900 text-right'
                          : 'mr-auto bg-gray-100 dark:bg-gray-700';
                      })()
                      }`}
                  >
                    <div className="text-sm text-gray-800 dark:text-gray-200">
                      {msg.content}
                    </div>
                    <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center text-gray-500 dark:text-gray-400">
                  {connectionStatus === 'connected'
                    ? 'No messages yet. Start a conversation!'
                    : `Connecting... (${connectionStatus})`}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 dark:border-gray-700 p-3 bg-gray-50 dark:bg-gray-700">
            <a
              href="/messages"
              className="block w-full text-center text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              onClick={() => setIsExpanded(false)}
            >
              Open Full Chat
            </a>
          </div>
        </div>
      )}

      {/* Floating Button */}
      <button
        onClick={toggleChat}
        className={`flex items-center justify-center w-14 h-14 rounded-full shadow-lg ${isExpanded ? 'bg-slate-800' : 'bg-slate-800 hover:bg-slate-900'
          } text-white transition-all duration-200`}
        aria-label={isExpanded ? 'Minimize chat' : 'Open chat'}
      >
        {isExpanded ? (
          <X size={24} />
        ) : (
          <div className="relative">
            <MessageSquare size={24} />
            {unreadCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold h-5 w-5 rounded-full flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </div>
        )}
      </button>
    </div>
  );
}

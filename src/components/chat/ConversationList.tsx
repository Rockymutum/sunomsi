"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { formatDistanceToNow } from '@/utils/dateUtils';

interface ConversationListProps {
    currentUserId?: string;
    selectedConversationId?: string;
    className?: string;
}

export default function ConversationList({
    currentUserId,
    selectedConversationId,
    className = ""
}: ConversationListProps) {
    const router = useRouter();
    const supabase = createClientComponentClient();

    const [conversations, setConversations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState<string | null>(currentUserId || null);

    useEffect(() => {
        if (currentUserId) {
            setUserId(currentUserId);
        }
    }, [currentUserId]);

    useEffect(() => {
        const fetchConversations = async () => {
            setLoading(true);

            try {
                let activeUserId = userId;

                if (!activeUserId) {
                    const { data: { session } } = await supabase.auth.getSession();
                    activeUserId = session?.user?.id || null;
                    setUserId(activeUserId);
                }

                if (!activeUserId) {
                    setLoading(false);
                    return;
                }

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
                    .or(`sender_id.eq.${activeUserId},receiver_id.eq.${activeUserId}`)
                    .order('created_at', { ascending: false });

                if (messagesError) throw messagesError;

                // Process conversations
                const conversationMap = new Map();

                for (const message of messagesData || []) {
                    const partnerId = message.sender_id === activeUserId ? message.receiver_id : message.sender_id;

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
                            unread: message.receiver_id === activeUserId && !message.read ? 1 : 0
                        });
                    } else {
                        // Accumulate unread count
                        if (message.receiver_id === activeUserId && !message.read) {
                            const conv = conversationMap.get(partnerId);
                            conv.unread += 1;
                        }
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

        // Subscribe to new messages to update the list in real-time
        const channel = supabase
            .channel('conversation_list_updates')
            .on('postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages'
                },
                () => {
                    fetchConversations();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };

    }, [supabase, userId]);

    if (loading) {
        return (
            <div className={`flex flex-col h-full bg-white border-r border-gray-200 ${className}`}>
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <div className="h-6 w-24 bg-gray-200 rounded animate-pulse"></div>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="p-3 flex gap-3 border-b border-gray-50">
                            <div className="w-12 h-12 rounded-full bg-gray-200 animate-pulse flex-shrink-0"></div>
                            <div className="flex-1 space-y-2">
                                <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse"></div>
                                <div className="h-3 bg-gray-200 rounded w-1/2 animate-pulse"></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className={`flex flex-col h-full bg-white border-r border-gray-200 ${className}`}>
            <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center sticky top-0 z-10">
                <h1 className="text-xl font-bold text-gray-800">Chats</h1>
                <div className="flex gap-2">
                    {/* Add icons for new chat or menu if needed */}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto">
                {conversations.length > 0 ? (
                    <div className="divide-y divide-gray-100">
                        {conversations.map((conversation) => (
                            <div
                                key={conversation.partnerId}
                                onClick={() => router.push(`/messages/${conversation.partnerId}`)}
                                className={`group p-3 flex gap-3 cursor-pointer hover:bg-gray-50 transition-colors ${selectedConversationId === conversation.partnerId ? 'bg-blue-50 hover:bg-blue-50' : ''
                                    }`}
                            >
                                <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-100 ring-1 ring-gray-200 flex-shrink-0">
                                    {conversation.partnerAvatar ? (
                                        <img
                                            src={conversation.partnerAvatar}
                                            alt={conversation.partnerName}
                                            className="h-full w-full object-cover"
                                        />
                                    ) : (
                                        <div className="h-full w-full flex items-center justify-center bg-blue-100 text-blue-600 font-bold text-lg">
                                            {conversation.partnerName?.charAt(0)?.toUpperCase() || 'U'}
                                        </div>
                                    )}
                                </div>

                                <div className="flex-1 min-w-0 flex flex-col justify-center">
                                    <div className="flex justify-between items-baseline gap-2">
                                        <p className="text-gray-900 font-semibold text-base leading-snug truncate">
                                            {conversation.partnerName || 'Unknown User'}
                                        </p>
                                        <span className={`text-xs whitespace-nowrap flex-shrink-0 ${conversation.unread > 0 ? 'text-green-500 font-medium' : 'text-gray-400'}`}>
                                            {formatDistanceToNow(new Date(conversation.lastMessageTime))}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center mt-0.5">
                                        <p className={`text-sm truncate flex-1 mr-2 ${conversation.unread > 0 ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                                            {conversation.lastMessage}
                                        </p>
                                        {conversation.unread > 0 && (
                                            <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-green-500 flex-shrink-0">
                                                <span className="text-[10px] font-bold text-white">
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
                    <div className="p-8 text-center">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-medium text-gray-900">No messages yet</h3>
                        <p className="mt-1 text-sm text-gray-500">
                            Start a conversation from the discovery page.
                        </p>
                        <button
                            onClick={() => router.push('/discovery')}
                            className="mt-4 px-4 py-2 bg-slate-800 text-white rounded-md hover:bg-slate-900 transition-colors text-sm"
                        >
                            Find Tasks
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

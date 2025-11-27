"use client";

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';
import { markAsRead, deleteNotification } from '@/utils/notifications';

interface Notification {
    id: string;
    type: 'message' | 'comment' | 'application';
    title: string;
    body: string;
    data: any;
    read: boolean;
    created_at: string;
}

export default function NotificationCenter({ onClose }: { onClose: () => void }) {
    const supabase = createClientComponentClient();
    const router = useRouter();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchNotifications();

        // Subscribe to new notifications
        const channel = supabase
            .channel('notifications')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'notifications'
            }, () => {
                fetchNotifications();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const fetchNotifications = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(20);

        setNotifications(data || []);
        setLoading(false);
    };

    const handleNotificationClick = async (notification: Notification) => {
        await markAsRead(notification.id);

        let url = '/';
        if (notification.type === 'message' && notification.data?.chatId) {
            url = `/messages/${notification.data.chatId}`;
        } else if (notification.type === 'comment' && notification.data?.taskId) {
            url = `/tasks/${notification.data.taskId}`;
        } else if (notification.type === 'application' && notification.data?.taskId) {
            url = `/tasks/${notification.data.taskId}`;
        }

        onClose();
        router.push(url);
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'message': return '💬';
            case 'comment': return '💭';
            case 'application': return '📝';
            default: return '🔔';
        }
    };

    return (
        <div className="absolute top-full right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 max-h-96 overflow-y-auto z-50">
            <div className="p-3 border-b border-gray-200 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Notifications</h3>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            {loading ? (
                <div className="p-8 text-center text-gray-500">Loading...</div>
            ) : notifications.length === 0 ? (
                <div className="p-8 text-center text-gray-500">No notifications</div>
            ) : (
                <div>
                    {notifications.map((notification) => (
                        <div
                            key={notification.id}
                            className={`w-full p-3 border-b border-gray-100 transition-colors flex gap-3 ${!notification.read ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                        >
                            <button
                                onClick={() => handleNotificationClick(notification)}
                                className="flex-1 text-left flex gap-3 min-w-0"
                            >
                                <div className="text-2xl flex-shrink-0">{getIcon(notification.type)}</div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-gray-900 text-sm truncate">{notification.title}</p>
                                    <p className="text-gray-600 text-xs mt-0.5 truncate">{notification.body}</p>
                                    <p className="text-gray-400 text-xs mt-1">
                                        {new Date(notification.created_at).toLocaleDateString()}
                                    </p>
                                </div>
                                {!notification.read && (
                                    <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0 mt-2"></div>
                                )}
                            </button>
                            <button
                                onClick={async (e) => {
                                    e.stopPropagation();
                                    try {
                                        await deleteNotification(notification.id);
                                        setNotifications(prev => prev.filter(n => n.id !== notification.id));
                                    } catch (error) {
                                        console.error('Error deleting:', error);
                                    }
                                }}
                                className="flex-shrink-0 text-gray-400 hover:text-red-500 self-center p-2"
                                title="Delete"
                            >
                                🗑️
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

"use client";

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';
import { markAsRead, deleteNotification } from '@/utils/notifications';
import Link from 'next/link';
import Navbar from '@/components/layout/Navbar';

interface Notification {
  id: string;
  type: 'message' | 'comment' | 'application';
  title: string;
  body: string;
  data: any;
  read: boolean;
  created_at: string;
}

export default function NotificationsPage() {
  const supabase = createClientComponentClient();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();

    const channel = supabase
      .channel('notifications_page')
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
      .limit(50);

    setNotifications(data || []);
    setLoading(false);
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.read) {
      await markAsRead(notification.id);
      // Optimistically update UI
      setNotifications(prev => prev.map(n =>
        n.id === notification.id ? { ...n, read: true } : n
      ));
    }

    let url = '/';
    if (notification.type === 'message' && notification.data?.chatId) {
      url = `/messages/${notification.data.chatId}`;
    } else if (notification.type === 'comment' && notification.data?.taskId) {
      url = `/tasks/${notification.data.taskId}`;
    } else if (notification.type === 'application' && notification.data?.taskId) {
      url = `/tasks/${notification.data.taskId}`;
    }

    router.push(url);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await deleteNotification(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (error) {
      console.error('Error deleting:', error);
    }
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
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
      <Navbar />
      <div className="max-w-2xl mx-auto pt-20 px-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex justify-between items-center">
            <h1 className="text-xl font-bold text-gray-900">Notifications</h1>
            <button
              onClick={fetchNotifications}
              className="text-sm text-primary hover:text-primary-dark font-medium"
            >
              Mark all as read
            </button>
          </div>

          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading...</div>
          ) : notifications.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-4xl mb-4">📭</div>
              <h3 className="text-lg font-medium text-gray-900">No notifications yet</h3>
              <p className="text-gray-500 mt-1">We'll let you know when something arrives.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`group p-3 flex gap-3 cursor-pointer transition-colors ${!notification.read ? 'bg-blue-50/50 hover:bg-blue-50' : 'hover:bg-gray-50'
                    }`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl flex-shrink-0 ${!notification.read ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'
                    }`}>
                    {getIcon(notification.type)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-2">
                      <p className="text-gray-900 font-medium text-sm leading-snug">
                        {notification.title}
                      </p>
                      <span className="text-[10px] text-gray-400 whitespace-nowrap flex-shrink-0 mt-0.5">
                        {new Date(notification.created_at).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: 'numeric'
                        })}
                      </span>
                    </div>
                    <p className="text-gray-600 text-xs mt-0.5 line-clamp-2">
                      {notification.body}
                    </p>
                  </div>

                  <div className="flex flex-col items-end justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                    {!notification.read && (
                      <div className="w-2 h-2 bg-blue-600 rounded-full mb-1"></div>
                    )}
                    <button
                      onClick={(e) => handleDelete(e, notification.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                      title="Delete notification"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
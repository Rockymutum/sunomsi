"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import Navbar from '@/components/layout/Navbar';
import { formatTimeAgo } from '@/utils/dateUtils';

export default function NotificationsPage() {
  const router = useRouter();
  const supabase = createClientComponentClient();
  
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  
  useEffect(() => {
    const fetchNotifications = async () => {
      setLoading(true);
      
      // Check authentication status
      const { data: { session } } = await supabase.auth.getSession();
      const currentUserId = session?.user?.id;
      
      if (!currentUserId) {
        router.push('/auth');
        return;
      }
      
      setUserId(currentUserId);
      
      // Fetch notifications for the current user
      const { data: notificationsData, error: notificationsError } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', currentUserId)
        .order('created_at', { ascending: false });
      
      if (notificationsError) {
        console.error('Error fetching notifications:', notificationsError);
      } else {
        setNotifications(notificationsData || []);
        
        // Mark all unread notifications as read
        const unreadNotifications = notificationsData?.filter(n => !n.read) || [];
        
        if (unreadNotifications.length > 0) {
          const unreadIds = unreadNotifications.map(n => n.id);
          
          const { error: updateError } = await supabase
            .from('notifications')
            .update({ read: true })
            .in('id', unreadIds);
          
          if (updateError) {
            console.error('Error marking notifications as read:', updateError);
          }
        }
      }
      
      setLoading(false);
    };
    
    fetchNotifications();
  }, [router, supabase]);
  
  const handleNotificationClick = (notification: any) => {
    // Navigate based on notification type
    switch (notification.type) {
      case 'new_application':
        router.push(`/tasks/${notification.task_id}`);
        break;
      case 'application_status':
        router.push(`/tasks/${notification.task_id}`);
        break;
      case 'new_message':
        router.push(`/messages/${notification.sender_id}`);
        break;
      case 'task_completed':
        router.push(`/tasks/${notification.task_id}`);
        break;
      default:
        router.push('/');
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
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Notifications</h1>
        
        {notifications.length > 0 ? (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <ul className="divide-y divide-gray-200">
              {notifications.map((notification) => (
                <li 
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`hover:bg-gray-50 cursor-pointer ${!notification.read ? 'bg-blue-50' : ''}`}
                >
                  <div className="px-4 py-4 sm:px-6">
                    <div className="flex items-start">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                        notification.type === 'new_application' ? 'bg-green-100 text-green-600' :
                        notification.type === 'application_status' ? 'bg-blue-100 text-blue-600' :
                        notification.type === 'new_message' ? 'bg-purple-100 text-purple-600' :
                        notification.type === 'task_completed' ? 'bg-yellow-100 text-yellow-600' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {notification.type === 'new_application' && (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z" />
                          </svg>
                        )}
                        {notification.type === 'application_status' && (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        )}
                        {notification.type === 'new_message' && (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
                            <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
                          </svg>
                        )}
                        {notification.type === 'task_completed' && (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                      
                      <div className="ml-4 flex-1">
                        <div className="flex items-center justify-between">
                          <p className={`text-sm font-medium ${!notification.read ? 'text-gray-900' : 'text-gray-700'}`}>
                            {notification.title}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatTimeAgo(notification.created_at)}
                          </p>
                        </div>
                        <p className={`text-sm mt-1 ${!notification.read ? 'text-gray-700' : 'text-gray-500'}`}>
                          {notification.message}
                        </p>
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900">No notifications yet</h3>
            <p className="mt-1 text-sm text-gray-500">
              When you receive notifications, they will appear here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
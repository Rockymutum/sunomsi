import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export async function createNotification({
    userId,
    type,
    title,
    body,
    data = {},
}: {
    userId: string;
    type: 'message' | 'comment' | 'application';
    title: string;
    body: string;
    data?: Record<string, any>;
}) {
    const supabase = createClientComponentClient();

    const { error } = await supabase.from('notifications').insert({
        user_id: userId,
        type,
        title,
        body,
        data,
    });

    if (error) {
        console.error('Error creating notification:', error);
    }
}

export async function markAsRead(notificationId: string) {
    const supabase = createClientComponentClient();

    const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId);

    if (error) {
        console.error('Error marking notification as read:', error);
    }
}

export async function getUnreadCount(userId: string) {
    const supabase = createClientComponentClient();

    const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('read', false);

    return count || 0;
}

export async function deleteNotification(notificationId: string) {
    const supabase = createClientComponentClient();

    const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

    if (error) {
        console.error('Error deleting notification:', error);
        throw error;
    }
}

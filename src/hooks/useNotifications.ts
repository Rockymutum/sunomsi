import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export function useNotifications() {
    const supabase = createClientComponentClient();
    const [permission, setPermission] = useState<NotificationPermission>('default');
    const [isSubscribed, setIsSubscribed] = useState(false);

    useEffect(() => {
        if ('Notification' in window) {
            setPermission(Notification.permission);
        }
    }, []);

    const requestPermission = async () => {
        if (!('Notification' in window)) {
            console.error('This browser does not support notifications');
            return false;
        }

        const result = await Notification.requestPermission();
        setPermission(result);

        if (result === 'granted') {
            await subscribeToPush();
        }

        return result === 'granted';
    };

    const subscribeToPush = async () => {
        try {
            const registration = await navigator.serviceWorker.ready;

            // Subscribe with VAPID key for production-ready push
            const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: vapidPublicKey ? urlBase64ToUint8Array(vapidPublicKey) : undefined,
            });

            // Save subscription to database
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const subscriptionJSON = subscription.toJSON();

                await supabase.from('push_subscriptions').upsert({
                    user_id: user.id,
                    endpoint: subscription.endpoint,
                    p256dh: subscriptionJSON.keys?.p256dh || '',
                    auth: subscriptionJSON.keys?.auth || ''
                });

                setIsSubscribed(true);
            }
        } catch (error) {
            console.error('Error subscribing to push:', error);
        }
    };

    const unsubscribe = async () => {
        try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();

            if (subscription) {
                await subscription.unsubscribe();

                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    await supabase
                        .from('push_subscriptions')
                        .delete()
                        .eq('user_id', user.id)
                        .eq('endpoint', subscription.endpoint);
                }

                setIsSubscribed(false);
            }
        } catch (error) {
            console.error('Error unsubscribing:', error);
        }
    };

    return { permission, isSubscribed, requestPermission, unsubscribe };
}

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

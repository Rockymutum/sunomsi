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
            console.log('Attempting to subscribe to push...');
            const registration = await navigator.serviceWorker.ready;
            console.log('Service Worker ready:', registration);

            // Subscribe with VAPID key for production-ready push
            const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
            console.log('VAPID Key present:', !!vapidPublicKey);

            if (!vapidPublicKey) {
                console.error('Missing VAPID public key');
                alert('Error: Missing VAPID public key');
                return;
            }

            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: vapidPublicKey ? urlBase64ToUint8Array(vapidPublicKey) : undefined,
            });

            console.log('Push subscription created:', subscription);

            // Save subscription to database
            const { data: { user }, error: userError } = await supabase.auth.getUser();

            if (userError) {
                console.error('Error getting user:', userError);
                return;
            }

            if (user) {
                console.log('Saving subscription for user:', user.id);
                const subscriptionJSON = subscription.toJSON();

                const { error: insertError } = await supabase.from('push_subscriptions').upsert({
                    user_id: user.id,
                    endpoint: subscription.endpoint,
                    p256dh: subscriptionJSON.keys?.p256dh || '',
                    auth: subscriptionJSON.keys?.auth || ''
                });

                if (insertError) {
                    console.error('Supabase insert error:', insertError);
                    alert('Failed to save subscription: ' + insertError.message);
                } else {
                    console.log('Subscription saved successfully!');
                    setIsSubscribed(true);
                    alert('Notifications enabled successfully!');
                }
            }
        } catch (error: any) {
            console.error('Error subscribing to push:', error);
            alert('Error subscribing: ' + error.message);
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

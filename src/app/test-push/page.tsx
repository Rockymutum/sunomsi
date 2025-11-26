"use client";

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';


export default function TestPushPage() {
    const [status, setStatus] = useState<string>('Initializing...');
    const [logs, setLogs] = useState<string[]>([]);
    const supabase = createClientComponentClient();

    const addLog = (msg: string) => {
        setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`]);
        console.log(msg);
    };

    const checkStatus = async () => {
        try {
            addLog('Checking status...');
            addLog(`User Agent: ${navigator.userAgent}`);

            // Check Notification permission
            if (typeof window !== 'undefined' && 'Notification' in window) {
                const permission = Notification.permission;
                addLog(`Notification permission: ${permission}`);
            } else {
                addLog('ERROR: Notification API not found');
            }

            // Check Service Worker
            if ('serviceWorker' in navigator) {
                const registration = await navigator.serviceWorker.getRegistration();
                addLog(`Service Worker registration: ${registration ? 'Found' : 'Missing'}`);
                if (registration) {
                    addLog(`SW Scope: ${registration.scope}`);
                    addLog(`SW State: ${registration.active ? 'Active' : 'Not Active'}`);
                }
            } else {
                addLog('Service Worker not supported');
            }

            // Check VAPID Key
            const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
            addLog(`VAPID Key present: ${!!vapidKey}`);

            setStatus('Ready');
        } catch (error: any) {
            addLog(`Error checking status: ${error.message}`);
            setStatus('Error');
        }
    };

    const forceSubscribe = async () => {
        try {
            addLog('Starting force subscription...');

            if (!('serviceWorker' in navigator)) {
                throw new Error('No Service Worker support');
            }

            const registration = await navigator.serviceWorker.ready;
            addLog('Service Worker ready');

            const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
            if (!vapidPublicKey) throw new Error('Missing VAPID key');

            // Convert key
            const padding = '='.repeat((4 - vapidPublicKey.length % 4) % 4);
            const base64 = (vapidPublicKey + padding).replace(/-/g, '+').replace(/_/g, '/');
            const rawData = window.atob(base64);
            const outputArray = new Uint8Array(rawData.length);
            for (let i = 0; i < rawData.length; ++i) {
                outputArray[i] = rawData.charCodeAt(i);
            }

            addLog('Subscribing to push manager...');
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: outputArray,
            });

            addLog('Got subscription object');

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not logged in');

            addLog(`Saving for user: ${user.id}`);
            const subJson = subscription.toJSON();

            const { error } = await supabase.from('push_subscriptions').upsert({
                user_id: user.id,
                endpoint: subscription.endpoint,
                p256dh: subJson.keys?.p256dh || '',
                auth: subJson.keys?.auth || ''
            });

            if (error) throw new Error(error.message);

            addLog('SUCCESS! Subscription saved to DB');
            alert('Success! Subscription saved.');

        } catch (error: any) {
            addLog(`ERROR: ${error.message}`);
            alert(`Error: ${error.message}`);
        }
    };

    const resetServiceWorker = async () => {
        try {
            addLog('Unregistering Service Worker...');
            const registration = await navigator.serviceWorker.getRegistration();
            if (registration) {
                await registration.unregister();
                addLog('Service Worker unregistered');
            } else {
                addLog('No Service Worker found to unregister');
            }

            addLog('Reloading page in 2 seconds...');
            setTimeout(() => window.location.reload(), 2000);
        } catch (error: any) {
            addLog(`Error resetting: ${error.message}`);
        }
    };

    useEffect(() => {
        checkStatus();
    }, []);

    return (
        <div className="p-8 max-w-2xl mx-auto pt-20">
            <h1 className="text-2xl font-bold mb-4">Push Notification Debugger</h1>

            <div className="mb-6 p-4 bg-gray-100 rounded">
                <p className="font-bold">Status: {status}</p>
                <p className="text-sm mt-2">Permission: {typeof Notification !== 'undefined' ? Notification.permission : 'Unknown'}</p>
            </div>

            <div className="flex flex-wrap gap-4 mb-8">
                <button
                    onClick={checkStatus}
                    className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
                >
                    Refresh Status
                </button>
                <button
                    onClick={forceSubscribe}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                    Force Subscribe
                </button>
                <button
                    onClick={resetServiceWorker}
                    className="px-4 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200 border border-red-300"
                >
                    Reset Service Worker
                </button>
            </div>

            <div className="bg-black text-green-400 p-4 rounded font-mono text-sm h-96 overflow-auto">
                {logs.map((log, i) => (
                    <div key={i}>{log}</div>
                ))}
            </div>
        </div>
    );
}

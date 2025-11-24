"use client";

import { useState, useEffect } from 'react';
import { useNotifications } from '@/hooks/useNotifications';

export default function NotificationPrompt() {
    const { permission, requestPermission } = useNotifications();
    const [showPrompt, setShowPrompt] = useState(false);

    useEffect(() => {
        // Show prompt after 3 seconds if permission not granted
        const timer = setTimeout(() => {
            if (permission === 'default') {
                setShowPrompt(true);
            }
        }, 3000);

        return () => clearTimeout(timer);
    }, [permission]);

    if (permission !== 'default' || !showPrompt) {
        return null;
    }

    return (
        <div className="fixed bottom-20 md:bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-sm z-50 animate-slide-in-right">
            <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4">
                <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 text-2xl">🔔</div>
                    <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 mb-1">
                            Enable Notifications
                        </h3>
                        <p className="text-sm text-gray-600 mb-3">
                            Get notified about new messages, comments, and applications
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={async () => {
                                    await requestPermission();
                                    setShowPrompt(false);
                                }}
                                className="px-4 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-dark transition-colors"
                            >
                                Enable
                            </button>
                            <button
                                onClick={() => setShowPrompt(false)}
                                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors"
                            >
                                Later
                            </button>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowPrompt(false)}
                        className="flex-shrink-0 text-gray-400 hover:text-gray-600"
                    >
                        ✕
                    </button>
                </div>
            </div>
        </div>
    );
}

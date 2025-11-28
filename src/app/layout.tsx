"use client";

import { useEffect } from 'react';
import { AuthProvider } from '@/components/providers/AuthProvider';
import { sessionManager } from '@/utils/sessionPersistence';
import NotificationPrompt from '@/components/notifications/NotificationPrompt';
import './globals.css';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    // Initialize session manager when app starts
    sessionManager.initialize();

    // Register service worker with aggressive update strategy
    if ('serviceWorker' in navigator) {
      // 1. Unregister any existing service workers to ensure a clean slate
      navigator.serviceWorker.getRegistrations().then(registrations => {
        for (let registration of registrations) {
          registration.unregister();
        }
      }).then(() => {
        // 2. Register new service worker with cache-busting timestamp
        // This forces the browser to fetch the new file instead of using a cached one
        navigator.serviceWorker.register(`/sw.js?v=${Date.now()}`)
          .then(reg => {
            console.log('Service Worker registered:', reg);

            // Check for updates periodically
            setInterval(() => {
              reg.update();
            }, 60 * 60 * 1000); // Check every hour
          })
          .catch(err => console.error('Service Worker registration failed:', err));
      });

      // Reload when a new service worker takes control
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          window.location.reload();
          refreshing = true;
        }
      });
    }

    // Check session on app load
    const checkSession = async () => {
      const user = await sessionManager.getCurrentUser();
      console.log('🏠 Layout: Initial user:', user?.email);
    };

    checkSession();
  }, []);

  return (
    <html lang="en">
      <head>
        {/* Mobile Viewport Configuration */}
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes, viewport-fit=cover" />

        {/* iOS Specific Meta Tags */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Sunomsi" />

        {/* Android Specific Meta Tags */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#1e293b" />

        {/* Prevent text size adjustment on orientation change */}
        <meta name="format-detection" content="telephone=no" />

        <link rel="manifest" href="/manifest.json" />
        <title>Sunomsi</title>
      </head>
      <body>
        <AuthProvider>
          {children}
          <NotificationPrompt />
        </AuthProvider>
      </body>
    </html>
  );
}
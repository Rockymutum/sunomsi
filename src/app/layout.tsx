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

    // Register service worker with update handling
    if ('serviceWorker' in navigator) {
      // Add timestamp to force update
      navigator.serviceWorker.register(`/sw.js?v=${Date.now()}`).then(reg => {
        console.log('Service Worker registered:', reg);

        // Check for updates
        reg.update();

        // Handle updates
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New content available, force reload
                window.location.reload();
              }
            });
          }
        });
      }).catch(err => console.error('Service Worker registration failed:', err));

      // Reload when new service worker takes control
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
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
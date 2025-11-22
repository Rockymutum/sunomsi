"use client";

import { useEffect } from 'react';
import { AuthProvider } from '@/components/providers/AuthProvider';
import { sessionManager } from '@/utils/sessionPersistence';
import './globals.css';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    // Initialize session manager when app starts
    sessionManager.initialize();

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

        <title>Sunomsi</title>
      </head>
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
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
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
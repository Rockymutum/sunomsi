'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useViewportHeight } from '@/hooks/useViewportHeight';
import { Inter } from 'next/font/google';
import Script from 'next/script';
import { Toaster } from 'react-hot-toast';

const inter = Inter({ subsets: ['latin'] });

export default function RootLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const vh = useViewportHeight();

  // Prevent pinch zoom on mobile
  useEffect(() => {
    const preventZoom = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    };

    document.addEventListener('touchmove', preventZoom, { passive: false });
    
    // Reset scroll position on route change
    window.scrollTo(0, 0);
    
    return () => {
      document.removeEventListener('touchmove', preventZoom);
    };
  }, [pathname]);

  return (
    <html lang="en" suppressHydrationWarning className="h-full">
      <head>
        <meta name="application-name" content="SUNOMSI" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="SUNOMSI" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileColor" content="#000000" />
        <meta name="msapplication-tap-highlight" content="no" />
        <meta name="theme-color" content="#000000" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#000000" media="(prefers-color-scheme: dark)" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover, user-scalable=no" />
        
        {/* iOS specific */}
        <meta name="apple-mobile-web-app-status" content="black-translucent" />
        <link rel="apple-touch-startup-image" href="/splash.png" />
        
        {/* Favicon links */}
        <link rel="icon" type="image/png" href="/favicon-96x96.png" sizes="96x96" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="shortcut icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/site.webmanifest" />
      </head>
      <body 
        className={`${inter.className} bg-white dark:bg-gray-900`}
        style={{
          minHeight: vh,
          display: 'flex',
          flexDirection: 'column',
          WebkitTapHighlightColor: 'transparent',
          touchAction: 'pan-y',
          overscrollBehaviorY: 'contain',
          width: '100%',
          maxWidth: '100vw',
          overflowX: 'hidden',
          position: 'relative'
        }}
      >
        <div className="flex-1 flex flex-col">
          {children}
        </div>
        <Toaster position="bottom-center" />
        <Script 
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9848284460634380"
          strategy="afterInteractive"
          crossOrigin="anonymous"
        />
      </body>
    </html>
  );
}

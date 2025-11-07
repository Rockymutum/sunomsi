import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from 'react-hot-toast';
import Script from 'next/script';
import { ReactNode, Suspense } from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { performanceMonitor } from '@/lib/performance';
import { reportWebVitals } from '@/lib/performance';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Analytics } from '@vercel/analytics/react';
import { getEnv } from '@/lib/env';
import { AuthProvider } from '@/context/AuthContext';
import PageLoader from '@/components/ui/PageLoader';
import './globals.css';

// Add this type definition
type Props = {
  children: ReactNode;
};

const inter = Inter({ subsets: ['latin'] });

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false
};

// Preload critical resources
const preloadResources = [
  { href: '/fonts/Inter.var.woff2', as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' },
  { href: '/images/logo.svg', as: 'image', type: 'image/svg+xml' },
];

export const metadata: Metadata = {
  title: 'SUNOMSI - Find Help or Work',
  description: 'Connect with people who need help or can offer their skills',
  manifest: '/site.webmanifest',
  metadataBase: new URL(getEnv().supabase.url),
  applicationName: 'SUNOMSI',
  authors: [{ name: 'SUNOMSI Team' }],
  generator: 'Next.js',
  keywords: ['tasks', 'freelance', 'work', 'help', 'services'],
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'SUNOMSI',
    startupImage: '/splash-screens/iphone5_splash.png',
  },
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://sunomsi.vercel.app',
    siteName: 'SUNOMSI',
    title: 'SUNOMSI - Find Help or Work',
    description: 'Connect with people who need help or can offer their skills',
    images: [
      {
        url: '/images/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'SUNOMSI - Find Help or Work',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SUNOMSI - Find Help or Work',
    description: 'Connect with people who need help or can offer their skills',
    images: ['/images/og-image.jpg'],
    creator: '@sunomsi',
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-96x96.png', sizes: '96x96', type: 'image/png' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
      { url: '/splash-screens/iphone5_splash.png', sizes: '320x568', type: 'image/png' },
      { url: '/splash-screens/iphone6_splash.png', sizes: '375x667', type: 'image/png' },
      { url: '/splash-screens/iphoneplus_splash.png', sizes: '414x736', type: 'image/png' },
    ],
  },
};

interface RootLayoutProps {
  children: ReactNode;
}

// This is the root layout component for your Next.js app.
// Learn more about this file: https://nextjs.org/docs/app/building-your-application/routing/pages-and-layouts#root-layout-required

export default function RootLayout({ children }: Props) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="application-name" content="SUNOMSI" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="SUNOMSI" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileColor" content="#000000" />
        <meta name="msapplication-tap-highlight" content="no" />
        <meta name="theme-color" content="#000000" />
        
        {/* Favicon links */}
        <link rel="icon" type="image/png" href="/favicon-96x96.png" sizes="96x96" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="shortcut icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/site.webmanifest" />
      </head>
      <body className={`${inter.className} antialiased`}>
        <ErrorBoundary>
          <AuthProvider>
            <PageLoader />
            <Suspense fallback={null}>
              {children}
            </Suspense>
          </AuthProvider>
          <Toaster 
            position="top-center"
            toastOptions={{
              duration: 5000,
              style: {
                background: '#1a1a1a',
                color: '#fff',
                borderRadius: '8px',
                padding: '12px 16px',
                fontSize: '14px',
                lineHeight: '1.5',
                maxWidth: '100%',
                width: 'auto',
              },
              success: {
                iconTheme: {
                  primary: '#10B981',
                  secondary: '#fff',
                },
              },
              error: {
                iconTheme: {
                  primary: '#EF4444',
                  secondary: '#fff',
                },
              },
            }}
          />
          <SpeedInsights />
          <Analytics />
        </ErrorBoundary>
        
        {/* Service Worker Registration */}
        <Script
          id="service-worker-registration"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator && window.location.hostname !== 'localhost') {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js')
                    .then(registration => {
                      console.log('ServiceWorker registration successful with scope: ', registration.scope);
                    })
                    .catch(error => {
                      console.log('ServiceWorker registration failed: ', error);
                    });
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import Script from 'next/script';
import { Toaster } from 'react-hot-toast';
import './globals.css';
import RootLayoutClient from '@/components/RootLayoutClient';

const inter = Inter({ subsets: ['latin'] });

export const viewport: Viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  minimumScale: 1,
  maximumScale: 1,
  userScalable: false,
  colorScheme: 'light',
  interactiveWidget: 'resizes-content',
};

export const metadata: Metadata = {
  title: 'SUNOMSI',
  description: 'Your application description',
  applicationName: 'SUNOMSI',
  appleWebApp: {
    capable: true,
    title: 'SUNOMSI',
    statusBarStyle: 'black-translucent',
  },
  formatDetection: {
    telephone: false,
  },
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#000000' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <RootLayoutClient>{children}</RootLayoutClient>;
}
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from 'react-hot-toast';
import Script from 'next/script';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'SUNOMSI - Find Help or Work',
  description: 'Connect with people who need help or can offer their skills',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9848284460634380"
          crossOrigin="anonymous"></script>
      </head>
      <body className={inter.className}>
        <Toaster position="top-right" />
        <main className="min-h-[100svh]">
          {children}
        </main>
      </body>
    </html>
  );
}
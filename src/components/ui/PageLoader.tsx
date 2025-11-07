'use client';

import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';

export default function PageLoader() {
  const [isLoading, setIsLoading] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [currentPath, setCurrentPath] = useState(pathname);
  const [isNavigating, setIsNavigating] = useState(false);

  // Handle route changes
  useEffect(() => {
    const handleStart = (url: string) => {
      if (url !== pathname + searchParams.toString()) {
        setIsNavigating(true);
      }
    };

    const handleComplete = () => {
      setIsLoading(false);
      setIsNavigating(false);
    };

    // Set up event listeners for route changes
    router.events?.on('routeChangeStart', handleStart);
    router.events?.on('routeChangeComplete', handleComplete);
    router.events?.on('routeChangeError', handleComplete);

    // Initial load
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 100);

    return () => {
      clearTimeout(timer);
      router.events?.off('routeChangeStart', handleStart);
      router.events?.off('routeChangeComplete', handleComplete);
      router.events?.off('routeChangeError', handleComplete);
    };
  }, [pathname, searchParams, router.events]);

  // Only show loader if navigating or initial loading
  if (!isLoading && !isNavigating) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm transition-opacity duration-300">
      <div className="flex flex-col items-center">
        <div className="h-12 w-12 border-4 border-primary/20 border-t-primary rounded-full animate-[spin_1s_linear_infinite]" />
      </div>
    </div>
  );
}

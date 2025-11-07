'use client';

import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export default function PageLoader() {
  const [isLoading, setIsLoading] = useState(true);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [prevPath, setPrevPath] = useState(pathname);
  const [isNavigating, setIsNavigating] = useState(false);

  // Handle route changes
  useEffect(() => {
    // Check if the route has changed
    if (pathname !== prevPath) {
      setIsNavigating(true);
      setPrevPath(pathname);
      
      // Set a minimum loading time for better UX
      const timer = setTimeout(() => {
        setIsNavigating(false);
      }, 200);
      
      return () => clearTimeout(timer);
    }
  }, [pathname, searchParams, prevPath]);

  // Handle initial load
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);

  // Only show loader if navigating or initial loading
  if (!isLoading && !isNavigating) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white/80 backdrop-blur-sm transition-opacity duration-300">
      <div className="flex flex-col items-center">
        <div className="h-12 w-12 border-4 border-primary/20 border-t-primary rounded-full animate-[spin_1s_linear_infinite]" />
      </div>
    </div>
  );
}

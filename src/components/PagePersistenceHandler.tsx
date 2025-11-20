"use client";

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

// Page memory lasts for 24 hours
const PAGE_MEMORY_DURATION = 24 * 60 * 60 * 1000; // 24 hours

export default function PagePersistenceHandler() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Save current page to localStorage whenever it changes
    const currentUrl = pathname + (searchParams.toString() ? `?${searchParams.toString()}` : '');
    
    if (currentUrl && currentUrl !== '/') {
      const pageMemory = {
        url: currentUrl,
        timestamp: Date.now()
      };
      localStorage.setItem('lastVisitedPage', JSON.stringify(pageMemory));
      console.log('Saved page to memory:', currentUrl);
    }
  }, [pathname, searchParams]);

  useEffect(() => {
    // Restore last visited page on app start if it's within 24 hours
    const pageMemoryStr = localStorage.getItem('lastVisitedPage');
    const currentPage = window.location.pathname + window.location.search;
    
    if (pageMemoryStr) {
      try {
        const pageMemory = JSON.parse(pageMemoryStr);
        const isMemoryValid = (Date.now() - pageMemory.timestamp) < PAGE_MEMORY_DURATION;
        
        if (isMemoryValid && pageMemory.url && pageMemory.url !== '/' && currentPage === '/') {
          console.log('Restoring last page from memory:', pageMemory.url);
          window.history.replaceState(null, '', pageMemory.url);
        } else if (!isMemoryValid) {
          // Clear expired memory
          localStorage.removeItem('lastVisitedPage');
        }
      } catch (error) {
        console.error('Error parsing page memory:', error);
        localStorage.removeItem('lastVisitedPage');
      }
    }

    // Save page when tab becomes hidden
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        const currentUrl = window.location.pathname + window.location.search;
        if (currentUrl && currentUrl !== '/') {
          const pageMemory = {
            url: currentUrl,
            timestamp: Date.now()
          };
          localStorage.setItem('lastVisitedPage', JSON.stringify(pageMemory));
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return null;
}
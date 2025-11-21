import { useEffect, useRef } from 'react';

interface UseScrollRestorationOptions {
    key: string;
    enabled?: boolean;
    delay?: number;
}

/**
 * Hook to save and restore scroll position for a page
 * @param key - Unique key for this page's scroll position in sessionStorage
 * @param enabled - Whether scroll restoration is enabled (default: true)
 * @param delay - Delay in ms before restoring scroll (default: 100)
 */
export function useScrollRestoration({
    key,
    enabled = true,
    delay = 100,
}: UseScrollRestorationOptions) {
    const hasRestoredRef = useRef(false);

    useEffect(() => {
        if (!enabled) return;

        // Save scroll position on scroll
        const handleScroll = () => {
            const scrollY = window.scrollY;
            sessionStorage.setItem(key, scrollY.toString());
        };

        // Throttle scroll events for performance
        let timeoutId: NodeJS.Timeout;
        const throttledScroll = () => {
            if (timeoutId) clearTimeout(timeoutId);
            timeoutId = setTimeout(handleScroll, 100);
        };

        window.addEventListener('scroll', throttledScroll, { passive: true });

        return () => {
            window.removeEventListener('scroll', throttledScroll);
            if (timeoutId) clearTimeout(timeoutId);
        };
    }, [key, enabled]);

    // Function to restore scroll position
    const restoreScroll = () => {
        if (!enabled || hasRestoredRef.current) return;

        const savedScroll = sessionStorage.getItem(key);
        if (savedScroll) {
            const scrollY = parseInt(savedScroll, 10);
            if (scrollY > 0) {
                // Use requestAnimationFrame for smooth restoration
                requestAnimationFrame(() => {
                    window.scrollTo({
                        top: scrollY,
                        behavior: 'instant' as ScrollBehavior,
                    });
                    hasRestoredRef.current = true;
                });
            }
        }
    };

    // Restore scroll position after content loads
    useEffect(() => {
        if (!enabled) return;

        // Delay restoration to ensure content is loaded
        const timeoutId = setTimeout(() => {
            restoreScroll();
        }, delay);

        return () => clearTimeout(timeoutId);
    }, [enabled, delay]);

    return { restoreScroll };
}

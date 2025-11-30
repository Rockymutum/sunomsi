import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { cacheManager } from '@/lib/cache';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

interface PrefetchOptions {
    route?: string;
    fetchData?: () => Promise<any>;
    cacheKey?: string;
    storeName?: 'tasks' | 'workers' | 'profiles' | 'messages';
}

export function usePrefetch(options: PrefetchOptions) {
    const router = useRouter();
    const supabase = createClientComponentClient();
    const prefetchedRef = useRef(false);

    const prefetch = async () => {
        if (prefetchedRef.current) return;
        prefetchedRef.current = true;

        try {
            // Prefetch route
            if (options.route) {
                router.prefetch(options.route);
            }

            // Prefetch and cache data
            if (options.fetchData && options.cacheKey && options.storeName) {
                const data = await options.fetchData();
                if (data) {
                    await cacheManager.set(options.storeName, options.cacheKey, data);
                }
            }
        } catch (error) {
            console.error('Prefetch error:', error);
        }
    };

    return { prefetch };
}

export function useHoverPrefetch(options: PrefetchOptions) {
    const { prefetch } = usePrefetch(options);

    const handleMouseEnter = () => {
        prefetch();
    };

    return { onMouseEnter: handleMouseEnter };
}

export function useIntersectionPrefetch(options: PrefetchOptions) {
    const { prefetch } = usePrefetch(options);
    const observerRef = useRef<IntersectionObserver | null>(null);

    useEffect(() => {
        observerRef.current = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        prefetch();
                    }
                });
            },
            { rootMargin: '50px' }
        );

        return () => {
            observerRef.current?.disconnect();
        };
    }, []);

    const ref = (element: HTMLElement | null) => {
        if (element && observerRef.current) {
            observerRef.current.observe(element);
        }
    };

    return { ref };
}

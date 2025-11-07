import { useState, useEffect, useCallback } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

type CacheEntry<T> = {
  data: T;
  timestamp: number;
};

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const cache = new Map<string, CacheEntry<any>>();

interface UseFetchOptions<T> {
  cacheKey?: string;
  enabled?: boolean;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
}

export function useFetch<T>(
  queryKey: string | any[],
  fetcher: () => Promise<T>,
  options: UseFetchOptions<T> = {}
) {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const cacheKey = options.cacheKey || JSON.stringify(queryKey);
  const enabled = options.enabled ?? true;

  const fetchData = useCallback(async () => {
    if (!enabled) return;

    // Check cache first
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      setData(cached.data);
      setIsLoading(false);
      options.onSuccess?.(cached.data);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await fetcher();
      
      // Update cache
      cache.set(cacheKey, {
        data: result,
        timestamp: Date.now(),
      });
      
      setData(result);
      options.onSuccess?.(result);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('An unknown error occurred');
      setError(error);
      options.onError?.(error);
    } finally {
      setIsLoading(false);
    }
  }, [cacheKey, enabled, fetcher, options]);

  const refetch = useCallback(() => {
    cache.delete(cacheKey);
    return fetchData();
  }, [cacheKey, fetchData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, isLoading, error, refetch };
}

// Helper function to clear specific cache entries
export function clearCache(key: string) {
  cache.delete(key);
}

// Clear all cache
export function clearAllCache() {
  cache.clear();
}

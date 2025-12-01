import { useEffect } from 'react';

// Global image cache - persists across all components and navigations
const imageCache = new Map<string, HTMLImageElement>();
const loadingPromises = new Map<string, Promise<void>>();

/**
 * Preload an image and cache it in memory
 */
export function preloadImage(src: string): Promise<void> {
    // Already cached
    if (imageCache.has(src)) {
        return Promise.resolve();
    }

    // Already loading
    if (loadingPromises.has(src)) {
        return loadingPromises.get(src)!;
    }

    // Start loading
    const promise = new Promise<void>((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';

        img.onload = () => {
            imageCache.set(src, img);
            loadingPromises.delete(src);
            console.log('[Preload] ✓ Cached:', src.split('/').pop());
            resolve();
        };

        img.onerror = () => {
            loadingPromises.delete(src);
            console.error('[Preload] ✗ Failed:', src.split('/').pop());
            reject(new Error(`Failed to preload: ${src}`));
        };

        img.src = src;
    });

    loadingPromises.set(src, promise);
    return promise;
}

/**
 * Check if image is cached
 */
export function isImageCached(src: string): boolean {
    return imageCache.has(src);
}

/**
 * Get cache stats for debugging
 */
export function getImageCacheStats() {
    return {
        cachedCount: imageCache.size,
        loadingCount: loadingPromises.size,
        cachedUrls: Array.from(imageCache.keys()).map(url => url.split('/').pop()),
    };
}

/**
 * Hook to preload multiple images
 */
export function useImagePreloader(imageUrls: string[]) {
    useEffect(() => {
        if (!imageUrls || imageUrls.length === 0) return;

        console.log(`[Preload] Starting preload of ${imageUrls.length} images...`);

        // Preload all images in parallel
        const promises = imageUrls
            .filter(url => url && typeof url === 'string')
            .map(url => preloadImage(url));

        Promise.all(promises)
            .then(() => {
                console.log(`[Preload] ✓ All ${imageUrls.length} images cached!`);
                console.log('[Cache Stats]', getImageCacheStats());
            })
            .catch(err => {
                console.error('[Preload] Some images failed to load:', err);
            });

    }, [imageUrls.join(',')]); // Re-run if image URLs change
}

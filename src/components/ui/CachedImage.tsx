'use client';

import { ImgHTMLAttributes, useState, useEffect, useRef } from 'react';

interface CachedImageProps extends ImgHTMLAttributes<HTMLImageElement> {
    src: string;
    alt: string;
}

// Global persistent cache - survives component unmounts
const globalImageCache = new Map<string, HTMLImageElement>();
const loadingImages = new Map<string, Promise<HTMLImageElement>>();

// Preload image and cache it
function preloadImage(src: string): Promise<HTMLImageElement> {
    // Return cached image if available
    if (globalImageCache.has(src)) {
        return Promise.resolve(globalImageCache.get(src)!);
    }

    // Return existing loading promise if image is being loaded
    if (loadingImages.has(src)) {
        return loadingImages.get(src)!;
    }

    // Create new loading promise
    const loadPromise = new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';

        img.onload = () => {
            globalImageCache.set(src, img);
            loadingImages.delete(src);
            resolve(img);
        };

        img.onerror = () => {
            loadingImages.delete(src);
            reject(new Error(`Failed to load image: ${src}`));
        };

        img.src = src;
    });

    loadingImages.set(src, loadPromise);
    return loadPromise;
}

export default function CachedImage({ src, alt, className, style, ...props }: CachedImageProps) {
    const [isLoaded, setIsLoaded] = useState(() => globalImageCache.has(src));
    const [error, setError] = useState(false);
    const imgRef = useRef<HTMLImageElement>(null);

    useEffect(() => {
        // If already cached, we're done
        if (globalImageCache.has(src)) {
            setIsLoaded(true);
            return;
        }

        // Preload the image
        let cancelled = false;

        preloadImage(src)
            .then(() => {
                if (!cancelled) {
                    setIsLoaded(true);
                }
            })
            .catch((err) => {
                if (!cancelled) {
                    console.error('Image load error:', err);
                    setError(true);
                    setIsLoaded(true);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [src]);

    return (
        <img
            ref={imgRef}
            src={src}
            alt={alt}
            className={className}
            crossOrigin="anonymous"
            loading="eager"
            decoding="async"
            {...props}
            style={{
                ...style,
                opacity: isLoaded ? 1 : 0,
                transition: 'opacity 0.15s ease-in-out',
            }}
        />
    );
}

// Export function to check cache status (for debugging)
export function getImageCacheStats() {
    return {
        cachedImages: globalImageCache.size,
        loadingImages: loadingImages.size,
        cachedUrls: Array.from(globalImageCache.keys()).map(url => url.split('/').pop()),
    };
}

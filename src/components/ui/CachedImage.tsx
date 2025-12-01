'use client';

import { ImgHTMLAttributes, useState, useEffect } from 'react';
import { isImageCached } from '@/hooks/useImagePreloader';

interface CachedImageProps extends ImgHTMLAttributes<HTMLImageElement> {
    src: string;
    alt: string;
}

export default function CachedImage({ src, alt, className, style, ...props }: CachedImageProps) {
    const [isLoaded, setIsLoaded] = useState(() => isImageCached(src));

    useEffect(() => {
        // Check if image is cached
        if (isImageCached(src)) {
            setIsLoaded(true);
        } else {
            // Wait a bit for preloader to cache it
            const timer = setTimeout(() => {
                setIsLoaded(true);
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [src]);

    return (
        <img
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
                transition: 'opacity 0.2s ease-in-out',
            }}
        />
    );
}

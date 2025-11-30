import { ImgHTMLAttributes, useState, useEffect } from 'react';

interface CachedImageProps extends ImgHTMLAttributes<HTMLImageElement> {
    src: string;
    alt: string;
}

// In-memory cache for loaded images
const imageCache = new Map<string, string>();

export default function CachedImage({ src, alt, className, ...props }: CachedImageProps) {
    const [imageSrc, setImageSrc] = useState<string>(() => {
        // Check if image is already in cache
        return imageCache.get(src) || src;
    });
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        // If already cached, mark as loaded
        if (imageCache.has(src)) {
            setIsLoaded(true);
            return;
        }

        // Preload image
        const img = new Image();
        img.crossOrigin = 'anonymous';

        img.onload = () => {
            // Cache the image URL
            imageCache.set(src, src);
            setImageSrc(src);
            setIsLoaded(true);
        };

        img.onerror = () => {
            console.error('Failed to load image:', src);
            setIsLoaded(true);
        };

        img.src = src;

        return () => {
            img.onload = null;
            img.onerror = null;
        };
    }, [src]);

    return (
        <img
            src={imageSrc}
            alt={alt}
            className={className}
            loading="eager"
            decoding="async"
            crossOrigin="anonymous"
            {...props}
            style={{
                ...props.style,
                opacity: isLoaded ? 1 : 0.5,
                transition: 'opacity 0.2s ease-in-out',
            }}
        />
    );
}

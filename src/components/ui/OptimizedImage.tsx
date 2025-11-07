import Image from 'next/image';
import { useState } from 'react';

interface OptimizedImageProps extends React.ComponentProps<typeof Image> {
  fallbackSrc?: string;
  containerClassName?: string;
}

export function OptimizedImage({
  src,
  alt = '',
  className = '',
  containerClassName = '',
  fallbackSrc = '/default-avatar.png',
  onError,
  ...props
}: OptimizedImageProps) {
  const [imgSrc, setImgSrc] = useState(src);
  const [isLoading, setIsLoading] = useState(true);

  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    if (imgSrc !== fallbackSrc) {
      setImgSrc(fallbackSrc);
    }
    onError?.(e);
  };

  return (
    <div className={`relative overflow-hidden ${containerClassName}`}>
      {isLoading && (
        <div className="absolute inset-0 bg-gray-200 animate-pulse" />
      )}
      <Image
        {...props}
        src={imgSrc}
        alt={alt}
        className={`${className} transition-opacity duration-300 ${
          isLoading ? 'opacity-0' : 'opacity-100'
        }`}
        onLoadingComplete={() => setIsLoading(false)}
        onError={handleError}
      />
    </div>
  );
}

'use client';

import { useEffect } from 'react';

type AdSenseProps = {
  slot: string;
  style?: React.CSSProperties;
  format?: string;
  layout?: string;
  layoutKey?: string;
  fullWidthResponsive?: boolean;
  className?: string;
};

export default function AdSense({
  slot,
  style = { display: 'block' },
  format = 'auto',
  layout = '',
  layoutKey = '',
  fullWidthResponsive = true,
  className = '',
}: AdSenseProps) {
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        // @ts-ignore
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      }
    } catch (err) {
      console.error('Error initializing AdSense:', err);
    }
  }, []);

  // Don't render ads during server-side rendering
  if (typeof window === 'undefined') {
    return null;
  }

  return (
    <div className={className}>
      <ins
        className="adsbygoogle"
        style={style}
        data-ad-client={process.env.NEXT_PUBLIC_GOOGLE_ADSENSE}
        data-ad-slot={slot}
        data-ad-format={format}
        data-ad-layout={layout}
        data-ad-layout-key={layoutKey}
        data-full-width-responsive={fullWidthResponsive.toString()}
      />
    </div>
  );
}

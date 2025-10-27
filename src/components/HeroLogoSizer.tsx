"use client";

import { useEffect, useMemo, useState } from "react";

export default function HeroLogoSizer() {
  const [mobilePx, setMobilePx] = useState(56);
  const [mdPx, setMdPx] = useState(80);
  const [isMd, setIsMd] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const handler = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsMd(("matches" in e ? e.matches : (e as MediaQueryList).matches));
    };
    handler(mq);
    mq.addEventListener ? mq.addEventListener("change", handler) : mq.addListener(handler as any);
    return () => {
      mq.removeEventListener ? mq.removeEventListener("change", handler) : mq.removeListener(handler as any);
    };
  }, []);

  const applied = useMemo(() => (isMd ? mdPx : mobilePx), [isMd, mdPx, mobilePx]);

  return (
    <div className="flex flex-col items-center">
      <div
        className="mx-auto mb-3 border-2 border-dashed border-red-500 bg-red-50/50 flex items-center justify-center"
        style={{ width: applied, height: applied }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png.PNG" alt="SUNOMSI logo" className="w-full h-full object-contain" />
      </div>
      <div className="flex items-center gap-4 text-sm text-gray-700">
        <div className="flex items-center gap-2">
          <span>Mobile</span>
          <input
            type="range"
            min={24}
            max={200}
            step={1}
            value={mobilePx}
            onChange={(e) => setMobilePx(parseInt(e.target.value, 10))}
          />
          <span>{mobilePx}px</span>
        </div>
        <div className="flex items-center gap-2">
          <span>md+</span>
          <input
            type="range"
            min={24}
            max={240}
            step={1}
            value={mdPx}
            onChange={(e) => setMdPx(parseInt(e.target.value, 10))}
          />
          <span>{mdPx}px</span>
        </div>
      </div>
    </div>
  );
}

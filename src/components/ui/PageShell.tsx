"use client";

import React from "react";

interface PageShellProps {
  header?: React.ReactNode;
  darkSection?: React.ReactNode;
  children?: React.ReactNode; // content below the dark section
  className?: string;
}

export default function PageShell({ header, darkSection, children, className = "" }: PageShellProps) {
  return (
    <div className={`relative rounded-[20px] shadow-lg overflow-hidden bg-white border border-gray-200 md:border-0 md:bg-[rgb(var(--color-card))] md:shadow-sm ${className}`}>
      {/* Header area */}
      {header && (
        <div className="p-5 pb-4">
          {header}
        </div>
      )}

      {/* Section below header (flattened, light) */}
      {darkSection && (
        <div className="bg-white text-gray-900 p-5 pt-4 border-t border-gray-200">
          {darkSection}
        </div>
      )}

      {/* Content below */}
      {children}
    </div>
  );
}

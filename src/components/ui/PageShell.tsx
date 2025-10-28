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
    <div className={`relative rounded-[28px] shadow-lg overflow-hidden bg-white border border-gray-200 md:border-0 md:bg-[rgb(var(--color-card))] md:shadow-sm ${className}`}>
      {/* Header area */}
      {header && (
        <div className="p-5 pb-20">
          {header}
        </div>
      )}

      {/* Dark section */}
      {darkSection && (
        <div className="bg-gray-900 text-white p-5 pt-12 rounded-t-[28px] -mt-10">
          {darkSection}
        </div>
      )}

      {/* Content below */}
      {children}
    </div>
  );
}

"use client";

import React from 'react';

interface AdPlaceholderProps {
  width?: string;
  height?: string;
  className?: string;
  type?: 'banner' | 'sidebar' | 'inline';
}

export default function AdPlaceholder({ 
  width = '100%', 
  height = '100px', 
  className = '',
  type = 'banner'
}: AdPlaceholderProps) {
  // Determine default dimensions based on ad type
  let defaultHeight = '100px';
  let defaultText = 'Advertisement';
  
  switch (type) {
    case 'banner':
      defaultHeight = '90px';
      break;
    case 'sidebar':
      defaultHeight = '600px';
      break;
    case 'inline':
      defaultHeight = '250px';
      break;
  }
  
  const finalHeight = height === '100%' ? defaultHeight : height;
  
  return (
    <div 
      className={`bg-gray-100 border border-dashed border-gray-300 flex items-center justify-center ${className}`}
      style={{ 
        width, 
        height: finalHeight,
        minHeight: '60px'
      }}
    >
      <span className="text-gray-500 text-sm">{defaultText}</span>
    </div>
  );
}
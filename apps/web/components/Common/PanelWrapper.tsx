/**
 * PanelWrapper Component
 * 
 * Reusable responsive wrapper for all content panels
 * Provides consistent styling, animations, and layout
 * 
 * Features:
 * - Responsive padding and spacing
 * - Smooth animations
 * - Consistent background and borders
 * - Mobile-friendly design
 * - Loading and empty states
 */

import React from 'react';

interface PanelWrapperProps {
  children: React.ReactNode;
  className?: string;
  isLoading?: boolean;
  loadingSkeletonLines?: number;
}

export function PanelWrapper({
  children,
  className = '',
  isLoading = false,
  loadingSkeletonLines = 3,
}: PanelWrapperProps) {
  if (isLoading) {
    return (
      <div className={`min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8 ${className}`}>
        <div className="max-w-7xl mx-auto space-y-4">
          {Array.from({ length: loadingSkeletonLines }).map((_, i) => (
            <div key={i} className="h-20 bg-white rounded-lg animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`
      min-h-screen bg-gradient-to-br from-gray-50 to-gray-100
      p-4 sm:p-6 lg:p-8
      transition-all duration-300 ease-out
      ${className}
    `}
    >
      <div className="max-w-7xl mx-auto">
        {children}
      </div>
    </div>
  );
}

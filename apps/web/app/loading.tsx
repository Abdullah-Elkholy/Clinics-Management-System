'use client';

import React from 'react';

/**
 * Global Loading Component
 * 
 * This is a Next.js Suspense boundary fallback.
 * Shown during:
 * - Initial page load
 * - Route transitions
 * - First-time compilation of a route
 * 
 * Prevents white screen / "compiler" feel.
 */
export default function Loading() {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-50/80 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-4">
                {/* Animated Logo/Spinner */}
                <div className="relative">
                    {/* Outer ring */}
                    <div className="w-16 h-16 border-4 border-blue-200 rounded-full animate-pulse" />
                    {/* Spinning ring */}
                    <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-t-blue-600 rounded-full animate-spin" />
                </div>

                {/* Loading text */}
                <div className="text-center">
                    <p className="text-lg font-medium text-gray-700 animate-pulse">
                        جارٍ التحميل...
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                        يرجى الانتظار
                    </p>
                </div>
            </div>
        </div>
    );
}

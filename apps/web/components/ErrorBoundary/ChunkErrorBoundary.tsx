'use client';

import { useEffect, ReactNode } from 'react';

interface ChunkErrorBoundaryProps {
  children: ReactNode;
}

/**
 * Error boundary component that handles chunk loading errors
 * Automatically reloads the page when a chunk fails to load
 */
export default function ChunkErrorBoundary({ children }: ChunkErrorBoundaryProps) {
  useEffect(() => {
    // Handle chunk loading errors
    const handleError = (event: ErrorEvent) => {
      const errorMessage = event.message || '';
      const isChunkError = 
        errorMessage.includes('chunk') ||
        errorMessage.includes('Loading chunk') ||
        errorMessage.includes('ChunkLoadError') ||
        event.error?.name === 'ChunkLoadError';
      
      if (isChunkError) {
        console.warn('Chunk load error detected, reloading page...', {
          message: errorMessage,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        });
        
        // Prevent default error handling
        event.preventDefault();
        
        // Reload the page after a short delay to allow error to be logged
        setTimeout(() => {
          window.location.reload();
        }, 100);
      }
    };

    // Handle unhandled promise rejections (chunk loading can throw these)
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const errorMessage = event.reason?.message || String(event.reason || '');
      const isChunkError = 
        errorMessage.includes('chunk') ||
        errorMessage.includes('Loading chunk') ||
        errorMessage.includes('ChunkLoadError') ||
        event.reason?.name === 'ChunkLoadError';
      
      if (isChunkError) {
        console.warn('Chunk load error in promise, reloading page...', {
          reason: event.reason,
        });
        
        // Prevent default error handling
        event.preventDefault();
        
        // Reload the page after a short delay
        setTimeout(() => {
          window.location.reload();
        }, 100);
      }
    };

    // Add event listeners
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    // Cleanup
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  return <>{children}</>;
}


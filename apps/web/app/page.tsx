'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';

/**
 * Root Page - Redirect Only
 * 
 * Middleware handles initial redirects, but this component provides
 * client-side fallback and handles auth state changes during session.
 */
export default function RootPage() {
  const router = useRouter();
  const { hasToken, isAuthenticated, isValidating } = useAuth();

  useEffect(() => {
    // Skip redirect during validation
    if (isValidating) {
      return;
    }

    // Redirect based on authentication state
    if (hasToken && isAuthenticated) {
      router.replace('/home');
    } else {
      router.replace('/login');
    }
  }, [hasToken, isAuthenticated, isValidating, router]);

  // Show loading while redirecting
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 to-purple-700">
      <div className="text-white text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
        <p className="text-lg">جاري التوجيه...</p>
      </div>
    </div>
  );
}

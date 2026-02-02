'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { useAuthGuard } from '../../hooks/useAuthGuard';
import LoginScreen from './LoginScreen';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * ProtectedRoute Component
 * Wraps routes that require authentication
 * - Shows loading state during auth initialization
 * - Redirects to login if not authenticated
 * - Prevents rendering protected content without auth
 * - Handles direct navigation to protected routes gracefully
 */
export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, user, isValidating, connectionError, retryConnection } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isInitialized, setIsInitialized] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const hasGlobalInitRef = useRef<boolean | null>(null);
  const maxWaitTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Use auth guard to protect routes
  useAuthGuard();

  // Maximum wait timeout to prevent infinite loading (10 seconds)
  useEffect(() => {
    maxWaitTimeoutRef.current = setTimeout(() => {
      console.warn('[ProtectedRoute] Max wait time reached, forcing initialization');
      setIsInitialized(true);
      setIsChecking(false);
      (window as any).__AUTH_INITIALIZED__ = true;
      hasGlobalInitRef.current = true;
    }, 10000);

    return () => {
      if (maxWaitTimeoutRef.current) {
        clearTimeout(maxWaitTimeoutRef.current);
      }
    };
  }, []);

  // One-time initialization; persist across navigations using a window flag
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (hasGlobalInitRef.current === null) {
      hasGlobalInitRef.current = (window as any).__AUTH_INITIALIZED__ === true;
    }
    if (hasGlobalInitRef.current) {
      // Already initialized in this session; skip loader
      if (maxWaitTimeoutRef.current) clearTimeout(maxWaitTimeoutRef.current);
      setIsInitialized(true);
      setIsChecking(false);
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      if (isValidating) {
        setIsInitialized(true);
        setIsChecking(true);
        return;
      }
      // No token: show login (redirect handled below in render logic)
      setIsInitialized(true);
      setIsChecking(false);
      (window as any).__AUTH_INITIALIZED__ = true;
      hasGlobalInitRef.current = true;
      return;
    }

    // Token exists; short timeout to allow AuthContext to validate
    const timer = setTimeout(() => {
      if (maxWaitTimeoutRef.current) clearTimeout(maxWaitTimeoutRef.current);
      setIsInitialized(true);
      if (!isAuthenticated && !user) {
        setIsChecking(true);
        const secondTimer = setTimeout(() => {
          setIsChecking(false);
        }, 400);
        return () => clearTimeout(secondTimer);
      } else {
        setIsChecking(false);
      }
      (window as any).__AUTH_INITIALIZED__ = true;
      hasGlobalInitRef.current = true;
    }, 100);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If auth state changes after initialization, update checking state
  useEffect(() => {
    if (isInitialized) {
      // If we have a token but not authenticated, still checking
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      if (token && !isAuthenticated && !user && !connectionError) {
        setIsChecking(true);
        // Wait a bit more for auth to complete, but not forever
        const timer = setTimeout(() => {
          console.warn('[ProtectedRoute] Auth validation timeout, stopping check');
          setIsChecking(false);
          // If still no auth after timeout, clear invalid token
          if (!isAuthenticated && !user) {
            console.warn('[ProtectedRoute] Clearing invalid token after timeout');
            localStorage.removeItem('token');
          }
        }, 3000); // Increased to 3 seconds max wait
        return () => clearTimeout(timer);
      } else {
        setIsChecking(false);
      }
    }
  }, [isAuthenticated, user, isInitialized, connectionError]);

  // Redirect to login if not authenticated (using useEffect to avoid setState during render)
  useEffect(() => {
    if (!isAuthenticated && !isValidating && pathname !== '/login' && pathname !== '/') {
      router.replace('/login');
    }
  }, [isAuthenticated, isValidating, pathname, router]);

  // Show connection error UI
  if (connectionError) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center max-w-md p-8">
          <div className="text-red-600 mb-4">
            <i className="fas fa-exclamation-triangle text-5xl"></i>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">خطأ في الاتصال</h2>
          <p className="text-gray-600 mb-6">{connectionError}</p>
          <button
            onClick={() => retryConnection && retryConnection()}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            <i className="fas fa-sync-alt ml-2"></i>
            إعادة المحاولة
          </button>
        </div>
      </div>
    );
  }

  // Show loading state during initialization
  if (!isInitialized || isChecking) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  // If not authenticated, handle based on validation state
  if (!isAuthenticated) {
    // During validation/refresh, show loading instead of redirecting
    if (isValidating) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-gray-600">جاري التحقق من الجلسة...</p>
          </div>
        </div>
      );
    }
    // Show loading while redirecting or show login screen
    if (pathname !== '/login' && pathname !== '/') {
      return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-gray-600">جاري إعادة التوجيه...</p>
          </div>
        </div>
      );
    }
    return <LoginScreen />;
  }

  // User is authenticated, render protected content
  return <>{children}</>;
}



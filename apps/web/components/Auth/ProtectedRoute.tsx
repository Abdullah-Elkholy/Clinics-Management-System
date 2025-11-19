'use client';

import { useEffect, useState, useRef } from 'react';
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
  const { isAuthenticated, user, isValidating } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isInitialized, setIsInitialized] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const hasGlobalInitRef = useRef<boolean | null>(null);

  // Use auth guard to protect routes
  useAuthGuard();

  // One-time initialization; persist across navigations using a window flag
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (hasGlobalInitRef.current === null) {
      hasGlobalInitRef.current = (window as any).__AUTH_INITIALIZED__ === true;
    }
    if (hasGlobalInitRef.current) {
      // Already initialized in this session; skip loader
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
      if (token && !isAuthenticated && !user) {
        setIsChecking(true);
        // Wait a bit more for auth to complete
        const timer = setTimeout(() => {
          setIsChecking(false);
        }, 500);
        return () => clearTimeout(timer);
      } else {
        setIsChecking(false);
      }
    }
  }, [isAuthenticated, user, isInitialized]);

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
    // Redirect to login page
    if (pathname !== '/login' && pathname !== '/') {
      router.replace('/login');
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



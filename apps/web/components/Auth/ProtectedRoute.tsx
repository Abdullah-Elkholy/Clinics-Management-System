'use client';

import { useEffect, useState } from 'react';
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
  const { isAuthenticated, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isInitialized, setIsInitialized] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  // Use auth guard to protect routes
  useAuthGuard();

  // Wait for auth state to initialize
  useEffect(() => {
    // Check if we have a token to determine if we should wait for auth
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    
    if (!token) {
      // No token, redirect immediately if trying to access protected route
      if (pathname !== '/') {
        // Use window.location for immediate redirect to prevent any flash
        window.location.replace('/');
        return;
      }
      setIsInitialized(true);
      setIsChecking(false);
      return;
    }
    
    // Token exists, wait a bit for AuthContext to validate it
    const timer = setTimeout(() => {
      setIsInitialized(true);
      // If still not authenticated after timeout, token might be invalid
      if (!isAuthenticated && !user) {
        // Still checking, wait a bit more
        setIsChecking(true);
        const secondTimer = setTimeout(() => {
          setIsChecking(false);
        }, 500);
        return () => clearTimeout(secondTimer);
      } else {
        setIsChecking(false);
      }
    }, 200);
    
    return () => clearTimeout(timer);
  }, [pathname, router, isAuthenticated, user]);

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

  // If not authenticated, redirect to login (auth guard should handle this, but double-check)
  if (!isAuthenticated) {
    // Redirect to home/login page
    if (pathname !== '/') {
      router.replace('/');
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



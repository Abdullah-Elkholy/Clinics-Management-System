/**
 * Authentication Guard Hook
 * Protects routes and handles authentication state changes
 */

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';
import logger from '../utils/logger';

/**
 * Hook to protect routes and handle auth state changes
 * - Validates token on route changes
 * - Redirects to login if not authenticated
 * - Prevents navigation loops
 */
export function useAuthGuard() {
  const { isAuthenticated, user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isCheckingRef = useRef(false);
  const lastPathRef = useRef<string | null>(null);

  useEffect(() => {
    // Skip if already checking or same path
    if (isCheckingRef.current || lastPathRef.current === pathname) {
      return;
    }

    // Skip check for root path during initial load
    if (pathname === '/' && lastPathRef.current === null) {
      lastPathRef.current = pathname;
      return;
    }

    isCheckingRef.current = true;
    lastPathRef.current = pathname;

    // Check authentication state
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    
    // Clean URL of any sensitive parameters
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (url.searchParams.has('username') || url.searchParams.has('password')) {
        url.searchParams.delete('username');
        url.searchParams.delete('password');
        window.history.replaceState({}, '', url.pathname + (url.search || ''));
      }
    }
    
    // If no token and trying to access protected route, redirect to login immediately
    if (!token && pathname !== '/') {
      logger.info('[AuthGuard] No token found, redirecting to login from:', pathname);
      // Use window.location for immediate redirect to ensure clean state
      window.location.href = '/';
      isCheckingRef.current = false;
      return;
    }
    
    // If token exists but user is not authenticated, wait for auth validation
    // But if we're on a protected route and not authenticated after a delay, redirect
    if (token && !isAuthenticated && pathname !== '/') {
      // AuthContext will handle validation on mount
      // Just wait a bit for it to complete, then check again
      const timeout = setTimeout(() => {
        // Re-check token and auth state
        const currentToken = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        // If token still exists but we're still not authenticated, it's likely invalid
        // Note: We can't check isAuthenticated here due to closure, so we'll let ProtectedRoute handle it
        isCheckingRef.current = false;
      }, 1000);
      
      return () => clearTimeout(timeout);
    }

    // If authenticated but on root, allow (will show MainApp)
    // If not authenticated and on root, allow (will show LoginScreen)
    if (pathname === '/') {
      isCheckingRef.current = false;
      return;
    }

    // If authenticated, allow navigation
    if (isAuthenticated) {
      isCheckingRef.current = false;
      return;
    }

    // If we reach here, we have a token but not authenticated yet
    // ProtectedRoute will handle the waiting and redirect if needed
    isCheckingRef.current = false;
  }, [pathname, isAuthenticated, router]);

  // Reset checking flag when auth state changes
  useEffect(() => {
    if (isAuthenticated || !user) {
      isCheckingRef.current = false;
    }
  }, [isAuthenticated, user]);
}


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

    // Skip check for root path and login during initial load
    if ((pathname === '/' || pathname === '/login') && lastPathRef.current === null) {
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
    if (!token && pathname !== '/login' && pathname !== '/') {
      logger.info('[AuthGuard] No token found, redirecting to login from:', pathname);
      // Use window.location for immediate redirect to ensure clean state
      window.location.href = '/login';
      isCheckingRef.current = false;
      return;
    }
    
    // If token exists but user is not authenticated, wait for auth validation
    // But if we're on a protected route and not authenticated after a delay, redirect
    if (token && !isAuthenticated && pathname !== '/login' && pathname !== '/') {
      // AuthContext will handle validation on mount
      // Wait briefly, then check again - reduced from 1000ms to 500ms
      const timeout = setTimeout(() => {
        // Re-check token and auth state
        const currentToken = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        // If token still exists but we're still not authenticated, it's likely invalid
        // Clear it to prevent infinite loops
        if (currentToken && !isAuthenticated) {
          logger.warn('[AuthGuard] Token exists but not authenticated after timeout, clearing');
          localStorage.removeItem('token');
          window.location.href = '/login';
        }
        isCheckingRef.current = false;
      }, 500); // Reduced timeout
      
      return () => clearTimeout(timeout);
    }

    // If authenticated but on login, allow (middleware will redirect to /home)
    // If not authenticated and on login, allow (user needs to log in)
    if (pathname === '/login') {
      isCheckingRef.current = false;
      return;
    }

    // If on root, allow (component will redirect based on auth state)
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


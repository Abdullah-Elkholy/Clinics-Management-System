/**
 * Authentication Guard Hook
 * Protects routes and handles authentication state changes
 */

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';
import logger from '../utils/logger';

// Configuration
const AUTH_VALIDATION_TIMEOUT_MS = 2000; // Max time to wait for auth validation

/**
 * Hook to protect routes and handle auth state changes
 * - Validates token on route changes
 * - Redirects to login if not authenticated
 * - Prevents navigation loops
 * - Clears stale tokens after timeout
 */
export function useAuthGuard() {
  const { isAuthenticated, user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isCheckingRef = useRef(false);
  const lastPathRef = useRef<string | null>(null);
  const validationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
      // Clear auth cookie to sync state
      document.cookie = 'auth=; Path=/; SameSite=Lax; Max-Age=0';
      router.replace('/login');
      isCheckingRef.current = false;
      return;
    }
    
    // If token exists but user is not authenticated, wait for auth validation with timeout
    if (token && !isAuthenticated && pathname !== '/login' && pathname !== '/') {
      // Set a timeout to clear stale token if auth doesn't complete
      validationTimeoutRef.current = setTimeout(() => {
        const currentToken = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        const authCookie = document.cookie.includes('auth=1');
        
        // If token still exists but we're still not authenticated, it's likely invalid
        if (currentToken && !isAuthenticated && !authCookie) {
          logger.warn('[AuthGuard] Token exists but auth failed after 2s, clearing');
          localStorage.removeItem('token');
          document.cookie = 'auth=; Path=/; SameSite=Lax; Max-Age=0';
        }
        
        isCheckingRef.current = false;
      }, AUTH_VALIDATION_TIMEOUT_MS);
      
      return () => {
        if (validationTimeoutRef.current) {
          clearTimeout(validationTimeoutRef.current);
        }
      };
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
  
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (validationTimeoutRef.current) {
        clearTimeout(validationTimeoutRef.current);
      }
    };
  }, []);
}


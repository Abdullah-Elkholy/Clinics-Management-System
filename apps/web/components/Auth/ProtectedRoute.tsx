'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { useAuthGuard } from '../../hooks/useAuthGuard';
import LoginScreen from './LoginScreen';
import logger from '../../utils/logger';
import { LoopDetector } from '../../utils/loopDetector';

// Extend Window interface for auth initialization flag
declare global {
  interface Window {
    __AUTH_INITIALIZED__?: boolean;
  }
}

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
  const [forceRender, setForceRender] = useState(false);
  const hasGlobalInitRef = useRef<boolean | null>(null);
  const maxWaitTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountTimeRef = useRef<number>(Date.now());
  const isMountedRef = useRef(true);

  // Use auth guard to protect routes
  useAuthGuard();
  
  // Reset loop detector on successful auth
  useEffect(() => {
    if (isAuthenticated && user) {
      LoopDetector.reset();
    }
  }, [isAuthenticated, user]);

  // Maximum wait timeout to prevent infinite loading (5 seconds absolute max)
  useEffect(() => {
    isMountedRef.current = true;
    
    // Check for page load loop (too many rapid page loads)
    if (LoopDetector.recordPageLoad()) {
      logger.error('[ProtectedRoute] Too many page loads, executing emergency break');
      LoopDetector.emergencyBreak();
      return;
    }
    
    // Skip further checks if emergency break was recently executed
    if (LoopDetector.wasEmergencyBreakRecent()) {
      logger.warn('[ProtectedRoute] Emergency break recently executed, skipping init');
      setIsInitialized(true);
      setIsChecking(false);
      return;
    }
    
    // Check for infinite loop in auth attempts
    if (LoopDetector.recordAttempt('ProtectedRoute')) {
      logger.error('[ProtectedRoute] Infinite loop detected, executing emergency break');
      LoopDetector.emergencyBreak();
      return;
    }
    
    // Aggressive timeout - force render after 5 seconds no matter what
    const absoluteMaxTimeout = setTimeout(() => {
      if (!isMountedRef.current) return;
      logger.warn('[ProtectedRoute] Absolute max wait reached (5s), forcing render');
      setIsInitialized(true);
      setIsChecking(false);
      setForceRender(true);
      window.__AUTH_INITIALIZED__ = true;
      hasGlobalInitRef.current = true;
      
      // If no token and still not authenticated, clear everything
      const token = localStorage.getItem('token');
      if (token && !isAuthenticated) {
        logger.warn('[ProtectedRoute] Clearing stuck token');
        localStorage.removeItem('token');
      }
    }, 5000);

    return () => {
      isMountedRef.current = false;
      clearTimeout(absoluteMaxTimeout);
      if (maxWaitTimeoutRef.current) {
        clearTimeout(maxWaitTimeoutRef.current);
      }
    };
  }, [isAuthenticated]);

  // One-time initialization; persist across navigations using a window flag
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (hasGlobalInitRef.current === null) {
      hasGlobalInitRef.current = window.__AUTH_INITIALIZED__ === true;
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
      window.__AUTH_INITIALIZED__ = true;
      hasGlobalInitRef.current = true;
      return;
    }

    // Token exists; short timeout to allow AuthContext to validate
    const timer = setTimeout(() => {
      if (!isMountedRef.current) return;
      if (maxWaitTimeoutRef.current) clearTimeout(maxWaitTimeoutRef.current);
      setIsInitialized(true);
      if (!isAuthenticated && !user) {
        setIsChecking(true);
        const secondTimer = setTimeout(() => {
          if (!isMountedRef.current) return;
          setIsChecking(false);
          // Force break if stuck too long
          if (Date.now() - mountTimeRef.current > 3000) {
            logger.warn('[ProtectedRoute] Forcing break after 3s');
            setForceRender(true);
          }
        }, 300); // Reduced from 400ms
        return () => clearTimeout(secondTimer);
      } else {
        setIsChecking(false);
      }
      window.__AUTH_INITIALIZED__ = true;
      hasGlobalInitRef.current = true;
    }, 50); // Reduced from 100ms

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If auth state changes after initialization, update checking state
  useEffect(() => {
    if (isInitialized) {
      // If we have a token but not authenticated, still checking
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      if (token && !isAuthenticated && !user && !connectionError) {
        // Check if we've been stuck too long
        const elapsedTime = Date.now() - mountTimeRef.current;
        if (elapsedTime > 4000) {
          logger.warn('[ProtectedRoute] Stuck for >4s, forcing clear');
          localStorage.removeItem('token');
          setIsChecking(false);
          setForceRender(true);
          return;
        }
        
        setIsChecking(true);
        // Reduced wait time for auth validation
        const timer = setTimeout(() => {
          if (!isMountedRef.current) return;
          logger.warn('[ProtectedRoute] Auth validation timeout after 2s');
          setIsChecking(false);
          // If still no auth after timeout, clear invalid token
          if (!isAuthenticated && !user) {
            logger.warn('[ProtectedRoute] Clearing invalid token');
            localStorage.removeItem('token');
            setForceRender(true);
          }
        }, 2000); // Reduced from 3000ms
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
    // Force render login if we've been stuck too long
    if (forceRender || Date.now() - mountTimeRef.current > 6000) {
      logger.warn('[ProtectedRoute] Force rendering login screen');
      return <LoginScreen />;
    }
    
    // During validation/refresh, show loading instead of redirecting
    if (isValidating && !forceRender) {
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




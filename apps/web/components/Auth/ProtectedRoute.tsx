'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { useAuthGuard } from '../../hooks/useAuthGuard';
import { LoopDetector } from '../../utils/loopDetector';
import logger from '../../utils/logger';
import LoginScreen from './LoginScreen';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

// Configuration
const MAX_WAIT_TIME_MS = 5000; // Absolute maximum wait time for any state
const CHECKING_TIMEOUT_MS = 2000; // Max time to stay in "checking" state

/**
 * ProtectedRoute Component
 * Wraps routes that require authentication
 * - Shows loading state during auth initialization
 * - Redirects to login if not authenticated
 * - Prevents rendering protected content without auth
 * - Handles direct navigation to protected routes gracefully
 * - Includes loop detection and emergency break mechanism
 */
export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, user, isValidating, connectionError, retryConnection } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isInitialized, setIsInitialized] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [forceRender, setForceRender] = useState(false);
  const hasGlobalInitRef = useRef<boolean | null>(null);
  const checkingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountTimeRef = useRef<number>(Date.now());
  const isMountedRef = useRef(true);

  // Use auth guard to protect routes
  useAuthGuard();

  // Reset loop detector when successfully authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      LoopDetector.reset();
    }
  }, [isAuthenticated, user]);

  // Main initialization effect with loop detection and max wait
  useEffect(() => {
    isMountedRef.current = true;
    
    // Check for too many page loads (stuck state detection)
    if (LoopDetector.recordPageLoad()) {
      logger.error('[ProtectedRoute] Too many page loads, executing emergency break');
      LoopDetector.emergencyBreak();
      return;
    }
    
    // Check if emergency break was recently executed - skip normal init
    if (LoopDetector.wasEmergencyBreakRecent()) {
      logger.warn('[ProtectedRoute] Emergency break recently executed, skipping init');
      setIsInitialized(true);
      setIsChecking(false);
      return;
    }
    
    // Check for redirect loop
    if (LoopDetector.recordAttempt('ProtectedRoute')) {
      logger.error('[ProtectedRoute] Infinite loop detected, executing emergency break');
      LoopDetector.emergencyBreak();
      return;
    }
    
    // Set absolute maximum wait timeout
    const maxWaitTimeout = setTimeout(() => {
      if (isMountedRef.current) {
        logger.warn('[ProtectedRoute] Absolute max wait reached (5s), forcing render');
        setIsInitialized(true);
        setIsChecking(false);
        setForceRender(true);
        (window as any).__AUTH_INITIALIZED__ = true;
        hasGlobalInitRef.current = true;
        
        // If we still have token but no auth, clear it
        const token = localStorage.getItem('token');
        if (token && !isAuthenticated) {
          logger.warn('[ProtectedRoute] Clearing stuck token');
          localStorage.removeItem('token');
        }
      }
    }, MAX_WAIT_TIME_MS);
    
    return () => {
      isMountedRef.current = false;
      clearTimeout(maxWaitTimeout);
      if (checkingTimeoutRef.current) {
        clearTimeout(checkingTimeoutRef.current);
      }
    };
  }, [isAuthenticated]);

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
      if (!isMountedRef.current) return;
      
      setIsInitialized(true);
      if (!isAuthenticated && !user) {
        setIsChecking(true);
        // Set a max timeout for checking state
        checkingTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            setIsChecking(false);
          }
        }, CHECKING_TIMEOUT_MS);
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
        
        // Clear previous timeout if any
        if (checkingTimeoutRef.current) {
          clearTimeout(checkingTimeoutRef.current);
        }
        
        // Set timeout to prevent infinite checking
        checkingTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            logger.warn('[ProtectedRoute] Checking timeout reached, clearing token');
            setIsChecking(false);
            
            // Token validation failed - clear it and sync cookie
            localStorage.removeItem('token');
            document.cookie = 'auth=; Path=/; SameSite=Lax; Max-Age=0';
          }
        }, CHECKING_TIMEOUT_MS);
        
        return () => {
          if (checkingTimeoutRef.current) {
            clearTimeout(checkingTimeoutRef.current);
          }
        };
      } else {
        setIsChecking(false);
        // Clear timeout since we're done checking
        if (checkingTimeoutRef.current) {
          clearTimeout(checkingTimeoutRef.current);
          checkingTimeoutRef.current = null;
        }
      }
    }
  }, [isAuthenticated, user, isInitialized]);

  // Redirect to login if not authenticated (using useEffect to avoid setState during render)
  useEffect(() => {
    if (!isAuthenticated && !isValidating && pathname !== '/login' && pathname !== '/') {
      // Also clear auth cookie to prevent middleware redirect loop
      document.cookie = 'auth=; Path=/; SameSite=Lax; Max-Age=0';
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



'use client';

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUI } from './UIContext';
import type { User, AuthState } from '../types';
import { UserRole } from '@/types/roles';
import { login as loginApi, logout as logoutApi, getCurrentUser, refreshAccessToken } from '@/services/api/authApiClient';
import logger from '@/utils/logger';
import { registerAuthErrorHandler, unregisterAuthErrorHandler } from '@/utils/apiInterceptor';
import { LoopDetector } from '@/utils/loopDetector';

// Retry/backoff configuration
const RETRY_DELAYS = [300, 900]; // ms delays for up to 2 retries

// Token refresh configuration
const TOKEN_REFRESH_BUFFER = 5 * 60 * 1000; // Refresh 5 minutes before expiry

// Validation timeout - maximum time to wait for auth validation
const VALIDATION_TIMEOUT_MS = 5000; // 5 seconds max

/**
 * Helper function to decode JWT token payload
 */
function decodeJWT(token: string): { exp?: number;[key: string]: any } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = parts[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return decoded;
  } catch (error) {
    logger.error('[Auth] Failed to decode JWT:', error);
    return null;
  }
}

// Type definition for Auth context shape
interface AuthContextType extends AuthState {
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  clearNavigationFlag: () => void;
  retryConnection: () => void;
  hasToken: boolean;
  isValidating: boolean;
  isNavigatingToHome: boolean;
  connectionError: string | null;
}

const AuthContext = createContext<AuthContextType | null>(null);

/**
 * Helper function to set auth presence cookie
 * Used by middleware for server-side route protection
 */
function setAuthCookie(isAuthenticated: boolean) {
  if (typeof document === 'undefined') return;

  if (isAuthenticated) {
    // Set cookie with SameSite=Lax for navigation, expires in 7 days
    document.cookie = 'auth=1; Path=/; SameSite=Lax; Max-Age=604800';
  } else {
    // Clear cookie by setting Max-Age=0
    document.cookie = 'auth=; Path=/; SameSite=Lax; Max-Age=0';
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
  });
  const [isValidating, setIsValidating] = useState(true);
  const [hasToken, setHasToken] = useState(false);
  const [isNavigatingToHome, setIsNavigatingToHome] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const { addToast } = useUI();
  const router = useRouter();

  // Refs for managing retry/backoff and preemption
  const attemptIdRef = useRef(0); // Incremented on each new login attempt
  const lastToastMessageRef = useRef<string>(''); // Track last toast to avoid duplicates
  const isInitializingRef = useRef(false); // Prevent multiple initialization attempts
  const validationTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Timeout for validation

  // Restore authentication state from localStorage on mount
  useEffect(() => {
    // Only run once on mount
    if (isInitializingRef.current) return;
    isInitializingRef.current = true;

    // Set up validation timeout - force complete after VALIDATION_TIMEOUT_MS
    validationTimeoutRef.current = setTimeout(() => {
      logger.warn('[Auth] Validation timeout reached (5s), forcing validation complete');
      setIsValidating(false);
      
      // If we still have a token but no user, the token is likely invalid
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      if (token && !authState.isAuthenticated) {
        logger.warn('[Auth] Token exists but validation timed out - clearing token');
        localStorage.removeItem('token');
        setHasToken(false);
        setAuthCookie(false);
      }
    }, VALIDATION_TIMEOUT_MS);

    const restoreAuth = async () => {
      setIsValidating(true);
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        setHasToken(!!token);

        if (!token) {
          // No access token - attempt refresh using HttpOnly cookie (if available)
          try {
            const refreshed = await refreshAccessToken();
            if (refreshed?.accessToken) {
              localStorage.setItem('token', refreshed.accessToken);
              setHasToken(true);
            } else {
              // Still no token, user is not authenticated
              setAuthCookie(false);
              setIsValidating(false);
              // Clear timeout since we're done
              if (validationTimeoutRef.current) {
                clearTimeout(validationTimeoutRef.current);
                validationTimeoutRef.current = null;
              }
              return;
            }
          } catch {
            setAuthCookie(false);
            setIsValidating(false);
            // Clear timeout since we're done
            if (validationTimeoutRef.current) {
              clearTimeout(validationTimeoutRef.current);
              validationTimeoutRef.current = null;
            }
            return;
          }
        }

        // Verify token is valid by fetching current user
        try {
          const userData = await getCurrentUser();
          if (userData) {
            // Extract role from user data
            const role = userData.role as UserRole;

            // Debug log in development
            if (process.env.NODE_ENV === 'development') {
              logger.info('[Auth Restore] User data from API:', userData);
              logger.info('[Auth Restore] Extracted role:', role);
            }

            // Store complete user data from API response
            setAuthState({
              user: {
                id: userData.id,
                username: userData.username,
                firstName: userData.firstName || '',
                lastName: userData.lastName || '',
                role: role,
                isActive: userData.isActive ?? true,
                createdAt: userData.createdAt || new Date(),
                updatedAt: userData.updatedAt || new Date(),
                lastLogin: userData.lastLogin,
                assignedModerator: userData.assignedModerator,
                moderatorQuota: userData.moderatorQuota,
                createdBy: userData.createdBy,
                isDeleted: userData.isDeleted,
                deletedAt: userData.deletedAt,
              },
              isAuthenticated: true,
            });
            setAuthCookie(true);
            // Reset loop detector on successful auth
            LoopDetector.reset();
            logger.info('[Auth] Restored authentication state from localStorage');
          }
        } catch (error) {
          // Token is invalid or expired, clear it
          logger.warn('[Auth] Token validation failed, clearing localStorage');
          localStorage.removeItem('token');
          localStorage.removeItem('selectedQueueId');
          setHasToken(false);
          setAuthCookie(false);
          setAuthState({
            user: null,
            isAuthenticated: false,
          });
        }
      } catch (error) {
        logger.error('[Auth] Failed to restore authentication:', error);
        setConnectionError('الخادم غير متاح. يرجى المحاولة لاحقاً');
        setAuthCookie(false);
        // On error, assume not authenticated
        setAuthState({
          user: null,
          isAuthenticated: false,
        });
      } finally {
        setIsValidating(false);
        // Clear validation timeout
        if (validationTimeoutRef.current) {
          clearTimeout(validationTimeoutRef.current);
          validationTimeoutRef.current = null;
        }
      }
    };

    restoreAuth();
    
    // Cleanup timeout on unmount
    return () => {
      if (validationTimeoutRef.current) {
        clearTimeout(validationTimeoutRef.current);
        validationTimeoutRef.current = null;
      }
    };
  }, []); // Empty deps - only run on mount

  // Proactive token refresh - refresh token before expiration
  useEffect(() => {
    if (!hasToken || !authState.isAuthenticated) {
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) return;

    const decoded = decodeJWT(token);
    if (!decoded || !decoded.exp) {
      logger.warn('[Auth] Token has no expiration, skipping proactive refresh');
      return;
    }

    const expiryTime = decoded.exp * 1000; // Convert to milliseconds
    const currentTime = Date.now();
    const timeUntilRefresh = expiryTime - currentTime - TOKEN_REFRESH_BUFFER;

    if (timeUntilRefresh <= 0) {
      // Token already expired or about to expire, refresh immediately
      logger.info('[Auth] Token expired or about to expire, refreshing immediately');
      refreshAccessToken()
        .then((refreshed) => {
          if (refreshed?.accessToken) {
            localStorage.setItem('token', refreshed.accessToken);
            setHasToken(true);
            logger.info('[Auth] Token refreshed successfully');
          }
        })
        .catch((error) => {
          logger.error('[Auth] Failed to refresh expired token:', error);
        });
      return;
    }

    logger.info(`[Auth] Scheduling token refresh in ${Math.round(timeUntilRefresh / 1000 / 60)} minutes`);

    const timeoutId = setTimeout(async () => {
      logger.info('[Auth] Proactively refreshing token');
      try {
        const refreshed = await refreshAccessToken();
        if (refreshed?.accessToken) {
          localStorage.setItem('token', refreshed.accessToken);
          setHasToken(true);
          logger.info('[Auth] Token refreshed successfully');
        } else {
          logger.warn('[Auth] Token refresh returned no access token');
        }
      } catch (error) {
        logger.error('[Auth] Failed to proactively refresh token:', error);
      }
    }, timeUntilRefresh);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [hasToken, authState.isAuthenticated]);

  const login = useCallback(async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    // Increment attempt ID to enable preemption of older retry loops
    const myAttemptId = ++attemptIdRef.current;

    // Check offline at the start
    if (!navigator.onLine) {
      const offlineMsg = 'أنت غير متصل بالإنترنت';
      if (lastToastMessageRef.current !== offlineMsg) {
        const debugData = process.env.NEXT_PUBLIC_DEBUG_ERRORS === 'true'
          ? { error: 'Network offline', timestamp: new Date().toISOString() }
          : undefined;
        addToast(offlineMsg, 'error', debugData);
        lastToastMessageRef.current = offlineMsg;
      }
      return { success: false, error: offlineMsg };
    }

    let finalError: string | undefined;

    // Retry loop with exponential backoff
    for (let attemptNumber = 0; attemptNumber <= RETRY_DELAYS.length; attemptNumber++) {
      // Check if this attempt was preempted by a newer login call
      if (myAttemptId !== attemptIdRef.current) {
        // A newer attempt started; silently abort retries
        return { success: false, error: undefined };
      }

      // Delay before retry (skip for first attempt)
      if (attemptNumber > 0) {
        const delayMs = RETRY_DELAYS[attemptNumber - 1];
        await new Promise(resolve => setTimeout(resolve, delayMs));

        // Re-check preemption and offline after delay
        if (myAttemptId !== attemptIdRef.current) {
          return { success: false, error: undefined };
        }
        if (!navigator.onLine) {
          const offlineMsg = 'أنت غير متصل بالإنترنت';
          if (lastToastMessageRef.current !== offlineMsg) {
            const debugData = process.env.NEXT_PUBLIC_DEBUG_ERRORS === 'true'
              ? { error: 'Network went offline during retry', attempt: attemptNumber + 1, timestamp: new Date().toISOString() }
              : undefined;
            addToast(offlineMsg, 'error', debugData);
            lastToastMessageRef.current = offlineMsg;
          }
          return { success: false, error: offlineMsg };
        }
      }

      try {
        const response = await loginApi({ username, password });

        if (response.success && response.data?.accessToken) {
          // Store token in localStorage
          localStorage.setItem('token', response.data.accessToken);

          // Decode token to get user info (JWT payload is base64-encoded JSON)
          const parts = response.data.accessToken.split('.');
          if (parts.length === 3) {
            try {
              // Properly decode Base64 with UTF-8 support for Arabic characters
              // atob() doesn't handle UTF-8 properly, so we use a helper function
              const decodeBase64 = (str: string): string => {
                try {
                  // Replace URL-safe Base64 characters: - becomes +, _ becomes /
                  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
                  // Decode using TextDecoder for proper UTF-8 handling
                  const binaryString = atob(base64);
                  const bytes = new Uint8Array(binaryString.length);
                  for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                  }
                  return new TextDecoder('utf-8').decode(bytes);
                } catch (e) {
                  logger.error('❌ Base64 decoding failed:', e);
                  throw new Error('Failed to decode JWT payload');
                }
              };

              const decoded = JSON.parse(decodeBase64(parts[1]));

              // Debug JWT parsing (disabled in production; uncomment for troubleshooting)
              // console.log('🔐 Full JWT Payload:', JSON.stringify(decoded, null, 2));

              // Extract role - Try MULTIPLE possible claim keys that JWT might use
              // JWT standard claim type keys can be in different formats
              const roleFromDirect = decoded.role;  // Direct "role" claim
              const roleFromClaimType = decoded['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'];  // ClaimTypes.Role
              const roleFromAllClaims = Object.entries(decoded).find(([k, v]) => k.toLowerCase().includes('role'));

              const roleValue = roleFromDirect || roleFromClaimType || (roleFromAllClaims ? roleFromAllClaims[1] : undefined);

              // Debug role extraction (disabled in production)
              if (process.env.NODE_ENV === 'development') {
                // console.log('🔐 Role Extraction Debug:', {
                //   roleFromDirect: `"${roleFromDirect}"`,
                //   roleFromClaimType: `"${roleFromClaimType}"`,
                //   roleFromAllClaims: roleFromAllClaims ? `${roleFromAllClaims[0]} = "${roleFromAllClaims[1]}"` : 'NOT_FOUND',
                //   finalRoleValue: `"${roleValue}"`,
                //   isRolePrimaryAdmin: roleValue === 'primary_admin',
                //   isRoleString: typeof roleValue === 'string',
                // });
              }

              // Ensure we have a valid role value
              const finalRole = (roleValue as UserRole) || UserRole.User;

              // Validate that the role is one of the allowed values
              const validRoles: UserRole[] = [UserRole.PrimaryAdmin, UserRole.SecondaryAdmin, UserRole.Moderator, UserRole.User];
              const isValidRole = validRoles.includes(finalRole);

              // Debug role validation (disabled in production)
              if (process.env.NODE_ENV === 'development' && !isValidRole) {
                // console.log('🔐 Role Validation:', {
                //   roleValue: finalRole,
                //   isValidRole: isValidRole,
                //   validRoles: validRoles,
                //   matchesPrimaryAdmin: finalRole === UserRole.PrimaryAdmin,
                // });
              }

              if (!isValidRole) {
                // console.warn(`⚠️ Invalid role "${finalRole}", defaulting to User role`);
              }

              // Map JWT claims to User object
              // Note: JwtTokenService creates claims with keys: "firstName", "lastName", "role"
              const user: User = {
                id: decoded.sub || decoded.userId || '',
                username: decoded.name || decoded.username || username,
                firstName: decoded.firstName || 'User',
                lastName: decoded.lastName || '',
                role: finalRole,
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date(),
              };

              // Debug UTF-8 name verification (disabled in production)
              if (process.env.NODE_ENV === 'development') {
                // console.log('🔐 User Names (UTF-8 Check):', {
                //   firstName: `"${user.firstName}"`,
                //   lastName: `"${user.lastName}"`,
                //   firstNameLength: user.firstName.length,
                //   lastNameLength: user.lastName.length,
                // });
              }

              setAuthState({
                user,
                isAuthenticated: true,
              });
              setHasToken(true);
              setAuthCookie(true);
              
              // Reset loop detector on successful login
              LoopDetector.reset();

              // Refresh user data from backend to populate assignedModerator and other fields
              // This ensures the user object has all necessary data (especially for regular users)
              // Call getCurrentUser directly to avoid dependency issues
              // Use setTimeout to ensure token is fully saved and available
              setTimeout(() => {
                getCurrentUser()
                  .then((freshUserData) => {
                    if (freshUserData) {
                      setAuthState((prev) => {
                        if (!prev.user) return prev;
                        return {
                          ...prev,
                          user: {
                            ...prev.user,
                            id: freshUserData.id || prev.user.id,
                            username: freshUserData.username || prev.user.username,
                            firstName: freshUserData.firstName || prev.user.firstName,
                            lastName: freshUserData.lastName || prev.user.lastName,
                            role: freshUserData.role || prev.user.role,
                            isActive: freshUserData.isActive ?? prev.user.isActive,
                            createdAt: freshUserData.createdAt || prev.user.createdAt,
                            updatedAt: freshUserData.updatedAt || prev.user.updatedAt,
                            lastLogin: freshUserData.lastLogin || prev.user.lastLogin,
                            assignedModerator: freshUserData.assignedModerator || prev.user.assignedModerator,
                            moderatorQuota: freshUserData.moderatorQuota || prev.user.moderatorQuota,
                            createdBy: freshUserData.createdBy || prev.user.createdBy,
                            isDeleted: freshUserData.isDeleted || prev.user.isDeleted,
                            deletedAt: freshUserData.deletedAt || prev.user.deletedAt,
                          },
                        };
                      });
                    }
                  })
                  .catch((err) => {
                    // Silently fail - user can still use the app, data will refresh on next page load
                    // Don't trigger logout - this is just a data refresh, not a critical auth failure
                    if (process.env.NODE_ENV === 'development') {
                      logger.warn('Failed to refresh user data after login (non-critical):', err);
                    }
                    // User object from JWT is still valid, so keep them authenticated
                  });
              }, 100); // Small delay to ensure token is saved

              // Clean URL of any sensitive parameters after successful login
              if (typeof window !== 'undefined') {
                const url = new URL(window.location.href);
                if (url.searchParams.has('username') || url.searchParams.has('password')) {
                  url.searchParams.delete('username');
                  url.searchParams.delete('password');
                  // Replace URL without sensitive params (don't add to history)
                  window.history.replaceState({}, '', url.pathname + (url.search || ''));
                }
              }

              // Redirect to home after successful login
              setIsNavigatingToHome(true);
              router.replace('/home');

              return { success: true };
            } catch (e) {
              logger.warn('Failed to decode JWT:', e);
              // Still set user as authenticated even if decode fails
              setAuthState({
                user: {
                  id: '1',
                  username,
                  firstName: username,
                  lastName: '',
                  role: UserRole.User,
                  isActive: true,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                },
                isAuthenticated: true,
              });
              setHasToken(true);
              setAuthCookie(true);

              // Clean URL of any sensitive parameters after successful login
              if (typeof window !== 'undefined') {
                const url = new URL(window.location.href);
                if (url.searchParams.has('username') || url.searchParams.has('password')) {
                  url.searchParams.delete('username');
                  url.searchParams.delete('password');
                  // Replace URL without sensitive params (don't add to history)
                  window.history.replaceState({}, '', url.pathname + (url.search || ''));
                }
              }

              // Redirect to home after successful login
              setIsNavigatingToHome(true);
              router.replace('/home');

              return { success: true };
            }
          }
        }

        // If response is not success, treat as retryable or non-retryable error
        // Note: login() will throw ApiError if !response.ok, so we only reach here if response.ok but response.success is false
        const err = new Error('Login response not successful') as any;
        err.statusCode = 400; // Treat as client error since response was OK but login failed
        err.message = 'فشل تسجيل الدخول';
        throw err;
      } catch (error) {
        const err = error as any;

        // Rich error log to avoid {} empty object in console (development only)
        if (process.env.NODE_ENV === 'development') {
          try {
            logger.error(`Login error (attempt ${attemptNumber + 1}/${RETRY_DELAYS.length + 1}):`, {
              raw: err,
              type: typeof err,
              keys: err ? Object.keys(err) : [],
              name: err?.name,
              message: err?.message,
              statusCode: err?.statusCode,
              stack: err?.stack,
              details: err?.details,
            });
          } catch { }
        }

        // Determine if this is retryable
        const isRetryable = typeof err?.statusCode !== 'number' || err.statusCode >= 500;
        const isCredentialError = err?.statusCode === 401 || err?.statusCode === 403;

        if (isCredentialError) {
          // Never retry on credential errors; return immediately without toast
          finalError = 'بيانات تسجيل الدخول غير صحيحة';
          break;
        }

        // Set finalError for potential retry or final return
        if (typeof err?.statusCode === 'number' && err.statusCode >= 400 && err.statusCode < 500) {
          // Non-credential 4xx; not retryable
          finalError = err?.message || 'فشل طلب تسجيل الدخول';
          break;
        } else if (typeof err?.statusCode === 'number' && err.statusCode >= 500) {
          // Server error; retryable
          finalError = 'حدث خطأ في الخادم، يرجى المحاولة لاحقاً';
        } else {
          // Network or unknown error; retryable
          finalError = err?.message || 'حدث خطأ أثناء الاتصال بالخادم';
        }

        // If not retryable, break immediately
        if (!isRetryable) {
          break;
        }

        // Continue to next attempt (if any remain)
        if (attemptNumber < RETRY_DELAYS.length) {
          // Debug: log retry attempts (disabled in production)
          if (process.env.NODE_ENV === 'development') {
            // console.log(`⏳ Retrying login in ${RETRY_DELAYS[attemptNumber]}ms...`);
          }
        }
      }
    }

    // Return final error after retries exhausted or on non-retryable failure
    if (finalError) {
      // Only toast if not a credential error (credential errors show inline on form)
      if (!(finalError === 'بيانات تسجيل الدخول غير صحيحة')) {
        if (lastToastMessageRef.current !== finalError) {
          // Pass debug data if debug mode is enabled
          const debugData = process.env.NEXT_PUBLIC_DEBUG_ERRORS === 'true'
            ? {
              error: finalError,
              attempts: RETRY_DELAYS.length + 1,
              timestamp: new Date().toISOString()
            }
            : undefined;
          addToast(finalError, 'error', debugData);
          lastToastMessageRef.current = finalError;
        }
      }
      return { success: false, error: finalError };
    }

    return { success: false, error: 'فشل تسجيل الدخول' };
  }, [addToast]);

  const clearNavigationFlag = useCallback(() => {
    setIsNavigatingToHome(false);
  }, []);

  const retryConnection = useCallback(() => {
    setConnectionError(null);
    setRetryCount(0);
    isInitializingRef.current = false;
    window.location.reload();
  }, []);

  const logout = useCallback(async () => {
    // Clear auth state first (immediate UI feedback)
    setAuthState({
      user: null,
      isAuthenticated: false,
    });
    setHasToken(false);
    setAuthCookie(false);

    // Clear any stored state immediately
    if (typeof window !== 'undefined') {
      // Remove authentication token
      localStorage.removeItem('token');

      // Remove user-specific data
      localStorage.removeItem('selectedQueueId');

      // Clear any session storage
      sessionStorage.clear();

      // Clean URL of any parameters
      const url = new URL(window.location.href);
      url.search = '';

      // Use replaceState to update URL without reload
      window.history.replaceState({}, '', url.pathname);
    }

    // Call backend to revoke refresh token (async, but don't block UI)
    // This happens in background - user sees immediate logout
    logoutApi().catch(() => {
      // Ignore errors - client-side cleanup already done
    });

    // Redirect to login page
    router.replace('/login');
  }, [router]);

  // Register global auth error handler
  useEffect(() => {
    registerAuthErrorHandler((error) => {
      logger.warn('[Auth] Global auth error detected, logging out:', error);
      logout();
    });

    return () => {
      unregisterAuthErrorHandler();
    };
  }, [logout]);

  /**
   * Refresh current user data from backend
   * Updates the user in AuthContext with fresh data from API
   */
  const refreshUser = useCallback(async () => {
    try {
      const freshUserData = await getCurrentUser();
      if (freshUserData) {
        // Update user data while preserving authentication state
        setAuthState((prev) => {
          if (!prev.user) return prev; // Don't update if not authenticated

          return {
            ...prev,
            user: {
              ...prev.user,
              id: freshUserData.id || prev.user.id,
              username: freshUserData.username || prev.user.username,
              firstName: freshUserData.firstName || prev.user.firstName,
              lastName: freshUserData.lastName || prev.user.lastName,
              role: freshUserData.role || prev.user.role,
              isActive: freshUserData.isActive ?? prev.user.isActive,
              createdAt: freshUserData.createdAt || prev.user.createdAt,
              updatedAt: freshUserData.updatedAt || prev.user.updatedAt,
              lastLogin: freshUserData.lastLogin || prev.user.lastLogin,
              assignedModerator: freshUserData.assignedModerator || prev.user.assignedModerator,
              moderatorQuota: freshUserData.moderatorQuota || prev.user.moderatorQuota,
              createdBy: freshUserData.createdBy || prev.user.createdBy,
              isDeleted: freshUserData.isDeleted || prev.user.isDeleted,
              deletedAt: freshUserData.deletedAt || prev.user.deletedAt,
            },
          };
        });
      }
    } catch (err) {
      // Silently fail - user data will refresh on next page reload
      if (process.env.NODE_ENV === 'development') {
        logger.error('Failed to refresh user data:', err);
      }
    }
  }, []); // No dependencies - uses functional setState to access current state

  return (
    <AuthContext.Provider value={{ ...authState, login, logout, refreshUser, clearNavigationFlag, retryConnection, hasToken, isValidating, isNavigatingToHome, connectionError }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

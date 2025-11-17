'use client';

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { useUI } from './UIContext';
import type { User, AuthState } from '../types';
import { UserRole } from '@/types/roles';
import { login as loginApi, logout as logoutApi, getCurrentUser } from '@/services/api/authApiClient';
import logger from '@/utils/logger';

// Retry/backoff configuration
const RETRY_DELAYS = [300, 900]; // ms delays for up to 2 retries

// Type definition for Auth context shape
interface AuthContextType extends AuthState {
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
  });

  const { addToast } = useUI();

  // Refs for managing retry/backoff and preemption
  const attemptIdRef = useRef(0); // Incremented on each new login attempt
  const lastToastMessageRef = useRef<string>(''); // Track last toast to avoid duplicates
  const isInitializingRef = useRef(false); // Prevent multiple initialization attempts

  // Restore authentication state from localStorage on mount
  useEffect(() => {
    // Only run once on mount
    if (isInitializingRef.current) return;
    isInitializingRef.current = true;

    const restoreAuth = async () => {
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        if (!token) {
          // No token, user is not authenticated
          return;
        }

        // Verify token is valid by fetching current user
        try {
          const userData = await getCurrentUser();
          if (userData) {
            // Extract role from user data
            const role = userData.role as UserRole;
            
            setAuthState({
              user: {
                id: userData.id,
                username: userData.username,
                firstName: userData.firstName || '',
                lastName: userData.lastName || '',
                role: role,
              },
              isAuthenticated: true,
            });
            logger.info('[Auth] Restored authentication state from localStorage');
          }
        } catch (error) {
          // Token is invalid or expired, clear it
          logger.warn('[Auth] Token validation failed, clearing localStorage');
          localStorage.removeItem('token');
          setAuthState({
            user: null,
            isAuthenticated: false,
          });
        }
      } catch (error) {
        logger.error('[Auth] Failed to restore authentication:', error);
        // On error, assume not authenticated
        setAuthState({
          user: null,
          isAuthenticated: false,
        });
      }
    };

    restoreAuth();
  }, []); // Empty deps - only run on mount

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
          } catch {}
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

  const logout = useCallback(() => {
    logoutApi();
    setAuthState({
      user: null,
      isAuthenticated: false,
    });
  }, []);

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
              firstName: freshUserData.firstName || prev.user.firstName,
              lastName: freshUserData.lastName || prev.user.lastName,
              username: freshUserData.username || prev.user.username,
              // Preserve other fields that might not be in getCurrentUser response
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
    <AuthContext.Provider value={{ ...authState, login, logout, refreshUser }}>
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

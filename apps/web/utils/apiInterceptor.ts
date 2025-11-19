/**
 * Global API Interceptor
 * Handles authentication errors (401/403) globally across all API calls
 * Automatically logs out user when token is invalid/expired
 */

import logger from './logger';

let authErrorHandler: ((error: { statusCode: number; message: string }) => void) | null = null;

/**
 * Register a global handler for authentication errors
 * This will be called when any API request returns 401 or 403
 */
export function registerAuthErrorHandler(handler: (error: { statusCode: number; message: string }) => void) {
  authErrorHandler = handler;
}

/**
 * Unregister the auth error handler
 */
export function unregisterAuthErrorHandler() {
  authErrorHandler = null;
}

/**
 * Check if an error is an authentication error (401 or 403)
 * and trigger the global handler if registered
 */
export function handleApiError(error: unknown): void {
  if (!authErrorHandler) return;

  // Check if error has statusCode property
  if (error && typeof error === 'object' && 'statusCode' in error) {
    const statusCode = (error as { statusCode: unknown }).statusCode;
    
    if (typeof statusCode === 'number' && (statusCode === 401 || statusCode === 403)) {
      const message = (error as { message?: string }).message || 'تم انتهاء صلاحية الجلسة';
      
      logger.warn('[API Interceptor] Authentication error detected:', {
        statusCode,
        message,
      });
      
      // Trigger global auth error handler
      authErrorHandler({ statusCode, message });
    }
  }
}

/**
 * Wrapper for fetch that automatically handles auth errors
 */
export async function fetchWithAuthInterceptor(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  try {
    const response = await fetch(url, options);
    
    // Check for auth errors
    if (response.status === 401 || response.status === 403) {
      handleApiError({
        statusCode: response.status,
        message: 'تم انتهاء صلاحية الجلسة',
      });
    }
    
    return response;
  } catch (error) {
    // Re-throw network errors as-is
    throw error;
  }
}


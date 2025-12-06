/**
 * API client for ClinicsManagementService WhatsApp utility endpoints
 * Handles WhatsApp number validation and other utility operations
 */

import { translateNetworkError } from '@/utils/errorUtils';

export interface OperationResult<T> {
  data?: T;
  isSuccess?: boolean;
  state?: string;
  resultMessage?: string;
}

export interface ApiError {
  message: string;
  statusCode?: number;
}

// ============================================
// API Client Configuration
// ============================================

const getClinicsManagementBaseUrl = (): string => {
  const baseUrl = process.env.NEXT_PUBLIC_CLINICS_MANAGEMENT_URL || 'http://localhost:5185';
  // Ensure no trailing slash
  return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
};

/**
 * Get main API base URL (for endpoints that are on the main API server, not ClinicsManagementService)
 */
const getMainApiBaseUrl = (): string => {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
  // Ensure /api is appended if not already present
  return baseUrl.endsWith('/api') ? baseUrl : `${baseUrl}/api`;
};

/**
 * Make fetch request to ClinicsManagementService
 */
async function fetchAPI<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const BASE_URL = getClinicsManagementBaseUrl();
  const url = `${BASE_URL}${endpoint}`;

  // Get auth token from localStorage
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  // Add Authorization header if token exists
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      // Include signal if provided for cancellation
      signal: options.signal,
    });

    // Handle non-JSON responses
    let data: unknown;
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      // Try to extract meaningful error messages
      let message: string | undefined;
      if (typeof data === 'string') {
        message = data;
      } else if (data && typeof data === 'object') {
        const obj = data as any;
        if (obj.message) message = obj.message;
        else if (obj.error) message = obj.error;
        else if (obj.resultMessage) message = obj.resultMessage;
        else if (Array.isArray(obj.errors)) message = obj.errors.join(', ');
      }

      throw {
        message: message || 'API request failed',
        statusCode: response.status,
      } as ApiError;
    }

    return data as T;
  } catch (error) {
    // Translate network errors to Arabic
    if (error && typeof error === 'object' && 'statusCode' in error) {
      // This is already an ApiError, re-throw it
      throw error;
    }
    
    // This is a network/fetch error, translate it
    const translatedMessage = translateNetworkError(error);
    throw {
      message: translatedMessage,
      statusCode: 0, // Network errors don't have status codes
    } as ApiError;
  }
}

// ============================================
// WhatsApp Utility API Methods
// ============================================

/**
 * Check if a phone number has WhatsApp
 * @param phoneNumber Phone number in E.164 format (e.g., +201234567890)
 * @param moderatorUserId Optional moderator user ID whose session to use
 * @param userId Optional user ID performing the action (for audit trail)
 * @param signal Optional AbortSignal to cancel the request
 * @returns OperationResult with boolean indicating if number has WhatsApp
 */
export async function checkWhatsAppNumber(
  phoneNumber: string,
  moderatorUserId?: number,
  userId?: number,
  signal?: AbortSignal
): Promise<OperationResult<boolean>> {
  try {
    // URL encode the phone number to handle special characters
    const encodedPhoneNumber = encodeURIComponent(phoneNumber);
    const queryParams = new URLSearchParams();
    if (moderatorUserId) queryParams.append('moderatorUserId', moderatorUserId.toString());
    if (userId) queryParams.append('userId', userId.toString());
    const query = queryParams.toString() ? `?${queryParams.toString()}` : '';
    const result = await fetchAPI<OperationResult<boolean>>(
      `/api/WhatsAppUtility/check-whatsapp/${encodedPhoneNumber}${query}`,
      {
        method: 'GET', // Changed from POST to GET to match backend endpoint
        signal, // Pass abort signal to fetch
      }
    );
    
    // Emit event if PendingQR detected for UI updates
    if (result.state === 'PendingQR' && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('whatsapp:pendingQR', {
        detail: { moderatorUserId, source: 'checkWhatsAppNumber' }
      }));
    }
    
    return result;
  } catch (error: any) {
    // Check if error is due to abort
    if (error?.name === 'AbortError' || signal?.aborted) {
      return {
        isSuccess: false,
        state: 'Aborted',
        resultMessage: 'تم إلغاء عملية التحقق',
      };
    }
    
    // Handle 405 Method Not Allowed error specifically
    if (error?.statusCode === 405 || error?.message?.includes('405') || error?.message?.includes('Method Not Allowed')) {
      console.error('[WhatsApp API] Method Not Allowed (405) - endpoint may have changed:', error);
      return {
        isSuccess: false,
        state: 'ServiceUnavailable',
        resultMessage: 'خطأ في طريقة الاتصال بالخادم. يرجى تحديث الصفحة والمحاولة مرة أخرى.',
      };
    }
    
    // Translate network errors to Arabic
    const translatedMessage = translateNetworkError(error);
    
    // Handle connection and CORS errors gracefully
    const errorMessage = error?.message || '';
    const isConnectionError = 
      errorMessage.includes('ERR_CONNECTION_REFUSED') ||
      errorMessage.includes('Failed to fetch') ||
      errorMessage.includes('NetworkError') ||
      errorMessage.includes('connection refused') ||
      errorMessage.includes('CORS') ||
      errorMessage.includes('Access-Control-Allow-Origin');
    
    if (isConnectionError) {
      return {
        isSuccess: false,
        state: 'ServiceUnavailable',
        resultMessage: translatedMessage || 'خدمة التحقق من الواتساب غير متاحة. يرجى التأكد من تشغيل الخادم وإعدادات CORS.',
      };
    }
    
    // Return a failure result if request fails (use translated message)
    return {
      isSuccess: false,
      state: 'Failure',
      resultMessage: translatedMessage || 'فشل التحقق من رقم الواتساب',
    };
  }
}

/**
 * Check WhatsApp authentication status
 * @param moderatorUserId - Optional moderator user ID to sync session for
 * @param userId - Optional user ID performing the action (for audit trail)
 * @returns OperationResult with boolean indicating if WhatsApp is authenticated
 */
export async function checkAuthentication(moderatorUserId?: number, userId?: number): Promise<OperationResult<boolean>> {
  try {
    const queryParams = new URLSearchParams();
    if (moderatorUserId) queryParams.append('moderatorUserId', moderatorUserId.toString());
    if (userId) queryParams.append('userId', userId.toString());
    const query = queryParams.toString() ? `?${queryParams.toString()}` : '';
    const url = `/api/WhatsAppUtility/check-authentication${query}`;
    
    console.log('[WhatsApp API] checkAuthentication called - moderatorUserId:', moderatorUserId, 'userId:', userId, 'url:', url);
    
    const result = await fetchAPI<OperationResult<boolean>>(
      url,
      { method: 'GET' }
    );
    
    console.log('[WhatsApp API] checkAuthentication result:', result);
    
    // Emit event if PendingQR detected for UI updates
    if (result.state === 'PendingQR' && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('whatsapp:pendingQR', {
        detail: { moderatorUserId, source: 'checkAuthentication' }
      }));
    }
    
    return result;
  } catch (error: any) {
    console.error('[WhatsApp API] checkAuthentication error:', error);
    const translatedMessage = translateNetworkError(error);
    return {
      isSuccess: false,
      state: 'Failure',
      resultMessage: translatedMessage || 'فشل التحقق من حالة المصادقة',
    };
  }
}

/**
 * Start WhatsApp authentication flow (QR code scan)
 * @param moderatorUserId - Optional moderator user ID to sync session for
 * @param userId - Optional user ID performing the action (for audit trail)
 * @returns OperationResult with boolean indicating if authentication was successful
 */
export async function authenticate(moderatorUserId?: number, userId?: number): Promise<OperationResult<boolean>> {
  try {
    const queryParams = new URLSearchParams();
    if (moderatorUserId) queryParams.append('moderatorUserId', moderatorUserId.toString());
    if (userId) queryParams.append('userId', userId.toString());
    const query = queryParams.toString() ? `?${queryParams.toString()}` : '';
    const url = `/api/WhatsAppUtility/authenticate${query}`;
    
    console.log('[WhatsApp API] authenticate called - moderatorUserId:', moderatorUserId, 'userId:', userId, 'url:', url);
    
    const result = await fetchAPI<OperationResult<boolean>>(
      url,
      { method: 'POST' }
    );
    
    console.log('[WhatsApp API] authenticate result:', result);
    
    // Emit event if PendingQR detected for UI updates
    if (result.state === 'PendingQR' && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('whatsapp:pendingQR', {
        detail: { moderatorUserId, source: 'authenticate' }
      }));
    }
    
    return result;
  } catch (error: any) {
    console.error('[WhatsApp API] authenticate error:', error);
    const translatedMessage = translateNetworkError(error);
    return {
      isSuccess: false,
      state: 'Failure',
      resultMessage: translatedMessage || 'فشل بدء عملية المصادقة',
    };
  }
}

/**
 * Get session health metrics for a moderator
 * @param moderatorUserId - Moderator user ID to get health metrics for
 * @returns Session health metrics including size, backup status, and provider session ID
 */
export async function getSessionHealth(moderatorUserId: number): Promise<{
  currentSizeBytes: number;
  currentSizeMB: number;
  backupSizeBytes: number;
  backupSizeMB: number;
  lastCleanup?: string;
  lastBackup?: string;
  backupExists: boolean;
  isAuthenticated: boolean;
  providerSessionId?: string;
  compressionRatio: number;
  thresholdBytes: number;
  thresholdMB: number;
  exceedsThreshold: boolean;
} | null> {
  try {
    const result = await fetchAPI<any>(
      `/api/SessionManagement/health?moderatorUserId=${moderatorUserId}`,
      { method: 'GET' }
    );
    return result;
  } catch (error: any) {
    console.error('[WhatsApp API] getSessionHealth error:', error);
    return null;
  }
}

/**
 * Get browser status for a moderator
 * @param moderatorUserId - Moderator user ID
 * @returns Browser status information
 */
export interface BrowserStatus {
  isActive: boolean;
  isHealthy: boolean;
  currentUrl?: string;
  lastAction?: string;
  sessionAge?: string;
  isAuthenticated: boolean;
  lastUpdated?: string;
}

export interface ModeratorBrowserStatus extends BrowserStatus {
  moderatorId: number;
  moderatorName: string;
  moderatorUsername: string;
  error?: string;
}

export async function getBrowserStatus(moderatorUserId: number): Promise<BrowserStatus | null> {
  try {
    console.log('[WhatsApp API] getBrowserStatus called with moderatorUserId:', moderatorUserId);
    const url = `/api/WhatsAppUtility/browser/status?moderatorUserId=${moderatorUserId}`;
    console.log('[WhatsApp API] Fetching from URL:', url);
    
    const result = await fetchAPI<{ success: boolean; data: BrowserStatus }>(
      url,
      { method: 'GET' }
    );
    
    console.log('[WhatsApp API] getBrowserStatus result:', result);
    
    if (result.success && result.data) {
      return result.data;
    }
    
    return null;
  } catch (error: any) {
    console.error('[WhatsApp API] getBrowserStatus error:', error);
    return null;
  }
}

/**
 * Get browser status for all moderators (Admin only)
 * @returns List of browser status for all moderators
 */
export async function getAllModeratorsBrowserStatus(): Promise<ModeratorBrowserStatus[]> {
  try {
    const result = await fetchAPI<{ success: boolean; data: ModeratorBrowserStatus[] }>(
      `/api/WhatsAppUtility/browser/status/all`,
      { method: 'GET' }
    );
    
    if (result.success && result.data) {
      return result.data;
    }
    
    return [];
  } catch (error: any) {
    console.error('[WhatsApp API] getAllModeratorsBrowserStatus error:', error);
    return [];
  }
}

/**
 * Refresh browser status for a moderator
 * @param moderatorUserId - Moderator user ID
 * @returns Success response
 */
export async function refreshBrowserStatus(moderatorUserId: number): Promise<{ success: boolean; message?: string }> {
  try {
    const result = await fetchAPI<{ success: boolean; message?: string }>(
      `/api/WhatsAppUtility/browser/refresh?moderatorUserId=${moderatorUserId}`,
      { method: 'POST' }
    );
    
    return result;
  } catch (error: any) {
    console.error('[WhatsApp API] refreshBrowserStatus error:', error);
    throw error;
  }
}

/**
 * Close browser session for a moderator
 * @param moderatorUserId - Moderator user ID
 * @returns Success response
 */
export async function closeBrowserSession(moderatorUserId: number): Promise<{ success: boolean; message?: string }> {
  try {
    const result = await fetchAPI<{ success: boolean; message?: string }>(
      `/api/WhatsAppUtility/browser/close?moderatorUserId=${moderatorUserId}`,
      { method: 'POST' }
    );
    
    return result;
  } catch (error: any) {
    console.error('[WhatsApp API] closeBrowserSession error:', error);
    throw error;
  }
}

/**
 * Get QR code screenshot for authentication
 * @param moderatorUserId - Moderator user ID
 * @returns QR code image as base64
 */
export interface QRCodeResponse {
  success: boolean;
  data?: {
    qrCodeImage: string; // base64
    format: string;
  };
  error?: string;
}

export async function getQRCode(moderatorUserId: number): Promise<QRCodeResponse> {
  try {
    const result = await fetchAPI<QRCodeResponse>(
      `/api/WhatsAppUtility/qr-code?moderatorUserId=${moderatorUserId}`,
      { method: 'GET' }
    );
    
    return result;
  } catch (error: any) {
    console.error('[WhatsApp API] getQRCode error:', error);
    throw error;
  }
}

/**
 * Make fetch request to main API server (for moderator endpoints)
 * These endpoints are on the main API, not ClinicsManagementService
 */
async function fetchMainAPI<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const BASE_URL = getMainApiBaseUrl();
  const url = `${BASE_URL}${endpoint}`;

  // Get auth token from localStorage
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  // Add Authorization header if token exists
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      signal: options.signal,
    });

    // Handle non-JSON responses
    let data: unknown;
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      // Try to extract meaningful error messages
      let message: string | undefined;
      if (typeof data === 'string') {
        message = data;
      } else if (data && typeof data === 'object') {
        const obj = data as any;
        if (obj.message) message = obj.message;
        else if (obj.error) message = obj.error;
        else if (obj.resultMessage) message = obj.resultMessage;
        else if (Array.isArray(obj.errors)) message = obj.errors.join(', ');
      }

      throw {
        message: message || 'API request failed',
        statusCode: response.status,
      } as ApiError;
    }

    return data as T;
  } catch (error) {
    // Translate network errors to Arabic
    if (error && typeof error === 'object' && 'statusCode' in error) {
      // This is already an ApiError, re-throw it
      throw error;
    }
    
    // This is a network/fetch error, translate it
    const translatedMessage = translateNetworkError(error);
    throw {
      message: translatedMessage,
      statusCode: 0, // Network errors don't have status codes
    } as ApiError;
  }
}

/**
 * Pause all tasks for a moderator (sets WhatsAppSession.IsPaused = true)
 * @param moderatorId - Moderator ID
 * @param reason - Optional pause reason
 * @returns Success response
 */
export interface PauseAllResponse {
  success: boolean;
  message: string;
  error?: string;
}

export async function pauseAllModeratorTasks(
  moderatorId: number, 
  reason?: string
): Promise<PauseAllResponse> {
  try {
    const result = await fetchMainAPI<PauseAllResponse>(
      `/Moderators/${moderatorId}/pause-all`,
      { 
        method: 'POST',
        body: JSON.stringify({ reason: reason || 'User paused' })
      }
    );
    
    return result;
  } catch (error: any) {
    console.error('[WhatsApp API] pauseAllModeratorTasks error:', error);
    throw error;
  }
}

/**
 * Resume all tasks for a moderator (sets WhatsAppSession.IsPaused = false)
 * @param moderatorId - Moderator ID
 * @returns Success response
 */
export async function resumeAllModeratorTasks(moderatorId: number): Promise<PauseAllResponse> {
  try {
    const result = await fetchMainAPI<PauseAllResponse>(
      `/Moderators/${moderatorId}/resume-all`,
      { method: 'POST' }
    );
    
    return result;
  } catch (error: any) {
    console.error('[WhatsApp API] resumeAllModeratorTasks error:', error);
    throw error;
  }
}

/**
 * Get global pause state for a moderator
 * @param moderatorId - Moderator ID
 * @returns Pause state
 */
export interface GlobalPauseState {
  isPaused: boolean;
  pauseReason: string | null;
  pausedAt: string | null;
  pausedBy: number | null;
  /** 
   * Computed by backend: true when session is paused and can be resumed
   * (either not PendingQR, or PendingQR but now connected/authenticated)
   */
  isResumable: boolean;
}

export async function getGlobalPauseState(moderatorId: number): Promise<GlobalPauseState> {
  try {
    const result = await fetchMainAPI<GlobalPauseState>(
      `/Moderators/${moderatorId}/pause-state`,
      { method: 'GET' }
    );
    
    return result;
  } catch (error: any) {
    console.error('[WhatsApp API] getGlobalPauseState error:', error);
    throw error;
  }
}

// Export the client object for consistency with other API clients
export const whatsappApiClient = {
  checkWhatsAppNumber,
  checkAuthentication,
  authenticate,
  getSessionHealth,
  getBrowserStatus,
  getAllModeratorsBrowserStatus,
  refreshBrowserStatus,
  closeBrowserSession,
  getQRCode,
  pauseAllModeratorTasks,
  resumeAllModeratorTasks,
  getGlobalPauseState,
};

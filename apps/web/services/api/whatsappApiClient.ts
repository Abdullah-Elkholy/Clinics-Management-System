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

export interface ExtensionCheckResult {
  success: boolean;
  category: string;
  message?: string;
  data?: boolean;
}

export interface ApiError {
  message: string;
  statusCode?: number;
}

// ============================================
// API Client Configuration
// ============================================



/**
 * Get main API base URL (for endpoints that are on the main API server, not ClinicsManagementService)
 */
const getMainApiBaseUrl = (): string => {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
  // Ensure /api is appended if not already present
  return baseUrl.endsWith('/api') ? baseUrl : `${baseUrl}/api`;
};


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
    const result = await fetchMainAPI<OperationResult<boolean>>(
      `/WhatsAppUtility/check-whatsapp/${encodedPhoneNumber}${query}`,
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
    const url = `/WhatsAppUtility/check-authentication${query}`;

    console.log('[WhatsApp API] checkAuthentication called - moderatorUserId:', moderatorUserId, 'userId:', userId, 'url:', url);

    const result = await fetchMainAPI<OperationResult<boolean>>(
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
    const url = `/WhatsAppUtility/authenticate${query}`;

    console.log('[WhatsApp API] authenticate called - moderatorUserId:', moderatorUserId, 'userId:', userId, 'url:', url);

    const result = await fetchMainAPI<OperationResult<boolean>>(
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
 * @deprecated This function was used for the old ClinicsManagementService approach.
 * Session health is no longer applicable with the extension-based WhatsApp integration.
 * @param moderatorUserId - Moderator user ID to get health metrics for
 * @returns Always returns null - kept for backward compatibility
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
  // Deprecated: Session health was for the old ClinicsManagementService approach
  // With extension-based WhatsApp integration, this is no longer needed
  return null;
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





/**
 * Close browser session for a moderator
 * @param moderatorUserId - Moderator user ID
 * @returns Success response
 */
export async function closeBrowserSession(moderatorUserId: number): Promise<{ success: boolean; message?: string }> {
  try {
    const result = await fetchMainAPI<{ success: boolean; message?: string }>(
      `/WhatsAppUtility/browser/close?moderatorUserId=${moderatorUserId}`,
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
    const result = await fetchMainAPI<QRCodeResponse>(
      `/WhatsAppUtility/qr-code?moderatorUserId=${moderatorUserId}`,
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
  /**
   * True when extension has active lease and recent heartbeat.
   * If false, pause/resume buttons should be disabled since there's nothing to pause.
   */
  isExtensionConnected: boolean;
  /**
   * WhatsApp session authentication status.
   * 'connected' = authenticated, 'pending' = not authenticated, 'disconnected' = no session
   */
  status: string | null;
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

/**
 * Combined status response from the server
 * Reduces 4 API calls (session, extension, pause-state, health) into 1
 */
export interface CombinedStatusResponse {
  success: boolean;
  timestamp: string;
  session: {
    id: number;
    moderatorUserId: number;
    sessionName?: string;
    status?: string;
    lastSyncAt?: string;
    createdAt: string;
    providerSessionId?: string;
    lastActivityAt?: string;
  } | null;
  pauseState: {
    isPaused: boolean;
    pauseReason: string | null;
    pausedAt: string | null;
    pausedBy: number | null;
    isResumable: boolean;
    isExtensionConnected?: boolean;
  };
  extension: {
    hasActiveLease: boolean;
    leaseId?: string;
    deviceId?: number;
    deviceName?: string;
    whatsAppStatus?: string;
    currentUrl?: string;
    lastHeartbeat?: string;
    expiresAt?: string;
    isOnline: boolean;
  };
}

/**
 * Get combined status for a moderator (session + extension + pause state in one call)
 * This reduces 4 API calls to 1 for better performance
 * @param moderatorId - Moderator ID
 * @returns Combined status data
 */
export async function getCombinedStatus(moderatorId: number): Promise<CombinedStatusResponse> {
  try {
    const result = await fetchMainAPI<CombinedStatusResponse>(
      `/Moderators/${moderatorId}/combined-status`,
      { method: 'GET' }
    );

    return result;
  } catch (error: any) {
    console.error('[WhatsApp API] getCombinedStatus error:', error);
    throw error;
  }
}

/**
 * Check if a phone number has WhatsApp using browser extension (NEW)
 * This replaces the legacy Playwright-based check with extension-driven validation
 * Hard-pauses any active sending during check (unresumable until complete)
 * @param phoneNumber Phone number (local format, e.g., 01234567890)
 * @param options Configuration options including countryCode and abort signal
 * @returns ExtensionCheckResult with validation status
 */
export async function checkWhatsAppNumberViaExtension(
  phoneNumber: string,
  options?: {
    countryCode?: string;
    forceCheck?: boolean;
    signal?: AbortSignal;
  }
): Promise<ExtensionCheckResult> {
  try {
    const encodedPhoneNumber = encodeURIComponent(phoneNumber);
    const queryParams = new URLSearchParams();
    if (options.countryCode) {
      queryParams.append('countryCode', options.countryCode);
    }
    if (options.forceCheck) {
      queryParams.append('forceCheck', 'true');
    }
    const query = queryParams.toString() ? `?${queryParams.toString()}` : '';

    // Use the new extension controller endpoint
    const result = await fetchMainAPI<{
      success: boolean;
      hasWhatsApp: boolean | null;
      state: string;
      message?: string;
    }>(
      `/extension/whatsapp/check-number/${encodedPhoneNumber}${query}`,
      {
        method: 'GET',
        signal: options?.signal,
      }
    );

    // Map response to ExtensionCheckResult format
    return {
      success: result.success,
      category: result.state,
      message: result.message,
      data: result.hasWhatsApp ?? undefined,
    };
  } catch (error: any) {
    // Check if error is due to abort
    if (error?.name === 'AbortError' || options?.signal?.aborted) {
      return {
        success: false,
        category: 'Aborted',
        message: 'تم إلغاء عملية التحقق',
      };
    }

    // Handle connection errors
    const errorMessage = error?.message || '';
    const isConnectionError =
      errorMessage.includes('ERR_CONNECTION_REFUSED') ||
      errorMessage.includes('Failed to fetch') ||
      errorMessage.includes('NetworkError');

    if (isConnectionError) {
      return {
        success: false,
        category: 'ServiceUnavailable',
        message: translateNetworkError(error),
      };
    }

    // Return error result
    return {
      success: false,
      category: 'Failed',
      message: error?.message || 'حدث خطأ أثناء التحقق من الرقم',
    };
  }
}

/**
 * Cancel any ongoing check session for the current moderator
 * Clears the CheckWhatsApp pause and allows sending to resume
 * @returns Success status
 */
export async function cancelCheckSession(): Promise<{ success: boolean; message?: string }> {
  try {
    const result = await fetchMainAPI<{ success: boolean; message?: string }>(
      `/extension/whatsapp/check-cancel`,
      {
        method: 'POST',
      }
    );

    return result;
  } catch (error: any) {
    console.error('[WhatsApp API] cancelCheckSession error:', error);
    return {
      success: false,
      message: error?.message || 'فشل إلغاء عملية التحقق',
    };
  }
}

// Export the client object for consistency with other API clients
export const whatsappApiClient = {
  checkWhatsAppNumber,
  checkWhatsAppNumberViaExtension,
  cancelCheckSession,
  checkAuthentication,
  authenticate,
  getSessionHealth,

  closeBrowserSession,
  getQRCode,
  pauseAllModeratorTasks,
  resumeAllModeratorTasks,
  getGlobalPauseState,
  getCombinedStatus,
};

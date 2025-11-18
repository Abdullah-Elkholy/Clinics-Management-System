/**
 * API client for ClinicsManagementService WhatsApp utility endpoints
 * Handles WhatsApp number validation and other utility operations
 */

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
 * Make fetch request to ClinicsManagementService
 */
async function fetchAPI<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const BASE_URL = getClinicsManagementBaseUrl();
  const url = `${BASE_URL}${endpoint}`;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
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
}

// ============================================
// WhatsApp Utility API Methods
// ============================================

/**
 * Check if a phone number has WhatsApp
 * @param phoneNumber Phone number in E.164 format (e.g., +201234567890)
 * @returns OperationResult with boolean indicating if number has WhatsApp
 */
export async function checkWhatsAppNumber(
  phoneNumber: string
): Promise<OperationResult<boolean>> {
  try {
    // URL encode the phone number to handle special characters
    const encodedPhoneNumber = encodeURIComponent(phoneNumber);
    const result = await fetchAPI<OperationResult<boolean>>(
      `/api/WhatsAppUtility/check-whatsapp/${encodedPhoneNumber}`,
      {
        method: 'GET',
      }
    );
    return result;
  } catch (error: any) {
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
        resultMessage: 'WhatsApp validation service is not available. Please ensure the ClinicsManagementService is running and CORS is configured.',
      };
    }
    
    // Return a failure result if request fails
    return {
      isSuccess: false,
      state: 'Failure',
      resultMessage: errorMessage || 'Failed to check WhatsApp number',
    };
  }
}

// Export the client object for consistency with other API clients
export const whatsappApiClient = {
  checkWhatsAppNumber,
};


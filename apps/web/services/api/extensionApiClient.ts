/**
 * API client for Extension Runner endpoints
 * Handles pairing, lease management, and extension status
 */

import { translateNetworkError } from '@/utils/errorUtils';

// ============================================
// Types
// ============================================

export interface ExtensionPairingCode {
  code: string;
  expiresAt: string;
  moderatorId: number;
}

export interface ExtensionDevice {
  id: string;
  deviceId: string;
  deviceName?: string;
  extensionVersion?: string;
  lastSeenAt?: string;
  createdAt: string;
}

export interface ExtensionLeaseStatus {
  hasActiveLease: boolean;
  deviceId?: string;
  deviceName?: string;
  acquiredAt?: string;
  expiresAt?: string;
  whatsAppStatus?: string;
  currentUrl?: string;
  lastHeartbeat?: string;
}

export interface StartPairingResult {
  success: boolean;
  code?: string;
  expiresAt?: string;
  expiresInSeconds?: number;
  error?: string;
}

export interface LeaseStatusResult {
  success: boolean;
  hasActiveLease?: boolean;
  deviceName?: string;
  whatsAppStatus?: string;
  lastHeartbeat?: string;
  error?: string;
}

// ============================================
// API Client Configuration
// ============================================

const getMainApiBaseUrl = (): string => {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
  return baseUrl.endsWith('/api') ? baseUrl : `${baseUrl}/api`;
};

/**
 * Make fetch request to Extension API
 */
async function fetchExtensionAPI<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const BASE_URL = getMainApiBaseUrl();
  const url = `${BASE_URL}${endpoint}`;

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    let data: unknown;
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      const errorMessage = typeof data === 'object' && data !== null && 'error' in data
        ? (data as { error: string }).error
        : typeof data === 'string'
        ? data
        : `HTTP ${response.status}`;
      throw new Error(errorMessage);
    }

    return data as T;
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error(translateNetworkError(error.message));
      }
      throw error;
    }
    throw new Error('Unknown error occurred');
  }
}

// ============================================
// Extension API Client
// ============================================

export const extensionApiClient = {
  /**
   * Start pairing - generates an 8-digit code for the extension
   */
  async startPairing(): Promise<StartPairingResult> {
    try {
      const result = await fetchExtensionAPI<{ code: string; expiresAt: string; expiresInSeconds: number }>('/extension/pairing/start', {
        method: 'POST',
      });
      return {
        success: true,
        code: result.code,
        expiresAt: result.expiresAt,
        expiresInSeconds: result.expiresInSeconds,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to generate pairing code',
      };
    }
  },

  /**
   * Revoke a paired device
   */
  async revokeDevice(deviceId: string): Promise<{ success: boolean; error?: string }> {
    try {
      await fetchExtensionAPI(`/extension/devices/${deviceId}`, {
        method: 'DELETE',
      });
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to revoke device',
      };
    }
  },

  /**
   * Get list of paired devices for current user
   */
  async getDevices(): Promise<{ success: boolean; devices?: ExtensionDevice[]; error?: string }> {
    try {
      const devices = await fetchExtensionAPI<ExtensionDevice[]>('/extension/devices');
      return { success: true, devices };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to get devices',
      };
    }
  },

  /**
   * Get current lease status
   */
  async getLeaseStatus(): Promise<LeaseStatusResult> {
    try {
      const result = await fetchExtensionAPI<ExtensionLeaseStatus>('/extension/lease/status');
      return {
        success: true,
        hasActiveLease: result.hasActiveLease,
        deviceName: result.deviceName,
        whatsAppStatus: result.whatsAppStatus,
        lastHeartbeat: result.lastHeartbeat,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to get lease status',
      };
    }
  },

  /**
   * Force release the current lease (admin action)
   */
  async forceReleaseLease(): Promise<{ success: boolean; error?: string }> {
    try {
      await fetchExtensionAPI('/extension/lease/force-release', {
        method: 'POST',
      });
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to release lease',
      };
    }
  },
};

export default extensionApiClient;

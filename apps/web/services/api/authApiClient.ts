import type { User } from '@/types';
/**
 * Authentication API Client
 * Handles login and authentication-related API calls
 */

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  data?: {
    accessToken: string;
  };
  errors?: Array<{
    code: string;
    message: string;
  }>;
}

export class ApiError extends Error {
  statusCode: number;
  details?: unknown;
  constructor(message: string, statusCode: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.details = details;
    // Ensure instanceof works
    Object.setPrototypeOf(this, ApiError.prototype);
  }
  toJSON() {
    return { name: this.name, message: this.message, statusCode: this.statusCode, details: this.details };
  }
}

// ============================================
// API Client Configuration
// ============================================

const getApiBaseUrl = (): string => {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
  // Ensure /api is appended if not already present
  return baseUrl.endsWith('/api') ? baseUrl : `${baseUrl}/api`;
};

// ============================================
// Authentication API
// ============================================

/**
 * Login with username and password
 * Returns JWT access token to be stored in localStorage
 */
export async function login(credentials: LoginRequest): Promise<LoginResponse> {
  const API_BASE_URL = getApiBaseUrl();
  const url = `${API_BASE_URL}/auth/login`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(credentials),
  });

  let data: unknown;
  const contentType = response.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const message = (typeof data === 'string' ? data : ((data as Record<string, unknown>)?.errors as Array<{message: string}>)?.[0]?.message || (data as Record<string, unknown>)?.message as string) || response.statusText || 'Login failed';
    // Don't trigger global auth handler for login endpoint - these are expected errors
    throw new ApiError(message, response.status, typeof data === 'string' ? { raw: data } : data);
  }

  return data as LoginResponse;
}

/**
 * Get current authenticated user information
 */
export async function getCurrentUser(): Promise<User> {
  const API_BASE_URL = getApiBaseUrl();
  const url = `${API_BASE_URL}/auth/me`;
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
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
    const message = (typeof data === 'string' ? data : (data as Record<string, unknown>)?.message as string) || response.statusText || 'Failed to get current user';
    const error = new ApiError(message, response.status, typeof data === 'string' ? { raw: data } : data);
    
    // Handle auth errors globally
    if (response.status === 401 || response.status === 403) {
      const { handleApiError } = require('@/utils/apiInterceptor');
      handleApiError({ statusCode: response.status, message });
    }
    
    throw error;
  }

  return data as User;
}

/**
 * Logout by clearing token
 * (Backend uses HttpOnly cookies for refresh tokens, so no logout call needed)
 */
export function logout(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('token');
  }
}

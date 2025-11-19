/* global RequestInit, HeadersInit */
/**
 * Users API Client
 * Handles fetching user and moderator data from the backend
 */
import logger from '@/utils/logger';
import { UserRole } from '@/types/roles';
import type { User } from '@/types/user';
import { translateNetworkError } from '@/utils/errorUtils';

export interface UserDto {
  id: number;
  username: string;
  firstName: string;
  lastName?: string;
  role: 'primary_admin' | 'secondary_admin' | 'moderator' | 'user';
  moderatorId?: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  lastLogin?: string | null;
}

export interface UserSettingsDto {
  id: number;
  userId: number;
  whatsAppPhoneNumber?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ListResponse<T> {
  items: T[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
}

type LegacyListResponse<T> = Partial<ListResponse<T>> & {
  data?: T[];
  total?: number;
  page?: number;
};

export interface ApiError {
  message: string;
  statusCode: number;
}

const DEFAULT_ERROR_MESSAGE = 'API request failed';

const extractErrorMessage = (payload: unknown, fallback = DEFAULT_ERROR_MESSAGE): string => {
  if (typeof payload === 'string') {
    return payload || fallback;
  }

  if (payload && typeof payload === 'object') {
    // Check for 'error' field first (commonly used in API responses)
    if ('error' in payload) {
      const error = (payload as { error?: unknown }).error;
      if (typeof error === 'string' && error) {
        return error;
      }
    }
    
    // Check for 'message' field (alternative response format)
    if ('message' in payload) {
      const message = (payload as { message?: unknown }).message;
      if (typeof message === 'string' && message) {
        return message;
      }
    }
  }

  return fallback;
};

// ============================================
// API Client Configuration
// ============================================

const getApiBaseUrl = (): string => {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
  // Ensure /api is appended if not already present
  return baseUrl.endsWith('/api') ? baseUrl : `${baseUrl}/api`;
};

/**
 * Get auth token from localStorage
 */
function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null; // SSR safety
  return localStorage.getItem('token');
}

/**
 * Make authenticated fetch request
 */
async function fetchAPI<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const API_BASE_URL = getApiBaseUrl();
  const url = `${API_BASE_URL}${endpoint}`;
  const token = getAuthToken();

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

    // Handle non-JSON responses
    let data: unknown;
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      const errorMessage = extractErrorMessage(data);

      logger.error('❌ API Error:', {
        url,
        status: response.status,
        statusText: response.statusText,
        message: errorMessage,
        responseData: data,
      });

      throw {
        message: errorMessage,
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
    logger.error('❌ Network Error:', {
      url,
      originalError: error,
      translatedMessage,
    });
    
    throw {
      message: translatedMessage,
      statusCode: 0, // Network errors don't have status codes
    } as ApiError;
  }
}

const emptyListResponse = <T>(pageNumber: number, pageSize: number): ListResponse<T> => ({
  items: [],
  totalCount: 0,
  pageNumber,
  pageSize,
});

function normalizeListResponse<T>(
  payload: unknown,
  defaults: { pageNumber: number; pageSize: number }
): ListResponse<T> {
  if (payload && typeof payload === 'object') {
    const data = payload as LegacyListResponse<T>;
    return {
      items: data.items ?? data.data ?? [],
      totalCount: data.totalCount ?? data.total ?? (data.items ?? data.data)?.length ?? 0,
      pageNumber: data.pageNumber ?? data.page ?? defaults.pageNumber,
      pageSize: data.pageSize ?? defaults.pageSize,
    };
  }

  return emptyListResponse<T>(defaults.pageNumber, defaults.pageSize);
}

// ============================================
// Users API
// ============================================

/**
 * Get all users with optional role filtering
 */
export async function getUsers(role?: string): Promise<ListResponse<UserDto>> {
  const params = new URLSearchParams();
  if (role) {
    params.append('role', role);
  }
  const queryString = params.toString();
  return fetchAPI(`/users${queryString ? `?${queryString}` : ''}`);
}

/**
 * Get a single user by ID
 */
export async function getUserById(userId: number): Promise<UserDto> {
  return fetchAPI(`/users/${userId}`);
}

/**
 * Get all moderators
 */
export async function getModerators(): Promise<ListResponse<UserDto>> {
  return getUsers('moderator');
}

/**
 * Get current user (authenticated user)
 */
export async function getCurrentUser(): Promise<UserDto> {
  return fetchAPI('/users/me');
}

/**
 * Get users under a specific moderator
 */
export async function getUsersUnderModerator(moderatorId: number): Promise<ListResponse<UserDto>> {
  return fetchAPI(`/users?moderatorId=${moderatorId}`);
}

/**
 * Get user settings by user ID
 */
export async function getUserSettings(userId: number): Promise<UserSettingsDto> {
  return fetchAPI(`/users/${userId}/settings`);
}

/**
 * Update user settings
 */
export async function updateUserSettings(
  userId: number,
  settings: Partial<UserSettingsDto>
): Promise<UserSettingsDto> {
  return fetchAPI(`/users/${userId}/settings`, {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
}

/**
 * Create a new user
 */
export async function createUser(data: {
  firstName: string;
  lastName?: string;
  username: string;
  role: string;
  moderatorId?: number;
  password?: string;
}): Promise<UserDto> {
  return fetchAPI('/users', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Update an existing user
 */
export async function updateUser(
  userId: number,
  data: Partial<UserDto>
): Promise<UserDto> {
  logger.debug('📤 usersApiClient.updateUser sending:', {
    userId,
    data,
    url: `/users/${userId}`,
  });

  try {
    const result: UserDto = await fetchAPI(`/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });

    logger.debug('✅ usersApiClient.updateUser received:', result);

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error 
      ? error.message 
      : (error && typeof error === 'object' && 'message' in error)
        ? String((error as { message?: unknown }).message || 'Unknown error')
        : 'Unknown error';
    logger.error('❌ usersApiClient.updateUser error:', {
      error: errorMessage,
      statusCode: (error && typeof error === 'object' && 'statusCode' in error) ? (error as { statusCode?: unknown }).statusCode : undefined,
      userId,
      payload: data,
      fullError: error,
    });
    throw error;
  }
}

/**
 * Delete a user
 */
export async function deleteUser(userId: number): Promise<void> {
  return fetchAPI(`/users/${userId}`, {
    method: 'DELETE',
  });
}

/**
 * List deleted users in trash (soft-deleted within 30 days)
 * Admin only
 */
export async function getTrashUsers(options?: {
  pageNumber?: number;
  pageSize?: number;
}): Promise<ListResponse<UserDto>> {
  const params = new URLSearchParams();
  const page = options?.pageNumber || 1;
  const pageSize = options?.pageSize || 10;
  params.append('page', page.toString());
  params.append('pageSize', pageSize.toString());

  const queryString = params.toString();
  const response = await fetchAPI<LegacyListResponse<UserDto>>(`/users/trash?${queryString}`);

  return normalizeListResponse<UserDto>(response, { pageNumber: page, pageSize });
}

/**
 * List permanently deleted users (archived, soft-deleted over 30 days)
 * Admin only
 */
export async function getArchivedUsers(options?: {
  pageNumber?: number;
  pageSize?: number;
}): Promise<ListResponse<UserDto>> {
  const params = new URLSearchParams();
  const page = options?.pageNumber || 1;
  const pageSize = options?.pageSize || 10;
  params.append('page', page.toString());
  params.append('pageSize', pageSize.toString());

  const queryString = params.toString();
  const response = await fetchAPI<LegacyListResponse<UserDto>>(`/users/archived?${queryString}`);

  return normalizeListResponse<UserDto>(response, { pageNumber: page, pageSize });
}

/**
 * Restore a deleted user from trash (within 30-day window)
 * Admin only
 */
export async function restoreUser(userId: number): Promise<UserDto> {
  return fetchAPI(`/users/${userId}/restore`, {
    method: 'POST',
  });
}

/**
 * Convert UserDto to frontend User model
 * Maps backend numerator moderatorId to frontend semantic field assignedModerator
 */
const mapRoleToEnum = (role: UserDto['role']): UserRole => {
  switch (role) {
    case 'primary_admin':
      return UserRole.PrimaryAdmin;
    case 'secondary_admin':
      return UserRole.SecondaryAdmin;
    case 'moderator':
      return UserRole.Moderator;
    case 'user':
      return UserRole.User;
    default:
      return UserRole.User;
  }
};

export function userDtoToModel(dto: UserDto): User {
  const createdAt = dto.createdAt ? new Date(dto.createdAt) : new Date();
  const updatedAt = dto.updatedAt ? new Date(dto.updatedAt) : createdAt;

  return {
    id: dto.id.toString(),
    username: dto.username,
    firstName: dto.firstName,
    lastName: dto.lastName,
    role: mapRoleToEnum(dto.role),
    isActive: dto.isActive,
    assignedModerator: dto.moderatorId ? dto.moderatorId.toString() : undefined,
    createdAt,
    updatedAt,
    lastLogin: dto.lastLogin ? new Date(dto.lastLogin) : undefined,
  };
}

// ============================================
// Error Handling Helper
// ============================================

/**
 * Format API error for display to user
 */
export function formatApiError(error: unknown): string {
  if (error instanceof TypeError) {
    return 'Network error. Please check your connection.';
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return (error as ApiError).message;
  }
  return 'An unexpected error occurred.';
}

// ============================================
// Export default client object for convenience
// ============================================

export const usersApiClient = {
  getUsers,
  getUserById,
  getModerators,
  getCurrentUser,
  getUsersUnderModerator,
  getUserSettings,
  updateUserSettings,
  createUser,
  updateUser,
  deleteUser,
  getTrashUsers,
  getArchivedUsers,
  restoreUser,
  formatApiError,
};

export default usersApiClient;

/**
 * Users API Client
 * Handles fetching user and moderator data from the backend
 */

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

export interface ApiError {
  message: string;
  statusCode: number;
}

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

  const response = await fetch(url, {
    ...options,
    headers,
  });

  // Handle non-JSON responses
  let data: any;
  const contentType = response.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const errorMessage = data?.message || data || 'API request failed';
    
    if (process.env.NODE_ENV === 'development') {
      console.error('❌ API Error:', {
        url: url,
        status: response.status,
        statusText: response.statusText,
        message: errorMessage,
        responseData: data,
      });
    }

    throw {
      message: errorMessage,
      statusCode: response.status,
    } as ApiError;
  }

  return data as T;
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
  if (process.env.NODE_ENV === 'development') {
    console.log('📤 usersApiClient.updateUser sending:', {
      userId: userId,
      data: data,
      url: `/users/${userId}`,
    });
  }

  try {
    const result: UserDto = await fetchAPI(`/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });

    if (process.env.NODE_ENV === 'development') {
      console.log('✅ usersApiClient.updateUser received:', result);
    }

    return result;
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('❌ usersApiClient.updateUser error:', {
        error: error,
        userId: userId,
        payload: data,
      });
    }
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
  const response = await fetchAPI(`/users/trash?${queryString}`);
  
  // Backend returns { success: true, data: users, total, page, pageSize }
  // We need to transform it to ListResponse format
  if (response && typeof response === 'object' && 'data' in response && 'total' in response) {
    return {
      items: (response as any).data || [],
      totalCount: (response as any).total || 0,
      pageNumber: (response as any).page || page,
      pageSize: (response as any).pageSize || pageSize,
    };
  }
  
  return response;
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
  const response = await fetchAPI(`/users/archived?${queryString}`);
  
  // Backend returns { success: true, data: users, total, page, pageSize }
  // We need to transform it to ListResponse format
  if (response && typeof response === 'object' && 'data' in response && 'total' in response) {
    return {
      items: (response as any).data || [],
      totalCount: (response as any).total || 0,
      pageNumber: (response as any).page || page,
      pageSize: (response as any).pageSize || pageSize,
    };
  }
  
  return response;
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
export function userDtoToModel(dto: UserDto): any {
  return {
    id: dto.id.toString(),
    firstName: dto.firstName,
    lastName: dto.lastName,
    username: dto.username,
    role: dto.role,
    isActive: dto.isActive,
    createdAt: dto.createdAt ? new Date(dto.createdAt) : undefined,
    updatedAt: dto.updatedAt ? new Date(dto.updatedAt) : undefined,
    lastLogin: dto.lastLogin ? new Date(dto.lastLogin) : undefined,
    moderatorId: dto.moderatorId, // keep for reference; use assignedModerator in frontend logic
    assignedModerator: dto.moderatorId ? dto.moderatorId.toString() : undefined, // canonical field for filtering
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

/**
 * Queues API Client
 * Handles fetching queue data from the backend
 */

export interface QueueDto {
  id: number;
  doctorName: string;
  description?: string;
  createdBy: number;
  moderatorId: number;
  currentPosition: number;
  estimatedWaitMinutes?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface QueuePatientDto {
  id: number;
  queueId: number;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  position: number;
  status: 'waiting' | 'in_service' | 'completed' | 'cancelled';
  createdAt: string;
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
    throw {
      message: data?.message || 'API request failed',
      statusCode: response.status,
    } as ApiError;
  }

  return data as T;
}

// ============================================
// Queues API
// ============================================

/**
 * Get all queues with optional filters
 */
export async function getQueues(options?: {
  moderatorId?: number;
  isActive?: boolean;
  pageNumber?: number;
  pageSize?: number;
}): Promise<ListResponse<QueueDto>> {
  const params = new URLSearchParams();
  if (options?.moderatorId !== undefined) {
    params.append('moderatorId', options.moderatorId.toString());
  }
  if (options?.isActive !== undefined) {
    params.append('isActive', options.isActive.toString());
  }
  if (options?.pageNumber !== undefined) {
    params.append('pageNumber', options.pageNumber.toString());
  }
  if (options?.pageSize !== undefined) {
    params.append('pageSize', options.pageSize.toString());
  }

  const queryString = params.toString();
  return fetchAPI(`/queues${queryString ? `?${queryString}` : ''}`);
}

/**
 * Get a single queue by ID
 */
export async function getQueue(queueId: number): Promise<QueueDto> {
  return fetchAPI(`/queues/${queueId}`);
}

/**
 * Get patients in a specific queue
 */
export async function getQueuePatients(queueId: number): Promise<ListResponse<QueuePatientDto>> {
  return fetchAPI(`/queues/${queueId}/patients`);
}

/**
 * Create a new queue
 */
export async function createQueue(data: Omit<QueueDto, 'id' | 'createdAt' | 'updatedAt'>): Promise<QueueDto> {
  return fetchAPI('/queues', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Update an existing queue
 */
export async function updateQueue(queueId: number, data: Partial<QueueDto>): Promise<QueueDto> {
  return fetchAPI(`/queues/${queueId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

/**
 * Delete a queue
 */
export async function deleteQueue(queueId: number): Promise<void> {
  return fetchAPI(`/queues/${queueId}`, {
    method: 'DELETE',
  });
}

/**
 * List deleted queues in trash (soft-deleted within 30 days)
 */
export async function getTrashQueues(options?: {
  pageNumber?: number;
  pageSize?: number;
}): Promise<ListResponse<QueueDto>> {
  const params = new URLSearchParams();
  if (options?.pageNumber !== undefined) {
    params.append('pageNumber', options.pageNumber.toString());
  }
  if (options?.pageSize !== undefined) {
    params.append('pageSize', options.pageSize.toString());
  }

  const queryString = params.toString();
  return fetchAPI(`/queues/trash/list${queryString ? `?${queryString}` : ''}`);
}

/**
 * List permanently deleted queues (archived, soft-deleted over 30 days)
 * Admin only
 */
export async function getArchivedQueues(options?: {
  pageNumber?: number;
  pageSize?: number;
}): Promise<ListResponse<QueueDto>> {
  const params = new URLSearchParams();
  if (options?.pageNumber !== undefined) {
    params.append('pageNumber', options.pageNumber.toString());
  }
  if (options?.pageSize !== undefined) {
    params.append('pageSize', options.pageSize.toString());
  }

  const queryString = params.toString();
  return fetchAPI(`/queues/archived/list${queryString ? `?${queryString}` : ''}`);
}

/**
 * Restore a deleted queue from trash (within 30-day window)
 */
export async function restoreQueue(queueId: number): Promise<QueueDto> {
  return fetchAPI(`/queues/${queueId}/restore`, {
    method: 'POST',
  });
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

export const queuesApiClient = {
  getQueues,
  getQueue,
  getQueuePatients,
  createQueue,
  updateQueue,
  deleteQueue,
  getTrashQueues,
  getArchivedQueues,
  restoreQueue,
  formatApiError,
};

export default queuesApiClient;

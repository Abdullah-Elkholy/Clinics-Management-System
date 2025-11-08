/**
 * Type-safe API client for Clinics Management System backend
 * Centralizes all API calls with automatic auth header handling
 */

// ============================================
// DTOs (matching backend DTOs exactly)
// ============================================

export interface TemplateDto {
  id: number;
  title: string;
  content: string;
  queueId: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ConditionDto {
  id: number;
  templateId: number;
  operator: string;
  value?: string;
  minValue?: string;
  maxValue?: string;
  createdAt: string;
}

export interface CreateTemplateRequest {
  title: string;
  content: string;
  queueId: number;
  isActive?: boolean;
}

export interface UpdateTemplateRequest {
  title?: string;
  content?: string;
  isActive?: boolean;
}

export interface CreateConditionRequest {
  templateId: number;
  operator: string;
  value?: string;
  minValue?: string;
  maxValue?: string;
}

export interface UpdateConditionRequest {
  operator?: string;
  value?: string;
  minValue?: string;
  maxValue?: string;
}

export interface MyQuotaDto {
  limit: number;
  used: number;
  remaining: number;
  percentage: number;
  isLowQuota: boolean;
  queuesLimit: number;
  queuesUsed: number;
  queuesRemaining: number;
}

export interface QuotaDto {
  id: number;
  limit: number;
  used: number;
  remaining: number;
  percentage: number;
  isLow: boolean;
  queuesLimit: number;
  queuesUsed: number;
  queuesRemaining: number;
  updatedAt: string;
}

export interface FailedTaskDto {
  id: number;
  queueId: number;
  queueName: string;
  patientPhone: string;
  messageContent: string;
  attempts: number;
  errorMessage?: string;
  status: string;
  createdAt: string;
  lastAttemptAt?: string;
}

export interface PaginatedFailedTasksResponse {
  items: FailedTaskDto[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
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

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

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
// Templates API
// ============================================

/**
 * Get all templates for a specific queue
 */
export async function getTemplates(queueId?: number): Promise<ListResponse<TemplateDto>> {
  const params = new URLSearchParams();
  if (queueId !== undefined) {
    params.append('queueId', queueId.toString());
  }
  const queryString = params.toString();
  return fetchAPI(`/templates${queryString ? `?${queryString}` : ''}`);
}

/**
 * Get a single template by ID
 */
export async function getTemplate(id: number): Promise<TemplateDto> {
  return fetchAPI(`/templates/${id}`);
}

/**
 * Create a new template
 */
export async function createTemplate(data: CreateTemplateRequest): Promise<TemplateDto> {
  return fetchAPI('/templates', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Update an existing template
 */
export async function updateTemplate(id: number, data: UpdateTemplateRequest): Promise<TemplateDto> {
  return fetchAPI(`/templates/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

/**
 * Delete a template
 */
export async function deleteTemplate(id: number): Promise<void> {
  return fetchAPI(`/templates/${id}`, {
    method: 'DELETE',
  });
}

// ============================================
// Conditions API
// ============================================

/**
 * Get all conditions for a specific queue
 */
export async function getConditions(queueId: number): Promise<ListResponse<ConditionDto>> {
  return fetchAPI(`/conditions?queueId=${queueId}`);
}

/**
 * Get a single condition by ID
 */
export async function getCondition(id: number): Promise<ConditionDto> {
  return fetchAPI(`/conditions/${id}`);
}

/**
 * Create a new condition
 */
export async function createCondition(data: CreateConditionRequest): Promise<ConditionDto> {
  return fetchAPI('/conditions', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Update an existing condition
 */
export async function updateCondition(id: number, data: UpdateConditionRequest): Promise<ConditionDto> {
  return fetchAPI(`/conditions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

/**
 * Delete a condition
 */
export async function deleteCondition(id: number): Promise<void> {
  return fetchAPI(`/conditions/${id}`, {
    method: 'DELETE',
  });
}

// ============================================
// Quotas API
// ============================================

/**
 * Get current user's quota
 */
export async function getMyQuota(): Promise<MyQuotaDto> {
  return fetchAPI('/quotas/me');
}

/**
 * Get all quotas (admin only)
 */
export async function getAllQuotas(): Promise<ListResponse<QuotaDto>> {
  return fetchAPI('/quotas');
}

/**
 * Get quota for a specific moderator (admin only)
 */
export async function getQuota(moderatorId: number): Promise<QuotaDto> {
  return fetchAPI(`/quotas/${moderatorId}`);
}

/**
 * Add quota to a moderator (admin only)
 */
export async function addQuota(
  moderatorId: number,
  data: { limit: number; queuesLimit: number }
): Promise<MyQuotaDto> {
  return fetchAPI(`/quotas/${moderatorId}/add`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Update a moderator's quota (admin only)
 */
export async function updateQuota(
  moderatorId: number,
  data: { limit?: number; queuesLimit?: number }
): Promise<MyQuotaDto> {
  return fetchAPI(`/quotas/${moderatorId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// ============================================
// Messages API
// ============================================

/**
 * Send a message
 */
export async function sendMessage(data: {
  templateId: number;
  queueId: number;
  patientPhone: string;
}): Promise<{ id: number; status: string }> {
  return fetchAPI('/messages', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Retry sending a message
 */
export async function retryMessage(messageId: number): Promise<{ status: string; attempts: number }> {
  return fetchAPI(`/messages/${messageId}/retry`, {
    method: 'POST',
  });
}

// ============================================
// Failed Tasks API
// ============================================

/**
 * Get failed tasks with pagination
 */
export async function getFailedTasks(options?: {
  queueId?: number;
  pageNumber?: number;
  pageSize?: number;
}): Promise<PaginatedFailedTasksResponse> {
  const params = new URLSearchParams();
  if (options?.queueId !== undefined) {
    params.append('queueId', options.queueId.toString());
  }
  if (options?.pageNumber !== undefined) {
    params.append('pageNumber', options.pageNumber.toString());
  }
  if (options?.pageSize !== undefined) {
    params.append('pageSize', options.pageSize.toString());
  }
  
  const queryString = params.toString();
  return fetchAPI(`/failed-tasks${queryString ? `?${queryString}` : ''}`);
}

/**
 * Get a single failed task
 */
export async function getFailedTask(id: number): Promise<FailedTaskDto> {
  return fetchAPI(`/failed-tasks/${id}`);
}

/**
 * Retry a failed task
 */
export async function retryFailedTask(id: number): Promise<FailedTaskDto> {
  return fetchAPI(`/failed-tasks/${id}/retry`, {
    method: 'POST',
  });
}

/**
 * Dismiss a failed task
 */
export async function dismissFailedTask(id: number): Promise<void> {
  return fetchAPI(`/failed-tasks/${id}/dismiss`, {
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

export const messageApiClient = {
  // Templates
  getTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  
  // Conditions
  getConditions,
  getCondition,
  createCondition,
  updateCondition,
  deleteCondition,
  
  // Quotas
  getMyQuota,
  getAllQuotas,
  getQuota,
  addQuota,
  updateQuota,
  
  // Messages
  sendMessage,
  retryMessage,
  
  // Failed Tasks
  getFailedTasks,
  getFailedTask,
  retryFailedTask,
  dismissFailedTask,
  
  // Utilities
  formatApiError,
};

export default messageApiClient;

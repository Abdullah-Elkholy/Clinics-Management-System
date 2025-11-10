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
  isDefault: boolean;
  hasCondition: boolean;  // true = active condition, false = placeholder/no-rule
  createdAt: string;
  updatedAt: string;
}

export interface ConditionDto {
  id: number;
  templateId?: number;
  queueId: number;
  operator: string;
  value?: number;
  minValue?: number;
  maxValue?: number;
  createdAt: string;
  updatedAt?: string;
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
  queueId: number;
  operator: string;
  value?: number;
  minValue?: number;
  maxValue?: number;
}

export interface UpdateConditionRequest {
  operator?: string;
  value?: number;
  minValue?: number;
  maxValue?: number;
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
export async function fetchAPI<T>(
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
// Retry & Timeout Utilities
// ============================================

/**
 * Configuration for retry behavior
 */
interface RetryConfig {
  maxAttempts: number;
  delayMs: number;
  backoffMultiplier: number;
  timeoutMs: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 2, // 1 initial + 1 retry
  delayMs: 500,
  backoffMultiplier: 1.5,
  timeoutMs: 8000,
};

/**
 * Executes a fetch operation with automatic retry on network failures.
 * Does NOT retry on 4xx client errors (validation, auth, not found).
 * Does retry on 5xx server errors and network timeouts.
 * 
 * @param operation - Async function that returns a Promise
 * @param config - Retry configuration (uses defaults if not provided)
 * @returns Promise result or throws ApiError on all attempts failure
 */
async function withRetry<T>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: Error | ApiError | null = null;
  let delay = finalConfig.delayMs;

  for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
    try {
      // Wrap in timeout
      return await Promise.race([
        operation(),
        new Promise<T>((_, reject) =>
          setTimeout(() => reject(new Error('Request timeout')), finalConfig.timeoutMs)
        ),
      ]);
    } catch (error) {
      lastError = error as Error | ApiError;
      
      // Don't retry on client errors (4xx) or validation errors
      if (
        error &&
        typeof error === 'object' &&
        'statusCode' in error &&
        (error as ApiError).statusCode >= 400 &&
        (error as ApiError).statusCode < 500
      ) {
        throw error; // Throw immediately on 4xx
      }

      // If this is the last attempt, throw
      if (attempt === finalConfig.maxAttempts) {
        throw error;
      }

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= finalConfig.backoffMultiplier;
    }
  }

  throw lastError || new Error('Operation failed after retries');
}

// ============================================
// Templates API
// ============================================

/**
 * Get all templates for a specific queue
 */
export async function getTemplates(queueId?: number): Promise<ListResponse<TemplateDto>> {
  // Validate queueId is a valid number
  if (queueId !== undefined && isNaN(queueId)) {
    console.error('Invalid queueId provided to getTemplates:', queueId);
    return { items: [], totalCount: 0, pageNumber: 0, pageSize: 0 };
  }
  
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
 * Create a new template (with automatic retry on network failures)
 */
export async function createTemplate(data: CreateTemplateRequest): Promise<TemplateDto> {
  return withRetry(() =>
    fetchAPI('/templates', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  );
}

/**
 * Update an existing template (with automatic retry on network failures)
 */
export async function updateTemplate(id: number, data: UpdateTemplateRequest): Promise<TemplateDto> {
  return withRetry(() =>
    fetchAPI(`/templates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  );
}

/**
 * Delete a template (with automatic retry on network failures)
 */
export async function deleteTemplate(id: number): Promise<void> {
  return withRetry(() =>
    fetchAPI(`/templates/${id}`, {
      method: 'DELETE',
    })
  );
}

/**
 * Set a template as default for its queue (sets isDefault=true, hasCondition=false)
 */
export async function setTemplateAsDefault(id: number): Promise<TemplateDto> {
  return withRetry(() =>
    fetchAPI(`/templates/${id}/default`, {
      method: 'PUT',
    })
  );
}

// ============================================
// Conditions API
// ============================================

/**
 * Get all conditions for a specific queue
 */
export async function getConditions(queueId: number): Promise<ListResponse<ConditionDto>> {
  // Validate queueId is a valid number
  if (isNaN(queueId)) {
    console.error('Invalid queueId provided to getConditions:', queueId);
    return { items: [], totalCount: 0, pageNumber: 0, pageSize: 0 };
  }
  
  return fetchAPI(`/conditions?queueId=${queueId}`);
}

/**
 * Get a single condition by ID
 */
export async function getCondition(id: number): Promise<ConditionDto> {
  return fetchAPI(`/conditions/${id}`);
}

/**
 * Create a new condition (with automatic retry on network failures)
 */
export async function createCondition(data: CreateConditionRequest): Promise<ConditionDto> {
  return withRetry(() =>
    fetchAPI('/conditions', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  );
}

/**
 * Update an existing condition (with automatic retry on network failures)
 */
export async function updateCondition(id: number, data: UpdateConditionRequest): Promise<ConditionDto> {
  return withRetry(() =>
    fetchAPI(`/conditions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  );
}

/**
 * Delete a condition (with automatic retry on network failures)
 */
export async function deleteCondition(id: number): Promise<void> {
  return withRetry(() =>
    fetchAPI(`/conditions/${id}`, {
      method: 'DELETE',
    })
  );
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
  setTemplateAsDefault,
  
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
  fetchAPI,
};

export default messageApiClient;

/* global RequestInit, HeadersInit */
/**
 * Type-safe API client for Clinics Management System backend
 * Centralizes all API calls with automatic auth header handling
 */
import logger from '@/utils/logger';
import { translateNetworkError } from '@/utils/errorUtils';

// ============================================
// DTOs (matching backend DTOs exactly)
// ============================================

export interface TemplateDto {
  id: number;
  title: string;
  content: string;
  queueId: number;
  condition?: ConditionDto;  // operator-driven state: DEFAULT, UNCONDITIONED, or active rule
  createdAt: string;
  updatedAt?: string;
  createdBy?: number;
  updatedBy?: number;
  isDeleted: boolean; // Single source of truth: active = !isDeleted
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
  conditionOperator?: string;
  conditionValue?: number;
  conditionMinValue?: number;
  conditionMaxValue?: number;
  isActive?: boolean;
}

export interface UpdateTemplateRequest {
  title?: string;
  content?: string;
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
  value?: number | null;
  minValue?: number | null;
  maxValue?: number | null;
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
  id: string; // Changed from number to string (Guid)
  queueId: number;
  queueName: string;
  moderatorId: number;
  moderatorName: string;
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

type LegacyListResponse<T> = Partial<ListResponse<T>> & {
  data?: T[];
  total?: number;
  page?: number;
  pageSize?: number;
};

export interface ApiError {
  message: string;
  statusCode: number;
  error?: string; // Error code (PendingQR, PendingNET, BrowserClosure, etc.)
  code?: string; // HTTP error code (AUTHENTICATION_REQUIRED, NETWORK_FAILURE, BROWSER_CLOSED, etc.)
  warning?: boolean; // Indicates if this is a warning (should show as warning toast, not error)
  [key: string]: unknown; // Allow additional error fields
}

const DEFAULT_ERROR_MESSAGE = 'API request failed';

const extractErrorMessage = (payload: unknown, fallback = DEFAULT_ERROR_MESSAGE): string => {
  if (typeof payload === 'string') {
    return payload || fallback;
  }

  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;

    // Prioritize 'message' field (used by backend for detailed error messages, including Arabic)
    if ('message' in obj && typeof obj.message === 'string' && obj.message.trim()) {
      return obj.message;
    }

    // Fallback to 'error' field (used by backend for BadRequest responses)
    if ('error' in obj && typeof obj.error === 'string' && obj.error.trim()) {
      return obj.error;
    }
  }

  return fallback;
};

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
      // Extract error details from response (may include error, code, message, warning fields)
      const errorData = typeof data === 'object' && data !== null ? data as Record<string, unknown> : null;
      const errorMessage = extractErrorMessage(data);
      const errorCode = errorData?.error as string | undefined;
      const code = errorData?.code as string | undefined;
      const warning = errorData?.warning as boolean | undefined;

      const apiError = {
        message: errorMessage,
        statusCode: response.status,
        error: errorCode,
        code: code,
        warning: warning,
        // Include full error data for detailed handling
        ...(errorData || {}),
      } as ApiError & { error?: string; code?: string; warning?: boolean };

      // Handle auth errors globally (but not for PendingQR/PendingNET/BrowserClosure warnings)
      if ((response.status === 401 || response.status === 403) && !warning) {
        const { handleApiError } = require('@/utils/apiInterceptor');
        handleApiError(apiError);
      }

      throw apiError;
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
    logger.error('Invalid queueId provided to getTemplates:', queueId);
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
  await withRetry(() =>
    fetchAPI(`/templates/${id}`, {
      method: 'DELETE',
    })
  );
}

/**
 * List deleted templates in trash (soft-deleted within 30 days)
 */
export async function getTrashTemplates(options?: {
  pageNumber?: number;
  pageSize?: number;
}): Promise<ListResponse<TemplateDto>> {
  const page = options?.pageNumber || 1;
  const pageSize = options?.pageSize || 10;
  const params = new URLSearchParams();
  params.append('page', page.toString());
  params.append('pageSize', pageSize.toString());

  const queryString = params.toString();
  const response = await withRetry(() =>
    fetchAPI<LegacyListResponse<TemplateDto>>(`/templates/trash?${queryString}`)
  );

  return normalizeListResponse<TemplateDto>(response, { pageNumber: page, pageSize });
}

/**
 * List permanently deleted templates (archived, soft-deleted over 30 days)
 * Admin only
 */
export async function getArchivedTemplates(queueId: number, options?: {
  pageNumber?: number;
  pageSize?: number;
}): Promise<ListResponse<TemplateDto>> {
  const params = new URLSearchParams();
  params.append('queueId', queueId.toString());
  if (options?.pageNumber !== undefined) {
    params.append('pageNumber', options.pageNumber.toString());
  }
  if (options?.pageSize !== undefined) {
    params.append('pageSize', options.pageSize.toString());
  }

  const queryString = params.toString();
  const pageNumber = options?.pageNumber || 1;
  const pageSize = options?.pageSize || 10;
  const response = await withRetry(() =>
    fetchAPI<LegacyListResponse<TemplateDto>>(`/templates/archived/list?${queryString}`)
  );

  return normalizeListResponse<TemplateDto>(response, { pageNumber, pageSize });
}

/**
 * Restore a deleted template from trash (within 30-day window)
 */
export async function restoreTemplate(id: number): Promise<TemplateDto> {
  return withRetry(() =>
    fetchAPI(`/templates/${id}/restore`, {
      method: 'POST',
    })
  );
}

/**
 * Set a template as default for its queue (sets condition.operator to DEFAULT)
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
export async function getConditions(queueId?: number): Promise<ListResponse<ConditionDto>> {
  if (queueId !== undefined && isNaN(queueId)) {
    logger.error('Invalid queueId provided to getConditions:', queueId);
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
  // Build request body, explicitly including null values when provided
  // This ensures UNCONDITIONED operator gets value: null, minValue: null, maxValue: null
  const requestBody: any = {};

  if (data.operator !== undefined) {
    requestBody.operator = data.operator;

    // For UNCONDITIONED and DEFAULT operators, explicitly set null values
    if (data.operator === 'UNCONDITIONED' || data.operator === 'DEFAULT') {
      requestBody.value = null;
      requestBody.minValue = null;
      requestBody.maxValue = null;
    } else if (data.operator === 'RANGE') {
      // For RANGE, explicitly set value to null (required by backend)
      requestBody.value = null;

      // Include min/max values
      if (data.minValue !== undefined) requestBody.minValue = data.minValue;
      if (data.maxValue !== undefined) requestBody.maxValue = data.maxValue;
    } else {
      // For other operators, include values if provided
      if (data.value !== undefined) {
        requestBody.value = data.value;
      }
      if (data.minValue !== undefined) {
        requestBody.minValue = data.minValue;
      }
      if (data.maxValue !== undefined) {
        requestBody.maxValue = data.maxValue;
      }
    }
  } else {
    // If operator is not being changed, include values if provided
    if (data.value !== undefined) {
      requestBody.value = data.value;
    }
    if (data.minValue !== undefined) {
      requestBody.minValue = data.minValue;
    }
    if (data.maxValue !== undefined) {
      requestBody.maxValue = data.maxValue;
    }
  }

  return withRetry(() =>
    fetchAPI(`/conditions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(requestBody),
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
 * Send a message (single patient)
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
 * Send messages to multiple patients (bulk)
 * @param correlationId - Optional unique ID for idempotency. If provided, prevents duplicate message creation on retries.
 */
export async function sendMessages(data: {
  templateId: number;
  patientIds: number[];
  channel?: string;
  overrideContent?: string;
  correlationId?: string;
}): Promise<{ success: boolean; queued: number }> {
  return fetchAPI('/messages/send', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Retry sending a message
 */
export async function retryMessage(messageId: string): Promise<{ status: string; attempts: number }> {
  return fetchAPI(`/messages/${messageId}/retry`, {
    method: 'POST',
  });
}

/**
 * Pause a single message
 */
export async function pauseMessage(messageId: string): Promise<{ success: boolean; message: string }> {
  return fetchAPI(`/messages/${messageId}/pause`, {
    method: 'POST',
  });
}

/**
 * Resume a paused message
 */
export async function resumeMessage(messageId: string): Promise<{ success: boolean; message: string }> {
  return fetchAPI(`/messages/${messageId}/resume`, {
    method: 'POST',
  });
}

/**
 * Delete a message (soft delete)
 */
export async function deleteMessage(messageId: string): Promise<{ success: boolean; message: string }> {
  return fetchAPI(`/messages/${messageId}`, {
    method: 'DELETE',
  });
}

/**
 * Pause all messages for a session
 */
export async function pauseSessionMessages(sessionId: string): Promise<{ success: boolean; pausedCount: number }> {
  return fetchAPI(`/messages/session/${sessionId}/pause`, {
    method: 'POST',
  });
}

/**
 * Resume all paused messages for a session
 */
export async function resumeSessionMessages(sessionId: string): Promise<{ success: boolean; resumedCount: number }> {
  return fetchAPI(`/messages/session/${sessionId}/resume`, {
    method: 'POST',
  });
}

/**
 * Pause all messages for a moderator (unified WhatsApp session)
 */
export async function pauseAllModeratorMessages(moderatorId: number): Promise<{ success: boolean; pausedMessages: number; pausedSessions: number }> {
  return fetchAPI(`/messages/moderator/${moderatorId}/pause`, {
    method: 'POST',
  });
}

/**
 * Resume all paused messages for a moderator
 */
export async function resumeAllModeratorMessages(moderatorId: number): Promise<{ success: boolean; resumedMessages: number; resumedSessions: number }> {
  return fetchAPI(`/messages/moderator/${moderatorId}/resume`, {
    method: 'POST',
  });
}

// ============================================
// Sessions API
// ============================================

export interface OngoingSessionDto {
  sessionId: string; // Guid serialized as string
  queueId: number;
  queueName: string;
  startTime: string;
  total: number;
  sent: number;
  status: string; // active, paused
  isProcessing?: boolean; // Indicates if session is currently being processed (has 'sending' messages)
  patients: SessionPatientDto[];
}

export interface SessionPatientDto {
  messageId?: string; // NEW: Message ID for tracking
  patientId: number;
  name: string;
  phone: string;
  countryCode: string;
  status: string; // sent, pending, failed, queued, sending
  isPaused: boolean;
  attempts?: number;
  failedReason?: string;
  messageContent?: string; // Resolved message content (variables replaced)
}

export interface FailedSessionDto {
  sessionId: string;
  queueId: number;
  queueName: string;
  startTime: string;
  total: number;
  failed: number;
  patients: SessionPatientDto[];
}

export interface SentMessageDto {
  messageId: string;  // Guid from backend
  patientId: number;
  patientName: string;
  patientPhone: string;
  countryCode: string;
  content: string;  // Resolved content (no variables)
  sentAt: string;
  createdBy?: number;
  updatedBy?: number;
}

export interface CompletedSessionDto {
  sessionId: string;
  queueId: number;
  queueName: string;
  startTime: string;
  completedAt?: string;
  total: number;
  sent: number;
  failed: number;
  queued: number;  // Number of queued/pending messages
  hasFailedMessages: boolean;
  hasOngoingMessages: boolean;  // True if session still has queued/sending messages
  isFullyCompleted: boolean;  // True if all messages are sent or failed
  sessionStatus: 'in_progress' | 'completed';  // Current session status
  sentMessages: SentMessageDto[];
}

/**
 * Get all ongoing sessions for current user's moderator.
 * For Admins: optionally filter by moderatorId.
 */
export async function getOngoingSessions(moderatorId?: number): Promise<{ success: boolean; data: OngoingSessionDto[] }> {
  const timestamp = Date.now();
  const queryParams = [`_t=${timestamp}`];
  if (moderatorId) queryParams.push(`moderatorId=${moderatorId}`);
  const params = `?${queryParams.join('&')}`;
  return fetchAPI(`/sessions/ongoing${params}`);
}

/**
 * Get all failed sessions for current user's moderator.
 * For Admins: optionally filter by moderatorId.
 */
export async function getFailedSessions(moderatorId?: number): Promise<{ success: boolean; data: FailedSessionDto[] }> {
  const params = moderatorId ? `?moderatorId=${moderatorId}` : '';
  return fetchAPI(`/sessions/failed${params}`);
}

/**
 * Get all completed sessions for current user's moderator.
 * For Admins: optionally filter by moderatorId.
 */
export async function getCompletedSessions(moderatorId?: number): Promise<{ success: boolean; data: CompletedSessionDto[] }> {
  const params = moderatorId ? `?moderatorId=${moderatorId}` : '';
  return fetchAPI(`/sessions/completed${params}`);
}

/**
 * Pause a session
 */
export async function pauseSession(sessionId: string): Promise<{ success: boolean; pausedCount: number }> {
  return fetchAPI(`/sessions/${sessionId}/pause`, {
    method: 'POST',
  });
}

/**
 * Resume a paused session
 */
export async function resumeSession(sessionId: string): Promise<{ success: boolean; resumedCount: number }> {
  return fetchAPI(`/sessions/${sessionId}/resume`, {
    method: 'POST',
  });
}

/**
 * Retry all failed messages in a session
 * IMPORTANT: Validates WhatsApp numbers before retrying
 */
export async function retrySession(sessionId: string): Promise<{
  success: boolean;
  requeued: number;
  skipped: number;
  message?: string;
  invalidPatients?: string[];
}> {
  return fetchAPI(`/sessions/${sessionId}/retry`, {
    method: 'POST',
  });
}

/**
 * Delete/cancel a session
 */
export async function deleteSession(sessionId: string): Promise<{ success: boolean }> {
  return fetchAPI(`/sessions/${sessionId}`, {
    method: 'DELETE',
  });
}

// ============================================
// Failed Tasks API
// NOTE: FailedTasksController removed - now using Messages API
// Failed messages are tracked via Message.Status = "failed"
// ============================================

/**
 * Get failed tasks with pagination
 * @deprecated Use getFailedSessions() instead - FailedTasks table removed
 */
export async function getFailedTasks(options?: {
  queueId?: number;
  moderatorUserId?: number;
  pageNumber?: number;
  pageSize?: number;
}): Promise<PaginatedFailedTasksResponse> {
  // FailedTasks endpoint removed - redirect to failed sessions
  const response = await getFailedSessions();

  // Transform FailedSessionDto to FailedTaskDto format
  const items: FailedTaskDto[] = [];
  if (response.success && response.data) {
    response.data.forEach(session => {
      session.patients.forEach(patient => {
        items.push({
          id: patient.messageId || String(patient.patientId),
          queueId: session.queueId,
          queueName: session.queueName,
          moderatorId: 0, // Not available in session response
          moderatorName: '',
          patientPhone: patient.phone,
          messageContent: patient.messageContent || '',
          attempts: patient.attempts || 0,
          errorMessage: patient.failedReason,
          status: 'failed',
          createdAt: session.startTime,
        });
      });
    });
  }

  return {
    items,
    totalCount: items.length,
    pageNumber: options?.pageNumber || 1,
    pageSize: options?.pageSize || items.length,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  };
}

/**
 * Get a single failed task
 * @deprecated Use message status check instead - FailedTasks table removed
 */
export async function getFailedTask(id: number): Promise<FailedTaskDto> {
  throw new Error('getFailedTask is deprecated - FailedTasks table removed. Use message status check instead.');
}

/**
 * Retry a failed task (message)
 * Now uses /messages/{id}/retry endpoint since FailedTasksController was removed
 */
export async function retryFailedTask(id: string): Promise<FailedTaskDto> {
  // Use the message retry endpoint instead of deleted failed-tasks endpoint
  const result = await fetchAPI<{ success: boolean; status: string; attempts: number }>(`/messages/${id}/retry`, {
    method: 'POST',
  });

  // Transform to FailedTaskDto format for backwards compatibility
  return {
    id: id,
    queueId: 0,
    queueName: '',
    moderatorId: 0,
    moderatorName: '',
    patientPhone: '',
    messageContent: '',
    attempts: result.attempts || 0,
    status: result.status || 'queued',
    createdAt: new Date().toISOString(),
  };
}

/**
 * Dismiss a failed task (delete message)
 * Now uses /messages/{id} DELETE endpoint since FailedTasksController was removed
 */
export async function dismissFailedTask(id: string): Promise<void> {
  // Use the message delete endpoint instead of deleted failed-tasks endpoint
  await fetchAPI(`/messages/${id}`, {
    method: 'DELETE',
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

/**
 * Get retry preview for a session - shows which messages can be retried vs skipped
 */
export async function getRetryPreview(sessionId: string) {
  return fetchAPI<{
    success: boolean;
    retryable: { count: number; reasons: Array<{ reason: string; count: number }> };
    nonRetryable: { count: number; reasons: Array<{ reason: string; count: number }> };
    requiresAction: { count: number; reasons: Array<{ reason: string; count: number }> };
  }>(`/messages/sessions/${sessionId}/retry-preview`, {
    method: 'POST',
  });
}

export const messageApiClient = {
  // Templates
  getTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  setTemplateAsDefault,
  getTrashTemplates,
  getArchivedTemplates,
  restoreTemplate,

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
  sendMessages,
  retryMessage,
  pauseMessage,
  resumeMessage,
  deleteMessage,
  pauseSessionMessages,
  resumeSessionMessages,
  pauseAllModeratorMessages,
  resumeAllModeratorMessages,

  // Sessions
  getOngoingSessions,
  getFailedSessions,
  getCompletedSessions,
  pauseSession,
  resumeSession,
  retrySession,
  deleteSession,

  // Failed Tasks
  getFailedTasks,
  getFailedTask,
  retryFailedTask,
  dismissFailedTask,

  // Retry Preview
  getRetryPreview,

  // Utilities
  formatApiError,
  fetchAPI,
};

export default messageApiClient;

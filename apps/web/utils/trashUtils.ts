/**
 * Trash & Archive Utilities
 * File: apps/web/utils/trashUtils.ts
 * 
 * Helper functions for soft-delete operations, error handling, and UI state
 */

import { ApiError } from '@/services/api/messageApiClient';

type RestoreErrorMetadata = Record<string, unknown> & {
  availableQuota?: number;
  requiredQuota?: number;
  expiryDate?: string;
};

/**
 * Error types for restore operations
 */
export enum RestoreErrorType {
  RESTORE_WINDOW_EXPIRED = 'restore_window_expired',
  QUOTA_INSUFFICIENT = 'quota_insufficient',
  NOT_FOUND = 'not_found',
  PERMISSION_DENIED = 'permission_denied',
  CONFLICT = 'conflict',
  UNKNOWN = 'unknown',
}

/**
 * Restore operation error details
 */
export interface RestoreError {
  type: RestoreErrorType;
  message: string;
  statusCode: number;
  metadata?: RestoreErrorMetadata;
}

type ApiErrorLike = ApiError & { metadata?: RestoreErrorMetadata };

const FALLBACK_ERROR: ApiErrorLike = {
  message: 'An unexpected error occurred.',
  statusCode: 0,
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isRestoreMetadata = (metadata: unknown): metadata is RestoreErrorMetadata =>
  isRecord(metadata);

const normalizeApiError = (error: unknown): ApiErrorLike => {
  if (!isRecord(error)) {
    return FALLBACK_ERROR;
  }

  const message = typeof error.message === 'string' && error.message.trim().length > 0
    ? error.message
    : FALLBACK_ERROR.message;
  const statusCode = typeof error.statusCode === 'number' ? error.statusCode : FALLBACK_ERROR.statusCode;
  const metadata = isRestoreMetadata(error.metadata) ? error.metadata : undefined;

  return { message, statusCode, metadata };
};

/**
 * Parse API error into RestoreError
 */
export function parseRestoreError(error: unknown): RestoreError {
  if (error instanceof TypeError) {
    return {
      type: RestoreErrorType.UNKNOWN,
      message: 'Network error. Please check your connection.',
      statusCode: 0,
    };
  }

  const apiError = normalizeApiError(error);
  const { statusCode, message } = apiError;

  // Parse error code from message or headers
  let errorType = RestoreErrorType.UNKNOWN;

  if (message.includes('restore_window_expired')) {
    errorType = RestoreErrorType.RESTORE_WINDOW_EXPIRED;
  } else if (message.includes('quota_insufficient')) {
    errorType = RestoreErrorType.QUOTA_INSUFFICIENT;
  } else if (statusCode === 404) {
    errorType = RestoreErrorType.NOT_FOUND;
  } else if (statusCode === 403) {
    errorType = RestoreErrorType.PERMISSION_DENIED;
  } else if (statusCode === 409) {
    errorType = message.includes('quota')
      ? RestoreErrorType.QUOTA_INSUFFICIENT
      : RestoreErrorType.CONFLICT;
  }

  // Extract metadata if available
  const metadata = apiError.metadata;

  return {
    type: errorType,
    message,
    statusCode,
    metadata,
  };
}

/**
 * Get user-friendly error message for restore operations
 */
export function getRestoreErrorMessage(error: RestoreError): string {
  switch (error.type) {
    case RestoreErrorType.RESTORE_WINDOW_EXPIRED:
      return 'This item has been deleted for too long (over 30 days) and can no longer be restored. It is permanently archived.';
    
    case RestoreErrorType.QUOTA_INSUFFICIENT:
      return `Cannot restore: insufficient quota. You need ${error.metadata?.requiredQuota || '?'} slots but only have ${error.metadata?.availableQuota || '?'} available.`;
    
    case RestoreErrorType.NOT_FOUND:
      return 'This item could not be found. It may have been permanently deleted.';
    
    case RestoreErrorType.PERMISSION_DENIED:
      return 'You do not have permission to restore this item.';
    
    case RestoreErrorType.CONFLICT:
      return error.message || 'A conflict occurred while restoring. Please try again.';
    
    default:
      return error.message || 'Failed to restore item. Please try again.';
  }
}

/**
 * Calculate days remaining until deletion is permanent
 */
export function getDaysRemainingInTrash(deletedAt: string, ttlDays: number = 30): number {
  const deleted = new Date(deletedAt);
  const expiryDate = new Date(deleted);
  expiryDate.setDate(expiryDate.getDate() + ttlDays);

  const now = new Date();
  const msRemaining = expiryDate.getTime() - now.getTime();
  const days = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));

  return Math.max(0, days);
}

/**
 * Check if item is restorable
 */
export function isRestorable(deletedAt: string, ttlDays: number = 30): boolean {
  return getDaysRemainingInTrash(deletedAt, ttlDays) > 0;
}

/**
 * Convert Western digits (0-9) to Arabic-Indic numerals (٠-٩)
 */
function toArabicNumerals(str: string): string {
  const arabicNumerals = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return str.replace(/\d/g, (digit) => arabicNumerals[parseInt(digit)]);
}

/**
 * Format deletion date for display (in Arabic)
 */
export function formatDeletionDate(deletedAt: string): string {
  const date = new Date(deletedAt);
  const now = new Date();
  
  const daysDiff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysDiff === 0) {
    return 'تم الحذف اليوم';
  } else if (daysDiff === 1) {
    return 'تم الحذف أمس';
  } else if (daysDiff < 7) {
    return `تم الحذف منذ ${toArabicNumerals(String(daysDiff))} ${daysDiff === 1 ? 'يوم' : 'أيام'}`;
  } else {
    // Use formatLocalDate from dateTimeUtils for full Arabic formatting
    const { formatLocalDate } = require('@/utils/dateTimeUtils');
    return formatLocalDate(date);
  }
}

/**
 * Pagination helper for trash/archive lists
 */
export interface PaginationState {
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export function calculatePaginationState(
  pageNumber: number,
  pageSize: number,
  totalCount: number
): PaginationState {
  const totalPages = Math.ceil(totalCount / pageSize);
  return {
    pageNumber,
    pageSize,
    totalCount,
    hasNextPage: pageNumber < totalPages,
    hasPreviousPage: pageNumber > 1,
  };
}

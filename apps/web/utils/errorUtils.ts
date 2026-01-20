/**
 * Error Translation Utilities
 * Translates common network and API errors to descriptive Arabic messages
 */

export const BACKEND_UNREACHABLE_MESSAGE =
  'تعذر الاتصال بالخادم. تأكد من أن الخادم يعمل وحاول مرة أخرى';

/**
 * Extract a human-readable message from unknown error shapes.
 * Prefers `.message`, then `.error`, then stringification.
 */
export function getErrorMessage(error: unknown, fallback = 'حدث خطأ غير متوقع'): string {
  if (!error) return fallback;

  if (typeof error === 'string') {
    return error || fallback;
  }

  if (error instanceof Error) {
    return error.message || fallback;
  }

  if (typeof error === 'object') {
    if ('message' in error) {
      const message = (error as { message?: unknown }).message;
      if (typeof message === 'string' && message) return message;
    }

    if ('error' in error) {
      const err = (error as { error?: unknown }).error;
      if (typeof err === 'string' && err) return err;
    }
  }

  try {
    return String(error) || fallback;
  } catch {
    return fallback;
  }
}

/**
 * Translate network errors to descriptive Arabic messages
 * @param error - Error object or error message string
 * @returns Arabic error message
 */
export function translateNetworkError(error: unknown): string {
  if (!error) {
    return 'حدث خطأ غير معروف';
  }

  // Handle Error objects
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();

    // Network connection errors
    if (
      message.includes('failed to fetch') ||
      message.includes('networkerror') ||
      message.includes('network error') ||
      name === 'typeerror' ||
      message.includes('err_connection_refused') ||
      message.includes('connection refused')
    ) {
      return BACKEND_UNREACHABLE_MESSAGE;
    }

    // Timeout errors
    if (
      message.includes('timeout') ||
      message.includes('timed out') ||
      message.includes('request timeout') ||
      name === 'timeouterror' ||
      message.includes('aborted')
    ) {
      return 'انتهت مهلة الاتصال. يرجى المحاولة مرة أخرى';
    }

    // Abort errors
    if (name === 'aborterror' || message.includes('aborted')) {
      return 'تم إلغاء الطلب';
    }

    // CORS errors
    if (message.includes('cors') || message.includes('cross-origin')) {
      return 'خطأ في صلاحيات الوصول. يرجى الاتصال بالدعم الفني';
    }

    // DNS errors
    if (message.includes('dns') || message.includes('name not resolved')) {
      return 'فشل في العثور على الخادم. يرجى التحقق من الاتصال بالإنترنت';
    }

    // SSL/TLS errors
    if (message.includes('ssl') || message.includes('tls') || message.includes('certificate')) {
      return 'خطأ في شهادة الأمان. يرجى الاتصال بالدعم الفني';
    }

    // Generic fetch errors
    if (message.includes('fetch')) {
      return 'فشل في إرسال الطلب. يرجى المحاولة مرة أخرى';
    }
  }

  // Handle string errors
  if (typeof error === 'string') {
    const message = error.toLowerCase();

    if (
      message.includes('failed to fetch') ||
      message.includes('networkerror') ||
      message.includes('network error') ||
      message.includes('err_connection_refused') ||
      message.includes('connection refused')
    ) {
      return BACKEND_UNREACHABLE_MESSAGE;
    }

    if (
      message.includes('timeout') ||
      message.includes('timed out') ||
      message.includes('request timeout')
    ) {
      return 'انتهت مهلة الاتصال. يرجى المحاولة مرة أخرى';
    }
  }

  // Handle objects with message property
  if (error && typeof error === 'object' && 'message' in error) {
    const message = String((error as { message?: unknown }).message || '').toLowerCase();

    if (
      message.includes('failed to fetch') ||
      message.includes('networkerror') ||
      message.includes('network error') ||
      message.includes('err_connection_refused') ||
      message.includes('connection refused')
    ) {
      return BACKEND_UNREACHABLE_MESSAGE;
    }

    if (
      message.includes('timeout') ||
      message.includes('timed out') ||
      message.includes('request timeout')
    ) {
      return 'انتهت مهلة الاتصال. يرجى المحاولة مرة أخرى';
    }
  }

  // Default fallback
  return 'حدث خطأ أثناء الاتصال بالخادم. يرجى المحاولة مرة أخرى';
}

/**
 * Check if error is a network/connection error
 * @param error - Error object or error message
 * @returns true if it's a network error
 */
export function isNetworkError(error: unknown): boolean {
  if (!error) return false;

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();

    return (
      message.includes('failed to fetch') ||
      message.includes('networkerror') ||
      message.includes('network error') ||
      message.includes('err_connection_refused') ||
      message.includes('connection refused') ||
      message.includes('timeout') ||
      message.includes('timed out') ||
      name === 'typeerror' ||
      name === 'timeouterror'
    );
  }

  if (typeof error === 'string') {
    const message = error.toLowerCase();
    return (
      message.includes('failed to fetch') ||
      message.includes('networkerror') ||
      message.includes('network error') ||
      message.includes('err_connection_refused') ||
      message.includes('connection refused') ||
      message.includes('timeout') ||
      message.includes('timed out')
    );
  }

  return false;
}

/**
 * Check if error is a timeout error
 * @param error - Error object or error message
 * @returns true if it's a timeout error
 */
export function isTimeoutError(error: unknown): boolean {
  if (!error) return false;

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();
    return (
      message.includes('timeout') ||
      message.includes('timed out') ||
      message.includes('request timeout') ||
      name === 'timeouterror'
    );
  }

  if (typeof error === 'string') {
    const message = error.toLowerCase();
    return (
      message.includes('timeout') ||
      message.includes('timed out') ||
      message.includes('request timeout')
    );
  }

  return false;
}


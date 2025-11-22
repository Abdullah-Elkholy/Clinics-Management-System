/**
 * Centralized Utility Functions
 * Single source of truth for all utility operations across the application
 */

import { PHONE_CONFIG } from '@/config/app.config';

// ============================================================================
// COUNTRY CODE UTILITIES
// ============================================================================

/**
 * Get effective country code, handling "OTHER" option
 * @param selected - Selected country code value
 * @param custom - Custom country code (when selected is "OTHER")
 * @returns The effective country code to use
 */
export const getEffectiveCountryCode = (
  selected: string,
  custom: string
): string => {
  if (selected === 'OTHER') {
    return custom || PHONE_CONFIG.DEFAULT_COUNTRY_CODE;
  }
  return selected || PHONE_CONFIG.DEFAULT_COUNTRY_CODE;
};

/**
 * Check if a country code is "OTHER" or unknown
 * @param countryCode - Country code to check
 * @returns true if OTHER or unknown
 */
export const isOtherCountryCode = (countryCode: string): boolean => {
  return countryCode === 'OTHER' || !countryCode.startsWith('+');
};

// ============================================================================
// PHONE NUMBER UTILITIES
// ============================================================================

/**
 * Format phone number for display with country code
 * @param phone - Phone number (national format, e.g., "1018542431")
 * @param countryCode - Country code (e.g., "+20")
 * @returns Formatted phone number for display (e.g., "+20 1018542431")
 */
export const formatPhoneForDisplay = (phone: string, countryCode?: string): string => {
  if (!phone) return '';
  
  // If country code provided, format as "+CC PHONE"
  if (countryCode) {
    return `${countryCode} ${phone}`;
  }
  
  return phone;
};

// ============================================================================
// STRING UTILITIES
// ============================================================================

/**
 * Sanitize user input to prevent XSS
 * @param input - Raw input string
 * @returns Sanitized string
 */
export const sanitizeInput = (input: string): string => {
  return input
    .trim()
    .replace(/[<>]/g, '')
    .slice(0, 1000);
};

/**
 * Truncate text with ellipsis
 * @param text - Text to truncate
 * @param maxLength - Maximum length
 * @returns Truncated text
 */
export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

/**
 * Convert Arabic text to Latin (if needed)
 * @param text - Text to convert
 * @returns Converted text
 */
export const arabicToLatin = (text: string): string => {
  const arabicNumbers = /[٠-٩]/g;
  return text.replace(arabicNumbers, (digit) => {
    return String.fromCharCode(digit.charCodeAt(0) - 1728);
  });
};

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

/**
 * Check if string is empty or whitespace only
 * @param value - String to check
 * @returns true if empty
 */
export const isEmpty = (value: string): boolean => {
  return !value || value.trim().length === 0;
};

/**
 * Check if string matches a regex pattern
 * @param value - String to check
 * @param pattern - Regex pattern
 * @returns true if matches
 */
export const matchesPattern = (value: string, pattern: RegExp): boolean => {
  return pattern.test(value);
};

/**
 * Validate phone number format
 * @param phone - Phone number to validate
 * @returns true if valid
 */
export const isValidPhoneFormat = (phone: string): boolean => {
  return PHONE_CONFIG.PHONE_REGEX.test(phone);
};

/**
 * Validate country code format
 * @param code - Country code to validate
 * @returns true if valid
 */
export const isValidCountryCodeFormat = (code: string): boolean => {
  return (
    code === 'OTHER' || PHONE_CONFIG.COUNTRY_CODE_REGEX.test(code)
  );
};

// ============================================================================
// ARRAY UTILITIES
// ============================================================================

/**
 * Remove duplicates from array
 * @param arr - Array to deduplicate
 * @returns Deduplicated array
 */
export const removeDuplicates = <T>(arr: T[]): T[] => {
  return Array.from(new Set(arr));
};

/**
 * Group array items by key
 * @param arr - Array to group
 * @param key - Property key to group by
 * @returns Object with grouped items
 */
export const groupBy = <T extends Record<string, any>>(
  arr: T[],
  key: keyof T
): Record<string, T[]> => {
  return arr.reduce(
    (groups, item) => {
      const groupKey = String(item[key]);
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(item);
      return groups;
    },
    {} as Record<string, T[]>
  );
};

// ============================================================================
// OBJECT UTILITIES
// ============================================================================

/**
 * Deep merge two objects
 * @param target - Target object
 * @param source - Source object
 * @returns Merged object
 */
export const deepMerge = <T extends Record<string, any>>(
  target: T,
  source: Partial<T>
): T => {
  const result = { ...target } as any;

  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const sourceValue = source[key];
      const targetValue = result[key];

      if (
        sourceValue &&
        typeof sourceValue === 'object' &&
        !Array.isArray(sourceValue) &&
        targetValue &&
        typeof targetValue === 'object' &&
        !Array.isArray(targetValue)
      ) {
        result[key] = deepMerge(
          targetValue as Record<string, any>,
          sourceValue as Record<string, any>
        );
      } else {
        result[key] = sourceValue;
      }
    }
  }

  return result as T;
};

/**
 * Check if object is empty
 * @param obj - Object to check
 * @returns true if empty
 */
export const isEmptyObject = (obj: Record<string, any>): boolean => {
  return Object.keys(obj).length === 0;
};

// ============================================================================
// NUMBER UTILITIES
// ============================================================================

/**
 * Format number as currency (Arabic format)
 * @param value - Number to format
 * @returns Formatted currency string
 */
export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('ar-EG', {
    style: 'currency',
    currency: 'EGP',
  }).format(value);
};

/**
 * Format number with thousand separators
 * @param value - Number to format
 * @returns Formatted number string
 */
export const formatNumber = (value: number): string => {
  return value.toLocaleString('ar-EG');
};

// ============================================================================
// DATE UTILITIES
// ============================================================================

/**
 * Format date to human-readable Arabic format
 * @param date - Date to format
 * @returns Formatted date string
 */
export const formatDateArabic = (date: Date): string => {
  return new Intl.DateTimeFormat('ar-EG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
};

/**
 * Format time to human-readable format
 * @param date - Date to format
 * @returns Formatted time string
 */
export const formatTime = (date: Date): string => {
  return new Intl.DateTimeFormat('ar-EG', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
};

// ============================================================================
// ERROR HANDLING UTILITIES
// ============================================================================

/**
 * Get error message from error object
 * @param error - Error object
 * @returns Error message string
 */
export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'حدث خطأ غير متوقع';
};

/**
 * Log error in development mode
 * @param context - Where error occurred
 * @param error - Error object
 */
export const logError = (context: string, error: unknown): void => {
  // Intentionally no-op to avoid console noise in the client
};

/**
 * Custom React Hooks
 * Reusable hook logic extracted from components for better code organization
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  ValidationError,
  validateCountryCode,
  validatePhone,
  validateName,
} from '@/utils/validation';
import { getEffectiveCountryCode, normalizePhoneNumber } from '@/utils/core.utils';

// ============================================================================
// useFormValidation HOOK
// ============================================================================

interface UseFormValidationOptions {
  initialErrors?: ValidationError;
  onErrorChange?: (errors: ValidationError) => void;
}

/**
 * Reusable hook for form validation
 * Handles validation state and provides methods to validate fields
 */
export const useFormValidation = (
  options: UseFormValidationOptions = {}
) => {
  const [errors, setErrors] = useState<ValidationError>(
    options.initialErrors || {}
  );

  const validateField = useCallback(
    (fieldName: string, value: string, validator: (val: string) => string | null) => {
      const error = validator(value);

      setErrors((prev) => {
        const newErrors = { ...prev };
        if (error) {
          newErrors[fieldName] = error;
        } else {
          delete newErrors[fieldName];
        }
        options.onErrorChange?.(newErrors);
        return newErrors;
      });

      return error;
    },
    [options]
  );

  const validateMultiple = useCallback(
    (
      validators: Record<string, { value: string; validator: (val: string) => string | null }>
    ) => {
      const newErrors: ValidationError = {};

      for (const fieldName in validators) {
        const { value, validator } = validators[fieldName];
        const error = validator(value);
        if (error) {
          newErrors[fieldName] = error;
        }
      }

      setErrors(newErrors);
      options.onErrorChange?.(newErrors);
      return Object.keys(newErrors).length === 0;
    },
    [options]
  );

  const clearErrors = useCallback(() => {
    setErrors({});
    options.onErrorChange?.({});
  }, [options]);

  const hasErrors = useCallback(() => {
    return Object.keys(errors).length > 0;
  }, [errors]);

  return {
    errors,
    setErrors,
    validateField,
    validateMultiple,
    clearErrors,
    hasErrors,
  };
};

// ============================================================================
// usePhoneValidation HOOK
// ============================================================================

interface UsePhoneValidationOptions {
  initialPhone?: string;
  initialCountryCode?: string;
  onPhoneChange?: (phone: string) => void;
  onCountryCodeChange?: (code: string) => void;
}

/**
 * Reusable hook for phone validation with country code handling
 */
export const usePhoneValidation = (
  options: UsePhoneValidationOptions = {}
) => {
  const [phone, setPhone] = useState(options.initialPhone || '');
  const [countryCode, setCountryCode] = useState(
    options.initialCountryCode || '+20'
  );
  const [customCountryCode, setCustomCountryCode] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [countryCodeError, setCountryCodeError] = useState<string | null>(
    null
  );

  const handlePhoneChange = useCallback(
    (value: string) => {
      setPhone(value);
      options.onPhoneChange?.(value);

      // Validate phone
      const error = validatePhone(value);
      setPhoneError(error);
    },
    [options]
  );

  const handleCountryCodeChange = useCallback(
    (value: string) => {
      setCountryCode(value);
      options.onCountryCodeChange?.(value);

      // Validate country code
      const error = validateCountryCode(value, true);
      setCountryCodeError(error);
    },
    [options]
  );

  const handleCustomCountryCodeChange = useCallback((value: string) => {
    setCustomCountryCode(value);

    // Validate custom code
    const error = validateCountryCode(value, true);
    setCountryCodeError(error);
  }, []);

  const getNormalizedPhone = useCallback(() => {
    const effectiveCode = getEffectiveCountryCode(
      countryCode,
      customCountryCode
    );
    return normalizePhoneNumber(phone, effectiveCode);
  }, [phone, countryCode, customCountryCode]);

  const isValid = useCallback(() => {
    return !phoneError && !countryCodeError && phone.trim() !== '';
  }, [phoneError, countryCodeError, phone]);

  return {
    phone,
    countryCode,
    customCountryCode,
    phoneError,
    countryCodeError,
    handlePhoneChange,
    handleCountryCodeChange,
    handleCustomCountryCodeChange,
    getNormalizedPhone,
    isValid,
  };
};

// ============================================================================
// useAsyncState HOOK
// ============================================================================

interface UseAsyncStateOptions<T> {
  initialValue?: T;
  onSuccess?: (value: T) => void;
  onError?: (error: Error) => void;
}

/**
 * Reusable hook for managing async state with loading and error states
 */
export const useAsyncState = <T,>(
  options: UseAsyncStateOptions<T> = {}
) => {
  const [value, setValue] = useState<T | undefined>(options.initialValue);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const execute = useCallback(
    async (asyncFunction: () => Promise<T>) => {
      setLoading(true);
      setError(null);

      try {
        const result = await asyncFunction();
        setValue(result);
        options.onSuccess?.(result);
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        options.onError?.(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [options]
  );

  const reset = useCallback(() => {
    setValue(options.initialValue);
    setLoading(false);
    setError(null);
  }, [options.initialValue]);

  return { value, loading, error, execute, reset, setValue };
};

// ============================================================================
// useDebounce HOOK
// ============================================================================

/**
 * Reusable hook for debouncing values
 */
export const useDebounce = <T,>(value: T, delay: number = 500): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
};

// ============================================================================
// useLocalStorage HOOK
// ============================================================================

interface UseLocalStorageOptions {
  serializer?: (value: any) => string;
  deserializer?: (value: string) => any;
}

/**
 * Reusable hook for managing localStorage
 */
export const useLocalStorage = <T,>(
  key: string,
  initialValue: T,
  options: UseLocalStorageOptions = {}
) => {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item =
        typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
      return item
        ? (options.deserializer || JSON.parse)(item)
        : initialValue;
    } catch (error) {
      console.error(`Error reading from localStorage [${key}]:`, error);
      return initialValue;
    }
  });

  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      try {
        const valueToStore =
          value instanceof Function ? value(storedValue) : value;
        setStoredValue(valueToStore);

        if (typeof window !== 'undefined') {
          window.localStorage.setItem(
            key,
            (options.serializer || JSON.stringify)(valueToStore)
          );
        }
      } catch (error) {
        console.error(`Error writing to localStorage [${key}]:`, error);
      }
    },
    [key, storedValue, options]
  );

  const removeValue = useCallback(() => {
    try {
      setStoredValue(initialValue);

      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(key);
      }
    } catch (error) {
      console.error(`Error removing from localStorage [${key}]:`, error);
    }
  }, [key, initialValue]);

  return [storedValue, setValue, removeValue] as const;
};

// ============================================================================
// usePrevious HOOK
// ============================================================================

/**
 * Reusable hook to access previous value of a prop or state
 */
export const usePrevious = <T,>(value: T): T | undefined => {
  const ref = useRef<T | undefined>(undefined);

  useEffect(() => {
    ref.current = value;
  }, [value]);

  return ref.current;
};

// ============================================================================
// useClickOutside HOOK
// ============================================================================

/**
 * Reusable hook to detect click outside of an element
 */
export const useClickOutside = (
  ref: React.RefObject<HTMLElement>,
  callback: () => void
) => {
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        callback();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [ref, callback]);
};

// ============================================================================
// useFetch HOOK
// ============================================================================

interface UseFetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
  immediate?: boolean;
}

/**
 * Reusable hook for fetching data
 */
export const useFetch = <T,>(
  url: string,
  options: UseFetchOptions = {}
) => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(options.immediate !== false);
  const [error, setError] = useState<Error | null>(null);

  const execute = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(url, {
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...(options.body && { body: JSON.stringify(options.body) }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = (await response.json()) as T;
      setData(result);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [url, options]);

  useEffect(() => {
    if (options.immediate !== false) {
      execute();
    }
  }, [url, options, execute]);

  return { data, loading, error, execute };
};

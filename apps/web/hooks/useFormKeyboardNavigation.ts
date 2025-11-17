/**
 * useFormKeyboardNavigation Hook
 * 
 * Provides keyboard navigation and Enter key submission for forms.
 * Handles:
 * - Enter key submission (except in textareas)
 * - Tab order management
 * - Escape key cancellation (optional)
 * - Focus management
 */

import { useEffect, useRef, useCallback } from 'react';

export interface UseFormKeyboardNavigationOptions {
  /**
   * Form element ref or form ID
   */
  formRef?: React.RefObject<HTMLFormElement> | string;
  
  /**
   * Callback when Enter is pressed in a text input
   * Should return true if submission was successful
   */
  onEnterSubmit?: () => void | boolean | Promise<void | boolean>;
  
  /**
   * Callback when Escape is pressed (optional)
   */
  onEscape?: () => void;
  
  /**
   * Whether to enable Enter key submission (default: true)
   */
  enableEnterSubmit?: boolean;
  
  /**
   * Whether to enable Escape key cancellation (default: false)
   */
  enableEscape?: boolean;
  
  /**
   * Custom selector for inputs that should trigger submission
   * Default: 'input[type="text"], input[type="email"], input[type="password"], input[type="number"], input[type="tel"]'
   */
  submitInputSelector?: string;
  
  /**
   * Whether the form is currently disabled/loading
   */
  disabled?: boolean;
}

/**
 * Hook to handle keyboard navigation in forms
 */
export function useFormKeyboardNavigation(options: UseFormKeyboardNavigationOptions = {}) {
  const {
    formRef,
    onEnterSubmit,
    onEscape,
    enableEnterSubmit = true,
    enableEscape = false,
    submitInputSelector = 'input[type="text"], input[type="email"], input[type="password"], input[type="number"], input[type="tel"]',
    disabled = false,
  } = options;

  // Helper to get current form element synchronously
  // This is called when events fire, so formRef.current should be available if form is mounted
  const getFormElement = useCallback((): HTMLFormElement | null => {
    if (typeof formRef === 'string') {
      // If formRef is a string, treat it as an ID
      return document.getElementById(formRef) as HTMLFormElement;
    } else if (formRef && 'current' in formRef) {
      // If formRef is a ref object, check current directly
      // When event fires, if form is mounted, formRef.current will be set
      return formRef.current;
    }
    return null;
  }, [formRef]);

  // Handle Enter key in inputs
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (disabled) return;

    const target = e.target as HTMLElement;
    
    // Get form element synchronously when event fires
    // If form is mounted, formRef.current should be available
    const formElement = getFormElement();
    
    // If we have a form ref, verify target is within it
    // This ensures we only handle events for our specific form
    if (formElement && !formElement.contains(target)) {
      return; // Event not in our form, ignore
    }
    
    // If no form ref and no form element found, skip (form might not be mounted yet)
    // This is okay - we'll catch it on the next render when form mounts
    if (!formElement) {
      // Check if target has a form ancestor as fallback
      const closestForm = target.closest('form');
      if (!closestForm) {
        return; // No form context at all
      }
    }
    
    // Check if target is an input that should trigger submission
    const isSubmitInput = target.matches(submitInputSelector);
    const isTextarea = target.tagName === 'TEXTAREA';
    const isSelect = target.tagName === 'SELECT';
    
    // Enter key handling
    if (e.key === 'Enter' && enableEnterSubmit) {
      // Don't submit if:
      // 1. It's a textarea (Enter should create new line)
      // 2. It's a select dropdown (Enter should select option)
      // 3. It's not a submit input
      // 4. Shift+Enter (user wants new line in input)
      if (isTextarea || isSelect || !isSubmitInput || e.shiftKey) {
        return;
      }

      // Use formElement if available, otherwise fall back to closest form
      const form = formElement || target.closest('form');
      if (!form) {
        return;
      }

      // Prevent default form submission (we'll handle it manually)
      e.preventDefault();
      e.stopPropagation();

      // Call submit handler
      if (onEnterSubmit) {
        const result = onEnterSubmit();
        // If it's a promise, handle it
        if (result instanceof Promise) {
          result.catch((error) => {
            console.error('Form submission error:', error);
          });
        }
      } else {
        // Default: trigger form submission
        const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
        form.dispatchEvent(submitEvent);
      }
    }

    // Escape key handling
    if (e.key === 'Escape' && enableEscape && onEscape) {
      // Only handle escape if target is in our form (or no form ref specified)
      if (!formElement || formElement.contains(target)) {
        e.preventDefault();
        e.stopPropagation();
        onEscape();
      }
    }
  }, [disabled, enableEnterSubmit, enableEscape, onEnterSubmit, onEscape, submitInputSelector, getFormElement]);

  // Attach event listeners
  // Listen on document with capture phase to catch events from dynamically mounted forms (e.g., modals)
  // The handler checks formRef.current synchronously when events fire, so it works even if form mounts after hook runs
  useEffect(() => {
    // Listen on document to catch all keyboard events
    // We check formRef.current in the handler, so it works even if form hasn't mounted yet
    document.addEventListener('keydown', handleKeyDown, true);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [handleKeyDown]);

  // Helper to set tab order on inputs
  const setTabOrder = useCallback((inputs: (HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement)[], startIndex = 1) => {
    inputs.forEach((input, index) => {
      if (!input.disabled && input.offsetParent !== null) {
        // offsetParent is null if element is hidden
        input.tabIndex = startIndex + index;
      } else {
        input.tabIndex = -1; // Skip disabled/hidden elements
      }
    });
  }, []);

  return {
    setTabOrder,
  };
}


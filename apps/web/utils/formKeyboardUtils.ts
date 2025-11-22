/**
 * Form Keyboard Utilities
 * 
 * Helper functions for managing keyboard navigation in forms
 */

/**
 * Get all focusable form elements in logical order
 */
export function getFormElementsInOrder(form: HTMLFormElement): (HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | HTMLButtonElement)[] {
  const selectors = [
    'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"])',
    'textarea',
    'select',
    'button:not([type="submit"]):not([type="reset"])',
    'input[type="submit"]',
    'input[type="button"]',
  ];

  const elements: (HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | HTMLButtonElement)[] = [];

  selectors.forEach((selector) => {
    const found = Array.from(form.querySelectorAll(selector)) as (HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | HTMLButtonElement)[];
    elements.push(...found);
  });

  // Filter out disabled and hidden elements
  return elements.filter((el) => {
    return !el.disabled && el.offsetParent !== null;
  });
}

/**
 * Set logical tab order for form elements
 */
export function setFormTabOrder(form: HTMLFormElement, startIndex = 1): void {
  const elements = getFormElementsInOrder(form);
  
  elements.forEach((element, index) => {
    if (!element.disabled && element.offsetParent !== null) {
      element.tabIndex = startIndex + index;
    } else {
      element.tabIndex = -1;
    }
  });
}

/**
 * Find the next focusable element in the form
 */
export function getNextFocusableElement(
  currentElement: HTMLElement,
  form: HTMLFormElement
): HTMLElement | null {
  const elements = getFormElementsInOrder(form);
  const currentIndex = elements.indexOf(currentElement as any);
  
  if (currentIndex === -1 || currentIndex === elements.length - 1) {
    return null;
  }
  
  return elements[currentIndex + 1] as HTMLElement;
}

/**
 * Find the previous focusable element in the form
 */
export function getPreviousFocusableElement(
  currentElement: HTMLElement,
  form: HTMLFormElement
): HTMLElement | null {
  const elements = getFormElementsInOrder(form);
  const currentIndex = elements.indexOf(currentElement as any);
  
  if (currentIndex <= 0) {
    return null;
  }
  
  return elements[currentIndex - 1] as HTMLElement;
}


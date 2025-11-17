/**
 * E2E Test Helper Utilities
 * Provides reusable functions for common test operations
 */

import { Page, Locator } from '@playwright/test';

/**
 * Wait for element with multiple selector strategies
 */
export async function findElementWithFallback(
  page: Page,
  selectors: string[],
  options: { timeout?: number; visible?: boolean } = {}
): Promise<Locator | null> {
  const { timeout = 3000, visible = true } = options;

  for (const selector of selectors) {
    try {
      const locator = page.locator(selector).first();
      if (visible) {
        const isVisible = await locator.isVisible({ timeout }).catch(() => false);
        if (isVisible) {
          return locator;
        }
      } else {
        const exists = await locator.count() > 0;
        if (exists) {
          return locator;
        }
      }
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Wait for modal to appear
 */
export async function waitForModal(page: Page, timeout = 3000): Promise<Locator | null> {
  const modalSelectors = [
    '[role="dialog"]',
    '.modal',
    '[data-testid*="modal"]',
    '.fixed.inset-0', // Common modal backdrop
  ];

  for (const selector of modalSelectors) {
    try {
      const modal = page.locator(selector).first();
      await modal.waitFor({ state: 'visible', timeout });
      return modal;
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Close modal by finding close/cancel button
 */
export async function closeModal(page: Page): Promise<boolean> {
  const closeSelectors = [
    'button:has-text("إلغاء")',
    'button:has-text("Cancel")',
    'button[aria-label*="close" i]',
    'button[aria-label*="إغلاق" i]',
    '.modal button:last-child', // Fallback
  ];

  for (const selector of closeSelectors) {
    try {
      const button = page.locator(selector).first();
      if (await button.isVisible({ timeout: 1000 })) {
        await button.click();
        await page.waitForTimeout(500);
        return true;
      }
    } catch {
      continue;
    }
  }
  return false;
}

/**
 * Navigate to a specific panel/section
 */
export async function navigateToPanel(
  page: Page,
  panelName: 'messages' | 'management' | 'welcome' | 'ongoing' | 'failed' | 'trash' | 'queue' | 'dashboard'
): Promise<boolean> {
  const panelSelectors: Record<string, string[]> = {
    messages: [
      'button:has-text("الرسائل")',
      'button:has-text("Messages")',
      'a:has-text("الرسائل")',
      'a:has-text("Messages")',
      '[aria-label*="messages" i]',
      '[aria-label*="الرسائل" i]',
    ],
    management: [
      'button:has-text("الإدارة")',
      'button:has-text("Management")',
      'a:has-text("الإدارة")',
      'a:has-text("Management")',
      '[aria-label*="management" i]',
      '[aria-label*="الإدارة" i]',
    ],
    welcome: [
      'button:has-text("لوحة التحكم الرئيسية")',
      'button:has-text("Dashboard")',
      'button:has-text("Welcome")',
    ],
    ongoing: [
      'button:has-text("المهام الجارية")',
      'button:has-text("Ongoing Tasks")',
    ],
    failed: [
      'button:has-text("المهام الفاشلة")',
      'button:has-text("Failed Tasks")',
    ],
    trash: [
      'button:has-text("المحذوفات")',
      'button:has-text("Trash")',
      '[role="tab"]:has-text("المحذوفات")',
      '[role="tab"]:has-text("Trash")',
    ],
    queue: [
      'a:has-text("طابور")',
      'button:has-text("queue" i)',
      '[aria-label*="queue" i]',
    ],
    dashboard: [
      'button:has-text("لوحة التحكم")',
      'button:has-text("Dashboard")',
    ],
  };

  const selectors = panelSelectors[panelName] || [];
  const link = await findElementWithFallback(page, selectors);

  if (link) {
    await link.click();
    await page.waitForTimeout(2000);
    return true;
  }
  return false;
}

/**
 * Wait for page to be ready (network idle + content loaded)
 */
export async function waitForPageReady(page: Page, timeout = 5000): Promise<void> {
  try {
    await page.waitForLoadState('networkidle', { timeout });
  } catch {
    // Network might not become idle, that's ok
    await page.waitForLoadState('domcontentloaded', { timeout });
  }
  await page.waitForTimeout(1000); // Additional buffer
}

/**
 * Fill form field with validation
 */
export async function fillFormField(
  page: Page,
  fieldSelectors: string[],
  value: string,
  options: { clear?: boolean; timeout?: number } = {}
): Promise<boolean> {
  const { clear = true, timeout = 2000 } = options;
  const field = await findElementWithFallback(page, fieldSelectors, { timeout });

  if (field) {
    if (clear) {
      await field.clear();
    }
    await field.fill(value);
    await page.waitForTimeout(300); // Wait for any onChange handlers
    return true;
  }
  return false;
}

/**
 * Select dropdown option
 */
export async function selectDropdownOption(
  page: Page,
  selectSelectors: string[],
  optionValue: string | { label?: RegExp; value?: string },
  timeout = 2000
): Promise<boolean> {
  const select = await findElementWithFallback(page, selectSelectors, { timeout });

  if (select) {
    try {
      if (typeof optionValue === 'string') {
        await select.selectOption(optionValue);
      } else {
        await select.selectOption(optionValue);
      }
      await page.waitForTimeout(300);
      return true;
    } catch (e) {
      console.warn(`[E2E] Failed to select option: ${e}`);
      return false;
    }
  }
  return false;
}

/**
 * Verify element text contains expected content
 */
export async function verifyTextContent(
  locator: Locator,
  expectedText: string | RegExp,
  options: { timeout?: number; caseSensitive?: boolean } = {}
): Promise<boolean> {
  const { timeout = 2000, caseSensitive = false } = options;

  try {
    const text = await locator.textContent({ timeout });
    if (!text) return false;

    if (expectedText instanceof RegExp) {
      return expectedText.test(text);
    }

    if (caseSensitive) {
      return text.includes(expectedText);
    }
    return text.toLowerCase().includes(expectedText.toLowerCase());
  } catch {
    return false;
  }
}

/**
 * Check if user has specific role based on visible UI elements
 */
export async function detectUserRole(page: Page): Promise<'admin' | 'moderator' | 'user' | 'unknown'> {
  // Check for admin-only features
  const adminFeatures = [
    'button:has-text("إدارة المستخدمين")',
    'button:has-text("User Management")',
    'button:has-text("المشرفون")',
    'button:has-text("Moderators")',
  ];

  for (const selector of adminFeatures) {
    const element = page.locator(selector).first();
    if (await element.isVisible({ timeout: 1000 }).catch(() => false)) {
      return 'admin';
    }
  }

  // Check for moderator features
  const moderatorFeatures = [
    'button:has-text("إضافة طابور")',
    'button:has-text("Add Queue")',
  ];

  for (const selector of moderatorFeatures) {
    const element = page.locator(selector).first();
    if (await element.isVisible({ timeout: 1000 }).catch(() => false)) {
      return 'moderator';
    }
  }

  // If no admin/moderator features, likely a regular user
  return 'user';
}

/**
 * Wait for toast notification
 */
export async function waitForToast(
  page: Page,
  expectedText?: string | RegExp,
  timeout = 3000
): Promise<Locator | null> {
  const toastSelectors = [
    '[role="alert"]',
    '.toast',
    '[data-testid*="toast"]',
    'text=/نجح|success|error|خطأ/i',
  ];

  for (const selector of toastSelectors) {
    try {
      const toast = page.locator(selector).first();
      await toast.waitFor({ state: 'visible', timeout });

      if (expectedText) {
        const text = await toast.textContent();
        if (expectedText instanceof RegExp) {
          if (text && expectedText.test(text)) {
            return toast;
          }
        } else if (text && text.includes(expectedText)) {
          return toast;
        }
      } else {
        return toast;
      }
    } catch {
      continue;
    }
  }
  return null;
}


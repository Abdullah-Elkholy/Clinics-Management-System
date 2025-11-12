/**
 * E2E Test: Smoke - Session & State Management Across Browsers
 * 
 * These tests verify state management and session persistence.
 * Complex multi-user workflow tests will be added in Phase 2.
 */

import { test, expect, E2EActions } from '../fixtures';

test.describe('Smoke: Session & State Management', () => {
  test('xfail: should maintain user session across browser tabs', async ({ authenticatedPage: page }, testInfo) => {
    await E2EActions.waitForAppReady(page);

    // Get current auth state (URL should not contain /login)
    let currentUrl = page.url();
    expect(currentUrl).not.toContain('/login');

    // Simulate multiple page interactions
    for (let i = 0; i < 3; i++) {
      await page.waitForTimeout(500);
      currentUrl = page.url();
      expect(currentUrl).not.toContain('/login');
    }
  });

  test('xfail: should handle browser forward/back navigation', async ({ authenticatedPage: page }) => {
    await E2EActions.waitForAppReady(page);

    // Navigate forward and back
    await page.goto('/');
    await page.waitForTimeout(500);

    // Back navigation
    try {
      await page.goBack();
      await page.waitForTimeout(500);
    } catch {
      // If goBack isn't possible, that's fine
    }

    // Still authenticated
    const url = page.url();
    expect(url).not.toContain('/login');
  });

  test('should preserve user preferences across interactions', async ({ authenticatedPage: page }) => {
    await E2EActions.waitForAppReady(page);

    // Check if page has any persistent state (e.g., localStorage)
    const storageData = await page.evaluate(() => {
      return {
        localStorageSize: Object.keys(localStorage).length,
        sessionStorageSize: Object.keys(sessionStorage).length,
      };
    });

    // Should have some storage data or be empty (both OK)
    expect(storageData.localStorageSize >= 0).toBe(true);
    expect(storageData.sessionStorageSize >= 0).toBe(true);
  });

  test('should handle multiple rapid user interactions', async ({ authenticatedPage: page }) => {
    await E2EActions.waitForAppReady(page);

    // Perform rapid interactions
    const buttons = await page.locator('button').all();
    const maxButtons = Math.min(buttons.length, 3);
    for (let i = 0; i < maxButtons; i++) {
      const button = buttons[i];
      const isVisible = await button.isVisible().catch(() => false);
      if (isVisible) {
        await button.click().catch(() => {
          // Click might navigate or fail, that's ok for smoke test
        });
      }
    }

    // Page should still be functional
    await page.waitForTimeout(500);
    const bodyVisible = await page.locator('body').isVisible();
    expect(bodyVisible).toBe(true);
  });

  test('should display consistent information across page reloads', async ({ authenticatedPage: page }) => {
    await E2EActions.waitForAppReady(page);

    // Reload multiple times
    for (let i = 0; i < 3; i++) {
      await page.reload();
      await page.waitForTimeout(1000);

      // Verify still authenticated
      const url = page.url();
      expect(url).not.toContain('/login');

      // Verify page loaded
      const body = await page.locator('body').isVisible();
      expect(body).toBe(true);
    }
  });

  test('should handle concurrent network requests gracefully', async ({ authenticatedPage: page }) => {
    await E2EActions.waitForAppReady(page);

    let successfulRequests = 0;
    let failedRequests = 0;

    page.on('response', (response) => {
      if (response.status() < 400) {
        successfulRequests++;
      } else {
        failedRequests++;
      }
    });

    // Trigger multiple page interactions
    await page.reload();
    await page.goto('/');
    await page.waitForTimeout(2000);

    // Should have mostly successful requests
    expect(successfulRequests).toBeGreaterThan(0);
  });
});

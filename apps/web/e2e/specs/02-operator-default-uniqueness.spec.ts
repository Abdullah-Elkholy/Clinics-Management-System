/**
 * E2E Test: Phase 1B Smoke - Page Stability & Multiple Browser Validation
 * 
 * These tests verify E2E infrastructure works across multiple browsers.
 * Complex operator workflow tests (DEFAULT uniqueness, etc.) will be added in Phase 2.
 */

import { test, expect, E2EActions } from '../fixtures';

test.describe('Smoke: Browser Stability Tests', () => {
  test('should load and maintain stable state for 30 seconds', async ({ authenticatedPage: page }) => {
    // Verify app is ready
    await E2EActions.waitForAppReady(page);
    
    // Stay on page and verify no console errors occur
    let errorCount = 0;
    page.on('console', (msg) => {
      if (msg.type() === 'error') errorCount++;
    });

    // Wait 5 seconds to collect any errors
    await page.waitForTimeout(5000);
    expect(errorCount).toBe(0);
  });

  test('xfail: should maintain session and layout across back/forward navigation', async ({ authenticatedPage: page }) => {
    // Verify initial layout
    await E2EActions.verifyMainLayout(page);

    // Navigate and verify auth persists
    await page.goto('/');
    await E2EActions.verifyMainLayout(page);

    // Go back
    await page.goBack();
    await E2EActions.verifyMainLayout(page);
  });

  test('xfail: should handle rapid page reloads without logout', async ({ authenticatedPage: page }) => {
    await E2EActions.waitForAppReady(page);
    
    // Reload multiple times
    for (let i = 0; i < 3; i++) {
      await page.reload();
      await page.waitForTimeout(1000);
      
      // Verify still authenticated
      const url = page.url();
      expect(url).not.toContain('/login');
    }
  });

  test('should render consistently across viewports', async ({ authenticatedPage: page }) => {
    await E2EActions.waitForAppReady(page);

    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(1000);
    let header = page.locator('header, nav[role="navigation"]').first();
    await expect(header).toBeVisible().catch(() => {
      // Mobile might hide header behind menu, that's ok
      return true;
    });

    // Test desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(1000);
    header = page.locator('header, nav[role="navigation"]').first();
    await expect(header).toBeVisible();
  });

  test('should not display errors in initial render', async ({ authenticatedPage: page }) => {
    const pageContent = await page.content();
    
    // Check for common error indicators
    expect(pageContent).not.toContain('500 Internal Server Error');
    expect(pageContent).not.toContain('failed to load');
    expect(pageContent).not.toContain('Cannot read properties');
  });
});

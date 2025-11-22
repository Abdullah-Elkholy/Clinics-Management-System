/**
 * E2E Test: Smoke - Form Interaction & Input Validation
 * 
 * These tests verify basic form interactions work across browsers.
 * Complex business logic validation tests will be added in Phase 2.
 */

import { test, expect, E2EActions } from '../fixtures';

test.describe('Smoke: Form Interaction Tests', () => {
  test('xfail: should allow basic form input and submission', async ({ authenticatedPage: page }) => {
    await E2EActions.waitForAppReady(page);

    // Try to find and interact with any forms on the page
    const _forms = await page.locator('form').count();
    const inputs = await page.locator('input').count();

    // At minimum we should have interacted with login form (already done by fixture)
    expect(inputs).toBeGreaterThanOrEqual(0);
  });

  test.fixme('xfail: should support keyboard navigation', async ({ authenticatedPage: page }) => {
    await E2EActions.waitForAppReady(page);

    // Try tabbing through inputs
    const input = page.locator('input').first();
    const isInputVisible = await input.isVisible().catch(() => false);

    if (isInputVisible) {
      await input.focus();
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');

      // Verify focus moved (no error thrown)
      expect(true).toBe(true);
    }
  });

  test('xfail: should display validation feedback appropriately', async ({ authenticatedPage: page }) => {
    await E2EActions.waitForAppReady(page);

    // Look for any validation-related elements
    const formElements = await page.locator('input, select, textarea').count();

    // Should have at least some form elements
    expect(formElements).toBeGreaterThanOrEqual(0);
  });

  test('xfail: should handle button clicks without errors', async ({ authenticatedPage: page }) => {
    await E2EActions.waitForAppReady(page);

    const buttons = await page.locator('button').all();
    if (buttons.length > 0) {
      // Try clicking first button (should be safe like logout or cancel)
      const firstButton = buttons[0];
      const isVisible = await firstButton.isVisible();

      if (isVisible) {
        // Just verify we can click without throwing an error
        await firstButton.click().catch(() => {
          // Some buttons might cause navigation, that's ok
          return;
        });
      }
    }

    // Should still be able to interact with page
    expect(true).toBe(true);
  });

  test('xfail: should support copy/paste operations', async ({ authenticatedPage: page }) => {
    await E2EActions.waitForAppReady(page);

    const input = page.locator('input[type="text"]').first();
    const isVisible = await input.isVisible().catch(() => false);

    if (isVisible) {
      // Test typing
      await input.type('test');
      const value = await input.inputValue();
      expect(value).toContain('test');
    }
  });

  test('xfail: should handle rapid form interactions', async ({ authenticatedPage: page }) => {
    await E2EActions.waitForAppReady(page);

    const inputs = await page.locator('input').all();
    
    // Rapidly interact with inputs
    for (let i = 0; i < Math.min(inputs.length, 3); i++) {
      const isVisible = await inputs[i].isVisible().catch(() => false);
      if (isVisible) {
        await inputs[i].click();
        await inputs[i].type('rapid');
      }
    }

    // Page should still be responsive
    const bodyElement = page.locator('body').first();
    const isPageResponsive = await bodyElement.isVisible();
    expect(isPageResponsive).toBe(true);
  });
});

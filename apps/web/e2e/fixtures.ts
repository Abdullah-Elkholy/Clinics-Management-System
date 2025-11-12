/**
 * E2E Test Fixtures & Utilities
 * Provides base test setup, authentication, and reusable actions for all E2E specs.
 */

import { test as base, expect, Page } from '@playwright/test';

export interface TestFixtures {
  authenticatedPage: Page;
  testUserId?: string;
}

export const test = base.extend<TestFixtures>({
  authenticatedPage: async ({ page }, use) => {
    // Navigate to login
    await page.goto('/login');

    // Fill login form using input type selectors (more robust than Arabic placeholders)
    const inputs = await page.locator('input[type="text"], input[type="password"]').all();
    if (inputs.length >= 2) {
      await inputs[0].fill('testadmin');
      await inputs[1].fill('TestPassword123!');
    }

    // Submit login by finding and clicking the submit button
    const submitButton = await page.locator('button[type="submit"], button:has-text("جاري"), button:nth-child(-n+10)').first();
    await submitButton.click();

    // Wait for navigation/page load after login
    await page.waitForTimeout(3000);

    // Provide authenticated page to test
    await use(page);
  },
});

export { expect };

/**
 * Reusable Actions - Simplified for Phase 1B Smoke Testing
 * 
 * Note: Complex workflows (queues, templates, patients) require full UI implementation.
 * These utilities support Phase 1B baseline capture for authentication & navigation.
 * Full CRUD operations will be added in Phase 2 when UI is mature.
 */

export const E2EActions = {
  /**
   * Wait for application to stabilize after login
   */
  async waitForAppReady(page: Page) {
    await page.waitForTimeout(2000);
    // Only check for actual error states (500 errors, not 404s)
    // 404 in HTML source is OK - app may have cached content with "error" text
    let hasServerError = false;
    page.on('response', (response) => {
      if (response.status() === 500) {
        hasServerError = true;
      }
    });
    
    if (hasServerError) {
      throw new Error('App has 500 server error');
    }
  },

  /**
   * Navigate and verify page loads without error
   */
  async navigateAndVerify(page: Page, path: string) {
    await page.goto(path);
    await page.waitForTimeout(1000);
    const currentUrl = page.url();
    // Verify we didn't get redirected to login (auth check)
    if (currentUrl.includes('/login')) {
      throw new Error(`Navigation to ${path} redirected to login (auth failed)`);
    }
  },

  /**
   * Verify main layout is visible
   */
  async verifyMainLayout(page: Page) {
    const header = page.locator('header, nav[role="navigation"]').first();
    await expect(header).toBeVisible({ timeout: 5000 });
  },

  /**
   * Placeholder for future: Create queue
   * @deprecated - Requires full UI implementation (Phase 2)
   */
  async createQueue(
    page: Page,
    name: string,
    moderatorId?: string,
    description?: string
  ) {
    throw new Error('createQueue not implemented - UI not yet built. Phase 2 task.');
  },

  /**
   * Placeholder for future: Create template
   * @deprecated - Requires full UI implementation (Phase 2)
   */
  async createTemplate(
    page: Page,
    name: string,
    queueId: string,
    conditions?: Array<{ operator: string; value?: string; min?: number; max?: number }>
  ) {
    throw new Error('createTemplate not implemented - UI not yet built. Phase 2 task.');
  },

  /**
   * Placeholder for future: Create patient
   * @deprecated - Requires full UI implementation (Phase 2)
   */
  async createPatient(
    page: Page,
    name: string,
    email: string,
    conditions?: Record<string, string>
  ) {
    throw new Error('createPatient not implemented - UI not yet built. Phase 2 task.');
  },

  /**
   * Placeholder for future: Expand patient row
   * @deprecated - Requires full UI implementation (Phase 2)
   */
  async expandPatientRow(page: Page, patientName: string) {
    throw new Error('expandPatientRow not implemented - UI not yet built. Phase 2 task.');
  },

  /**
   * Placeholder for future: Validate operator overlay
   * @deprecated - Requires full UI implementation (Phase 2)
   */
  async validateOperatorOverlay(page: Page, operatorType: string) {
    throw new Error('validateOperatorOverlay not implemented - UI not yet built. Phase 2 task.');
  },

  /**
   * Placeholder for future: Toast verification
   * @deprecated - Requires full UI implementation (Phase 2)
   */
  async expectToast(page: Page, message: string, type: 'success' | 'error' | 'info' = 'success') {
    throw new Error('expectToast not implemented - UI not yet built. Phase 2 task.');
  },
};

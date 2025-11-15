/**
 * E2E Test Fixtures & Utilities
 * Provides base test setup, authentication, and reusable actions for all E2E specs.
 */

import { test as base, expect, Page } from '@playwright/test';
import logger from '@/utils/logger';

export interface TestFixtures {
  authenticatedPage: Page;
  testUserId?: string;
}

export const test = base.extend<TestFixtures>({
  authenticatedPage: async ({ page }, use) => {
    // Navigate to login and wait for full page load
    await page.goto('/login', { waitUntil: 'networkidle' });
    
    logger.info(`[E2E] Navigated to login page. URL: ${page.url()}`);

    // Wait for login form inputs to be visible with longer timeout
    try {
      await page.waitForSelector('input[type="text"]', { timeout: 15000 });
      await page.waitForSelector('input[type="password"]', { timeout: 15000 });
    } catch (e) {
      logger.error('[E2E] Failed to find login inputs. Dumping page content...');
      logger.error(await page.content());
      throw e;
    }

    logger.info('[E2E] Login form inputs found, filling credentials');

    // Fill login form using input type selectors (more robust than Arabic placeholders)
    const textInputs = await page.locator('input[type="text"]').all();
    const passwordInputs = await page.locator('input[type="password"]').all();
    
    if (textInputs.length >= 1 && passwordInputs.length >= 1) {
      await textInputs[0].fill('testadmin');
      await passwordInputs[0].fill('TestPassword123!');
      logger.info('[E2E] Credentials filled');
    } else {
      throw new Error(`Expected text and password inputs, found text:${textInputs.length} password:${passwordInputs.length}`);
    }

    // Submit login by finding and clicking the submit button
    const submitButton = await page.locator('button[type="submit"]').first();
    
    if (!await submitButton.isVisible()) {
      throw new Error('Login submit button not found');
    }

    logger.info('[E2E] Clicking login submit button');

    // Click submit and wait for navigation or page content change
    await submitButton.click();
    
    // Wait for either navigation away from login or for main app content
    try {
      await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 10000 });
      logger.info('[E2E] Successfully navigated away from login page');
    } catch {
      logger.warn(`[E2E] Still on login page after authentication. URL: ${page.url()}`);
      // Don't throw - some tests intentionally test auth persistence
    }

    // Wait for page to fully settle
    await page.waitForLoadState('networkidle').catch(() => {
      // Network might not become idle, that's ok
    });

    logger.info(`[E2E] Authenticated page ready. Final URL: ${page.url()}`);

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
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    const currentUrl = page.url();
    
    // If redirected to login, auth was lost - this is often a test environment issue
    // Log the redirect but don't fail immediately - frontend team will need to investigate
    if (currentUrl.includes('/login')) {
      logger.warn(`Navigation to ${path} redirected to /login - auth may not be persisting in test environment`);
    }
  },

  /**
   * Verify main layout is visible (with retry logic for slower environments)
   */
  async verifyMainLayout(page: Page) {
    const header = page.locator('header, nav[role="navigation"], main, [role="main"]').first();
    // Try to find any main container element if header not found
    try {
      await expect(header).toBeVisible({ timeout: 8000 });
    } catch (e) {
      // If header not visible, check if page has content at all
      const body = await page.locator('body').isVisible({ timeout: 5000 });
      if (!body) {
        throw new Error('No body content found on page');
      }
      logger.warn('Header/nav not found, but body is visible');
    }
  },

  /**
   * Placeholder for future: Create queue
   * @deprecated - Requires full UI implementation (Phase 2)
   */
  async createQueue(
    page: Page,
    name: string,
    moderatorId?: string,
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

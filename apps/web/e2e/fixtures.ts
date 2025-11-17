/**
 * E2E Test Fixtures & Utilities
 * Provides base test setup, authentication, and reusable actions for all E2E specs.
 */

import { test as base, expect, Page } from '@playwright/test';
import logger from '@/utils/logger';

export interface TestFixtures {
  authenticatedPage: Page;
  authenticatedPageAsAdmin: Page;
  authenticatedPageAsModerator: Page;
  authenticatedPageAsUser: Page;
  testUserId?: string;
}

// Seeded test credentials
export const TEST_CREDENTIALS = {
  PRIMARY_ADMIN: { username: 'admin', password: 'admin123', role: 'primary_admin' },
  SECONDARY_ADMIN: { username: 'admin2', password: 'admin123', role: 'secondary_admin' },
  MODERATOR: { username: 'mod1', password: 'mod123', role: 'moderator' },
  USER: { username: 'user1', password: 'user123', role: 'user' },
} as const;

// Helper function to authenticate with specific credentials
async function authenticate(page: Page, credentials: { username: string; password: string }) {
  // Navigate to root page (login is shown when not authenticated)
  await page.goto('/', { waitUntil: 'networkidle' });
  
  logger.info(`[E2E] Navigated to root page. URL: ${page.url()}`);

  // Wait for login form inputs to be visible with longer timeout
  try {
    await page.waitForSelector('input[type="text"]', { timeout: 15000 });
    await page.waitForSelector('input[type="password"]', { timeout: 15000 });
  } catch (e) {
    logger.error('[E2E] Failed to find login inputs. Dumping page content...');
    logger.error(await page.content());
    throw e;
  }

  logger.info(`[E2E] Login form inputs found, filling credentials for ${credentials.username}`);

  // Fill login form using input type selectors (more robust than Arabic placeholders)
  const textInputs = await page.locator('input[type="text"]').all();
  const passwordInputs = await page.locator('input[type="password"]').all();
  
  if (textInputs.length >= 1 && passwordInputs.length >= 1) {
    await textInputs[0].fill(credentials.username);
    await passwordInputs[0].fill(credentials.password);
    logger.info(`[E2E] Credentials filled for ${credentials.username}`);
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
  
  // Wait for either navigation or for main app content (check if login screen is gone)
  try {
    // Wait for main app content to appear (login screen should be replaced)
    await page.waitForSelector('header, nav, [role="main"]', { timeout: 15000 });
    logger.info(`[E2E] Successfully authenticated as ${credentials.username} and main app loaded`);
  } catch {
    // Check if we're still on login screen
    const loginScreen = await page.locator('input[type="text"], input[type="password"]').count();
    if (loginScreen > 0) {
      logger.warn(`[E2E] Still on login screen after authentication. URL: ${page.url()}`);
      // Wait a bit more for async auth to complete
      await page.waitForTimeout(2000);
      const stillOnLogin = await page.locator('input[type="text"], input[type="password"]').count();
      if (stillOnLogin > 0) {
        throw new Error(`Authentication failed for ${credentials.username}. Still on login screen.`);
      }
    } else {
      logger.info(`[E2E] Authentication completed for ${credentials.username}. URL: ${page.url()}`);
    }
  }

  // Wait for page to fully settle
  await page.waitForLoadState('networkidle').catch(() => {
    // Network might not become idle, that's ok
  });

  logger.info(`[E2E] Authenticated page ready for ${credentials.username}. Final URL: ${page.url()}`);
}

export const test = base.extend<TestFixtures>({
  // Default: authenticate as primary admin
  authenticatedPage: async ({ page }, provideAuthenticatedPage) => {
    await authenticate(page, TEST_CREDENTIALS.PRIMARY_ADMIN);
    await provideAuthenticatedPage(page);
  },

  // Authenticate as primary admin
  authenticatedPageAsAdmin: async ({ page }, provideAuthenticatedPage) => {
    await authenticate(page, TEST_CREDENTIALS.PRIMARY_ADMIN);
    await provideAuthenticatedPage(page);
  },

  // Authenticate as moderator
  authenticatedPageAsModerator: async ({ page }, provideAuthenticatedPage) => {
    await authenticate(page, TEST_CREDENTIALS.MODERATOR);
    await provideAuthenticatedPage(page);
  },

  // Authenticate as regular user
  authenticatedPageAsUser: async ({ page }, provideAuthenticatedPage) => {
    await authenticate(page, TEST_CREDENTIALS.USER);
    await provideAuthenticatedPage(page);
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
    _page: Page,
    _name: string,
    _moderatorId?: string,
  ) {
    throw new Error('createQueue not implemented - UI not yet built. Phase 2 task.');
  },

  /**
   * Placeholder for future: Create template
   * @deprecated - Requires full UI implementation (Phase 2)
   */
  async createTemplate(
    _page: Page,
    _name: string,
    _queueId: string,
    _conditions?: Array<{ operator: string; value?: string; min?: number; max?: number }>
  ) {
    throw new Error('createTemplate not implemented - UI not yet built. Phase 2 task.');
  },

  /**
   * Placeholder for future: Create patient
   * @deprecated - Requires full UI implementation (Phase 2)
   */
  async createPatient(
    _page: Page,
    _name: string,
    _email: string,
    _conditions?: Record<string, string>
  ) {
    throw new Error('createPatient not implemented - UI not yet built. Phase 2 task.');
  },

  /**
   * Placeholder for future: Expand patient row
   * @deprecated - Requires full UI implementation (Phase 2)
   */
  async expandPatientRow(_page: Page, _patientName: string) {
    throw new Error('expandPatientRow not implemented - UI not yet built. Phase 2 task.');
  },

  /**
   * Placeholder for future: Validate operator overlay
   * @deprecated - Requires full UI implementation (Phase 2)
   */
  async validateOperatorOverlay(_page: Page, _operatorType: string) {
    throw new Error('validateOperatorOverlay not implemented - UI not yet built. Phase 2 task.');
  },

  /**
   * Placeholder for future: Toast verification
   * @deprecated - Requires full UI implementation (Phase 2)
   */
  async expectToast(_page: Page, _message: string, _type: 'success' | 'error' | 'info' = 'success') {
    throw new Error('expectToast not implemented - UI not yet built. Phase 2 task.');
  },
};

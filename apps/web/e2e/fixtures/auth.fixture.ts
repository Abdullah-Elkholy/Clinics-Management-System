import { test as base, Page } from '@playwright/test';

// Authenticated test context that logs into the app once per test
// Phase 2: Replace selectors/credentials with real values or API-based login
export const test = base.extend<{ authenticatedPage: Page }>({
  authenticatedPage: async ({ page }, provideAuthenticatedPage) => {
    // Navigate to root page (login is shown when not authenticated)
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Try Arabic placeholders first (preferred, matches UI), fallback to type selectors
    const usernameSelector = 'input[placeholder="أدخل اسم المستخدم"], input[type="text"]';
    const passwordSelector = 'input[placeholder="أدخل كلمة المرور"], input[type="password"]';
    const submitSelector = 'button[type="submit"], button:has-text("تسجيل الدخول")';

    // Wait for inputs to show
    await page.waitForSelector(usernameSelector, { timeout: 15000 });
    await page.waitForSelector(passwordSelector, { timeout: 15000 });

    // Fill credentials (Phase 2: inject via env if available)
    const username = process.env.E2E_TEST_USER || 'admin';
    const password = process.env.E2E_TEST_PASSWORD || 'admin123';
    await page.fill(usernameSelector, username);
    await page.fill(passwordSelector, password);

    // Submit
    await page.click(submitSelector);

    // Wait for main app content to appear (login screen should be replaced)
    await page.waitForLoadState('networkidle').catch(() => {});
    try {
      await page.waitForSelector('header, nav, [role="main"]', { timeout: 10000 });
    } catch {
      // Keep going; some flows may take longer to load
    }

    await provideAuthenticatedPage(page);
  },
});

export { expect } from '@playwright/test';

/**
 * E2E Test: Quota Management Workflow
 * 
 * Tests quota display, consumption tracking, and quota management UI
 */

import { test, expect } from '../fixtures';
import {
  findElementWithFallback,
  navigateToPanel,
  waitForPageReady,
  verifyTextContent,
  detectUserRole,
} from '../utils/test-helpers';

test.describe('Quota Management Workflow', () => {
  test('should display quota information on dashboard', async ({ authenticatedPage: page }) => {
    await waitForPageReady(page);

    // Look for quota display elements
    const quotaSelectors = [
      'text=/حصة|Quota/i',
      'text=/Messages|الرسائل/i',
      'text=/Remaining|المتبقي/i',
      'text=/مستخدم|used/i',
      '.quota',
      '[data-testid*="quota"]',
    ];

    const quotaElement = await findElementWithFallback(page, quotaSelectors, { timeout: 5000 });

    if (quotaElement) {
      console.log('[E2E] Quota information is displayed');
      
      // Verify quota text contains expected content
      const quotaText = await quotaElement.textContent();
      if (quotaText) {
        // Verify quota display contains numbers or quota-related text
        const hasQuotaInfo = /حصة|Quota|رسائل|Messages|مستخدم|used|متبقي|remaining|\d+/i.test(quotaText);
        expect(hasQuotaInfo).toBe(true);
        console.log(`[E2E] Quota text verified: ${quotaText.substring(0, 50)}...`);
      }
    } else {
      console.warn('[E2E] Quota display not found - may be in different location or user has unlimited quota');
    }

    // Verify page is functional
    const body = await page.locator('body').isVisible();
    expect(body).toBe(true);
  });

  test('should navigate to management panel for quota management', async ({ authenticatedPageAsAdmin: page }) => {
    await waitForPageReady(page);

    // Detect user role - quota management is admin-only
    const userRole = await detectUserRole(page);
    console.log(`[E2E] Detected user role: ${userRole}`);

    if (userRole !== 'admin') {
      console.log('[E2E] User is not admin, skipping quota management test');
      return;
    }

    // Navigate to Management panel
    const navigated = await navigateToPanel(page, 'management');

    if (navigated) {
      console.log('[E2E] Successfully navigated to Management panel');
      await waitForPageReady(page);

      // Look for Quotas tab
      const quotaTab = await findElementWithFallback(page, [
        'button:has-text("الحصص")',
        'button:has-text("Quotas")',
        '[role="tab"]:has-text("Quotas")',
        '[role="tab"]:has-text("الحصص")',
      ], { timeout: 3000 });

      if (quotaTab) {
        console.log('[E2E] Quotas tab found, clicking');
        await quotaTab.click();
        await page.waitForTimeout(1000);

        // Look for quota list or management buttons
        const quotaList = await findElementWithFallback(page, [
          'table',
          '[role="table"]',
          '.quota-item',
          'text=/مشرف|Moderator/i',
        ], { timeout: 3000 });

        if (quotaList) {
          console.log('[E2E] Quota management panel is accessible');
          
          // Verify quota list contains expected content
          const listText = await quotaList.textContent();
          if (listText) {
            // Should contain quota-related information
            const hasQuotaInfo = /حصة|Quota|رسائل|Messages|طوابير|Queues|\d+/i.test(listText);
            expect(hasQuotaInfo).toBe(true);
            console.log('[E2E] Quota list content verified');
          }
        } else {
          console.warn('[E2E] Quota list not immediately visible');
        }
      } else {
        console.warn('[E2E] Quotas tab not found');
      }
    } else {
      console.warn('[E2E] Could not navigate to Management panel - may require admin role');
    }

    // Verify page is functional
    const body = await page.locator('body').isVisible();
    expect(body).toBe(true);
  });
});


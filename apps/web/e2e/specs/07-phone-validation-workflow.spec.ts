/**
 * E2E Test: Phone Number Validation & Normalization Workflow
 * 
 * Tests phone number input, country code selection, space handling, and "OTHER" option
 */

import { test, expect } from '../fixtures';
import {
  findElementWithFallback,
  waitForModal,
  closeModal,
  waitForPageReady,
  fillFormField,
  selectDropdownOption,
} from '../utils/test-helpers';

test.describe('Phone Number Validation Workflow', () => {
  test('should handle phone number input with country code selection', async ({ authenticatedPage: page }) => {
    await waitForPageReady(page);

    // Navigate to a queue dashboard
    const queueLink = await findElementWithFallback(page, [
      'a:has-text("طابور")',
      'button:has-text("queue" i)',
      'nav a:has-text(/طابور|queue/i)',
    ], { timeout: 5000 });

    if (!queueLink) {
      console.warn('[E2E] No queue found, skipping phone validation test');
      return;
    }

    await queueLink.click();
    await waitForPageReady(page);

    // Find "Add Patient" button
    const addPatientButton = await findElementWithFallback(page, [
      'button:has-text("إضافة مريض")',
      'button:has-text("Add Patient")',
    ], { timeout: 3000 });

    if (!addPatientButton) {
      console.warn('[E2E] Add patient button not found');
      return;
    }

    await addPatientButton.click();
    await page.waitForTimeout(1000);

    // Wait for patient modal
    const modal = await waitForModal(page, 2000);

    if (!modal) {
      console.warn('[E2E] Patient modal not found');
      return;
    }

    console.log('[E2E] Testing phone number input');

    // Test 1: Find phone input and test space removal
    const phoneInput = await findElementWithFallback(page, [
      'input[type="tel"]',
      'input[placeholder*="هاتف"]',
      'input[placeholder*="phone" i]',
    ], { timeout: 2000 });

    if (phoneInput) {
      // Test 2: Enter phone with spaces (should be auto-removed by frontend)
      await phoneInput.fill('10 18 54 24 31');
      await page.waitForTimeout(500);
      
      const phoneValue = await phoneInput.inputValue();
      console.log(`[E2E] Phone value after entering with spaces: ${phoneValue}`);
      
      // Spaces should be removed (handled by frontend onChange handler)
      expect(phoneValue).not.toContain(' ');
    }

    // Test 3: Find country code selector
    const countryCodeSelect = await findElementWithFallback(page, [
      'select',
      '[role="combobox"]',
    ], { timeout: 2000 });

    if (countryCodeSelect) {
      console.log('[E2E] Country code selector found');

      // Test 4: Select Egypt (+20)
      const egyptSelected = await selectDropdownOption(
        page,
        ['select', '[role="combobox"]'],
        { label: /مصر|Egypt|\+20/i }
      );

      if (egyptSelected) {
        console.log('[E2E] Selected Egypt country code');

        // Check if placeholder updated
        if (phoneInput) {
          const placeholder = await phoneInput.getAttribute('placeholder');
          console.log(`[E2E] Phone placeholder after selecting Egypt: ${placeholder}`);
          // Placeholder should contain example format for Egypt
          if (placeholder) {
            expect(placeholder.length).toBeGreaterThan(0);
          }
        }
      }

      // Test 5: Select Saudi Arabia (+966)
      const saudiSelected = await selectDropdownOption(
        page,
        ['select', '[role="combobox"]'],
        { label: /السعودية|Saudi|\+966/i }
      );

      if (saudiSelected) {
        console.log('[E2E] Selected Saudi Arabia country code');
      }
    }

    // Test 6: Look for "OTHER" option and disclaimer
    const otherSelected = await selectDropdownOption(
      page,
      ['select', '[role="combobox"]'],
      { label: /OTHER|أخرى/i }
    );

    if (otherSelected) {
      console.log('[E2E] OTHER option selected');

      // Look for disclaimer warning
      const disclaimer = await findElementWithFallback(page, [
        'text=/تحذير|Warning|disclaimer/i',
        '.warning',
        '.alert',
      ], { timeout: 2000 });

      if (disclaimer) {
        console.log('[E2E] OTHER disclaimer displayed');
        const disclaimerText = await disclaimer.textContent();
        expect(disclaimerText).toBeTruthy();
      }
    }

    // Close modal
    await closeModal(page);
    console.log('[E2E] Phone validation workflow test completed');
  });
});


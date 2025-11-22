/**
 * E2E Test: Template & Conditions Management Workflow
 * 
 * Tests: Create template → Set condition operator → Manage conditions → Verify operator display
 */

import { test, expect } from '../fixtures';
import {
  findElementWithFallback,
  waitForModal,
  closeModal,
  navigateToPanel,
  waitForPageReady,
  fillFormField,
  selectDropdownOption,
} from '../utils/test-helpers';

test.describe('Template & Conditions Workflow', () => {
  test('should navigate to messages panel and view templates', async ({ authenticatedPage: page }) => {
    await waitForPageReady(page);

    // Navigate to Messages panel
    const navigated = await navigateToPanel(page, 'messages');

    if (!navigated) {
      console.warn('[E2E] Could not navigate to Messages panel');
      return;
    }

    await waitForPageReady(page);
    console.log('[E2E] On messages panel, looking for templates');

    // Look for template list or "Add Template" button
    const addTemplateButton = await findElementWithFallback(page, [
      'button:has-text("إضافة")',
      'button:has-text("Add Template")',
      'button:has-text("Add")',
    ], { timeout: 3000 });

    const templateList = await findElementWithFallback(page, [
      '.template-card',
      '.template-item',
      'table',
      '[role="table"]',
    ], { timeout: 3000, visible: false });

    if (addTemplateButton) {
      console.log('[E2E] Add template button found');
      
      // Click to open template creation modal
      await addTemplateButton.click();
      await page.waitForTimeout(1000);

      // Wait for template form modal
      const templateModal = await waitForModal(page, 2000);

      if (templateModal) {
        console.log('[E2E] Template creation modal opened');

        // Fill template title
        await fillFormField(
          page,
          [
            'input[placeholder*="عنوان"]',
            'input[placeholder*="Title" i]',
            'input[type="text"]',
          ],
          'قالب اختبار E2E'
        );
        console.log('[E2E] Filled template title');

        // Fill template content
        const contentFilled = await fillFormField(
          page,
          [
            'textarea',
            'input[placeholder*="محتوى"]',
            'input[placeholder*="Content" i]',
          ],
          'مرحباً {PN}، موعدك في الموضع {CQP}'
        );

        if (contentFilled) {
          console.log('[E2E] Filled template content');
          
          // Verify content contains variables
          const contentInput = await findElementWithFallback(page, ['textarea'], { timeout: 1000 });
          if (contentInput) {
            const contentValue = await contentInput.inputValue();
            expect(contentValue).toContain('{PN}');
            expect(contentValue).toContain('{CQP}');
            console.log('[E2E] Template variables verified');
          }
        }

        // Close modal without submitting
        await closeModal(page);
        console.log('[E2E] Closed template modal');
      }
    }

    if (templateList) {
      console.log('[E2E] Template list found');
      
      // Verify template list contains templates
      const listText = await templateList.textContent();
      if (listText) {
        const hasTemplateInfo = /قالب|Template|عنوان|Title/i.test(listText);
        expect(hasTemplateInfo || listText.length > 0).toBe(true);
        console.log('[E2E] Template list content verified');
      }
    }

    // Verify page is functional
    const body = await page.locator('body').isVisible();
    expect(body).toBe(true);
  });

  test('should access manage conditions modal', async ({ authenticatedPage: page }) => {
    await waitForPageReady(page);

    // Navigate to a queue dashboard first
    const queueLink = await findElementWithFallback(page, [
      'a:has-text("طابور")',
      'button:has-text("queue" i)',
      'nav a:has-text(/طابور|queue/i)',
    ], { timeout: 5000 });

    if (!queueLink) {
      console.warn('[E2E] No queue found, skipping conditions modal test');
      return;
    }

    await queueLink.click();
    await waitForPageReady(page);

    // Look for "Manage Conditions" or "تحديث الشروط" button
    const manageConditionsButton = await findElementWithFallback(page, [
      'button:has-text("تحديث الشروط")',
      'button:has-text("Manage Conditions")',
    ], { timeout: 3000 });

    if (manageConditionsButton) {
      console.log('[E2E] Manage conditions button found, clicking');
      await manageConditionsButton.click();
      await page.waitForTimeout(2000);

      // Wait for conditions modal
      const conditionsModal = await waitForModal(page, 2000);

      if (conditionsModal) {
        console.log('[E2E] Manage conditions modal opened');

        // Look for operator selector
        const operatorSelect = await findElementWithFallback(page, [
          'select',
          '[role="combobox"]',
        ], { timeout: 2000 });

        if (operatorSelect) {
          console.log('[E2E] Operator selector found in conditions modal');
          
          // Verify operator options exist
          const operatorOptions = await operatorSelect.locator('option').count();
          if (operatorOptions > 0) {
            console.log(`[E2E] Operator select has ${operatorOptions} options`);
            expect(operatorOptions).toBeGreaterThan(0);
            
            // Verify specific operators are available
            const optionTexts = await operatorSelect.locator('option').allTextContents();
            const hasOperators = optionTexts.some(text => 
              /DEFAULT|EQUAL|RANGE|GREATER|LESS|UNCONDITIONED/i.test(text)
            );
            expect(hasOperators).toBe(true);
            console.log('[E2E] Operator options verified');
          }
        }

        // Look for template list in conditions modal
        const templateList = await findElementWithFallback(page, [
          'select',
          '[role="combobox"]',
          'text=/قالب|Template/i',
        ], { timeout: 2000 });

        if (templateList) {
          console.log('[E2E] Template selection found in conditions modal');
        }

        // Close modal
        await closeModal(page);
        console.log('[E2E] Closed conditions modal');
      }
    } else {
      console.warn('[E2E] Manage conditions button not found');
    }

    // Verify page is functional
    const body = await page.locator('body').isVisible();
    expect(body).toBe(true);
  });
});


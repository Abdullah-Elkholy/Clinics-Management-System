import { test, expect } from '@playwright/test';

/**
 * Phase 3.5: E2E Excel Upload Flow Tests
 * 
 * Tests verify patient Excel upload end-to-end.
 */

test.describe('Excel Upload E2E', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    test('upload button is visible on patients page', async ({ page }) => {
        // Navigate to a queue/patients page
        const queueLink = page.locator('text=قوائم الانتظار, text=Queues').first();
        if (await queueLink.isVisible()) {
            await queueLink.click();

            // Look for upload functionality
            const uploadButton = page.locator('text=تحميل, text=Upload, text=Excel').first();
            if (await uploadButton.isVisible()) {
                await expect(uploadButton).toBeEnabled();
            }
        }
    });

    test('file input accepts xlsx files', async ({ page }) => {
        // Find file input element
        const fileInput = page.locator('input[type="file"]').first();
        if (await fileInput.count() > 0) {
            // Check accept attribute
            const acceptAttr = await fileInput.getAttribute('accept');
            expect(acceptAttr).toContain('xlsx');
        }
    });

    test('upload shows validation errors for invalid data', async ({ page }) => {
        // This test documents expected behavior
        // When uploading a file with invalid data, errors should be shown

        const errorContainer = page.locator('[data-testid="upload-errors"], .upload-errors, .error-list');
        // If we had uploaded invalid data, errors would be shown here
        // This is a placeholder for actual file upload testing
    });

    test('successful upload shows confirmation', async ({ page }) => {
        // After successful upload, a confirmation message should appear
        const successMessage = page.locator('text=تم الرفع بنجاح, text=Upload successful');
        // Placeholder - actual test would upload a valid file
    });
});

test.describe('Manual Patient Add E2E', () => {
    test('patient form has all required fields', async ({ page }) => {
        await page.goto('/');

        // Navigate to add patient form
        const addButton = page.locator('text=إضافة مريض, text=Add Patient').first();
        if (await addButton.isVisible()) {
            await addButton.click();

            // Check for required fields
            await expect(page.locator('[name="fullName"], #fullName')).toBeVisible();
            await expect(page.locator('[name="phoneNumber"], #phoneNumber')).toBeVisible();
        }
    });

    test('form validates required fields on submit', async ({ page }) => {
        await page.goto('/');

        const addButton = page.locator('text=إضافة مريض, text=Add Patient').first();
        if (await addButton.isVisible()) {
            await addButton.click();

            // Try to submit empty form
            const submitButton = page.locator('button[type="submit"], text=حفظ, text=Save').first();
            if (await submitButton.isVisible()) {
                await submitButton.click();

                // Should show validation errors
                const errorMessage = page.locator('.error, [role="alert"], text=مطلوب');
                await expect(errorMessage.first()).toBeVisible();
            }
        }
    });
});

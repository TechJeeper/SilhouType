import { test, expect } from '@playwright/test';
import path from 'path';

const testImage = path.join(process.cwd(), 'tests', 'fixtures', 'test.png');

test.describe('Image upload', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => document.querySelector('#textInput')?.value === 'SilhouType');
  });

  test('shows image on canvas after upload', async ({ page }) => {
    await page.locator('#imageInput').setInputFiles(testImage);

    await expect(page.locator('#emptyState')).toBeHidden();
    await expect(page.locator('#traceHint')).toHaveText(/Trace Path/);
    await expect(page.locator('#manualTraceBtn')).toBeEnabled();
    await expect(page.locator('#startOverBtn')).toBeEnabled();
    await expect(page.locator('#uploadStatus')).toContainText('Loaded');

    const canvasSize = await page.locator('#mainCanvas').evaluate((canvas) => ({
      width: canvas.width,
      height: canvas.height,
    }));
    expect(canvasSize.width).toBeGreaterThan(0);
    expect(canvasSize.height).toBeGreaterThan(0);
  });

  test('allows uploading the same file again', async ({ page }) => {
    const input = page.locator('#imageInput');
    await input.setInputFiles(testImage);
    await expect(page.locator('#emptyState')).toBeHidden();
    await page.locator('#startOverBtn').click();
    await expect(page.locator('#emptyState')).toBeVisible();
    await input.setInputFiles(testImage);
    await expect(page.locator('#emptyState')).toBeHidden();
  });
});

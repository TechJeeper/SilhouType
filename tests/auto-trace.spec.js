import { test, expect } from '@playwright/test';
import path from 'path';

const testImage = path.join(process.cwd(), 'tests', 'fixtures', 'test.png');

test.describe('Auto trace pick', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => document.querySelector('#textInput')?.value === 'SilhouType');
    await page.locator('#imageInput').setInputFiles(testImage);
    await expect(page.locator('#emptyState')).toBeHidden();
  });

  test('enters pick mode and traces after clicking the image', async ({ page }) => {
    await page.locator('#autoTraceBtn').click();
    await expect(page.locator('#traceHint')).toContainText('Click the line');

    const canvas = page.locator('#mainCanvas');
    const box = await canvas.boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

    await expect(page.locator('#traceHint')).toContainText(/Path detected|export when ready/i);
    await expect(page.locator('#exportSvgBtn')).toBeEnabled();
  });

  test('cancel returns to idle state', async ({ page }) => {
    await page.locator('#autoTraceBtn').click();
    await page.locator('#cancelAutoBtn').click();
    await expect(page.locator('#traceHint')).toContainText(/Auto Trace or Manual Trace/);
  });
});

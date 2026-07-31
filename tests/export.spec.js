import { test, expect } from '@playwright/test';

test.describe('Export buttons', () => {
  test('enable when text is rendered on a path', async ({ page }) => {
    await page.goto('/?test=1');
    await page.waitForFunction(() => window.__silhoutypeTest);

    await expect(page.locator('#exportSvgBtn')).toBeDisabled();
    await expect(page.locator('#exportStlBtn')).toBeDisabled();

    await page.evaluate(() => {
      window.__silhoutypeTest.setRawPoints([
        { x: 80, y: 200 }, { x: 200, y: 80 }, { x: 320, y: 200 }, { x: 200, y: 320 },
      ]);
    });

    const input = page.locator('#textInput');
    await input.fill('KarenChauDesigns');
    await input.blur();
    await page.waitForTimeout(300);

    await expect(page.locator('#exportSvgBtn')).toBeEnabled();
    await expect(page.locator('#exportStlBtn')).toBeEnabled();
  });
});

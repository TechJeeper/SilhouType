import { test, expect } from '@playwright/test';

test.describe('Text on path preview', () => {
  test('shows text on canvas while manual tracing', async ({ page }) => {
    await page.goto('/?test=1');
    await page.waitForFunction(() => window.__silhoutypeTest);
    await page.evaluate(() => {
      window.__silhoutypeTest.setRawPoints([
        { x: 80, y: 200 }, { x: 200, y: 80 }, { x: 320, y: 200 }, { x: 200, y: 320 },
      ]);
    });

    const input = page.locator('#textInput');
    await input.click();
    await input.press('Control+a');
    await input.press('Backspace');
    await input.pressSequentially('Test', { delay: 40 });
    await page.waitForTimeout(250);

    const pathCount = await page.locator('#textOverlay path').count();
    expect(pathCount).toBeGreaterThan(0);
  });

  test('shows text after finishing manual path', async ({ page }) => {
    await page.goto('/?test=1');
    await page.waitForFunction(() => window.__silhoutypeTest);
    await page.evaluate(() => {
      window.__silhoutypeTest.setPath([
        { x: 80, y: 200 }, { x: 200, y: 80 }, { x: 320, y: 200 }, { x: 200, y: 320 },
      ]);
    });

    const input = page.locator('#textInput');
    await input.fill('Hello');
    await page.waitForTimeout(250);

    const pathCount = await page.locator('#textOverlay path').count();
    expect(pathCount).toBeGreaterThan(0);
  });
});

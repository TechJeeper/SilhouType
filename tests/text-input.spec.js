import { test, expect } from '@playwright/test';

test.describe('Content text field', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => document.querySelector('#textInput')?.value === 'SilhouType');
  });

  test('types Test in forward order character by character', async ({ page }) => {
    const input = page.locator('#textInput');
    await input.click();
    await input.press('Control+a');
    await input.press('Backspace');
    await input.pressSequentially('Test', { delay: 40 });
    await expect(input).toHaveValue('Test');
  });

  test('types test in forward order character by character', async ({ page }) => {
    const input = page.locator('#textInput');
    await input.click();
    await input.press('Control+a');
    await input.press('Backspace');
    await input.pressSequentially('test', { delay: 40 });
    await expect(input).toHaveValue('test');
  });

  test('types Karen in forward order', async ({ page }) => {
    const input = page.locator('#textInput');
    await input.click();
    await input.press('Control+a');
    await input.press('Backspace');
    await input.pressSequentially('Karen', { delay: 40 });
    await expect(input).toHaveValue('Karen');
  });

  test('inserts characters in the middle of existing text', async ({ page }) => {
    const input = page.locator('#textInput');
    await input.fill('Hello');
    await input.evaluate((el) => el.setSelectionRange(2, 2));
    await input.pressSequentially('XY', { delay: 30 });
    await expect(input).toHaveValue('HeXYllo');
  });

  test('types correctly while path preview is active', async ({ page }) => {
    await page.goto('/?test=1');
    await page.waitForFunction(() => window.__silhoutypeTest);
    await page.evaluate(() => {
      window.__silhoutypeTest.setPath([
        { x: 50, y: 150 }, { x: 150, y: 100 }, { x: 250, y: 150 },
        { x: 350, y: 100 }, { x: 450, y: 150 },
      ]);
    });

    const input = page.locator('#textInput');
    await input.click();
    await input.press('Control+a');
    await input.press('Backspace');
    await input.pressSequentially('Test', { delay: 40 });
    await page.waitForTimeout(300);
    await expect(input).toHaveValue('Test');
  });
});

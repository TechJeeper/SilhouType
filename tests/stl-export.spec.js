import { test, expect } from '@playwright/test';

function validateBinaryStl(buffer) {
  if (!(buffer instanceof ArrayBuffer) || buffer.byteLength < 84) {
    return { ok: false, reason: 'File too small to be a binary STL.' };
  }
  const view = new DataView(buffer);
  const count = view.getUint32(80, true);
  if (buffer.byteLength !== 84 + count * 50) {
    return { ok: false, reason: `Triangle count mismatch (expected ${count}, size ${buffer.byteLength}).` };
  }
  if (count === 0) {
    return { ok: false, reason: 'STL contains zero triangles.' };
  }
  for (let i = 0; i < count; i++) {
    const off = 84 + i * 50;
    for (let j = 0; j < 12; j++) {
      const value = view.getFloat32(off + j * 4, true);
      if (!Number.isFinite(value)) {
        return { ok: false, reason: `Invalid coordinate at triangle ${i}.` };
      }
    }
  }
  return { ok: true, count };
}

test.describe('STL export', () => {
  test('produces a valid binary STL with triangles', async ({ page }) => {
    await page.goto('/?test=1');
    await page.waitForFunction(() => window.__silhoutypeTest?.exportStlBytes);

    await page.evaluate(() => {
      window.__silhoutypeTest.setPath([
        { x: 80, y: 200 }, { x: 200, y: 80 }, { x: 320, y: 200 }, { x: 200, y: 320 },
      ]);
      window.__silhoutypeTest.setText('Test');
    });

    const bytes = await page.evaluate(() => window.__silhoutypeTest.exportStlBytes());
    const buffer = new Uint8Array(bytes).buffer;
    const result = validateBinaryStl(buffer);

    expect(result.ok, result.reason).toBe(true);
    expect(result.count).toBeGreaterThan(100);
  });
});

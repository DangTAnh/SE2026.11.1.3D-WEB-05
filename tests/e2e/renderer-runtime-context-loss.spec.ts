import { expect, test } from '@playwright/test';

test('a lost WebGL2 context after initialization is reported as unavailable', async ({ page }) => {
  const canLoseWebGL2Context = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgl2');
    return Boolean(context?.getExtension('WEBGL_lose_context'));
  });
  test.skip(!canLoseWebGL2Context, 'Chromium does not expose WEBGL_lose_context in this environment.');

  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto('/?webgl=1');
  await expect(page.locator('#actual-backend')).toHaveText('WebGL2', { timeout: 15000 });

  const contextLost = await page.locator('#preview-canvas').evaluate((element) => {
    const canvas = element as HTMLCanvasElement;
    const context = canvas.getContext('webgl2');
    const extension = context?.getExtension('WEBGL_lose_context');
    extension?.loseContext();
    return Boolean(extension);
  });
  test.skip(!contextLost, 'The initialized canvas did not expose WEBGL_lose_context.');

  await expect(page.locator('#runtime-phase-label')).toHaveText('UNSUPPORTED', { timeout: 10000 });
  await expect(page.locator('.renderer-unavailable')).toBeVisible();
  expect(pageErrors).toEqual([]);
});

import { expect, test } from '@playwright/test';

test('a lost WebGL2 context after initialization is reported as unavailable', async ({ page }) => {
  // Keep the production v2 default (65,536 particles). Software WebGL2 needs
  // the same bounded 90s test / 60s readiness budget as the production smoke.
  // The remaining budget covers loss propagation and browser cleanup.
  test.setTimeout(90_000);
  const canLoseWebGL2Context = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgl2');
    return Boolean(context?.getExtension('WEBGL_lose_context'));
  });
  test.skip(!canLoseWebGL2Context, 'Chromium does not expose WEBGL_lose_context in this environment.');

  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await test.step('initialize default production workload', async () => {
    await page.goto('/?webgl=1');
    await expect(page.locator('#actual-backend')).toHaveText('WebGL2', { timeout: 60_000 });
  });

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

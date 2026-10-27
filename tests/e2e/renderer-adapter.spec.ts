import { expect, test } from '@playwright/test';

test('forced WebGL2 initializes a renderer on the application canvas when supported', async ({ page }) => {
  // v2 default 65536 is kept here; software rendering needs a startup budget.
  test.setTimeout(90_000);
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto('/?webgl=1');
  const capabilities = await page.locator('#preview-canvas').evaluate((element: HTMLCanvasElement) => {
    const context = element.getContext('webgl2');
    return {
      webgl2: context !== null,
      timestampQuery: Boolean(context?.getExtension('EXT_disjoint_timer_query_webgl2')),
    };
  });

  await expect(page.locator('#actual-backend')).toHaveText(capabilities.webgl2 ? 'WebGL2' : 'Không khả dụng');
  await expect(page.locator('#runtime-phase-label')).toHaveText(capabilities.webgl2 ? 'READY' : 'UNSUPPORTED');

  if (capabilities.webgl2) {
    const dimensions = await page.locator('#preview-canvas').evaluate((canvas: HTMLCanvasElement) => ({
      width: canvas.width,
      height: canvas.height,
    }));
    expect(dimensions.width).toBeGreaterThan(1);
    expect(dimensions.height).toBeGreaterThan(1);
    await expect(page.locator('#toggle-preview')).toBeEnabled();
    await page.waitForTimeout(1200);
    await expect(page.locator('#actual-backend')).toHaveText('WebGL2');

    const timingLabel = page.locator('#gpu-timing');
    if (capabilities.timestampQuery) {
      // Timing is sampled every 30 compute frames; software WebGL can need
      // several seconds to produce that first sample, so allow a slow-device window.
      await expect(timingLabel).not.toHaveText('Không khả dụng', { timeout: 25_000 });
      const timingMs = Number((await timingLabel.innerText()).replace(' ms', ''));
      expect(Number.isFinite(timingMs) && timingMs > 0).toBe(true);
    } else {
      await expect(timingLabel).toHaveText('Không khả dụng');
    }
  }
  expect(pageErrors).toEqual([]);
});

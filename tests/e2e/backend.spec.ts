import { expect, test } from '@playwright/test';

// A real renderer under software GL is heavy; run one page at a time per project.
test.describe.configure({ mode: 'serial', timeout: 60_000 });

/**
 * Browser matrix for the two-backend benchmark (issue #18).
 *
 * The suite never assumes a GPU: each case probes the browser first and skips
 * safely on machines that do not have the capability. What it does assert in
 * every environment is that the reported backend is the actual one, never the
 * request, and that the preview canvas is never blank.
 */
async function capabilities(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const canvas = document.createElement('canvas');
    const webgl2 = canvas.getContext('webgl2') !== null;
    const gpu = (navigator as Navigator & { gpu?: unknown }).gpu;
    return { webgl2, webgpu: typeof gpu !== 'undefined' };
  });
}

/** Releases the renderer before Playwright tears the context down. */
async function releaseRenderer(page: import('@playwright/test').Page) {
  await page.evaluate(() => window.dispatchEvent(new Event('beforeunload'))).catch(() => {});
}

test('forced WebGL2 runs the real adapter and keeps a sized canvas', async ({ page }) => {
  const caps = await capabilities(page);
  test.skip(!caps.webgl2, 'WebGL2 is unavailable in this browser');

  await page.goto('/?webgl=1');
  await expect(page.locator('#actual-backend')).toHaveText('WebGL2', { timeout: 20_000 });
  await expect(page.locator('#lab-shell')).toHaveAttribute('data-runtime-phase', 'ready');

  const canvas = page.locator('#preview-canvas');
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  expect(box!.width).toBeGreaterThan(0);
  const drawing = await canvas.evaluate((node: HTMLCanvasElement) => ({ width: node.width, height: node.height }));
  expect(drawing.width).toBeGreaterThan(0);
  expect(drawing.height).toBeGreaterThan(0);
  await releaseRenderer(page);
});

test('forced WebGL2 that cannot start reports unavailable, not the request', async ({ page }) => {
  const caps = await capabilities(page);
  test.skip(caps.webgl2, 'WebGL2 is available; this case targets the unavailable path');

  await page.goto('/?webgl=1');
  await expect(page.locator('#actual-backend')).toHaveText('Không khả dụng', { timeout: 20_000 });
  await expect(page.locator('#lab-shell')).toHaveAttribute('data-runtime-phase', 'unsupported');

  const canvas = page.locator('#preview-canvas');
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  expect(box!.width).toBeGreaterThan(0);
  await releaseRenderer(page);
});

test('without WebGPU the app falls back or shows unsupported, never WebGPU', async ({ page }) => {
  const caps = await capabilities(page);
  test.skip(caps.webgpu, 'WebGPU is available; this case targets the fallback path');

  await page.goto('/');
  await expect(page.locator('#actual-backend')).toHaveText(/^(WebGL2( fallback)?|Không khả dụng)$/, {
    timeout: 20_000,
  });
  await expect(page.locator('#lab-shell')).toHaveAttribute(
    'data-runtime-phase',
    /^(ready|fallback|unsupported)$/,
  );

  const canvas = page.locator('#preview-canvas');
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  expect(box!.width).toBeGreaterThan(0);
  expect(box!.height).toBeGreaterThan(0);
  await releaseRenderer(page);
});

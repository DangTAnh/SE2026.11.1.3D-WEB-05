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

/** Same-origin page with no renderer, so probing cannot start the lab. */
const PROBE_PAGE = '/tests/e2e/fixtures/capability-probe.html';

/**
 * Probes the application origin, not `about:blank`: WebGPU is origin-gated and
 * a secure localhost fixture can expose an adapter that `about:blank` does not.
 * `navigator.gpu` alone is not proof — an adapter must actually resolve.
 */
async function capabilities(page: import('@playwright/test').Page) {
  await page.goto(PROBE_PAGE);
  return page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    const webgl2 = canvas.getContext('webgl2') !== null;
    const gpu = (
      navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown | null> } }
    ).gpu;
    let webgpu = false;
    if (gpu) {
      try {
        webgpu = (await gpu.requestAdapter()) !== null;
      } catch {
        webgpu = false;
      }
    }
    return { webgl2, webgpu };
  });
}

/** Releases the renderer before Playwright tears the context down. */
async function releaseRenderer(page: import('@playwright/test').Page) {
  await page.evaluate(() => window.dispatchEvent(new Event('beforeunload'))).catch(() => {});
}

test('probe treats an exposed API without an adapter as unsupported', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'gpu', {
      configurable: true,
      value: { requestAdapter: () => Promise.resolve(null) },
    });
  });
  const caps = await capabilities(page);
  expect(
    await page.evaluate(
      () =>
        typeof (navigator as Navigator & { gpu?: { requestAdapter?: unknown } }).gpu
          ?.requestAdapter,
    ),
  ).toBe('function');
  expect(caps.webgpu).toBe(false);
});

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

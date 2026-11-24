/**
 * #103 — a particle-count rebuild must present initialized particles, also
 * while the preview is paused.
 *
 * Root cause (Three r186.1, WebGL2 backend): compute programs are cached by
 * shader source and the cached program keeps the transform-feedback
 * attributes of the buffers it was first built for. Replacement kernels have
 * identical source, so unless every old kernel is disposed first they write
 * into the old buffers and the rendered buffer stays all zero.
 *
 * Evidence levels: the adapter cases read the rendered position attribute back
 * from the real GPU and screenshot the canvas; the UI cases drive the normal
 * controls on the production app. On this machine WebGL2 is usually
 * SwiftShader (software), not physical-GPU acceptance. WebGPU runs only when
 * the browser exposes an adapter and is otherwise a recorded skip.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import type { PositionSummary } from './fixtures/count-rebuild.ts';

const FIXTURE = '/tests/e2e/fixtures/count-rebuild.html';
// Matches the WebGL warning the defect produced when an old, smaller buffer
// was still bound for transform feedback.
const TRANSFORM_FEEDBACK_ERROR = /transform feedback/i;

function collectProblems(page: Page): string[] {
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error' || TRANSFORM_FEEDBACK_ERROR.test(message.text())) {
      problems.push(`${message.type()}: ${message.text()}`);
    }
  });
  return problems;
}

/**
 * Width/height of the region whose pixels differ from the background inside a
 * fixed central crop (20%–80% on both axes), which excludes the UI overlay
 * labels and buttons near the edges of the preview. It detects spatial
 * collapse; it is not a particle counter.
 */
async function visibleExtent(page: Page, target: Locator): Promise<{ width: number; height: number }> {
  const png = await target.screenshot();
  return page.evaluate(async (base64) => {
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
    const sx = Math.floor(bitmap.width * 0.2);
    const sy = Math.floor(bitmap.height * 0.2);
    const cropWidth = Math.floor(bitmap.width * 0.6);
    const cropHeight = Math.floor(bitmap.height * 0.6);
    const canvas = new OffscreenCanvas(cropWidth, cropHeight);
    const context = canvas.getContext('2d')!;
    context.drawImage(bitmap, sx, sy, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
    const { data, width, height } = context.getImageData(0, 0, cropWidth, cropHeight);
    // Background = most frequent colour in the crop (the cloud may cover a corner).
    const histogram = new Map<number, number>();
    for (let i = 0; i < data.length; i += 4) {
      const key = ((data[i] >> 3) << 10) | ((data[i + 1] >> 3) << 5) | (data[i + 2] >> 3);
      histogram.set(key, (histogram.get(key) ?? 0) + 1);
    }
    const [backgroundKey] = [...histogram.entries()].reduce((best, entry) => (entry[1] > best[1] ? entry : best));
    const [r0, g0, b0] = [((backgroundKey >> 10) & 31) << 3, ((backgroundKey >> 5) & 31) << 3, (backgroundKey & 31) << 3];
    let minX = width; let minY = height; let maxX = -1; let maxY = -1;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const i = (y * width + x) * 4;
        if (Math.abs(data[i] - r0) + Math.abs(data[i + 1] - g0) + Math.abs(data[i + 2] - b0) > 60) {
          minX = Math.min(minX, x); maxX = Math.max(maxX, x);
          minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        }
      }
    }
    return maxX < 0 ? { width: 0, height: 0 } : { width: maxX - minX + 1, height: maxY - minY + 1 };
  }, png.toString('base64'));
}

function expectInitialized(summary: PositionSummary, count: number): void {
  expect(summary.count).toBe(count);
  expect(summary.drawCount).toBe(count);
  expect(summary.finite).toBe(true);
  // Uniform spawn in a sphere of radius 10 (default): no all-zero buffer and
  // no pile-up at the origin. Mean radius of a uniform ball is 0.75 * R.
  expect(summary.nonZero).toBeGreaterThan(summary.floats * 0.99);
  expect(summary.maxAbs).toBeGreaterThan(5);
  expect(summary.maxAbs).toBeLessThanOrEqual(10.5);
  expect(summary.meanRadius).toBeGreaterThan(6);
  expect(summary.meanRadius).toBeLessThan(9);
}

type Backend = 'webgl2' | 'webgpu';
type Mode = 'attractor' | 'vortex';
interface RebuildCase { backend: Backend; mode: Mode; from: number; to: number; switchModesFirst?: boolean }

const CASES: RebuildCase[] = [
  { backend: 'webgl2', mode: 'attractor', from: 1000, to: 2000 },
  { backend: 'webgl2', mode: 'attractor', from: 4000, to: 1000 },
  { backend: 'webgl2', mode: 'vortex', from: 1000, to: 3000 },
  { backend: 'webgl2', mode: 'vortex', from: 3000, to: 1000 },
  // A mode round trip before the rebuild must not leave an old kernel that
  // still holds the shared program.
  { backend: 'webgl2', mode: 'attractor', from: 1000, to: 2000, switchModesFirst: true },
  { backend: 'webgpu', mode: 'attractor', from: 1000, to: 2000 },
  { backend: 'webgpu', mode: 'vortex', from: 3000, to: 1000 },
];

test.describe('count rebuild with the real adapter (#103)', () => {
  test.skip(({ isMobile }) => isMobile, 'GPU readback runs once on desktop Chromium');

  for (const testCase of CASES) {
    const label = `${testCase.backend}/${testCase.mode} ${testCase.from}→${testCase.to}`
      + (testCase.switchModesFirst ? ' after mode round trip' : '');
    test(`paused rebuild initializes and resumes: ${label}`, async ({ page }, testInfo) => {
      test.setTimeout(90_000);
      const problems = collectProblems(page);
      await page.goto(FIXTURE);
      await page.waitForFunction(() => Boolean(window.rebuild));

      const status = await page.evaluate(
        ({ from, mode, backend }) => window.rebuild.init({ count: from, mode, backend }),
        testCase,
      );
      // Backend availability is established, never assumed.
      test.skip(status.actual !== testCase.backend, `${testCase.backend} unavailable here (actual=${status.actual}); NOT_RUN`);

      await page.evaluate(() => window.rebuild.frames(3));
      const canvas = page.locator('#host canvas');
      const before = await page.evaluate(() => window.rebuild.readPositions());
      expectInitialized(before, testCase.from);
      const extentBefore = await visibleExtent(page, canvas);

      await page.evaluate(async ({ mode, switchModesFirst }) => {
        window.rebuild.start();
        await window.rebuild.frames(3);
        if (switchModesFirst) {
          window.rebuild.apply({ mode: mode === 'attractor' ? 'vortex' : 'attractor' });
          await window.rebuild.frames(3);
          window.rebuild.apply({ mode });
          await window.rebuild.frames(3);
        }
        window.rebuild.pause();
      }, testCase);

      await page.evaluate((to) => window.rebuild.apply({ count: to }), testCase.to);
      await page.evaluate(() => window.rebuild.frames(3));
      const rebuilt = await page.evaluate(() => window.rebuild.readPositions());
      const pausedStatus = await page.evaluate(() => window.rebuild.status());
      expect(pausedStatus).toMatchObject({ actual: testCase.backend, running: false });
      expectInitialized(rebuilt, testCase.to);
      const extentAfter = await visibleExtent(page, canvas);
      expect(extentBefore.width).toBeGreaterThan(100);
      expect(extentAfter.width).toBeGreaterThan(extentBefore.width * 0.5);
      expect(extentAfter.height).toBeGreaterThan(extentBefore.height * 0.5);

      // Paused frames must not step the replacement state.
      await page.evaluate(() => window.rebuild.frames(3));
      const stillPaused = await page.evaluate(() => window.rebuild.readPositions());
      expect(stillPaused.absSum).toBe(rebuilt.absSum);

      await page.evaluate(async () => { window.rebuild.start(); await window.rebuild.frames(8); });
      const resumed = await page.evaluate(() => window.rebuild.readPositions());
      expectInitialized(resumed, testCase.to);
      expect(resumed.absSum).not.toBe(rebuilt.absSum);

      await testInfo.attach('count-rebuild.json', {
        body: JSON.stringify({ case: testCase, status, before, rebuilt, resumed, extentBefore, extentAfter }, null, 2),
        contentType: 'application/json',
      });
      await page.evaluate(() => window.rebuild.dispose());
      expect(problems).toEqual([]);
    });
  }
});

test.describe('count rebuild through the production UI (#103)', () => {
  test.skip(({ isMobile }) => isMobile, 'Visible rebuild regression runs once on desktop Chromium');

  async function openPausedWebGL2(page: Page): Promise<void> {
    await page.goto('/?webgl=1');
    const webgl2 = await page.locator('#preview-canvas').evaluate((element: HTMLCanvasElement) => (
      document.createElement('canvas').getContext('webgl2') !== null && element instanceof HTMLCanvasElement
    ));
    test.skip(!webgl2, 'WebGL2 unavailable here; NOT_RUN');
    await expect(page.locator('#actual-backend')).toHaveText('WebGL2', { timeout: 60_000 });
    await expect(page.locator('#runtime-phase-label')).toHaveText('READY');
    await page.locator('#toggle-preview').click();
    await expect(page.locator('#toggle-preview')).toHaveAttribute('aria-label', 'Tiếp tục xem trước');
  }

  test('changing particle count while paused keeps a spatially distributed cloud', async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    const problems = collectProblems(page);
    await openPausedWebGL2(page);
    const canvas = page.locator('#preview-canvas');
    const before = await visibleExtent(page, canvas);

    await page.locator('#particle-count').fill('1000');
    await page.locator('#particle-count').press('Tab');
    await expect(page.locator('#particle-count-value')).toContainText('1.000');
    await page.waitForTimeout(500);
    const after = await visibleExtent(page, canvas);

    await expect(page.locator('#actual-backend')).toHaveText('WebGL2');
    await expect(page.locator('#runtime-phase-label')).toHaveText('READY');
    await expect(page.locator('#toggle-preview')).toHaveAttribute('aria-label', 'Tiếp tục xem trước');
    expect(before.width).toBeGreaterThan(100);
    expect(after.width).toBeGreaterThan(before.width * 0.5);
    expect(after.height).toBeGreaterThan(before.height * 0.5);
    await testInfo.attach('visible-extent.json', { body: JSON.stringify({ before, after }), contentType: 'application/json' });
    expect(problems).toEqual([]);
  });

  test('importing a preset with another count and mode while paused keeps a distributed cloud', async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    const problems = collectProblems(page);
    await openPausedWebGL2(page);
    const canvas = page.locator('#preview-canvas');
    const before = await visibleExtent(page, canvas);

    // Round-trip the app's own export so only count and mode change and the
    // backend preference stays as-is (applyConfig path, no re-init).
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#export-preset').click();
    const download = await downloadPromise;
    const exported = JSON.parse(await (await import('node:fs/promises')).readFile(await download.path(), 'utf8'));
    exported.config.simulation.particleCount = 2000;
    exported.config.mode = 'vortex';
    await page.locator('#preset-file').setInputFiles({
      name: 'count-rebuild.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(exported)),
    });
    await expect(page.locator('#particle-count-value')).toContainText('2.000');
    await expect(page.locator('#mode-vortex')).toHaveAttribute('aria-pressed', 'true');
    await page.waitForTimeout(500);
    const after = await visibleExtent(page, canvas);

    await expect(page.locator('#actual-backend')).toHaveText('WebGL2');
    await expect(page.locator('#runtime-phase-label')).toHaveText('READY');
    await expect(page.locator('#toggle-preview')).toHaveAttribute('aria-label', 'Tiếp tục xem trước');
    expect(after.width).toBeGreaterThan(before.width * 0.5);
    expect(after.height).toBeGreaterThan(before.height * 0.5);
    await testInfo.attach('visible-extent.json', { body: JSON.stringify({ before, after }), contentType: 'application/json' });
    expect(problems).toEqual([]);
  });
});

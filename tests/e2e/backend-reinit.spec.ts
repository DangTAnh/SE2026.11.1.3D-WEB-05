import { expect, test } from '@playwright/test';

const fixture = '/tests/e2e/fixtures/backend-session.html';

test('backend apply preserves config and pause, creates a new canvas and cleans up UI polling', async ({ page }) => {
  await page.clock.install();
  await page.goto(fixture);
  await expect(page.locator('#actual-backend')).toHaveText('WebGPU');
  await page.locator('#speed').fill('2.5');
  await page.locator('#mode-vortex').click();
  await page.locator('#toggle-preview').click();
  const canvas = await page.locator('#preview-canvas').elementHandle();
  const fallbackText = await page.locator('#preview-canvas').textContent();
  await page.locator('#backend').selectOption('webgl2');
  await page.locator('#apply-backend').click();
  await expect(page.locator('#actual-backend')).toHaveText('WebGL2');
  await expect(page.locator('#toast')).toHaveText('Đã áp dụng backend: WebGL2.');
  await expect(page.locator('#preview-canvas')).toHaveText(fallbackText!);
  expect(fallbackText!.trim().length).toBeGreaterThan(0);
  await expect(page.locator('[data-renderer-staging]')).toHaveCount(0);
  expect(await canvas!.evaluate(node => node.isConnected)).toBe(false);
  await expect(page.locator('#speed')).toHaveValue('2.5');
  await expect(page.locator('#mode-vortex')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#toggle-preview')).toHaveAttribute('aria-label', 'Tiếp tục xem trước');
  expect(await page.evaluate(() => window.sessionTest.ports[0]!.calls.filter(c => c.type === 'dispose').length)).toBe(1);
  await page.locator('#toggle-preview').click();
  await page.locator('#reset-preview').click();
  expect(await page.evaluate(() => window.sessionTest.ports[1]!.calls.filter(c => c.type === 'start').length)).toBe(1);
  await page.evaluate(() => { window.sessionTest.ports[1]!.calls.length = 0; });
  await page.clock.runFor(1500);
  expect(await page.evaluate(() => window.sessionTest.ports[1]!.calls.filter(c => c.type === 'getStatus').length)).toBe(3);
  await page.evaluate(() => { window.sessionTest.unmount(); window.dispatchEvent(new Event('beforeunload')); });
  const count = await page.evaluate(() => window.sessionTest.ports[1]!.calls.length);
  await page.clock.fastForward(1500);
  expect(await page.evaluate(() => window.sessionTest.ports[1]!.calls.length)).toBe(count);
  expect(await page.evaluate(() => window.sessionTest.ports[1]!.calls.filter(c => c.type === 'dispose').length)).toBe(1);
  expect(await page.evaluate(() => window.sessionTest.observers)).toEqual({ created: 1, disconnected: 1 });
});

for (const failure of ['reject', 'unavailable'] as const) {
test(`failed init (${failure}) retains the running canvas and reports rollback`, async ({ page }) => {
  await page.goto(fixture);
  await expect(page.locator('#actual-backend')).toHaveText('WebGPU');
  const canvas = await page.locator('#preview-canvas').elementHandle();
  await page.locator('#speed').fill('2.5');
  await page.locator('#backend').selectOption('webgl2');
  await page.evaluate(failure => {
    window.sessionTest.failNext = failure === 'reject';
    window.sessionTest.unavailableNext = failure === 'unavailable';
  }, failure);
  await page.locator('#apply-backend').click();
  await expect(page.locator('#toast')).toHaveText('Không thể áp dụng backend. Vẫn sử dụng WebGPU trước đó.');
  await expect(page.locator('#actual-backend')).toHaveText('WebGPU');
  expect(await canvas!.evaluate(node => node.isConnected)).toBe(true);
  await expect(page.locator('#speed')).toHaveValue('2.5');
  expect(await page.evaluate(() => ({ oldDisposed: window.sessionTest.ports[0]!.disposed,
    running: window.sessionTest.ports[0]!.getStatus().running,
    failedDisposed: window.sessionTest.ports[1]!.disposed })))
    .toEqual({ oldDisposed: false, running: true, failedDisposed: true });
  await expect(page.locator('[data-renderer-staging]')).toHaveCount(0);
  await expect(page.locator('#apply-backend')).toBeEnabled();
});
}

test('staging keeps the live canvas until readiness; overlapping requests publish only the latest result', async ({ page }) => {
  await page.goto(fixture);
  await expect(page.locator('#actual-backend')).toHaveText('WebGPU');
  const canvas = await page.locator('#preview-canvas').elementHandle();
  await page.evaluate(() => { window.sessionTest.deferNext = true; });
  await page.locator('#apply-backend').click();
  await expect(page.locator('#runtime-phase-label')).toHaveText('INITIALIZING');
  expect(await canvas!.evaluate(node => node.isConnected)).toBe(true);
  await expect(page.locator('#preview-canvas')).toHaveCount(1);
  await expect(page.locator('[data-renderer-staging]')).toHaveAttribute('aria-hidden', 'true');
  expect(await page.locator('[data-renderer-staging]').evaluate(node => (node as HTMLElement).inert)).toBe(true);
  expect(await page.locator('[data-renderer-staging] canvas').evaluate(node => node.isConnected)).toBe(true);
  await expect(page.locator('#runtime-fps')).toHaveText('—');
  await expect(page.locator('#gpu-timing')).toHaveText('Không khả dụng');
  await page.locator('#backend').selectOption('webgl2');
  await page.locator('#apply-backend').click();
  await expect(page.locator('#actual-backend')).toHaveText('WebGL2');
  await expect(page.locator('#toast')).toHaveText('Đã áp dụng backend: WebGL2.');
  await page.evaluate(() => window.sessionTest.finish[0]!());
  await expect(page.locator('#actual-backend')).toHaveText('WebGL2');
  await expect(page.locator('#toast')).toHaveText('Đã áp dụng backend: WebGL2.');
  expect(await page.evaluate(() => window.sessionTest.ports[1]!.disposed)).toBe(true);
  expect(await page.evaluate(() => window.sessionTest.factoryCanvasIsLatestRendererCanvas())).toBe(true);
  expect(await page.evaluate(() => window.sessionTest.latestRendererCanvasIsConnected())).toBe(true);
  await expect(page.locator('#app canvas')).toHaveCount(1);
  await expect(page.locator('[data-renderer-staging]')).toHaveCount(0);
});

test('valid WebGPU to WebGL2 fallback reports success rather than rollback', async ({ page }) => {
  await page.goto(fixture);
  await expect(page.locator('#actual-backend')).toHaveText('WebGPU');
  await page.evaluate(() => { window.sessionTest.fallbackNext = true; });
  await page.locator('#backend').selectOption('webgpu');
  await page.locator('#apply-backend').click();
  await expect(page.locator('#actual-backend')).toHaveText('WebGL2 fallback');
  await expect(page.locator('#toast')).toHaveText('Đã áp dụng backend: WebGL2 fallback thay cho WebGPU.');
});

test('backend apply follows a canvas replaced by runtime recovery', async ({ page }) => {
  await page.goto(fixture);
  await expect(page.locator('#actual-backend')).toHaveText('WebGPU');
  const original = await page.locator('#preview-canvas').elementHandle();

  await page.evaluate(() => window.sessionTest.simulateRuntimeCanvasReplacement());
  expect(await original!.evaluate(node => node.isConnected)).toBe(false);
  expect(await page.evaluate(() => window.sessionTest.factoryCanvasIsCurrent())).toBe(true);

  await page.locator('#backend').selectOption('webgl2');
  await page.locator('#apply-backend').click();
  await expect(page.locator('#actual-backend')).toHaveText('WebGL2');
  await expect(page.locator('#toast')).toHaveText('Đã áp dụng backend: WebGL2.');
  expect(await page.evaluate(() => window.sessionTest.factoryCanvasIsCurrent())).toBe(true);
  await expect(page.locator('[data-renderer-staging]')).toHaveCount(0);
});

test('backend apply adopts a canvas replaced inside staging during initialization', async ({ page }) => {
  await page.goto(fixture);
  await expect(page.locator('#actual-backend')).toHaveText('WebGPU');
  await page.evaluate(() => { window.sessionTest.replaceDuringInitNext = true; });
  await page.locator('#backend').selectOption('webgpu');
  await page.evaluate(() => { window.sessionTest.fallbackNext = true; });
  await page.locator('#apply-backend').click();
  await expect(page.locator('#actual-backend')).toHaveText('WebGL2 fallback');
  await expect(page.locator('#toast')).toHaveText('Đã áp dụng backend: WebGL2 fallback thay cho WebGPU.');
  expect(await page.evaluate(() => ({
    factoryUsesRenderer: window.sessionTest.factoryCanvasIsLatestRendererCanvas(),
    rendererCanvasConnected: window.sessionTest.latestRendererCanvasIsConnected(),
  }))).toEqual({ factoryUsesRenderer: true, rendererCanvasConnected: true });
  await expect(page.locator('#preview-canvas')).toHaveCount(1);
  await expect(page.locator('#app canvas')).toHaveCount(1);
  await expect(page.locator('[data-renderer-staging]')).toHaveCount(0);
});

test('initial WebGPU fallback commits the replacement canvas from its staged candidate', async ({ page }) => {
  await page.addInitScript(() => { window.sessionInitialFallback = true; });
  await page.goto(fixture);
  await expect(page.locator('#actual-backend')).toHaveText('WebGL2 fallback');
  expect(await page.evaluate(() => ({
    factoryUsesRenderer: window.sessionTest.factoryCanvasIsLatestRendererCanvas(),
    rendererCanvasConnected: window.sessionTest.latestRendererCanvasIsConnected(),
  }))).toEqual({ factoryUsesRenderer: true, rendererCanvasConnected: true });
  await expect(page.locator('#preview-canvas')).toHaveCount(1);
  await expect(page.locator('#app canvas')).toHaveCount(1);
  await expect(page.locator('[data-renderer-staging]')).toHaveCount(0);
});

test('runtime replacement is disposed with its owner without removing a newer candidate surface', async ({ page }) => {
  await page.goto(fixture);
  await expect(page.locator('#actual-backend')).toHaveText('WebGPU');
  await page.evaluate(() => window.sessionTest.simulateRuntimeCanvasReplacement());
  expect(await page.evaluate(() => window.sessionTest.factoryCanvasIsCurrent())).toBe(true);

  await page.locator('#backend').selectOption('webgl2');
  await page.locator('#apply-backend').click();
  await expect(page.locator('#actual-backend')).toHaveText('WebGL2');
  expect(await page.evaluate(() => ({
    factoryUsesRenderer: window.sessionTest.factoryCanvasIsLatestRendererCanvas(),
    rendererCanvasConnected: window.sessionTest.latestRendererCanvasIsConnected(),
  }))).toEqual({ factoryUsesRenderer: true, rendererCanvasConnected: true });
  await expect(page.locator('#app canvas')).toHaveCount(1);
  await expect(page.locator('[data-renderer-staging]')).toHaveCount(0);

  await page.evaluate(() => window.dispatchEvent(new Event('beforeunload')));
  await expect(page.locator('#app canvas')).toHaveCount(0);
  await expect(page.locator('[data-renderer-staging]')).toHaveCount(0);
});

test('initial unavailable retry does not start without user intent', async ({ page }) => {
  await page.addInitScript(() => { window.sessionInitialUnavailable = true; });
  await page.goto(fixture);
  await expect(page.locator('#actual-backend')).toHaveText('Không khả dụng');
  await page.evaluate(() => { window.sessionTest.unavailableNext = true; });
  await page.locator('#apply-backend').click();
  await expect(page.locator('#toast')).toHaveText('Không thể áp dụng backend. Không có renderer khả dụng; vui lòng thử lại.');
  await page.locator('#apply-backend').click();
  await expect(page.locator('#actual-backend')).toHaveText('WebGPU');
  await expect(page.locator('#toggle-preview')).toHaveAttribute('aria-label', 'Tiếp tục xem trước');
  expect(await page.evaluate(() => window.sessionTest.ports[2]!.calls.filter(c => c.type === 'start').length)).toBe(0);
  await page.locator('#toggle-preview').click();
  expect(await page.evaluate(() => window.sessionTest.ports[2]!.getStatus().running)).toBe(true);
});

test('production applies WebGL2, WebGPU and Auto without reload and resumes after re-init', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/?webgl=1');
  const webgl2Available = await page.evaluate(() => document.createElement('canvas').getContext('webgl2') !== null);
  if (!webgl2Available) {
    await expect(page.locator('#actual-backend')).toHaveText('Không khả dụng', { timeout: 20000 });
    await expect(page.locator('#runtime-phase-label')).toHaveText('UNSUPPORTED');
  }
  test.skip(!webgl2Available, 'WebGL2 is unavailable in this browser; production unsupported UI was verified.');
  await expect(page.locator('#actual-backend')).toHaveText('WebGL2', { timeout: 20000 });
  await page.locator('#particle-count').fill('1000');
  await page.locator('#speed').fill('2.5');
  await page.locator('#toggle-preview').click();
  const documentId = await page.evaluate(() => performance.timeOrigin);
  for (const preference of ['webgpu', 'auto', 'webgl2']) {
    const canvas = await page.locator('#preview-canvas').elementHandle();
    await page.locator('#backend').selectOption(preference);
    await page.locator('#apply-backend').click();
    await expect(page.locator('#actual-backend')).toHaveText(/^(WebGPU|WebGL2(?: fallback)?)$/, { timeout: 20000 });
    expect(await canvas!.evaluate(node => node.isConnected)).toBe(false);
    await expect(page.locator('#speed')).toHaveValue('2.5');
    await expect(page.locator('#backend')).toHaveValue(preference);
    await expect(page.locator('#toggle-preview')).toHaveAttribute('aria-label', 'Tiếp tục xem trước');
    await expect(page.locator('#runtime-fps')).toHaveText('—');
    await expect(page.locator('#gpu-timing')).toHaveText('Không khả dụng');
  }
  expect(await page.evaluate(() => performance.timeOrigin)).toBe(documentId);
  await page.locator('#toggle-preview').click();
  await expect(page.locator('#runtime-fps')).toHaveText(/^\d+ FPS$/, { timeout: 20000 });
});

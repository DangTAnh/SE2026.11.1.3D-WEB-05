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
  await page.locator('#backend').selectOption('webgl2');
  await page.locator('#apply-backend').click();
  await expect(page.locator('#actual-backend')).toHaveText('WebGL2');
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
});

test('failed init permits retry, and overlapping requests only publish the latest backend', async ({ page }) => {
  await page.goto(fixture);
  await expect(page.locator('#actual-backend')).toHaveText('WebGPU');
  await page.evaluate(() => { window.sessionTest.failNext = true; });
  await page.locator('#apply-backend').click();
  await expect(page.locator('#actual-backend')).toHaveText('Không khả dụng');
  await expect(page.locator('#runtime-notice')).not.toContainText('private');
  await expect(page.locator('#apply-backend')).toBeEnabled();
  await page.evaluate(() => { window.sessionTest.deferNext = true; });
  await page.locator('#apply-backend').click();
  await expect(page.locator('#runtime-phase-label')).toHaveText('INITIALIZING');
  await expect(page.locator('#runtime-fps')).toHaveText('—');
  await expect(page.locator('#gpu-timing')).toHaveText('Không khả dụng');
  await page.locator('#backend').selectOption('webgl2');
  await page.locator('#apply-backend').click();
  await expect(page.locator('#actual-backend')).toHaveText('WebGL2');
  await page.evaluate(() => window.sessionTest.finish[0]!());
  await expect(page.locator('#actual-backend')).toHaveText('WebGL2');
  expect(await page.evaluate(() => window.sessionTest.ports[2]!.disposed)).toBe(true);
});

test('production applies WebGL2, WebGPU and Auto without reload and resumes after re-init', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/?webgl=1');
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

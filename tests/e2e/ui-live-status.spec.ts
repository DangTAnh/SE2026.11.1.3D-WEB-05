import { expect, test } from '@playwright/test';

const fixturePage = '/tests/e2e/fixtures/renderer-port.html';

test('production WebGL2 shows live FPS and clears metrics when paused', async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  await page.goto('/?webgl=1');
  const supported = await page.locator('#preview-canvas').evaluate(canvas =>
    (canvas as HTMLCanvasElement).getContext('webgl2') !== null);
  test.skip(!supported, 'This browser cannot initialize WebGL2 on the application canvas.');
  await expect(page.locator('#actual-backend')).toHaveText('WebGL2', { timeout: 20_000 });
  await expect(page.locator('#runtime-phase-label')).toHaveText('READY');
  // Exercise status transitions on a small real GPU workload. The v2 default
  // (65536) is validated by the production initialization smoke; software
  // rendering it here makes screenshot/click latency dominate this status test.
  await page.locator('#particle-count').fill('1000');
  await expect(page.locator('#runtime-fps')).toHaveText(/^\d+ FPS$/, { timeout: 20_000 });
  await expect(page.locator('#runtime-fps-detail')).toHaveText('Dữ liệu từ renderer');
  await page.screenshot({ path: testInfo.outputPath('live-webgl2.png') });
  await page.locator('#toggle-preview').click();
  await expect(page.locator('#runtime-fps')).toHaveText('—');
  await expect(page.locator('#gpu-timing')).toHaveText('Không khả dụng');
  await expect(page.locator('#gpu-timing-detail')).toContainText('tạm dừng');
  await page.locator('#toggle-preview').click();
  await expect(page.locator('#runtime-fps')).toHaveText(/^\d+ FPS$/, { timeout: 20_000 });
});

test('pending init shows loading without fabricated metrics, then displays the initialized port', async ({ page }) => {
  await page.addInitScript(() => { window.deferRendererInit = true; });
  await page.goto(fixturePage);
  await expect(page.locator('#runtime-phase-label')).toHaveText('INITIALIZING');
  await expect(page.locator('#actual-backend')).toHaveText('Đang khởi tạo');
  await expect(page.locator('#runtime-fps')).toHaveText('—');
  await expect(page.locator('#gpu-timing')).toHaveText('Không khả dụng');
  await expect(page.locator('[data-runtime-control]:not(:disabled)')).toHaveCount(0);
  await page.evaluate(() => window.finishRendererInit?.());
  await expect(page.locator('#actual-backend')).toHaveText('WebGPU');
  await expect(page.locator('#runtime-phase-label')).toHaveText('READY');
  await expect(page.locator('#mode-vortex')).toBeEnabled();
});

test('live status replaces metrics and backend identity across failure and recovery', async ({ page }) => {
  await page.clock.install();
  await page.goto(fixturePage);
  await expect(page.locator('#actual-backend')).toHaveText('WebGPU');
  await page.evaluate(() => window.uiTest.setStatus({ fps: 61.7, gpuTimingAvailable: true, measurementAgeMs: 0, gpuTimeMs: 1.25 }));
  await page.clock.fastForward(500);
  await expect(page.locator('#runtime-fps')).toHaveText('62 FPS');
  await expect(page.locator('#gpu-timing')).toHaveText('1.25 ms');

  await page.evaluate(() => window.uiTest.setStatus({ measurementAgeMs: 2_001 }));
  await page.clock.fastForward(500);
  await expect(page.locator('#gpu-timing')).toHaveText('Không khả dụng');

  await page.evaluate(() => window.uiTest.setStatus({ gpuTimingAvailable: true, measurementAgeMs: 0, gpuTimeMs: 0 }));
  await page.clock.fastForward(500);
  await expect(page.locator('#gpu-timing')).toHaveText('Không khả dụng');

  await page.evaluate(() => window.uiTest.setStatus({ actual: 'webgl2', requested: 'webgpu', fps: 48,
    gpuTimingAvailable: false, measurementAgeMs: null, gpuTimeMs: 0 }));
  await page.clock.fastForward(500);
  await expect(page.locator('#actual-backend')).toHaveText('WebGL2 fallback');
  await expect(page.locator('#runtime-fps')).toHaveText('48 FPS');
  await expect(page.locator('#gpu-timing')).toHaveText('Không khả dụng');

  await page.evaluate(() => window.uiTest.setStatus({ actual: 'unavailable' }));
  await page.clock.fastForward(500);
  await expect(page.locator('#actual-backend')).toHaveText('Không khả dụng');
  await expect(page.locator('#runtime-fps')).toHaveText('—');
  await expect(page.locator('#mode-vortex')).toBeDisabled();
  await expect(page.locator('#export-preset')).toBeEnabled();
  await expect(page.locator('#import-preset')).toBeEnabled();

  await page.evaluate(() => window.uiTest.setFailure(true));
  await page.clock.fastForward(500);
  await expect(page.locator('#lab-shell')).toHaveAttribute('data-runtime-phase', 'error');
  await expect(page.locator('#runtime-notice')).not.toContainText('internal');

  await page.evaluate(() => {
    window.uiTest.setFailure(false);
    window.uiTest.setStatus({ actual: 'webgpu', fps: 60, gpuTimingAvailable: true, measurementAgeMs: 0, gpuTimeMs: 2 });
  });
  await page.clock.fastForward(500);
  await expect(page.locator('#runtime-phase-label')).toHaveText('READY');
  await expect(page.locator('#runtime-notice')).toBeHidden();
  await expect(page.locator('#actual-backend')).toHaveText('WebGPU');
  await expect(page.locator('#mode-vortex')).toBeEnabled();
  await expect(page.locator('#gpu-timing')).toHaveText('2.00 ms');
});

test('paused and invalid samples never keep old GPU timing visible', async ({ page }) => {
  await page.clock.install();
  await page.goto(fixturePage);
  await page.evaluate(() => window.uiTest.setStatus({ fps: 60, gpuTimingAvailable: true, measurementAgeMs: 0, gpuTimeMs: 3 }));
  await page.clock.fastForward(500);
  await expect(page.locator('#gpu-timing')).toHaveText('3.00 ms');
  await page.evaluate(() => window.uiTest.setStatus({ running: false }));
  await page.clock.fastForward(500);
  await expect(page.locator('#runtime-fps')).toHaveText('—');
  await expect(page.locator('#gpu-timing')).toHaveText('Không khả dụng');
  await expect(page.locator('#gpu-timing-detail')).toContainText('tạm dừng');
  await page.locator('#toggle-preview').click();
  await expect(page.locator('#toggle-preview')).toHaveAttribute('aria-label', 'Tạm dừng xem trước');
  expect(await page.evaluate(() => window.uiTest.port.getStatus().running)).toBe(true);
  await page.evaluate(() => window.uiTest.setStatus({ running: true, fps: NaN, measurementAgeMs: 0, gpuTimeMs: -1 }));
  await page.clock.fastForward(500);
  await expect(page.locator('#runtime-fps')).toHaveText('—');
  await expect(page.locator('#runtime-fps-detail')).toHaveText('Không có số đo hợp lệ');
  await expect(page.locator('#gpu-timing')).toHaveText('Không khả dụng');
});

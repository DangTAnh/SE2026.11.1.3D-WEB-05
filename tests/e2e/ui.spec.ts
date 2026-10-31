import { cloneConfig, DEFAULT_CONFIG } from '../../src/presets/preset.ts';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const fixturePage = '/tests/e2e/fixtures/renderer-port.html';

const validPreset = {
  schemaVersion: 2,
  app: '3D-WEB-05',
  config: {
    ...cloneConfig(DEFAULT_CONFIG), mode: 'vortex', backendPreference: 'webgl2',
    simulation: { ...DEFAULT_CONFIG.simulation, particleCount: 32000, speed: 2.2, particleSize: 4 },
    rendering: { ...DEFAULT_CONFIG.rendering, particleColor: '#ff8800' },
    modes: { ...cloneConfig(DEFAULT_CONFIG).modes, vortex: { vortexStrength: 2.4, vortexDamping: 0.99 } },
  },
};

test('luồng điều khiển chính hoạt động và không tràn ngang', async ({ page }) => {
  await page.goto(fixturePage);

  await expect(page.getByRole('heading', { level: 1 })).toContainText('Make motion');
  await expect(page.locator('#actual-backend')).toHaveText('WebGPU');

  await page.locator('#mode-vortex').click();
  await expect(page.locator('#mode-vortex')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#scene-mode')).toHaveText('VORTEX FIELD');
  await expect(page.locator('#strength-label')).toHaveText('Vortex strength');

  await page.locator('#speed').fill('2.5');
  await expect(page.locator('#speed-value')).toContainText('2,5');

  await page.locator('#restore-defaults').click();
  await expect(page.locator('#mode-attractor')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#speed-value')).toContainText('1,2');

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
});

test('trạng thái port chuyển trực tiếp qua fallback và error', async ({ page }) => {
  await page.goto(fixturePage);
  await page.evaluate(() => window.uiTest.setStatus({ actual: 'webgl2' }));
  await expect(page.locator('#lab-shell')).toHaveAttribute('data-runtime-phase', 'fallback');
  await expect(page.locator('#runtime-notice')).toHaveAttribute('data-tone', 'warning');
  await expect(page.locator('#actual-backend')).toContainText('WebGL2 fallback');
  await expect(page.locator('#mode-vortex')).toBeEnabled();

  await page.evaluate(() => window.uiTest.setFailure(true));
  await expect(page.locator('#lab-shell')).toHaveAttribute('data-runtime-phase', 'error');
  await expect(page.locator('#runtime-notice')).toHaveAttribute('role', 'alert');
  await expect(page.locator('#runtime-notice-title')).toHaveText('Renderer gặp lỗi');
  await expect(page.locator('#runtime-notice-message')).not.toContainText(/Error:|at \w+ \(|\.tsx?:\d+/);
  await expect(page.locator('[data-runtime-control]:not(:disabled)')).toHaveCount(0);
  await expect(page.locator('#export-preset')).toBeEnabled();
  await expect(page.locator('#import-preset')).toBeEnabled();
});

test('preset hợp lệ được import, preset lỗi không làm đổi state', async ({ page }) => {
  await page.goto(fixturePage);

  await page.locator('#preset-file').setInputFiles({
    name: 'valid-preset.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(validPreset)),
  });
  await expect(page.locator('#mode-vortex')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#particle-count-value')).toContainText('32.000');
  await expect(page.locator('#particle-color-value')).toHaveText('#FF8800');

  const invalidPreset = structuredClone(validPreset);
  invalidPreset.config.simulation.speed = 99;
  await page.locator('#preset-file').setInputFiles({
    name: 'invalid-preset.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(invalidPreset)),
  });

  await expect(page.locator('#toast')).toContainText('Tốc độ nằm ngoài');
  await expect(page.locator('#particle-count-value')).toContainText('32.000');
  await expect(page.locator('#speed-value')).toContainText('2,2');
});

test('preset export tạo JSON đúng schema', async ({ page }) => {
  await page.goto(fixturePage);

  const downloadPromise = page.waitForEvent('download');
  await page.locator('#export-preset').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('particle-lab-attractor-preset.json');

  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();
  const exported = JSON.parse(await readFile(downloadPath as string, 'utf8')) as typeof validPreset;
  expect(exported.schemaVersion).toBe(2);
  expect(exported.app).toBe('3D-WEB-05');
  expect(exported.config.mode).toBe('attractor');
  expect(exported.config.simulation.particleCount).toBe(65536);
});

test('named v2 document survives edits and simulation reset; defaults clear metadata', async ({ page }) => {
  await page.goto(fixturePage);
  const document = { ...structuredClone(validPreset), name: 'TV4 named experiment' };
  document.config.simulation.particleCount = 65536;
  document.config.modes.attractor.attractorStrength = 1.234;
  document.config.modes.vortex.vortexStrength = 2.345;
  await page.locator('#preset-file').setInputFiles({ name: 'named.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(document)) });
  await expect(page.locator('#toast')).toHaveText('Đã nhập preset hợp lệ.');
  await expect(page.locator('#particle-count')).toHaveValue('65536');
  await expect(page.locator('#strength')).toHaveValue('2.345');
  await page.locator('#strength').fill('3.123');
  await page.locator('#mode-attractor').click();
  await expect(page.locator('#strength')).toHaveValue('1.234');
  await page.locator('#speed').fill('2.123');
  await page.locator('#reset-preview').click();
  const exportDocument = async () => {
    const pending = page.waitForEvent('download');
    await page.locator('#export-preset').click();
    const download = await pending;
    return JSON.parse(await readFile((await download.path())!, 'utf8')) as typeof document;
  };
  const exported = await exportDocument();
  expect(exported.name).toBe(document.name);
  expect(exported.config.simulation.speed).toBe(2.123);
  expect(exported.config.modes.attractor.attractorStrength).toBe(1.234);
  expect(exported.config.modes.vortex.vortexStrength).toBe(3.123);
  const engineConfigs = await page.evaluate(() => window.uiTest.port.calls
    .filter(c => c.type === 'applyConfig').map(c => c.config));
  expect(engineConfigs.every(config => !Object.hasOwn(config!, 'name'))).toBe(true);

  await page.locator('#restore-defaults').click();
  const defaults = await exportDocument();
  expect(defaults).not.toHaveProperty('name');
  expect(defaults.config).toEqual(cloneConfig(DEFAULT_CONFIG));

  // Importing an unnamed document also clears a previously imported name.
  for (const preset of [document, validPreset]) {
    await page.locator('#preset-file').setInputFiles({ name: 'import.json', mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(preset)) });
    await expect(page.locator('#toast')).toHaveText('Đã nhập preset hợp lệ.');
  }
  expect(await exportDocument()).not.toHaveProperty('name');
});

test('rejected import retains document name; accepted import retains new name if reset fails', async ({ page }) => {
  await page.goto(fixturePage);
  const importDocument = async (name: string) => {
    await page.locator('#preset-file').setInputFiles({ name: 'named.json', mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({ ...validPreset, name })) });
  };
  const exportedName = async () => {
    const pending = page.waitForEvent('download');
    await page.locator('#export-preset').click();
    const download = await pending;
    return (JSON.parse(await readFile((await download.path())!, 'utf8')) as { name?: string }).name;
  };
  await importDocument('original name');
  await expect(page.locator('#toast')).toHaveText('Đã nhập preset hợp lệ.');
  await page.evaluate(() => {
    const apply = window.uiTest.port.applyConfig.bind(window.uiTest.port);
    let fail = true;
    window.uiTest.port.applyConfig = config => {
      if (fail) { fail = false; throw new Error('private backend failure'); }
      apply(config);
    };
  });
  await importDocument('rejected name');
  await expect(page.locator('#toast')).toContainText('Không thể áp dụng cấu hình');
  expect(await exportedName()).toBe('original name');
  await page.evaluate(() => {
    window.uiTest.port.reset = () => { throw new Error('private reset failure'); };
  });
  await importDocument('accepted name');
  await expect(page.locator('#toast')).toContainText('Cấu hình đã được áp dụng');
  expect(await exportedName()).toBe('accepted name');
});

test('không có vi phạm WCAG tự động mức A/AA @a11y', async ({ page }) => {
  await page.goto(fixturePage);
  for (const phase of ['ready', 'fallback', 'unsupported', 'error']) {
    await page.evaluate((phase) => {
      window.uiTest.setFailure(phase === 'error');
      window.uiTest.setStatus({ actual: phase === 'unsupported' ? 'unavailable'
        : phase === 'fallback' ? 'webgl2' : 'webgpu' });
    }, phase);
    await expect(page.locator('#lab-shell')).toHaveAttribute('data-runtime-phase', phase);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(results.violations, `Axe violations tại ${phase}`).toEqual([]);
  }
});

test('tạo ảnh minh chứng desktop/mobile theo fixture @evidence', async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    let seed = 2026;
    Math.random = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
  });

  const screenshotDir = path.resolve(process.cwd(), 'docs/04-testing/screenshots');
  const isDesktop = testInfo.project.name === 'desktop-chromium';
  const cases = isDesktop
    ? [
        { phase: 'ready', file: 'automated-desktop-1440x1000.png' },
        { phase: 'fallback', file: 'automated-fallback-1440x1000.png' },
      ]
    : [
        { phase: 'ready', file: 'automated-mobile-500x844.png' },
        { phase: 'error', file: 'automated-error-500x844.png' },
      ];

  for (const evidence of cases) {
    await page.goto(fixturePage);
    await page.evaluate((phase) => {
      window.uiTest.setFailure(phase === 'error');
      window.uiTest.setStatus({ actual: phase === 'fallback' ? 'webgl2' : 'webgpu' });
    }, evidence.phase);
    await expect(page.locator('#lab-shell')).toHaveAttribute('data-runtime-phase', evidence.phase);
    await expect(page.locator('#lab-shell')).toBeVisible();
    await page.screenshot({
      path: path.join(screenshotDir, evidence.file),
      animations: 'disabled',
    });
  }
});

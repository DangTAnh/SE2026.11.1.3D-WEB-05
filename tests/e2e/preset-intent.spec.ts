import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { cloneConfig, DEFAULT_CONFIG, type PresetDocument } from '../../src/presets/preset.ts';

declare global {
  interface Window {
    presetReads: Record<string, { resolve: (text: string) => void; reject: (error: Error) => void }>;
    toastChanges: string[];
  }
}

const documentFor = (name: string, speed: number): PresetDocument => ({
  schemaVersion: 2, app: '3D-WEB-05', name,
  config: { ...cloneConfig(DEFAULT_CONFIG), simulation: { ...DEFAULT_CONFIG.simulation, speed } },
});
const a = documentFor('A', 2);
const b = documentFor('B', 2.5);

test.beforeEach(async ({ page }) => {
  await page.clock.install();
  await page.goto('/tests/e2e/fixtures/renderer-port.html', { waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => Boolean(window.uiTest))).toBe(true);
  await page.evaluate(() => {
    window.presetReads = {};
    File.prototype.text = function () {
      return new Promise<string>((resolve, reject) => { window.presetReads[this.name] = { resolve, reject }; });
    };
    window.toastChanges = [];
    new MutationObserver(() => window.toastChanges.push(document.querySelector('#toast')!.textContent!))
      .observe(document.querySelector('#toast')!, { childList: true, attributes: true, subtree: true });
    window.uiTest.port.calls.length = 0;
  });
});

async function select(page: Page, name: string, size = 2) {
  await page.locator('#preset-file').setInputFiles({ name, mimeType: 'application/json', buffer: Buffer.alloc(size, ' ') });
  if (size <= 1_000_000) await expect.poll(() => page.evaluate(n => Boolean(window.presetReads[n]), name)).toBe(true);
}

async function finish(page: Page, name: string, value: PresetDocument | 'reject') {
  await page.evaluate(async ({ name, value }) => {
    const read = window.presetReads[name]!;
    if (value === 'reject') read.reject(new Error('stale read failure'));
    else read.resolve(JSON.stringify(value));
    // Drain the async handler and MutationObserver without wall-clock scheduling.
    await Promise.resolve();
    await Promise.resolve();
  }, { name, value });
}

async function exported(page: Page): Promise<PresetDocument> {
  const pending = page.waitForEvent('download');
  await page.locator('#export-preset').click();
  const download = await pending;
  return JSON.parse(await readFile((await download.path())!, 'utf8')) as PresetDocument;
}

async function applied(page: Page) {
  return page.evaluate(() => window.uiTest.port.calls.filter(c => c.type === 'applyConfig').map(c => c.config));
}

test('latest import intent wins when B completes before A', async ({ page }) => {
  await select(page, 'A.json');
  await select(page, 'B.json');
  await finish(page, 'B.json', b);
  await expect(page.locator('#toast')).toHaveText('Đã nhập preset hợp lệ.');
  const notifications = await page.evaluate(() => [...window.toastChanges]);
  await finish(page, 'A.json', a);
  expect(await applied(page)).toEqual([b.config]);
  expect(await page.evaluate(() => window.toastChanges)).toEqual(notifications);
  expect(await exported(page)).toEqual(b);
});

test('restore defaults invalidates a pending import', async ({ page }) => {
  await select(page, 'A.json');
  await page.locator('#restore-defaults').click();
  const notifications = await page.evaluate(() => [...window.toastChanges]);
  await finish(page, 'A.json', a);
  expect(await applied(page)).toEqual([DEFAULT_CONFIG]);
  await expect(page.locator('#toast')).toHaveText('Đã khôi phục cấu hình mặc định.');
  expect(await page.evaluate(() => window.toastChanges)).toEqual(notifications);
  expect(await exported(page)).toEqual({ schemaVersion: 2, app: '3D-WEB-05', config: DEFAULT_CONFIG });
});

test('newer invalid schema owns feedback and suppresses older success', async ({ page }) => {
  await select(page, 'A.json');
  await select(page, 'B.json');
  await finish(page, 'B.json', { ...b, config: { ...b.config, mode: 'invalid' } } as unknown as PresetDocument);
  await expect(page.locator('#toast')).toHaveText('Simulation mode không hợp lệ.');
  const notifications = await page.evaluate(() => [...window.toastChanges]);
  await finish(page, 'A.json', a);
  expect(await applied(page)).toEqual([]);
  expect(await page.evaluate(() => window.toastChanges)).toEqual(notifications);
  expect(await exported(page)).toEqual({ schemaVersion: 2, app: '3D-WEB-05', config: DEFAULT_CONFIG });
});

for (const outcome of ['resolve', 'reject'] as const) {
  test(`unmount suppresses pending ${outcome} and all later side effects`, async ({ page }) => {
    await select(page, 'A.json');
    expect(await exported(page)).toEqual({ schemaVersion: 2, app: '3D-WEB-05', config: DEFAULT_CONFIG });
    await page.evaluate(() => window.uiTest.unmount());
    const before = await page.evaluate(() => ({ calls: [...window.uiTest.port.calls], toasts: [...window.toastChanges] }));
    await finish(page, 'A.json', outcome === 'reject' ? 'reject' : a);
    expect(await page.evaluate(() => ({ calls: window.uiTest.port.calls, toasts: window.toastChanges }))).toEqual(before);
    await expect(page.locator('#speed')).toHaveValue(String(DEFAULT_CONFIG.simulation.speed));
  });
}

test('selection cleanup is synchronous and the same file can be selected again', async ({ page }) => {
  await select(page, 'A.json');
  await expect(page.locator('#preset-file')).toHaveValue('');
  await select(page, 'B.json');
  await expect(page.locator('#preset-file')).toHaveValue('');
  await finish(page, 'A.json', 'reject');
  await expect(page.locator('#preset-file')).toHaveValue('');
  expect(await page.evaluate(() => window.toastChanges)).toEqual([]);
  await finish(page, 'B.json', b);
  await select(page, 'B.json');
  await finish(page, 'B.json', b);
  expect(await applied(page)).toEqual([b.config, b.config]);
  expect(await exported(page)).toEqual(b);
});

test('newer oversized selection invalidates an older read without reading the large file', async ({ page }) => {
  await select(page, 'A.json');
  await select(page, 'large.json', 1_000_001);
  await expect(page.locator('#toast')).toHaveText('Tệp preset vượt quá giới hạn 1 MB.');
  expect(await page.evaluate(() => window.presetReads['large.json'])).toBeUndefined();
  const notifications = await page.evaluate(() => [...window.toastChanges]);
  await finish(page, 'A.json', 'reject');
  expect(await applied(page)).toEqual([]);
  expect(await page.evaluate(() => window.toastChanges)).toEqual(notifications);
  expect(await exported(page)).toEqual({ schemaVersion: 2, app: '3D-WEB-05', config: DEFAULT_CONFIG });
});

for (const edit of ['speed', 'particle-size', 'strength', 'particle-count', 'particle-color', 'mode', 'backend']) {
  test(`deliberate ${edit} edit invalidates a pending import`, async ({ page }) => {
    await select(page, 'A.json');
    if (edit === 'mode') await page.locator('#mode-vortex').click();
    else if (edit === 'backend') await page.locator('#backend').selectOption('webgl2');
    else await page.locator(`#${edit}`).fill(edit === 'particle-count' ? '32000' : edit === 'particle-color' ? '#ff8800' : '3');
    const expected = await exported(page);
    const calls = await applied(page);
    const notifications = await page.evaluate(() => [...window.toastChanges]);
    await finish(page, 'A.json', a);
    expect(await applied(page)).toEqual(calls);
    expect(await page.evaluate(() => window.toastChanges)).toEqual(notifications);
    expect(await exported(page)).toEqual(expected);
  });
}

test('pause and simulation reset retain pending import intent', async ({ page }) => {
  await select(page, 'A.json');
  await page.locator('#toggle-preview').click();
  await page.locator('#reset-preview').click();
  await finish(page, 'A.json', a);
  expect(await applied(page)).toEqual([a.config]);
  expect(await exported(page)).toEqual(a);
});

test('1 MB boundary imports normally; renderer failure retains config and metadata', async ({ page }) => {
  await select(page, 'boundary.json', 1_000_000);
  await finish(page, 'boundary.json', a);
  expect(await applied(page)).toEqual([a.config]);
  expect(await exported(page)).toEqual(a);
  await page.evaluate(() => {
    window.uiTest.port.calls.length = 0;
    window.uiTest.port.applyConfig = () => { throw new Error('private renderer failure'); };
  });
  await select(page, 'B.json');
  await finish(page, 'B.json', b);
  await expect(page.locator('#toast')).toContainText('Không thể áp dụng cấu hình');
  await expect(page.locator('#toast')).not.toContainText('private');
  expect(await applied(page)).toEqual([]);
  expect(await page.evaluate(() => window.uiTest.port.calls.filter(c => c.type === 'reset'))).toEqual([]);
  expect(await exported(page)).toEqual(a);
});

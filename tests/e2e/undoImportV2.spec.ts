import { test, expect } from './vt121Transport.ts';
import { cloneConfig, DEFAULT_CONFIG } from '../../src/presets/preset.ts';
import { readFile } from 'node:fs/promises';
const fixture = '/tests/e2e/fixtures/renderer-port.html';
const documentA = () => ({ schemaVersion: 2, app: '3D-WEB-05', name: 'After import', config: {
  ...cloneConfig(DEFAULT_CONFIG), mode: 'vortex', backendPreference: 'webgl2',
  simulation: { ...DEFAULT_CONFIG.simulation, particleCount: 32000, speed: 2.2, particleSize: 4 },
  rendering: { ...DEFAULT_CONFIG.rendering, backgroundColor: '#123456', particleColor: '#ff8800', opacity: .7 },
  camera: { enabled: false, autoRotate: true, distance: 45 },
} });
async function exported(page: import('@playwright/test').Page) {
  const wait = page.waitForEvent('download'); await page.locator('#export-preset').click();
  const file = await wait; return JSON.parse(await readFile((await file.path())!, 'utf8'));
}
test('VT121-V2-E1 import and Undo restore complete nested document and port config once', async ({ page }) => {
  await page.goto(fixture);
  await page.locator('#speed').fill('1.8');
  const before = await exported(page);
  const after = documentA();
  await page.locator('#preset-file').setInputFiles({ name: 'v2.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(after)) });
  await expect(page.locator('#mode-vortex')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#particle-count')).toHaveValue('32000');
  expect(await exported(page)).toEqual(after);
  const undo = page.getByRole('button', { name: 'Undo import', exact: true });
  await expect(undo).toBeEnabled({ timeout: 3000 });
  await undo.click();
  expect(await exported(page)).toEqual(before);
  await expect(page.locator('#speed')).toHaveValue('1.8');
  expect(await page.evaluate(() => window.uiTest.port.calls.filter(c => c.type === 'applyConfig').at(-1))).toMatchObject({config: before.config});
  await expect(undo).toBeDisabled();
});

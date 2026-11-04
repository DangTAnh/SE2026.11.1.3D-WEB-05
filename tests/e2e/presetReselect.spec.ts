import { test, expect } from '@playwright/test';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cloneConfig, DEFAULT_CONFIG, parsePresetDocument } from '../../src/presets/preset.ts';

for (const action of ['manual', 'defaults', 'backend', 'apply-backend', 'undo'] as const) {
  test(`same native file can be selected after pending read cancelled by ${action}`, async ({ page }) => {
    const directory = await mkdtemp(join(tmpdir(), 'preset-reselect-'));
    const path = join(directory, 'preset.json');
    const config = cloneConfig(DEFAULT_CONFIG);
    config.simulation.speed = 2.2;
    await writeFile(path, JSON.stringify({ schemaVersion: 2, app: '3D-WEB-05', config }));
    await page.goto(action === 'apply-backend'
      ? '/tests/e2e/fixtures/backend-session.html' : '/tests/e2e/fixtures/renderer-port.html');
    const input = page.locator('#preset-file');
    if (action === 'undo') {
      await input.setInputFiles(path);
      await expect(page.locator('#undo-import')).toBeEnabled();
    }
    await page.evaluate(() => {
      const original = File.prototype.text;
      let first = true;
      File.prototype.text = function () {
        if (!first) return original.call(this);
        first = false;
        return new Promise<string>(resolve => {
          (window as unknown as { finishPresetRead: () => Promise<void> }).finishPresetRead =
            async () => resolve(await original.call(this));
        });
      };
    });
    await input.setInputFiles(path);
    await expect.poll(() => page.evaluate(() => typeof (window as unknown as { finishPresetRead?: unknown }).finishPresetRead)).toBe('function');
    if (action === 'manual') await page.locator('#speed').fill('1.8');
    if (action === 'defaults') await page.locator('#restore-defaults').click();
    if (action === 'backend') await page.locator('#backend').selectOption('webgl2');
    if (action === 'apply-backend') await page.locator('#apply-backend').click();
    if (action === 'undo') await page.locator('#undo-import').click();
    // A native input must be empty even while the cancelled read remains pending.
    await expect(input).toHaveValue('');
    await input.setInputFiles(path);
    await expect(page.locator('#speed')).toHaveValue('2.2');
    await page.evaluate(async () => {
      await (window as unknown as { finishPresetRead: () => Promise<void> }).finishPresetRead();
      await Promise.resolve();
    });
    await expect(page.locator('#speed')).toHaveValue('2.2');
    await expect(page.locator('#undo-import')).toBeEnabled();
  });
}

test('native range sanitization keeps supported live numeric edits schema-valid', async ({ page }) => {
  await page.goto('/tests/e2e/fixtures/renderer-port.html');
  for (const id of ['speed', 'particle-size', 'particle-count', 'strength']) {
    for (const value of ['NaN', 'Infinity', '-Infinity', '', '-99999', '999999999', '1.0001']) {
      await page.locator(`#${id}`).evaluate((node: HTMLInputElement, value) => {
        node.value = value;
        node.dispatchEvent(new Event('input', { bubbles: true }));
        node.dispatchEvent(new Event('change', { bubbles: true }));
      }, value);
      const call = await page.evaluate(() => window.uiTest.port.calls.filter(c => c.type === 'applyConfig').at(-1));
      expect(call?.type).toBe('applyConfig');
      if (call?.type !== 'applyConfig') throw new Error('Missing applied config');
      expect(() => parsePresetDocument(JSON.stringify({ schemaVersion: 2, app: '3D-WEB-05', config: call.config }))).not.toThrow();
    }
  }
});

for (const completion of ['success', 'rejection', 'dispose'] as const) {
  test(`older ${completion} cannot clear or apply a newer pending selection`, async ({ page }) => {
    await page.goto('/tests/e2e/fixtures/renderer-port.html');
    await page.evaluate(() => {
      const original = File.prototype.text;
      File.prototype.text = function () {
        return new Promise<string>((resolve, reject) => {
          const finish = async () => this.name === 'reject.json'
            ? reject(new Error('obsolete read failed')) : resolve(await original.call(this));
          if (this.name === 'latest.json') window.uiTest.finishImport = finish;
          else (window as unknown as { finishOld: () => Promise<void> }).finishOld = finish;
        });
      };
    });
    const input = page.locator('#preset-file');
    const config = cloneConfig(DEFAULT_CONFIG);
    const file = (name: string, speed: number) => ({ name, mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({ schemaVersion: 2, app: '3D-WEB-05', config: {
        ...config, simulation: { ...config.simulation, speed },
      } })) });
    await input.setInputFiles(file(completion === 'rejection' ? 'reject.json' : 'old.json', 2.2));
    await input.setInputFiles(file('latest.json', 1.8));
    await expect(input).toHaveValue('');
    if (completion === 'dispose') await page.evaluate(() => window.uiTest.unmount());
    await page.evaluate(async () => {
      await (window as unknown as { finishOld: () => Promise<void> }).finishOld();
      await Promise.resolve();
    });
    await expect(input).toHaveValue('');
    await expect(page.locator('#speed')).toHaveValue('1.2');
    await page.evaluate(async () => { await window.uiTest.finishImport!(); await Promise.resolve(); });
    await expect(page.locator('#speed')).toHaveValue(completion === 'dispose' ? '1.2' : '1.8');
    await expect(page.locator('#toast')).not.toContainText('obsolete read failed');
  });
}

import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import type { PresetDocument } from '../../src/presets/preset.ts';

async function tabTo(page: Page, id: string) {
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press('Tab');
    if (await page.locator(`#${id}`).evaluate(el => el === document.activeElement)) return;
  }
  throw new Error(`Tab did not reach ${id}`);
}

const ranges = [
  { id: 'particle-count', output: 'particle-count-value', min: 1000, max: 500000, step: 1, field: 'particleCount' },
  { id: 'speed', output: 'speed-value', min: 0.1, max: 3, step: 0.001, field: 'speed' },
  { id: 'particle-size', output: 'particle-size-value', min: 1, max: 8, step: 0.001, field: 'particleSize' },
  { id: 'strength', output: 'strength-value', min: 0.2, max: 4, step: 0.001, field: 'attractorStrength' },
] as const;

for (const width of [1440, 320, 390, 500]) {
  test(`range keyboard focus and values remain visible at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/tests/e2e/fixtures/renderer-port.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#actual-backend')).toHaveText('WebGPU');
    for (const range of ranges) {
      const input = page.locator(`#${range.id}`);
      await tabTo(page, range.id);
      await expect(input).toBeFocused();
      expect(await input.evaluate(el => el.matches(':focus-visible'))).toBe(true);
      const geometry = await input.evaluate(el => {
        const style = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        const extent = parseFloat(style.outlineWidth) + parseFloat(style.outlineOffset);
        const bounds = { left: rect.left - extent, right: rect.right + extent,
          top: rect.top - extent, bottom: rect.bottom + extent };
        const clippedBy: string[] = [];
        for (let parent = el.parentElement; parent; parent = parent.parentElement) {
          const css = getComputedStyle(parent);
          const box = parent.getBoundingClientRect();
          if (/(auto|scroll|hidden|clip)/.test(css.overflowX) && (bounds.left < box.left || bounds.right > box.right)) clippedBy.push(parent.className);
          if (/(auto|scroll|hidden|clip)/.test(css.overflowY) && (bounds.top < box.top || bounds.bottom > box.bottom)) clippedBy.push(parent.className);
        }
        return { outline: style.outlineStyle, width: parseFloat(style.outlineWidth), color: style.outlineColor,
          background: getComputedStyle(el.closest('.settings')!).backgroundColor, bounds, clippedBy,
          viewport: { width: innerWidth, height: innerHeight } };
      });
      expect(geometry.outline).toBe('solid');
      expect(geometry.width).toBeGreaterThanOrEqual(2);
      expect(geometry.color).toBe('rgb(116, 229, 244)');
      expect(geometry.color).not.toBe(geometry.background);
      expect(geometry.clippedBy).toEqual([]);
      expect(geometry.bounds.left).toBeGreaterThanOrEqual(0);
      expect(geometry.bounds.right).toBeLessThanOrEqual(geometry.viewport.width);
      expect(geometry.bounds.top).toBeGreaterThanOrEqual(0);
      expect(geometry.bounds.bottom).toBeLessThanOrEqual(geometry.viewport.height);
      // Include panel padding around the outline in the visual evidence.
      const focused = await page.screenshot();
      await input.evaluate(el => el.blur());
      expect(await input.evaluate(el => getComputedStyle(el).outlineStyle)).toBe('none');
      const blurred = await page.screenshot();
      expect(focused.equals(blurred)).toBe(false);
      if (range.id === 'particle-count' && testInfo.project.name === 'desktop-chromium' && (width === 1440 || width === 320)) {
        await testInfo.attach(`focus-${width}`, { body: focused, contentType: 'image/png' });
        await testInfo.attach(`blur-${width}`, { body: blurred, contentType: 'image/png' });
      }
      // Return via real keyboard modality after the deliberate blur comparison.
      await page.keyboard.press('Shift+Tab');
      await tabTo(page, range.id);
      await page.keyboard.press('Home');
      await expect(input).toHaveValue(String(range.min));
      await page.keyboard.press('ArrowRight');
      const next = Number((range.min + range.step).toFixed(3));
      await expect(input).toHaveValue(String(next));
      await expect(page.locator(`#${range.output}`)).toContainText(new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 }).format(next));
      await page.keyboard.press('ArrowLeft');
      await expect(input).toHaveValue(String(range.min));
      await page.keyboard.press('End');
      await expect(input).toHaveValue(String(range.max));
      await expect(page.locator(`#${range.output}`)).toContainText(new Intl.NumberFormat('vi-VN').format(range.max));
      expect(await input.getAttribute('min')).toBe(String(range.min));
      expect(await input.getAttribute('max')).toBe(String(range.max));
      expect(await input.getAttribute('step')).toBe(String(range.step));
      await input.evaluate(el => el.blur());
      await input.click();
      expect(await input.evaluate(el => el.matches(':focus-visible'))).toBe(false);
      expect(await input.evaluate(el => getComputedStyle(el).outlineStyle)).toBe('none');
      await page.keyboard.press('End');
    }
    const pending = page.waitForEvent('download');
    await page.locator('#export-preset').click();
    const exported = JSON.parse(await readFile((await (await pending).path())!, 'utf8')) as PresetDocument;
    expect(exported.config.simulation).toMatchObject({ particleCount: 500000, speed: 3, particleSize: 8 });
    expect(exported.config.modes.attractor.attractorStrength).toBe(4);
    const configs = await page.evaluate(() => window.uiTest.port.calls.filter(c => c.type === 'applyConfig').map(c => c.config));
    expect(configs.at(-1)).toEqual(exported.config);
    await page.evaluate(() => window.uiTest.setStatus({ actual: 'unavailable', running: false }));
    for (const range of ranges) await expect(page.locator(`#${range.id}`)).toBeDisabled();
  });
}

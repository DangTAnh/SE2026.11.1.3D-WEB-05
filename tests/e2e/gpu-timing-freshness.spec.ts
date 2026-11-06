import { expect, test } from '@playwright/test';
import { PROBE_PAGE } from './support/capabilities';

interface TimestampReadbackBuffer {
  readonly label: string;
  mapAsync(mode: number, offset?: number, size?: number): Promise<void>;
}
declare global {
  interface Window {
    failComputeTiming?: boolean;
    GPUBuffer?: { prototype: TimestampReadbackBuffer };
  }
}

for (const backend of ['webgpu', 'webgl2'] as const) {
  test(`${backend} timing becomes unavailable after a real query read error and recovers`, async ({ page }) => {
    test.setTimeout(90_000);
    const pageErrors: string[] = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.addInitScript(() => {
      const state = window;
      state.failComputeTiming = false;
      const getQueryParameter = WebGL2RenderingContext.prototype.getQueryParameter;
      WebGL2RenderingContext.prototype.getQueryParameter = function (query, pname) {
        if (state.failComputeTiming) throw new Error('Injected timer query read error');
        return getQueryParameter.call(this, query, pname);
      };
      if (state.GPUBuffer !== undefined) {
        const mapAsync = state.GPUBuffer.prototype.mapAsync;
        state.GPUBuffer.prototype.mapAsync = function (mode, offset, size) {
          if (state.failComputeTiming && this.label === 'buffer_timestamp_result_compute') {
            return Promise.reject(new Error('Injected compute timestamp map error'));
          }
          return mapAsync.call(this, mode, offset, size);
        };
      }
    });

    await page.goto(PROBE_PAGE);
    const supported = await page.evaluate(async requested => {
      if (requested === 'webgl2') {
        return Boolean(document.createElement('canvas').getContext('webgl2')
          ?.getExtension('EXT_disjoint_timer_query_webgl2'));
      }
      const gpu = (navigator as Navigator & { gpu?: {
        requestAdapter(): Promise<{ features: { has(name: string): boolean } } | null>;
      } }).gpu;
      return Boolean((await gpu?.requestAdapter())?.features.has('timestamp-query'));
    }, backend);
    test.skip(!supported, `${backend} timestamp queries are unavailable in this browser context`);

    await page.goto(backend === 'webgl2' ? '/?webgl=1' : '/');
    const actual = backend === 'webgpu' ? 'WebGPU' : 'WebGL2';
    await expect(page.locator('#actual-backend')).toHaveText(actual, { timeout: 60_000 });
    const timing = page.locator('#gpu-timing');
    await expect(timing).not.toHaveText('Không khả dụng', { timeout: 20_000 });

    // Keep the real renderer/query pools; only inject the readback API failure.
    await page.evaluate(() => { window.failComputeTiming = true; });
    await expect(timing).toHaveText('Không khả dụng', { timeout: 10_000 });
    await expect(page.locator('#actual-backend')).toHaveText(actual);
    await expect(page.locator('#runtime-fps')).not.toHaveText('Không khả dụng');

    await page.evaluate(() => { window.failComputeTiming = false; });
    await expect(timing).not.toHaveText('Không khả dụng', { timeout: 20_000 });
    await expect(page.locator('#actual-backend')).toHaveText(actual);
    expect(pageErrors).toEqual([]);
  });
}

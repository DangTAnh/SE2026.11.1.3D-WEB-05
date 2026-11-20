import type { Page } from '@playwright/test';

/** Same-origin page with no renderer, so probing cannot start the lab. */
export const PROBE_PAGE = '/tests/e2e/fixtures/capability-probe.html';

/**
 * Probes the application origin, not `about:blank`: WebGPU is origin-gated and
 * a secure localhost fixture can expose an adapter that `about:blank` does not.
 * `navigator.gpu` alone is not proof — an adapter must actually resolve.
 */
export async function probeCapabilities(page: Page) {
  await page.goto(PROBE_PAGE);
  return page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    const webgl2 = canvas.getContext('webgl2') !== null;
    const gpu = (
      navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown | null> } }
    ).gpu;
    let webgpu = false;
    if (gpu) {
      try {
        webgpu = (await gpu.requestAdapter()) !== null;
      } catch {
        webgpu = false;
      }
    }
    return { webgl2, webgpu };
  });
}

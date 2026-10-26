/**
 * #50 — GPU readback parity against the CPU reference.
 *
 * The fixture runs the real shared kernels through WebGPURenderer (WebGL2, and
 * WebGPU when the browser exposes an adapter), reads the buffers back and
 * compares them with `step()` from the same initial GPU state. A missing
 * backend produces a recorded skip, not a pass.
 */
import { expect, test } from '@playwright/test';
import type { ParityOptions, ParityResult } from './fixtures/simulation-parity.ts';

const CASES: ParityOptions[] = [
  // Pure step: tight tolerance (observed delta is float32 rounding only).
  { backend: 'webgl2', mode: 'attractor', steps: 60, lifetime: 100 },
  { backend: 'webgl2', mode: 'vortex', steps: 60, lifetime: 100, vortexDamping: 0.97 },
  // Respawn: GPU trig on the spawn sphere is coarser than JS, so the position
  // tolerance is 2e-3 for these cases only (documented in docs/04-testing).
  { backend: 'webgl2', mode: 'attractor', steps: 40, lifetime: 0.25, tolerance: { position: 2e-3, velocity: 1e-4 } },
  { backend: 'webgl2', mode: 'vortex', steps: 40, lifetime: 0.25, vortexDamping: 0.97, tolerance: { position: 2e-3, velocity: 1e-4 } },
  // Zero delta must leave positions, velocities and ages untouched on the GPU.
  { backend: 'webgl2', mode: 'attractor', steps: 5, dt: 0, lifetime: 0.25, tolerance: { position: 0, velocity: 0, age: 0 } },
  // WebGPU is reported as a skip when the adapter is unavailable.
  { backend: 'webgpu', mode: 'attractor', steps: 40, lifetime: 0.25, tolerance: { position: 2e-3, velocity: 1e-4 } },
  { backend: 'webgpu', mode: 'vortex', steps: 40, lifetime: 0.25, vortexDamping: 0.97, tolerance: { position: 2e-3, velocity: 1e-4 } },
];

const describeCase = (options: ParityOptions): string =>
  `${options.backend}/${options.mode} steps=${options.steps ?? 40} dt=${options.dt ?? 1 / 60} lifetime=${options.lifetime ?? 0.25}`;

test('GPU kernels match the CPU reference through readback', async ({ page, isMobile }) => {
  test.skip(isMobile, 'GPU kernel parity runs once on desktop Chromium');
  test.setTimeout(180_000);

  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/tests/e2e/fixtures/simulation-parity.html');

  const results = await page.evaluate(async (cases: ParityOptions[]) => {
    const out: ParityResult[] = [];
    for (const options of cases) {
      out.push(await window.parityTest.run(options));
    }
    return out;
  }, CASES);

  await test.info().attach('gpu-kernel-parity.json', {
    body: JSON.stringify(results, null, 2),
    contentType: 'application/json',
  });

  const failed = results.filter((result) => result.status === 'failed');
  expect(failed, failed.map((result) => `${describeCase(result)}: ${result.reason}`).join('\n')).toEqual([]);

  const passed = results.filter((result) => result.status === 'passed');
  const skipped = results.filter((result) => result.status === 'skipped');

  if (passed.length === 0) {
    test.skip(true, `No requested backend could run: ${skipped.map((result) => result.reason).join('; ')}`);
  }

  // WebGL2 Chromium is the required backend; every WebGL2 case must pass.
  const webgl2Cases = results.filter((result) => result.backend === 'webgl2');
  expect(webgl2Cases.every((result) => result.status === 'passed'), JSON.stringify(results, null, 2)).toBe(true);

  // WebGPU either passes or carries an explicit adapter/device reason.
  for (const result of results.filter((entry) => entry.backend === 'webgpu')) {
    expect(['passed', 'skipped'], JSON.stringify(result)).toContain(result.status);
    if (result.status === 'skipped') expect(result.reason).toBeTruthy();
  }

  // Headless Chromium has no WebGPU adapter; the fixture reports that as a skip.
  // Any other page error is a failure.
  const unexpectedErrors = pageErrors.filter((message) => !message.includes('Unable to create WebGPU adapter'));
  expect(unexpectedErrors).toEqual([]);
});

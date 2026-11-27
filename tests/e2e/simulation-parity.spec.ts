/**
 * #50 — GPU readback parity against the CPU reference.
 *
 * The fixture runs the real shared kernels through WebGPURenderer (WebGL2, and
 * WebGPU when the browser exposes an adapter), reads the buffers back and
 * compares them with `step()` from the same initial GPU state after N steps.
 * A missing backend produces a recorded skip, not a pass. Empty, truncated or
 * non-finite readbacks fail; they are never treated as zero delta.
 *
 * Reporting: each `test()` is one Playwright test. The per-case pass/skip
 * status is inside the attached `gpu-kernel-parity.json`, not a Playwright
 * skip for the WebGPU subcases.
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

  // #96 — non-unit speed. Both sides use `clampedDt * speed` exactly once;
  // 0.1 and 3 are the preset-schema v2 boundaries.
  { backend: 'webgl2', mode: 'attractor', steps: 60, lifetime: 100, speed: 0.1 },
  { backend: 'webgl2', mode: 'vortex', steps: 60, lifetime: 100, speed: 3, vortexDamping: 0.97 },
  // Speed 3 also drives respawn/age: effective delta is 0.05 per step.
  {
    backend: 'webgl2', mode: 'attractor', steps: 40, lifetime: 0.25, speed: 3,
    tolerance: { position: 2e-3, velocity: 1e-4 },
  },
  // Raw dt above the adapter clamp: both sides must use 0.05 * 3 = 0.15 once.
  { backend: 'webgl2', mode: 'attractor', steps: 20, lifetime: 100, dt: 0.1, speed: 3 },

  // #96 — attractor damping is conditional on `distance > radius`. The primed
  // state is uniform and starts deliberately outside or inside the radius.
  // Outside: damping 0.8 must change the CPU result versus identity damping.
  {
    backend: 'webgl2', mode: 'attractor', steps: 30, lifetime: 100,
    spawnRadius: 12, attractorRadius: 6, attractorDamping: 0.8,
    prime: { position: [10, 0, 0], velocity: [0, 0, 1] },
    expectDamping: 'changes-result',
  },
  // Inside: the same damping must be a bit-identical no-op.
  {
    backend: 'webgl2', mode: 'attractor', steps: 30, lifetime: 100,
    spawnRadius: 12, attractorRadius: 6, attractorDamping: 0.8,
    prime: { position: [1, 0, 0], velocity: [0, 0, 1] },
    expectDamping: 'no-effect',
  },
  // Radius boundary 0.5 with damping 0.8, starting outside.
  {
    backend: 'webgl2', mode: 'attractor', steps: 30, lifetime: 100,
    spawnRadius: 12, attractorRadius: 0.5, attractorDamping: 0.8,
    prime: { position: [10, 0, 0], velocity: [0, 0, 1] },
    expectDamping: 'changes-result',
  },
  // Radius boundary 50: position 10 is outside the default radius 6 but inside
  // 50, so damping must follow the configured radius, not a hardcoded default.
  {
    backend: 'webgl2', mode: 'attractor', steps: 30, lifetime: 100,
    spawnRadius: 12, attractorRadius: 50, attractorDamping: 0.8,
    prime: { position: [10, 0, 0], velocity: [0, 0, 1] },
    expectDamping: 'no-effect',
  },
  // Damping boundary 1 is identity but still flows through the radius branch.
  // A kernel that kept the default 0.98 would diverge from the CPU reference.
  {
    backend: 'webgl2', mode: 'attractor', steps: 30, lifetime: 100,
    spawnRadius: 12, attractorRadius: 6, attractorDamping: 1,
    prime: { position: [10, 0, 0], velocity: [0, 0, 1] },
  },

  // Zero delta must be a strict no-op. Priming makes the case non-vacuous:
  // nonzero velocity, an expired particle, and an attractor particle outside
  // the configured damping radius; a missing guard would change one of them.
  // Non-unit speed must not bypass the guard because delta stays 0.
  {
    backend: 'webgl2',
    mode: 'attractor',
    steps: 5,
    dt: 0,
    lifetime: 0.25,
    spawnRadius: 12,
    attractorRadius: 6,
    speed: 3,
    prime: { age: 1, position: [10, 0, 0], velocity: [1.5, -0.5, 0.25] },
    tolerance: { position: 0, velocity: 0, age: 0 },
  },
  {
    backend: 'webgl2',
    mode: 'vortex',
    steps: 5,
    dt: 0,
    lifetime: 0.25,
    speed: 0.1,
    prime: { age: 1, velocity: [1.5, -0.5, 0.25] },
    tolerance: { position: 0, velocity: 0, age: 0 },
  },
  // WebGPU is reported as a skip when the adapter is unavailable.
  { backend: 'webgpu', mode: 'attractor', steps: 40, lifetime: 0.25, tolerance: { position: 2e-3, velocity: 1e-4 } },
  { backend: 'webgpu', mode: 'vortex', steps: 40, lifetime: 0.25, vortexDamping: 0.97, tolerance: { position: 2e-3, velocity: 1e-4 } },
];

const describeCase = (options: ParityResult): string =>
  `${options.backend}/${options.mode} steps=${options.steps ?? 40} dt=${options.dt ?? 1 / 60}`
  + ` speed=${options.speed ?? 1} radius=${options.attractorRadius ?? 6}`
  + ` damping=${options.attractorDamping ?? 0.98} lifetime=${options.lifetime ?? 0.25}`;

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

  // #96: the damping case matrix must be recorded and non-vacuous.
  const dampingCases = results.filter((result) => result.expectDamping !== null);
  expect(dampingCases.length).toBeGreaterThan(0);
  for (const result of dampingCases) {
    expect(result.dampingControlDelta, JSON.stringify(result)).not.toBeNull();
    if (result.expectDamping === 'changes-result') {
      expect(result.dampingControlDelta!, JSON.stringify(result)).toBeGreaterThan(1e-5);
    } else {
      expect(result.dampingControlDelta, JSON.stringify(result)).toBe(0);
    }
  }
  // Speed and radius/damping values must survive into the artifact.
  for (const result of results.filter((entry) => entry.backend === 'webgl2')) {
    expect(result.speed).toBeGreaterThan(0);
    expect(result.attractorRadius).toBeGreaterThan(0);
    expect(result.attractorDamping).toBeGreaterThan(0);
    expect(result.effectiveDelta).toBeCloseTo(
      Math.min(0.05, Math.max(0, result.dt)) * result.speed,
      12,
    );
  }

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

const FAULT_CASES: ParityOptions[] = [
  { backend: 'webgl2', mode: 'attractor', count: 8, steps: 2, fault: 'empty' },
  { backend: 'webgl2', mode: 'attractor', count: 8, steps: 2, fault: 'truncated' },
  { backend: 'webgl2', mode: 'attractor', count: 8, steps: 2, fault: 'nan' },
];

test('corrupt GPU readback fails instead of claiming parity', async ({ page, isMobile }) => {
  test.skip(isMobile, 'GPU readback validation runs once on desktop Chromium');
  test.setTimeout(60_000);

  await page.goto('/tests/e2e/fixtures/simulation-parity.html');

  const results = await page.evaluate(async (cases: ParityOptions[]) => {
    const out: ParityResult[] = [];
    for (const options of cases) {
      out.push(await window.parityTest.run(options));
    }
    return out;
  }, FAULT_CASES);

  await test.info().attach('gpu-kernel-parity-faults.json', {
    body: JSON.stringify(results, null, 2),
    contentType: 'application/json',
  });

  for (const result of results) {
    expect(result.status, JSON.stringify(result)).toBe('failed');
    expect(result.reason).toMatch(/readback|non-finite|truncated|empty/i);
    expect(result.maxPositionDelta).toBeNull();
    expect(result.maxVelocityDelta).toBeNull();
    expect(result.maxAgeDelta).toBeNull();
  }
});

const INVALID_PARAMETER_CASES: ParityOptions[] = [
  { backend: 'webgl2', mode: 'attractor', attractorRadius: 0.49 },
  { backend: 'webgl2', mode: 'attractor', attractorRadius: 50.01 },
  { backend: 'webgl2', mode: 'attractor', attractorDamping: 0.79 },
  { backend: 'webgl2', mode: 'attractor', attractorDamping: 1.01 },
  { backend: 'webgl2', mode: 'attractor', speed: 0.09 },
  { backend: 'webgl2', mode: 'attractor', speed: 3.01 },
  { backend: 'webgl2', mode: 'attractor', speed: Number.NaN },
  { backend: 'webgl2', mode: 'vortex', expectDamping: 'no-effect' },
];

test('out-of-range parity parameters fail instead of running or skipping', async ({ page, isMobile }) => {
  test.skip(isMobile, 'GPU readback validation runs once on desktop Chromium');
  test.setTimeout(60_000);

  await page.goto('/tests/e2e/fixtures/simulation-parity.html');

  const results = await page.evaluate(async (cases: ParityOptions[]) => {
    const out: ParityResult[] = [];
    for (const options of cases) {
      out.push(await window.parityTest.run(options));
    }
    return out;
  }, INVALID_PARAMETER_CASES);

  await test.info().attach('gpu-kernel-parity-invalid-parameters.json', {
    body: JSON.stringify(results, null, 2),
    contentType: 'application/json',
  });

  for (const result of results) {
    expect(result.status, JSON.stringify(result)).toBe('failed');
    expect(result.reason).toMatch(/attractorRadius|attractorDamping|speed|expectDamping/);
    expect(result.maxPositionDelta).toBeNull();
  }
});

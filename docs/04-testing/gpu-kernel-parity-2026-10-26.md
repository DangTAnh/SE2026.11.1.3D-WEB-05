# GPU kernel readback parity — 2026-10-26 (#50)

**Scope:** execute the real shared TSL kernels through `WebGPURenderer`, read
`positions`/`velocities`/`ages`/`seeds` back from the GPU, and compare the state
after N steps with the CPU reference (`step()`) started from the same
GPU-initialized state. The first readback is validated before it is used; an
empty, truncated or non-finite buffer fails instead of producing a zero delta.

**Harness:** `tests/e2e/fixtures/simulation-parity.html` + `simulation-parity.ts`
**Test:** `tests/e2e/simulation-parity.spec.ts` (desktop Chromium)
**Command:** `npx playwright test tests/e2e/simulation-parity.spec.ts --project=desktop-chromium`

## Environment

| Item | Value |
|---|---|
| OS | Windows (local workstation) |
| Browser | Chromium 156.0.8078.4 (Playwright 1.64.0, headless) |
| WebGL2 | ANGLE / Vulkan 1.3 SwiftShader (software) |
| WebGPU | NOT_RUN — `THREE.WebGPUBackend: Unable to create WebGPU adapter.` |

This run proves real GPU execution and readback on WebGL2. SwiftShader is a
software rasterizer, so it is **not** evidence for physical-GPU performance or
for WebGPU. The WebGL2 fallback was exercised, not the WebGPU backend.

## Result

6/6 WebGL2 cases passed, 2/2 WebGPU cases skipped with an explicit adapter
reason. The fault-injection test produced 3/3 failures with a validation reason,
so a corrupt readback cannot be reported as parity.

**Reporting levels:** Playwright runs **two tests** in this file. The parity test
passes because every required WebGL2 subcase passes; the two WebGPU subcases are
`skipped` entries inside the attached `gpu-kernel-parity.json`, not Playwright
test skips. The second test covers fault injection and passes when all three
corrupt readbacks are rejected.

| Backend | Mode | Steps | dt | lifetime | spawnRadius | Tolerance (position / velocity / age) | Max position delta | Max velocity delta | Max age delta | Result |
|---|---|---|---:|---|---:|---:|---|---:|---:|---:|---|
| WebGL2 | attractor | 60 | 1/60 | 100 | 4 | 5e-5 / 5e-5 / 1e-5 | 2.38e-7 | 3.58e-7 | 0 | PASS |
| WebGL2 | vortex | 60 | 1/60 | 100 | 4 | 5e-5 / 5e-5 / 1e-5 | 4.77e-7 | 7.75e-7 | 0 | PASS |
| WebGL2 | attractor | 40 | 1/60 | 0.25 | 4 | 2e-3 / 1e-4 / 1e-5 | 7.01e-4 | 1.65e-5 | 0 | PASS |
| WebGL2 | vortex | 40 | 1/60 | 0.25 | 4 | 2e-3 / 1e-4 / 1e-5 | 7.01e-4 | 1.43e-5 | 0 | PASS |
| WebGL2 | attractor | 5 | 0 | 0.25 | 12 | 0 / 0 / 0 | 0 | 0 | 0 | PASS |
| WebGL2 | vortex | 5 | 0 | 0.25 | 4 | 0 / 0 / 0 | 0 | 0 | 0 | PASS |
| WebGPU | attractor | 40 | 1/60 | 0.25 | 4 | 2e-3 / 1e-4 / 1e-5 | — | — | — | SKIP (no adapter) |
| WebGPU | vortex | 40 | 1/60 | 0.25 | 4 | 2e-3 / 1e-4 / 1e-5 | — | — | — | SKIP (no adapter) |

### The zero-delta cases are not vacuous

A freshly initialized particle has zero velocity and a zero age, so a zero-delta
step would pass even if the `delta > 0` guard were deleted. The harness writes a
test-only prime state through a compute kernel (not a CPU buffer mutation) before
the zero-delta steps:

- every particle gets `velocity = (1.5, -0.5, 0.25)`;
- every particle gets `age = 1`, which is past `lifetime = 0.25`;
- the attractor case uses `spawnRadius = 12` with `radius = 6`, so particles are
  outside the damping radius.

The CPU copy gets the same values, and `assertNonVacuousZeroDelta()` rejects the
case if any of those conditions is missing. Deleting either the damping guard or
the respawn guard therefore changes the GPU state and fails the case.

### Readback validation and negative coverage

`parityValidation.ts` validates both the initial and final readback before
computing deltas:

- expected length is `count * 3` for positions/velocities and `count` for
  ages/seeds; storage-buffer padding is limited to the next 16-byte boundary;
- empty, truncated and over-long buffers are rejected;
- `NaN`/`Infinity` are rejected in float channels;
- both float channels must have equal lengths before `maxDelta` is computed;
- final seeds are read back and must equal the initial seeds.

The fault-injection test monkey-patches the renderer readback to return an empty
buffer, a truncated buffer and a `NaN` value. All three return `status: failed`
with a `ParityValidationError` reason and `max*Delta: null`. Unit tests for the
same functions are in `tests/unit/parity-validation.test.ts`.

### Why the respawn cases have a wider tolerance

Pure-step cases stay under 8e-7. The respawn cases re-enter the spawn sphere,
where the GPU computes `sin`/`cos`/`pow` on SwiftShader while the CPU uses JS
`Math.sin`/`Math.cos`/`Math.cbrt`. The measured worst case is 7.01e-4 in world
units with `spawnRadius = 4`; ages remain exact and velocities stay below 2e-5.
The wider tolerance is applied **only** to respawn cases and is not used to
hide a physics mismatch.

## What is and is not covered

- Covered: real compute execution, shared buffer layout, init kernel, both step
  kernels, damping path, lifetime respawn, a primed zero-delta no-op, immutable
  seeds, GPU→CPU readback and rejection of corrupt readbacks.
- Not covered: WebGPU execution (no adapter in this environment), physical-GPU
  performance, timestamp measurements, 500k-particle stress.

## Reproduce

```sh
npm ci
npx playwright install chromium
npm run dev -- --host 127.0.0.1 --port 4173   # or let Playwright start it
npx playwright test tests/e2e/simulation-parity.spec.ts --project=desktop-chromium
```

The parity and fault-injection JSON results are attached to the Playwright report
as `gpu-kernel-parity.json` and `gpu-kernel-parity-faults.json`.

## Full-suite evidence

- `npx playwright test --workers=1`: **42 passed, 4 skipped** (skips: 2 WebGPU
  renderer probes + the two mobile parity/validation tests).
- `CI=1` sets `workers: 1`; the repo already documents that software-GPU
  parallelism needs one worker. The default parallel run on this workstation
  hit pre-existing 30 s UI timeouts in `ui-port`/`ui-live-status`, also without
  the new parity spec, so it is not used as evidence here.

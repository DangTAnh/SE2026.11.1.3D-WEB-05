# GPU kernel readback parity — 2026-10-26 (#50)

**Scope:** execute the real shared TSL kernels through `WebGPURenderer`, read
`positions`/`velocities`/`ages` back from the GPU, and compare each step with the
CPU reference (`step()`) started from the same GPU-initialized state.

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

5/5 WebGL2 cases passed, 2/2 WebGPU cases skipped with an explicit adapter
reason. `npm run test:e2e` reports the WebGPU cases as skipped, not passed.

| Backend | Mode | Steps | dt | lifetime | Tolerance (position / velocity / age) | Max position delta | Max velocity delta | Max age delta | Result |
|---|---|---|---|---:|---|---:|---:|---:|---|
| WebGL2 | attractor | 60 | 1/60 | 100 | 5e-5 / 5e-5 / 1e-5 | 2.38e-7 | 3.58e-7 | 0 | PASS |
| WebGL2 | vortex | 60 | 1/60 | 100 | 5e-5 / 5e-5 / 1e-5 | 4.77e-7 | 7.75e-7 | 0 | PASS |
| WebGL2 | attractor | 40 | 1/60 | 0.25 | 2e-3 / 1e-4 / 1e-5 | 7.01e-4 | 1.65e-5 | 0 | PASS |
| WebGL2 | vortex | 40 | 1/60 | 0.25 | 2e-3 / 1e-4 / 1e-5 | 7.01e-4 | 1.40e-5 | 0 | PASS |
| WebGL2 | attractor | 5 | 0 | 0.25 | 0 / 0 / 0 | 0 | 0 | 0 | PASS |
| WebGPU | attractor | 40 | 1/60 | 0.25 | 2e-3 / 1e-4 / 1e-5 | — | — | — | SKIP (no adapter) |
| WebGPU | vortex | 40 | 1/60 | 0.25 | 2e-3 / 1e-4 / 1e-5 | — | — | — | SKIP (no adapter) |

### Why the respawn cases have a wider tolerance

Pure-step cases stay under 8e-7. The respawn cases re-enter the spawn sphere,
where the GPU computes `sin`/`cos`/`pow` on SwiftShader while the CPU uses JS
`Math.sin`/`Math.cos`/`Math.cbrt`. The measured worst case is 7.01e-4 in world
units with `spawnRadius = 4`; ages remain exact and velocities stay below 2e-5.
The wider tolerance is applied **only** to respawn cases and is not used to
hide a physics mismatch.

## What is and is not covered

- Covered: real compute execution, shared buffer layout, init kernel, both step
  kernels, damping path, lifetime respawn, zero-delta no-op, GPU→CPU readback.
- Not covered: WebGPU execution (no adapter in this environment), physical-GPU
  performance, timestamp measurements, 500k-particle stress.

## Reproduce

```sh
npm ci
npx playwright install chromium
npm run dev -- --host 127.0.0.1 --port 4173   # or let Playwright start it
npx playwright test tests/e2e/simulation-parity.spec.ts --project=desktop-chromium
```

The JSON result is attached to the Playwright report as
`gpu-kernel-parity.json`.

## Full-suite evidence

- `npx playwright test --workers=1`: **41 passed, 3 skipped** (skips: 2 WebGPU
  renderer probes + the mobile parity project).
- `CI=1` sets `workers: 1`; the repo already documents that software-GPU
  parallelism needs one worker. The default parallel run on this workstation
  hit pre-existing 30 s UI timeouts in `ui-port`/`ui-live-status`, also without
  the new parity spec, so it is not used as evidence here.

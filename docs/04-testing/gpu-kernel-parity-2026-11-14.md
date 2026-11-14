# GPU kernel parity — attractor damping and non-unit speed (2026-11-14, #96)

**Scope:** extend the #50 readback harness so the parity matrix explicitly covers
attractor radius/damping and non-unit speed. No physics, kernel or attribute
layout changed: the same shared kernels are executed through `WebGPURenderer`,
read back, and compared with the CPU reference (`step()`).

**Baseline:** `dev@3d1c4f6` (the Issue text named `e55405d`; `dev` moved after
#92, so the branch starts from the current remote `dev`).
**Harness:** `tests/e2e/fixtures/simulation-parity.ts`
**Test:** `tests/e2e/simulation-parity.spec.ts` (desktop Chromium)
**Command:** `npx playwright test tests/e2e/simulation-parity.spec.ts --project=desktop-chromium --workers=1`

## What changed

1. `ParityOptions` now exposes `attractorRadius`, `attractorDamping` and `speed`.
   They are validated before any GPU work against the preset-schema v2 ranges:
   radius `[0.5, 50]`, damping `[0.8, 1]`, speed `[0.1, 3]`. Out-of-range input
   returns `status: failed` with a parameter reason; it never becomes a backend
   skip.
2. The GPU uniform `radius`/`damping` is set from the case instead of the
   hardcoded defaults. `speed` reaches both sides once:
   - GPU: `uniforms.delta = clamp(rawDt, 0, MAX_FRAME_DELTA) * speed`;
   - CPU: `step(state, clampedDt, config)` performs its own single
     `dt * speed`.
   `MAX_FRAME_DELTA = 0.05` mirrors `src/simulations/rendererAdapter.ts`; the
   existing adapter unit test already asserts clamp-then-multiply-once.
3. `prime` can now write a deterministic position for every particle, so a
   damping case starts provably outside or inside the configured radius.
4. `expectDamping` adds a CPU control run from the same primed state with
   identity damping (`attractorDamping = 1`):
   - `changes-result`: damping `< 1` outside the radius must change the state by
     more than `1e-5`;
   - `no-effect`: damping `< 1` inside the radius must produce a bit-identical
     state.
   The artifact records `dampingControlDelta` for both.
5. `ParityResult` now retains every effective input (`count`, raw `dt`,
   `effectiveDelta`, `lifetime`, `spawnRadius`, `strength`, `speed`,
   `attractorRadius`, `attractorDamping`, `vortexDamping`, prime, tolerance) so
   any case can be reproduced from its JSON.

## Environment

| Item | Value |
|---|---|
| OS | Windows (local workstation) |
| Browser | Chromium 156.0.8078.4 (Playwright 1.64.0, headless) |
| WebGL2 | ANGLE / Vulkan 1.3 SwiftShader (software) |
| WebGPU | NOT_RUN — `THREE.WebGPUBackend: Unable to create WebGPU adapter.` |

This is real compute execution and GPU→CPU readback on WebGL2, but SwiftShader is
a software rasterizer. It is **not** evidence for a physical GPU, WebGPU
execution or performance.

## Result — 2026-11-14

15/15 WebGL2 cases passed; 2/2 WebGPU cases were skipped with the adapter reason.
The damping matrix is non-vacuous in both directions, and the zero-delta cases
remain exact no-ops.

| # | Mode | Steps | raw dt | effective delta | speed | radius | damping | Control | Max position | Max velocity | Max age | Result |
|---:|---|---:|---:|---:|---:|---:|---:|---|---:|---:|---:|---|
| 1 | attractor | 60 | 1/60 | 0.016667 | 1 | 6 | 0.98 | — | 2.38e-7 | 3.58e-7 | 0 | PASS |
| 2 | vortex | 60 | 1/60 | 0.016667 | 1 | 6 | 0.98 | — | 4.77e-7 | 7.75e-7 | 0 | PASS |
| 3 | attractor | 40 | 1/60 | 0.016667 | 1 | 6 | 0.98 | — | 7.01e-4 | 1.65e-5 | 0 | PASS (respawn tol) |
| 4 | vortex | 40 | 1/60 | 0.016667 | 1 | 6 | 0.98 | — | 7.01e-4 | 1.40e-5 | 0 | PASS (respawn tol) |
| 5 | attractor | 60 | 1/60 | 0.001667 | 0.1 | 6 | 0.98 | — | 3.73e-9 | 1.49e-8 | 0 | PASS |
| 6 | vortex | 60 | 1/60 | 0.05 | 3 | 6 | 0.98 | — | 2.70e-6 | 1.43e-6 | 0 | PASS |
| 7 | attractor | 40 | 1/60 | 0.05 | 3 | 6 | 0.98 | — | 7.01e-4 | 0 | 0 | PASS (respawn tol) |
| 8 | attractor | 20 | 0.1 | 0.15 | 3 | 6 | 0.98 | — | 1.43e-6 | 4.77e-7 | 0 | PASS (clamp) |
| 9 | attractor | 30 | 1/60 | 0.016667 | 1 | 6 | 0.8 | changes | 7.45e-9 | 1.49e-8 | 0 | PASS |
| 10 | attractor | 30 | 1/60 | 0.016667 | 1 | 6 | 0.8 | no-effect | 0 | 5.96e-8 | 0 | PASS |
| 11 | attractor | 30 | 1/60 | 0.016667 | 1 | 0.5 | 0.8 | changes | 7.45e-9 | 1.49e-8 | 0 | PASS |
| 12 | attractor | 30 | 1/60 | 0.016667 | 1 | 50 | 0.8 | no-effect | 0 | 1.19e-7 | 0 | PASS |
| 13 | attractor | 30 | 1/60 | 0.016667 | 1 | 6 | 1 | — | 0 | 1.19e-7 | 0 | PASS |
| 14 | attractor | 5 | 0 | 0 | 3 | 6 | 0.98 | — | 0 | 0 | 0 | PASS (zero delta) |
| 15 | vortex | 5 | 0 | 0 | 0.1 | 6 | 0.98 | — | 0 | 0 | 0 | PASS (zero delta) |
| 16 | attractor | 40 | 1/60 | 0.016667 | 1 | 6 | 0.98 | — | — | — | — | SKIP (no adapter) |
| 17 | vortex | 40 | 1/60 | 0.016667 | 1 | 6 | 0.98 | — | — | — | — | SKIP (no adapter) |

Cases 1–4 are the retained #50 matrix. Cases 5–8 cover speed `0.1`/`3`, speed-3
respawn/age, and a raw `dt = 0.1` that must be clamped to `0.05` before the
single ×3. Cases 9–13 cover damping polarity and the radius `0.5`/`50` and
damping `0.8`/`1` boundaries. Cases 14–15 retain the zero-delta no-op, now with
non-unit speed; delta is still 0, so the guard must hold.

### Why cases 9 and 11 prove damping changes the result

Both cases prime every particle at `[10, 0, 0]` with velocity `[0, 0, 1]`,
outside radius 6 and 0.5 respectively. The CPU control run starts from the same
primed state and only replaces `attractorDamping = 0.8` with `1`. The recorded
`dampingControlDelta` is **0.3488** for both cases, far above the `1e-5`
non-vacuity floor. A kernel or reference that skipped damping would therefore
not match the parity run, and the control run itself would be flagged vacuous.

### Why cases 10 and 12 prove damping is conditional

Both prime every particle at `[1, 0, 0]` and `[10, 0, 0]` respectively, inside
radius 6 and 50. The control delta is exactly **0** (position and velocity), so
damping `< 1` really is a no-op inside the configured radius. Case 12 also
distinguishes the configured radius from the old hardcoded default 6: position
10 is outside 6 but inside 50.

### Why case 8 proves the clamp and single speed application

The raw delta `0.1` is above the adapter's `0.05` clamp. The artifact records
`effectiveDelta = 0.15000000000000002`, and both the GPU uniform and the CPU
`step()` use that value once. A double application would use `0.45`, which
cannot match the CPU reference.

## Negative coverage

- The three corrupt-readback cases (empty, truncated, `NaN`) still fail with a
  validation reason and `max*Delta: null`; 3/3 PASS.
- Eight out-of-range parameter cases (`radius 0.49/50.01`, `damping 0.79/1.01`,
  `speed 0.09/3.01/NaN`, `expectDamping` on vortex) all return
  `status: failed` with the parameter reason before renderer creation; 8/8 PASS.
- Seeds are read back before and after every case and must be unchanged.

## Verification

| Gate | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run typecheck:tests` | PASS |
| `npm test` | 339/339 PASS (30 files) |
| Targeted parity spec | 3/3 Playwright tests PASS (4.8 s) |
| Full E2E (`--grep-invert @evidence --workers=1`) | 77 passed, 13 skipped, 0 failed (11.6 min) |
| `npm run build` | PASS |

The attached artifacts are `gpu-kernel-parity.json`,
`gpu-kernel-parity-faults.json` and
`gpu-kernel-parity-invalid-parameters.json`.

## What is and is not covered

- Covered: real WebGL2 compute execution and readback, explicit radius/damping/
  speed inputs, clamp-then-scale-once delta, damping polarity on both sides of
  the threshold, radius `0.5`/`50` and damping `0.8`/`1` boundaries, speed
  `0.1`/`3`, respawn/age under speed 3, zero-delta no-op, immutable seeds,
  corrupt-readback rejection and invalid-parameter rejection.
- Not covered: physical-GPU execution, WebGPU execution (no adapter in this
  environment), performance, timestamps and 500k-particle stress. WebGPU remains
  `SKIP`/`NOT_RUN`, never parity.

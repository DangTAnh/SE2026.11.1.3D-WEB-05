# Cached GPU timestamps — Issue #79

## Problem and implementation

Baseline: `dev@24c4d968392c84abd2046918aa8e1d45d832381c`, after PR #78.
Branch: `fix/79-cached-gpu-timestamps`. TV3 owns adapter/backend review and TV1
reviews the existing GPU-only freshness interpretation; no RendererPort change.

Pinned Three 0.186.1 returns cached `lastValue` when timestamp resolution fails.
WebGL2 can also write new frame ids after a per-query disjoint/read error while
reusing that cached number. A positive fulfilled promise or frame progress alone
therefore does not prove a new timing sample. The adapter previously assigned
a new submission time to this cached duration and renewed stale GPU timing.

`resolveFreshComputeTime` is a version-specific boundary around the existing
Three compute query pool. It refuses an already pending resolve, invalidates
the pool's fallback cache with NaN, and requires the resolved frame to equal the
captured submission frame. Only a finite positive duration is returned; all
missing/invalid/cached results are null. The internal sentinel never becomes a
RendererPort measurement. Missing version-specific metadata fails closed.
This depends on the pinned runtime query-pool API; retest with the owners before
upgrading Three. No package or lockfile change is included.

The adapter retains submission-based age, 2000 ms maximum GPU age, 10-compute-
frame query cadence, generation checks and pause/reset/dispose/recovery guards.
FPS remains independent (#55); no physics, schema/hash, requested/actual or CPU
fallback change. Historical benchmark artifacts keep their original source and
interpretation rather than being relabelled after this fix.

## Actual verification

Windows 11 / Node 24.19.0 / npm 11.17.0 / pinned Chromium 156.0.8078.4.
The installed dependencies are reused from the prior successful lockfile install
for #78; `npm ci` was NOT_RUN again for this unchanged manifest/lockfile.

| Verification | Result |
|---|---|
| New adapter cached-timing regressions before source fix | 2 FAIL, reproducing false availability on WebGPU/WebGL2 |
| Source and test typechecks after fix | PASS |
| All unit/contract/integration tests | 265/265 PASS, 24 files |
| Headed readback-error/recovery smoke, retries=0 | 2/2 PASS, 9.3 s, actual WebGPU and WebGL2 |
| `CI=1 npm run verify` | PASS |
| Full desktop/mobile E2E | 76 PASS /12 SKIP, 6.1 min, no actual retries/flaky cases |
| Production build | PASS, 209 modules; existing 1092.96 kB chunk advisory |

The twelve skips comprise the earlier eight capability/platform cases plus
four new readback-error cases without headless timestamp support. The latter
are not counted as executed in the headless run. The headed desktop run executes
both new backend cases using actual hardware/query pools; it does not skip them.

Unit coverage includes actual pinned WebGPU resolution-error fallback and
WebGL2 disjoint/query-read fallback (including advanced frame ids), identical
successive valid durations, an older pending resolve, wrong/consumed frame,
missing pool, invalid duration, and existing lifecycle/recovery regressions.

The browser smoke keeps the production renderer and query pools. After genuine
positive timing appears, it injects WebGPU compute-buffer map rejection or
WebGL2 query-read exception, expects unavailable timing while actual backend
and FPS remain present, removes the fault and expects timing to recover.
These are readback API fault injections, not a physical GPU failure. Physical
device-loss behavior and physical-GPU numerical parity remain NOT_RUN.

## Reproduction and release handoff

```sh
npm ci
npx playwright install chromium
npm run verify
npx playwright test tests/e2e/gpu-timing-freshness.spec.ts --project=desktop-chromium --headed --retries=0
```

The last command requires a headed context with WebGPU timestamp-query and
WebGL2 EXT_disjoint_timer_query_webgl2 support. If absent, the explicit skip is
not hardware acceptance. Actual pushed SHA/remote checks are recorded on the
Issue #79 PR; local verification is separate from CI.

PR #70 and Issue #59 now reflect completed #68/#62/#76/#78 integration, v2
benchmark artifacts and #55/#56 post-MVP scope. Keep the release Draft pending
merge of this fix, final-head CI and independent release review. Deploy/smoke,
default-branch template visibility (#65) and any agreed tag happen only after an
authorized release merge. No release/deploy/tag/settings change is performed.

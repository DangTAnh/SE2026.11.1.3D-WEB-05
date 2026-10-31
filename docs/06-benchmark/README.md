# Benchmark results — TV1

One file per measured session, named `YYYY-MM-DD-<gpu>-<browser>.md` and
committed with the numbers. A screenshot or a chat message is not a result.

Acceptance criteria for a run: `docs/01-requirements/mvp-acceptance.md` §2.
Aggregation key: `(mode, configHash) × actual` — never merge across a hash
boundary (`docs/architecture.md` §5.1).
The hash excludes rendering and camera fields; compare the complete validated
config, environment and protocol before combining independent sessions.

## Recorded sessions

- [31/10 default v2, AMD Radeon, headed Chromium](2026-10-31-amd-radeon-chromium-v2.md):
  commit `d6ee6e3`, 65,536 particles, 100 samples on each actual backend.
- [31/10 default v2, SwiftShader, headless Chromium](2026-10-31-swiftshader-chromium-v2.md):
  the same source/config; software WebGL2 with the unavailable WebGPU row explicit.
- Historical v1/20,000 sessions:
  [28/10 headed AMD Radeon](2026-10-28-amd-radeon-chromium.md) and
  [29/10 headless SwiftShader](2026-10-29-swiftshader-chromium.md).

The new artifacts are promoted runner output without editing the numbers or
limitations. Interpretation and verification are recorded separately in the
[v2 integration handoff](../04-testing/benchmark-v2-integration-2026-10-31.md).
The headed FPS medians remain near 60; backend order is fixed and no performance
advantage is claimed. Its positive GPU durations do not establish freshness when
timestamp resolution fails: the inherited #62 cached-value finding needs a
separate TV1/TV3 follow-up. Physical-GPU numerical parity remains NOT_RUN.

## Runner

`src/perf/benchmark.ts` owns `BENCHMARK_PROTOCOL` — warm-up 3000 ms, cadence
100 ms, 100 samples, 10 s, median — and `buildBenchmarkResult`, which refuses a
run missing an environment field, samples, or a single `configHash`.
`tests/e2e/backend.spec.ts` is the browser matrix.

Run the evidence test headless with
`npx playwright test tests/e2e/benchmark-run.spec.ts --project=desktop-chromium`,
or add `--headed` on the same host for a two-backend comparison: Chromium may
expose WebGPU only in a headed context. The runner probes the WebGL renderer,
WebGPU adapter, browser, OS and commit at run time, then writes
`test-results/benchmark-result.md` (or `BENCHMARK_OUTPUT_PATH`). Promote that
file into this directory deliberately; a test run never overwrites a dated
result.

A recorded comparison requires a machine where both backends run. When a
backend cannot run, `buildBenchmarkResult` records it in `blockedBackends` and
the table shows `n/a` for that row; the reason goes under Limitations. Never
turn a request into an `actual` backend.

## Result file template

```
## Environment
Browser / version:
OS:
GPU / driver:
Repo commit:
Host: same machine for both backends? yes / no

## Configuration
Preset JSON:
configHash (64 hex):
Mode / particleCount:
Warm-up / sample count / duration (as fixed by TV5):

## Runs
| actual backend | samples | fps median (min–max) | gpuTimeMs median (min–max) |
|---|---|---|---|
| webgpu | ... | ... | ... |
| webgl2 | ... | ... | ... |

## Limitations
- Which protocol value was not yet fixed, or which timing path was unavailable.
- Compute on WebGL2 runs through transform feedback, not a native compute
  shader; say so rather than implying parity of mechanism.
```

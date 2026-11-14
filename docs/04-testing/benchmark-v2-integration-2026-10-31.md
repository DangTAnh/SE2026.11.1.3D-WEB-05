# Benchmark v2 integration — Issue #58 / PR #78

## Source and scope

- Baseline PR head: `6269e99f56cd32a7f5ccce0133e0d9eda5c9849e`.
- Normally merged dev: `2389f0f550b33899801e1ab07c6312baea0c9faf`, including
  merged #76 nested preset v2 and #68 community standards.
- Integration/source commit: `d6ee6e3`. Both new measured artifacts name this
  exact revision. Subsequent handoff changes are documentation/artifacts only.
- Resolve the sole textual conflict in PROJECT_STATUS by retaining all #58,
  #16, #53 and #54 checkpoints. Change the formatter to
  `result.config.simulation.particleCount` and its default assertion to 65536.
  Preserve full validated config pinning, isolated result snapshots,
  `blockedBackends: []` fixtures and blocked/measured classification tests.
- No adapter, simulation kernel, schema, configHash or dependency changes.
  #55/#56 remain post-MVP. The inherited #62 cached-timestamp freshness finding
  remains a separate TV1/TV3 follow-up, including for release #70.

## Actual local verification

Windows 11 (raw OS probe `Windows_NT 10.0.26300`), Node 24.19.0/npm 11.17.0,
pinned Playwright Chromium 156.0.8078.4, one browser worker.

| Command | Result at d6ee6e3 |
|---|---|
| `npm ci` | PASS, 54 packages; one inherited moderate Vite advisory |
| `CI=1 npm run verify` | PASS |
| Source and test typechecks (within verify) | PASS |
| Unit/contract/integration tests | 252/252 PASS, 23 files |
| Desktop/mobile Chromium E2E | 76 PASS /8 SKIP, 6.1 min; no actual retries/flaky cases |
| Production build | PASS, 208 modules; existing 1092.53 kB chunk advisory |
| Headed benchmark, `--retries=0` | 1 PASS, 30.2 s total |
| Headless benchmark, `--retries=0` | 1 PASS, 2.2 min total |

E2E skips: four unavailable-WebGPU cases, two WebGL2-unavailable branches on a
WebGL2-capable environment, and two desktop-only parity cases on mobile. Axe
checks passed. CI-mode verify permits two retries by policy, but this run used
none. Evidence runs explicitly disabled retries. No harness or assertion was
weakened; historical tests and run files remain intact.

## Measured default-v2 sessions

Both artifacts below are promoted byte-for-byte from runner output. They carry
the full nested config and hash
`0f917cd0a56e3d7b63f53c7f1e7bb5f2cdfb70d6191454733baf204f0fc907fa`.
The reported workload uses 65536 particles with the unchanged fixed protocol:
3000 ms warm-up, 100 ms cadence, 100 samples, declared duration 10 s, median.
The duration is the protocol declaration; the total wall-clock evidence-test
times are listed above, including initialization and software-renderer delays.

- [Headed AMD Radeon](../06-benchmark/2026-10-31-amd-radeon-chromium-v2.md):
  100 samples on each actual backend; both FPS medians 59.91611743559009.
  GPU medians reported by the adapter: WebGL2 0.13916 ms and WebGPU 0.131072 ms.
- [Headless SwiftShader](../06-benchmark/2026-10-31-swiftshader-chromium-v2.md):
  WebGL2 100 samples, FPS median 1.5790304752881659, GPU timing n/a.
  WebGPU n/a because requestAdapter returned null in this context.

WebGL2 always precedes WebGPU; order is not counterbalanced. Near-60 headed FPS
does not measure peak throughput, and these single-session numbers establish no
performance advantage. The exact driver version is not exposed by the browser.
Positive GPU durations do not prove fresh query identity under readback errors:
Three may return a cached value, the inherited #62 finding. Physical-GPU numeric
parity, error-path timestamp freshness and release/MVP acceptance remain NOT_RUN
or pending owner acceptance. No CPU fallback or fabricated measurement is used.
The historical 28/10 and 29/10 files remain v1/20000 sessions without relabeling.

## Reproduction

Check out `d6ee6e3`, install with `npm ci`, install pinned Chromium once with
`npx playwright install chromium`, then run `npm run verify`.

```sh
npx playwright test tests/e2e/benchmark-run.spec.ts --project=desktop-chromium --headed --retries=0
npx playwright test tests/e2e/benchmark-run.spec.ts --project=desktop-chromium --retries=0
```

For each evidence run set BENCHMARK_OUTPUT_PATH to a distinct untracked path;
otherwise the runner writes test-results/benchmark-result.md. Promote output
deliberately; never write over the committed historical artifacts. The measured
renderer, adapter availability and timing support depend on the host/context.

Final pushed SHA and remote CI are recorded on PR #78. TV1/TV4 re-review and an
independent human approval are required before merge. This handoff performs no
PR merge, main/dev push, release, deployment, tag or repository settings change.

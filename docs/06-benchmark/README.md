# Benchmark results — TV1

One file per measured session, named `YYYY-MM-DD-<gpu>-<browser>.md` and
committed with the numbers. A screenshot or a chat message is not a result.

Acceptance criteria for a run: `docs/01-requirements/mvp-acceptance.md` §2.
Aggregation key: `(mode, configHash) × actual` — never merge across a hash
boundary (`docs/architecture.md` §5.1).

## Runner

`src/perf/benchmark.ts` owns `BENCHMARK_PROTOCOL` — warm-up 3000 ms, cadence
100 ms, 100 samples, 10 s, median — and `buildBenchmarkResult`, which refuses a
run missing an environment field, samples, or a single `configHash`.
`tests/e2e/backend.spec.ts` is the browser matrix.

A recorded comparison still requires a machine where both backends run. When
WebGPU is unavailable, write `n/a` for that row and say so under Limitations;
never turn a request into an `actual` backend.

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
| actual backend | statistic | fps | gpuTimeMs | gpuTimingAvailable | min / max |
|---|---|---|---|---|---|
| webgpu |  |  |  |  |  |
| webgl2 |  |  |  |  |  |

## Limitations
- Which protocol value was not yet fixed, or which timing path was unavailable.
- Compute on WebGL2 runs through transform feedback, not a native compute
  shader; say so rather than implying parity of mechanism.
```

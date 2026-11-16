# Collector config/status identity — Issue #99

## Root cause

`PerformanceCollector.#capture` hashed the effective config, awaited the
asynchronous SHA-256 digest, and only then read `port.getStatus()`. When the
effective workload changed while that digest was pending, the emitted snapshot
carried the previous workload's `configHash` together with the new workload's
FPS/GPU metrics. The reported reproduction emitted the default-v2 hash
`0f917cd0…` for a speed-2 workload, independently of GPU timing availability.

## Policy (implemented)

- The effective config and the port status are read in one synchronous step, so
  a digest or an observer cannot pair one workload's identity with another
  workload's metrics.
- The digest, the `onStatus` observer and the paused/running checks keep their
  previous relative order, so a synchronous `stop`/`dispose`/`restart` from an
  observer still cancels the capture before it can emit.
- After the digest the port status is read again. A port that is paused, lost or
  running a different `actual` backend is reported to `onStatus` (the #82/#83
  classification path) and the captured sample is not emitted, so a benchmark
  cannot resolve with a row measured across a backend change.
- After the digest, the effective config is compared with the capture-time
  identity using the existing `canonicalConfig` projection. If it changed — by
  the caller, or synchronously from `onStatus` — the capture is discarded and
  the next cadence samples the new workload.
- Active-workload projection/rounding, preset-v2 semantics, `configHash` itself,
  the INV-1 GPU-timing rule (unavailable/stale/invalid timing → `null`), paused
  skipping and the non-overlapping `#sampling` guard are unchanged. No schema
  fields were added.

## Tests

`tests/unit/perf-collector.test.ts` adds a deferred-digest helper that still
uses the real SHA-256 value, so the assertions compare real hashes:

| Case | Expected |
|---|---|
| Workload changes during the digest | Capture discarded; next cadence emits the new hash with the new metrics |
| Config changes synchronously from `onStatus` | Capture discarded; next cadence emits the new hash |
| Status changes during the digest | Emitted snapshot keeps the status captured with its own hash |
| Digest rejects | `onError` once, no sample, cadence keeps running |
| `stop()` during the digest | No sample |
| Backend becomes unavailable while the final digest is pending | Benchmark rejects (`backend became unavailable`) instead of resolving |
| Backend replaced while the final digest is pending | Benchmark rejects (`actual backend changed`) |

## Review follow-up (16/11/2026)

TV3's review of the first revision found that reading the status only before
the digest regressed the terminal-loss behaviour of #82/#83: the post-digest
observer received an old status, so a loss during hashing could still emit a
sample and let a benchmark resolve. The implementation now re-reads the status
after the digest and surfaces loss/replacement through `onStatus`, keeping the
captured metrics only when lifecycle and backend are unchanged. The two
benchmark regressions above fail without that re-check (verified by temporarily
stashing the source change) and pass with it.

## Results (local, Windows, Node 22.16, pinned lockfile)

- `npx vitest run tests/unit/perf-collector.test.ts tests/unit/benchmark.test.ts`:
  **39 PASS / 0 FAIL**.
- `npm test`: **397 PASS / 0 FAIL**, 33 files.
- `npm run typecheck`, `npm run typecheck:tests`, `npm run build`: PASS
  (existing chunk-size advisory only).

## Limits

- Controlled fake-port and fake-timer evidence. No GPU execution, no physical
  device, no real-user capacity claim.
- The capture now reports the status read at capture time; a status change that
  happens during the digest is visible on the next cadence. The benchmark
  terminal-loss observer keeps its guarded position, but this fix does not
  change #97 (stale GPU timestamps after `applyConfig`), which stays open.
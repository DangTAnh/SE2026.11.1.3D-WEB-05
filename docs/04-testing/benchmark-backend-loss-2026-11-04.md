# Benchmark backend-loss handoff — Issue #82

PR #70 review identified a pending benchmark promise after a running backend
reports `actual: unavailable, running: false`. The general collector correctly
skips paused snapshots, but the benchmark then never reaches rejection or caller
cleanup. Two fake-clock regressions on dev@8f7c3ee reproduce pending collection
after 60 seconds for both WebGL2 terminal loss and exhausted WebGPU recovery.

The collector now offers an optional status observer before its paused-snapshot
skip. Benchmark collection uses it to reject unavailable status or a changed
actual backend, routing the error through existing collector disposal. No extra
polling timer is introduced. The caller continues to own/dispose the port; its
finally block becomes reachable. Available paused renderers may resume. GPU
timing, full-config pinning, schema/hash, physics and #55 FPS scope are unchanged.

## Verification

Windows, Node 24.19.0, unchanged lockfile and existing installed dependencies:

- RED: both backend-loss regressions FAIL on old source: pending vs rejected.
- GREEN: all 23 benchmark tests PASS, including unavailable initial status,
  caller cleanup/zero timers, available pause/resume and backend replacement.
- `npm test`: 270/270 PASS, 24 files.
- `npm run typecheck`: PASS.
- `npm run build`: PASS, including source/test typechecks, 209 modules; existing
  chunk-size advisory remains.
- `npx playwright test tests/e2e/renderer-runtime-context-loss.spec.ts --retries=0`:
  2/2 desktop/mobile PASS via normal HTTP, 1.1 minutes. The real production
  WebGL2 context becomes unavailable after injected context loss.

The deterministic promise/timer/caller-cleanup assertions use FakeRenderer,
not physical GPU failure. Browser smoke exercises production context-loss
reporting, not a new benchmark measurement or physical GPU failure. Full local
E2E, new benchmark measurements, physical-GPU parity, deployment and release
acceptance are NOT_RUN in this fix. Remote CI and owner review are recorded in
the fix PR. Release #70 remains blocked until the fix lands and is re-reviewed.

## 05/11/2026 — observer cancellation follow-up

TV3 reproduced a sample emitted after onStatus synchronously stopped/disposed
the collector. Both new regressions FAIL on 5c0d442 (one sample, expected zero).
Re-checking the active generation after the callback discards cancelled captures,
including an obsolete generation if the observer restarts. The tests wait for
the observer after asynchronous hashing, then assert zero samples/errors/timers
and retained caller ownership. The benchmark's throwing-observer error path is
still covered by its existing backend-loss regressions.

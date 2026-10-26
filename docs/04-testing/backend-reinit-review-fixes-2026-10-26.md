# PR #63 — TV1 review fixes

Baseline: `dev@a6e460d`, merged normally into `feat/54-backend-reinit` via
`89bb87c`. This follow-up supersedes the failure behavior described in the
[initial handoff](backend-reinit-2026-10-26.md); historical results remain there.

## Transaction and ownership

The shared `createCanvasRendererFactory` stages a distinct, connected canvas in
an inert, aria-hidden, offscreen wrapper. Deep cloning preserves fallback text;
the staged canvas has no duplicate live ID. The previous canvas remains visible
through initialization. A candidate commits only when init returns an available
backend matching its status. Failure disposes only the candidate and reports
rollback explicitly. Initial failure has no active renderer to retain.

RendererSession tracks the active resource separately from the pending generation.
It snapshots requested preference, applies subsequent config/resize edits on
completion, ignores late results and disposes each resource once. At commit it
pauses the old simulation before starting the candidate; failed commit resumes the
retained simulation according to current user intent. Successful switches restart
particle state. Pending initialization may briefly own two renderer resources;
the concrete adapter owns frame-loop/GPU resource shutdown on disposal.

The UI remains mounted once with one control binding, poller and host observer.
It receives an explicit applied/failed/superseded result and distinguishes valid
fallback from rollback. A failed initial backend cannot create running intent;
retry stays paused until the user starts it. Pending and new-generation status
do not expose the prior generation's measurements.

## Review-to-regression mapping

| TV1 finding | Regression evidence |
|---|---|
| Retain renderer on failure | Integration reject/unavailable/status mismatch, commit failure, candidate readiness/start ordering; E2E rollback retains live canvas/config/running state |
| Unreachable error toast | E2E resolved-unavailable and rejected init, rollback/no-renderer errors, successful switch and valid fallback |
| Running without backend | Integration unavailable → retry, pause/resume during deferred init; E2E explicit user start after retry |
| E2E capability gate | Production switching probes WebGL2, asserts unsupported UI then skips with reason when absent |
| Mutable requested preference | Deferred generations finish out of order; latest alone commits; old rejection cannot clear pending init |
| Missing fallback text | E2E compares nonempty fallback content before/after canvas replacement |
| Duplicated canvas factory | Production and fixture import the same composition factory; E2E checks connected staging, inert/aria-hidden, one live ID and removal |

Additional integration coverage: dispose during initialization; repeated switches;
factory failure; full config and latest target preservation. E2E verifies observer
disconnect, poller shutdown and one disposal after unmount/unload.

## Related integration boundaries

- #61: this factory provides fresh-surface staging at composition level. Runtime
  recovery still lives inside TV3's adapter and cannot silently replace its canvas.
  TV1/TV3 must agree a loss notification/recovery ownership API before reusing
  session switching. A synthetic context-loss test is not hardware device-loss proof.
- #62: no unapproved `RendererStatus` fields are added here. Once TV1/TV5 settle
  independent FPS/GPU freshness, integrate the approved empty-status fields in
  `RendererSession.getStatus()` (null while pending/unavailable) and test reset,
  pause and stale asynchronous results. #55 remains separate.
- #64 `edb9e0a`: browser matrix and readiness waits touch existing backend/UI
  behavior; they do not change the canvas factory or session. TV4 review of the
  final combined browser matrix is useful; no benchmark/parity claim follows
  from a sized canvas or capability API presence.

## Verification

- `npm ci --offline --ignore-scripts`: PASS, lockfile unchanged.
- Session integration: 15 PASS (including old-backend loss during a failed switch).
- Focused backend re-init E2E: 14 PASS (desktop/mobile, no retries).
- Source/test typechecks: PASS.
- `npm test`: 139 PASS across 19 files.
- Final `CI=1 npm run verify`: PASS — both typechecks, 139 unit/contract/integration
  tests, 52 desktop/mobile E2E PASS, two WebGPU-adapter skips, production build.
  No retries in this final full run; browser suite took 4.2 minutes.
- `git diff --check`: PASS. Existing Vite >500 kB bundle warning remains.

An earlier full run failed the existing desktop live-FPS test at its 60 s total
timeout (48 pass, three flaky, two skips). Trace showed READY/live FPS assertions
passing before screenshot/click exhausted the budget under browser load. The
unchanged test then passed independently in 32.5 s. Final full verification above
passed without changing assertions, particle counts, timeouts or retry settings.

Hardware WebGPU switching, physical device removal, GPU numeric readback parity
and fair same-machine two-backend measurements are NOT_RUN. Chromium production
switching exercises WebGL2 and requested-WebGPU fallback; FakeRenderer tests prove
only caller/lifecycle behavior. Human TV1/TV3 review is still required.

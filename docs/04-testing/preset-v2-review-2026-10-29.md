# PR #76 review revision — 29/10/2026

## Scope and diagnosis

Baseline: feature `2ec74e9aa82d3ea06c15535a16cddd32a9555a13`, integrated
`dev@142769176cdb081dac2cf5f87419e55ac6fa726c`. TV5 review 5695849490
and TV3 review 5695742899 were read live before edits. No runtime source,
schema/default/range/hash or #55/#56 change is included.

Old CI run 40843299853 / job 123344635675 reports context-loss desktop first
attempt exceeding the **30000 ms test timeout**, then retry passing. It does
not identify a failing assertion or a teardown-specific error. No workflow
artifacts remain available through the artifact API, so the exact slow phase
cannot be recovered. Startup/readiness/event propagation/cleanup share that
30s total. Backend readiness separately allowed only 15s; loss propagation
10s. The test starts the unchanged real 65536-particle production default.
The local unchanged test passed in 16.5s; no reproduced production defect,
deadlock or disposal failure was found. This supports insufficient slow-device
budget as the working diagnosis, not proof of the exact old CI bottleneck.

The affected test alone now uses 90s overall / 60s backend readiness, matching
existing production smokes. The loss assertion remains 10s. Assertions,
capability skips and default workload are retained. An explicit startup step
makes future traces easier to inspect. Global timeout/retry policy is unchanged.

## Harness and documentation

Restore `npm run dev -- --host 127.0.0.1 --port 4173`. package.json maps dev
to the same pinned Vite executable. Commit 59dba81 introduced direct Node;
the original handoff records Windows/npm flag forwarding trouble. Current
Node 22.16.0 / npm 11.10.1 Windows runs start and stop the standard webServer
successfully. Linux confirmation must come from the new exact-head CI.
Historical notes are preserved, not presented as current necessity.

PowerShell invocation of `npm run test:e2e -- --retries=0` emitted
"Unknown cli config --retries" and omitted it from the executed script.
That incomplete diagnostic attempt was stopped, not counted as retry-disabled
evidence. Use `CI=1 npx playwright test --grep-invert '@evidence' --retries=0`
(PowerShell: set `$env:CI='1'` first) for the equivalent explicit verification.

ui-interaction-spec now describes nested v2, complete default example/ranges,
strict rejection/import/name behavior, RendererSession Apply/rollback, merged
#62 GPU-only freshness and current acceptance paths. Flat v1/Canvas2D are
explicitly Historical / Superseded. Shared contracts require TV1 review;
lifecycle/testing revision requires TV3/TV5 re-review. TV2 ranges are unchanged.
All seven relative links resolve; the example validates through the real parser
and equals DEFAULT_CONFIG. The initial plain Node example check lacked TS
loading support; rerun with --experimental-strip-types passed.

## Local verification

- npm ci: PASS, 54 packages, zero vulnerabilities.
- source/test typechecks: PASS.
- npm test: PASS, 235 tests /22 files.
- npm run build: PASS, 208 modules; existing 1092.53 kB chunk advisory.
- Context-loss baseline: 1 PASS, 16.5s, retries=0.
- Changed targeted repeat-each=3: 3 PASS, 16.3/15.8/15.7s, total 51.8s,
  one worker, retries=0, standard npm webServer.
- CI=1 npm run verify: PASS, 235 tests, 76 E2E PASS /8 SKIP, 8.1min,
  no retries/flaky; context-loss desktop 16.3s/mobile 20.4s; build PASS.
- Separate full retries=0 run: result recorded on PR #76 after completion.

The initial restricted browser invocation stalled before running tests and was
stopped; the complete executions use the authorized browser/server environment.
Eight expected skips: four unavailable WebGPU cases, two unavailable-WebGL2
branches on a WebGL2-capable environment, two desktop-only parity cases on mobile.
No new skip or assertion removal. Physical WebGPU/parity/timestamp freshness
and v2-default fair benchmark acceptance remain NOT_RUN. Software WebGL2 and
synthetic loss are not physical GPU acceptance.

Exact committed SHA, latest CI and owner gates are recorded in PR #76. Keep
Draft; no approval, Ready, merge, release, tag, deployment or Issue closure.

## Additional live-status triage on this revision

The first explicit full retries=0 run returned **75 PASS /8 SKIP /1 FAIL**
(10.7min). Context-loss passed desktop 23.9s/mobile 27.8s. Mobile live-status
failed before status assertions at its locator capability evaluation with
Playwright connection error "Object with guid handle@... was not bound in the
connection". The saved trace contains no application assertion failure there.
Do not describe this full run as PASS.

Three unchanged targeted mobile live-status trials returned **2 PASS /1 FAIL**:
45.5s, 47.4s, then total test timeout 60000ms. Trace places navigation at ~1.3s,
capability evaluation at ~13.7s, and filling particle count at ~48.5s; the
remaining status/screenshot/pause work exceeded the overall budget. Thus the
60s budget could expire even when startup and the subsequent transitions work.
Both traces were preserved outside the repository before later output cleanup.

A narrow follow-up changes only that production status test: 90s overall,
60s readiness, and an in-page canvas capability probe instead of transferring
an ElementHandle. All assertions and the post-start 1000-particle status load
remain; the initial 65536 default remains real. This removes the handle transfer
involved in the observed protocol error, without claiming a proven Playwright
root cause. No dependency upgrade or production change. Changed mobile targeted
repeats: **3/3 PASS**, ~72/60/60s, 3.5min, retries=0. Full revision verification
and exact-head CI results are recorded on PR #76 after completion. Earlier full
PASS and failed runs above remain historical evidence for the preceding test
revision, not final-head full-suite proof.

Final local CI=1 verify attempt after the live-status follow-up was **stopped
incomplete after a failure**: unchanged desktop backend-reinit.spec.ts:204
exceeded its existing 90s test timeout (reported ~1.7min including teardown).
The earlier 76/8 full PASS does not cover this follow-up test revision.
No clean final full-suite result is claimed here. G0 and 235 unit tests on the
follow-up content passed. Do not infer a production root cause from this timeout;
TV3/TV5 must review the preserved trace and exact-head CI. No broad timeout
increase or unrelated source change was made in response.

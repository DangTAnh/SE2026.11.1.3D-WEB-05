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

## TV1 final review follow-up — 29/10/2026

The exact-head schema finding was checked against `7a6992a`: both strengths
already have minimum 0.2, maximum 4 and multipleOf 0.001. `preset.ts:3` imports
that v2 JSON directly; no v1 schema is imported by product source. Schema is
unchanged. Direct JSON import regressions accept 0.2/4/1.234 and reject
50/0.199/4.001/1.2345 for both modes with the actual error message. Existing
coverage rejects missing/unknown keys at every level, accepts 65536/500000,
and tests atomic UI invalid-import behavior.

Option A retains the owner-approved active-workload hash and golden vectors.
TV1 explicitly accepts this option in discussion_r4411879288 provided §5.1
states the collision consequence. Architecture now states that rendering and
camera can change GPU cost without changing hash. Sampling pins the validated
full config and rejects observed changes, including excluded fields; the result
builder stores an isolated validated snapshot. Raw hash-only samples cannot
prove retrospective full-config provenance; callers must not concatenate runs
solely by hash/backend. This remains an explicit limitation, not a fairness claim.

### Verified remote baseline (not evidence for later local edits)

CI run [40860125420](https://github.com/DangTAnh/SE2026.11.1.3D-WEB-05/actions/runs/40860125420),
job 123400946463, SUCCESS: checkout log identifies synthetic merge
`17337a98d351a443cb42a79c6a6959ff47f2791e` of feature
`7a6992a5e6b3ab04ce1b428550e5b6543d73a7d2` into
`dev@142769176cdb081dac2cf5f87419e55ac6fa726c`.
Both typechecks, 235 tests /22 files, 208-module build PASS. E2E: 76 PASS /
8 SKIP, one worker, 9.8 minutes, no retry/flaky entries (retry policy remained
2; actual log shows no retries). Context loss desktop/mobile 24.5s/18.5s;
backend re-init desktop/mobile 49.6s/27.9s; live status desktop/mobile
33.6s/24.9s. The earlier statement that no clean remote full suite existed is
superseded for this baseline only. Prior failed/incomplete local runs remain
historical evidence above.

### Integration with #78

Compared #76 `7a6992a` and #78 `4c85bea` against common dev `1427691`.
Proposed order: #76 first, then TV5 normally merges dev into #78. Shared paths
include README, PROJECT_STATUS, benchmark-result.test.ts, benchmark.test.ts,
and src/perf/benchmark.ts (the latter now also changes for the guard).
The later PR must preserve nested v2 config, use
`result.config.simulation.particleCount`, expect default 65536 (not 20000),
retain both v2 full-config tests and #78 blocked-backend tests, add
`blockedBackends: []` to manually constructed result fixtures, and keep this
full-config guard/snapshot alongside #78's optional blockedBackends input and
WebGPU outcome handling. Preserve every PROJECT_STATUS checkpoint.
If #78 lands first, #76 must normally merge dev and make the same nested-count,
required-fixture and guard reconciliation before rerunning verification.
Do not add #78's unmerged required result field to #76 preemptively.
Existing v1/20k artifacts remain historical; v2-default benchmark acceptance
requires new measurements or an explicit owner-recorded limitation. No #78
branch edit or merge is performed here.

### Final sequential local verification — review follow-up content

- npm ci: PASS, 54 packages, 0 vulnerabilities (committed lockfile unchanged).
- npm run typecheck / npm run typecheck:tests: PASS.
- npm test: PASS, 241 tests /22 files.
- CI=1 npx playwright test --grep-invert '@evidence' --retries=0: PASS,
  76 desktop/mobile tests /8 expected skips, 8.7min, one worker, zero retries
  or flaky entries; axe PASS. Strength-50 invalid import preserves slider and
  output 2.4 with no renderer call on both viewports.
- npm run build: PASS, 208 modules, existing 1092.53 kB chunk advisory.
- This sequential command chain covers all npm run verify stages, with the
  E2E stage explicitly forced to retries=0; all source/test/config content
  is the content committed in this follow-up. Only evidence/status text follows.
- Context loss desktop/mobile 23.3/16.6s; backend re-init 35.3/25.4s;
  live-status 24.3/19.7s. No test assertion weakened, skip added or global
  timeout/retry policy changed. Physical GPU gates remain NOT_RUN.

The resumed original CI=1 npm run verify completed with 241 unit tests,
74 E2E PASS /8 SKIP /2 FLAKY (10.6min) and build PASS. Desktop ui-port
reported page.evaluate target/browser closed, not an assertion mismatch;
mobile backend-reinit reported missing trace/artifact files during context
close (ENOENT). A second runner was mistakenly launched while this first
runner still ran: its startup failed because port 4173 was occupied, but it
also cleaned shared test-results artifacts. This explains the artifact
interference; it does not establish a production cause for the browser-close
error. No production fix was invented. Runs are now strictly sequential.
The complete isolated retries=0 result above supersedes neither historical
failure nor trace provenance; it is separate final-content verification.

Independent read-only Codex review found no actionable defect in nested
parser/UI/session, simulation/material/camera mapping, OrbitControls cleanup
or benchmark guard/snapshot. This is supplementary AI evidence, not human
owner sign-off. Final exact-head CI, review replies, Ready state and requested
reviewers are tracked live on PR #76. Owner decisions permit option A; affected
owners must review the implementation and an independent human must approve.
No merge, auto-merge, deployment, release, tag or issue closure is authorized
by these checks.

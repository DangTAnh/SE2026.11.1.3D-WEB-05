# VT-121 acceptance follow-up — 05/11/2026

Codex-assisted author audit and measurements, not independent human approval.
Implementation measured: `c2f5f3053224d375327aa33ba85276b68678384d`.
Unchanged live dev: `8f7c3eeb74c7a9501332b265fa16a6aa552aa2b3`.
Delivery and acceptance tracking: [Issue #84](https://github.com/DangTAnh/SE2026.11.1.3D-WEB-05/issues/84),
sole assignee `duyanhtr130905`; [PR #81](https://github.com/DangTAnh/SE2026.11.1.3D-WEB-05/pull/81).

## Acceptance authority and original requirement

The recorded original [initial plan](VT121-initial-plan-original.md),
[test strategy](VT121-test-strategy.md), submitted BTCN3 dossier and
[04/11 assignment clarification](VT121-review-followup-2026-11-04.md) retain
**p95 <= 5 seconds for 200 tasks/users**. The original externally supplied
assignment is represented by these records; no separate signed measurement
protocol or authorized waiver was found in the repository, reviews, inline
threads or Issue history. The current user instruction explicitly retains the
5-second limit. Limited-harness permission does not waive it.

The historical 04/11 wording about the user and GPT as scope decision makers
is not authority for GPT/Codex to approve acceptance or change an academic NFR.
No such approval is asserted here. Issue #84 asks the owners to identify the
accountable acceptance authority and publicly record the workload, latency
endpoints, estimator and required independent run count. Any deferral/change
must name its actual authorized decision maker, timestamp, rationale, risk,
impact and follow-up. No decision currently exists.

**BLOCKED — OWNER NFR DECISION REQUIRED. NFR NOT_MET in the current capped
campaign; real 200-user concurrency NOT_VERIFIED.** A single fast round is
not substituted for reproducible acceptance. No acceptance criterion changed.

## Harness audit and protocol actually executed

`tests/e2e/vt121-load.spec.ts` is unchanged from the implementation HEAD:

- One headless Chromium, 10 independent desktop contexts/pages, 1440x1000.
  Context/page creation, module loading/navigation and initial UI readiness
  happen before timing. Pages are reused across jobs within a round.
- One warm-up operation on each page (10 total), then 200 jobs submitted at
  one monotonic `performance.now()` start; at most 10 execute concurrently.
  Three independent Playwright repetitions recreate their contexts and warmup.
- Each unchanged operation selects the original schema-v2 payload (default
  config with name `browser load`, vortex mode, speed 2), asserts speed 2,
  clicks the accessible native Undo control, asserts restored speed 1.2 and
  disabled Undo. It exercises the actual file reader/parser/controller/UI;
  the renderer is the explicitly labelled FakeRenderer fixture. This narrow
  speed oracle is not a complete document oracle; separate Undo E2E covers it.
- Queue-inclusive latency ends after all those assertions, from the common
  submission start. Service starts when a worker claims a job. Queue wait is
  derived **per sample** as latency minus service, then quantiled; quantiles
  themselves are never subtracted. All samples and errors are retained.
- Nearest rank: sort n samples, select index `ceil(n*p)-1`; n=200 per round.
  p95 is sample 190. No rounding before comparison, pooling to hide a slow
  round, threshold/timeout change, force-click or skipped assertion.
- Original optional Vite transport enabled: modules pass through the actual
  Vite transformer and Playwright interception, not normal HTTP. Initial
  network/module loading is outside timing. App import uses local File data;
  there is no application server/account workload. This cannot establish
  HTTP capacity, physical GPU capacity or 200 concurrent real users.
- `playwright.config.ts`: workers=1; explicit retries=0; existing 240000ms
  evidence-test timeout unchanged. Performance is tagged `@evidence` and
  excluded by `test:e2e`, hence by `verify`; exit0 asserts 200 jobs/no errors,
  **not** p95<=5000ms. It remains an explicit acceptance campaign, not a newly
  mandatory environment-sensitive CI benchmark.

Environment: Windows 10.0.26300, Node 22.16.0, pinned Playwright 1.64.0 /
Chromium 156.0.8078.4 (revision 1248), Intel i5-12450HX, 12 logical CPUs,
25,463,480,320 bytes RAM. Same installed dependencies/lockfile, browser,
machine, concurrency and transport as the recorded 04/11 browser campaign.
No verification/GPU campaign ran alongside the measurements. This does not
control all OS background activity, power/thermal state or order effects.

## Repeated results (milliseconds)

All rows use queue-inclusive latency. Error rate is 0/200 in each round.

| Source | Round | p50 | p90 | p95 | p99 | Errors |
|---|---:|---:|---:|---:|---:|---:|
| HEAD c2f5f30 | 1 | 2708.0064 | 4750.4046 | 5155.5662 | 5246.4182 | 0 |
| HEAD c2f5f30 | 2 | 2532.6183 | 4541.3436 | 4803.5604 | 4952.5525 | 0 |
| HEAD c2f5f30 | 3 | 2820.1291 | 4866.3022 | 5154.3228 | 5236.2886 | 0 |
| Pre-fix source 4eb31d3 | 1 | 2731.0926 | 4666.6814 | 4908.7921 | 5038.2107 | 0 |
| Pre-fix source 4eb31d3 | 2 | 2592.9468 | 4601.6158 | 4834.3609 | 4929.4609 | 0 |
| Pre-fix source 4eb31d3 | 3 | 2721.9169 | 4701.4435 | 4944.6508 | 5109.3959 | 0 |

HEAD p95 range 4803.5604–5155.5662ms; range width 352.0058ms, sample standard
deviation 202.8727ms across three round-p95 values. Two rounds exceed 5000ms;
the arithmetic mean of round p95 values is 5037.8165ms, a descriptive statistic,
not an alternative acceptance estimator. All 600 HEAD jobs completed without
functional error. Service p95 316.3378 / 307.4000 / 328.5056ms; queue-wait p95
4750.4077 / 4541.3459 / 4866.3039ms. Neither replaces queue-inclusive p95.

The 4eb31d3 comparison uses the unchanged HEAD fixture/harness and existing
`VT121_SOURCE_BASELINE` mechanism to load original production `src` from its
clean checkout. Its p95 range is 4834.3609–4944.6508ms (sample SD 56.2579ms).
The only production diff since that revision clears the file input before
awaiting its read. Runs were sequential, HEAD then baseline, not randomized;
the overlapping ranges and observed variability do not establish causality
or justify reverting the proven same-file fix. This is a pre-fix comparison,
**not a measurement of total PR overhead against dev**. Dev lacks Undo; the
identical operation cannot complete there. Replacing Undo with another action
would change workload, so no dev/PR overhead or optimization claim is made.

Public raw evidence, all 1200 samples, timestamps and environment:
[HEAD 3x200](https://github.com/DangTAnh/SE2026.11.1.3D-WEB-05/issues/84#issuecomment-6648428189),
[pre-fix source 3x200](https://github.com/DangTAnh/SE2026.11.1.3D-WEB-05/issues/84#issuecomment-6648429889).
Historical 13.347999s and 5.064348s campaigns remain valid historical results;
they are not erased by the new round below 5s.

## Diagnostic phase experiment (separate from acceptance rounds)

A separate external copy of the unchanged operation adds only monotonic
timestamps around the existing Playwright calls, retaining 200 jobs/pool10,
10 warmups and all assertions. It is diagnostic, not a replacement acceptance
run or a committed harness change. Mean per-job measured phases:

This diagnostic round also retains its overall queue-inclusive p95
5007.3309ms, p50 2618.3603ms, p99 5171.5621ms, 0/200 errors. It is above the
same 5000ms numerical target and is not silently discarded from the record.

| Phase | Mean ms | p95 ms |
|---|---:|---:|
| setInputFiles interaction | 61.8113 | 78.1026 |
| Imported speed assertion | 27.9431 | 37.6105 |
| Locate/click Undo interaction | 111.0619 | 146.8730 |
| Restored speed and disabled assertions | 55.5368 | 69.8528 |

Undo interaction includes Playwright protocol, browser scheduling, locator
resolution and actionability/animation-frame waits, event dispatch and app
handling; it is **not controller-only Undo execution time**. Likewise file
interaction is not parser-only time. The raw acceptance samples show large
queue accumulation; this profile identifies harness interaction costs but
does not establish a production bottleneck attributable to PR #81. No force
click, direct DOM invocation, parser cache or controller rewrite is justified.
No parser/browser CPU subphase measurement is claimed.

Unchanged Node script rerun: 1000 warmups, 5x200 synthetic Promise sessions,
real parser/deep snapshots/import/Undo/document assertions, one event loop:

| Round | p50 ms | p90 ms | p95 ms | p99 ms | Errors |
|---|---:|---:|---:|---:|---:|
| 1 | 7.9633 | 14.5517 | 15.2436 | 15.8010 | 0 |
| 2 | 7.3477 | 13.8272 | 14.6807 | 15.3868 | 0 |
| 3 | 7.3647 | 14.0378 | 14.7834 | 15.3527 | 0 |
| 4 | 7.5615 | 13.6151 | 14.2938 | 14.8447 | 0 |
| 5 | 7.3491 | 13.9400 | 14.6190 | 15.3733 | 0 |

These controller numbers cannot substitute for browser queue or real-user
latency. Raw Node/profile/logs, generated diagnostic source/config, analysis
and hashes are retained outside the repository in the session's
`output/finalize81-20261105/`; no generated raw output is committed.

## Reproduction

From implementation HEAD with its lockfile dependencies and pinned Chromium:

```powershell
$env:VT121_VITE_TRANSPORT='1'
Remove-Item Env:VT121_SOURCE_BASELINE -ErrorAction SilentlyContinue
npx playwright test tests/e2e/vt121-load.spec.ts --project=desktop-chromium --retries=0 --repeat-each=3 --reporter=line
# Repeat separately with a clean immutable checkout of 4eb31d3:
$env:VT121_SOURCE_BASELINE='ABSOLUTE_PATH_TO_4eb31d3_CHECKOUT'
npx playwright test tests/e2e/vt121-load.spec.ts --project=desktop-chromium --retries=0 --repeat-each=3 --reporter=line
Remove-Item Env:VT121_SOURCE_BASELINE -ErrorAction SilentlyContinue
node --experimental-strip-types bench/importUndo200-v2.mjs
```

Select the installed revision with `PLAYWRIGHT_BROWSERS_PATH` if necessary;
use accessible TEMP/TMP and unique external test/report output directories.
First attempt used a restricted profile's nonexistent Chromium location and
failed all three browser launches before any workload. Those setup logs are
retained separately, not counted as 600 failed jobs or functional passes.
Rerun selected the already installed pinned browser; no package upgrade.

## Workflow and remaining acceptance

- Entire open/closed repository Issue inventory audited: no dedicated Undo /
  VT-121 / BTCN3 Issue. #84 restores traceability with exactly one assignee,
  explicit AC1–AC5/NFR/dependencies/evidence and unchecked acceptance boxes.
  Existing #16/#54/#55/#56 have different scope. Public branch/history retained;
  no attempt to retroactively claim Issue-first compliance. PR references #84
  without automatic closing while individual-assignment acceptance is open.
- TV1 latest review APPROVED at implementation HEAD, static-only; its text
  still asks for explicit shared Playwright/transport sign-off. Approval must
  not be interpreted as that separate disposition or as approval of later docs.
- TV3 latest CHANGES_REQUESTED: no new blocking production defect, NFR gate open.
- TV5 re-reviewed on 05/11, confirmed same-file fix and **resolved its own P2
  thread**. Its latest CHANGES_REQUESTED now concerns NFR, not same-file retry.
  Do not ask for a redundant fix or resolve/dismiss another reviewer's gate.
- Exact implementation-HEAD Verify/CodeQL/Analyze were SUCCESS at live audit.
  New documentation revision requires its own CI and reviewer acknowledgement.
- No source/config/dependency/schema/hash/engine changes. No approval, merge,
  thread resolution, Issue closure, deployment, tag or protection change.
  Submission PDF/ZIP, RED/GREEN and immutable evidence remain unchanged.

Functional evidence is complete for the defined UI/port slice, subject to
independent human acceptance. Technical-review completion and workflow are
pending final-revision reviewer/owner handling. NFR acceptance is false until
conforming accepted-workload evidence or an authorized decision actually exists.

## Actual local regression verification on 05/11

`npm run verify` completed exit0 on the unchanged implementation plus these
documentation updates: source typecheck PASS, test typecheck PASS, 336/336
unit/integration tests across 26 files PASS, **102 E2E PASS /12 capability
SKIP**, production build PASS (211 modules; existing bundle-size advisory).
Normal HTTP, desktop/mobile Chromium, workers=1, retries=0; no flaky/retry
entry or failed test. Performance ran earlier, separately. Raw `verify.log`
is retained with the external evidence. This does not turn GPU skips or the
excluded performance gate into passes. Remote checks must match the actual
new documentation commit; the implementation-HEAD CI is historical evidence.

Focused normal-HTTP command also executed separately with retries=0:
`npx playwright test tests/e2e/presetReselect.spec.ts tests/e2e/undoImportV2.spec.ts --retries=0`:
**26/26 PASS**, desktop/mobile, 29.1s, no skip/retry/failure. Raw `focused.log`
is retained externally. The submitted PDF's SHA-256 still matches its original
manifest (`b0f7eedf9e3e23b59c8c79966576d155bbb884e7266c500a2f9321ddc7959459`).

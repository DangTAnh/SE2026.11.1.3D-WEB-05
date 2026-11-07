# VT-120 engineering record

Student: Đặng Thế Anh, 23001821. Original tests/data/mutation/plan/reflection
for VT-120, not copied from VT-121/VT-123. Spec and assumptions:
[VT120-spec-plan.md](VT120-spec-plan.md).

## Executed checkpoints

Baseline f00271e06347c5a4c88ebeffc00ca4c2134a7651; RED e626654;
GREEN 184cdd2. Subsequent test-oracle review changes preserve production code.
Windows, Node 24.19.0, Vitest 5.0.3, fast-check 4.10.2, coverage-v8 5.0.3.
The assignment URL redirects to the configured DangTAnh repository.

| Experiment | Actual result | Evidence file (external package) |
|---|---|---|
| First RED | 15 FAIL/1 PASS; test harness also had one late-attached rejection | 01-red.log |
| Clean RED subset after harness correction | 5 FAIL for unimplemented feature; 11 excluded, no unhandled rejection | 02-red-clean.log |
| First GREEN | 16/16 PASS incl. 200 PBT scenarios | 03-green.log |
| Integration GREEN | 19/19 PASS, independent clients/conflict/response loss | 04-green-integration.log |
| Mutation before review | T04 + T13 both FAIL; mutation killed | 06-mutation-pinned.log |
| Initial coverage | 291/291 repository tests; module 96.96% lines/97.36% branches | 07-coverage-full.log |
| Reviewed coverage | 297/297 tests, module 100% lines/branches/functions/statements | 09-coverage-reviewed.log |
| Reviewed mutation | T04 + T13 both FAIL with corrected oracle | 10-mutation-reviewed-tests.log |
| Shuffled/reseeded repeats | 3/3 runs, 25/25 tests each; 200 generated cases per seed | flake-23001821/20261107/12088080.log |
| Load, five rounds | 5/5 PASS; each 80 tasks/0 errors/80 effects/160 calls | load-1..5.json and logs |
| Full verify, completed restart | exit0, both typechecks, 297 units, 76 E2E PASS/12 capability SKIP, 6.7min, build PASS | 12-full-verify-restart.log + full-verify-result.json |

The first full-verify session ended without an observable exit ledger, after 21
listed browser cases; it is INCOMPLETE, not a complete pass/failure. A fresh
normal-HTTP run completed with a separate exit JSON: exitCode 0. One Playwright
worker, local retries=0; no actual retry/flaky entry. The 12 skips are capability/
platform skips, not proof of physical WebGPU or GPU parity. Full source/test
typechecks and build also passed. Existing chunk advisory remains.

Load p95 ms, every run retained: 41.2880, 40.6502, 45.2277, 49.6524,
25.8876. Range 25.8876..49.6524 ms <2500ms. These are individual campaign
observations, not a claimed improvement or a real-user service SLO. The first
load overlapped the final repeat process briefly; all rounds and their raw
latencies are retained, with no cherry-picking.

The initial mutation worktree had no node_modules junction. An attempted npx
invocation fetched a temporary newer CLI and failed config loading; that is
setup failure, NOT mutation evidence. Junction corrected, pinned offline
Vitest 5.0.3 rerun produced the expected assertion failures. Dependencies in the
submission branch remain pinned; no temporary CLI change entered its lockfile.

## Mutation and oracle strength

Mutant e1142f8 changes exhaustion/permanent rejection to a fabricated success
receipt. It is in a separate local-only worktree/branch, not submission history.
T04 rejects this with "promise resolved instead of rejecting". T13 shrinks:

```text
seed: 23001821; path: 0:0:0:0:1
document data: {count:1000, speed:100, name:" "}
faults: ["before"]; maxAttempts:1; shrunk 4 times
expected: rejection and no confirmed receipt/ledger effect
mutant: resolves committed:true although nothing persisted
```

Two AI-generated test shapes initially looked plausible but were not trustworthy:
(1) a receipt changing multiple fields cannot detect removal of one field check;
(2) assertions inside the operation try/catch can be caught as expected failures.
Module-limited review identified both. Add independent canonical/committed cases,
capture promise outcome first, assert outside the catch, and require matching
ledger/local confirmation/exactly one effect on success. The final mutation
rerun still fails both T04 and T13. Coverage alone would not have exposed the
second oracle defect, despite near-complete execution.

## Flake/risk review

- Time: T11 uses fake timers and immediate attached rejection handling, not an
  arbitrary real sleep assertion. Real load timings remain scheduler-dependent;
  passing this machine does not establish a deterministic production p95.
- Order/shared state/randomness: every test/property has its own service ledger
  and client. Three shuffled suite seeds plus three explicit PBT seeds all pass;
  record seed/path to replay a failure. Property generation shrinks automatically.
- Network: no external call; injected faults and barriers force commit/response
  loss and concurrent interleavings. This removes network flakiness but cannot
  establish a real adapter's atomicity/timeout behavior.

## Traceability

| AC/risk | Tests | Actual files | Commit checkpoint/result |
|---|---|---|---|
| AC1 validation/snapshot | T01,T06,T09,T13 | tests/unit/preset-persistence.test.ts | e626654 RED ->184cdd2 GREEN; final oracle review PASS |
| AC2 retry/policy | T02,T04,T05,T11,T12/T12b | same | GREEN PASS; 3 shuffled repeats PASS |
| AC3 partial failure/dedupe | T03,T07,T09,T10,I01-I03 | unit + tests/integration/preset-persistence.test.ts | GREEN PASS, 80 clients/1 effect |
| AC4 no false success | T04,T08/T08b,T13,T14,I03 | same | mutant e1142f8 killed; corrected oracle PASS |
| AC5 scoped latency | T15 | tests/load/vt120-load.test.ts | 5 rounds PASS, 80 tasks, p95 <=49.6524ms |
| Module risk coverage | all above | src/presets/persistence.ts | 100% selected-module coverage; NOT whole app |

The load case has an independent effects/calls/receipt oracle and records failed
tasks before its assertions. No sample is silently dropped from an accepted
round. API and product E2E are not applicable to this new in-process slice.
Existing browser regression is a separate full-verify checkpoint.

## AI Usage Log and review

1. User supplies VT-120 assignment, repository and constraints. Primary Codex
   audits architecture/workflow/preset API; does not reuse another student's
   deliverable. Student must read and own final code/report.
2. Separate agent fork_turns=none gets ONLY module API descriptions and VT-120
   requirements, with explicit ban on filesystem/browser reads. Its assumptions
   and prompt are recorded in spec-plan. Plan existed before implementation.
3. Primary coordinator reviews plan against repository: correct discovery paths,
   no real persistence/API, full-document identity and no fictional deadline.
   Repository-level context belongs to this reconciliation step; we do not claim
   the entire pre-existing coordinator conversation was context-restricted.
4. Codex creates original RED tests + explicit contract stub (e626654), then a
   small coordinator patch (184cdd2). Diff reviewed: validation before I/O,
   stable request, pending coalescing, key reservation, matching receipt, retry
   only known transient errors; no GPU/schema/runtime dependency change.
5. The SAME restricted agent may then inspect ONLY persistence.ts, its unit and
   integration tests, and vt120-service.ts. It identifies two oracle gaps above.
   It receives no other student's files, broader history or load evidence.
6. Primary applies oracle corrections and executes coverage/mutation/repeats/
   load. Final module-limited AI review: no remaining actionable correctness
   finding under the declared port assumptions. The reviewer ran no tests and
   did NOT review the separate load harness; its review is not human approval.
7. PDF/report synthesis uses the actual command outputs and explicitly labels
   limits. No AI claim substitutes for execution, deployment or team acceptance.

Missing-context risk: module-only AI could assume a durable idempotent server
exists or prove exactly-once from a client cache. Architecture review rejects
both claims. The same limited reviewer cannot approve real-service performance
or authentication because those contracts were never supplied.

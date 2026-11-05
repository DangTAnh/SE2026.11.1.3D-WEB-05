# VT-123 — Evidence and traceability

All commands were run in `D:/subjects/SE` on Node 24.15.0 / npm, Vitest 5.0.3.
Raw logs are in [`evidence/`](evidence/).

## 1. Baseline and commits

| Item | Value |
|---|---|
| Baseline (initial commit) | `dev@8f7c3eeb74c7a9501332b265fa16a6aa552aa2b3` |
| RED test commit | `fd1bcfb1eae50fd609d8e1918c4a46eb55c3e0b4` — `test(review): add VT-123 reviewer and concurrency suite` |
| GREEN implementation commit | `be246d75d8e455db73255c8294fc6adfdd3d1208` — `feat(review): add preset review board with content-hash CAS` |
| Load harness commit | `48b13ceebc5a3f117215aa50be98c6de265f6d85` — `test(review): add 40-task p95 load harness` |
| Documentation | the commit that adds this file |

The branch is `feat/85-reviewer-role`, created from the baseline with
`git switch --no-track -c feat/85-reviewer-role origin/dev`.

## 2. RED — the tests fail before the code exists

```sh
npx vitest run tests/unit/review-workflow.test.ts
```

Result (`evidence/vt123-red.log`): **FAIL — 1 failed file, 0 tests**

```text
Error: Cannot find module '../../src/presets/review.ts'
       imported from D:/subjects/SE/tests/unit/review-workflow.test.ts
Test Files  1 failed (1)
Tests       no tests
```

This is the expected reason: the vertical slice does not exist at the baseline.
A second, behavioural RED is produced by the mutation in §4, which proves that
the tests are not merely checking that a file exists.

## 3. GREEN — implementation passes

```sh
npx vitest run tests/unit/review-workflow.test.ts
```

Result (`evidence/vt123-green.log`): **PASS — 18/18 tests**.

The first GREEN attempt exposed a defect in the AI-authored test itself: T02
used the v1 flat shape `document.simulation` instead of the v2
`document.config.simulation`, and `toThrow(TypeError)` passed anyway because
assigning to `undefined` also throws. Fixing the path made T02 assert the real
invariant. This is recorded as an unreliable-AI point in the usage log.

## 4. Mutation — remove the important validation

The mutation deletes the post-await CAS block in `PresetReviewBoard.#review`
(the version / content-hash / status re-check). The temporary patch was applied
to the working tree only and is **not** in any branch commit.

```sh
npx vitest run tests/unit/review-workflow.test.ts
```

Result (`evidence/vt123-mutation.log`): **FAIL — 3 failed, 15 passed**

```text
× [T05] approval with a wrong content hash is rejected and changes nothing
× [T08] forty concurrent approvals accept exactly one review
× [T09] a stale approval cannot land after a concurrent submission
Tests  3 failed | 15 passed (18)
```

The mutation is killed by both the deterministic interleaving (T09) and the
stress tests (T08), plus the direct wrong-hash test (T05). After restoring the
file, the suite is 18/18 again (`evidence/vt123-green-after-restore.log`).

## 5. Coverage (context, not a quality score)

```sh
npx vitest run tests/unit/review-workflow.test.ts --coverage \
  --coverage.include=src/presets/review.ts --coverage.reporter=text
```

Result (`evidence/vt123-coverage.log`): **100% statements (43/43), branches
(30/30), functions (10/10), lines (42/42)** for `src/presets/review.ts`.

Coverage is reported as context only. The risk coverage is the mapping in §7:
every acceptance criterion and the race risk have executed assertions, including
the failure paths. A high line percentage alone would not show that a stale
approval is rejected; T09 does.

## 6. Flaky-risk experiment and load

**Repeat runs.** The review suite was run 20 consecutive times:

```sh
for i in $(seq 1 20); do npx vitest run tests/unit/review-workflow.test.ts; done
```

Result (`evidence/vt123-repeat.log`): **0 failures / 20 runs**.

**40-task load.** `npm run test:load` ran four times. Each task submits a
revision with retry, then approves the current pending revision with retry.

| Run | Operations | Conflicts | p50 (ms) | p95 (ms) | p99 (ms) | Max (ms) | Threshold |
|---|---|---|---|---|---|---|---|
| 1 | 859 | 779 | 92.0 | 274.0 | 304.1 | 304.1 | 1500 |
| 2 | 863 | 786 | 60.8 | 256.1 | 288.2 | 288.2 | 1500 |
| 3 | 864 | 786 | 74.9 | 262.3 | 304.5 | 304.5 | 1500 |
| 4 | 865 | 787 | 103.0 | 300.0 | 330.0 | 330.0 | 1500 |

**Result: PASS in all four runs** (p95 256–300 ms, 5× below the target), with
`finalVersion = 40` and no unexpected errors.

**Limits of this result.** One Node process, an in-memory board, a fixed 1 ms
simulated store round-trip, no network, database, browser, GC pressure or real
accounts. The 40 promises interleave on one event loop rather than executing in
parallel. This demonstrates the harness and the domain's contention behaviour;
it does **not** prove production capacity or a p95 for real users.

## 7. Traceability

| AC / NFR / risk | Test(s) | Test file | Commit | Result |
|---|---|---|---|---|
| AC1 read + approve/reject | T03, T04, T12, T17 | `tests/unit/review-workflow.test.ts` | `fd1bcfb`, `be246d7` | PASS |
| AC2 reviewer cannot modify data | T01, T02 | same | `fd1bcfb`, `be246d7` | PASS |
| AC3 no lost update | T06, T07, T08, T14 | same | `fd1bcfb`, `be246d7` | PASS |
| AC4 exact version + content | T05, T09, T13, T15, T16, T18 | same | `fd1bcfb`, `be246d7` | PASS |
| AC5 atomic failure | T10, T11 | same | `fd1bcfb`, `be246d7` | PASS |
| NFR1 40 tasks, p95 ≤ 1.5 s | load harness | `tests/load/review-load.test.ts` | `48b13ce` | PASS (p95 ≤ 300 ms) |
| NFR2 determinism | 20 repeat runs; T09 uses gates | same | — | PASS (0/20 failures) |
| NFR3 architecture | existing fitness test; import review | `tests/unit/fitness-architecture.test.ts` | — | PASS |
| NFR4 auditability | T03, T12 | `tests/unit/review-workflow.test.ts` | `fd1bcfb`, `be246d7` | PASS |
| Race risk (stale approval) | T09, mutation log | same | `be246d7` | PASS; mutation killed |

## 8. Full regression and G0

```sh
npm run typecheck        # PASS
npm run typecheck:tests  # PASS
npm test                 # PASS — 283/283 tests, 25 files
npm run build            # PASS — 209 modules
```

The full suite includes the existing 265 tests plus the 18 new ones
(`evidence/vt123-full-unit.log`, `evidence/vt123-build.log`).

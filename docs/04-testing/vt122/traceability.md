# VT-122 traceability

Requirement source: Issue #90 and `specification.md`.

## Acceptance criteria → tests

| AC | Production rule | Tests | Evidence |
| --- | --- | --- | --- |
| AC1 one effect on replay | replay cache (`save` lines 62–70), in-flight promise (73–99) | T01, T02, T03, T06, T09, T10, T12, T23 | `green-targeted.txt`, `green-final.txt`, `pairwise.txt` |
| AC2 conflict | canonical compare + `SaveConflictError` (68) | T04, T13, P02/P09/P11 | `green-targeted.txt`, `mutation-full.txt` |
| AC3 validation before port | `assertRequestId` with `typeof` guard (36, 117–121), `serializePresetDocument` (58) | T07, T08, P05–P08, P12, P13 | `review91-t07.txt`, `review91-t07-red.txt`, `pairwise.txt` |
| AC4 inclusive boundary | `#expired` → `now > expiresAt` (112–114) | T05, T14, T22, P01, P11, P14, P18 | `mutation-survive.txt`, `mutation-killed.txt`, `coverage.txt` |
| AC5 failures never confirm | receipt validation (79–82, 123–131), failed state (89–93) | T09, T10, T11, T23, T24, P03/P15/P16/P17 | `green-targeted.txt`, `ai-candidates-after.txt` |

## Risk → tests

| Risk | Tests |
| --- | --- |
| R1 duplicate effect | T02, T03, T06, T09, T12, T16, T17 |
| R2 same id / different content | T04, T13, pairwise rows with `prior=committed-different` |
| R3 off-by-one expiry | T05, T14, T22, mutation experiment |
| R4 lost response / bad receipt | T09, T11, T23, T24, pairwise receipt rows |
| R5 restart/process | **NOT_RUN** — documented limitation |
| R6 cache growth | T22 checks pruning on access; no sweep test |
| R7 fake-store overclaim | Scope statement in README, PR and report |

## Code → tests (coverage)

| Code area | Tests |
| --- | --- |
| constructor options / retention range (47–54) | T20, T22 |
| request-id guard (117–121), including non-string runtime values | T07, P08 |
| canonical serialize / document validation (58) | T08, P01/P04/P09/P13 |
| replay + conflict (62–70) | T02, T04, T05, T06, T13, T14, P10/P11/P14 |
| in-flight sharing (70, 77–99) | T03, T12 |
| receipt validation (79–82, 123–131) | T11, T23, T24, P03/P05–P07/P12/P15–P17 |
| failed state (89–93) | T09, T10, T13, T23, T24, P03/P15–P17 |
| `confirmed()` boundary (102–110) | T14, T21, T22 |

Targeted coverage is 100% statements (54/54), branches (36/36), functions
(11/11) and lines (50/50) for `src/presets/resubmission.ts`.

## Commands → evidence

| Command | Evidence file | Result |
| --- | --- | --- |
| targeted Vitest before implementation | `evidence/red.txt` | 12 failed / 3 passed |
| targeted Vitest after implementation | `evidence/green-targeted.txt` | 15/15 passed |
| `npm test` after implementation | `evidence/green-full.txt` | 287/287 passed |
| `npm test` after pairwise | `evidence/green-full-after-pairwise.txt` | 305/305 passed |
| `npm test` final | `evidence/green-final.txt` | 310/310 passed |
| pairwise suite | `evidence/pairwise.txt` | 18/18 passed |
| coverage command | `evidence/coverage.txt` | 100% / 100% / 100% / 100% |
| 20 shuffled runs | `evidence/flaky-shuffle.txt` | 20/20 runs, 36/36 each |
| mutant T02 | `evidence/mutation-survive.txt` | pass (survives) |
| mutant T05 | `evidence/mutation-killed.txt` | fail (killed) |
| mutant full targeted | `evidence/mutation-full.txt` | 5 failed / 31 passed |
| load run 1–3 | `evidence/unique.json`, `duplicates.json`, `serialized-control.json`, `load-run2/`, `load-run3/` | p95 within target for unique/duplicates; control > target |
| AI candidates before | `evidence/ai-candidates-before.txt` | 6/6 passed yet weak |
| strengthened recovery | `evidence/ai-candidates-after.txt` | 2/2 passed |
| T07 red with guard reverted | `evidence/review91-t07-red.txt` | 1 failed (promise resolved for `undefined`) |
| T07 green after fix | `evidence/review91-t07.txt` | 1/1 passed |
| Review P2 fix summary | `evidence/review-91-fix.md` | root cause, fix, red/green, re-review |
| `npm run build` | `evidence/build.txt` | typechecks + build PASS |
| full E2E regression | `evidence/e2e.txt` | 75 passed, 12 skipped, 1 failed (mobile teardown) |
| single E2E rerun | `evidence/e2e-rerun.txt` | same mobile teardown timeout |

## Baseline → branch

| Item | Value |
| --- | --- |
| Baseline `origin/dev` | `f00271e06347c5a4c88ebeffc00ca4c2134a7651` |
| Issue | #90, assignee Terivn |
| Branch | `feat/90-idempotent-preset-resubmit` |
| Draft PR | [#91](https://github.com/DangTAnh/SE2026.11.1.3D-WEB-05/pull/91), base `dev` |
| Commits | `217a9d9` RED, `4417683` GREEN, `ed0805a` pairwise/load, `352b6cc` coverage/flaky, `04b5ba4` AI candidates, `81b98d5` strengthen, `86cb9eb` mutation evidence, `e50534e` docs, `cec1327` PR link, `f88a94b` review P2 fix |
| Mutant | `eb1b1d320484813aeb9f23d89c552185d514a130` on local `temp/vt122-mutation` only |

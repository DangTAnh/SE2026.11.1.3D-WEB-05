> Raw output paths below identify historical archived files: [immutable evidence and SHA-256 manifest](VT121-evidence-archive.md). They are no longer tracked in the current tree.

> Historical design/execution narrative below refers to the pre-publication campaign; current publication status is recorded at the end.

# VT121 v2 test strategy and matrix


AC1: validated import stores independent complete document snapshot only after config apply commits. AC2: Undo restores nested config and optional name once; unavailable initially/after consumption. AC3: parser/file rejection preserves state/history. AC4: client capability required on import, Undo, inspection, invalidation. AC5: edits/backend apply attempts invalidate history and pending reads; stale results/errors are silent; partial apply recovers conditionally. A post-commit reset warning retains applied config and Undo opportunity, preserving existing app contract; committed Undo with reset warning consumes the snapshot because config restoration succeeded.

Constraints: no schema/RendererPort/GPU/dependency/framework changes; accessible native Undo and existing live-region toast; deterministic deferred promises and isolated tests. Performance target 200 tasks/users p95<=5s, with controller/browser/real-user scopes reported separately. No API/accounts exist; API tests NOT_APPLICABLE.

| ID | Requirement/risk | Level | Input/precondition | Expected | Priority | Actual test file | Result |
|---|---|---|---|---|---|---|---|
| S1 | AC1/2 deep snapshot | unit+Ajv | named nested document, mutate alias | exact full original document restored once | P0 | tests/unit/importUndoV2.test.ts | PASS |
| B1 | count BVA | integration | 999/1000/1001/1500/65536/499999/500000/500001/1000.5 | reject/accept/accept/accept/accept/accept/accept/reject/reject | P0 | tests/unit/importUndoV2.test.ts | PASS |
| B2 | speed BVA/precision | integration | .099/.1/.101/2.999/3/3.001/1.0001 | reject/accept/accept/accept/accept/reject/reject | P0 | tests/unit/importUndoV2.test.ts | PASS |
| B3 | size BVA/precision | integration | .999/1/1.001/7.999/8/8.001/2.5001 | reject/accept/accept/accept/accept/reject/reject | P0 | tests/unit/importUndoV2.test.ts | PASS |
| B4/B5 | both mode strengths | integration | .199/.2/.201/3.999/4/4.001/1.5001 | reject/accept/accept/accept/accept/reject/reject | P0 | tests/unit/importUndoV2.test.ts | PASS |
| B6 | missing/empty/version | integration | missing nested speed, empty string, JSON string,0,{},bad JSON,v1,v3 | rejection preserves exact current/prior history | P0 | tests/unit/importUndoV2.test.ts | PASS |
| B7 | document name BVA | integration | lengths0/1/80/81 | reject/accept/accept/reject | P1 | tests/unit/importUndoV2.test.ts | PASS |
| S2 | sequence/name absence | unit | A then B | undo to A, absent name preserved | P0 | tests/unit/importUndoV2.test.ts | PASS |
| S3 | stale history | unit/UI | manual edit after import | Undo invalidated | P0 | tests/unit/importUndoV2.test.ts; tests/e2e/undoImportV2.spec.ts E3 | PASS |
| S4 | Undo validation bypass | integration | current snapshot speed99 | reject before apply/history save | P0 | tests/unit/importUndoV2.test.ts | PASS |
| AUTH1 | unauthorized import | unit | wrong capability | denied, exact state/history remain | P0 | tests/unit/importUndoV2.test.ts | PASS |
| AUTH2 | unauthorized Undo | unit+mutation | imported doc; wrong capability | denied, owner still restores snapshot | P0 | tests/unit/importUndoV2.test.ts | PASS (mutation result logged separately) |
| AUTH3 | history ownership | unit | wrong read/invalidate | denied, history retained | P1 | tests/unit/importUndoV2.test.ts | PASS |
| FAIL1/2 | before/partial apply | unit | exception before write or after nested/name writes | rollback full doc; prior history retained | P0 | tests/unit/importUndoV2.test.ts | PASS |
| FAIL3 | Undo partial failure | unit | partial write then throw | imported state recovered, history retained/retry works | P0 | tests/unit/importUndoV2.test.ts | PASS |
| FAIL4 | rollback failure | unit | apply+rollback throw | AggregateError with both errors; no atomicity claim | P0 | tests/unit/importUndoV2.test.ts | PASS for defined failure contract |
| FAIL5 | reset after commit | unit/existing E2E | config commits then reset throws | history reflects committed config; existing reset semantics retained | P0 | tests/unit/importUndoV2.test.ts; existing ui-port.spec.ts/ui.spec.ts | PASS |
| FILE1 | byte-size BVA | helper+real Ajv | 0/1/999999/1000000/1000001 B | empty reject/schema reject/valid accept/valid accept/reject before read | P0 | tests/unit/presetFileV2.test.ts | PASS |
| FILE2 | actual read error | helper | latest text() rejects | error shown, state/history unchanged | P1 | tests/unit/presetFileV2.test.ts | PASS |
| RACE1 | stale async | helper | valid/invalid/rejected A completes after B | B remains, no stale error/success toast | P0 | tests/unit/presetFileV2.test.ts | PASS |
| RACE2 | dispose/edit | helper | invalidate deferred read | no subsequent apply/notification | P0 | tests/unit/presetFileV2.test.ts | PASS |
| E1 | full document and port | browser/UI-port | import changes mode/count, Undo | exact export and port config restored; disabled second Undo | P0 | tests/e2e/undoImportV2.spec.ts | PASS desktop/mobile |
| E2 | real UI file limits | browser/UI-port | 1MB valid then empty/0/{}/bad/oversize | unchanged full export/history; Undo still works | P0 | tests/e2e/undoImportV2.spec.ts | PASS desktop/mobile |
| E3 | actual File.text race | browser/UI-port | deferred valid/invalid A after B; manual edit | stale error silent before export, B wins; edit disables Undo | P0 | tests/e2e/undoImportV2.spec.ts | PASS desktop/mobile |
| E4 | UI/port partial failure | browser/UI-port | FakeRenderer apply writes then throws, also Undo failure | UI and last port request recover; history correct | P0 | tests/e2e/undoImportV2.spec.ts | PASS desktop/mobile |

Primary oracles: explicit schema-v2 values and before-operation deep documents, not duplicated controller logic. E4 is port/config evidence, not physical GPU resource rollback. Selected Node coverage tests import actual .ts source using built-in type stripping; percentages do not cover app/bindings or whole project. Regression includes all original assertions; optional transport changes only their fixture import.

Flaky review: controlled microtasks/deferred reads (no arbitrary sleeps in new tests), fresh controller/document per test, shuffled seeds121–123, no external-font/network assertions, explicit Vite/Chromium transport, retries0. Existing GPU timing waits remain untouched. HMR transport failures are preserved rather than filtered from pageErrors.

## Publication verification — 02/11/2026

VERIFIED: [PR #81](https://github.com/DangTAnh/SE2026.11.1.3D-WEB-05/pull/81) OPEN, isDraft=true, base=dev, published HEAD 247781de4c90df52f54a6e0327e3dfaf7931a0d0. Fetch succeeded; merge-base with current origin/dev is 8f7c3eeb74c7a9501332b265fa16a6aa552aa2b3. Dev synchronization completed in merge commit 247781de4c90df52f54a6e0327e3dfaf7931a0d0. No rebase/force-push/merge of PR.

VERIFIED historical post-publication execution at that merge: 336 unit/integration PASS; 84 E2E PASS, 12 capability SKIP; 8 focused Undo PASS retries=0; typechecks/build PASS. Commands and exit0 are preserved in external handoff output/VT121-final/logs/publication-result.json and publication-original.log. These are not new executions in finalization.

VERIFIED CI on published merge: CI verify SUCCESS [run 41412349557](https://github.com/DangTAnh/SE2026.11.1.3D-WEB-05/actions/runs/41412349557); CodeQL SUCCESS. Finalization HEAD checks must be read separately from external VT121-pr-ci-status.md; do not transfer this PASS to a later SHA. Human review PENDING: reviews=[], reviewRequests=[] at API inspection. New finalization verification is logged separately. Overall REVIEW_PENDING; real-user SLO NOT_VERIFIED.

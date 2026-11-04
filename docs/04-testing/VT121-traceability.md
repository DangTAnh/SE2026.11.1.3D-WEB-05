> Raw output paths below identify historical archived files: [immutable evidence and SHA-256 manifest](VT121-evidence-archive.md). They are no longer tracked in the current tree.

> Historical design/execution narrative below refers to the pre-publication campaign; current publication status is recorded at the end.

# VT121 traceability — schema v2

Commit key: baseline cached-dev2389f0f550b33899801e1ab07c6312baea0c9faf; REDbfd124749412e93d32b4048d0fd6173bb4f58cb9; featureGREENe808d70a792ffb377c8b310f8f9e0bb441ba5dc0. Verification configuration follow-up: e7b72e7 (full SHA recorded in final handoff). Latest dev integrated; see publication verification below. Historical v1 results are separate, never substituted for v2.

| AC/risk | Case IDs | Actual test file | Commit | Result | Evidence |
|---|---|---|---|---|---|
| Missing Undo | E1 | tests/e2e/undoImportV2.spec.ts | baseline / REDbfd1247 | expected FAIL after successful import/export, missing button | output/VT121-final/logs/03-red.log |
| AC1 validated deep snapshot | S1,S2,E1 | tests/unit/importUndoV2.test.ts; tests/e2e/undoImportV2.spec.ts | GREENe808d70 | PASS | output/VT121-final/logs/04-green.log; output/VT121-final/logs/04-green-final-feature.log |
| AC2 exact document/once | S1,S2,E1 | same | GREENe808d70 | PASS | same |
| AC3 actual-schema boundaries | B1–B7 | tests/unit/importUndoV2.test.ts | GREENe808d70 | PASS | output/VT121-final/logs/04-green.log; output/VT121-final/logs/08-unit-1.log |
| AC3 file byte boundaries | FILE1,E2 | tests/unit/presetFileV2.test.ts; tests/e2e/undoImportV2.spec.ts | GREENe808d70 | PASS | output/VT121-final/logs/04-green-final-feature.log; output/VT121-final/logs/08-unit-1.log |
| AC4 internal capability | AUTH1–AUTH3 | tests/unit/importUndoV2.test.ts | GREENe808d70 | PASS | output/VT121-final/logs/08-unit-1.log |
| AC4 deliberate Undo guard removal | AUTH2 | tests/unit/importUndoV2.test.ts | temporary uncommitted diff from GREEN | mutation KILLED, expected FAIL exit1 | output/VT121-final/logs/06-mutation.log; VT121-v2-mutation.patch |
| AC5 partial recovery | FAIL1–FAIL4,E4 | tests/unit/importUndoV2.test.ts; tests/e2e/undoImportV2.spec.ts | GREENe808d70 | PASS for defined conditional contract | output/VT121-final/logs/04-green-final-feature.log; output/VT121-final/logs/08-unit-1.log |
| AC5 committed reset warning | FAIL5, existing ui-port/ui tests | tests/unit/importUndoV2.test.ts; tests/e2e/ui-port.spec.ts; tests/e2e/ui.spec.ts | GREENe808d70 | PASS | output/VT121-final/logs/04-green.log; output/VT121-final/logs/05-regression.log (these individual cases passed) |
| AC5 stale edits/async lifecycle | S3,RACE1,RACE2,E3 | tests/unit/importUndoV2.test.ts; tests/unit/presetFileV2.test.ts; tests/e2e/undoImportV2.spec.ts | GREENe808d70 | PASS | output/VT121-final/logs/04-green-final-feature.log; output/VT121-final/logs/08-e2e-1.log |
| No validation bypass | S4 | tests/unit/importUndoV2.test.ts | GREENe808d70 | PASS | output/VT121-final/logs/04-green.log |
| Full regression | all existing+new | package.json verify scripts | verification e7b72e7 | PASS exit0:312 unit +84 E2E PASS/8 SKIP; earlier failures retained | output/VT121-final/logs/05-regression-isolated.log |
| Source coverage | 2 supplementary Node tests | tests/unit/importUndoV2.node.test.mjs | GREENe808d70 source | 100% selected modules, NOT whole-project | output/VT121-final/logs/07-coverage.log; final rerun output/VT121-final/logs/07-coverage-final.log |
| Flaky/order | all312 unit;8 focused browser | above tests | GREENe808d70 | 3 rounds each PASS, retries0; shared artifact issue documented | output/VT121-final/logs/08-flaky.log; per-round logs |
| Performance |200 Node sessions and200 submitted browser jobs | bench/importUndo200-v2.mjs; tests/e2e/vt121-load.spec.ts | GREENe808d70 | measured scope only; real-user SLO NOT_VERIFIED | output/VT121-final/logs/09-performance-isolated.log; output/VT121-final/logs/09-browser-performance-fixed.log |
| API | — | no API exists | — | NOT_APPLICABLE | architecture scope |
| Dev / publication / CI | integration | merge history | 247781d | dev integrated; PR OPEN Draft; initial CI SUCCESS | PR #81; external handoff `logs/run-initial.log` |
| Human review | — | — | — | HUMAN_REVIEW_PENDING | VT121-independent-ai-review.md is AI only |

All file names in this table identify actual source files preserved in the Git bundle and source snapshot. Earlier reporter trace/video paths embedded inside raw logs are ephemeral; not all were retained after concurrent campaigns. The saved logs and RED screenshot are retained evidence, not claims that every reporter attachment remains available.

Risk coverage is mapped to all5 AC groups for this exact cached-v2 contract. It does not establish global rollback atomicity, physical GPU recovery/performance, live HTTP deployment, latest remote integration or real200-user SLO. Those remain explicit limits.

## Publication verification — 02/11/2026

VERIFIED: [PR #81](https://github.com/DangTAnh/SE2026.11.1.3D-WEB-05/pull/81) OPEN, isDraft=true, base=dev, published HEAD 247781de4c90df52f54a6e0327e3dfaf7931a0d0. Fetch succeeded; merge-base with current origin/dev is 8f7c3eeb74c7a9501332b265fa16a6aa552aa2b3. Dev synchronization completed in merge commit 247781de4c90df52f54a6e0327e3dfaf7931a0d0. No rebase/force-push/merge of PR.

VERIFIED historical post-publication execution at that merge: 336 unit/integration PASS; 84 E2E PASS, 12 capability SKIP; 8 focused Undo PASS retries=0; typechecks/build PASS. Commands and exit0 are preserved in external handoff output/VT121-final/logs/publication-result.json and publication-original.log. These are not new executions in finalization.

VERIFIED CI on published merge: CI verify SUCCESS [run 41412349557](https://github.com/DangTAnh/SE2026.11.1.3D-WEB-05/actions/runs/41412349557); CodeQL SUCCESS. Finalization HEAD checks must be read separately from external VT121-pr-ci-status.md; do not transfer this PASS to a later SHA. Human review PENDING: reviews=[], reviewRequests=[] at API inspection. New finalization verification is logged separately. Overall REVIEW_PENDING; real-user SLO NOT_VERIFIED.

VERIFIED finalization rerun: `npx playwright test tests/e2e/undoImportV2.spec.ts --config=playwright.vt121.config.ts --workers=1 --retries=0`, optional transport enabled after external-request fix, 8 PASS, exit0. Raw log: `output/VT121-final/logs/11-finalization-focused.log`. Normal HTTP full verify is separate, tracked in external final-review/status; no new performance claim from this run.

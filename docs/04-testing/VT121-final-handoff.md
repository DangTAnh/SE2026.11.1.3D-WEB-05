# VT121 final handoff

Trần Duy Anh — MSSV23001828 — TV4 — SE2026-T30 — 3D-WEB-05 — VT-121.
Baseline2389f0f550b33899801e1ab07c6312baea0c9faf; REDbfd124749412e93d32b4048d0fd6173bb4f58cb9; GREENe808d70a792ffb377c8b310f8f9e0bb441ba5dc0.

VERIFIED historical RED: missing Undo after successful import/export, exit1 output/VT121-final/logs/03-red.log. Production controller absent from RED tree. GREEN adds guarded full-document Undo. Mutation removes only Undo guard; AUTH2 KILLED exit1 output/VT121-final/logs/06-mutation.log; safe source retains guard. Coverage100% line/branch/function only importUndo.ts/presetFile.ts, whole-app NOT_MEASURED.

Historical pre-merge312/84/8 results remain raw evidence. Post-merge336/84/12+focused8 commands and exit0 preserved in external handoff `logs/publication-result.json` and publication-original.log. Finalization reruns have separate logs; no old execution relabelled as new.

VERIFIED Node synthetic5×200 p9532.678–36.323ms; browser200 jobs/pool10 queue p9513.347999s exceeds5s, service-only .894348s. Real200-user SLO NOT_VERIFIED. GPU rollback PARTIAL; human review PENDING.

Canonical documents: docs/04-testing. Raw evidence: output/VT121-final/logs. Fourteen byte-identical document copies were removed only after ZIP archive verification; no unique log/test deleted. External VT121-submission-handoff contains archive, cleanup manifest, final review, current PR/CI status, Git bundle and final ZIP. Final HEAD/CI recorded externally after commit to avoid self-reference. No PDF edited, no PR merged.

## Publication verification — 02/11/2026

VERIFIED: [PR #81](https://github.com/DangTAnh/SE2026.11.1.3D-WEB-05/pull/81) OPEN, isDraft=true, base=dev, published HEAD 247781de4c90df52f54a6e0327e3dfaf7931a0d0. Fetch succeeded; merge-base with current origin/dev is 8f7c3eeb74c7a9501332b265fa16a6aa552aa2b3. Dev synchronization completed in merge commit 247781de4c90df52f54a6e0327e3dfaf7931a0d0. No rebase/force-push/merge of PR.

VERIFIED historical post-publication execution at that merge: 336 unit/integration PASS; 84 E2E PASS, 12 capability SKIP; 8 focused Undo PASS retries=0; typechecks/build PASS. Commands and exit0 are preserved in external handoff output/VT121-final/logs/publication-result.json and publication-original.log. These are not new executions in finalization.

VERIFIED CI on published merge: CI verify SUCCESS [run 41412349557](https://github.com/DangTAnh/SE2026.11.1.3D-WEB-05/actions/runs/41412349557); CodeQL SUCCESS. Finalization HEAD checks must be read separately from external VT121-pr-ci-status.md; do not transfer this PASS to a later SHA. Human review PENDING: reviews=[], reviewRequests=[] at API inspection. New finalization verification is logged separately. Overall REVIEW_PENDING; real-user SLO NOT_VERIFIED.

VERIFIED finalization rerun: `npx playwright test tests/e2e/undoImportV2.spec.ts --config=playwright.vt121.config.ts --workers=1 --retries=0`, optional transport enabled after external-request fix, 8 PASS, exit0. Raw log: `output/VT121-final/logs/11-finalization-focused.log`. Normal HTTP full verify is separate, tracked in external final-review/status; no new performance claim from this run.

VERIFIED finalization G0: `npm run build` (source/test typechecks + Vite build), exit0. Raw log: `output/VT121-final/logs/11-finalization-build.log`. Existing chunk-size warning retained; no dependency/config tuning to suppress it.

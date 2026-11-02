# VT121 final handoff — 2026-11-02

**STATUS: PARTIAL_COMPLETE.** Local cached-dev v2 implementation and verification complete; remote publication/latest-dev reconciliation remain blocked. Browser pool queue target also exceeded; real-user SLO is not verified. HUMAN_REVIEW_PENDING. No PDF was edited.

Student: Trần Duy Anh —23001828, TV4, SE2026-T30. Project3D-WEB-05, assignmentVT-121.

## Repository / history

- Repository: https://github.com/DangTAnh/SE2026.11.1.3D-WEB-05 (canonical origin verified locally; live API unreachable).
- Worktree: C:/Users/PC/.codex/.chatgpt-projects/g-p-6ac74c56e7fc8191bf607f753ba39a29/work/vt121-undo-import-v2
- Feature branch: feat/tv4-bt3-vt121-undo-import-v2; proposed target dev, confirmed from cached AGENTS/CONTRIBUTING workflow.
- Actual baseline: 2389f0f550b33899801e1ab07c6312baea0c9faf (cached origin/dev, NOT live remote HEAD).
- Supplied newer dev8f7c3eeb74c7a9501332b265fa16a6aa552aa2b3 object absent; fetch/ls-remote failed. Latest integration therefore PENDING.
- RED: bfd124749412e93d32b4048d0fd6173bb4f58cb9; genuine pre-production test execution, valid v2 import/export then FAIL missing Undo, exit1.
- GREEN feature: e808d70a792ffb377c8b310f8f9e0bb441ba5dc0.
- Verified source/test/config HEAD: e7b72e7b169de05617a99508e310bdf7c8f59df0; artifact isolation follow-up, production unchanged since GREEN.
- Final delivery HEAD: resolved after documentation commit in the package delivery ledger/results.json (see end of this handoff).
- GitHub branch URL/Draft PR URL: NOT_VERIFIED / NOT_CREATED_BY_THIS_RUN. No URL invented. isDraft unverified; CI NOT_RUN.
- Historical v1 preserved unchanged: baseline f37b3acf4783ef873d0a9fac043e9bcc42c1a087; RED7da2ad25c1a1744a229a55e6c759e1e596f05f02; GREEN388b915c741635d8d55b28287a161eebab892997; evidence2f8bc2cd6650476d15d8a72ba206f237378296dc. Separate history/v1 evidence is not v2 PASS proof.

## Actual final results

| Check | Result | Evidence |
|---|---|---|
| Baseline lockfile install/typechecks/unit | PASS,241 tests | logs/01-baseline-tests.log |
| Test-first RED | expected feature FAIL, exit1, missing accessible Undo | logs/03-red.log; red-v2-screenshot.png |
| Feature GREEN |312 unit/integration and8 focused browser PASS; typechecks/build PASS | logs/04-green.log; logs/04-green-final-feature.log |
| Final full verify | PASS exit0:312 unit/integration,84 E2E PASS,8 capability SKIP,0 FAIL; typechecks/build PASS | logs/05-regression-isolated.log |
| Authorization mutation | KILLED: AUTH2 expected FAIL, exit1; guard removed only in Undo | logs/06-mutation.log; VT121-v2-mutation.patch |
| Safe code after mutation | temporary branch/worktree deleted; full verify PASS afterwards | logs/06-mutation-cleanup.log; logs/05-regression-isolated.log |
| Source coverage | importUndo.ts + presetFile.ts each100% line/branch/function under2 supplementary Node tests; whole project NOT_MEASURED | logs/07-coverage-final.log |
| Flaky review |3×312 shuffled unit PASS;3×8 focused E2E PASS, retries0; shared artifact bug diagnosed/fixed, not hidden | logs/08-flaky.log; per-round logs |
| Node200 tasks |5 rounds,0 errors; p9532.678–36.323ms, synthetic only | logs/09-performance-isolated.log |
| Browser200 submitted tasks |0 functional errors; pool10; queue p9513.347999s, exceeds5s numeric target | logs/09-browser-performance-fixed.log |
| Real200-user SLO | NOT_VERIFIED;200 simultaneous browser contexts NOT_RUN | VT121-performance-results.md |
| API / human approval | NOT_APPLICABLE / HUMAN_REVIEW_PENDING | no API/accounts; AI review supplementary |
| Push / Draft PR / CI | BLOCKED_NETWORK / NOT_CREATED / NOT_RUN | logs/10-github-pr.log |

Environment: Windows10.0.26300, Node22.16.0/npm11.10.1, Git2.54.0.windows.1/gh2.103.3, Chromium156.0.8078.4, i5-12450HX/12 logical CPUs. Installed existing lockfile packages offline; no dependency/framework change. No engine/backend/RendererPort/schema changes.

## Failures preserved / interpretation

First full run:79PASS/8SKIP/5FAIL due Vite HMR WebSocket network errors. Baseline-source comparison reproduced desktop3; transport repaired without filtering pageerror or changing old assertions. Second simultaneous run:80PASS/8SKIP/4FAIL, all ENOENT during context teardown because verification campaigns shared test-results. This was an orchestration mistake; per-command artifact/HTML paths and isolated final run fixed it. These failures stay in logs/05-regression.log and05-regression-restored.log. Do not summarize them as unexplained source failures or erase them. Final verify above is a separate real execution, not a replaced log or retry setting.

## Diff / design decisions / limits

Five production files: full-document session controller; async reader helper; control bindings; native accessible Undo button; app reset-error phase marker. Initial LabConfig-only snapshot revised to full document including name. Generic rollback revised to preserve existing config-committed/reset-failed semantics. V1 numeric boundaries rejected for v2. Independent AI review corrected stale-toast evidence before export. All code/test edits are in Git; source snapshot is included for inspection.

Client Symbol is internal ownership only. Partial FakeRenderer writes prove UI/port request recovery if rollback succeeds, not physical GPU resource transactions. Generic rollback can fail explicitly; asynchronous backend effects are unproven. Test transport is not live TCP deployment proof. Current remote dev cannot be claimed integrated. README and remaining-risks describe these limits and reproducible commands. No merge/deployment/tag/credential reset/security-policy change occurred.

## Changed files through verified code HEAD

```text
bench/importUndo200-v2.mjs
docs/04-testing/VT121-initial-plan-original.md
docs/04-testing/VT121-plan-review.md
playwright.config.ts
playwright.vt121.config.ts
src/presets/importUndo.ts
src/ui/app.ts
src/ui/controls/controlBindings.ts
src/ui/controls/presetFile.ts
src/ui/template.ts
tests/e2e/backend-reinit.spec.ts
tests/e2e/backend.spec.ts
tests/e2e/renderer-adapter-webgpu.spec.ts
tests/e2e/renderer-adapter.spec.ts
tests/e2e/renderer-runtime-context-loss.spec.ts
tests/e2e/simulation-parity.spec.ts
tests/e2e/ui-live-status.spec.ts
tests/e2e/ui-port.spec.ts
tests/e2e/ui.spec.ts
tests/e2e/undoImportV2.spec.ts
tests/e2e/vt121-load.spec.ts
tests/e2e/vt121Transport.ts
tests/support/vt121Data.ts
tests/unit/importUndoV2.node.test.mjs
tests/unit/importUndoV2.test.ts
tests/unit/presetFileV2.test.ts
```

Final documentation/evidence files are an additional delivery commit; its SHA is recorded in the external package ledger after commit to avoid self-referential commit content. Production diff since GREEN is empty.

## Publication and PDF next steps

Network still fails DNS before HTTP: gh structured host state=error despite exit0; /user and repo query exit1; Git resolver exit128; curl exit6. Credentials UNVERIFIED, no observed401/403. Push/PR operations stopped, not the local assignment. Once network works, fetch/reconcile latest dev, verify issue/owner and permissions, query existing PR to avoid duplicates, push only the feature branch and create/verify a Draft PR into dev. Never merge without another person's review. No PR body draft is misrepresented as a created PR.

Use VT121-pdf-update-data.md and the301-word reflection draft for PDF update; student must review personal reflection. Do not enter a PR URL, real-user SLO PASS or whole-project100% coverage. ZIP evidence and complete real Git bundle preserve both v1/v2 histories. Git bundle is not a substitute for PR URL.

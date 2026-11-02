> Historical design/execution narrative below refers to the pre-publication campaign; current publication status is recorded at the end.

# VT121 diff review — cached-dev v2 candidate

Scope: base2389f0f; REDbfd1247; featureGREENe808d70; verification follow-up e7b72e7. Production change stays in five files: src/presets/importUndo.ts, src/ui/controls/presetFile.ts, src/ui/controls/controlBindings.ts, src/ui/template.ts, and two-line app.ts committed-reset-error classification. No engine/backend, RendererPort, schema, package or lockfile edits. Feature commit changes24 files/352 insertions/31 deletions, including new tests/bench and one-line imports in9 old browser specs. These import changes retain every old assertion and activate optional transport only when environment requests it. Follow-up changes only one config line to accept a unique outputDir.

Design: domain controller owns validated deep document snapshots, never UI/renderer internals. UI callbacks remain the existing apply path. Full document includes name; RendererPort receives config only. File reader is colocated in controls; monotonic request IDs suppress stale success/error and invalidate on edits/dispose. Error phase is explicit because old code commits config before reset. CommittedPresetError preserves established post-commit behavior; a generic partial apply failure attempts recovery. No global atomicity claim for arbitrary rollback or asynchronous GPU resources.

Correctness: real parser validates imports AND saved/current snapshots. History saves after successful config commit; generic failure leaves prior history. Owner guard precedes import/Undo/history access; exact Undo guard mutation is killed. Deep/inactive/name/camera/rendering values and absence of metadata are checked. Byte0/1/999999/1000000/1000001 and v2 numeric precision are tested from schema. Actual DOM deferred reads test stale valid/invalid; partial FakeRenderer writes followed by exception test UI/port recovery and retained Undo. It is not physical GPU resource recovery.

Evidence: pre-implementation E1 RED reached real v2 import/export then failed on missing Undo. Feature GREEN includes312 Vitest and8 focused desktop/mobile E2E, source/test typechecks/build. Initial full regression79PASS/8SKIP/5FAIL exposed HMR transport errors. Baseline-source comparison reproduced desktop3; local development-tool WebSocket routing fixed transport without filtering pageerror. Subsequent simultaneous full/repeat campaigns shared test-results and caused4 ENOENT teardown failures (80PASS/8SKIP/4FAIL). This was a verification-orchestration mistake, not an assertion failure: raw logs contain browserContext.close missing trace paths. Added unique outputDir per campaign and isolated HTML reports; final full rerun is recorded separately, not overwritten. Three shuffled unit/three no-retry focused E2E rounds passed. Final actual totals/status are authoritative in handoff.

Changes made after review:
1. Independent AI reviewer noticed export masks toast; E3 now asserts latest import toast before export after stale read release.
2. HMR false alone was insufficient; test transport accepts local HMR socket and ws:false disables its server socket. No app WebSocket was found; broad localhost matcher remains a documented future risk.
3. Test campaigns required independent artifact directories. playwright.config.ts optional VT121_TEST_OUTPUT and run.ps1 per-command directories remove shared artifact state, without retries or changed assertions.

Questionable claims rejected: LabConfig-only snapshot (loses name), shallow cloning (loses nested isolation), unconditional rollback on every throw (breaks committed-reset behavior), bundle coverage as source coverage, Symbol as server authorization, and Node200 tasks as real200 users. Each decision has corresponding source, test or log in plan/traceability.

Independent AI source/transport review found no other actionable defect. It did not independently execute the full suite and is not human approval. HUMAN_REVIEW_PENDING. Latest remote dev reconciliation/issue assignment/publication are blocked by network, not silently treated as complete. Rollback: revert feature and verification commits or close unmerged draft; never merge automatically.

Final outcome: isolated npm run verify exited0 with312 unit/integration,84 E2E PASS/8 capability SKIP, source/test typechecks and build PASS. No production source change after GREEN. Final browser load completed200 jobs without functional errors but queue-inclusive p95 exceeded5s; do not call the SLO PASS.

## Publication verification — 02/11/2026

VERIFIED: [PR #81](https://github.com/DangTAnh/SE2026.11.1.3D-WEB-05/pull/81) OPEN, isDraft=true, base=dev, published HEAD 247781de4c90df52f54a6e0327e3dfaf7931a0d0. Fetch succeeded; merge-base with current origin/dev is 8f7c3eeb74c7a9501332b265fa16a6aa552aa2b3. Dev synchronization completed in merge commit 247781de4c90df52f54a6e0327e3dfaf7931a0d0. No rebase/force-push/merge of PR.

VERIFIED historical post-publication execution at that merge: 336 unit/integration PASS; 84 E2E PASS, 12 capability SKIP; 8 focused Undo PASS retries=0; typechecks/build PASS. Commands and exit0 are preserved in external handoff output/VT121-final/logs/publication-result.json and publication-original.log. These are not new executions in finalization.

VERIFIED CI on published merge: CI verify SUCCESS [run 41412349557](https://github.com/DangTAnh/SE2026.11.1.3D-WEB-05/actions/runs/41412349557); CodeQL SUCCESS. Finalization HEAD checks must be read separately from external VT121-pr-ci-status.md; do not transfer this PASS to a later SHA. Human review PENDING: reviews=[], reviewRequests=[] at API inspection. New finalization verification is logged separately. Overall REVIEW_PENDING; real-user SLO NOT_VERIFIED.

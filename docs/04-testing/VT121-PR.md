# feat(tv4/vt121): safe one-step undo for v2 preset import

Valid preset import overwrites current edits. This v2 slice adds a one-step Undo that restores the complete validated PresetDocument (nested config and optional name), not only visible slider values.

## Scope / acceptance criteria

1. Successful validated import saves an independent prior document after config commit.
2. Undo restores the document through the existing UI/RendererPort path exactly once.
3. Invalid/missing/empty/oversize input preserves state/history; v2 BVA uses actual schema ranges and precision.
4. Client session capability guards import/Undo/history; unauthorized callers cannot consume snapshots.
5. Manual edits invalidate old history/pending reads; latest file request wins; partial apply is recoverable if rollback works. Post-commit reset warning keeps existing applied-config behavior and correct history.

Tested base: cached dev2389f0f550b33899801e1ab07c6312baea0c9faf. Target proposal dev per AGENTS/CONTRIBUTING. Latest remote dev is unverified because network/DNS fails; this draft must be reconciled with live dev before merge. No fabricated linked/closing issue; assignment/owner review PENDING. Original v1 history remains on its own branch, not merged into dev.

REDbfd124749412e93d32b4048d0fd6173bb4f58cb9 contains only plan/test/transport. Real pre-patch E1 imported/exported v2 successfully then failed on missing Undo. FeatureGREENe808d70a792ffb377c8b310f8f9e0bb441ba5dc0 adds the implementation; verification follow-up e7b72e7 isolates outputDir. No engine/RendererPort/schema/dependency/framework changes.

## Evidence

- 312 Vitest unit/integration tests PASS;8 focused desktop/mobile browser tests PASS; typechecks/build PASS (logs04-green and04-green-final-feature).
- Full final regression result is recorded in VT121-final-handoff.md and logs05-regression-isolated.log. Prior runs and their failures are preserved: HMR transport caused5 errors; simultaneous campaigns caused4 artifact ENOENT teardown errors. No assertion/retry masking.
- Undo guard mutation only: AUTH2 FAILS as expected, exit1; KILLED. No mutation commit; temporary worktree/branch removed. Safe-code tests repeated afterwards.
- Source-only Node coverage: importUndo.ts and presetFile.ts100% line/branch/function; not whole-project coverage, no Ajv inflation.
- Three shuffled312-test unit rounds and three focused8-test browser rounds PASS, retries0. Deferred File.text unit and real DOM tests cover stale valid/invalid/error outcomes.
- Performance tables and raw200-operation samples in handoff/logs09. Node experiment has5 rounds; browser integration is a separate capped-context experiment. Neither verifies200 real-user end-to-end p95<=5s.

Reproduction: docs/04-testing/BT3-VT121-README.md. Traceability, original plan, revisions, AI usage and self/independent AI review are retained in docs/04-testing and output/VT121-final. Browser tests use optional intercepted Vite transport due network restrictions; actual app/fixtures/schema execute, old assertions unchanged, local HMR handled as dev tooling. This is not live TCP deployment evidence.

## Limits / rollback / approval

Capability is module/harness ownership, not account/server authorization. Conditional rollback cannot prove physical GPU resource atomicity or arbitrary async recovery. FakeRenderer partial-write tests verify UI/port requests. Reset warning means config committed, not a rejected import. Physical GPU/200 real users/latest-dev integration remain unverified.

Rollback by reverting feature/verification commits or closing the unmerged draft. HUMAN_REVIEW_PENDING; independent AI review is supplementary. Do not merge, deploy, tag or mark human-approved automatically.

AI disclosure: Codex drafted the initial plan, patch and tests. Actual metadata/reset assumptions were revised from source evidence; independent AI review corrected the stale-toast oracle. Shared artifact mistakes and failed runs are preserved. See VT121-ai-usage-log.md and VT121-diff-review.md. Student reflection is a301-word draft for personal review.

Final isolated verification:312 unit/integration +84 E2E PASS/8 capability SKIP, exit0. Node p95 32.678–36.323ms; browser pool10 queue p95 13.347999s exceeds5s. Real200-user SLO NOT_VERIFIED.

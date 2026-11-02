## Student / scope
Trần Duy Anh · 23001828 · TV4 · SE2026-T30 · VT-121.
Adds one-step Undo for validated schema-v2 preset import, preserving the complete document and optional name. No schema, dependency, framework or GPU/backend change.

## Acceptance criteria and invariants
- Valid import captures a deep validated predecessor; Undo restores it once.
- Invalid JSON/schema/file boundaries preserve state and history.
- Internal ownership guard protects import/Undo/history; no account authorization claim.
- Manual edits and stale async file reads cannot resurrect obsolete history.
- Apply failures attempt recovery; committed reset warnings preserve existing app semantics.
Accessible native control/live-region feedback. Recovery is conditional if rollback fails or GPU side effects are asynchronous. NFR target:200 tasks/users p95≤5s, with measured scopes separated.

## History / implementation
Baseline `2389f0f550b33899801e1ab07c6312baea0c9faf`.
RED `bfd124749412e93d32b4048d0fd6173bb4f58cb9`; GREEN `e808d70a792ffb377c8b310f8f9e0bb441ba5dc0`.
Published integration HEAD `247781de4c90df52f54a6e0327e3dfaf7931a0d0` merges dev `8f7c3ee`; current HEAD is shown by GitHub above.
Controller, async reader, control bindings, native button and reset-phase marker implement the change. Finalization preserves history, removes14 archived identical document copies and makes optional transport continue external requests rather than synthesize success. Nine existing spec assertions remain unchanged.

## Evidence
Historical post-integration:336 unit/integration PASS;84 E2E PASS/12 capability SKIP;8 focused Undo PASS retries0; typechecks/build PASS. Finalization: build including source/test typechecks PASS exit0; focused Undo8/8 PASS retries0 exit0 after transport correction. Normal HTTP full regression is running separately; current GitHub checks above remain authoritative. Initial published-head CI/CodeQL succeeded; that result is not transferred to a later SHA.
- [Test-first RED log](https://github.com/DangTAnh/SE2026.11.1.3D-WEB-05/blob/feat/tv4-bt3-vt121-undo-import-v2/output/VT121-final/logs/03-red.log): expected exit1, missing Undo after valid import/export.
- [Mutation log](https://github.com/DangTAnh/SE2026.11.1.3D-WEB-05/blob/feat/tv4-bt3-vt121-undo-import-v2/output/VT121-final/logs/06-mutation.log): Undo-only guard removal KILLED by AUTH2; final guard retained.
- [Coverage log](https://github.com/DangTAnh/SE2026.11.1.3D-WEB-05/blob/feat/tv4-bt3-vt121-undo-import-v2/output/VT121-final/logs/07-coverage-final.log):100% line/branch/function only importUndo.ts/presetFile.ts; whole-app NOT_MEASURED.
- [Flaky review](https://github.com/DangTAnh/SE2026.11.1.3D-WEB-05/blob/feat/tv4-bt3-vt121-undo-import-v2/output/VT121-final/logs/08-flaky.log):3 shuffled unit rounds and3 focused E2E rounds; HMR timing and shared artifact collisions documented, failed logs retained.

## Performance / limitations
Node synthetic5×200 jobs p9532.678–36.323ms. Browser200 jobs/pool10 queue p9513.347999s **exceeds5s**; service-only .894348s. Real200-user concurrent SLO **NOT_VERIFIED**. FakeRenderer proves UI/port behavior, not physical GPU recovery/performance. Optional transformed transport is distinct from normal HTTP testing.

## Review / AI disclosure
Codex assisted planning, implementation, tests and finalization; plan assumptions were corrected for full-document metadata and post-commit reset failures. Student owns the submission and must confirm the reflection. Human review **PENDING**; no self-approval, no merge before independent review.
[README](https://github.com/DangTAnh/SE2026.11.1.3D-WEB-05/blob/feat/tv4-bt3-vt121-undo-import-v2/docs/04-testing/BT3-VT121-README.md) · [Traceability](https://github.com/DangTAnh/SE2026.11.1.3D-WEB-05/blob/feat/tv4-bt3-vt121-undo-import-v2/docs/04-testing/VT121-traceability.md) · [AI Usage Log](https://github.com/DangTAnh/SE2026.11.1.3D-WEB-05/blob/feat/tv4-bt3-vt121-undo-import-v2/docs/04-testing/VT121-ai-usage-log.md) · [Risks](https://github.com/DangTAnh/SE2026.11.1.3D-WEB-05/blob/feat/tv4-bt3-vt121-undo-import-v2/docs/04-testing/VT121-remaining-risks.md).

[Finalization build log](https://github.com/DangTAnh/SE2026.11.1.3D-WEB-05/blob/feat/tv4-bt3-vt121-undo-import-v2/output/VT121-final/logs/11-finalization-build.log) · [Focused Undo log](https://github.com/DangTAnh/SE2026.11.1.3D-WEB-05/blob/feat/tv4-bt3-vt121-undo-import-v2/output/VT121-final/logs/11-finalization-focused.log).

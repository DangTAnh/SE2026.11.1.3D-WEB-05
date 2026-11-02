# Original v2 initial implementation plan — before source edits

2026-11-02. Codex, continuing the user's "CODEX MASTER PROMPT — HOÀN THIỆN BT3 VT-121". Preserve all original v1 commits and logs. This file is the actual first plan for this run, not reconstructed after implementation.

Problem: successful preset import overwrites current edits without a recovery action. Vertical slice: one-step Undo across preset parser/session and UI import controls; no engine/backend changes.

Initial proposed design: reuse v1 session controller with structuredClone of LabConfig for nested v2 values. Treat apply as synchronous and attempt rollback by reapplying pre-operation config on failure. Keep one prior config, not a redo stack. Bind owner Symbol privately in controls and invalidate history on manual edits. Reuse latest-request-wins reader.

Assumptions to verify: LabConfig alone represents all imported UI state; synchronous apply is sufficient to characterize UI/renderer consistency; existing UI edits all pass through controls. These are provisional, not proven guarantees. Inspect metadata and renderer lifecycle before implementation.

AC1 validated import commits an independent prior snapshot only after successful apply. AC2 Undo restores complete import-related UI state once. AC3 invalid/boundary/empty/oversize imports preserve state/history. AC4 wrong capability denied on import/Undo/history inspection. AC5 manual edits invalidate history and pending reads; stale reads are silent; partial failures recover according to the actual apply contract, with explicit rollback-fails limitations.

NFR: no dependencies/framework/renderer contract changes; accessible Undo and reproducible tests. Performance target 200 tasks/users p95<=5s, measured scopes distinguished.

Invariant: no rejected/unauthorized operation changes current snapshot or history; successful Undo consumes exactly one previous snapshot. Atomicity is conditional on actual rollback behavior.

Expected files: src/presets/importUndo.ts, UI controls/template (and minimal app wiring only if required), new unit/E2E tests, benchmark, VT121 documents/evidence. Never edit schemas, GPU/simulation/backend, shared RendererPort or dependency versions. New branch from locally verified dev if remote unavailable; label cached SHA explicitly, not latest remote.

Test strategy: initial real baseline E2E RED via actual built application if Vite loopback blocked; schema-v2 BVA using real parser, deep snapshot, document metadata, capability, partial apply, rollback failure, deferred reads, manual edit and duplicate Undo. Full existing regression, exact guard mutation in a temporary worktree, coverage without new packages, 3 shuffled unit and 3 no-retry browser rounds, 5x200 synthetic tasks with p50/p95/p99/throughput/errors.

Rollback: close unmerged draft or revert v2 feature commit; preserve v1 history. Review source evidence and refine at least two assumptions before source changes. Human approval remains pending; no merge.

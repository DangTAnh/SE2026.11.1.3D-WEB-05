> Historical design/execution narrative below refers to the pre-publication campaign; current publication status is recorded at the end.

# v1/v2 comparison and revised plan


Initial plan is preserved verbatim in VT121-initial-plan-original.md before production edits.

Revision 1 — initial "snapshot LabConfig only": rejected. src/presets/preset.ts lines 20–27 defines PresetDocument.name; src/ui/app.ts lines 34–37 and 105–111 retain document name separately from renderer config. Revised controller snapshots/validates the complete PresetDocument with structuredClone, including absent/present metadata. Undo tests export document equality and nested inactive mode/camera/rendering fields, not only sliders.

Revision 2 — initial "synchronous apply plus reapply rollback characterizes consistency": too broad. RendererPort.ts declares applyConfig:void, but app.ts updateConfig applies renderer, then commits UI config/name, then calls reset; reset may throw after config is already committed (app.ts lines 81–103). Existing ui-port.spec.ts "renderer reset errors during import" explicitly expects new config remains applied. Revised design distinguishes a committed configuration + reset warning from a failed configuration apply. A domain CommittedPresetError marker records that defined phase; controller commits history and rethrows warning when config committed, while generic partial apply failures trigger rollback. Undo similarly consumes history only if config restore committed. This retains existing reset behavior rather than silently changing it to rollback. Renderer internal resources/time are not a transactional system; rollback-fails remains explicit, not a universal guarantee.

Revision 3 — v1 BVA cannot be reused: schema-v2.json simulation.particleCount min1000 max500000 integer, NO multipleOf (65536 default). Thus 1500 accepts and 50001 accepts. Numeric speed/size/strength now multipleOf .001. Schema version1 is explicitly rejected, version2 required. File size policy remains 1000000 bytes; add 999999 case missing from v1 matrix.

Revision 4 — existing browser fixture tests injected RendererPort, distinct from real GPU tests. Ported Undo E2E will use existing renderer-port.html plus actual app.ts/controls/parser and FakeRenderer; label this UI/port integration, NOT GPU performance. Terminal and Chromium both deny loopback, so browser tests need in-process Vite transformation + Playwright transport interception. No backend/engine changes, no altered old assertions. Default runner failures will remain reported if full regression cannot execute.

Authorization remains client capability/harness-only. No accounts/server or API exists. Branch name follows explicit user-requested VT121 name; issue assignment cannot be created/verified while GitHub is unreachable, so issue/owner/human approval remains PENDING. No fabricated closing issue.

## Publication verification — 02/11/2026

VERIFIED: [PR #81](https://github.com/DangTAnh/SE2026.11.1.3D-WEB-05/pull/81) OPEN, isDraft=true, base=dev, published HEAD 247781de4c90df52f54a6e0327e3dfaf7931a0d0. Fetch succeeded; merge-base with current origin/dev is 8f7c3eeb74c7a9501332b265fa16a6aa552aa2b3. Dev synchronization completed in merge commit 247781de4c90df52f54a6e0327e3dfaf7931a0d0. No rebase/force-push/merge of PR.

VERIFIED historical post-publication execution at that merge: 336 unit/integration PASS; 84 E2E PASS, 12 capability SKIP; 8 focused Undo PASS retries=0; typechecks/build PASS. Commands and exit0 are preserved in external handoff output/VT121-final/logs/publication-result.json and publication-original.log. These are not new executions in finalization.

VERIFIED CI on published merge: CI verify SUCCESS [run 41412349557](https://github.com/DangTAnh/SE2026.11.1.3D-WEB-05/actions/runs/41412349557); CodeQL SUCCESS. Finalization HEAD checks must be read separately from external VT121-pr-ci-status.md; do not transfer this PASS to a later SHA. Human review PENDING: reviews=[], reviewRequests=[] at API inspection. New finalization verification is logged separately. Overall REVIEW_PENDING; real-user SLO NOT_VERIFIED.

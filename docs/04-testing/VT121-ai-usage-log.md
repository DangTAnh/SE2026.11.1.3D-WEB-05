# VT121 AI usage log

Tool: Codex desktop agent, terminal/PowerShell, Git2.54.0.windows.1, gh2.103.3, Node22.16.0, npm11.10.1, existing Vitest/Playwright/Vite. Exact backend model identifier was not captured in execution evidence; no model/version is invented. Independent AI reviewer used same session tooling; it is not human approval.

Active prompt: user's "CODEX MASTER PROMPT — HOÀN THIỆN BT3 VT-121". Actual quoted instructions applied:
> Không viết lại công việc đã hoàn thành khi có thể tái sử dụng.
> Mặc định ưu tiên port tính năng Undo sang dev/schema v2 nếu dev vẫn là nhánh tích hợp chính.
> Không merge trực tiếp branch v1 vào dev nếu gây conflict hoặc phá contract v2.
> Không giả mạo bằng chứng, không chỉnh sửa log để tạo PASS, không tự merge và không tự thay đổi requirements để làm đẹp báo cáo.

Full prompt remains in this chat; these are identified excerpts, not a fabricated verbatim replacement. Actual first v2 AI output is preserved in VT121-initial-plan-original.md before production edits. Actual revisions in VT121-plan-review.md were made after source inspection and before implementation.

Decisions:
1. Initial LabConfig-only snapshot revised to full PresetDocument including optional name, based on preset.ts/app.ts metadata contract; E1/S1/S2 verify deep restoration and absence.
2. Initial reapply rollback assumption narrowed: app commits renderer/UI before reset, and existing ui-port tests expect config retained if reset fails. Introduced CommittedPresetError for this phase; generic apply failures roll back, committed reset warnings save/consume history appropriately. No renderer contract or GPU code changed.
3. Reject v1 boundaries on v2: count has no multipleOf and max500000; fractional precision .001 applies to speed/size/both strengths. FILE1 additionally covers999999 bytes.
4. Reused v1 latest-request reader source only after inspecting semantics, not v1 logs as new PASS. Added source v2 cases and real DOM deferred-race evidence.

Questionable AI output verified:
- The prior v1 AI-generated shallow snapshot is valid only for scalar v1 and cannot be transplanted into nested v2; the actual initial v2 plan already proposed structuredClone. Use parser-returned deep document and compare full inactive mode/camera/rendering/name, not only canUndo.
- Generic catch-and-rollback looks atomic but reset can throw after commit. Existing app and tests forced phase classification; rollback-fails/async GPU caveats retained.
- E3 exported immediately after stale release, overwriting toast. Independent AI review identified this evidence gap; added assertion on latest-import toast before export. No old assertion weakened.
- HMR false alone did not stop a Vite client WebSocket. Initial full regression79PASS/8SKIP/5FAIL; every failure preserved. Baseline source probe reproduced desktop3 errors. Transport now accepts only local dev-tool sockets and disables its server socket via Vite's existing ws:false option; pageerror assertions remain intact. This is not a production fix or live TCP proof.
- Source-only coverage is now measurable via existing Node type stripping (unlike v1 bundled70%); do not compare them as the same metric or extrapolate selected100% to whole app.
- gh status JSON exit0 still contained host state=error. No auth conclusion without HTTP response. Push/PR remain blocked by DNS.

V1 checkpoint/feature/evidence commits remain 7da2ad2/388b915/2f8bc2c, verified in00/01 logs and original bundle. V2 baseline2389f0f, real pre-implementation RED bfd124749412e93d32b4048d0fd6173bb4f58cb9; feature GREEN e808d70a792ffb377c8b310f8f9e0bb441ba5dc0. RED import/export assertions passed before missing Undo failed; unlike v1, v2 RED was run before production change. Commands, exit codes and outputs are in logs; failed attempts are retained separately from final reruns.

Author responsibilities: verify actual source, review four diff layers, interpret evidence scope, preserve histories, keep new work on personal branch, avoid secrets/deps/GPU changes, and leave final approval/merge to humans. No claim of human approval or current remote integration.

Additional observed orchestration error: full verify and repeated E2E used default test-results simultaneously. 05-regression-restored.log shows80PASS/8SKIP/4FAIL, all four teardown failures are ENOENT on shared trace artifacts (including E1, not a failed Undo assertion). Kept raw failures. Follow-up e7b72e7 adds optional unique outputDir; runner sets per-command artifact/HTML paths, and final full verify runs alone. No retry or weakened assertion was used. This is a concrete shared-state flaky source from Lecture07, not a claim that every test is inherently stable.

Final verification e7b72e7 exited0:312 unit/integration +84 E2E PASS/8 capability SKIP. Source coverage repeated100% only for2 selected modules. Initial browser benchmark CLI failed because bare @vt121load was parsed as a PowerShell splat; quoted retry executed the workload (not an assertion retry). Node final p95=32.678–36.323ms; browser queue p95=13.347999s exceeds5s despite0 functional errors. This mismatch is reported, not optimized away or relabelled real-user PASS.

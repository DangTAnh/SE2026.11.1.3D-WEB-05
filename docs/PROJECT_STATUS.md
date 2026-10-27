# PROJECT STATUS — 3D-WEB-05

## 27/10/2026 — Issue #52 recovery branch synchronized with latest dev

- Branch `fix/52-runtime-device-loss` is integrating `dev@93fd267`, which
  includes the composition-owned backend re-initialization flow (#63), the
  Vortex parameter contract (#49), and lifetime/respawn work (#48).
- Runtime adapter recovery still replaces its canvas after WebGPU loss. The
  shared canvas factory now resolves the currently connected preview canvas,
  so a later user-requested backend switch stages from the replacement rather
  than a detached canvas. UI resize observation remains on the stable host.
- A desktop/mobile E2E regression simulates runtime canvas replacement and
  verifies that a subsequent backend Apply uses the current canvas. `CI=1 npm
  run verify` passes on the merge candidate: both typechecks, 157 unit/contract/
  integration tests, 56 desktop/mobile Chromium E2E tests, two WebGPU-adapter
  skips, and production build. No E2E retries were needed. The existing Vite
  >500 kB chunk warning remains. Physical WebGPU loss remains **NOT_RUN**.

## 26/10/2026 — PR #63 TV1 review fixes

- Merged latest `dev@a6e460d` into the existing feature branch via `89bb87c`;
  merged #44/#60 source is preserved. No published history was rewritten.
- All seven TV1 findings have code/regression changes: transactional staging and
  rollback, explicit switch results/toasts, guarded initial start, capability-safe
  E2E, generation-specific requested backend, preserved fallback content, and one
  shared production/fixture canvas factory. Human re-review remains required.
- Test mapping and integration boundaries are in the
  [review-fix evidence](04-testing/backend-reinit-review-fixes-2026-10-26.md).
  Final full verify PASS: 139 unit/contract/integration tests, 52 desktop/mobile
  E2E PASS and two WebGPU-adapter skips, both typechecks and production build.
  No retries in the final full run; an earlier timeout is recorded in the evidence.
  The initial handoff below records historical evidence, not current verification.
- #61 still needs TV3 canvas recovery/pause fixes and an agreed recovery ownership
  API with TV1. #62 stays Draft pending freshness fixes and TV1/TV5 contract review;
  #63 does not invent its fields. #64 is a separate benchmark-runner candidate.
- #14 stays open pending acceptance wording for the negative `uiState` regression.
  #16/#49 hash and Vortex decisions remain open; #55 waits #62; #56 waits #16/#49.
  #43/#51 source is merged but their owners still need to confirm Issue closure.
- Physical WebGPU, GPU readback parity (#50), lifetime/respawn (#48), fair measured
  benchmark (#58), MVP acceptance and release remain separate unmet gates.

## 26/10/2026 — TV4 Issue #54 backend re-initialization candidate

- Baseline: `dev@ac364912`; branch `feat/54-backend-reinit`, assigned to TV4
  (`duyanhtr130905`). Backend selection now has an explicit Apply action that
  replaces the adapter and canvas without page reload. Configuration and pause
  intent survive; measurements are cleared while initialization is pending.
- Composition owns generations/disposal; UI stays mounted once and retains one
  poller and host ResizeObserver. `RendererPort` and backend/simulation source
  are unchanged. TV1 composition and TV3 lifecycle review are required.
- Focused evidence: 10 session/composition integration tests PASS; six new
  desktop/mobile E2E checks PASS, including real production backend apply.
  Full `CI=1 npm run verify` PASS: typechecks, 140 unit/integration tests,
  44 browser E2E passed and two WebGPU skips, production build. Evidence is in
  [backend re-init handoff](04-testing/backend-reinit-2026-10-26.md).
- #16 remains BLOCKED by #49/hash/Vortex owner decisions; #55 by Draft #62 and
  freshness contract review; #56 by #16/#49. These are not included in #54.
- Hardware WebGPU, numeric GPU parity, fair benchmarks and MVP/release acceptance
  remain NOT_RUN. New tests exercise WebGL2/fallback in this environment and
  explicitly labelled fake ports for races/failure paths. Do not infer GPU parity.
- Next: human TV1/TV3 review → address findings → owner merge; TV2/TV1 settle
  #49/hash; TV1/TV5 settle #62 before TV4 continues #16/#55/#56. No self-approval,
  merge, release or direct push to dev/main is part of this candidate.

## 26/10/2026 — #49/#48 merged; #50 GPU readback checkpoint

- #49 froze the public vortex parameters to `vortexStrength` + `vortexDamping`
  (no `vortexRadius`); schema v2, `LabConfig`, `SimulationConfig` and the adapter
  share one default and validation rule. No hardcoded damping uniform.
- #48 added deterministic seed-based lifetime respawn to the CPU reference and
  both TSL kernels, with `spawnRadius`/`lifetime` uniform wiring. `delta = 0`
  remains a strict no-op, including for expired particles.
- #49 merged in #73 and #48 in #74. #50 adds a real GPU readback harness:
  WebGL2 (SwiftShader) passes 6/6 cases, including primed zero-delta and
  immutable-seed checks; 3/3 corrupt readbacks fail validation. The validator
  unpacks vec3 readback by the backend stride (3 packed WebGL2, 4 padded WebGPU),
  so the same harness accepts both layouts. WebGPU is SKIPPED with an explicit
  missing-adapter reason.
  Evidence: [GPU kernel readback parity](04-testing/gpu-kernel-parity-2026-10-26.md).
- #50 is in PR #75 and has not merged. No release, physical-WebGPU execution or
  physical-GPU acceptance is implied by the software-rendered WebGL2 evidence.

## 25/10/2026 — TV4 integration of dev `04f1522`

- PR #40 is merged: #12 adapter, #13 WebGL2 fallback/timing and composition
  are preserved unchanged in PR #33's integration result. No backend/contract
  or simulation implementation was changed by TV4.
- #33 adds UI-only initialization projection (no backend/metric claim until
  init completes), with Promise-controlled loading tests and production WebGL2
  live-FPS/pause/resume tests. Invalid/paused GPU timing remains null/unavailable.
- #42 remains head `43563fe`, conflict-free against this dev baseline, with
  successful head CI. TV3 review is requested and still pending; no replacement
  approval or unnecessary synchronization commit was made.
- #16 remains blocked on owner-confirmed hash scope and Vortex mapping.
  #18 belongs to TV1 with TV5 runtime evidence; neither task is implicitly done
  by this UI integration. Physical WebGPU/parity/benchmark acceptance is NOT_RUN.
- Verification and next gate: see the current section of the
  [UI handoff](04-testing/UI-live-status-2026-10-24.md). Human TV1 re-review of
  the new #33 head is required; no PR merge or release is authorized here.
- Local source/test typechecks and `CI=1 npm run verify` PASS: 134 tests,
  38 desktop/mobile E2E passed, two WebGPU skips, build passed. Remote CI for
  the pushed head is a separate gate; these results do not establish GPU parity.

## Historical checkpoints (superseded by the current section above)

> **25/10/2026 — issue #14 timing projection follow-up:** UI now rejects zero GPU
> timing even if a producer marks it available, matching `RendererPort` and the
> pending #40 producer. A small positive duration shows `<0.01 ms` instead of
> rounding to zero. Source/test typechecks, 120 unit/integration tests and the
> production build passed on this TV4 branch; desktop/mobile Chromium E2E passed
> 32 tests with two WebGPU skips. UI fixture tests are not GPU timing evidence.
> PR #40 remains unmerged and WebGPU hardware/timestamp evidence is still open.
> Earlier checkpoints below are historical.

> **25/10/2026 — issue #14 integration checkpoint:** PR #33's branch now
> incorporates `dev@140eb41` (merged adapter #12). Source typecheck, test
> typecheck, production build and 119 unit/integration tests passed locally.
> Four focused production/fallback Chromium checks passed on desktop/mobile;
> the full browser suite passed 32 tests with two WebGPU skips when run with
> one worker. This
> environment has no WebGPU adapter, so WebGPU runtime proof and benchmark
> remain open. See [live status handoff](04-testing/UI-live-status-2026-10-24.md).

> **24/10/2026 — issue #14 draft, feat/14-ui-live-status:** the UI now has only
> RendererStatus-based state projection; synthetic backend/fixture query helpers
> are removed. Polling, failure/recovery and metric clearing are tested against
> an explicitly injected FakeRenderer. PR #32 is merged; draft PR #33 targets
> dev. GPU integration is not accepted: adapter #12/#15 and real browser evidence remain
> pending. See [live status handoff](04-testing/UI-live-status-2026-10-24.md).
> **24/10/2026 — dev update after #38:** composition root #15 has merged at
> `de6665a`; production still uses an unavailable placeholder pending adapter
> #12. PRs #39/#40 now propose adapter/fallback changes and require review and
> runtime evidence. Issue #37 remains open while the collector test repair in
> #38 is assessed. The checkpoint below uses the earlier `888626a` baseline.

> **24/10/2026 — workflow/current-dev checkpoint (#36):** dev at `888626a`
> includes #32 UI controls and #35 shared TSL kernels. Adapter #12, fallback
> #13 and composition #15 remain pending; GPU runtime/parity/benchmark NOT_RUN.
> TV4 #33 is a draft live-status candidate into dev; #16 is blocked on shared
> hash/Vortex decisions. Four legacy branches have been renamed with identical
> SHAs. See [workflow audit and next actions](05-management/workflow-audit-2026-10-24.md)
> and [CONTRIBUTING](../CONTRIBUTING.md). Prior checkpoints below are historical.

> **24/10/2026 — TV4 issue #9/#25 branch checkpoint:** UI now consumes an
> injected RendererPort, with explicit FakeRenderer browser tests and no
> Canvas2D preview. Production main initializes a placeholder port and shows
> unavailable until #12 supplies the real adapter; this is not GPU acceptance.
> README reflects this branch's behavior. See
> [handoff and verification](04-testing/UI-renderer-port-2026-10-24.md).
> Previous checkpoints below are historical, not current branch state.

> Cập nhật GitHub ngày **22/10/2026**: xem
> [snapshot theo từng nhánh và kế hoạch PR](05-management/github-progress-2026-10-22.md)
> và [kiểm tra TV4 hôm nay](04-testing/TV4-pr-verification-2026-10-22.md).
> Nội dung dưới đây là checkpoint TV4 ngày 11/10; các câu “chưa push/chưa PR”,
> pending và kết quả test bên dưới chỉ mô tả thời điểm đó.

**Cập nhật:** 11/10/2026
**Nhánh làm việc:** feat/tv4-week1-ui-ux
**Gate hiện tại:** TV4 pre-integration + quality tooling hoàn tất, chờ review contract và ghép engine.

## Đã hoàn thành phía TV4

- Use case, UI requirements, wireframe, mô tả UI và interaction spec tuần 1.
- UI responsive và Canvas2D preview trung thực về giới hạn.
- Preset schema v1, validation chặt, import/export và unit tests.
- View-model trạng thái runtime độc lập engine.
- Fixture: initializing, ready WebGPU, fallback WebGL2, unsupported, error.
- Design tokens, reduced-motion, alert/status semantics, trạng thái disabled.
- Ma trận state, test cases và tài liệu bàn giao pre-integration.
- Ajv dùng trực tiếp JSON Schema v1; Vitest thay Node test runner.
- Playwright E2E desktop/mobile, axe-core WCAG scan và ảnh evidence tự động.

## Đang chờ

- TV1 xác nhận lifecycle/API adapter và hướng hợp nhất lịch sử Git.
- TV2 xác nhận mode, range vật lý và cách apply config WebGPU.
- TV3 xác nhận fallback reason/actual backend.
- TV5 xác nhận PerformanceSnapshot, chu kỳ cập nhật và E2E/benchmark.
- Thiết lập default branch để sau theo chỉ đạo của chủ repo.
- Quality tooling ngày 11/10 đã được commit cục bộ trên nhánh TV4; chưa push/chưa mở PR.

## Kiểm tra chất lượng

| Kiểm tra | Trạng thái |
|---|---|
| Baseline typecheck | Đạt |
| Baseline unit tests | Đạt 6/6 |
| Typecheck sau thay đổi | Đạt |
| Unit tests sau thay đổi | Đạt 17/17 |
| Playwright E2E | Đạt 10/10, desktop + mobile Chromium |
| axe-core WCAG A/AA | Đạt 2 viewport × 4 state, 0 violation sau sửa contrast |
| Production build | Đạt, Vite 6.4.4, 190 modules transformed |
| Ảnh tự động | Đạt 2/2 test; 4 ảnh `automated-*` mới |

## Ba việc tiếp theo

1. Khi người dùng cho phép: push nhánh TV4 và mở PR theo chiến lược lịch sử Git do TV1 chốt.
2. TV1/TV2/TV3/TV5 review contract; sau khi có engine, mở rộng E2E/benchmark thật.
3. Chỉ mở rộng Firefox/WebKit hoặc Storybook khi có nhu cầu tích hợp cụ thể; không đổi kiến trúc UI hiện tại.

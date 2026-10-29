# PROJECT STATUS — 3D-WEB-05

## 28/10/2026 — Issue #53 synchronized after PR #69

- Normally merge `dev@db8231568a700918ac42c6efa9beb3b20aab6831`
  into `fix/53-measurement-age` from `3451aec`. Git applied the merge cleanly;
  no textual conflict required resolution. Preserve #69 CI hardening and its
  exact lockfile alongside all #53 source and regression tests, unchanged.
- GPU-only age remains measured from compute submission including readback:
  2,000 ms threshold, 10-frame query cadence, lifecycle/generation invalidation,
  stale GPU timing unavailable/null while valid FPS is retained, and null age
  for pending sessions. Preserve #61 recovery; independent FPS freshness is #55.
- Full head/base, actual per-command verification and current CI are recorded in
  [PR #62](https://github.com/DangTAnh/SE2026.11.1.3D-WEB-05/pull/62).
  Historical parallel E2E failures are separate from the one-worker default.
- All six inline review threads are resolved. Historical TV1 contract approvals
  were dismissed after later pushes; current-head owner re-review, TV5 collector
  confirmation and independent human approval remain required. GitHub was Ready
  at this inspection; this update does not change Draft/Ready or approve/merge.
- Keep every historical checkpoint below, including the superseded #54 candidate.
  Hardware WebGPU recovery, physical GPU parity/timestamp freshness and fair
  benchmark acceptance remain **NOT_RUN**; software/test doubles are not proof.

## Historical checkpoint — 28/10/2026 — Issue #53 synchronized with dev@4fdf67a

- Normally merge `dev@4fdf67ac6e6913e5f45215faf9e025626f220a29`
  into `fix/53-measurement-age` from `1d0cabd`. Preserve merged #71
  reconciliation/history, #64 benchmark runner, #57 deterministic E2E settings
  and #46 repository standards. The conflict was in this checkpoint file only.
- Keep Issue #53 source/tests unchanged: GPU-only age from compute submission,
  2,000 ms threshold, 10-frame cadence, lifecycle invalidation, valid FPS retained
  when GPU timing is stale, unavailable/null GPU timing, and null pending-session
  age. Preserve #61 recovery and late lost-renderer timestamp guards. #55 stays
  separate; no preset-v2 branch or second simulation pipeline is imported.
- TV1's contract-only approval at `1d0cabd` is historical review evidence, not
  approval of this new integration. TV5 collector review, downstream dependencies
  and independent approval remain gates. Keep Draft; no approval/PR merge here.
- Actual per-command outcomes, new full head/base and CI state are recorded in
  [PR #62](https://github.com/DangTAnh/SE2026.11.1.3D-WEB-05/pull/62).
  E2E now follows dev's one-worker default; the old parallel 12-failure report
  remains separate history, not a result for this configuration.
- All earlier checkpoints, including #54, are preserved below. Hardware WebGPU,
  physical GPU timestamp freshness/parity and fair measured benchmark remain
  **NOT_RUN**. Software/test-double evidence does not establish hardware acceptance.

## Historical checkpoint — 27/10/2026 — PR #62 integrates runtime recovery from dev@38a1d05

- Branch `fix/53-measurement-age` merges
  `dev@38a1d05740f20d886b177196b3a1852b1c2ae5fd` normally into the
  previous `88d4bb1` head. PR #61 / Issue #52 recovery is now merged in dev.
  All earlier checkpoints, including the superseded #54 candidate, are retained
  below as historical reports; their counts are not current-head evidence.
- Keep WebGPU runtime-loss recovery with one WebGL2 attempt, fresh canvas
  replacement, owner-scoped surface adoption/disposal and generation guards.
  Session start/pause intent survives recovery and a later backend Apply.
- Keep Issue #53 GPU-only age from compute submission (including readback),
  2,000 ms threshold, 10-frame cadence and lifecycle timing invalidation.
  Pending session age is null; the collector skips paused samples but retains
  valid FPS with unavailable/null GPU timing when only GPU age is stale.
  Independent FPS freshness remains #55.
- Both regression sets are retained. An integration regression also checks that
  a timestamp resolving from the lost renderer cannot publish into or unlock
  the recovered renderer's pending query.
- Current-head verification commands/results are recorded with full base/head
  SHAs in [PR #62](https://github.com/DangTAnh/SE2026.11.1.3D-WEB-05/pull/62).
  The earlier default-parallel E2E run's 12 timeout/polling failures remain
  separate from serial verification; they are not claimed fixed without a rerun.
- Hardware WebGPU recovery and physical GPU timestamp freshness: **NOT_RUN**.
  Software WebGL2, synthetic context loss and fake ports do not prove hardware
  acceptance. Keep Draft pending TV1's measurementAgeMs contract decision,
  TV5's collector confirmation and independent human approval. No PR merge.

## Historical checkpoint — 27/10/2026 — Issue #53 PR #62 review follow-up

- Latest fetched base: `dev@09723af8055df0a76d983959e7d0818cf6091450`.
  Reviewed head `b9bf795f42cf05df4e869c1a9ee65bfa6bf02a82` already
  merges that base normally. Test revision
  `d2ef6866ef6580941dae9a5e8ba4e6ae084287fc` adds the collector regression;
  this checkpoint is its documentation-only follow-up on the same PR branch.
- The new fake-port case reports available GPU timing at age 2,001 ms with
  `gpuTimeMs: 3`: the collector retains FPS 60 and emits
  `gpuTimingAvailable: false` / `gpuTimeMs: null`.
- GPU-only age still starts at compute submission, includes readback delay,
  and expires after 2,000 ms. Cadence stays one query per 10 compute frames;
  5 FPS reaches the window before readback delay, and slower frames/delays may
  make timing unavailable. Independent FPS freshness remains Issue #55.
- Verification on test revision `d2ef686` (this follow-up changes only docs):
  `npm run typecheck` PASS; `npm run build` PASS (including test typecheck);
  `npm test` PASS, 174 tests across 20 files. Focused collector: 7/7 PASS.
- `CI=1 npm run verify` PASS: both typechecks, 174 unit/contract/integration
  tests, 54 desktop/mobile Chromium E2E passes and 4 expected skips (3.9 min,
  1 worker), then production build. No E2E retries or flaky cases in this run.
  Skips: two unavailable WebGPU-adapter checks and two desktop-only parity
  checks on mobile. Vite retains the 1,060.55 kB minified JS chunk advisory.
- The default-parallel E2E suite was not rerun for this test/docs follow-up;
  its prior 12 failures remain recorded separately below and are not fixed by
  the serial pass.
- Hardware WebGPU / physical timestamp freshness: **NOT_RUN**. Software
  WebGL2/SwiftShader and fake ports do not establish hardware timestamp cadence
  or freshness. TV1/TV5 re-review and human approval remain required.

## Historical checkpoint — 27/10/2026 — reviewed head b9bf795

- Base `dev@09723af`, head `b9bf795`. The PR body at review time recorded
  source typecheck/build PASS, 173 unit/contract/integration tests PASS, and
  serial `CI=1 npm run verify` PASS with 54 E2E passes and 4 expected skips.
  These are prior-run evidence, not the new 174-test run.
- Separately, the default-parallel E2E run at that head recorded 42 passes,
  4 skips and 12 timeout/polling failures under 10 workers. The serial pass
  does not turn that parallel run into a pass or prove the flakes fixed.

## Historical checkpoint — 27/10/2026 — Issue #53 with dev@93fd267

- Branch `fix/53-measurement-age` integrates `dev@93fd267` through a normal
  merge. This brings in the merged #63 composition/backend re-initialization
  flow plus current #48/#49 simulation updates. The merged composition session
  now reports `measurementAgeMs: null` while initialization is pending and
  forwards the active adapter status after initialization.
- This candidate keeps the #53 GPU timing freshness contract: sample age starts
  at compute submission, stale timing becomes null/unavailable, and valid FPS
  can remain in a sample when only GPU timing is stale. No CPU fallback is added.
- `CI=1 npm run verify`: PASS — both typechecks, 162 unit/contract/integration
  tests, 52 desktop/mobile Chromium E2E tests, two WebGPU-adapter skips, and
  production build. No E2E retries were needed. Existing Vite chunk warning
  remains (~1,061 kB minified). Physical GPU timing-age behavior remains
  **NOT_RUN** because this environment has no WebGPU adapter.

## Previous checkpoint — 26/10/2026 — Issue #53 review follow-up

- Branch `fix/53-measurement-age` now includes latest fetched `dev@e226697`.
  The local review-fix candidate timestamps GPU samples from compute submission,
  requests one query every 10 compute frames, and preserves valid FPS when only
  GPU timing is stale. FPS freshness remains the separate scope of Issue #55.
- `npm run verify`: source/test typechecks PASS; 139 unit/contract/integration
  tests PASS; Chromium desktop/mobile E2E 38 PASS, 2 WebGPU adapter cases
  skipped; build PASS with the existing ~1,055 kB chunk warning. Focused
  collector/adapter regressions: 18/18 PASS. Physical GPU timing-age behavior
  is **NOT_RUN**.
- PR #63 remains open and its pending `RendererStatus` omits required
  `measurementAgeMs`; keep #62 draft until TV1 resolves merge-order
  compatibility and TV1/TV5 re-review the contract/collector behavior.
  This records the state before #63 merged into `dev` on 27/10; retain as
  historical evidence only.

## 27/10/2026 — dev `38a1d05`: #61 merged after the `09723af` reconciliation

- PR #61 (`885b812`) merged into `dev` at `38a1d05`. It guards runtime recovery
  against late init/dispose races, adopts a recovered canvas without an id
  precondition, keeps start intent during recovery, and resets FPS and INV-1
  timing state on failed recovery. The #52 checkpoint below records the
  branch-level evidence; physical WebGPU device-loss recovery remains NOT_RUN.

## 27/10/2026 — dev reconciliation at `09723af`

- The reconciliation baseline was `dev@09723af` (27/10/2026). It includes the
  transactional backend Apply/re-init (#63 at `93fd267`), deterministic lifetime
  respawn (#48 at
  `5802055`), frozen vortex parameters (#49 at `e226697`) and the GPU readback
  parity harness (#50 at #75/`09723af`). The earlier #40/#33/#42/#44/#60 merges
  remain in `dev`.
- #63 replaced the next-init-only model: Apply replaces the adapter and canvas
  without a reload, preserves configuration and pause intent, clears measurements
  while initialization is pending, and rolls back a failed switch. The
  `RendererSession` stages candidates transactionally and owns generation and
  disposal; only `RendererStatus.actual` identifies the backend that ran.
- #48/#49: config identity includes `spawnRadius`, `lifetime` and (vortex-only)
  `vortexDamping`; `vortexRadius` is not a public field.
- Docs-only reconciliation (#45): README, architecture and team ownership now
  describe this behavior. Earlier checkpoints below are preserved as history and
  do not describe current state.
- Verification before the dev merge: local `git diff --check` clean,
  `npm run typecheck`, `npm run build` and `npm test` PASS (162 tests); E2E was
  not rerun locally. CI `verify` at `62fedb8` PASS (it includes `test:e2e`).
- Verification after merging `dev@38a1d05`: local `git diff --check` clean,
  `npm run typecheck` and `npm run build` PASS (205 modules); unit/E2E were not
  rerun locally for this docs branch. CI at the pushed head is the current gate.
- NOT_RUN: physical WebGPU execution, physical-GPU numeric parity, live GPU
  timing, fair measured two-backend benchmark, MVP acceptance and release. #75's
  WebGL2 readback evidence is software-rendered (SwiftShader), not physical-GPU
  proof.

## 27/10/2026 — Issue #52 recovery branch synchronized with latest dev

- Branch `fix/52-runtime-device-loss` includes latest `dev@09723af`, which
  includes the composition-owned backend re-initialization flow (#63), the
  Vortex parameter contract (#49), lifetime/respawn work (#48), and the GPU
  readback parity harness (#50).
- Runtime adapter recovery still replaces its canvas after WebGPU loss. The
  shared canvas factory now resolves the currently connected preview canvas,
  so a later user-requested backend switch stages from the replacement rather
  than a detached canvas. UI resize observation remains on the stable host.
- Re-review verification: source and test typechecks pass; `npm test` passes
  172 unit/contract/integration tests, the production build passes (205
  modules), and the focused desktop/mobile backend-reinit and runtime-context-
  loss E2E set passes 26/26 without retries. This focused set includes id-less
  canvas replacement. The existing Vite >500 kB chunk warning remains.
- Physical WebGPU loss remains **NOT_RUN**; browser E2E uses synthetic WebGL2
  context loss and test-double canvas replacement, not hardware recovery proof.

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

> Historical checkpoint restored verbatim from `dev@09723af`. PR #63
> superseded this initial candidate; the evidence and next steps below describe
> that earlier run, not the current #53 revision.

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

## 26/10/2026 — dev reconciliation at `a6e460d`

- Current `dev` is `a6e460d` (26/10/2026). It includes adapter/fallback #40 at
  `04f1522`, live RendererStatus UI #33 at `ac36491`, collector-test fix #42 at
  `dc7bb3a`, zero-delta kernel #44 at `94a4c22` and capability-probe removal
  #60 at `a6e460d`.
- #13 and #42 are merged and closed; the adapter, WebGL2 fallback/timing,
  RendererStatus UI and capability-probe removal are in `dev`. This checkpoint
  corrects the stale "under review"/"pending #42" statements in README,
  architecture, ownership and this file (#45). Earlier checkpoints below are
  preserved as history and do not describe current state.
- Docs-only change: `git diff --check` clean; `npm run typecheck` and
  `npm run build` PASS. Source/test suites were not rerun for this docs change.
- NOT_RUN: physical WebGPU execution, GPU numeric parity, live GPU-timing
  evidence and the two-backend benchmark run. Benchmark-runner source is
  proposed in PR #64, not merged. #14 and #51 remain open for their own
  acceptance reconciliation; #16 remains blocked on shared hash/Vortex
  decisions.

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

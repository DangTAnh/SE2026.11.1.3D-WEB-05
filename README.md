# 3D-WEB-05 — GPU Particle Lab

Read [CONTRIBUTING](CONTRIBUTING.md) and [AGENTS](AGENTS.md) before coding.
Use an assigned Issue, a numbered branch from current `dev`, G0 before push,
and a PR into `dev` with evidence and another person's approval.
See the [current workflow/progress audit](docs/05-management/workflow-audit-2026-10-24.md).

Browser particle lab targeting WebGPU with a WebGL2 GPU fallback, two modes
(Attractor/Vortex), live controls, preset import/export, and reproducible
measurements on both backends.

**Current implementation: the real renderer adapter is wired through RendererPort.**
The Canvas2D preview has been removed. The default entry point initializes the
adapter before mounting the UI. On `dev` at `09723af` (27/10/2026), browser
tests exercise a real WebGL2 path; the available Chromium environment has no
WebGPU adapter, so its WebGPU smoke test is skipped. Preset import/export
remains available. Physical-GPU/WebGPU parity and a fair two-backend benchmark
run remain unverified; #50's WebGL2 readback parity is software-rendered
(SwiftShader), not physical-GPU proof.

## Run and verify

Requires **Node.js >= 22.16** and npm. From the repository root:

```bash
npm ci
npx playwright install chromium  # once per machine
npm run dev                     # Vite development server
```

```bash
npm run typecheck               # source TypeScript
npm run typecheck:tests         # test TypeScript
npm test                        # Vitest unit/contract tests
npm run test:e2e                # desktop/mobile Chromium; excludes screenshots
npm run build                   # production build
npm run preview                 # serve the production build
npm run verify                  # source/tests typecheck, unit, E2E, build
```

Use the test totals reported by the current run; branch totals change as PRs
merge. CI runs `npm run verify` on PRs and configured pushes.

## What exists

- **UI / presets:** controls, nested preset v2 JSON validation and document/name round-trip,
  pause/resume/reset through an injected `RendererPort`, responsive layout,
  accessibility checks, unavailable/error presentation and cleanup.
- **Port consumer:** `mountLabUI(root, port)` applies defaults once, sends one
  `applyConfig` per change, polls `getStatus`, and returns an idempotent disposer.
  It never creates or initializes a GPU backend.
- **Composition root:** `composeLab` initializes the port before the UI reads its
  status, survives an unavailable or rejecting init (the UI renders unsupported),
  and returns the UI disposer wired to `beforeunload`. `src/main.ts` constructs
  the real adapter supplied by #12.
- **Core:** renderer/status contracts, config identity, aggregation and result
  parsing; a shared `FakeRenderer` for tests.
- **Backend selection / fallback:** `ThreeRendererAdapter` initializes the
  requested backend through `startBackend()` in `src/simulations/backend/fallback.ts`.
  `auto` and `webgpu` try WebGPU first; an expected `BackendUnavailableError`
  permits WebGL2 fallback, while explicit `webgl2` goes directly there. The
  adapter reports the backend that initialized. There is no separate
  capability-probe/resolver path; the duplicate module and tests were removed.
- **Simulation reference and sampling:** deterministic CPU reference steps and
  the RendererPort performance collector are integrated. The renderer uses the
  shared TSL simulation pipeline; WebGL2 readback parity (6/6 cases, plus 3/3
  corrupt-readback rejections) is recorded in
  `docs/04-testing/gpu-kernel-parity-2026-10-26.md`. WebGPU execution remains
  pending because this environment exposes no adapter.
- **Schema v2 candidate (#76 / #16):** this branch uses nested v2 at runtime,
  preserves both mode groups and optional document name, and rejects v1, unknown
  and missing keys. Rendering/camera fields reach adapter consumers; workload
  hash follows TV1's active-mode projection. Owner review remains required;
  the v1 schema is retained only as history.
- **Verification:** UI interaction tests use an explicit
  `tests/e2e/fixtures/renderer-port.html` harness with `FakeRenderer`.
  The harness starts no GPU and its backend labels are test inputs, not runtime
  evidence. Runtime state is not selected by URL parameters: tests change the
  injected port status directly and exercise polling, failure and recovery.

## Integration and remaining evidence

- The #12 adapter (#39/#40 at `04f1522`), live RendererStatus UI (#33 at
  `ac36491`), collector-test fix (#42 at `dc7bb3a`), capability-probe removal
  (#60 at `a6e460d`), backend Apply/re-init (#63 at `93fd267`), lifetime respawn
  (#48 at `5802055`), frozen vortex parameters (#49 at `e226697`) and GPU
  readback parity harness (#50 at #75/`09723af`) are merged into `dev`. The
  adapter stays bound to the production canvas through the composition root.
- The prepared UI shows INITIALIZING without backend or metric claims until the
  initialized port is mounted; missing/failed ports then show unavailable/error.
- Obtain WebGPU browser evidence and verify GPU numeric parity, live timing,
  lifetime/respawn, perf collection and the two-backend benchmark separately.
  WebGL2 kernel readback parity is recorded for #50.
- Choose Auto/WebGPU/WebGL2, then click **Áp dụng backend** to initialize a new
  renderer without reloading. Configuration and pause state are preserved;
  particles restart from their initial state. A fresh canvas permits changing
  context type. Candidates initialize in an inert, hidden staging surface; only
  a ready backend replaces the live canvas. Failed switches keep the old renderer
  and report rollback; initial failure reports unavailable and allows retry.
  Rapid requests use the latest generation. Old FPS/GPU timing is not carried over.
  Only `RendererStatus.actual` identifies the backend that ran.
- Unsupported/invalid GPU timing stays `null`, never a fabricated zero.
- No server, login, database or network persistence is included.

## Project references

- [Architecture and contracts](docs/architecture.md)
- [MVP acceptance](docs/01-requirements/mvp-acceptance.md)
- [Use cases](docs/01-requirements/use-cases.md) and
  [UI requirements](docs/01-requirements/ui-requirements.md)
- [Interaction specification](docs/02-design/ui-interaction-spec.md)
- [Preset v1 schema](docs/02-design/preset-schema-v1.schema.json),
  [v2 proposal](docs/02-design/preset-schema-v2-proposal.md) and
  [v2 schema](docs/02-design/preset-schema-v2.schema.json)
- [Team ownership](docs/05-management/team-ownership.md)
- [Benchmark result template](docs/06-benchmark/README.md)
- [UI port handoff and verification](docs/04-testing/UI-renderer-port-2026-10-24.md)
- [Live status handoff and verification](docs/04-testing/UI-live-status-2026-10-24.md)

## GitHub workflow

Default branch: `main`. Integration branch: `dev`.
Work starts from a tracked issue on a separate branch from current `dev`
(pattern `type/<issue-number>-slug`, e.g. `feat/9-ui-renderer-port`), then a PR into `dev`, passing CI and at
least one independent approval before merge. Do not push directly to `main`.

Request TV1 (`minhhhduc`) review for the UI port/composition boundary and README.
The GitHub Pages workflow from PR #27 is integrated into dev. Publish a live
URL or deployment badge only after promotion to main, successful deployment
and a live smoke test.

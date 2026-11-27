# Repository instructions

Read [CONTRIBUTING.md](CONTRIBUTING.md) before modifying this repository.
Follow the supplied team workflow for agents and humans alike.

## Delivery rules

- Begin with an Issue assigned to exactly one person. Read scope, acceptance
  criteria and dependencies before coding.
- Create `type/<issue-number>-short-description` from the latest remote `dev`.
  Use the team's names, not `codex/...`. Send feature/fix/docs PRs into `dev`.
- Make small English Conventional Commits. Preserve user changes and published
  history. Do not commit/push directly or force-push to `main`/`dev`.
- Before every push run `npm run typecheck` and `npm run build` (G0), then the
  tests appropriate to the change. Report the actual result and any failures.
- Use the PR template: `Closes #N`, behavior, evidence, reproduction and remaining
  dependencies. Require at least one other person's approval before merge.
  Agent review is additional evidence, not the required human approval.
- Do not commit `node_modules/`, `dist/`, credentials, temporary files or drafts.
- Releases use a reviewed `dev` → `main` PR and the agreed milestone tag after
  merge. Do not deploy, tag a release or change repository protection settings
  merely because local tests pass.

## Stack and commands

The current stack is TypeScript/ES modules, Vite, Three.js/TSL, Ajv, Vitest,
Playwright Chromium and axe-core. Node >= 22.16 is required. `package.json` and
`package-lock.json` define the versions; do not upgrade the stack incidentally.

```sh
npm ci
npm run typecheck
npm run typecheck:tests
npm test
npm run test:e2e
npm run build
# Combined verification:
npm run verify
```

Install the Playwright browser once with `npx playwright install chromium`.
Use existing test commands; do not replace the harness or weaken failing tests
to get a green result. Keep evidence outside generated build/dependency folders.

## Architecture and ownership

Read [architecture](docs/architecture.md) and
[team ownership](docs/05-management/team-ownership.md) before crossing a module
boundary. TV1 owns core/contracts/composition/CI, TV2 simulation math and shared
GPU state, TV3 adapter/backend lifecycle, TV4 UI/presets, TV5 collector/tests and
runtime proof. The Issue's single assignee owns delivery; affected module owners
review shared changes.

- `src/core/types` is a leaf. Core/ports must not import `three` or touch the DOM.
- UI talks to `RendererPort`, never imports simulation/backend internals.
- Presets do not import UI. Keep schema validation and unknown-key rejection.
- Use one renderer with shared simulation rules, not separate physics copies
  for WebGPU/WebGL2. Do not add a CPU fallback as a GPU acceptance shortcut.
- Shared `RendererPort`, `LabConfig`, schema and `configHash` decisions need
  their owners' review. Do not invent unresolved v2 fields or hash semantics.

## Runtime and Three.js cautions

- `requested` is a preference; only `actual` identifies the backend that ran.
  Missing GPU timing is `gpuTimeMs: null` with `gpuTimingAvailable: false`.
  Never substitute zero or test data for a missing measurement.
- UI receives an initialized port. Respect documented init/config/start and
  dispose ownership; guard asynchronous work after unmount/dispose.
- Invoke TSL `Fn` factories before `.compute(count)`. Guard normalization of
  zero vectors and preserve the shared attribute layout.
- Set `delta = clampedDt * speed` once. Compare edge cases, including zero
  delta, with the CPU reference; a graph-construction test is not GPU parity.
- Read [kernel contract](docs/03-research/gpu-kernel-contract.md) and
  [WebGL2 research](docs/03-research/webgl2-simulation-options.md) before changing
  compute/fallback code. Browser tests must establish backend availability.

## Evidence and handoff

Use [project status](docs/PROJECT_STATUS.md) for current checkpoints and follow
its evidence links. Separate source merged, tests passed, real GPU exercised,
requirements accepted and release deployed. Test doubles prove caller behavior,
not GPU execution, fair benchmarks or product completion. Record `NOT_RUN` or
`BLOCKED` with the dependency/reason when appropriate. Update status at a useful
checkpoint without silently rewriting historical reports.

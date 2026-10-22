# 3D-WEB-05 — GPU Particle Lab

Web app that visualises tens of thousands of particles with GPU simulation on
WebGPU, falling back to WebGL2, with two simulation modes, live controls, FPS /
GPU timing when the backend provides it, preset export/import, and a
WebGPU vs WebGL2 benchmark.

**Status: UI prototype plus written contracts.** There is no GPU renderer yet —
the only preview is a Canvas 2D mock. What exists is tracked per area in
[`docs/architecture.md`](docs/architecture.md) §1; do not describe the mock's
numbers as WebGPU/WebGL2 results.

## Run

Requires **Node.js >= 22.16** and npm.

```bash
npm install
npm run dev        # Vite dev server, usually http://localhost:5173
```

```bash
npm run typecheck  # tsc --noEmit
npm test           # 24 unit tests (13 preset, 3 port, 8 measurement)
npm run build
npm run preview
```

CI (`.github/workflows/ci.yml`) runs `npm ci`, typecheck and the unit tests on
every push to `main` or `feat/**`, and on pull requests.

## What exists today

- **UI prototype (TV4):** Attractor/Vortex modes, controls for particle count,
  speed, size, colour, strength and backend preference, pause/resume/reset,
  preset export/import with validation. The preview is Canvas 2D and draws at
  most **600** points while the default config asks for **20,000** — its FPS
  and the backend label (`Canvas 2D (mockup)`) are not benchmark data.
- **Contracts (TV1):**
  - [`RendererPort`](src/core/renderer/RendererPort.ts) and
    [`backend.ts`](src/core/types/backend.ts): one renderer, backend-flagged;
    `actual` is the backend that ran, `requested` only explains a fallback.
  - [`PerformanceSnapshot`](src/core/types/measurement.ts): the shape of a
    perf sample — actual backend, `configHash`, FPS, GPU timing with
    `gpuTimeMs: null` iff timing is unavailable.
  - [`configHash`](src/core/measurement/configHash.ts): deterministic SHA-256
    identity over the fields that change GPU work. Not consumed anywhere yet.
- **Docs:** [architecture](docs/architecture.md) (INV-1, contracts, debt
  register), [ADR-0001](docs/adr/0001-modular-monolith.md),
  [work division](docs/05-management/team-ownership.md),
  [MVP acceptance](docs/01-requirements/mvp-acceptance.md),
  [WebGL2 research](docs/03-research/webgl2-simulation-options.md),
  [benchmark template](docs/06-benchmark/README.md).

## Not implemented yet

- No WebGPU, `three`, TSL compute, compute shader or real WebGL2 fallback.
- No renderer adapter (`src/simulations/`) and no composition root: `src/main.ts`
  is still the week-1 bootstrap and `src/ui/app.ts` still drives the Canvas 2D
  mock directly (D-01 in the debt register).
- No simulation physics, no perf collector (`src/perf/`), no WebGPU vs WebGL2
  measurement.
- No server, authentication or persistence in this repository.

## Ownership

Work is split by axis, not by directory:
[`docs/05-management/team-ownership.md`](docs/05-management/team-ownership.md).
Empty directories with `.gitkeep` mean Git tracks them, **not** that the work
exists.

## Integration notes

- `RendererPort` is the only integration point between `src/ui/` and
  `src/simulations/`; the UI never imports a simulation module.
- `LabConfig` still lives in [`src/presets/preset.ts`](src/presets/preset.ts)
  (TV4) and is imported as a type only by the port — debt D-06.
- `configHash` is defined and implemented but not yet used by any collector;
  the fields and algorithm are in `docs/architecture.md` §5.1.
- Backend identity rule (INV-1): store the backend that actually ran, and write
  `gpuTimeMs: null` rather than `0` when timing is unavailable.

## Branches

Work happens on `feat/*` branches and is merged into the team's integration
branch. Do not push directly to `main`.

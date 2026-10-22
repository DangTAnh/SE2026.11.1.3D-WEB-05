# Work division — 3D-WEB-05

Owner of this document: **TV1** (architecture).
Status: **set by TV1 on 2026-10-22**, to be objected to at the next sync. It
replaces the kickoff draft that assigned one directory per person.

## 1. Why the draft was wrong

1. **It split `src/simulations/webgpu/` from `src/simulations/webgl2/`.**
   Those two change together: one TSL material tree, one `forceWebGL` flag
   ([`docs/architecture.md`](../architecture.md) §4). Two owners produce two
   copies of the same physics, and the copies drift.
2. **It left TV1 with `src/core/`** — 75 lines, while the TypeScript under
   `src/` + `tests/` is 642 lines and TV4 has already written 392 of them
   (61%): every UI requirement and the preset domain.
3. **It gave the benchmark to no one.** The graded part of this topic is
   WebGPU vs WebGL2 on the same particles, with numbers. No row produced it.

## 2. Rule

> Split along axes that change independently. Merge anything that always
> changes together.

A split is acceptable when: (1) each unit has one reason to change; (2) no two
people edit the same file in the same week; (3) the riskiest work has the most
people on it; (4) nobody waits more than a few days.

The table below **currently fails conditions 2 and 3 in the places listed in
§6**. Those are scheduling problems, not ownership problems — fix them by
ordering, not by reassigning again.

## 3. Division

| Member | Axis they own | Where they merge | Deliverable |
|---|---|---|---|
| **TV2** | What a particle is, and how it evolves | `src/simulations/simulation.ts`, `src/simulations/shared/` | Two modes, deterministic `step(dt)`, attribute/material tree both backends draw with, one unit test per mode |
| **TV3** | How the same scene runs on either backend, and what it costs | `src/simulations/rendererAdapter.ts`, `src/simulations/backend/` | Backend selection, `forceWebGL`, `trackTimestamp`, fallback verified on a browser without WebGPU |
| **TV1** | What the system says about itself, and where it is wired | `src/core/`, `src/main.ts`, `.github/`, `docs/06-benchmark/` | `RendererPort`, perf sample shape, aggregation key, export format, benchmark report, CI, composition root |
| **TV4** | What the user controls and sees | `src/ui/`, `src/presets/` | All `UI-FR-01..10` driven through `RendererPort` instead of the Canvas 2D mock; preset export/import |
| **TV5** | What we can prove | `src/perf/`, `tests/` | `src/perf/` collector, E2E and browser matrix, the two-backend benchmark run |

File paths are **proposed**; TV2 and TV3 may rename inside `src/simulations/`.
They may not rename a path that `tests/` or `src/ui/` already imports without
telling TV1 and TV5 — a silent rename breaks the CI that gates everyone.

### 3.1 One renderer, not two

- `src/simulations/shared/` holds the particle attributes and the material tree
  both backends draw with. TV2 writes it, TV3 reviews it.
- `src/simulations/backend/` holds capability probe, `forceWebGL`, timestamp
  query and the fallback decision. TV3 writes it.
- Neither directory holds a second copy of the simulation rules.

**Open (decision with TV2 + TV3).** WebGL2 has no native compute shader, but
`three@0.186.1`'s `WebGLBackend` maps a TSL compute node to transform feedback,
so the same compute source can run on both backends. A CPU step is not an
acceptable fallback — the simulation is meant to run on the GPU. Evidence and
remaining constraints: [`03-research/webgl2-simulation-options.md`](../03-research/webgl2-simulation-options.md).
Do not write a second stepping path before that decision.

## 4. Coverage

| Requirement | Produced by | Recorded by | Proved by |
|---|---|---|---|
| `UI-FR-01` choose simulation mode | TV4 (control), TV2 (simulation) | — | TV5 |
| `UI-FR-02` particle count | TV4 (control), TV2 (simulation) | — | TV5 |
| `UI-FR-03` speed / size / color / mode coefficient | TV4 (control), TV2 (simulation) | — | TV5 |
| `UI-FR-04` show actual backend | TV3 (`getStatus`) | TV1 | TV5 |
| `UI-FR-05` FPS / GPU timing | TV3 | TV1 | TV5 |
| `UI-FR-06` export, `UI-FR-07` import | TV4 | — | TV5 |
| `UI-FR-08` reset, `UI-FR-09` pause/resume | TV4 | — | TV5 |
| `UI-FR-10` loading / error / unsupported | TV3, TV4 | TV1 | TV5 |
| Preset export / import (client-side) | TV4 | — | TV5 |
| WebGPU vs WebGL2 benchmark | run by TV5 | TV1 (`docs/06-benchmark/`) | TV5 |

Definition of done for the MVP: [`01-requirements/mvp-acceptance.md`](../01-requirements/mvp-acceptance.md).
The benchmark protocol values it leaves as TBD are TV5's to fix (aggregation
shared with TV2/TV3).

Nine of the ten controls exist against the mock. `UI-FR-04` does not meet its
acceptance criterion: it must display the backend that actually ran
(`docs/01-requirements/ui-requirements.md:27`), and `src/ui/app.ts:36`
hardcodes `Canvas 2D (mockup)`. That gap is D-04 in
[`docs/architecture.md`](../architecture.md) §6.

## 5. Shared files

- **`src/ui/app.ts` — TV4 owns it and merges every change.** TV1 sends the
  port-injection PR; TV5 never edits it (tests only). TV4's own plan
  (`src/ui/overlays/README.md`) to move the status cards into an overlay module
  is the split to follow, not a new `status.ts`.
- **`tests/` — TV5 owns the harness.** Existing files stay with their authors:
  `renderer-port.test.ts` and `preset.contract.test.ts` (TV1, 168 lines) and
  `preset.test.ts` (TV4, 34 lines). For new files: TV2 and TV3 may add tests for
  a module they own; TV5 reviews every new test file.

## 6. Merge order

Nobody needs the full chain before starting; this is the order that keeps
people unblocked:

1. **TV1**: publish the perf sample shape and the `configHash` rule — both
   decided on 2026-10-22, neither implemented yet. No backend-switch path is
   added: a changed `backendPreference` applies on the next `init()`.
2. **TV2 + TV3**: freeze the simulation→render interface (attributes, uniforms,
   state buffers) and the WebGL2 step decision. Due 2026-10-29.
3. **TV3**: `rendererAdapter.ts` behind the port.
4. **TV1**: composition root — `src/main.ts` constructs the adapter and injects
   it into `mountLabUI`.
5. **TV4**: consumes the port; the mock is deleted, not kept as a fallback.
6. **TV5**: builds the collector against `RendererPort` from day one — it needs
   no renderer, only the interface.

## 7. Open decisions

| # | Question | Owner | Due |
|---|---|---|---|
| 1 | WebGL2 compute path: TSL compute node through three's transform-feedback mapping (evidence in [`03-research/webgl2-simulation-options.md`](../03-research/webgl2-simulation-options.md)), or a separate GPU path? CPU is not an option | TV2 + TV3 | 2026-10-29 |
| 2 | `LabConfig` frozen — field names and ranges final for the engine | TV4, reviewed by TV1/2/3 | 2026-10-29 (proposed) |

Item 2 is an external dependency: the date and the frozen field set were
proposed by TV1, and TV4 has not confirmed either. The backend-switch question
is closed — see `docs/architecture.md` §4.

## 8. Working rules

- Anyone may review and open a PR into another member's area. The owner reviews
  the logic; ownership is not code exclusivity.
- Never delete someone else's code without talking to them first.
- A contract changes only with its owner's review. Consumers adapt; the
  contract does not bend per consumer (`docs/architecture.md` §4.1).
- Claims about what exists go in `docs/architecture.md`, not in chat. If this
  file and the code disagree, the code is right and the file is a bug.

# Work division — 3D-WEB-05

Owner of this document: **TV1** (architecture).
Status: **set by TV1 on 2026-10-22**, to be objected to at the next sync. It
replaces the kickoff draft that assigned one directory per person.

## 1. Why the draft was wrong

1. **It split `src/simulations/webgpu/` from `src/simulations/webgl2/`.**
   Those two change together: one TSL material tree, one `forceWebGL` flag
   ([`docs/architecture.md`](../architecture.md) §4). Two owners produce two
   copies of the same physics, and the copies drift.
2. **It left TV1 with `src/core/`** — 75 lines, while the repo is 642 and
   TV4 has already written 392 of them (61%): every UI requirement and the
   preset domain.
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

**Open:** WebGL2 has no compute-shader path. Either the step runs on the CPU in
simulation.ts for both backends, or WebGL2 gets a second GPU stepping path. Not
decided; see §7 item 1. Do not write either until it is.

## 4. Coverage

| Requirement | Produced by | Recorded by | Proved by |
|---|---|---|---|
| `UI-FR-01` load / render | TV2, TV3 | — | TV5 |
| `UI-FR-02` particle count, `UI-FR-03` mode | TV2 | — | TV5 |
| `UI-FR-04` show actual backend | TV3 (`getStatus`) | TV1 | TV5 |
| `UI-FR-05` FPS / GPU timing | TV3 | TV1 | TV5 |
| `UI-FR-06` export, `UI-FR-07` import | TV4 | — | TV5 |
| `UI-FR-08` reset, `UI-FR-09` pause/resume | TV4 | — | TV5 |
| `UI-FR-10` loading / error / unsupported | TV3, TV4 | TV1 | TV5 |
| Preset export / import (client-side) | TV4 | — | TV5 |
| WebGPU vs WebGL2 benchmark | run by TV5 | TV1 (`docs/06-benchmark/`) | TV5 |

All ten UI requirements are already implemented against the mock. What remains
for TV4 is integration — roughly 90 of the 162 lines in `app.ts` — not features.

## 5. Shared files

- **`src/ui/app.ts` — TV4 owns it and merges every change.** TV1 sends the
  port-injection PR; TV5 never edits it (tests only). TV4's own plan
  (`src/ui/overlays/README.md`) to move the status cards into an overlay module
  is the split to follow, not a new `status.ts`.
- **`tests/` — TV5 owns the harness.** TV2 may add tests for a module they own;
  TV5 reviews. Nobody else adds test files.

## 6. Merge order

Nobody needs the full chain before starting; this is the order that keeps
people unblocked:

1. **TV1**: extend `RendererPort` with a backend-switch path, and publish the
   perf sample shape. Due 2026-10-24.
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
| 1 | WebGL2 has no compute-shader path — CPU step for both backends, or a second GPU path? | TV2 + TV3 | 2026-10-29 |
| 2 | `backendPreference` cannot switch a running renderer; `RendererPort` has no re-init. Add it or delete UC-03 | TV1 | 2026-10-24 |
| 3 | `LabConfig` frozen — field names and ranges final for the engine | TV4, reviewed by TV1/2/3 | 2026-10-29 |

## 8. Working rules

- Anyone may review and open a PR into another member's area. The owner reviews
  the logic; ownership is not code exclusivity.
- Never delete someone else's code without talking to them first.
- A contract changes only with its owner's review. Consumers adapt; the
  contract does not bend per consumer (`docs/architecture.md` §4.1).
- Claims about what exists go in `docs/architecture.md`, not in chat. If this
  file and the code disagree, the code is right and the file is a bug.

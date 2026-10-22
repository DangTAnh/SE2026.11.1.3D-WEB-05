# Architecture — 3D-WEB-05 GPU Particle Lab

Owner: TV1 (`src/core/`, `src/main.ts`, `.github/`).
Status: **partially implemented**. This file records what exists today, what the
target shape is, and the rules that keep the two from drifting apart.

Related documents: [`ui-requirements.md`](01-requirements/ui-requirements.md),
[`ui-interaction-spec.md`](02-design/ui-interaction-spec.md),
[`team-ownership.md`](05-management/team-ownership.md).

---

## 1. What exists today

| Area | State | Location |
|---|---|---|
| Renderer contract | **Holds a written type, no implementation yet** | [`src/core/renderer/RendererPort.ts`](../src/core/renderer/RendererPort.ts) |
| Backend identity types | Implemented (types only) | [`src/core/types/backend.ts`](../src/core/types/backend.ts) |
| Preset domain (parse/serialize) | Implemented, client-side only | [`src/presets/preset.ts`](../src/presets/preset.ts) |
| UI shell | Implemented (prototype) | [`src/ui/app.ts`](../src/ui/app.ts) |
| Simulation preview | Canvas 2D mock, **not a GPU renderer** | [`src/ui/mock/particlePreview.ts`](../src/ui/mock/particlePreview.ts) |
| Renderer adapter (one, backend-flagged) | Not started | `src/simulations/rendererAdapter.ts` (planned) |
| Simulation: physics + material tree | Not started | `src/simulations/simulation.ts`, `src/simulations/shared/` (planned) |
| Perf collector | Not started (TV5) | `src/perf/` |

There is **one** renderer, not one per backend. `src/simulations/webgpu/` and
`src/simulations/webgl2/` hold backend-specific parts only (capability probe,
timestamp query), never a second copy of the simulation rules.
| Server, auth, persistence | **Out of scope for this repo** | — |

The mock draws at most 600 points while the default config asks for 20,000, so
no timing produced by it is usable for a WebGPU/WebGL2 comparison.

## 2. Dependency rules

```mermaid
flowchart LR
  UI["src/ui"] --> PORT["src/core/renderer<br/>RendererPort"]
  UI --> PRESET["src/presets"]
  PORT --> TYPES["src/core/types"]
  PORT -. "type only: LabConfig" .-> PRESET
  SIM["src/simulations/simulation.ts"] --> PORT
  RND["src/simulations/rendererAdapter.ts"] --> PORT
  PERF["src/perf"] --> PORT
```

Solid arrows are runtime dependencies; the dotted arrow is type-only. Arrows
never point back toward `src/ui`.

Rules:

1. `src/core/types/` imports nothing. It is the leaf.
2. `src/core/renderer/` may import types only. No DOM, no `three`, no network.
3. `src/simulations/*` may import `src/core/`; **never** the reverse.
4. `src/ui/` may not import `src/simulations/*` directly — only `RendererPort`.
5. `src/presets/` may not import `src/ui/`.

Rule 4 holds today only because nothing implements `RendererPort`: the UI draws
with a Canvas 2D mock that itself lives under `src/ui/`, so there is no
`src/simulations/` import to forbid yet. The port has no implementation and the
mock cannot be swapped for a GPU backend — that gap is D-01.

## 3. Backend boundary

`BackendPreference` (`auto | webgpu | webgl2`) is a request. `ActualBackend`
(`webgpu | webgl2 | unavailable`) is a fact produced by the engine.

**INV-1 — measurement integrity.** A benchmark row must record the backend that
actually ran, and `gpuTimeMs` is `null` if and only if `gpuTimingAvailable` is
false. Recording the requested backend, or writing `0` for "not measured",
invalidates every comparison the project is built to produce.

`RendererStatus` encodes this directly: `requested` exists only to explain a
fallback, and `actual` is the only backend identity a benchmark row may store.

## 4. Renderer contract

`RendererPort` (see the file for full doc comments):

```ts
init(target: RendererTarget): Promise<ActualBackend>
applyConfig(config: Readonly<LabConfig>): void
start() / pause() / reset()
getStatus(): RendererStatus
dispose(): void
```

Design notes:

- `init` **resolves** with `unavailable` instead of throwing, because "no GPU
  backend" is a normal state the UI must render, not an exception.
- `applyConfig` is called on every slider tick; it must not allocate GPU
  resources or start a request. Only an explicit preset save reaches a server.
- The contract is transport-free and DOM-free so that `tests/unit/renderer-port.test.ts`
  can exercise callers with a fake — no canvas, no GPU.

When a real backend is added, `ThreeRendererAdapter` will be **one** class with a
backend flag (`forceWebGL`), not two classes: `three/webgpu` selects the backend
at construction and exposes `renderer.backend.isWebGPUBackend`. Two classes
would duplicate the same TSL material tree.

### 4.1 Who owns each contract

| Contract | Defined in | Producer | Consumers | Owner |
|---|---|---|---|---|
| `RendererPort`, `RendererStatus` | `src/core/renderer/RendererPort.ts` | TV1 | UI, perf, both renderers | TV1 |
| `ActualBackend`, `BackendPreference` | `src/core/types/backend.ts` | TV1 | renderer, perf, UI | TV1 |
| `LabConfig`, preset JSON v1 | `src/presets/preset.ts` | TV4 | UI, renderer, future server | TV4 |
| Perf sample shape | `src/core/types/measurement.ts` (planned) | TV1 | TV5, ingestion | TV1 |

A contract changes only with its owner's review. Consumers adapt; the contract
does not bend per consumer.

Who writes which file is in [`05-management/team-ownership.md`](05-management/team-ownership.md);
this table is about contracts, not about people.

## 5. Data ownership

| Data | Owner | Rule |
|---|---|---|
| Preset JSON (v1) | Preset module | `schemaVersion: 1`, unknown keys dropped on parse |
| Backend identity | Renderer port | Only the engine may produce `ActualBackend` |
| Performance samples | Perf collector (planned) | Must carry `actual`, never the requested backend |

There is no persistence layer in this repository yet. Any claim about stored
data in the current codebase would be false.

## 6. Known debt

| ID | Debt | Where |
|---|---|---|
| D-01 | UI imports the Canvas 2D mock directly; no `RendererPort` implementation is wired | `src/ui/app.ts`, `src/ui/mock/particlePreview.ts` |
| D-02 | Domain module touches the DOM (`downloadPreset`) | `src/presets/preset.ts` |
| D-03 | Unchecked cast from a DOM value into `LabConfig` | `src/ui/app.ts` |
| D-04 | Backend label hardcoded in the UI template | `src/ui/app.ts` |
| D-05 | `serializePreset` re-parses its own output to self-validate | `src/presets/preset.ts` |
| D-06 | `RendererPort` depends on `src/presets` for the `LabConfig` type | `src/core/renderer/RendererPort.ts` |
| D-07 | TV1 must inject `RendererPort` into `src/ui/app.ts`, which TV4 owns and merges — two owners on one file. The status UI stays in TV4's overlay module, not in a file TV5 edits | `src/ui/app.ts` |
| D-08 | `LabConfig.backendPreference` can be replaced after `init` by import or reset (`src/ui/app.ts:143,152`), but the renderer lifecycle specifies no way to apply the change | `src/core/renderer/RendererPort.ts` |

D-06 disappears once the config types move into `src/core/types/`; that change
needs TV4's agreement because `src/presets/` is theirs.

Open decisions that are not debt yet — the WebGL2 stepping path, the backend
switch, and the `LabConfig` freeze date — are tracked in
[`05-management/team-ownership.md`](05-management/team-ownership.md) §7.
Evidence on the WebGL2 path is in
[`03-research/webgl2-simulation-options.md`](03-research/webgl2-simulation-options.md).

## 7. Verification

```bash
npm ci
npm run typecheck     # tsc --noEmit over src/
npm test              # node --experimental-strip-types --test tests/unit/*.test.ts
```

`RendererPort` itself adds no runtime code; the contract test exists so that a
future implementation cannot quietly change what `actual` or `gpuTimeMs` mean.

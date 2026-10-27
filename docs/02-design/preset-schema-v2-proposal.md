# Preset Schema v2 — implemented contract, Issue #16

This supersedes the proposal's unresolved sections. Owner decisions:
[TV1 hash](https://github.com/DangTAnh/SE2026.11.1.3D-WEB-05/issues/16#issuecomment-6438150192),
[TV2 semantics](https://github.com/DangTAnh/SE2026.11.1.3D-WEB-05/issues/16#issuecomment-6433870821),
[TV3 mapping](https://github.com/DangTAnh/SE2026.11.1.3D-WEB-05/issues/16#issuecomment-6433632760).
TV4's document API is a Codex-assisted implementation decision, not another
owner's approval. Formal cross-owner PR review is still required.

## Document API

`PresetDocument = { schemaVersion: 2, app: "3D-WEB-05", name?: string, config: LabConfig }`.
`parsePresetDocument` and `serializePresetDocument` retain the complete document;
`parsePreset` and `serializePreset` remain config-only helpers. UI uses document
APIs, renderer receives only nested LabConfig. Name is optional, 1–80 characters,
retained verbatim. Edits, mode switching, backend Apply and simulation Reset
retain it. Restore defaults and unnamed imports clear it. Rejected imports/apply
retain the previous document. If only reset fails after successful apply, the
new config/name remain together with an explicit error.

JSON has explicit stable key ordering at every level, indent 2 and final LF.
Unknown keys at every level and missing fields are rejected; no filling defaults,
no v1 migration. Historical v1 schema remains for reference only. NaN/Infinity
are rejected. Every noninteger numeric field has precision 0.001; the runtime
Ajv validator uses a small floating arithmetic tolerance for decimal multiples.
Count is integer, without `multipleOf: 1000`.

## Defaults and ranges

| Field | Range | Default |
|---|---|---|
| mode | attractor, vortex | attractor |
| backendPreference | auto, webgpu, webgl2 | auto |
| simulation.particleCount | integer 1000–500000 | 65536 |
| simulation.spawnRadius | 1–100 | 10 |
| simulation.particleSize | 1–8 adapter units | 2.5 |
| simulation.lifetime | 0.5–20 simulated seconds | 6 |
| simulation.speed | 0.1–3 | 1.2 |
| modes.attractor.attractorStrength | 0.2–4 | 1.5 |
| modes.attractor.attractorRadius | 0.5–50 damping threshold | 6 |
| modes.attractor.attractorDamping | 0.8–1 | 0.98 |
| modes.vortex.vortexStrength | 0.2–4 | 1.5 |
| modes.vortex.vortexDamping | 0.8–1 | 0.99 |
| rendering.backgroundColor | #RRGGBB | #07111f |
| rendering.particleColor | #RRGGBB | #6ce6ff |
| rendering.opacity | 0.05–1 | 1 |
| rendering.additiveBlend | boolean | false |
| camera.enabled | boolean | true |
| camera.autoRotate | boolean; effective only when enabled | false |
| camera.distance | 5–500 | 30 |

Defaults are deeply frozen; `cloneConfig` creates independent nested snapshots.
Both mode groups are required and retained. There is no vortexRadius or flow
mode. Attractor stays the existing tangential/orbit implementation. Damping is
per step. Speed multiplies clamped delta once; lifetime uses simulated time;
spawn radius feeds init and respawn. See [architecture §5](../architecture.md)
for the exact active-workload hash matrix and full runtime mapping.

## Review and follow-up

Schema, runtime defaults, types, examples and contract tests migrate together.
The existing UI controls read nested values and update active strength only.
New controls remain #56; independent FPS freshness remains #55. No changes from
Draft PR #62 are imported. GPU parity and release/benchmark acceptance stay
separate; software/mock evidence is not physical GPU proof.

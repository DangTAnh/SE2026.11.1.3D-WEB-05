# Issue #102 — preview pointer routing

Independent baseline: `dev@3d1c4f64871dcc1d1d93c5a4ed99c1f54fe6dcc0`.
Branch: `fix/102-preview-pointer-routing`; TV4. Review: TV3 `justcoffeee`,
TV5 `DangTAnh`. Final HEAD/CI are recorded in the associated Draft PR.

## Cause and minimal fix

Absolute decorative overlays are siblings above the canvas. With their default
pointer-events:auto, center crosshair/upper tags/lower text intercept initial
pointerdown and wheel. Those events cannot reach canvas OrbitControls by DOM
bubbling because the canvas is a sibling, not their ancestor.

A scoped CSS rule makes `.scene-upper`, `.scene-bottom` and `.crosshair`
pointer-events:none. Noninteractive descendants, including `.render-tag`, mode
labels and the playback wrapper/gap, inherit it. `.playback button` restores
pointer-events:auto for the actual pause/reset hit targets. The existing
`.grid-layer` already has pointer-events:none. No touch-action, focus/hover,
layout, disabled semantics or camera implementation changes.

Only tokens.css changes production behavior. No UI import of GPU internals,
RendererPort/LabConfig/schema/hash/timing/backend/kernel change; rendererAdapter
and its OrbitControls lifecycle were inspected read-only. #103, bulk UI, #55/#56
and release #70 are outside this branch.

## Browser proof

`preview-orbit.html/ts` mounts the existing UI shell/fake RendererPort, then
attaches pinned real Three PerspectiveCamera and OrbitControls to that exact
canvas. No GPU renderer, camera double, fake orbit algorithm or production hook
is involved. OrbitControls handles the browser events and updates the real
camera synchronously. Snapshot reads position/quaternion/distance only.

`preview-orbit.spec.ts` covers:

- Center crosshair drag: hit target canvas, pointerdown recorded, real position
  and quaternion change while orbit distance is retained.
- Crosshair wheel: canvas wheel recorded and camera distance increases.
- Nearby uncovered canvas drag still changes real camera position.
- Upper pill/render-tag, lower mode text and exact gap between buttons pass
  hit testing AND real drag movement through to canvas.
- Buttons retain hit targets, hover, actual Tab/Enter/Space and focus outline;
  pause/reset port calls occur without any canvas pointerdown or camera change.
- Disabled real OrbitControls leaves the camera unchanged despite canvas events.
- Mobile CDP touch at crosshair changes the real camera and does not scroll;
  touch outside canvas still scrolls the page. Existing controls-owned
  touch-action:none remains, and disposal restores the previous inline value.

Touch uses Playwright Chromium mobile emulation/CDP, not a physical phone.
Desktop skips only the mobile-specific touch case; its mouse cases still run.
No production GPU/backend claim follows from this shell/camera harness. The
existing production UI/backend tests identify actual backend independently.

## RED/GREEN and verification

Before CSS patch: **2 desktop FAIL**, center hit resolves to the crosshair
(empty id) instead of canvas, and real camera wheel distance stays30 rather
than increasing. After patch: **13 PASS /1 SKIP /0 FAIL**, 28.8s, retries0.
Both projects run all six mouse/keyboard cases; the mobile touch case PASS.
RED and GREEN reports are preserved outside Git in task output.

Node22.16.0/npm11.10.1; TS5.9.3/Playwright1.64.0/Three0.186.1, no upgrades.
Both typechecks and 336 unit/integration tests /30 files PASS (including
renderer-orbit-controls lifecycle). Local browser is installed
Chrome157.0.8103.51 via temporary standard-config copy, project channel=chrome,
video=off, original projects/workers/assertions retained. Bundled browser
download timed out earlier; standard local bundled run NOT_RUN. CI uses the
committed Playwright config. Reproduce after installing locked dependencies
and bundled Chromium:

```sh
npx playwright test tests/e2e/preview-orbit.spec.ts --retries=0
npx playwright test tests/e2e/preview-orbit.spec.ts tests/e2e/ui.spec.ts tests/e2e/ui-port.spec.ts tests/e2e/backend-reinit.spec.ts --grep-invert '@evidence' --retries=0
npm run typecheck
npm run typecheck:tests
npm test
npm run build
git diff --check
```

Recorded local browser commands add `--config playwright.chrome.local.ts` using
the temporary override above; it is not committed. Independent human review,
physical-phone/GPU acceptance, release and deployment remain separate gates.

Final full relevant suite (camera + all UI + backend re-init): **69 PASS /1
SKIP /0 FAIL**, 2.9min, retries0. The one SKIP is the desktop copy of the mobile
touch test; mobile touch passed. Production backend tests separately establish
actual WebGL2/WebGPU results; camera-harness evidence remains explicitly
renderer-free. Production build and `git diff --check` PASS (existing chunk
advisory only). No #103 blocker was encountered in these checks, and no #103
fix or scientific/physical-device acceptance is implied.

# Live RendererStatus UI — issue #14, 24/10/2026

Branch: `feat/14-ui-live-status`, following `type/<issue-number>-slug`.
Initial baseline: PR #32, commit `ed914c0b5831e4e4cb67058aee014662bb9df684`.
PR #32 merged into dev at `1c466d2b164ed9731bea9dacc125f23f0385fda1`;
PR #33 targets dev. After #38 merged, this branch merged `dev@de6665a` and
resolved the fixture conflict by keeping `composeLab` plus controlled status
transitions. On 25/10 it integrated `dev@140eb41` with the real adapter from
#39. The initial #32 baseline below is historical.

## Completed UI work

- Removed synthetic runtime backend values, fixture key types, query parsers and
  preview-FPS helpers from source; removed URL-driven state from browser tests.
- RendererStatus.actual remains the only backend identity. Requested preference
  explains automatic fallback; it never replaces actual in the backend card.
- Finite, nonnegative values are displayed only with appropriate availability.
  Unavailable/invalid timing and measurements retained while paused are hidden.
  A measured zero is still a valid value when timing is available and running.
- Existing polling now has regression coverage for ready → fallback →
  unavailable → error → recovery and clearing old metrics/notices.
- Tests use an explicit controlled FakeRenderer with no production query path.
  The fake's status mutator lets `start()`/`pause()`/`dispose()` remain authoritative.
  Shared RendererPort, collector, preset v1 and physics are unchanged; current
  `main.ts` now comes from the #39 adapter integration.

## Verification

`npm run verify` after integrating #38: **119 unit/integration tests**,
**30 desktop/mobile Chromium E2E**,
source/test typecheck and production build PASS.
The browser suite includes axe WCAG A/AA checks for all four runtime phases.
TV1's requested changes on #33 led to valid-FPS detail, authoritative fake
status mutation, and current docs. TV1 approved head `03367331`. The old query
parser is absent from production source; one E2E deliberately passes
`?uiState=ready-webgpu` to verify that production ignores it.

On 25/10 after integrating `dev@140eb41`: `npm run typecheck` and
`npm run build` passed, `npm test` passed 119/119, and the Chromium E2E suite
passed 32 with 2 WebGPU skips (desktop/mobile) when run with one worker.
The production checks observed the initialized WebGL2 backend on this machine,
including `?webgl=1`; these checks do not prove WebGPU or GPU parity.

## Remaining integration gate

This is a draft UI candidate, not closure of #14. #32/#9/#25, composition root
#15 and adapter #12 are merged. Real WebGL2 initialization has been exercised
in Chromium; WebGPU is unavailable in this browser environment. GPU parity,
timing acceptance and the two-backend benchmark are NOT_RUN. Current port has no frame
timestamp or measurement-age field, so UI cannot independently determine the
freshness of numeric values while a producer claims it is running.

PR #33 targets dev; CI checks the final candidate head.
Exercise the same UI with actual WebGPU and WebGL2, forced fallback and
unavailable/error paths before marking #14 accepted. No default branch,
release, deployment or shared preset/configHash decision is changed here.

## Other TV4 work

#16 (preset v2 adoption) remains blocked on the configHash field-set decision
owned by TV1 and the public Vortex parameter/default mapping with TV2/TV3.
The current v2 schema contains vortexStrength only, while reference kernels
use vortexDamping too. No speculative schema/type migration was introduced.

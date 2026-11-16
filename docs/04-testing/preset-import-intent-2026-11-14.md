# Issue #98 — preset import intent

Baseline: `dev@3d1c4f64871dcc1d1d93c5a4ed99c1f54fe6dcc0`.
Owner: TV4; review: TV1 `minhhhduc`, TV5 `DangTAnh`.
Final commit and CI are recorded in the associated Draft PR.

## Behavior and root cause

Previously, the file change handler checked only disposal after `File.text()`.
A slow A could apply after B, or after Restore defaults. Its `finally` could
also clear the input used by a later selection. Completion order owned state.

`bindLabControls` now owns a monotonically increasing import generation. A
nonempty selection captures its File, advances the generation and clears the
input synchronously, before checking size or awaiting text. A newer invalid
selection still supersedes older reads. Cancellation/no file is not a new
selection. After the await, stale requests return before parsing or applying;
success/error notifications also require the current generation and live UI.
There is no asynchronous input cleanup. Re-selecting the same file remains
possible even while another read is pending.

Restore defaults, speed/size/strength/count/color edits, mode selection, backend
preference and explicit backend Apply invalidate pending imports immediately,
including an edit whose renderer apply fails. Count input invalidates intent
before its later change commit. This preserves the user's latest deliberate
action rather than reviving an obsolete import after a rejected action.
Pause/resume, simulation reset and export do not change configuration intent
and do not cancel reads. Dispose advances the generation and removes handlers.
Reads are logically invalidated, not physically cancelled; File.text has no
AbortSignal contract here. No timeout or delay establishes ordering.

The existing app transaction still owns config/name rollback: rejected apply
retains both, while successful apply followed by reset failure retains the new
config/name. RendererPort, preset v2/schema, configHash, adapter, simulation,
backend selection and GPU timing are unchanged. Bulk UI and #103 are excluded.

## Regression coverage

`tests/e2e/preset-intent.spec.ts` adds 16 cases per desktop/mobile project:

- A/B out-of-order completion; pending import vs Restore defaults.
- Newer invalid schema and oversized selection; stale success and rejection.
- Unmount followed by resolve or reject, with no later calls or toast changes.
- Synchronous input cleanup and repeated selection of the same file.
- Seven config edit paths invalidate pending import.
- Pause/reset keep import intent; exactly 1,000,000 bytes remains allowed.
- Rejected renderer apply retains the exported config and metadata, without reset.

Tests use controlled File.text promises, real DOM input selection and JSON
downloads. They assert full exported documents, renderer apply calls and toast
mutations (including repeated identical messages). The UI harness uses a fake
RendererPort: these tests do not prove GPU rendering or physical-phone behavior.
Existing ui.spec/ui-port.spec retain normal import, schema, metadata, reset,
rollback, lifecycle and disabled-state coverage.

## Test-first evidence and environment

Node 22.16.0, npm 11.10.1; lockfile TypeScript 5.9.3, Playwright 1.64.0,
Three 0.186.1. No dependency updates. npm ci reported one moderate advisory;
no unrelated audit fix was applied.

Before implementation, two desktop assertions failed on real calls `[B,A]`
and `[defaults,A]`. Mobile restore failed for the same reason; the mobile A/B
attempt timed out navigating at load. Initial attempts did not reach assertions
because bundled Chromium/ffmpeg were absent. These environment failures are
separate from the behavioral RED. RED artifacts are retained outside Git in
the task workspace's `output/tv4-fixes-20261114/red98` directory.

The new tests await DOMContentLoaded and fixture readiness, avoiding an external
resource load dependency. After patch: targeted desktop/mobile **32 PASS, 0
FAIL, 0 SKIP**, retries 0. Both typechecks PASS; Vitest **336 PASS /30 files**;
production build PASS (existing large-chunk advisory); diff check PASS.

Browser download timed out. The targeted run used installed Chrome via a
temporary copy of the repository Playwright config, preserving both projects,
workers=1 and assertions, setting each project's `use.channel` to `chrome` and
`use.video` to `off` (ffmpeg unavailable). That temporary config is not shipped.
Reproduce with the committed config after `npx playwright install chromium`:

```sh
npx playwright test tests/e2e/preset-intent.spec.ts --retries=0
npm run typecheck
npm run typecheck:tests
npm test
npm run test:e2e
npm run build
git diff --check
```

Full equivalent E2E command:
`npx playwright test --grep-invert '@evidence' --config playwright.chrome.local.ts --retries=0`:
**114 PASS, 0 FAIL, 6 SKIP**, 5.3 minutes, no retries. Chrome 157.0.8103.51.
The six skips are two unavailable-only scenarios on each project (this browser
supports WebGL2/WebGPU) and two desktop-only parity cases on mobile. They are
not passes. The standard bundled-Chromium local suite is NOT_RUN to completion
because its browser download timed out. A first npm invocation with forwarded
config arguments and an unquoted PowerShell filter attempt both found no tests;
the correctly quoted direct command above ran all 120 cases.

CI uses the committed config and bundled Chromium; see the PR for its actual
status. Independent human acceptance, physical GPU/phone tests and release
acceptance are not established.

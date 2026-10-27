# Issue #54 — backend Apply lifecycle

Candidate branch: `feat/54-backend-reinit`, from `dev@ac364912`.
Delivery owner: TV4. Required reviewers: TV1 (composition) and TV3 (adapter lifecycle).

## Behavior and design

Select Auto/WebGPU/WebGL2, then **Áp dụng backend**. The composition session
disposes the old concrete port and creates another on a fresh canvas. A canvas
retains its context type, so disposing a renderer is insufficient for switching
WebGL2/WebGPU. The UI receives a stable RendererPort facade and remains mounted.
The observer watches the unchanged host; resize measures the current canvas.

The latest init generation alone can publish its backend. Superseded/pending
ports are disposed once. Init failure reports unavailable, clears metrics and
allows retry. Config edits made during pending init are applied on completion.
Pause intent survives; particle state restarts with the new renderer. No shared
RendererPort change, Three import in UI or second simulation path was introduced.

## Verification

- Source typecheck, test typecheck and production build: PASS.
- Focused session/composition integration: 10 PASS.
- New desktop/mobile Chromium E2E: 6 PASS. Includes actual production WebGL2 →
  WebGPU request → Auto → WebGL2 without reload, fallback/actual reporting,
  preserved speed/pause, fresh canvas, failure/retry, latest request and poll cleanup.
- Full `CI=1 npm run verify`: PASS — source/test typechecks, 140 unit/contract/
  integration tests, 44 desktop/mobile Chromium E2E passed, two WebGPU-adapter
  cases skipped, production build passed. No retries were needed in this full run.
- Existing Vite >500 kB chunk warning remains; no dependencies were changed.

Reproduce with Node >=22.16, `npm ci`, Chromium installed, then:

```sh
npm run typecheck
npm run typecheck:tests
npm run build
npm test -- tests/integration/renderer-session.test.ts tests/integration/composition.test.ts
npm run test:e2e -- tests/e2e/backend-reinit.spec.ts --workers=1
CI=1 npm run verify
```

On PowerShell, set `$env:CI='1'` before `npm run verify`. If the execution
environment's shared temporary directory is inaccessible to workers, point
TEMP/TMP to a writable local temporary directory. This is an environment setting,
not a repository test change.

The first new poll-count test used clock.fastForward, which intentionally skips
repeated interval ticks; clock.runFor now exercises all three 500ms ticks.
The initial production lifecycle run at 20,000 particles timed out during browser
interaction; the new lifecycle test uses a valid 1,000-particle configuration
and retains all lifecycle assertions. Existing production tests remain unchanged.

## Limits and remaining work

Fake ports prove cancellation/config/cleanup behavior, not GPU execution. Real
WebGPU is unavailable in this Chromium environment. Hardware WebGPU switching,
device removal, numeric readback parity and fair performance comparison are
NOT_RUN. Existing adapter GPU timestamp cadence and runtime recovery issues are
outside #54 and require TV3 follow-up; this PR does not claim they are fixed.

No PR merge, release or MVP acceptance is implied by local test results. #16 is
blocked by Vortex/hash decisions (#49); #55 waits for contract/collector review
of Draft #62; #56 waits for #16/#49. Human TV1/TV3 review precedes owner merge.

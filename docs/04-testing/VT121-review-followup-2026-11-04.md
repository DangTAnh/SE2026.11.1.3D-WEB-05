# PR #81 review follow-up — 04/11/2026

Codex-assisted implementation and verification; not independent human approval.
Baseline PR HEAD: `4eb31d31e732fd26f4e7cde51dac2db98c73797d`.
Live base `dev`: `8f7c3eeb74c7a9501332b265fa16a6aa552aa2b3`.

## Review disposition

| Review request | Classification | Disposition |
|---|---|---|
| TV5 same-file retry after cancelled read | Confirmed P2 bug | Keep File, synchronously clear input before awaiting; request generation unchanged. Native Chromium regression RED before patch. |
| TV1 live-document validation | Design concern | Keep strict snapshot validation. Supported production paths audited; native range sanitization test covers nonfinite, empty, out-of-range and excess-precision numeric assignments. No supported malformed-state path established. |
| TV1 Windows failures | Regression/test failure investigation | Compare original PR head, fixed head and base with same pinned browser/dependencies, normal HTTP, retries=0. See execution results below. |
| TV1 latency target | Acceptance/NFR decision | Historical raw 200-job queue p95 recomputed: 13347.9991 ms, service p95 894.3478 ms, errors 0. NFR NOT_MET in capped browser harness; 200 real concurrent users NOT_VERIFIED. |
| TV1 committed output | Repository hygiene | Byte-verified ZIP backup of all 42 files, stop tracking current raw output, retain local files and immutable original Git commit with SHA-256 manifest. |
| Independent approval / shared harness ownership | Human gate | Re-review by TV1/TV5 and independent human approval remain required. No AI approval. |

## Live-document contract and reachability

`mountLabUI` owns a cloned default config. Only its local update callback writes that config; the renderer receives a separate clone. Numeric controls are HTML range inputs with min/max/step matching the schema. Their values are sanitized by Chromium before Number(value). Color/select/mode controls use bounded native values. Preset imports use the real v2 parser; defaults use DEFAULT_CONFIG. Undo restores a validated deep snapshot. Backend reinitialization receives config through the existing port and does not write arbitrary values into the UI closure.

Malformed objects supplied directly to the controller in a test or a forged DOM/event are outside supported user paths. A future programmatic config writer or new text/number input must validate at its boundary. The existing S4 test deliberately rejects an invalid live snapshot. Making snapshots best-effort would change the rollback/Undo contract and could restore invalid state; no such change is justified by current reachability evidence.

## Windows failure investigation

Historical trace from the isolated mobile backend failure was inspected: actual backend WebGL2 and runtime phase ready assertions completed successfully. Subsequent canvas lookup/bounding operations took seconds; the final beforeunload evaluation remained pending when the global 60s budget expired. This is evidence of cumulative browser/renderer responsiveness in that run, not an import/Undo failure. It does not alone identify the underlying GPU/driver cause.

Historical poll test installs a clock without pausing it, then assumes exactly three polls after runFor(1500); real time can advance before that call. That is a timing risk, not proof that this PR introduces another poller. No timeout/assertion is changed here. Fresh base/head runs decide reproducibility; a pass is NOT_REPRODUCED, never retroactive FIXED.

## NFR source and measurement scope

The user supplied the original VT-121 assignment on 04/11: 200 concurrent users/tasks, p95 <= 5.0s; if real load cannot run, describe a harness, simulated data and limits. The user identifies themselves and GPT as scope decision makers. This clarification permits an honestly scoped experiment; it does not waive the latency target.

The browser script submits 200 tasks at one monotonic start, limits execution to 10 contexts, and measures latency through Playwright import, DOM assertions, Undo and DOM assertions. Undo is in the measured operation, but there is no per-phase controller profile establishing it as the bottleneck. Queue-inclusive latency cannot be replaced with service-only timing. The Node script exercises real parser/snapshot/Undo/assertions in one event loop; it cannot establish real-user/GPU capacity. No speculative optimization, framework/dependency change, or SLO relaxation is made.

## Evidence preservation

[Archived raw evidence and SHA-256 manifest](VT121-evidence-archive.md) links all 42 files to immutable commit 4eb31d3. Current test/benchmark sources remain tracked. New raw logs are kept outside the checkout in the local output/fix81-20261104 directory, not committed as temporary output. Existing submission PDF/ZIP are unchanged.

## Executed verification

Environment: Windows, Node 22.16.0, Playwright 1.64.0, pinned Chromium 156.0.8078.4 (revision 1248), headless, one worker, retries=0, normal HTTP at 127.0.0.1:4173. Installed package versions were checked against the lockfile: zero mismatches. Lockfile SHA-256: `6f72045deb3e5befa830bfbf3b78ae34de2a782f7a4c8b7d8f9daa9018c5e703`. No dependency upgrade; shared existing installed packages were reused. Browser suites were run sequentially with separate output paths.

- RED before implementation: `npx playwright test tests/e2e/presetReselect.spec.ts --project=desktop-chromium --retries=0 --max-failures=1`: 1 expected failure, 3 not run. Native file input remained `C:\fakepath\preset.json` after cancellation. Earlier setup-only attempt failed because pinned browser was missing; installer subsequently succeeded.
- GREEN after implementation: `npx playwright test tests/e2e/presetReselect.spec.ts tests/e2e/undoImportV2.spec.ts --retries=0`: 26 PASS / 0 FAIL, desktop + mobile, 31.2s. New file has 9 cases per viewport. Existing unit parser/race/error/history and Undo E2E assertions remain unchanged.
- Original PR HEAD full `npm run verify`: PASS, 336 unit/integration, 84 E2E PASS / 12 capability SKIP, both typechecks and build PASS; E2E 8.6 minutes, no retries. Historical Windows failures NOT_REPRODUCED in this campaign, not declared FIXED.
- Fixed source/tests: source typecheck, test typecheck, 336 unit/integration, build PASS. First restricted worker run hit temp-file ENOENT (19 suites failed to load, 110 executed tests passed); rerun under consistent host temp access passed all 336. This setup failure is retained in tool history and is not counted as a product pass.

Patch commit: `ecbbf45ed4a0682b428e9f2ba5a10deb3584ba97` (`fix(presets): allow same-file retry after cancelled import`).

To reproduce RED, copy the new presetReselect spec into an isolated checkout of original 4eb31d3 and run the command above. GREEN uses the fixed head. No published history was rewritten and the original workspace was not reset or stashed.

### Base comparison

Base `8f7c3ee`: `npx playwright test tests/e2e/backend-reinit.spec.ts:5 tests/e2e/backend-reinit.spec.ts:204 tests/e2e/backend.spec.ts:39 tests/e2e/renderer-adapter.spec.ts:3 --retries=0`: **8/8 PASS**, both viewports, 3.4 minutes. Same browser/dependencies/normal HTTP/one worker. Corresponding original PR tests passed in the 8.6-minute full campaign. Static base/head comparison shows GPU code unchanged; old backend test assertions are identical (only optional fixture import differs, transport unset here). No introduced regression established. Original failure root cause remains unproven; separate lifecycle/clock timing and hardware responsiveness concerns remain visible.

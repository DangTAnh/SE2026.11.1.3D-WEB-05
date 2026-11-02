# VT121 README — v2 cached-dev candidate

Node22.16.0/npm11.10.1, Windows10.0.26300, Chromium156.0.8078.4. Personal branch feat/tv4-bt3-vt121-undo-import-v2 from cached dev2389f0f. Current remote dev is UNVERIFIED; no merge.

PowerShell from repository root:

```powershell
npm ci --no-audit --no-fund
# Actual install in this environment used cached lockfile packages:
# npm ci --offline --no-audit --no-fund
$env:TEMP = "$PWD/output/VT121-final/tmp"
$env:TMP = $env:TEMP
New-Item -ItemType Directory -Force $env:TEMP | Out-Null
npm run typecheck
npm run typecheck:tests
npm test
npm run build
```

Default E2E uses the original Vite server. This terminal denies DNS and loopback. Existing browser can be selected explicitly and real Vite-transformed modules delivered through intercepted transport:

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = 'C:/Users/PC/AppData/Local/ms-playwright'
$env:VT121_VITE_TRANSPORT = '1'
Remove-Item Env:VT121_SOURCE_BASELINE -ErrorAction SilentlyContinue
npx playwright test tests/e2e/undoImportV2.spec.ts --config=playwright.vt121.config.ts --workers=1 --retries=0
npm run verify
```

This optional fixture modifies transport only. All existing test assertions are unchanged; each old spec has a one-line fixture import. Vite loads actual modules, schemas and real GPU code where existing tests invoke it. Undo E2E uses the explicitly labelled FakeRenderer UI/port fixture and is not GPU performance proof. Vite HMR's local WebSocket is accepted by the test transport and ws:false stops its server socket; app pageerror checks remain unchanged. No application WebSocket exists today. Unset VT121_VITE_TRANSPORT to use normal Vite networking. Source-baseline override must be unset for GREEN/regression/load.

RED commit bfd124749412e93d32b4048d0fd6173bb4f58cb9 contains test/plan/transport only, no production Undo. To repeat RED, checkout that commit in a separate worktree, install lockfile dependencies, set the transport/browser/TEMP variables, and run the E1 command above. Expected failure: missing Undo after successful nested document import/export. GREEN e808d70a792ffb377c8b310f8f9e0bb441ba5dc0 adds implementation and tests. Optional VT121_SOURCE_BASELINE can read actual src files from an immutable baseline checkout for retrospective diagnostics; it does not replace the pre-implementation RED evidence.

Mutation: create a temporary worktree from GREEN, remove only assertAuthorized(actor) inside undo in src/presets/importUndo.ts, keep import guard. Run:

```powershell
npx vitest run tests/unit/importUndoV2.test.ts -t 'AUTH2 unauthorized undo'
```

Expected exit1: missing authorization exception. Exact diff is VT121-v2-mutation.patch in evidence. No mutation commit was made. Remove only this verified temporary worktree/branch, then rerun tests in the safe feature worktree. Do not push mutation.

```powershell
# Three independent rounds (seeds121,122,123):
npx vitest run --sequence.shuffle --sequence.seed=121
npx playwright test tests/e2e/undoImportV2.spec.ts --config=playwright.vt121.config.ts --workers=1 --retries=0
# Source-only selected modules; no new coverage dependency:
node --experimental-strip-types --experimental-test-coverage --test --test-coverage-include=src/presets/importUndo.ts --test-coverage-include=src/ui/controls/presetFile.ts tests/unit/importUndoV2.node.test.mjs
# Node200 sessions, five rounds and1000 warmup operations:
node --experimental-strip-types bench/importUndo200-v2.mjs
# Optional additional browser/port200 tasks, max10 active contexts; one round:
npx playwright test tests/e2e/vt121-load.spec.ts --config=playwright.vt121.config.ts --project=desktop-chromium --workers=1 --retries=0 --grep "@vt121load"
```

Latency quantiles use nearest rank over measured monotonic timings. Node latency includes microtask queue delay; browser latency includes queued jobs, Playwright overhead and file/DOM operations. Neither experiment verifies200 simultaneous real-user end-to-end p95<=5s. API tests NOT_APPLICABLE. Capability is internal session ownership only; rollback conditional; post-commit reset warning is not a rejected import. Human review/issue/current-dev reconciliation/push/PR remain separate gates. See final handoff for actual results, failures and logs.

Concurrent campaigns must set different VT121_TEST_OUTPUT and PLAYWRIGHT_HTML_OUTPUT_DIR values. Evidence run.ps1 does this automatically per log name; normal sequential default still uses test-results. The initial simultaneous-campaign ENOENT failures are retained in05-regression-restored.log. Final isolated regression has a separate log. Do not run performance concurrently with GPU regression when interpreting latency.

## Restore the exact local histories

After extracting the evidence ZIP, `git clone --branch feat/tv4-bt3-vt121-undo-import-v2 VT121-all-local.bundle restored-vt121` restores real commits without network. The bundle also retains the v1 feature ref. Verify the bundle with `git bundle verify VT121-all-local.bundle` inside a Git repository. Bundle provenance/refs are in logs/12-final-git.log. This does not publish a branch or create a PR.

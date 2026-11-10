# VT-122 evidence index

Generated on Windows 11, Node v24.22.1, npm 11.19.1, Vitest 5.0.3, Vite 6.4.4,
Playwright Chromium (headless shell 1248).

| File | What it records |
| --- | --- |
| `red.txt` | First targeted run before implementation: 12 failed / 3 passed |
| `green-targeted.txt` | 15 targeted tests after implementation |
| `green-full.txt` | Full suite after implementation: 287/287 |
| `green-full-after-pairwise.txt` | Full suite after pairwise: 305/305 |
| `green-final.txt` | Full suite before merging `dev`: 310/310 |
| `green-merge-dev.txt` | Full suite after merging `dev`/PR #89: 336/336 |
| `build-merge-dev.txt` | Typechecks + build after the merge: PASS |
| `pairwise.txt` | 18 pairwise rows pass |
| `coverage.txt` | 100% statements/branches/functions/lines |
| `coverage-summary.json` | Machine-readable copy of the coverage summary |
| `flaky-shuffle.txt` | 20 shuffled seeds, all 36/36 |
| `mutation.diff` | One-line `>` → `>=` mutant |
| `mutation-meta.txt` | Mutant commit, parent, operator, result |
| `mutation-survive.txt` | Non-boundary T02 passes on the mutant |
| `mutation-killed.txt` | Boundary T05 fails on the mutant |
| `mutation-full.txt` | Full targeted run on the mutant: 5 failed / 31 passed |
| `unique.json` | 100 unique tasks, run 1 |
| `duplicates.json` | 100 tasks / 10 keys, run 1 |
| `serialized-control.json` | Deliberate serialization control, run 1 |
| `load-run.txt` | Load command output, run 1 |
| `load-run2.txt`, `load-run2/` | Load command output and JSON, run 2 |
| `load-run3.txt`, `load-run3/` | Load command output and JSON, run 3 |
| `ai-candidates-before.txt` | Six AI candidates all passing before review |
| `ai-candidates-after.txt` | Two rewritten recovery tests |
| `review-91-fix.md` | Review P2: non-string request ids, root cause, fix, red/green |
| `review91-t07-red.txt` | T07 with the `typeof` guard reverted: 1 failed |
| `review91-t07.txt` | T07 after the fix: 1/1 passed |
| `build.txt` | `npm run build` including both typechecks |
| `e2e.txt` | Local full E2E: 75 passed, 12 skipped, 1 mobile teardown timeout |
| `e2e-rerun.txt` | Local single mobile rerun: same teardown timeout |

Published CI on `f88a94b` (run `42590832942`) passed: 310 tests, 76 E2E pass /
12 capability skips, both typechecks, build, CodeQL and Analyze. After merging
`origin/dev`, CI on `e865cdf` (run `42771452722`) passed with 336 tests, 76 E2E
pass / 12 skips, CodeQL and Analyze. The local mobile teardown failure did not
reproduce on the Linux runner, so it is recorded as an environment-specific
result rather than a VT-122 pass.

## Load summary (three runs)

| Run | Scenario | p95 ms | Calls | Effects |
| --- | --- | ---: | ---: | ---: |
| 1 | unique | 64.2 | 100 | 100 |
| 1 | duplicates (10 keys) | 58.0 | 10 | 10 |
| 1 | serialized control | 5913.5 | 100 | 100 |
| 2 | unique | 58.6 | 100 | 100 |
| 2 | duplicates (10 keys) | 54.0 | 10 | 10 |
| 2 | serialized control | 5897.9 | 100 | 100 |
| 3 | unique | 63.4 | 100 | 100 |
| 3 | duplicates (10 keys) | 57.1 | 10 | 10 |
| 3 | serialized control | 5911.0 | 100 | 100 |

Target p95 ≤ 3000 ms. The unique/duplicate scenarios pass; the control is
expected to fail the target because it serializes all 100 calls. Scope: one Node
process, 50 ms simulated I/O per call, no network/DB/user-capacity claim.

## E2E note

The full regression ran for 13.6 minutes: 75 passed, 12 expected skips, 1 failed.
The failure is in the unchanged `tests/e2e/renderer-adapter.spec.ts` mobile
project, during context teardown:

```text
Tearing down "context" exceeded the test timeout of 90000ms.
Error: browserContext.close: Test ended.
```

The same single test was rerun alone and failed the same way (`e2e-rerun.txt`),
so this is reproducible in this environment, not a one-off random flake. The
VT-122 module is not imported by the application or by that test; no UI, backend
or renderer file was changed. The unchanged test passed on the Linux CI run, so
this is recorded as a Windows test-harness limitation, not as a VT-122 pass.

# VT-124 execution ledger

Issue #93; baseline `e55405da0bd2546d33baa53acda060c470e2200d`.
Isolated branch `feat/93-bulk-preset-import`. Windows, Node v24.21.0,
npm 12.2.0; committed lockfile, Vitest 5.0.3. No package changes.
User plan review and correction are recorded in [plan.md](plan.md).

## Actual runs (separate checkpoints)

| Checkpoint | Command | Observed result |
|---|---|---|
| Baseline dev | npm ci; npm test | install exit0; 336/336 tests,30files PASS |
| RED stub, then committed as 296a797 | npx vitest run tests/unit/preset-batch.test.ts tests/integration/preset-batch.test.ts | exit1,23/23 FAIL;18unit+5integration, explicit unimplemented behavior |
| GREEN implementation, committed as afb31fc | same targeted command | exit0,23/23 PASS,2files |
| GREEN working tree | npm run typecheck; npm run typecheck:tests | both exit0 |
| GREEN working tree | npm test | exit0,359/359 PASS,32files |
| GREEN working tree | npm run build | exit0,209modules; existing1092.96kB chunk advisory |
| Agent review follow-up | targeted command after adding T15b | exit0,24/24 PASS; aggregate multibyte exact/+1 byte oracle |
| Reviewed full suite | npm test; both typechecks; npm run build | exit0,360/360 PASS,32files; both types/build PASS |
| Complete E2E | npm run test:e2e, normal local-server permissions | exit0,76 PASS/12 SKIP,9.2min,1worker,retries0,no actual retry/flaky |
| Mutation 5bb5192 (separate local-only branch) | targeted suite with processing type guard inverted | exit1,19 FAIL/5 PASS; T01 and T02/T03 fail |
| Restore feature branch | same targeted command; source hash comparison | exit0,24 PASS; original blob cd35524f1e6d3d12fa94c11cb5abd2877851b062 restored |
| V8 selected-module coverage | targeted suite with coverage.include=src/presets/batchImport.ts | lines21/21,statements27/27,functions2/2;branches19/20=95% |
| Shuffle repeat | targeted suite, seeds12493/20261114/930124 | each exit0,24/24 PASS |
| Load rounds1-5 | vitest.vt124-load.config.ts | each exit0,120tasks,0errors;p95 62.4054/61.6537/63.7603/71.9902/82.1818ms |
| Final EOF-only cleanup | both typechecks; npm test; npm run build | exit0,360/360 PASS; removed trailing blank EOF lines only, no behavior change |

The initial RED uses a deliberately throwing contract stub, not an old production
bulk implementation. For example, T02/T03 expected two accepted documents and
one indexed rejection but instead received `VT124 bulk import not implemented`.
No module-import, compiler or test-discovery error is counted as feature RED.
Both valid documents are checked directly after GREEN; error assertions are not
inside a catch that could swallow a failed expectation.

The later 24-test suite adds an oracle after review. It was not present in the
original 23-test RED checkpoint; no retroactive RED result is claimed for T15b.

## Review / rulings

- Read-only fresh-context agent review inspected only this module/test slice and
  the shared preset parser. It ran no tests, edited no files and gave no human
  approval. Finding: single-record boundary tests did not protect cumulative
  byte accounting. Added T15b with two multibyte documents, each <1MB, whose total
  is exactly1MB and then1MB+1. Current implementation already accumulated bytes
  correctly; no production patch was needed for this finding.
- The state model is an oracle on observable reports from successive prefixes,
  not a persistent/async importer. No callback/test-only trace was added to the
  production API solely to satisfy the testing technique.
- Envelope/resource failures reject before any record parsing. Per-record JSON,
  schema and runtime-type failures become indexed rejected items. Accepted
  documents are returned in memory, not applied or persisted.

## Environment interruptions (not application regression evidence)

- The first full E2E attempt in the sandbox never started a listening Vite
  server or reported any test cases. After investigating only its own processes,
  it was explicitly terminated; it is INCOMPLETE, not PASS or a demonstrated
  product failure. Original `e2e.log` retained.
- A second unchanged `npm run test:e2e` campaign with normal local-server
  permissions is recorded separately as `e2e-unsandboxed.log`: exit0,
  76 PASS/12 SKIP. No test/harness weakening was made. The initial interruption
  had exit-1 and no test cases; it is not merged into this successful result.
- A Git-index write denied in the sandbox was retried through authorized
  escalation; GREEN commit afb31fc succeeded. An earlier verification command
  rejected by the approval service's usage limit was not executed; subsequent
  successful runs above have their own logs/results. Neither is a test result.

Local raw logs and exit ledgers are retained under `vt124-evidence.local/` in
this worktree (ignored, outside dependency/build directories). Selected raw
execution logs, exit ledgers and all five load JSONs are also preserved in
[evidence/](evidence/). Public text excludes personal student metadata.
Committed console-log copies normalize trailing spaces/blank EOF lines for
git diff --check; verbatim originals remain in the local evidence package.
The complete E2E run preceded the final trailing-EOF cleanup; final G0/unit
checks were repeated afterward. No production/test logic changed in that cleanup.

## Mutation and performance interpretation

The boolean business rule requiring JSON-text records was inverted on a separate
branch only. Mutation commit 5bb5192 is not feature ancestry and is not pushed.
After restoring the feature, the source blob matches exactly. A killed mutation
is one useful counterexample; it is not proof that every regression is detected.

Load starts 120 promises at one barrier. Each receives20 independent texts with
15valid/5malformed JSON. The nearest-rank p95 is the114th of120 latencies, using
one common submission timestamp including initial queue/validation/assertions.
Input creation is outside the measurement. Failures and their latency remain
in raw output before campaign assertions. Five rounds run after E2E/repeats,
without another verification campaign competing. No HTTP/DB/GPU or simulated
service I/O is involved; this proves only this single-process batch workload.

Flaky risks assessed: real scheduler timing (retain all rounds; do not extrapolate
user capacity); order/shared mutable state (isolated inputs and shuffle seeds);
network (unit/load have none; E2E server-start interruption separately recorded).

## Remaining evidence

The PDF is a local AI-assisted report with a reflection draft for student
confirmation. Remote CI must be read on the actual pushed head. New hardware
WebGPU/timestamp/parity, real-user capacity, durable storage, deployment and
independent human acceptance are NOT_RUN/unverified. No merge/deploy/tag.

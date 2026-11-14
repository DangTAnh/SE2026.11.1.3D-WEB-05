# VT-124 — isolated bulk preset import

Issue [#93](https://github.com/DangTAnh/SE2026.11.1.3D-WEB-05/issues/93).
Baseline: `e55405da0bd2546d33baa53acda060c470e2200d` (`origin/dev`).
Branch: `feat/93-bulk-preset-import`. [Approved plan and human feedback](plan.md).

## Scope and use

`importPresetBatch` in `src/presets/batchImport.ts` receives an array of independent
JSON texts (the contents of exported preset files). It uses the existing strict
v2 parser separately for every record. It returns ordered `items`, accepted and
rejected counts, and `EMPTY`, `VALID_ONLY`, `ERROR_ONLY` or `MIXED` state.
Accepted items contain full documents; rejected items contain index and reason.
One bad record never discards accepted records or prevents processing later ones.
Duplicates are retained; separate calls/results do not share mutable documents.

Non-array input, more than 100 records or total string content greater than
1,000,000 UTF-8 bytes rejects the whole call before parsing. Exact boundaries
are allowed. Non-string array elements, including sparse slots, become individual
rejections. A malformed record is recoverable because it is a separate text;
this API is not a parser for one damaged JSON-array file.

No bulk UI, File API, real storage/API, renderer effects or durable import is
implemented. Returned accepted documents are in memory. Existing single-file
UI remains unchanged. Module owner/human review is still required.

## Reproduce

Node >=22.16 and the committed lockfile; no dependency upgrade:

```powershell
npm ci
npx vitest run tests/unit/preset-batch.test.ts tests/integration/preset-batch.test.ts
npm run typecheck
npm run typecheck:tests
npm test
npm run test:e2e
npm run build
git diff --check

# Separate Phase 3 campaigns; not part of normal verify:
npx vitest run --coverage --coverage.include=src/presets/batchImport.ts
npx vitest run tests/unit/preset-batch.test.ts tests/integration/preset-batch.test.ts --sequence.shuffle --sequence.seed=12493
npx vitest run --config vitest.vt124-load.config.ts
```

RED checkpoint `296a797` deliberately has only a throwing contract stub. In a
disposable checkout of that commit, the original 23 tests fail because the bulk
behavior is unimplemented; it is not an installation/import error. GREEN code
is commit `afb31fc`. A later review strengthens the total-byte test across two
records; it is additional oracle coverage, not a claimed new RED experiment.
See [actual execution ledger](evidence.md) for separated command results.

## State transition testing / traceability

Transitions are checked through successive batch prefixes against literal
expected states/outcomes. The model describes the observable report; there is
no asynchronous session state or invented processing event stream.

| Current | Valid record | Invalid record |
|---|---|---|
| EMPTY | VALID_ONLY | ERROR_ONLY |
| VALID_ONLY | VALID_ONLY | MIXED |
| ERROR_ONLY | MIXED | ERROR_ONLY |
| MIXED | MIXED | MIXED |

| AC / risk | Cases | File | Oracle |
|---|---|---|---|
| AC1 strict existing validation | T09,T11,T12 | unit + integration preset-batch | v1/unknown/missing/type/range/precision reject, later valid accepted |
| AC2 per-record isolation | T02/T03,T04,T05,T06 | unit/preset-batch.test.ts | both valid documents survive valid-error-valid; continue after error |
| AC3 accounting/state/order | T04-T08,T14,T19,T20 | same | literal states, exact ordered statuses/indices, duplicates and holes accounted |
| AC4 full-document/isolation | T01,T10,T13,T22 | unit + integration preset-batch | names/config match, mutation cannot cross results, published bytes preserved |
| AC5 unrelated regression | existing single import/export/unmount cases | tests/e2e/ui-port.spec.ts and existing repository suite | existing behavior assertions retained; see execution status |
| Resource constraints | T15,T15b,T21 | unit/preset-batch.test.ts | count and cumulative UTF-8 exact/+1 boundaries, invalid envelope rejects |

The accepted plan's T16/T17 refer to existing UI regressions, not new tests
authored for VT-124. T18 is a future load campaign and remains NOT_RUN.

## Mutation, coverage and measured load

Local-only branch `test/93-bulk-type-guard-mutant`, commit `5bb5192`, inverts the
record type guard. Targeted suite: 19 FAIL/5 PASS (24). The feature branch was
restored, source blob verified unchanged and targeted suite returned to 24 PASS.
Reproduce only in an isolated checkout: change the processing guard from
`typeof record !== 'string'` to `typeof record === 'string'`, then run targeted
tests. T01 and T02/T03 must fail. Never push/merge the mutant into the feature.

Selected-module coverage: 100% lines/statements/functions, 95% branches (19/20).
The uncovered branch is a non-Error throw fallback; no 100% branch claim. Three
shuffle seeds pass 24/24 each. Existing E2E: 76 PASS/12 SKIP, retries=0; a first
sandbox server-start interruption is retained separately, not counted as PASS.

Five load rounds: 120 tasks, 20 records each (15 valid/5 invalid), zero task
errors each; p95 62.4054, 61.6537, 63.7603, 71.9902, 82.1818ms, all <=3500ms.
The common-release clock includes initial dispatch queue, parsing and assertions;
input preparation precedes the clock. This is one Node process with synchronous
parsing and 120 promises, not 120 CPU workers or HTTP/DB users. Raw results are
in [the evidence directory](evidence/); every task/round is retained.

## Limits / handoff

The local PDF/reflection is AI-assisted and needs the student's own reading,
edits and confirmation before submission. No bulk UI, durable persistence,
production-user capacity, hardware WebGPU/timestamp freshness, physical-GPU parity,
deployment or independent human acceptance is proven. No merge/deploy/tag.

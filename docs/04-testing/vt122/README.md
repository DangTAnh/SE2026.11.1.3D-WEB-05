# VT-122 — Idempotent preset resubmission

Personal BT3 vertical slice for Lê Huy Anh Dũng (23001846), team SE2026-T30,
project 3D-WEB-05. Issue
[#90](https://github.com/DangTAnh/SE2026.11.1.3D-WEB-05/issues/90), draft PR
[#91](https://github.com/DangTAnh/SE2026.11.1.3D-WEB-05/pull/91).

## Problem

The preset import/export path validates a full document, but there is no save
path at all in this repository (no HTTP API, auth, database or Save button). A
naive replay of the same user action would therefore create a second saved
preset or a second transaction once such a port exists. VT-122 adds a
framework-independent guard in front of a `PresetSavePort` and proves the
caller-side contract with executable tests.

## Delivered slice

| Piece | Location |
| --- | --- |
| Guard, port and errors | `src/presets/resubmission.ts` |
| Atomic test store / fault injection | `tests/support/vt122-store.ts` |
| Unit tests T01–T22 | `tests/unit/preset-resubmission.test.ts` |
| Integration tests T03/T08/T09/T10/T12 | `tests/integration/preset-resubmission-service.test.ts` |
| Pairwise matrix and tests | `tests/fixtures/vt122-pairwise.json`, `tests/unit/preset-resubmission-pairwise.test.ts` |
| Deterministic recovery tests T23/T24 | `tests/unit/preset-resubmission-recovery.test.ts` |
| 100-task load harness | `tests/load/vt122-load.test.ts`, `vitest.vt122-load.config.ts` |
| Pairwise generator | `scripts/vt122-pairwise.mjs` |

The caller supplies a stable `requestId`; the service canonicalizes the full
`PresetDocument` (existing schema v2 validation, unknown keys rejected), replays
a confirmed receipt inside the retention window, shares one in-flight call for
concurrent duplicates, rejects the same key with different content, and never
turns a mismatched or uncommitted receipt into success.

The client window is a cache policy, not permission to duplicate. The port must
atomically bind `requestId + canonical + effect`; that is the only way to keep
one effect across processes or restarts. This repository only has a test double
for that port.

## Commands

```sh
npm ci
npm test
npx vitest run tests/unit/preset-resubmission.test.ts \
  tests/integration/preset-resubmission-service.test.ts \
  tests/unit/preset-resubmission-pairwise.test.ts \
  tests/unit/preset-resubmission-recovery.test.ts

# Coverage (dev-only @vitest/coverage-v8)
npx vitest run tests/unit/preset-resubmission.test.ts \
  tests/integration/preset-resubmission-service.test.ts \
  tests/unit/preset-resubmission-pairwise.test.ts \
  --coverage --coverage.include=src/presets/resubmission.ts \
  --coverage.reporter=text --coverage.reporter=json-summary \
  --coverage.reportsDirectory=docs/04-testing/vt122/evidence/coverage

# 100-task load + serialized control
$env:VT122_LOAD_RESULT='docs/04-testing/vt122/evidence'
npx vitest run --config vitest.vt122-load.config.ts
```

## Evidence

All raw logs are in [`evidence/`](evidence/). The report indexes them.

| Claim | Evidence |
| --- | --- |
| RED before implementation | `evidence/red.txt` — 12 failed / 3 passed |
| GREEN targeted | `evidence/green-targeted.txt` — 15/15 |
| GREEN full suite | `evidence/green-final.txt` — 310/310 |
| Pairwise | `evidence/pairwise.txt` — 18/18, 52/52 valid pairs |
| Coverage | `evidence/coverage.txt` — 100% statements/branches/functions/lines |
| Flaky check | `evidence/flaky-shuffle.txt` — 20 seeds, 0 failures |
| Mutation | `evidence/mutation-meta.txt`, `mutation-survive.txt`, `mutation-killed.txt`, `mutation-full.txt`, `mutation.diff` |
| Load | `evidence/unique.json`, `duplicates.json`, `serialized-control.json`, `load-run2/`, `load-run3/` |
| AI candidates | `evidence/ai-candidates-before.txt`, `evidence/ai-candidates-after.txt` |
| Review #91 P2 fix | `evidence/review-91-fix.md`, `review91-t07-red.txt`, `review91-t07.txt` |
| Build | `evidence/build.txt` — typechecks + Vite build PASS (existing chunk advisory) |
| E2E regression | `evidence/e2e.txt`, `evidence/e2e-rerun.txt`; CI passed 76/12 |

## Results at a glance

- 310/310 Vitest tests pass; 38 of them are VT-122 tests (13 unit + 5
  integration + 18 pairwise + 2 recovery).
- Targeted coverage of `src/presets/resubmission.ts`: 100% statements (54/54),
  100% branches (36/36), 100% functions (11/11), 100% lines (50/50).
- Review #91 P2: `RegExp.test` used to coerce non-string ids. The guard now
  checks `typeof requestId !== 'string'` first; T07 covers `undefined`, `null`,
  `123`, `true`, an array and an object with `toString`. Removing the guard
  fails T07 (`review91-t07-red.txt`); restoring it passes (`review91-t07.txt`).
  The re-review APPROVE on `f88a94b` was auto-dismissed when the docs commit
  `aab05b3` was pushed, so a fresh human approval is still required.
- 20 shuffled seeds `23001847`–`23001866`: 36/36 each, no failures.
- CI on `f88a94b`: `verify` PASS (310 tests, 76 E2E pass / 12 capability skips),
  CodeQL and Analyze PASS.
- 100 concurrent unique tasks: p95 58.6–64.2 ms over three runs; 100 calls and
  100 effects.
- 100 concurrent tasks over 10 keys: p95 54.0–58.0 ms; only 10 calls and
  10 effects.
- Serialized control: p95 5897.9–5913.5 ms, deliberately above the 3000 ms
  target, proving the harness is sensitive to serialization.
- Mutation `now > expiresAt` → `now >= expiresAt`: the non-boundary test T02
  survives and boundary test T05 fails; full targeted run 5 failed / 31 passed.

## Limitations

- No real API, database, auth, UI or cross-process durability exists; the port
  is a test double. These results prove caller behavior and contract shape, not
  production exactly-once.
- The load harness runs 100 promises in one Node process with 50 ms simulated
  I/O. It is not a network/DB/user-capacity benchmark.
- The retention cache is pruned on access; there is no background sweep.
- E2E does not exercise this slice because no save UI/backend exists. The local
  full E2E run had one mobile Chromium teardown timeout, documented in the
  evidence; the same unchanged test passed on the Linux CI run (76 E2E pass /
  12 capability skips). Neither result exercises VT-122.
- Retention eviction is lazy: an untouched key remains until that key is
  accessed again. This is not bounded-memory eviction, as noted in review #91.
- Draft only. Team review is required before merge.

## Status vocabulary

Source implemented and unit/integration/pairwise tests passed. Real backend
durability, product UI and physical deployment are **NOT_RUN** / out of scope.

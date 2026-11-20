# VT-122 test strategy

## 1. Scope and oracle

The test oracle is observable behavior at three boundaries:

- **Port calls** (`store.calls.length`) — how many times the unit asked the
  durable layer to commit.
- **Committed effects** (`store.effectCount(requestId)`) — how many effects the
  simulated store actually created.
- **Confirmed receipt** (`saver.confirmed(requestId)` / resolved receipt) — what
  the caller is allowed to treat as success.

Separating the first two matters: after the retention window the service may
legitimately call the port again, but the durable port must still return one
effect. A test that only asserts promise resolution cannot detect duplicates.

Time is an injected `() => number`; no real timers, sleeps, randomness or
network are used in unit/integration/pairwise tests. The load harness uses
`setTimeout` only to simulate 50 ms of port I/O.

## 2. Black-box design

### 2.1 Equivalence partitions

| Input / state | Valid classes | Invalid classes |
| --- | --- | --- |
| `requestId` | JavaScript string, 1–128 chars of `A–Z a–z 0–9 . _ : -` | empty, space, `/`, length 129, and non-string runtime values (`undefined`, `null`, `123`, `true`, array, object with `toString`) |
| document | schema v2, complete config, optional name | unknown key, schema v1, malformed |
| prior entry | none, committed-same, committed-different, failed | — |
| clock relative to `expiresAt` | before, exact | after |
| port receipt | committed + matching id/canonical | wrong id, wrong canonical, `committed !== true`, throw before/after commit |

### 2.2 Boundary values

Retention is inclusive, so the boundaries are:

- `expiresAt - 1` → replay, no port call;
- `expiresAt` → replay, no port call;
- `expiresAt + 1` → cache miss, new port call, but still one effect;
- default window boundaries `0` and `86_400_000` / `86_400_001`.

T05/T14/T22 cover the boundary; T02 is deliberately a non-boundary replay so the
mutation experiment can show it surviving.

### 2.3 Decision table (core rows)

| Prior | Clock | Input | Expected |
| --- | --- | --- | --- |
| none | before | valid | 1 call, 1 effect, confirmed |
| committed-same | before/exact | valid | 0 calls, 1 effect, same receipt |
| committed-same | after | valid | 1 call, 1 effect |
| committed-different | before/exact | valid | `SaveConflictError`, 0 calls |
| failed | before/exact | valid | retry allowed, 1 effect at most |
| any | any | invalid id/doc | reject before port |

### 2.4 Pairwise / combinatorial

Four factors are generated in `scripts/vt122-pairwise.mjs`:

- `prior`: none, committed-same, committed-different, failed (4);
- `clock`: before, exact, after (3);
- `input`: valid, invalid-key, invalid-doc (3);
- `receipt`: valid, wrong-requestId, wrong-canonical, uncommitted,
  throw-after-commit (5).

Constraints remove impossible combinations, e.g. invalid input cannot reach the
port (so receipt is irrelevant), there is no entry to expire when `prior=none`,
and a replay/conflict with `prior=committed-*` happens before the port, so its
receipt must be valid.

Result: 29 valid combinations reduced to **18 rows** covering **52/52 valid
pairs (100%)**. The matrix is checked in as `tests/fixtures/vt122-pairwise.json`
and every row is an executable test (`P01`–`P18`). Generation is deterministic;
re-running the script produces the same rows.

### 2.5 Concurrency and faults

- T03: 20 concurrent identical saves share one in-flight call.
- T12: different ids commit independently (no global serialization).
- T09/T10/T11/T23/T24: throw before commit, throw after commit, wrong request
  id, wrong canonical, `committed === false`.
- T21: `confirmed()` is undefined while the first save is pending.
- T16/T17/T19: 100 concurrent tasks; the control deliberately serializes all
  calls to prove the harness can fail.

## 3. Test inventory

| Group | IDs | File | Count |
| --- | --- | --- | --- |
| Unit happy/replay/conflict/boundary/validation/options | T01, T02, T04–T07, T11, T13, T14, T18, T20–T22 | `tests/unit/preset-resubmission.test.ts` | 13 |
| Integration/concurrency/faults | T03, T08–T10, T12 | `tests/integration/preset-resubmission-service.test.ts` | 5 |
| Pairwise rows | T15/P01–P18 | `tests/unit/preset-resubmission-pairwise.test.ts` | 18 |
| Strengthened AI-derived recovery | T23, T24 | `tests/unit/preset-resubmission-recovery.test.ts` | 2 |
| Load | T16, T17, T19 | `tests/load/vt122-load.test.ts` | 3 |

Test-first order: RED commit `217a9d9` (12 failed / 3 passed), GREEN commit
`4417683` (15/15 targeted, 287/287 full), then pairwise/load, coverage/flaky,
AI candidates, strengthening and mutation evidence.

## 4. Tools and commands

```sh
npm test
npx vitest run tests/unit/preset-resubmission.test.ts \
  tests/integration/preset-resubmission-service.test.ts \
  tests/unit/preset-resubmission-pairwise.test.ts \
  tests/unit/preset-resubmission-recovery.test.ts

npx vitest run --sequence.shuffle --sequence.seed=<seed> ...
npx vitest run --config vitest.vt122-load.config.ts
node scripts/vt122-pairwise.mjs
npm run build
```

Coverage uses dev-only `@vitest/coverage-v8@5.0.3` (same version as Vitest).
The tool is not a runtime dependency.

## 5. What is not tested, and why

- **No E2E save flow:** the product has no save UI, HTTP endpoint, database or
  auth. Adding a fake browser flow would test a fixture, not the product.
- **No real durability:** the atomic port is a test double. Production
  exactly-once requires a real transaction/unique constraint and is **NOT_RUN**.
- **No user-capacity benchmark:** the load harness is one Node process with
  simulated I/O; it is a regression guard, not a capacity claim.
- **No cross-process/restart test:** out of scope for this slice.
- Full E2E regression was run for honesty; see `evidence/e2e.txt` and
  `evidence/e2e-rerun.txt`. The single mobile Chromium teardown timeout
  reproduces on the unchanged test file and is unrelated to this module.

## 6. Anti-gaming checks

- Assertions include call count, effect count and receipt identity, not only
  `resolves`.
- The serialized control must exceed the p95 target; otherwise the load test is
  considered insensitive.
- The mutation changes only the boundary operator and must be killed by a
  boundary test while a non-boundary test survives.
- AI candidates were run before review: all six passed, yet four were deleted
  and two rewritten because passing is not the same as being a good oracle.
- T07 includes non-string runtime values, because a TypeScript annotation does
  not enforce the JavaScript boundary and `RegExp.test` coerces its argument.
  The guard is reverted once to confirm the regression test fails
  (`evidence/review91-t07-red.txt`), then restored (`review91-t07.txt`).

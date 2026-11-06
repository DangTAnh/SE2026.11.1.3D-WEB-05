# Reviewer concurrency — test strategy (VT-123, Issue #85)

Date: 2026-11-06

## 1. Risk-based approach

The slice is a domain contract with no UI or network path, so the test pyramid is weighted
toward unit tests: they are the cheapest way to force the read/await/write interleavings that
cause lost updates. The risk ranking below drives the depth of each level.

| Risk | Why it matters | Level | Tests |
|---|---|---|---|
| R1 — lost update / stale write wins | Two editors or a reviewer and an editor act on the same revision; the later write silently overwrites the earlier one. This is the VT-123 core risk. | Unit (race) + load | T07, T08, T09, T10, T15 |
| R2 — reviewer modifies original data | The change request's defining constraint; a review action must not change bytes, hash or version. | Unit | T03, T04, T05, T17 |
| R3 — wrong authorization | Reviewer submits, editor approves, or a double review changes metadata again. | Unit (negative) | T01, T02, T13, T14 |
| R4 — stale or forged approval | Approval is accepted for a revision the reviewer did not read (wrong version/hash), or the digest changes after the pre-check. | Unit (negative/race) | T06, T07, T19 |
| R5 — non-atomic failure | Invalid content or a failed digest leaves a partial revision. | Unit + integration | T11, T12 |
| R6 — scheduler-dependent tests | Tests pass or fail by timing, not by behavior. | Repeat procedure | P16 |
| R7 — cross-resource interference | Two independent boards share state accidentally. | Unit (isolation) | T18 |

### Levels used and levels deliberately omitted

- **Unit:** `PresetReviewBoard` with a deterministic/injected hasher; no DOM, no network.
- **Integration (module boundary):** the board together with the real
  `parsePresetDocument` / `serializePresetDocument` boundary (T11). There is no HTTP API in
  this repository, so "API" tests are replaced by this module-boundary test.
- **E2E: not necessary.** No UI or runtime path imports the review module. A browser test
  would require inventing a reviewer screen, and it would still exercise the same domain
  methods through a fake UI. The domain race is better and more deterministically tested at
  unit level. The existing Playwright suite already covers the product UI.
- **Not necessary:** axe/accessibility (no UI change), GPU/backend/parity (unrelated
  subsystem), authentication/session (no auth exists), cross-process/durable-store
  integration (no store exists; recorded as a limitation, not faked).

## 2. Test case table

Priority: H = must pass before merge; M = should pass; L = sanity.

| ID | Risk / requirement | Level | Precondition / input | Expected result | Priority |
|---|---|---|---|---|---|
| T01 | R3 / AC1 — reviewer cannot submit | Unit, negative | Empty board; actor `{role:'reviewer'}`; valid document; `baseVersion=0` | `forbidden-role`; `read()` is still `null` | H |
| T02 | R3 / AC1 — editor cannot approve | Unit, negative | Board with pending v1; actor `{role:'editor'}`; correct version/hash | `forbidden-role`; status stays `pending`; `reviewedBy` stays `null` | H |
| T03 | R2 / AC1 — reviewer approves exact revision | Unit | Pending v1; reviewer; exact `(version, contentHash)`; note | `status='approved'`, `reviewedBy` and note set; document, contentHash and version are byte/identity-identical to the pending revision | H |
| T04 | R2 / AC2 — rejection does not change content | Unit | Pending v1; reviewer; exact `(version, contentHash)` | `status='rejected'`; same document/hash/version; only review metadata changed | H |
| T05 | R2 / AC2 — immutability of read and input | Unit | Submit document A; keep the caller's object and the returned snapshot; try to mutate both | Mutations throw (`TypeError`) in strict mode or have no effect on the stored revision; stored document still equals A | H |
| T06 | R4 / AC4 — wrong content hash | Unit, negative | Pending v1; reviewer presents a different digest | `content-changed`; board still pending; `reviewedBy=null` | H |
| T07 | R1/R4 / AC4 — stale approval after a newer submission | Unit, race failure-path | Reviewer reads v1; editor submits v2 from base 1; reviewer then approves v1 with the old hash | `stale-version` or `content-changed`; board is v2 pending; no review metadata from the stale approval | H |
| T08 | R1 / AC3 — two concurrent submissions | Unit, race | Two editors submit different documents A and B from `baseVersion=0`; both reach the digest before either resolves | Exactly one fulfilled, one `stale-version`; final version `1`; final document is exactly A or B, and its `contentHash` matches that document | H |
| T09 | R1 / AC3 — two concurrent approvals | Unit, race | Pending v1; reviewers r1/r2 approve with different notes; both reach the digest first | Exactly one fulfilled, one fails; status `approved`; exactly one `(reviewedBy, reviewNote)` pair, no mixed metadata | H |
| T10 | R1 / AC3 — concurrent submit + approve | Unit, race | Pending v1; reviewer approves v1 while editor submits v2 from base 1; both reach the digest first | Linearizable outcome: either (v1 approved, then v2 pending) or (approval rejected, v2 pending). Final revision is v2 pending; no mixed content | H |
| T11 | R5 / AC5 — invalid document at the module boundary | Integration, negative | `particleCount=0`, unknown key, or `schemaVersion=1` passed to `submit` | The preset validator throws before any write; board is unchanged | H |
| T12 | R5 / AC5 — hasher failure is atomic | Unit, failure | Injected hasher rejects after the board has prepared the candidate revision | The rejection propagates; no revision is written; `read()` is unchanged | M |
| T13 | R3 / AC5 — double review | Unit, negative | Pending v1; approve it; approve again with the same version/hash | Second call fails `not-reviewable`; the first approval's metadata is unchanged | M |
| T14 | R3 / AC1 — review with no revision | Unit, negative/boundary | Empty board; reviewer calls `approve` | `not-reviewable`; board stays `null` | M |
| T15 | R1/NFR1 — 40 concurrent tasks, p95 | Load | 40 tasks: submit with retry on `stale-version`, then approve the current pending revision; 1 ms simulated store delay | p95 ≤ 1500 ms (definition: [requirements](../01-requirements/reviewer-concurrency-requirements.md) §4 NFR1); final version ≥ 40; every committed revision internally consistent | H |
| T17 | R2 / AC2 — review identity covers the whole document | Unit | Two documents identical in simulation/mode but different name, colour and backend preference | Different `contentHash` values; approving the first cannot satisfy an approval for the second (`content-changed`) | H |
| T18 | R7 — independent resources | Unit, isolation | Two boards, each with its own pending revision; review one | The other board's revision and metadata are untouched | L |
| T19 | R4 / AC4 — post-await digest mismatch | Unit, race failure-path | Pending v1; reviewer approves with the correct `(version, contentHash)`; the gated hasher releases the review digest as a different value | `content-changed`; board remains pending; `reviewedBy=null`; document, contentHash and version unchanged | H |

## 3. Concurrency testing design

### Same resource vs different resources

The dangerous case is **same resource**: one `PresetReviewBoard` holding one current
revision. T07–T10 and T15 all contend on that single revision. T18 is the low-risk
different-resource sanity check: two boards must not share module-level state. There is no
module-level mutable state in the design; T18 proves it.

### Number of parallel requests

- 2 for deterministic interleaving (T07–T10). Two is enough to expose the read/await/write
  window and lets each outcome be asserted exactly.
- 1 for T19, which uses the gate to stop a single review after its pre-checks and release a
  different digest at the post-await re-check.
- 40 for the load/stress case (T15), matching the required load verification.

### Interleaving order

The content digest is the only asynchronous point. Tests inject a `ContentHasher` backed by
a deferred promise. The test starts **both** operations first, waits until both have called
the hasher (a counter/barrier), and only then resolves the digest promises in the chosen
order. This proves the operations were genuinely in flight together; no sleep or sequential
`await` is used to fake the race.

The suite exercises both orders where they differ:

- A's digest resolves first, then B's.
- B's digest resolves first, then A's.

Assertions are over the **set of outcomes** (`Promise.allSettled`), not completion order, so
the scheduler cannot change the expected result. The suite is repeated by procedure P16 to
catch order dependence.

### Stale vs fresh version

- **Fresh:** `baseVersion` equals the current version and the digest matches.
- **Stale version:** T07 and T08 submit/approve with a `baseVersion` or `version` captured
  before another write.
- **Stale/forged content:** T06 uses a wrong digest; T17 proves the digest covers fields
  that `configHash` ignores, so a stale or partial identity cannot authorize the wrong
  document.
- **Post-await digest mismatch:** T19 passes the pre-await checks, then releases a different
  digest at the review's own re-check; the write must be refused as `content-changed`.
- **Same revision:** T09 starts both approvals from the same `(version, contentHash)`.

### Why this is not sequential in disguise

The test does not `await board.submit(...)` before starting the second call. It creates both
promises, confirms both reached the injected hasher barrier, then resolves them. If the
implementation were sequential, the second call would not have reached the barrier and the
test would fail on the barrier assertion rather than pass silently.

### Flakiness procedure (P16)

Determinism is verified by a procedure, not a test case: run the unit suite 30–50 times and
record the pass rate. The two named flaky risks are controlled explicitly:

- **Promise completion order.** Race assertions are over outcome sets
  (`Promise.allSettled`), never over which promise resolved first. Both digest-resolution
  orders are exercised, so a scheduler change cannot flip an expected result.
- **Shared state.** Every test constructs a fresh `PresetReviewBoard`; there is no
  module-level mutable state, and no test depends on another test's order. The 40-task load
  harness creates its own board as well.
- **Time and random data.** No `setTimeout` in assertions, no random data and no wall-clock
  threshold in unit tests; the hasher is injected and deterministic.

## 4. Traceability to acceptance criteria

| AC | Tests |
|---|---|
| AC1 — reviewer permissions | T01, T02, T03, T04, T14 |
| AC2 — original data unchanged | T03, T04, T05, T17 |
| AC3 — concurrency / no lost update | T08, T09, T10, T15 |
| AC4 — exact revision approval | T06, T07, T09, T19 |
| AC5 — atomic failure / double review | T11, T12, T13 |
| NFR1 — p95 ≤ 1500 ms at 40 tasks | T15 |
| NFR2 — no lost updates | T08, T15 |
| NFR3 — deterministic, repeatable | P16 (procedure) |

## 5. What the tests cannot prove

The board is in-process, and the load harness is a single Node process with a simulated
store delay. The tests cannot prove cross-process safety, durable persistence, real-user
latency or production capacity. Those limits are stated in the
[requirements](../01-requirements/reviewer-concurrency-requirements.md) §7 and are not
papered over with a fake server.

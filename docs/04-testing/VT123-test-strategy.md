# VT-123 — Risk-based test strategy

## 1. Levels

| Level | Used? | Where / why |
|---|---|---|
| Unit (domain) | Yes | `tests/unit/review-workflow.test.ts` — the role and CAS contract is pure domain logic. |
| Integration / contention | Yes | `tests/load/review-load.test.ts` — 40 tasks through the public board API. |
| API | No | The repository has no HTTP/service layer (`docs/architecture.md` §1). |
| E2E | No | There is no reviewer screen; adding one would invent UI scope. The existing preset-import E2E cannot exercise roles. |
| Performance | Yes, separate | The load harness is excluded from `npm test` so the normal suite stays fast and deterministic. |

## 2. Concurrency testing technique

1. **Deterministic interleaving (T09).** The board accepts an injected hasher.
   The test replaces it with a queue of deferred promises, starts an approval
   and a submission, then resolves the gates in a chosen order. The reviewer's
   approval is paused exactly inside its read → `await` → write window while a
   new revision commits. No sleeps and no scheduler assumptions: the order is
   decided by the test.
2. **Stress (T06–T08, T14).** 2 or 40 submissions/approvals start from the same
   base and run under `Promise.allSettled`. The assertions are over the outcome
   **set** — "exactly one fulfilled", "every rejection is a `stale-version`" —
   not over completion order.
3. **Atomicity (T10, T11).** A rejecting hasher and an invalid document must
   leave the board byte-identical. A status flip without a successful digest is
   the failure path tied to the race risk.
4. **Invariant check (T14).** Mixed submissions and approvals; afterwards every
   revision must satisfy `contentHash === SHA-256(serializePresetDocument(doc))`
   and the review metadata must be consistent with the status.

**Test-data choice.** There is no random data and no clock. Documents are built
from `cloneConfig(DEFAULT_CONFIG)` and differ by `simulation.particleCount`
(`1000 + index * 1000`) and by `name`. Distinct content makes a lost update
observable by *content*, not only by version. The 40-task data uses
`1000 + ((taskId + attempt) % 40) * 1000`; every value is inside the v2 schema
(integer 1 000–500 000). Reviewer IDs (`reviewer-1..40`) are distinct so the
winning reviewer is identifiable.

## 3. Test cases (T01–T18)

| ID | Risk / AC | Level | Precondition / input | Expected result | Priority |
|---|---|---|---|---|---|
| T01 | AC2 role: reviewer must not modify data | Unit | Reviewer calls `submit` | `ReviewError('forbidden-role')`; board empty | P0 |
| T02 | AC2 immutability | Unit | Read a revision; assign to `document.config.simulation` | Frozen snapshot throws `TypeError`; stored value unchanged | P0 |
| T03 | AC1 approve | Unit | Editor submits; reviewer approves with read version+hash | `approved`; document, hash, version unchanged; reviewer/note recorded | P0 |
| T04 | AC1 separation | Unit | Editor calls `approve` | `forbidden-role` | P1 |
| T05 | AC4 exact content | Unit | Reviewer supplies a wrong hash | `content-changed`; status stays `pending` | P0 |
| T06 | AC3 lost update | Unit | 2 concurrent submits from base 0 | Exactly 1 fulfilled, 1 `stale-version`; version 1; winner's document stored | P0 |
| T07 | AC3 40-way contention | Unit | 40 concurrent submits from base 0 | Exactly 1 winner, 39 `stale-version`; version 1 | P0 |
| T08 | AC3/AC4 duplicate approval | Unit | 40 concurrent reviewers approve the same revision | Exactly 1 accepted, 39 rejected; document unchanged | P0 |
| T09 | AC4 stale approval (race) | Unit | Gated hasher; approval paused; editor commits v2; gates resolved | Approval rejects `content-changed`; final v2 `pending` | P0 |
| T10 | AC5 atomic failure | Unit | Hasher rejects during submit and during approve | Promise rejects; board unchanged in both cases | P0 |
| T11 | AC5 validation | Unit | `particleCount = 999` (schema min 1000) | Validation error; no revision created | P1 |
| T12 | AC1 reject | Unit | Reviewer rejects with a reason | `rejected`; note recorded; content unchanged | P1 |
| T13 | AC4 double review | Unit | Reject an already-approved revision | `not-reviewable` | P1 |
| T14 | AC3/AC4 invariants | Unit | 20 submits + 20 approvals from one base | All rejections are `ReviewError`; final hash matches final document; metadata consistent | P1 |
| T15 | AC4 identity | Unit | Same document, keys inserted in different order | Canonical serialization and identity are equal | P1 |
| T16 | AC4 default hasher | Unit | Default SHA-256 board; submit then approve | 64 lowercase hex; approval succeeds; hash stable | P1 |
| T17 | AC1 empty board | Unit | Approve before any submission | `not-reviewable` | P2 |
| T18 | AC4 wrong version | Unit | Approve `version + 1` with the correct hash | `stale-version`; status stays `pending` | P1 |

Negative tests: T01, T04, T05, T11, T13, T17, T18. Failure-path tests tied to
the race/atomicity risk: T10 (rejecting hasher) and T11 (invalid document).

## 4. Flaky-risk review

| Risk | Mitigation | Evidence |
|---|---|---|
| Time | Unit tests never assert elapsed time; the load harness is the only clock user and asserts a 1.5 s ceiling with a 5× margin. | 20 repeat runs, 0 failures |
| Order / shared state | Every test constructs a new board; no module-level mutable state; assertions over outcome sets, not completion order. | 20 repeat runs |
| Network | None: the module is pure and in-memory; no `fetch`, no sockets. | import review |
| Concurrency | Deterministic gates for the exact interleaving (T09); stress tests assert invariants (T06–T08, T14). | 20 repeat runs |
| Random data | No `Math.random`; documents are derived from a fixed default and an index. | source review |

The load harness prints its result rather than asserting a fragile exact
latency; the only hard threshold is the assignment's 1500 ms ceiling.

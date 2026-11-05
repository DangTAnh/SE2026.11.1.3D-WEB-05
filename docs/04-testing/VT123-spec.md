# VT-123 — Specification

Status: BT3 individual slice. Branch `feat/85-reviewer-role` from
`dev@8f7c3eeb74c7a9501332b265fa16a6aa552aa2b3`. Issue #85.

## 1. Problem statement

The preset domain currently lets any client replace the active preset. There is
no separation between the person who edits a preset and the person who approves
it, and no guarantee that the approved content is the content the reviewer saw.
Under concurrent requests, two edits based on the same revision can both commit
(lost update), and an approval issued against revision *N* can mark revision
*N+1* as approved (stale approval). The change request adds a reviewer role that
can read and approve but must not modify the original data.

## 2. Scope

**In scope:** a client-side domain board (`src/presets/review.ts`) that stores
immutable preset revisions, enforces editor/reviewer separation, and applies
optimistic compare-and-swap (CAS) on version + content hash.

**Out of scope, with evidence:**

- Authentication, accounts, a network service and a database.
  `docs/architecture.md` §1 records *"Server, auth, persistence — out of scope
  for this repo"*; the app is a static Vite build deployed to GitHub Pages.
- A reviewer UI. The change request is a permission contract, not a screen; no
  reviewer screen exists in `src/ui/`, and adding one would invent UI scope.
- Schema changes. The v2 preset schema is a shared contract with
  `additionalProperties: false`; reviewer metadata stays outside `LabConfig`.

`ReviewActor` is an **authorization input**, not an authenticated principal. A
future store must derive the role from a verified session.

## 3. Acceptance criteria

| ID | Criterion (observable) |
|---|---|
| AC1 | A reviewer can read the current revision and approve or reject it. |
| AC2 | A reviewer cannot submit or modify preset content; a review changes only review metadata. |
| AC3 | Concurrent submissions from the same base version produce exactly one winner, with no lost update and no mixed content. |
| AC4 | An approval/rejection is accepted only for the exact version and content hash the reviewer read; a stale one is rejected. |
| AC5 | A failed digest or invalid document leaves the board unchanged (atomic failure). |

## 4. Non-functional constraints

| ID | Constraint | Verification |
|---|---|---|
| NFR1 | 40 concurrent review tasks, p95 <= 1.5 s | `npm run test:load` |
| NFR2 | Deterministic unit tests: no wall-clock assertions, no random data, no shared mutable state | review + 20 repeat runs |
| NFR3 | Architecture: `src/presets` must not import `src/ui`; no DOM/`three`; no new runtime dependency | `tests/unit/fitness-architecture.test.ts`, import review |
| NFR4 | Auditability: every revision carries submitter, reviewer, note, version and content hash | T03, T12 |

## 5. Invariant / contract

**INV-VT123.** For every revision `r` returned by `read()` or by a successful
`submit` / `approve` / `reject`:

1. `r.document` is deeply frozen and
   `r.contentHash === SHA-256(serializePresetDocument(r.document))`.
2. A review action changes only `status`, `reviewedBy` and `reviewNote`; it
   never changes `document`, `contentHash`, `version` or `submittedBy`.
3. Only an editor creates a revision; only a reviewer approves or rejects.
4. A review commits only if, **after** the asynchronous digest, the board still
   holds the same revision object with `status === 'pending'` and a matching
   content hash.
5. A failed validation or digest leaves the board unchanged.

Clause 4 is the most important contract. It is the single guard that turns the
read → `await` → write sequence into a linearizable transition. The mutation
experiment removes exactly this guard.

## 6. Deliberate limits

- In-memory and single-process. The CAS models the contract a durable store must
  implement (`UPDATE ... WHERE version = ? AND content_hash = ?`); it does not
  prove cross-process or distributed serializability.
- The role is supplied by the caller. This is an authorization decision, not
  authentication.
- No API or E2E test, because those layers do not exist in this repository
  (§2). The 40-task harness is the integration-level contention test.

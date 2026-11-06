# ADR-0002 — Optimistic compare-and-swap for reviewer concurrency

- Status: proposed (author decision for Issue #85; team review pending)
- Date: 2026-11-06
- Deciders: Đỗ Minh Đức (author); affected module owners to review
- Related: [requirements](../01-requirements/reviewer-concurrency-requirements.md),
  [design proposal](../02-design/reviewer-concurrency-design-proposal.md),
  [test strategy](../04-testing/reviewer-concurrency-test-strategy-2026-11-06.md),
  [architecture](../architecture.md)

## Context

A preset is a validated, canonical JSON document. The slice adds a reviewer role that can
read and approve or reject a revision but must not modify the document. Two requests may
act on the same revision at the same time, and the board has one asynchronous suspension
point: the content digest.

The repository has no server, authentication or persistence layer
([architecture.md](../architecture.md) §1, line 37). The board is therefore in-process and
in-memory; the decision must still record what a durable store has to implement.

An approval must be tied to the exact content the reviewer read. Two candidate identities
exist:

- `configHash` (`src/core/measurement/configHash.ts:9-21`) projects only simulation values
  and the active mode group. It excludes name, colours, opacity, blend, camera and backend
  preference, so it cannot authorize a review of the complete document.
- `serializePresetDocument` (`src/presets/preset.ts:78-99`) produces byte-stable canonical
  output for the complete validated v2 document. Its SHA-256 is a usable content identity.

The codebase already prefers rejecting superseded asynchronous work to blocking: the
backend switch uses a monotonically increasing request id and ignores stale completions
(`src/ui/app.ts:50`, `src/ui/app.ts:119-123`). Defaults are frozen and `cloneConfig`
returns an independent copy (`src/presets/preset.ts:28-38`).

## Decision

Use **optimistic concurrency control (compare-and-swap)** over immutable revisions.

- A revision stores `version`, the deeply frozen `document`, and `contentHash =
  SHA-256(serializePresetDocument(document))`.
- `submit(actor, document, baseVersion)` is editor-only. It validates and canonicalizes
  before the await, then re-reads the current version after the digest and commits only if
  the version still equals `baseVersion`. Otherwise it fails with `stale-version`.
- `approve` / `reject` are reviewer-only. They require the exact `(version, contentHash)`
  the reviewer read, re-check the revision identity, status and digest after the
  asynchronous digest, and change only `status`, `reviewedBy` and `reviewNote`. A mismatch
  fails with `stale-version` or `content-changed`.
- The in-process board is the only implementation in this slice. A durable store must
  perform the same conditional write (`WHERE version = ? AND content_hash = ?`) in one
  transaction; the in-memory board does not protect a second process.

## Alternatives considered

| Option | Why not |
|---|---|
| **Pessimistic lock / serialized queue** (per-resource mutex) | There is no process or store to own the lock (no server/auth/persistence; [architecture.md](../architecture.md) §1, line 37). A browser-only lock cannot cover tabs or processes. A lock adds owner identity, lease expiry, timeout, deadlock and release-on-failure paths that must themselves be tested, and it serializes all 40 tasks so p95 depends on queue length. It also does not enforce the reviewer read-only rule. |
| **Use `configHash` as the review identity** | It deliberately ignores name, rendering, camera and backend preference (`src/core/measurement/configHash.ts:9-21`). A reviewer could approve changed content that has the same workload projection. |
| **Sequence every operation through one global lock** | Same missing-host and queue problems as the per-resource lock, with worse throughput; it also hides the conflict instead of reporting it. |

## Consequences

Positive:

- No lock ownership, lease, timeout or deadlock handling.
- The conflict is explicit in the API (`stale-version`, `content-changed`), so callers can
  retry from a fresh read.
- The review action reuses the canonical serializer and immutable documents already used
  by the preset module.
- Independent tasks can proceed; only true conflicts are rejected.

Negative:

- Callers must handle conflicts and retry; under extreme contention retries can starve.
- The guarantee is only as strong as the store's conditional write. The in-memory board
  cannot coordinate two processes, tabs or reloads.
- `ReviewActor.role` is an authorization input supplied by the caller, not an authenticated
  principal; a real service must derive it from authentication.

## Evidence

- Unit and race evidence:
  `tests/unit/review-workflow.test.ts` (T01–T19).
- Load evidence: `tests/load/review-load.test.ts` (T15).
- Mutation evidence:
  [03-mutation.log](../04-testing/evidence/reviewer-concurrency-2026-11-06/03-mutation.log).
- Coverage and repeat evidence:
  [04-coverage.log](../04-testing/evidence/reviewer-concurrency-2026-11-06/04-coverage.log),
  [05-flakiness.log](../04-testing/evidence/reviewer-concurrency-2026-11-06/05-flakiness.log),
  [06-load-repeat.log](../04-testing/evidence/reviewer-concurrency-2026-11-06/06-load-repeat.log).

## When to revisit

Revisit when any of these is measured or becomes a requirement:

1. A durable store or server exists; move the conditional write into one store transaction
   and add a cross-process race test.
2. Retry starvation is measured under the required load; consider a bounded queue or
   backoff, not an unbounded lock.
3. Authentication supplies the role; replace the caller-supplied `ReviewActor` with a
   derived principal and add authorization tests at that boundary.
4. The p95 harness fails on a slower environment; record the environment and re-evaluate
   the budget before changing the threshold.

# VT-122 specification and change request

## 1. Context

`src/presets/preset.ts` already validates and round-trips schema v2 preset
documents, including rejection of unknown keys and v1 documents. The repository
has no save endpoint, persistence layer or Save button. Adding idempotency to a
fictional HTTP handler would not be executable here, so VT-122 specifies the
smallest real vertical slice: a caller-owned request identity in front of a
`PresetSavePort`, with a test double that models an atomic durable store.

This is independent personal work. It does not reuse or depend on the VT-120
branch #88 / PR #89.

## 2. Problem statement

A user action can be submitted more than once: double click, retry after a
timeout, a lost response, or two tabs. Without a stable request identity and a
replay/conflict rule, the save path creates duplicate presets or duplicate
transactions. A client-side "already saved" flag is not sufficient because the
response can be lost after the server committed.

## 3. Invariant

Within one retention window, each `(requestId, canonicalDocument)` pair has at
most one committed effect, and a reported success always carries a receipt that
matches both the request id and the canonical document.

The client cannot prove exactly-once alone. The `PresetSavePort` must atomically
bind `requestId` to the canonical content and the stored effect. The service in
this slice enforces the caller side of that contract and validates what the port
returns.

## 4. API contract

```ts
interface PresetSaveRequest {
  readonly requestId: string;
  readonly canonical: string;
}

interface PresetSaveReceipt extends PresetSaveRequest {
  readonly committed: true;
}

interface PresetSavePort {
  save(request: PresetSaveRequest): Promise<PresetSaveReceipt>;
}

class PresetSaveService {
  constructor(port: PresetSavePort, options?: {
    retentionMs?: number; // default 24 h, integer 1..604800000
    now?: () => number;   // injected clock
  });
  save(requestId: string, document: PresetDocument): Promise<PresetSaveReceipt>;
  confirmed(requestId: string): PresetSaveReceipt | undefined;
}
```

Rules:

1. `requestId` must match `^[A-Za-z0-9._:-]{1,128}$`; otherwise `TypeError`
   before serialization or any port call.
2. The document is canonicalized with the existing `serializePresetDocument`,
   so schema/unknown-key validation runs before the port.
3. Replaying the same `(requestId, canonical)` while an entry is committed and
   not expired returns the same frozen receipt without another port call.
4. Concurrent duplicates share one in-flight promise and one port call.
5. The same `requestId` with different canonical content raises
   `SaveConflictError` before the port; no new effect.
6. `now === expiresAt` is still valid (inclusive boundary); `now === expiresAt + 1`
   may start a new operation. In-flight entries never expire.
7. The service reports success only when `receipt.committed === true`,
   `receipt.requestId` matches and `receipt.canonical` matches.
8. A failed attempt is retained as a failed entry until the same inclusive
   boundary, so a retry can proceed and a conflicting retry is still rejected.

## 5. Acceptance criteria

| ID | Criterion |
| --- | --- |
| AC1 | Same id + canonical, sequential or concurrent, within retention: exactly one store effect and the same confirmed receipt. |
| AC2 | Same id + different canonical within retention: `SaveConflictError`, no additional call/effect; existing receipt preserved. |
| AC3 | Invalid id or invalid document (unknown key, v1) is rejected before the port: zero calls/effects. |
| AC4 | Retention boundary is inclusive: exact expiry replays; one millisecond later may call again; in-flight work never expires. |
| AC5 | Port failure or a mismatched/uncommitted receipt never produces confirmed success; a retry after a lost response keeps at most one effect under the atomic port contract. |

## 6. Risks

| ID | Risk | Impact | Mitigation / evidence |
| --- | --- | --- | --- |
| R1 | Double submit creates two effects | Duplicate user data / charges | Stable id, in-flight sharing, replay cache; T02/T03/T06/T09/T12 |
| R2 | Id reused with different content | Silent data overwrite | Canonical compare, `SaveConflictError`; T04/T13, pairwise |
| R3 | Off-by-one at expiry | Lost replay or unwanted replay | Inclusive `now > expiresAt`; T05/T14/T22 and mutation |
| R4 | Commit succeeds, response lost | Client retries blindly | Receipt validation, unconfirmed state, port dedupe; T09/T11/T23/T24 |
| R5 | Process restart / second process | Local cache is empty | Explicit limitation: port must be durable and atomic; not proven here |
| R6 | Retained entries grow | Memory growth | Entries pruned on access; no background sweep (documented) |
| R7 | Test double mistaken for production proof | False confidence | Scope and NOT_RUN statements in README/PR/report |

## 7. Out of scope

- Real HTTP API, database, auth, UI Save button, telemetry.
- Cross-process, restart or multi-region exactly-once.
- Schema, `LabConfig`, `configHash`, GPU, simulation or renderer changes.
- Performance claims beyond the single-process 100-task harness.

## 8. Decisions

- **Caller-supplied id, not server-generated.** A retry only works if the retry
  carries the same identity.
- **Canonical full document as the conflict key.** Names and all config groups
  participate, matching the existing schema v2 round-trip.
- **Inclusive TTL.** `now === expiresAt` replays; `now === expiresAt + 1` may
  re-fetch. This is stated once and enforced in one helper.
- **Client TTL is not a dedupe permission.** Even after expiry the port must
  return the original receipt for the same id.
- **Receipt is frozen and returned by identity** so callers cannot mutate a
  confirmed result.

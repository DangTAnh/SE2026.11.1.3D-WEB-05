# Reviewer concurrency — requirements (VT-123, Issue #85)

- Author: Đỗ Minh Đức (23001864)
- Team: SE2026-T30 — 3D-WEB-05 (GPU Particle Lab with WebGPU fallback)
- Variant: VT-123 — reviewer role plus concurrent-update safety
- Baseline: `origin/dev` = `8f7c3eeb74c7a9501332b265fa16a6aa552aa2b3`
- Implementation branch: `feat/85-reviewer-concurrency`
- Submission fork: <https://github.com/justcoffeee/SE2026.11.1.3D-WEB-05>
- Related: [design proposal](../02-design/reviewer-concurrency-design-proposal.md),
  [test strategy](../04-testing/reviewer-concurrency-test-strategy-2026-11-06.md),
  [ADR-0002](../adr/0002-reviewer-concurrency-optimistic-cas.md)

## 1. Problem statement

A preset is a validated, canonical JSON document that a user can export and import.
Today the application has no reviewer role, no revision identity and no update guard:
anyone who holds a preset document can replace it, and two concurrent submissions can
silently overwrite each other. A reviewer must be able to inspect and approve exactly
the content they read without being able to alter it, and the system must reject a
write based on a revision that is no longer current instead of losing an update.

## 2. Scope and limitations

The repository has no server, authentication or persistence layer
([architecture.md](../architecture.md) §1). Therefore this slice implements the domain
contract, not an authenticated product feature:

- `ReviewActor.role` is an authorization input supplied by the caller; a real service
  must derive it from an authenticated principal.
- The review board is in-process and in-memory. A durable store must implement the same
  conditional write (compare-and-swap on version + content hash) to keep the guarantee
  across processes.
- No UI screen, network API, database or account system is added.

The nearest existing module is the preset domain (`src/presets/preset.ts`), which already
provides Ajv validation, a canonical serializer and frozen defaults. The slice reuses
those functions rather than inventing a second preset model.

## 3. Acceptance criteria

| ID | Criterion (testable) |
|---|---|
| AC1 | A reviewer can read the current revision and approve or reject it. A reviewer cannot submit preset content. An editor cannot approve or reject. Both denials fail with `forbidden-role` and leave the board unchanged. |
| AC2 | A review action (approve/reject) never changes the stored document, its content hash or its version. Only `status`, `reviewedBy` and `reviewNote` change. The returned document is deeply frozen; mutating it throws and the stored revision is unchanged. |
| AC3 | When two or more editors submit from the same base version concurrently, exactly one submission commits. Every other submission fails with `stale-version`. The final version is exactly `baseVersion + 1` and contains exactly one submitted document (no lost update, no mixed content). |
| AC4 | An approve/reject is accepted only for the exact `(version, contentHash)` the reviewer read. If a newer revision replaced it, or the content digest does not match, the action fails with `stale-version` or `content-changed` and the board is unchanged. |
| AC5 | An invalid document or a rejected content-hash computation leaves the board unchanged (no partial write). A second approve/reject of an already reviewed revision fails with `not-reviewable`. |

## 4. Non-functional constraints

| ID | Constraint |
|---|---|
| NFR1 | 40 concurrent submit/approve tasks complete with p95 latency ≤ 1500 ms. **Definition (stated once):** p95 is the nearest-rank value of the ascending sorted 40 per-task `performance.now()` latencies — `ceil(0.95 × 40) = 38`th value, index 37 (zero-based). The harness is in-process with a documented simulated store delay; it is not a production capacity claim, and its conclusions do not extend to a real server or store. |
| NFR2 | No lost updates under contention. After 40 concurrent tasks, `finalVersion ≥ 40` and every committed revision is internally consistent: `version`, `contentHash` and `document` belong to the same submission. |
| NFR3 | Tests are deterministic: no wall-clock assertions, no random data, no shared mutable test state. Interleavings are forced with an injected gated hasher; the suite is repeated 30–50 times with a recorded pass rate. |
| NFR4 | No new runtime dependency, no preset-schema change and no `configHash` change. The slice reuses `serializePresetDocument` / `parsePresetDocument` and the existing Vitest harness. |

## 5. Single most important invariant

**A review action never changes the reviewed document. Every write is conditional on the
exact revision identity and content digest read, re-checked after the asynchronous digest
completes; therefore a committed revision cannot mix content from two submissions and a
stale write cannot silently win.**

This is the contract the tests must protect. If this invariant is broken, both the
read-only reviewer guarantee (AC2) and the no-lost-update guarantee (AC3/AC4) fail.

## 6. Out of scope

- Authentication, session management, account storage, roles at the HTTP layer.
- A reviewer UI, approval dashboard or notification flow.
- Cross-process/durable persistence and production load capacity.
- Changes to the preset v2 schema, `LabConfig`, `configHash` or `RendererPort`.

## 7. Limitations (evidence boundary)

- **In-process CAS only.** The compare-and-swap is enforced inside one JavaScript event
  loop over an in-memory board. It does not survive a reload, cannot coordinate two
  browser tabs or two processes, and is not a durable store. A real server or database
  must implement the same conditional write (`WHERE version = ? AND content_hash = ?`)
  to preserve the guarantee; otherwise a cross-process race remains.
- **In-process load simulation only.** The 40-task p95 is measured by a Vitest harness in
  one Node process with a documented simulated store delay. It is not a network, server,
  database or real-user measurement. No conclusion about production capacity, real-user
  latency or a deployed p95 extends beyond this harness.
- **Authorization is not authentication.** `ReviewActor.role` is supplied by the caller;
  there is no login, session or principal. A real service must derive the role from an
  authenticated identity.
- **No UI or network path.** No screen or HTTP endpoint imports this module in this
  slice. The evidence is the domain test suite and the executable harness, not an
  end-to-end product flow.

# VT-123 — AI-assisted plan and repository review

Tool: Claude Code coding agent (session model reported as
`deepseek/deepseek-v4.1-flash`). This file records the plan the agent produced
**before** coding and the corrections made by reading the repository. The agent
did not receive approval for the plan; every point below was checked against a
file or command output.

## 1. Prompt used

```text
Read AGENTS.md, CONTRIBUTING.md, docs/architecture.md, docs/05-management/
team-ownership.md and src/presets/preset.ts.

Change request (VT-123): add a reviewer role that can read and approve but must
not modify the original data.
Risk: race condition when two requests concurrently change the same resource.
Required: two implementation options, choose one with repository evidence and
record the rejected option; assumptions; files you plan to change; a
concurrency-testing strategy; a mutation that removes an important validation;
40 concurrent tasks with p95 <= 1.5 s.

Do not write code yet. Do not propose schema/hash/stack changes.
```

## 2. Agent plan as returned (before review)

**Option A — server-side RBAC.** Add an HTTP service and a database, a `roles`
table, `GET /presets/:id` for reviewers, `POST /approve`, and a row lock
(`SELECT ... FOR UPDATE`) around the approval transaction. Test with an HTTP
client and a 40-request load run.

**Option B — client-side review board.** Add a pure domain module with
immutable revisions, two roles, and optimistic concurrency. Test with Vitest and
`Promise.all`; run the load harness in Node.

Planned files: `src/core/review/board.ts`, `src/presets/preset.ts` (add reviewer
metadata to the preset), `tests/unit/review.test.ts`,
`tests/load/review-load.test.ts`.

Planned identity: reuse `configHash` from
`src/core/measurement/configHash.ts`.

Assumptions stated by the agent: (a) a server can be added to this repository;
(b) `configHash` identifies the full preset; (c) synchronous methods are enough
to test a race; (d) `setTimeout`/`Promise.all` is sufficient for determinism.

## 3. Review against the repository

| # | Agent point | Evidence found | Decision |
|---|---|---|---|
| 1 | Option A (server RBAC) | `docs/architecture.md` §1: *"Server, auth, persistence — out of scope for this repo"*; the app builds to a static Vite bundle and deploys to GitHub Pages; `CONTRIBUTING.md` forbids incidental stack changes. | **Rejected.** Option B chosen. |
| 2 | Put the module in `src/core/review/` | `docs/architecture.md` §2 rule 1 (`src/core/types` is a leaf) and the dependency graph: core does not import presets; `src/presets` may import core, never `src/ui`. | **Corrected:** `src/presets/review.ts`. |
| 3 | Use `configHash` as the review identity | `src/core/measurement/configHash.ts` deliberately excludes `backendPreference`, `particleColor`, the inactive mode and the preset envelope. A color/backend-only edit would hash the same, so a reviewer could approve content they never saw. | **Rejected.** Use SHA-256 of `serializePresetDocument` (complete canonical artifact; already validates with Ajv). |
| 4 | Add reviewer metadata to `LabConfig` / the preset schema | `docs/02-design/preset-schema-v2.schema.json` has `additionalProperties: false`; the schema and `configHash` are shared contracts that need owner review, and metadata would change preset round-trips. | **Rejected.** Metadata lives in the revision wrapper. |
| 5 | Synchronous methods are enough | A fully synchronous board has no interleaving window in a single JS thread, so the concurrency tests would be vacuous. The real window is the asynchronous content digest (SHA-256). | **Corrected:** async `submit`/`approve` with a post-await CAS. |
| 6 | `setTimeout`/`Promise.all` for determinism | Timers depend on machine load; `Promise.all` completion order is scheduler-dependent. | **Corrected:** unit tests inject a gated hasher with deferred promises (T09); timers are used only in the load harness. |
| 7 | Assert completion order | Order is not part of the contract and varies between runs. | **Corrected:** assert the set of outcomes ("exactly one fulfilled", T06–T08). |

Two points were **rejected outright** (server RBAC, `configHash` identity), two
were **corrected** (module location, synchronous API), and two test-harness
assumptions were replaced. The rejected Option A is recorded here as required by
the VT-123 AI constraint.

## 4. Final file list

| File | Why |
|---|---|
| `src/presets/review.ts` | Domain board, roles, immutable revisions, CAS. |
| `tests/unit/review-workflow.test.ts` | T01–T18. |
| `tests/load/review-load.test.ts` | 40-task p95 harness. |
| `vitest.load.config.ts`, `package.json`, `tsconfig.tests.json` | Isolated harness and its typecheck. |
| `docs/04-testing/*` | Spec, strategy, evidence, traceability, AI log, reflection. |

## 5. Risks the plan keeps visible

- The board is not a distributed lock; a durable store must implement the same
  conditional write.
- The actor role is not authenticated.
- The load harness measures a single Node process; it does not model network,
  database, browser or real accounts.

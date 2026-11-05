# VT-123 — AI usage log

Tool: **Claude Code** coding agent. Session model reported by the harness:
`deepseek/deepseek-v4.1-flash`. Used for planning, implementation, test design,
mutation analysis and document drafting. Every output below was checked against
a repository file or a real command; no claim is accepted because the model
stated it.

## 1. Prompts and outputs

| # | Prompt (summary) | Output used | Rejected / corrected | Evidence |
|---|---|---|---|---|
| 1 | Read the repo rules and the VT-123 assignment; propose two options, assumptions, files and a test approach. Do not code. | Option A (server RBAC) and Option B (client board); assumption list; planned files. | Option A rejected; `src/core/review/` and `configHash` rejected; synchronous API corrected. | `docs/architecture.md` §1–§2; `src/core/measurement/configHash.ts`; `docs/02-design/preset-schema-v2.schema.json` |
| 2 | Write the failing tests for the chosen slice covering role separation, immutability and concurrency. | T01–T18; gated-hasher pattern for T09. | T02 used the v1 flat shape and was fixed; T16–T18 added to cover the default hasher and the two missing negative branches. | `evidence/vt123-red.log`, `evidence/vt123-coverage.log` |
| 3 | Implement the smallest board that satisfies the tests. | `src/presets/review.ts` with post-await CAS. | First attempt kept a separate `current !== target` and hash check; consolidated into one CAS block so the mutation is a single, auditable guard. | `src/presets/review.ts` |
| 4 | Apply a deliberate mutation that removes an important validation; run the tests; restore the file. | Deletion of the CAS block. | Kept the mutation out of every commit; only a working-tree patch and a log. | `evidence/vt123-mutation.log` |
| 5 | Build a 40-task p95 harness for this slice. | `tests/load/review-load.test.ts`; separate config and `test:load`. | Initial workload used a 2 ms store delay, which produced avoidable queueing; reduced to 1 ms and documented that the delay is simulated. | `evidence/vt123-load.log`; `docs/04-testing/VT123-evidence.md` §6 |
| 6 | Draft the report, traceability and reflection. | This dossier and the PDF source. | Claims were limited to what the logs show; production capacity, authentication and real-user p95 are explicitly NOT_VERIFIED. | all evidence files |

## 2. AI-generated items that looked plausible but were not trustworthy

**(a) The T02 test used the wrong document shape.** The generated assertion
`snapshot.document.simulation.particleCount` matched the old flat v1 config.
The repository had already migrated to nested v2 (`document.config.simulation`).
The test still went green on the mutation step because assigning to `undefined`
throws `TypeError`, so `toThrow(TypeError)` did not prove the object was frozen.
Detected by the failing T02 run and a manual type/read check; fixed to inspect
`document.config.simulation` and to compare the stored value.

**(b) "A synchronous board is enough; JS is single-threaded."** Plausible, but
with no `await` between read and write there is no interleaving window, so the
concurrency test would pass even if the board had no protection at all. The real
window is the asynchronous content digest. This is why T09 injects a gated
hasher and why the mutation only fails when the CAS after the `await` is
removed.

**(c) "Reuse `configHash` for the approval identity."** Plausible because it is
the repository's existing identity function, but its documentation and
`canonicalConfig` exclude `backendPreference`, `particleColor`, the inactive
mode and the envelope/name. Two presets differing only in colour or backend
would share a hash, so a reviewer could approve content they never saw. The
board uses SHA-256 of the complete canonical document instead.

## 3. Reporting honesty

- The load result is a harness result, not a production benchmark. The PDF and
  evidence file state the single-process, in-memory and simulated-I/O limits.
- The reviewer role is not authentication; the repository has no server or auth
  layer.
- The `NOT_RUN` / `NOT_VERIFIED` items (real store, multi-process race, real
  users, physical deployment) are not described as passed.
- No AI review is presented as human approval. The branch is a personal
  assignment and must not be merged without another person's review.

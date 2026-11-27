# VT-122 AI usage log

Student: Lê Huy Anh Dũng (23001846). All AI output was reviewed, executed and
either accepted, rewritten or deleted by the student. No AI-generated number is
used without a matching raw log in `evidence/`.

| # | Date | Purpose / prompt summary | AI output | Student decision and verification |
| --- | --- | --- | --- | --- |
| 1 | 08/11/2026 | Inspect the repository and propose a vertical slice for "idempotent preset resubmission" that can actually run here. | Suggested either an HTTP handler (not runnable) or a `PresetSaveService` + port. | Chose the port slice because the repo has no server/DB/UI. Verified by searching the repo; recorded the limitation instead of fabricating an API. |
| 2 | 08/11/2026 | Generate the first RED tests for replay, conflict, validation, boundary and receipt faults. | A test skeleton with 15 assertions across unit and integration files. | Reviewed each oracle; kept 15. Ran before implementation: 12 failed / 3 passed (`red.txt`), then implemented only enough to pass. |
| 3 | 08/11/2026 | Design a pairwise matrix for `prior × clock × input × receipt` with realistic constraints. | Generator with 4 factors, constraints, greedy pair selection and 18 rows. | Checked constraints by hand (invalid input cannot reach the port, `prior=none` has no expiry, etc.). Re-ran generator: 29 valid combinations, 52/52 pairs, 18 rows. |
| 4 | 08/11/2026 | Propose one boundary mutation for the retention operator. | `now > expiresAt` → `now >= expiresAt`. | Created a throwaway branch, committed mutant `eb1b1d3`; T02 survived, T05/T14/T22/P01/P11 failed. Restored the original operator and kept the diff/logs. |
| 5 | 08/11/2026 | Generate six additional tests for the save service. | AI-01…AI-06; all six passed immediately. | Inspected them: four were duplicates or had no effect oracle; two were rewritten. See the disposition table below. |
| 6 | 08/11/2026 | Draft the README/spec/strategy/traceability and the report layout. | Draft prose and table structure. | Every count, hash, p95 and result was re-read from the evidence files; unsupported claims were removed. The student owns the final text and reflection. |
| 7 | 08/11/2026 | Review the final diff for scope creep. | Suggested no schema/hash/GPU changes and no production exactly-once claim. | Confirmed only presets guard, tests, docs and a dev-only coverage package changed. |

## AI-generated candidate tests: before and after

Evidence: `evidence/ai-candidates-before.txt` (6/6 passed) and
`evidence/ai-candidates-after.txt` (2/2 passed).

| Candidate | Weakness found | Disposition |
| --- | --- | --- |
| AI-01 duplicate happy path | Duplicates T02; asserts only one call | Deleted |
| AI-02 weak promise assertion | `resolves.toBeDefined()` proves almost nothing | Deleted |
| AI-03 invalid key without zero-call oracle | Does not prove the port was skipped | Deleted |
| AI-04 conflict without effect oracle | Does not prove one effect / preserved receipt | Deleted |
| AI-05 weak receipt mismatch | Only checks that something throws | Fixed as **T24**: wrong-canonical receipt, unconfirmed state, one effect, retry reconciles |
| AI-06 real-timer retention test | Nondeterministic sleep; can flake on a loaded machine | Rewritten as **T23** with the injected clock and a deterministic failed→retry path, frozen receipt and one effect |

Four tests were deleted and two were fixed. The remaining suite has explicit
call-count, effect-count and receipt-identity oracles.

## What AI did not do

- It did not run the tests in place of the student; every result in this
  repository comes from a command recorded under `evidence/`.
- It did not claim real HTTP/DB durability. The port is a test double and that
  limitation is repeated in the README, PR body and report.
- It did not copy another team member's plan, tests, mutation or reflection.
  VT-120 (#88/#89) was intentionally not reused.
- It did not choose the final scope, acceptance criteria or reflection; those
  were reviewed and accepted by the student.

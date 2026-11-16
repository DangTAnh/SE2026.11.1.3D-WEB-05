# Reviewer concurrency — design proposal and self-review (VT-123, Issue #85)

## 0. Prompt used

The main prompt is the BT3 assignment brief supplied for variant VT-123. The Phase 1
instruction was, in substance:

> Write one problem statement, 3–5 testable acceptance criteria (reviewer permissions,
> original data unchanged, concurrency), at least two non-functional constraints including
> p95 ≤ 1.5 s at 40 concurrent tasks and no lost updates, and the single most important
> invariant. Propose TWO design options, choose one using evidence from the repository, and
> explicitly document the rejected option. Then self-review the plan against the real repo
> and correct at least two wrong or missing points with evidence.

The output below is the plan produced from that prompt. Section 6 records what the first
draft got wrong and how it was corrected.

## 1. Assumptions

- Node ≥ 22.16 (local `v24.15.0`) and the committed toolchain; no dependency upgrade.
- `PresetDocument` v2 is the resource. It is validated by Ajv and canonicalized by
  `serializePresetDocument` (`src/presets/preset.ts:40-99`).
- The repository has no server, authentication or persistence
  ([architecture.md](../architecture.md) §1, line 37), so the slice is a domain contract
  plus an executable harness.
- `ReviewActor.role` is an authorization input, not an authenticated principal.
- The only asynchronous suspension point in the board is the content digest; tests inject a
  deterministic or gated hasher.

## 2. Design option A — optimistic concurrency control (chosen)

Each revision carries `version` and `contentHash`. A submission states the `baseVersion` it
read; an approval states the exact `(version, contentHash)` the reviewer read. Both
operations perform their asynchronous digest first and then re-read the board. The write is
committed only if the board still holds the same revision, status and digest. Otherwise the
operation fails with `stale-version` or `content-changed`.

### Pros

- No blocking and no lock ownership, lease, timeout or deadlock handling.
- Fits the repository's existing async style: the UI already discards superseded async
  results with a generation counter (`src/ui/app.ts:50`, `src/ui/app.ts:119-123`) instead
  of locking.
- Reuses the canonical serializer as the content identity
  (`src/presets/preset.ts:78-99`), so the hash covers the complete v2 document (name,
  rendering, camera, backend preference), unlike `configHash`
  (`src/core/measurement/configHash.ts:8-20`).
- Immutability is already a repo pattern: frozen defaults and `cloneConfig`
  (`src/presets/preset.ts:27-38`). A review action can return a new wrapper without
  touching the document.
- Conflicts are rejected quickly and retried by the caller, so 40 tasks do not queue behind
  one lock.

### Cons

- Callers must handle `stale-version` / `content-changed` and retry.
- Under extreme contention retries can starve; the load harness bounds retries and fails
  loudly if exhausted.
- The guarantee is only as strong as the store's conditional write; the in-memory board
  cannot protect a second process.

### Files to change

- `src/presets/review.ts` (new): `PresetReviewBoard`, immutable `PresetRevision`,
  `ReviewActor`, `ReviewError`, injectable `ContentHasher`, default SHA-256.
- `tests/unit/review-workflow.test.ts` (new): permissions, immutability, CAS, deterministic
  interleavings, negative and failure paths.
- `tests/load/review-load.test.ts` + `vitest.load.config.ts` (new), `test:load` script in
  `package.json`: 40-task p95 harness.
- No change to `src/presets/preset.ts`, the schema, `configHash` or `RendererPort`.

## 3. Design option B — pessimistic lock / serialized queue (rejected)

A per-resource mutex serializes every read-modify-write. A submission or approval acquires
the lock, reads the current revision, writes, then releases. The lock needs an owner, a
lease/timeout and a cleanup path; in a multi-process store it must be enforced by the
store itself.

### Pros

- Simple mental model: no retries and no optimistic conflict path.
- A correctly implemented lock also prevents lost updates.

### Cons

- There is no host for the lock: the repository has no server, auth or persistence
  ([architecture.md](../architecture.md) §1, line 37). A browser-only lock cannot cover
  tabs or processes without a shared storage/Web Locks design, which is outside this slice.
- A lock adds owner identity, lease expiry, timeout, deadlock and release-on-failure code
  that must itself be tested. That is more surface than the optimistic re-check.
- It serializes all 40 tasks; the p95 budget would depend on queue length, while the chosen
  option lets independent tasks proceed and rejects only true conflicts.
- A lock does not enforce the reviewer read-only rule; authorization still has to be
  checked. It solves only one of the two required behaviours.

### Why it was rejected (repository evidence)

1. **No process or store to own the lock.** The architecture explicitly places server,
   auth and persistence out of scope ([architecture.md](../architecture.md) §1, line 37).
   The board is in-process.
2. **The codebase already prefers stale-result rejection to blocking.** The backend switch
   uses a monotonically increasing request id and ignores superseded promises
   (`src/ui/app.ts:50`, `src/ui/app.ts:119-123`).
3. **The repository already provides deterministic content identity.**
   `serializePresetDocument` produces byte-stable, validated canonical output
   (`src/presets/preset.ts:78-99`), which is exactly what a compare-and-swap needs.
4. **`configHash` is not a substitute.** It deliberately projects only simulation values
   and the active mode group (`src/core/measurement/configHash.ts:8-20`); it excludes name,
   colours, opacity, blend, camera and backend preference. Approving by `configHash` would
   let a reviewer approve changed content.
5. **The repo already uses immutability.** Defaults are frozen at every level and
   `cloneConfig` returns an independent copy (`src/presets/preset.ts:27-38`).

## 4. Implementation plan (test-first)

1. Fetch `origin/dev`; create `feat/85-reviewer-concurrency` from
   `8f7c3eeb74c7a9501332b265fa16a6aa552aa2b3`. Record the hash.
2. Write the unit and load tests first, run them, and save the failing log. The expected
   failure is a module-not-found or missing-export error only at the first RED step; the
   committed failing evidence must show assertion failures for the intended behaviours, so
   the first run is followed by a second RED run against the implemented types.
3. Implement `src/presets/review.ts`:
   - `ReviewRole = 'editor' | 'reviewer'`; `ReviewStatus`;
     `ReviewActor { id, role }`.
   - `PresetRevision { version, document, contentHash, status, submittedBy, reviewedBy,
     reviewNote }`, deeply frozen.
   - `PresetReviewBoard.read()` returns the frozen revision.
   - `submit(actor, document, baseVersion)` is editor-only; validates and canonicalizes with
     `serializePresetDocument`, parses an independent copy, awaits the digest, re-reads the
     version, then commits.
   - `approve` / `reject` are reviewer-only; require the exact version and digest, await the
     digest, re-read identity/status/digest, then commit review metadata only.
4. Add the load harness and `test:load` script.
5. Run `npm run typecheck`, `npm run typecheck:tests`, `npm test`, `npm run test:load`,
   `npm run build`. Save logs under
   `docs/04-testing/evidence/reviewer-concurrency-2026-11-06/`.
6. Document how to run the tests in [the testing README](../04-testing/README.md).

## 5. Test-first vertical slice

The first commit contains only tests and supporting config; production code follows in a
separate commit after the failing result is recorded. The load test is excluded from
`npm test` (`vitest.config.ts:6` includes only `tests/unit` and `tests/integration`) and runs
through `npm run test:load`.

## 6. Self-review against the real repository

The first draft of this plan contained the following wrong or missing points. Each was
corrected before coding.

| # | First-draft claim | Why it is wrong / missing | Evidence | Correction |
|---|---|---|---|---|
| 1 | Reuse `configHash` as the review identity. | `configHash` projects only simulation fields and the active mode group. Two documents that differ only in name, colours, opacity, blend, camera or backend preference would hash the same, so a reviewer could approve changed content. | `src/core/measurement/configHash.ts:8-20` builds `fields` from `simulation` + active mode only and explicitly says "only simulation and the active mode group enter the hash". | Hash `serializePresetDocument(document)`, which includes the complete validated v2 document (`src/presets/preset.ts:78-99`). |
| 2 | Add the reviewer role to the UI/auth layer. | The repo has no auth, session, account or role state; the architecture marks server/auth/persistence out of scope. A UI role would be a fabricated authorization decision. | [architecture.md](../architecture.md) §1, line 37; no role/auth symbols in `src/`; preset import/export is client-side only (`src/ui/controls/controlBindings.ts:137-165`). | Model `ReviewActor` as a caller-supplied authorization input and state the limitation in the requirements. |
| 3 | Store the caller's document object directly and freeze only the wrapper. | The caller could mutate the stored document after submission; `preset.ts` deliberately returns an independent copy (`structuredClone`) and keeps defaults frozen at every level. | `src/presets/preset.ts:67-73` returns `structuredClone(value)`; `src/presets/preset.ts:27-38` freezes every level. | Validate/canonicalize, parse the canonical string into a new copy, then deep-freeze the document and the revision wrapper. |
| 4 | Force the race with `setTimeout` sleeps in tests. | Wall-clock sleeps are non-deterministic and create flaky tests; the assignment explicitly asks for deterministic concurrency evidence. | The assignment's NFR (deterministic, repeatable) and the existing test style (fake clock / injected dependencies, e.g. `tests/unit/perf-collector.test.ts`). | Inject a `ContentHasher` that returns a deferred promise; resolve the two operations in the chosen order with `Promise.allSettled`. No sleeps in assertions. |
| 5 | Put a mutex around the board because `await` yields. | JavaScript is single-threaded. The board has one asynchronous suspension point (the digest). A post-await re-read is sufficient; a mutex adds lease/timeout/release code with no host. | The repo has no lock/store ([architecture.md](../architecture.md) §1, line 37) and already uses a generation counter to ignore superseded async work (`src/ui/app.ts:50`, `119-123`). | Use optimistic compare-and-swap after the digest. |
| 6 | Assume `src/presets/review.ts` already exists and only needs a patch. | The file was deleted by the revert commit; it is not in the current tree. | `git show --stat 3798f8f` deletes `src/presets/review.ts`, `tests/unit/review-workflow.test.ts`, `tests/load/review-load.test.ts`, `vitest.load.config.ts`; the file listing confirms they are absent. | Treat the module and tests as new files. |
| 7 | Assume `npm test` will run the load harness. | `vitest.config.ts:6` includes only `tests/unit/**` and `tests/integration/**`. | `vitest.config.ts:6`. | Add a separate `vitest.load.config.ts` and a `test:load` script; keep `npm test` fast and deterministic. |

## 7. Definition of done for this slice

- AC1–AC5 are covered by named tests; each AC maps to at least one test file and line.
- The concurrency tests are genuinely parallel: operations are started before any digest
  resolves, and the gated hasher controls the interleaving.
- The planned mutation removes the post-await re-check of `version`/`contentHash`; at least
  one test must fail on the mutant.
- 40-task p95 is measured and compared with 1500 ms; the harness limits are stated.
- G0 (`typecheck`, `build`), `npm test` and `npm run test:load` pass on the final revision.

## 8. Planned mutation

The deliberate defect for Phase 4 is: **remove the post-await re-check of
`version`/`contentHash`** in the board's write path. Concretely:

- `submit` no longer re-reads the current version after the asynchronous digest; or
- `#review` no longer compares the current revision identity, status and digest after the
  asynchronous digest.

That re-check is the validation that closes the race window. **No test is pre-claimed as the
killer.** Which test detects the mutant is recorded only after the Phase 4 run. The recorded
result is in
[03-mutation.log](../04-testing/evidence/reviewer-concurrency-2026-11-06/03-mutation.log):
T10 killed the mutant; after T19 was added, T10 and T19 both kill it.

## 9. Evidence and commit policy

- The repository stores the slice's source, tests, docs and evidence on the feature branch.
- Evidence logs live in
  `docs/04-testing/evidence/reviewer-concurrency-2026-11-06/`.
- Generated output (`coverage/`, `dist/`, `node_modules/`) and local report/PDF drafts are
  not committed.
- The committed docs are the source of truth for the repository; course-only working copies
  are not part of the branch.

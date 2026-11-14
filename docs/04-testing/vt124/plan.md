# VT-124 approved Phase 2 plan — Issue #93

Baseline: e55405da0bd2546d33baa53acda060c470e2200d (origin/dev).
Branch: feat/93-bulk-preset-import. One delivery assignee: justcoffeee.
Scope: preset-domain module and executable tests, no new bulk UI/API/storage.

## Human review before code

The user approved module + test harness, no UI, and explicitly rejected the
assumption that the existing handler processes multiple files, citing
src/ui/controls/controlBindings.ts:152, input.files?.[0]. This feedback arrived
before any VT-124 implementation/test patch. It is human feedback, not an
invented reviewer approval. A second repository correction: app.ts applies one
active configuration; architecture.md says there is no real persistence layer.
Accepted records below mean in-memory returned documents, never persisted data.

## Contract and scope decisions

Input: an array of independent JSON texts. Reuse parsePresetDocument per record.
Non-string elements, malformed JSON, invalid v2/v1 documents reject individually.
One invalid record must not discard earlier accepted documents or skip later
ones. Exactly one ordered outcome per index; duplicates retained. Empty input
is EMPTY. Top-level non-array, >100 records, or total string content >1,000,000
UTF-8 bytes rejects before processing. Limits are proposed design constraints
accepted with the plan, not an existing bulk feature. No option/dependency/schema
changes. Results from separate calls are isolated.

Report state is derived from accepted/rejected counts: EMPTY, VALID_ONLY,
ERROR_ONLY, MIXED. Transition tests run successive prefixes and compare against
literal expected states/outcomes. This is a state-transition oracle for the
observable batch report, not a claim of persistent sessions or asynchronous jobs.

## Acceptance / risks

- AC1 strict existing v2 validation and invalid runtime elements.
- AC2 preserve valid documents before and after record failures.
- AC3 ordered exhaustive accounting, no early abort or silent dedupe.
- AC4 full-document/name preservation, no input/default/cross-run mutation.
- AC5 existing single-import/export/runtime behavior unchanged.

State events: valid or invalid record. EMPTY -> VALID_ONLY/ERROR_ONLY;
VALID_ONLY -> VALID_ONLY/MIXED; ERROR_ONLY -> MIXED/ERROR_ONLY;
MIXED -> MIXED for either event. New call starts EMPTY.

## Phase 2 execution ledger

1. Issue/assignee and isolated branch; npm ci + baseline suite.
2. Write unit/integration tests and explicit throwing contract stub; observe RED
   from unimplemented behavior, not missing imports/tool setup; commit RED.
3. Small GREEN implementation, same tests; full suite and both typechecks/build.
4. Existing desktop/mobile E2E regression, preserve failures/retries separately.
5. Diff + final independent agent review, Conventional Commits, normal push and
   Draft PR into dev. No approve/merge/deploy/tag.

Expected files: src/presets/batchImport.ts, tests/unit/preset-batch.test.ts,
tests/integration/preset-batch.test.ts, tests/support/vt124-presets.ts and these
technical evidence docs; append a new PROJECT_STATUS checkpoint only.

At plan approval, Phase3/4 were NOT_RUN. After the user subsequently selected
"continue the entire submission", the actual mutation/coverage/repeats/load and
local PDF work continued. Their results are recorded separately in evidence.md;
this original plan is not relabelled as execution evidence. No promises about
hardware, real-user capacity or durable persistence.

Raw local logs: vt124-evidence.local/ (ignored; no personal data in public docs).
Results/evidence ledger is updated only after commands finish. Do not commit
temporary files, node_modules, dist or other students' work.

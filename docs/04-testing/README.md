# Testing runbook

This file lists the commands used to verify the repository. It is the runbook for the
reviewer-concurrency slice (VT-123, Issue #85); the evidence logs are in
[`evidence/reviewer-concurrency-2026-11-06/`](evidence/reviewer-concurrency-2026-11-06/).

## Prerequisites

- Node.js >= 22.16 (the current `package.json` engine constraint).
- Install dependencies once with `npm ci`.
- Install the Playwright browser once with `npx playwright install chromium`.

## Repository checks

```sh
npm run typecheck        # tsc --noEmit over src/
npm run typecheck:tests  # tsc --noEmit -p tsconfig.tests.json
npm test                 # Vitest unit and integration tests
npm run test:e2e         # Playwright Chromium E2E
npm run build            # typecheck + typecheck:tests + production build
npm run verify           # all of the above, in one command
```

`npm run build` includes both typechecks, so G0 is `npm run typecheck` + `npm run build`
when a change also needs the test typecheck.

## Review slice

```sh
npx vitest run tests/unit/review-workflow.test.ts  # T01-T14, T17-T19 (17 tests), deterministic unit/race suite
npm run test:load                                  # T15, 40 concurrent tasks, p95 budget
npm run test:coverage                              # coverage for src/presets/review.ts
```

The load test uses its own config (`vitest.load.config.ts`) and is not part of `npm test`.
`npm run test:coverage` writes a generated `coverage/` directory; do not commit it. The
coverage provider is the declared devDependency `@vitest/coverage-v8@5.0.3`.

## Mutation check

The deliberate mutation is the patch in the evidence folder. It removes the post-await
version/contentHash re-check from `PresetReviewBoard.#review`. To run it without keeping
the mutant:

```sh
git switch -c bt3-mutation-repro
git apply docs/04-testing/evidence/reviewer-concurrency-2026-11-06/mutation-remove-post-await-recheck.patch
npx vitest run tests/unit/review-workflow.test.ts
git restore src/presets/review.ts
git switch feat/85-reviewer-concurrency
git branch -D bt3-mutation-repro
```

The current suite should fail T10 and T19 (the mutant is killed). The historical pre-T19
run in
[`03-mutation.log`](evidence/reviewer-concurrency-2026-11-06/03-mutation.log) records the
same mutation being killed by T10 only, before T19 existed.

## Evidence

| File | Purpose |
|---|---|
| [`01-fail.log`](evidence/reviewer-concurrency-2026-11-06/01-fail.log) | RED run before the implementation |
| [`02-pass.log`](evidence/reviewer-concurrency-2026-11-06/02-pass.log) | GREEN unit, load and full-suite run |
| [`03-mutation.log`](evidence/reviewer-concurrency-2026-11-06/03-mutation.log) | Mutation diff, raw failures, reproduction and T19 re-run |
| [`04-coverage.log`](evidence/reviewer-concurrency-2026-11-06/04-coverage.log) | Line/branch coverage and uncovered-branch mapping |
| [`05-flakiness.log`](evidence/reviewer-concurrency-2026-11-06/05-flakiness.log) | 30 repeated unit-suite runs |
| [`06-load-repeat.log`](evidence/reviewer-concurrency-2026-11-06/06-load-repeat.log) | 10 repeated load runs and p95 spread |

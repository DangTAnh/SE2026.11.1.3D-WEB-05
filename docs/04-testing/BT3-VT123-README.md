# BT3 / VT-123 — Preset reviewer role (23001864)

Individual BTCN3 deliverable. **Do not merge without team review.**

| Item | Value |
|---|---|
| Student | Đỗ Minh Đức — 23001864 |
| Variant | VT-123 |
| Team / project | SE2026-T30 / 3D-WEB-05 |
| Repository | https://github.com/DangTAnh/SE2026.11.1.3D-WEB-05 |
| Issue | [#85](https://github.com/DangTAnh/SE2026.11.1.3D-WEB-05/issues/85) |
| Pull request | [#86](https://github.com/DangTAnh/SE2026.11.1.3D-WEB-05/pull/86) — **draft, do not merge** |
| Branch | `feat/85-reviewer-role` |
| Baseline | `dev@8f7c3eeb74c7a9501332b265fa16a6aa552aa2b3` |
| Change request | Add a reviewer role that can read and approve but must not modify the original data. |
| Risk | Race condition when two requests concurrently change the same resource. |
| Test technique | Concurrency testing. |
| Mutation | Remove an important validation (the post-await content-hash / revision CAS). |
| Load | 40 concurrent tasks, p95 <= 1.5 s. |

## What changed

- [`src/presets/review.ts`](../../src/presets/review.ts) — immutable preset
  revisions, editor-only `submit`, reviewer-only `approve`/`reject`, and an
  optimistic compare-and-swap on `(version, contentHash, status)` after the
  asynchronous digest.
- [`tests/unit/review-workflow.test.ts`](../../tests/unit/review-workflow.test.ts)
  — T01–T18: role separation, immutability, deterministic stale-approval
  interleaving, 40-way contention, atomic failure.
- [`tests/load/review-load.test.ts`](../../tests/load/review-load.test.ts) and
  [`vitest.load.config.ts`](../../vitest.load.config.ts) — 40 concurrent review
  tasks with a simulated 1 ms store round-trip; fails when p95 > 1500 ms.
- `docs/04-testing/VT123-*.md` — specification, plan review, strategy,
  evidence, traceability, AI log and reflection.
- `docs/04-testing/evidence/*.log` — raw RED, GREEN, mutation, coverage,
  repeat-run, full-suite, build and load output.

## Run the tests

```sh
npm ci
npx playwright install chromium   # only needed for the existing E2E suite
npm run typecheck
npm run typecheck:tests
npx vitest run tests/unit/review-workflow.test.ts   # 18 tests
npm run test:load                                    # 40 tasks, p95 <= 1.5 s
npm test                                             # full unit/integration suite
npm run build                                        # G0
```

## Result at the branch tip

| Check | Result |
|---|---|
| Review suite | 18/18 PASS |
| Full unit/integration suite | 283/283 PASS (25 files) |
| Repeat runs (flaky check) | 0 failures in 20 runs |
| Mutation (CAS removed) | killed by T05, T08 and T09; restored, 18/18 PASS |
| Coverage (`src/presets/review.ts`) | 100% statements / branches / functions / lines |
| Load (40 tasks, 1 ms simulated I/O) | p95 256–300 ms vs 1500 ms target; 4 runs, 0 harness errors |
| Typechecks / build | PASS (209 modules) |

## Scope limit

The repository has no server, auth or persistence (`docs/architecture.md` §1),
so this slice models and tests the concurrency contract in a client-side module.
`ReviewActor` is an authorization input, not an authenticated principal. A real
deployment needs a server-side store whose conditional write implements the same
CAS (for example `UPDATE ... WHERE version = ? AND content_hash = ?`).

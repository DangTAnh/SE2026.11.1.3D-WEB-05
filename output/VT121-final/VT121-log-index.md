# VT121 log index

All current root logs are freshly executed on the v2 candidate unless explicitly labelled historical in history/v1. Each raw command log has timestamp, cwd/OS/Node, command and exit footer; individual subcommand exits are printed where a diagnostic batch continues after failure. Later runner versions additionally record code HEAD and relevant non-secret environment settings. This index maps provenance for earlier headers without replacing raw output.

-00-environment: original v1 branch2f8bc2c preservation and CLI/DNS diagnostics; overall exit6 is network failure, not auth verdict.
-01-baseline: bundle valid; current dev object absent; fetch/ls-remote fail128; cached dev2389f0f compared with main. Batch final diff exit0 does not mark fetch PASS.
-01-baseline-tests: v2 base2389f0f install/typechecks/241 tests PASS, exit0.
-02-plan-review: later dump of preserved initial plan/revision files (written before feature edits) and immutable main/dev source diff. Its command timestamp is later; it is not presented as the original plan creation time.
-03-red: app source2389f0f, pre-implementation E1 failed missing Undo, exit1; RED commitbfd1247 subsequently recorded it.
-04-green: feature source before commit e808d70,312 tests and E1 PASS.
-04-green-final-feature:312 previously passed; source/test typechecks, all8 focused browser cases and build PASS, before feature commit.
-05-regression: initial full run79PASS/8SKIP/5FAIL, exit1, HMR transport error.
-05-baseline-gpu-recheck: unmodified baseline source through VT121_SOURCE_BASELINE worktree, desktop3 HMR errors reproduced; later workers used the transport fix, so3FAIL/3PASS/2SKIP is not a single immutable transport benchmark or pre-implementation RED.
-05-transport-fix-check:2 parity tests PASS after HMR transport repair.
-05-regression-restored:80PASS/8SKIP/4FAIL, exit1, shared artifact ENOENT during concurrent campaigns; not production assertion failures.
-05-regression-isolated: verified e7b72e7 source/test/config; final full verify PASS exit0,312 unit/integration +84 browserPASS/8 capabilitySKIP.
-06-mutation: sourcee808d70 plus the single uncommitted Undo guard deletion; AUTH2 expectedFAIL exit1 (mutationKILLED).06-mutation-cleanup records safe deletion and diff checks.
-07-coverage /07-coverage-final: actual TypeScript modules via Node stripping;2 tests PASS,100% selected source line/branch/function. Final rerun at e7b72e7. App/whole-project NOT_MEASURED.
-08-flaky: summary of actual unit/E2E loops, raw08-unit-1/2/3 and08-e2e-1/2/3. All exit0, seeds121/122/123 and retries0. Simultaneous campaign artifacts interfered with full suite, preserved separately.
-09-performance: exploratory Node run during regression, not final latency claim.
-09-performance-isolated: final five rounds,200 jobs each, warmup1000, actual p50/p95/p99/duration/throughput/errors/raw samples, sourcee7b72e7.
-09-browser-performance: CLI quoting error before workload, exit1; no performance datum.
-09-browser-performance-fixed: quoted command executed200 submitted UI jobs with max10 active contexts;0 functional errors, test exit0, queue p95=13.347999s EXCEEDS5s. It is not a latency PASS or200 simultaneous real users.
-10-github-pr /10-github-final: live DNS/network errors before HTTP; auth unresolved, no push/PR/CI action taken.

Raw embedded trace/video paths from old failed runs are reporter outputs; some ephemeral artifacts were deleted by concurrent runners. Saved logs and RED screenshot are available, not every ephemeral attachment. Code commit mapping and final packaging integrity checks are in handoff/results/manifest.

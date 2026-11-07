# BT3 - 23001821 - VT-120

Original individual work for Dang The Anh / Đặng Thế Anh, SE2026-T30,
3D-WEB-05. Issue #88; branch feat/88-idempotent-preset-retry.
Baseline: f00271e06347c5a4c88ebeffc00ca4c2134a7651.

## Run (Node >=22.16, committed lockfile)

```powershell
npm ci
npx vitest run tests/unit/preset-persistence.test.ts tests/integration/preset-persistence.test.ts
npx vitest run --coverage --coverage.include=src/presets/persistence.ts --coverage.reporter=text
$env:VT120_LOAD_RESULT = [IO.Path]::GetFullPath('../vt120-load.json')
npx vitest run --config vitest.vt120-load.config.ts
Remove-Item Env:VT120_LOAD_RESULT
npm run verify
```

PBT: fast-check 4.10.2, default seed 23001821, 200 generated cases/run and
automatic shrinking. Optional VT120_PBT_SEED changes the recorded seed.
Load runs separately from normal verify: 80 tasks released at a shared barrier,
1ms simulated service I/O, half fail-before-commit and half lose first response,
3 attempts/5ms base delay, p95 = sorted latency index 75, threshold 2500ms.
All tasks use the SAME barrier-release timestamp, including their initial
dispatch queue; the clock does not begin only when a task's microtask starts.
It measures end-to-end per-task validation/retries/confirmation in ONE process.
No real users, HTTP, disk, DB, network, GPU or deployed service is measured.

## Spec, tests and evidence

- [Specification, original restricted-context plan and cases](VT120-spec-plan.md).
- [Review, results, traceability and AI usage](VT120-evidence.md).
- Module: src/presets/persistence.ts. Test-only atomic ledger:
  tests/support/vt120-service.ts. No product UI imports this slice.
- RED commit e626654 contains a deliberately unimplemented contract stub plus
  tests, not a runnable feature. GREEN implementation commit 184cdd2.
- Deliberate mutation is isolated in local branch test/88-vt120-success-mutant,
  commit e1142f8, never merged or pushed into the submission branch. To reproduce
  in a disposable worktree, replace the catch guard's `throw error` with
  `return Object.freeze({ ...request, committed: true })`, then run T04/T13.
  Both must fail. Restore the original file before any normal verification.
- Machine logs/JSON and mutation diff are retained in the external VT120
  submission evidence package and PDF appendix; generated raw logs are not
  committed. Commands, outcomes and counterexample are summarized below.

## Limits and ownership

The service/adapter MUST atomically persist operation key, complete canonical
payload, effect and receipt. Otherwise retries after a lost response can repeat
effects despite this client. A client does not provide durable exactly-once
semantics, cross-process coordination, authentication or trustworthy receipt
verification against a dishonest adapter.

Ports must settle; no deadline/cancellation guarantee. Failure can mean a remote
commit exists without local confirmation. Retry the same logical operation key,
never a new key to "fix" an ambiguous outcome. Client key reservations/receipts
remain in memory for its lifetime (no eviction), so unbounded operation streams
need a durable ledger/retention design. There is no production persistence to
roll back here.

Human/module-owner review remains required. No merge, deployment or tag.

# Review #91 follow-up — non-string request ids

## Finding

TV4 AI-assisted review `5822322675` (CHANGES_REQUESTED, 09/11/2026) raised one
blocking P2:

`RegExp.test(requestId)` coerces runtime values to strings, so `undefined`,
`null`, `123`, `true`, `['req-1']` and an object with
`toString: () => 'req-1'` passed `assertRequestId`. The original non-string value
was then used as the `Map` key and forwarded to `port.save`, violating AC3
(zero calls/effects for invalid ids).

## Fix

Commit `f88a94b74163d76dc63eb9a22ad45b8c2ab21cd3` (author: DangTAnh) changes the
guard to check the runtime type before the regex:

```ts
if (typeof requestId !== 'string' || !REQUEST_ID.test(requestId)) {
  throw new TypeError('requestId must match ^[A-Za-z0-9._:-]{1,128}$');
}
```

VT122-T07 now iterates over the four invalid string classes plus
`undefined`, `null`, `123`, `true`, `['req-1']` and
`{ toString: () => 'req-1' }`, and asserts `TypeError`, zero port calls and
zero committed effects.

## Reproduction

- Red: with only the `typeof` guard reverted, T07 fails because the promise
  resolves for `requestId: undefined` instead of rejecting:
  `review91-t07-red.txt` (exit 1).
- Green: `review91-t07.txt` — 1/1 T07 pass.
- Full suite on `f88a94b`: `green-final.txt` — 310/310 pass.
- Both typechecks and production build: `build.txt` — PASS (existing chunk
  advisory only).
- Published CI on `f88a94b`: run `42590832942` SUCCESS; 310 tests, 76 E2E pass /
  12 capability skips, CodeQL and Analyze pass (reviewer-provided evidence, then
  re-checked on the PR).

Re-review `5835810121` (verdict APPROVE, 10/11/2026) confirms the P2 is
resolved. That review is AI-assisted technical evidence, not independent human
approval, NFR acceptance or authorization to merge.

## Approval lifecycle

The APPROVE was recorded against `f88a94b`. When the docs-only commit `aab05b3`
was pushed, GitHub auto-dismissed it (`review_dismissed`, 10/11/2026 06:19 UTC,
actor Terivn; repository setting dismisses stale approvals on new commits).
The review body is retained, but the PR currently has **no active approval**.
A fresh human approval is therefore still required after the documentation
follow-up; the dismissal is a workflow fact, not a new code defect.

## Remaining workflow correction

The review noted that Issue #90, the README and the PR body require a draft
personal-assignment PR, while the live PR was Ready for review. This follow-up
converts the PR back to draft and keeps it unmerged. The technical approval is
retained as review evidence; a human still has to approve before any merge.

## Non-blocking notes not changed

- Retention eviction is lazy: untouched keys are not swept. This is not a
  bounded-memory cache and remains documented as a limitation.
- The load harness starts each timer after the barrier, so the reported p95 is
  task latency, not queue-inclusive dispatch latency.
- PR #89 uses a parallel coordinator with a different port contract. Choosing
  the integration boundary is a team decision, not a change to this slice.

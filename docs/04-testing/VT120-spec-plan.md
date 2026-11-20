# VT-120 - individual original work

Dang The Anh / Đặng Thế Anh, 23001821, SE2026-T30, 3D-WEB-05.
Issue #88, baseline f00271e06347c5a4c88ebeffc00ca4c2134a7651.
Assignment URL justcoffeee/SE2026.11.1.3D-WEB-05 currently redirects to
DangTAnh/SE2026.11.1.3D-WEB-05; this is the same repository, not an unrelated fork.

## Specification

Problem: a preset write can commit remotely and lose its response. Blind retries
can repeat the side effect; reporting success on a failed write can leave the
caller and persistence inconsistent. Add a bounded retry coordinator using the
existing validated full preset document.

| AC | Testable requirement |
|---|---|
| AC1 | Validate key/document and capture canonical full JSON before I/O; retries use identical operation identity and bytes. |
| AC2 | Retry only TemporaryPersistenceError, at most maxAttempts (1..8); other errors and receipt mismatch reject. |
| AC3 | Matching duplicates, including concurrent calls and client restart after response loss, produce <=1 service effect under an atomic deduplicating port contract. Different content under the same key rejects. |
| AC4 | Resolve success and expose confirmed state only after a receipt matching key, canonical bytes and committed:true. Exhaustion/partial failure is not success; a remote commit may remain unconfirmed. |
| AC5 | 80 concurrent tasks complete consistently in the documented service harness; nearest-rank p95 (76th sorted latency) <=2500 ms. |

NFR1: fixed attempts, validated delay (0..1000 ms), bounded linear waits, no global
serialization across keys. A port must settle its promise; an indefinitely hung
adapter is outside this slice, not a claimed deadline/cancellation guarantee.
NFR2: deterministic property seeds and injected wait/I/O, isolated ledgers, no
external network in tests. NFR3: no runtime dependency/schema/hash/GPU changes.
Dev-only fast-check 4.10.2 and coverage-v8 5.0.3 enable required PBT/coverage.

**Invariant:** success implies a matching confirmed persistence receipt. At-most-
one effect additionally requires the service to atomically bind key + canonical
payload + effect and replay its receipt. Client retry alone cannot prove exactly
once, survive server-ledger expiry or roll back a remote commit.

## Module-only AI plan (before implementation)

Tool: separate Codex planning agent, fork_turns=none, no filesystem/tools reads.
Only input: preset module types and parse/serialize/clone API descriptions;
VT-120 change request, partial-failure risk, PBT/mutation/80-task requirements.
No other students' source, tests, plans or reflections supplied.

Prompt: "Use ONLY this module context. Do not read files or browse. Produce an
implementation plan BEFORE code, assumptions, filenames, invariant, 3-5 ACs,
NFRs, property-based data strategy and missing-context risks. Existing
PresetDocument schemaVersion 2/app/name/config; parsePresetDocument validates
unknown keys/ranges and clones; serializePresetDocument gives canonical full
JSON. Retry temporary external failures without repeating effects. Persistence,
API/auth/integration details unknown. Never invent executed evidence."

Agent output: propose persistence-port.ts + save-preset.ts and tests/presets;
validate/canonicalize once, immutable payload and operation ID, atomic remote
dedupe, classified errors, attempt/time budgets, injected clock/wait/jitter;
require matching confirmation; response loss remains ambiguous until replay.
Suggested generated fault traces, keys, valid documents, concurrency schedules;
mutation returns success on failed write; 80-task p95. Assumptions: caller
retains key, persistence can atomically dedupe/replay, receipt identifies a
commit, tooling supports generated properties. No execution claimed.

Repository review and changes to plan:
1. tests/presets is NOT discovered by vitest.config.ts (unit/integration globs).
   Use tests/unit + tests/integration, and a separate vitest.vt120-load.config.ts.
2. architecture.md section 1 explicitly has no persistence/server/auth. Reject
   any assumed production HTTP/storage integration: provide a test-only service
   harness and a port, not a fabricated endpoint/account capability.
3. Keep one small persistence.ts instead of two new production modules. Full
   canonical serializer includes name/rendering/camera; configHash deliberately
   omits them (architecture section 5.1), so reject configHash as dedupe identity.
4. Do not claim a total deadline or safe abort for an injected port with no
   cancellation contract. Keep finite attempts/waits and explicitly exclude
   never-settling adapters. Timed-out writes can still commit remotely.
5. PBT/coverage are not existing capabilities on baseline. Add pinned dev-only
   tools, no runtime or stack upgrade. Load remains a separately invoked harness.

Missing-context risk: planning without the wider architecture could promise
durable exactly-once or add a network/auth boundary that the repository lacks.
Broader repository review revealed that gap. The agent's code/tests are not
evidence; actual RED/GREEN, mutation and load executions are required.

## Risk-based test strategy (original VT-120 data)

Unit: retry classification, confirmation, snapshots and policy. Integration:
coordinator + real Ajv serializer + test service ledger, including concurrent
different client instances. No HTTP API exists, so API/network E2E NOT_APPLICABLE;
no UI imports this slice, so a new browser/GPU E2E would not prove persistence.
Existing full verification is run separately when feasible.

| ID | Risk/AC | Level/input | Expected | Priority |
|---|---|---|---|---|
| T01 | false success AC4 | unit valid preset | matching receipt then confirmed | P0 |
| T02 | transient AC2 | unit fail before commit | retry same bytes/key | P0 |
| T03 | partial failure AC3 | integration commit/lose response | one effect, replay | P0 |
| T04 | mutation AC4 | unit all writes fail | reject, no confirmed state | P0 |
| T05 | permanent AC2 | unit permanent rejection | one attempt | P0 |
| T06 | boundary AC1 | unit invalid schema/key | zero writes | P0 |
| T07 | inconsistent content AC3 | integration conflicting key after loss | reject, no overwrite | P0 |
| T08 | false receipt AC4 | unit wrong key/payload | reject, no confirmation | P0 |
| T09 | concurrency AC1/3 | integration 12 calls/late input mutation | one write, stable snapshot | P0 |
| T10 | restart AC3 | integration two clients, lost response | service dedupes once | P0 |
| T11 | time AC2 | unit fake clock waits | bounded retries, no timers | P1 |
| T12 | invalid policy AC2 | unit 0/9/NaN attempts | constructor rejects | P1 |
| T13 | generated failures AC1-4 | PBT 200 seeded cases + shrinking | model oracle, <=1 effect | P0 |
| T14 | partial adapter failure AC4 | unit false receipt/wait failure | no false success | P0 |
| T15 | load AC5 | 80 concurrent operations | all confirmed, p95<=2500ms | P1 |

PBT data: fast-check records particleCount 1000..500000, speed integer
100..3000 divided by 1000 (schema precision), arbitrary names length 1..30,
fault arrays length 0..6 from before/after/ok/permanent, attempts 1..8.
Seed 23001821, 200 runs; fast-check reports seed/path and shrinks failures.
Expected success is computed from the first confirming/permanent fault and
attempt budget, independently from coordinator state. Ledger effect count is a
service-model oracle, not a remote-system guarantee. Fresh fixture per case.

# VT121 remaining risks and gates

- BLOCKED_NETWORK: GitHub/API names cannot resolve in this terminal. No HTTP401/403 obtained; auth UNVERIFIED. No credential reset, browser, privilege escalation, permission changes or unauthorized alternate publication.
- LATEST_DEV_NOT_VERIFIED: tested baseline is cached origin/dev 2389f0f550b33899801e1ab07c6312baea0c9faf. Supplied newer 8f7c3ee object unavailable. Must fetch/reconcile latest dev before any merge. v1 commits remain unchanged and are not merged into v2.
- HUMAN_REVIEW_PENDING: independent AI review is supplementary. Issue assignment cannot be verified/created while GitHub unreachable; no invented Closes issue. No merge/deploy/release/tag.
- CAPABILITY_ONLY: internal Symbol check has meaning only for session/harness method ownership, not account or server authorization. No API/auth layer was added.
- CONDITIONAL_RECOVERY: renderer applyConfig is synchronous at the port but may trigger asynchronous GPU side effects. Controller can recover full UI document and reapply prior config if callback accepts rollback; arbitrary engine/resource/async failures are not transactional. Rollback errors surface explicitly. Config-committed/reset-failed is a warning state with correct history, preserving existing contract, not a rejected import.
- TRANSPORT_SCOPE: intercepted Vite transforms execute actual source/fixtures with the same installed dependencies; no live TCP deployment guarantee. Local HMR connection is terminated in test transport, not filtered from pageerror. Matcher covers local WebSockets; narrow if the app later introduces its own WebSocket. Baseline-source substitution must be UNSET for GREEN/regression/performance.
- MEASUREMENT_SCOPE: Node200 sessions are one-event-loop synthetic work; browser integration uses a capped context pool, not200 simultaneous real users. End-to-end real200-user SLO remains NOT_VERIFIED even if measured p95 is below5s. FakeRenderer evidence is not GPU performance.
- COVERAGE_SCOPE: source-only percentages apply to importUndo.ts and presetFile.ts under supplementary Node tests, not parser/app/bindings or entire product. Passing risk tests and mutation provide different evidence; neither proves zero defects.
- DEFAULT_STACK: no dependency/framework/schema/engine changes. Any cached/dev drift or differing Node/Chromium/real GPU environment requires re-verification.

- MEASURED_BROWSER_QUEUE_TARGET_MISSED: final200-job/pool10 queue p95=13.347999s exceeds5s; service-only p95=.894348s does not erase queue delay. This measured scope is not real200-user capacity.

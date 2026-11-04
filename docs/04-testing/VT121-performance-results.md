> Raw output paths below identify historical archived files: [immutable evidence and SHA-256 manifest](VT121-evidence-archive.md). They are no longer tracked in the current tree.

> Historical design/execution narrative below refers to the pre-publication campaign; current publication status is recorded at the end.

## Performance measured after regression

Nearest-rank quantiles from monotonic timings, including queue delay. Node: five rounds ×200 Promise sessions,1000 warmup operations;506-byte preset; real v2 parser/deep snapshot/import+Undo/assertions. One event loop, NOT200 parallel users. CPU i5-12450HX,12 logical CPUs, total memory25,463,480,320 bytes; Windows10.0.26300/Node22.16.0. No concurrent verification campaign during final measurement.

| Workload | Duration ms | p50 ms | p95 ms | p99 ms | Throughput ops/s | Errors |
|---|---:|---:|---:|---:|---:|---:|
| Node 1 | 36.795 | 19.582 | 34.862 | 36.317 | 5435.55 | 0 |
| Node 2 | 36.450 | 17.344 | 35.047 | 36.072 | 5486.91 | 0 |
| Node 3 | 37.912 | 18.288 | 36.323 | 37.540 | 5275.33 | 0 |
| Node 4 | 34.418 | 18.461 | 33.131 | 33.915 | 5810.86 | 0 |
| Node 5 | 34.446 | 16.557 | 32.678 | 33.718 | 5806.16 | 0 |
| Browser pool10 | 13783.473 | 7310.059 | 13347.999 | 13725.025 | 14.51 | 0 |

Node synthetic p95 range32.678–36.323ms is below numerical5000ms target in that scope only. Browser:200 submitted UI import/Undo jobs, max10 active contexts, one round,10 warmups, actual UI/FakeRenderer over intercepted Vite. Queue-inclusive p95=13.347999s **EXCEEDS5.0s** in this capped harness. Service-only p95=894.348ms was derived separately from raw service samples and does not replace queue latency. Browser test exit0 means200 jobs completed without functional errors, NOT that latency SLO passed.200 simultaneous real-browser contexts were NOT_RUN; real200-user end-to-end SLO remains NOT_VERIFIED. No HTTP/GPU capacity conclusion.

Raw final logs: output/VT121-final/logs/09-performance-isolated.log; output/VT121-final/logs/09-browser-performance-fixed.log. Exploratory09-performance.log ran while regression was active, not the final isolated measurement. Initial09-browser-performance.log failed CLI parsing because an unquoted @ token was treated specially by PowerShell; no workload ran in that attempt. Correctly quoted command in the fixed log then executed the200 jobs. Failed logs remain intact.

## Publication verification — 02/11/2026

VERIFIED: [PR #81](https://github.com/DangTAnh/SE2026.11.1.3D-WEB-05/pull/81) OPEN, isDraft=true, base=dev, published HEAD 247781de4c90df52f54a6e0327e3dfaf7931a0d0. Fetch succeeded; merge-base with current origin/dev is 8f7c3eeb74c7a9501332b265fa16a6aa552aa2b3. Dev synchronization completed in merge commit 247781de4c90df52f54a6e0327e3dfaf7931a0d0. No rebase/force-push/merge of PR.

VERIFIED historical post-publication execution at that merge: 336 unit/integration PASS; 84 E2E PASS, 12 capability SKIP; 8 focused Undo PASS retries=0; typechecks/build PASS. Commands and exit0 are preserved in external handoff output/VT121-final/logs/publication-result.json and publication-original.log. These are not new executions in finalization.

VERIFIED CI on published merge: CI verify SUCCESS [run 41412349557](https://github.com/DangTAnh/SE2026.11.1.3D-WEB-05/actions/runs/41412349557); CodeQL SUCCESS. Finalization HEAD checks must be read separately from external VT121-pr-ci-status.md; do not transfer this PASS to a later SHA. Human review PENDING: reviews=[], reviewRequests=[] at API inspection. New finalization verification is logged separately. Overall REVIEW_PENDING; real-user SLO NOT_VERIFIED.

# Release evidence follow-up — 25/11/2026

Refs #59, PR #113 and the review on #70. This checkpoint preserves the October
measurements and the 20/11 proposed order interpretation as dated history; it
does not change `mvp-acceptance.md` or invent an acceptance-owner waiver.

## Revisions and scope

- Runtime baseline: integrated `dev@2b306ad5f3f063648df4752d431dc15b9943227c`,
  including #114/#103 and #115/#97.
- Measured revision: `d22de971f8d058d1a020b3558f9467696078a974` on the Issue #59
  branch. Its source, tests, lockfile and workflows are identical to that dev
  baseline; its additional changes are documentation.
- The separate favicon fix #117 adds `public/favicon.ico` and an explicit relative
  icon link in index.html for the GitHub Pages project path. The first successful
  icon-only working tree was later committed as `729f8a1`; final head `004f7a9`
  includes both delivery changes. No renderer or test assertion was modified.
- Pinned Playwright Chromium 156.0.8078.4, headed, Windows 11 build26300,
  physical AMD Radeon(TM) Graphics / WebGPU amd/rdna-2. AMD driver31.0.21024.2004
  was read from Win32_VideoController, not inferred from a browser string.

## Benchmark order: new evidence, unchanged criterion

The 20/11 statement that counterbalancing was outside MVP acceptance is
withdrawn. The proposed criterion still says to alternate WebGPU and WebGL2 on
the same machine. The old single-order results do not establish that condition.

Two fresh pairs now record both execution orders on the same host/build:

| Pair | Execution order | Actual samples | FPS medians, WebGL2 / WebGPU | GPU medians, WebGL2 / WebGPU |
|---|---|---|---|---|
| [AB](../06-benchmark/2026-11-25-amd-radeon-chromium-order-ab.md) | WebGL2 then WebGPU | 100 +100 | 59.9101 /59.9161 | 0.11836 /0.131072 ms |
| [BA](../06-benchmark/2026-11-25-amd-radeon-chromium-order-ba.md) | WebGPU then WebGL2 | 100 +100 | 59.9042 /59.9161 | 0.10514 /0.131072 ms |

Each backend gets a new canvas/adapter, explicit reset and the existing
BENCHMARK_PROTOCOL:3s warm-up,100ms cadence,100 samples,10s declared duration,
median. Both pairs use default v2/65536 particles and hash
`0f917cd0a56e3d7b63f53c7f1e7bb5f2cdfb70d6191454733baf204f0fc907fa`.
Only backendPreference changes to force the requested path; workload, appearance,
camera and800x600/DPR1 target otherwise match. Every sample records the actual
backend and the same hash. No sample is pooled across pairs or historical builds.

This is one paired campaign covering both orders, not a statistical performance
advantage claim. FPS is refresh-bound near60; device/driver/general throughput
conclusions are not established. Acceptance owners must review the new evidence;
its presence does not itself approve or deploy the release.

The two Markdown results are byte-for-byte output of the existing
buildBenchmarkResult/toMarkdown path. [Raw400 samples and environment](../06-benchmark/evidence/2026-11-25-orders/samples.json)
and the [exact capture source](../06-benchmark/evidence/2026-11-25-orders/capture-source.txt)
are preserved. The latter is the one-off execution record, not a replacement
repository harness. Its local import/cwd paths name E:/CNPM and its metadata
input names system.json; regenerate OS/driver metadata when replaying elsewhere.

## Headed GPU checks and the favicon failure

On d22de97, this unmodified command initially produced **5 PASS /9 FAIL**,
retries0, one worker:

```sh
npx playwright test tests/e2e/simulation-parity.spec.ts tests/e2e/gpu-timing-freshness.spec.ts tests/e2e/count-rebuild.spec.ts --project=desktop-chromium --headed --retries=0 --workers=1
```

All nine count cases reached their unchanged final console assertion, which
reported a404 resource error. A separate console/location probe identified
`/favicon.ico`; the runtime and fixtures had no favicon. No GPU assertion failed
in that run. This is not relabelled as a passing suite or a #103 regression.

Issue #116 / PR #117 supplies a valid static icon. The same command on that
asset-only working tree then produced **14 PASS /0 SKIP /0 FAIL in24.4s**, with
zero retries/flaky results. Console assertions, GPU readback checks, tolerances
and timeouts are unchanged. [Machine-readable before/after summary](../06-benchmark/evidence/2026-11-25-orders/hardware-summary.json).

The successful run includes:

- Count increase/decrease and mode round-trip through real adapters, plus the
  normal production UI and preset-import count paths. Both actual WebGL2 and
  WebGPU were exercised where the matrix selects them.
- Real kernel readback parity:15 WebGL2 cases and2 WebGPU cases PASS. Maximum
  position delta in this matrix was2.3842e-6 on WebGL2 and8.3447e-7 on WebGPU.
  Existing corrupt-readback and invalid-parameter rejection also PASS.
- Both real query-pool read-error tests PASS: timing becomes unavailable/null
  under the injected error and recovers on the same backend. These are injected
  timestamp errors, not physical GPU device-loss experiments.

The initial failed log/trace and complete final JSON remain in the external
release-20261125 evidence workspace. The committed summary retains every test
status/error and the parity subcase results. The missing-browser launch attempt
was resolved by installing the pinned Chromium; no installed-Chrome override or
dependency upgrade was used.

The icon-only version still allowed an implicit `/favicon.ico` request at the
domain root when the app was served below its GitHub Pages project path. A local
production-build subpath smoke reproduced that404. Final #117 head `004f7a9`
adds `href="./favicon.ico"`, matching the existing relative Vite base. The same
subpath smoke then requested the icon below the project prefix, returned200 and
reported no console errors. The GPU was intentionally unavailable in that
static-delivery smoke; it is not a live-URL/deployment or rendering acceptance.
[Before/after subpath record](../06-benchmark/evidence/2026-11-25-orders/favicon-project-path.json).

All14 headed GPU tests were rerun on final `004f7a9`: **14 PASS /0 SKIP /0 FAIL
in23.9s**, no retries. The machine-readable summary preserves the initial failure,
first icon-only pass and final relative-link pass separately.

## Local verification and remaining gates

- npm ci, both typechecks, production build and416 unit/integration tests PASS
  on the resolved docs tree; existing chunk advisory remains.
- Fresh25/11 audit: production dependency tree0 known advisories; full tree1
  moderate Vite advisory. This is a dated dependency snapshot, not a security
  guarantee. [Audit details](release-dependency-audit-2026-11-20.md).
- Final pushed-head CI and independent human review are still required for both
  #113 and #117. The asset-dependent14/14 result is not asserted for an unmerged
  release tree that still lacks the icon.
- Physical GPU device-loss/recovery, other GPUs/drivers, physical-phone testing,
  deployment/live-URL smoke and full MVP acceptance remain separate. No release
  merge, deployment, milestone tag or protection change is made here.

For a replay, copy the capture source to a distinct untracked directory as
benchmark-orders.mjs before checking out the measured revision. Prepare a fresh
system.json with Win32_OperatingSystem (Caption/Version/BuildNumber) and
Win32_VideoController (Name/DriverVersion), install the committed lockfile and
pinned Chromium, and serve the checkout on127.0.0.1:4187. Run the capture script
with its paths adjusted to that checkout. Keep generated outputs separate from
these committed artifacts; compare both full configs, protocol, actual backends,
environment and order before interpreting results. The standard repository
benchmark evidence test remains its fixed-order harness.

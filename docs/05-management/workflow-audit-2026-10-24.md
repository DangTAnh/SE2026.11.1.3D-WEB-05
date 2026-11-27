# Workflow and progress checkpoint — 24 October 2026

Issue: [#36](https://github.com/DangTAnh/SE2026.11.1.3D-WEB-05/issues/36).
Owner: duyanhtr130905 (TV4). Source baseline: `dev@888626a3f47c21c3105e6d9e96ff12eef81a4c26`.
This checkpoint applies the team procedure supplied on this date. The original
announcement's claim about a running orbit/WebGPU/WebGL2 demo is historical;
it is not runtime evidence for the current integrated repository.

**Later same-day update:** #38 merged into `dev@de6665a`, adding the composition
root and a collector test change. Production still reports unavailable until
adapter #12 is integrated. PRs #39 (adapter) and #40 (WebGL2 fallback) are
review candidates, not accepted runtime evidence. Issue #37 stays open until
the collector test change has been checked for deterministic behavior. The
tables below retain their explicit earlier `888626a` baseline.

## Branch corrections

GitHub's branch rename operation was used. Before/after remote branch reads
confirmed **the exact same head SHA** for each pair, with the old name removed.
No commit was rewritten and no protected/default branch was renamed.

| Old name | New name | Issue / merged PR | Preserved SHA |
|---|---|---|---|
| `codex/tv4-9-ui-renderer-port` | `feat/9-ui-renderer-port` | #9 / #32 | `ed914c0b5831e4e4cb67058aee014662bb9df684` |
| `codex/tv4-into-develop` | `feat/4-ui-presets-integration` | #4 / #1 | `02cb8ca2f38c2103c40ee14529b7583afffee1b0` |
| `feat/tv4-week1-ui-ux` | `feat/4-ui-presets-preintegration` | #4 / historical source for #1 | `11eedfd6449642ac53fe19a63a24b2669b6d7389` |
| `feat/tv1-architecture-srs` | `feat/5-architecture-srs` | #5 / #20 | `0504e5865bada0a4655a8a9438b2a196d6b537fe` |

`feat/14-ui-live-status` already follows the rule and targets `dev` in #33.
The existing `ci/26-...`, `docs/2-...` and numbered `feat/...` branches are
Issue-scoped; they do not need cosmetic renaming. `main` and `dev` retain their
names and protections. No open PR has one of the four renamed branches as its
head or base in the audited snapshot.

The pre-integration source branch is historical and has a different history;
renaming it does not make it a new branch from current `dev`. The integration
PR #1 records the cherry-pick reconciliation. Keep that audit trail. Closed
PR text and dated reports may still contain old names; use this mapping rather
than rewriting the old evidence as if the new names had always existed.

### Update a local clone

GitHub does not rename local branches automatically. Save any local changes,
then substitute one verified old/new pair from the table:

```sh
git branch -m OLD_NAME NEW_NAME
git fetch origin
git branch --set-upstream-to=origin/NEW_NAME NEW_NAME
```

For a single-branch clone, add that branch's fetch refspec first:

```sh
git remote set-branches --add origin NEW_NAME
git fetch origin
```

Do not recreate/push an old name or delete another member's work to make a
local checkout match. The delivery checkout's existing Issue #9 local branch
has been renamed and its tracking updated; unrelated local clones are untouched.

## Repository progress

| Area | Verified repository evidence | Remaining acceptance |
|---|---|---|
| Core / architecture / CI | #20, #24 merged; port/types/measurement and fake port present | Actual adapter/composition integration |
| Simulation | #21 CPU reference and #35 shared TSL buffers + both kernels merged into dev | GPU execution/readback parity NOT_RUN; zero-delta damping finding from #23 remains in current source |
| Backend probe | #29 merged | #12 adapter and #13 forced WebGL2/fallback/timing |
| UI controls / README | #32 merged; #9/#25 closed | Real port injection from #15 |
| UI live status | #33 draft into dev; test-driven status/error/recovery and metric clearing | #12/#15 + real browser evidence before #14 accepted |
| Preset v2 | Schema proposal #3 merged; runtime still v1 | #16 waits for hash scope and Vortex parameter/default decisions |
| Measurement | #31 collector merged | #18 two-backend benchmark after #12/#13; no fair benchmark result |
| Release | #34 draft `dev` → `main`; Pages workflow is on dev | No release/deployment or milestone tag performed by this work |

#22/#23 remain open with older stacked bases/heads, although #35 brought the
combined kernel code into dev. Do not merge them merely to clear the queue:
the maintainers need to reconcile their duplicate scope and outstanding
reviews. The #23 review at `d835463` reports `delta = 0` damping velocities
while CPU `step()` is a no-op. The same formulas are present in `888626a`.
This is source-level evidence, not a numeric GPU run.

The initial #33 verification after integrating current dev found an intermittent
collector test failure: expected 2 samples, received 20. The focused suite and
the subsequent full run passed. [#37](https://github.com/DangTAnh/SE2026.11.1.3D-WEB-05/issues/37)
tracks a deterministic test-only repair; do not hide the failed attempt.

Verification after integrating dev into #33: `npm ci`, then a full
`CI=1 npm run verify` passed with **114 unit tests and 30 desktop/mobile E2E**,
source/test typechecks and build. #36 changes documentation/templates only:
`npm run typecheck`, `npm run build` and `git diff --check` passed. Independent
read-only documentation review reported no blockers; that reviewer did not run
tests. These are local checks, not the required human GitHub approval.

## TV4 next actions

1. Keep #33 current with dev, include G0/test evidence and reproduction, request
   TV1 review and keep draft until #12/#15 runtime dependencies are fulfilled.
2. Submit the missing workflow/agent instructions and PR template under #36,
   on `docs/36-team-workflow` from current dev, for another person's review.
3. For #16, obtain TV1's exact v2 hash field set and TV2/TV3's Vortex mapping.
   Then branch `feat/16-preset-v2` from latest dev, implement config/validator/
   serializer/examples/tests together, and request the contract owners' review.
   Do not invent those decisions or add the deferred v2 UI controls here.

No percentages of total project completion or accepted GPU requirements are
inferred from merged PRs or green UI tests.

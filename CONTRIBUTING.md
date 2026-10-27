# Team workflow

Every change follows **Issue → one assignee → branch from latest dev → small
commits → G0 → PR into dev → another person's review → merge**.
This records the team's working procedure supplied on 24 October 2026.

## Before coding

1. Read this file, [AGENTS.md](AGENTS.md), the Issue and its dependencies.
2. Check [project status](docs/PROJECT_STATUS.md),
   [architecture](docs/architecture.md) and
   [ownership](docs/05-management/team-ownership.md).
3. Create or claim an Issue with **exactly one assignee**. Record scope,
   acceptance criteria, dependencies and verification steps. Resolve shared
   contract decisions with their owners before changing consumers.
4. Start from the current remote `dev`, with a clean working tree:

```sh
git fetch origin dev
git switch --no-track -c feat/42-short-description origin/dev
```

Replace `42` with the real Issue number. Names follow
`type/<issue-number>-short-description`, using lowercase words separated by
hyphens. Use `feat/`, `fix/`, `docs/` or `chore/` as appropriate. Existing
issue-scoped `ci/` and `test/` branches follow the same number/slug structure.
Do not use personal names, `tv4-...` or `codex/...` instead of the Issue number.

If `dev` moves during the work, fetch it and merge `origin/dev` into the feature
branch, resolve conflicts and rerun checks. New work starts from `dev`; do not
open new stacked PRs against another feature branch.

## Issue templates and review routing

Open new work from **Issues → New issue** and pick `Task`, `Bug` or `Decision`.
`Task` asks for scope, acceptance criteria, dependencies and evidence; `Bug`
asks for reproduction, expected/actual results, acceptance criteria,
dependencies and evidence; `Decision` asks for the question, context, options,
owner, consequences and evidence. Assign exactly one person. `.github/CODEOWNERS` routes the affected
module owner for review, but the PR still needs at least one other person's
approval before merge.

## Local setup and G0

Use Node >= 22.16 and the committed npm lockfile:

```sh
npm ci
npx playwright install chromium
npm run dev
```

For **every push**, both G0 commands must pass on the content being pushed:

```sh
npm run typecheck
npm run build
```

Run tests appropriate to the change. `npm run verify` additionally runs source
and test typechecks, unit/contract tests, Chromium desktop/mobile E2E and build.
Record failures, retries and limitations; do not describe an unrun check as
passed. `?webgl=1` must be checked after a real adapter/composition root exists;
the current no-port UI and test harness do not prove GPU fallback.

## Commits and pull requests

- Write small English Conventional Commits, for example
  `feat(ui): display renderer status` or `fix(test): control collector clock`.
  One commit represents one coherent change. A merge commit used to bring
  `dev` into a feature branch preserves integration history.
- Never commit or push directly to `main` or `dev`, including documentation.
  Never force-push to either branch. Do not rewrite published history to make
  earlier workflow mistakes disappear.
- Do not commit `node_modules/`, `dist/`, credentials, temporary logs or drafts.
  Check `git status` and the staged diff before committing.
- Push the Issue branch explicitly, then open a PR **into `dev`**, using the
  [PR template](.github/pull_request_template.md).
- Include `Closes #<issue-number>`, the behavior changed, actual evidence
  (command/results and/or screenshots), and steps another person can repeat.
  A dependency-blocked candidate stays draft, with incomplete acceptance
  criteria stated. A closing keyword expresses intended closure on eventual
  merge; it does not mean the Issue has already passed acceptance.
- Request the relevant owner and at least one reviewer other than the author.
  Require **at least one approval by another person** before merge. Automated
  checks or an AI review do not replace the team's human approval.
- Resolve requested changes and rerun checks on the final revision. Do not
  self-approve or merge your own unreviewed PR. Mark a draft ready only after
  its dependencies and acceptance gates are satisfied.

## Reviewer checklist

- Issue exists, has exactly one assignee and matches the scope and branch.
- Feature PR targets `dev`; behavior matches acceptance criteria.
- G0 is green; tests, evidence and reproduction match the current revision.
- Shared types/schema/measurement changes have their owners' review.
- Errors, unavailable paths, lifecycle/dispose and regressions are covered.
- Requested backend is distinguished from actual; missing GPU timing is
  `null` with a reason, and fake-port tests are labelled as such.
- No generated dependencies/build output, secrets or unrelated changes.
- Dependencies, remaining risks and release implications are explicit.

## Milestones and releases

At a milestone, open a separate release PR **from `dev` into `main`**. Obtain
another person's approval and the milestone's runtime/acceptance evidence.
After that PR merges, the release owner tags the merged release commit with
the agreed milestone tag (`m2`, `m3`, ...). `main` is for releases; no direct
commits or pushes. Do not infer release acceptance from a green build.

The [branch audit](docs/05-management/workflow-audit-2026-10-24.md) records legacy
renames and local-clone update instructions. It preserves historical facts;
renaming a branch does not retroactively change its original base or reviews.

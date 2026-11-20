# Release dependency audit — 20/11/2026

TV5 triage for the release review question on PR #70: the final release CI log
showed `npm ci` reporting 6 high-severity advisories. This records what the
advisory database actually reports at the current release head, and separates
runtime from build-time dependencies.

## Commands and results

Run at `dev@cbce7c4` with the committed lockfile (`npm ci` first):

```sh
npm audit --json            # full tree, including devDependencies
npm audit --omit=dev --json # runtime dependencies only
npm ls vite                 # which entries pull the dev-only advisory
```

| Scope | Result |
|---|---|
| `npm audit --omit=dev` | **0 vulnerabilities** (info 0, low 0, moderate 0, high 0, critical 0) |
| `npm audit` (full tree) | **1 moderate** — `vite@6.4.4`, `Vite: server.fs.deny bypassed with queries` |

- Runtime dependencies are `ajv` and `three`; both are clean in this audit.
- `vite` is a devDependency (also reached through `vitest` → `@vitest/mocker`).
  The advisory concerns the Vite dev/preview server's `server.fs.deny`, which is
  never part of the built `dist` bundle served by GitHub Pages.
- The 6 high-severity entries in the 18/11 CI log came from the advisory snapshot
  at that time (transitive dev entries); the current database reports none of
  them as high. Advisories move in both directions, so the merge-head CI run is
  the authoritative record, not this document.

## Triage decision

- No runtime-exploitable advisory is present; the site is a static build with no
  server process.
- The remaining moderate advisory is dev-server-only, so it is recorded rather
  than force-upgraded: the repository instructions forbid incidental stack
  upgrades, and `vite` is pinned by the lockfile used for every CI run.
- Re-check at the merge head:
  `npm ci && npm audit --omit=dev && npm audit`.

## Limits

This is a dependency-database check, not a penetration test or a claim that the
application is free of exploitable defects. Physical-GPU and deployment checks
remain separate release gates.
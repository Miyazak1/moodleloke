# Clean checkout verification

## Accepted baseline

- Version: `0.1.0-alpha.1`
- Commit: `b362288`
- Tag: `v0.1.0-alpha.1`
- Verification date: 2026-09-17
- Platform: Windows, Node.js 22 / npm 10 contract

## Method

The repository was cloned with `git clone --no-hardlinks` into a new temporary directory. The verification did not reuse source-workspace or target-workspace `node_modules`, build output, `.local` state, database dumps, or Git metadata.

The following installation path completed from committed lockfiles:

`npm ci`

`npm ci --prefix backend`

`npm ci --prefix frontend`

The clean clone then passed:

`npm run ci:contracts`

This includes frontend and backend builds, Prisma Client generation, Agent runtime tests, standalone shell contracts, Teaching Asset Registry, Authoring boundary, CI contract, data migration and preflight policy tests, reachability and product-boundary audits, Prisma retention, environment inventory, and the release baseline gate.

## Supply-chain observation

The installation audit reported 10 backend dependency findings (4 moderate, 6 high) and 8 frontend dependency findings (2 low, 2 moderate, 4 high) at verification time. These counts are registry observations rather than proof of runtime exploitability. No automatic `npm audit fix` was applied because it may change locked major versions or runtime behavior.

Before a public or production release, classify each finding by reachable production path, patch non-breaking items, explicitly document accepted exceptions with expiry, and rerun this clean-checkout gate.

## Scope limit

This gate proves repository and lockfile reproducibility for the core contract suite. Browser golden paths, live providers, production credentials, and real-data migration remain separate gates.

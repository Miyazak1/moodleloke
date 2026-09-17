# Release baseline 0.1.0-alpha.1

This prerelease establishes the first independently buildable Moodlelike Agent repository baseline.

## Included

- standalone student Agent and independent Authoring entry;
- Teaching Asset Registry;
- Agent runtime, question supply, assessment, learning evidence and recovery services;
- isolated PostgreSQL/Redis defaults;
- contract CI and three browser golden paths;
- Prisma retention matrix, safe migration/rollback tooling, disposable migration rehearsal and read-only data preflight;
- environment inventory, secret hygiene gate and source provenance.

## Required release gates

`npm run ci:contracts`

`npm run ci:golden`

`npm run data:rehearsal:apply`

Real data migration additionally requires an explicitly authorized source preflight and the checklist in `DATA_CUTOVER_CHECKLIST.md`.

## Known compatibility debt

- runtime environment names and internal CSCA domain types retain legacy prefixes;
- Prisma initially copies all 147 models; archive candidates are not deleted;
- root operational scripts still include retained question-production and migration utilities and require a later allowlist cleanup;
- this prerelease is private and carries no open-source grant.

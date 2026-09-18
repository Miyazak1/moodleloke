# Release baseline 0.1.0-alpha.3

This prerelease establishes the first independently buildable Moodlelike Agent repository baseline.

## Included

- standalone student Agent and independent Authoring entry;
- Teaching Asset Registry;
- Agent runtime, question supply, assessment, learning evidence and recovery services;
- isolated PostgreSQL/Redis defaults;
- contract CI and three browser golden paths;
- Prisma retention matrix, safe migration/rollback tooling, disposable migration rehearsal and read-only data preflight;
- environment inventory, secret hygiene gate and source provenance.
- zero-known-vulnerability backend/frontend lockfiles at the Phase 4B audit point and a high/critical CI dependency gate.
- one-command Windows local delivery with isolated PostgreSQL/Redis defaults, idempotent demo seeding, runtime verification and an acceptance workflow.
- standalone repository ownership contract that rejects extraction tooling and active references to the former workspace path.
- live Agent, attachment and teaching browser checks aligned with the standalone 5190/3100 local-delivery contract.
- classified root command surface with file/reference integrity, bounded growth and duplicate-command governance.
- compatibility-operation registry that blocks the former release/Docker/staging chain by default and separates controlled data writes from retained validation.
- archived-operations boundary that removes the unreachable former implementations while retaining non-bypassable command-name sentinels and explicit warnings on historical runbooks.
- canonical `MOODLELIKE_ENV` platform selector with production-safe `CSC_ENV` fallback and a static migration contract across local and deployment entry points.
- Moodlelike-owned deployment, storage-volume and session-Cookie defaults with an explicit no-implicit-data-migration boundary.
- Moodlelike-visible browser identity with one-way migration of legacy authentication, locale and Agent preference storage keys.
- zero-Provider real-browser acceptance for independent demo login, live local learning-data reads and browser-identity migration.

## Required release gates

`npm run ci:contracts`

`npm run security:audit-dependencies`

`npm run ci:golden`

`npm run data:rehearsal:apply`

Real data migration additionally requires an explicitly authorized source preflight and the checklist in `DATA_CUTOVER_CHECKLIST.md`.

## Known compatibility debt

- internal CSCA domain flags and types retain legacy prefixes; the platform environment selector has migrated to `MOODLELIKE_ENV` while `CSC_ENV` remains a deprecated safety fallback;
- Prisma initially copies all 147 models; archive candidates are not deleted;
- root operational scripts still include retained question-production, validation and controlled migration utilities; further cleanup must follow the governed command inventory and data-authorization boundary;
- this prerelease is private and carries no open-source grant.

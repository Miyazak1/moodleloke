# Compatibility operations

## Status

The standalone repository retains a limited set of commands inherited from the former platform because some provide useful database safeguards, security checks, concurrency tests or question-production verification. They are not all supported Moodlelike production operations.

`npm run audit:compatibility-operations` reads the governed command surface, classifies every retained compatibility entry and writes the deterministic inventory at `artifacts/compatibility-operations.json`.

## Blocked legacy release chain

Fourteen command names remain as safety sentinels because old runbooks may still mention them. They no longer execute their former implementation. Invoking one exits with an explanation instead of starting an old Docker stack, contacting an old port, using a CSCALite placeholder dump or running the former release pipeline.

There is deliberately no environment-variable bypass. Restoring one requires a reviewed implementation based on Moodlelike Compose identity, ports, health identity, credentials, evidence paths and rollback contracts.

Use these supported replacements:

- local runtime and authenticated verification: `npm run local:start` and `npm run local:verify`;
- complete local acceptance: `npm run local:acceptance`;
- deterministic core and browser gates: `npm run ci:contracts` and `npm run ci:golden`;
- dependency security: `npm run security:audit-dependencies`;
- data migration and rollback: only the commands and approvals documented in `DATA_CUTOVER_CHECKLIST.md`.

## Controlled data writes

Administrator bootstrap, security cleanup, migrations, restore, legacy seed and school import commands can modify data. Their presence is not authorization to execute them. Use only against an explicitly selected local, disposable or separately approved target after inspecting the command-specific safeguards and taking a recoverable backup when applicable.

The Moodlelike local workflow uses `db:migrate` internally against its isolated local database. Real-data access and cutover remain separately authorized operations.

## Historical runbooks

Documents describing CSCALite Docker, staging and release procedures are retained as historical evidence. They are not current Moodlelike instructions. Current entry points are `LOCAL_DELIVERY.md`, `LIVE_GOLDEN_PATH.md`, `REPOSITORY_OWNERSHIP.md` and this document.

The unreachable implementations behind the blocked chain have been removed, while the 14 command-name sentinels remain to fail safely when old instructions are followed. `docs/ARCHIVED_CSCA_OPERATIONS.md` records the retirement boundary and the deleted implementation paths. The compatibility audit rejects restoration of those files or removal of archive warnings from the generic-looking historical runbooks.

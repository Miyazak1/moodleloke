# Archived CSCAlite operations

## Purpose

Moodlelike retains historical CSCAlite operations material as migration evidence, not as an executable product surface. Historical documents can explain why compatibility names exist, but they do not define current deployment, release or data-operation procedures.

## Executable boundary

Fourteen former release, staging and Docker command names remain in `package.json` as safety sentinels. Every sentinel delegates only to `scripts/blocked-compatibility-operation.cjs` and exits without running the former implementation. There is no environment-variable bypass.

The unreachable implementations behind that chain were removed after a reverse-reference audit:

- `scripts/db-backup-docker.cjs`
- `scripts/verify-staging.cjs`
- `scripts/verify-docker-status.cjs`
- `scripts/verify-docker-staging-local.cjs`
- `scripts/verify-docker.cjs`
- `scripts/verify-release-window-local.cjs`
- `scripts/launch-smoke.cjs`
- `scripts/verify-release.cjs`
- `scripts/ops-smoke.cjs`
- `scripts/smoke-check.cjs`

Do not recreate or call these paths from current code. A future deployment implementation must be designed for Moodlelike identity, isolated ports, current health contracts, credentials, evidence paths and rollback policy, then introduced under reviewed current command names.

## Current entry points

- Local installation, startup and verification: [`../LOCAL_DELIVERY.md`](../LOCAL_DELIVERY.md)
- Live Agent and teaching checks: [`../LIVE_GOLDEN_PATH.md`](../LIVE_GOLDEN_PATH.md)
- Deterministic contract gate: `npm run ci:contracts`
- Browser golden paths: `npm run ci:golden`
- Compatibility classification and safeguards: [`../COMPATIBILITY_OPERATIONS.md`](../COMPATIBILITY_OPERATIONS.md)
- Explicitly authorized data cutover: [`../DATA_CUTOVER_CHECKLIST.md`](../DATA_CUTOVER_CHECKLIST.md)

## Historical documents

`ops-runbook.md`, `backup-restore.md` and dated handoff/triage records may mention retired commands, ports, Compose identities and CSCALite paths. Those references are preserved as historical facts. They must carry or inherit this archive boundary and must not be copied into active Moodlelike instructions.

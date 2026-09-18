# CSCAlite Backup And Restore

> **Archived compatibility document.** This file records the former CSCAlite backup and restore procedure. It is not a Moodlelike production runbook and does not authorize any data operation. The old Docker backup entry is intentionally blocked. For current local delivery use [`../LOCAL_DELIVERY.md`](../LOCAL_DELIVERY.md); for any real-data migration or rollback use [`../DATA_CUTOVER_CHECKLIST.md`](../DATA_CUTOVER_CHECKLIST.md) only after explicit target authorization. See [`ARCHIVED_CSCA_OPERATIONS.md`](ARCHIVED_CSCA_OPERATIONS.md).

## Backup

Create a dry-run first:

```bash
npm run db:backup -- --dry-run
```

Create a dump:

```bash
npm run db:backup
```

Backups are written to `BACKUP_DIR`, defaulting to `.tmp/backups/`. The directory is ignored by git.

On Windows hosts without local PostgreSQL client tools, create the dump from the local Docker staging database instead:

```bash
npm run db:backup:docker
```

By default this reads from `cscalite-verify-db-1`, which is the `db` service in the local staging compose stack. Override `DOCKER_BACKUP_CONTAINER` only for another CSCAlite staging/restore container, not unrelated projects.

Keep at least the latest pre-release backup until the next successful release window. Store production backups outside the public web root and outside the application container writable layer.

## Restore

Always dry-run before a restore:

```bash
npm run db:restore -- .tmp/backups/cscalite-example.dump --dry-run
```

Run a real restore only with explicit consent in the command environment:

```bash
ALLOW_DB_RESTORE=1 npm run db:restore -- .tmp/backups/cscalite-example.dump
```

On Windows PowerShell:

```powershell
$env:ALLOW_DB_RESTORE="1"; npm run db:restore -- .tmp/backups/cscalite-example.dump
```

Restore uses `pg_restore --clean --if-exists`, so it can remove objects in the target database. Confirm the printed host and database name before continuing.

The restore script refuses obvious production targets by default. Normal restore drills should point to a database whose host or database name contains `test`, `restore`, `staging`, `stage`, `dev`, `local`, or `demo`.

For an emergency production restore only, set all three values for that single command environment:

```bash
ALLOW_DB_RESTORE=1 ALLOW_PRODUCTION_DB_RESTORE=1 CONFIRM_RESTORE_DATABASE=cscalite npm run db:restore -- .tmp/backups/cscalite-real-backup.dump
```

Do not keep `ALLOW_PRODUCTION_DB_RESTORE` set in a permanent production environment.

## Restore Smoke

Restore smoke proves a backup can be restored into a non-production database:

```bash
npm run db:restore:smoke -- .tmp/backups/cscalite-example.dump --dry-run
```

For a real restore smoke, set `RESTORE_TEST_DATABASE_URL` to a database whose name contains `test`, `restore`, or `staging`, then run:

```bash
npm run db:restore:smoke -- .tmp/backups/cscalite-example.dump
```

If `RESTORE_TEST_DATABASE_URL` is not set and Docker is available, the script starts a temporary Postgres container, restores into it, checks migration status, verifies key tables, prints row counts for users, schools, content, audit logs, and refresh sessions, performs a sample read from each table, and destroys the container. It refuses to use `DATABASE_URL` directly.

## Release Restore Drill

Before a production release window, run a restore drill with a real backup file. The placeholder dump is not accepted:

```bash
npm run verify:backup-restore-drill -- .tmp/backups/cscalite-real-backup.dump
```

To force the drill to use a temporary Docker Postgres database even when `RESTORE_TEST_DATABASE_URL` is set, use:

```bash
npm run verify:backup-restore-drill -- .tmp/backups/cscalite-real-backup.dump --docker
```

For a non-destructive evidence pass, use:

```bash
npm run verify:backup-restore-drill -- .tmp/backups/cscalite-real-backup.dump --dry-run
```

The drill writes a sanitized evidence file to `.tmp/release-evidence/` and records the backup size plus restore target host/database. Dry-run is useful for release preparation, but it does not replace a real restore into `RESTORE_TEST_DATABASE_URL` or temporary Docker Postgres before a production cutover.

For the local Docker release rehearsal, run:

```bash
npm run verify:release-window:local
```

This creates a Docker-based backup and restores it into a temporary Docker Postgres database, so it does not require `pg_dump` or `pg_restore` on the Windows host.

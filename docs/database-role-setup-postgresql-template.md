# PostgreSQL Role Setup Template

This template is an operator guide for creating least-privilege PostgreSQL roles for CSCAlite. Run it only against the intended staging or production PostgreSQL cluster, and adapt role names, database names, and password management to the hosting provider.

Do not commit real passwords. Prefer provider-managed secrets or a deployment secret manager.

## Target Roles

- `cscalite_app`: runtime role used by the backend `DATABASE_URL`.
- `cscalite_migrator`: migration role used only by Prisma migrate/deploy jobs.
- `cscalite_backup`: backup/export role used only by backup automation.
- Provider admin or `postgres`: emergency administration only.

## One-Time Role Creation

Run as a database owner or provider admin:

```sql
CREATE ROLE cscalite_app LOGIN PASSWORD 'REPLACE_IN_SECRET_MANAGER';
CREATE ROLE cscalite_migrator LOGIN PASSWORD 'REPLACE_IN_SECRET_MANAGER';
CREATE ROLE cscalite_backup LOGIN PASSWORD 'REPLACE_IN_SECRET_MANAGER';
```

If the provider supports passwordless IAM/database auth, use that instead of static passwords.

## Database And Schema Privileges

Assuming the application database is `cscalite` and the schema is `public`:

```sql
\c cscalite

GRANT CONNECT ON DATABASE cscalite TO cscalite_app;
GRANT CONNECT ON DATABASE cscalite TO cscalite_migrator;
GRANT CONNECT ON DATABASE cscalite TO cscalite_backup;

GRANT USAGE ON SCHEMA public TO cscalite_app;
GRANT USAGE, CREATE ON SCHEMA public TO cscalite_migrator;
GRANT USAGE ON SCHEMA public TO cscalite_backup;
```

## Runtime Privileges After Migrations

After migrations create the tables and sequences:

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO cscalite_app;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO cscalite_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO cscalite_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO cscalite_app;
```

The runtime role should not be a superuser, database owner, or schema owner.

## Migration Privileges

The migrator role needs enough privileges to apply Prisma migrations:

```sql
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO cscalite_migrator;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO cscalite_migrator;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO cscalite_migrator;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL PRIVILEGES ON TABLES TO cscalite_migrator;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL PRIVILEGES ON SEQUENCES TO cscalite_migrator;
```

Use `cscalite_migrator` only in migration jobs such as `npm run db:migrate`.

## Backup Privileges

For logical backups:

```sql
GRANT SELECT ON ALL TABLES IN SCHEMA public TO cscalite_backup;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO cscalite_backup;
```

Some providers require a built-in read or backup role instead. Prefer the provider-supported backup role when available.

## Verification Queries

Run these before production launch:

```sql
SELECT rolname, rolsuper, rolcreatedb, rolcreaterole
FROM pg_roles
WHERE rolname IN ('cscalite_app', 'cscalite_migrator', 'cscalite_backup');

SELECT grantee, table_schema, table_name, privilege_type
FROM information_schema.table_privileges
WHERE grantee IN ('cscalite_app', 'cscalite_migrator', 'cscalite_backup')
ORDER BY grantee, table_schema, table_name, privilege_type;
```

Expected:

- `cscalite_app` has no superuser, create database, or create role permissions.
- `cscalite_app` can run the application but cannot perform broad DDL.
- `cscalite_migrator` is not used by the runtime backend.
- `cscalite_backup` can read tables for backups but is not used by runtime writes.

## Environment Mapping

Use separate URLs:

```bash
DATABASE_URL=postgresql://cscalite_app:...@HOST:5432/cscalite?schema=public&sslmode=require
MIGRATION_DATABASE_URL=postgresql://cscalite_migrator:...@HOST:5432/cscalite?schema=public&sslmode=require
BACKUP_DATABASE_URL=postgresql://cscalite_backup:...@HOST:5432/cscalite?schema=public&sslmode=require
```

The current scripts read `DATABASE_URL`; if migration or backup-specific URLs are adopted later, update the scripts deliberately and keep compatibility documented.

# Deployment identity

## Current defaults

Moodlelike owns its deployment identity independently of the former platform:

- backend images: `moodlelike-backend:migrate` and `moodlelike-backend:prod`;
- frontend image: `moodlelike-frontend:prod`;
- PostgreSQL database default: `moodlelike`;
- named volumes: `moodlelike-postgres-data`, `moodlelike-backups`, and `moodlelike-uploads`;
- HTTP port override: `MOODLELIKE_HTTP_PORT`;
- session cookies: `moodlelike_refresh`, `moodlelike_csrf`, and `moodlelike_oauth_state`.

The same Cookie defaults are used by the backend, frontend request layer, example environments and container build arguments.

## Compatibility and cutover boundary

These are defaults for new Moodlelike environments. Existing deployments can continue to supply their current `POSTGRES_DB`, `DATABASE_URL`, volume mappings and Cookie-name environment variables during an explicitly planned transition.

Changing a Compose volume name does not migrate data. The Moodlelike defaults create isolated resources and will not attach a former CSCALite volume automatically. Do not copy, restore, rename or mount real data without the authorization and checks in `DATA_CUTOVER_CHECKLIST.md`.

Changing Cookie names starts a new browser session namespace. An existing deployment that needs a staged login transition should keep its prior names through environment overrides until the cutover window is approved.

## Release status

`deploy/docker-compose.prod.yml` is an identity-clean deployment template, not a restored release pipeline. The former release, staging and Docker commands remain blocked as documented in `COMPATIBILITY_OPERATIONS.md`. A production rollout still requires a reviewed current release implementation, secrets, backup/rollback evidence and explicit target authorization.

Internal CSCA domain identifiers, persisted schema names, API paths and Prometheus metric names are not deployment defaults and remain compatibility debt. Browser storage keys now use a one-way compatibility migration documented in `BROWSER_IDENTITY_MIGRATION.md`.

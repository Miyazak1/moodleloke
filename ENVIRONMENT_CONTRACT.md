# Environment contract

## Required in production

- `MOODLELIKE_ENV`: canonical application environment (`production` in deployed runtimes); `CSC_ENV` is accepted only as a deprecated fallback;
- `DATABASE_URL`: dedicated Moodlelike PostgreSQL database;
- `AUTH_SECRET`: long, random signing secret unique to this deployment;
- `CORS_ORIGINS`: exact permitted web origins;
- `PUBLIC_APP_ORIGIN`: canonical student application origin;
- `PUBLIC_API_ORIGIN`: canonical API origin.

Redis, SMTP, Google OAuth, model Providers, organization BYOK, attachments and operational endpoints are optional capabilities. Enabling one requires its corresponding credentials and rollout checks; unused credentials should remain unset.

Variables exposed through `VITE_*` are public browser configuration and must never contain secrets. Provider keys, SMTP passwords, auth secrets and operational tokens are server-only.

The machine-generated inventory at `artifacts/environment-contract.md` lists every direct environment reference reachable from the current Agent runtime. Variables not present in examples rely on code defaults and are compatibility debt, not implicitly required production configuration.

`MOODLELIKE_ENV` is now the canonical platform-level environment selector. Production safety checks treat any of `MOODLELIKE_ENV`, legacy `CSC_ENV`, or `NODE_ENV` set to `production` as production, so a conflicting legacy value cannot weaken safeguards.

Legacy `CSCA_*` and `CSCALITE_*` names remain versioned domain compatibility contracts. `CSC_ENV` remains a read-only fallback during the deprecation window. These names should be migrated through explicit aliases and tests, never by a broad search-and-replace.

# Environment contract

## Required in production

- `DATABASE_URL`: dedicated Moodlelike PostgreSQL database;
- `AUTH_SECRET`: long, random signing secret unique to this deployment;
- `CORS_ORIGINS`: exact permitted web origins;
- `PUBLIC_APP_ORIGIN`: canonical student application origin;
- `PUBLIC_API_ORIGIN`: canonical API origin.

Redis, SMTP, Google OAuth, model Providers, organization BYOK, attachments and operational endpoints are optional capabilities. Enabling one requires its corresponding credentials and rollout checks; unused credentials should remain unset.

Variables exposed through `VITE_*` are public browser configuration and must never contain secrets. Provider keys, SMTP passwords, auth secrets and operational tokens are server-only.

The machine-generated inventory at `artifacts/environment-contract.md` lists every direct environment reference reachable from the current Agent runtime. Variables not present in examples rely on code defaults and are compatibility debt, not implicitly required production configuration.

Legacy `CSCA_*`, `CSCALITE_*` and `CSC_ENV` names remain versioned compatibility contracts. They should be renamed only through an explicit alias/deprecation migration, never by a broad search-and-replace.

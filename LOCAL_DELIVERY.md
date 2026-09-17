# Moodlelike local delivery

## Command model

- `npm run local:doctor`: verify Node.js 22, npm, Docker Desktop/Compose and dependency installation state;
- `npm run local:setup`: install missing locked dependencies, start the isolated Moodlelike PostgreSQL/Redis services, deploy committed migrations and create idempotent local demo evidence;
- `npm run local:start`: run setup, start backend on 3100 and frontend on 5190, wait for both services, authenticate the dedicated demo user and keep both processes attached to the current terminal;
- `npm run local:verify`: verify backend identity, Agent HTML shell, demo authentication and authenticated Agent conversation access against already running services;
- `npm run local:acceptance`: run runtime verification, dependency security audit, complete core contracts and all three browser golden paths.

Windows users may double-click `start-moodlelike-dev.bat`; it delegates to the same Node runner instead of maintaining a second startup implementation.

## Isolation and safety

The local environment uses Compose project `moodlelike`, PostgreSQL port 56432, Redis port 57379, database `moodlelike`, and its own named volume. Local setup rejects production mode, and the demo seed rejects non-loopback database hosts. It never reads the CSCALite environment file, database, Docker volume or uploads.

The generated demo credentials live under ignored `.local/` and are never printed by the verifier. The default local auth secret is development-only and must never be used for deployment.

Legacy `CSCA_*` feature flags remain internal compatibility contracts for the extracted runtime. Operators use the Moodlelike commands above and do not need to set them manually.

## Expected URLs

- Student Agent: `http://localhost:5190/zh/agent`
- Backend health: `http://localhost:3100/api/v1/health`
- PostgreSQL: `localhost:56432`
- Redis: `localhost:57379`

Stop the foreground command with Ctrl+C. PostgreSQL and Redis remain available for the next run; stop them explicitly with `docker compose stop` when desired.

## Verified rehearsal

The Windows rehearsal passed Docker/Compose doctor checks, deployed all 97 migrations, reran with no pending migrations, seeded the dedicated demo fixtures idempotently, started the stable compiled backend plus Vite frontend, passed both in-run and independent authenticated verification, and released application ports after Ctrl+C. PostgreSQL and Redis intentionally remained healthy for the next local run.

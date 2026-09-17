# Live Agent golden paths

## Purpose

These checks exercise the standalone Moodlelike UI, API, authentication, PostgreSQL evidence and optional live model Providers. They are separate from the deterministic `npm run ci:golden` suite because live Provider calls may incur cost and depend on configured credentials.

## Start the standalone environment

From the repository root, use one terminal:

```powershell
npm run local:start
```

The supported local endpoints are:

- Student Agent: `http://localhost:5190/zh/agent`
- Backend API and health: `http://localhost:3100`

The startup workflow installs locked dependencies when necessary, starts isolated Moodlelike PostgreSQL and Redis services, deploys committed migrations and creates idempotent local demo fixtures. It does not read another repository's environment or data.

## Run live checks

Use a second terminal at the repository root:

```powershell
node scripts/agent-demo-gate.cjs
npm --prefix frontend run test:e2e:agent:live
npm --prefix frontend run test:e2e:agent:attachment:live
```

The demo gate is read-only unless `--live` is explicitly supplied. Browser tests may call configured Providers and can incur cost. They require the ignored local demo credentials produced by setup and never fall back to a real student account.

Custom deployments may set `AGENT_LIVE_FRONTEND_URL`, `AGENT_LIVE_BACKEND_URL`, `AGENT_DEMO_FRONTEND_URL` or `AGENT_DEMO_BACKEND_URL`. Defaults must remain aligned with the standalone local-delivery ports.

## Deterministic release paths

For provider-free release verification, run:

```powershell
npm run ci:golden
```

This covers the recommended student practice flow, teaching assistance that keeps active practice mounted, and publishing through the isolated Authoring entry.

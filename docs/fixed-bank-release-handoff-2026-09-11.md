# CSCAPilot Fixed-Bank Release Handoff - 2026-09-11

## Release decision

The public release remains the fixed-question-bank product. Student special practice, mock exams, past papers, learning history and account onboarding are in scope. Automatic AI question generation, review, publication, predictive replenishment, startup recovery and observation execution remain disabled and are not part of the public release path.

## Prepared branch

- Branch: `codex/deepseek-ai-gateway`
- Remote: `https://github.com/Miyazak1/CSCAlite.git`
- Prepared commits after `67b51cb`:
  - `b4c3caf` - onboarding and public learning experience
  - `7a832e0` - admin publishing workflows
  - `d391b14` - isolated AI tooling calibration
  - `54392e7` - fixed-bank release boundary
  - `24a1838` - browser-check and auth-loading race stabilization
- Push is intentionally pending explicit confirmation that the named GitHub repository is controlled by the user or their team.

## Verification evidence

- `npm run verify:fixed-bank`: passed.
  - Browser result: 270 passed, 22 intentionally skipped, 0 failed.
  - Covered production-environment isolation, frontend and backend builds, backend security, adaptive rules, learning dashboard rules, mock-exam history, wrong-question rules and the fixed-bank browser matrix.
- Production-style local Docker staging:
  - PostgreSQL and Redis healthy.
  - Migrations applied through `0071_student_onboarding_profile`.
  - Backend readiness and frontend routing checks passed.
  - Sanitized evidence: `.tmp/release-evidence/docker-status-2026-09-11T03-32-14-887Z.json` and `.tmp/release-evidence/staging-full-local-2026-09-11T03-32-15-383Z.json`.
- Full browser development suite against the rebuilt Docker image: 278 passed, 26 intentionally skipped, 0 failed at two workers.
- The temporary `cscalite-verify` containers and network were removed after verification. Docker data volumes were retained.

## Isolation note

During release verification, a separate AI-questioning workstream modified `backend/src/ai-questioning/ai-questioning.service.ts` and created `scripts/csca-three-subject-live-observation.cjs`. Those working-tree changes were preserved but excluded from the fixed-bank release commits. They must be reviewed and committed by the AI-questioning workstream, not folded into this release by accident.

## Real staging blockers

The repository contains a production-style local Docker Compose stack and staging verification scripts, but no configured remote staging target or provider deployment workflow. `.github/workflows/quality.yml` runs quality checks for pull requests and pushes to `main`; it does not deploy this feature branch.

Before a real staging deployment can be executed, the release operator must provide or confirm:

1. The hosting target and deployment mechanism or project credentials.
2. An HTTPS `STAGING_BASE_URL` reachable from the release host.
3. Staging `DATABASE_URL`, Redis configuration and authority to apply migrations through `0071_student_onboarding_profile`.
4. Long random staging secrets, the real `PUBLIC_APP_ORIGIN`/`CORS_ORIGINS`, secure-cookie settings and the fixed-bank AI isolation flags.
5. `OPS_METRICS_ENABLED=true` with `OPS_METRICS_TOKEN` or `STAGING_METRICS_TOKEN` for the full staging gate.
6. Either permission for the gate to register a disposable smoke account or `STAGING_SMOKE_EMAIL` and `STAGING_SMOKE_PASSWORD` for an existing account.
7. A pre-deployment database backup, a disposable restore target and permission to run the restore drill.
8. A configured SMTP provider and receipt of a real verification email.
9. A pull request or merge plan so GitHub Actions runs the quality workflow before production deployment.

Once those values and permissions exist, run `npm run verify:staging:full`, archive its sanitized evidence, verify backup restoration, and only then schedule the production release window.

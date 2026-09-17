# CSCAlite release handoff - 2026-09-05

## Current pushed state

- Branch: `codex/deepseek-ai-gateway`
- Latest pushed commit: `41ece61 release: prepare csca learning isolation build`
- Remote: `origin/codex/deepseek-ai-gateway`
- Repo path on this machine: `D:\CODE\CSCAlite`

This commit was pushed to GitHub after staging the current tracked code changes plus source/document/script additions. Local visual QA screenshots, `artifacts/`, and `sites/` were intentionally not committed.

## What is included in `41ece61`

- New student frontend direction:
  - CSCA learning-first public pages.
  - School/study-China/scholarship public pages removed from the frontend route surface.
  - Updated homepage, subject learning, mock exam, past papers, AI service, consulting, account page, cart/order/checkout surfaces.
  - Vietnamese and English navigation/content updates are included, though more visual QA is still needed.

- Phase isolation for unfinished automatic question generation:
  - `CSCALITE_SPECIAL_PRACTICE_STUDENT_SESSIONS_ENABLED` added to environment examples.
  - Special-practice student start flow now exposes availability and blocks unavailable banks instead of starting broken sessions.
  - Admin special-practice surfaces show student-ready/unavailable state.
  - Structured errors preserve explicit error codes.
  - Launch/smoke scripts contain checks for unavailable special-practice banks returning a clear 409-style state.

- AI question generation / observation work from the current workspace:
  - Large updates under `backend/src/ai-questioning/`.
  - New policy files:
    - `backend/src/ai-questioning/subject-practice-question-plan-policy.ts`
    - `backend/src/ai-questioning/subject-practice-task-family-policy.ts`
  - New migration:
    - `backend/prisma/migrations/0070_subject_practice_observation_tasks/migration.sql`
  - New operational scripts under `scripts/csca-subject-practice-*`, `scripts/csca-ai-*`, and related docs under `docs/`.

- Admin/backend alignment work:
  - Admin content page can manage the updated public-home content structure.
  - Admin past-paper page gained upload helper UI for source/answer PDF metadata.
  - Staging/smoke checks were partially moved away from retired `/schools` frontend routes.

## Other Codex task status

The task `codex://threads/01a06089-f924-77b2-a3a2-680acec963ee` is titled `查看自动出题进展`, is idle, and uses the same repo path `D:\CODE\CSCAlite`.

The Codex app API only exposed recent completed turns with empty visible items, so I could not reconstruct a full turn-by-turn narrative from that task inside this handoff. The practical evidence is the repository state: the pushed commit includes the current workspace's automatic-questioning source files, scripts, migration, and docs that were present locally before the push.

## Verification already run

- Passed after final staging:
  - `npm --prefix frontend run build`

- Passed earlier in this work session before the last quick handoff/push step:
  - `npm --prefix backend run build`
  - `node -c scripts/smoke-check.cjs`
  - `node -c scripts/launch-smoke.cjs`

Backend build and full smoke were not rerun after the final small cart/search/staging-script cleanup because the user asked to stop and push due limited Codex quota.

## Known incomplete loops

- Backend search still needs a cleanup pass:
  - User-visible `/schools` frontend route checks were removed from smoke/staging scripts.
  - Search result types were changed toward `content | practice | page`.
  - But `backend/src/search/search.service.ts` still contains unused school fallback/read/mapper helpers. They are not currently wired into candidates, but they should be deleted in the next pass.

- School-related backend/admin compatibility remains:
  - Frontend school/study-China pages are deleted, but backend school modules/types may still exist.
  - Decide next time whether to keep them hidden for compatibility or remove them fully.

- Purchase flow is intentionally not fully reopened:
  - AI service purchase button was changed toward a not-yet-open behavior during the UI pass.
  - Cart/checkout now avoid presenting school review as a new service, but historical `SCHOOL_SERVICE` items may still render as legacy services.
  - Need one live visual check for cart, checkout, AI service purchase click, and orders.

- Consulting/invite/team flow still needs product decision:
  - Team invite page exists and is styled better than before, but whether it belongs under consulting/team quota needs final IA decision.
  - Consulting form should be checked end-to-end next time.

- Past-paper detail/admin upload:
  - Public detail page and admin upload helper were improved.
  - Need confirm backend upload/storage path is truly available in the intended deployment environment.

- Visual QA remains incomplete:
  - Personal homepage spacing, recent records overflow, language tabs, AI service card spacing, consulting/invite layout, and footer contrast were partially addressed in code but not comprehensively revalidated after the push.
  - Existing local screenshots remain untracked and can be used as references if staying on this machine, but they are not in Git.

## Local files not pushed

Only untracked visual artifacts remain locally after push:

- `artifacts/`
- many `frontend/*.png` audit/check screenshots
- `sites/`

Do not use `git add .` next time unless these are intentionally cleaned or ignored. Start with:

```bash
git status --short --branch
```

## Recommended next-device steps

1. Check out the pushed branch:

```bash
git fetch origin
git checkout codex/deepseek-ai-gateway
git pull --ff-only
```

2. Run the minimum release gate:

```bash
npm --prefix frontend run build
npm --prefix backend run build
node -c scripts/smoke-check.cjs
node -c scripts/launch-smoke.cjs
```

3. If a database is involved, confirm migration `0070_subject_practice_observation_tasks` is applied or intentionally deferred before deploying backend code that references the new observation/task structures.

4. Continue from the known incomplete loops above, especially backend search cleanup and visual QA of the public learning flows.

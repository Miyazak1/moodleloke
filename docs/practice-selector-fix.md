# Topic and difficulty selection entry (2026-11-12)

The deployed Math 1.43 engine was ready, but the default recommended workbench
did not expose its existing configurable free-practice form. Learning settings
started a default batch directly, and the report adjustment panel omitted math
difficulty. This frontend correction exposes **自选知识点和难度** on the default
workbench, submitted free-practice report and learning settings. It opens topic
selection before starting a batch. Report adjustments also include difficulty.

Explicit `mode=free` survives refresh without changing the saved default learning
mode. Returning to recommendations removes the temporary route parameter.
Unfinished practice, mock exams and teaching remain protected.

## Local acceptance

- TypeScript, production Vite build, i18n parity, minimal frontend and workspace
  route contracts passed.
- Actual browser against the live local acceptance backend: opened configuration
  from the default workbench, settings and submitted report; refreshed the form;
  returned to recommendations; chose **空间几何 / 困难 / 3 题** and started it.
- Actual round 102 opened with three questions, `较难`, selected topic, and
  `数学生成题 · 已核验`. This used the existing Math 1.43 backend, no Provider.
- Checked 1440, 390 and 320 pixel viewports. Form document width equalled viewport
  at 390 and 320. Existing unfinished-task navigation kept the active round.
- Proof images: `artifacts/practice-selector/`. Test-account names and topic
  fixtures in these images belong to the isolated local acceptance database.
- Regression tests cover default entry/payload, settings/refresh/return, and the
  independent verification-report entry. Included in the golden core command.

## Existing production release update

Use a clean checkout at the reviewed commit and run:

```bash
bash deploy/math143-update-frontend.sh FULL_COMMIT_SHA
```

This helper is specific to the verified production project `moodlelike-next`,
port 18081, and release directory `/root/moodlelike-math143-git-20261112`.
It builds only the frontend, preserves backend CSRF names, saves the old private
release environment, changes only the immutable frontend image and recreates
only the frontend container. Startup HTTP failures retry before automatic
frontend rollback. It performs no database migration, backend restart, test-site
change, or Nginx change. Existing images and database backup remain available.

For manual rollback, use the exact backup path printed by the helper:

```bash
APP=/www/wwwroot/moodlelike-next
REL=/root/moodlelike-math143-git-20261112
cp -p /EXACT/PRINTED/release.env.before-ui-TIMESTAMP "$REL/release.env"
docker compose --env-file "$APP/.env" --env-file "$REL/release.env" \
  -p moodlelike-next -f "$APP/deploy/docker-compose.prod.yml" \
  -f "$REL/release.yml" up -d --no-build --no-deps frontend
```

After updating, refresh the browser and verify selecting a topic, difficulty and
question count before starting. Application availability is checked by the
helper; production student acceptance remains an operator UI check.

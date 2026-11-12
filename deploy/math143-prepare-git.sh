#!/usr/bin/env bash
# Build a fixed Git revision without changing any running application or DB.
set -euo pipefail
umask 077
EXPECTED=${1:?Pass the reviewed 40-character Git commit SHA}
REL=${2:-/root/moodlelike-math143-git-20261112}
APP=/www/wwwroot/moodlelike-next
SOURCE=$(cd -- "$(dirname -- "$0")/.." && pwd -P)
[[ "$EXPECTED" =~ ^[a-f0-9]{40}$ ]]
test "$(uname -m)" = x86_64
test "$(git -C "$SOURCE" rev-parse HEAD)" = "$EXPECTED"
git -C "$SOURCE" diff --quiet
git -C "$SOURCE" diff --cached --quiet
test -f "$APP/.env"
test -f "$APP/deploy/docker-compose.prod.yml"
test ! -e "$REL/release.env"
test "$(docker inspect moodlelike-next-db-1 --format '{{range .Mounts}}{{if eq .Destination "/var/lib/postgresql/data"}}{{.Name}}{{end}}{{end}}')" = moodlelike-next_moodlelike-postgres-data
mkdir -p "$REL"

# Preserve the existing operator-selected CSRF names in the frontend build.
COOKIE=$(docker exec moodlelike-next-backend-1 node -e 'console.log(process.env.AUTH_CSRF_COOKIE_NAME||"moodlelike_csrf")')
HEADER=$(docker exec moodlelike-next-backend-1 node -e 'console.log(process.env.AUTH_CSRF_HEADER_NAME||"X-CSRF-Token")')
VERSION=math143-git-${EXPECTED:0:12}
BACKEND=moodlelike-backend:$VERSION
FRONTEND=moodlelike-frontend:$VERSION
MIGRATE=moodlelike-backend:$VERSION-migrate
docker build -f "$SOURCE/deploy/backend.Dockerfile" -t "$BACKEND" "$SOURCE"
docker build --target build -f "$SOURCE/deploy/backend.Dockerfile" -t "$MIGRATE" "$SOURCE"
docker build -f "$SOURCE/deploy/frontend.Dockerfile" -t "$FRONTEND" \
  --build-arg "VITE_AUTH_CSRF_COOKIE_NAME=$COOKIE" \
  --build-arg "VITE_AUTH_CSRF_HEADER_NAME=$HEADER" "$SOURCE"

printf 'MATH143_RELEASE_BACKEND_IMAGE=%s\nMATH143_RELEASE_FRONTEND_IMAGE=%s\nMATH143_RELEASE_MIGRATE_IMAGE=%s\nMATH143_GENERATION_ENABLED=false\n' \
  "$(docker image inspect "$BACKEND" --format '{{.Id}}')" \
  "$(docker image inspect "$FRONTEND" --format '{{.Id}}')" \
  "$(docker image inspect "$MIGRATE" --format '{{.Id}}')" > "$REL/release.env"
cp "$SOURCE/deploy/docker-compose.math143-release.yml" "$REL/release.yml"
cp "$SOURCE/deploy/math143-migration-preflight.cjs" "$REL/migration-preflight.cjs"
cat > "$REL/table-fingerprints.sql" <<'SQL'
SET TIME ZONE 'UTC';
SELECT format('SELECT %L, count(*), md5(coalesce(string_agg(row_to_json(t)::text, E''\n'' ORDER BY row_to_json(t)::text COLLATE "C"), '''')) FROM %I.%I t;', tablename, schemaname, tablename)
FROM pg_tables WHERE schemaname='public' ORDER BY tablename
\gexec
SQL
printf '%s\n' "$EXPECTED" > "$REL/source-commit.txt"
printf 'CSRF cookie: %s\nCSRF header: %s\n' "$COOKIE" "$HEADER" > "$REL/frontend-build-settings.txt"
echo "Candidate images built from $EXPECTED. Existing application and DB were not changed."
echo "Release files: $REL"
echo "Continue with docs/math143-github-deployment.md and the backup/restore gate."

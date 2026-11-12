#!/usr/bin/env bash
# Update only the frontend of the existing, enabled Math 1.43 release.
set -euo pipefail
umask 077
EXPECTED=${1:?Pass the reviewed 40-character Git commit SHA}
REL=${2:-/root/moodlelike-math143-git-20261112}
APP=/www/wwwroot/moodlelike-next
SOURCE=$(cd -- "$(dirname -- "$0")/.." && pwd -P)
[[ "$EXPECTED" =~ ^[a-f0-9]{40}$ ]]
test "$(git -C "$SOURCE" rev-parse HEAD)" = "$EXPECTED"
git -C "$SOURCE" diff --quiet
git -C "$SOURCE" diff --cached --quiet
test -f "$REL/release.env"
test -f "$REL/release.yml"
rdc() {
  docker compose --env-file "$APP/.env" --env-file "$REL/release.env" \
    -p moodlelike-next -f "$APP/deploy/docker-compose.prod.yml" -f "$REL/release.yml" "$@"
}
test "$(rdc ps -q frontend)" = "$(docker inspect moodlelike-next-frontend-1 --format '{{.Id}}')"
OLD=$(docker inspect moodlelike-next-frontend-1 --format '{{.Image}}')
test "$(sed -n 's/^MATH143_RELEASE_FRONTEND_IMAGE=//p' "$REL/release.env")" = "$OLD"
COOKIE=$(docker exec moodlelike-next-backend-1 node -e 'console.log(process.env.AUTH_CSRF_COOKIE_NAME||"moodlelike_csrf")')
HEADER=$(docker exec moodlelike-next-backend-1 node -e 'console.log(process.env.AUTH_CSRF_HEADER_NAME||"X-CSRF-Token")')
IMAGE=moodlelike-frontend:math143-ui-${EXPECTED:0:12}
docker build -f "$SOURCE/deploy/frontend.Dockerfile" -t "$IMAGE" \
  --build-arg "VITE_AUTH_CSRF_COOKIE_NAME=$COOKIE" \
  --build-arg "VITE_AUTH_CSRF_HEADER_NAME=$HEADER" "$SOURCE"
NEW=$(docker image inspect "$IMAGE" --format '{{.Id}}')
BACKUP="$REL/release.env.before-ui-$(date -u +%Y%m%dT%H%M%SZ)"
cp -p "$REL/release.env" "$BACKUP"
rollback() {
  cp -p "$BACKUP" "$REL/release.env"
  rdc up -d --no-build --no-deps frontend
  echo "Frontend rolled back. Saved configuration: $BACKUP" >&2
}
sed -i "s/^MATH143_RELEASE_FRONTEND_IMAGE=.*/MATH143_RELEASE_FRONTEND_IMAGE=$NEW/" "$REL/release.env"
if ! rdc up -d --no-build --no-deps frontend; then rollback; exit 1; fi
READY=false
for _ in $(seq 1 30); do
  if curl --fail --silent --max-time 3 http://127.0.0.1:18081/ -o /dev/null; then READY=true; break; fi
  sleep 2
done
if test "$READY" != true; then rollback; exit 1; fi
printf '%s\n' "$EXPECTED" > "$REL/frontend-source-commit.txt"
printf 'FRONTEND_UPDATED_OK\nCommit: %s\nImage: %s\nRollback configuration: %s\n' "$EXPECTED" "$NEW" "$BACKUP"

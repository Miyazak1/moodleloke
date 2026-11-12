#!/usr/bin/env bash
# Schema-neutral backend correction for the existing enabled Math 1.43 release.
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
test "$(rdc ps -q backend)" = "$(docker inspect moodlelike-next-backend-1 --format '{{.Id}}')"
OLD=$(docker inspect moodlelike-next-backend-1 --format '{{.Image}}')
test "$(sed -n 's/^MATH143_RELEASE_BACKEND_IMAGE=//p' "$REL/release.env")" = "$OLD"
test "$(sed -n 's/^MATH143_GENERATION_ENABLED=//p' "$REL/release.env")" = true
IMAGE=moodlelike-backend:math143-topic-${EXPECTED:0:12}
docker build -f "$SOURCE/deploy/backend.Dockerfile" -t "$IMAGE" "$SOURCE"
NEW=$(docker image inspect "$IMAGE" --format '{{.Id}}')
BACKUP="$REL/release.env.before-topic-$(date -u +%Y%m%dT%H%M%SZ)"
cp -p "$REL/release.env" "$BACKUP"
rollback() {
  cp -p "$BACKUP" "$REL/release.env"
  rdc up -d --no-build --no-deps backend
  echo "Backend rolled back. Saved configuration: $BACKUP" >&2
}
sed -i "s/^MATH143_RELEASE_BACKEND_IMAGE=.*/MATH143_RELEASE_BACKEND_IMAGE=$NEW/" "$REL/release.env"
# Read the real topic inventory using the candidate image and the existing DB
# connection, before replacing the running backend. No Nest bootstrap or writes.
if ! rdc run --rm --no-deps -T --entrypoint node backend <<'NODE'
const { PrismaClient } = require('/app/backend/node_modules/@prisma/client');
const { VerifiedMath143Adapter } = require('/app/backend/dist/backend/src/question-engine-plugin/verified-math143.adapter.js');
const { verifiedMathCellsForTopic } = require('/app/backend/dist/backend/src/question-engine-plugin/verified-math-topic-binding.js');
const prisma = new PrismaClient();
(async () => {
  const topics = await prisma.cscaExamTopic.findMany({ where: { subject: 'math', status: 'published' }, select: { code: true } });
  const catalog = new VerifiedMath143Adapter().catalog().cells;
  const rows = topics.map(topic => ({ code: topic.code, difficulties: ['basic','medium','hard'].filter(band => verifiedMathCellsForTopic(topic.code, band, catalog).length) }));
  const unexpected = rows.filter(row => row.difficulties.length !== 3 && row.code !== 'math-coordinate-geometry');
  if (unexpected.length) throw Error('UNMAPPED_PRODUCTION_MATH_TOPICS: ' + unexpected.map(row => row.code).join(','));
  console.log(JSON.stringify({ status: 'MATH_TOPIC_BINDINGS_OK', generatedTopics: rows.filter(row => row.difficulties.length === 3).length,
    bankOnlyTopics: rows.filter(row => row.difficulties.length === 0).map(row => row.code) }));
})().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
NODE
then
  cp -p "$BACKUP" "$REL/release.env"
  echo "Candidate topic audit failed; the running backend was not replaced." >&2
  exit 1
fi
if ! rdc up -d --no-build --no-deps backend; then rollback; exit 1; fi
READY=false
for _ in $(seq 1 60); do
  if docker exec moodlelike-next-backend-1 node -e '
    fetch("http://127.0.0.1:3000/api/v1/ops/ready", {
      headers: { authorization: "Bearer " + process.env.OPS_READY_TOKEN }, signal: AbortSignal.timeout(3000)
    }).then(async r => {
      const b = await r.json();
      process.exit(r.status === 200 && b.status === "ready" && b.questionEngine?.status === "ready" ? 0 : 1);
    }).catch(() => process.exit(1));' >/dev/null 2>&1; then READY=true; break; fi
  sleep 2
done
if test "$READY" != true; then rollback; exit 1; fi
printf '%s\n' "$EXPECTED" > "$REL/backend-source-commit.txt"
printf 'BACKEND_UPDATED_OK\nCommit: %s\nImage: %s\nRollback configuration: %s\n' "$EXPECTED" "$NEW" "$BACKUP"

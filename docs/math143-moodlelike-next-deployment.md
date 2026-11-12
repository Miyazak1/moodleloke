# cscapilot.com：数学 1.43 定向发布

目标由用户提供的服务器终端截图确认：正式域名 `www.cscapilot.com cscapilot.com` → 宝塔正式站代理 → `127.0.0.1:18081` → Compose 项目 `moodlelike-next`；基础配置 `/www/wwwroot/moodlelike-next/deploy/docker-compose.prod.yml`。数据库 `db:5432/moodlelike`，用户 `postgres`，现有卷 `moodlelike-next_moodlelike-postgres-data`，当前迁移到 `0098_agent_conversation_lifecycle`。

本手册不操作 18080 的 `deploy` 项目、`csca-math-lab` 或 test 站点，不更改域名代理。不要把本地的基础 Compose 覆盖到服务器；使用服务器既有基础文件，仅叠加本包的 `release.yml`。

下面全部命令在**服务器宝塔终端的 Bash**中执行。按阶段执行，任一步失败立即停在该阶段。发布包不包含环境密钥或本地验收库备份。

## 1. 上传、校验和加载

将本地 `.local/math143-layout-release/upload/` 中全部文件，通过宝塔文件管理上传到 `/root/moodlelike-math143-20261112/`。不要上传到网站可公开访问的目录。

```bash
set -euo pipefail
umask 077
APP=/www/wwwroot/moodlelike-next
REL=/root/moodlelike-math143-20261112
cd "$REL"
test "$(uname -m)" = x86_64
sha256sum -c SHA256SUMS
docker image load -i images.tar.gz
bash verify-images.sh
test -s candidate.env
cp candidate.env release.env

dc() { docker compose --env-file "$APP/.env" -p moodlelike-next -f "$APP/deploy/docker-compose.prod.yml" "$@"; }
rdc() { docker compose --env-file "$APP/.env" --env-file "$REL/release.env" -p moodlelike-next -f "$APP/deploy/docker-compose.prod.yml" -f "$REL/release.yml" "$@"; }
```

镜像校验同时支持 Docker 不同镜像存储实现报告的索引 ID 或配置 ID，校验成功后固定服务器实际加载的 ID，不依赖可变 `prod` 标签。文件校验依赖通过可信渠道上传的整包；不是第三方签名。

## 2. 写入前核对

```bash
test "$(dc ps -q db)" = "$(docker inspect moodlelike-next-db-1 --format '{{.Id}}')"
test "$(docker inspect moodlelike-next-db-1 --format '{{range .Mounts}}{{if eq .Destination "/var/lib/postgresql/data"}}{{.Name}}{{end}}{{end}}')" = moodlelike-next_moodlelike-postgres-data

docker exec moodlelike-next-db-1 psql -U postgres -d moodlelike -c \
  'SELECT migration_name,finished_at,rolled_back_at FROM _prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL;'

test "$(docker exec moodlelike-next-db-1 psql -U postgres -d moodlelike -Atqc \
  'SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name DESC LIMIT 1;')" = 0098_agent_conversation_lifecycle

docker exec moodlelike-next-backend-1 node -e \
  'const p=process.env;const u=new URL(p.DATABASE_URL);if(u.hostname!=="db"||u.pathname!=="/moodlelike")process.exit(1);console.log(JSON.stringify({database:u.pathname,csrfCookie:p.AUTH_CSRF_COOKIE_NAME||"(unset)",csrfHeader:p.AUTH_CSRF_HEADER_NAME||"(unset)",uploads:p.UPLOADS_DIR||"/app/uploads"}))'

rdc config --format json > "$REL/rendered.private.json"
rdc run --rm --no-deps -v "$REL/migration-preflight.cjs:/tmp/math143-preflight.cjs:ro" \
  migrate node /tmp/math143-preflight.cjs
```

预检只读取迁移记录，并核对已应用迁移的内容摘要（允许 CRLF/LF 差异）；**待执行项必须恰好为 0099、0100、0101，失败迁移查询必须为空。** 若出现其他项、连接到其他库、已执行 SQL 内容变化或基线不符，脚本会失败，不执行后续步骤。此检查不能代替对手动 schema drift 的核对。

0099 增加每日任务执行表及索引/用户外键；0100 增加数学身份唯一索引；0101 增加持久化出题任务表及索引，均未删除或重写原题库。本地已从模拟 0098 的已填充恢复副本执行三项真实迁移并比对原业务表；这不是线上数据副本的校验结果。

前端本包的 CSRF cookie/header 编译配置为 `moodlelike_csrf` / `X-CSRF-Token`。如当前服务显式使用其他名称，必须先重新构建匹配的前端候选，不能直接继续。若环境变量未设置，需根据当前应用配置核实名称。`rendered.private.json` 可能包含密钥，不发送到聊天或网站目录。人工比较渲染结果与当前服务，保留现有数据库、上传挂载、18081 端口、域名、Cookie 和 Provider 配置；同时确认发布包中的其他已有工作区改动属于本次批准范围。未覆盖原有待审改动。

## 3. 维护窗口与真实备份

宣布维护窗口，确认没有其他进程向正式库写入。先确认备份磁盘空间足够。该阶段开始暂停学生访问/写入；Nginx 可能暂时返回 502。

如果终端中途断开，先重新定义第 1 阶段的变量和 `dc` / `rdc` 函数；不要重新覆盖已经启用的 `release.env`。

```bash
set -euo pipefail
umask 077
TS=$(date -u +%Y%m%dT%H%M%SZ)
B=/root/moodlelike-backups/math143-$TS
mkdir -p "$B"
printf '%s\n' "$B" > "$REL/latest-backup-path.txt"
df -h / /var/lib/docker

OLD_BACKEND=$(docker inspect moodlelike-next-backend-1 --format '{{.Image}}')
OLD_FRONTEND=$(docker inspect moodlelike-next-frontend-1 --format '{{.Image}}')
OLD_MIGRATE=$(docker inspect moodlelike-next-migrate-1 --format '{{.Image}}')
printf 'BACKEND=%s\nFRONTEND=%s\nMIGRATE=%s\n' "$OLD_BACKEND" "$OLD_FRONTEND" "$OLD_MIGRATE" > "$B/previous-images.txt"
docker image save -o "$B/previous-images.tar" "$OLD_BACKEND" "$OLD_FRONTEND" "$OLD_MIGRATE"
cp "$APP/.env" "$B/previous-env.private"
dc config > "$B/previous-compose.private.yml"
cp /www/server/panel/vhost/nginx/www.cscapilot.com.conf "$B/site.conf"
cp -a /www/server/panel/vhost/nginx/proxy/www.cscapilot.com "$B/site-proxy"

UPLOADS=$(docker exec moodlelike-next-backend-1 node -e 'console.log(process.env.UPLOADS_DIR||"/app/uploads")')
docker exec moodlelike-next-backend-1 test -d "$UPLOADS"
dc stop frontend backend

docker exec moodlelike-next-db-1 pg_dump -U postgres -d moodlelike \
  --format=custom --no-owner --no-privileges > "$B/database.dump"
docker exec moodlelike-next-db-1 pg_dumpall -U postgres --globals-only > "$B/roles.private.sql"
docker cp "moodlelike-next-backend-1:$UPLOADS" "$B/uploads"
test -s "$B/database.dump"
sha256sum "$B/database.dump" "$B/previous-images.tar" > "$B/backup.sha256"

docker exec -i moodlelike-next-db-1 psql -X -qAt -F '|' \
  -v ON_ERROR_STOP=1 -U postgres -d moodlelike \
  < "$REL/table-fingerprints.sql" > "$B/source-tables.txt"
```

备份还需复制到独立受控存储，不能只留在与数据库相同磁盘。若备份失败，保留现场，使用 `dc up -d --no-build --no-deps backend frontend` 恢复原镜像服务；不要继续迁移。

## 4. 用真实备份验证恢复

新建临时恢复容器，**无网络、无对外端口，不挂载正式数据库卷**。不要对 `moodlelike-next-db-1` 执行恢复。

```bash
RESTORE=moodlelike-math143-restore-$TS
PG_IMAGE=$(docker inspect moodlelike-next-db-1 --format '{{.Image}}')
printf '%s\n' "$RESTORE" > "$B/restore-container.txt"
docker run -d --name "$RESTORE" --network none \
  -e POSTGRES_PASSWORD="$(openssl rand -hex 32)" "$PG_IMAGE"

ready=false
for n in $(seq 1 90); do
  if docker exec "$RESTORE" pg_isready -h 127.0.0.1 -U postgres -d postgres >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 1
done
test "$ready" = true

docker exec "$RESTORE" createdb -U postgres moodlelike_restore
docker exec -i "$RESTORE" pg_restore -U postgres -d moodlelike_restore \
  --exit-on-error --no-owner --no-privileges < "$B/database.dump"

docker exec -i "$RESTORE" psql -X -qAt -F '|' \
  -v ON_ERROR_STOP=1 -U postgres -d moodlelike_restore \
  < "$REL/table-fingerprints.sql" > "$B/restored-tables.txt"
diff -u "$B/source-tables.txt" "$B/restored-tables.txt"
sha256sum -c "$B/backup.sha256"
docker stop "$RESTORE"
```

只有恢复成功、逐表行数及数据摘要一致才继续。恢复容器和卷保留；没有删除正式数据或 test 数据。失败则按第 3 阶段恢复原服务。

## 5. 应用迁移，关闭生成更新应用

```bash
rdc run --rm --no-deps migrate
rdc up -d --no-build --no-deps backend frontend
rdc ps

docker inspect moodlelike-next-backend-1 --format '{{.State.Health.Status}}'
curl -fsSI http://127.0.0.1:18081/

docker exec moodlelike-next-backend-1 node -e \
  'const t=process.env.OPS_READY_TOKEN;fetch("http://127.0.0.1:3000/api/v1/ops/ready",{headers:t?{authorization:"Bearer "+t}:{}}).then(async r=>{const b=await r.json();console.log(JSON.stringify({http:r.status,status:b.status,engine:b.questionEngine?.status}));if(!r.ok||b.status!=="ready"||b.questionEngine?.status!=="inactive")process.exit(1)}).catch(()=>process.exit(1))'
```

后端刚启动时会显示 `starting`，等待健康状态为 `healthy` 再验收。用正式域名登录，确认历史学习记录、三科旧题库作答提交与移动端正常。此时数学引擎应为 `inactive`。不要执行 `docker compose down -v`，不要重新创建数据库或替换卷，不运行 seed。

## 6. 启用唯一正式数学插件

```bash
sed -i 's/^MATH143_GENERATION_ENABLED=.*/MATH143_GENERATION_ENABLED=true/' "$REL/release.env"
rdc up -d --no-build --no-deps backend

docker exec moodlelike-next-backend-1 node -e \
  'const t=process.env.OPS_READY_TOKEN;fetch("http://127.0.0.1:3000/api/v1/ops/ready",{headers:t?{authorization:"Bearer "+t}:{}}).then(async r=>{const b=await r.json();console.log(JSON.stringify({http:r.status,status:b.status,engine:b.questionEngine?.status}));if(!r.ok||b.status!=="ready"||b.questionEngine?.status!=="ready")process.exit(1)}).catch(()=>process.exit(1))'

docker exec moodlelike-next-db-1 psql -U postgres -d moodlelike -c \
  'SELECT migration_name,finished_at FROM _prisma_migrations ORDER BY migration_name DESC LIMIT 3;'
```

同样等待后端健康后再运行 readiness 命令。实际验收支持范围内的知识点、三档难度、缺题生成、双语题干和配图、判题提交及学习记录；刷新后不重复出题或重复入账。确认后结束维护窗口。正式插件只有 `verified-math-1.43`，旧生成链路和读图试点均关闭。聊天、邮件等供应商仍用既有环境，不替换成演练值。

后续维护命令要继续使用 `rdc` 指定的两份配置和两份 env 文件。仅运行原基础 Compose 会丢失本次覆盖设置；将该组合记录到正式运维入口。

## 7. 首选回滚：关闭生成，保留全部作答

```bash
sed -i 's/^MATH143_GENERATION_ENABLED=.*/MATH143_GENERATION_ENABLED=false/' "$REL/release.env"
rdc up -d --no-build --no-deps backend
```

确认 readiness 的 engine 为 `inactive`，三科原有题库可以作答提交。此路径已在最新组合本地演练，不回退数据库，不删除新题或作答。

若需要回滚整套应用，应先保留失败现场与发布后新增记录，并在隔离库验证服务器保留的旧镜像对新 schema 的兼容性。旧镜像 ID、环境和配置在 `$B`；当前未执行过这两个真实线上旧镜像的兼容性验收，不能宣称可以盲目切回。数据库恢复仅用于数据损坏，恢复到新库并校验后再切连接，须先处理发布后新增作答；不自动覆盖原库。

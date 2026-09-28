# CSCALITE → Moodlelike 生产切换 Runbook

> 状态：待生产盘点确认后执行
> 编写日期：2026-09-28
> 适用环境：阿里云 Ubuntu、宝塔面板、Docker Compose、Nginx 反向代理
> 目标：CSCALITE 与 Moodlelike 短期共存，先影子验证，再切换流量，最后退役旧站

## 1. 执行结论

本次切换不在原目录覆盖 CSCALITE，也不让两个后端同时写同一个生产数据库。

固定采用以下拓扑：

```text
切换前
公网域名/IP ──宝塔 Nginx──> CSCALITE 旧站（继续生产）
                               │
                               └── CSCALITE 生产库/上传卷

并行验证
47.242.60.180:18080 ──> moodlelike-demo（现有演示环境）
47.242.60.180:18081 ──> moodlelike-next（新的切换候选环境）
                               │
                               └── 源库副本/独立上传卷

正式切换
公网域名/IP ──宝塔 Nginx──> moodlelike-next:18081
CSCALITE 旧站停止写入并保留，用于短期回退
```

数据库恢复不是普通应用回滚手段。只要新站已经接收用户写入，就不能直接切回旧数据库，否则会丢失切换后的注册、答题、会话、审核和内容运营记录。

## 2. 已确认的真实环境身份

以下值来自当前服务器截图和仓库生产 Compose，不是示例名：

| 资源 | 已确认值 |
| --- | --- |
| 服务器公网 IP | `47.242.60.180` |
| 当前 Moodlelike 演示目录 | `/www/wwwroot/moodlelike-demo` |
| GitHub 仓库 | `https://github.com/Miyazak1/moodleloke.git` |
| 当前演示 Compose project | `moodlelike-demo` |
| 当前演示 HTTP 端口 | `18080` |
| 当前演示数据库容器 | `moodlelike-demo-db-1` |
| 当前演示 Redis 容器 | `moodlelike-demo-redis-1` |
| 当前演示迁移容器 | `moodlelike-demo-migrate-1`，正常状态为 `Exited (0)` |
| 当前演示后端容器 | `moodlelike-demo-backend-1` |
| 当前演示前端容器 | `moodlelike-demo-frontend-1` |
| 当前演示数据库卷 | `moodlelike-demo_moodlelike-postgres-data` |
| 当前演示备份卷 | `moodlelike-demo_moodlelike-backups` |
| 当前演示上传卷 | `moodlelike-demo_moodlelike-uploads` |
| 新候选目录 | `/www/wwwroot/moodlelike-next` |
| 新候选 Compose project | `moodlelike-next` |
| 新候选 HTTP 端口 | `18081` |
| 新候选数据库容器 | `moodlelike-next-db-1` |
| 新候选后端容器 | `moodlelike-next-backend-1` |
| 新候选前端容器 | `moodlelike-next-frontend-1` |
| 新候选数据库卷 | `moodlelike-next_moodlelike-postgres-data` |
| 新候选备份卷 | `moodlelike-next_moodlelike-backups` |
| 新候选上传卷 | `moodlelike-next_moodlelike-uploads` |

尚不能从本地仓库或现有截图安全确认的只有 CSCALITE 正式站 Compose project、容器、端口、卷和宝塔站点配置文件。第 4 节只读盘点会查出这些值。在盘点表填写完成前，不得执行第 7 节以后的命令。

## 3. 总门禁与职责

至少两个人参与正式切换：一人执行，一人逐项复核。提前确定：

- 执行人；
- 复核人；
- 业务验收人；
- 有权决定回滚的人；
- 切换窗口开始与最晚回滚时间。

必须满足：

- 合并后的 Moodlelike release commit 已推送并固定 SHA；
- `npm run ci:contracts` 与必要构建检查通过；
- 已用生产副本完整演练一次；
- 生产源库、上传文件、宝塔 Nginx 配置均有备份；
- 新旧站不会同时写生产数据；
- 切换窗口内不升级 PostgreSQL、Prisma 主版本、认证协议或自动出题策略；
- 不删除旧仓库目录、旧数据库卷、旧上传卷和旧镜像；
- 真实 `.env`、数据库 URL、API key 和用户数据不得粘贴进 Git、Issue 或聊天。

## 4. 第一次登录服务器：只读盘点

以下命令均在宝塔终端中执行，不修改容器或数据。

### 4.1 查看所有 Compose 项目、容器和端口

```bash
docker compose ls
docker ps -a --format 'table {{.Names}}\t{{.Image}}\t{{.Ports}}\t{{.Status}}\t{{.Label "com.docker.compose.project"}}'
docker volume ls --format 'table {{.Name}}\t{{.Driver}}'
```

只筛选可能相关的资源：

```bash
docker ps -a --format '{{.Names}}|{{.Image}}|{{.Ports}}|{{.Status}}|{{.Label "com.docker.compose.project"}}' | grep -Ei 'csca|moodle'
docker volume ls --format '{{.Name}}' | grep -Ei 'csca|moodle'
```

### 4.2 定位 CSCALITE 旧站目录

```bash
find /www/wwwroot -maxdepth 3 -type f \( -name 'docker-compose.yml' -o -name 'docker-compose.prod.yml' \) -print
find /www/wwwroot -maxdepth 3 -type d -name '.git' -print
```

对疑似 CSCALITE 目录逐个执行，下列命令不会显示 `.env` 内容：

```bash
cd /www/wwwroot/cscalite
pwd
git remote -v
git rev-parse --abbrev-ref HEAD
git rev-parse HEAD
git status --short
```

如果真实目录不是 `/www/wwwroot/cscalite`，从这里开始始终使用真实目录。

### 4.3 定位宝塔反向代理配置

```bash
grep -RsnE 'proxy_pass[[:space:]]+http://(127\.0\.0\.1|localhost):[0-9]+' /www/server/panel/vhost/nginx 2>/dev/null
```

若没有结果，再执行：

```bash
grep -RsnE '47\.242\.60\.180|server_name|proxy_pass' /www/server/panel/vhost/nginx 2>/dev/null | grep -Ei 'csca|moodle|proxy_pass|47\.242\.60\.180'
```

只查看命中的站点文件，不要查看 `.env`：

```bash
sed -n '1,240p' /www/server/panel/vhost/nginx/实际站点配置文件.conf
```

### 4.4 从容器标签确认旧站 project 和工作目录

把 `实际旧后端容器名` 替换为第 4.1 节找到的容器：

```bash
docker inspect 实际旧后端容器名 --format 'project={{index .Config.Labels "com.docker.compose.project"}}'
docker inspect 实际旧后端容器名 --format 'working_dir={{index .Config.Labels "com.docker.compose.project.working_dir"}}'
docker inspect 实际旧后端容器名 --format 'compose_files={{index .Config.Labels "com.docker.compose.project.config_files"}}'
docker inspect 实际旧后端容器名 --format '{{range .Mounts}}{{println .Name " -> " .Destination}}{{end}}'
```

对旧数据库容器和旧后端容器分别检查挂载：

```bash
docker inspect 实际旧数据库容器名 --format '{{range .Mounts}}{{println .Type " | " .Name " | " .Source " -> " .Destination}}{{end}}'
docker inspect 实际旧后端容器名 --format '{{range .Mounts}}{{println .Type " | " .Name " | " .Source " -> " .Destination}}{{end}}'
```

### 4.5 填写并复核生产盘点表

把真实值填写到发布记录中，不要把密码写进本文件：

```text
PROD_ORIGIN=
BT_SITE_CONF=
OLD_DIR=
OLD_PROJECT=
OLD_COMPOSE_FILE=
OLD_HTTP_PORT=
OLD_DB_CONTAINER=
OLD_DB_VOLUME=
OLD_BACKEND_CONTAINER=
OLD_FRONTEND_CONTAINER=
OLD_UPLOAD_VOLUME=
OLD_UPLOAD_PATH=
OLD_DB_NAME=
OLD_DB_USER=
RELEASE_COMMIT=
```

如果数据库容器使用标准 `POSTGRES_DB` 和 `POSTGRES_USER`，可以只显示非敏感身份：

```bash
docker inspect 实际旧数据库容器名 --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -E '^(POSTGRES_DB|POSTGRES_USER)='
```

不要执行 `docker inspect ... | grep PASSWORD`，也不要执行 `cat .env`。

## 5. 固定本次终端变量

正式执行时，打开一个新的 root 终端，将第 4.5 节的真实值填入下方。下面前六个候选环境值已经固定，无需修改。

```bash
export SERVER_IP='47.242.60.180'
export DEMO_DIR='/www/wwwroot/moodlelike-demo'
export DEMO_PROJECT='moodlelike-demo'
export DEMO_PORT='18080'
export NEXT_DIR='/www/wwwroot/moodlelike-next'
export NEXT_PROJECT='moodlelike-next'
export NEXT_PORT='18081'

export PROD_ORIGIN='https://填写正式域名；若暂时只有IP则填http://47.242.60.180'
export BT_SITE_CONF='/www/server/panel/vhost/nginx/填写实际站点配置文件.conf'
export OLD_DIR='/www/wwwroot/填写旧站真实目录'
export OLD_PROJECT='填写旧Compose项目名'
export OLD_COMPOSE_FILE='填写旧compose文件绝对路径'
export OLD_HTTP_PORT='填写旧站本机端口'
export OLD_DB_CONTAINER='填写旧数据库容器名'
export OLD_DB_VOLUME='填写旧数据库卷名'
export OLD_BACKEND_CONTAINER='填写旧后端容器名'
export OLD_FRONTEND_CONTAINER='填写旧前端容器名'
export OLD_UPLOAD_VOLUME='填写旧上传卷名'
export OLD_UPLOAD_PATH='/app/uploads'
export RELEASE_COMMIT='填写已经推送的完整40位commit SHA'
```

执行硬门禁；任何一行失败都停止：

```bash
set -eu
case "$PROD_ORIGIN$BT_SITE_CONF$OLD_DIR$OLD_PROJECT$OLD_COMPOSE_FILE$OLD_HTTP_PORT$OLD_DB_CONTAINER$OLD_DB_VOLUME$OLD_BACKEND_CONTAINER$OLD_FRONTEND_CONTAINER$OLD_UPLOAD_VOLUME$RELEASE_COMMIT" in *填写*) echo 'Replace every 填写 placeholder first'; false ;; esac
test -d "$DEMO_DIR"
test -f "$BT_SITE_CONF"
test -d "$OLD_DIR"
test -f "$OLD_COMPOSE_FILE"
test "${#RELEASE_COMMIT}" -eq 40
test "$OLD_HTTP_PORT" != "$NEXT_PORT"
docker inspect "$OLD_DB_CONTAINER" >/dev/null
docker inspect "$OLD_BACKEND_CONTAINER" >/dev/null
docker volume inspect "$OLD_DB_VOLUME" >/dev/null
docker volume inspect "$OLD_UPLOAD_VOLUME" >/dev/null
printf 'old=%s:%s next=%s:%s release=%s\n' "$OLD_PROJECT" "$OLD_HTTP_PORT" "$NEXT_PROJECT" "$NEXT_PORT" "$RELEASE_COMMIT"
```

关闭 `set -e`，防止后续人工排查时终端意外退出：

```bash
set +e
```

## 6. 创建服务器外部备份目录并保存身份清单

备份必须位于 Web 根目录之外：

```bash
export CUTOVER_ID="$(date -u +%Y%m%dT%H%M%SZ)"
export CUTOVER_DIR="/root/cutover-backups/$CUTOVER_ID"
install -d -m 700 "$CUTOVER_DIR"
printf '%s\n' "$CUTOVER_DIR" > /root/cutover-backups/ACTIVE_CUTOVER
chmod 600 /root/cutover-backups/ACTIVE_CUTOVER
printf '%s\n' "$CUTOVER_ID" > "$CUTOVER_DIR/cutover-id.txt"
docker compose ls > "$CUTOVER_DIR/docker-compose-ls.before.txt"
docker ps -a --no-trunc > "$CUTOVER_DIR/docker-ps.before.txt"
docker volume ls > "$CUTOVER_DIR/docker-volumes.before.txt"
git -C "$OLD_DIR" rev-parse HEAD > "$CUTOVER_DIR/cscalite-head.txt"
git -C "$DEMO_DIR" rev-parse HEAD > "$CUTOVER_DIR/moodlelike-demo-head.txt"
cp -a "$BT_SITE_CONF" "$CUTOVER_DIR/nginx-site.before.conf"
chmod 600 "$CUTOVER_DIR"/*
ls -lah "$CUTOVER_DIR"
```

确认备份目录变量没有落到 `/`、`/root` 或 `/www/wwwroot`：

```bash
test "$CUTOVER_DIR" != '/'
test "$CUTOVER_DIR" != '/root'
case "$CUTOVER_DIR" in /root/cutover-backups/*) echo 'backup path ok' ;; *) echo 'BAD BACKUP PATH'; false ;; esac
```

## 7. 备份 CSCALITE 源库和上传文件

### 7.1 读取非敏感数据库身份

```bash
export OLD_DB_NAME="$(docker inspect "$OLD_DB_CONTAINER" --format '{{range .Config.Env}}{{println .}}{{end}}' | sed -n 's/^POSTGRES_DB=//p' | head -n 1)"
export OLD_DB_USER="$(docker inspect "$OLD_DB_CONTAINER" --format '{{range .Config.Env}}{{println .}}{{end}}' | sed -n 's/^POSTGRES_USER=//p' | head -n 1)"
test -n "$OLD_DB_NAME"
test -n "$OLD_DB_USER"
printf 'source database=%s user=%s container=%s\n' "$OLD_DB_NAME" "$OLD_DB_USER" "$OLD_DB_CONTAINER"
```

### 7.2 在线一致性数据库备份

`pg_dump` 提供单次事务一致性快照，可用于第一次影子演练；最终切换仍要在停写后再备份一次。

```bash
export REHEARSAL_DB_DUMP="$CUTOVER_DIR/cscalite-rehearsal.dump"
docker exec "$OLD_DB_CONTAINER" pg_dump -U "$OLD_DB_USER" -d "$OLD_DB_NAME" --format=custom --no-owner --no-privileges > "$REHEARSAL_DB_DUMP"
test -s "$REHEARSAL_DB_DUMP"
sha256sum "$REHEARSAL_DB_DUMP" | tee "$REHEARSAL_DB_DUMP.sha256"
docker exec -i "$OLD_DB_CONTAINER" pg_restore --list /dev/stdin < "$REHEARSAL_DB_DUMP" | head -n 20
```

若最后一条因容器版 `pg_restore` 不支持 `/dev/stdin` 而失败，改用：

```bash
docker cp "$REHEARSAL_DB_DUMP" "$OLD_DB_CONTAINER:/tmp/cscalite-rehearsal.dump"
docker exec "$OLD_DB_CONTAINER" pg_restore --list /tmp/cscalite-rehearsal.dump | head -n 20
docker exec "$OLD_DB_CONTAINER" rm -f /tmp/cscalite-rehearsal.dump
```

### 7.3 上传卷备份

先确认卷名和候选卷名绝不相同：

```bash
test "$OLD_UPLOAD_VOLUME" != 'moodlelike-next_moodlelike-uploads'
docker volume inspect "$OLD_UPLOAD_VOLUME" --format '{{.Name}} -> {{.Mountpoint}}'
```

使用只读挂载归档：

```bash
docker image inspect alpine:3.20 >/dev/null 2>&1 || docker pull alpine:3.20
docker run --rm \
  -v "$OLD_UPLOAD_VOLUME:/source:ro" \
  -v "$CUTOVER_DIR:/backup" \
  alpine:3.20 sh -c 'cd /source && tar -czf /backup/cscalite-uploads-rehearsal.tar.gz .'
test -s "$CUTOVER_DIR/cscalite-uploads-rehearsal.tar.gz"
sha256sum "$CUTOVER_DIR/cscalite-uploads-rehearsal.tar.gz" | tee "$CUTOVER_DIR/cscalite-uploads-rehearsal.tar.gz.sha256"
```

若旧站上传不是 named volume，而是 bind mount，必须把 `OLD_UPLOAD_VOLUME` 改为第 4.4 节确认的宿主机目录，并使用：

```bash
tar -C /填写真实上传目录 -czf "$CUTOVER_DIR/cscalite-uploads-rehearsal.tar.gz" .
```

## 8. 部署独立 Moodlelike 候选栈

### 8.1 拉取并固定 release commit

```bash
test ! -e "$NEXT_DIR" || { echo "$NEXT_DIR already exists; inspect it instead of overwriting"; false; }
git clone https://github.com/Miyazak1/moodleloke.git "$NEXT_DIR"
git -C "$NEXT_DIR" fetch --prune origin
git -C "$NEXT_DIR" checkout --detach "$RELEASE_COMMIT"
test "$(git -C "$NEXT_DIR" rev-parse HEAD)" = "$RELEASE_COMMIT"
git -C "$NEXT_DIR" status --short
```

最后一条必须没有输出。

### 8.2 创建候选环境配置

从 CSCALITE 旧生产环境安全继承认证密钥、Google OAuth、SMTP 和 Cookie 配置；只使用
`moodlelike-demo/.env` 会让旧登录会话和 Google 登录配置丢失。复制文件不会在终端显示秘密：

```bash
if [ -f "$OLD_DIR/.env" ]; then
  install -m 600 "$OLD_DIR/.env" "$NEXT_DIR/.env"
else
  install -m 600 "$DEMO_DIR/.env" "$NEXT_DIR/.env"
  echo 'Old production secrets are externally managed; add them securely before startup.'
fi
cd "$NEXT_DIR"
nano .env
```

如果旧站使用宝塔环境变量或外部 Secret Manager、没有 `$OLD_DIR/.env`，则由运维人员在
`$NEXT_DIR/.env` 中逐项安全录入，不要通过聊天传递。必须保持原值的项目包括
`AUTH_SECRET`、`JWT_SECRET`、Google Client ID/Secret/redirect URI 和 SMTP 配置。

在编辑器中至少确认或修改以下项目：

```dotenv
POSTGRES_DB=moodlelike
MOODLELIKE_HTTP_PORT=18081
PUBLIC_APP_ORIGIN=http://47.242.60.180:18081
CORS_ORIGINS=http://47.242.60.180:18081
AUTH_COOKIE_SECURE=false
AUTH_COOKIE_DOMAIN=
AUTH_REFRESH_COOKIE_NAME=cscalite_refresh
AUTH_CSRF_COOKIE_NAME=cscalite_csrf
AUTH_CSRF_HEADER_NAME=x-csrf-token
AUTH_GOOGLE_STATE_COOKIE_NAME=cscalite_oauth_state
VITE_AUTH_CSRF_COOKIE_NAME=cscalite_csrf
VITE_AUTH_CSRF_HEADER_NAME=X-CSRF-Token
```

说明：这是通过 HTTP/IP 进行影子验证的配置。正式域名切换且 HTTPS 生效后，应改为真实 `https://域名`、`AUTH_COOKIE_SECURE=true`，再重建前后端。若已经为候选环境配置独立 HTTPS 子域名，直接填写该 HTTPS origin，并保持 secure 为 `true`。

只输出允许公开的配置，验证端口和 origin；不要 `cat .env`：

```bash
grep -E '^(POSTGRES_DB|MOODLELIKE_HTTP_PORT|PUBLIC_APP_ORIGIN|CORS_ORIGINS|AUTH_COOKIE_SECURE|AUTH_COOKIE_DOMAIN|AUTH_REFRESH_COOKIE_NAME|AUTH_CSRF_COOKIE_NAME|AUTH_CSRF_HEADER_NAME|AUTH_GOOGLE_STATE_COOKIE_NAME|VITE_AUTH_CSRF_COOKIE_NAME|VITE_AUTH_CSRF_HEADER_NAME|GOOGLE_OAUTH_REDIRECT_URI)=' .env
```

### 8.3 只启动候选数据库和 Redis

```bash
cd "$NEXT_DIR"
docker compose -p "$NEXT_PROJECT" --env-file .env -f deploy/docker-compose.prod.yml up -d db redis
docker compose -p "$NEXT_PROJECT" --env-file .env -f deploy/docker-compose.prod.yml ps
```

此时 `backend` 尚未创建，Compose 也还没有创建上传卷。用候选 project 的精确标签预建该卷：

```bash
export NEXT_UPLOAD_VOLUME='moodlelike-next_moodlelike-uploads'
docker volume create \
  --label com.docker.compose.project=moodlelike-next \
  --label com.docker.compose.volume=moodlelike-uploads \
  "$NEXT_UPLOAD_VOLUME"
docker volume inspect "$NEXT_UPLOAD_VOLUME" --format '{{.Name}} | project={{index .Labels "com.docker.compose.project"}} | volume={{index .Labels "com.docker.compose.volume"}}'
```

等待 `db` 和 `redis` 均为 healthy：

```bash
until [ "$(docker inspect -f '{{.State.Health.Status}}' moodlelike-next-db-1)" = 'healthy' ]; do sleep 2; done
until [ "$(docker inspect -f '{{.State.Health.Status}}' moodlelike-next-redis-1)" = 'healthy' ]; do sleep 2; done
```

### 8.4 恢复源库副本到候选数据库

```bash
export NEXT_DB_NAME="$(docker inspect moodlelike-next-db-1 --format '{{range .Config.Env}}{{println .}}{{end}}' | sed -n 's/^POSTGRES_DB=//p' | head -n 1)"
export NEXT_DB_USER="$(docker inspect moodlelike-next-db-1 --format '{{range .Config.Env}}{{println .}}{{end}}' | sed -n 's/^POSTGRES_USER=//p' | head -n 1)"
test -n "$NEXT_DB_NAME"
test -n "$NEXT_DB_USER"
test "$OLD_DB_CONTAINER" != 'moodlelike-next-db-1'
docker cp "$REHEARSAL_DB_DUMP" moodlelike-next-db-1:/tmp/source.dump
docker exec moodlelike-next-db-1 pg_restore \
  -U "$NEXT_DB_USER" -d "$NEXT_DB_NAME" \
  --clean --if-exists --no-owner --no-privileges --exit-on-error \
  /tmp/source.dump
docker exec moodlelike-next-db-1 rm -f /tmp/source.dump
```

### 8.5 恢复上传文件到候选卷

候选卷必须存在且名称精确匹配：

```bash
docker volume inspect "$NEXT_UPLOAD_VOLUME" --format '{{.Name}} -> {{.Mountpoint}}'
test "$NEXT_UPLOAD_VOLUME" != "$OLD_UPLOAD_VOLUME"
docker run --rm \
  -v "$NEXT_UPLOAD_VOLUME:/restore" \
  -v "$CUTOVER_DIR:/backup:ro" \
  alpine:3.20 sh -c 'cd /restore && tar -xzf /backup/cscalite-uploads-rehearsal.tar.gz'
```

### 8.6 构建、迁移并启动候选应用

```bash
cd "$NEXT_DIR"
docker compose -p "$NEXT_PROJECT" --env-file .env -f deploy/docker-compose.prod.yml up -d --build
docker compose -p "$NEXT_PROJECT" --env-file .env -f deploy/docker-compose.prod.yml ps
```

正确结果应为：

- `moodlelike-next-db-1` healthy；
- `moodlelike-next-redis-1` healthy；
- `moodlelike-next-backend-1` healthy；
- `moodlelike-next-frontend-1` started/running；
- `moodlelike-next-migrate-1` exited code 0。

若失败：

```bash
docker compose -p "$NEXT_PROJECT" --env-file .env -f deploy/docker-compose.prod.yml ps -a
docker compose -p "$NEXT_PROJECT" --env-file .env -f deploy/docker-compose.prod.yml logs --tail=300 migrate backend frontend
```

### 8.7 上线前配置预检

当前学生站使用已核验题库，自动出题插件应保持关闭。该命令只读配置，不调用 Provider、不写数据库：

当前 v1.4a 只完成了带签名任务协议，sidecar 传输尚未实现。候选环境必须显式保持：

```dotenv
QUESTION_ENGINE_EXECUTION_MODE=in-process
```

不要在本次生产切换中把 `.env` 改为 `sidecar`。v1.4b-4 已完成三项 Provider 能力路由、本地假 Provider 全链路契约、版本兼容门禁和自动化故障演练，但默认 `QUESTION_ENGINE_SIDECAR_ACTIVATION_ENABLED=false`，且仍需完成独立环境实机演练。未显式启用时，预检及运行时 readiness 会返回 `sidecar_activation_not_enabled`；能力列表不完整时会返回对应的 `worker_capability_not_configured`；未配置 `QUESTION_ENGINE_ACCEPTED_WORKER_VERSIONS` 时会返回 `worker_version_policy_not_configured`。这些都是安全阻断，不是可忽略告警。`docker compose --profile question-engine ...` 目前只允许在隔离联调环境使用，不属于本生产切换 Runbook 的启动命令。

隔离联调、健康探针、滚动升级和回滚演练必须按 `docs/question-engine-sidecar-rehearsal-runbook-2026-09-28.md` 单独执行；完成演练也不自动授权正式站切换为 Sidecar。

未来隔离联调时，Worker 与 Host 的版本配置必须成对出现；滚动升级可短暂接受两个版本，完成后立即收窄：

```dotenv
QUESTION_ENGINE_WORKER_VERSION=1.0.0
QUESTION_ENGINE_ACCEPTED_WORKER_VERSIONS=1.0.0
```

```bash
cd "$NEXT_DIR"
node scripts/moodlelike-integration-preflight.cjs --env-file=.env
```

必须看到顶层 `status` 为 `ready` 或 `ready_with_warnings`，并且 `questionEngine.status` 为 `inactive`。如果以后把自动出题拆到独立生产实例，再在那个实例执行：

```bash
node scripts/moodlelike-integration-preflight.cjs --env-file=.env --question-engine-production
```

独立题目生产实例必须看到 `questionEngine.status=ready`；任何 `blocked` 都不得上线。

## 9. 候选环境验收

### 9.1 机器检查

```bash
curl -fsSI "http://127.0.0.1:$NEXT_PORT/"
curl -fsS "http://127.0.0.1:$NEXT_PORT/api/v1/ops/ready"
curl -fsSI "http://127.0.0.1:$NEXT_PORT/agent"
docker inspect moodlelike-next-backend-1 --format '{{.State.Health.Status}}'
docker compose -p "$NEXT_PROJECT" --env-file "$NEXT_DIR/.env" -f "$NEXT_DIR/deploy/docker-compose.prod.yml" ps
```

就绪响应还必须满足：学生站为 `questionEngine.status=inactive`；未来独立题目生产实例为 `questionEngine.status=ready`。`blocked` 会让整体状态降级，先按响应里的 `questionEngine.blockers` 修复配置，不要绕过健康检查。

若配置了 `OPS_READY_TOKEN`，第二条改为：

```bash
curl -fsS -H 'Authorization: Bearer 在本机安全粘贴token' "http://127.0.0.1:$NEXT_PORT/api/v1/ops/ready"
```

### 9.2 浏览器人工黄金路径

打开 `http://47.242.60.180:18081`，至少完成：

1. 首页与语言选择；
2. 新用户注册、邮箱验证策略提示、登录、刷新后保持登录；
3. 管理员登录；
4. `/agent` 开始一轮练习、提交答案、进入下一轮；
5. 每题问答只读取当前题上下文；
6. 学习证据、错题、薄弱点与计划生成；
7. 历年题、模考、教学资产；
8. 管理后台内容、用户、团队、审计、AI 和自动出题页面；
9. 上传一个测试附件并重新打开；
10. 浏览器控制台无 401/403/404/500/503 的非预期错误。

### 9.3 数据库只读抽查

```bash
docker exec moodlelike-next-db-1 psql -U "$NEXT_DB_USER" -d "$NEXT_DB_NAME" -Atc "select count(*) from \"_prisma_migrations\" where finished_at is not null;"
docker exec moodlelike-next-db-1 psql -U "$NEXT_DB_USER" -d "$NEXT_DB_NAME" -Atc "select count(*) from pg_tables where schemaname='public';"
docker exec "$OLD_DB_CONTAINER" psql -U "$OLD_DB_USER" -d "$OLD_DB_NAME" -Atc "select count(*) from pg_tables where schemaname='public';"
```

表数不是唯一验收标准；还需按实际模型核对用户、题目、答题证据、组织、内容、任务和上传记录。

## 10. 正式切换前一天

- 候选环境验收全部通过；
- 确认 release SHA 没有变化；
- 确认宝塔安全组无需向公网永久开放 `18081`；正式切流后只需 Nginx 访问本机端口；
- 通知维护窗口；
- 暂停自动出题调度器、后台 worker、邮件批任务和其他写任务；
- 确认旧站仍可启动，旧数据库和旧上传卷没有删除；
- 确认 `$CUTOVER_DIR` 有足够空间容纳第二份数据库和上传备份；
- 在宝塔保存站点配置截图和反向代理目标；
- 明确切换后至少 30 分钟只允许验收账号写入，暂不全面开放用户。

## 11. 正式切换窗口：冻结、最终同步、启动

### 11.1 再次载入第 5 节变量

新的终端不会保留变量。重新执行第 5 节变量块，再验证：

```bash
export CUTOVER_DIR="$(cat /root/cutover-backups/ACTIVE_CUTOVER)"
case "$CUTOVER_DIR" in /root/cutover-backups/*) ;; *) echo 'BAD CUTOVER_DIR'; false ;; esac
export OLD_DB_NAME="$(docker inspect "$OLD_DB_CONTAINER" --format '{{range .Config.Env}}{{println .}}{{end}}' | sed -n 's/^POSTGRES_DB=//p' | head -n 1)"
export OLD_DB_USER="$(docker inspect "$OLD_DB_CONTAINER" --format '{{range .Config.Env}}{{println .}}{{end}}' | sed -n 's/^POSTGRES_USER=//p' | head -n 1)"
export NEXT_DB_NAME="$(docker inspect moodlelike-next-db-1 --format '{{range .Config.Env}}{{println .}}{{end}}' | sed -n 's/^POSTGRES_DB=//p' | head -n 1)"
export NEXT_DB_USER="$(docker inspect moodlelike-next-db-1 --format '{{range .Config.Env}}{{println .}}{{end}}' | sed -n 's/^POSTGRES_USER=//p' | head -n 1)"
export NEXT_UPLOAD_VOLUME='moodlelike-next_moodlelike-uploads'
test -d "$CUTOVER_DIR"
test -f "$BT_SITE_CONF"
test "$(git -C "$NEXT_DIR" rev-parse HEAD)" = "$RELEASE_COMMIT"
test -n "$OLD_DB_NAME"
test -n "$OLD_DB_USER"
test -n "$NEXT_DB_NAME"
test -n "$NEXT_DB_USER"
test "$NEXT_UPLOAD_VOLUME" != "$OLD_UPLOAD_VOLUME"
docker compose -p "$NEXT_PROJECT" --env-file "$NEXT_DIR/.env" -f "$NEXT_DIR/deploy/docker-compose.prod.yml" ps
```

### 11.2 冻结旧站写入

先暂停外部写任务，再停止旧前后端；数据库保持运行以完成最终备份：

```bash
docker stop "$OLD_FRONTEND_CONTAINER" "$OLD_BACKEND_CONTAINER"
docker ps --format '{{.Names}} {{.Status}}' | grep -E "^($OLD_FRONTEND_CONTAINER|$OLD_BACKEND_CONTAINER) " || true
```

此时公网出现短暂维护/502 是预期行为。确认没有其他旧 worker 继续写库；如有，先停止对应容器。

### 11.3 生成最终源库备份

```bash
export FINAL_DB_DUMP="$CUTOVER_DIR/cscalite-final.dump"
docker exec "$OLD_DB_CONTAINER" pg_dump -U "$OLD_DB_USER" -d "$OLD_DB_NAME" --format=custom --no-owner --no-privileges > "$FINAL_DB_DUMP"
test -s "$FINAL_DB_DUMP"
sha256sum "$FINAL_DB_DUMP" | tee "$FINAL_DB_DUMP.sha256"
```

生成最终上传归档：

```bash
docker run --rm \
  -v "$OLD_UPLOAD_VOLUME:/source:ro" \
  -v "$CUTOVER_DIR:/backup" \
  alpine:3.20 sh -c 'cd /source && tar -czf /backup/cscalite-uploads-final.tar.gz .'
test -s "$CUTOVER_DIR/cscalite-uploads-final.tar.gz"
sha256sum "$CUTOVER_DIR/cscalite-uploads-final.tar.gz" | tee "$CUTOVER_DIR/cscalite-uploads-final.tar.gz.sha256"
```

### 11.4 停止候选应用并用最终数据覆盖候选副本

这里仅覆盖已确认的 `moodlelike-next` 候选库，绝不能填写旧生产容器。

```bash
cd "$NEXT_DIR"
docker compose -p "$NEXT_PROJECT" --env-file .env -f deploy/docker-compose.prod.yml stop frontend backend
test "$NEXT_PROJECT" = 'moodlelike-next'
test "$NEXT_DB_NAME" = 'moodlelike'
docker cp "$FINAL_DB_DUMP" moodlelike-next-db-1:/tmp/source-final.dump
docker exec moodlelike-next-db-1 psql -U "$NEXT_DB_USER" -d "$NEXT_DB_NAME" -v ON_ERROR_STOP=1 -c 'DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;'
docker exec moodlelike-next-db-1 pg_restore \
  -U "$NEXT_DB_USER" -d "$NEXT_DB_NAME" \
  --no-owner --no-privileges --exit-on-error \
  /tmp/source-final.dump
docker exec moodlelike-next-db-1 rm -f /tmp/source-final.dump
```

清空并恢复的仅是候选上传卷。三重检查通过后再执行：

```bash
test "$NEXT_PROJECT" = 'moodlelike-next'
test "$NEXT_UPLOAD_VOLUME" = 'moodlelike-next_moodlelike-uploads'
test "$NEXT_UPLOAD_VOLUME" != "$OLD_UPLOAD_VOLUME"
docker run --rm \
  -v "$NEXT_UPLOAD_VOLUME:/restore" \
  -v "$CUTOVER_DIR:/backup:ro" \
  alpine:3.20 sh -c 'find /restore -mindepth 1 -maxdepth 1 -exec rm -rf -- {} + && cd /restore && tar -xzf /backup/cscalite-uploads-final.tar.gz'
```

### 11.5 迁移并启动最终候选

先把 `.env` 中正式 origin 与 Cookie 改为最终 HTTPS 配置：

```bash
cd "$NEXT_DIR"
nano .env
```

至少应为：

```dotenv
MOODLELIKE_HTTP_PORT=18081
PUBLIC_APP_ORIGIN=https://你的正式域名
CORS_ORIGINS=https://你的正式域名
AUTH_COOKIE_SECURE=true
AUTH_COOKIE_DOMAIN=
AUTH_REFRESH_COOKIE_NAME=cscalite_refresh
AUTH_CSRF_COOKIE_NAME=cscalite_csrf
AUTH_CSRF_HEADER_NAME=x-csrf-token
AUTH_GOOGLE_STATE_COOKIE_NAME=cscalite_oauth_state
VITE_AUTH_CSRF_COOKIE_NAME=cscalite_csrf
VITE_AUTH_CSRF_HEADER_NAME=X-CSRF-Token
```

如正式环境暂时只有 HTTP/IP，则 `PUBLIC_APP_ORIGIN`、`CORS_ORIGINS` 使用 `http://47.242.60.180`，并保持 `AUTH_COOKIE_SECURE=false`。不要在 HTTP 下启用 secure Cookie。

构建并启动：

```bash
docker compose -p "$NEXT_PROJECT" --env-file .env -f deploy/docker-compose.prod.yml up -d --build
docker compose -p "$NEXT_PROJECT" --env-file .env -f deploy/docker-compose.prod.yml ps -a
curl -fsSI "http://127.0.0.1:$NEXT_PORT/"
curl -fsS "http://127.0.0.1:$NEXT_PORT/api/v1/ops/ready"
```

如果这里未通过，不要切 Nginx；执行第 13.1 节回滚。

## 12. 宝塔 Nginx 切流

### 12.1 切流前精确验证

确认当前配置中旧 upstream 只出现预期次数，并备份：

```bash
grep -n "127.0.0.1:$OLD_HTTP_PORT" "$BT_SITE_CONF"
grep -o "127.0.0.1:$OLD_HTTP_PORT" "$BT_SITE_CONF" | wc -l
cp -a "$BT_SITE_CONF" "$CUTOVER_DIR/nginx-site.immediately-before-cutover.conf"
```

若命中为 `localhost`，下方替换命令相应改为 `localhost`。如果命中数量不符合预期，停止并在宝塔面板人工修改反向代理目标，不能盲目全局替换。

### 12.2 将 upstream 从旧端口改为 18081

```bash
sed -i "s#127.0.0.1:$OLD_HTTP_PORT#127.0.0.1:$NEXT_PORT#g" "$BT_SITE_CONF"
grep -n "127.0.0.1:$NEXT_PORT" "$BT_SITE_CONF"
```

验证并重载宝塔 Nginx：

```bash
if command -v nginx >/dev/null 2>&1; then NGINX_BIN="$(command -v nginx)"; else NGINX_BIN='/www/server/nginx/sbin/nginx'; fi
if "$NGINX_BIN" -t; then
  if systemctl is-active nginx >/dev/null 2>&1; then systemctl reload nginx; else /etc/init.d/nginx reload; fi
else
  cp -a "$CUTOVER_DIR/nginx-site.immediately-before-cutover.conf" "$BT_SITE_CONF"
  "$NGINX_BIN" -t
  if systemctl is-active nginx >/dev/null 2>&1; then systemctl reload nginx; else /etc/init.d/nginx reload; fi
  echo 'Nginx validation failed; old site config restored.'
  false
fi
```

### 12.3 切流后冒烟

```bash
curl -fsSI "$PROD_ORIGIN/"
curl -fsS "$PROD_ORIGIN/api/v1/ops/ready"
curl -fsSI "$PROD_ORIGIN/agent"
docker compose -p "$NEXT_PROJECT" --env-file "$NEXT_DIR/.env" -f "$NEXT_DIR/deploy/docker-compose.prod.yml" ps
docker compose -p "$NEXT_PROJECT" --env-file "$NEXT_DIR/.env" -f "$NEXT_DIR/deploy/docker-compose.prod.yml" logs --since=10m --tail=300 backend frontend
```

随后由验收账号完成：登录、刷新会话、开始练习、提交答案、生成学习证据、管理员读取、上传文件。确认全部通过后，才结束只允许验收账号写入的观察阶段。

## 13. 回滚命令

### 13.1 情形 A：尚未向普通用户开放，候选站没有必须保留的新写入

这是首选的快速回滚。先冻结候选写入：

```bash
docker stop moodlelike-next-frontend-1 moodlelike-next-backend-1
```

恢复宝塔配置并重载：

```bash
cp -a "$CUTOVER_DIR/nginx-site.immediately-before-cutover.conf" "$BT_SITE_CONF"
if command -v nginx >/dev/null 2>&1; then nginx -t; else /www/server/nginx/sbin/nginx -t; fi
if systemctl is-active nginx >/dev/null 2>&1; then systemctl reload nginx; else /etc/init.d/nginx reload; fi
```

恢复旧站容器：

```bash
docker start "$OLD_DB_CONTAINER"
docker start "$OLD_BACKEND_CONTAINER" "$OLD_FRONTEND_CONTAINER"
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | grep -E "($OLD_DB_CONTAINER|$OLD_BACKEND_CONTAINER|$OLD_FRONTEND_CONTAINER)"
curl -fsSI "$PROD_ORIGIN/"
```

旧源库从未被候选应用写入，因此无需恢复旧数据库，也绝不能把候选库 dump 覆盖回旧库。

### 13.2 情形 B：新站已经向普通用户开放并产生写入

此时禁止直接切回旧站。必须：

1. 立即停止新站前后端，冻结所有写入；
2. 记录故障发生时间和最后成功写入时间；
3. 备份候选数据库和上传卷；
4. 判断新写入是否可以丢弃、人工补录或需要反向迁移；
5. 由回滚决策人明确选择后再执行；
6. 如果需要保留新写入，先编写并演练反向迁移，不得用 `pg_restore --clean` 直接覆盖旧生产库。

先保存故障现场：

```bash
export INCIDENT_ID="$(date -u +%Y%m%dT%H%M%SZ)"
export INCIDENT_DIR="/root/cutover-backups/incident-$INCIDENT_ID"
install -d -m 700 "$INCIDENT_DIR"
docker stop moodlelike-next-frontend-1 moodlelike-next-backend-1
docker exec moodlelike-next-db-1 pg_dump -U "$NEXT_DB_USER" -d "$NEXT_DB_NAME" --format=custom --no-owner --no-privileges > "$INCIDENT_DIR/moodlelike-next-incident.dump"
sha256sum "$INCIDENT_DIR/moodlelike-next-incident.dump" > "$INCIDENT_DIR/moodlelike-next-incident.dump.sha256"
docker compose -p "$NEXT_PROJECT" --env-file "$NEXT_DIR/.env" -f "$NEXT_DIR/deploy/docker-compose.prod.yml" logs --since=2h > "$INCIDENT_DIR/moodlelike-next.log"
```

到此停止。不得自行执行数据库反向覆盖。

### 13.3 仅回滚 Moodlelike release，不回滚数据

如果数据库迁移是向前兼容的，且问题只来自新镜像，可在候选目录部署上一个已验证 commit，同时继续使用候选数据库：

```bash
cd "$NEXT_DIR"
git fetch --prune origin
git checkout --detach 上一个已验证的完整40位commit
docker compose -p "$NEXT_PROJECT" --env-file .env -f deploy/docker-compose.prod.yml up -d --build
docker compose -p "$NEXT_PROJECT" --env-file .env -f deploy/docker-compose.prod.yml ps -a
```

只有确认旧应用代码兼容当前数据库 schema 后才能这样做。不要回滚 Prisma migration 文件或删除新增表。

## 14. 切换后观察与旧站退役

### 14.1 前 30 分钟

每 5 分钟检查：

```bash
docker compose -p "$NEXT_PROJECT" --env-file "$NEXT_DIR/.env" -f "$NEXT_DIR/deploy/docker-compose.prod.yml" ps
docker compose -p "$NEXT_PROJECT" --env-file "$NEXT_DIR/.env" -f "$NEXT_DIR/deploy/docker-compose.prod.yml" logs --since=5m --tail=200 backend
curl -fsS "$PROD_ORIGIN/api/v1/ops/ready"
```

关注：5xx、401/403 激增、刷新登录失败、数据库连接耗尽、答题提交失败、会话串线、重复学习证据、上传 404、后台任务堆积。

### 14.2 前 48 小时

- 每天保留数据库备份；
- 旧 CSCALITE 数据库和上传卷只读保留；
- 旧前后端容器保持停止，但不要 `down -v`；
- 不清理旧镜像；
- 自动出题插件保持禁用或 shadow，除非已经单独通过上线门禁；
- 不裁剪 Prisma schema 和历史 migrations。

### 14.3 至少两个稳定发布周期后

可以停止旧容器，但仍不删除卷：

```bash
docker stop "$OLD_FRONTEND_CONTAINER" "$OLD_BACKEND_CONTAINER" "$OLD_DB_CONTAINER"
docker ps -a --format 'table {{.Names}}\t{{.Status}}' | grep -E "($OLD_DB_CONTAINER|$OLD_BACKEND_CONTAINER|$OLD_FRONTEND_CONTAINER)"
```

归档旧站身份：

```bash
git -C "$OLD_DIR" rev-parse HEAD
docker volume inspect "$OLD_DB_VOLUME" "$OLD_UPLOAD_VOLUME" > "$CUTOVER_DIR/legacy-volumes.json"
sha256sum "$FINAL_DB_DUMP" "$CUTOVER_DIR/cscalite-uploads-final.tar.gz"
```

只有单独批准的退役工单、异地备份校验和恢复演练全部完成后，才能考虑删除旧容器、旧卷或旧目录。本 Runbook 不授权任何 `docker compose down -v`、`docker volume rm` 或递归删除命令。

## 15. 后续 Moodlelike 日常发布

正式切换后，公网继续指向 `moodlelike-next:18081`。稳定后可以把目录逻辑名称改为 `moodlelike-prod`，但不必为了命名立即搬目录或改 project；资源身份稳定比名称好看更重要。

每次发布使用固定 commit，不直接追随不确定的 `main`：

```bash
cd /www/wwwroot/moodlelike-next
git fetch --prune origin
git checkout --detach 新版本完整40位commit
docker compose -p moodlelike-next --env-file .env -f deploy/docker-compose.prod.yml up -d --build
docker compose -p moodlelike-next --env-file .env -f deploy/docker-compose.prod.yml ps -a
curl -fsS http://127.0.0.1:18081/api/v1/ops/ready
```

发布前仍需数据库备份。不要把日常更新简化为未经检查的 `git pull && docker compose up`。

## 16. 发布记录模板

```text
Cutover ID:
执行人：
复核人：
业务验收人：
回滚决策人：

源 CSCALITE commit：
目标 Moodlelike commit：
旧 Compose project：
旧 HTTP 端口：
旧数据库容器/卷：
旧上传卷：
新 Compose project：moodlelike-next
新 HTTP 端口：18081
新数据库容器/卷：moodlelike-next-db-1 / moodlelike-next_moodlelike-postgres-data
新上传卷：moodlelike-next_moodlelike-uploads
宝塔站点配置：

演练完成时间：
停写时间：
最终 dump SHA-256：
最终 uploads SHA-256：
Nginx 切流时间：
首次健康检查时间：
开放普通用户时间：
观察结束时间：
是否回滚：
事故/备注：
```

## 17. 执行时的最终判断

可以继续切流：候选数据库来自停写后的最终 dump、上传归档一致、迁移容器退出码为 0、后端 healthy、登录和答题黄金路径通过、宝塔配置已备份。

必须停止：任何容器/卷身份不明确、候选与旧站共享数据库卷、源目标数据库相同、最终备份为空或校验失败、迁移失败、认证失败、答题数据不能保存、上传丢失、Nginx 配置验证失败。

立即回滚：切流后但开放普通用户前出现关键路径失败，按第 13.1 节恢复宝塔配置和旧容器。

升级为数据事故：开放普通用户后出现问题，按第 13.2 节冻结并备份现场，不得直接切回造成新写入丢失。

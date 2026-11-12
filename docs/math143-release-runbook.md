# 数学 1.43 发布准备、备份与回滚

本次仅完成本地准备。没有登录服务器、读取线上配置、备份线上数据库、推送镜像或操作 cscapilot.com / test.cscapilot.com。下面的正式发布步骤是待授权操作手册，不是已执行记录。

## 候选发布物

当前最新候选为包含学生配图的 `moodlelike-backend:math143-figures-rc-local` / `moodlelike-frontend:math143-figures-rc-local`，迁移镜像仍为下列同一个镜像。不可变 ID 与最新证据见 [生产准备验收](math143-production-preparation.md) 及 `.local/math143-figures-release/release-manifest.json`。旧 `math143-rc-local` 标签为保留基线，发布时不得混用。读图试点默认关闭。

- 后端镜像：`moodlelike-backend:math143-rc-local`，使用 `deploy/backend.Dockerfile` 的最终 runtime 阶段。
- 前端镜像：`moodlelike-frontend:math143-rc-local`，实际 Nginx + Vite 生产构建。
- 迁移镜像：`moodlelike-backend:math143-migrate-local`，同一后端 Dockerfile 的 build 阶段，保留 Prisma CLI。不要用不含 CLI 的 runtime 镜像执行迁移。
- 唯一正式生成插件：`verified-math-1.43`。归档、1,152 个冻结文件、依赖均在镜像内；不挂载本地源码或安装目录。
- 发布覆盖配置：`deploy/docker-compose.math143-release.yml`。默认关闭数学生成；旧生成、审核、题意映射及调度开关均关闭。

候选镜像不可变 ID、源码与迁移摘要见本地 `.local/math143-release/release-manifest.json`。标签仅用于本地查找；正式发布应使用审核过的仓库摘要，或导入后核对相同镜像 ID。不要在发布时从变化中的工作区重新构建。

工作区已有其他任务的未提交修改。镜像封装的是本次构建时实际代码，manifest 逐项记录源码摘要和工作区差异，避免把候选镜像误认为一个干净的已审核提交。发布前必须核对这份差异清单；本次不擅自提交、撤销或推送其他任务的改动。

## 重现本地验收

```powershell
docker build -f deploy/backend.Dockerfile -t moodlelike-backend:math143-rc-local .
docker build --target build -f deploy/backend.Dockerfile -t moodlelike-backend:math143-migrate-local .
docker build -f deploy/frontend.Dockerfile -t moodlelike-frontend:math143-rc-local .
node scripts/math143-production-rehearsal.cjs
node scripts/math143-migration-upgrade-rehearsal.cjs
node scripts/math143-release-config-test.cjs
node scripts/math143-release-manifest.cjs
```

验证配图最新候选时，前后端构建标签改为 `math143-figures-rc-local`；上述四个 `node scripts/math143-*.cjs` 命令均追加 `--figures`，使用独立的 `.local/math143-figures-release/` 证据与恢复副本。不会覆盖基线证据。

演练脚本拒绝远程 Docker context，不读取根目录 `.env`。每次创建全新的本地 Compose 项目、随机凭据、独立数据库，后端/数据库/迁移容器只连接禁止外连的 internal 网络。仅 Nginx 额外连接本地端口桥接网络，浏览器阻断非本地请求。仅监听 `127.0.0.1:18091`；聊天凭据为无效演练值，不验证聊天 Provider 服务。不会调用业务站点或 SMTP。

覆盖生产入口启动与 readiness、Nginx 学生 UI、数学生成/校验/发布/做题、幂等与双语答案隔离，以及真实 `pg_dump` / 新库 `pg_restore`。恢复后逐表比较 public schema 全部表的行数及内容摘要，包括迁移、题库、学生和学习记录。另演练停用插件后的三科题库判题提交，再重新启用插件。

随后在上述一次性恢复副本中模拟“尚未应用 0100/0101”的已有数据状态，执行同一迁移镜像的真实 migrate deploy，逐表确认原有题库、用户和学习记录未变。该步骤只重建恢复副本中的两个新增对象，不操作源验收库或任何站点。manifest 分别记录工作区审阅清单及镜像内部实际编译产物摘要，新增验收工具不会冒充已打包的应用文件。

结果、截图、演练 dump 和项目名称保存于 `.local/math143-release/`。演练结束停止本次项目，保留卷供检查；不删除已有容器或数据。凭据和备份不提交 Git。

## 正式发布窗口前需要采集的现场信息

目前尚未访问线上，所以下列值必须在得到正式发布授权后核对，不能使用开发默认值代替：

1. 正式站 CPU 架构、当前项目名、Compose 基础文件、环境文件路径、数据库实际名称和卷绑定。本地镜像为 Linux/amd64，发布目标需兼容。
2. 当前前后端镜像 ID/摘要、启动参数、上传目录和反向代理配置；保留原镜像及配置副本。
3. 线上 `_prisma_migrations` 中已成功的迁移列表和待执行列表。确认没有 failed migration、其他未审核迁移或 schema drift。
4. PostgreSQL 主版本、可用空间、备份位置与恢复账号权限；真实备份恢复演练所需的隔离位置。
5. 现有聊天、邮件、Cookie、域名及支付配置按原值保留。此次只增加正式数学插件开关，不迁移产品身份或重命名资源。

## 备份步骤（待正式发布授权后执行）

安排短暂维护窗口，暂停学生写入、后台任务及其他数据库写入者。确认没有正在处理的出题任务，避免数据库与上传文件备份时间不一致。记录维护开始时间和负责人。

以下为 Linux 发布主机模板。先填写实际已核对的路径及项目名；不要直接套用本地 Compose 项目。`dc` 始终指向既有正式项目，不能包含 test 站点。

```bash
set -euo pipefail
umask 077
# 填入现场核对值，保持既有资源标识。
: "${EXISTING_COMPOSE:?}" "${EXISTING_ENV:?}" "${EXISTING_PROJECT:?}" "${BACKUP_ROOT:?}"
dc() { docker compose --env-file "$EXISTING_ENV" -p "$EXISTING_PROJECT" -f "$EXISTING_COMPOSE" "$@"; }
release_dir="$BACKUP_ROOT/math143-$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$release_dir"
dc images > "$release_dir/previous-images.txt"
dc config > "$release_dir/previous-compose.private.yml"
cp "$EXISTING_ENV" "$release_dir/previous-env.private"
dc exec -T db sh -eu -c 'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner --no-privileges' > "$release_dir/database.dump"
dc exec -T db sh -eu -c 'exec pg_dumpall -U "$POSTGRES_USER" --globals-only' > "$release_dir/roles.private.sql"
test -s "$release_dir/database.dump"
sha256sum "$release_dir/database.dump" > "$release_dir/database.dump.sha256"
dc exec -T db pg_restore --list < "$release_dir/database.dump" > "$release_dir/database.contents.txt"
```

`compose config`、角色备份和环境副本可能包含密钥，必须使用受限目录，不回传聊天、不放入仓库或 Web 目录。还需备份现场核对的上传卷/对象存储及代理配置，记录各自时间戳与摘要，并将备份复制到应用容器和当前磁盘之外的受控存储。

把真实 dump 恢复到一个新建的隔离数据库，使用与线上兼容的 PostgreSQL 工具。校验用户、三科题库、学习记录、迁移记录的行数及内容摘要。只有 `pg_restore --exit-on-error` 成功且校验一致才算备份可用；仅有 dump 文件或 `--list` 不足以放行。当前已完成的是本地真实演练，不冒充线上真实备份已完成。

## 迁移与启用顺序

1. 锁定已验收镜像并核对正式发布范围。渲染“既有基础配置 + release 覆盖配置”，比较数据库连接、卷、端口、域名及 Cookie 配置，确认未改变资源身份。
2. 检查待迁移 SQL。0100 只新增生成题数学身份唯一索引；0101 只新增供题任务表与索引。本次没有删库、删题或重写三科题库的迁移。其他待迁移项需单独审核，不能因为执行 migrate deploy 而一并默认批准。
3. 完成上述备份与隔离恢复后，用已验收迁移镜像执行 `node scripts/prisma-cli.cjs migrate deploy`。覆盖配置已去掉历史演示、题库导入及内容 seed 步骤。
4. 先以 `MATH143_GENERATION_ENABLED=false` 更新既有 backend/frontend，使用 `up -d --no-build --no-deps backend frontend`；不要执行 `down -v`，不要重新创建数据库服务或更换卷。
5. 验证 readiness、三科旧题库与历史学习记录，再设 `MATH143_GENERATION_ENABLED=true`，只重建 backend 容器。前端无需第二次构建。
6. 用专用验收账号检验知识点/三档难度、缺题生成、双语读题、判题、提交及学习记录；监控任务失败、响应超时、数据库连接与生成队列。通过后结束维护窗口。

正常路径保留既有业务环境，不复制演练中的随机凭据或假聊天配置。test.cscapilot.com 不在此次发布目标内。

## 回滚层级

**首选：仅关闭数学生成，保留当前已验证镜像与全部新数据。** 将 `MATH143_GENERATION_ENABLED=false`，按同一基础配置与覆盖配置执行 `up -d --no-build --no-deps backend`。确认引擎状态 inactive，三科原有题库仍可作答提交。没有生成任务再运行后，检查恢复前后题库/学习记录行数。这条路径已在本地生产镜像实际演练。

**应用回滚：恢复发布前的前后端镜像摘要与环境配置。** 先暂停写入并保留失败现场日志，保持数据库、上传卷、域名及 Cookie 设置。0100/0101 为新增对象，默认不执行逆向 SQL，不删生成题或任务表。但具体线上旧镜像目前未知，其与新 schema/生成题来源的兼容性必须在发布授权后用同一旧镜像和隔离库验证，不能凭本地演练保证任意旧版本都兼容。

**数据库恢复：仅用于数据损坏，另行确认。** 保持写入冻结，先备份故障后的数据库和上传文件以便保全发布后新增作答。将发布前备份恢复到一个新的数据库名，校验后再显式切换业务连接，不覆盖原库、不删除原卷。数据库恢复会回到备份时间点，必须先处理新增作答的保全/补录及上传文件时间一致性。未经确认不在生产执行 `pg_restore --clean`、DROP、重建 schema 或自动恢复。

回滚验收：原有三科练习可读可写、学生身份与 Cookie 正常、无重复学习证据、任务停止生成、关键表行数与期望一致。记录镜像摘要、回滚层级、时间、负责人和验证结果。

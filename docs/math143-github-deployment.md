# 从 GitHub 固定提交发布到正式 Moodlelike

本流程替代手工上传镜像包。正式目标为 `moodlelike-next`、18081、`/www/wwwroot/moodlelike-next`、数据库 `moodlelike` 和既有卷 `moodlelike-next_moodlelike-postgres-data`。不操作 18080 的旧项目、test 站点或独立 Math Lab。

发布分支：`codex/math143-student-release`，仓库：`https://github.com/Miyazak1/moodleloke.git`。具体完整 SHA 由发布消息给出。不要使用变化中的 `main` 或在正式目录直接 `git pull` 后默认启动。

## 本次范围

- 数学 1.43 唯一正式供题插件、持久化任务、校验入库、学生自由练习难度选择及三科既有题库兼容。
- 必要的每日任务执行记录、独立验证上下文、供题覆盖和管理员观测依赖；对应原有 0098 基线后的 0099，以及插件 0100/0101。观测接口不注册其他正式出题引擎。
- 原生/公开条件配图、题干/选项/公式/图标排版、宽窄屏及复盘。读图试点代码仅作为默认关闭的试验模块，发布覆盖配置明确关闭它。
- 生产构建、迁移预检、备份恢复及回滚工具和验收记录。24 MB 冻结运行包有 SHA 校验，服务器无需另一个源码仓库。

不提交 `.env`、本地数据库/备份、CSV 历史导出、临时 PDF/截图工作目录或上游包含内部留出答案的完整配图交接包。配图运行依赖单独纳入版本控制，交接包只保留来源 SHA。

## 1. 拉取指定提交并构建候选镜像

在服务器宝塔终端的 Bash 中操作，先把第一行替换为发布消息的完整 SHA。新源码放到 `/root` 的独立目录；正式目录、运行配置和数据卷保持当前状态。

```bash
set -euo pipefail
RELEASE_COMMIT='替换为发布消息中的40位SHA'
[[ "$RELEASE_COMMIT" =~ ^[a-f0-9]{40}$ ]]
SOURCE=/root/moodlelike-math143-source-${RELEASE_COMMIT:0:12}
REL=/root/moodlelike-math143-git-20261112
APP=/www/wwwroot/moodlelike-next

git clone --branch codex/math143-student-release --single-branch \
  https://github.com/Miyazak1/moodleloke.git "$SOURCE"
git -C "$SOURCE" checkout --detach "$RELEASE_COMMIT"
test "$(git -C "$SOURCE" rev-parse HEAD)" = "$RELEASE_COMMIT"
bash "$SOURCE/deploy/math143-prepare-git.sh" "$RELEASE_COMMIT" "$REL"
```

脚本仅构建三个新标签的镜像，不迁移或更新服务；读取现有后端的非敏感 CSRF 名称作为前端编译参数，保留旧镜像。若已有 `release.env` 会停止，避免覆盖已经启用的发布配置。Docker 构建需要访问已有依赖源；使用锁文件，但服务器构建出来的镜像 ID 可能与本地不同，不能冒充相同二进制。

## 2. 渲染配置和只读迁移预检

```bash
umask 077
dc() { docker compose --env-file "$APP/.env" -p moodlelike-next -f "$APP/deploy/docker-compose.prod.yml" "$@"; }
rdc() { docker compose --env-file "$APP/.env" --env-file "$REL/release.env" -p moodlelike-next -f "$APP/deploy/docker-compose.prod.yml" -f "$REL/release.yml" "$@"; }

test "$(dc ps -q db)" = "$(docker inspect moodlelike-next-db-1 --format '{{.Id}}')"
rdc config --format json > "$REL/rendered.private.json"
rdc run --rm --no-deps -v "$REL/migration-preflight.cjs:/tmp/math143-preflight.cjs:ro" \
  migrate node /tmp/math143-preflight.cjs
```

预检必须 `status: pass`，基线 0098，待执行仅 0099/0100/0101；检查失败停止。渲染文件可能含密钥，不能回传聊天。核对正式端口仍为 18081、数据库和卷未变、既有域名/Cookie/Provider 配置保留、生成默认关闭。正式构建与本地相同提交仍需现场 readiness 和学生链路验收。

## 3. 真实备份、恢复、迁移、启用与回滚

保持上面的 `APP`、`REL`、`dc`、`rdc` 定义，依次执行 [定向发布手册](math143-moodlelike-next-deployment.md) **第 3 至第 7 阶段**的完整命令：

1. 保存旧镜像、环境、Compose、代理、数据库与上传文件，暂停写入，保留维护窗口。
2. 无网络独立 PostgreSQL 容器恢复真实备份，逐表校验；备份复制到独立受控存储。
3. schema-only 迁移；关闭生成更新前后端，等待 healthy，检查三科旧题库和学习历史。
4. 开启 `verified-math-1.43`，等待 healthy，验收真实学生出题、配图、判题提交、幂等和移动端。
5. 首选回滚为关闭数学生成，不回退或覆盖数据库。完整应用回滚仍需验证现场旧镜像与新增 schema 的兼容性。

这里的 `REL` 是 `/root/moodlelike-math143-git-20261112`，**跳过镜像包手册第 1 阶段**，不要把它改回上传包目录。以后维护继续使用两份配置及两份 env 文件；既有正式目录的 `.env` 和基础 Compose 不被此流程覆盖。任何一步失败先恢复旧服务或保持生成关闭，不自动恢复数据库。

本地证据：最终候选组合实际 Nginx 学生链路、150 表备份恢复和插件停用/重启用通过；从模拟 0098 的已填充恢复副本升级后 147 张原业务表内容不变。它们不替代线上真实数据恢复验证，也不表示全仓所有历史 CI 门禁均已通过。

发布整理时另外修正了旧静态约定：可见品牌保持 CSCAPilot，Moodlelike 仅作资源/Cookie 命名；旧 Provider 能力断言改为要求退役并校验唯一数学激活门禁；四个已有命令补齐分类。构建、OAuth、Agent、候选入库、任务协议、唯一插件、配图、前端路由及余下发布契约分项通过。完整 GitHub CI/浏览器黄金路径状态以远端该提交实际运行结果为准，不冒充已经全量重跑。

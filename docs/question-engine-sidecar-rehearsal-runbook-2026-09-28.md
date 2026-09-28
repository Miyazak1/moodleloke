# Question Engine Sidecar 独立联调与滚动升级 Runbook

日期：2026-09-28
适用阶段：v1.4c-v1.4e 隔离联调、运行态验收与证据留存
生产结论：本 Runbook 不授权切换正式学生站，正式站继续使用 `QUESTION_ENGINE_EXECUTION_MODE=in-process`。

## 1. 安全边界

本流程只验证容器、Redis、健康接口、任务协议、Worker 版本与能力声明，不执行真实出题任务，不调用真实 Provider，不写入题库，不发布学生内容。

执行期间必须保持：

```dotenv
QUESTION_ENGINE_EXECUTION_MODE=in-process
QUESTION_ENGINE_SIDECAR_ACTIVATION_ENABLED=false
CSCA_AI_QUESTION_GENERATION_ENABLED=false
CSCA_AI_QUESTION_REVIEW_ENABLED=false
CSCA_AI_TOPIC_MAPPING_ENABLED=false
CSCA_SUBJECT_PRACTICE_PRODUCTION_ENABLED=false
CSCA_AI_QUESTIONING_SCHEDULER_ENABLED=false
```

不要把 Provider API Key 粘贴到终端输出、截图或本文档中。

## 2. 变量约定

在服务器项目目录执行：

```bash
cd /www/wwwroot/moodlelike-demo
export QE_PROJECT=moodlelike-demo
export QE_ENV_FILE=.env
export QE_COMPOSE_FILE=deploy/docker-compose.prod.yml
export QE_EVIDENCE_DIR=/www/backup/moodlelike-question-engine-rehearsal-20260928-01
mkdir -p "$QE_EVIDENCE_DIR"
chmod 700 "$QE_EVIDENCE_DIR"
```

确认当前学生站和基础服务正常：

```bash
docker compose -p "$QE_PROJECT" --env-file "$QE_ENV_FILE" -f "$QE_COMPOSE_FILE" ps
docker compose -p "$QE_PROJECT" --env-file "$QE_ENV_FILE" -f "$QE_COMPOSE_FILE" exec -T redis redis-cli ping
```

Redis 必须返回 `PONG`，backend、db、redis、frontend 必须保持健康。

## 3. 生成只读升级计划

下面的命令只打印计划，不修改 `.env`，也不执行 Docker 命令：

```bash
node scripts/question-engine-sidecar-rehearsal.cjs \
  --from=1.0.0 \
  --to=1.1.0 \
  --project="$QE_PROJECT" \
  --env-file="$QE_ENV_FILE" \
  --compose-file="$QE_COMPOSE_FILE"
```

机器可读版本：

```bash
node scripts/question-engine-sidecar-rehearsal.cjs --from=1.0.0 --to=1.1.0 --project="$QE_PROJECT" --env-file="$QE_ENV_FILE" --compose-file="$QE_COMPOSE_FILE" --json
```

## 4. 启动隔离 Worker

先在 `.env` 中设置基线版本和能力，但继续保持 Host 为 `in-process`：

```dotenv
QUESTION_ENGINE_WORKER_VERSION=1.0.0
QUESTION_ENGINE_ACCEPTED_WORKER_VERSIONS=1.0.0
QUESTION_ENGINE_WORKER_CAPABILITIES=question.generate,question.review,question.topic-map
QUESTION_ENGINE_SIDECAR_URL=http://question-engine-worker:3100/v1/tasks/execute
QUESTION_ENGINE_TASK_KEY_ID=sidecar-rehearsal-v1
QUESTION_ENGINE_TASK_HMAC_SECRET=使用密码管理器保存的至少32字符随机值
QUESTION_ENGINE_NONCE_REDIS_URL=redis://redis:6379
```

可在服务器终端生成随机值，再只粘贴到 `.env`，不要把输出发到聊天或截图中：

```bash
openssl rand -hex 32
```

只启动 profile 中的 Worker：

```bash
docker compose -p "$QE_PROJECT" --profile question-engine --env-file "$QE_ENV_FILE" -f "$QE_COMPOSE_FILE" up -d --build question-engine-worker
docker compose -p "$QE_PROJECT" --profile question-engine --env-file "$QE_ENV_FILE" -f "$QE_COMPOSE_FILE" ps
docker compose -p "$QE_PROJECT" --profile question-engine --env-file "$QE_ENV_FILE" -f "$QE_COMPOSE_FILE" logs --tail=100 question-engine-worker
```

Worker 没有宿主机端口，健康探针应从 backend 容器内部执行：

```bash
docker compose -p "$QE_PROJECT" --profile question-engine --env-file "$QE_ENV_FILE" -f "$QE_COMPOSE_FILE" exec -T backend \
  node scripts/moodlelike-integration-preflight.cjs --probe-question-engine-worker
```

必须看到 `questionEngineWorkerProbe.status` 为 `pass`，并确认：

- `protocol=question-engine-task-v1`；
- `worker.version=1.0.0`；
- 三项 capability 都存在；
- `blockers=[]`。

此时 Host 仍为 `in-process`，后台运行态显示 `not_applicable` 属于预期，不影响就绪状态。只有后续获批切换为 `sidecar` 且打开 activation 后，Host 才会持续执行只读健康探测。

同时保存机器可验证的原始探针和脱敏证据摘要：

```bash
docker compose -p "$QE_PROJECT" --profile question-engine --env-file "$QE_ENV_FILE" -f "$QE_COMPOSE_FILE" exec -T backend \
  node scripts/moodlelike-integration-preflight.cjs --probe-question-engine-worker \
  > "$QE_EVIDENCE_DIR/baseline-probe.json"

node scripts/question-engine-sidecar-evidence.cjs \
  --phase=baseline \
  --expected-version=1.0.0 \
  --probe-file="$QE_EVIDENCE_DIR/baseline-probe.json" \
  --output="$QE_EVIDENCE_DIR/baseline-evidence.json"
```

证据命令必须输出 `status=passed`；文件已存在时工具会拒绝覆盖。原始探针可能包含内部健康地址，只能保存在权限为 `700` 的演练目录中；用于评审和归档的是 `*-evidence.json` 脱敏摘要。

## 5. 滚动升级演练

### 5.1 打开双版本兼容窗口

把 `.env` 改为：

```dotenv
QUESTION_ENGINE_WORKER_VERSION=1.0.0
QUESTION_ENGINE_ACCEPTED_WORKER_VERSIONS=1.0.0,1.1.0
```

重建 Host 并重新执行健康探针：

```bash
docker compose -p "$QE_PROJECT" --profile question-engine --env-file "$QE_ENV_FILE" -f "$QE_COMPOSE_FILE" up -d --force-recreate backend
docker compose -p "$QE_PROJECT" --profile question-engine --env-file "$QE_ENV_FILE" -f "$QE_COMPOSE_FILE" exec -T backend node scripts/moodlelike-integration-preflight.cjs --probe-question-engine-worker
```

### 5.2 升级 Worker

把 `.env` 中 `QUESTION_ENGINE_WORKER_VERSION` 改为 `1.1.0`，兼容窗口暂时不变，然后执行：

```bash
docker compose -p "$QE_PROJECT" --profile question-engine --env-file "$QE_ENV_FILE" -f "$QE_COMPOSE_FILE" up -d --build --force-recreate question-engine-worker
docker compose -p "$QE_PROJECT" --profile question-engine --env-file "$QE_ENV_FILE" -f "$QE_COMPOSE_FILE" exec -T backend node scripts/moodlelike-integration-preflight.cjs --probe-question-engine-worker
```

探针必须显示 `worker.version=1.1.0` 且状态为 `pass`。

保存升级阶段证据：

```bash
docker compose -p "$QE_PROJECT" --profile question-engine --env-file "$QE_ENV_FILE" -f "$QE_COMPOSE_FILE" exec -T backend \
  node scripts/moodlelike-integration-preflight.cjs --probe-question-engine-worker \
  > "$QE_EVIDENCE_DIR/upgrade-worker-probe.json"

node scripts/question-engine-sidecar-evidence.cjs \
  --phase=upgrade-worker \
  --expected-version=1.1.0 \
  --probe-file="$QE_EVIDENCE_DIR/upgrade-worker-probe.json" \
  --output="$QE_EVIDENCE_DIR/upgrade-worker-evidence.json"
```

### 5.3 收窄兼容窗口

把 `.env` 改为：

```dotenv
QUESTION_ENGINE_WORKER_VERSION=1.1.0
QUESTION_ENGINE_ACCEPTED_WORKER_VERSIONS=1.1.0
```

然后重建 backend 并再次探测：

```bash
docker compose -p "$QE_PROJECT" --profile question-engine --env-file "$QE_ENV_FILE" -f "$QE_COMPOSE_FILE" up -d --force-recreate backend
docker compose -p "$QE_PROJECT" --profile question-engine --env-file "$QE_ENV_FILE" -f "$QE_COMPOSE_FILE" exec -T backend node scripts/moodlelike-integration-preflight.cjs --probe-question-engine-worker
```

用相同方式保存 `close-compatibility-window-probe.json`，并把证据参数改为：

```bash
--phase=close-compatibility-window --expected-version=1.1.0
```

## 6. 回滚演练

先重新打开双版本窗口，再恢复旧 Worker，最后收窄为旧版本：

```dotenv
QUESTION_ENGINE_WORKER_VERSION=1.0.0
QUESTION_ENGINE_ACCEPTED_WORKER_VERSIONS=1.0.0,1.1.0
```

```bash
docker compose -p "$QE_PROJECT" --profile question-engine --env-file "$QE_ENV_FILE" -f "$QE_COMPOSE_FILE" up -d --force-recreate backend
docker compose -p "$QE_PROJECT" --profile question-engine --env-file "$QE_ENV_FILE" -f "$QE_COMPOSE_FILE" up -d --build --force-recreate question-engine-worker
docker compose -p "$QE_PROJECT" --profile question-engine --env-file "$QE_ENV_FILE" -f "$QE_COMPOSE_FILE" exec -T backend node scripts/moodlelike-integration-preflight.cjs --probe-question-engine-worker
```

探针通过后，把 `QUESTION_ENGINE_ACCEPTED_WORKER_VERSIONS` 收窄为 `1.0.0`，重建 backend 并再探测一次。

回滚阶段分别使用 `--phase=rollback` 和 `--phase=rollback-finalize`，两者的 `--expected-version` 都是 `1.0.0`。任何证据输出为 `blocked` 时都不得继续下一阶段。

## 7. 故障判定

以下任意结果都表示演练失败，禁止切换 Sidecar：

- `question_engine_worker_health_timeout`；
- `question_engine_worker_health_unavailable`；
- `worker_protocol_mismatch`；
- `worker_version_not_accepted`；
- `worker_capability_missing:*`；
- Worker 容器 unhealthy/restarting；
- Redis 非健康；
- 学生站 backend 或 frontend 因演练重建而无法恢复健康。

查看诊断信息：

```bash
docker compose -p "$QE_PROJECT" --profile question-engine --env-file "$QE_ENV_FILE" -f "$QE_COMPOSE_FILE" ps -a
docker compose -p "$QE_PROJECT" --profile question-engine --env-file "$QE_ENV_FILE" -f "$QE_COMPOSE_FILE" logs --tail=300 backend question-engine-worker redis
```

若在隔离环境中专门验收运行态联动，可在已设置 `sidecar` 和 activation 的 Host 内调用受保护的就绪接口，并检查 `questionEngine.runtime`。鉴权方式沿用当前运维接口配置，不要把令牌写入命令历史、截图或文档：

```bash
curl -fsS -H "Authorization: Bearer $OPS_READY_TOKEN" http://127.0.0.1:18080/api/v1/ops/ready
```

预期结果：Worker 正常时 `questionEngine.status=ready`、`runtime.worker.status=healthy` 且 `runtime.transport.circuit.open=false`；Worker 不可达、协议/版本/能力不兼容或熔断打开时，整体就绪必须降级。后台 Question Engine 页面应显示相同的无密钥运行态摘要。

仅在获批的隔离环境已实际启用 Sidecar 时，可以把上述响应保存为 `$QE_EVIDENCE_DIR/runtime-ready.json`，并在证据命令中追加：

```bash
--readiness-file="$QE_EVIDENCE_DIR/runtime-ready.json"
```

此时证据还会强制检查运行态为 `ready`、Worker 为 `healthy`、版本精确匹配、blocker 为空且熔断关闭。正式学生站保持 `in-process` 时不要为了生成该字段而切换开关。

## 8. 结束演练

停止可选 Worker，不影响现有学生站服务：

```bash
docker compose -p "$QE_PROJECT" --profile question-engine --env-file "$QE_ENV_FILE" -f "$QE_COMPOSE_FILE" stop question-engine-worker
```

最终再次确认 `.env`：

```dotenv
QUESTION_ENGINE_EXECUTION_MODE=in-process
QUESTION_ENGINE_SIDECAR_ACTIVATION_ENABLED=false
```

本 Runbook 完成只代表隔离运行和升级路径通过，不构成真实 Provider 调用、自动出题批次、数据库写入或学生内容发布授权。

演练归档至少保留：版本化 rollout plan、各阶段 `*-evidence.json`、执行人、执行时间、目标 Git commit、Docker 镜像摘要和最终回滚/收窄结论。不要归档 `.env`、访问令牌、签名密钥或 Provider 配置。

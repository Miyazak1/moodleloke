# DeepSeek First AI Gateway 上线与回滚 Runbook

日期：2026-07-09

配套文档：

- `docs/deepseek-first-ai-gateway-executable-plan-2026-07-09.md`
- `docs/deepseek-first-ai-gateway-interface-and-data-spec-2026-07-09.md`
- `docs/deepseek-first-ai-gateway-phase-1-work-orders-2026-07-09.md`

## 1. 适用范围

本文档用于 AI Gateway Phase 1 上线：

- 生产前期只使用 DeepSeek。
- 支持一个或多个 DeepSeek Key。
- 所有 AI 调用统一走 Gateway。
- 保留旧配置兼容和回滚开关。

## 2. 上线前检查

### 2.1 代码检查

运行：

```bash
rg "fetch\\(.*chat/completions" backend/src
rg "CSCA_AI_.*API_KEY|DEEPSEEK_API_KEYS" backend/src
```

期望：

- `/chat/completions` 直接调用只出现在 `backend/src/ai-gateway/providers/`。
- 业务服务不直接读取 API Key。
- 允许配置服务读取 env。

### 2.2 构建检查

```bash
npm run backend:build
npm run frontend:build
```

### 2.3 功能检查

在测试环境运行：

```bash
npm run csca-ai-questioning:rules
npm run csca-ai-questioning:smoke
npm run csca-ai-questioning:subject-closure-smoke
npm run csca-mock-exam-ai-generation:smoke
```

如果测试环境没有真实 DeepSeek key，应确认 mock/fallback 分支仍通过。

### 2.4 数据库迁移

如果 Phase 1 新增 `AiGatewayCallLog`：

```bash
npm run db:migrate
```

上线前确认：

```bash
npm run prisma:validate
```

## 3. 环境变量配置

### 3.1 单 DeepSeek Key

推荐生产配置：

```env
AI_GATEWAY_ENABLED=true
AI_DEFAULT_PROVIDER=deepseek
AI_GATEWAY_LEDGER_ENABLED=true

DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_API_KEYS=sk-xxx
DEEPSEEK_DEFAULT_MODEL=deepseek-chat
DEEPSEEK_REASONER_MODEL=deepseek-reasoner

AI_GATEWAY_GLOBAL_CONCURRENCY=5
AI_GATEWAY_REALTIME_CONCURRENCY=3
AI_GATEWAY_BACKGROUND_CONCURRENCY=2
AI_GATEWAY_REALTIME_QUEUE_TIMEOUT_MS=5000
AI_GATEWAY_BACKGROUND_QUEUE_TIMEOUT_MS=120000
DEEPSEEK_KEY_CONCURRENCY=2

AI_GATEWAY_DEFAULT_TIMEOUT_MS=30000
AI_GATEWAY_STUDENT_TIMEOUT_MS=15000
AI_GATEWAY_BACKGROUND_TIMEOUT_MS=60000
```

### 3.2 多 DeepSeek Key

```env
DEEPSEEK_API_KEYS=sk-key1,sk-key2,sk-key3
DEEPSEEK_KEY_CONCURRENCY=2
```

说明：

- 每个 key 最多 2 并发。
- 3 个 key 理论 DeepSeek 总并发为 6，但仍受 `AI_GATEWAY_GLOBAL_CONCURRENCY` 限制。

### 3.3 只开启学生实时 AI

```env
AI_GATEWAY_ENABLED=true
CSCA_AI_COACH_ENABLED=true
CSCA_AI_QUESTION_GENERATION_ENABLED=false
CSCA_AI_QUESTION_REVIEW_ENABLED=false
```

### 3.4 只开启后台出题

```env
AI_GATEWAY_ENABLED=true
CSCA_AI_COACH_ENABLED=false
CSCA_AI_QUESTION_GENERATION_ENABLED=true
CSCA_AI_QUESTION_REVIEW_ENABLED=true
```

### 3.5 完全关闭外部 AI

```env
AI_GATEWAY_ENABLED=false
CSCA_AI_COACH_ENABLED=false
CSCA_AI_QUESTION_GENERATION_ENABLED=false
CSCA_AI_QUESTION_REVIEW_ENABLED=false
CSCA_AI_PROVIDER=rule-fallback
```

## 4. 宝塔面板部署步骤

假设项目目录：

```bash
/www/wwwroot/cscalite
```

更新代码：

```bash
cd /www/wwwroot/cscalite
git fetch origin
git checkout codex/adaptive-ai-questioning
git pull --ff-only origin codex/adaptive-ai-questioning
```

安装依赖：

```bash
npm install
npm --prefix backend install
npm --prefix frontend install
```

迁移和构建：

```bash
npm run db:migrate
npm run build
```

重启：

```bash
pm2 restart cscalite-backend --update-env
pm2 save
```

如果使用宝塔 Node 项目管理器，则在面板里重启对应 Node 项目。

## 5. Docker 部署步骤

```bash
cd /www/wwwroot/cscalite
git fetch origin
git checkout codex/adaptive-ai-questioning
git pull --ff-only origin codex/adaptive-ai-questioning

docker compose --env-file deploy/.env -f deploy/docker-compose.prod.yml up -d --build
```

确认 migrate 服务成功执行。

## 6. 上线后验证

### 6.1 健康检查

```bash
curl -fsS http://127.0.0.1:3000/api/v1/health
curl -fsS http://127.0.0.1:3000/api/v1/ops/ready
```

如果新增 Gateway health endpoint：

```bash
curl -fsS http://127.0.0.1:3000/api/v1/admin/ai-gateway/health
```

### 6.2 管理后台检查

进入：

```text
/zh/admin/ai-operations
/zh/admin/ai-question-bank
/zh/admin/audit
```

检查：

- Provider 状态是否 healthy。
- DeepSeek key 是否 enabled。
- realtime/background running 是否正常。
- 最近调用是否写入 ledger。
- 失败原因是否可见。

### 6.3 学生侧检查

检查：

- 科目训练能正常开始。
- AI Coach 提示能返回。
- 题目解释能返回或规则 fallback。
- 后台出题不会影响学生页面响应。

## 7. 监控指标

上线后 24 小时重点看：

| 指标 | 预期 |
| --- | --- |
| Provider error rate | < 5% |
| Provider timeout rate | < 5% |
| AI Coach p95 latency | < 8s |
| question_generation success rate | 持续稳定 |
| key cooldown count | 不应持续升高 |
| realtime queue length | 接近 0 |
| background queue length | 可积压但应持续消化 |

## 8. 常见问题处理

### 8.1 DeepSeek 429 限流

现象：

- errorCode = `provider_rate_limited`
- key 进入 cooldown

处理：

1. 降低并发：

```env
DEEPSEEK_KEY_CONCURRENCY=1
AI_GATEWAY_BACKGROUND_CONCURRENCY=1
```

2. 暂停后台生成：

```env
CSCA_AI_QUESTION_GENERATION_ENABLED=false
```

3. 重启后端。

### 8.2 DeepSeek 超时

处理：

```env
AI_GATEWAY_STUDENT_TIMEOUT_MS=12000
AI_GATEWAY_BACKGROUND_TIMEOUT_MS=90000
DEEPSEEK_KEY_CONCURRENCY=1
```

学生实时任务宁可快速 fallback，不要长时间卡住。

### 8.3 AI Coach 大量 fallback

检查：

- `CSCA_AI_COACH_ENABLED`
- `CSCA_AI_ROLLOUT_PERCENT`
- `DEEPSEEK_API_KEYS`
- Prompt safety 是否拒绝输出
- Gateway health

临时处理：

```env
CSCA_AI_COACH_ENABLED=false
```

### 8.4 后台出题大量失败

检查：

- Provider health。
- question_generation prompt 是否过长。
- schema invalid 是否属于业务解析问题。
- 真题画像/大纲是否缺失。

临时处理：

```env
CSCA_AI_QUESTION_GENERATION_ENABLED=false
CSCA_AI_QUESTIONING_SCHEDULER_ENABLED=false
```

## 9. 回滚策略

### 9.1 软回滚：关闭 Gateway

如果保留旧调用路径：

```env
AI_GATEWAY_ENABLED=false
```

然后重启后端。

### 9.2 关闭学生实时 AI

```env
CSCA_AI_COACH_ENABLED=false
CSCA_AI_ROLLOUT_PERCENT=0
```

效果：

- 学生侧使用规则 fallback。
- 后台出题可继续。

### 9.3 关闭后台 AI 出题

```env
CSCA_AI_QUESTION_GENERATION_ENABLED=false
CSCA_AI_QUESTION_REVIEW_ENABLED=false
CSCA_AI_QUESTIONING_SCHEDULER_ENABLED=false
```

效果：

- 学生侧 AI Coach 可继续。
- 后台不再消耗 DeepSeek 生成题。

### 9.4 Git 回滚

如果需要回滚代码：

```bash
cd /www/wwwroot/cscalite
git log --oneline -5
git checkout <previous-good-commit>
npm install
npm --prefix backend install
npm --prefix frontend install
npm run build
pm2 restart cscalite-backend --update-env
```

注意：

- 如果本次上线执行了数据库迁移，不要随意手工回滚数据库。
- 优先使用关闭开关而不是回滚数据库。

## 10. 生产安全要求

- 不要把 DeepSeek Key 写入前端环境变量。
- 不要提交 `.env`。
- 不要在日志中输出完整 key。
- BYOK key 必须加密存储。
- 前端只展示 key label 或 keyId，不展示明文。

## 11. 发布记录模板

每次上线记录：

```text
发布时间：
提交：
分支：
执行人：
是否执行 db:migrate：
是否执行 npm run build：
AI_GATEWAY_ENABLED：
DEEPSEEK key 数量：
上线前 Provider 状态：
上线后 Provider 状态：
回滚开关确认：
备注：
```

## 12. 最小上线路径

如果只想最小风险上线：

1. 部署代码。
2. 执行迁移和构建。
3. 配置 `AI_GATEWAY_ENABLED=true`。
4. 只开启 AI Coach 5% 灰度。
5. 后台出题仍关闭。
6. 观察 24 小时。
7. 再开启后台出题。

推荐顺序：

```text
AI Coach 小流量 -> AI Coach 全量 -> 后台审题 -> 后台生成 -> 自动补题
```

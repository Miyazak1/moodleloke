# Moodlelike v1.5 RC Readiness

日期：2026-09-28
阶段标识：产品整合阶段 v1.5 RC（不等同于 `package.json` 的发布版本号）
目标分支：`main`
基线提交：`0fa1eea`

## 1. 候选范围

本候选版把 Moodlelike 收敛为 CSCA 做题训练产品，并包含：

- 继承后的公开首页与 CSCA-only 内容；
- 统一 `/agent`、认证、注册、找回密码和用户语言偏好路由；
- 隔离的管理后台入口，以及内容运营、运营概览和 Question Engine 状态页面；
- CSCALITE 认证复用决策、产品整合 ADR 和生产切换 Runbook；
- Question Engine 插件边界、候选写入门禁、签名任务协议、可选 Sidecar Worker、运行态观测和演练证据；
- 更新后的独立部署、环境变量、Compose profile 和发布契约。

本候选版不包含：

- 正式学生站切换到 Sidecar；
- 真实 Provider 演练或自动出题批次；
- 自动候选题直接发布；
- CSCALITE 旧站下线或数据库删除；
- 包版本号升级。

## 2. 生产安全默认值

正式站首次部署本候选版时必须保持：

```dotenv
QUESTION_ENGINE_PLUGIN_ENABLED=false
QUESTION_ENGINE_EXECUTION_MODE=in-process
QUESTION_ENGINE_SIDECAR_ACTIVATION_ENABLED=false
QUESTION_ENGINE_WORKER_ENABLED=false
CSCA_AI_QUESTION_GENERATION_ENABLED=false
CSCA_AI_QUESTION_REVIEW_ENABLED=false
CSCA_AI_TOPIC_MAPPING_ENABLED=false
CSCA_SUBJECT_PRACTICE_PRODUCTION_ENABLED=false
CSCA_AI_QUESTIONING_SCHEDULER_ENABLED=false
```

`question-engine-worker` 仍位于显式 Compose profile 中，普通 `docker compose up` 不会启动它。

## 3. 已完成验证

| 门禁 | 结果 |
|---|---|
| `npm run ci:contracts` | 通过 |
| 前端生产构建 | 通过 |
| 后端生产构建 | 通过 |
| 公开首页 Golden | 2/2 通过 |
| Agent 核心 Golden | 12/12 通过 |
| 独立作者端 Golden | 1/1 通过 |
| 内容后台 Golden | 3/3 通过 |
| 运营后台 Golden | 2/2 通过 |
| Question Engine 后台 Golden | 2/2 通过 |
| 语言切换与持久化 | 6/6 通过 |
| Compose 配置解析 | 通过；本机仅有 Docker config 读取权限警告 |
| 敏感信息模式扫描 | 未发现真实密钥；仅存在模板占位值和测试夹具 |
| `git diff --check` | 通过；仅有 Windows LF/CRLF 提示 |

语言测试此前使用 Playwright 自带 Windows webServer 管理时会在用例完成后残留进程；候选版已改为显式托管 Vite 生命周期，用例通过后可正常退出。

## 4. 部署与验收顺序

1. 推送并记录候选提交 SHA；
2. 服务器备份当前 `.env`、数据库卷、上传卷和当前镜像/提交信息；
3. 拉取候选提交并确认 `.env` 保持第 2 节安全默认值；
4. 执行 Compose 配置解析、镜像构建和数据库迁移；
5. 启动现有 `db`、`redis`、`backend`、`frontend`，不带 `question-engine` profile；
6. 验收首页、注册登录、Google 登录、Agent 做题、学习计划和管理后台；
7. 观察健康检查、认证刷新、后台错误率和容器重启情况；
8. 只有正式站稳定后，才在隔离环境启动可选 Worker 并执行 Sidecar Runbook。

具体服务器命令和回滚步骤以 `docs/cscalite-to-moodlelike-production-cutover-runbook-2026-09-28.md` 为准；Worker 演练以 `docs/question-engine-sidecar-rehearsal-runbook-2026-09-28.md` 为准。

## 5. 发布判定

候选代码达到“可提交、可推送、可在现有 in-process 安全模式部署”的标准。它尚未获得 Sidecar 生产切换、真实自动出题或 CSCALITE 旧站下线授权。

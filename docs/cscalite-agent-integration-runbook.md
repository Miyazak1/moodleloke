# CSCALite × Moodlelike Agent 接入运行手册

> 合并范围、目标架构、旧练习收口和分阶段门禁见
> [CSCALITE × Moodlelike 学习 Agent 合并与旧练习收口计划](./cscalite-agent-consolidation-plan-2026-09-23.md)。

## 边界

- CSCALite 继续拥有登录态、学生身份、主导航和发布流量控制。
- Moodlelike 接管学生做题、判题、学习证据、错题复盘、独立验证和当前题 AI 问答。
- 自动出题仍是隔离插件，只能向审核/发布流程提供候选题，不得在学生请求中即时生成并直接投放。
- 做题、报告、教学和真题工作区使用 `agentContextId`；只有独立“学科问答”使用可复用会话。
- 机器可读契约位于 `contracts/cscalite-agent-host.v1.json`。

## 前端宿主接入

- `AgentPage` 不直接拥有浏览器路由或登录页，它只依赖 `frontend/src/lib/agent-host-bridge.ts` 中的 `AgentHostBridge`。
- CSCALite 接入时必须提供 `navigate(path)`、`requestAuthentication(returnTo)`、`getSnapshot()` 与 `requestJson()`。`requestJson()` 必须复用 CSCALite 现有认证、刷新和 CSRF 链路，Agent 不另存 token。
- `getSnapshot()` 统一提供字符串化的用户 ID、认证解析状态、语言和功能能力。数据库中的数字用户 ID 只存在于 CSCALite 服务端，跨前端边界统一序列化为字符串。
- `/agent` 是唯一浏览器入口，语言来自宿主快照或存储状态，不得写入任何 `/{locale}/agent` 路径。当前 UI 支持 `zh-CN`、`en`、`vi`；内容缺失时回退英文。
- 独立开发站壳 `StandaloneAgentApp` 已使用同一桥接契约，因此合并时替换宿主实现即可，不需要复制独立站的路由壳。
- 学习资料、证据确认、教学建议和独立验证卡片集中在 `AgentLearningCards.tsx`；`AgentPage` 只负责编排状态和工作区，宿主不得绕过这些组件直接写学习证据。
- Agent 样式以 `.agent-page` 为根命名空间；宿主只负责容器尺寸和布局，不覆盖命名空间内部样式。

## 会话与题目上下文

- `AgentConversation` 只用于独立“学科问答”，允许长期保存、列出和恢复。
- `AgentContext` 是短生命周期工作区，不是会话。标准结构见 `contracts/agent-context.v1.json`，共同样例见 `contracts/fixtures/cscalite-agent-host.v1.json`。
- 做题、模考、真题、教学和错题复习只能使用 `agentContextId`。`conversation` 与 `agentConversationId` 不得作为别名读取，也不得由新路由写出。
- 上下文由服务端绑定已认证用户和领域实体；绑定题目时，只能访问服务端认定的当前题。切题使旧题绑定进入 `superseded`，后续写入返回 `workspace_stale`。
- 跨用户访问返回 `workspace_forbidden`。过期上下文返回 `workspace_stale`，客户端应重新读取当前工作区，而不是偷偷创建或恢复会话。

## 错误与工作区事件

- 冻结错误码：`auth_required`、`email_unverified`、`feature_disabled`、`workspace_stale`、`workspace_forbidden`、`question_supply_unavailable`。
- 宿主向 Agent 传递身份、语言、功能开关变化与工作区恢复事件；Agent 向宿主报告工作区就绪/关闭、作答开始/提交和报告打开。事件名称以机器契约为准。
- `workspace_stale` 是可恢复冲突；客户端返回最新题目。`workspace_forbidden` 不得自动重试或改写用户身份。

## 自动出题插件端口

- 跨仓库协议位于 `contracts/question-supply-plugin.v1.json`。
- 学生运行时只通过 `QuestionCatalogReadPort` 读取已审核、已发布题目，通过 `QuestionSupplyDemandPort` 异步上报库存缺口。
- 学生请求不得同步触发生成、读取 staging 候选题或直接发布题目。库存不足返回 `question_supply_unavailable`，已有做题、判题、报告和学科问答仍可使用。

## 发布前检查

1. 以 `.env.production.example` 创建密钥管理配置，不要把真实值写入仓库。
2. 将 `MOODLELIKE_HOST_INTEGRATION_MODE` 设置为 `cscalite`，并保持 `MOODLELIKE_HOST_CONTRACT_VERSION=cscalite-agent-host-v1`。
3. 将 `VITE_AGENT_DISABLED_REDIRECT_URL` 设置为 CSCALite 原做题入口，不能使用 `/`。
4. 保持自动出题四个隔离开关为 `false`。
5. 使用 Redis 作为多实例限流存储。
6. 依次执行：

   - `node scripts/check-cscalite-agent-host-contract.cjs`
   - `node scripts/moodlelike-integration-preflight.cjs --env-file=<staging-env> --mode=cscalite`
   - 在允许访问测试资源的环境执行同一命令并加 `--probe-database`
   - 经授权后加 `--probe-deepseek`，该探针会产生一次极小的模型请求
   - `npm run ci:contracts`
   - `npm run ci:golden`

预检只输出布尔状态、模型名、延迟和脱敏错误分类，不输出数据库地址、认证密钥或 DeepSeek 密钥。

## 灰度顺序

1. 只读影子：保留 CSCALite 原入口，验证身份映射、题源读取和学习证据读取。
2. 内部账号：打开后端 Agent 与写入开关，只允许内部测试账号进入新入口。
3. 小流量学生：构建时开启 `VITE_AGENT_WEB_ENABLED`，逐步把主导航入口切到 `/agent`。
4. 扩大流量前检查 `/api/v1/ops/ready` 中的 `studentAgent`、数据库和限流状态。
5. 自动出题插件的放量必须走独立审批，不能随学生端放量自动开启。

## 故障与降级

- DeepSeek 超时、限流或断网：已作答题目使用审核解析生成可信降级说明；无审核上下文时明确提示暂不可用，不伪造回答。做题和判题继续可用。
- 浏览器 SSE 中断：客户端使用事件序号续传；服务端只向运行所属用户回放后续事件。
- 重复提交：轮次提交、任务启动、结算和建议曝光均使用幂等边界，重复请求返回已有结果。
- 数据库不可用：就绪检查返回 degraded，负载均衡不得继续把新流量送入实例。

## 回滚

1. 先设置 `AGENT_WEB_ENABLED=false` 阻止新的服务端 Agent 操作。
2. 重新构建前端并设置 `VITE_AGENT_WEB_ENABLED=false`。
3. 禁用页会把学生送到 `VITE_AGENT_DISABLED_REDIRECT_URL` 指定的原做题入口。
4. 不删除 Moodlelike 学习证据和轮次数据；恢复后继续使用原 ID 和幂等键。
5. 自动出题插件开关保持不变，不参与学生端回滚。

## 当前上线阻断标准

以下任一情况必须停止放量：接入契约不通过；数据库或 DeepSeek 流式探针失败；Redis 限流未配置却部署多个后端实例；回滚地址仍为 `/`；自动出题隔离开关被打开；桌面、平板、移动端黄金路径失败；健康接口暴露任何密钥或连接串。

# PR11A：API 大模型受约束意图路由

## 1. 目标

让 Web Agent 理解比固定关键词更自然的学习请求，但不把学习决策权、工具选择权或领域写权限交给模型。大模型通过现有 AI Gateway API 调用；不在本地或服务器部署大模型。

## 2. 固定边界

模型只允许输出服务器声明的分类：

- `today_plan`：询问今天学什么、下一步、复习或改进方向；
- `learning_status`：查询掌握情况、薄弱点或学习进度；
- `review_queue`：查询个人错题和待复习项；
- `mock_exams`：查询个人模考记录与报告；
- `past_papers`：查询已发布真题资源；
- `capability_help`：询问 Agent 能做什么或如何使用；
- `clarify`：学习请求确实含糊，需要一个最小澄清；
- `unsupported`：无关请求或当前未开放能力。

模型不能返回或指定工具名。`today_plan` 仍由 `AgentRunnerService` 执行固定、服务器维护的 Capability 链；自动出题、Evidence Writer、Projection、成绩写入和管理员接口不进入模型边界。

## 3. 安全与恢复

- 当前及最近对话作为不可信 JSON 数据送入分类器；System Prompt 明确忽略其中的指令、工具请求和策略修改；
- 输出使用严格 Zod Schema，额外字段、非法枚举和非法澄清结构全部拒绝；
- 置信度低于 `0.65` 时只进入服务器固定澄清文案；
- 未配置 API key、Gateway 失败、超时或输出不合规时退回 `routeAgentIntent` 规则；
- 模型生成的自由文本不直接展示给学生；
- `plan.created` 记录来源、置信度、原因和路由版本，Run 恢复时复用结果，避免重复路由调用；
- 每次 provider 调用限制为一次，8 秒超时，并写入 AI Gateway ledger。

## 4. Feature Flag

`CSCA_AGENT_LLM_ROUTER_ENABLED` 默认关闭。本地一键演示脚本打开该开关；如果没有可用个人实时 API key，功能无错误降级为原规则路由。

## 5. 当前能力与下一阶段

PR11A 只解决受约束意图分类，不宣称完成通用聊天 Agent。PR11B 已在不改变 Capability 权限的前提下完成：

1. 使用结构化工具结果生成有来源的自然解释；
2. 为学习状态、错题、模考和真题资源增加固定服务器路由；
3. 下一阶段建立固定多轮评测集，验证意图准确率、提示注入拒绝、API 故障降级和费用；
4. 随后完成本地黄金路径与投资人 Demo 验收。

PR11B 详见 [50-GROUNDED-AGENT-READ-ROUTES.md](./50-GROUNDED-AGENT-READ-ROUTES.md)。

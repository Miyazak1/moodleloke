# CSCAPilot Agent 插件方案

状态：Draft v0.1  
依赖文档：[产品规格](./01-PRODUCT-SPEC.md)、[工具契约](./02-TOOL-CONTRACTS.md)、[Agent Runtime](./03-AGENT-RUNTIME.md)、[数据模型](./04-DATA-MODEL.md)

本文中的插件首版统一称为 `PLUGIN-P1`；发布阶段定义见 [19-ARCHITECTURE-CLOSURE-ADR.md](./19-ARCHITECTURE-CLOSURE-ADR.md)。

## 1. 目标

把 CSCAPilot 的学习能力提供给 Codex、ChatGPT 等支持插件和 MCP 的 Agent 客户端，同时保证网页端与插件端：

- 使用同一个 CSCAPilot 账号、学习档案和权限体系；
- 读取同一份掌握度、错题、模考、真题与学习计划数据；
- 调用同一套领域服务和 AI Gateway；
- 使用同一套额度、计费、审计和安全规则；
- 对相同输入产生语义一致的业务结果。

插件不是第二套 CSCAPilot，也不是把网页后端复制到客户端。它是共享能力层之上的一个渠道适配器。

## 2. 总体定位

```text
Codex / ChatGPT / other Agent host
          |
          | Plugin: Skills + MCP + optional UI
          v
CSCAPilot remote MCP gateway
          |
          v
Shared Capability Layer / Domain Services
          |
          +-- Profile and learning context
          +-- Practice and diagnostic
          +-- Wrong-question review
          +-- Mock exam
          +-- Past-paper resources
          +-- AI Gateway and usage ledger
```

宿主 Agent 负责理解自然语言、选择工作流和呈现结果；CSCAPilot 服务端负责身份、授权、业务校验、状态变更、计费和审计。宿主提供的确认界面不能替代服务端确认机制。

## 3. 插件组成

依据 OpenAI 插件架构，插件可以组合三类能力：

1. **Skills**：向 Agent 描述 CSCAPilot 的工作流、选择规则和成功标准。
2. **MCP Server**：提供带类型契约的工具、鉴权、结构化结果和服务端执行能力。
3. **Optional UI**：仅在复杂信息确实需要可视化时使用；所有核心工具在没有自定义 UI 时仍应可用。

建议先交付 Skills + Remote MCP 的无自定义 UI 版本，再根据真实使用数据决定是否增加交互组件。

## 4. 建议的逻辑包结构

下面是设计阶段的逻辑结构，不是最终脚手架承诺。实施时应以当时有效的插件清单规范校验目录和 manifest 字段。

```text
cscapilot-plugin/
  .codex-plugin/
    plugin.json
  skills/
    daily-study/
      SKILL.md
    weakness-diagnostic/
      SKILL.md
    wrong-question-review/
      SKILL.md
    mock-exam-coach/
      SKILL.md
    past-paper-search/
      SKILL.md
    weekly-learning-review/
      SKILL.md
  mcp/
    server configuration or remote server declaration
  ui/
    optional components added after PLUGIN-P1 validation
  README.md
```

插件包中不包含生产数据库凭据、DeepSeek/API 密钥或能绕过 CSCAPilot 后端的直连逻辑。

## 5. 首批 Skills

### 5.1 Daily Study

触发示例：

- “我今天该学什么？”
- “给我安排 30 分钟化学练习。”
- “继续上次的训练。”

工作流：读取学习上下文与可用时间，给出简短计划，经必要确认后创建或继续练习。成功结果必须说明科目、范围、预计时长、题量以及为什么现在做它。

### 5.2 Weakness Diagnostic

触发示例：

- “诊断一下我的物理薄弱点。”
- “为什么我的化学成绩一直上不去？”

工作流：先读取已有证据；证据不足时建议小型诊断。不得在没有数据时把推断表述成事实。

### 5.3 Wrong-question Review

触发示例：

- “复习最近的错题。”
- “把反复错的知识点整理出来。”

工作流：读取复习队列，按遗忘风险、错误频次和考试相关性排序，创建复习训练或返回复习摘要。

### 5.4 Mock Exam Coach

触发示例：

- “开始一次数学模考。”
- “分析我上一次模考。”

工作流：区分“查看/分析”和“开始/提交”操作。开始和提交模考属于状态变更，必须满足确认和幂等要求。

### 5.5 Past-paper Search

触发示例：

- “找 2026 年化学真题。”
- “给我带答案解析的物理卷。”

工作流：返回站内已发布、用户有权访问的资源，并优先给出 CSCAPilot 页面深链。不得把任意互联网 URL 当作可信真题。

### 5.6 Weekly Learning Review

触发示例：

- “总结我这周的学习。”
- “下周应该怎么调整？”

工作流：汇总训练、掌握度、错题和模考变化，区分观测事实与建议，并给出最多三项可执行行动。

## 6. MCP 工具范围

工具的输入、输出、错误、确认和幂等契约以 [02-TOOL-CONTRACTS.md](./02-TOOL-CONTRACTS.md) 为准。插件不得重新定义同名业务语义。

### 6.1 PLUGIN-P1 读取工具

- `get_learning_dashboard`
- `get_learning_profile`
- `get_ai_credit_balance`
- `get_subject_mastery`
- `get_review_queue`
- `list_mock_exam_attempts`
- `search_past_papers`
- `get_score_goal`
- `get_study_availability`
- `get_target_gap`
- `get_learning_prescription`
- `get_question_supply_status`
- `simulate_plan_adjustment`
- `get_score_readiness`（仅在校准和产品门槛通过后开放）

### 6.2 PLUGIN-P1 状态变更工具

- `create_adaptive_practice`
- `create_diagnostic`
- `start_review_practice`
- `start_mock_exam`
- `update_score_goal`
- `update_study_availability`
- `update_learning_profile`
- `submit_mock_exam`（条件开放，保持 L3 确认）

### 6.3 PLUGIN-P1 AI 工具

- `generate_question_hint`
- `generate_question_explanation`
- `generate_round_summary`
- `generate_weekly_learning_report`

### 6.4 后续工具

- `request_generated_practice`（灰度开放，默认只产生 `TRAINING` 题）
- 二进制附件上传与分析
- 学习计划的精细编辑与日历联动
- 教师、机构和管理员工具集

管理员接口不进入学生插件。未来如需管理员插件，应使用独立插件、独立 scopes 和独立发布审查。

## 7. MCP 服务形态

生产环境使用稳定 HTTPS 地址和 Streamable HTTP。候选地址：

- `https://api.cscapilot.com/mcp`
- `https://mcp.cscapilot.com/mcp`

最终域名待部署设计确定。MCP Gateway 只做协议、认证上下文、工具注册、结果适配和审计接入，不复制领域规则。

每个工具结果建议同时包含：

- `structuredContent`：供宿主继续推理和组合；
- 简短文本摘要：即使宿主不支持 UI 也能清楚呈现；
- 可选 CSCAPilot 深链；
- 计费工具的 `chargedUnits`、`remainingUnits` 和 `entitlementSource`；
- `requestId`、业务对象 ID 和可重试信息。

## 8. 身份与 OAuth

插件用户绑定已有 CSCAPilot 账号，不创建独立的“插件用户”。私有学习数据和所有写操作必须授权。

实现目标为符合 MCP 授权规范的 OAuth 2.1：

- MCP 服务发布 Protected Resource Metadata；
- 授权服务器发布 OAuth Authorization Server Metadata；
- 使用 Authorization Code 与 PKCE S256；
- access token 的 audience/resource 指向 CSCAPilot MCP；
- 每次请求校验 issuer、audience、有效期和 scopes；
- 支持撤销、refresh token 轮换和账号解绑；
- 客户端注册方式在实施阶段从 CIMD、DCR 或预注册客户端中确定。

浏览器 Cookie 不直接暴露给插件，OAuth token 也不进入模型上下文或普通工具输出。

## 9. Scopes

| Scope | 能力 | 示例工具 |
|---|---|---|
| `learning.read` | 读取个人学习档案、统计与复习队列 | `get_learning_dashboard` |
| `resources.read` | 搜索与访问已授权学习资源 | `search_past_papers` |
| `practice.write` | 创建诊断、训练和错题复习 | `create_diagnostic` |
| `mock_exam.write` | 创建模考和保存进行中状态 | `start_mock_exam` |
| `mock_exam.submit` | 提交模考并触发不可逆评分流程 | `submit_mock_exam` |
| `profile.write` | 修改学习档案与目标 | `update_learning_profile` |
| `ai.generate` | 使用 CSCAPilot 托管模型并可能消耗额度 | `generate_question_hint` |

插件应按工作流渐进请求权限，不在首次连接时默认索取全部 scopes。读取、普通写入、高影响提交和 AI 消耗必须可独立授权。

## 10. 确认与状态变更

工具分为：

- L0：只读，无确认；
- L1：可安全重试的低影响写入，允许一次明确意图后执行；
- L2：消耗额度或创建重要业务状态，执行前展示影响；
- L3：提交考试、覆盖关键设置等高影响操作，需要服务端签发的一次性确认。

服务端确认记录至少绑定 `userId`、`toolName`、`toolVersion`、规范化输入哈希、预计额度、过期时间和一次性 nonce。宿主的“确认”按钮只是用户表达意图的入口，后端仍要重新校验权限、余额和参数。

## 11. 自定义 UI 策略

`PLUGIN-P1` 默认使用宿主的文字、表格和链接呈现。以下场景再考虑自定义 UI：

| 场景 | PLUGIN-P1 | 后续 UI 候选 |
|---|---|---|
| 今日计划 | 文本 + 操作建议 | 可编辑时间轴 |
| 掌握度 | 简短摘要 | 科目/知识点对比图 |
| 真题搜索 | 列表 + 深链 | 可筛选资源卡片 |
| 模考确认 | 原生确认 | 考试规则确认卡 |
| 学习档案 | 深链到网页设置 | 内嵌受控表单 |
| 额度 | 文本状态 | 余额与近期消耗卡 |

自定义 UI 不能成为工具可用性的前提，也不能在前端自行计算最终余额、权限或考试状态。

## 12. 网页与插件的一致性

- 两个渠道调用同一个 Capability Layer；
- Agent 运行记录标记 `channel=web|codex|chatgpt|other_mcp`；
- 对象 ID、状态机和额度流水跨渠道一致；
- 一个渠道创建的练习可在另一个渠道继续；
- 插件返回网页深链时携带对象 ID，不携带长期访问令牌；
- 页面文案和插件摘要可不同，但业务事实必须相同。

## 13. 版本管理

分别维护：

- 插件包版本；
- Skill 版本；
- MCP 工具 schema 版本；
- Agent prompt/policy 版本；
- 领域 API 版本。

工具新增可保持向后兼容；字段删除、语义变化和确认等级提升需要版本迁移。服务端至少保留一个受支持的旧版本窗口，并记录每次执行所用版本。

## 14. 可观测性

每次插件调用至少记录：

- `requestId`、`agentRunId`、`userId`、OAuth client、channel；
- tool、tool version、skill version；
- scopes 判定、确认等级和结果；
- latency、重试、错误类别；
- AI provider/model、token 或计量单位、最终扣费；
- 目标业务对象 ID。

日志禁止记录 access token、refresh token、第三方 API key、完整题目答案和不必要的个人资料。

## 15. 测试矩阵

### 契约测试

- MCP schema 与共享 Tool Contract 一致；
- 无 UI 客户端能完成所有 `PLUGIN-P1` 流程；
- 缺字段、未知字段、重复请求和版本不兼容返回稳定错误。

### 授权测试

- 未登录、过期 token、错误 audience、scope 不足；
- 用户 A 不能读取或修改用户 B 的对象；
- 被撤销连接立即失效；
- 读取 scope 不能调用写入或 AI 工具。

### 跨渠道测试

- 网页创建、插件继续；
- 插件创建、网页展示；
- 两端并发操作的幂等与冲突处理；
- 两端额度和流水最终一致。

### 宿主兼容测试

- Codex 中的发现、授权、工具调用和深链；
- ChatGPT 中支持的同等流程；
- 宿主不支持可选 UI 时正常降级；
- 中英文请求、长对话与工具失败恢复。

## 16. 发布阶段

1. **本地契约阶段**：mock MCP，只验证工具与 Skills。
2. **内部远程阶段**：开发环境 OAuth，团队账号使用。
3. **私有测试阶段**：少量真实用户，默认关闭高影响工具。
4. **受控发布阶段**：开放读取、练习和有限 AI 能力。
5. **公开发布阶段**：完成安全审查、支持流程、限流和撤销机制后再开放。

## 17. PLUGIN-P1 非目标

- 不让插件直接访问数据库；
- 不在插件本地保存完整学习档案；
- 不让宿主绕过 CSCAPilot AI Gateway 直接选择供应商密钥；
- 不提供管理员和批量机构管理能力；
- 插件首版不传输二进制附件或抓取任意 URL；网页 Composer 的私有附件能力独立作为核心能力实现，后续插件仅通过受控附件资源契约接入；
- 不承诺所有宿主具有完全相同的 UI。

## 18. 待确认事项

- MCP 正式域名和独立网关部署方式；
- OAuth 客户端注册策略与 token 生命周期；
- 首发宿主仅 Codex，还是同时支持 ChatGPT；
- `ai.generate` 是否与每个业务写 scope 组合要求；
- 首批是否开放模考提交；
- 哪些自定义 UI 能显著提升完成率。

## 19. 官方参考

- [OpenAI Plugins 概念](https://developers.openai.com/plugins/concepts/plugins)
- [OpenAI MCP Server 概念](https://developers.openai.com/plugins/concepts/mcp-server)
- [OpenAI 插件认证](https://developers.openai.com/plugins/build/auth)

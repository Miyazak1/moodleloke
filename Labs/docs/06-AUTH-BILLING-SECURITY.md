# CSCAPilot Agent 认证、计费与安全方案

状态：Draft v0.1  
依赖文档：[工具契约](./02-TOOL-CONTRACTS.md)、[Agent Runtime](./03-AGENT-RUNTIME.md)、[数据模型](./04-DATA-MODEL.md)、[插件方案](./05-PLUGIN-SPEC.md)

## 1. 目标

本方案定义网页 Agent 和外部插件共同遵守的安全基线。核心原则是：模型、提示词、浏览器和插件宿主都不是授权边界；最终权限、计费、确认和数据完整性只能由 CSCAPilot 服务端保证。

## 2. 需要保护的资产

- 用户身份、会话和 OAuth token；
- 学习档案、目标、掌握度、错题与模考记录；
- 未公开题目、答案、解析和受限真题文件；
- AI 额度、购买记录和使用流水；
- Agent 对话、工具调用和确认记录；
- DeepSeek 等供应商密钥与内部路由策略；
- 管理员、机构和白名单权限。

## 3. 信任边界

```text
User
  |
  +-- Browser UI -------- existing web session --------+
  |                                                   |
  +-- Agent host ------ OAuth access token ------+    |
                                                  v    v
                                            API / MCP Gateway
                                                   |
                                      authentication + policy
                                                   |
                                           Capability Layer
                                                   |
                           +-----------------------+------------------+
                           |                       |                  |
                     Domain data             AI Gateway       Usage ledger
                                                   |
                                             Model providers
```

跨越任一边界的数据都必须重新验证。自然语言、模型输出、网页内容、PDF 内容和 MCP 客户端参数都视为不可信输入。

## 4. 网页端身份与会话

网页 Agent 复用现有登录、Cookie、Access Policy Guard 和账号状态，不建立旁路会话。

实施时继续验证以下要求：

- 生产 Cookie 使用 `Secure`、`HttpOnly` 和合适的 `SameSite`；
- refresh token 只通过受保护 Cookie 传递并支持轮换与撤销；
- CORS 使用明确 allowlist，不使用带凭据的通配来源；
- 状态变更接口具备 CSRF 防护；
- 登出、改密、封禁和风险事件可使会话失效；
- 管理员权限继续由服务端 guard 判定，不依据前端是否显示入口。

Agent 对话 ID 不是认证凭据，知道 `agentRunId` 不能获得会话访问权。

## 5. 插件 OAuth 2.1

插件访问个人数据或执行写操作时必须使用符合 MCP 授权规范的 OAuth 2.1 流程：

- MCP 作为资源服务器；
- CSCAPilot 身份系统或选定 IdP 作为授权服务器；
- Codex、ChatGPT 等宿主作为 OAuth 客户端；
- Authorization Code + PKCE S256；
- 发布 Protected Resource Metadata 与 Authorization Server Metadata；
- authorization 请求携带目标 resource，token audience 必须匹配 MCP；
- 每次请求校验签名、issuer、audience、有效期、not-before、subject 和 scopes；
- refresh token 轮换、可撤销，并绑定客户端与账号；
- token 不写入模型输入、普通日志、URL 查询参数或工具返回值。

建议 access token 短时有效；具体时长、refresh token 上限和重新认证条件在威胁建模与客户端兼容测试后确定，不在本稿写死。

## 6. Scope 与最小权限

| Scope | 允许 | 明确不允许 |
|---|---|---|
| `learning.read` | 读取本人学习数据 | 读取他人、管理员数据 |
| `resources.read` | 搜索本人可访问资源 | 获取未发布或越权文件 |
| `practice.write` | 创建本人训练 | 提交模考、修改档案 |
| `mock_exam.write` | 创建和保存本人模考 | 最终提交 |
| `mock_exam.submit` | 提交本人模考 | 管理试卷或成绩 |
| `profile.write` | 修改允许的学习偏好 | 修改身份、角色和额度 |
| `ai.generate` | 调用受控 AI 生成 | 访问供应商密钥或改路由策略 |

授权原则：

- 首次连接只请求当前工作流所需 scopes；
- 高影响 scope 单独展示用途；
- 服务端工具同时校验 scope、账号状态、对象归属和领域规则；
- 不能仅凭 scope 跳过资源级授权；
- 学生插件永远不映射管理员路由。

## 7. 对象级授权

所有读取和写入都以服务端解析出的 `userId` 为起点，不信任客户端传入的用户 ID。

每个工具必须验证：

1. 当前主体是否有效；
2. scope 是否允许该动作；
3. 目标对象是否属于该主体或明确共享给该主体；
4. 对象当前状态是否允许该动作；
5. 科目、资源、机构等附加权限是否满足；
6. 是否命中风控、限流或 kill switch。

列表接口同样必须在数据库查询条件中约束主体，不能先读取全量数据再在应用层过滤。

## 8. 操作确认等级

| 等级 | 类型 | 示例 | 要求 |
|---|---|---|---|
| L0 | 只读 | 查询掌握度、真题 | 不额外确认 |
| L1 | 低影响可恢复写入 | 创建普通训练、从独立测量题池创建不扣费诊断 | 明确用户意图 + 幂等键 |
| L2 | 消耗额度或生成重要状态 | AI 解析、AI 生成训练内容 | 展示预计消耗和结果影响 |
| L3 | 高影响或难恢复 | 提交模考、覆盖关键计划 | 一次性服务端确认令牌 |

L2/L3 的确认记录至少包含：

- `userId`、`agentRunId`、channel；
- tool name/version；
- 规范化输入哈希；
- 预计额度和影响摘要；
- 签发时间、过期时间、nonce；
- 消费时间和最终业务对象 ID。

输入、工具版本或预估影响发生变化后，旧确认失效。确认令牌必须短时、一次性，并在服务端原子消费。

## 9. 计费边界

需要明确区分两类模型成本：

1. **宿主 Agent 模型成本**：由 Codex/ChatGPT 等宿主承担，不进入 CSCAPilot 额度流水。
2. **CSCAPilot 托管 AI 成本**：通过 CSCAPilot AI Gateway 调用 DeepSeek 等模型，按现有 entitlement 与 usage ledger 规则计量。

以下行为默认不扣 CSCAPilot AI 额度：

- 读取学习档案和统计；
- 搜索站内真题；
- 创建使用既有题库的普通练习；
- 返回既有标准答案和已存解析；
- 跳转到网页继续操作。

以下行为可能扣额度：

- 新生成提示、解析或学习总结；
- AI 诊断、开放题评价或个性化反馈；
- 明确标注由 CSCAPilot 托管模型执行的后台任务。

最终规则必须由现有 `AiEntitlementService` / `AiUsageMeterService` 演进承载，Agent 不维护另一套余额。

## 10. 扣费事务

推荐流程：

```text
authorize request
    -> validate entitlement
    -> estimate units and disclose when required
    -> reserve units with idempotency key
    -> execute AI call
    -> settle actual units
    -> release/refund unused reservation
    -> append immutable ledger event
```

关键规则：

- usage ledger 是余额变化的审计来源，前端显示不是事实来源；
- `idempotencyKey` 同时约束业务执行和额度预留；
- 网络重试不能重复扣费；
- 供应商失败、超时且无可用结果时按政策释放或退款；
- 已产生有效结果但客户端断线时不得简单重复执行；
- 工具返回 `chargedUnits`、`remainingUnits`、`entitlementSource` 和 `ledgerEntryId`；
- 白名单/无限额度使用显式 entitlement 标志表达，不伪装成极大余额；
- 人工调整、购买、赠送、消耗、退款分别使用可识别的 ledger reason。

预留与结算应放在数据库事务或具有等效一致性保证的工作流中。

## 11. 模型与供应商安全

- 插件和浏览器只能请求业务能力，不能传入供应商 API key；
- 客户端可请求质量/速度偏好，但最终模型由服务端 task policy 决定；
- 实际 provider/model 写入网关调用日志，不能只记录请求模型；
- 供应商错误需要去敏，不能把请求头、密钥或内部 URL 返回用户；
- key pool、并发、超时、重试和熔断沿用 AI Gateway；
- 高风险内容和未验证结构化输出不能直接触发写工具。

## 12. Prompt Injection 与工具滥用

外部内容中的文字只能作为数据，不能覆盖系统策略或工具授权。包括：

- 用户上传内容；
- 真题 PDF 与解析；
- 网页搜索结果；
- MCP resource 内容；
- 数据库中的自由文本。

防护要求：

- Agent 只接收完成任务所需的最小上下文；
- system policy、tool schema 与用户内容分层传递；
- 工具参数由结构化 schema 校验，不执行内容中的“命令”；
- 模型提出的工具调用仍经过服务端授权、状态机与确认；
- 输出到 HTML 时统一转义；
- 不把 secrets、内部 prompt 或其他用户数据放入上下文；
- 对跨工具链的高影响动作设置步骤上限和风险检测。

## 13. 文件与 URL 安全

`WA-F0/WA-P1` 网页 Agent 支持受控的私有文档与图片附件，但不支持任意 URL 抓取；`PLUGIN-P1` 暂不传输二进制附件。对话附件与公开真题文件分区存储、分开授权，详细设计见 [10-ATTACHMENT-INGESTION.md](./10-ATTACHMENT-INGESTION.md)。

文件链路至少要求：

- 类型、扩展名、MIME、文件头和大小同时校验；
- 文件名规范化，存储键由服务端生成；
- 恶意文件扫描与隔离；
- 解析进程资源限额和超时；
- 私有文件下载进行对象级鉴权；
- 外部 URL 采用协议、域名和解析后 IP allowlist；
- 阻止回环、链路本地、内网、云元数据地址和重定向绕过；
- 下载响应设置安全的 Content-Type 与 Content-Disposition。

## 14. 输入与 API 安全

- 所有工具和 REST 输入使用 allowlist schema，拒绝未知高风险字段；
- 防止 mass assignment，尤其是 `role`、`credits`、`ownerId`、`published`；
- 数据库访问参数化，禁止把自然语言拼进查询；
- 所有对象 ID 防 IDOR；
- 深链只允许 CSCAPilot 已知路由，不允许 `javascript:` 或开放重定向；
- 错误信息区分可恢复与不可恢复，但不泄露内部堆栈；
- 单次请求和 Agent run 都设置工具次数、耗时和成本上限。

## 15. 限流与滥用防护

生产环境优先使用 Redis 支撑分布式限流。至少覆盖：

- 未认证认证接口：按 IP、设备风险和账号标识；
- 已认证接口：按用户和 endpoint/tool；
- OAuth：按 client、用户、授权/换 token 操作；
- AI：按用户、机构、工具、模型成本和并发；
- 文件：按上传大小、下载频率和总带宽；
- 全局供应商并发与熔断。

限流错误返回稳定 code、合理的 retry-after 和 request ID。不得把“无限额度”解释为无限并发或无限请求频率。

## 16. 隐私与数据最小化

- Agent 默认只读取当前任务需要的学习数据；
- 不需要完整生日、家庭地址或身份证件；
- 对话与工具记录的保留期分别配置；
- 分析数据优先去标识或聚合；
- 用户可查看连接、撤销插件授权并按政策申请删除；
- 删除账号时同步处理 OAuth grant、Agent 记录和派生数据；
- 向模型供应商发送的数据在隐私政策和供应商协议覆盖范围内。

具体保留期与删除状态机以 [04-DATA-MODEL.md](./04-DATA-MODEL.md) 的实施决策为准。

## 17. Secrets 管理

- 所有供应商密钥、OAuth 私钥和数据库凭据只存放在受控 secret store 或部署环境；
- 不提交到 Git、插件包、前端 bundle 或日志；
- 按环境隔离，生产密钥不能用于本地原型；
- 支持轮换、撤销、使用审计和最小服务权限；
- 备份不得把明文密钥与业务数据放在同一无保护位置。

## 18. 审计与告警

安全审计事件包括：

- 登录、登出、刷新、OAuth 授权/撤销；
- scope 拒绝和对象越权尝试；
- L2/L3 确认签发、消费、过期；
- AI 预留、结算、退款和人工额度调整；
- 模考提交、档案关键字段变更；
- 管理员访问与 kill switch 操作；
- 异常工具链、速率激增和供应商失败。

告警应基于可行动阈值，避免记录敏感正文。`requestId`、`agentRunId`、ledger entry 和 gateway call log 应可关联追踪。

## 19. 撤销与 Kill Switch

必须能独立关闭：

- 整个外部 MCP 接入；
- 某个 OAuth client；
- 某个 tool 或 tool version；
- 所有 AI 生成或指定供应商/模型；
- L2/L3 状态变更；
- 单个用户或机构的 Agent 能力。

撤销后已签发但未使用的确认令牌失效，后台任务按策略取消或安全结束，不能继续产生未授权扣费。

## 20. 复用现有能力

首版优先复用并加固：

- 现有 auth cookies、认证 guard 和 access policy；
- `StudentProfile` 与账号状态；
- `AiGatewayService` 的 task policy、超时、重试、并发与调用日志；
- `AiEntitlementService`、`AiUsageMeterService` 和 `CscaAIUsageLedger`；
- 现有 Redis/内存 rate-limit 基础设施；
- 练习、错题、模考和真题的领域服务。

需要新增的主要组件：

- OAuth 2.1 授权与资源服务器集成；
- Remote MCP Gateway；
- scopes 到领域 policy 的映射；
- L2/L3 服务端确认记录；
- Agent run/tool execution 审计表；
- 跨渠道深链和撤销管理界面。

## 21. 上线安全门槛

- OAuth metadata、PKCE、audience 和 token 校验通过互操作测试；
- 所有工具通过未授权、scope 不足和 IDOR 测试；
- 扣费在超时、重试、断线和并发情况下不重复；
- L2/L3 无法绕过确认；
- Prompt injection 测试不能提升权限或泄露 secrets；
- Redis 限流、全局熔断与 kill switch 已演练；
- 日志去敏和数据保留策略生效；
- 跨网页/插件状态与余额一致；
- 用户能查看并撤销插件连接；
- 安全事件负责人、回滚和支持流程明确。

## 22. 学生保护与供应商数据门槛

产品面向学生，不能默认所有用户都具有相同的数据授权能力。在 `PROD-V1` 前必须完成正式隐私/法务评审并冻结：

- 年龄适配以及可能涉及未成年人的同意、撤回和监护/学校控制流程；
- 对话、题目截图、手写内容和文档发送给模型供应商前的明确告知与配置；
- 供应商是否用于训练、保存期限、处理区域、分包商和删除承诺；
- 用户的数据访问、导出、更正、删除与账号注销状态机；
- 关闭云端图片分析后的可用降级能力；
- 对话、附件、派生图片、OCR、模型输入和审计数据的分别保留期限；
- 组织账号不能替学生放弃产品承诺之外的基本隐私控制。

年龄、地区、教育阶段和组织归属不能被用于不透明降质、差别计费或缩小关键学习机会。具体法律适用范围不能由 Agent 或 Prompt 判断。

## 23. 待确认事项

- OAuth 授权服务器自建还是使用现有 IdP；
- access/refresh token 生命周期和重认证策略；
- AI 单位如何映射不同任务、模型和实际成本；
- 预留失败、部分结果和后台任务的退款细则；
- 对话与工具审计的具体保留期；
- 模考提交是否进入首发插件；
- 机构账号的共享额度与管理员审计模型。

## 24. 官方参考

- [OpenAI MCP Server 概念](https://developers.openai.com/plugins/concepts/mcp-server)
- [OpenAI 插件认证](https://developers.openai.com/plugins/build/auth)

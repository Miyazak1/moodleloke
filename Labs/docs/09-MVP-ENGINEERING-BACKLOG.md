# CSCAPilot Agent WA-F0 工程任务拆分

状态：Draft v0.1  
范围：Web Agent Foundation（`WA-F0`），包括只读学习能力和私有文档/图片理解，并为 `LS-V1` 写工具和插件留下兼容接口。本文是任务清单，不代表已经实现。阶段定义见 [19-ARCHITECTURE-CLOSURE-ADR.md](./19-ARCHITECTURE-CLOSURE-ADR.md)。

## 1. WA-F0 完成定义

登录用户可以在 CSCAPilot 网页中通过对话：

- 了解今日学习建议；
- 查看个人薄弱点与证据；
- 查看待复习错题；
- 查看最近模考；
- 搜索已发布真题；
- 查看 AI 余额；
- 上传 PDF、DOCX 和图片，查看处理状态并基于内容提问；
- 获得带附件名、页码或图片区域引用的分析；
- 在 Agent 类型化工作区继续操作；未迁移能力暂用受控旧页面回退。

`WA-F0` 不创建训练、不提交模考、不修改档案、不提供外部插件。基础上传、扫描和确定性提取不扣 AI 额度；OCR/多模态分析通过现有 AI Gateway 与额度体系受控执行。幂等练习创建从 `LS-V1` 开始，不与本条冲突。

## 2. Epic A：契约与工程骨架

### A1. 冻结 P0 工具 DTO

- 为七个读取工具建立 TypeScript input/output schema；
- 统一 subject/language/status code；
- 定义标准错误与 metadata；
- 加入 schema version。

验收：契约测试覆盖正常、缺字段、未知字段和版本不兼容。

### A2. 建立 Agent backend module

- 新建 controller/service/adapter 边界；
- 接入现有 authentication guard；
- 不直接导出 Prisma model；
- 接入 request ID 和结构化日志。

验收：feature flag 关闭时路由不可用，现有接口行为不变。

### A3. 建立 Feature Flags

建议最小 flags：

- `AGENT_WEB_ENABLED`
- `AGENT_READ_TOOLS_ENABLED`
- `AGENT_WRITE_TOOLS_ENABLED`
- `AGENT_AI_TOOLS_ENABLED`
- `AGENT_MCP_ENABLED`

验收：默认关闭；可按环境和 allowlist 用户开启；配置缺失不覆盖其他环境变量。

## 3. Epic B：只读 Capability Adapters

### B1. Learning Dashboard Adapter

复用现有学习看板与 readiness 数据，返回摘要、最近活动和建议所需证据。

验收：关键数字与现有网页一致，空数据有明确 reason code。

### B2. Learning Profile Adapter

读取教育阶段、年级、目标科目、语言、考试日期、经验与每周目标。

验收：只返回 Agent 必需字段，不暴露敏感或内部字段。

### B3. AI Credits Adapter

复用现有 entitlement 服务，区分有限余额、无限额度和不可用状态。

验收：读取不产生 ledger；白名单不显示伪造的大数字。

### B4. Mastery Adapter

按科目和知识点返回掌握度、证据量、更新时间与置信度。

验收：证据不足时不得输出确定性薄弱结论。

### B5. Review Queue Adapter

复用错题/复习队列，返回优先级、原因和可跳转对象。

验收：只包含当前用户对象，排序规则可解释。

### B6. Mock Attempts Adapter

返回最近模考、状态、科目、时间和结果摘要。

验收：未完成与已提交状态正确，插件/Agent 无法修改。

### B7. Past-paper Search Adapter

复用已发布资源查询，支持科目、年份、语言和资源类型过滤。

验收：不返回未发布资源；深链和下载权限沿用现有规则。

## 4. Epic C：Agent Runtime 只读版

### C1. Intent Router

识别六类 `WA-F0` 意图和普通帮助请求；低置信度时提出一个最小澄清问题。

验收：固定集上不把查询误路由为状态变更。

### C2. Tool Orchestrator

- 注册读取工具 allowlist；
- 设置单轮/单 run 工具次数与超时；
- 支持串并行读取；
- 处理部分失败和重试。

验收：模型无法调用未注册写工具；循环调用可被终止。

### C3. Context Builder

按意图最小化加载档案、掌握度和历史，区分事实、推断和用户输入。

验收：不同用户上下文隔离，日志不记录不必要正文。

### C4. Response Composer

统一回答结构：直接结论、简短依据、下一步操作。支持中文和英文。

验收：所有业务数字能追溯到工具结果，不由模型自行计算余额。

### C5. Run Lifecycle

实现 created/running/completed/failed/cancelled，加入 request ID、版本和 channel。

验收：刷新或断线后能安全恢复结果，不重复运行工具。

## 5. Epic D：网页体验

### D1. 正式页面框架

把 Labs 视觉方向移植到现有 frontend，复用站点 header、头像、语言、色彩、排版、按钮、卡片和响应式规则。

验收：不是 iframe 或独立主题；不会覆盖全站 CSS。

### D2. 对话列表与空状态

展示欢迎信息、能力范围、建议 prompt 和隐私/额度简述。

验收：新用户能理解 Agent 能做什么，附件格式、限制和隐私清楚，也不会误以为能完成尚未开放的业务写操作。

### D3. Composer

支持输入、发送、停止、键盘快捷键和禁用状态；支持选择文件、拖放、粘贴截图、附件队列、进度、取消、删除和重试。

验收：重复点击不产生重复请求；移动端软键盘下可用；附件层不遮挡能力菜单、输入框或学习上下文。

### D3a. 附件预览与引用

支持私有预览、页码导航、图片缩放和回答引用定位。

验收：引用不能访问其他用户附件；长文件名、低清警告和解析失败状态完整。

### D4. Message 与 Tool Status

展示用户/Agent 头像、流式内容、工具状态、错误、重试、复制和反馈。

验收：长文本、公式、中英文混排不溢出；浮层不遮挡主要内容。

### D5. 学习上下文侧栏

展示必要的考试目标、今日状态和快捷入口；移动端折叠为抽屉。

验收：数据来自共享工具，不在前端重复计算。

### D6. Deep Links

普通训练在 Agent 内打开；错题、模考、真题和设置按迁移顺序改为 Agent 工作区，完成前保留受控回退。

验收：语言前缀、权限和不存在对象均正确处理，无开放重定向。

### D7. 无障碍与国际化

验收：键盘可操作、焦点清楚、ARIA 合理、主要对比度达标；中英文不使用硬编码拼接。

## 6. Epic E：数据与可观测性

### E1. AgentRun / ToolExecution Migration

只增加新表、索引和 nullable 关联，不修改现有认证、额度和学习表语义。

验收：迁移在空库与现有数据库快照成功；旧应用镜像仍可运行。

### E2. 结构化事件

记录 run、tool、latency、result、channel 和版本，不记录 token、secret 或不必要正文。

验收：一次用户请求可从前端 request ID 追踪到工具执行。

### E3. Dashboard 与告警

观测成功率、P95、取消、工具失败和异常循环。

验收：能区分业务拒绝、用户错误、依赖失败和系统错误。

### E4. Retention Job

按配置清理或去标识过期 Agent 内容，保留必要审计索引。

验收：任务可 dry-run、可重入、有删除统计。

## 7. Epic F：安全与回归

### F1. Object-level Authorization Tests

覆盖所有工具的跨用户、跨机构和管理员边界。

### F2. Prompt Injection Corpus

建立题目、PDF 文本、用户消息和工具输出中的注入样本。

### F3. Rate Limits

接入现有 rate-limit 基础设施，按用户/run/tool 限制。

### F4. Regression Suite

确保 Google 登录、邮箱注册/验证、Cookie、档案设置、AI 额度、练习、模考、真题和后台均不退化。

### F5. Kill Switch Drill

演练关闭 Agent 页面、读取工具和整个 runtime。

验收：无需回滚数据库即可停止新请求，现有网站继续服务。

## 8. Epic G：后续写入准备（不在 WA-F0 开启）

### G1. Idempotency Store

定义用户、工具、版本、输入哈希和结果对象的唯一关系。

### G2. Confirmation Store

支持 L2/L3 的短时一次性确认记录。

### G3. Usage Reservation

在现有 usage meter 之上设计 reserve/settle/release，不建立第二余额。

### G4. Disabled Write Tool Schemas

完成 schema 与测试，但生产 flag 保持关闭。

验收：即使模型尝试调用，未开放工具也被服务端稳定拒绝且不产生状态变化。

## 8A. Epic H：文档与图片理解

### H1. Attachment Policy 与数据模型

建立格式/大小/页数策略、AgentAttachment、页面、chunk、分析和消息关联模型。

### H2. 私有上传链路

实现上传会话、完成确认、hash/所有权校验、状态查询、取消和删除。

### H3. 隔离扫描与解析 Worker

实现文件类型校验、恶意软件扫描、资源限制、PDF/DOCX 原生提取和安全失败分类。

### H4. OCR 与视觉增强

处理扫描 PDF、题目图片、公式、图表和低置信度区域，并接入 AI Gateway/额度。

### H5. 私有检索与引用

按页、题目和版面块切分，建立会话级检索，生成稳定 page/chunk/region citation。

### H6. Attachment Analysis Tools

支持文档问答、总结、题目/作答分析、多文件比较和知识点映射。

### H7. 生命周期与可观测性

实现保留、删除、派生内容清理、处理指标、成本与审计关联。

验收：满足 [10-ATTACHMENT-INGESTION.md](./10-ATTACHMENT-INGESTION.md) 的 `WA-F0/WA-P1` 验收标准。

## 9. 推荐实施顺序

```text
A1 -> A2/A3 + E1
   -> B1..B7 + demo seed/reset
   -> C2/C5 + E2 + D1
   -> H1/H2
   -> H3/H5
   -> C1/C3/C4 + D2..D6
   -> H4/H6
   -> local golden-path E2E
   -> local investor demo freeze
   -> F1..F5 production hardening
   -> internal read-only release
   -> G1..G4
```

本地演示的具体 D0–D5 门槛见 [12-LOCAL-DEMO-DELIVERY-PLAN.md](./12-LOCAL-DEMO-DELIVERY-PLAN.md)。可并行项必须共享已经冻结的 DTO，避免前后端各自猜测字段。

## 10. 首期 PR 切分建议

每个 PR 保持可审查和可回滚：

1. Agent contracts 与 error taxonomy；
2. feature flags 与空 module；
3. AgentRun/ToolExecution 向前兼容迁移；
4. profile/dashboard/credits adapters；
5. mastery/review/mock/past-paper adapters；
6. runtime 只读 orchestrator；
7. frontend shell 与 design tokens 复用；
8. private attachment model/upload/security pipeline；
9. messages/composer/attachment queue/tool status；
10. extraction/OCR/private retrieval/citations；
11. side context/deep links/i18n/a11y；
12. E2E、安全、可观测性和 release gate。

数据库迁移、功能启用和生产放量不要合并在同一个不可逆 PR/发布步骤中。

## 11. Definition of Done

每项工程任务只有满足以下条件才算完成：

- 代码、类型和迁移经过审查；
- 单元/契约/集成测试通过；
- 安全与对象授权测试覆盖；
- 中英文和移动端行为确认；
- 日志无敏感数据；
- feature flag 和回滚方式明确；
- 文档、监控和错误处理同步更新；
- 未修改或覆盖既有生产 secrets/config；
- 适用的现有 release gates 继续通过。

## 12. 明确暂缓

- Remote MCP 与公开插件发布；
- 自定义插件 UI；
- 任意 URL 抓取，以及支持格式之外的任意文件；
- 模考最终提交；
- 机构/管理员 Agent；
- 自动修改学习档案；
- 主动通知、定时任务和长时后台 Agent；
- 替代现有主导航或全部学习页面。

这些能力在 `WA-F0` 获得真实数据后重新排序，而不是默认进入下一版本。

## 13. 首条学习结果闭环增量

`WA-F0` 继续作为基础安全层；`LS-V1` 追加 Goal、Evidence、V2 Shadow State、Target Gap、Prescription 和幂等练习创建。施工范围、真实/演示数据边界、决策规则、PR 顺序和完成定义统一以 [18-FIRST-VERTICAL-SLICE.md](./18-FIRST-VERTICAL-SLICE.md) 为准。

该增量不开放 Agent 直接调用自动出题、修改学习状态或展示未经校准的目标达标概率。

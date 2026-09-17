# CSCAPilot Agent 实施路线图

状态：Accepted v0.2  
目标：先在现有本地电脑完成可重复的投资人演示，再在不干扰现有线上业务的前提下生产化，并为远程 MCP 插件预留统一能力层。

当前立即执行的 D0–D5 路线、演示范围、硬件约束、黄金路径和 PR 顺序以 [12-LOCAL-DEMO-DELIVERY-PLAN.md](./12-LOCAL-DEMO-DELIVERY-PLAN.md) 为准。本文件的 Phase 0–6 是演示通过后的总体产品与生产发布路线；两者共享相同契约，不建立一次性演示代码分支。

发布物使用 [架构收口 ADR](./19-ARCHITECTURE-CLOSURE-ADR.md) 中的固定 ID：`DEMO-V1 -> WA-F0 -> LS-V1 -> WA-P1 -> PLUGIN-P1 -> PROD-V1`。阶段标题中的“最小闭环”只描述能力，不再作为另一个 MVP 定义。

## 1. 实施原则

- **先旁路、后接入**：最初只读现有数据，不改变现有页面和业务流程。
- **先网页、后插件**：先验证共享 Capability Layer，再开放远程 MCP。
- **先确定性能力、后生成式能力**：查询、导航和创建既有训练先上线，AI 生成逐项开放。
- **所有能力可关闭**：每个工具、AI 类别、渠道和用户组都有独立 feature flag。
- **不覆盖线上配置**：沿用现有 Google 登录、邮箱、Cookie、数据库、DeepSeek Gateway 和额度配置；部署配置只增加新项。
- **数据库只做向前兼容迁移**：先加表/字段，再双写或回填，最后才考虑清理旧结构。
- **同一业务只有一个事实来源**：Agent 复用领域服务，不复制余额、掌握度或模考状态计算。

## 2. 交付路径

```text
DEMO-V1  本地投资人演示
   -> Phase 0  生产契约与安全基线
   -> WA-F0  只读 Capability Layer
   -> LS-V1  学习结果闭环
   -> WA-P1  网页 Agent 小流量试点
   -> PLUGIN-P1  Remote MCP 私测
   -> PROD-V1  稳定化与公开发布
```

阶段只能在退出条件满足后推进。任何阶段出现额度重复扣除、越权、错误提交模考或影响现有登录的情况，立即停止扩量。

## 3. Phase 0：契约冻结与安全基线

### 目标

把当前文档转化为可测试的接口边界，建立不碰生产数据的开发环境。

### 工作项

- 确认 `WA-P1` 用户旅程与明确非目标；
- 冻结首批工具名称、输入、输出、错误码和确认等级；
- 定义 `AgentRun`、`ToolExecution`、确认记录的最小数据结构；
- 定义 channel、tool version、prompt version 和 request ID 规范；
- 建立 Agent 相关 feature flags，默认全部关闭；
- 建立独立测试账号、额度和题库样本；
- 整理现有领域服务复用清单，识别仍直接写数据库的旧路径；
- 完成威胁模型和隐私数据分类。

### 退出条件

- P0 工具均有契约测试样例；
- 开发环境不使用生产 API key 和生产 OAuth client；
- feature flags 能按环境、渠道和用户关闭；
- 数据库迁移通过空库、现有快照和回滚演练；
- 产品、工程和安全对 L0–L3 分级达成一致。

## 4. Phase 1：只读 Capability Layer

### 目标

用统一服务返回 Agent 所需学习上下文，但不产生业务状态和额度变化。

### 首批能力

- `get_learning_dashboard`
- `get_learning_profile`
- `get_ai_credit_balance`
- `get_subject_mastery`
- `get_review_queue`
- `list_mock_exam_attempts`
- `search_past_papers`

### 实施要求

- 在 backend 内建立 Agent/Capability 模块；
- 适配现有 StudentProfile、学习看板、错题、模考和真题服务；
- 返回稳定 DTO，不直接暴露 Prisma model；
- 所有查询在数据库层按当前用户约束；
- 加入 request ID、延迟、错误分类和数据来源；
- 支持中英文展示字段，但业务枚举保持稳定 code；
- 不新增第二套缓存事实来源。

### 退出条件

- 所有读取工具通过对象级授权测试；
- 与现有页面展示的关键数据一致；
- P95 延迟达到约定目标；
- 关闭 Agent flag 后现有网站无行为变化；
- 读取工具不会产生 AI 调用或额度流水。

## 4A. 并行轨：实时学习智能 V2

该轨道不阻塞 `WA-F0` 只读能力，也不直接替换现有掌握度系统。完整决策见 [15-REALTIME-LEARNING-INTELLIGENCE-ADR.md](./15-REALTIME-LEARNING-INTELLIGENCE-ADR.md)。

### 工作项

- 冻结 `LearningEvidenceEventV1`、`UserCscaTopicStateV2` 和 `LearningPrescriptionV1`；
- 建立历史答案回放夹具与当前 v1 基线；
- 每次有效答题写入幂等、不可变 Evidence；
- 运行 V2 Shadow Projection，不影响当前学生推荐；
- 建立状态版本、重放、题目纠错补偿和投影健康检查；
- 内部展示多维状态、置信度、证据不足和推荐理由；
- 达到门槛后按学科、题型和用户群灰度 Decision Engine。

### 退出条件

- 答题成功后 Evidence 不丢失、不重复；
- 同一事件和模型版本重放结果一致；
- V2 不改变现有 v1 页面和训练行为；
- 低质量或被召回题目的证据可以降权或撤销；
- 低样本状态不展示虚假精确度；
- 推荐结果绑定 stateVersion、policyVersion 和可解释理由；
- v1 回退和按学科 kill switch 已验证。

## 4B. 并行轨：自适应教学干预

该轨道依赖实时学习状态，但不阻塞 Agent 基础会话。完整决策见 [16-ADAPTIVE-LEARNING-INTERVENTION-ADR.md](./16-ADAPTIVE-LEARNING-INTERVENTION-ADR.md)。

### 工作项

- 定义版本化干预决策、触发原因、内容计划和 Outcome；
- 离线回放重复错误、提示依赖和继续刷题收益过低等规则；
- 先运行 Shadow Decision，不打断真实学生；
- 优先接入已审核 Concept Card、标准解析和验证题；
- 先开放轮末建议，再灰度 mini-set 间隔 Micro Lesson；
- 最后接入 AI 个性化讲解和手写 guided correction；
- 建立冷却、最大打断次数、跳过、推迟和关闭控制。

### 退出条件

- 查看讲解不会直接提升掌握度；
- 正式模考不被主动讲解打断；
- 重复证据不会重复触发同一干预；
- 验证题和延迟复习能衡量实际效果；
- AI 失败可降级到已审核内容；
- 关闭干预后普通练习和学习状态更新不受影响。

## 4C. 并行轨：目标分数与结果校准

该轨道依赖 V2 学习状态和受治理的测量题，但不阻塞基础 Agent 会话。首版先形成可信差距判断，再逐步开放分数区间和达标概率。完整决策见 [17-TARGET-SCORE-OUTCOME-ADR.md](./17-TARGET-SCORE-OUTCOME-ADR.md)。

### 工作项

- 建立版本化 `StudentScoreGoal` 与 `ExamScoringPolicy`；
- 冻结独立诊断、保留题和计时模考的测量边界；
- 实现规则化 `TargetGapSnapshot`，优先输出差距和证据不足；
- 离线生成 Forecast 并校准区间覆盖率与高置信错误率；
- 内部 Shadow 展示轨迹、达标概率和推荐变化；
- 达到门槛后按学科灰度学生可见预测；
- 将 Decision Engine 的目标逐步切换为目标差距缩小与长期保持。

### 退出条件

- 无有效评分规则或证据不足时不输出分数预测；
- 训练题与无偏验证题严格隔离；
- Forecast、Gap 和 Prescription 绑定完整版本并可重放；
- 目标修改、题目召回和评分规则更新能触发正确重算；
- 学生界面不出现成绩保证或伪精确数字；
- 分群偏差、feature flag、按学科灰度和回退通过验证。

## 5. Phase 2：网页 Agent 最小闭环

### 目标

把 Labs 原型接入真实只读能力和私有附件基础设施，让用户通过 Agent 完成“理解现状—理解上传资料—获得建议—进入类型化学习工作区”的闭环。完整 `WA-P1` 需继续完成 Phase 3 的多模态分析与计费闭环。

### WA-F0 对话

- 今天学什么；
- 查看薄弱点；
- 找到待复习错题；
- 查看最近模考；
- 搜索真题；
- 查询 AI 余额；
- 上传 PDF、DOCX 或题目图片并看到安全处理、解析和预览状态；
- 基于已解析附件进行引用式问答；
- 在 Agent 内打开练习、讲解、真题、模考和报告工作区；迁移期只为尚未完成的能力保留旧页面回退。

### 实施要求

- 将 Agent 页面纳入现有前端路由和设计系统；
- 复用当前登录、头像、语言、导航、按钮、卡片和响应式 tokens；
- 实现流式回答、停止、重试、复制、反馈和错误恢复；
- 对工具执行显示简洁状态，不暴露内部 chain-of-thought；
- 使用受控深链，不在 URL 中放 token；
- 对空档案、无数据、未登录和权限不足提供可行动降级；
- 保存最小 Agent run 记录，正文保留策略可配置。
- 实现私有上传会话、安全扫描、PDF/DOCX 提取、图片/扫描件 OCR 和会话级检索；
- Composer 显示上传、扫描、解析、就绪、失败、取消和重试，并支持页码/区域引用。

### 退出条件

- 六类学习对话和附件上传/识别流程在桌面端与移动端可完成；
- 中英文、空数据、慢请求和局部失败均有正确界面；
- 关键无障碍检查通过；
- 不修改现有 Google 登录、邮箱发送和认证 Cookie 配置；
- 关闭页面入口即可完整回退。

## 6. Phase 3：受控写入与 AI 计费

### 目标

让 Agent 能创建训练并提供 AI 辅助，同时验证确认、幂等和额度闭环。

### 推荐开放顺序

1. 创建普通自适应训练；
2. 创建错题复习；
3. 创建小型诊断；
4. 生成提示；
5. 生成解析；
6. 生成学习总结；
7. 创建模考。

附件的多模态分析、长文总结和作答评价在本阶段通过 AI Gateway 开放；基础上传、扫描、确定性提取与预览已在 Phase 2 完成。

模考最终提交、学习档案批量修改暂不进入该阶段。

自动出题不作为本阶段退出条件。Agent 先使用已发布题库；自动出题通过质量门槛后，按 [14-QUESTION-GENERATION-INTEGRATION-ADR.md](./14-QUESTION-GENERATION-INTEGRATION-ADR.md) 依次完成 Mock Adapter、影子接入和单学科灰度，不直接依赖仍在变化的内部 Service。

### 实施要求

- 写工具调用现有领域服务，不直接操作表；
- L1/L2 操作实现幂等键和影响说明；
- AI 请求接入现有 AiGatewayService；
- 建立额度预留、结算、释放/退款流程；
- 白名单/无限额度保持现有 entitlement 语义；
- provider/model 由服务端 task policy 决定；
- 工具失败不产生孤立对象或重复流水；
- 额度不足时仍能使用非 AI 学习能力。

### 退出条件

- 超时、重复点击、客户端断线和并发重试不重复创建或扣费；
- AI 结果与 ledger、gateway call log 能关联；
- 关闭任一 AI tool flag 不影响其他功能；
- 固定评估集达到质量门槛；
- 已演练 provider 故障和全局 AI kill switch。

## 7. Phase 4：小流量线上试点（WA-P1）

### 目标

用真实用户数据验证价值、稳定性和成本。试点期间旧学生页面保留作回退；Agent 原生工作区达到等价门槛后再逐项移除旧入口。

### 放量建议

- 内部团队；
- 明确同意的测试用户；
- 1%–5% 登录用户；
- 逐步扩大到单科目或单地区用户；
- 达标后扩大读取与低风险写工具；
- 最后才考虑高成本或高影响工具。

### 观察指标

- 首次任务完成率；
- 建议到训练的转化率；
- 7 日复访和训练完成率；
- 工具成功率与 P95 延迟；
- AI 单次有效结果成本；
- 重复扣费、越权和错误状态变更数量；
- 用户主动关闭、投诉和人工支持量。

### 退出条件

- 安全严重事件为 0；
- 核心任务完成率达到产品门槛；
- 错误率、成本和支持负担可控；
- 回滚与数据修复演练完成；
- 用户反馈表明 Agent 带来额外价值，而非只增加操作步骤。

## 8. Phase 5：Remote MCP 私测（PLUGIN-P1）

### 目标

在 Codex 等宿主中使用已经过网页小流量验证的同一能力层，不新增业务规则。

### 工作项

- 实现 Remote MCP Gateway；
- 配置 OAuth 2.1 metadata、PKCE、audience 和 scopes；
- 制作首批 Skills；
- 提供结构化结果、简短文本和网页深链；
- 标记 `channel=codex|chatgpt`；
- 建立连接查看、撤销和审计界面；
- 用内部账号完成宿主兼容测试。

### 退出条件

- 未授权、错误 audience、scope 不足和撤销连接均正确拒绝；
- 插件无自定义 UI 也能完成 P0 工作流；
- 网页与插件跨渠道状态、额度一致；
- 插件无法访问管理员接口或供应商凭据；
- MCP Gateway 可单独关闭且不影响网页端。

## 9. Phase 6：稳定化与公开发布

### 工作项

- 完善每周复盘、长期计划和跨会话记忆；
- 根据使用数据增加必要的插件 UI；
- 完善国际化、无障碍和移动端；
- 建立 SLO、值班、告警和事件响应；
- 冻结 API/队列/投影 SLO、RPO、RTO 和备份恢复演练；
- 设置 Outbox/队列积压、dead-letter、stale Forecast 和异常费用阈值及负责人；
- 完成公开插件说明、隐私说明和支持文档；
- 完成学生/未成年人、供应商数据、数据导出删除和内容纠错流程评审；
- 对高影响工具做单独灰度；
- 建立工具和 Skill 版本退役流程。

## 10. 部署与配置继承

Agent 发布只允许增加下列配置类别：

- Agent feature flags；
- Agent/MCP 服务地址；
- OAuth resource/client 配置；
- Agent 限流、预算和保留期；
- prompt/tool/skill 版本；
- observability 与 kill switch 配置。

部署脚本不得覆盖已有：

- `DATABASE_URL`；
- `AUTH_SECRET` 与 Cookie 策略；
- Google OAuth client/secret/redirect URI；
- SMTP host、port、user、password、from；
- DeepSeek/API keys 与现有模型路由；
- CORS/public app origin；
- 现有 entitlement、白名单和额度配置。

发布前必须对这些配置只做“存在性与兼容性校验”，不得写入默认值覆盖线上值。

## 11. 数据库迁移策略

1. 上线前备份并验证恢复；
2. 迁移只添加 Agent 新表、索引或 nullable 字段；
3. 老版本应用必须能在新 schema 上运行；
4. 数据回填独立执行、可暂停、可重入；
5. 新代码先 shadow/read-only，再启用写入；
6. 回滚应用时保留新增数据，不做自动 destructive down migration；
7. 清理旧字段另开后续版本并再次审批。

## 12. 回滚层级

| 层级 | 动作 | 数据处理 |
|---|---|---|
| R1 | 关闭单个 tool/AI flag | 保留已完成记录 |
| R2 | 关闭 Agent 写入，只保留读取 | 释放未执行预留 |
| R3 | 隐藏网页 Agent 入口 | 后端记录保留供审计 |
| R4 | 关闭 MCP Gateway | 撤销/拒绝新 token 调用 |
| R5 | 回滚应用镜像 | 不回滚已执行的向前兼容迁移 |

任何涉及错误扣费的回滚都必须生成可审计退款流水，不能直接修改余额数字。

## 13. 推荐里程碑

不在本稿承诺日历日期。建议按能力门槛管理：

- M0：契约、安全和开发环境就绪；
- M1：本地只读 API 与演示数据可用；
- M2：本地投资人演示冻结，三条黄金路径通过；
- M3：训练创建与 AI 额度闭环；
- M4：Codex 插件私测；
- M5：线上小流量；
- M6：公开可用。

每个里程碑都必须附带评估报告、已知问题、回滚步骤和下一阶段批准人。

## 14. 当前评分预测施工状态

- PR9B：评分政策、题目校准、Forecast 校准与完整 Gate 治理底座；
- PR9C：确定性离线校准流水线、双人审核与追加式审计；
- PR9D-A：化学可解释模型、最近限时模考基线、内部 Shadow 数据适配与回放（已实现，学生发布关闭）；
- PR9D-B（总体）：真实时间切分数据集、基线比较、概率/区间校准与分层评估；
- PR9D-B1：后续限时模考代理结果的数据集、时间/学习者隔离和结果来源硬门（已实现，只用于开发）；
- PR9D-B2：真实 CSCA 成绩的独立同意、双人核验、撤回/更正、不可变清单与校准失效传播（已实现，仍不面向学生发布数值）；
- 后续独立发布阶段：只有 PR9D-B qualified 后，才设计小流量学生端展示和回退。

PR9D-A 细节见 [41-CHEMISTRY-SCORE-PREDICTION-SHADOW.md](./41-CHEMISTRY-SCORE-PREDICTION-SHADOW.md)。

PR9D-B2 细节见 [43-VERIFIED-CSCA-EXAM-OUTCOME-CLOSED-LOOP.md](./43-VERIFIED-CSCA-EXAM-OUTCOME-CLOSED-LOOP.md)。下一阶段应先运行真实数据采集与运营核验试点，观察同意率、核验吞吐、撤回传播与样本偏差；样本和质量门槛未达到前，不进入学生端预测展示。

## 15. 当前题源供给交接施工状态

- PR10A：Agent 今日方案和教学干预验证在可信题源不足时，写入去重、可审计的异步补库需求；学生请求不调用生成器（已实现）；
- PR10B：内容生产侧稳定 v1 契约、Shadow No-op 适配器、幂等生产计划和审核库存恢复对账（已实现）；仍不允许 Agent 控制生成、审核或发布；
- PR10C：缺口复核样本、恢复后领域可执行确认、30 天指标与 Shadow Gate（已实现）；真实运营样本未达到门槛前不连接生产适配器。
- PR10D：带数据库租约的自动 Shadow 复核、脱敏运营导出和数学/物理/化学独立验收报告（已实现）；真实适配器仍未授权。
- PR10E：持久运行历史、过期运行恢复、运营健康诊断与逐学科样本新鲜度（已实现）；下一步进入受控 Shadow 试点观察。

## 16. 当前 Web Agent API 编排施工状态

- PR11A：通过现有 AI Gateway 接入严格 Schema 的自然语言意图分类；模型只在 `today_plan / capability_help / clarify / unsupported` 中选择，不能返回工具名或改变学习事实（已实现）；
- 未配置模型、调用失败、超时、低置信度或输出不合规时，继续使用确定性规则或固定澄清文案；
- PR11B：已增加学习状态、错题、模考和真题资源的服务器固定路由；模型只能选择服务器事实的展示样式与顺序，最终文案不接受模型新增事实（已实现）；
- PR11C：已建立中英文固定评测集、故障/注入/空数据/归属/预算门和显式 Live Demo Gate；固定集已通过（已实现）；
- PR11D：已建立仅允许本地数据库的隔离演示账号与事实数据，完成真实接口、真实 Provider 五轮连续彩排及数据库审计，30/30 Run 与 50/50 模型调用成功（已实现）；
- PR11E：已建立与普通测试隔离的真实浏览器黄金路径，覆盖登录、Composer、连续问答、SSE、会话恢复、布局和失败反馈；同时修正 desktop/mobile 快速回归债务（已实现）；
- PR11F：已建立 PNG 手写作答与原生文本 PDF 的真实浏览器黄金路径，覆盖上传、视觉/文本分析、页码引用、可信题源匹配、学生确认和撤销（已实现）；
- PR11G：已建立今日方案到练习启动、作答提交、Evidence/Projection 和 Agent 状态刷新的真实闭环，并冻结统一学习辅助 v1（已实现）；
- PR12A：已完成统一辅助面板、刷新恢复、计费语义和内容问题反馈（已实现）；
- PR12B：已完成版本化 TeachingAsset、知识点/语言解析、首个白名单函数交互微课、服务端主动提问、A4 曝光和真实黄金路径（已实现）；
- PR12C：已将 TeachingAsset 接入主动干预 Delivery、mini-set 间隔展示和既有独立验证调度（已实现）；
- PR12D：已扩展物理、化学白名单交互案例，并冻结视频资产协议；视频 renderer 留待媒体处理、播放器和真实浏览器验收完成后开放。
- PR12E：已建立教学资产后台目录、草稿编辑、真实组件预览、审核、发布、版本切换、下架与审计闭环。
- PR12F：已建立教学资产效果聚合、逐版本归因、三阶段独立验证指标、稳定性结果和只读运营信号。
- PR12G：已建立教学资产质量告警、版本退化识别、人工确认/解决/重开和审计恢复队列。
- PR12H：已建立按学生历史、教学深度与资源效果进行的确定性个性化路由，包含失败内容避重、20% 受控探索、选择快照和安全回退。
- PR12I：已建立 legacy/shadow/active 三态路由、双轨决策事件、脱敏后台诊断、发布硬门和无迁移快速回退。
- PR12J：已把路由决策、教学交付、独立验证与稳定掌握串成效果对照，并建立按学科持久化自动熔断和人工审计重置。
- PR12K：已将手写过程分析作为 A3 `check_work` 接入 Agent 安排的当前练习题，完成服务端可信上下文绑定、独立验证/完整解法门、分层识别结果、辅助曝光和零直接掌握度写入。
- PR12L：已完成当前题手写引导纠错的真实浏览器黄金路径，覆盖真实视觉 Provider、刷新恢复、移动端布局、证据懒创建隔离、掌握度不变和正式练习结算；同时把视觉分析默认输出预算校准为 8,000。
- PR12M：已建立 Demo V1 统一发布门禁，三条黄金路径分别从确定性基线连续运行 5 轮；完成会话复用、路径隔离、未知学科的受治理题源反向解析、视觉结构化输出收敛和抽取题干确定性展示。最终 50/50 Agent Run、15/15 附件分析、75/75 Provider 调用通过，实测成本约 USD 0.0392。
- PR12N（进行中）：确立 Agent 原生学习工作区；普通练习及讲解后的即时/保持/迁移验证不再跳转科目页；真题检索、PDF 阅读下载、可信源卷绑定、题号/页码定位和确定性引用回答均在 Agent 内完成。下一步在引用契约上建设分层、可追问的引导式讲题。
- PR12O（后续稳定化）：补齐 10–20 页固定附件冒烟集、明确标记的 Provider 缓存回放、断网/冷启动/超时演练和投资人演示录屏；完成前不宣称 D5 整体关闭。

PR11A 的边界和回退策略见 [49-API-LLM-AGENT-ROUTER.md](./49-API-LLM-AGENT-ROUTER.md)。
PR11B 的固定查询路由和事实约束见 [50-GROUNDED-AGENT-READ-ROUTES.md](./50-GROUNDED-AGENT-READ-ROUTES.md)。
PR11C 的固定集、阈值和真实接口运行方式见 [51-AGENT-FIXED-EVAL-AND-DEMO-GATE.md](./51-AGENT-FIXED-EVAL-AND-DEMO-GATE.md)。
PR11D 的隔离数据、真实模型实测指标和复现方式见 [52-AGENT-LIVE-DEMO-REHEARSAL.md](./52-AGENT-LIVE-DEMO-REHEARSAL.md)。
PR11E 的真实浏览器步骤、测试隔离和剩余边界见 [53-AGENT-BROWSER-GOLDEN-PATH.md](./53-AGENT-BROWSER-GOLDEN-PATH.md)。
PR11F 的附件 fixture、真实 Provider 指标、证据边界和复现方式见 [54-AGENT-ATTACHMENT-BROWSER-GOLDEN-PATH.md](./54-AGENT-ATTACHMENT-BROWSER-GOLDEN-PATH.md)。
学习辅助阶梯、教学资产、交互动画/视频和主动干预合流方案见 [55-LEARNING-ASSISTANCE-AND-TEACHING-ASSET-ADR.md](./55-LEARNING-ASSISTANCE-AND-TEACHING-ASSET-ADR.md)。
TeachingAsset V1、首个交互微课与真实黄金路径见 [58-TEACHING-ASSET-V1-AND-FIRST-MICRO-LESSON.md](./58-TEACHING-ASSET-V1-AND-FIRST-MICRO-LESSON.md)。
主动微课、组间展示与独立验证闭环见 [59-TEACHING-ASSET-PROACTIVE-INTERVENTION-CLOSED-LOOP.md](./59-TEACHING-ASSET-PROACTIVE-INTERVENTION-CLOSED-LOOP.md)。
多学科交互资产与视频、字幕、章节、播放事件和可访问性合同见 [60-MULTI-SUBJECT-TEACHING-ASSETS-AND-VIDEO-CONTRACT.md](./60-MULTI-SUBJECT-TEACHING-ASSETS-AND-VIDEO-CONTRACT.md)。
教学资产后台运营与安全发布工作流见 [61-TEACHING-ASSET-ADMIN-PUBLISHING-WORKFLOW.md](./61-TEACHING-ASSET-ADMIN-PUBLISHING-WORKFLOW.md)。

教学资产效果评估和运营反馈口径见 [62-TEACHING-ASSET-EFFECTIVENESS-FEEDBACK-LOOP.md](./62-TEACHING-ASSET-EFFECTIVENESS-FEEDBACK-LOOP.md)。

教学资产质量告警与人工复核队列见 [63-TEACHING-ASSET-QUALITY-REVIEW-QUEUE.md](./63-TEACHING-ASSET-QUALITY-REVIEW-QUEUE.md)。

教学资产个性化排序、失败避重、受控探索与安全回退见 [64-TEACHING-ASSET-PERSONALIZED-ROUTING.md](./64-TEACHING-ASSET-PERSONALIZED-ROUTING.md)。

教学资产路由 Shadow、运营诊断、发布门和回滚方案见 [65-TEACHING-ASSET-ROUTING-SHADOW-AND-RELEASE-GATE.md](./65-TEACHING-ASSET-ROUTING-SHADOW-AND-RELEASE-GATE.md)。

教学路由效果归因、样本门槛与自动熔断见 [66-TEACHING-ROUTING-OUTCOME-CLOSED-LOOP-AND-CIRCUIT-BREAKER.md](./66-TEACHING-ROUTING-OUTCOME-CLOSED-LOOP-AND-CIRCUIT-BREAKER.md)。

当前题手写过程检查、A3 引导纠错、答案泄露门和学习事实边界见 [67-CONTEXTUAL-HANDWRITING-GUIDED-CORRECTION.md](./67-CONTEXTUAL-HANDWRITING-GUIDED-CORRECTION.md)。

当前题手写引导纠错的真实 Provider、浏览器恢复、移动端与证据边界实测见 [68-HANDWRITING-GUIDED-CORRECTION-BROWSER-GOLDEN-PATH.md](./68-HANDWRITING-GUIDED-CORRECTION-BROWSER-GOLDEN-PATH.md)。

Demo V1 统一发布门禁、五轮实测、修复项和剩余 D5 边界见 [69-AGENT-DEMO-V1-RELEASE-GATE.md](./69-AGENT-DEMO-V1-RELEASE-GATE.md)。

Agent 作为唯一学生主界面、类型化学习工作区、旧页面迁移与下线边界见 [70-AGENT-NATIVE-LEARNING-WORKSPACE-ADR.md](./70-AGENT-NATIVE-LEARNING-WORKSPACE-ADR.md)。

系统推荐与学生主动自由练习并存、共享证据与学习历程的产品边界见 [82-AGENT-DUAL-MODE-LEARNING-ADR.md](./82-AGENT-DUAL-MODE-LEARNING-ADR.md)。

PR10A 细节见 [44-QUESTION-SUPPLY-DEMAND-HANDOFF.md](./44-QUESTION-SUPPLY-DEMAND-HANDOFF.md)。

PR10B 细节见 [45-QUESTION-SUPPLY-FULFILLMENT-SHADOW.md](./45-QUESTION-SUPPLY-FULFILLMENT-SHADOW.md)。

PR10C 细节见 [46-QUESTION-SUPPLY-SHADOW-EVALUATION.md](./46-QUESTION-SUPPLY-SHADOW-EVALUATION.md)。

PR10D 细节见 [47-QUESTION-SUPPLY-SHADOW-OPERATIONS.md](./47-QUESTION-SUPPLY-SHADOW-OPERATIONS.md)。

PR10E 细节见 [48-QUESTION-SUPPLY-SHADOW-PILOT-OPERATIONS.md](./48-QUESTION-SUPPLY-SHADOW-PILOT-OPERATIONS.md)。

# CSCAPilot Agent 能力目录

> 状态：Accepted v1.0  
> 更新时间：2026-09-12  
> 作用：统一说明 Agent 能调用什么、何时开放、谁负责执行，以及哪些能力永远不交给 Agent。

## 1. 使用规则

本文是产品和工程索引，不复制精确 DTO。发生冲突时：

1. 工具名称、输入输出、错误码和风险等级以 [02-TOOL-CONTRACTS.md](./02-TOOL-CONTRACTS.md) 为准；
2. Run、SSE、确认和恢复以 [03-AGENT-RUNTIME.md](./03-AGENT-RUNTIME.md) 为准；
3. 权限与计费以 [06-AUTH-BILLING-SECURITY.md](./06-AUTH-BILLING-SECURITY.md) 为准；
4. 发布阶段以 [19-ARCHITECTURE-CLOSURE-ADR.md](./19-ARCHITECTURE-CLOSURE-ADR.md) 为准；
5. 代码落地后，后端 `contracts/v1` 与 Tool Registry 是可执行事实来源。

任何新增能力必须先进入本目录，明确权限、风险、费用、幂等、渠道和 owner，再进入 Agent allowlist。

## 2. 图例

### 发布阶段

- `WA-F0`：只读和附件基础；
- `LS-V1`：首条目标—练习—证据闭环；
- `WA-P1`：网页 Agent 小流量完整 P0；
- `PLUGIN-P1`：Codex/ChatGPT 等外部 Agent 私测；
- `PROD-V1`：生产公开版本；
- `Future`：不进入当前施工承诺。

### 风险等级

| 等级 | 语义 | 执行要求 |
| --- | --- | --- |
| L0 | 只读且无额外费用 | 授权通过后直接执行 |
| L1 | 低风险、可恢复写入 | 明确用户意图、幂等执行 |
| L2 | 修改设置或产生 AI 费用 | 展示影响/费用并按策略确认 |
| L3 | 高影响或难恢复 | 一次性服务端确认令牌 |

### 渠道

- Web：网页 Agent；
- Plugin：外部 Agent 通过 MCP；
- UI API：Composer 或 Artifact 组件直接调用，不暴露给大模型选工具；
- Internal：后台服务能力，不进入 Agent Tool Registry。

## 3. 学习读取能力

| 工具 | 学生获得的结果 | 首发阶段 | Scope | 风险/AI | Web | Plugin | 事实来源 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `get_learning_dashboard` | 今日概览、进度和建议摘要 | WA-F0 | `learning.read` | L0 / 0 | 是 | 是 | Learning Dashboard 服务 |
| `get_learning_profile` | 年级、目标科目、考试日期、语言和时间偏好 | WA-F0 | `learning.read` | L0 / 0 | 是 | 是 | StudentProfile + Availability |
| `get_ai_credit_balance` | AI 权益、余额和来源 | WA-F0 | `learning.read` | L0 / 0 | 是 | 是 | Entitlement + Usage Ledger |
| `get_subject_mastery` | 学科/知识点多维状态、证据量和置信度 | WA-F0 | `learning.read` | L0 / 0 | 是 | 是 | v1 Adapter / V2 State |
| `get_review_queue` | 到期错题、优先级和原因 | WA-F0 | `learning.read` | L0 / 0 | 是 | 是 | Review Queue |
| `list_mock_exam_attempts` | 未完成模考、历史结果和入口 | WA-F0 | `learning.read` | L0 / 0 | 是 | 是 | Mock Attempt 服务 |
| `search_past_papers` | 已发布真题和资源套装 | WA-F0 | `resources.read` | L0 / 0 | 是 | 是 | Past Paper/Bundle 服务 |

读取能力必须在数据库查询阶段限制当前主体，不能先读取全量数据再过滤。现有 dashboard 的 `readiness.score` 是兼容汇总，不是目标分数预测，也不注册为独立工具。

## 4. 目标、备考度与决策能力

| 工具 | 学生获得的结果 | 首发阶段 | Scope | 风险/AI | Web | Plugin | 事实来源 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `get_score_goal` | 当前目标分数、科目、考试日期和版本 | LS-V1 | `learning.read` | L0 / 0 | 是 | 是 | StudentScoreGoal |
| `update_score_goal` | 版本化修改目标并触发重算 | LS-V1 | `profile.write` | L2 / 0 | 是 | 是 | StudentScoreGoal Service |
| `update_learning_profile` | 修改允许的教育阶段、科目和语言等档案字段 | WA-P1 | `profile.write` | L2 / 0 | 是 | 是 | StudentProfile Service |
| `get_study_availability` | 时区、每周分钟和默认单次时长 | LS-V1 | `learning.read` | L0 / 0 | 是 | 是 | StudyAvailabilityPreference |
| `update_study_availability` | 修改长期时间偏好 | LS-V1 | `profile.write` | L2 / 0 | 是 | 是 | Availability Service |
| `get_target_gap` | 当前最影响目标的能力差距和证据 | LS-V1 | `learning.read` | L0 / 0 | 是 | 是 | TargetGapSnapshot |
| `get_learning_prescription` | 一个首选任务、理由、时间和替代项 | LS-V1 | `learning.read` | L0 / 0 | 是 | 是 | Learning Decision Service |
| `get_question_supply_status` | 训练需求是否有合格已发布库存 | LS-V1 | `learning.read` | L0 / 0 | 是 | 是 | Question Supply Facade |
| `simulate_plan_adjustment` | 模拟时间、日期或节奏改变的影响 | WA-P1 | `learning.read` | L0 / 0 | 是 | 是 | Capacity + Decision Engine |
| `get_score_readiness` | 当前备考度测量状态、缺失证据与下一验证动作 | LS-V1 Shadow* | `learning.read` | L0 / 0 | 是 | 是 | Score Readiness Shadow Gate |

`get_score_readiness` 的 `*` 表示 Shadow Gate 已可被 Agent 调用，但正式分数区间与达标概率尚未开放；当前返回 `insufficient | measuring`、`confidence: insufficient` 和下一验证动作，数值字段固定为 `null`。完成评分策略治理、题目校准与回测后，才允许升级为学生可见的数值预测。

“今天只有十分钟”等内容形成请求级 `SessionConstraint`，只影响本次 Prescription，不调用长期偏好写入工具。

## 5. 学习任务能力

| 工具 | 学生获得的结果 | 首发阶段 | Scope | 风险/AI | 幂等 | Web | Plugin |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `create_adaptive_practice` | 基于已发布题目创建 5 题练习 | LS-V1 | `practice.write` | L1 / 通常 0 | 必须 | 是 | 是 |
| `create_diagnostic` | 创建 20 题诊断 | WA-P1 | `practice.write` | L1 / 0 | 必须 | 是 | 是 |
| `start_review_practice` | 从本人复习队列创建验证练习 | LS-V1 | `practice.write` | L1 / 0 | 必须 | 是 | 是 |
| `start_mock_exam` | 为公开试卷创建本人模考 Attempt | WA-P1 | `mock_exam.write` | L1 / 0 | 必须 | 是 | 是 |
| `submit_mock_exam` | 正式提交已有模考 | WA-P1 | `mock_exam.submit` | L3 / 0 | 必须 | 是 | 条件开放 |

继续已有模考不是独立写工具。Agent 先调用 `list_mock_exam_attempts`，再返回经过所有权验证的入口。

创建训练前必须重新验证 Prescription、state version、题目库存和用户权限。库存不足不能静默生成题目或产生 AI 费用。

## 6. AI 教学能力

| 工具 | 学生获得的结果 | 首发阶段 | Scope | 风险/AI | 执行 | Web | Plugin |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `get_available_assistance` | 当前题目允许与推荐的分级辅助动作 | LS-V1 | `learning.read` | L0 / 0 | 同步 | 是 | 是 |
| `request_learning_assistance` | 概念提醒、渐进提示、步骤检查、例题或受控解析 | LS-V1 | `learning.read` / `ai.generate` | L0–L2 / 按结果 | 同步或异步 | 是 | 是 |
| `get_teaching_asset` | 读取已发布知识卡、例题、交互内容或未来视频 | LS-V1 | `learning.read` | L0 / 0 | 同步 | 是 | 是 |
| `report_learning_content_issue` | 举报题目、讲解、交互内容或 AI 判断 | WA-P1 | `learning.feedback` | L1 / 0 | 同步 | 是 | 是 |
| `generate_question_hint` | 当前题目的渐进式提示 | WA-P1 | `ai.generate` | L2 / 消耗 | 同步 | 是 | 是 |
| `generate_question_explanation` | 结合本人作答的解析 | WA-P1 | `ai.generate` | L2 / 消耗 | 同步 | 是 | 是 |
| `generate_round_summary` | Round 结果、错误模式和下一步 | WA-P1 | `ai.generate` | L2 / 消耗 | 同步 | 是 | 是 |
| `generate_weekly_learning_report` | 结构化周报 | WA-P1 | `ai.generate` | L2 / 消耗 | 同步或缓存 | 是 | 是 |
| `analyze_attachments` | 文档问答、题图分析和手写审阅 | WA-F0 | `ai.generate` | L2 / 按任务 | 异步可恢复 | 是 | 暂不传二进制 |
| `request_generated_practice` | 请求私有定制训练题 | Future/灰度 | `ai.generate` + `practice.write` | L2 / 预留结算 | 异步可恢复 | 条件开放 | 条件开放 |

新交互统一通过 `get_available_assistance` 与 `request_learning_assistance` 进入分级辅助阶梯；`generate_question_hint` 和 `generate_question_explanation` 保留为底层兼容适配器，不由新 UI 或模型绕过策略直接调用。已发布的概念卡、分步例题、交互动画及未来视频统一由 `get_teaching_asset` 读取。具体层级、曝光和跨端边界见 [55-LEARNING-ASSISTANCE-AND-TEACHING-ASSET-ADR.md](./55-LEARNING-ASSISTANCE-AND-TEACHING-ASSET-ADR.md)。

AI 工具统一通过 CSCAPilot AI Gateway。模型、供应商、Prompt、Reviewer 和内部路由不能由 Agent 指定。AI 失败且没有有效结果时按计费策略释放预留；无限额度仍受并发、文件和预算限制。

`request_generated_practice` 默认只能产生 `TRAINING` 题，不能产生正式诊断、校准或模考测量题。

## 7. Composer 与附件 UI API

以下能力由可信前端组件或后台状态机调用，不作为模型自由选择的普通工具：

| 应用能力 | 用途 | 风险 | 调用方 |
| --- | --- | --- | --- |
| `create_attachment_upload_session` | 校验策略并创建短时上传目标 | L1 | Composer UI |
| `complete_attachment_upload` | 验证 hash、大小、所有权并启动处理 | L1 | Composer UI |
| `get_attachment_status` | 获取扫描、解析、OCR 和进度 | L0 | Composer/Artifact UI |
| `delete_attachment` | 撤销访问并启动清理 | L2 | Composer/Settings UI |

消息只携带服务端 `attachmentIds[]`。Agent 可调用 `analyze_attachments`，但不能提交客户端伪造的 OCR 文本、任意 URL 或 base64，也不能绕过所有权和处理状态。

## 8. Agent 不可调用的内部能力

| 内部能力 | 为什么不开放 | 合法执行者 |
| --- | --- | --- |
| Evidence Writer | 防止模型伪造学习事实 | Answer/Review/Mock 领域服务 |
| Learning Projection Worker | 掌握度必须确定、可重放 | Learning Intelligence |
| Score/Gap/Forecast 写入 | 防止模型自行设定成绩判断 | Score Readiness Engine |
| Scoring/Syllabus 管理 | 属于考试事实和治理 | 受控管理员/教研流程 |
| 自动出题 Generator/Validator/Reviewer | 隔离快速演进的出题系统 | Question Generation Engine |
| 题目审核、发布、下架 | 防止未审核内容进入公共题库 | Content Governance |
| 测量池枚举 | 防止诊断/校准题泄露 | Assessment Service |
| AI 余额或白名单调整 | 额度账本是唯一事实来源 | Entitlement/Admin Service |
| 用户角色与组织权限修改 | 防止提权 | Auth/Admin Service |
| 直接 Prisma/SQL 访问 | 绕过权限、事务和审计 | Domain Repository |

Agent 不能通过组合多个低风险工具间接实现上述结果。

## 9. 内部编排能力

以下能力参与闭环，但不属于模型工具：

- `record_prescription_decision`：记录展示、接受、跳过或调整；
- `append_learning_evidence`：答案事务内追加 Evidence；
- `project_learning_state`：按用户/学科序列更新 V2 State；
- `recompute_target_gap`：生成版本化差距快照；
- `recompute_score_readiness`：生成 Shadow/正式 Forecast；
- `select_learning_intervention`：选择讲解、纠错或验证题；
- `request_inventory_replenishment`：后台申请题库补充；
- `compensate_learning_evidence`：题目纠错后的补偿与重放；
- `notify_content_correction`：通知受影响学生。

这些能力由领域事件、队列或应用服务触发，不能接受模型提供的 `userId`、分数、掌握度或发布状态。

`request_inventory_replenishment` 已在 PR10A 以内部 `QuestionSupplyRequestService` 落地，只接受 Agent Runtime 与教学干预验证产生的结构化缺口。它不是模型工具，也不等于自动出题请求；完整边界见 [44-QUESTION-SUPPLY-DEMAND-HANDOFF.md](./44-QUESTION-SUPPLY-DEMAND-HANDOFF.md)。

PR10B 的 `QuestionSupplyFulfillmentService` 是后台领域编排器，不是新增模型工具。它先用现有领域服务精确复核审核库存，再把仍未满足的聚合缺口写成版本化 Shadow 计划；当前适配器保证 `generationInvoked=false`。因此 Web Agent、LLM 和 Codex 插件均不能调用该服务，也不会获得自动出题系统的控制权。详见 [45-QUESTION-SUPPLY-FULFILLMENT-SHADOW.md](./45-QUESTION-SUPPLY-FULFILLMENT-SHADOW.md)。

PR10C 的恢复确认同样不是模型工具。`domain_preflight_passed` 和 `task_started` 只能由今日方案与教学干预的既有后端领域路径写入，用于证明题源恢复后的可执行性；模型输出、浏览器参数和插件调用都不能生成该证据。评估定义见 [46-QUESTION-SUPPLY-SHADOW-EVALUATION.md](./46-QUESTION-SUPPLY-SHADOW-EVALUATION.md)。

## 10. Feature Flag 矩阵

| Flag | 控制范围 | 默认 |
| --- | --- | --- |
| `AGENT_WEB_ENABLED` | 网页 Agent 入口和 API | 关闭 |
| `AGENT_READ_TOOLS_ENABLED` | L0 读取工具 | 关闭 |
| `AGENT_WRITE_TOOLS_ENABLED` | L1–L3 写工具总开关 | 关闭 |
| `AGENT_AI_TOOLS_ENABLED` | AI 教学能力总开关 | 关闭 |
| `AGENT_MCP_ENABLED` | 外部插件/MCP | 关闭 |
| `LEARNING_INTERVENTION_ENABLED` | 教学干预总开关 | 关闭 |
| `LEARNING_INTERVENTION_MICRO_LESSON_ENABLED` | 组间 Micro Lesson | 关闭 |
| `LEARNING_INTERVENTION_AI_EXPLANATION_ENABLED` | AI 个性化干预 | 关闭 |
| `LEARNING_INTERVENTION_HANDWRITING_ENABLED` | 手写纠错干预 | 关闭 |
| `LEARNING_INTERVENTION_SPACED_REVIEW_ENABLED` | 延迟复习干预 | 关闭 |
| `AGENT_GENERATED_PRACTICE_ENABLED` | 私有自动出题总开关 | 关闭 |
| `AGENT_GENERATION_PARTIAL_RESULT_ENABLED` | 部分成功题目交付 | 关闭 |
| `CSCA_AGENT_FOUNDATION_ENABLED` | LS-V1 后端基础能力总开关 | 关闭 |
| `CSCA_AGENT_TEACHING_ASSET_ENABLED` | 版本化教学资产解析、交互与曝光；同时受 Web 与练习写入开关约束 | 关闭 |
| `CSCA_LEARNING_EVIDENCE_WRITE_ENABLED` | 在答案事务写 Evidence + Outbox | 关闭 |
| `CSCA_LEARNING_SHADOW_PROJECTION_ENABLED` | V2 Shadow State 投影 | 关闭 |
| `CSCA_TARGET_GAP_ENABLED` | 生成目标差距快照 | 关闭 |
| `CSCA_LEARNING_PRESCRIPTION_ENABLED` | 生成学习方案快照 | 关闭 |
| `CSCA_SCORE_READINESS_ENABLED` | 学生可见备考度预测 | 关闭 |

自动出题另外按数学、物理、化学设置独立开关。任何细粒度开关都受总开关、用户/组织 rollout 和 kill switch 共同约束。上表已冻结 LS-V1 PR 1 的学习智能 V2 与 Score Readiness flag；附件 AI 的正式 flag 名仍需在对应 PR 冻结，不能由实现临时命名。

## 11. 渠道差异

网页和插件共享 Capability 服务，不共享编排状态：

- Web Runtime 可以管理完整会话、附件和 SSE；
- Plugin 使用宿主 Agent 编排，通过 OAuth + MCP 调用同一能力；
- `PLUGIN-P1` 首期不上传二进制附件；
- 插件不能获得网页端之外的更高权限；
- Web L2/L3 使用站内确认卡，Plugin 使用服务端一次性确认协议；
- 两个渠道返回相同业务结果、版本、费用和错误码。

## 12. 能力生命周期

每项能力依次经过：

```text
proposed -> contracted -> implemented -> shadow
         -> allowlist -> gradual_rollout -> generally_available
         -> deprecated -> retired
```

进入下一状态必须记录：

- owner 和批准人；
- contract/tool/policy 版本；
- Feature Flag 和回滚方式；
- 契约、授权、幂等、计费与 E2E 测试；
- 质量、成本和安全门槛；
- Web/Plugin 分渠道状态；
- 已知限制和支持手册。

破坏性语义变化创建新工具主版本，不在原工具上原地修改。退役前必须确认没有活跃客户端、Run、Artifact 或未完成后台任务依赖旧版本。

## 13. 首条施工切片的最小 allowlist

`LS-V1` 只开放：

```text
get_learning_profile
get_score_goal
get_study_availability
get_subject_mastery
get_review_queue
list_mock_exam_attempts
get_target_gap
get_learning_prescription
get_question_supply_status
update_score_goal
update_study_availability
create_adaptive_practice
start_review_practice
```

其中只有 `update_score_goal`、`update_study_availability`、`create_adaptive_practice` 和 `start_review_practice` 可以写入；Agent Runtime 不能因为模型返回了其他工具名就执行。

## 14. 维护要求

- 每次 Tool Registry 变更必须同步本目录；
- CI 比较 Registry 与目录中的正式工具名；
- 每个季度或重大发布前复核权限、计费、渠道和状态；
- 发现名称漂移时以工具契约为准并阻止发布；
- Internal 能力误进入 Agent allowlist 视为安全发布阻断；
- 本文不记录供应商密钥、内部 Prompt 或管理员操作细节。

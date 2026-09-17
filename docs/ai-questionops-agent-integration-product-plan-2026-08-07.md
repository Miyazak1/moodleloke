# AI QuestionOps Agent Integration Product Plan - 2026-08-07

> 2026-08-11 扩展：聊天式自适应练习、Codex / 类 Codex 接入及 3D 题目运行时的完整方案，见 `docs/ai-questionops-conversational-adaptive-practice-3d-product-architecture-2026-08-11.md`。该扩展明确：正式发布依赖自动质量门，不设置人工逐题审核环节。

## 目标

本文档沉淀一个长期产品方向：将 CSCAlite 当前的 AI 出题机制，逐步抽象为一个可独立使用、可被 Codex / ChatGPT / 其他 AI agent 接入的出题生产系统。

这个方向不应被定义为“AI 生成题目接口”，而应定义为：

> AI QuestionOps：面向教育题库生产的 AI 出题、审核、去重、多样性治理、发布和审计基础设施。

它的核心价值不是让模型多写几道题，而是让 AI agent 能在受控边界内参与题库生产，同时保留自动质量门、离线质量抽样证据、题池库存治理和可追溯审计。

## 背景判断

当前 CSCAlite 已经验证出几个重要事实：

- 单纯 prompt 不能稳定解决准确性、难度、多样性和重复题壳问题。
- provider/key 只能解决吞吐，不能解决质量治理。
- 学生端必须和后台生成波动隔离，题池耗尽时进入补题中状态，而不是同步触发生成。
- 化学流水线已经基本跑通，但准确性仍需抽检，多样性仍需结构化治理。
- 数学和物理不能继承化学结论，需要各自的 task family、difficulty rubric 和 audit 校准。
- 新的多样性治理方向应基于 `TaskFamily + QuestionFingerprint + DiversityWindow + SchedulerHint`，而不是继续横向堆 prompt 禁令和 reviewer 正则。

这些经验可以抽象成一个独立产品能力。

## 产品定位

### 不建议的定位

- AI 题目生成器
- Prompt 模板市场
- 简单题库扩写工具
- 给 LMS 的一个自动出题插件

这些定位会把复杂度低估成“调用大模型生成内容”。

### 推荐定位

- AI QuestionOps 平台
- Agent-ready question production infrastructure
- AI-assisted assessment item governance system

推荐一句话：

> 这是一个让 AI agent 安全参与题库生产的基础设施：它能按考纲和难度补题，识别重复题壳，审计答案和解释，控制发布门禁，并把所有质量判断留痕。

## 核心用户

第一批用户不应直接是学生，而应是题库生产和教学运营角色：

- 教研老师：配置考纲、审题、抽检、下架问题题。
- 题库运营：看库存缺口、发起补题、查看质量报告。
- 学校 / 培训机构管理员：接入自己的 syllabus、LMS 和题库。
- AI agent / Codex：自动读取状态、生成补题计划、运行审计、提出修复建议。
- 平台工程团队：通过 API/MCP 将题库生产能力嵌入其他产品。

学生侧仍只消费正式 published 题池。

## 接入形态判断

未来不应只选择 plugin、skill 或 API 中的一个，而应分层设计。

| 层级 | 作用 | 是否必要 | 说明 |
|---|---|---|---|
| Core API | 独立产品的真正边界 | 必须 | 任何 LMS、后台、agent 都通过 API 接入 |
| MCP Server / App | 让 Codex、ChatGPT、agent 调用工具 | 必须 | 暴露查询、审计、创建 run、提交 review 等工具 |
| Plugin | 面向 Codex/ChatGPT 的分发包装 | 推荐 | 打包 skill + app/MCP，让用户容易启用 |
| Skill | 教 agent 如何使用系统 | 推荐 | 沉淀验收标准、停止线、抽检流程、风险判断 |
| UI Extension / App UI | 面向非技术用户的可视化入口 | 后续 | 适合教研、运营、学校管理员 |

结论：

> 核心应是 API-first；agent 接入用 MCP；Codex/ChatGPT 分发用 Plugin；操作方法沉淀成 Skill。

## 推荐架构

```text
AI QuestionOps Core
  ├─ Syllabus And Topic Policy
  ├─ Subject Policy Registry
  │   ├─ Chemistry Policy
  │   ├─ Math Policy
  │   └─ Physics Policy
  ├─ Production Run Engine
  ├─ Question Generator
  ├─ Reviewer And Validator
  ├─ Diversity Engine
  │   ├─ TaskFamily Classifier
  │   ├─ QuestionFingerprint
  │   ├─ DiversityWindow
  │   ├─ NearDuplicate Signal
  │   └─ SchedulerHint
  ├─ QualityAuditLedger
  ├─ Published Pool
  ├─ Audit And Readiness Reports
  └─ Export / Sync / Integration API

Integration Layer
  ├─ REST / GraphQL API
  ├─ MCP Server
  ├─ Codex Plugin
  │   ├─ Skill: workflow guidance
  │   └─ App/MCP tools: real actions
  ├─ ChatGPT App UI
  └─ LMS / School Platform Connector
```

## Codex / Agent 接入设计

### Skill 应负责什么

Skill 不应承载业务状态或直接改库。它负责教 agent 正确工作：

- 如何判断 provider 问题、机制问题、质量问题。
- 如何验收一个 production run。
- 如何做离线质量抽样。
- 如何判断错题入库、难度错位、同壳重复。
- 如何使用 rollout gate 和 audit report。
- 哪些问题可以记录后停止，哪些问题必须修。
- 如何避免因为局部坏题无限补 prompt。
- 如何解释给教研和老板。

Skill 是“方法论和操作规程”。

### MCP tools 应负责什么

MCP / App tools 才是真正连接系统的工具层。建议第一版工具：

只读工具：

- `get_subject_status(subject)`
- `list_production_runs(subject, filters)`
- `inspect_production_run(runId)`
- `audit_subject_quality(subject, options)`
- `sample_published_questions(subject, topicId, difficulty, count)`
- `evaluate_diversity_window(subject, topicId, difficulty)`
- `simulate_pool_impact(policyVersion, flags)`
- `get_question_trace(questionId)`
- `get_readiness_report(subject)`

低风险写工具：

- `create_draft_production_plan(subject, target)`
- `submit_quality_audit_evidence(questionId, decision, evidence)`
- `mark_question_for_recheck(questionId, reason)`
- `create_observation_run(subject, budget, flags)`

高风险写工具，必须要求操作者显式确认：

- `start_production_run`
- `publish_questions`
- `archive_question`
- `enable_policy_flag`
- `bulk_reclassify_questions`
- `sync_to_external_lms`

### Plugin 应负责什么

Plugin 是给 Codex/ChatGPT 用户发现和启用的包装。一个 `AI QuestionOps` plugin 可以包含：

- 一个或多个 skills：
  - `questionops-production-audit`
  - `questionops-quality-audit`
  - `questionops-diversity-calibration`
  - `questionops-lms-export`
- 一个 required app / MCP connector：
  - 连接 QuestionOps backend。
- 可选 app：
  - Google Drive / Notion / LMS / GitHub，用于读取 syllabus、导出报告或生成工单。

Plugin 适合做“工作流产品化”，不是底层业务逻辑本身。

## API 边界建议

独立产品必须先定义稳定 API，而不是让 Codex 直接操作数据库。

推荐资源模型：

- `Subject`
- `Syllabus`
- `Topic`
- `DifficultyRubric`
- `TaskFamily`
- `QuestionFingerprint`
- `ProductionRun`
- `GenerationJob`
- `CandidateQuestion`
- `ReviewDecision`
- `PublishedQuestion`
- `DiversityWindow`
- `AuditReport`
- `PolicyVersion`
- `QualityAuditLedger`

推荐 API 风格：

- 查询类 API 默认 read-only。
- 写动作必须 idempotent。
- 高风险动作必须支持 dry-run。
- 所有异步生产任务返回 `runId` / `jobId`，不在请求中长时间阻塞。
- 所有质量判断必须带 `policyVersion`。
- 所有 agent 写动作必须记录 actor、source、tool、reason、trace id。

## 权限和安全边界

第一版 agent 接入必须保守。

默认允许：

- 查询 run 状态。
- 生成 audit。
- 抽样题目。
- 计算 diversity。
- 做 pool impact dry-run。
- 创建 draft plan。

默认不允许：

- 直接发布题。
- 批量下架题。
- 打开强阻断 feature flag。
- 改 syllabus/source profile。
- 删除题目。
- 绕过自动 reviewer/validator/gate。

建议权限等级：

| 等级 | 能力 | 适用对象 |
|---|---|---|
| Viewer | read-only audit/status/sample | 老师、运营、agent 默认权限 |
| Quality Auditor | 提交离线抽样证据、标记问题题 | 教研老师、研发运营 |
| Operator | 创建 production run、观察 run | 题库运营 |
| Admin | 开关 policy flag、发布策略、外部同步 | 平台管理员 |

所有 destructive 或 publish 级操作都应有 confirmation。

## 与当前 CSCAlite 的关系

短期不建议立刻拆成独立服务。更稳路线是：

1. 先在 CSCAlite 内部把边界稳定下来。
2. 把隐含逻辑抽成模块化 service。
3. 再暴露内部 API。
4. 再封装 MCP server。
5. 最后做 plugin/app 分发。

现阶段 CSCAlite 是第一个 reference implementation。

## 阶段路线

### Phase 0：内部边界收口

目标：让 CSCAlite 内部代码更像未来产品核心。

工作：

- 固化 `TaskFamily`、`QuestionFingerprint`、`DiversityWindow`、`SchedulerHint`。
- 所有 audit/report 都带 `policyVersion`。
- provider/key failure 不进入 quality memory。
- current-policy/student-consumable scope 明确区分。
- feature flag 默认关闭，所有强阻断先有 dry-run。

交付：

- 内部模块边界文档。
- 三科 readiness report。
- rollout gate。

### Phase 1：内部 Codex Skill

目标：先让 Codex 在当前 repo 里稳定协作。

工作：

- 写一个内部 skill，沉淀：
  - 主任务停止线。
  - 化学/数学/物理验收流程。
  - 抽检标准。
  - audit 命令。
  - provider/key 与质量问题区分。
  - 多样性治理原则。

交付：

- `questionops` 内部 skill。
- 可复用操作手册。

### Phase 2：只读 MCP Server

目标：让 agent 能查状态、跑审计、取样，而不是靠人工复制 SQL。

工作：

- 暴露只读 tools：
  - run status
  - subject audit
  - diversity window
  - sample questions
  - pool impact dry-run
  - readiness report
- OAuth/API key 认证。
- 工具级权限和审计日志。

交付：

- Internal MCP server。
- Codex 可调用的只读工具集。

### Phase 3：低风险写动作

目标：让 agent 能帮助运营推进，但不能绕过质量门。

工作：

- 创建 draft production plan。
- 创建小预算 observation run。
- 提交 offline quality-audit evidence。
- 标记问题题进入 recheck queue。

交付：

- 写动作 confirmation。
- action ledger。
- idempotency keys。

### Phase 4：Plugin 打包

目标：让非工程用户更容易启用。

工作：

- 打包 skill + MCP app。
- 定义 plugin listing。
- 明确 required app、optional app。
- 支持 workspace-level permission。

交付：

- `AI QuestionOps` plugin。
- 内部 workspace 试用。

### Phase 5：ChatGPT App UI / 教研控制台

目标：让老师和运营不需要理解 API/MCP。

工作：

- 科目质量雷达。
- 题型 family 分布。
- 题池库存缺口。
- 重复题壳警告。
- 自动质量门审计、抽样校准与事故回放面板。
- 发布前 dry-run 面板。

交付：

- 可视化 app UI。
- 非技术用户验收流程。

### Phase 6：外部产品化

目标：服务外部学校、题库平台、LMS。

工作：

- 多租户。
- 组织权限。
- 计费与额度。
- 数据隔离。
- 导入 syllabus。
- 导出题库。
- LMS integration。
- SLA 和审计合规。

交付：

- 独立 QuestionOps 产品。

## 向量库判断

MVP 不需要向量库。

当前主问题不是语义检索，而是缺少结构化题型治理。第一阶段应优先使用：

- `TaskFamily`
- `QuestionFingerprint`
- deterministic skeleton normalization
- token / expression similarity
- sliding window
- policyVersion audit

向量库只适合作为后续 fallback：

- 跨表述近重复识别。
- 大规模题库相似题搜索。
- 离线 audit。
- 跨 topic 语义重复分析。

不要让 embedding 成为第一版发布阻断依据。它成本高、阈值难解释、误杀风险高，也不擅长识别“表面不同但解法壳相同”的题。

## 商业价值

这个产品真正可卖的能力：

- 不是“自动生成题”，而是“可控地生产可发布题”。
- 不是“题越多越好”，而是“题目准确、难度稳定、题壳多样、可追溯”。
- 不依赖老师逐题审批，而是让教研角色聚焦策略、抽样校准和异常调查。
- 不是只服务 CSCAlite，而是可嵌入 LMS、题库平台、学校内部系统和 AI agent workflow。

可包装成三个版本：

| 版本 | 用户 | 能力 |
|---|---|---|
| Internal Ops | 自己平台 | 补题、审计、质量治理 |
| Agent API | AI agent / 工程团队 | API + MCP + Skill |
| Institution Product | 学校/机构 | 控制台 + 题库生产 + LMS 同步 |

## 风险

### 产品风险

- 用户以为这是“无限自动出题”，实际需要自动质量治理和持续校准。
- 使用方不信任 AI 题，需要强解释、抽样证据和可回放审计。
- 不同地区/考试体系 syllabus 差异大。

### 工程风险

- 题型分类器横向膨胀。
- prompt/reviewer 正则继续变胖。
- 多科策略串线。
- policy flag 误开导致题池清空。
- provider failure 被误当成 family 质量问题。

### 质量风险

- 错题入库。
- 答案不唯一。
- hard 难度被简单题冒充。
- 同壳重复但 audit 看不见。
- 缺图题进入 text-only 学生练习。

### 集成风险

- agent 权限过大。
- MCP write action 缺少 confirmation。
- 外部 LMS 数据模型差异。
- 多租户数据隔离不足。

## 关键原则

1. API-first，不让 agent 直接碰数据库。
2. MCP 是工具层，Skill 是工作方法层，Plugin 是分发层。
3. 学生端只消费 formally published 题。
4. provider/key failure 不进入质量记忆。
5. 默认 read-only，写动作逐步开放。
6. 强阻断必须 feature flag + dry-run + pool impact。
7. 三科策略隔离，不能因为数学优化影响化学。
8. 所有质量判断带 policyVersion。
9. 向量库不是 MVP 主干，只是后续 fallback。
10. 自动 reviewer/validator/gate 不能被 agent 绕过；人工抽检只作为离线质量审计证据，不是发布链路的必需环节。

## 近期建议

当前不急着独立成产品。建议先做三件事：

1. 把现有 diversity engine 设计继续在 CSCAlite 内部跑稳。
2. 写一个内部 `questionops` skill，先让 Codex 以后接手此类任务更稳定。
3. 设计只读 MCP tool schema，但暂时不实现写动作。

当化学、数学、物理都达到“可审计、可抽检、可灰度补题”的状态后，再进入独立产品化。

## 参考

- OpenAI Help Center: Plugins in ChatGPT and Codex
  - https://help.openai.com/en/articles/20001256-plugins-in-codexOpenAI
- OpenAI Help Center: Build with the Apps SDK
  - https://help.openai.com/en/articles/12515353-build-with-the-apps-sdk
- OpenAI Help Center: Developer mode and MCP apps in ChatGPT
  - https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt

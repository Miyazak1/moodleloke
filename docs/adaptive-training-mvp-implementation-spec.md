# CSCA 科目练习智能化 MVP 实施规格

## 1. 文档目的

这份文档把 `docs/adaptive-ai-questioning-plan.md` 中的完整方案收敛成第一版可执行规格。它的目标不是覆盖最终形态，而是明确：

- 第一版必须交付什么；
- 哪些能力先不做，避免范围失控；
- 需要改造现有项目中的哪些模块；
- 后端、前端、数据模型、API 和验收标准如何对齐；
- AI 在 MVP 中如何参与，同时不让训练体验依赖实时出题。

## 2. 产品结论

MVP 采用一个核心产品语义，但需要区分“用户看到的产品路径”和“底层能力”：

- 普通用户从现有“科目学习 -> 数学/物理/化学”进入练习，不新增顶层“科目练习”或“自适应训练”产品。
- 自适应是底层 `Adaptive Engine` 能力，负责诊断、掌握度、推荐、组题、AI Coach 和观测。
- 用户侧前端入口并入现有 `csca-subjects` 科目页；`csca-special-practice` 仅作为题库、旧组件复用和后端 API namespace 的内部实现细节。
- 用户只选择学科：数学、物理、化学。
- 主题、知识点、难度、薄弱项、题库缺口属于系统内部调度和后台管理概念，不再作为普通用户的主要入口。
- 旧的 `/csca-special-practice` 用户路由不再兼容，不在普通路由表中保留；如果需要历史报告迁移，应通过后台或数据层处理，而不是给普通用户保留第二套入口。
- 模拟题/模考仍然是独立用户场景，但后续也应接入同一套 `Adaptive Engine`：用掌握度影响组卷、复盘、弱项卷和下一步建议。

这个方向可以避免“科目学习、模拟题、自适应训练”三个入口互相竞争：用户仍然理解为按科目学习和做模拟题，智能化能力藏在底层。

## 3. MVP 范围

### 3.1 必须做

第一版需要完成以下能力：

1. 改造现有 `csca-subjects/:subject` 科目页，让练习入口直接出现在数学、物理、化学页面内。
2. 支持学科级入口，不再把主题列表作为普通用户主路径。
3. 支持首次学科诊断流程，用 20 题混合考点和难度建立初始掌握度。
4. 诊断完成后，支持 5 题一轮的智能科目练习。
5. 支持每轮提交后生成报告：正确率、薄弱点、掌握度变化、下一轮推荐原因。
6. 支持基础掌握度模型，按主题记录用户能力状态。
7. 支持题库优先的选题策略，尽量不依赖实时 AI 出题。
8. 支持基础 AI Coach：提示、错因解释、轮次总结。
9. 支持 AI 使用记录和用户反馈，为后续额度、质量评估和成本控制做准备。
10. 移除旧 `/csca-special-practice` 用户入口；可视化工具可暂时复用旧组件，但对外路径必须归到 `/csca-subjects/:subject/...`。

### 3.2 暂不做

以下内容不进入 MVP，除非后续明确调整优先级：

1. 实时 AI 批量出题。
2. 完整 AI 出题、审核、发布流水线。
3. 学校级额度池。
4. 企业 BYOK。
5. 多档付费额度商城和机构额度池。
6. 复杂 IRT 或贝叶斯能力模型。
7. 概念卡插入、概念卡后台维护和概念卡 AI 生成审核。
7. 完整后台题库质量仪表盘。
8. 大规模历史数据精细迁移。
9. 用户手动选择主题的新版主体验。

MVP 可以保留技术扩展点，但不能把这些能力作为第一版上线前置条件。

### 3.3 当前分支实现状态

截至 2026-06-06，`codex/adaptive-ai-questioning` 分支完成的是“可灰度试用的科目练习智能化 MVP”，不是完整 AI 自适应学习平台。

| 范围 | 状态 | 说明 |
| --- | --- | --- |
| 科目内智能练习入口 | 已完成 | 普通用户主路径已并入 `csca-subjects` 科目页；旧 `/csca-special-practice` 用户路由不再兼容，adaptive 作为底层能力，不作为独立用户产品。 |
| 20 题冷启动诊断 | 已完成 | 未完成本科目诊断时，后端强制创建 `diagnostic` session。 |
| 5 题一轮训练 | 已完成 | 诊断后进入 `practice` session，报告页可直接开始下一轮。 |
| Topic mapping | 已完成 | 当前本地验证为 48 个考试 topic、960 道 published 专项题全覆盖。 |
| Planner / QuestionProvider / Mastery | MVP 规则版已完成 | 采用可解释规则，已加 `csca-adaptive:rules` 防回归测试。 |
| AI Coach | MVP 降级版已完成 | 已有提示、错因分析、本轮总结、反馈和 interaction 记录；默认 provider 仍是 `rule-fallback`。 |
| AI usage meter | 成本估算最小闭环已接入 | 记录估算 token、provider、model、costEstimate、定价配置状态和单位估算；外部 provider 成功时标记 billable，失败或 fallback 不扣费。 |
| 外部 LLM provider | 最小 adapter、灰度状态验收和代码侧 prompt 模板已接入 | 支持平台统一 OpenAI/OpenAI-compatible provider 的环境变量配置、prompt version、超时、失败降级、基础输出 guard 和 `CSCA_AI_ROLLOUT_PERCENT` 按用户稳定放量；后台审计页已展示只读 provider readiness、脱敏 base URL host、API key 是否配置、成本单价配置、rollout 比例和未就绪原因；代码侧已登记 `coach-v1-basic` / `coach-v2-safety` 模板，未知 prompt version 不会进入外部 provider；新增 `ai-provider:smoke`，默认验证 fallback 与 provider readiness，真实外部调用必须显式设置 `AI_PROVIDER_SMOKE_ALLOW_EXTERNAL=1`；尚未做后台编辑密钥、prompt 模板后台发布和完整安全审核。 |
| AI 额度 / ledger / 购买额度 | 个人额度闭环和用户侧入口已接入 | 新增用户个人 AI Coach 额度账户、reserve/consume/refund ledger、成本 metadata、管理员发放额度、固定 AI 额度包购买履约、查询接口和 `ai-credits:smoke` 端到端验收；前端已在自适应总览、学科面板、答题页和报告页展示余额、低余额/耗尽降级提示和购买入口；多档套餐、机构额度池、BYOK 和后台看板未完成。 |
| AI 出题 / 审题 / 发布流水线 | 未完成 | 明确不进入当前 MVP，后续必须走候选题、审核、发布链路。 |
| 训练事件埋点 | 最小闭环已接入 | 新增 `CscaTrainingEvent`，记录诊断/训练 session、round、AI Coach 点击和反馈事件，并提供 admin observability API。 |
| 后台指标看板 | 灰度观测与复核队列已增强 | 现有后台审计页已展示 AI Coach 与训练事件 observability 摘要，并支持时间范围、学科、provider、状态、类型、复核原因筛选、刷新/重置、AI 调用趋势、训练事件趋势、provider/type/status/subject 分布、最近失败/最近事件和 AI 复核队列；复核队列由低评分、provider 拒绝、provider 错误、额度耗尽等信号派生，管理员可写入处理结论并进入 admin audit；独立 BI 看板未完成。 |

后续沟通中应避免把“当前 MVP 已完成”说成“文档完整方案已完成”。当前进度语义为：科目练习智能化 MVP 主闭环接近灰度可用；完整 AI 平台，尤其是模拟题智能化，仍处于后续阶段。

## 4. 与现有项目结构的关系

### 4.1 后端

优先复用和改造现有模块：

- `backend/src/csca-special-practice`
  - 继续作为题库和 adaptive API 的内部后端命名空间。
  - 承载科目练习智能化能力，内部新增 adaptive service、planner、mastery engine、question provider。
- `backend/src/csca-mock-exam`
  - 继续承担固定模考。
  - 后续接入同一套 `Adaptive Engine`，把模考报告作为掌握度证据，并支持智能模拟卷、弱项卷和复测卷；MVP 可先做弱关联。
- `backend/prisma/schema.prisma`
  - 新增自适应训练、掌握度、题目曝光、AI 交互记录等模型。
- `backend/src/admin-audit`
  - 训练策略、AI 额度、后台题库操作后续应接入审计。
- `backend/src/common/validation`
  - 新 API DTO 继续使用现有校验风格。

不建议第一版新增完全平行的 `csca-adaptive-practice` 后端模块，因为这会让专项和自适应长期并存，增加职责分裂。

### 4.2 前端

优先改造现有页面和 API 封装：

- `frontend/src/pages/CscaSubjectPage.tsx`
  - 作为普通用户的科目学习和科目练习主入口。
  - 在数学、物理、化学页面内展示诊断/继续练习按钮、掌握度、题量和登录状态。
- `frontend/src/pages/CscaSpecialPracticePage.tsx`
  - 不再作为普通用户主入口。
  - 可暂时保留为可视化工具、旧题库组件或后台预览复用层，但不暴露 `/csca-special-practice` 用户路由。
  - 内部按状态切换 overview、diagnostic、subject dashboard、round、report。
- `frontend/src/lib/api-special-practice.ts`
  - 扩展自适应训练 API。
- `frontend/src/lib/api-types.ts`
  - 增加自适应训练 DTO 类型。
- `frontend/src/lib/routes.ts`
  - 用户侧主入口保持 `/csca-subjects` 与 `/csca-subjects/:subject`。
  - `routes.cscaSpecialPractice` 如仍存在，仅用于内部组件复用或 API 封装过渡，不应进入普通 route known list。
- `frontend/src/lib/app-nav-items.ts`
  - 导航不新增“科目练习/自适应训练”顶层项；继续从“科目学习”进入各学科。
- `frontend/src/components/AppRouteRenderer.tsx`
  - 增加或调整自适应训练相关路由渲染。
- `frontend/src/styles/subject-learning.css`
  - 承载科目页内的智能练习面板样式。
- `frontend/src/styles/special-practice.css`
  - 继续服务答题轮、报告、可视化或 legacy 组件样式，不作为科目页主样式。

不建议第一版新增 `CscaAdaptivePracticePage.tsx` 和独立 CSS，否则产品上虽然说只有一个入口，代码上却会形成两个训练产品。

## 5. 路由设计

MVP 用户侧路由如下：

| 路由 | 用途 |
| --- | --- |
| `/csca-subjects` | 科目学习索引，进入数学、物理、化学 |
| `/csca-subjects/:subject` | 某学科主页，包含学习内容、公式/工具入口和智能练习面板 |
| `/csca-subjects/:subject#practice` | 本科目智能练习面板锚点 |
| `/csca-subjects/:subject/practice/rounds/:id` | 当前诊断或训练轮 |
| `/csca-subjects/:subject/practice/rounds/:id/report` | 本轮报告 |
| `/csca-subjects/:subject/visualize/...` | 本科目交互工具 |
| `/csca-subjects/:subject/formulas` / `/vocabulary` | 本科目公式和术语 |

旧 `/csca-special-practice` 不再作为已知普通用户路由；普通用户导航只暴露科目学习、科目页、训练轮和报告。

## 6. 数据模型 MVP

### 6.1 主题与映射

`CscaExamTopic`

- `id`
- `subject`
- `code`
- `title`
- `description`
- `examScope`
- `parentId`
- `weight`
- `status`

`CscaTopicMapping`

- `id`
- `sourceType`
- `sourceId`
- `topicId`
- `confidence`
- `createdAt`
- `updatedAt`

用途：

- 把现有专项题、后续导入题、模考题和 CSCA 考试范围统一映射到内部主题。
- 允许一个题目映射到多个主题。

### 6.2 掌握度

`UserCscaTopicMastery`

- `id`
- `userId`
- `subject`
- `topicId`
- `mastery`
- `confidence`
- `attemptCount`
- `correctCount`
- `lastPracticedAt`
- `lastUpdatedAt`

MVP 中 `mastery` 使用 0 到 1 的浮点值，`confidence` 表示证据可靠度。第一版不需要复杂模型，但字段要为后续算法升级留空间。

### 6.3 训练会话

`CscaAdaptiveSession`

- `id`
- `userId`
- `subject`
- `mode`
- `status`
- `startedAt`
- `completedAt`

`CscaAdaptiveRound`

- `id`
- `sessionId`
- `roundIndex`
- `status`
- `plannerSnapshot`
- `startedAt`
- `submittedAt`

`CscaAdaptiveRoundItem`

- `id`
- `roundId`
- `questionId`
- `topicId`
- `plannedDifficulty`
- `position`
- `userAnswer`
- `isCorrect`
- `usedHint`
- `usedExplanation`
- `timeSpentSeconds`
- `submittedAt`

`plannerSnapshot` 保存当轮推荐原因和策略快照，方便解释、排查和复盘。

### 6.4 题目曝光

`CscaQuestionExposure`

- `id`
- `userId`
- `questionId`
- `source`
- `lastSeenAt`
- `seenCount`
- `lastResult`

用途：

- 避免同一轮重复出题。
- 降低短期重复。
- 为后续“错题变式”和复习间隔提供依据。

### 6.5 AI 交互

`CscaAIInteraction`

- `id`
- `userId`
- `subject`
- `topicId`
- `questionId`
- `sessionId`
- `roundId`
- `type`
- `provider`
- `model`
- `promptVersion`
- `inputHash`
- `output`
- `tokenUsage`
- `costEstimate`
- `status`
- `createdAt`

`CscaAIInteractionFeedback`

- `id`
- `interactionId`
- `userId`
- `rating`
- `reason`
- `createdAt`

MVP 需要记录 AI 使用和用户反馈，即使第一版先不做完整付费，也要为成本、质量和后续商业化留证据链。

### 6.6 概念卡（二期扩展点）

`CscaConceptCard`

- `id`
- `subject`
- `topicId`
- `title`
- `body`
- `examples`
- `status`
- `createdAt`
- `updatedAt`

概念卡用于训练中断点和错题后的轻量补救，但不作为当前 MVP 上线前置条件。当前 MVP 先通过题目解析、AI 错因分析、轮次总结和错因模式复习完成闭环；概念卡后续应作为二期能力，配套后台维护、审核和插入策略后再上线。

## 7. 后端服务拆分

### 7.1 `CscaSpecialPracticeAdaptiveService`

训练主协调服务，负责：

- 创建诊断；
- 创建训练 session；
- 开始新 round；
- 提交 round；
- 返回报告；
- 调用 planner、mastery engine、question provider、AI coach。

### 7.2 `AdaptivePlanner`

负责决定下一轮练什么。MVP 策略：

1. 如果用户没有完成本科目诊断，先进入 20 题 diagnostic round。
2. 诊断只按学科进入，不允许用户按专题手动选择；题目混合不同 topic、题型和难度。
3. 诊断完成并提交后，本科目后续进入 5 题 practice round。
4. practice round 优先选择当前学科中掌握度最低的 2 个主题。
5. 加入 1 个最近答错主题。
6. 加入 1 个较久未复习主题。
7. 如果整体掌握度高于阈值，加入 1 个挑战题；否则加入 1 个基础题。
8. 避免同一轮重复题，尽量避免近期重复题。

planner 输出必须包含推荐原因，用于前端展示和后续排查。

### 7.3 `MasteryEngine`

负责更新掌握度。MVP 可以使用规则模型：

- 初始 `mastery = 0.5`，`confidence = 0.2`。
- 独立答对提升较高。
- 使用提示后答对提升较低。
- 看了解析后重做答对只给很低提升。
- 答错降低掌握度。
- 难题答对提升比简单题更高。
- 连续错误触发降难度或概念卡。

建议初始公式：

```text
correctDelta = 0.05 * difficultyWeight * assistWeight
wrongDelta = -0.08 * difficultyWeight
newMastery = clamp(oldMastery + delta, 0, 1)
```

其中：

- `assistWeight = 1.0` 表示独立答对；
- `assistWeight = 0.5` 表示使用提示后答对；
- `assistWeight = 0.2` 表示看解析或概念卡后答对；
- `difficultyWeight` 可从 0.8 到 1.3。

第一版重点是可解释、可调参、行为稳定，不追求算法复杂。

### 7.4 `AdaptiveQuestionProvider`

负责从题库取题。MVP 原则：

1. 优先从现有 `SpecialPracticeQuestion` 取题。
2. 根据 `CscaTopicMapping` 找到题目和主题关系。
3. 按学科、主题、难度、发布状态过滤。
4. 排除同轮已出现题。
5. 尽量排除近期已做题。
6. 如果目标主题题量不足，降级到相邻主题或同学科未见题。
7. 不在训练请求中实时调用 AI 生成题。

这样可以保证训练体验稳定，AI 不会成为答题链路的单点风险。

### 7.5 `AICoachService`

MVP 支持三类能力：

- `hint`：给提示，不直接泄露答案。
- `explain_wrong_answer`：解释用户为什么错，结合题干、选项、标准解析。
- `round_summary`：总结本轮表现和下一步建议。

失败策略：

- 如果 LLM 未配置、额度不足或调用失败，系统返回固定解析或规则总结。
- 训练流程不能因为 AI 失败而中断。

### 7.6 `AIEntitlementService`

MVP 只做个人额度最小闭环：

- 判断用户是否可以使用 AI Coach；
- 记录使用量；
- 支持配置免费试用额度或管理员发放额度；
- 支持固定额度包购买履约和用户侧余额展示；
- 额度耗尽时训练不断流，AI Coach 降级到标准解析或本地规则提示。

后续再扩展到多档额度包、学校额度池和 BYOK。

## 8. API MVP

当前后端接口继续挂在 `csca-special-practice` 命名空间下，这是内部 API namespace，不等于用户侧还存在 `/csca-special-practice` 页面入口。后续如果要彻底清理命名债，可以新增 `/api/v1/csca-subjects/adaptive/...` 并做服务端迁移，但不应影响当前 MVP 发布节奏。

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| `GET` | `/api/v1/csca-special-practice/adaptive/overview` | 获取自适应训练总览 |
| `POST` | `/api/v1/csca-special-practice/adaptive/sessions` | 创建 adaptive session；后端按学科诊断状态决定 `diagnostic` 或 `practice` mode |
| `GET` | `/api/v1/csca-special-practice/adaptive/sessions/:id` | 获取 session 状态 |
| `POST` | `/api/v1/csca-special-practice/adaptive/sessions/:id/rounds` | 创建诊断或训练 round；`diagnostic` 为 20 题，`practice` 为 5 题 |
| `PATCH` | `/api/v1/csca-special-practice/adaptive/rounds/:roundId` | 暂存答题状态 |
| `POST` | `/api/v1/csca-special-practice/adaptive/rounds/:roundId/submit` | 提交本轮 |
| `POST` | `/api/v1/csca-special-practice/adaptive/questions/:questionId/hints` | 获取 AI 提示 |
| `POST` | `/api/v1/csca-special-practice/adaptive/questions/:questionId/explain` | 获取 AI 错因解释 |
| `POST` | `/api/v1/csca-special-practice/adaptive/ai-interactions/:id/feedback` | 提交 AI 反馈 |
| `GET` | `/api/v1/csca-special-practice/adaptive/mastery` | 获取掌握度地图 |
| `GET` | `/api/v1/csca-special-practice/adaptive/concept-cards/:topicId` | 二期：获取概念卡，当前 MVP 不提供 |

## 9. 前端 MVP 交互

### 9.1 科目页内练习面板

`/csca-subjects/:subject#practice`

显示：

- 本科目训练状态：未开始、需诊断、训练中、建议复习；
- 最近一次训练结果；
- 今日建议；
- 固定模考入口保持清晰区分；
- 不展示手动 topic 选择作为主路径。

不要在科目页练习面板堆主题列表，否则会退回旧专项练习体验。

### 9.2 学科首次诊断

`/csca-subjects/:subject`

显示：

- 当前学科掌握度概览；
- 未诊断时明确提示“先做 20 题诊断”；
- 系统推荐原因；
- 近期薄弱点；
- 最近训练记录；
- 可选的掌握度地图入口。

用户看到的是“系统已经替我安排好了下一轮”，不是“我还要自己选哪个专题”。

### 9.3 训练轮

`/csca-subjects/:subject/practice/rounds/:id`

核心交互：

- 诊断 round 为 20 题，训练 round 为 5 题；
- 题目进度固定；
- 支持暂存答案；
- 支持提示；
- 支持提交后看解析；
- AI Coach 放在侧边或题目下方，不抢答题主流程；
- 题目区域保持稳定，不因为提示展开导致布局大幅跳动。

### 9.4 轮次报告

`/csca-subjects/:subject/practice/rounds/:id/report`

显示：

- 本轮正确率；
- 每题结果；
- 薄弱主题；
- 掌握度变化；
- AI 或规则生成的简短总结；
- 下一轮按钮；
- 休息或概念卡建议。

报告页的目标是让用户愿意继续下一轮，而不是只看到错题列表。

### 9.5 掌握度地图

MVP 中掌握度先内嵌在 `/csca-subjects/:subject` 和报告页；独立掌握度地图可后续放在科目页子视图，而不是新增顶层训练产品。

MVP 可以做轻量版本：

- 按学科展示主题掌握度；
- 用状态和颜色区分强、稳、弱、未诊断；
- 不允许普通用户从这里进入“手动选题训练”作为主路径；
- 可以从弱项跳回“开始下一轮”，由 planner 决定题目。

## 10. AI 使用策略

MVP 中 AI 的定位是“训练陪练”和“解释增强”，不是“实时出题机器”。

### 10.1 同步 AI

训练中可同步调用：

- 提示；
- 错因解释；
- 本轮总结。

要求：

- 必须有超时和失败降级；
- 必须记录使用量；
- 必须支持用户反馈；
- 不应把答案直接暴露在第一层提示里；
- 输出需要基于已有题干、选项、标准答案和标准解析。

### 10.2 异步 AI

MVP 不要求实现完整异步出题，但数据结构应允许后续加入：

- 题库缺口扫描；
- 低库存主题自动生成候选题；
- AI 初审；
- 人工终审；
- 变式题生成。

异步 AI 的发布链路必须是“候选题 -> 审核 -> 发布”，不能直接进入正式训练题库。

### 10.3 额度策略

MVP 建议采用：

- 平台统一配置 LLM；
- 个人用户首次创建 AI Coach 额度账户时默认获得 50 次免费额度，也可以由管理员发放额度；
- 记录交互成本和 token 使用；
- 成本口径按 DeepSeek 官方 API 价格配置。当前使用 `deepseek-v4-flash` 时，保守按 cache miss input `US$0.14 / 1M tokens`、output `US$0.28 / 1M tokens` 估算，即 `CSCA_AI_INPUT_COST_PER_1K_TOKENS=0.00014`、`CSCA_AI_OUTPUT_COST_PER_1K_TOKENS=0.00028`；cache hit input 更低，后续若要精确核算，需要把 provider 返回的 cache 命中 token 拆出来。
- 当前固定付费额度包技术履约为 100 次，通过 AI 服务购买页、购物车、结算、支付成功回调后写入 AI entitlement ledger；最终用户售价应在专业 AI 服务页中按 DeepSeek 成本、支付手续费和运营毛利重新设计，不直接沿用临时包价。多档额度包、学校额度池、BYOK 放到后续阶段。
- 自适应总览、学科面板、答题页和报告页都要展示剩余额度、低余额/耗尽提示和清晰充值入口；训练页中的充值按钮应进入 `/services/ai-coach`，由专业 AI 服务页解释个人额度包、免费额度、团队/组织额度池和成本口径，再加入 100 次额度包进入结算。购物车仅作为已选服务和价格明细确认页。

这样可以先验证 AI Coach 是否真的提高留存、完成率和用户满意度，再扩大商业化复杂度。

## 11. 状态与边界

### 11.1 无题可出

如果某主题题量不足：

1. 先选择同主题较低或较高难度题；
2. 再选择相邻主题；
3. 再选择同学科未见题；
4. 最后提示“该方向题量不足，系统已安排相近训练”。

不能让用户卡在空页面。

### 11.2 AI 不可用

如果 AI 不可用：

- 训练照常进行；
- 提示按钮置灰或显示固定提示；
- 错因解释降级为标准解析；
- 报告总结使用规则模板。

### 11.3 训练疲劳

MVP 可以用简单规则：

- 连续两轮明显下降，建议休息；
- 同一主题连续错 3 次，当前 MVP 先进入错因复习和降难度；二期再插入概念卡；
- 一轮耗时过长，下一轮降低难度；
- 掌握度达到阈值后，建议切换到模考或其他学科。

### 11.4 历史数据

MVP 不需要精细回填全部历史，但可以做弱初始化：

- 如果旧专项记录有稳定 topic mapping，可作为初始掌握度证据；
- 如果只有模考总分，则只用于学科级初始状态，不直接推导具体主题；
- 没有可靠映射时，走诊断流程。

## 12. 实施阶段

### 阶段 1：数据与后端骨架

- 增加 Prisma 模型；
- 增加自适应 DTO；
- 增加 adaptive service、planner、mastery engine、question provider；
- 增加 overview、session、round、submit API；
- 增加规则级测试，覆盖 planner、question provider、mastery engine 和 AI usage meter。
- 增加 `npm.cmd run ai-credits:smoke`，覆盖注册用户、购买固定 AI 额度包、mock 支付成功、余额入账和重复回调幂等。
- 增加 `npm.cmd run ai-provider:smoke`，覆盖 provider readiness、fallback 不扣费、interaction usage metadata；真实外部 provider 灰度调用需显式设置 `AI_PROVIDER_SMOKE_ALLOW_EXTERNAL=1`，避免误消耗额度。
- 增加 `npm.cmd run csca-adaptive:release-smoke`，串联学生 20 题诊断、5 题训练、AI 低评分反馈、后台复核队列、复核结论写入和 admin audit；完整后台验收需配置管理员账号并设置 `ADAPTIVE_RELEASE_SMOKE_REQUIRE_ADMIN=1`。
- 前端接入用户侧 AI 额度面板，覆盖训练前、训练中和报告页三个消费触点。

完成标志：

- 后端可以创建 session、生成 20 题诊断 round、生成 5 题训练 round、提交并更新 mastery。

### 阶段 2：前端改造

- 改造 `CscaSubjectPage.tsx`，把智能练习面板并入现有数学、物理、化学页面；
- 训练轮和报告使用 `/csca-subjects/:subject/practice/rounds/:id` 路由；
- 从普通导航、页脚和首页移除独立“科目练习/自适应训练/专项练习”入口语义；
- 旧 `/csca-special-practice` 用户路由不再兼容；
- 增加加载、空状态、错误状态。

完成标志：

- 用户可以从 `/csca-subjects/:subject` 完成一次完整本科目智能练习闭环。

### 阶段 3：AI Coach

- 增加 `AICoachService`；
- 增加提示、错因解释、轮次总结接口；
- 增加 AI 使用记录；
- 增加用户反馈；
- 增加 AI 不可用降级。

完成标志：

- AI 开启时可以提供帮助，AI 关闭时训练仍然可用。

### 阶段 4：上线前质量收敛

- 增加题库映射检查；
- 增加无题降级策略；
- 增加训练疲劳策略；
- 增加管理员可观察的基础日志；
- 跑构建、类型检查、规则级测试和关键流程 smoke。

完成标志：

- MVP 可灰度给真实用户试用。

## 13. 验收标准

MVP 至少满足：

1. 新用户进入 `/csca-subjects/:subject` 后，在本科目页面内看到诊断/练习入口，而不是旧专题列表或独立“自适应训练”产品。
2. 用户第一次选择某学科后，必须先进入 20 题诊断。
3. 用户提交某学科诊断后，后续进入该学科直接开始 5 题训练。
4. 同一轮不会出现重复题。
5. 用户提交后可以看到报告和下一轮建议。
6. 掌握度会随答题结果变化。
7. AI Coach 开启时可以给提示、错因解释和总结。
8. AI Coach 关闭或失败时，训练流程不中断。
9. 旧 `/csca-special-practice` 普通用户链接不再作为已知路由；必要历史数据通过后台或数据迁移处理。
10. 固定模考功能不受影响。
11. TypeScript 构建、`csca-adaptive:rules`、`csca-adaptive:smoke`、默认 `ai-provider:smoke` 和迁移后的 `csca-adaptive:release-smoke` 通过。
12. 主要训练事件有日志或数据记录，便于后续分析。
13. 低评分 AI Coach 反馈能进入后台复核队列，管理员能写入处理结论并产生审计记录。

## 14. 后续成熟方向

MVP 跑通后，再按数据决定是否推进：

1. AI 出题和 AI 审题流水线。
2. 学校额度池。
3. 用户购买 AI Coach 额度。
4. BYOK。
5. 更复杂的掌握度模型。
6. 题库缺口仪表盘。
7. 教师或机构视角的班级薄弱点分析。
8. 训练效果 A/B 测试。

判断是否进入下一阶段，不看功能是否“酷”，而看：

- 用户是否愿意持续训练；
- AI Coach 是否提高完成率和满意度；
- 题库是否真的存在明显缺口；
- 运营成本是否可控；
- 学校或机构是否愿意为管理能力付费。

## 15. 第一版最小开发清单

建议第一轮开发只拆成这些任务：

1. 建立科目练习智能化数据模型。
2. 完成 topic mapping 的最小可用版本。
3. 后端生成 20 题诊断轮和 5 题训练轮。
4. 后端提交训练轮并更新 mastery。
5. 前端把智能练习并入现有科目页。
6. 前端完成训练轮和报告。
7. 接入 AI Coach 的提示和错因解释。
8. 增加 AI 不可用降级。
9. 跑通一个学科的完整闭环。
10. 再扩展到三个学科。

这份清单完成后，方案就从“可以讨论”进入“可以灰度试用”。

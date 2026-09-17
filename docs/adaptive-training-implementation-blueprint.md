# CSCA 科目练习智能化实施蓝图

## 1. 当前成熟度判断

在现有方案基础上，科目练习智能化已经完成第一轮 MVP 主闭环实现，但不等于完整 AI 自适应学习平台已经完成。

关键语义修正：自适应不是一个新的用户产品入口，而是底层 `Adaptive Engine`。用户侧应该看到现有“科目学习”和“模拟题/模考”；数学、物理、化学科目页内直接承接诊断、掌握度、推荐和 AI Coach，模拟题后续接入同一套掌握度、错题、曝光和组卷能力。

2026-06-06 最新产品决策：

- 不新增顶层“科目练习”或“自适应训练”入口。
- 不再兼容旧 `/csca-special-practice` 普通用户路由。
- 练习入口并入 `/csca-subjects/:subject`，训练轮和报告路由并入 `/csca-subjects/:subject/practice/rounds/:id`。
- 在线模考不新增“自适应模考”入口，而是在现有 `/csca-mock-exam/:subject` 内加入系统推荐、历史续做和后续组卷能力。
- 后端 `/api/v1/csca-special-practice/adaptive/...` 暂时保留为内部 API namespace，不代表用户侧还存在同名页面。

当前成熟度判断：

- 产品方向：成熟。
- 架构方向：MVP 主闭环已落地，后续 AI provider、额度和后台看板仍需分阶段补齐。
- MVP 边界：当前分支完成的是“可灰度试用的科目练习智能化 MVP”。
- 工程落点：核心训练链路已实现，下一步应完成科目页入口语义收口、发布前完整验收和真实 LLM/额度设计。
- 题库与考纲映射：当前 published 题库已验证全覆盖，但后续考纲版本化和题库质量看板仍未完成。

因此下一步应该继续按阶段执行，避免把“MVP 完成”误解为“完整方案完成”。

### 1.1 当前实现语义

| 语义 | 当前状态 | 不能混淆的点 |
| --- | --- | --- |
| MVP 主闭环 | 基本完成 | 指诊断、训练、报告、mastery、题库优先选题、AI Coach 降级版。 |
| MVP 扩展骨架 | 部分完成 | 指 AI interaction、usage meter、provider adapter 接口等，为后续真实 LLM 和额度服务预留。 |
| 完整 AI 平台 | 未完成 | 指真实 LLM provider、额度购买、机构额度池、AI 出题/审题、后台质量和成本看板。 |
| 灰度可用 | 接近 | 还需要完整 `verify:release`、本地手测和必要的 UI 微调。 |

## 2. 现有代码结构观察

### 2.1 后端现状

当前专项练习后端集中在：

- `backend/src/csca-special-practice/csca-special-practice.controller.ts`
- `backend/src/csca-special-practice/csca-special-practice.service.ts`
- `backend/src/csca-special-practice/csca-special-practice.module.ts`
- `backend/src/csca-special-practice/csca-special-practice.types.ts`

现有能力已经包括：

- 专项总览：`getOverview`
- 学科详情：`getSubject`
- 主题开始页：`getTopicStart`
- 创建练习 session：`createSession`
- 暂存 session：`patchSession`
- 检查答案：`checkAnswer`
- 提交 session：`submitSession`
- 报告：`getReport`
- 我的练习记录：`listMySessions`
- 我的错题：`listMyWrongQuestions`
- 管理员 topic/question/import 能力
- 管理员审计接入

这说明第一版自适应训练不需要重做完整答题系统，可以复用现有 session、题目快照、提交、报告、管理员题库管理等思路。

### 2.2 Prisma 现状

现有专项练习核心模型：

- `SpecialPracticeTopic`
- `SpecialPracticeQuestion`
- `SpecialPracticeSession`

关键字段：

- `SpecialPracticeTopic.subject`
- `SpecialPracticeTopic.module`
- `SpecialPracticeTopic.slug`
- `SpecialPracticeQuestion.difficulty`
- `SpecialPracticeQuestion.knowledgeTags`
- `SpecialPracticeSession.questionSnapshot`
- `SpecialPracticeSession.answers`
- `SpecialPracticeSession.timeSpent`
- `SpecialPracticeSession.correctCount`
- `SpecialPracticeSession.wrongCount`

这些字段可以支撑 MVP 的第一版选题、答题记录和报告，但不能直接支撑长期自适应，因为缺少：

- 稳定的考纲 topic 层；
- 用户 topic mastery；
- adaptive session/round/item；
- 题目曝光记录；
- AI 交互记录；
- AI 反馈记录。

### 2.3 前端现状

当前专项练习前端集中在：

- `frontend/src/pages/CscaSpecialPracticePage.tsx`
- `frontend/src/pages/CscaSubjectPage.tsx`
- `frontend/src/lib/api-special-practice.ts`
- `frontend/src/lib/api-types.ts`
- `frontend/src/styles/special-practice.css`
- `frontend/src/styles/subject-learning.css`
- `frontend/src/components/AppRouteRenderer.tsx`
- `frontend/src/lib/routes.ts`
- `frontend/src/lib/app-nav-items.ts`

`CscaSpecialPracticePage.tsx` 当前已经包含：

- `OverviewView`
- `SubjectView`
- `StartView`
- `SessionView`
- `ReportView`
- 大量数学、物理、化学可视化和专题页面兼容逻辑

因此前端改造不能用“新建一套顶层页面并替换”的方式。当前更准确的做法是：

- `CscaSubjectPage.tsx` 作为普通用户入口，科目页直接出现诊断/继续练习能力；
- adaptive 训练轮和报告视图继续复用 `AdaptivePracticeViews.tsx`；
- `CscaSpecialPracticePage.tsx` 只作为旧组件、可视化工具和后台预览的复用层，不再作为普通用户路由入口；
- 可视化对外路径迁移到 `/csca-subjects/:subject/...`，必要时内部再转译到旧组件。

## 3. 工程原则

1. 不新增用户可感知的第二个训练产品。
2. 不新增 `csca-adaptive-practice` 顶层路由。
3. 不保留旧 `/csca-special-practice` 普通用户路由，避免入口职责重复。
4. 不让训练链路依赖实时 AI。
5. 不把 AI 出题放入 MVP。
6. 不重写现有管理员题库管理，先扩展映射和质量检查。
7. 先做一个学科闭环，再扩展三个学科。
8. 后端先跑通，再改造前端入口。

## 4. 阶段拆分

## Sprint 0：题库盘点与考纲映射

目标：确认现有题库是否足够支撑第一版自适应训练。

### 后端任务

1. 写一个只读盘点脚本或临时 admin 查询，统计：
   - 每个学科 topic 数量；
   - 每个 topic 题目数量；
   - 每个 topic 下不同 difficulty 的题目数量；
   - `knowledgeTags` 覆盖情况；
   - draft/published 数量；
   - 空题、无解析、无选项等质量问题。
2. 输出缺口表：
   - 可直接用于训练；
   - 可以用于训练但映射不稳定；
   - 题量不足；
   - 内容需要修复。

### 文档或配置任务

1. 建立 CSCA 内部 topic 列表。
2. 每个 topic 至少包含：
   - `subject`
   - `code`
   - `title`
   - `description`
   - `examScope`
   - `weight`
   - `parentCode`
3. 先允许 topic 与现有 `SpecialPracticeTopic` 一对一或多对一映射。

### 产物

- 题库盘点结果。
- 初版 topic mapping。
- 是否可进入 Sprint 1 的判断。

### 验收

- 至少一个学科可以覆盖 8 到 12 个核心 topic。
- 每个核心 topic 至少有 5 道可发布题，低于这个数量的 topic 要被标记为低库存。
- 每个题目能找到一个主要内部 topic。

### 初步盘点结果

2026-06-05 已对当前本地数据库执行专项题库验证和只读统计：

- `npm.cmd run special-practice:validate` 已通过。
- 当前共有 52 个专项 topic，其中 48 个为 published。
- 当前共有 1000 道专项题，其中 960 道为 published。
- 已产生 57 条专项练习 session。
- 暂未发现低库存 topic。
- 暂未发现只有单一难度的 published topic。
- 暂未发现缺选项、缺标签、缺题干、缺解析等基础质量问题。

按学科统计：

| 学科 | Published topic | Published question | 模块数 | 每个 published topic 最少题量 | 难度分布 |
| --- | ---: | ---: | ---: | ---: | --- |
| 数学 | 12 | 240 | 4 | 20 | 基础 72 / 中等 96 / 较难 48 / 挑战 24 |
| 物理 | 21 | 420 | 5 | 20 | 基础 126 / 中等 168 / 较难 84 / 挑战 42 |
| 化学 | 15 | 300 | 4 | 20 | 基础 90 / 中等 120 / 较难 60 / 挑战 30 |

初步结论：

- 当前题库已经足够支撑自适应训练 MVP。
- 第一版可以直接把现有 `SpecialPracticeTopic` 作为内部 `CscaExamTopic` 的初始映射来源。
- 每个 published topic 都有 20 题，足够支持 5 题一轮、短期去重和基础难度调度。
- 真正需要补的不是题量，而是把现有 topic 与 CSCA 考纲范围的语义映射固化为数据模型。

已落地的 Sprint 0 工程变更：

- 新增 `CscaExamTopic` 与 `CscaTopicMapping` Prisma 模型。
- 新增 `0030_csca_adaptive_topic_mapping` migration。
- 新增 `csca-adaptive:seed-topic-mapping` 脚本，用现有 published 专项题库生成初始映射。
- 新增 `csca-adaptive:validate-topic-mapping` 脚本，用于检查 published topic/question 的映射覆盖率。
- 已在本地数据库应用 migration，并完成初始 seed 与覆盖率验证。

本地 seed 结果：

- 扫描 published 专项 topic：48。
- 创建 `CscaExamTopic`：48。
- 创建 topic mapping：48。
- 创建 question mapping：960。

本地覆盖率验证结果：

- exam topic：48。
- published special practice topic：48。
- missing topic：0。
- missing question：0。
- 数学：12/12 topic，240/240 question。
- 物理：21/21 topic，420/420 question。
- 化学：15/15 topic，300/300 question。

## Sprint 1：后端自适应闭环

目标：在不大改前端的情况下，后端可以生成自适应训练轮并提交更新 mastery。

当前工程状态：

- 已新增 `UserCscaTopicMastery`、`CscaAdaptiveSession`、`CscaAdaptiveRound`、`CscaAdaptiveRoundItem`、`CscaQuestionExposure` Prisma 模型。
- 已新增 `0031_csca_adaptive_training_state` migration，并应用到本地数据库。
- 已新增 `AdaptivePlannerService`，按弱项、近期错题、久未练习、挑战项生成一轮 topic 计划。
- 已新增 `AdaptiveQuestionProviderService`，基于 `CscaTopicMapping` 从现有 published 专项题库选题，并考虑题目曝光去重。
- 已新增 `MasteryEngineService`，用可解释规则更新 topic mastery。
- 已新增 `CscaAdaptiveService`，支持 session、round、patch、check、submit、report、mastery。
- 已在 `CscaSpecialPracticeController` 挂载 `/api/v1/csca-special-practice/adaptive/...` 系列后端 API。
- 已新增 `npm.cmd run csca-adaptive:rules`，覆盖 diagnostic planner、practice planner、question provider、mastery engine 和 AI usage meter 的规则级防回归测试。
- 已通过 `backend:build`、`prisma:validate`、`special-practice:validate`、`csca-adaptive:validate-topic-mapping`、`csca-adaptive:rules`。

### Prisma 模型

新增模型建议：

```prisma
model CscaExamTopic {
  id          Int      @id @default(autoincrement())
  subject     String   @db.VarChar(60)
  code        String   @unique @db.VarChar(120)
  title       String   @db.VarChar(160)
  description String?  @db.Text
  examScope   String?  @map("exam_scope") @db.Text
  parentId    Int?     @map("parent_id")
  weight      Int      @default(1)
  status      String   @default("published") @db.VarChar(30)
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  @@index([subject, status], map: "idx_csca_exam_topics_subject_status")
  @@map("csca_exam_topics")
}

model CscaTopicMapping {
  id         Int      @id @default(autoincrement())
  sourceType String  @map("source_type") @db.VarChar(60)
  sourceId   Int     @map("source_id")
  topicId    Int     @map("topic_id")
  confidence Float   @default(1)
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt @map("updated_at")

  @@unique([sourceType, sourceId, topicId], map: "uq_csca_topic_mappings_source_topic")
  @@index([topicId], map: "idx_csca_topic_mappings_topic")
  @@map("csca_topic_mappings")
}

model UserCscaTopicMastery {
  id              Int      @id @default(autoincrement())
  userId          Int      @map("user_id")
  subject         String   @db.VarChar(60)
  topicId         Int      @map("topic_id")
  mastery         Float    @default(0.5)
  confidence      Float    @default(0.2)
  attemptCount    Int      @default(0) @map("attempt_count")
  correctCount    Int      @default(0) @map("correct_count")
  lastPracticedAt DateTime? @map("last_practiced_at")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  @@unique([userId, topicId], map: "uq_user_csca_topic_mastery_user_topic")
  @@index([userId, subject], map: "idx_user_csca_topic_mastery_user_subject")
  @@map("user_csca_topic_mastery")
}
```

训练轮相关模型：

```prisma
model CscaAdaptiveSession {
  id          Int      @id @default(autoincrement())
  userId      Int      @map("user_id")
  subject     String   @db.VarChar(60)
  mode        String   @default("practice") @db.VarChar(40)
  status      String   @default("active") @db.VarChar(40)
  startedAt   DateTime @default(now()) @map("started_at")
  completedAt DateTime? @map("completed_at")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  @@index([userId, subject, createdAt], map: "idx_csca_adaptive_sessions_user_subject_created")
  @@map("csca_adaptive_sessions")
}

model CscaAdaptiveRound {
  id              Int      @id @default(autoincrement())
  sessionId        Int     @map("session_id")
  roundIndex       Int     @map("round_index")
  status           String  @default("active") @db.VarChar(40)
  plannerSnapshot  Json?   @map("planner_snapshot")
  answers          Json    @default("{}")
  timeSpent        Json    @default("{}") @map("time_spent")
  currentQuestion  Int     @default(1) @map("current_question")
  correctCount     Int     @default(0) @map("correct_count")
  wrongCount       Int     @default(0) @map("wrong_count")
  unansweredCount  Int     @default(0) @map("unanswered_count")
  startedAt        DateTime @default(now()) @map("started_at")
  submittedAt      DateTime? @map("submitted_at")
  version          Int      @default(1)
  createdAt        DateTime @default(now()) @map("created_at")
  updatedAt        DateTime @updatedAt @map("updated_at")

  @@unique([sessionId, roundIndex], map: "uq_csca_adaptive_round_session_index")
  @@index([sessionId, createdAt], map: "idx_csca_adaptive_rounds_session_created")
  @@map("csca_adaptive_rounds")
}

model CscaAdaptiveRoundItem {
  id                Int      @id @default(autoincrement())
  roundId           Int      @map("round_id")
  questionId         Int      @map("question_id")
  topicId            Int      @map("topic_id")
  plannedDifficulty  String?  @map("planned_difficulty") @db.VarChar(40)
  position           Int
  selectedAnswer     String?  @map("selected_answer") @db.VarChar(50)
  isCorrect          Boolean? @map("is_correct")
  usedHint           Boolean  @default(false) @map("used_hint")
  usedExplanation    Boolean  @default(false) @map("used_explanation")
  timeSpentSeconds   Int      @default(0) @map("time_spent_seconds")
  createdAt          DateTime @default(now()) @map("created_at")
  updatedAt          DateTime @updatedAt @map("updated_at")

  @@unique([roundId, questionId], map: "uq_csca_adaptive_round_items_round_question")
  @@index([roundId, position], map: "idx_csca_adaptive_round_items_round_position")
  @@index([questionId], map: "idx_csca_adaptive_round_items_question")
  @@map("csca_adaptive_round_items")
}
```

曝光与 AI 记录：

```prisma
model CscaQuestionExposure {
  id          Int      @id @default(autoincrement())
  userId      Int      @map("user_id")
  questionId  Int      @map("question_id")
  source      String   @db.VarChar(60)
  seenCount   Int      @default(1) @map("seen_count")
  lastResult  String?  @map("last_result") @db.VarChar(40)
  lastSeenAt  DateTime @default(now()) @map("last_seen_at")

  @@unique([userId, questionId, source], map: "uq_csca_question_exposures_user_question_source")
  @@index([userId, lastSeenAt], map: "idx_csca_question_exposures_user_seen")
  @@map("csca_question_exposures")
}

model CscaAIInteraction {
  id            Int      @id @default(autoincrement())
  userId        Int?     @map("user_id")
  subject       String?  @db.VarChar(60)
  topicId       Int?     @map("topic_id")
  questionId    Int?     @map("question_id")
  sessionId     Int?     @map("session_id")
  roundId       Int?     @map("round_id")
  type          String   @db.VarChar(60)
  provider      String?  @db.VarChar(60)
  model         String?  @db.VarChar(120)
  promptVersion String?  @map("prompt_version") @db.VarChar(60)
  inputHash     String?  @map("input_hash") @db.VarChar(120)
  output        String?  @db.Text
  tokenUsage    Json?    @map("token_usage")
  costEstimate  Float?   @map("cost_estimate")
  status        String   @default("success") @db.VarChar(40)
  createdAt     DateTime @default(now()) @map("created_at")

  @@index([userId, createdAt], map: "idx_csca_ai_interactions_user_created")
  @@index([roundId], map: "idx_csca_ai_interactions_round")
  @@map("csca_ai_interactions")
}

model CscaAIInteractionFeedback {
  id            Int      @id @default(autoincrement())
  interactionId Int      @map("interaction_id")
  userId        Int?     @map("user_id")
  rating        Int
  reason        String?  @db.Text
  createdAt     DateTime @default(now()) @map("created_at")

  @@index([interactionId], map: "idx_csca_ai_feedback_interaction")
  @@map("csca_ai_interaction_feedback")
}
```

### 新增后端文件

建议在 `backend/src/csca-special-practice` 下新增：

- `csca-adaptive.types.ts`
- `csca-adaptive.service.ts`
- `adaptive-planner.service.ts`
- `mastery-engine.service.ts`
- `adaptive-question-provider.service.ts`
- `ai-coach.service.ts`

同时更新：

- `csca-special-practice.module.ts`
- `csca-special-practice.controller.ts`
- `csca-special-practice.service.ts`

### API

第一批后端 API：

- `GET /api/v1/csca-special-practice/adaptive/overview`
- `POST /api/v1/csca-special-practice/adaptive/sessions`
- `GET /api/v1/csca-special-practice/adaptive/sessions/:id`
- `POST /api/v1/csca-special-practice/adaptive/sessions/:id/rounds`
- `GET /api/v1/csca-special-practice/adaptive/rounds/:roundId`
- `PATCH /api/v1/csca-special-practice/adaptive/rounds/:roundId`
- `POST /api/v1/csca-special-practice/adaptive/rounds/:roundId/check`
- `POST /api/v1/csca-special-practice/adaptive/rounds/:roundId/submit`
- `GET /api/v1/csca-special-practice/adaptive/rounds/:roundId/report`
- `GET /api/v1/csca-special-practice/adaptive/mastery`

### 后端验收

- 已登录用户可以创建 adaptive session。
- 未完成本科目诊断的用户会先进入 `diagnostic` session，系统生成 20 题混合诊断 round。
- 完成诊断后，后续进入 `practice` session，系统生成 5 题训练 round。
- round 内题目不重复。
- 提交 round 后更新 `UserCscaTopicMastery`。
- 提交诊断 round 后会把 diagnostic session 标记为 completed，overview 后续切换为正式训练入口。
- 报告能返回掌握度变化和下一轮建议。
- 旧 `SpecialPracticeSession` API 不受影响。

### Session/Round 术语

当前实现统一采用以下含义：

- `CscaAdaptiveSession`：一次诊断或一次训练容器，由 `mode` 区分 `diagnostic` / `practice`。当前 MVP 中，一个 session 通常承载一个 active round；提交 round 后 session 标记为 `completed`。
- `CscaAdaptiveRound`：真正的答题单元。诊断 round 为 20 题，训练 round 为 5 题；前端答题页和报告页都以 round id 为路由主键。
- `CscaAdaptiveRoundItem`：round 内的单题状态，记录答案、耗时、是否使用 hint/explanation。

## Sprint 2：科目页内智能练习入口

目标：把普通用户入口并入现有科目页；adaptive 作为内部能力层，不作为新增用户产品，也不新增顶层科目练习页面。

当前工程状态：

- 已扩展 `frontend/src/lib/api-types.ts`，新增 adaptive overview/session/round/report/mastery 类型。
- 已扩展 `frontend/src/lib/api-special-practice.ts`，接入 `/api/v1/csca-special-practice/adaptive/...` API。
- 已把普通用户入口并入 `/csca-subjects/:subject`，在数学、物理、化学科目页内展示诊断/继续练习面板。
- 已移除普通导航和页脚中的独立科目练习入口，避免和“科目学习”重复。
- 已将普通用户流程改为两阶段：首次进入某学科只能启动 20 题诊断；诊断提交后，后续入口切换为 5 题一轮训练。
- 已新增 adaptive round taking/report 视图，支持答题、即时判分、自动暂存、提交和报告。
- adaptive round 提交时会等待正在进行的自动暂存完成，并在提交中锁定答题、跳题、AI Coach 与重复提交操作，降低版本冲突和重复点击风险。
- 已将 adaptive 用户视图集中在 `frontend/src/pages/special-practice/adaptive/AdaptivePracticeViews.tsx`，由 `AppRouteRenderer` 在 `/csca-subjects/:subject/practice/rounds/:id` 下渲染。
- 旧 `/csca-special-practice` 普通用户路由不再兼容；可视化工具对外路径并入 `/csca-subjects/:subject/...`，内部可暂时复用旧组件。
- 已将用户可见导航、页脚和首页文案从“专项/自适应训练”收敛为“科目学习内的练习”；后台仍保留“专项题库”和 adaptive observability 语义。
- 已通过 `npm.cmd --prefix frontend run build`、`npm.cmd run csca-adaptive:smoke` 与 Playwright 首页渲染检查。

### 新增类型

在 `frontend/src/lib/api-types.ts` 增加：

- `AdaptiveTrainingOverview`
- `AdaptiveSubjectSummary`
- `AdaptiveSession`
- `AdaptiveRound`
- `AdaptiveRoundDetail`
- `AdaptiveRoundReport`
- `AdaptiveMasteryTopic`
- `AdaptivePlannerReason`
- `AICoachInteraction`

### 扩展 API 封装

在 `frontend/src/lib/api-special-practice.ts` 增加：

- `getAdaptivePracticeOverview`
- `createAdaptivePracticeSession`
- `getAdaptivePracticeSession`
- `createAdaptivePracticeRound`
- `getAdaptivePracticeRound`
- `patchAdaptivePracticeRound`
- `checkAdaptivePracticeAnswer`
- `submitAdaptivePracticeRound`
- `getAdaptivePracticeRoundReport`
- `getAdaptivePracticeMastery`

### 页面拆分

当前已采用“科目页入口 + adaptive 子模块”的拆分方式：

- `frontend/src/pages/CscaSubjectPage.tsx`：承接普通用户的科目页、智能练习面板、诊断/继续练习入口。
- `frontend/src/pages/special-practice/adaptive/AdaptivePracticeViews.tsx`：集中维护 adaptive overview、subject dashboard、round taking、round report 与 AI Coach 交互。
- `frontend/src/pages/CscaSpecialPracticePage.tsx`：不作为普通用户入口，仅作为旧组件、可视化工具和后台预览的复用层。

暂不继续拆成四个小视图文件，原因是 adaptive round/report 之间共享较多 copy、路径、subject、AI Coach 和提交流控 helper；过早拆散会让状态流和文案维护更碎。后续如果 `AdaptivePracticeViews.tsx` 继续增长，可以再按如下边界拆分：

- `adaptive/AdaptiveOverviewView.tsx`
- `adaptive/AdaptiveSubjectDashboardView.tsx`
- `adaptive/AdaptiveRoundView.tsx`
- `adaptive/AdaptiveRoundReportView.tsx`
- `adaptive/adaptivePracticeHelpers.ts`

### 路由处理

`AppRouteRenderer` 的用户侧路由判断建议调整为：

1. `/csca-subjects/:subject/practice/rounds/:id/report` -> `AdaptiveRoundReportView`。
2. `/csca-subjects/:subject/practice/rounds/:id` -> `AdaptiveRoundView`。
3. `/csca-subjects/:subject/visualize/...` 和化学工具路径 -> 对外保留科目页路径，内部复用 visualizer 组件。
4. `/csca-subjects/:subject/formulas` / `/vocabulary` -> 科目资料页。
5. `/csca-subjects/:subject` -> `CscaSubjectPage`。

建议普通入口：

- `/csca-subjects` -> 科目学习索引。
- `/csca-subjects/:subject` -> 本科目学习页和智能练习面板。
- `/csca-subjects/:subject/practice/rounds/:id` -> 诊断或训练轮。
- `/csca-subjects/:subject/practice/rounds/:id/report` -> 本轮报告。

旧 `/csca-special-practice` 不再进入普通用户 route known list。

### 导航文案

更新：

- `frontend/src/lib/app-nav-items.ts`
- `frontend/src/i18n/messages/zh-CN.ts`
- `frontend/src/i18n/messages/en.ts`
- `frontend/src/i18n/messages/vi.ts`
- `frontend/src/components/SiteFooter.tsx`

文案从“专项/自适应训练”逐步收敛为“科目学习里的智能练习”。

### 前端验收

- 用户点击导航进入的是原有科目学习页，页面内由 adaptive engine 决定诊断或练习。
- 用户只需要选择学科，不需要选择 topic。
- 学科页可以开始下一轮训练。
- 训练轮可答题、暂存、提交。
- 报告页可以继续下一轮。
- 旧 `/csca-special-practice` 普通用户路径不再打开。
- 可视化路径不受影响。

## Sprint 2.5：在线模考页内自适应推荐

目标：把“模拟题/在线模考变成自适应”落实在原有模考入口里，而不是新增一个并列产品。

当前工程状态：

- 已在 `frontend/src/pages/CscaMockExamPage.tsx` 的 `/csca-mock-exam/:subject` 科目模考页读取 adaptive overview 与个人模考历史。
- 已新增后端 `MockExamPlannerService`，`/api/v1/csca-mock-exam/subjects/:subject` 支持可选登录用户并返回 `recommendation`。
- 已新增“系统推荐下一套”区域，按优先级处理：未完成模考续做、首次整卷诊断、低分补弱、专项掌握度联动、保持整卷节奏。
- 前端优先使用后端 `recommendation`，后端推荐为空或认证回退时，继续使用前端兜底策略，保证公开模考页可用。
- 已新增 `MockExamMasteryBridgeService`，模考首次提交后会把可映射题目的正确/错误结果反哺到 `UserCscaTopicMastery`。
- 已在原套卷卡片中标记推荐卷，用户仍可查看和手动选择全部套卷。
- 已保持原 CBT 做题、提交、报告路由不变：推荐只决定下一步入口，不改变现有 attempt/taking/report 流程。
- 已新增 Playwright 用例，验证已登录用户在数学模考页接收后端推荐并进入第二套卷。
- 已扩展 `csca-adaptive:rules`，覆盖模考题 knowledge tag 到 exam topic 的映射和 mastery 更新。
- 已扩展 `csca-adaptive:seed-topic-mapping`，为发布中的 `MockExamQuestion` 生成显式 `mock_exam_question -> CscaExamTopic` 主考点映射，并清理同题旧 mock 映射。
- 已扩展 `csca-adaptive:validate-topic-mapping`，把发布模考题映射覆盖率纳入验证闸门。

当前边界：

- 这一阶段是“自适应推荐套卷”，不是“动态生成整卷”。
- 模考反哺 mastery 只处理登录用户、首次提交、且能映射到已发布 `CscaExamTopic` 的题目；正式验证要求发布模考题都有显式主考点映射，运行时仍保留 tag fallback 作为兜底。
- 推荐逻辑已开始下沉到后端，但目前仍只是“固定套卷推荐”；尚未统一 exposure、动态整卷组卷、后台观测和策略版本。

下一步建议：

- 当固定套卷库存不足或用户做完全部卷后，再引入基于 published 题库的自适应整卷组卷。
- 后台增加模考推荐观测：推荐命中率、推荐后完成率、完成后分数变化、固定卷库存覆盖率。
- 后台增加低置信度/未人工复核映射队列；当前种子脚本可生成初始映射，但还没有管理员逐题确认工作流。

## Sprint 3：AI Coach MVP

目标：把 AI 作为训练陪练接入，不影响核心训练可用性。

当前工程状态：

- 已新增 `CscaAIInteraction` 与 `CscaAIInteractionFeedback` Prisma 模型。
- 已新增 `0032_csca_ai_coach_interactions` migration，并应用到本地数据库。
- 已新增 `AICoachService`，默认采用 `rule-fallback` 本地规则实现，不依赖外部 LLM。
- 已新增 `AICoachProviderService` provider adapter；在配置 `CSCA_AI_COACH_ENABLED`、`CSCA_AI_PROVIDER`、`CSCA_AI_MODEL`、`CSCA_AI_API_KEY` 后，可调用平台统一 OpenAI/OpenAI-compatible provider，失败时自动降级到本地 fallback；后台审计页已接入只读 provider readiness、未就绪原因、脱敏 base URL host、prompt version、超时、温度、输出长度和 rollout 放量比例配置状态。
- 已新增代码侧 `ai-coach-prompt-templates` 模板注册表，登记 `coach-v1-basic` 与默认 `coach-v2-safety`；未知 `CSCA_AI_PROMPT_VERSION` 会阻断外部 provider 调用并回退本地规则，同时在 readiness blocker 中暴露原因。
- 已为 AI Coach provider 增加最小 prompt version 管理和基础输出 guard：不允许输出系统提示/API key/内部配置；hint 阶段如果模型直接泄露答案，会回退到本地提示并记录拒绝状态；`csca-adaptive:rules` 覆盖 prompt 模板安全指令、fallback 上下文和未知模板阻断。
- 已新增 `ai-provider:smoke` 灰度脚本：默认验证 provider readiness、rule fallback interaction、usage metadata、训练事件和 fallback 不扣费；当后台或环境显示外部 provider 已就绪时，脚本不会默认发起真实模型调用，必须显式设置 `AI_PROVIDER_SMOKE_ALLOW_EXTERNAL=1` 才会消耗 1 个 AI Coach 单位并验证 billable、ledger posted consume 和余额扣减。
- 已新增 `AIUsageMeterService` 成本估算最小闭环，为每次 AI Coach interaction 写入 `tokenUsage` 估算、耗时、是否 billable、定价配置状态、单位估算和 `costEstimate`；外部 provider 失败或 fallback 不计费。
- 已新增 `AIEntitlementService`、`CscaAIEntitlementAccount`、`CscaAIUsageLedger` 与 `0033_csca_ai_entitlements` migration，支持个人 AI Coach 额度查询、预占、成功扣减、失败退款、管理员发放额度、固定 AI 额度包购买履约和 ledger 成本 metadata，并通过 `ai-credits:smoke` 覆盖购买入账幂等。
- 已在自适应总览、学科面板、答题页和报告页接入用户侧 AI 额度展示、低余额/耗尽降级提示和购买入口，训练链路在额度不足时继续保留标准解析。
- 已新增 `AIObservabilityService` 与 admin API，按日期范围聚合 AI Coach 调用量、fallback/拒绝/错误率、billable 次数、估算 token、反馈评分和最近失败。
- 已新增 `CscaTrainingEvent`、`TrainingEventService` 与 admin API，记录并聚合诊断/训练开始、完成、AI Coach 点击和反馈事件。
- 已新增 `CscaAIReviewDecision` 与 `0036_csca_ai_review_decisions` migration，支持管理员对 AI Coach interaction 写入复核结论，并通过 admin audit 记录处理动作。
- 已增强后台审计页的自适应观测区：支持时间范围、学科、provider、状态、AI 类型和复核原因筛选，提供刷新/重置、AI 调用趋势、训练事件趋势、provider/type/status/subject 分布、最近训练事件、最近 AI 失败列表和 AI 复核队列；复核队列通过低评分、provider 拒绝、provider 错误、额度耗尽等信号派生并给出建议动作，管理员可记录“可接受 / 改 Prompt / 修题 / 暂停模板 / 已处理”等结论；暂不拆独立 BI 页面。
- 已在 `CscaSpecialPracticeController` 挂载 AI Coach API。
- 已扩展前端 API 类型与请求封装。
- 已在 adaptive round 答题页接入“AI Coach”区域：作答前支持提示；作答后“查看解析”会合并标准解析、错因分析和有用/没用反馈。
- 已在 adaptive round report 页接入“生成 AI 总结”。
- AI hint/explanation 会标记 round item 的 `usedHint` / `usedExplanation`，用于后续 mastery 更新和报告分析。
- hint 只能在未作答前请求；作答后只能请求 explanation，避免把答后复盘误记为训练中提示。
- 未作答时不能请求 explanation，避免训练中直接暴露正确答案。
- 未提交时不能生成 round summary，避免用户提前获得整轮复盘。
- 提交后不允许继续请求 hint；提交后的 explanation 可作为复盘交互记录，但不再写入训练辅助使用标记。
- 已通过 `backend:build` 与 `frontend build`。
- 已新增 `npm.cmd run csca-adaptive:smoke`，覆盖真实 HTTP 链路：注册临时用户、创建自适应 session/round、判题、暂存、AI hint、AI feedback、AI explanation、AI 使用标记、提交、AI round summary、mastery 查询，并验证 AI interaction/feedback 数据完整性后自动清理临时数据。

### 后端任务

新增或扩展：

- `AICoachService`
- `AICoachProviderService`
- `AIUsageMeterService`
- `AIEntitlementService`
- `AIObservabilityService`
- `TrainingEventService`

当前 MVP 已落地：

- `AICoachService`
- `AICoachProviderService`
- `AIUsageMeterService`
- `AIEntitlementService`
- `AIObservabilityService`
- `TrainingEventService`
- `CscaAIInteraction`
- `CscaAIInteractionFeedback`
- `CscaAIEntitlementAccount`
- `CscaAIUsageLedger`
- `CscaTrainingEvent`
- `CscaAIReviewDecision`

暂未落地但应作为下一阶段补充：

- prompt 模板后台版本发布与运营审核工作流
- 学校/平台额度策略
- 多档 AI 额度商品、真实支付产品映射、机构额度池和 BYOK
- 完整 AI 安全审核、质量/成本独立看板、筛选趋势图和后台可编辑 provider 单价配置

MVP 接口：

- `GET /api/v1/admin/csca-special-practice/adaptive/ai/observability`
- `GET /api/v1/admin/csca-special-practice/adaptive/ai/review-queue`
- `POST /api/v1/admin/csca-special-practice/adaptive/ai/review-queue/:interactionId/decisions`
- `GET /api/v1/admin/csca-special-practice/adaptive/ai/provider-config`
- `GET /api/v1/admin/csca-special-practice/adaptive/events/observability`
- `GET /api/v1/csca-special-practice/adaptive/ai/entitlement`
- `POST /api/v1/csca-special-practice/adaptive/ai/hint`
- `POST /api/v1/csca-special-practice/adaptive/ai/explain`
- `POST /api/v1/csca-special-practice/adaptive/ai/round-summary`
- `POST /api/v1/csca-special-practice/adaptive/ai-interactions/:id/feedback`

灰度验证脚本：

- `npm.cmd run ai-provider:smoke`：默认不消耗真实 LLM 额度。若外部 provider 已就绪但未设置 `AI_PROVIDER_SMOKE_ALLOW_EXTERNAL=1`，只验证 readiness 并跳过 live call；设置后会发起一次 hint 调用，并按 `CSCA_AI_ROLLOUT_PERCENT` 判断临时用户是否应进入真实 provider，验证外部 provider 成功、interaction billable、ledger 扣减和余额变化，或验证未命中灰度时安全 fallback。若提供 `ADMIN_BOOTSTRAP_EMAIL` / `ADMIN_BOOTSTRAP_PASSWORD`，脚本还会提交一条临时低评分反馈，验证后台 observability、rollout health 和 review queue 能看到这次样本；需要把后台只读接口也作为硬性验收时，设置 `AI_PROVIDER_SMOKE_REQUIRE_ADMIN=1`。
- `npm.cmd run csca-adaptive:release-smoke`：发布前本地灰度验收脚本，覆盖注册临时学生、math 20 题诊断、5 题训练、AI hint、低评分反馈、后台 provider config、复核队列、复核结论写入和 admin audit。若未配置管理员账号，脚本只跑学生侧并标记后台复核跳过；正式灰度验收应设置 `ADAPTIVE_RELEASE_SMOKE_REQUIRE_ADMIN=1`，并在停掉旧后端后先跑 migration、重启后端。

下一阶段接入真实 LLM 时，可以先只接一个平台统一 provider，并支持环境变量开关：

- `CSCA_AI_COACH_ENABLED`
- `CSCA_AI_PROVIDER`
- `CSCA_AI_MODEL`
- `CSCA_AI_API_KEY`
- `CSCA_AI_BASE_URL`
- `CSCA_AI_TIMEOUT_MS`
- `CSCA_AI_TEMPERATURE`
- `CSCA_AI_PROMPT_VERSION`
- `CSCA_AI_MAX_OUTPUT_CHARS`
- `CSCA_AI_ROLLOUT_PERCENT`
- `CSCA_AI_INITIAL_FREE_UNITS`
- `CSCA_AI_ENTITLEMENT_ENABLED`
- `CSCA_AI_INPUT_COST_PER_1K_TOKENS`
- `CSCA_AI_OUTPUT_COST_PER_1K_TOKENS`
- `CSCA_AI_UNIT_TOKEN_BUDGET`
- `CSCA_AI_COST_CURRENCY`
- `CSCA_AI_ROLLOUT_MIN_INTERACTIONS`
- `CSCA_AI_ROLLOUT_MIN_FEEDBACK`
- `CSCA_AI_ROLLOUT_MAX_ERROR_RATE`
- `CSCA_AI_ROLLOUT_MAX_REJECTION_RATE`
- `CSCA_AI_ROLLOUT_MAX_LOW_FEEDBACK_RATE`
- `CSCA_AI_ROLLOUT_MIN_AVERAGE_RATING`

如果 LLM 没配置：

- hint 返回规则提示；
- explain 返回标准解析；
- summary 返回规则总结；
- 前端不报错。

当前实现即采用该降级策略作为默认能力：

- `provider`: `rule-fallback`
- `model`: `local-rule-v1`
- `promptVersion`: `coach-rule-v1`

这样可以先验证前端交互、日志记录、用户反馈和训练流融合，再决定是否接入真实 LLM。

### 前端任务

当前 MVP 已落地：

- 作答前提示按钮。
- 作答后解析内嵌错因分析。
- AI interaction 有用/没用反馈。
- 同一题同一 AI 类型结果不重复追加。

交互要求：

- 提示不能抢占主答题区域；
- 第一层提示不能直接给答案；
- AI 加载态要短；
- 失败时显示“已切换为标准解析”；
- 用户可以对 AI 回答做有用/没用反馈。
- 作答后不再展示独立“解释错因”按钮，避免和“查看解析”职责重复。

### 验收

- AI 开启时能给提示和错因解释。
- AI 关闭时训练仍可完整完成。
- AI 调用会写入 `CscaAIInteraction`。
- 用户反馈会写入 `CscaAIInteractionFeedback`。

当前 MVP 验收重点：

- 训练不依赖 AI，AI 只作为辅助层。
- 提示不会直接替用户作答。
- 提示必须发生在作答前，作答后请求 hint 会被拒绝。
- 错因解释优先复用已有标准解析和正确答案。
- 错因解释必须在作答后才能请求，整轮总结必须在提交后才能生成。
- 提交后的 hint 请求会被拒绝，避免把复盘阶段误记为训练中辅助。
- AI 输出可被记录、计量、反馈，为后续真实 LLM 成本和质量评估留数据基础。

当前本地 smoke 结果：

- `npm.cmd run csca-adaptive:smoke` 已通过。
- smoke 创建 1 个临时学生用户，先验证 math 20 题诊断 round，提交后确认 overview 切换到训练，再验证 5 题 focus practice round；同时验证 3 条 AI interaction、1 条 AI feedback、`sessionId`、`roundId`、`questionId` 关联，并在结束时清理。
- `npm.cmd run csca-adaptive:rules` 已通过，覆盖 20 题诊断难度分布、5 题 practice planner、focus topic、题目曝光优先级、mastery hint/explanation 降权、AI usage metering。
- `npm.cmd run ai-credits:smoke` 已通过，覆盖固定 AI 额度包购买、mock 支付回调、余额增加和重复回调不重复入账。
- `npm.cmd run ai-provider:smoke` 用于上线前灰度验证 provider readiness、fallback 不扣费和可选真实 provider 调用。默认本地 `rule-fallback` 路径应通过；真实 provider 路径需设置 `AI_PROVIDER_SMOKE_ALLOW_EXTERNAL=1`。
- `npm.cmd run csca-adaptive:release-smoke` 已新增，用于迁移并重启后端后的发布前完整灰度验收；本阶段已完成脚本语法检查和规则测试，实际 HTTP 跑通需要使用最新后端进程与 `0036_csca_ai_review_decisions` migration。
- 当前 AI provider 为 `rule-fallback`。

## Sprint 4：上线前收敛

目标：把 MVP 从能跑变成可灰度。

### 必做

1. 题库低库存降级策略。
2. 连续答错后的概念卡或降难度策略。
3. 训练疲劳提示。
4. 旧 `/csca-special-practice` 普通用户路径下线测试。
5. 模考入口回归测试。
6. 管理员题库发布流程回归测试。
7. 构建和类型检查。

### 建议测试

后端：

- planner 选题不重复；
- 题量不足降级；
- round 提交幂等或冲突处理；
- mastery 更新；
- AI 关闭降级；
- legacy session 不受影响。

前端：

- overview 加载；
- subject dashboard 加载；
- round 答题与暂存；
- report 展示；
- legacy topic 路径；
- visualizer 路径；
- AI 失败状态。

## 5. 第一轮编码顺序

建议真正开始写代码时按这个顺序：

1. 添加 Prisma 模型和 migration。
2. 写 topic mapping seed 或导入脚本。
3. 写 `AdaptiveQuestionProvider`。
4. 写 `MasteryEngine`。
5. 写 `AdaptivePlanner`。
6. 写 `CscaAdaptiveService`。
7. 挂 controller API。
8. 补后端单元测试。
9. 扩展前端 API types。
10. 新增 adaptive overview 和 subject dashboard。
11. 新增 adaptive round 和 report。
12. 调整导航文案。
13. 接 AI Coach。
14. 做端到端手动验收。

这个顺序的好处是先验证“系统能不能稳定选题和更新掌握度”，再投入前端体验和 AI。

## 6. 最关键的未决问题

正式编码前还需要确认：

1. CSCA 考纲 topic 列表是否由我们先定义，还是从已有内容自动归并。
2. 每个学科 MVP 要覆盖多少 topic。
3. 第一版是否要求所有用户登录后才能使用智能科目练习。
4. AI Coach 免费额度是多少。
5. 是否允许游客使用非 AI 的基础科目练习。
6. 旧“专项练习/自适应训练”文案何时彻底替换成“科目学习里的智能练习”。

我的建议：

- 科目练习需要登录，否则无法保存 mastery。
- 游客可以看到 overview，但开始训练时引导登录。
- AI Coach 先给少量免费额度，后续再接付费。
- 旧 `/csca-special-practice` 普通用户路径不再保留；如发现真实用户历史链接需求，用数据迁移、后台预览或专门的报告回看方案处理。

## 7. 最大风险

### 7.1 题库映射风险

如果现有题目和 CSCA 考纲 topic 无法稳定映射，科目练习会变成“随机抽题 + 漂亮报告”。

应对：

- Sprint 0 必须先做题库盘点。
- 低置信映射不能直接进入正式 planner。
- 后台需要能看到低库存和低置信映射。

### 7.2 前端页面体积风险

`CscaSpecialPracticePage.tsx` 已经很大，如果继续作为普通用户训练入口，会增加维护成本并让产品职责重复。

应对：

- 第一版普通用户入口转到 `CscaSubjectPage.tsx`，避免 `CscaSpecialPracticePage.tsx` 继续承接新产品语义。
- adaptive 用户视图已拆到 `frontend/src/pages/special-practice/adaptive/AdaptivePracticeViews.tsx`，由科目页路由调用。
- 后续只在 adaptive 子模块或科目页内继续拆分，不再把新能力追加回旧专项主入口文件。
- 可视化页面对外迁移到科目页路径，内部可暂时复用旧组件。

### 7.3 AI 成本和稳定性风险

AI Coach 如果不限制，会产生成本不可控和体验不稳定。

应对：

- MVP 必须有开关、超时、降级和日志。
- 不做实时 AI 出题。
- 不把 AI 作为训练提交的必需步骤。

### 7.4 用户理解风险

如果页面仍然展示大量 topic 卡片，用户会觉得这只是旧专项换皮。

应对：

- 普通用户主路径只展示学科、下一轮、掌握度、报告。
- topic 只在解释、报告和后台出现。

## 8. 成熟度更新

有了这份蓝图后，方案成熟度可以从 75%-80% 提升到约 85%。

还没有到 95%，因为缺两件硬证据：

1. 真实题库盘点结果。
2. 真实 topic mapping 质量。

只要 Sprint 0 证明题库覆盖可用，这个方案就可以正式进入第一轮开发。

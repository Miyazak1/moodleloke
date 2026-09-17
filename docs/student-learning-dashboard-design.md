# CSCA 学习驾驶舱与自动学习投入反馈方案

> 日期：2026-06-08  
> 分支：`codex/adaptive-ai-questioning`  
> 状态：学习驾驶舱、AI 周报缓存、错因模式聚合与复习队列 MVP 已落地；历史数据兜底已补齐  
> 关联文档：`adaptive-ai-questioning-plan.md`、`adaptive-training-mvp-implementation-spec.md`、`adaptive-training-ux-optimization.md`

## 1. 背景

CSCAlite 当前已经把自适应训练并入现有科目学习页。用户不再需要理解“专项练习”“自适应训练”“AI Coach”这些内部能力的边界，而是从数学、物理、化学科目页直接进入诊断、训练、复盘和下一轮推荐。

下一阶段的问题不再是“有没有训练闭环”，而是：

- 用户长期使用后，能不能看见自己真的在进步。
- 用户做完一轮、一次模考、一次错题复盘后，系统能不能自动给出清晰反馈。
- 个人页能不能从账号工作台升级为学习驾驶舱。
- AI 能不能在长期学习路径中给出有价值的总结，而不是只在单题解析里出现。

参考产品里的“CBT 仿真、三级计时、AI 错题本、4 维 AI 讲解、48 维诊断、3 届验证、学习闭环”值得借鉴，但不能简单照搬。CSCAlite 的重点应该是围绕 CSCA 备考，把真实学习行为、掌握度、错题、模考和 AI 总结串成一个长期反馈系统。

## 2. 核心判断

### 2.1 不做用户手动打卡

这里的“打卡”不应该是用户点击一个按钮完成签到。

更准确的产品语义是：

- 学习投入反馈。
- 学习活动轨迹。
- 学习足迹。
- 训练热力图。
- 成长记录。

系统应该根据用户在网站上的真实学习行为自动点亮和累积，而不是让用户为了完成任务去点一个无学习含义的按钮。

有效学习行为包括：

- 完成一轮 5 题科目训练。
- 完成 20 题诊断。
- 完成一次 48 题模拟题。
- 复盘错题。
- 查看 AI 解析并反馈“有用 / 没用”。
- 某个知识点从低掌握度进入稳定区间。
- 连续多天完成有效训练。

AI 周报、AI 总结和浏览报告可以作为辅助证据，但不应单独点亮一天。否则用户只看报告、不做训练，也会被误判为有效学习。

### 2.2 用户价值

学习驾驶舱要解决三个问题：

1. 我最近有没有坚持学习。
2. 我在哪些地方真的变强了。
3. 我下一步最应该做什么。

因此它不是单纯的数据报表，也不是游戏化签到，而是一个让用户长期愿意回来训练的反馈系统。

## 3. 可借鉴能力评估

| 参考能力 | 是否借鉴 | CSCAlite 的落点 |
| --- | --- | --- |
| CBT 仿真 | 借鉴 | 放在现有模拟题/模考，不新增平行入口；强调 48 题、60 分钟、官方节奏。 |
| 三级计时 | 借鉴一部分 | 模考可保留总时长、阶段提醒、最后冲刺；科目训练只保留轻量计时，避免干扰。 |
| AI 错题本 | 强烈借鉴 | 错题不只是列表，要聚合错因、重复错误、下次复习时间和 AI 复盘建议。 |
| 4 维 AI 讲解 | 借鉴但收敛 | 不做花哨标签，统一到“知识点、错因、正确思路、下一步动作”。 |
| 48 维诊断 | 借鉴思想 | 不是营销数字，而是基于 CSCA 考纲 topic 和能力维度形成诊断面板。 |
| 3 届验证 | 可后置 | 当前题库和考纲可以标注来源与覆盖度，真实公开验证需要后续运营数据支撑。 |
| 学习闭环 | 强烈借鉴 | 形成“诊断 -> 训练 -> 解析 -> 错题 -> 模考 -> 再训练 -> 长期趋势”的闭环。 |

### 3.1 后续讨论补充：能借鉴的不是口号，而是产品能力

参考截图里的表达有价值，但 CSCAlite 不应照搬“不是又一个题库”“AI 老师”“48 维诊断”这类营销说法。我们真正要借鉴的是它背后的产品能力：把用户每一次训练、错误、复盘、模考和 AI 讲解组织成清晰的备考系统。

#### 3.1.1 AI 错题本

这是最适合 CSCAlite 先做深的能力。

当前 CSCAlite 已有错题本和 AI 错因解析，下一步应该升级为：

- 错题自动归因：知识点不会、审题错误、计算错误、时间压力、公式记忆混淆。
- 错题重复频率：同一 topic、同类错误、同一题型反复出现几次。
- 间隔复习队列：今天该复盘哪些错题，不让用户自己翻错题本。
- 错题状态变化：从 `active` 到 `improving`，再到 `resolved`。
- AI 复盘建议：不是再讲一遍解析，而是告诉用户下一次如何避免。

这部分应落到 `CscaWrongPattern`，并和 `CscaAdaptiveRoundItem`、`UserCscaTopicMastery`、`CscaAIInteraction` 关联。

#### 3.1.2 4 维 AI 讲解

可以借鉴，但需要定义成 CSCAlite 自己的版本。

建议 4 个维度是：

1. 为什么错。
2. 正确思路。
3. 快速解法。
4. 下次如何避免。

它比单纯“AI 解析”更像产品能力。对用户来说，这四个维度分别回答：

- 我到底错在哪里。
- 这道题正确路径是什么。
- 考试时怎么更快做出来。
- 下一次遇到类似题怎么不再掉坑。

交互上不一定要做四个 tab。更好的方式是在解析卡里自然分段，默认只展开最关键的“错因 + 正确思路”，其余内容根据题目和用户表现选择性展示。

#### 3.1.3 48 维诊断

这个概念可以借鉴，但不能为了好听硬造 48 个指标。

CSCAlite 应该基于 CSCA 考纲 topic 和能力标签形成诊断维度。维度来源可以包括：

- 学科：数学、物理、化学。
- topic：函数、几何、力学、化学计量等。
- 能力：概念理解、公式使用、图像理解、计算稳定性、时间控制。
- 证据：诊断题、5 题训练、模考、错题复盘。

如果最终真的能形成 48 个稳定维度，可以在产品文案里表达；如果当前只有 20-30 个可靠维度，就应该诚实展示“知识点诊断”或“能力诊断”，不要为营销数字牺牲可信度。

#### 3.1.4 学习闭环

这是最重要的方向。

当前 CSCAlite 已经有：

- 做题。
- 报告。
- 下一轮训练。
- AI 解析。
- 错题记录。

但个人页还没有把长期闭环展示出来。后续应该变成：

- 今天做了什么。
- 最近有没有坚持。
- 哪个知识点改善了。
- 哪类错因还在反复。
- 下一轮为什么推荐这些题。
- 模考暴露的问题如何回到科目训练。

也就是说，学习闭环不是一个宣传模块，而是个人页、科目页、模考报告和错题本之间的数据闭环。

#### 3.1.5 个人页学习统计

用户提出个人页需要更好展示学习情况，这一点应作为后续 UX 的重点。

个人页不应只展示历史记录列表，而应该有：

- 学习热力图：自动展示学习投入，不是手动打卡。
- 学习曲线：正确率、题量、学习时长、掌握度的趋势。
- 学科雷达或学科掌握卡：数学、物理、化学分别展示状态。
- 错因趋势：哪些错误正在减少，哪些错误还在重复。
- 模考趋势：分数、用时、未答题、薄弱模块变化。
- AI 周报：用自然语言总结长期变化和下一步动作。

这部分直接决定用户是否感觉“这个系统懂我”，也决定 AI Coach 的价值能否从单题解析扩展到长期陪练。

### 3.2 不建议照搬的部分

以下内容不建议直接照搬：

- 不直接承诺“1:1 复制官方考场”，除非真实考试界面、题型、计时规则和交互细节已经核验。
- 不硬说“48 维诊断”，除非数据库和报告真的能支撑稳定维度。
- 不把 AI 包装成万能老师。AI 应该服务于提示、解析、总结和复盘，不接管判题和 mastery 更新。
- 不把学习热力图做成手动签到。它必须来自真实训练行为。
- 不把个人页做成堆满指标的 BI 看板。它首先要告诉用户下一步该做什么。

## 4. 和现有项目结构的关系

### 4.1 当前已有基础

后端已经有可复用的数据来源：

- `CscaAdaptiveSession`
  - 用户一次科目训练 session。
- `CscaAdaptiveRound`
  - 5 题训练轮或诊断轮。
- `CscaAdaptiveRoundItem`
  - 单题作答、正确与否、用时、是否使用提示/解析。
- `UserCscaTopicMastery`
  - 用户在 topic 上的 mastery、confidence、attempt/correct 计数。
- `CscaQuestionExposure`
  - 题目曝光次数和最近作答结果。
- `CscaAIInteraction`
  - AI Coach 提示、解析、总结、token/cost/status。
- `CscaTrainingEvent`
  - 训练开始、完成、AI Coach 点击和反馈等事件。
- `MockExamAttempt`
  - 模考作答、得分、正确/错误/未答和用时。

前端已有个人页：

- `frontend/src/pages/PublicMePage.tsx`

当前个人页更像账号工作台，包含短名单、学校对比、练习记录、错题、订单服务。后续可以在这个页面的 overview 区域加入学习驾驶舱，而不是新建一个和个人页竞争的入口。

### 4.2 不建议新增独立“打卡页”

不建议新增一个单独的 `/checkin` 或 `/learning-streak` 页面。

原因：

- 用户目标不是打卡，而是备考。
- 打卡页会变成孤立游戏化功能，和训练主线脱节。
- 个人页天然承载长期数据、订单、额度和学习记录，更适合升级为学习驾驶舱。

建议入口：

- 顶部账号菜单进入“我的账号”。
- `/me` 的总览页首屏改造为学习驾驶舱。
- 科目训练报告页只展示本轮反馈，并提供进入个人页查看长期趋势的轻入口。

## 5. 数据库设计

### 5.1 设计原则

1. 事件驱动，不存手动签到。
2. 原始事件可追溯，每日快照可快速查询。
3. 学习连续天数由规则计算，不由用户点击产生。
4. AI 洞察和趋势总结单独存储，避免每次打开个人页都消耗 LLM。
5. 个人学习反馈应覆盖科目训练、模考、错题复盘和 AI 交互。

### 5.2 复用现有事件表

当前已有 `CscaTrainingEvent`，可以作为 MVP 的基础事件表继续扩展：

```prisma
model CscaTrainingEvent {
  id         Int      @id @default(autoincrement())
  userId     Int?     @map("user_id")
  subject    String?  @db.VarChar(60)
  sessionId  Int?     @map("session_id")
  roundId    Int?     @map("round_id")
  questionId Int?     @map("question_id")
  eventType  String   @map("event_type") @db.VarChar(80)
  source     String   @default("adaptive") @db.VarChar(40)
  metadata   Json?
  createdAt  DateTime @default(now()) @map("created_at")
}
```

建议补充标准事件类型：

| eventType | source | 说明 |
| --- | --- | --- |
| `diagnostic_started` | `adaptive` | 开始 20 题诊断 |
| `diagnostic_completed` | `adaptive` | 完成诊断 |
| `practice_round_started` | `adaptive` | 开始 5 题训练轮 |
| `practice_round_completed` | `adaptive` | 完成训练轮 |
| `question_answered` | `adaptive` / `mock` | 单题作答 |
| `wrong_question_reviewed` | `wrong_bank` | 错题复盘 |
| `ai_hint_used` | `adaptive` | 使用 AI 提示 |
| `ai_explanation_viewed` | `adaptive` | 查看 AI 解析 |
| `ai_feedback_submitted` | `adaptive` | 提交 AI 有用/没用反馈 |
| `mock_exam_started` | `mock` | 开始模拟题 |
| `mock_exam_completed` | `mock` | 完成模拟题 |

`metadata` 建议写入：

- `durationSeconds`
- `answeredCount`
- `correctCount`
- `wrongCount`
- `unansweredCount`
- `topicIds`
- `masteryBefore`
- `masteryAfter`
- `aiInteractionId`
- `isBillable`

### 5.3 新增每日学习快照

新增 `CscaLearningDailySnapshot`，用于个人页快速渲染热力图、学习曲线和统计卡片。

```prisma
model CscaLearningDailySnapshot {
  id                Int      @id @default(autoincrement())
  userId            Int      @map("user_id")
  localDate         DateTime @map("local_date")
  timezone          String   @default("Asia/Shanghai") @db.VarChar(60)
  subject           String?  @db.VarChar(60)
  activeScore       Int      @default(0) @map("active_score")
  answeredCount     Int      @default(0) @map("answered_count")
  correctCount      Int      @default(0) @map("correct_count")
  wrongCount        Int      @default(0) @map("wrong_count")
  unansweredCount   Int      @default(0) @map("unanswered_count")
  practiceSeconds   Int      @default(0) @map("practice_seconds")
  mockSeconds       Int      @default(0) @map("mock_seconds")
  reviewCount       Int      @default(0) @map("review_count")
  aiInteractionCount Int     @default(0) @map("ai_interaction_count")
  masteryAvg        Float?   @map("mastery_avg")
  isStreakEligible  Boolean  @default(false) @map("is_streak_eligible")
  createdAt         DateTime @default(now()) @map("created_at")
  updatedAt         DateTime @updatedAt @map("updated_at")

  @@unique([userId, localDate, subject], map: "uq_csca_learning_daily_user_date_subject")
  @@index([userId, localDate], map: "idx_csca_learning_daily_user_date")
}
```

说明：

- `subject = null` 表示全科汇总。
- `subject = math/physics/chemistry` 表示学科维度。
- `activeScore` 用于热力图深浅，不直接展示给用户。
- `isStreakEligible` 表示当天是否算有效学习日。

### 5.4 新增连续学习状态

新增 `CscaLearningStreak`，避免每次打开个人页都从全量历史重算连续天数。

```prisma
model CscaLearningStreak {
  id                 Int      @id @default(autoincrement())
  userId             Int      @unique @map("user_id")
  currentStreakDays  Int      @default(0) @map("current_streak_days")
  longestStreakDays  Int      @default(0) @map("longest_streak_days")
  lastEligibleDate   DateTime? @map("last_eligible_date")
  updatedAt          DateTime @updatedAt @map("updated_at")
}
```

规则：

- 当天达到有效学习条件，`lastEligibleDate` 更新为当天。
- 如果昨天也有效，`currentStreakDays + 1`。
- 如果中断超过一天，重新从 1 开始。
- `longestStreakDays` 只增不减。

### 5.5 新增 AI 学习洞察

新增 `CscaLearningInsight`，用于周报/月报和个人页 AI 总结缓存。

```prisma
model CscaLearningInsight {
  id                 Int      @id @default(autoincrement())
  userId             Int      @map("user_id")
  periodType         String   @map("period_type") @db.VarChar(40)
  periodStart        DateTime @map("period_start")
  periodEnd          DateTime @map("period_end")
  summary            String   @db.Text
  strengths          Json     @default("[]")
  weaknesses         Json     @default("[]")
  recommendedActions Json     @default("[]") @map("recommended_actions")
  provider           String?  @db.VarChar(60)
  model              String?  @db.VarChar(120)
  status             String   @default("success") @db.VarChar(40)
  createdAt          DateTime @default(now()) @map("created_at")

  @@index([userId, periodType, periodStart], map: "idx_csca_learning_insights_user_period")
}
```

AI 洞察不应每次刷新页面都生成。建议：

- 每周自动生成一次。
- 用户完成关键模考后可生成一次。
- 用户本周训练量不足时，用规则总结，不强行消耗额度。

### 5.6 错因模式聚合

错题本要从“错题列表”升级为“错因模式”。

建议新增 `CscaWrongPattern`：

```prisma
model CscaWrongPattern {
  id              Int       @id @default(autoincrement())
  userId          Int       @map("user_id")
  subject         String    @db.VarChar(60)
  topicId         Int?      @map("topic_id")
  patternType     String    @map("pattern_type") @db.VarChar(60)
  recurrenceCount Int       @default(1) @map("recurrence_count")
  lastWrongAt     DateTime? @map("last_wrong_at")
  lastCorrectAt   DateTime? @map("last_correct_at")
  nextReviewAt    DateTime? @map("next_review_at")
  status          String    @default("active") @db.VarChar(40)
  metadata        Json?
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  @@index([userId, subject, status], map: "idx_csca_wrong_patterns_user_subject_status")
  @@index([userId, nextReviewAt], map: "idx_csca_wrong_patterns_user_review")
}
```

`patternType` 示例：

- `concept_gap`
- `formula_or_rule`
- `calculation`
- `visual_interpretation`
- `unanswered`

当前实现采用保守规则归因，不让 LLM 直接写入错因事实。训练或模考提交后，系统会根据是否未答、题目知识标签和 topic 聚合错因模式；同一用户、同一学科、同一 topic、同一错因类型会累加 `recurrenceCount`，并更新 `nextReviewAt`。AI 后续可以解释这些错因，但不作为错因数据的唯一来源。

## 6. 有效学习日规则

一天是否点亮，不看用户有没有点击“打卡”，而看是否发生有效学习。

建议 MVP 规则：

| 行为 | activeScore | 是否可点亮 |
| --- | ---: | --- |
| 完成一轮 5 题训练 | 40 | 是 |
| 完成 20 题诊断 | 80 | 是 |
| 完成一次 48 题模考 | 120 | 是 |
| 复盘 3 道及以上错题 | 30 | 是 |
| 单题使用 AI 解析并反馈 | 10 | 否，辅助加分 |
| 查看报告但没有训练 | 5 | 否 |
| 只登录或浏览页面 | 0 | 否 |

热力图强度建议：

- 0：无活动。
- 1：轻量学习，activeScore 1-39。
- 2：有效学习，activeScore 40-79。
- 3：高强度学习，activeScore 80-119。
- 4：完整训练日，activeScore >= 120。

用户文案不展示 activeScore，只展示自然语言：

- 今天已完成 1 轮训练。
- 今天已点亮学习记录。
- 本周已学习 4 天。
- 连续学习 6 天。
- 最近 30 天训练 18 天。

## 7. API 设计

### 7.1 个人学习驾驶舱

新增：

`GET /api/v1/me/learning-dashboard`

返回结构：

```ts
type LearningDashboardResponse = {
  profile: {
    displayName: string | null;
    role: string;
  };
  summary: {
    totalAnswered: number;
    totalCorrect: number;
    accuracy: number | null;
    practiceMinutesThisWeek: number;
    currentStreakDays: number;
    longestStreakDays: number;
    readinessScore: number | null;
  };
  heatmap: Array<{
    date: string;
    level: 0 | 1 | 2 | 3 | 4;
    answeredCount: number;
    practiceMinutes: number;
    accuracy: number | null;
    subjects: string[];
    isStreakEligible: boolean;
  }>;
  trend: Array<{
    date: string;
    accuracy: number | null;
    masteryAvg: number | null;
    answeredCount: number;
    practiceMinutes: number;
  }>;
  subjects: Array<{
    subject: 'math' | 'physics' | 'chemistry';
    masteryAvg: number | null;
    answeredCount: number;
    weakTopicCount: number;
    nextAction: string;
  }>;
  weakTopics: Array<{
    subject: string;
    topicId: number | null;
    title: string;
    mastery: number | null;
    wrongCount: number;
    nextActionLabel: string;
    nextActionHref: string;
  }>;
  wrongPatterns: Array<{
    subject: string;
    label: string;
    recurrenceCount: number;
    nextReviewAt: string | null;
  }>;
  nextActions: Array<{
    priority: number;
    title: string;
    body: string;
    ctaLabel: string;
    href: string;
  }>;
  aiInsight: {
    status: 'ready' | 'generating' | 'empty' | 'fallback';
    summary: string | null;
    actions: string[];
    generatedAt: string | null;
  };
};
```

### 7.2 某天学习详情

新增：

`GET /api/v1/me/learning-dashboard/days/:date`

用于热力图点击某一天后展示详情：

- 当天完成了哪些训练。
- 哪些学科有活动。
- 正确率和用时。
- 主要错因。
- 系统建议的下一步。

### 7.3 生成或刷新 AI 周报

新增：

`POST /api/v1/me/learning-dashboard/insights/weekly`

注意：

- 默认不让用户频繁重生成。
- 优先复用缓存。
- 额度不足时降级到规则总结。
- AI 周报不替代训练反馈，只做长期总结。

## 8. 前端交互设计

### 8.1 个人页首屏

个人页 `/me` 的 overview 首屏建议重构为：

1. 用户头像、显示名、学习身份。
2. 关键统计条：
   - 累计作答题数。
   - 本周学习时长。
   - 当前连续学习天数。
   - 最长连续学习天数。
   - 当前备考准备度。
3. 学习活动热力图。
4. 今日/本周下一步建议。

参考 Codex Desktop 个人主页的结构，但换成学习语义：

- `Token 活动` -> `学习活动`
- `累计 Token` -> `累计作答`
- `最长任务时长` -> `最长学习日`
- `当前连续天数` -> `当前连续学习`

### 8.2 热力图交互

热力图不是签到控件，而是反馈控件。

交互：

- 默认展示最近 365 天。
- 支持 `每日 / 每周 / 累计` 三个视图。
- 支持筛选 `全部 / 数学 / 物理 / 化学 / 模考`。
- hover 或点击某天显示当天学习详情。
- 今天未点亮时展示：`完成 1 轮训练即可点亮今天的学习记录。`
- 今天已点亮时展示：`今天已完成有效训练，继续挑战会提高今日强度。`

视觉：

- 颜色不要过度游戏化。
- 使用低饱和绿/蓝表示学习强度。
- 空白格保持安静，不制造焦虑。
- 连续学习天数展示为鼓励，不做惩罚。

### 8.3 学习曲线

个人页应有学习曲线，而不是只展示热力图。

建议图表：

- 最近 30 天正确率曲线。
- 最近 30 天训练题量柱状图。
- 掌握度平均值趋势。
- 模考分数趋势。

展示原则：

- 首屏只展示一张最关键的组合图。
- 详情可以切换：正确率、题量、用时、掌握度。
- 不要把每一个统计都做成独立卡片堆满页面。

### 8.4 学科掌握卡

数学、物理、化学分别展示：

- 平均掌握度。
- 已练题量。
- 近 7 天正确率。
- 当前薄弱 topic 数。
- 一个主动作。

主动作示例：

- 数学：`继续 5 题训练`
- 物理：`先复盘牛顿定律错题`
- 化学：`开始 20 题诊断`

### 8.5 错因模式

错题本不应只告诉用户错了哪些题，而要告诉用户反复在哪里错。

个人页可以展示：

- 最近重复错因 TOP 3。
- 本周新增错因。
- 已改善错因。
- 下次复习时间。

文案示例：

- `你最近 3 次把半径平方和半径混淆。`
- `平行直线斜率判断已连续 2 次答对，可以降低复习优先级。`
- `函数换底公式建议今天复盘 3 道。`

### 8.6 AI 学习总结

AI 总结应该作为长期反馈，不抢训练主线。

个人页 AI 区域建议：

- `本周 AI 学习总结`
- `你本周最明显的进步`
- `仍然需要处理的 1 个问题`
- `下一次训练建议`

不要展示冗长分析。推荐结构：

```text
本周你完成了 6 轮数学训练，函数题正确率从 40% 到 62%。
主要问题仍然是三角函数诱导公式，错误集中在符号判断。
下一步建议：先复盘 3 道诱导公式错题，再进入下一轮数学训练。
```

## 9. 页面信息架构

建议个人页 overview 顺序：

1. 学习身份和关键统计。
2. 下一步建议。
3. 学习活动热力图。
4. 学习曲线。
5. 学科掌握卡。
6. 错因模式。
7. AI 周总结。
8. 最近训练和模考记录。

原有短名单、学校对比、订单服务仍然保留在个人页导航里，但 overview 的主叙事应更偏学习进度。

## 10. 激励设计

激励不是简单夸奖，而是让用户知道长期投入有意义。

### 10.1 短期反馈

训练完成后：

- 答得好：强调稳定性和下一组可稍微提高难度。
- 答得一般：强调已暴露薄弱点，下一轮会更精准。
- 答得差：强调完整作答本身有价值，先修复基础点。

### 10.2 中期反馈

每周：

- 本周学习几天。
- 哪个学科最稳定。
- 哪个 topic 改善最多。
- 哪个错因仍反复出现。

### 10.3 长期反馈

每月：

- 学习活动热力图。
- 模考趋势。
- 学科掌握度变化。
- AI 生成月度复盘。

### 10.4 避免负反馈

不要这样写：

- `你已经断签。`
- `你今天还没学习。`
- `你落后了。`

建议写：

- `今天完成 1 轮训练，就能延续本周学习节奏。`
- `重新开始也会被记录为进步。`
- `本周还有 2 个薄弱点值得优先处理。`

## 11. 实现计划

### Phase 1：文档和产品定稿

目标：

- 明确学习驾驶舱不是手动打卡。
- 明确自动学习投入反馈规则。
- 明确个人页改造范围。

交付：

- 本文档。
- 和 `adaptive-training-ux-optimization.md` 对齐文案。

### Phase 2：后端聚合 MVP

目标：

- 基于现有 `CscaTrainingEvent`、adaptive round、mock attempt 聚合个人学习概览。
- 新增 `CscaLearningDailySnapshot` 和 `CscaLearningStreak`。

交付：

- migration。
- snapshot 聚合服务。
- `GET /api/v1/me/learning-dashboard`。
- 单元测试覆盖有效学习日和 streak。

### Phase 3：个人页学习驾驶舱

目标：

- 改造 `PublicMePage.tsx` overview。
- 增加关键统计、热力图、学习曲线、下一步建议。

交付：

- 学习驾驶舱首屏。
- 热力图组件。
- 学科掌握卡。
- 空状态和加载状态。

### Phase 4：错因模式和 AI 周报

目标：

- 建立错因模式聚合。
- 缓存 AI 周报，避免重复消耗额度。

交付：

- `CscaWrongPattern`。
- `CscaLearningInsight`。
- 周报生成服务。
- 个人页 AI 总结卡。

### Phase 5：模考联动

目标：

- 模考完成后进入同一学习驾驶舱。
- 用模考结果更新弱点、趋势和下一步建议。

交付：

- mock attempt 事件化。
- 模考分数趋势。
- 模考后推荐下一轮科目训练。

当前 MVP 不新增模考趋势表，直接从已提交的 `MockExamAttempt` 读取最近 6 次记录，生成 `mockTrend`：最近一次模考、最近分数趋势、按学科聚合的平均分/未答数，以及回到薄弱科目训练的 CTA。后续如果要展示更精细的 topic 变化，可再把模考题目映射和知识点统计固化到趋势快照。

## 12. 风险和边界

### 12.1 数据可信度

如果只靠页面访问和点击，很容易把“浏览”误判为学习。

规避：

- 点亮规则必须以完成训练、完成模考、复盘错题为主。
- AI 解析浏览只作为辅助信号。

### 12.2 用户焦虑

连续学习和热力图容易制造压力。

规避：

- 不使用惩罚性文案。
- 不做断签羞辱。
- 用“重新开始也算进步”的语气。

### 12.3 性能

个人页如果每次实时扫所有 round、attempt 和 event，会变慢。

规避：

- 原始事件保留。
- 每日 snapshot 预聚合。
- 个人页默认读 snapshot 和最近少量事件。

### 12.4 AI 成本

AI 周报如果每次打开都生成，会消耗不可控。

规避：

- 周报缓存。
- 低活跃用户用规则总结。
- 真实 LLM 只在有足够学习证据时调用。

### 12.5 产品边界

学习驾驶舱不是新的训练入口，也不是新的营销页。

它应该服务于：

- 个人页长期反馈。
- 科目训练下一步建议。
- 模考后的回流训练。
- AI Coach 长期价值证明。

## 13. 成熟度评估

当前方案已经具备可执行性：

- 产品语义清楚：不是打卡，是自动学习投入反馈。
- 数据来源清楚：现有 adaptive、mock、AI interaction、training event 可复用。
- 需要新增的表清楚：每日快照、连续学习、AI 洞察、错因模式。
- API 边界清楚：个人学习驾驶舱统一查询。
- 前端落点清楚：改造 `/me` overview，而不是新建孤立页面。
- 风险边界清楚：避免用户焦虑、避免重复 AI 消耗、避免浏览行为误判学习。

建议下一步进入 Phase 2：先做后端学习快照和 dashboard API MVP，再改造个人页。这样前端不会先做假数据，也能保证学习热力图和趋势图来自真实行为。

## 14. MVP 实施范围

### 14.1 第一版要解决的问题

学习驾驶舱 MVP 只解决一个核心问题：

> 用户进入个人页后，能立刻看见自己最近的真实学习投入、连续学习情况、学习趋势和下一步建议。

第一版不追求完整 BI，不追求所有 AI 洞察，也不追求一次性把错题本、模考、科目训练全部做成复杂图谱。

### 14.2 MVP 必做

第一版必须包含：

1. 个人页 overview 顶部学习统计。
2. 自动学习热力图。
3. 当前连续学习天数和最长连续学习天数。
4. 最近 30 天学习趋势。
5. 数学、物理、化学学科掌握卡。
6. 一个明确的下一步建议。
7. 新用户空状态。
8. dashboard API 失败时的降级展示。

### 14.3 MVP 暂不做

第一版暂不做：

- AI 周报自动生成。
- 月度学习报告。
- 复杂错因模式聚类。
- 错题间隔复习队列。
- 模考完整趋势分析。
- 机构/班级排行榜。
- 手动补签。
- 积分、徽章、任务墙。

这些能力可以后续接入，但不能拖慢第一版个人页学习反馈闭环。

### 14.4 第一版页面目标

用户打开 `/me` overview，应该在 5 秒内理解：

- 我这周有没有练。
- 我连续练了几天。
- 最近正确率和题量有没有变化。
- 哪个学科最需要处理。
- 现在最应该点哪个按钮继续学习。

## 15. 第一阶段数据结构

### 15.1 第一阶段只新增两张表

为了控制复杂度，第一阶段只新增：

1. `CscaLearningDailySnapshot`
2. `CscaLearningStreak`

`CscaLearningInsight` 和 `CscaWrongPattern` 放到第二阶段。第一版可以用现有 mastery、round item、mock attempt 和 training event 生成弱点和建议。

### 15.2 `CscaLearningDailySnapshot` 第一版字段

第一版字段建议：

```prisma
model CscaLearningDailySnapshot {
  id                 Int      @id @default(autoincrement())
  userId             Int      @map("user_id")
  localDate          DateTime @map("local_date")
  timezone           String   @default("Asia/Shanghai") @db.VarChar(60)
  subject            String?  @db.VarChar(60)
  activeScore        Int      @default(0) @map("active_score")
  answeredCount      Int      @default(0) @map("answered_count")
  correctCount       Int      @default(0) @map("correct_count")
  wrongCount         Int      @default(0) @map("wrong_count")
  unansweredCount    Int      @default(0) @map("unanswered_count")
  practiceSeconds    Int      @default(0) @map("practice_seconds")
  mockSeconds        Int      @default(0) @map("mock_seconds")
  aiInteractionCount Int      @default(0) @map("ai_interaction_count")
  masteryAvg         Float?   @map("mastery_avg")
  isStreakEligible   Boolean  @default(false) @map("is_streak_eligible")
  createdAt          DateTime @default(now()) @map("created_at")
  updatedAt          DateTime @updatedAt @map("updated_at")

  @@unique([userId, localDate, subject], map: "uq_csca_learning_daily_user_date_subject")
  @@index([userId, localDate], map: "idx_csca_learning_daily_user_date")
  @@map("csca_learning_daily_snapshots")
}
```

说明：

- `subject = null` 表示全科汇总。
- `subject = math/physics/chemistry` 表示单科汇总。
- 前端热力图默认使用全科汇总。
- 学科卡使用单科汇总和 `UserCscaTopicMastery`。

### 15.3 `CscaLearningStreak` 第一版字段

```prisma
model CscaLearningStreak {
  id                Int       @id @default(autoincrement())
  userId            Int       @unique @map("user_id")
  currentStreakDays Int       @default(0) @map("current_streak_days")
  longestStreakDays Int       @default(0) @map("longest_streak_days")
  lastEligibleDate  DateTime? @map("last_eligible_date")
  createdAt         DateTime  @default(now()) @map("created_at")
  updatedAt         DateTime  @updatedAt @map("updated_at")

  @@map("csca_learning_streaks")
}
```

### 15.4 聚合触发时机

第一版不需要做复杂异步任务系统，可以先在关键行为完成后同步或近同步更新快照：

- adaptive round 提交成功后。
- diagnostic round 提交成功后。
- mock exam attempt 提交成功后。
- AI explanation feedback 提交后，只更新 `aiInteractionCount`，不单独点亮 streak。

后续如果流量变大，再改为 event outbox 或定时聚合任务。

### 15.5 有效学习日判断

第一版规则：

- 完成 1 轮 5 题训练：有效。
- 完成 20 题诊断：有效。
- 完成 48 题模考：有效。
- 仅查看报告：无效。
- 仅查看 AI 解析：无效。
- 仅登录或浏览页面：无效。

## 16. 第一阶段接口契约

### 16.1 Dashboard API

新增：

`GET /api/v1/me/learning-dashboard`

第一版返回：

```ts
type LearningDashboardMvpResponse = {
  summary: {
    totalAnswered: number;
    totalCorrect: number;
    accuracy: number | null;
    practiceMinutesThisWeek: number;
    currentStreakDays: number;
    longestStreakDays: number;
    activeDaysLast30: number;
  };
  heatmap: Array<{
    date: string;
    level: 0 | 1 | 2 | 3 | 4;
    answeredCount: number;
    practiceMinutes: number;
    accuracy: number | null;
    isStreakEligible: boolean;
  }>;
  trend: Array<{
    date: string;
    answeredCount: number;
    accuracy: number | null;
    practiceMinutes: number;
  }>;
  subjects: Array<{
    subject: 'math' | 'physics' | 'chemistry';
    label: string;
    masteryAvg: number | null;
    answeredCount: number;
    accuracy: number | null;
    weakTopicCount: number;
    href: string;
  }>;
  nextAction: {
    title: string;
    body: string;
    ctaLabel: string;
    href: string;
  } | null;
};
```

### 16.2 返回数据规则

`summary`：

- `totalAnswered` 来自全量 daily snapshot 或现有 round/mock 数据回填。
- `practiceMinutesThisWeek` 使用本周全科 snapshot。
- `activeDaysLast30` 使用最近 30 天 `isStreakEligible = true` 的天数。

`heatmap`：

- 默认返回最近 365 天。
- 没有数据的日期也返回，level 为 0，方便前端稳定渲染。

`trend`：

- 默认返回最近 30 天。
- 用于个人页首屏曲线。

`subjects`：

- 三个学科固定返回，即使没有数据也返回空状态。
- `href` 指向 `/csca-subjects/:subject`。

`nextAction`：

- 有未完成 adaptive round：继续未完成训练。
- 未完成诊断：开始本科目诊断。
- 有明显弱学科：进入该学科训练。
- 无学习记录：从数学诊断开始。
- 全部稳定：建议进入模拟题。

### 16.3 失败降级

如果 dashboard API 失败：

- 个人页 overview 不能整体崩溃。
- 保留账号资料、短名单、订单等原有模块。
- 学习驾驶舱区域展示轻量错误态：`学习数据暂时无法加载，稍后再试。`

## 17. 个人页 MVP 布局

### 17.1 首屏结构

`/me` overview 首屏建议：

1. 个人资料区。
2. 学习统计条。
3. 下一步建议卡。
4. 学习活动热力图。
5. 最近 30 天趋势图。
6. 学科掌握卡。

原有短名单、学校对比、订单入口继续保留，但不抢学习驾驶舱首屏主线。

### 17.2 统计条

统计条展示：

- 累计作答。
- 当前连续学习。
- 最长连续学习。
- 本周学习时长。
- 最近 30 天有效学习天数。

不要展示内部字段名，例如 activeScore、snapshot、streak eligible。

### 17.3 下一步建议卡

下一步建议卡必须只有一个主按钮。

示例：

```text
继续完成数学训练
你还有一轮数学训练未完成，完成后系统会更新掌握度和下一轮推荐。
[继续训练]
```

或者：

```text
先完成数学诊断
你还没有本科目的初始诊断，完成 20 题后系统才能准确推荐训练。
[开始诊断]
```

### 17.4 学习热力图

第一版热力图只需要：

- 最近 365 天。
- 5 档强度。
- hover title 或点击显示简短详情。

简短详情：

- 日期。
- 作答题数。
- 正确率。
- 学习时长。
- 是否有效学习日。

### 17.5 学习趋势图

第一版趋势图可以先做简单组合：

- 柱状：每日作答题数。
- 折线：每日正确率。

如果当前图表库不足，可以先用轻量 CSS bar + SVG polyline，后续再换图表库。不要为了图表引入大型依赖。

### 17.6 学科掌握卡

三张卡固定展示：

- 数学。
- 物理。
- 化学。

每张卡展示：

- 掌握度。
- 近 30 天作答数。
- 正确率。
- 薄弱知识点数。
- 主按钮：进入本科目。

### 17.7 空状态

新用户没有任何学习记录时：

- 不展示空白热力图作为主视觉。
- 展示温和引导：`完成一次 20 题诊断后，这里会自动生成你的学习轨迹。`
- 主按钮：`开始数学诊断`。

## 18. 验收标准

### 18.1 数据验收

必须满足：

1. 用户完成一轮 5 题训练后，当天全科 snapshot 增加 answered/correct/wrong/practiceSeconds。
2. 用户完成一轮训练后，当天热力图 level 大于 0。
3. 用户连续两天完成有效训练后，`currentStreakDays = 2`。
4. 用户只查看 AI 解析但不完成训练，不会点亮 streak。
5. 同一 round 重复提交不会重复累计题量。
6. dashboard API 对无学习记录用户返回稳定空数据。

### 18.2 前端验收

必须满足：

1. `/me` overview 能显示学习统计条。
2. 无学习记录用户看到清晰空状态和主按钮。
3. 有学习记录用户看到热力图、趋势和学科卡。
4. Dashboard API 失败时，个人页其他模块仍可用。
5. 移动端不横向溢出。
6. 热力图格子、统计卡和按钮文字不重叠。

### 18.3 产品验收

必须满足：

1. 页面不出现“点击打卡”。
2. 页面文案表达“学习投入自动记录”。
3. 下一步建议只有一个主动作。
4. 不用惩罚性文案制造焦虑。
5. 不把 AI 包装成判题者或 mastery 决策者。

### 18.4 技术验收

建议运行：

- Prisma migration 检查。
- 后端 dashboard service 单元测试。
- `npm run csca-adaptive:rules` 和 `npm run csca-learning:rules`，分别覆盖自适应训练规则、学习驾驶舱快照优先、历史兜底和统计聚合规则。
- 前端 build。
- 个人页路由 smoke。
- 浏览器桌面和移动端检查。

第一阶段完成后，再进入第二阶段：AI 周报、错因模式、模考趋势和更完整的长期学习洞察。

## 19. 当前实现状态

### 19.1 已完成

当前分支已经完成学习驾驶舱 MVP 的主体工程：

1. 新增 `CscaLearningDailySnapshot` 和 `CscaLearningStreak`。
2. 科目训练提交后自动记录学习活动。
3. 模考提交后自动记录学习活动。
4. 新增 `/api/v1/me/learning-dashboard`。
5. 个人页 overview 展示居中的用户信息、CSCA 学习统计、学习活动热力图、近 30 天趋势、学科掌握卡和下一步建议。
6. 热力图按最近 365 天展示，视觉接近 GitHub/Codex 的活动网格。
7. 当用户没有新快照数据时，dashboard 会只读聚合历史训练轮次和模考提交记录，避免老用户页面显示为 0。
8. 学习活动热力图的切换收敛为真实统计尺度：`天 / 周 / 月`。天视图展示每日连续性，周视图聚合每周投入，月视图聚合阶段性训练量，避免多个按钮显示同一套数据。
9. 自适应训练规则测试和学习驾驶舱规则测试已加入 `verify:local`，本地综合验证会自动覆盖训练规则、dashboard 快照路径和历史兜底路径。
10. 第二阶段的学习总结已从“AI 周报”收口为规则优先的 `learningSummary`：dashboard API 返回规则生成的学习总结，个人页直接展示，不要求用户点击生成，也不会在打开页面时消耗 LLM。
11. 旧 `POST /api/v1/me/learning-dashboard/insights/weekly` 仅保留兼容：返回当前规则总结，不再调用外部 provider，不再扣用户 AI 额度。
12. 学习行为完成后只更新学习快照、错因、模考趋势和准备度证据；个人页总结随 dashboard 数据自然更新，不自动触发 LLM。未来若启用 LLM polish，也必须作为平台免费表达增强，不进入用户额度账本。
13. 错因模式基础版已落地：新增 `CscaWrongPattern`，科目训练和模考提交后会自动聚合错因类型、重复次数、最近错题和下次复习时间。
14. dashboard API 已返回 `wrongPatterns` 摘要，个人页学习驾驶舱展示最近最需要处理的 TOP 3 错因模式，并提供回到对应科目训练的入口。
15. 学习驾驶舱规则测试已覆盖错因模式的累加和 dashboard 暴露路径。
16. 模考趋势基础版已落地：dashboard API 返回 `mockTrend`，包含最近一次模考、最近 6 次分数趋势、按学科聚合的平均分和未答数。
17. 个人页学习驾驶舱已展示模考趋势卡，并给出“模考后回到薄弱科目训练”的回流建议。
18. 学习驾驶舱规则测试已覆盖模考趋势和科目训练回流建议。
19. 错因状态流转 MVP 已落地。

### 19.2 历史数据兜底边界

历史兜底只在用户完全没有 `CscaLearningDailySnapshot` 且总作答数为 0 时启用。

这样做的原因是：

- 不在打开个人页时反复写库。
- 不和新快照流水重复累计。
- 能让旧训练数据在个人页先可见。

后续如果要把旧数据永久迁移进快照表，应单独做一个一次性 backfill 脚本，并记录迁移版本，避免重复入账。

### 19.3 待继续

下一阶段建议优先做：

1. 停掉本地后端进程后重新运行 Prisma generate，确保新增 `CscaLearningInsight` 和 `CscaWrongPattern` client 在干净环境生成。
2. 继续打磨错因详情页是否需要独立展开，以及 `resolved` 错因是否要进入历史复盘入口。
3. 深化模考薄弱模块变化：把模考题的 topic 映射统计进报告和 dashboard，让用户看到哪些知识点在连续模考中改善或恶化。
4. 后续如需更稳定的异步执行，可把当前同步尝试生成升级为队列或定时任务。

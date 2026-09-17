# CSCA Adaptive AI Questioning Plan

> 2026-06-06 路由与产品语义更新：本文早期段落曾讨论把 `csca-special-practice` 改造成用户侧“科目练习”入口，并保留旧 topic/session/report 路由兼容。当前最终决策已经调整为：不新增顶层“科目练习”或“自适应训练”入口，普通用户从现有 `/csca-subjects/:subject` 科目页进入诊断和练习；训练轮和报告使用 `/csca-subjects/:subject/practice/rounds/:id`；旧 `/csca-special-practice` 普通用户路由不再兼容。后端 `/api/v1/csca-special-practice/adaptive/...` 暂时保留为内部 API namespace，不代表用户侧仍有同名页面。

## 目标

CSCAlite 要做的不是一个简单的 AI 出题入口，也不是新增一个和科目练习、模拟题并列的“自适应训练”产品，而是把现有 CSCA 备考场景智能化。系统需要根据用户的作答表现，动态影响科目练习和模拟题的知识点、难度、题型、复盘和下一步建议；AI 只负责在明确约束下生成或改写内容，不能直接替代考试范围、难度策略和质量审核。

核心目标：

- 题目必须符合 CSCA 当前考试范围，至少覆盖数学、物理、化学三个已上线科目。
- 难度必须分批次、可解释、可校验，不能只依赖模型自称“简单/中等/困难”。
- 用户训练必须自适应：根据正确率、近期表现、耗时、错题知识点和稳定性，动态组下一轮小批次题。
- AI 生成内容必须有护栏：生成前有蓝图，生成后有自动审题、规则校验、去重和状态管理。
- 第一阶段以安全落地为主，不影响现有固定模考、专项练习、真题资料和发布流程。

> 2026-06-10 决策补充：官方考纲应作为题库建设的最高约束，授权真题只作为题型、难度、风格和分布校准材料，不能作为 AI 直接改写模板。AI 生成题必须是基于考纲和 blueprint 的原创候选题，经过相似度检查、Validator、Reviewer 和人工审核后才能发布。详见 `docs/csca-syllabus-past-paper-ai-questioning-architecture.md`。

## 用户需求

用户明确要求：

- 符合 CSCA 考试范围。
- 难度分批次。
- 明确实现形式和架构。
- 训练方式必须自适应，而不是单纯按知识点批量生成题。
- 在独立本地分支开发，不影响之前的主线。
- 文档需要说明需求、边界、方案、执行计划，以及和当前项目结构的关系。

## 范围边界

### 本阶段要做

- 改造现有科目学习页，让用户在数学、物理、化学页面内直接进入诊断和智能练习；自适应只作为底层能力。
- 后续改造模拟题/模考，让模拟题也使用同一套掌握度、错题、曝光和推荐能力。
- 复用现有 CSCA 科目体系：`math`、`physics`、`chemistry`。
- 复用现有题目形态：单项选择题、A-D 四个选项、答案、解析、知识点标签。
- 建立 CSCA 考纲蓝图，作为 AI 出题和自适应规划的基础数据。
- 建立用户知识点掌握度模型。
- 建立小批次自适应组题逻辑。
- 建立 AI 生成题目的审核和入库策略。
- 先让 AI 生成内容进入草稿或临时练习，不直接污染正式题库。

### 本阶段不做

- 不改动现有固定模拟卷的语义和数据结构。
- 不让 AI 无约束实时生成正式考试题。
- 不把 AI 生成题直接发布为正式题库。
- 不追求第一版就使用复杂机器学习算法。
- 不直接替代人工审核，尤其是正式题库发布前。
- 不处理支付、会员、额度计费等商业策略，除非后续单独设计。

## 当前项目结构关系

CSCAlite 当前已经有完整的 CSCA 备考基础，但它偏向固定资源和固定练习。自适应不应再做成一个和科目学习、模拟题平级的新产品，而应成为底层 `Adaptive Engine`：先把诊断和智能练习并入当前 `csca-subjects` 科目页，再逐步改造模拟题/模考的组卷和复盘。用户最终理解的是“在科目里练”和“做模拟题”，不是额外多一个“自适应训练”入口。

### 现有后端结构

- `backend/src/csca-mock-exam`
  - 当前负责完整 CBT 风格模拟卷。
  - 已有套卷、题目、attempt、报告、后台导入和发布能力。
  - 数据模型是 `MockExamPaper`、`MockExamQuestion`、`MockExamAttempt`。
  - 适合继续承担“完整模拟卷”和“仿真考试”。
  - 不建议在这里直接加入自适应逻辑，否则会混淆固定套卷和动态训练。

- `backend/src/csca-special-practice`
  - 当前负责按 topic 的专项练习题库和 adaptive API。
  - 已有 topic、question、session、report、后台导入和发布能力。
  - 数据模型是 `SpecialPracticeTopic`、`SpecialPracticeQuestion`、`SpecialPracticeSession`。
  - 和自适应训练关系很近，可以复用题目结构和知识点标签思路。
  - 改造后它应成为内部题库/训练能力 namespace；topic 只作为系统调度、题库组织和后台管理单位，不再作为用户主动选择入口。

- `backend/prisma/schema.prisma`
  - 已有用户、模考、专项练习、真题资料、支付、学校等核心表。
  - `User` 已关联 `mockExamAttempts` 和 `specialPracticeSessions`。
  - 自适应训练需要新增 user-level mastery/session/job 表，并挂到 `User`。

- `backend/src/admin-audit`
  - 已有后台审计记录。
  - AI 生成、审核、人工发布等管理行为应该复用审计机制。

### 现有前端结构

- `frontend/src/pages/CscaMockExamPage.tsx`
  - 当前负责 `/csca-mock-exam` 相关页面。
  - 包含科目入口、套卷入口、答题页、报告页。
  - 报告里已经按 `knowledgeStats` 识别薄弱知识点，这是自适应训练的自然入口。

- `frontend/src/lib/api-mock-exam.ts`
  - 当前封装固定模考 API。
  - 模考后续也应接入 `Adaptive Engine`：模考报告既能更新掌握度，也能生成弱项卷、复测卷和下一套智能模拟卷。

- `frontend/src/lib/api-special-practice.ts`
  - 当前封装专项练习 API。
  - 改造后继续作为训练入口 API，可扩展 adaptive 相关请求，避免再造平级的前端业务入口。

- `frontend/src/content/csca-exam.ts`
  - 当前维护 CSCA 考试安排、科目、考试时长、题量、基础考纲信息。
  - 自适应模块可以参考这里的科目范围，但需要更细的考纲蓝图。

- `frontend/src/content/localized/csca-subjects.ts`
  - 当前维护 CSCA 科目和资源标签的本地化。
  - 自适应训练的知识点标签和科目文案应尽量复用或扩展这里。

### 建议改造模块

后端：

- `backend/src/csca-special-practice`
  - 继续作为题库和 adaptive API 的内部后端命名空间。
  - 新增 adaptive service/planner/mastery/question provider。
  - 旧 topic/session/report 能力只用于后台预览、数据迁移或必要的管理动作；普通用户侧不再兼容旧 `/csca-special-practice` 路由。

- `backend/src/ai-questioning`
  - AI 生成、AI 审题、prompt builder、schema validator、provider adapter。
  - 如果后续还有其它 AI 能力，可以独立复用。

前端：

- `frontend/src/pages/CscaSubjectPage.tsx`
  - 从“科目学习页”升级为本科目学习、诊断和智能练习入口。
  - 展示诊断/继续练习按钮、掌握度、可用题量、登录状态和下一轮说明。
- `frontend/src/pages/CscaSpecialPracticePage.tsx`
  - 不再作为普通用户入口；仅作为旧组件、可视化工具和后台预览复用层。

- `frontend/src/lib/api-special-practice.ts`
  - 扩展 adaptive API 封装，保留现有专项 API。

样式新增：

- 可复用 `frontend/src/styles/mock-exam.css` 和 `practice.css` 的答题布局。
- 科目页内练习面板使用 `frontend/src/styles/subject-learning.css`。
- 答题轮、报告和旧复用组件继续使用 `frontend/src/styles/special-practice.css`，避免破坏现有 topic/session 样式。

## 产品方案

### 架构原则

自适应系统是核心，AI 不只是一条后台题目供应链，还应该是用户训练体验里的教练层。

推荐总架构：

```text
Adaptive Engine：决定练什么
Question Bank：提供可靠题目
AI Coach：解释为什么、错在哪里、下一步怎么练
AI Planner Assistant：辅助总结错因和优化计划
AI Generator：后台补题和变式
AI Reviewer：审题、查超纲、查多答案、查难度
```

落地顺序应该是：

```text
bank-first adaptive
-> AI Coach
-> AI Planner Assistant
-> AI 变式题
-> AI 后台补题库
-> 低风险即时 AI 生成
```

第一版即使不接 AI，也应该能根据用户表现动态组题。但更好的 AI 融入方式不是只让它异步出题，而是把 AI 分为同步、半同步、异步三类能力：

- 同步 AI：实时讲解、提示、错因解释、训练反馈，直接提升用户体验。
- 半同步 AI：辅助 Planner 总结用户表现、识别错因、解释训练计划，但最终由系统规则落地。
- 异步 AI：生成题目、审题、补题库、生成变式，保持质量审核和成本控制。

AI 不能直接掌控评分、正式题库发布和最终训练计划，但可以让系统更会解释、更会陪练、更会把用户的错误转成下一步行动。

### 用户体验

入口可以放在模考报告页和备考首页：

- 模考报告页：根据这次错题，进入弱项科目练习或生成复测卷。
- CSCA 备考页：直接进入“科目练习”。
- 历史 topic 报告页：针对旧记录中的薄弱点进入下一轮科目练习。

自适应训练采用小批次，不做一次性大卷：

```text
开始训练
-> 系统生成 5 道题
-> 用户完成
-> 系统更新掌握度
-> 展示本轮诊断
-> 系统推荐下一轮 5 道题
```

每轮题目建议构成：

- 2 道薄弱知识点。
- 1 道近期错过但有改善迹象的知识点。
- 1 道已掌握知识点的间隔复习。
- 1 道综合应用或挑战题。

本轮结束后要给用户解释下一轮为什么这样安排，例如：

```text
下一轮安排：
- 函数 2 题：你最近 3 次在该模块正确率低于 50%。
- 电磁学 1 题：上次答对但耗时偏长。
- 几何 1 题：7 天未复习。
- 综合题 1 题：当前数学掌握度达到 0.72，开始加入 L3 题。
```

这类解释是自适应训练的关键体验。用户需要看到系统不是随机推题，而是在根据他的表现调度训练。

### 前端交互方案

基于当前前端结构，自适应能力不应做成新的营销页，而应改造现有练习和模考入口。当前项目已经有：

- `frontend/src/lib/routes.ts`：集中维护 route 常量。
- `frontend/src/components/AppRouteRenderer.tsx`：按 route lazy-load 页面。
- `frontend/src/lib/api-types.ts`：集中定义 API 类型。
- `frontend/src/lib/api-mock-exam.ts` 和 `frontend/src/lib/api-special-practice.ts`：按业务模块封装请求。
- `frontend/src/pages/CscaMockExamPage.tsx`：已有完整模考答题页、题号导航、报告页、知识点统计。
- `frontend/src/pages/CscaSpecialPracticePage.tsx`：已有专项练习入口、topic/session/report 形态。
- `frontend/src/styles/mock-exam.css` 和 `frontend/src/styles/special-practice.css`：已有 CSCA 训练相关的页面节奏、按钮、状态面板、报告布局。

建议改造：

```text
frontend/src/pages/CscaSubjectPage.tsx
frontend/src/pages/special-practice/adaptive/AdaptivePracticeViews.tsx
frontend/src/lib/api-special-practice.ts
frontend/src/styles/subject-learning.css
frontend/src/styles/special-practice.css
```

并在现有文件中接入：

```text
routes.cscaSubjects 保持 '/csca-subjects'
AppRouteRenderer 在 csca-subjects 下分发科目页、训练轮、报告和可视化工具
preloadRouteChunk 对 /csca-subjects/:subject/practice/rounds/:id 预加载 AdaptivePracticeViews
buildPrimaryNavItems 不新增“科目练习/自适应训练”顶层项，继续从“科目学习”进入
api-types.ts 增加 AdaptivePractice 类型
styles.css 继续 import special-practice.css
```

#### 页面结构

自适应训练应并入当前 `CscaSubjectPage` 科目页，并由 `AppRouteRenderer` 在科目路由下分发训练轮和报告：

```text
/csca-subjects
  -> CscaSubjectIndex / default subject landing

/csca-subjects/:subject
  -> CscaSubjectPage
     页面内展示本科目学习内容、资料入口和智能练习面板
     如果用户未完成该学科诊断，则只显示 20 题诊断入口

/csca-subjects/:subject/practice/rounds/:id
  -> AdaptiveRoundView

/csca-subjects/:subject/practice/rounds/:id/report
  -> RoundReportView

/csca-subjects/:subject/visualize/...
  -> subject visualizer views
```

旧 `/csca-special-practice` 普通用户路由不再兼容。后端 API namespace 可以暂时保留 `/api/v1/csca-special-practice/adaptive/...`，但这只是内部命名。

科目页组件签名建议保持和现有页面一致：

```tsx
export function CscaSubjectPage({
  subject,
  currentUser,
  onNavigate
}: {
  subject: SubjectKey;
  currentUser: User | null;
  onNavigate: (path: string) => void;
}) {
  // 在科目页内展示学习内容、诊断入口、继续练习和掌握度概览
}
```

#### Overview 首屏

首屏应该直接给用户行动入口，而不是解释 AI 有多强。用户最终只看到“科目练习”，不是“专项练习”和“自适应训练”两个并列产品。推荐三入口：

```text
开始诊断
根据最近模考训练
强化我的错题
```

状态面板展示：

- 最近训练科目。
- 当前最薄弱 topic。
- 今日建议训练时长。
- 上次训练后的下一轮计划。
- 三个学科的训练状态：数学、物理、化学。

如果用户未登录：

- 可以允许体验诊断或展示 preview。
- 保存长期 mastery、历史报告和错题强化时引导登录。
- 沿用当前 `onAuthRedirect`/`currentUser` 模式，不在页面内另造认证流程。

#### Diagnostic 诊断

诊断页用于新用户冷启动，不应像完整模考那样强调分数。交互重点：

- 20 题。
- 顶部显示“正在定位你的 CSCA 基础”。
- 只按学科进入，混合覆盖多个核心 topic、题型和难度。
- 题目页复用训练题面布局，但不显示过强的考试压力。
- 完成后进入“诊断结果”，初始化 mastery。

诊断完成页展示三类结果：

```text
稳定项
不稳定项
薄弱项
```

用户主按钮：

```text
开始第一轮自适应训练
```

#### SubjectAdaptiveDashboard 学科训练页

用户只选择学科，不选择 topic。因此 `/csca-subjects/:subject` 科目页内应包含智能练习面板：

```text
数学智能练习
当前建议：函数 L2 + 几何复习 + 概率基础
按钮：开始下一轮数学训练
```

页面布局：

- 顶部：保留原科目学习内容和考试摘要。
- 练习面板：当前掌握度、下一轮建议、开始诊断/继续练习按钮。
- 次级区：本学科 topic 掌握度地图，只展示系统判断和推荐原因。
- 说明区：topic 是系统调度单位，用户不需要手动选择。

这样 topic 仍然存在，但不再是用户入口。用户始终通过“开始下一轮训练”进入系统安排的训练。

#### AdaptiveRound 训练页

训练页可以复用 `CscaMockExamPage` 的答题心智，但节奏更短：

- 左侧或顶部：5 题轮次进度。
- 主区：题干、A-D 选项。
- 侧区：本轮目标和 AI Coach。
- 底部：上一题、下一题、提交本轮。

每题增加两个 AI Coach 动作：

```text
提示
解释我的错误
```

交互规则：

- `提示` 是分层 reveal：第一次只给方向，第二次给关键概念，第三次给解题步骤，但仍不直接给答案。
- `解释我的错误` 只有用户已作答后可用。
- AI Coach 输出放在题目右侧或题目下方的固定解释面板里，避免弹窗打断刷题节奏。
- AI 输出需要 loading、失败和重试状态。
- AI 输出不改变题目答案、分数和 mastery。

答错后的反馈不要只显示固定解析，而应显示：

```text
你选了 C
可能错因：混淆斜率和截距
正确思路：先找到 y = kx + b 中的 b。
```

动作按钮：

```text
再练 1 道同类题
继续下一题
查看完整解析
```

`再练 1 道同类题` 不应该立即现场生成高风险新题。第一版可以让 Planner 从同 topic 题库抽一题，题库不足时再触发 AI 变式候选。

#### RoundReport 本轮报告

本轮报告是产品价值展示的核心，不应只是正确率。建议包含：

- 本轮正确/错误/未答/平均耗时。
- topic 状态变化。
- 错因标签统计。
- AI Coach 的自然语言总结。
- 下一轮安排和每项理由。

示例：

```text
本轮判断：
函数：仍不稳定，主要错因是斜率/截距混淆。
几何：保持稳定，下一轮只做复习题。
概率：7 天未复习，下一轮插入 1 道基础题。

下一轮安排：
函数 L2 变式题 2 道
几何复习题 1 道
概率基础题 1 道
综合挑战题 1 道
```

主按钮：

```text
开始下一轮训练
```

次级按钮：

```text
查看掌握度地图
回到 CSCA 准备
```

#### MasteryMap 掌握度地图

掌握度地图先做轻量，不需要复杂图表。按当前项目的信息密度和样式，建议使用科目分组和状态条：

```text
数学
- 函数：不稳定
- 几何：稳定
- 概率：薄弱

物理
- 力学：薄弱
- 电磁学：未诊断
```

每个 topic 展示：

- 状态：薄弱 / 不稳定 / 稳定 / 未诊断。
- mastery 百分比。
- 最近一次训练时间。
- 推荐动作：系统下一轮将如何处理，例如补基础 / 做变式 / 进入 L3 / 复习。

点击 topic 只展示系统判断依据、历史表现和相关概念卡，不直接开始手动 topic 训练。

#### 入口整合

当前项目已有多个自然入口，不要只依赖主导航：

- `CscaPrepPage`：入口跳到 `/csca-subjects` 或具体 `/csca-subjects/:subject`。
- `CscaMockExamPage` 的 report：根据 `knowledgeStats` 增加“用这些薄弱点训练”，跳回对应科目页练习面板。
- 旧 topic/report 数据如仍需处理，应走后台预览或迁移，不保留普通用户旧路由兼容。
- `PublicMePage`：在学习记录里增加“继续训练”。
- 主导航：不新增训练顶层项，继续从“科目学习”进入数学、物理、化学。

#### 前端状态和类型

建议在 `api-types.ts` 中增加：

```ts
export type AdaptivePracticeOverview = {
  recommendedMode: 'diagnostic' | 'continue' | 'weak-topic';
  subjects: Array<{ subject: MockExamSubjectId; mastery: number; status: string }>;
  weakestTopics: Array<{ topicId: string; title: string; subject: MockExamSubjectId; mastery: number }>;
  activeSession?: AdaptivePracticeSession;
};

export type AdaptivePracticeQuestion = MockExamQuestion & {
  topicId: string;
  difficulty: 'L1' | 'L2' | 'L3' | 'L4';
  knowledgeTags: string[];
  misconceptionTags?: string[];
};

export type AdaptiveCoachResponse = {
  title: string;
  body: string;
  steps?: string[];
  misconceptionTags?: string[];
  nextAction?: string;
};
```

`api-special-practice.ts` 在现有 request 模式上扩展：

```text
getAdaptiveOverview()
createAdaptiveDiagnostic()
createAdaptiveSession()
getAdaptiveSession()
patchAdaptiveRound()
submitAdaptiveRound()
getAdaptiveHint()
getAdaptiveExplanation()
getAdaptiveCoachSummary()
```

#### 样式策略

不要新增完全独立的 `adaptive-practice.css`。建议继续改造 `special-practice.css`：

- 复用 `page-stack brand-page` 的页面骨架。
- 复用 `mock-exam-page` 的答题和报告节奏。
- 复用 `special-practice-page` 的专项 topic 状态表达。
- 新增 `special-adaptive-*` 类名，避免改坏旧 topic/session 样式。
- 主色不要做成单一 AI 紫色。当前品牌已有 orange/blue/green 等变量，自适应页可以用更克制的工作型界面。
- AI Coach 面板要像训练辅助控件，不要像聊天窗口占满页面。

#### 用户觉得“值”的关键

前端最能产生价值感的不是“AI 生成题”，而是这三个体验闭环：

```text
错因解释 -> 同类强化 -> 下一轮理由
```

每次用户答错，系统应立刻告诉他：

- 你错在哪里。
- 这类错误属于哪个知识点或错因。
- 现在该做什么。

每轮结束，系统应立刻告诉他：

- 哪些 topic 变稳了。
- 哪些 topic 还不稳定。
- 下一轮为什么这么排。

#### 训练停止和休息策略

自适应训练不能无限推下一轮。系统需要知道什么时候继续、什么时候降级、什么时候建议休息或切换模考。

建议规则：

- 连续 3 轮正确率下降：建议休息或回到基础概念卡。
- 单轮平均耗时显著过长：下一轮降低难度或减少综合题。
- 同一错因连续出现 2 次：插入概念卡，不继续硬刷同类题。
- 某学科 mastery 达到目标阈值：建议做一次完整模考。
- 用户连续多轮只靠提示答对：降低 mastery 增长，安排无提示复测题。

前端文案要把“停止”包装成训练建议，而不是失败：

```text
今天这轮已经定位到主要问题。建议先看 60 秒概念卡，明天再继续 L2 变式。
```

#### 概念卡和微讲解

如果用户连续错同一类问题，只继续出题价值有限。需要在训练流中插入概念卡：

```text
你连续 2 次混淆斜率和截距。
先看 60 秒概念卡，再做 1 道变式题。
```

概念卡来源：

- 优先复用现有科目学习内容。
- 根据 `CscaExamTopic` 的 overview/focusItems 生成短卡片。
- AI Coach 可把长解析压缩成“60 秒说明”。
- 管理后台可审核和固化高频概念卡。

概念卡不应变成大段文章，建议结构：

```text
一句话定义
常见混淆点
一个小例子
马上练一道
```

### 冷启动诊断

新用户没有历史数据时，不应该直接进入 5 题自适应小轮次。建议第一轮使用诊断模式：

- 每个科目先做 20 道诊断题。
- 覆盖本科目的多个核心模块，不让用户按专题手动选择。
- 难度覆盖基础、中等、较难和挑战，用于更稳定地识别真实水平。
- 诊断完成后初始化 `UserCscaTopicMastery`。
- 如果用户来自模考报告页或历史 topic 报告页，可以跳过通用诊断，直接以报告中的薄弱知识点初始化训练计划。

诊断不是正式模考，不强调分数，而强调定位：

```text
基础稳定项
边缘项
薄弱项
耗时异常项
建议下一轮训练重点
```

### 自适应原则

系统决定练什么，AI 决定怎么把题写出来。

也就是说：

- Adaptive Planner 决定科目、知识点、难度、题型、题量。
- AI Planner Assistant 可以辅助总结错因和解释计划，但不能越过系统规则。
- Question Provider 优先从正式题库抽题。
- 当题库不足、需要变式、需要同类但不重复的新题时，才调用 AI Generator。
- AI Generator 必须按 blueprint 输出结构化 JSON。
- AI Coach 可以同步参与讲解、提示和反馈，不直接改答案和评分。
- AI Reviewer 和 Validator 决定这道题能否进入练习流。

### AI 融入形态

#### 同步 AI Coach

同步 AI 参与用户正在进行的训练，但只做低风险输出：

- 用户答错后，基于用户选择的错误选项生成个性化讲解。
- 用户卡住时，生成逐步提示，不直接给答案。
- 用户提交一轮后，把统计数据转成自然语言诊断。
- 解释下一轮为什么这样安排。
- 把固定解析改写成更通俗或多语言解释。
- 针对用户错因给出 1-2 个短练习建议。

同步 AI 不负责：

- 改题目答案。
- 判定用户作答是否正确。
- 发布题目。
- 绕过题库和 Planner 直接生成下一轮。

同步 AI 可以依赖当前题目的结构化上下文：

```json
{
  "questionId": 123,
  "topicId": "physics.mechanics.force",
  "prompt": "...",
  "options": [],
  "correctAnswer": "B",
  "userAnswer": "C",
  "explanation": "...",
  "misconceptionTags": ["formula-condition-confusion"],
  "userMastery": 0.46,
  "secondsSpent": 94
}
```

#### 半同步 AI Planner Assistant

半同步 AI 参与下一轮计划的解释和微调，但不独裁。推荐流程：

```text
MasteryEngine 计算掌握度
-> AdaptivePlanner 生成候选计划
-> AI Planner Assistant 总结错因和提出建议
-> Rule Guard 校验建议
-> AdaptivePlanner 输出最终计划
```

AI Planner Assistant 可以做：

- 总结用户本轮主要错因。
- 判断错误更像概念不会、公式条件混淆、计算粗心、读题问题还是时间压力。
- 建议 Planner 不要过早升级或需要插入复习题。
- 把机械训练计划改写成用户能理解的学习路线。

系统必须做：

- 校验 topic 是否在 CSCA 范围内。
- 校验难度升级/降级是否符合规则。
- 校验题量和题型是否符合产品约束。
- 记录 AI 建议和最终计划差异。

#### 异步 AI Generator 和 Reviewer

异步 AI 继续负责高风险内容生产：

- 后台补充低库存 topic。
- 为错题生成同类变式题。
- 审核题目是否超纲、是否多答案、难度是否偏离。
- 为每个选项生成干扰项意图和错因标签。
- 维护题库难度解释和错因标签。

异步 AI 的输出必须经过 Validator、Reviewer 和必要的人工审核，才能进入正式题库。

### 错因标签

自适应训练不能只知道用户“哪道题错了”，还要尽量知道“为什么错”。建议给每个选项绑定错因标签。

示例：

```json
{
  "optionId": "C",
  "isCorrect": false,
  "distractorIntent": "混淆公式适用条件",
  "misconceptionTags": ["formula-condition-confusion", "concept-boundary"]
}
```

用户选择 C 后，系统就能更新更细粒度的弱点：

```text
不是简单地说“力学错了”
而是说“牛顿第二定律中公式适用条件混淆”
```

错因标签来源：

- 人工录入。
- AI Generator 生成。
- AI Reviewer 校验。
- 用户真实作答数据反向修正。

错因标签用途：

- AI Coach 个性化讲解。
- Planner 更精准安排下一轮。
- 管理后台查看题目的干扰项质量。
- 后续生成同类变式题。

### AI 其它高价值用法

优先级最高的 AI 能力不是实时出题，而是把训练数据变得更可理解、更可运营。

#### AI 错因诊断

用户选错后，AI 根据题目、选项、用户答案和已有解析输出错因：

```text
你不是不会函数，而是把截距和斜率混了。
```

错因诊断用于：

- AI Coach 解释。
- mastery 更新。
- 下一轮 Planner。
- 管理后台题目质量分析。

#### AI 分层讲解

同一道题可以提供多种解释粒度：

- 超短解释：适合快速复盘。
- 分步骤解释：适合用户没看懂。
- 更简单语言解释：适合基础薄弱或非中文用户。

这比单一固定解析更有价值，也不会影响评分。

#### AI 训练总结

每轮结束生成自然语言总结：

```text
本轮你在函数题上仍不稳定，但几何已经稳定。下一轮先保留函数 L2，不急着升 L3。
```

总结必须基于系统已有统计，不允许编造用户没有做过的题或不存在的成绩。

#### AI 管理员助手

后台导入题库或审核题目时，AI 可帮助管理员：

- 检查是否超纲。
- 标 topicId。
- 标设计难度。
- 生成错因标签。
- 找重复题。
- 给出审核优先级。

这能降低运营成本，比在用户侧无限生成新题更稳。

#### AI 题库补洞扫描

定期扫描题库覆盖：

```text
数学函数 L2 可用题不足
物理电磁学 L3 错因标签缺失
化学有机 L1 题太少
```

AI 根据缺口生成草稿，进入审核队列。题库足够时，AI Generator 应减少触发。

### LLM 供给和额度架构

LLM 不建议第一版交给学校或用户自己配置。更稳的路线是：

```text
Phase 1：平台统一提供 LLM，用户购买 AI 训练额度
Phase 2：机构/学校购买额度池，分配给学生
Phase 3：企业学校可选 BYOK，自带模型配置
```

#### Phase 1: 平台统一提供

MVP 使用平台统一配置的模型 provider。用户购买的不是 token，而是产品化额度：

```text
AI Coach 解释次数
AI 提示次数
自适应训练包
错题强化包
会员内含 AI 辅导额度
```

平台统一提供的好处：

- 前端体验一致。
- Prompt、模型、审核和安全策略统一。
- 不需要学生、学校理解 API key。
- 可以统一限流、缓存、降级和成本控制。
- 可以复用当前 `commerce`、`orders`、`payments` 的支付链路。

当前 `backend/prisma/schema.prisma` 已有：

- `CartItem`
- `Order`
- `OrderItem`
- `Payment`
- `PaymentCallbackLog`

但 `CartItemType` 当前只有 `SCHOOL_SERVICE` 和 `ADVISOR_PACKAGE`。AI 额度商品不应硬塞成顾问包，而应新增商品类型和授权账本：

```text
CartItemType.AI_CREDIT_PACK
OrderItem.metadata 记录额度包详情
Payment 成功后发放 AI entitlement / credit grant
```

#### Phase 2: 机构额度池

学校、留学机构或代理商后续可以购买机构额度池。学生使用 AI Coach 时，从机构池扣除。

产品形态：

```text
机构购买 10,000 次 AI Coach 调用
机构邀请学生加入
学生训练消耗机构额度
机构后台查看使用量、学习效果和剩余额度
```

机构额度池比“学校自己配置 LLM key”更适合第二阶段，因为：

- 成本仍由平台控制。
- 模型质量仍一致。
- 学校采购和学生使用逻辑更简单。
- 更容易做销售和售后。

#### Phase 3: Enterprise BYOK

学校自带 LLM key 只适合企业版，不建议第一版做。

适用场景：

- 学校已有模型供应商和采购合同。
- 学校有数据合规要求。
- 学校希望 AI 请求走自己的额度。
- 学校要求模型请求不走平台统一 provider。

BYOK 会带来复杂度：

- API key 加密存储。
- provider adapter 差异。
- 每个学校的模型速度、成本、失败率不同。
- Prompt 和安全策略要兼容多个 provider。
- 问题排查更复杂。

因此 BYOK 应作为 `Organization` 级高级配置，并且默认关闭。

#### LLM 调用路由

所有 AI 能力都应从后端调用模型，前端不接触 provider key。

```text
Frontend
-> Adaptive API
-> AI Entitlement Service
-> AI Usage Meter
-> AI Provider Router
-> Provider Adapter
-> Model
```

调用前检查：

- 用户是否登录。
- 是否有个人额度、机构额度或免费体验额度。
- 当前能力是否需要扣额度。
- 是否命中缓存。
- 是否超过限流。

调用后记录：

- 能力类型：hint / explanation / round_summary / planner_assistant / generation / review。
- 实际 provider 和 model。
- 估算成本。
- 扣减额度。
- 失败原因和降级结果。

#### 额度扣减原则

不同 AI 能力成本和风险不同，应按能力分级，而不是统一按“请求次数”粗暴扣。

建议：

| 能力 | 是否扣额度 | 说明 |
| --- | --- | --- |
| 固定解析 | 不扣 | 题库已有内容 |
| AI 提示 | 扣少量 | 同题最多 3 次 |
| AI 解释错误 | 扣标准额度 | 用户可感知价值高 |
| 本轮总结 | 扣标准额度或会员内含 | 可缓存 |
| Planner Assistant | 平台成本，不直接展示扣费 | 可作为自适应服务成本 |
| AI 生成题 | 后台成本，不直接向用户实时扣 | 计入题库建设成本 |
| AI Reviewer | 后台成本 | 计入运营成本 |

用户看到的是“AI Coach 次数”或“训练额度”，系统内部再换算 provider token 成本。

#### 免费体验和降级

为了保证体验，AI 额度用完或模型失败时必须降级：

- 提示失败：返回固定提示或隐藏提示按钮。
- 解释失败：返回题库原解析。
- 本轮总结失败：返回规则生成总结。
- Planner Assistant 失败：AdaptivePlanner 规则照常工作。
- AI Generator 失败：QuestionProvider 用题库、相邻 topic 或较低难度兜底。

前端文案应避免暴露 provider 细节：

```text
AI Coach 今日额度已用完，仍可查看标准解析并继续训练。
```

#### 额度和 mastery 的关系

AI 使用会影响学习判断：

- 独立答对：正常提升 mastery。
- 看提示后答对：提升幅度降低。
- 看完整解析后重做答对：主要记录复习行为，不应大幅提升 mastery。
- AI Coach 解释被用户打开：记录为学习辅助事件。

这避免用户靠提示“刷高”掌握度。

### 难度分层

建议使用 L1-L4 四档，后台可显示中文标签。

| 难度 | 中文名 | 特征 | 适合用途 |
| --- | --- | --- | --- |
| L1 | 基础识别 | 直接考概念、公式、定义，题干短，干扰项明显 | 新手补基础 |
| L2 | 标准理解 | 考概念边界、常见应用，干扰项有一定相似度 | 常规训练 |
| L3 | 场景应用 | 题干包含场景，需要 2-3 步判断 | 强化训练 |
| L4 | 综合分析 | 多知识点交叉，多个选项看似合理 | 冲刺和压测 |

题目需要同时保留两个难度字段：

- `designedDifficulty`：出题蓝图或人工标注的设计难度。
- `empiricalDifficulty`：基于真实用户正确率、耗时、放弃率、回看率校准出来的实际难度。

训练计划初期使用 `designedDifficulty`，上线后逐步以 `empiricalDifficulty` 修正。比如一题设计为 L2，但大量用户耗时很长且正确率低，系统应把它视为 L3 或进入人工复核。

难度不是 prompt 文案，而是可校验参数：

- `scenarioLength`
- `reasoningSteps`
- `distractorStrength`
- `knowledgeIntersections`
- `calculationComplexity`
- `answerObviousness`

AI 生成后必须输出难度解释，系统再校验它是否符合目标难度。

### CSCA 范围蓝图

需要建立一份内部 CSCA 考纲蓝图，不要只在 prompt 里写“符合 CSCA”。

建议结构：

```json
{
  "subject": "math",
  "module": "algebra-functions",
  "topic": "linear-functions",
  "subtopic": "slope-and-intercept",
  "skill": "calculation",
  "examWeight": 0.12,
  "allowedQuestionTypes": ["single-choice"],
  "difficultyRange": ["L1", "L2", "L3"],
  "mustCover": ["function expression", "intercept"],
  "mustAvoid": ["out-of-scope university calculus"]
}
```

第一版可从现有模块开始：

- 数学：集合与不等式、函数、几何与代数、概率与统计。
- 物理：力学、电磁学、热学、光学。
- 化学：物质结构、反应原理、溶液、有机化学。

后续再细化到 topic/subtopic。

### 考纲版本治理

CSCA 范围不能只是一份静态配置。需要记录来源、版本和验证状态，避免考纲变化后旧题继续误导用户。

建议每份考纲蓝图包含：

- `syllabusVersion`
- `sourceUrl`
- `sourceLabel`
- `lastVerifiedAt`
- `verifiedBy`
- `status`

每道题也应绑定 `syllabusVersion`。当考纲更新时：

- 新题默认使用最新版本。
- 旧题进入 `needs_review` 或保留旧版本标记。
- 自适应训练默认只抽当前有效考纲版本的题。
- 管理后台应能筛选“过期考纲题”和“待复核题”。

### Topic ID 映射

现有 `MockExamQuestion.knowledgeTags` 和 `SpecialPracticeQuestion.knowledgeTags` 都是文本标签。文本标签适合展示，但不适合作为自适应算法的唯一依据，因为会出现同义词、翻译、大小粒度不一致的问题。

第一版可以临时用标签匹配复用现有题库，但必须尽快建立稳定的 `topicId`：

- 给 `MockExamQuestion` 和 `SpecialPracticeQuestion` 建立 tag-to-topic 映射。
- 一个题目可以有多个 topic，但必须有一个 primary topic。
- 用户 mastery 只能基于 topicId 更新，不直接基于展示文案更新。
- 本地化文案从 topicId 派生，而不是反过来用文案推断 topic。

推荐新增一个映射表或映射配置：

```text
sourceType
sourceQuestionId
sourceTag
topicId
confidence
reviewStatus
createdAt
updatedAt
```

## 技术架构

### 核心流水线

```text
用户作答
-> Performance Recorder
-> Mastery Engine
-> Adaptive Planner
   -> AI Planner Assistant
   -> Rule Guard
-> Question Provider
   -> Question Bank
   -> AI Generator
-> AI Reviewer
-> Validator
-> Adaptive Session
-> AI Coach
-> 本轮报告和下一轮计划
```

### 模块职责

#### ExamScopeService

维护 CSCA 考纲蓝图、科目、模块、topic、权重、题型限制、难度上限。

来源可以是：

- 数据库表。
- 种子脚本。
- 后台可维护配置。

第一版建议数据库加种子，不先做复杂后台。

#### MasteryEngine

维护用户在每个 topic 上的掌握度。

关键指标：

- `mastery`：掌握度，0-1。
- `confidence`：系统对掌握度判断的信心。
- `attempts`：累计作答数。
- `recentAccuracy`：近期正确率。
- `averageDifficulty`：最近稳定难度。
- `lastPracticedAt`：最近练习时间。
- `stability`：稳定性，防止一次答对就过度升级。
- `forgettingRisk`：遗忘风险，用于间隔复习。

第一版可用规则模型：

```text
答对：mastery += 0.05 * difficultyWeight
答错：mastery -= 0.08 * difficultyWeight

L1 = 0.8
L2 = 1.0
L3 = 1.3
L4 = 1.6
```

掌握度边界：

```text
mastery < 0.4：补基础，优先 L1-L2
0.4 <= mastery < 0.7：标准训练，优先 L2
0.7 <= mastery < 0.85：应用训练，优先 L2-L3
mastery >= 0.85：挑战和复习，优先 L3-L4
```

更新 mastery 时不只看对错，也要看：

- 题目难度。
- 用户耗时是否异常。
- 是否未答。
- 是否连续答对或连续答错。
- 是否是近期重复题。
- 题目的 empiricalDifficulty 是否已经偏离设计难度。

还需要区分作答证据强度，避免 AI Coach 把 mastery 刷高：

```text
独立答对：正常提升 mastery
看 1-2 层提示后答对：小幅提升 mastery
看完整提示或解析后答对：主要记录学习行为，mastery 只微调
未答或跳过：降低 confidence，视情况降低 mastery
看解析后重做答对：不等同于独立掌握，需要安排无提示复测题
```

历史数据回填也应有权重：

- 已提交模考报告：权重较高。
- 历史 topic 报告：权重中等。
- 未完成 session：不参与 mastery。
- 时间过久的记录：按时间衰减。
- 旧题缺少稳定 topicId：只作为弱证据，等 topic mapping 审核后再正式纳入。

#### AdaptivePlanner

根据用户画像生成下一轮 blueprint。

输入：

- 用户历史。
- 当前科目。
- 最近一轮作答。
- topic 掌握度。
- 题库覆盖情况。
- 用户选择的训练目标。

输出：

```json
{
  "sessionId": 123,
  "roundNumber": 2,
  "items": [
    {
      "subject": "physics",
      "topicId": "mechanics.force",
      "difficulty": "L2",
      "questionType": "single-choice",
      "sourcePreference": "bank-first",
      "reason": "recent mistakes and low mastery"
    }
  ]
}
```

#### AIPlannerAssistant

辅助 AdaptivePlanner 把用户表现转成错因摘要和计划解释。

输入：

- 本轮作答结果。
- topic mastery。
- 错误选项对应的 misconceptionTags。
- 候选训练计划。
- 系统规则摘要。

输出：

```json
{
  "diagnosis": [
    {
      "topicId": "math.functions.linear",
      "reason": "recent_wrong_answers",
      "misconceptionTags": ["slope-intercept-confusion"],
      "summary": "一次函数题中更常混淆斜率和截距。"
    }
  ],
  "planSuggestions": [
    {
      "topicId": "math.functions.linear",
      "difficulty": "L2",
      "action": "keep_level",
      "reason": "L2 尚未稳定，不建议立即升 L3。"
    }
  ],
  "userFacingExplanation": "下一轮先继续函数 L2 变式题，再加入一题几何复习题。"
}
```

Rule Guard 必须检查 AI 建议：

- 不能添加超出 CSCA 范围的 topic。
- 不能超过当前允许难度上限。
- 不能改变评分结果。
- 不能要求生成不支持的题型。
- 不能违反题量和重复曝光规则。

#### QuestionProvider

优先级：

1. 从已发布正式题库抽未做过的题。
2. 从专项练习题库抽相同 topic 的题。
3. 从模考题库抽带有匹配 knowledgeTags 的题。
4. 调用 AI 生成临时题或草稿题。

注意：现有 `MockExamQuestion` 的 `knowledgeTags` 是 JSON，`SpecialPracticeQuestion` 也有 `knowledgeTags`。第一版可以先通过标签匹配复用题目，但长期应建立统一的 topic id。

QuestionProvider 需要记录曝光，防止用户短时间内反复看到同一题或高度相似题：

- 同一 session 不重复出现同一题。
- 近期已见题默认不再抽取。
- AI 变式题需要记录 `generatedVariantOf`。
- 如果题库不足，优先降低难度或扩大相邻 topic，而不是硬重复。

#### AICoach

提供同步、低风险、用户可见的 AI 辅导能力。

主要能力：

- `explainWrongAnswer`：根据用户选项解释为什么错。
- `giveHint`：给出分层提示，不直接暴露答案。
- `summarizeRound`：总结本轮表现和下一步训练重点。
- `explainPlan`：把 Planner 输出转成用户能理解的话。
- `rewriteExplanation`：把固定解析改写为更通俗、多语言或更短版本。

所有 AICoach 输出都应该有边界：

- 明确基于题目已有正确答案和解析。
- 不生成新的正确答案。
- 不覆盖系统评分。
- 不写入正式题库。
- 可记录但不作为唯一训练依据。

#### AIGenerator

输入必须是 blueprint，不接受自由文本出题。

输出必须是 JSON：

```json
{
  "stem": "...",
  "options": [
    { "id": "A", "text": "..." },
    { "id": "B", "text": "..." },
    { "id": "C", "text": "..." },
    { "id": "D", "text": "..." }
  ],
  "correctAnswer": "B",
  "explanation": "...",
  "knowledgeTags": ["函数", "一次函数"],
  "optionMetadata": [
    {
      "optionId": "A",
      "distractorIntent": "常见计算错误",
      "misconceptionTags": ["calculation-slip"]
    }
  ],
  "difficulty": "L2",
  "difficultyReason": {
    "reasoningSteps": 1,
    "distractorStrength": "medium"
  }
}
```

#### AIReviewer

对生成题进行二次审查：

- 是否符合指定 CSCA subject/topic。
- 是否超纲。
- 是否只有一个正确答案。
- 选项是否互斥。
- 解析是否支持答案。
- 难度是否匹配。
- 是否存在明显提示词。
- 是否和近期题目重复。
- 每个错误选项的干扰项意图是否合理。
- misconceptionTags 是否匹配题目和选项。

Reviewer 不通过时：

- 可以要求 Generator 修订一次。
- 仍不通过则丢弃或进入人工审核。

AI Reviewer 只能降低风险，不能证明题目一定正确。正式题库必须保留人工审核或抽样审核。数学、物理、化学中的计算题还应尽量引入确定性校验：

- 数学题：表达式、方程、数值答案可用规则或计算器校验。
- 物理题：单位、公式代入、数量级可校验。
- 化学题：简单化学式、反应类型、守恒关系可校验。
- 无法确定性校验的题进入人工审核。

#### Validator

程序化校验：

- JSON schema。
- A-D 四个选项。
- `correctAnswer` 必须在 A-D。
- 题干、选项、解析不能为空。
- `topicId` 必须存在。
- `difficulty` 必须在 L1-L4。
- 临时题不能直接变成 published。

#### DifficultyCalibrator

根据真实作答数据校准题目实际难度。

输入：

- 正确率。
- 平均耗时。
- 未答率。
- 回看/标记率。
- 用户 mastery 分布。

输出：

- `empiricalDifficulty`。
- `difficultyConfidence`。
- 是否需要人工复核。

校准逻辑可以先用规则模型：

```text
高 mastery 用户大量答错 -> 题目可能偏难或有错。
低 mastery 用户大量答对且耗时短 -> 题目可能偏易。
正确率正常但耗时异常 -> 题干可能太长或干扰项过强。
```

#### QualityEvaluationService

维护一组内部 gold set，用于评估 AI 生成和 AI 审题质量。

gold set 要求：

- 每个科目和核心模块都有人工确认题。
- 每题有明确 topicId、难度、答案、解析。
- 可用于测试 generator 是否跑题。
- 可用于测试 reviewer 是否能识别错误答案、多答案、超纲题和难度偏差。

上线前至少需要记录：

- AI 生成通过率。
- Reviewer 拒绝率。
- 人工审核推翻率。
- 按科目的错误类型分布。

#### GenerationScheduler

AI 生成应优先异步预生成，而不是用户点击下一轮时现场等待。

推荐策略：

- 用户完成一轮后，后台预生成下一轮候选题。
- 高需求 topic 定期补题。
- 低库存 topic 优先生成 L1-L2 基础题。
- 生成失败时回退到题库抽题或相邻 topic。
- 缓存已通过审核的 AI 题，减少重复调用。

#### AIInteractionLogger

记录同步和半同步 AI 参与过程，便于质量评估和问题排查。

记录内容：

- AI 能力类型：coach、planner_assistant、generator、reviewer。
- 输入摘要和安全过滤结果。
- 输出内容或结构化结果。
- 是否展示给用户。
- 是否被 Rule Guard 修改或拒绝。
- 用户是否采纳，例如是否点击提示、是否继续下一轮。

日志不应长期保存敏感原文，应该按现有隐私和安全策略做脱敏、摘要或过期清理。

#### AIEntitlementService

负责判断用户是否可以使用某项 AI 能力。

检查顺序：

1. 用户个人 AI 额度。
2. 用户所属机构额度池。
3. 免费体验额度。
4. 管理员或测试账号豁免。

输出：

```json
{
  "allowed": true,
  "billingScope": "user",
  "creditSourceId": 123,
  "remaining": 42,
  "degradeTo": null
}
```

如果不允许调用，需要返回降级策略，而不是让前端直接失败。

#### AIUsageMeter

负责记录和扣减 AI 使用量。

记录内容：

- userId。
- organizationId nullable。
- interactionType。
- provider。
- model。
- estimatedTokens。
- creditCost。
- result：success / failed / degraded / cached。
- linked session / round / question。

扣减原则：

- 缓存命中可以不扣或少扣。
- provider 失败不扣用户额度。
- 被安全策略拒绝不扣用户额度。
- 后台 generator/reviewer 计入平台运营成本，不直接扣用户训练额度。

#### AIProviderRouter

负责选择实际 LLM provider。

路由顺序：

1. 如果用户属于启用 BYOK 的机构，使用机构 provider 配置。
2. 否则使用平台默认 provider。
3. 如果默认 provider 不可用，切换到 fallback provider。
4. 如果全部失败，返回降级策略。

Provider Router 不直接暴露给前端。前端只知道 AI Coach 能力是否可用。

#### OrganizationAIQuotaService

负责机构额度池。

能力：

- 给机构发放额度。
- 机构成员消耗额度。
- 查询剩余额度。
- 生成机构使用报告。
- 设置学生/班级额度上限。

第一版可以暂不实现 organization，但数据模型要预留，避免后面重构 entitlement 逻辑。

## 数据模型建议

新增模型草案如下，字段名可以在实现时按 Prisma 习惯微调。

### `CscaExamTopic`

统一考纲范围。

```text
id
subject
module
slug
title
description
parentId nullable
syllabusVersion
sourceUrl nullable
sourceLabel nullable
lastVerifiedAt nullable
verifiedBy nullable
examWeight
allowedQuestionTypes Json
difficultyRange Json
status
sortOrder
createdAt
updatedAt
```

### `CscaQuestionBlueprint`

记录系统计划生成什么题。

```text
id
subject
topicId
difficulty
questionType
skill
source
constraints Json
status
createdAt
updatedAt
```

### `CscaQuestion`

统一自适应题库。可存正式题、AI 草稿题、临时题。

```text
id
subject
topicId
blueprintId nullable
sourceType              // bank | ai | imported | mock_exam | special_practice
sourceQuestionId nullable
designedDifficulty
empiricalDifficulty nullable
difficultyConfidence nullable
questionType
prompt
options Json
correctAnswer
explanation
knowledgeTags Json
optionMetadata Json nullable
syllabusVersion
generationMetadata Json nullable
reviewMetadata Json nullable
status                  // draft | pending_review | approved | published | archived | temporary
version
createdAt
updatedAt
```

### `CscaQuestionMisconception`

维护标准错因标签，供题目选项、AI Coach 和 Planner 复用。

```text
id
slug
subject
topicId nullable
label
description
status
createdAt
updatedAt
```

### `CscaConceptCard`

训练中插入的微讲解内容。可以由人工维护，也可以由 AI Coach 生成后审核固化。

```text
id
topicId
misconceptionId nullable
title
body
exampleJson nullable
status                  // draft | published | archived
source                  // manual | ai | imported
reviewMetadata Json nullable
createdAt
updatedAt
```

### `CscaAdaptiveSession`

一次自适应训练 session。

```text
id
userId nullable
subject
mode                    // adaptive | weak-topic | review | challenge
language
status                  // active | completed | abandoned
currentRound
startedAt
completedAt nullable
createdAt
updatedAt
```

### `CscaAdaptiveRound`

小批次训练轮次。

```text
id
sessionId
roundNumber
plannerInput Json
plannerOutput Json
summary Json nullable
createdAt
completedAt nullable
```

### `CscaAdaptiveRoundItem`

本轮的每道题。

```text
id
roundId
questionId
orderNumber
topicId
difficulty
reason
answer nullable
isCorrect nullable
secondsSpent nullable
createdAt
updatedAt
```

### `UserCscaTopicMastery`

用户 topic 掌握度。

```text
id
userId
topicId
mastery
confidence
attempts
correctCount
wrongCount
recentAccuracy
averageDifficulty
stability
forgettingRisk
lastPracticedAt nullable
updatedAt
```

### `CscaQuestionExposure`

记录用户看过、答过、被推荐过的题，控制重复和变式。

```text
id
userId nullable
sessionId nullable
questionId
sourceQuestionId nullable
generatedVariantOf nullable
eventType               // shown | answered | skipped | generated
createdAt
```

### `CscaAIInteraction`

记录 AI Coach、Planner Assistant、Generator、Reviewer 的调用摘要。

```text
id
userId nullable
sessionId nullable
roundId nullable
questionId nullable
interactionType         // coach | planner_assistant | generator | reviewer
inputSummary Json
outputSummary Json
guardResult Json nullable
shownToUser Boolean
createdAt
expiresAt nullable
```

### `CscaAIInteractionFeedback`

用户对 AI Coach 输出的轻量反馈。

```text
id
interactionId
userId nullable
rating                  // helpful | unclear | maybe_wrong
comment nullable
createdAt
```

### `CscaTrainingEvent`

统一记录训练事件，用于漏斗、A/B 和学习效果分析。

```text
id
userId nullable
sessionId nullable
roundId nullable
eventType               // diagnostic_started | round_completed | hint_used | explanation_opened | concept_card_viewed | next_round_started
metadata Json nullable
createdAt
```

### `AiCreditProduct`

定义平台可售卖的 AI 额度包或会员内含权益。

```text
id
slug
title
description
creditAmount
validDays nullable
priceCents
currency
status                  // draft | active | archived
metadata Json nullable
createdAt
updatedAt
```

### `UserAiCreditBalance`

用户当前可用 AI 额度汇总。

```text
id
userId
availableCredits
reservedCredits
expiresAt nullable
updatedAt
```

### `AiCreditLedger`

AI 额度账本，所有发放、扣减、退款、过期都写流水。

```text
id
userId nullable
organizationId nullable
orderId nullable
orderItemId nullable
interactionId nullable
type                    // grant | consume | refund | expire | adjust
source                  // purchase | membership | trial | organization | admin
credits
balanceAfter nullable
metadata Json nullable
createdAt
```

### `Organization`

机构/学校/代理商容器，后续支持机构额度池。

```text
id
slug
name
type                    // school | agency | partner | enterprise
status
createdAt
updatedAt
```

### `OrganizationMember`

机构成员关系。

```text
id
organizationId
userId
role                    // owner | admin | teacher | student
status
createdAt
updatedAt
```

### `OrganizationAiCreditPool`

机构 AI 额度池。

```text
id
organizationId
availableCredits
reservedCredits
expiresAt nullable
perUserDailyLimit nullable
status
updatedAt
```

### `OrganizationLlmProviderConfig`

企业 BYOK 配置。第一版不实现，但预留架构。

```text
id
organizationId
provider
model
encryptedApiKey
baseUrl nullable
status                  // disabled | active | suspended
usagePolicy Json nullable
createdAt
updatedAt
```

### `CscaAiGenerationJob`

AI 生成任务记录。

```text
id
blueprintId
provider
model
requestHash
promptMetadata Json
rawOutput Json nullable
normalizedOutput Json nullable
reviewResult Json nullable
status
error nullable
createdAt
updatedAt
```

### `CscaTopicMapping`

把现有文本标签和旧题映射到稳定 topicId。

```text
id
sourceType              // mock_exam | special_practice | imported
sourceQuestionId nullable
sourceTag
topicId
isPrimary
confidence
reviewStatus            // pending | approved | rejected
createdAt
updatedAt
```

### `CscaQuestionQualityMetric`

记录题目的真实表现，用于难度校准和质量复核。

```text
id
questionId
attemptCount
correctRate
medianSeconds
unansweredRate
markedRate
empiricalDifficulty
difficultyConfidence
needsReview
updatedAt
```

## API 方案

扩展现有公开/登录训练 API：

- `GET /api/v1/csca-special-practice/adaptive/overview`
  - 返回用户当前自适应训练概览、科目掌握度、推荐入口。

- `POST /api/v1/csca-special-practice/adaptive/sessions`
  - 创建自适应训练 session。
  - body: `subject`、可选 `mode`。
  - 后端根据该学科诊断完成状态决定 `diagnostic` 或 `practice` mode；未完成诊断时强制 diagnostic。

- `POST /api/v1/csca-special-practice/adaptive/sessions/:id/rounds`
  - 生成诊断或训练 round。
  - diagnostic round 为 20 题，practice round 为 5 题。
  - 由 planner 决定题目蓝图。

- `GET /api/v1/csca-special-practice/adaptive/sessions/:id`
  - 获取 session 和历史 rounds 状态。

- `PATCH /api/v1/csca-special-practice/adaptive/rounds/:roundId`
  - 保存本轮答案、耗时、当前题。

- `POST /api/v1/csca-special-practice/adaptive/rounds/:roundId/submit`
  - 提交本轮，更新 mastery，返回诊断和下一轮建议。

- `POST /api/v1/csca-special-practice/adaptive/questions/:questionId/hints`
  - 同步 AI Coach 提示。
  - 必须基于当前题和当前用户作答状态，不直接返回答案。

- `POST /api/v1/csca-special-practice/adaptive/questions/:questionId/explain`
  - 同步 AI Coach 个性化讲解。
  - 输入用户选择，输出为什么该选项不对、正确思路是什么。

- `POST /api/v1/csca-special-practice/adaptive/rounds/:roundId/coach-summary`
  - 同步或半同步生成本轮自然语言诊断。
  - 不改变系统评分和 mastery，只作为解释层。

- `GET /api/v1/csca-special-practice/adaptive/concept-cards/:topicId`
  - 获取当前 topic 或错因相关的概念卡。

- `POST /api/v1/csca-special-practice/adaptive/ai-interactions/:id/feedback`
  - 用户对 AI Coach 输出反馈：有帮助 / 没看懂 / 可能有错。

- `GET /api/v1/ai-credits/me`
  - 查询当前用户 AI Coach 额度、有效期、今日使用量。

- `GET /api/v1/ai-credits/products`
  - 查询可购买的 AI 训练额度包。

- `POST /api/v1/cart/items`
  - 扩展现有购物车，支持 `AI_CREDIT_PACK`。
  - 支付成功后通过 ledger 发放额度。

新增后台 API：

- `GET /api/v1/admin/csca-topics`
- `POST /api/v1/admin/csca-topics/import`
- `GET /api/v1/admin/ai-question-jobs`
- `POST /api/v1/admin/ai-question-jobs`
- `POST /api/v1/admin/ai-question-jobs/:id/approve`
- `POST /api/v1/admin/ai-question-jobs/:id/reject`
- `GET /api/v1/admin/csca-topic-mappings`
- `PATCH /api/v1/admin/csca-topic-mappings/:id`
- `GET /api/v1/admin/csca-question-quality`
- `GET /api/v1/admin/csca-misconceptions`
- `POST /api/v1/admin/csca-misconceptions`
- `GET /api/v1/admin/csca-concept-cards`
- `POST /api/v1/admin/csca-concept-cards`
- `GET /api/v1/admin/ai-interactions`
- `GET /api/v1/admin/training-analytics`
- `GET /api/v1/admin/ai-credit-products`
- `POST /api/v1/admin/ai-credit-products`
- `GET /api/v1/admin/ai-credit-ledger`
- `GET /api/v1/admin/organizations`
- `POST /api/v1/admin/organizations`
- `GET /api/v1/admin/organizations/:id/ai-credits`
- `POST /api/v1/admin/organizations/:id/ai-credits/grants`
- `GET /api/v1/admin/organizations/:id/llm-provider`
- `PATCH /api/v1/admin/organizations/:id/llm-provider`

## 执行计划

### Phase 0: 方案确认

- 确认自适应训练独立于固定模考。
- 确认用户侧最终只有一个训练入口：改造现有 `csca-special-practice`，不新增平级的 `csca-adaptive-practice` 页面。
- 确认第一版只做数学、物理、化学。
- 确认题型先只支持 single-choice。
- 确认 AI 题先进入 temporary/pending_review，不直接 published。

### Phase 1: 考纲蓝图和数据结构

- 新增 `CscaExamTopic` 等基础表。
- 加入 `syllabusVersion`、来源、验证时间和复核状态。
- 用 seed 初始化数学、物理、化学模块和 topic。
- 给现有 mock/special 题目建立到 topic 的映射策略。
- 保持现有 `MockExamPaper`、`SpecialPracticeTopic` 不破坏。

### Phase 2: Topic 映射和冷启动诊断

- 建立 `CscaTopicMapping`。
- 从现有 `knowledgeTags` 生成初始映射草案。
- 标记 primary topic 和 secondary topics。
- 实现新用户 20 题诊断流程。
- 诊断完成后初始化 `UserCscaTopicMastery`。
- 设计历史数据回填：已提交模考权重较高，历史 topic 报告权重中等，未完成 session 不参与。

### Phase 3: 自适应 session 和 mastery

- 新增 `CscaAdaptiveSession`、`CscaAdaptiveRound`、`CscaAdaptiveRoundItem`。
- 新增 `UserCscaTopicMastery`。
- 实现 `MasteryEngine` 的规则模型。
- 区分独立答对、提示后答对、看解析后重做答对。
- 从现有模考报告和历史 topic 报告中提取 knowledgeTags，逐步回填用户画像。

### Phase 4: Planner 和题库优先抽题

- 实现 `AdaptivePlanner`。
- 实现 5 题一轮的小批次计划。
- 实现 `QuestionProvider` 的 bank-first 策略。
- 实现 `CscaQuestionExposure`，控制重复和变式题曝光。
- 实现 `AIPlannerAssistant` 的结构化建议和 Rule Guard。
- 先不调用 AI，也能跑通自适应训练。

### Phase 5: AI Coach 和错因标签

- 新增 `AICoach`。
- 支持答错后的个性化讲解。
- 支持分层提示。
- 支持本轮诊断和下一轮计划解释。
- 建立 `CscaQuestionMisconception`。
- 建立 `CscaConceptCard`，连续错同一错因时插入 60 秒概念卡。
- 为题目选项补充 `optionMetadata` 和 misconceptionTags。
- 建立 `CscaAIInteraction` 日志。
- 建立 AI Coach 反馈：有帮助 / 没看懂 / 可能有错。

### Phase 6: AI 额度和平台 Provider

- 新增 `AIEntitlementService`、`AIUsageMeter`、`AIProviderRouter`。
- 平台统一配置默认 LLM provider。
- 新增用户 AI 额度余额和 ledger。
- 扩展 commerce 商品类型，支持 `AI_CREDIT_PACK`。
- 支付成功后发放 AI Coach 额度。
- AI 失败、额度不足、缓存命中都要有明确降级策略。

### Phase 7: AI 生成和审核

- 新增 `ai-questioning` 模块。
- 实现 prompt builder、generator、reviewer、validator。
- 接入 AI provider 配置。
- AI 生成题只进入临时练习或后台待审核。
- 增加重复检测和失败重试。
- 引入计算题确定性校验。
- 引入异步预生成和生成缓存。

### Phase 8: 前端训练体验

- 改造 `CscaSubjectPage`，把智能练习并入现有科目页。
- 不新增“自适应训练/科目练习”顶层导航。
- 支持冷启动诊断。
- 支持学科自适应面板：数学、物理、化学分别显示下一轮建议。
- 支持开始 session、完成一轮、看本轮诊断、继续下一轮。
- 展示“下一轮为什么这样安排”。
- 支持“提示”和“解释我的错误”。
- 展示 AI Coach 剩余额度和降级提示。
- 在模考报告页增加“用这些薄弱点生成自适应训练”的入口。
- 在历史 topic 报告页增加“进入下一轮自适应训练”的入口。

### Phase 9: 管理后台

- 增加 CSCA topic 蓝图维护或导入。
- 增加 topic mapping 审核。
- 增加错因标签维护。
- 增加概念卡维护和审核。
- 增加 AI Coach 和 Planner Assistant 调用观察页。
- 增加训练指标看板：诊断完成率、下一轮继续率、AI 解释满意度、7 日回访率。
- 增加 AI 额度商品、ledger 和使用量看板。
- 增加 AI 生成题审核列表。
- 增加题目质量和 empirical difficulty 看板。
- 支持 approve/reject/archive。
- 审核通过的 AI 题才能进入正式可复用题库。

### Phase 10: 机构额度池

- 新增 `Organization` 和 `OrganizationMember`。
- 新增机构 AI 额度池。
- 支持机构购买、发放和限制学生额度。
- 机构后台查看用量和学习效果。

### Phase 11: Enterprise BYOK

- 新增 `OrganizationLlmProviderConfig`。
- API key 加密存储。
- Provider Router 支持机构 provider 优先。
- BYOK 默认关闭，仅企业版开启。

### Phase 12: 上线前质量门槛

- 每个 topic 至少有基础题覆盖。
- AI 题自动审核通过率可观测。
- 每道正式 AI 题有 reviewer metadata。
- 自适应策略有最小测试覆盖。
- 生成失败时能回退到题库抽题。
- 有内部 gold set。
- 有考纲版本过期题筛查。
- 有真实难度校准任务。
- AI Coach 输出有抽样审核。
- AI Coach 反馈能进入后台复核。
- 高频错因有概念卡兜底。
- Planner Assistant 建议有 Rule Guard 拒绝率监控。
- AI 额度扣减、失败不扣费、缓存扣费策略有测试覆盖。
- 机构和 BYOK 默认不影响普通用户平台额度路径。
- 诊断完成率、下一轮继续率、AI 解释满意度、7 日回访率有基础埋点。

## 风险和控制

### 考纲过期风险

控制方式：

- 题目和 topic 都绑定 `syllabusVersion`。
- 记录 `sourceUrl`、`lastVerifiedAt` 和 `verifiedBy`。
- 考纲更新后旧题进入待复核或过期状态。
- 自适应训练默认只抽当前有效考纲版本。

### Topic 映射错误风险

控制方式：

- 文本 `knowledgeTags` 只能作为候选来源。
- mastery 只基于稳定 `topicId` 更新。
- 映射需要 `confidence` 和 `reviewStatus`。
- 低置信度映射不进入正式自适应策略。

### 历史数据迁移风险

控制方式：

- 只回填已提交的模考和历史 topic 报告。
- 未完成 session 不参与 mastery。
- 时间过久的记录按时间衰减。
- 缺少稳定 topicId 的记录只作为弱证据。
- 回填任务要可重跑，并记录使用的 mapping 版本。

### 跑题风险

控制方式：

- 以 `CscaExamTopic` 为唯一范围来源。
- prompt 中只引用当前 topic 的 mustCover/mustAvoid。
- Reviewer 复核是否超纲。

### 难度失控

控制方式：

- 难度拆成可校验指标。
- AI 输出 difficultyReason。
- 系统根据作答结果持续修正题目实际难度。
- 同时保留 `designedDifficulty` 和 `empiricalDifficulty`。
- 难度偏差过大的题进入人工复核。

### 错题或多答案风险

控制方式：

- AI Reviewer 审题。
- 程序化 Validator。
- 计算题尽量引入确定性校验。
- 正式发布前人工审核。
- 已有作答记录的题不允许直接大改，延续现有 mock/special 的版本保护思路。

### AI 同步输出误导风险

控制方式：

- AI Coach 必须基于已有正确答案和解析生成。
- 提示接口不能直接返回答案。
- 讲解输出要标记为辅导解释，不改变系统评分。
- 对高频题和高曝光讲解做抽样审核。
- 用户反馈“讲解不清楚/可能有误”后进入后台复核。

### 用户过度依赖提示风险

控制方式：

- 提示分层，前两层不给答案。
- 每题限制提示次数。
- mastery 更新区分独立答对、提示后答对、看解析后重做答对。
- 连续依赖提示时安排无提示复测题。
- 报告中可以提示“本轮 2 题借助提示答对”，帮助用户建立真实感。

### 训练疲劳风险

控制方式：

- 连续多轮正确率下降时建议休息。
- 同一错因重复出现时插入概念卡。
- 单轮耗时过长时降低下一轮难度或减少综合题。
- mastery 达标时建议切换到完整模考，而不是继续刷短轮次。

### AI 额度耗尽风险

控制方式：

- 前端提前展示剩余额度和今日使用量。
- AI Coach 额度耗尽时降级到固定解析。
- 提示、解释、总结分别计量，不把所有能力混成一个黑箱。
- provider 失败、缓存命中、安全拒绝不扣用户额度。
- 未登录用户只给少量体验额度，长期记录需要登录。

### LLM 成本失控风险

控制方式：

- AI Coach 每题限制提示次数。
- 本轮总结可缓存。
- Planner Assistant 不直接对用户按次扣费，作为平台成本受限流控制。
- AI Generator 和 Reviewer 走后台任务，不在用户高峰路径无限触发。
- 通过 `AIUsageMeter` 按能力、模型、用户、机构统计成本。

### BYOK 复杂度风险

控制方式：

- 第一版不做 BYOK。
- 第二阶段先做机构额度池。
- BYOK 只作为企业版配置。
- BYOK provider 配置必须加密存储、可暂停、可回退到平台 provider。
- Organization 级 provider 不影响普通用户平台统一额度路径。

### AI 输入隐私风险

控制方式：

- 前端不接触 LLM provider key。
- 不向模型发送用户 email、姓名、支付信息。
- 只发送题目、选项、用户答案、topic、必要 mastery 摘要。
- `CscaAIInteraction` 保存摘要，避免长期保存敏感原文。
- 管理后台查看 AI 日志时隐藏敏感用户标识。

### Planner Assistant 越权风险

控制方式：

- AI Planner Assistant 只输出建议，不直接写入最终计划。
- Rule Guard 校验范围、难度、题型、题量和重复曝光。
- 记录 AI 建议和最终计划差异。
- 被拒绝建议进入质量分析。

### 重复曝光风险

控制方式：

- 记录 `CscaQuestionExposure`。
- 同一 session 不重复。
- 近期已见题降权。
- AI 变式题绑定 `generatedVariantOf`。
- 题库不足时宁可回退到相邻 topic 或较低难度，也不要短时间重复。

### 成本和延迟风险

控制方式：

- 题库优先。
- 小批次生成。
- 异步 generation job。
- 后台预生成下一轮候选题。
- 缓存通过审核的 AI 题。
- 生成失败时回退到已发布题库。

### 质量不可观测风险

控制方式：

- 建立 gold set。
- 记录 AI 生成通过率、Reviewer 拒绝率、人工推翻率。
- 记录 AI Coach 使用率、用户反馈和抽样审核结果。
- 记录 Planner Assistant 建议采纳率和拒绝原因。
- 记录题目 empirical difficulty。
- 定期抽查高曝光题和异常题。

### 产品效果不可证明风险

控制方式：

- 记录诊断完成率。
- 记录下一轮继续率。
- 记录 7 日回访率。
- 记录 AI 解释点击率和满意度。
- 记录错因重复率是否下降。
- 记录自适应训练后模考分数是否改善。

### 对现有系统的影响

控制方式：

- 改造现有 `csca-subjects` 用户侧入口，新增自适应 session/round/mastery 表。
- 不改变现有固定模考 attempt 语义。
- 不改变 past paper 下载资源。
- 旧 `/csca-special-practice` 普通用户路由不再兼容；后台预览和数据迁移可以继续复用旧题库能力。
- 模考报告导流到对应科目页的下一轮智能练习，不反向修改历史报告。

## MVP 定义与当前实现语义

这里需要区分两个层级：

- **当前产品 MVP**：目标是让普通用户可以完成自适应训练闭环，并可以灰度验证诊断、训练、报告、下一轮继续率和 AI Coach 的基础价值。
- **平台级 AI MVP**：目标是把真实 LLM provider、额度、成本、后台审核、AI 出题/审题等商业化和运营能力接起来。

截至 2026-06-06，`codex/adaptive-ai-questioning` 分支已完成当前产品 MVP 主闭环，并开始补平台级 AI MVP 的底座能力。当前仍不能理解为完整 AI 平台已完成。

### 当前产品 MVP

最小可行版本应该做到：

- 有 CSCA topic 蓝图。
- 有 tag-to-topic 映射。
- 有冷启动诊断。
- 有用户 topic mastery。
- 有自适应 session。
- 每轮 5 道题。
- Planner 能根据用户表现调整 topic 和 difficulty。
- QuestionProvider 能从现有题库抽题。
- QuestionProvider 能控制重复曝光。
- AI Coach 能提供答错讲解、分层提示和本轮总结。
- 用户能对 AI Coach 输出反馈：有帮助 / 没看懂 / 可能有错。
- 完成本轮后展示薄弱点、掌握度变化和下一轮计划。
- 报告能解释下一轮安排原因。

当前分支已经覆盖上述主闭环。AI Coach 默认仍可在 `rule-fallback` 下运行；同时已经具备平台统一 OpenAI/OpenAI-compatible provider 的最小 adapter 和失败降级路径。

### 平台级 AI MVP

以下能力属于下一阶段或更后阶段，不应被解释为当前分支已完成：

- 有考纲版本字段和考纲更新后的题目复核流程。
- Planner Assistant 能提供结构化建议，并经过 Rule Guard。
- 题目选项能记录基础错因标签。
- mastery 能更精细地区分独立答对、提示后答对、看解析后重做答对。
- 连续同错因时能插入概念卡。
- 至少记录诊断完成率、下一轮继续率、AI 解释点击率等埋点。最小 `CscaTrainingEvent`、admin observability API、派生 AI 复核队列和人工复核结论写入已接入，复杂漏斗 UI、7 日回访分析和独立复核工作流仍未完成。
- 平台统一真实 LLM provider 可用。最小 adapter、代码侧 prompt 模板版本注册、基础输出 guard、admin observability API、后台审计页最小观察区、只读 provider 灰度配置状态/成本配置验收，以及 `ai-provider:smoke` 灰度脚本已接入；脚本默认不误触发真实模型调用，只有设置 `AI_PROVIDER_SMOKE_ALLOW_EXTERNAL=1` 才会验证 billable interaction、ledger 扣减和余额变化；prompt 后台发布、完整安全审核、后台密钥编辑和独立可视化看板仍需补齐。
- 用户 AI Coach 额度可查询、可扣减、可降级。个人额度账户、reserve/consume/refund ledger、成本 metadata、管理员发放额度、固定 AI 额度包购买履约，以及自适应总览/学科面板/答题页/报告页的余额展示、低余额提示和购买入口已接入。
- AI 额度 ledger、额度商品、机构额度池和 BYOK。个人 ledger、运营发放、固定额度包和 token 成本估算已接入，多档套餐、机构池和 BYOK 未完成。
- AI Generator / AI Reviewer / 候选题审核发布流水线。

当前产品 MVP 可以暂时不接 AI Generator，也不做机构额度池和 BYOK。因为自适应的核心是 planner 和 mastery，不是生成模型。真实 LLM Coach 和额度体系可以作为下一阶段接入，但不能污染正式题库，也不能让训练链路依赖模型稳定性。

## 推荐第一步

当前产品 MVP 的第一步已经执行，已落地：

```text
CscaExamTopic
+ CscaTopicMapping
+ UserCscaTopicMastery
+ CscaAdaptiveSession / Round / RoundItem
+ CscaQuestionExposure
+ CscaAIInteractionFeedback
+ CscaTrainingEvent
+ AICoach
+ AIUsageMeter
+ AdaptivePlanner
+ bank-first QuestionProvider
```

下一阶段不要直接写 AI 出题。当前已开始补平台级 AI 底座，状态如下：

```text
[已开始] 真实 LLM provider adapter
[已开始] 代码侧 prompt 模板版本注册和基础输出 guard
[已开始] 只读 provider readiness、未就绪原因和成本配置后台验收
[已开始] 真实 LLM provider 灰度 smoke：默认 fallback，不误消耗额度；显式 opt-in 后验证 live billable/ledger
[已开始] 发布前自适应灰度 release smoke：学生训练链路、AI 反馈、后台复核和审计串联
[未完成] prompt 模板后台发布和运营审核工作流
[已开始] AIEntitlementService
[已开始] AI 额度 ledger 和成本 metadata
[已开始] 管理员发放 AI Coach 额度
[已开始] 固定 AI 额度包购买履约和端到端 smoke
[已开始] AI Coach 使用量查询
[已开始] 用户侧 AI 额度余额展示、耗尽降级提示和购买入口
[已开始] provider token 单价环境配置和 costEstimate
[已开始] AI Coach 质量/成本 admin observability API
[已开始] 训练事件埋点和 admin observability API
[已开始] AI Coach 质量/成本后台观测页：已支持筛选、趋势、分布、最近失败/事件列表、派生复核队列和处理结论写入
[未完成] 独立 AI 复核工作流、批量处理和处理 SLA
[未完成] 独立 BI 看板和更完整漏斗分析
```

这一步完成后，项目才进入平台级 AI MVP。之后再把 AI 作为题目来源之一接进来，系统会更稳，也不会把模型输出错误扩散到正式题库。

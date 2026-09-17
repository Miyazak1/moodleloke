# 个人页产品评审与备考成熟度方案

> 日期：2026-06-09  
> 范围：`/zh/me` 个人页、学习驾驶舱、今日复盘、错题本、练习与模考记录  
> 目的：记录当前个人页的产品/交互问题，以及新增“备考成熟度”聚合能力的设计方向。
>
> 延伸架构：成熟度评分从 MVP 继续升级时，参见 [`readiness-evidence-engine-architecture.md`](./readiness-evidence-engine-architecture.md)，该文档细化了题量、知识覆盖面、题目难度、置信度和下一步动作排序的成熟方案。

## 1. 总体判断

个人页当前已经具备很强的学习数据闭环能力，但产品表达还没有完全收束。

它现在同时承担了四类职责：

- 学习驾驶舱：学习活动、趋势、掌握度、模考、错因、复盘。
- 错题中心：统一错题本、错因复习包、错题筛选、展开复盘。
- 申请工作台：短名单、学校对比、申请准备建议。
- 账号中心：账号设置、邮箱验证、订单服务。

能力覆盖接近完整，但用户打开页面时仍需要自己判断“我现在到底怎么样、下一步做什么、离准备成熟还差多远”。因此，下一阶段不应继续堆卡片，而应把已有数据翻译成更明确的用户结论。

## 2. 当前主要问题

### 2.1 总览信息过载

总览页当前连续展示：

- 学习驾驶舱。
- 学习活动热力图。
- 最近 30 天趋势。
- 长期反馈。
- 模考趋势。
- AI 周报。
- 今日复盘。
- 错因模式。
- 学科掌握。
- 短名单、学校对比、练习与模考、订单摘要。
- 下一步建议。
- 任务卡。

这些模块单独看都有价值，但在同一个总览层级上出现时，用户很难形成主线。

用户打开个人页最想知道的通常是：

- 今天最该做什么？
- 最近有没有进步？
- 最大短板在哪里？
- 离可以上考场还差多少？

当前页面提供了原始指标，但没有足够清晰地给出这四个结论。

### 2.2 学习任务和申请任务混在一起

CSCA 学习状态和留学申请准备都重要，但它们属于不同任务模式。

当前总览同时出现“继续训练”和“先保存几所目标学校”，会让用户被两个目标拉扯。个人页应优先服务当前最紧迫的任务，再把另一类任务放到次级区域。

建议：

- 默认总览优先 CSCA 学习闭环。
- 申请相关内容压缩为一个“申请准备”摘要区，或放到独立 tab。
- 当用户没有学习数据时，再用申请任务承接空状态。

### 2.3 今日复盘的语义曾不清晰

用户反馈：“点复盘完成不知道有什么用，好像只是顺序变换了。”

原逻辑：

- “今日复盘”同时展示到期项和后续复习项。
- 点击“复盘完成”后，后端把该错因的 `nextReviewAt` 推到 5 天后。
- 但由于后续复习项仍显示在同一列表里，用户看到的效果像只是列表排序变了。

已做的前端修正方向：

- “今日复盘”只展示真正到期的项。
- 非到期错因继续出现在“错因模式”里，而不是今日任务里。
- 点击“复盘完成”后，该项从今日复盘消失。
- 成功反馈带上下次复盘时间。

后续仍建议：

- 将按钮文案从“复盘完成”进一步细化为“标记已复盘”或“今天已复盘”。
- 只有用户进入复盘或展开解析后，再显示完成按钮，会更符合严格学习闭环。
- 后端排期不要长期固定 5 天，应逐步根据错因强度、是否重练成功、掌握度变化动态调整。

### 2.4 错题本信息密度过高

练习与模考页当前展示：

- 错因复习包。
- 5 个筛选器。
- 很长的知识点和标签下拉。
- 错题卡列表。
- 模考和练习记录。

这更像管理后台或数据库筛选器，而不是学生的复盘入口。

建议默认只给三类入口：

- 今天该复盘。
- 高频错因。
- 最近错题。

高级筛选应折叠到“更多筛选”。常用筛选可以保留为 chips 或快捷按钮，例如“数学”“到期”“模考错题”“公式混淆”。

### 2.5 错因复习包数字需要解释

例如：

```text
公式/规则混淆
65
23 到期 · 平面解析几何 / 函数 / 基本初等函数 / 立体几何
```

这个数据有价值，但用户未必知道 65 是题数、错因次数还是复习项。

建议改成：

```text
公式/规则混淆
65 道相关错题 · 23 道到期
优先复盘：平面解析几何 / 函数 / 基本初等函数
```

低置信度归因也应解释为“系统根据答题行为初步判断”，避免用户误以为 AI 已经确定了错误原因。

## 3. 新功能：备考成熟度

### 3.1 用户问题

个人页应回答一个更高阶的问题：

> 我现在距离准备成熟还差多远？

这个问题比“答了多少题”“正确率多少”“掌握度多少”更贴近用户真实焦虑。

当前页面已经有很多局部指标：

- 总答题数。
- 正确率。
- 科目掌握度。
- 薄弱点数量。
- 最近模考分数。
- 未答题数量。
- 错因趋势。
- 到期复盘。
- 学习节奏。

但用户需要自己把这些指标合成判断。个人页应该替用户完成这一步。

### 3.2 产品定位

新增“备考成熟度”模块，放在个人页总览顶部，作为学习驾驶舱的总判断。

它不是简单的分数展示，而是一个聚合诊断：

- 当前阶段。
- 成熟度分数。
- 最大差距。
- 下一阶段目标。
- 推荐行动。

示例：

```text
备考成熟度
基础积累中 · 28/100

距离稳定应考还差：
1. 数学掌握度仍偏低，优先补 12 个薄弱点。
2. 最近模考 25 分，建议先冲到 60+。
3. 近 30 天只有 1 天有效训练，节奏还不稳定。

下一阶段目标：
完成 3 轮数学训练 + 1 次完整模考。
```

### 3.3 维度设计

成熟度建议拆成四个维度，而不是只给一个总分。

#### 知识掌握

输入：

- `subjects[].masteryAvg`
- `subjects[].weakTopicCount`
- `subjects[].answeredCount`
- 是否完成诊断

表达：

- 哪个科目最拖后腿。
- 还有多少薄弱 topic。
- 是否仍缺基础诊断证据。

#### 模考表现

输入：

- `mockTrend.latest.score`
- `mockTrend.latest.unansweredCount`
- `mockTrend.recent`
- `mockTrend.subjectStats`

表达：

- 最近一次模考分数。
- 未答题是否过多。
- 是否完成过完整模考。
- 是否需要从专项训练转入 CBT 节奏训练。

#### 错题修复

输入：

- `wrongPatternTrend[].activeCount`
- `wrongPatternTrend[].dueCount`
- `wrongPatterns[]`
- `reviewQueue.summary.dueToday`

表达：

- 高频错因是否仍活跃。
- 今日是否有必须复盘项。
- 错因是否开始改善。

#### 学习节奏

输入：

- `summary.activeDaysLast30`
- `summary.practiceMinutesThisWeek`
- `rhythmEvaluation.status`
- `rhythmEvaluation.answeredLast14`
- `summary.currentStreakDays`

表达：

- 训练是否稳定。
- 最近两周题量是否足够。
- 是否只是短期冲刺、缺少连续证据。

### 3.4 阶段文案

建议避免“未成熟”“不合格”这类挫败感强的词。

可用阶段：

- `刚开始定位`：诊断或题量证据不足。
- `基础积累中`：有训练数据，但掌握度和模考分偏低。
- `薄弱修复中`：已有错题和模考，正在补短板。
- `考前强化中`：分数接近目标，但节奏或错题仍需稳住。
- `接近稳定应考`：模考、掌握度、错题和节奏都较稳定。

### 3.5 初版评分建议

总分 100，可先用规则计算，不需要 AI。

建议权重：

- 知识掌握：35 分。
- 模考表现：30 分。
- 错题修复：20 分。
- 学习节奏：15 分。

初版不需要绝对精确，关键是可解释。

示例规则：

- 没有完成任何诊断或总答题少于 20：阶段为 `刚开始定位`。
- 最近模考低于 40：模考表现上限 12/30。
- 任一核心科目 mastery 低于 40：知识掌握上限 18/35。
- 到期复盘数大于 0：错题修复扣分，并提示先处理。
- 近 30 天有效训练少于 4 天：学习节奏扣分。

### 3.6 推荐行动生成

成熟度模块必须给行动，不只是分数。

推荐行动优先级：

1. 有未完成诊断：先完成对应科目诊断。
2. 有到期复盘：先复盘到期错因。
3. 最近模考分低且 weak topics 多：回科目训练补弱项。
4. 掌握度尚可但未答多：进入模考节奏训练。
5. 数据不足：完成一轮 5 题训练或一次完整模考。

### 3.7 后端接口建议

在 `LearningDashboardResponse` 中新增字段：

```ts
readiness: {
  score: number;
  stage: 'diagnosing' | 'building' | 'repairing' | 'reinforcing' | 'exam_ready';
  title: string;
  body: string;
  dimensions: Array<{
    key: 'mastery' | 'mock' | 'review' | 'rhythm';
    label: string;
    score: number;
    maxScore: number;
    status: 'strong' | 'steady' | 'weak' | 'insufficient';
    evidence: string;
  }>;
  blockers: string[];
  nextMilestone: string;
  nextAction: {
    title: string;
    body: string;
    ctaLabel: string;
    href: string;
  };
}
```

初版完全由规则生成。AI 周报可以引用这个结果，但不应该负责计算成熟度。

### 3.8 前端展示建议

放在总览顶部，位置高于热力图和趋势。

结构：

- 左侧：阶段、总分、简短解释。
- 右侧：下一步 CTA。
- 下方：四个维度条。
- 再下方：最多 3 个 blocker。

示例：

```text
备考成熟度
基础积累中 · 28/100
当前证据显示：你已经开始训练，但知识掌握、模考分数和学习节奏都还没有稳定。

[继续数学训练]

知识掌握 12/35
模考表现 8/30
错题修复 5/20
学习节奏 3/15

主要差距：
- 数学掌握度 21%，还有 12 个薄弱点。
- 最近模考 25 分，先冲到 60+。
- 近 30 天只有 1 天有效训练。
```

## 4. 信息架构调整建议

### 4.1 总览页建议顺序

推荐顺序：

1. 备考成熟度。
2. 今天最该做什么。
3. 今日复盘。
4. 科目掌握。
5. 模考表现。
6. 学习节奏。
7. 错因模式。
8. 申请准备摘要。

热力图和 30 天趋势可以降级，不要抢占第一屏。

### 4.2 练习与模考页建议顺序

推荐顺序：

1. 进行中的训练/模考。
2. 到期复盘。
3. 高频错因包。
4. 最近错题。
5. 完整错题本筛选器。
6. 历史记录。

这样更符合学生使用路径：先继续未完成任务，再处理复盘，再查历史。

### 4.3 设置、订单、申请功能

这些功能保留，但不应和学习驾驶舱同权重竞争。

建议：

- 账号设置保持独立 tab。
- 订单服务保持独立 tab。
- 短名单和学校对比合并为“申请准备”或弱化在总览下方。

## 5. 技术债与拆分建议

`PublicMePage.tsx` 当前职责过多，后续继续扩展会增加维护风险。

建议拆分：

- `MeLearningDashboard.tsx`
- `MeReadinessCard.tsx`
- `MeReviewQueue.tsx`
- `MeWrongQuestionBank.tsx`
- `MeApplicationWorkspace.tsx`
- `MeSettingsPanel.tsx`
- `me-copy.ts`

优先拆：

1. `LearningReviewQueue`
2. `MeWrongQuestionBank`
3. 新增的 `MeReadinessCard`

## 6. 推荐执行顺序

### 阶段 A：可理解性修正

- 今日复盘只显示到期项。
- 完成复盘后明确展示下次复盘时间。
- 错因复习包数字加单位。
- 错题筛选器默认折叠。

### 阶段 B：备考成熟度 MVP

- 后端新增 `readiness` 聚合字段。
- 前端总览顶部新增成熟度卡。
- 用规则生成分数、阶段、blockers 和 next action。
- 加规则测试覆盖典型状态：新用户、训练中、模考低分、接近成熟。

### 阶段 C：信息架构收束

- 总览降噪，减少同级卡片数量。
- 申请相关信息下沉。
- 练习与模考页改成“任务优先”。

### 阶段 D：更强闭环

- “复盘完成”与真实复盘/重练行为绑定。
- `nextReviewAt` 根据重练结果动态调整。
- 高频错因包支持一键进入定向训练。

## 7. 解决与优化方案

本节把前面的评审建议落成可执行方案。目标不是一次性重做个人页，而是在现有数据和组件基础上，用最小风险把个人页从“数据展示”推进到“备考指挥台”。

### 7.1 目标用户路径

用户进入个人页后，优先完成这条路径：

```text
看到备考成熟度 -> 理解最大差距 -> 执行今天最重要的一件事 -> 复盘到期错因 -> 查看完整错题/历史
```

这条路径应覆盖三种典型用户：

- 新用户：还没有足够训练证据，需要先完成诊断。
- 训练中用户：有错题和薄弱点，需要知道先补哪里。
- 冲刺用户：有模考成绩，需要知道离稳定应考还差速度、正确率还是节奏。

### 7.2 总览页 MVP 结构

总览页首屏建议改成：

```text
[个人基础信息和关键指标]

[备考成熟度]
阶段 + 分数 + 主要差距 + 下一步按钮

[今天最该做]
1 个主任务，最多 2 个辅助任务

[今日复盘]
只显示到期错因

[学科掌握 / 模考表现 / 学习节奏]
三张压缩卡，点击进入详情

[申请准备摘要]
短名单、对比、订单压到下方
```

当前的热力图、30 天趋势、AI 周报、长期反馈都可以保留，但不应全部在首屏同级出现。初版可以先把它们移动到成熟度卡之后，并降低视觉权重。

### 7.3 备考成熟度后端规则

新增 `readiness` 聚合字段时，优先用规则实现。规则必须可解释、可测试、可回退。

#### 7.3.1 输入数据

优先复用 `LearningDashboardResponse` 已经拥有的数据：

- `summary.totalAnswered`
- `summary.accuracy`
- `summary.activeDaysLast30`
- `summary.practiceMinutesThisWeek`
- `subjects`
- `masteryTrend`
- `wrongPatternTrend`
- `rhythmEvaluation`
- `mockTrend`
- `wrongPatterns`
- `reviewQueue.summary.dueToday`，可在 dashboard 服务内复用同类计算，不一定直接依赖 review queue API。

#### 7.3.2 分数规则

初版总分 100：

```text
知识掌握 35
模考表现 30
错题修复 20
学习节奏 15
```

建议规则：

- 知识掌握：
  - 没有任何科目 mastery：0-8 分。
  - 最强科目 mastery < 40：最高 18 分。
  - 任一已训练科目 weakTopicCount >= 10：扣 5-10 分。
  - 三科都有训练证据且平均 mastery >= 70：可进入 28+。

- 模考表现：
  - 没有完整模考：0-8 分。
  - 最近模考 < 40：最高 12 分。
  - 最近模考 40-59：13-20 分。
  - 最近模考 60-79 且未答不高：21-26 分。
  - 最近模考 >= 80 且近两次稳定：27-30 分。

- 错题修复：
  - 没有错题数据且训练题量不足：标记 `insufficient`，给 4-8 分。
  - 到期复盘 > 0：扣 4-8 分。
  - 高频 active wrong patterns 多：扣 4-8 分。
  - 大部分错因为 improving 且到期少：可进入 14+。

- 学习节奏：
  - activeDaysLast30 < 3：0-4 分。
  - activeDaysLast30 3-7：5-9 分。
  - activeDaysLast30 8-14 且最近两周题量足够：10-13 分。
  - activeDaysLast30 >= 15 且 rhythmEvaluation 为 strong：14-15 分。

#### 7.3.3 阶段判定

阶段不要只按总分判定，还要看关键证据是否缺失。

```text
diagnosing:
  totalAnswered < 20 或没有诊断/掌握度证据

building:
  有训练证据，但最近模考缺失或 < 40，或主要科目 mastery < 45

repairing:
  有模考和错题证据，主要问题是 weak topics / due reviews / active wrong patterns

reinforcing:
  最近模考 >= 60，掌握度中等以上，但节奏或错题仍不稳定

exam_ready:
  最近模考 >= 75，主要科目 mastery >= 70，到期复盘少，节奏 steady/strong
```

#### 7.3.4 Blockers 生成

最多输出 3 条 blocker，按影响排序。

优先级：

1. 缺诊断或训练证据不足。
2. 最近模考分数低。
3. 未答题多或总用时异常。
4. 某科 mastery 明显低。
5. weakTopicCount 高。
6. due review 高。
7. activeDaysLast30 低。

文案必须具体，避免泛泛而谈。

可用文案：

```text
数学掌握度 21%，还有 12 个薄弱点。
最近模考 25 分，距离稳定应考还需要先冲到 60+。
近 30 天只有 1 天有效训练，节奏证据还不足。
今天有 3 个到期错因，建议先完成复盘。
```

#### 7.3.5 Next Action 生成

成熟度卡只给一个主 CTA，不要给多个同权重按钮。

优先级：

1. `start_diagnostic`：缺诊断。
2. `review_due_patterns`：有到期复盘。
3. `continue_active_round`：有未完成训练。
4. `repair_weak_subject`：低 mastery + weak topics。
5. `resume_mock_attempt`：有未完成模考。
6. `start_mock_exam`：知识掌握尚可但缺模考证据。
7. `keep_training`：维持节奏。

### 7.4 前端展示方案

新增 `MeReadinessCard`，放在 `LearningDashboardPanel` 顶部，位于现有 `me-learning-hero` 之后或替代部分 hero 内容。

#### 7.4.1 桌面布局

```text
┌──────────────────────────────────────────────┐
│ 备考成熟度                    28/100          │
│ 基础积累中                                    │
│ 当前证据显示：你已经开始训练，但模考和掌握度... │
│                                              │
│ [继续数学训练]                                │
│                                              │
│ 知识掌握 12/35  ███░░░                       │
│ 模考表现  8/30  ██░░░░                       │
│ 错题修复  5/20  ██░░░░                       │
│ 学习节奏  3/15  █░░░░░                       │
│                                              │
│ 主要差距                                      │
│ - 数学掌握度 21%，还有 12 个薄弱点。           │
│ - 最近模考 25 分，先冲到 60+。                │
└──────────────────────────────────────────────┘
```

#### 7.4.2 移动端布局

移动端不要横向进度复杂排版，使用纵向：

```text
备考成熟度
基础积累中 · 28/100

当前最大差距
数学掌握度 21%，还有 12 个薄弱点。

[继续数学训练]

四个维度折叠/短条展示
```

#### 7.4.3 视觉原则

- 这张卡是总览主卡，视觉权重高于热力图和错题趋势。
- 不使用夸张红色恐吓用户，弱项用 amber/teal 的状态区分。
- 分数是辅助，阶段和差距文案是主信息。
- CTA 必须明确说明动作，例如“继续数学训练”“复盘 3 个到期错因”“开始一次数学模考”。

### 7.5 今日复盘优化方案

当前已修正为只显示到期项。下一步建议：

- 标题保留“今日复盘”。
- 空状态显示“今天没有必须复盘的错因”，同时提供次级入口“查看错因模式”。
- 到期项上显示“为什么要复盘”：例如“重复 3 次 · 5 天未复盘”。
- 完成按钮文案改为“标记已复盘”。
- 如果用户没有展开解析或进入科目，按钮可降级为次级样式，避免暗示已经完成真实练习。

更严格版本：

```text
今日复盘项 -> 点击进入复盘 -> 查看错题/解析/错因 -> 标记已复盘 -> 安排下次复盘
```

### 7.6 错题本优化方案

练习与模考 tab 建议改为任务优先：

```text
1. 进行中
   - 未完成训练
   - 未完成模考

2. 到期复盘
   - 到期错因包
   - 到期错题

3. 高频错因
   - 复习包卡片，带题数和到期数

4. 最近错题
   - 默认 5-8 道

5. 完整错题本
   - 折叠筛选器
   - 高级筛选

6. 历史记录
```

筛选器默认折叠：

```text
[数学] [到期] [模考错题] [公式混淆] [更多筛选]
```

只有点击“更多筛选”后才展示学科、模块、知识点、标签、错因五个 select。

### 7.7 文案替换建议

建议替换：

| 当前文案 | 建议文案 | 原因 |
|---|---|---|
| 复盘完成 | 标记已复盘 | 更准确，不暗示系统验证了学习效果 |
| 后续复习 | 下次复习 | 更像排期，不像任务状态 |
| 错因复习包 | 高频错因包 | 用户更容易理解 |
| 低置信度归因 | 初步归因 | 更自然，减少技术感 |
| 统一错题本 | 错题复盘 | 更面向用户任务 |

### 7.8 验收标准

#### 产品验收

- 用户进入个人页首屏能看到备考成熟度阶段和分数。
- 用户能看到最多 3 条具体差距，不需要自行解读多张图表。
- 用户能看到一个明确主 CTA。
- 今日复盘为 0 时，不显示可完成的复盘任务。
- 点“标记已复盘”后，该任务从今日复盘消失，并显示下次复盘时间。
- 错题本默认不展示 5 个大型筛选器。
- 错因复习包数字有单位，用户能理解题数和到期数。

#### 技术验收

- `LearningDashboardResponse` 返回 `readiness`。
- 规则测试覆盖至少 5 个场景：
  - 新用户/数据不足。
  - 训练中但无模考。
  - 模考低分。
  - 到期复盘多。
  - 接近稳定应考。
- 前端构建通过。
- 浏览器验证桌面和移动端无横向溢出。
- `/zh/me` 无 console error。

#### 不做范围

初版不做：

- AI 计算成熟度。
- 宣称“官方通过概率”。
- 宣称“48 维完整诊断”。
- 宣称“3 届验证”。
- 将成熟度作为付费门槛。

成熟度是学习建议，不是考试结果承诺。

### 7.9 实施任务拆分

#### 后端任务

1. 在 `csca-learning.types.ts` 增加 `LearningReadiness` 类型。
2. 在 `CscaLearningService.getDashboard` 中调用 `buildReadiness(...)`。
3. 实现 `buildReadiness` 纯函数，输入 dashboard 聚合数据，输出 score/stage/dimensions/blockers/nextAction。
4. 添加规则测试脚本，覆盖典型用户状态。
5. 保持 AI insight 只引用 readiness，不参与 readiness 计算。

#### 前端任务

1. 在 `frontend/src/lib/api-types.ts` 增加 `readiness` 类型。
2. 新增 `MeReadinessCard` 组件。
3. 将 `MeReadinessCard` 放到 `LearningDashboardPanel` 顶部。
4. 调整总览模块顺序，降低热力图和趋势权重。
5. 将错题筛选器折叠到“更多筛选”。
6. 修改复盘文案和完成反馈。

#### 样式任务

1. 新增 `.me-readiness-card` 样式。
2. 新增维度条样式。
3. 移动端纵向布局。
4. 保证按钮文字不溢出。
5. 保证成熟度卡不变成营销 hero，而是工作台主摘要。

## 8. 可执行实施蓝图

上一节已经给出方案，本节补齐到可以直接拆 PR 的程度。

### 8.1 推荐 PR 拆分

#### PR 1：后端 readiness 规则层

目标：

- 不动前端布局。
- 只让 `/api/v1/me/learning-dashboard` 返回 `readiness`。
- 增加规则测试。

改动文件：

- `backend/src/csca-learning/csca-learning.types.ts`
- `backend/src/csca-learning/csca-learning.service.ts`
- `frontend/src/lib/api-types.ts`
- `scripts/csca-learning-dashboard-rules-test.cjs`

验收：

- `node scripts\csca-learning-dashboard-rules-test.cjs`
- `backend\node_modules\.bin\tsc.cmd -p backend\tsconfig.json --pretty false --noEmit --incremental false`

#### PR 2：前端成熟度卡

目标：

- 在总览顶部展示 `MeReadinessCard`。
- 暂不重排整个个人页。
- 保持没有 `readiness` 字段时向后兼容。

改动文件：

- `frontend/src/pages/PublicMePage.tsx`
- `frontend/src/styles/account.css`

验收：

- `npm --prefix frontend run build`
- 浏览器验证 `/zh/me` 桌面和移动端。

#### PR 3：今日复盘与错题本可理解性

目标：

- 今日复盘只显示到期项。
- 文案改为“标记已复盘”。
- 错因包数字加单位。
- 错题筛选器折叠。

改动文件：

- `frontend/src/pages/PublicMePage.tsx`
- `frontend/src/styles/account.css`
- 必要时扩展 `scripts/csca-wrong-questions-rules-test.cjs`

验收：

- 今日复盘为 0 时不显示完成按钮。
- 错因包可读为“X 道相关错题 · Y 道到期”。
- 前端构建通过。

#### PR 4：总览信息架构收束

目标：

- 降低热力图、趋势、AI 周报的首屏权重。
- 申请准备摘要下沉。
- 形成“成熟度 -> 今日任务 -> 关键状态”的阅读顺序。

这个 PR 适合在 readiness 卡上线并验证数据后做。

### 8.2 后端类型细化

建议新增类型：

```ts
export type LearningReadinessStage =
  | 'diagnosing'
  | 'building'
  | 'repairing'
  | 'reinforcing'
  | 'exam_ready';

export type LearningReadinessDimensionKey = 'mastery' | 'mock' | 'review' | 'rhythm';

export type LearningReadinessDimensionStatus = 'strong' | 'steady' | 'weak' | 'insufficient';

export type LearningReadiness = {
  score: number;
  stage: LearningReadinessStage;
  title: string;
  body: string;
  dimensions: Array<{
    key: LearningReadinessDimensionKey;
    label: string;
    score: number;
    maxScore: number;
    status: LearningReadinessDimensionStatus;
    evidence: string;
  }>;
  blockers: string[];
  nextMilestone: string;
  nextAction: {
    type:
      | 'start_diagnostic'
      | 'review_due_patterns'
      | 'continue_active_round'
      | 'repair_weak_subject'
      | 'resume_mock_attempt'
      | 'start_mock_exam'
      | 'keep_training';
    title: string;
    body: string;
    ctaLabel: string;
    href: string;
  };
};
```

然后在 `LearningDashboardResponse` 中增加：

```ts
readiness: LearningReadiness;
```

### 8.3 后端纯函数设计

建议把 readiness 计算做成纯函数，降低回归风险。

函数签名：

```ts
function buildReadiness(input: {
  language: LearningDashboardLanguage;
  summary: LearningDashboardResponse['summary'];
  subjects: LearningDashboardSubject[];
  masteryTrend: LearningDashboardResponse['masteryTrend'];
  wrongPatternTrend: LearningDashboardResponse['wrongPatternTrend'];
  rhythmEvaluation: LearningDashboardResponse['rhythmEvaluation'];
  mockTrend: LearningDashboardResponse['mockTrend'];
  wrongPatterns: LearningDashboardResponse['wrongPatterns'];
  dueReviewCount: number;
  activeRound: { id: number; subject: string } | null;
}): LearningReadiness
```

`dueReviewCount` 可以来自已有 `wrongPatterns` 和 `nextReviewAt` 计算，也可以在 `getDashboard` 内额外计算，初版不需要直接调用 `getWrongPatternReviewQueue`，避免 dashboard 查询互相套娃。

### 8.4 精确评分算法 MVP

下面给出足够可实现的初版规则。后续可以调权重，但第一版应保持简单。

#### 8.4.1 知识掌握分

输入：`subjects`

计算：

```text
trainedSubjects = subjects where answeredCount > 0
masteryValues = trainedSubjects where masteryAvg is number
avgMastery = average(masteryValues)
maxWeakTopics = max(weakTopicCount)
```

规则：

```text
if trainedSubjects.length === 0:
  score = 0
  status = insufficient
else if masteryValues.length === 0:
  score = min(8, trainedSubjects.length * 3)
  status = insufficient
else:
  base = round(avgMastery / 100 * 35)
  weakPenalty = min(10, maxWeakTopics)
  score = clamp(base - weakPenalty, 6, 35)
```

状态：

```text
score <= 8: insufficient
score <= 18: weak
score <= 27: steady
score >= 28: strong
```

#### 8.4.2 模考表现分

输入：`mockTrend`

规则：

```text
if !mockTrend.latest:
  score = 0
  status = insufficient
else:
  score = round(mockTrend.latest.score / 100 * 30)
  if latest.unansweredCount >= 8: score -= 4
  if recent.length >= 2 and latest.score >= previous.score: score += 2
  score = clamp(score, 4, 30)
```

状态：

```text
no latest: insufficient
latest.score < 40: weak
latest.score < 70: steady
latest.score >= 70: strong
```

#### 8.4.3 错题修复分

输入：`wrongPatternTrend`, `wrongPatterns`, `dueReviewCount`

计算：

```text
activeCount = sum(wrongPatternTrend.activeCount)
dueCount = dueReviewCount or sum(wrongPatternTrend.dueCount)
highPriorityCount = wrongPatterns where priority === 'high'
improvingCount = wrongPatterns where status === 'improving'
```

规则：

```text
if activeCount === 0 and wrongPatterns.length === 0:
  score = 10
  status = insufficient
else:
  score = 20
  score -= min(8, dueCount * 2)
  score -= min(6, highPriorityCount * 2)
  if improvingCount >= 2: score += 2
  score = clamp(score, 4, 20)
```

状态：

```text
score <= 8: weak
score <= 14: steady
score >= 15: strong
```

#### 8.4.4 学习节奏分

输入：`summary`, `rhythmEvaluation`

规则：

```text
score = 0
if activeDaysLast30 >= 3: score += 4
if activeDaysLast30 >= 8: score += 4
if activeDaysLast30 >= 15: score += 3
if rhythmEvaluation.answeredLast14 >= 40: score += 2
if currentStreakDays >= 3: score += 2
score = clamp(score, 0, 15)
```

状态：

```text
score <= 4: weak
score <= 9: steady
score >= 10: strong
```

### 8.5 阶段判定精确规则

按以下顺序判定：

```text
if summary.totalAnswered < 20 or mastery.status === insufficient:
  diagnosing
else if !mockTrend.latest or mock.score < 12 or mastery.score < 18:
  building
else if review.score < 12 or dueReviewCount > 0 or wrongPatterns has high priority:
  repairing
else if totalScore >= 65 and mock.score >= 18 and mastery.score >= 22:
  reinforcing
else if totalScore >= 78 and mock.score >= 22 and mastery.score >= 26 and review.score >= 15 and rhythm.score >= 10:
  exam_ready
else:
  repairing
```

注意：`exam_ready` 判断必须放在 `reinforcing` 前，或者在实现时先判断最高阶段。

更稳妥的顺序：

```text
if diagnosing condition -> diagnosing
if exam_ready condition -> exam_ready
if reinforcing condition -> reinforcing
if repairing condition -> repairing
else -> building
```

### 8.6 Blockers 选择算法

每个候选 blocker 带 `priority`，最后取前 3 条。

候选：

```text
priority 100: totalAnswered < 20
priority 95: no mastery data
priority 90: no mock exam
priority 85: latest mock score < 40
priority 80: dueReviewCount > 0
priority 75: weakest subject mastery < 45
priority 70: max weakTopicCount >= 8
priority 60: activeDaysLast30 < 4
priority 55: latest mock unansweredCount >= 8
priority 50: highPriority wrong patterns > 0
```

示例实现形态：

```ts
const blockers = candidates
  .filter((item) => item.active)
  .sort((a, b) => b.priority - a.priority)
  .slice(0, 3)
  .map((item) => item.message);
```

### 8.7 Next Action 精确规则

按顺序返回第一个满足的 action：

```text
1. activeRound exists:
   type = continue_active_round
   href = /zh/csca-subjects/:subject/practice/rounds/:id

2. totalAnswered < 20 or no mastery:
   type = start_diagnostic
   href = /zh/csca-subjects/math

3. dueReviewCount > 0:
   type = review_due_patterns
   href = /zh/me?section=overview#review-queue

4. weakest trained subject mastery < 55:
   type = repair_weak_subject
   href = weakestSubject.href

5. no mockTrend.latest and avgMastery >= 45:
   type = start_mock_exam
   href = /zh/csca-mock-exam

6. latest mock has unansweredCount >= 8:
   type = start_mock_exam
   href = /zh/csca-mock-exam/:subject

7. default:
   type = keep_training
   href = weakestSubject.href or /zh/csca-subjects/math
```

如果 `href` 带 locale，前端现有 `stripLocalePrefix` 能处理；但建议后端统一返回 `/zh/...`，保持和现有 dashboard 行为一致。

### 8.8 文案字典

成熟度文案要进入 `dashboardCopy(language)`，不要硬编码在算法里。

中文建议：

```ts
readiness: {
  title: '备考成熟度',
  stages: {
    diagnosing: '刚开始定位',
    building: '基础积累中',
    repairing: '薄弱修复中',
    reinforcing: '考前强化中',
    exam_ready: '接近稳定应考'
  },
  dimensionLabels: {
    mastery: '知识掌握',
    mock: '模考表现',
    review: '错题修复',
    rhythm: '学习节奏'
  },
  statusLabels: {
    strong: '稳定',
    steady: '推进中',
    weak: '偏弱',
    insufficient: '证据不足'
  }
}
```

英文/越南语可以先直译，必须保证字段存在，避免前端 fallback 到 key。

### 8.9 前端组件契约

新增组件：

```tsx
function MeReadinessCard({
  readiness,
  copy,
  onNavigate
}: {
  readiness: LearningDashboard['readiness'] | null | undefined;
  copy: ReturnType<typeof learningCopy>;
  onNavigate: (href: string) => void;
}) {
  if (!readiness) return null;
  ...
}
```

渲染规则：

- `readiness.score` 显示为 `score/100`。
- `readiness.stage` 不直接显示 key，显示后端返回的 `title`。
- 维度条宽度：`score / maxScore * 100%`。
- blockers 最多渲染 3 条。
- `nextAction` CTA 使用 `onNavigate(stripLocalePrefix(readiness.nextAction.href))`。
- 如果 `nextAction` 缺失，隐藏按钮，不渲染 disabled 按钮。

### 8.10 样式落点

新增样式块建议放在 `account.css` 学习驾驶舱样式附近，即 `.me-learning-dashboard` 后。

类名：

```css
.me-readiness-card
.me-readiness-main
.me-readiness-score
.me-readiness-dimensions
.me-readiness-dimension
.me-readiness-bar
.me-readiness-bar span
.me-readiness-blockers
.me-readiness-actions
```

响应式：

```css
@media (max-width: 720px) {
  .me-readiness-main {
    grid-template-columns: 1fr;
  }
  .me-readiness-score {
    align-items: flex-start;
  }
}
```

### 8.11 测试用例矩阵

在 `scripts/csca-learning-dashboard-rules-test.cjs` 增加 readiness 测试，或新建 `scripts/csca-learning-readiness-rules-test.cjs`。

建议测试：

| 场景 | 输入特征 | 期望 |
|---|---|---|
| 新用户 | totalAnswered 0，无 mastery，无 mock | stage `diagnosing`，score 低，action `start_diagnostic` |
| 刚完成诊断 | totalAnswered 20，mastery 低，无 mock | stage `building`，blocker 提到掌握度/模考证据 |
| 模考低分 | latest mock 25，mastery 低 | stage `building` 或 `repairing`，blocker 提到模考分 |
| 到期复盘多 | dueReviewCount 3，wrongPatterns high | stage `repairing`，action `review_due_patterns` |
| 节奏不足 | activeDaysLast30 1，其它中等 | rhythm dimension `weak`，blocker 提到节奏 |
| 接近成熟 | mock >= 80，mastery >= 75，due 0，rhythm strong | stage `exam_ready`，score >= 78 |
| 有 active round | activeRound 存在 | action 优先 `continue_active_round` |

### 8.12 浏览器验收脚本

人工或 Playwright 验收步骤：

1. 打开 `/zh/me`。
2. 验证首屏出现“备考成熟度”。
3. 验证存在 `score/100`。
4. 验证最多 4 个维度条。
5. 验证最多 3 条主要差距。
6. 点击 CTA，确认跳转到对应训练/复盘/模考路径。
7. 缩窄到移动宽度，确认无横向滚动。
8. 切到“练习与模考”，确认筛选器默认折叠。

### 8.13 风险与决策

#### 风险 1：分数被用户理解为官方通过概率

处理：

- 文案使用“备考成熟度”，不要使用“通过率”“录取概率”“考试通过概率”。
- 加说明：基于站内练习、模考和复盘证据估算。

#### 风险 2：规则分数不准

处理：

- 第一版强调可解释，不强调精准。
- blockers 比总分更重要。
- 后续根据真实用户数据调整阈值。

#### 风险 3：总览更拥挤

处理：

- 新增 readiness 卡时必须下沉至少一个旧模块。
- 热力图和趋势不应继续占据首屏主视觉。

#### 风险 4：AI 周报和 readiness 结论冲突

处理：

- AI 周报只引用 readiness 结果，不自行重算。
- fallback 周报也使用 readiness blockers 作为行动建议来源。

### 8.14 Definition of Done

该方案真正完成时，应同时满足：

- 后端 dashboard 返回 readiness。
- readiness 至少覆盖 7 个规则测试场景。
- 个人页首屏展示成熟度卡。
- 用户能看到“还差什么”和“下一步做什么”。
- 今日复盘不再显示非到期可完成项。
- 错题本默认不再暴露大型筛选器。
- 桌面和移动端无明显布局溢出。
- 文案不暗示官方通过率或 48 维完整诊断。

## 9. 结论

个人页下一步最重要的不是继续增加更多数据，而是把已有数据转译成用户能行动的判断。

“备考成熟度”应该成为个人页的核心解释器：

- 它回答用户距离考试准备成熟还差多远。
- 它说明差距来自知识、模考、错题还是节奏。
- 它给出下一阶段目标和最有效行动。

这样个人页才能从“学习数据展览馆”升级为真正的“备考指挥台”。

# CSCA 备考成熟度证据引擎架构方案

> 日期：2026-06-09  
> 范围：个人页备考成熟度、学习驾驶舱、诊断/训练/模考/错因复盘数据闭环  
> 目标：把当前 `43/100` 这类“行动推荐分”升级为用户可信的“证据驱动备考成熟度判断系统”。

## 0. 当前执行状态

截至 2026-06-09，已完成到 Phase 5.3 第三切片的可运行实现：

- Phase 1：`readiness` 已输出 `confidence`、`confidenceReason`、`scoreExplanation`，前端个人页已解释分数不是模考成绩。
- Phase 2：`coverage` 已成为一等证据，准备度维度从 mastery/mock/review/rhythm 扩展为 coverage/mastery/mock/review/rhythm，并加入整体覆盖率、高权重覆盖率和盲区数量。
- Phase 3：准备度已读取最近自适应作答的 `plannedDifficulty`、`usedHint`、`usedExplanation`、`isCorrect`，并用中高难独立作答样本影响 mastery 分、blocker、confidence 和 `exam_ready` 门槛。
- Phase 4：复盘队列和错因卡片已区分“未复盘 / 已复盘待验证 / 已验证修复”，完成复盘后会返回带 `topicId` 的验证训练入口，科目页会自动创建同知识点聚焦训练轮；readiness 的 review 维度会因待验证修复扣分，并阻止 `exam_ready`。
- Phase 5 第二切片：`readiness.nextActions` 已返回最多 3 个按 `expectedGain` 排序的动作，保留 `nextAction` 作为第一优先动作兼容旧前端；前端会展示预计收益和独立 `reason`，并记录用户点击建议动作的 `readiness_action_clicked` 事件用于后续校准。
- Phase 5.3 第一切片：`readiness.actionOutcome` 已按最近 14 天建议点击计算跟进情况，能识别点击后 24 小时内的诊断、训练、模考提交和复盘验证证据，并在个人页以“建议反馈”轻量展示。
- Phase 5.3 第二切片：后台训练事件 observability 已聚合 readiness recommendation 的点击数、跟进数、跟进率、平均 expectedGain、整体状态和 action type 分组，Admin Audit 页面已展示成熟度建议总体卡片和分组列表。
- Phase 5.3 第三切片：`expectedGain` 已接入最近 30 天全局 action type 校准系数；每个推荐动作保留 `baseExpectedGain`，并输出 `calibration` 元数据。样本数不足 5 时不调整，足够样本下根据 24 小时跟进率在 0.82 到 1.12 之间保守调节排序收益。
- PR 9 第一切片：`actionOutcome` 和 action type `calibration` 已加入 `abilityLiftRate`。系统会用点击后 7 天内的复盘验证/正确证据、模考相对上一场提分、topic mastery 达到可信水平来判断建议是否真的带来能力改善，并把个人页建议反馈从“跟进率”扩展到“能力改善率”。
- PR 9b 第一半：新增 `csca_readiness_action_calibration_snapshots`，按日期和 action type 持久化 clicked/followed/abilityLift、rate、multiplier/status；dashboard 会优先读取最近快照，缺失时回退实时聚合并 best-effort 写入今日快照。
- PR 9c：`readiness_action_clicked` 会保存点击时最弱 topic 的 `masteryBaseline`；训练/补弱类 ability lift 会优先比较点击前后同 topic mastery delta，`actionOutcome`、`calibration` 和每日快照都输出 `averageMasteryDelta`。
- PR 9d：新增管理员主动刷新 readiness action calibration snapshot 的入口；dashboard 缺快照时只做实时只读回退，不再承担写快照职责。Admin Audit 页面可手动刷新，并写入后台审计日志。
- PR 9e：新增轻量定时刷新服务，按北京时间每日低峰复用主动刷新入口生成 readiness action calibration snapshot；默认关闭，可通过 `CSCA_READINESS_CALIBRATION_SCHEDULE_ENABLED` 和 hour/minute 环境变量启用。
- PR 10 第一切片：分学科中高难样本阈值从纯硬编码升级为默认阈值、单科环境覆盖和近 30 天 sampled distribution 推荐三层策略；dashboard 会返回每科 `requiredCount`、`recommendedCount`、`sampleSize` 和 `source`，默认仍使用保守静态阈值。
- PR 10b：Admin Audit 的训练事件 observability 已展示中高难阈值分布摘要，包含 mode、最小样本、每科 recommended/current threshold、sampleSize、p50/p60/p80、source，以及 sampled 模式相对默认阈值的影响 user-subject 数。
- PR 11：Admin Audit 已新增 readiness calibration health alerts，会检查最近校准快照是否缺失、过期、为空，是否存在 `needs_calibration` 的建议 action type，以及 sampled distribution 模式下各学科样本是否不足。
- PR 12：Admin Audit 已新增 sampled-threshold rollout checklist and acceptance metrics，将样本量、校准健康、影响人数上限和 sampled mode 开关拆成发布门槛；默认 `CSCA_READINESS_SAMPLED_THRESHOLD_MAX_IMPACT_USER_SUBJECTS=5`，超出则提示暂不发布。
- PR 13：清理 readiness 相关前端类型债，`frontend` 的 `tsc --noEmit` 已通过；新增 `npm run csca-readiness:release-gate`，用内存 stub 验证 sampled 阈值发布门禁在健康样本下通过、样本不足时阻断。
- PR 14：`verify:local` 已接入 `npm run csca-readiness:release-gate`；`docs/ops-runbook.md` 已新增 sampled 阈值上线/回滚 runbook，明确默认 static、Admin Audit 检查项、sampled 开启步骤和回滚步骤。
- PR 15：新增 `npm run csca-readiness:evidence`，可生成 sampled 阈值上线前、上线后和回滚阶段的 evidence JSON；未配置 Admin 凭证时输出 fixture 模板，配置 `CSCA_READINESS_EVIDENCE_BASE_URL` 与 token 或管理员账号后从 Admin API 拉取真实观测。
- PR 16：新增最终交接文档 `docs/readiness-final-handoff.md`，汇总用户侧能力、Admin/Ops 入口、环境变量、发布/回滚步骤、验证矩阵和剩余可选项。
- PR 17：新增 `npm run csca-readiness:evidence:compare`，自动比较 readiness evidence 的 before/after 文件，输出模式、发布状态、影响人数、校准健康、阻断告警和 checklist 差异；发布后发现阻断风险时返回非 0。
- PR 18：compare 支持 `--write`，可把 sanitized comparison evidence 写入 `RELEASE_EVIDENCE_DIR`，用于发布审批留档；默认选取 latest pair 时会排除 comparison 文件，避免把对比结果误当作原始 evidence。
- PR 19：Admin API 与 Admin Audit 页面已支持 readiness evidence 历史列表和单份 JSON 下载，文件名做白名单校验，读取范围限制在 `RELEASE_EVIDENCE_DIR`。
- PR 20：新增 `docs/readiness-copy-guidelines.md`，并先清理个人页中文 readiness 文案，把“成熟度、置信度、证据充分度、校准、能力改善率、难度 topic 信号”等内部术语替换为“准备度、系统把握、判断依据、建议有效率、不同难度练习记录”等更容易理解的表达。
- PR 21：同步清理个人页英文和越南语 readiness 文案，避免 `confidence`、`evidence sufficiency`、`ability lift`、`tuning`、`topic signal`、`hiệu chỉnh` 等内部/统计口径直接暴露给学生。
- PR 22：清理 Admin Audit readiness 区块的运营侧文案，把“成熟度校准、成熟度证据、采样阈值、rollout、needs tuning”等表达替换为“准备度建议、建议效果、判断依据、发布门槛、发布记录、需要观察”，让运营页面直接服务发布判断；API、脚本和 evidence JSON 仍保留精确内部字段名。
- PR 23：个人页 readiness 分数旁新增“这分数怎么算？”轻量展开说明，三语解释分数不是模考成绩，而是综合题量覆盖、题目难度、模考节奏和复盘验证来估算离稳定上考场还有多远。
- PR 24：个人页今日复盘按钮从“标记已复盘”升级为“已看懂，去验证 / Understood, verify now / Đã hiểu, xác minh ngay”；完成复盘后如后端返回 `verificationHref`，前端会直接进入同知识点/同错因验证训练，让用户理解复盘闭环不是点击完成，而是要用同类题确认修复。
- PR 25：个人页学习区完成一轮微文案巡检，清理错题包、长期反馈、掌握曲线和建议反馈里的工程/统计表达，把“自动聚合、低置信度归因、topic mastery 快照、recommendation”等替换成学生能理解的“同类错误、错因不太确定、科目掌握随练习更新、建议有没有帮上忙”。
- PR 26：个人页实机复验补齐后端 dashboard 文案清理，把 readiness 标题、分数解释、系统把握、维度 evidence、blocker 和长期学习小结里的内部模型语言继续降复杂度；学生侧不再展示“证据充分度、难度加权 topic 正确率、难度 topic 信号、掌握度证据、规则总结”等表达。

当前已锁定的关键规则：

- 高题量但低覆盖，不能进入 `exam_ready`。
- 基础题高正确率但中高难独立样本不足，不能进入 `exam_ready`，并且 readiness confidence 保持 `low`。
- 高覆盖、高 mastery、高模考、无复盘债、节奏稳定，且三科都有足够中高难独立正确样本，才能进入 `exam_ready`。

当前主线已进入可交接状态。sampled 阈值默认仍保持 `static`，真实发布时按 `docs/ops-runbook.md` 与 `docs/readiness-final-handoff.md` 执行门禁、evidence 生成、上线观察和回滚。

## 1. 核心判断

当前个人页已经实现了备考成熟度 MVP：系统会把掌握度、模考、错因复盘和学习节奏合成一个 `readiness.score`，并给出下一步动作。

但这个 MVP 还不能完全称为成熟评分模型，因为它对三个关键问题处理不足：

- 题量是否足够：已有最小题量判断，但没有按科目、知识点、时间窗口分别评估样本充分度。
- 知识覆盖面是否足够：目前主要通过三科 mastery 和 weakTopicCount 间接判断，缺少显式 topic coverage。
- 题目难度是否足够：当前准备度评分没有显式按 difficulty、题源和考试权重加权。

因此，下一阶段不应只是微调分数公式，而应建设一套 `Readiness Evidence Engine`：

```text
学习事件 -> 证据归一化 -> 知识覆盖计算 -> 难度加权掌握度 -> 成熟度评分 -> 下一步行动排序
```

成熟度分数必须回答两个问题：

- 分数是多少：用户现在离稳定备考成熟还有多远。
- 凭什么：系统基于哪些题量、覆盖、难度、模考、复盘和节奏证据作出判断。

## 2. 设计原则

### 2.1 分数必须带置信度

`43/100` 单独展示会被用户理解为考试成绩或模考成绩。成熟模型必须同时输出：

```ts
{
  score: 43,
  confidence: 'low' | 'medium' | 'high',
  confidenceReason: string
}
```

低置信度时，UI 文案应强调“证据不足”，而不是暗示系统已经准确知道用户水平。

### 2.2 证据不足时不能给确定性结论

例如：

- 数学只做了 5 道简单题，不能判断数学已经成熟。
- 完成很多训练但没做完整模考，不能判断考试节奏成熟。
- 做题很多但集中在少数 topic，不能判断知识覆盖成熟。

证据不足应优先进入 `diagnosing` 或 `building`，下一步动作应是补诊断、补覆盖或补模考。

### 2.3 覆盖面比总题量更重要

100 道题如果都集中在 3 个知识点，不能等价于三科均衡覆盖。成熟模型必须显式计算：

- 每科 topic 总数。
- 已覆盖 topic 数。
- 高权重 topic 覆盖率。
- 低置信 topic 数。
- 完全未触达但应考的 blind spots。

### 2.4 难度要参与 mastery 和 readiness

同一 topic 下：

- 简单题答对，只能证明基础识别。
- 中等题答对，证明可迁移应用。
- 较难/挑战题答对，才更接近成熟。
- 高难题连续答错，比简单题答错更能暴露边界。

因此 readiness 不应只看正确率，而应看 difficulty-adjusted mastery。

### 2.5 下一步动作按预期收益排序

当前 MVP 的 `nextAction` 是规则优先级。成熟模型应升级为：

```ts
nextAction = argmax(expectedReadinessGain)
```

也就是根据当前最短板、证据缺口和可修复性，估算哪个动作最能提升成熟度。

## 3. 分层架构

### 3.1 Evidence Layer：学习证据层

统一归一化所有真实学习事件。

来源：

- 自适应诊断。
- 自适应训练。
- 在线模考。
- 错题复盘。
- AI 解释/提示使用。
- 学习节奏快照。

建议内部证据结构：

```ts
type ReadinessEvidenceEvent = {
  userId: number;
  source: 'diagnostic' | 'adaptive_round' | 'mock_exam' | 'review' | 'ai_assisted';
  subject: 'math' | 'physics' | 'chemistry';
  topicId: number | null;
  questionId: number | null;
  difficulty: '基础' | '中等' | '较难' | '挑战' | null;
  isCorrect: boolean | null;
  isUnanswered: boolean;
  secondsSpent: number | null;
  usedAiHelp: boolean;
  occurredAt: Date;
  weight: number;
};
```

MVP 可以先不落新表，直接由现有表聚合：

- `cscaAdaptiveRound`
- `cscaAdaptiveRoundItem`
- `mockExamAttempt`
- `mockExamAttemptAnswer`
- `cscaWrongPattern`
- `userCscaTopicMastery`
- `cscaLearningDailySnapshot`

中期建议增加只读聚合服务，不急于增加写入表。

### 3.2 Knowledge Coverage Layer：知识覆盖层

覆盖层回答：“用户碰过哪些该考知识点，哪些还没形成有效证据？”

输出结构：

```ts
type SubjectCoverage = {
  subject: CscaLearningSubject;
  totalTopicCount: number;
  coveredTopicCount: number;
  coverageRate: number;
  highWeightCoverageRate: number;
  confidenceReadyTopicCount: number;
  lowConfidenceTopicCount: number;
  blindSpotCount: number;
  blindSpots: Array<{
    topicId: number;
    title: string;
    requiredWeight: number;
    reason: 'not_covered' | 'low_confidence' | 'stale';
  }>;
};
```

覆盖判定建议：

- `covered`：topic 至少出现过 1 次有效作答。
- `confidenceReady`：topic 有足够样本，且至少覆盖基础/中等难度。
- `blindSpot`：高权重 topic 无作答，或长期没有更新。
- `stale`：过去 30/45 天没有触达，confidence 衰减。

初始阈值：

```text
topic 有效样本 >= 3，或诊断/模考中出现 >= 1 且训练中出现 >= 1
高权重 topic 低于 60% 覆盖率时，coverage 维度不得进入 strong
```

### 3.3 Difficulty-Adjusted Mastery Layer：难度加权掌握层

现有 `userCscaTopicMastery` 已有 `mastery/confidence`，可以继续作为基础，但 readiness 应读取难度加权后的解释指标。

建议每个 topic 计算：

```ts
type TopicMasterySignal = {
  topicId: number;
  subject: CscaLearningSubject;
  mastery: number;
  confidence: number;
  attemptCount: number;
  difficultyAdjustedAccuracy: number;
  averageDifficultyRank: number;
  sourceWeight: number;
  recentTrend: 'improving' | 'declining' | 'steady' | 'insufficient';
  lastSeenAt: Date | null;
};
```

难度权重初始值：

```text
基础: 0.70
中等: 1.00
较难: 1.20
挑战: 1.35
```

题源权重初始值：

```text
普通训练: 1.00
诊断: 1.15
模考: 1.25
复盘后重练: 1.10
AI 提示后答对: 0.75
```

当前首版实现：

- 不新增数据库字段，先从已提交的 adaptive rounds 和 mock exam attempts 实时聚合 topic 级信号。
- `readiness.difficulty` 输出 `topicSignalCount`、`lowDifficultyAdjustedTopicCount`、`averageDifficultyAdjustedAccuracy` 和最多 5 个 `weakDifficultyTopics`。
- topic 有效样本阈值先设为 `attemptCount >= 3`，避免单题偶然波动直接影响准备度。
- 难度权重使用基础 `0.70`、中等 `1.00`、较难 `1.20`、挑战 `1.35`。
- 题源权重首版接入 adaptive session mode 和 mock exam：普通训练 `1.00`、诊断 `1.15`、复盘/验证/聚焦训练 `1.10`、模考 `1.25`。
- AI 辅助答对会折算为较低正确性：提示后答对 `0.75`，解析后答对 `0.55`。
- 难度加权后不稳定的 topic 会扣 mastery 维度分、进入 blockers，并阻止 `exam_ready`。

更新原则：

- 中高难题答对提升更多。
- 简单题答对提升有限。
- 同一 topic 连续答错降低更多。
- 使用 AI 后答对可以计入学习证据，但不应等价于独立答对。
- 长时间未复习时，`confidence` 衰减，不直接大幅降低 `mastery`。

### 3.4 Mock Stability Layer：模考稳定层

模考不是只看分数，还要看时间压力下是否稳定。

输出：

```ts
type MockStability = {
  latestScore: number | null;
  bestRecentScore: number | null;
  averageRecentScore: number | null;
  unansweredRate: number | null;
  pacingRisk: 'none' | 'low' | 'medium' | 'high' | 'unknown';
  subjectWeakBackflow: Array<{
    subject: CscaLearningSubject;
    score: number;
    unansweredCount: number;
    href: string;
  }>;
};
```

判定建议：

- 无完整模考：mock 维度为 `insufficient`。
- 未答率 >= 18%：pacingRisk 至少为 `medium`。
- 最近两次模考下降 >= 10 分：趋势风险。
- 模考得分高但大量未答：不应直接进入 exam-ready。

### 3.5 Review Stability Layer：错因复盘稳定层

复盘不是“点按钮消失”，而是证明错因正在被修复。

输出：

```ts
type ReviewStability = {
  activePatternCount: number;
  duePatternCount: number;
  highPriorityPatternCount: number;
  recurrenceRisk: 'low' | 'medium' | 'high';
  repairedPatternCount: number;
  verifiedRepairRate: number;
};
```

建议区分两种完成：

- `marked_reviewed`：用户标记今天已复盘。
- `verified_repaired`：用户复盘后在相同 topic/pattern 上重新答对。

成熟度模型应更看重 `verified_repaired`。

### 3.6 Rhythm Stability Layer：学习节奏层

节奏权重不宜过高，避免“勤奋但没掌握”被高估。

输出：

```ts
type RhythmStability = {
  activeDaysLast7: number;
  activeDaysLast14: number;
  activeDaysLast30: number;
  answeredLast14: number;
  practiceMinutesThisWeek: number;
  rhythmStatus: 'strong' | 'steady' | 'building' | 'at_risk';
};
```

节奏主要影响：

- 置信度。
- 考前保持阶段。
- 是否提示用户重新启动学习。

不应单独把低 mastery 用户推到成熟状态。

## 4. 成熟度评分模型

建议总分仍为 100，但维度调整为 6 个。

```text
Knowledge Coverage    18
Weighted Mastery      26
Mock Stability        22
Review Stability      16
Rhythm Stability       8
Evidence Sufficiency  10
```

### 4.1 Evidence Sufficiency：证据充分度 10

衡量系统是否有资格判断用户成熟度。

当前实现：

```text
累计有效作答 >= 80: 2
三科有 mastery 证据: 2
至少 1 次完整模考: 2
coverageRate >= 70: 1
中高难独立样本达到跨科阈值: 1
topic 级难度信号 >= 3: 1
近 30 天有效学习日 >= 6: 1
```

门槛：

- `< 5`：整体 confidence 保持 `low`。
- `< 5`：stage 不应进入 `reinforcing`。
- `< 8`：stage 不应进入 `exam_ready`。

### 4.2 Knowledge Coverage：知识覆盖 25

规则草案：

```text
三科平均 coverageRate: 12
高权重 topic coverageRate: 8
blindSpotCount 惩罚: -0 到 -5
lowConfidenceTopicCount 惩罚: -0 到 -4
```

门槛：

- 高权重 topic 覆盖率 `< 70%`：不能进入 `exam_ready`。
- blindSpotCount `>= 8`：nextAction 优先补覆盖。

### 4.3 Weighted Mastery：难度加权掌握 25

规则草案：

```text
三科 weighted mastery 平均值: 15
最低学科 mastery: 6
中高难题独立正确率: 4
```

门槛：

- 最低学科 `< 60%`：stage 最高为 `building`。
- 中高难题样本不足：mastery status 最高为 `steady`，不能为 `strong`。

### 4.4 Mock Stability：模考稳定 20

规则草案：

```text
最近模考分数: 10
近两次模考稳定性: 4
未答率/节奏风险: 4
模考错因回流完成度: 2
```

门槛：

- 无模考：mock status 为 `insufficient`。
- 未答率 `>= 18%`：mock status 不得为 `strong`。
- 最近模考 `< 60`：stage 不应进入 `reinforcing`。

### 4.5 Review Stability：错因复盘稳定 10

规则草案：

```text
无到期复盘: 3
高优先级错因少: 2
复盘后重练正确率: 3
错因复发率下降: 2
```

门槛：

- duePatternCount `> 0`：下一步动作优先级上升。
- highPriorityPatternCount `>= 3`：stage 至少为 `repairing`。

### 4.6 Rhythm Stability：学习节奏 5

规则草案：

```text
近 30 天 >= 8 个有效学习日: 2
近 14 天作答 >= 40: 2
本周有训练或模考时长: 1
```

## 5. Stage 与 Confidence

### 5.1 Stage

```ts
type ReadinessStage =
  | 'diagnosing'
  | 'building'
  | 'repairing'
  | 'reinforcing'
  | 'exam_ready';
```

建议规则：

```text
diagnosing:
  evidenceSufficiency < 8
  或三科诊断未完成且 totalAnswered < 60

building:
  有基础证据，但 coverage/mastery/mock 任一核心维度明显不足

repairing:
  duePatternCount > 0
  或 highPriorityPatternCount >= 3
  或复发错因明显拖累

reinforcing:
  score >= 68
  且 evidenceSufficiency >= 10
  且 coverage/mastery/mock 均不弱

exam_ready:
  score >= 82
  且 confidence = high
  且 highWeightCoverageRate >= 80%
  且 latestMockScore >= 75
  且 duePatternCount = 0
  且 pacingRisk 不高
```

### 5.2 Confidence

```ts
type ReadinessConfidence = 'low' | 'medium' | 'high';
```

建议规则：

```text
low:
  evidenceSufficiency < 8
  或没有模考
  或三科中 >= 2 科样本不足

medium:
  evidenceSufficiency >= 8
  且至少有一次模考
  且至少两科有有效 topic coverage

high:
  evidenceSufficiency >= 12
  且三科 coverage 均可用
  且最近 30 天有新证据
  且至少一次完整模考
```

## 6. API Contract

建议 dashboard 的 `readiness` 升级为：

```ts
type LearningReadiness = {
  score: number;
  confidence: 'low' | 'medium' | 'high';
  confidenceReason: string;
  stage: 'diagnosing' | 'building' | 'repairing' | 'reinforcing' | 'exam_ready';
  title: string;
  body: string;
  scoreExplanation: string;
  dimensions: Array<{
    key: 'evidence' | 'coverage' | 'mastery' | 'mock' | 'review' | 'rhythm';
    label: string;
    score: number;
    maxScore: number;
    status: 'strong' | 'steady' | 'weak' | 'insufficient';
    evidence: string;
    blockers: string[];
    href?: string;
  }>;
  coverage: {
    subjects: SubjectCoverage[];
    blindSpotCount: number;
    highWeightCoverageRate: number;
  };
  blockers: string[];
  nextMilestone: string;
  nextActions: Array<{
    type:
      | 'complete_diagnostic'
      | 'cover_blind_spot'
      | 'repair_weak_subject'
      | 'review_due_patterns'
      | 'practice_pacing'
      | 'start_mock_exam'
      | 'keep_training';
    title: string;
    body: string;
    ctaLabel: string;
    href: string;
    expectedGain: number;
    reason: string;
  }>;
};
```

兼容策略：

- 保留当前 `nextAction`，从 `nextActions[0]` 派生。
- 前端先展示第一推荐动作，后续再支持“更多建议”。
- `scoreExplanation` 用来解释“不是模考分”。

## 7. 服务拆分

建议新增服务：

```ts
CscaReadinessService
  buildReadiness(userId, language)
  collectEvidence(userId)
  computeEvidenceSufficiency(evidence)
  computeCoverage(evidence)
  computeWeightedMastery(evidence)
  computeMockStability(evidence)
  computeReviewStability(evidence)
  computeRhythmStability(evidence)
  rankNextActions(dimensions)
```

短期可以由 `CscaLearningService.getDashboard` 调用：

```ts
const readiness = await this.readinessService.buildReadiness(userId, language);
```

中期再把 dashboard 的其它学习反馈也逐步复用 readiness signals，避免多套规则互相矛盾。

## 8. 数据迁移与落地顺序

### Phase 1：增强现有 MVP，不改表

状态：已完成。

目标：让当前个人页分数解释更清晰。

任务：

- UI 文案改为 `备考成熟度 43/100`。
- 增加说明：`基于题量、覆盖面、题目难度、模考、复盘和节奏估算，不等于模考成绩。`
- 后端 readiness 增加 `confidence/confidenceReason/scoreExplanation`。
- 当前四维度临时扩展为五维：新增 `evidence` 或 `coverage` 简版。
- 规则测试增加低置信度、无模考、高题量但低覆盖三类样本。

### Phase 2：显式 Coverage

状态：已完成第三切片。

目标：把 topic 覆盖从隐含指标变成一等公民。

已落地任务：

- 从现有 topic 表计算每科 totalTopicCount。
- 从 `userCscaTopicMastery` 聚合 topic 触达情况。
- 输出 `SubjectCoverage` 到 `readiness.coverage`。
- coverage 进入 readiness dimensions、blockers、confidence 和 `exam_ready` 门槛。

后续增强：

- 从 round/mock answer 回填更完整的 topic 触达情况。
- 前端展示“知识覆盖 46% / 高权重盲区 18 个”。
- `nextAction` 支持 `cover_blind_spot`。

### Phase 3：难度加权 Mastery

状态：已完成首版。

目标：让简单题和难题不再等价。

已落地任务：

- 统一 difficulty rank 映射。
- readiness 聚合时读取每题 difficulty。
- 计算最近中高难题独立作答样本数、独立正确率和平均难度 rank。
- 更新 mastery 解释文案：`中高难题独立正确率`。
- AI 提示/解析后答题不计入“独立中高难正确率”。
- 中高难样本不足会降低 mastery 分、降低 confidence，并阻止 `exam_ready`。
- 已下沉到 topic 级难度加权正确率：`lowDifficultyAdjustedTopicCount` 会影响 mastery 分和 `exam_ready`。
- 已加入题源权重首版：诊断证据权重高于普通训练，复盘/验证/聚焦训练略高于普通训练，模考题源通过 `mock_exam_question` topic mapping 接入。
- 已补齐 readiness 侧模考 topic fallback：缺少显式 `cscaTopicMapping` 时，会用模考题 `knowledgeTags` 与同科 exam topic 的 title/module/code 做精确和模糊匹配。
- 已把中高难证据从全局题量阈值升级为分学科阈值：数学 3 个、物理 2 个、化学 2 个独立中高难样本；`exam_ready` 要求三科都达标。

后续增强：

- 用真实数据校准数学/物理/化学的中高难样本阈值。

### Phase 4：错因修复验证

状态：已完成首版。

目标：复盘完成不只是点击，而是闭环修复。

已落地任务：

- 增加 `reviewed` 与 `verified_repaired` 的区别。
- 复盘完成后返回 `verificationRequired` 与 `verificationHref`。
- 个人页复盘队列显示“已复盘，待用同类题验证修复”。
- 错因模式卡片显示“待验证修复 / 已验证修复”状态。
- `verificationHref` 带上 `topicId`，科目页识别后自动创建同知识点聚焦训练轮。
- readiness review 维度已将 pending verification 纳入扣分、证据文案、blocker 和 `exam_ready` 门槛。
- 已有正确证据机制继续负责把 improving 错因推进到 resolved。

后续增强：

- 将同 `patternType` 的题目选择权重进一步提高，而不仅是同 topic。
- 将验证训练结果沉淀为更细粒度的 review stability 事件，支持后续模型校准。

### Phase 5：Next Best Action 排序

状态：已完成 5.3 第三切片。

目标：下一步动作按预期收益排序。

已落地任务：

- 每个 blocker 产出 expectedGain 和独立 reason。
- `nextActions` 返回 3 个以内。
- 前端主按钮展示最高收益动作，次按钮展示后续建议动作。
- 前端展示预计收益和 reason，解释为什么此动作值得优先做。
- 点击建议动作会写入 `readiness_action_clicked` 训练事件，保留 action type、href、expectedGain、priority、rank、stage、score 和 source。
- dashboard 返回 `readiness.actionOutcome`，按最近 14 天统计 clickedCount、followedCount、followThroughRate、averageExpectedGain、averageScoreDelta、topActionType 和校准状态。
- action outcome 会按动作类型匹配后续证据：诊断匹配 diagnostic round，训练匹配 practice round，模考匹配 submitted mock，复盘匹配 lastReviewCompletedAt 或 lastCorrectAt。
- action outcome 和 action type calibration 已加入 `abilityLiftRate` 和 `averageMasteryDelta`：复盘验证/正确证据、模考提分、topic mastery 点击前后真实提升都会计为能力改善。
- 个人页展示“建议反馈”，解释系统正在用真实跟进行为、能力改善和相关 topic mastery delta 校准推荐排序。
- 后台训练事件 observability 返回 `readinessActions` 聚合，包含整体跟进率、按 action type 的点击/跟进/平均 expectedGain/status，以及最近点击样本。
- Admin Audit 页面展示“成熟度建议”总体 KPI 和“成熟度建议分组”，用于判断哪些建议动作需要调参。
- `expectedGain` 排序会读取最近 30 天 action type 校准系数；样本不足 5 次点击时保持原收益，低能力改善/低跟进率动作下调，高能力改善动作轻微上调。
- 校准系数已可持久化为每日快照：`csca_readiness_action_calibration_snapshots` 存 action type 级别的 clicked/followed/abilityLift、rate、multiplier/status；dashboard 优先读最近快照，缺失时只实时聚合用于当前响应，不写快照。
- Admin Audit 已提供手动刷新 readiness action calibration snapshot 的按钮和受保护 API，刷新结果会写入后台审计日志。
- 后台已提供可选定时刷新服务，开启后按北京时间每日生成校准快照；可配置 `CSCA_READINESS_CALIBRATION_SCHEDULE_HOUR`、`CSCA_READINESS_CALIBRATION_SCHEDULE_MINUTE` 和 `CSCA_READINESS_CALIBRATION_SCHEDULE_RUN_ON_STARTUP`。
- 中高难样本阈值已支持三层策略：默认 math=3、physics=2、chemistry=2；可用 `CSCA_READINESS_HIGH_DIFFICULTY_REQUIRED_*` 单科覆盖；也可用 `CSCA_READINESS_HIGH_DIFFICULTY_THRESHOLD_MODE=sampled` 在样本充足时采用近 30 天分布推荐值。
- Admin Audit 已展示中高难阈值分布和 sampled 影响估算，运营可以先观察 p50/p60/p80 和 impacted user-subject 数，再决定是否开启 sampled 模式。
- `nextActions` 返回 `baseExpectedGain` 与 `calibration`，便于后续解释和排查推荐排序变化。

后续增强：

- 已增加 readiness calibration health alerts：快照过期、快照为空、sampled distribution 样本不足、某 action type 长期 needs_calibration 时提示运营处理。

## 9. 前端信息架构

### 9.1 卡片标题

建议从：

```text
43/100
继续训练
```

改为：

```text
备考成熟度
43/100 · 置信度中
```

下方解释：

```text
综合题量、知识覆盖、题目难度、模考、错因复盘和学习节奏估算，不等于模考成绩。
```

### 9.2 维度展示

建议展示 6 个紧凑维度：

- 证据充分度
- 知识覆盖
- 难度掌握
- 模考稳定
- 错因复盘
- 学习节奏

每个维度必须包含：

- 分数。
- 状态。
- 证据句。
- 主要 blocker。
- 可点击动作（如存在）。

### 9.3 用户解释优先级

页面顺序建议：

1. 成熟度结论。
2. 最大差距。
3. 下一步动作。
4. 六维证据。
5. 详细趋势图。

不要让热力图或趋势图先于结论出现，否则用户仍要自己解读。

## 10. 验收标准

### 10.1 数据正确性

- 低题量用户不会进入 `exam_ready`。
- 无模考用户 mock 维度为 `insufficient`。
- 高题量但低覆盖用户 coverage 维度为 `weak`。
- 简单题高正确率但中高难题样本不足时，mastery 不得为 `strong`。
- 有到期高优先级错因时，nextAction 优先复盘或验证修复。
- 高覆盖、高 mastery、高模考、无复盘债、节奏稳定时，stage 为 `exam_ready`。

### 10.2 用户理解

用户应能在 10 秒内理解：

- 这个分数不是模考分。
- 主要差距是什么。
- 下一步为什么做这个动作。
- 是证据不足，还是能力不足。

### 10.3 前端体验

- 移动端分数、说明、按钮不挤压。
- 维度卡片文本不溢出。
- 主按钮跳到实际可执行页面。
- 复盘动作能让今日任务消失，并说明下一次复盘时间。

### 10.4 回归测试

至少新增以下规则测试：

- `readiness_low_evidence_stays_diagnosing`
- `readiness_high_volume_low_coverage_is_not_ready`
- `readiness_easy_questions_only_lowers_confidence`
- `readiness_due_reviews_prioritized`
- `readiness_exam_ready_requires_mock_and_coverage`
- `readiness_next_actions_rank_expected_gain`

## 11. 与当前实现的差异

当前实现已经完成：

- `readiness.score/stage/dimensions/blockers/nextAction`
- 维度：coverage/mastery/mock/review/rhythm/evidence
- `confidence/confidenceReason/scoreExplanation`
- 显式 `coverage`
- 中高难独立作答证据
- 到期复盘和待验证修复优先
- 高题量低覆盖不 ready
- 基础题高正确率但中高难样本不足不 ready
- 单科中高难样本充足但跨科证据不足不 ready
- readiness 侧模考 topic fallback tag 匹配
- exam_ready 规则测试
- 复盘从“标记完成”升级为“验证修复”闭环
- `nextActions` 多动作 expectedGain 排序、reason 展示和点击事件记录
- `actionOutcome` 单用户建议跟进摘要
- `abilityLiftRate` 单用户和 action type 校准信号
- `averageMasteryDelta` 单用户、action type 和每日快照信号
- readiness action calibration 每日快照表与读取 fallback
- Admin Audit 训练事件 observability 的 readiness action 和 evidence sufficiency 聚合
- `expectedGain` action type 校准系数和 `baseExpectedGain` 留痕

仍可选升级：

- Admin Audit evidence 历史增加筛选、保留策略或外部对象存储归档。
- sampled threshold distribution 增加更细的 subject/topic drilldown。
- readiness stage distribution 增加发布前后趋势图。
- calibration health 接入外部告警。
- 将 comparison evidence 接入 CI 或发布审批系统。
- 继续按文案指南清理 Admin 运营侧复杂表述。

## 12. 推荐下一步

原因：

- Phase 1-5 已经把分数解释、覆盖面、中高难证据、复盘验证和多动作排序接入 readiness，个人页已经能解释“分数是什么、差在哪、先做什么”。
- Phase 5.3/PR 9/PR 9b/PR 9c/PR 9d/PR 9e 已经把推荐动作从规则排序推进到可观测、可校准、可回流，并开始用 ability lift、真实 topic mastery delta、每日快照、主动刷新入口与定时刷新服务评估真实改善。
- PR 10/PR 10b 已经让中高难阈值具备生产分布推荐、安全切换机制和 Admin Audit 运营视图。
- Phase 6 已经接入 adaptive round 与 mock exam 的 topic 级 difficulty-adjusted mastery、source weighting、模考 topic fallback 和分学科中高难阈值。
- Phase 7 已经把 readiness 从 5 维升级为 6 维，并在 Admin Audit 聚合 evidence sufficiency 分布和主要缺口。
- PR 15/PR 16 已经补齐发布 evidence 和最终交接文档，当前 readiness/sampled 阈值主线可以进入发布评审或拆 PR 合并。

可选后续切片：

```text
PR 22: readiness evidence retention and approval workflow
```

# 参考网站特色方案交接文档

> 日期：2026-06-09  
> 当前分支：`codex/adaptive-ai-questioning`  
> 交接目的：把“参考网站特色”相关方案、已完成范围、未完成能力和下一步执行顺序交给后续任务继续推进。

## 1. 背景与产品判断

用户曾提供参考网站截图，核心卖点包括：

- CBT 仿真。
- 三级计时。
- AI 错题本。
- 4 维 AI 讲解。
- 48 维诊断。
- 3 届验证。
- 学习闭环。
- 个人页学习活动、趋势和长期投入反馈。

我们已经明确：CSCAlite 不应该照搬参考网站文案，也不应该把能力做成营销堆叠。更合适的方向是：

- 把 CSCA 科目学习、模考、错题、AI Coach 和学习数据打成一个长期备考闭环。
- 不新增一个平行的“自适应训练”产品入口，而是让现有科目页和模考页具备自适应能力。
- AI 不是判题中心，也不是直接发布题目的来源；AI 主要用于解释、总结、归因、辅助复盘和后台审核。

## 2. 当前已经完成的范围

当前已完成的是“科目练习智能化 MVP”，不是完整参考特色方案。

已完成能力：

1. 科目页内承接自适应训练。
   - 用户从 `/csca-subjects/:subject` 进入，不再使用独立自适应入口。
   - 旧 `/csca-special-practice` 普通入口已不作为用户主入口。

2. 首次 20 题诊断。
   - 新用户首次进入某学科，需要完成本科目 20 题诊断。
   - 诊断后写入 topic mastery 和学习证据。

3. 后续 5 题一轮训练。
   - 训练 round size 为 5。
   - 下一轮会根据掌握度、薄弱 topic、近期错误和曝光记录安排。

4. AI Coach MVP。
   - 支持 hint。
   - 支持错因解析。
   - 支持 round summary。
   - 失败或 fallback 不中断训练。
   - rule fallback 不写额度 ledger。

5. DeepSeek 兼容 provider 和 AI 额度。
   - 个人初始免费额度为 50。
   - 支持购买固定额度包。
   - provider smoke、adaptive smoke、release smoke 已跑通。

6. 训练完成报告页减法。
   - 重点展示表现、下一步建议和 AI 总结。
   - 不再把所有细节堆到首屏。

7. 个人学习驾驶舱第一版。
   - 用户头像和基础信息居中展示。
   - 展示学习活动热力图、趋势、错因模式、下一步建议。
   - 学习活动是自动根据站内投入反馈，不是用户手动打卡。

8. 后台 AI 反馈复核链路。
   - 低评分 AI 反馈进入 review queue。
   - 管理员可写入处理结论。
   - 审计记录可追踪。

## 3. 关键代码入口

### 后端

- `backend/prisma/schema.prisma`
  - 自适应训练、AI 额度、学习驾驶舱、错因模式等数据模型。

- `backend/src/csca-special-practice/csca-adaptive.service.ts`
  - 自适应 session / round 主流程。

- `backend/src/csca-special-practice/adaptive-planner.service.ts`
  - 下一轮 topic / 难度规划。

- `backend/src/csca-special-practice/ai-coach.service.ts`
  - AI hint、错因解析、round summary。

- `backend/src/csca-special-practice/ai-coach-provider.service.ts`
  - OpenAI-compatible / DeepSeek provider 适配。

- `backend/src/csca-special-practice/ai-entitlement.service.ts`
  - AI 额度、reservation、ledger。

- `backend/src/csca-learning/`
  - 个人学习驾驶舱、学习活动、趋势、错因模式。

- `backend/src/csca-mock-exam/`
  - 模考数据和学习证据弱联动。

### 前端

- `frontend/src/pages/CscaSubjectPage.tsx`
  - 科目页主入口。
  - 诊断、继续训练、下一步建议、科目工具入口。

- `frontend/src/pages/special-practice/adaptive/AdaptivePracticeViews.tsx`
  - 自适应训练答题页、解析、报告页。

- `frontend/src/pages/PublicMePage.tsx`
  - 个人学习驾驶舱。
  - 当前也有旧练习错题本 UI。

- `frontend/src/pages/AIServicePage.tsx`
  - AI 服务与额度购买页。

- `frontend/src/styles/subject-learning.css`
  - 科目页样式。

- `frontend/src/styles/special-practice.css`
  - 训练页、报告页、AI 解析样式。

- `frontend/src/styles/account.css`
  - 个人页、学习驾驶舱、错题本样式。

## 4. 当前没有完全完成的参考特色能力

### 4.1 统一错题本

当前状态：

- 已有“练习错题本”雏形。
- API：`/api/v1/csca-special-practice/my-wrong-questions`
- 前端位置：`PublicMePage.tsx` 的“练习与模考”区域。
- 主要来源：旧 `SpecialPracticeSession`。

缺口：

- 自适应 `CscaAdaptiveRound` 错题还没有统一进入错题本。
- 模考错题还没有统一进入错题本。
- 错题没有统一状态：未复盘、已看解析、已重练、已掌握。
- AI 错因解析没有绑定成错题级长期资产。

建议目标：

- 建立统一错题 evidence / wrong item 模型，或在现有 round / attempt item 基础上做统一查询层。
- 一个错题本覆盖：自适应诊断、自适应训练、模考、旧练习。
- 支持按学科、topic、错因类型、状态、下次复习时间筛选。

### 4.2 AI 错题本

当前状态：

- AI 可以对单题错因做解释。
- `CscaWrongPattern` 可以记录重复错因模式。

缺口：

- 还没有形成“AI 错题本”产品。
- 没有自动归因到稳定错因类型，例如：知识点不会、审题错误、计算错误、公式记忆混淆、时间压力。
- 没有把同一错因下的题聚合成复习包。
- 没有间隔复习和重练闭环。

建议目标：

- 每次错题写入 `wrong pattern` 或统一 wrong item 时，附带可解释错因类型。
- 低置信度错因仍允许先展示，但要标记来源和置信度。
- 用户侧展示“你最近最常错的是哪几类问题”，而不是只展示题目列表。

### 4.3 4 维 AI 讲解

当前状态：

- 已有 AI 错因解析，但输出结构仍偏自由文本。

缺口：

- 还没有稳定产品结构。
- 建议固定为：
  - 为什么错。
  - 正确思路。
  - 快速解法。
  - 下次如何避免。

建议目标：

- 修改 prompt 和返回 schema。
- 前端把 AI 解析渲染成 4 个清晰区块。
- 仍保留题库标准解析作为基准，AI 解释只做补充。

### 4.4 48 维诊断

当前状态：

- 目前是 20 题学科诊断。
- 后端已有 topic mastery 和 dashboard 汇总。

缺口：

- 不是完整 48 维诊断。
- 诊断维度、题量、覆盖率和报告表达还没有产品化。

建议目标：

- 不建议一开始就硬做“48 维”数字。
- 先基于 CSCA 三科真实范围定义稳定维度树。
- 逐步在报告页展示“已覆盖维度”和“置信度不足维度”。

### 4.5 CBT 仿真与三级计时

当前状态：

- 现有模考已有基础答题和报告。
- 自适应训练有题内用时记录。

缺口：

- 模考还不是严格 CBT 仿真。
- 没有按参考网站那种考试环境细节强化：
  - 60 分钟时限。
  - 阶段提醒。
  - 最后检查。
  - 自动交卷。
  - Mark for Review。
  - 题目导航状态。
  - 每题/每组/整卷三级计时体验。

建议目标：

- 先改模考页，不要把 CBT 压到科目训练页。
- 科目训练保持轻量、低压力。
- 模考承担正式考试仿真。

### 4.6 学习闭环

当前状态：

- 已有：训练、报告、下一轮、个人页活动、错因模式。

缺口：

- 还没有完整闭环：
  - 做题。
  - 错题入本。
  - AI 归因。
  - 间隔复习。
  - 重练同类题。
  - 再测。
  - 学习曲线反馈。

建议目标：

- 统一错题本是闭环的第一步。
- 第二步是错题复习队列。
- 第三步才是变式题和概念卡。

## 5. 推荐执行顺序

### 阶段 1：统一错题本

目标：

- 让自适应训练、诊断、模考、旧练习错题统一出现在个人页。

建议任务：

1. 梳理错题来源。
   - `CscaAdaptiveRoundItem`
   - `CscaAdaptiveRound.answers`
   - `MockExamAttempt`
   - `SpecialPracticeSession`

2. 设计统一返回结构。
   - sourceType：adaptive_round / diagnostic / mock_exam / special_practice
   - subject
   - topicId / topicTitle
   - question snapshot
   - selectedAnswer
   - correctAnswer
   - explanation
   - aiExplanationId
   - status
   - lastWrongAt
   - nextReviewAt

3. 新增或扩展 API。
   - 建议使用新 API：`/api/v1/me/csca/wrong-questions`
   - 不建议继续把新错题本挂在 `csca-special-practice` 命名空间下。

4. 前端改造个人页错题本。
   - 保留现有 UI 思路。
   - 改为统一数据源。
   - 首屏展示“待复盘”和“高频错因”，完整列表放下方。

阶段完成标准：

- 做完一轮自适应训练错题后，个人页能看到该错题。
- 做完一次模考错题后，个人页能看到该错题。
- 能跳回对应科目继续练。

### 阶段 2：4 维 AI 讲解

目标：

- 把自由文本 AI 错因解析升级为结构化解释。

建议任务：

1. 修改 AI prompt。
2. 修改 AI output parser。
3. 前端渲染 4 个区块。
4. 保存原始 output 和结构化字段。
5. 支持有用/没用反馈继续进入 review queue。

阶段完成标准：

- 错题展开后能看到固定结构：为什么错、正确思路、快速解法、下次避免。
- AI 失败时仍展示标准解析。

### 阶段 3：错题复习队列

目标：

- 用户不是“翻错题列表”，而是每天看到系统安排好的复习任务。

建议任务：

1. 给 wrong item 或 wrong pattern 增加复习状态。
2. 根据错题次数、最近正确、topic mastery 计算 `nextReviewAt`。
3. 科目页和个人页展示“今天建议复盘 N 道”。
4. 支持“复盘完成 / 重新练这个知识点 / 加入下一轮训练”。

阶段完成标准：

- 个人页有“今日复盘”。
- 科目页能把错题复习作为下一步建议之一。

### 阶段 4：学习曲线和长期反馈

目标：

- 让用户感到“长期投入被看见”，不是只看到单次结果。

建议任务：

1. 完善学习活动热力图。
2. 增加科目掌握曲线。
3. 增加错因趋势。
4. 增加近 30 天学习节奏评价。
5. 加入温和但不过度游戏化的激励文案。

阶段完成标准：

- 个人页优先展示 CSCA 学习状态。
- 用户能一眼看出最近是否进步、哪个科目拖后腿、下一步做什么。

### 阶段 5：CBT 仿真与三级计时

目标：

- 模考页更像真实考试，不影响科目训练轻量体验。

建议任务：

1. 模考页增加题目状态面板。
2. 增加 Mark for Review。
3. 增加自动交卷和阶段提醒。
4. 增加整卷 / 题目 / 阶段计时。
5. 报告页展示时间分布。

阶段完成标准：

- 用户能用模考页进行接近真实 CSCA 的限时训练。

## 6. 当前验证记录

最近一次已通过：

```powershell
npm --prefix frontend run build
backend\node_modules\.bin\tsc.cmd -p backend\tsconfig.json --pretty false --noEmit --incremental false
node scripts\csca-adaptive-rules-test.cjs
node scripts\csca-learning-dashboard-rules-test.cjs
node scripts\ai-credit-purchase-smoke.cjs
node scripts\ai-provider-smoke.cjs
node scripts\csca-adaptive-smoke.cjs
node scripts\csca-adaptive-release-smoke.cjs
git diff --check
```

浏览器只读验收确认：

- `/zh/csca-subjects/math` 是科目页入口，并显示 20 题诊断。
- `/zh/csca-special-practice` 不再作为普通训练入口。
- `/zh/me` 未登录时显示登录门禁，无 console error。

## 7. 交接注意事项

1. 不要重新新增一个“自适应训练”主导航入口。
   - 自适应能力应继续藏在科目学习和模考背后。

2. 不要让 AI 接管判题。
   - 判题、掌握度、训练流应继续由确定性规则和题库答案控制。

3. 不要把 AI 出题直接进入正式题库。
   - 题目生成、变式题、概念卡都应走后台审核或至少 temporary / review 状态。

4. 错题本应优先做统一数据层。
   - 不要只在前端拼几个列表。
   - 否则后续间隔复习、错因趋势、学习曲线都会继续碎片化。

5. 个人页是长期学习反馈中心。
   - 不是普通账号设置页。
   - 新能力应优先服务“我最近学得怎么样、接下来做什么”。

6. 参考网站特色要转译成 CSCAlite 自己的产品语言。
   - 不建议直接使用“48 维”“3 届验证”等营销表达，除非后端数据和公开证据能支撑。

## 8. 建议下个任务开场语

可以把后续任务目标描述为：

> 在当前 `codex/adaptive-ai-questioning` 分支上，继续执行 `docs/reference-feature-handoff.md`。优先实现阶段 1：统一错题本。要求把自适应训练、诊断、模考、旧练习的错题统一到一个后端查询层和个人页错题本中，并保留现有科目页自适应主流程不变。


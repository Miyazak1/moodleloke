# 参考网站特色方案验收审计

> 日期：2026-06-09
> 关联文档：`reference-feature-handoff.md`
> 审计口径：证明交接方案中建议优先推进的闭环能力，而不是复刻参考网站营销文案。

## 1. 结论

当前实现已经把参考特色拆进 CSCAlite 自身的 CSCA 学习闭环：

- 科目页承接首次诊断和后续 5 题训练。
- 统一错题本覆盖自适应诊断、自适应训练、模考和旧专项练习。
- 错题本支持错因归因、错因复习包、AI 结构化讲解和下次复习时间。
- 个人页展示今日复盘、错因模式、掌握曲线、错因趋势、学习节奏和长期反馈。
- 模考页承担 CBT 仿真、题目导航、标记复查、自动交卷、整卷/题目/阶段计时和报告时间诊断。
- 诊断报告展示维度覆盖、已覆盖维度和证据不足维度。

仍不应对外宣称：

- 不宣称“完整 48 维诊断”。当前是基于 CSCA topic 的维度覆盖和证据置信度产品化。
- 不宣称“3 届验证”。当前没有公开历史届次验证数据支撑，只能表达题库来源、覆盖和训练证据。
- 不宣称 AI 出题或 AI 判题。判题、掌握度和训练安排仍由确定性规则与题库答案控制。

## 2. 阶段验收矩阵

| 阶段 | 交接目标 | 当前状态 | 代码证据 | 验证证据 |
|---|---|---|---|---|
| 阶段 1：统一错题本 | 自适应训练、诊断、模考、旧练习错题统一进入个人页。 | 已完成 | `backend/src/me/me.service.ts` 的 `listCscaWrongQuestions` 汇总 `specialPracticeWrongQuestions`、`adaptiveWrongQuestions`、`mockExamWrongQuestions`；`backend/src/me/me.controller.ts` 暴露 `/api/v1/me/csca/wrong-questions`；`frontend/src/pages/PublicMePage.tsx` 使用统一数据源。 | `node scripts/csca-wrong-questions-rules-test.cjs` 断言四类来源、AI explanation id、nextReviewAt、筛选能力。 |
| 阶段 1：统一返回结构 | 返回 sourceType、subject、topic、question snapshot、selected/correct、explanation、aiExplanationId、status、lastWrongAt、nextReviewAt。 | 已完成 | `backend/src/me/me.types.ts` 的 `CscaWrongQuestionItem`；`frontend/src/lib/api-types.ts` 同步类型。 | `scripts/csca-wrong-questions-rules-test.cjs` 覆盖 sourceType、stable itemKey、practicePath、status、nextReviewAt、structured AI explanation。 |
| 阶段 2：4 维 AI 讲解 | AI 错因解析固定为为什么错、正确思路、快速解法、下次避免。 | 已完成 | `backend/src/csca-special-practice/ai-coach-prompt-templates.ts`、`ai-coach-provider.service.ts`、`ai-coach.service.ts`；`CscaAIInteraction.structuredOutput`；前端训练页和错题本渲染结构化字段。 | `node scripts/csca-adaptive-rules-test.cjs` 覆盖 prompt schema、provider schema validation、structuredOutput 持久化；`node scripts/csca-wrong-questions-rules-test.cjs` 覆盖错题本读取结构化讲解。 |
| 阶段 3：错题复习队列 | 个人页有今日复盘，科目页把复盘作为下一步建议之一。 | 已完成 | `backend/src/csca-learning/csca-learning.service.ts` 的 `getWrongPatternReviewQueue`、`completeWrongPatternReview`；`backend/src/me/me.controller.ts` 的 review queue endpoints；`frontend/src/pages/PublicMePage.tsx` 的今日复盘；`frontend/src/pages/CscaSubjectPage.tsx` 读取 due count。 | `node scripts/csca-learning-dashboard-rules-test.cjs` 覆盖 review queue、完成复盘后排下次复习；前端构建通过。 |
| 阶段 4：学习曲线和长期反馈 | 个人页优先展示 CSCA 学习状态，能看出进步、薄弱科目和下一步。 | 已完成 | `LearningDashboardResponse` 包含 `masteryTrend`、`wrongPatternTrend`、`rhythmEvaluation`；`PublicMePage.tsx` 展示长期反馈、学习节奏、掌握曲线、错因趋势。 | `node scripts/csca-learning-dashboard-rules-test.cjs` 断言 mastery delta、wrong pattern trend、rhythm status。 |
| 阶段 5：CBT 仿真与三级计时 | 模考页更像真实考试，有状态面板、Mark for Review、自动交卷、阶段提醒、整卷/题目/阶段计时、报告时间分布。 | 已完成 | `frontend/src/pages/CscaMockExamPage.tsx` 包含 countdown、autosave、auto submit、marked review、question nav、CBT status；`frontend/src/styles/mock-exam.css` 包含 `.mock-cbt-status`；i18n 文案包含 time diagnostics。 | `npm --prefix frontend run build` 通过；既有 mock exam 页面和报告代码保留 `timeDiagnostics`、`averageTime`、`timeAdvice` 文案和渲染。 |
| 4.4 诊断维度产品化 | 不硬做“48 维”，先展示已覆盖维度和置信度不足维度。 | 已完成当前阶段 | `backend/src/csca-special-practice/csca-adaptive.service.ts` 返回 `diagnosticCoverage`；`frontend/src/pages/special-practice/adaptive/AdaptivePracticeViews.tsx` 展示“已覆盖维度”和“待补证据维度”。 | `node scripts/csca-adaptive-rules-test.cjs` 的 `testDiagnosticCoverageReport` 覆盖 coverageRate、coveredDimensions、low_confidence、not_covered。 |
| 4.2 AI 错题本产品化 | 错题按稳定错因类型聚合成复习包，低置信度归因可展示但标明。 | 已完成当前阶段 | `backend/src/me/me.service.ts` 返回 `mistakePattern`、`summary.patternTypes`、`reviewPacks`；`frontend/src/pages/PublicMePage.tsx` 展示“错因复习包”和低置信度归因。 | `node scripts/csca-wrong-questions-rules-test.cjs` 覆盖 patternType、reviewPacks、patternType filter。 |

## 3. 当前验证命令

本轮已通过：

```powershell
npm run prisma:validate
npm run db:migrate
npm run db:migrate:status
node scripts\csca-wrong-questions-rules-test.cjs
node scripts\csca-adaptive-rules-test.cjs
node scripts\csca-learning-dashboard-rules-test.cjs
node scripts\csca-mock-exam-history-rules-test.cjs
backend\node_modules\.bin\tsc.cmd -p backend\tsconfig.json --pretty false --noEmit --incremental false
npm --prefix frontend run build
node scripts\ai-provider-smoke.cjs
node scripts\csca-adaptive-smoke.cjs
node scripts\csca-adaptive-release-smoke.cjs
git diff --check
```

本轮复验记录：

- 首次运行 `csca-adaptive-smoke` 和 `csca-adaptive-release-smoke` 时，AI hint 路径返回 500。
- `npm run db:migrate:status` 显示 `0042_csca_ai_structured_output` 尚未应用。
- 已运行 `npm run db:migrate`，成功应用 `0042_csca_ai_structured_output`。
- 迁移后 `npm run db:migrate:status` 显示 `Database schema is up to date!`。
- 迁移后 `node scripts\csca-adaptive-smoke.cjs` 通过，覆盖 20 题诊断、5 题训练、AI hint、AI explanation、round summary、训练事件和额度扣减。
- 迁移后 `node scripts\csca-adaptive-release-smoke.cjs` 通过，且 admin review queue 决策和 audit 记录通过。
- `node scripts\ai-provider-smoke.cjs` 成功退出；默认配置未强制 live 外部调用。
- `npm run prisma:validate` 通过，确认当前 Prisma schema 有效。
- 浏览器只读复验 `/zh/csca-subjects/math`，确认科目页展示掌握度、5 题训练、智能练习和在线模考入口。
- 浏览器只读复验 `/zh/me`，确认学习驾驶舱、长期反馈、今日复盘、错因模式、统一错题本和错因过滤器可见。
- 浏览器只读复验 `/zh/csca-mock-exam/attempts/39`，确认 CBT 状态条展示整卷剩余、当前题、当前题组，且题号导航、标记复查和交卷入口可用。
- 浏览器复验时发现旧错题记录的 `patternConfidence` 可能显示 `NaN%`，已在前端改为仅对有效数字显示百分比。
- 浏览器复验时发现账号页进行中模考记录只回到模考首页；已为模考历史接口增加 `attemptPath`，并让账号页未提交记录直达 `/csca-mock-exam/attempts/:id`。
- `node scripts\csca-mock-exam-history-rules-test.cjs` 覆盖了进行中模考的 `attemptPath` 和已提交模考的当前报告路径，避免回退到旧 `/zh/mock-exam` 路由。
- `package.json` 已新增 `csca-mock-exam-history:rules`，并接入 `verify:local`。

`git diff --check` 仅输出仓库当前 CRLF warning，未发现 whitespace error。

## 4. 发布前建议复验

发布前建议把以下命令作为最终门禁：

```powershell
npm run prisma:validate
npm --prefix frontend run build
backend\node_modules\.bin\tsc.cmd -p backend\tsconfig.json --pretty false --noEmit --incremental false
node scripts\csca-adaptive-rules-test.cjs
node scripts\csca-learning-dashboard-rules-test.cjs
node scripts\csca-wrong-questions-rules-test.cjs
node scripts\csca-mock-exam-history-rules-test.cjs
node scripts\ai-provider-smoke.cjs
node scripts\csca-adaptive-smoke.cjs
node scripts\csca-adaptive-release-smoke.cjs
git diff --check
```

浏览器只读复验建议：

- `/zh/csca-subjects/math`：首次诊断入口、复盘建议、科目工具入口。
- `/zh/csca-special-practice/adaptive/rounds/:id/report`：诊断报告的维度覆盖和待补证据。
- `/zh/me`：学习驾驶舱、今日复盘、错因模式、错因复习包、统一错题本。
- `/zh/csca-mock-exam`：CBT 状态面板、标记复查、导航状态、计时和自动交卷。

本轮浏览器复验补充：

- 已验证 `/zh/csca-subjects/math`、`/zh/me` 和真实模考作答页 `/zh/csca-mock-exam/attempts/39`。
- 当前本地账号的 `/zh/me` 练习页没有展示“错因复习包”，原因是现有账号数据没有可聚合的高置信复习包；统一错题本、错因过滤和错因标签已可见。
- 账号页进行中模考“继续”入口已从通用模考首页修正为 attempt path；若本地后端进程未重启，浏览器热验可能仍读到旧接口响应。

## 5. 后续可选增强

- 将 `CscaWrongQuestionItem` 的复盘状态从派生状态升级为持久化 wrong item 状态，以支持逐题“已掌握”。
- 为 `reviewPacks` 增加一键创建下一轮训练的显式动作，目前页面通过对应科目训练入口回流。
- 当真实题库维度树稳定并有足够覆盖证据后，再讨论是否对外表达具体维度总数。
- 只有在有公开数据或运营证据后，才考虑“届次验证”类表达。

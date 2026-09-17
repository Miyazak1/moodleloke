# CSCA 科目练习智能化 MVP 验收矩阵

> 日期：2026-06-09  
> 分支：`codex/adaptive-ai-questioning`  
> 关联文档：`adaptive-ai-questioning-plan.md`、`adaptive-training-mvp-implementation-spec.md`、`adaptive-training-ux-optimization.md`、`student-learning-dashboard-design.md`

## 1. 验收结论

当前分支已达到“科目练习智能化 MVP 可灰度验收”的工程状态，但仍不等于完整 AI 自适应学习平台完成。

当前 MVP 已覆盖：

- 科目页内进入训练，不新增平行自适应产品。
- 首次本科目先做 20 题诊断。
- 后续正式训练 5 题一轮。
- Planner / QuestionProvider / Mastery 使用可解释规则。
- AI Coach 支持提示、错因解析、轮次总结和反馈。
- AI 不可用或 fallback 时训练不中断。
- 个人 AI 额度、初始免费额度、购买入账和 ledger 已接入。
- 学习驾驶舱展示长期学习活动、趋势、错因模式和下一步建议。
- 模考结果会进入学习驾驶舱和错因复习证据。

当前明确不进入 MVP：

- AI 直接生成正式发布题库。
- 概念卡插入与概念卡后台维护。
- 多档额度商城、机构额度池、BYOK。
- prompt 模板后台发布和完整运营审核工作流。
- 独立 BI 看板、完整漏斗分析和复杂 IRT / 贝叶斯模型。

## 2. 验收矩阵

| # | 验收项 | 当前状态 | 主要证据 | 验证方式 |
|---|---|---|---|---|
| 1 | 新用户进入 `/csca-subjects/:subject` 后，在本科目页面内看到诊断/练习入口，而不是旧专题列表或独立自适应产品。 | 已完成 | `frontend/src/pages/CscaSubjectPage.tsx`；旧 `/csca-special-practice` E2E。 | E2E: `old special practice user route is no longer exposed`；浏览器 `/zh/csca-subjects/math`。 |
| 2 | 用户第一次选择某学科后，必须先进入 20 题诊断。 | 已完成 | `diagnosticRoundSize`、科目页 20 题诊断 CTA。 | `node scripts/csca-adaptive-rules-test.cjs`；E2E: `subject practice starts...`。 |
| 3 | 用户提交某学科诊断后，后续进入该学科直接开始 5 题训练。 | 已完成 | `ADAPTIVE_ROUND_SIZE` / `ADAPTIVE_DIAGNOSTIC_ROUND_SIZE`。 | `node scripts/csca-adaptive-rules-test.cjs`；发布前复跑 `csca-adaptive-smoke`。 |
| 4 | 同一轮不会出现重复题。 | 已完成 | QuestionProvider 与曝光规则。 | `node scripts/csca-adaptive-rules-test.cjs`。 |
| 5 | 用户提交后可以看到报告和下一轮建议。 | 已完成 | `AdaptiveRoundReportView`；自动 AI 总结和下一轮准备。 | E2E: `subject practice report gives adaptive motivation before details`。 |
| 6 | 掌握度会随答题结果变化。 | 已完成 | `mastery-engine.service.ts`、`submitRound`。 | `node scripts/csca-adaptive-rules-test.cjs`。 |
| 7 | AI Coach 开启时可以给提示、错因解释和总结。 | 已完成 | `AICoachService`、prompt templates、前端 AI 解析卡。 | E2E: `subject practice shows a single AI mistake explanation...`；发布前复跑 `ai-provider-smoke`。 |
| 8 | AI Coach 关闭或失败时，训练流程不中断。 | 已完成 | provider fallback、AI usage meter、fallback reserve 不写 ledger。 | `node scripts/csca-adaptive-rules-test.cjs`。 |
| 9 | 旧 `/csca-special-practice` 普通用户链接不再作为已知路由。 | 已完成 | 普通入口迁到 `/csca-subjects`；旧 route E2E。 | E2E: `old special practice user route is no longer exposed`。 |
| 10 | 固定模考功能不受影响，并逐步接入同一学习证据。 | 已完成 MVP 级弱联动 | `CscaMockExamPage`、mock submit 记录 learning evidence。 | E2E: `mock exam subject page recommends the next paper in place`；`node scripts/csca-learning-dashboard-rules-test.cjs`。 |
| 11 | TypeScript 构建、规则测试、smoke 验证通过。 | 已完成 | 前端 build、后端 noEmit、Prisma、规则测试、AI provider smoke、adaptive smoke、release smoke 均通过。 | 本文“本轮验证记录”。 |
| 12 | 主要训练事件有日志或数据记录，便于后续分析。 | 已完成 | `CscaTrainingEvent`、AI interaction、learning snapshots、wrong patterns。 | `node scripts/csca-adaptive-rules-test.cjs`。 |
| 13 | 低评分 AI Coach 反馈能进入后台复核队列，管理员能写入处理结论并产生审计记录。 | 已完成 | `AIObservabilityService`、review queue、review decision API。 | `node scripts\csca-adaptive-release-smoke.cjs`，本轮已跑通 `reviewDecision` 与 `auditCount`。 |

## 3. 本轮验证记录

已通过：

```powershell
node scripts\csca-adaptive-rules-test.cjs
node scripts\csca-learning-dashboard-rules-test.cjs
node scripts\ai-credit-purchase-smoke.cjs
npm.cmd run prisma:validate
npm --prefix frontend run build
backend\node_modules\.bin\tsc.cmd -p backend\tsconfig.json --pretty false --noEmit --incremental false
git diff --check
node scripts\ai-provider-smoke.cjs
node scripts\csca-adaptive-smoke.cjs
node scripts\csca-adaptive-release-smoke.cjs
```

`ai-credit-purchase-smoke` 已确认：

- 初始免费额度为 50。
- 固定购买包入账 100。
- 最终余额为 150。
- 重复支付回调不会重复入账。

本轮发现并修复：

- `csca-adaptive-smoke` 暴露出 `rule-fallback` AI 使用仍写入 `CscaAIUsageLedger` 的问题。
- 已修复 `AIEntitlementService.reserve`：`rule-fallback` 直接通过，不触碰 entitlement account，不写 usage ledger。
- 已新增规则测试 `testAIEntitlementFallbackReserveIsNotLedgered` 防回归。

本轮 smoke 已确认：

- `csca-adaptive-smoke` 跑通首次 20 题诊断、后续 5 题训练、AI hint、错因解析、轮次总结、训练事件和额度扣减。
- `ai-provider-smoke` 通过，LLM provider 适配层可用。
- `csca-adaptive-release-smoke` 跑通准发布主流程，并确认后台复核链路：`reviewDecision=accepted`、`auditCount=1`。

浏览器只读验收已确认：

- `/zh/csca-subjects/math` 首屏为 `CSCA 数学`，主入口为 `开始 20 题诊断`，未出现旧专题列表。
- `/zh/csca-special-practice` 返回 404 占位页，不再作为普通用户训练入口。
- `/zh/me` 未登录时显示登录门禁，无 console error。

## 4. 当前非阻塞风险

1. 外部 LLM live call 会消耗额度，发布流程应明确何时允许跑 live smoke，避免误消耗。
2. 概念卡已经从当前 MVP 验收中移出；二期实现时需要同时补数据库、后台维护、前端插入点和审核策略。
3. 机构额度池、BYOK、prompt 后台发布和独立 BI 看板均为二期，不阻塞当前科目练习智能化 MVP。

## 5. 发布前最后动作

1. 停掉旧后端进程。
2. 运行 migration。
3. 重启后端。
4. 跑 `ai-provider:smoke`、`csca-adaptive:smoke`、`csca-adaptive:release-smoke`。
5. 用浏览器手动走一遍：首次 20 题诊断、5 题训练、错题 AI 解析、报告页、下一轮、个人页学习驾驶舱。

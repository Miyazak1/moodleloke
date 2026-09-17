# CSCA Readiness Final Handoff

> 日期：2026-06-10  
> 范围：个人页备考成熟度、推荐动作校准、中高难 sampled 阈值发布门禁  
> 状态：可进入发布交接。sampled 阈值默认仍关闭，需按 runbook 显式启用。

## 1. 交付结论

这条主线已经从“个人页上一个难解释的 43/100 分数”升级为一套可解释、可观测、可校准、可回滚的 readiness 机制。

用户侧现在应理解为：

- 分数是“备考成熟度”，不是模考成绩。
- 系统会同时说明证据置信度、主要短板和下一步动作。
- 题量、知识覆盖、题目难度、模考、复盘验证和学习节奏都会影响结论。
- 证据不足时不会给出确定的 `exam_ready` 结论。

运营侧现在应具备：

- 推荐动作点击和跟进观测。
- 能力改善率与 mastery delta 校准信号。
- 每日 readiness action calibration snapshot。
- 管理员手动刷新和定时刷新。
- 中高难 sampled threshold distribution。
- sampled 阈值发布 checklist。
- 上线前、上线后和回滚 evidence pack。

## 2. 用户侧能力

个人页 readiness 目前覆盖这些核心问题：

- `score`：0-100 的备考成熟度，不等于考试分数。
- `confidence` / `confidenceReason`：告诉用户系统对当前判断有多确定。
- `scoreExplanation`：解释分数来自哪些证据。
- `dimensions`：覆盖 `coverage`、`mastery`、`mock`、`review`、`rhythm`、`evidence`。
- `blockers`：阻止进入成熟状态的关键原因。
- `nextActions`：最多 3 个按 `expectedGain` 排序的建议动作。
- `actionOutcome`：展示最近建议是否被跟进、是否带来能力改善。

关键产品规则：

- 高题量但低覆盖，不能进入 `exam_ready`。
- 基础题高正确率但中高难独立样本不足，不能进入 `exam_ready`。
- 三科覆盖、高权重 topic、模考、复盘验证和节奏都达标，才允许进入 `exam_ready`。
- 复盘不是单纯“点完成”，而是会进入“已复盘待验证 / 已验证修复”的闭环。

## 3. Admin 与 Ops 能力

Admin Audit 现在新增或增强了这些入口：

- readiness recommendation observability：点击数、跟进数、跟进率、能力改善率、平均 expectedGain、平均 mastery delta。
- action type calibration：按 action type 输出 multiplier、status 和样本情况。
- calibration snapshots：按日期和 action type 持久化校准结果。
- calibration health：检查快照缺失、过期、空样本、`needs_calibration` 和 sampled 分布样本不足。
- high-difficulty threshold distribution：展示各学科 sampled 推荐阈值、p50/p60/p80、样本量和来源。
- sampled-threshold rollout checklist：把发布条件拆成样本量、校准健康、影响人数上限和 sampled mode 开关。
- readiness evidence history：Admin Audit 可列出最近 readiness evidence / comparison evidence，并下载单份 JSON 作为发布审批附件。

Ops 侧新增脚本：

- `npm run csca-learning:rules`
- `npm run csca-readiness:release-gate`
- `npm run csca-readiness:evidence`
- `npm run csca-readiness:evidence:compare`
- Admin API: `GET /api/v1/admin/csca-learning/readiness-evidence`
- Admin API: `GET /api/v1/admin/csca-learning/readiness-evidence/:name`

`verify:local` 已包含 `csca-readiness:release-gate`。

## 4. 关键文件

后端：

- `backend/src/csca-learning/csca-learning.service.ts`
- `backend/src/csca-learning/csca-learning.types.ts`
- `backend/src/csca-special-practice/training-event.service.ts`
- `backend/src/admin-audit/admin-audit.controller.ts`
- `backend/src/admin-audit/admin-audit.service.ts`
- `backend/src/ops/readiness-calibration-scheduler.service.ts`
- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/0043_readiness_action_calibration_snapshots/`

前端：

- `frontend/src/pages/PublicMePage.tsx`
- `frontend/src/pages/AdminAuditPage.tsx`
- `frontend/src/lib/api-types.ts`
- `frontend/src/lib/api-admin.ts`

脚本与文档：

- `scripts/csca-learning-dashboard-rules-test.cjs`
- `scripts/csca-readiness-release-gate.cjs`
- `scripts/csca-readiness-evidence-pack.cjs`
- `docs/readiness-evidence-engine-architecture.md`
- `docs/ops-runbook.md`
- `docs/personal-page-product-review-and-readiness-plan.md`

环境变量示例：

- `.env.example`
- `.env.production.example`

## 5. 环境变量

Calibration snapshot schedule：

- `CSCA_READINESS_CALIBRATION_SCHEDULE_ENABLED`
- `CSCA_READINESS_CALIBRATION_SCHEDULE_HOUR`
- `CSCA_READINESS_CALIBRATION_SCHEDULE_MINUTE`
- `CSCA_READINESS_CALIBRATION_SCHEDULE_RUN_ON_STARTUP`

中高难阈值：

- `CSCA_READINESS_HIGH_DIFFICULTY_THRESHOLD_MODE`
- `CSCA_READINESS_HIGH_DIFFICULTY_REQUIRED_MATH`
- `CSCA_READINESS_HIGH_DIFFICULTY_REQUIRED_PHYSICS`
- `CSCA_READINESS_HIGH_DIFFICULTY_REQUIRED_CHEMISTRY`
- `CSCA_READINESS_SAMPLED_THRESHOLD_MAX_IMPACT_USER_SUBJECTS`

Evidence pack：

- `CSCA_READINESS_EVIDENCE_BASE_URL`
- `CSCA_READINESS_EVIDENCE_TOKEN`
- `CSCA_READINESS_EVIDENCE_PHASE`
- `CSCA_READINESS_EVIDENCE_DAYS`
- `RELEASE_EVIDENCE_DIR`

默认生产姿态应保持：

```text
CSCA_READINESS_HIGH_DIFFICULTY_THRESHOLD_MODE=static
CSCA_READINESS_SAMPLED_THRESHOLD_MAX_IMPACT_USER_SUBJECTS=5
```

## 6. 发布步骤

1. 保持 sampled mode 关闭，确认当前仍为 `static`。
2. 跑本地 readiness 门禁：

```bash
npm.cmd run csca-readiness:release-gate
```

3. 跑本地完整门禁：

```bash
npm.cmd run verify:local
```

4. 在 Admin Audit 手动刷新 readiness calibration snapshots。
5. 确认 calibration health 为 healthy 或仅 watching。
6. 确认 sampled-threshold rollout checklist 为 ready。
7. 生成上线前 evidence：

```bash
CSCA_READINESS_EVIDENCE_PHASE=pre_rollout npm run csca-readiness:evidence
```

8. 设置 sampled mode 并重启后端：

```text
CSCA_READINESS_HIGH_DIFFICULTY_THRESHOLD_MODE=sampled
```

9. 确认 Admin Audit 中各 eligible subject 的 threshold source 为 `sampled_distribution`。
10. 生成上线后 evidence：

```bash
CSCA_READINESS_EVIDENCE_PHASE=post_rollout npm run csca-readiness:evidence
```

11. 发布窗口内观察 impacted user-subject count、calibration alerts、readiness stage distribution 和用户反馈。

## 7. 回滚步骤

1. 设置：

```text
CSCA_READINESS_HIGH_DIFFICULTY_THRESHOLD_MODE=static
```

2. 重启后端。
3. 确认 Admin Audit 显示 static/default threshold mode。
4. 生成 rollback evidence：

```bash
CSCA_READINESS_EVIDENCE_PHASE=rollback npm run csca-readiness:evidence
```

5. 保留 calibration snapshots，不要清理历史证据。

立即回滚条件：

- rollout checklist 变为 `blocked`。
- calibration health 变为 `needs_attention` 或 `blocked`。
- impacted user-subject count 超过 `CSCA_READINESS_SAMPLED_THRESHOLD_MAX_IMPACT_USER_SUBJECTS`。
- sampled 分布失去任一学科资格。
- 用户反馈显示 readiness 结论更难理解或信任下降。

## 8. 验证矩阵

本轮最终验收建议至少跑：

```bash
npm.cmd run csca-readiness:release-gate
npm.cmd run csca-readiness:evidence
npm.cmd run csca-readiness:evidence:compare -- --allow-blocked
npm exec tsc -b --pretty false
node scripts\csca-learning-dashboard-rules-test.cjs
node scripts\csca-adaptive-rules-test.cjs
npm --prefix backend run build
npm --prefix frontend run build
git diff --check
```

已知注意事项：

- Windows 上 backend build 可能出现 Prisma query engine DLL 文件锁 warning；此前验证中命令退出码为 0。若发版前需要重新生成 Prisma client，先停止占用 backend/client 的 Node 进程再跑。
- `csca-readiness:evidence` 在没有 live Admin API 配置时会生成 fixture-shaped 模板，用于交接和发布检查格式；真实发布证据需要配置 base URL 与 token 或管理员账号。
- `csca-readiness:evidence:compare` 默认比较 `RELEASE_EVIDENCE_DIR` 中最新两份 readiness evidence；真实发布评审建议显式传入 `--before` 和 `--after`。加 `--write` 会把 comparison evidence 写入同一目录，文件名为 `csca-readiness-compare-...json`，且不会被下一次默认 compare 选作输入。

## 9. 剩余可选项

当前主线已经可交接。后续可选增强不阻塞发布：

- 按 `docs/readiness-copy-guidelines.md` 持续清理用户侧文案，避免把 calibration、threshold、confidence、evidence 等内部术语直接暴露给学生。
- Admin Audit 增加 evidence JSON 下载或历史列表。
- sampled threshold distribution 加更细的 subject/topic drilldown。
- readiness stage distribution 做发布前后趋势图。
- 将 calibration health 接入外部告警。
- 将 comparison evidence 接入 CI 或发布审批系统。
- 给 Admin evidence 历史增加筛选、固定保留策略或外部对象存储归档。

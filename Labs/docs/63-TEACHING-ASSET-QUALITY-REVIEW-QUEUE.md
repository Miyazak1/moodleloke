# PR12G：教学资产质量告警与人工复核队列

## 目标

把 PR12F 的效果指标转换为可跟进的运营工作，而不是让管理员逐个打开资产猜测哪里有问题。系统负责确定性识别风险，管理员负责确认、调查和关闭；任何告警都不会自动下架内容或修改学生掌握度。

## 队列入口与接口

后台入口：`/admin/content/teaching-assets` 顶部“质量复核队列”。

- `GET /api/v1/admin/teaching-assets/quality-alerts?days=30`
- `POST /api/v1/admin/teaching-assets/quality-alerts/:alertKey/actions`

接口继续使用管理员权限保护，只返回聚合指标，不返回学生身份或作答内容。

## 告警类型

1. `minimum_sample_not_met`：互动上下文、独立学生或独立验证样本不足；
2. `learning_outcome_below_floor`：独立验证或即时检查低于复核底线；
3. `engagement_or_verification_below_target`：完成或独立验证低于观察目标；
4. `version_regression`：同语言新版本相对上一发布/下架版本显著退化。

版本退化阈值：两版本都达到相应最低样本时，独立验证通过率下降至少 15 个百分点，或即时检查首次正确率下降至少 20 个百分点。

## 工作流

```text
open -> acknowledged -> resolved
  |          |             |
  +----------+-------------+-> open（重新打开）
```

每次动作必须填写原因，写入 `AdminAuditLog`。当前版本、统计窗口、效果策略、信号和原因共同生成确定性告警指纹：如果指标策略或版本发生变化，旧告警的“已解决”状态不会遮蔽新的风险。

## 存储决策

PR12G 不增加与学习事实重复的新业务表。告警从现有 TeachingAsset、Exposure、Interaction、Intervention Outcome 和 Stability 数据实时派生；人工工作流状态作为管理员治理事件写入现有审计日志。后续只有在队列规模和查询频率证明需要时，才增加物化快照或专用工单表。

## 安全边界

- 只评估当前已发布版本；
- 告警只读地观察学习事实；
- `automaticAction=false` 仍是硬约束；
- 解决告警不等于资产质量已被系统证明，只代表管理员完成当前指纹对应的处置；
- 已下架版本不会继续占据当前复核队列，但历史审计保留。

## 验收

真实本地脚本验证小样本告警从 open 经 acknowledged、resolved 再 reopen，并验证每次状态都可从审计事件恢复，同时保持发布状态和学习掌握度不变。

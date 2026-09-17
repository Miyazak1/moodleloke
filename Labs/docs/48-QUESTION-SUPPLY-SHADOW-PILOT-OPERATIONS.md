# PR10E：题源供给 Shadow 试点运营与健康诊断

## 1. 目标

PR10E 把 PR10D 的自动复核从“能定时跑”提升到“能被运营和排障”。本阶段记录每次运行、检测积压与失效租约、按学科检查样本新鲜度，并在 AI 运维后台展示诊断结果。

它仍只运行审核库存复核与 No-op Shadow 分发。健康状态、运行次数和验收报告均固定 `realAdapterAuthorized=false`，不能据此连接自动出题、审核或发布。

## 2. 运行历史

每次成功取得调度租约后写入 `QuestionSupplySchedulerRun`：

- 触发方式：`scheduled` 或 `manual`；
- 状态：`running`、`succeeded`、`failed`、`lease_expired`；
- 开始/完成时间；
- 复核、计划、创建与 Shadow 分发数量；
- 截断错误码。

手动“运行一次复核”也必须经过同一数据库租约，并保留管理员 actor 到既有 fulfillment 事件，不能绕开定时任务互斥。新实例取得过期租约后，会把超过租约期限仍为 `running` 的旧运行标为 `lease_expired`。

每轮结束还会再次按 worker 校验租约所有权。已经失去租约的旧 worker 不能把运行记为成功，而会留下 `SCHEDULER_LEASE_LOST`，避免多实例接管时产生虚假的成功记录。

迁移：`0093_question_supply_shadow_pilot_health`。

## 3. 健康诊断

管理员接口：

`GET /api/v1/admin/question-supply-requests/fulfillment/operations-health`

状态：

- `disabled`：scheduler 开关关闭；
- `healthy`：没有检测到当前运营异常；
- `warning`：需要关注但未证明链路失效；
- `critical`：最近运行失败、租约过期或复核失败率过高。

首版诊断项：

| Code | 级别 | 含义 |
| --- | --- | --- |
| `SCHEDULER_NEVER_RAN` | warning | 开关已开但没有持久状态 |
| `SCHEDULER_LAST_RUN_FAILED` | critical | 最近调度失败 |
| `SCHEDULER_LEASE_EXPIRED` | critical | 调度状态仍持有过期租约 |
| `SCHEDULER_OVERDUE` | warning | 超过约三倍调度间隔没有完成 |
| `STALE_OPEN_REQUESTS` | warning | 开放缺口超过 24 小时未更新 |
| `FAILED_FULFILLMENT_PLANS` | warning | 存在等待重试的失败计划 |
| `EXPIRED_PLAN_LEASES` | critical | fulfillment 计划租约过期 |
| `INVENTORY_CHECK_FAILURE_RATE_HIGH` | critical | 24 小时至少 5 次检查且失败率超过 10% |
| `SUBJECT_HAS_NO_RECENT_CHECKS` | warning | 某学科有开放缺口但 24 小时没有复核样本 |

“没有告警”只表示运行链健康，不代表题源充足，也不代表 PR10C 验收 Gate 达标。运营健康与证据质量必须分开查看。

## 4. 三科隔离

health 返回数学、物理、化学各自的开放缺口、过期缺口、24 小时检查/失败数、7 天恢复周期和最近检查时间。学科新鲜度不会跨科借样本：数学刚完成复核不能掩盖物理缺口未复核。

## 5. 数据和权限边界

- health 与运行历史只对管理员开放；
- operations health 与 recent runs 不返回 worker ID、用户 ID 或 request ID；独立 scheduler 状态接口仍仅供管理员排障；
- 运行摘要只保存计数和触发类型；
- 学生主流程不依赖 health 查询成功；
- 诊断不会自动重置状态、删除失败样本或触发内容生产。

## 6. 试点操作顺序

1. 启动时应用 0092、0093 迁移；
2. 确认 scheduler 开关和 No-op Adapter；
3. 查看 operations health 是否存在租约或检查错误；
4. 分别查看三科 30 天验收报告；
5. 导出脱敏 JSON/CSV 留作评审快照；
6. 对告警修复根因，不删除样本、不降低门槛；
7. 只有独立 ADR 和人工批准才能进入真实适配器阶段。

## 7. 验证

- `npm --prefix backend run test:question-supply-shadow-scheduler`
- `npm --prefix backend run test:question-supply-operations-health`
- `npm --prefix backend run test:question-supply-evaluation`
- `npm run frontend:build`

下一阶段应让测试/受控环境运行足够长时间，形成真实三科样本快照和异常处置记录；不应继续通过增加代码模拟“样本已达标”。

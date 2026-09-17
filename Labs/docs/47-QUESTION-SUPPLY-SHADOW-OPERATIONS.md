# PR10D：题源供给 Shadow 自动复核与运营验收

## 1. 目标

PR10D 让 PR10B/PR10C 已有的精确库存复核可以在后台稳定积累真实 Shadow 样本，并让运营人员按学科查看与导出证据。它没有扩大 Agent 权限：仍不调用自动出题、不创建候选题、不审核、不发布，所有接口继续固定返回 `realAdapterAuthorized=false`。

## 2. 定时复核

`QuestionSupplyShadowSchedulerService` 只调用既有 `QuestionSupplyFulfillmentService`：

1. 精确复核开放缺口的审核库存；
2. 为仍然缺题的 request cycle 幂等创建 Shadow plan；
3. 调用 No-op Adapter 记录契约分发；
4. 保存本轮数量、状态和错误码。

开关与参数：

- `CSCA_QUESTION_SUPPLY_SHADOW_SCHEDULER_ENABLED`：总开关，且依赖 PR10A/PR10B 开关；
- `CSCA_QUESTION_SUPPLY_SHADOW_INTERVAL_MINUTES`：间隔，默认 15 分钟，范围 1–1440；
- `CSCA_QUESTION_SUPPLY_SHADOW_BATCH_SIZE`：每轮上限，默认 25，范围 1–100；
- `CSCA_QUESTION_SUPPLY_SHADOW_RUN_ON_STARTUP`：启动后是否立即运行，默认 true。

所有开关默认关闭。`start-cscalite-dev.bat` 在本地演示环境显式开启，并使用 5 分钟间隔。

## 3. 防重与故障恢复

调度器包含两层互斥：

- 进程内 `running` 防止同一实例重入；
- `QuestionSupplySchedulerState` 的数据库租约防止多个后端实例重复执行同一轮。

租约为 5 分钟，执行期间每分钟续租。进程崩溃后，其他实例只有在租约过期后才能接管。成功或失败都会释放租约，并写入最近开始时间、完成时间、摘要或脱敏错误码。计划层原有幂等键、租约与重试继续生效，所以调度租约意外过期也不会重复创建同一 request cycle 的计划。

状态接口：

`GET /api/v1/admin/question-supply-requests/fulfillment/scheduler`

## 4. 分学科验收报告

报告接口：

`GET /api/v1/admin/question-supply-requests/fulfillment/report?days=30`

它在同一时间窗、同一指标定义下返回 overall 以及 math、physics、chemistry 三份独立 Gate。每个学科必须独立达到样本门槛；数学样本不能替代物理或化学。后台 AI 运维页展示每科检查数、完成数、缺口确认率、恢复后可执行率和阻断项。

## 5. 脱敏运营导出

接口：

- JSON：`GET /api/v1/admin/question-supply-requests/fulfillment/export?days=30&format=json`
- CSV：`GET /api/v1/admin/question-supply-requests/fulfillment/export?days=30&format=csv`

导出只包含运营验收需要的来源、学科、知识点、需求数量、首次检查、恢复确认、耗时和状态。它不包含 `userId`、actor、原始 request ID 或领域实体 ID；request cycle 使用不可逆的截断 SHA-256 sample key。导出接口只对管理员开放。

## 6. 上线与回滚

迁移为 `0092_question_supply_shadow_operations`。生产部署时先应用迁移，再单独开启 scheduler 开关。关闭 scheduler 不影响手动复核、学生主流程和历史证据；关闭 PR10B 总开关会同时关闭 scheduler。

回滚应用代码时保留 scheduler state 和历史样本供审计。不得通过删除失败样本、缩短统计窗口或合并三科样本让 Gate 人为变绿。

## 7. 验证

- `npm --prefix backend run test:question-supply-shadow-scheduler`
- `npm --prefix backend run test:question-supply-evaluation`
- `npm --prefix backend run test:question-supply-fulfillment`
- `npm run frontend:build`

PR10D 完成后，下一阶段应先积累并检查真实 Shadow 样本；只有独立 ADR 明确批准、内容侧提供幂等接收端、kill switch 与回放演练通过，才讨论真实生产适配器。

PR10E 已进一步增加持久运行历史、过期运行恢复、运营健康诊断和逐学科样本新鲜度，详见 [48-QUESTION-SUPPLY-SHADOW-PILOT-OPERATIONS.md](./48-QUESTION-SUPPLY-SHADOW-PILOT-OPERATIONS.md)。

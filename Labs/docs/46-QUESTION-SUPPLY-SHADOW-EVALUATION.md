# PR10C：题源供给 Shadow 评估与恢复确认

## 1. 目标

PR10C 回答的不是“能不能接自动出题”，而是三个更早的问题：

1. Agent 上报的缺口是否经原领域检查再次确认；
2. 审核库存恢复后，原领域入口是否真的重新变为可执行；
3. Shadow 交接本身是否稳定、及时且没有重复放大需求。

本阶段继续使用 No-op Adapter。无论评估结果如何，接口都固定返回 `realAdapterAuthorized=false`；真实内容生产连接仍需独立 ADR、内容侧幂等接收端和人工批准。

## 2. 两层恢复证据

只把补库需求标为 `resolved` 不能证明学生后来真的能使用。PR10C 区分：

- `sufficient`：PR10B 使用原领域选择器重新检查，确认已审核库存满足；
- `domain_preflight_passed`：学生之后再次获得今日方案或干预验证卡时，原领域入口再次通过同一组题源约束；
- `task_started`：教学干预验证真正创建了受约束的练习轮次。

`QuestionSupplyRecoveryConfirmation` 按 `(requestId, requestCycle, confirmationKind)` 去重，不保存 `userId`。确认只能由后端原领域路径 best-effort 写入，浏览器、模型和插件均不能伪造。

如果领域执行前检查先于后台定时复核发现库存已经恢复，它可以原子地解决当前需求、完成对应 Shadow 计划并写入确认。学生链路不依赖评估写入成功。

## 3. 缺口复核样本

每次 PR10B 精确复核都会追加 `QuestionSupplyInventoryCheck`：

- `still_short`：真实约束下仍然缺题；
- `sufficient`：真实约束下库存已恢复；
- `check_failed`：复核过程失败，不能当作缺口或恢复证据。

记录包含 request cycle、checker version、请求量与可用量。评估时每个 cycle 只取窗口内第一次检查计算“缺口确认率”，避免频繁轮询放大样本。

## 4. 30 天评估指标

后台接口：

`GET /api/v1/admin/question-supply-requests/fulfillment/evaluation?days=30`

返回：

- 需求行、累计观察与重复聚合率；
- 有复核证据的 cycle、首次复核确认缺口率和复核失败数；
- 完成 cycle、恢复后可执行确认率、真实启动率；
- Shadow 分发失败率；
- 从计划创建到库存恢复的 median / P90 时长；
- 按来源和学科的拆分；
- 评估 Gate 与明确阻断项。

后台 AI 运维页同步显示近 30 天 Gate、缺口确认率、恢复后可执行率、P90 和样本量。

## 5. 首版 Gate

| 指标 | 门槛 |
| --- | ---: |
| 已检查 cycle | ≥ 30 |
| 已完成 cycle | ≥ 20 |
| Shadow 分发尝试 | ≥ 20 |
| 首次复核确认缺口率 | ≥ 80% |
| 恢复后领域入口可执行率 | ≥ 90% |
| Shadow 分发失败率 | ≤ 5% |
| 恢复时长 P90 | ≤ 72 小时 |

状态语义：

- `insufficient_sample`：样本量不足，不作放量结论；
- `hold`：样本够但至少一个质量门不达标；
- `shadow_evidence_ready`：Shadow 证据达到首版门槛，但**不代表真实适配器获批**。

“任务启动率”只对已经存在真实启动回调的教学干预验证有意义；普通今日方案当前只确认入口可执行，不能把跳转地址当成练习已经完成。

## 6. 偏差和限制

- `observationCount` 是当前需求行的累计快照，不是严格按窗口切分的事件数；因此重复聚合率用于发现异常放大，不用于财务结算；
- 只有运行 Shadow 复核才产生 inventory check，缺少检查的 cycle 不进入缺口确认率分母；
- 内容团队尚未真实消费 demand，恢复时长可能来自人工补题或其他题库流程；
- 今日方案的 `domain_preflight_passed` 证明可创建入口恢复，不证明学生点击或完成；
- 评估必须按来源和学科查看，不能用数学样本替代物理或化学。

## 7. 验证与回滚

- 迁移：`0091_question_supply_recovery_evaluation`；
- 专项测试：`npm --prefix backend run test:question-supply-evaluation`；
- 题源请求、Shadow fulfillment、Agent 今日方案和教学干预验证测试共同覆盖回归；
- 关闭 PR10A/PR10B 开关可停止新增缺口和 Shadow 复核；恢复确认写入始终是 best-effort，不会阻断学生主流程；
- 回滚应用代码不会删除历史评估记录，数据库表保留供审计。

下一阶段若样本不足，应先运行本地/测试环境回放与受控运营试点；不得为了让 Gate 变绿而伪造确认、降低领域约束或直接调用自动出题。

PR10D 已增加带数据库互斥租约的可关闭定时复核、脱敏 JSON/CSV 导出和三学科独立验收报告，详见 [47-QUESTION-SUPPLY-SHADOW-OPERATIONS.md](./47-QUESTION-SUPPLY-SHADOW-OPERATIONS.md)。它只自动运行本阶段已有复核，不改变真实适配器未授权的结论。

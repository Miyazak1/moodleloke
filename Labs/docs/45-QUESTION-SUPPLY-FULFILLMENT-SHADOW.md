# PR10B：题源补充 Shadow 消费与库存恢复对账

## 1. 结论

PR10B 把 PR10A 的聚合缺口转换为内容侧可稳定消费的 `QuestionSupplyDemandV1`，但当前适配器仍是 **Shadow No-op**：它只证明契约、幂等、租约、重试和恢复对账能够跑通，不调用自动出题，不创建候选题，不审核，也不发布。

```text
Agent / 教学干预
  -> QuestionSupplyRequest（学生身份隔离的聚合缺口）
  -> 先复核现有已审核库存
      -> 已满足：自动 resolved，不创建生产工作
      -> 仍不足：QuestionSupplyFulfillmentPlan（每个 request cycle 一个）
  -> QuestionSupplyDemandV1
  -> Shadow No-op Adapter

独立内容生产、审核、发布
  -> 已审核题库发生变化
  -> 下一次精确库存复核
  -> request resolved + plan completed
```

因此，页面里的“运行一次复核”不是“开始出题”。管理员不能从 Agent 运维面板控制 Prompt、模型、审核结论或发布状态。

## 2. 稳定消费契约

`QuestionSupplyDemandV1` 只暴露内容生产真正需要的聚合维度：

- `demandKey`、`requestId`、`requestCycle`；
- 来源、学科、知识点、难度、任务类型与验证阶段；
- 固定的 `reviewed_published_only` 题源政策；
- 所需数量、最后已知库存、缺口数量；
- 不含用户标识的结构约束和观察时间。

契约采用严格 Zod Schema，当前 `schemaVersion=1`。它明确不包含 `userId`、学习状态、分数、处方实体 ID 或模型参数。未来真实内容生产适配器必须实现同一个 Port；Agent 代码不允许反向依赖自动出题模块。

## 3. 周期、幂等与状态

同一个 `QuestionSupplyRequest` 在一次生命周期内使用一个 `cycle`。已解决或已忽略的需求再次被真实观察到时，cycle 加一；每个 `(requestId, requestCycle)` 最多生成一个计划。`demandKey` 由 request key、cycle 和契约版本确定性计算，可供外部消费者去重。

```text
planned -> leased -> shadow_dispatched -> completed
              |              ^
              v              |
            failed ----------+

过期 leased -> 再次领取
人工终止需求 -> 后续不再领取
```

领取使用 `status + updatedAt` CAS、60 秒租约和 worker ID。临时失败会清空租约并使用有上限的指数退避；失去租约的 worker 不能写入成功或失败事件。计划事件由数据库触发器保护为只追加。

## 4. 精确库存恢复

对账必须使用与真实任务创建相同的领域检查，不能只看一个汇总计数：

- 今日方案缺口调用 `LearningReadCapabilityService.getQuestionSupplyStatus`，按学科、知识点、难度和所需数量重新检查已审核库存；
- 教学干预验证读取原验证记录，再调用 `AdaptiveQuestionProviderService.pickIndependentVerificationQuestions`，保留用户已曝光题排除和 transfer signature 约束。

运行顺序固定为“先复核、再建计划、最后 Shadow 分发”。这样库存已经由人工或其他内容流程补齐时，不会制造多余生产工作。只有复核确实满足后，需求才自动 `resolved`，对应计划才 `completed`；学生真正创建练习时仍会再次执行原有库存门禁。

## 5. 管理接口与界面

仅管理员可访问：

- `GET /api/v1/admin/question-supply-requests/fulfillment/plans?limit=50`：查看计划、需求和最近事件；
- `POST /api/v1/admin/question-supply-requests/fulfillment/run`：执行一次有界复核、物化和 Shadow 分发，`limit` 为 1–100；
- AI 运维页“生成队列”标签增加独立的题源交接面板，并明确标注 Shadow 与“不调用生成”。

运行开关为 `CSCA_QUESTION_SUPPLY_FULFILLMENT_SHADOW_ENABLED`，它还依赖 PR10A 的 `CSCA_QUESTION_SUPPLY_REQUEST_ENABLED`。两者默认均视为关闭，本地一键启动脚本显式开启。

## 6. 迁移、测试与恢复

- 迁移：`0090_question_supply_fulfillment_shadow`；
- 后端测试：`npm --prefix backend run test:question-supply-fulfillment`；
- PR10A 周期回归：`npm --prefix backend run test:question-supply-request`；
- 关闭 Shadow flag 即可立即停止新的物化、领取和自动对账，不影响学生降级路径；
- 计划与事件保留供审计，关闭开关不删除历史；
- 数据库迁移不在代码提交时自动执行，部署时按现有 Prisma migration 流程应用。

## 7. 真实适配器启用门槛

PR10B 不授权替换为真实出题调用。PR10C 已增加缺口复核、恢复确认和 30 天 Shadow Gate，详见 [46-QUESTION-SUPPLY-SHADOW-EVALUATION.md](./46-QUESTION-SUPPLY-SHADOW-EVALUATION.md)。只有真实运营样本达到门槛、另行 ADR 批准、内容系统提供幂等接收端、审核发布仍保持独立权限，并完成 kill switch 与回放演练后，才可以新增真实适配器；不得直接修改当前 Shadow Adapter 让它偷偷调用生成器。

# PR8C：学习干预效果验证闭环

## 1. 本阶段目标

学生完成经过审核的知识点讲解后，系统不能把“看完”当成“学会”。本阶段增加一组独立验证题，用真实作答证据判断本次干预的即时效果，并把结论交还 Agent 安排下一步。

固定边界：

- 验证由系统推荐，不要求学生自己判断该练什么；
- 只使用同知识点、已审核、该学生从未曝光的现有可信题；
- 不调用大模型、AI 网关或自动出题系统；
- 题目不足时记录供给缺口，不临时生成题；
- 提交整组前不即时判题、不显示答案、不提供提示或解析；
- 阅读讲解、启动验证和写入 Outcome 都不直接修改掌握度；
- 正式模考进行中不推荐、不启动；
- 验证是非阻断任务，在 Agent 类型化工作区内完成并回到原对话。

## 2. 状态与数据模型

### LearningInterventionVerification

```text
recommended -> starting -> started -> completed
     |                         
     +-----------------> supply_unavailable
```

该记录冻结干预、Delivery、内容版本、选题版本、测量版本和三道题的版本化引用。`deliveryId` 唯一，避免同一次讲解重复创建验证；`startRequestId` 唯一，并通过 `starting` 抢占状态避免并发启动两个练习轮次。

题目引用来自 `CscaQuestion`，须满足：

- `status = approved`；
- `sourceType != ai` 且不是派生题；
- 所属考试知识点为 `published`；
- 质量记录没有 `needsReview`；
- 不在本次讲解来源排除项内；
- 当前用户不存在题目曝光、测量曝光或历史学习证据。

启动时练习域会再次检查这些条件，并在数据库事务中预留 `AssessmentItemExposure`。如果题目在推荐与启动之间已被曝光或失效，任务转为 `supply_unavailable`，不会降级到生成题。

### LearningInterventionOutcome

Outcome 对 Verification 和 Delivery 都是一对一，保存：

- 正确题数、总题数和准确率；
- 是否全过程独立作答；
- 使用的 Learning Evidence 引用；
- 版本化测量口径；
- `passed`、`failed` 或 `inconclusive` 结论。

即时口径 v1：三题全部作答、无提示与解析、证据齐全且正确率至少 `2/3` 为 `passed`；非独立或证据不完整为 `inconclusive`；其余为 `failed`。这是干预效果追踪结果，不是 Outcome writer 对掌握度的直接写入。后续掌握度仍由统一的学习证据投影流程计算。

## 3. 领域复用与隔离

验证复用已有 `CscaAdaptiveSession`、`CscaAdaptiveRound`、题目快照、草稿保存、整组提交和 Learning Evidence 管道。`plannerSnapshot.mode = intervention_verification` 明确标识独立验证轮次。

服务端是泄题防线：

- 单题检查接口返回 `INDEPENDENT_VERIFICATION_NO_LIVE_CHECK`；
- AI Coach 提示和解析返回 `INDEPENDENT_VERIFICATION_ASSISTANCE_DISABLED`；
- 前端同时隐藏 AI 额度、提示、解析以及实时对错统计；
- 整组提交后才展示报告并结算 Outcome。

自动出题系统与本流程保持依赖隔离。未来题目供应应通过“审核后进入可信题库”的异步发布边界扩充，而不是由 Agent 在学生请求期间直接调用生成器。

## 4. API 与前端流程

1. `POST /api/v1/agent/intervention-verifications/offer`
   - 查找最近完成且未验证的 Delivery；
   - 选取三道独立可信题；
   - 返回推荐卡，或返回 `REVIEWED_UNEXPOSED_SUPPLY_UNAVAILABLE`。
2. `POST /api/v1/agent/intervention-verifications/:id/start`
   - 校验用户、期限、模考状态和题目版本；
   - 幂等创建独立验证轮，并返回练习路由。
3. `POST /api/v1/agent/intervention-verifications/:id/settle`
   - 要求轮次已提交；
   - 读取不可撤销的有效证据并幂等写入 Outcome；
   - 返回验证结论。

Agent 卡片说明“为什么现在验证”，但不会替学生暴露答案或技术规则。Agent 验证工作区保留正常作答体验，提交后在同一界面显示报告；关闭报告前先结算验证，再以最新证据请求下一步方案。

## 5. 开关、迁移与验收

开关：`CSCA_LEARNING_INTERVENTION_VERIFICATION_ENABLED=true`。它依赖 Foundation、Shadow Projection、Intervention Shadow 和 Intervention Delivery 全部开启。

迁移：`0082_learning_intervention_verification`。

专项验收覆盖：

- 审核、来源、质量与从未曝光过滤；
- 题目不足安全降级且不调用 AI/生成器；
- 正式模考抑制与用户权限隔离；
- 启动重放幂等；
- Outcome 的独立性、证据引用和结论；
- 服务端即时判题与 AI 辅助禁用；
- 学习状态与自动出题隔离守卫。

下一阶段应增加延迟保持验证和跨题型迁移验证，使“即时做对”逐步升级为“稳定掌握”，并由统一决策层根据即时、保持和迁移证据选择复习、再讲解或继续推进。

# PR8D：保持与迁移验证

## 1. 为什么不能“立即做对 = 已掌握”

PR8C 只能回答学生在刚看完讲解后能否独立完成同知识点题目。它仍可能受到短时记忆、相似题结构和刚发生的提示效应影响。本阶段把干预效果拆成三个有顺序的测量阶段：

```text
immediate 即时独立验证
    通过
      ↓ 延迟到期
retention 保持验证
    通过
      ↓ 更换任务结构
transfer 迁移验证
    通过
      ↓
stable 稳定掌握证据成立
```

任一阶段失败得到 `not_stable`；证据不完整、非独立作答或题目供给不足得到 `inconclusive`。三个阶段的 Outcome 都是决策层输入，不由 Outcome writer 直接修改掌握度。

## 2. 数据模型演进

`LearningInterventionVerification` 新增：

- `phase`：`immediate`、`retention` 或 `transfer`；
- `dueAt`：任务最早可领取时间；
- `selectionConstraints`：冻结迁移题的结构排除条件；
- `(deliveryId, phase)` 唯一约束，允许一次 Delivery 拥有三个阶段且每阶段只创建一次。

`LearningInterventionOutcome.deliveryId` 不再唯一，仍保持 `verificationId` 唯一。

新增 `LearningInterventionStabilityAssessment`，每个 Delivery 仅一条聚合结论，保存：

- 聚合状态和 `stable / not_stable / inconclusive`；
- 版本化稳定性判定策略；
- 各阶段 Outcome、准确率与时间；
- 所有参与判定的学习证据引用。

迁移为 `0083_learning_intervention_stability`，已有 PR8C 数据自动归类为 `immediate`。

## 3. 时间策略

生产默认在即时验证通过 24 小时后开放保持验证：

```text
CSCA_INTERVENTION_RETENTION_DELAY_HOURS=24
```

允许范围为 1–168 小时。非生产环境可使用 `CSCA_INTERVENTION_RETENTION_DELAY_MINUTES` 做演示；本地一键启动脚本设置为 1 分钟。生产环境忽略分钟级演示参数，避免误把几乎即时的复测当成长期保持。

到期前 Agent 不展示任务，只返回 `nextDueAt`；到期时才实时选择仍未曝光的题，避免过早冻结题目后在其他练习中被学生看见。

## 4. 迁移题结构口径

迁移验证不是简单提高难度。每道可信题生成一个可审计的 `transferSignature`，优先级固定为：

1. 已保存 Question Plan 的 `taskFamily`；
2. 人工 Blueprint 的 `skill`；
3. 题型与知识分类标签组合。

迁移阶段必须有明确结构签名，并且签名不能与即时、保持阶段已使用的任何签名相同。无可靠标签或不同结构题不足三道时，记录 `CROSS_STRUCTURE_SUPPLY_UNAVAILABLE`，形成 `inconclusive` 聚合结论；不得把难度变化冒充能力迁移，也不得临时调用自动出题补齐。

启动练习时服务端会重新计算结构签名并核对冻结值，防止后台编辑或题目版本变化绕过迁移约束。

## 5. 编排和幂等

- 即时阶段通过：在结算事务内幂等创建 `scheduled retention`；
- 保持阶段到期：Agent offer 才执行可信题选择并转成 `recommended`；
- 保持阶段通过：在结算事务内幂等创建 `scheduled transfer`；
- 迁移阶段通过：聚合结论变为 `completed / stable`；
- 任一阶段失败或不确定：结束当前链路，不自动推进下一阶段。

阶段创建使用 `(deliveryId, phase)` 唯一约束，启动继续使用请求 ID、状态抢占、数据库曝光预留和崩溃恢复。正式模考进行中，offer 和 start 都由服务端阻断。

## 6. 题源和学习边界

三个阶段均只接受：

- `approved` 且所属知识点 `published`；
- `sourceType != ai`，不是派生题；
- 无 `needsReview`；
- 对当前用户无题目曝光、测量曝光和历史学习证据；
- 不复用本次验证链路之前的题目版本。

做题过程中继续禁止即时判题、答案、提示和 AI 解析。系统不调用 AI Gateway、不调用自动出题，也不写 `UserCscaTopicStateV2`。学习状态的变化只能通过统一 Learning Evidence 投影发生。

## 7. Agent 和本地演示

Agent 使用同一张非阻断推荐卡，按阶段显示：

- 讲解后的独立验证；
- 延迟保持验证；
- 跨题型迁移验证。

Agent 内的验证与报告工作区读取 round 中冻结的阶段，明确解释本轮是在测即时理解、延迟保持还是跨结构迁移。报告关闭前先结算当前阶段，并传递 `intervention_verification` 实体引用。Agent 随后通过统一 `learning.read` 能力 `get_intervention_stability` 按当前用户读取阶段结果和聚合结论；不信任客户端自行描述的成绩，也不会接受跨用户引用。该只读能力同时开放给网页 Agent、Codex 插件、ChatGPT 插件和内部通道，确保未来插件不另建一套判定逻辑。

Agent 仍以 Learning Evidence 投影和 Learning Prescription 决定下一项任务；从 PR8E 起，稳定性结论和已到期验证先进入确定性的 Learning Decision 输入，再由 Agent 解释为何继续巩固、等待保持验证或确认稳定掌握，并被冻结进方案 Artifact。若实体引用无效或无权访问，能力返回失败且不泄露资源，Agent 忽略这段不可信页面上下文，继续依赖当前用户自己的学习证据制定方案。

本地演示可依次完成即时验证，等待 1 分钟后刷新 Agent 获取保持验证；保持通过后迁移验证立即进入推荐队列。实际演示是否能完整跑通仍取决于该知识点是否拥有足够数量、且结构标签不同的审核题。

## 8. 验收范围

- 到期前不可领取、到期后才选题；
- 三阶段唯一性和顺序推进；
- 未曝光题过滤与跨结构签名排除；
- 结构标签启动时重校验；
- 供给不足形成明确不确定结论；
- 稳定、非稳定和不确定聚合；
- 用户权限、正式模考、启动及结算幂等；
- 禁止实时泄题、AI 辅助、AI/生成器调用和掌握度直接写入；
- 前后端生产构建及既有干预闭环回归。

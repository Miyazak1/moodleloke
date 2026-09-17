# ADR-007：架构收口、版本边界与生产缺口

> 状态：Accepted v1.0  
> 更新时间：2026-09-12  
> 目的：消除现有文档中的范围、接口和一致性歧义，冻结开工基线。

## 1. 发布阶段命名

后续文档和任务不得单独使用含义不明的“MVP”。统一使用：

| ID | 名称 | 目的 | 允许真实用户 |
| --- | --- | --- | --- |
| `PROTO-S` | Static Prototype | 验证信息架构和视觉交互 | 否 |
| `DEMO-V1` | Local Investor Demo | 本地跑通固定黄金路径 | 仅演示账号 |
| `WA-F0` | Web Agent Foundation | 只读能力、附件和安全基础 | 内部测试 |
| `LS-V1` | Learning Loop Vertical Slice | 目标—方案—练习—证据闭环 | 白名单测试 |
| `WA-P1` | Web Agent Pilot | P0 用户任务和受控写入 | 小流量用户 |
| `PLUGIN-P1` | Plugin Pilot | Codex 等宿主接入 | 明确授权用户 |
| `PROD-V1` | Production v1 | 达到生产、安全和运营门槛 | 灰度后全量 |

`WA-F0` 不创建训练；`LS-V1` 首次加入幂等练习创建；`WA-P1` 才承诺产品规格中的完整 P0 任务。附件在 `DEMO-V1/WA-F0` 可先独立验证，不阻塞学习闭环。

## 2. 文档事实优先级

发生冲突时按以下顺序执行：

1. Accepted ADR：不可在任务文档中改写架构决策；
2. `02-TOOL-CONTRACTS.md`：工具名、版本、DTO、风险等级和错误码唯一来源；
3. `03-AGENT-RUNTIME.md`：Run 状态机与 Web API 唯一来源；
4. `04-DATA-MODEL.md`：数据约束、事务和保留策略唯一来源；
5. 产品规格：描述用户结果，不重新定义技术契约；
6. Roadmap、Backlog、Demo Plan：只引用上述契约并安排顺序。

代码中的 `contracts/v1` 落地后成为可执行来源，文档必须通过契约测试与其保持同步。

## 3. Canonical API 与工具名

创建 Agent 请求的正式入口为：

```text
POST /api/v1/agent/conversations/:conversationId/messages
```

服务端原子创建 User Message 和初始 Run；客户端不能直接创建任意 Run。Run 的读取、事件、取消和确认沿用 Runtime 文档。

首条学习闭环使用的正式名称包括：

- `list_mock_exam_attempts`，不使用 `get_mock_exam_status`；
- `get_score_readiness` 表示目标分数备考预测；
- dashboard 内原有 `readiness.score` 只是兼容汇总字段，不注册为独立 Agent 工具；
- `get_question_supply_status` 只返回库存可用性，不返回未发布内容。

CI 必须从 Tool Registry 导出文档清单并检测重复、缺失和名称漂移。

## 4. 学习事件一致性

冻结为“事实同步落库，投影异步计算”：

```text
answer submission transaction
  -> validate ownership and immutable question revision
  -> save answer/result
  -> append LearningEvidenceEvent
  -> append LearningEvidenceOutbox
commit
  -> return evidenceVersion and current projectedStateVersion

projection worker
  -> claim outbox event
  -> order by user/subject sequence
  -> idempotently update UserCscaTopicStateV2
  -> advance LearningStateProjectionCheckpoint
  -> enqueue Gap/Forecast/Prescription recomputation
```

要求：

- 所有答题入口共用同一 Evidence Writer；
- PostgreSQL 是事实来源，Redis 只传递任务；
- 采用 at-least-once 投递和幂等消费，不声称 exactly-once；
- 每个用户/学科维护单调 `evidenceVersion`；
- 晚到事件按事件序号重放，不能仅按 Worker 到达时间覆盖；
- 下一题需要新状态时进行有上限等待；超时返回 `adaptationPending` 并使用明确版本的旧状态；
- Round、Gap 和 Prescription 不阻塞答案保存。

## 5. Outbox 边界

- `AgentOutbox`：只服务 Agent Run、Attachment 与 UI/SSE 事件；
- `LearningEvidenceOutbox`：与答案和 Evidence 同事务，服务学习状态投影；
- 自动出题使用其自身 Job/Outbox；
- 三者可以复用同一个 Dispatcher 基础库，但不能互相拥有领域数据。

因此关闭或移除 Agent 不会停止普通网页练习产生学习证据。

## 6. 统一版本向量

任何 Gap、Forecast 或 Prescription 至少绑定：

```ts
type LearningDecisionVersionVector = {
  goalVersion: string;
  availabilityVersion: string;
  evidenceVersion: string;
  learningStateVersion: string;
  learningModelVersion: string;
  syllabusVersion: string;
  scoringPolicyVersion: string;
  itemCalibrationVersion: string;
  decisionPolicyVersion: string;
  decisionContextVersion: string;
  forecastModelVersion: string;
};
```

`decisionPolicyVersion` 表示任务排序与干预策略版本；`decisionContextVersion` 冻结复习到期状态、近期模考、计划日期等不属于 Learning State 但会改变方案的动态输入；`forecastModelVersion` 表示分数预测模型版本。即使某个响应暂不展示分数，也必须记录用于该决策链的有效 Forecast 模型版本或明确的 `not-enabled` 版本标识，不能省略字段。

Forecast、Gap 和 Prescription 快照的自然幂等键至少包含：

```text
userId + goalId + hash(LearningDecisionVersionVector)
```

不得只使用 `learningStateVersion` 的子集代替完整版本向量；Evidence、学习模型、评分、校准、Forecast 模型或决策策略任一版本变化，都必须产生新快照或明确复用同一完整向量的已有快照。

发布新结果必须使用 compare-and-set 更新“当前快照”指针，旧任务完成后不能覆盖更新版本。

## 7. 测量题隔离

题目版本必须具有唯一测量角色：

- `TRAINING`：日常练习，可由审核通过的自动生成题供给；
- `DIAGNOSTIC`：短诊断；
- `CALIBRATION`：模型校准，不向普通推荐开放；
- `MOCK`：计时整卷；
- `RETIRED`：泄露、错误或失效。

生产规则：

- 同一题目版本在一个有效窗口内不能同时承担训练和无偏测量；
- 保存用户级 `AssessmentItemExposure`；
- 暴露过答案、解析或讲解的题，不再作为该用户的独立验证题；
- 保留池只能通过专用服务读取，Agent 和普通推荐无法枚举；
- 自动生成题默认只能进入 `TRAINING`，进入测量池需独立教研审批与校准；
- 泄露或题目纠错后转为 `RETIRED`，触发 Evidence 补偿和预测重算；
- 池大小、轮换周期、重复曝光冷却期由学科评测冻结。

## 8. Evidence 防污染

- 首次独立作答权重最高；
- 同题重复尝试使用递减权重并设置单题贡献上限；
- 看过完整答案、解析或同构例题后的正确只能作为“引导后表现”；
- 独立验证必须使用未曝光题或经过冷却的等价测量题；
- 用户确认手写 OCR 仅确认识别文本，不等于答案正确；
- 手写答案只有在原题版本、评分 rubric、关键符号置信度和评分结果均可信时进入 Evidence；
- topic weights 必须非负、版本化且总和为 1；
- 异常用时、批量猜测、客户端时间篡改和疑似答案共享进入低置信或排除状态；
- 所有降权保留 reason code，不能静默处理。

## 9. 学习时间模型

`weeklyGoalDays` 不足以支持按分钟优化。新增：

- `StudyAvailabilityPreference`：时区、每周分钟目标、偏好学习日、默认单次时长、可选时间窗；
- `SessionConstraint`：只对当前请求/当天生效，例如“今天只有十分钟”；
- `PlanCapacitySnapshot`：按目标日期和可用时间生成的容量快照。

短期约束默认不覆盖长期偏好。所有日期计算使用用户 IANA timezone；没有时区时明确使用账号默认值并标记来源。

## 10. 学生保护与供应商数据

在 `PROD-V1` 前必须冻结：

- 年龄适配和可能涉及未成年人的同意流程；
- 学生、监护人或学校账号的控制关系；
- 附件、手写内容和对话发送给模型供应商的告知与选择；
- 供应商保留、训练使用、数据区域和删除承诺；
- 数据访问、导出、更正、删除和撤回流程；
- 默认附件和对话保留期；
- 禁止将教育阶段、地区等敏感代理变量用于不透明降质或差别定价。

具体法律适用范围由正式法务/隐私评审确认，架构不得用一条通用勾选框替代。

## 11. 内容纠错与申诉

学生必须能举报题目、评分、讲解、OCR 和能力判断。处理工作流至少包含：

```text
report -> triage -> quarantine -> review -> decision
       -> correction/restore -> affected-user lookup
       -> Evidence compensation -> State/Forecast replay
       -> user notification -> audit close
```

严重错误在审核前先停止继续分发；人工不能直接改学生掌握度，必须通过纠错、补偿事件或有理由的正式 override 流程。

## 12. 生产运营门槛

`DEMO-V1` 可以使用标记清楚的降级；`PROD-V1` 必须另外冻结：

- API、队列、投影和模型供应商 SLO；
- RPO、RTO、备份恢复验证与区域故障策略；
- Outbox/队列积压、stale Forecast 和 dead-letter 阈值；
- dead-letter owner、处置时限和重放工具；
- 用户/机构/全局成本上限及异常费用熔断；
- 模型、策略、题库和评分规则的回滚兼容矩阵；
- 数据迁移、回填、双读/Shadow 和退出判据；
- 学科、语言、地区、年级和组织分群的质量/公平性门槛。

## 13. 当前允许开工的范围

可以立即开始 `LS-V1 PR 1`：契约、增量迁移草案、Feature Flags、Evidence Writer 接口、版本向量和固定测试夹具。

以下事项不阻塞本地演示：插件 OAuth 供应商、精确达标概率、生产对象存储、主动通知和自托管模型。它们不得以临时实现进入生产。

## 14. 已冻结决策

- 版本阶段使用明确 ID，不再单独称“MVP”；
- 工具、Runtime API 和数据模型各有唯一事实来源；
- 学习事实同步落库，学习状态异步幂等投影；
- Agent Outbox 与 Learning Outbox 分离；
- 所有决策结果绑定完整版本向量；
- 训练题与无偏测量题强制隔离并记录曝光；
- 用户确认 OCR 不等于确认答案正确；
- 学习时间拆为长期偏好和短期约束；
- 未成年人、供应商数据、纠错申诉和灾备是生产门槛。

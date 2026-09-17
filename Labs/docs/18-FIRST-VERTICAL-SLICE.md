# CSCAPilot Agent 首条端到端施工切片

> 状态：Accepted v1.0  
> 更新时间：2026-09-12  
> 目标：冻结第一条既能本地演示、又能沿用到生产的学习结果闭环。

## 1. 冻结结论

第一条黄金路径定为：

> 设定 CSCA 目标 → 识别当前最大能力差距 → 系统推荐今天的任务 → 学生进入并完成真实练习 → 学习证据更新 → 系统解释变化和下一步。

这条路径优先于开放式聊天、长期规划、全自动出题和复杂成绩预测，因为它一次验证了产品最核心的价值：系统能够依据学生目标和状态作出行动建议，并从学生完成任务后的真实结果中继续学习。

首条切片只做一个学科、一个演示账号、一套冻结评分策略和一条可靠回路。架构保持多学科，但不以扩大范围换取表面完整度。

## 2. 演示脚本

推荐固定为化学场景，具体科目可以由可用演示数据调整：

```text
1. 学生进入 Agent，看到目标、考试日期和当前状态
2. 学生问：“我今天应该学什么？”
3. 系统读取真实档案、掌握度、错题、近期练习/模考和可用题目
4. 系统指出一个最影响目标的差距，并推荐 10–15 分钟任务
5. 学生点击后在 Agent 内进入类型化练习工作区
6. 学生完成一组真实题目
7. 答案通过现有正式提交链路保存
8. 学习状态投影更新，Round 结束后重新计算差距和方案
9. 在同一 Agent 会话内看到“发生了什么变化、依据是什么、下一步是什么”
10. 若同一知识点持续错误，系统在组间或轮末插入短讲解与验证题
```

投资人应当能看出三个差异：不是模型凭空建议、不是进入静态链接后闭环中断、不是完成题量就被判定为进步。

## 3. 首版功能范围

### 3.1 必须真实运行

- 当前用户身份和对象级授权；
- `StudentProfile` 中已有的考试日期、目标科目、语言和 `weeklyGoalDays`；
- 新增的 `StudyAvailabilityPreference` 与请求级 `SessionConstraint`；
- 新增的版本化 `StudentScoreGoal`；
- 现有练习、答题、错题、模考和已发布题目查询；
- 练习的创建/打开与现有答题提交链路；
- 幂等 `LearningEvidenceEventV1`；
- V2 Shadow State 或等价的可重放演示投影；
- 规则化 `TargetGapSnapshot` 与 `LearningPrescriptionV1`；
- Agent 的工具调用、SSE 状态、Artifact 和深链；
- 所有数值的数据来源、版本和更新时间。

### 3.2 可以使用冻结演示配置

- 单个学科的 `ExamScoringPolicy`；
- 题目—知识点—难度映射的冻结校准参数；
- 未达到公开预测门槛时使用的 readiness label；
- 演示学生历史事件 seed；
- 模型 API 不可用时的固定回答缓存。

这些配置必须标记 `demo` 或 `provisional`，不能伪装为经过正式统计校准的生产结论。

### 3.3 首条切片不做

- 对学生展示精确目标达标概率；
- 声称预计可获得某个确定分数；
- 实时为每个学生调用自动出题；
- 多周无人值守计划、通知或日历；
- 全科同时个性化；
- 教师、班级和组织分析；
- Remote MCP/Codex 插件；
- 真实支付、生产扩容和自托管大模型。

## 4. 真实数据与演示数据边界

| 能力 | 首版来源 | UI 表达 | 生产沿用 |
| --- | --- | --- | --- |
| 用户档案 | 真实本地数据库 | 正常展示 | 是 |
| 目标分数 | 新真实领域表 | “你的目标” | 是 |
| 当前掌握度 | 现有 v1 + V2 Shadow | 标出证据量/置信度 | 是，逐步切 V2 |
| 最大差距 | 规则引擎实时计算 | “当前最需要处理” | 是，持续校准 |
| 今日方案 | 规则化 Prescription | 理由、时长、任务 | 是 |
| 训练题 | 已发布真实题库 | 正常练习 | 是 |
| 自动出题 | 不在请求路径内；只补库存 | 不暴露生成过程 | 是 |
| 达标概率 | 首条切片不展示 | “尚需更多校准” | 达门槛后开放 |
| Agent 表达 | 真实模型 API | 正常流式回答 | 是 |
| 模型故障兜底 | 固定且标注的缓存 | “演示缓存结果” | 否 |

任何 seed 必须通过独立 demo 数据库或可重置演示账号写入，不能混入生产账号。

## 5. 请求链路

```text
Web Agent
  -> POST /api/v1/agent/conversations/:conversationId/messages
  -> Intent Router: today_plan
  -> Capability Facade (parallel reads)
       get_learning_profile
       get_score_goal
       get_subject_mastery
       get_review_queue
       list_mock_exam_attempts
       get_question_supply_status
  -> Score Gap Service
       create TargetGapSnapshot
  -> Learning Decision Service
       create LearningPrescription
  -> Response Composer
       evidence-backed explanation + task Artifact
  -> SSE completed
  -> student opens existing practice route
  -> existing answer/round submission
  -> LearningEvidenceOutbox -> Learning Projection Worker
  -> new State -> Gap -> Prescription
```

底层读写必须经过 Capability Facade；Agent Runtime 不直接查询 Prisma，不直接创建训练，不直接修改掌握度。

## 6. 最小数据增量

第一条切片新增或落地：

1. `StudentScoreGoal`：当前目标及历史版本；
2. `LearningEvidenceEvent`：答题事实事件；
3. `UserCscaTopicStateV2`：Shadow 多维状态；
4. `LearningStateProjectionCheckpoint`：重放位置；
5. `TargetGapSnapshot`：差距快照；
6. `LearningPrescription`：推荐方案；
7. `LearningDecisionCurrent`：CAS 发布的当前 Gap 与 Prescription 成对指针；
8. `LearningPrescriptionOutcome`：接受、完成和后续结果；
9. 最小 Agent Conversation/Run/ToolCall/Artifact 表；
10. `LearningEvidenceOutbox`：与答案/Evidence 同事务的学习投影待投递事件；
11. `AgentOutbox`：仅用于 Agent Run、Attachment 和 UI/SSE 事件；
12. `StudyAvailabilityPreference`：长期学习容量和时区偏好；
13. `AssessmentItemExposure`：隔离训练题与独立测量题。

`ScoreReadinessForecast` 表可以在本切片创建，但学生可见概率保持关闭；先积累 Shadow 预测和校准数据。

## 7. 最小 Capability 集

### 读取

- `get_learning_profile`
- `get_score_goal`
- `get_subject_mastery`
- `get_review_queue`
- `list_mock_exam_attempts`
- `get_target_gap`
- `get_learning_prescription`
- `get_question_supply_status`

### 写入

- `update_score_goal`：L2，确认后执行；
- `create_adaptive_practice`：L1，幂等创建或组装已发布题目；
- `record_prescription_decision`：内部能力，记录接受、跳过或调整；

### 暂不开放给 Agent

- 直接写 Learning State；
- 直接设置 Gap 或 Forecast；
- 直接调用自动出题内部流水线；
- 发布、下架或修改题目；
- 修改考试评分规则。

## 8. 第一版决策规则

首版不训练推荐模型，使用版本化确定性规则：

1. 证据不足且距离考试允许时，优先短诊断；
2. 有到期错题且 retention 风险高时，优先复习；
3. 有高影响、高置信薄弱点时，优先针对性练习；
4. 同一 misconception 连续出现时，优先短教学干预而不是继续堆题；
5. 临近考试且覆盖充分时，优先计时综合练习或模考；
6. 无合格题目库存时选次优任务并异步申请库存补充；
7. 每次只给一个首选任务，并提供“更短”“换科目”两个替代项。

规则输入、输出和理由代码固定在 `policyVersion` 中。LLM 只能解释返回结果。

## 9. UI 冻结范围

首条切片只要求以下界面完整：

- Agent 空状态：目标、能力范围、附件入口和推荐问题；
- 学习上下文：目标日期、当前状态、最大差距和有来源的今日可用时间；
- 今日方案卡：任务、理由、预计时间、题量和开始按钮；
- 运行状态：正在读取、正在分析、方案已生成、失败/重试；
- Round 完成回流卡：本轮证据、状态变化、不确定项和下一步；
- 干预卡：短讲解、跳过/稍后、验证题；
- 数据来源与更新时间入口。

移动端把学习上下文折叠成抽屉；浮层不得遮挡 Composer、方案卡或答题主操作。

## 10. PR 施工顺序

### PR 1：契约和迁移

- 冻结本切片 DTO、错误码和枚举；
- 添加 Goal、Availability、Evidence、V2 State、Gap、Prescription、Exposure 和 Agent 最小表；
- 分别建立 LearningEvidenceOutbox、AgentOutbox 和幂等唯一约束；
- 默认所有新 flags 关闭。

### PR 2：Capability Facade

- 包装现有 profile、mastery、wrong question、mock 和题库服务；
- 实现对象级授权和契约测试；
- 禁止 Agent 直接访问 Prisma。

### PR 3：Evidence 与 Shadow Projection

- 让所有现有答案入口通过统一 Evidence Writer，在答案事务中写入 Evidence 与 LearningEvidenceOutbox；
- Worker 按用户/学科序列幂等投影并维护 checkpoint；
- 历史回放和 V2 Shadow State；
- 与 v1 差异可查询但不影响现有页面。

### PR 4：Gap 与 Prescription

- 实现首版规则和理由代码；
- 生成不可变快照；
- 对相同 state/policy 输入保持确定结果；
- 使用 CAS 当前指针防止迟到任务覆盖新方案；
- 自动出题只作为后台库存请求。

### PR 5：Agent Runtime 与 UI

- 接入 today_plan 意图、工具编排和 SSE；
- 显示上下文、方案 Artifact、深链和回流卡；
- 接入现有设计系统、头像、语言和响应式规则。

### PR 6：闭环与演示硬化

- 完成真实练习后的状态刷新；
- 加入一次重复错误干预和验证题；
- seed/reset、故障注入和固定缓存；
- 连续演示与浏览器 E2E。

## 11. 验收场景

至少固定以下夹具：

1. 新学生、无证据：推荐诊断，不声称薄弱点或分数；
2. 有明确薄弱点：推荐对应真实练习并说明证据；
3. 重复错误：从继续刷题切换为短讲解和验证；
4. 证据改善：完成任务后差距缩小，但不因一次正确变成“已掌握”；
5. 无合格库存：安全降级并创建异步补库请求；
6. 模型 API 失败：工具结果仍可转为模板化建议；
7. 重复发送/刷新：不重复创建训练、Evidence 或扣费；
8. 越权对象：请求被拒绝且不泄露存在性；
9. 目标修改：确认、版本化并重新计算方案；
10. 功能关闭：现有 CSCAPilot 学习流程完全不受影响。

## 12. 完成定义

只有同时满足以下条件，首条切片才算完成：

- 从目标到练习完成再到新方案真实闭环；
- 所有核心数字可追溯到数据库事实或明确的 provisional 配置；
- 训练题与独立诊断/测量题具有角色和曝光隔离；
- 规则引擎在固定输入下可确定重放；
- 一次答案提交只产生一次 Evidence；
- Agent 无权直接修改学习状态、预测和题库；
- 页面刷新、模型超时和 Worker 重试不重复产生业务结果；
- 同一黄金路径连续运行 5 次无阻断；
- 现有登录、训练、错题、模考和真题流程回归通过；
- 本地 demo 数据可以一键恢复；
- 文档记录所有 Demo 与生产差异。

## 13. 开工入口

开工时先执行 PR 1，不先做聊天 Prompt，也不先接自动出题。首个工程验收物应是：冻结 DTO、数据库迁移草案、feature flags、种子数据契约和一组不依赖模型的闭环测试夹具。

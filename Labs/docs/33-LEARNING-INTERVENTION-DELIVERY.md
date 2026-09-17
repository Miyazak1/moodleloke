# PR8B：轮末学习干预 Delivery

## 1. 本阶段目标

把 PR8A 的 `LearningIntervention` Shadow 决策安全地送到学生面前，但仍保持以下边界：

- 只在练习轮结束后或 Agent 对话内展示非阻断卡片；
- 只读取 `published` Concept Card，缺失时才读取 `approved` 标准题解析；
- 不即时生成 AI 讲解，不调用自动出题系统；
- 查看、完成或跳过讲解都不直接改变知识点掌握度；
- 正式模考进行中不展示、也不允许推进讲解状态；
- 无审核内容时记录内容缺口，对学生安全隐藏。

## 2. 数据模型

### LearningInterventionDelivery

它是一次学生可见交付的当前状态，使用 `(interventionId, channel)` 唯一约束避免重复领取。

状态：

```text
offered -> in_progress -> completed
   |            |
   +-> deferred +-> deferred
   |            |
   +-> skipped  +-> skipped

缺少审核内容 -> content_unavailable（不展示）
```

Delivery 保存：

- Shadow 干预引用、用户和展示位置；
- 内容来源类型、来源 ID、来源版本；
- 审核内容的不可变快照；
- 展示、开始、完成、稍后、跳过时间；
- 生成时上下文及“不调用生成器、不修改掌握度”边界。

### LearningInterventionStep

Step 是追加式操作日志。`(userId, clientRequestId)` 唯一，保证重试不会重复执行。每条记录保存动作、前后状态和最小审计元数据。

## 3. 内容信任规则

解析顺序固定为：

1. 同知识点、状态为 `published`、且知识点本身为 `published` 的 Concept Card；
2. 同知识点、状态为 `approved`、解析非空、且知识点为 `published` 的标准题解析；
3. 都不存在时创建 `content_unavailable` Delivery 与 `content_missing` Step。

接口在 `offered` 状态只返回标题和推荐理由；学生点击“开始学习”进入 `in_progress` 后才返回正文。内容以审核时快照交付，后续后台编辑不会静默改变本次学习记录。

## 4. API

### `POST /api/v1/agent/interventions/offer`

请求：

```json
{
  "clientRequestId": "uuid",
  "context": "agent_conversation",
  "conversationId": "owned-conversation-id"
}
```

`context` 只接受 `after_round` 或 `agent_conversation`。对话 ID 必须属于当前用户。正式模考进行中返回空项目和 `FORMAL_MOCK_ACTIVE`。

### `POST /api/v1/agent/intervention-deliveries/:id/actions`

动作只接受 `start`、`complete`、`defer`、`skip`，并执行拥有者校验、状态迁移校验、幂等校验和并发状态保护。`defer` 默认 24 小时后允许再次展示。

## 5. 前端行为

- 卡片出现在 Agent 消息流末尾，不使用弹窗，不遮挡做题；
- 未开始时展示审核来源、知识点标题、系统推荐理由；
- 开始后原位展开审核正文；
- “完成阅读”“稍后”“跳过”完成后收起；
- 加载失败不会阻断 Agent 对话；
- 服务端是最终权限和状态来源，前端隐藏不是安全边界。

## 6. 功能开关

`CSCA_LEARNING_INTERVENTION_DELIVERY_ENABLED=true`。

该开关依赖 `CSCA_AGENT_FOUNDATION_ENABLED`、`CSCA_LEARNING_SHADOW_PROJECTION_ENABLED` 和 `CSCA_LEARNING_INTERVENTION_SHADOW_ENABLED`。本地一键启动脚本已开启，生产环境应按灰度策略单独启用。

## 7. 验收与后续

本阶段专项测试覆盖审核内容门禁、正文延迟披露、内容缺口、正式模考抑制、用户隔离、动作幂等和不修改掌握度边界。

后续阶段应使用 `LearningInterventionStep` 与干预后的真实答题证据评估效果。不能把 `completed`（看完讲解）当成“已掌握”；只有后续独立作答、保持与迁移证据才能改变学习状态。

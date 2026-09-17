# PR12C：教学资产主动干预闭环

## 目标

把 PR12B 的受治理 TeachingAsset 接入已有学习干预与独立验证链路，使系统能在一组训练结束后，根据服务端学习证据主动推荐短微课，而不是等待学生自己提出“给我生成练习”。

## 闭环

1. 学习智能层根据重复错因、低收益训练等真实证据产生 `LearningIntervention`，建议动作是 `offer_micro_lesson`，位置通常是 `between_sets`。
2. Agent Delivery 只从已发布、知识点匹配、语言匹配的 TeachingAsset 中选择内容；没有可用资产时才回退到已审核知识卡片或标准解析。
3. 学生接受后才下发可渲染内容。客户端永远拿不到即时检查的答案键和反馈键。
4. 打开、调参、即时检查、完成均写入独立交互事件；完成前必须通过服务端判分的即时检查。
5. 微课暴露记为 A4，`masteryChanged=false`。微课完成不等于知识点掌握。
6. Delivery 完成后，由既有 Intervention Verification 服务选择 3 道已审核、未曝光的新题，建立 immediate 独立验证；后续仍可进入 retention 与 transfer 阶段。

## 边界与隔离

- 浏览器和大模型不能指定题目、答案或掌握度变化。
- 自动出题系统不在实时学习链路中被调用；题源不足只记录 supply gap，走异步补库流程。
- 正式模考期间禁止推荐、推进微课及验证。
- TeachingAsset 必须处于 published 状态，并且绑定 published 知识点。
- 主动微课交互使用 `intervention_delivery:<deliveryId>` 上下文，与题后按需微课的 round/question 上下文隔离。
- PR12C 首期只实现函数平移组件；PR12D 已在同一协议下加入物理牛顿第二定律与化学酸碱中和组件，视频仍按独立发布门控制。

## API

- `POST /api/v1/agent/interventions/offer`：支持 `language`，保留策略给出的 `placement`。
- `POST /api/v1/agent/intervention-deliveries/:id/actions`：接受、完成、稍后、跳过。
- `POST /api/v1/agent/intervention-deliveries/:id/teaching-interactions`：记录主动微课交互。
- `POST /api/v1/agent/intervention-verifications/offer`：完成后建立独立验证。

## UI 行为

- Agent 对话中可接受并完成主动微课。
- Agent 内训练报告工作区会在组间展示同一套微课，完成后在同一 Agent 会话中开始独立验证。
- 普通科目训练与非 Agent 轮次不主动插入该闭环。

## 验收

运行 `node scripts/agent-teaching-intervention-live.cjs`，验证：组间位置保留、开始前不泄露内容、答案键不下发、服务端判分、A4 暴露、掌握度不变，以及 3 道新题的 immediate 独立验证被创建。

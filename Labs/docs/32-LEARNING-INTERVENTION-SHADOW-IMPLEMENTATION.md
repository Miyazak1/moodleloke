# 学习干预 Shadow 决策实现（PR8A）

## 1. 本阶段交付

PR8A 将 ADR-005 的 I0/I1 底座接入真实学习证据投影链路。系统现在可以基于版本化学习状态判断“继续做题还是应先教学干预”，但全部结果只写入内部 Shadow 表，不向学生展示、不创建教学内容，也不改变掌握度。

实现遵循四条隔离原则：

- 决策只读取 `LearningEvidenceEvent` 与 `UserCscaTopicStateV2`，不读取大模型自由文本；
- 不调用 AI Gateway，不生成讲解，不扣除 AI 额度；
- 不调用自动出题模块，只在快照中明确记录 `automaticQuestionGenerationInvoked=false`；
- Shadow 评估异常被主链路隔离，不能导致答题证据或学习状态投影失败。

## 2. 数据模型

`LearningIntervention` 保存一个可重放的干预决策：

- 用户、科目、知识点；
- `stateVersion` 与 `policyVersion`；
- action、触发原因、紧迫度、展示时机和内容计划；
- Shadow 状态与抑制原因；
- 仅包含指标和 Evidence ID 的输入快照；
- evidence cutoff、有效期和创建时间。

`decisionKey` 由用户、科目、知识点、状态版本、策略版本和当次抑制上下文计算。同一状态在相同门控条件下重复投递或完整重放不会产生重复决策；正式模考结束等时间性门控解除后，同一学习状态可以形成一条新的 eligible Shadow 判断，不会永久卡在 suppressed 状态。

## 3. 首版确定性策略

策略版本为 `intervention-shadow-rules-1`，最多读取该科目最近 80 条证据，并为每个知识点使用最近 6 条质量不低于 0.5 的证据。证据查询严格限制在 Projection Checkpoint 的 `lastEventSequence` 以内，不能用尚未投影的“未来证据”解释当前状态版本。

| 场景 | 决策 | 内容计划 |
| --- | --- | --- |
| 少于 3 条证据、置信度低于 0.35 或近期可靠证据不足 | `continue_practice` | 无，只继续诊断采样 |
| 使用完整解析后仍重复错误 | `offer_micro_lesson` | guided mini lesson；手写证据优先 guided correction |
| 近期重复错误 | `offer_micro_lesson` | concept card 或 guided correction |
| 多题练习仍大量错误/部分正确且掌握度低 | `offer_micro_lesson` | worked example |
| 正确但连续依赖提示或解析 | `show_error_feedback` | brief concept card + 后续验证 |
| retention 低 | `schedule_review` | retrieval check |
| 既有高掌握判断与近期连续错误冲突 | `show_error_feedback` | contrast example + 诊断验证 |
| 没有达到门槛 | `continue_practice` | 无 |

所有教学型内容计划都要求后续独立验证。完成或查看讲解本身永远不形成掌握证据。

## 4. 防打扰和安全门控

首版门控参数：

- 最近四小时存在未提交正式模考：`FORMAL_MOCK_ACTIVE`；
- 同一知识点六小时内已有 Shadow 提案：`COOLDOWN_ACTIVE`；
- 用户滚动二十四小时内已有三条提案：`DAILY_LIMIT_REACHED`。

被门控的判断仍以 `shadow_suppressed` 保存，便于离线分析规则本身是否正确。普通无干预判断保存为 `shadow_noop`，达到规则且未被门控的保存为 `shadow_proposed`。

## 5. 实时与回放

Evidence Outbox 成功投影后触发一次对应用户/科目的 Shadow 评估；完整重放结束后也触发评估。调用是 best-effort：Shadow 服务失败会被吞并并单独观察，原证据仍保持 processed，投影 checkpoint 仍正常推进。

功能开关是 `CSCA_LEARNING_INTERVENTION_SHADOW_ENABLED`，同时依赖 Foundation 和 Shadow Projection。关闭后不查询或写入干预表。本地一键启动脚本默认开启，生产环境默认关闭并按学科/用户群灰度。

## 6. 验证覆盖

- 规则输入相同则输出完全一致；
- 低证据、重复错误、提示依赖、保持风险等分支；
- 正式模考、冷却期与每日次数门控；
- 相同状态版本的数据库幂等；
- 实时投影、完整重放触发 Shadow 评估；
- Shadow 异常不影响 Evidence 投影；
- Feature Flag 依赖关系、后端构建和既有 Agent/Decision 回归。

## 7. 下一阶段边界

PR8B 才实现学生可见的“轮末被动建议”：只读取已审核 Concept Card/标准解析，允许学习、稍后和跳过，并记录 Delivery。PR8A 不提供前端入口，也不把 `shadow_proposed` 当作可直接展示的生产决策。

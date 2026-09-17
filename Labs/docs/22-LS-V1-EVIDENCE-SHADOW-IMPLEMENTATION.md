# LS-V1 Evidence 与 Shadow Projection 实施记录

> 状态：PR 3 implemented, feature disabled
>
> 更新时间：2026-09-12
> 依赖：[实时学习智能 ADR](./15-REALTIME-LEARNING-INTELLIGENCE-ADR.md) · [首条垂直切片](./18-FIRST-VERTICAL-SLICE.md)

## 1. 已落地的数据链

```text
trusted answer submission
  -> existing ownership / immutable question checks
  -> existing answer and score writes
  -> LearningEvidenceWriter (same Prisma transaction)
       -> monotonic user + subject event sequence
       -> immutable LearningEvidenceEvent
       -> LearningEvidenceOutbox
commit
  -> PostgreSQL outbox worker (at-least-once)
       -> ordered, idempotent projection
       -> UserCscaTopicStateV2 (shadow model version)
       -> LearningStateProjectionCheckpoint
```

当前 `CSCA_AGENT_FOUNDATION_ENABLED`、`CSCA_LEARNING_EVIDENCE_WRITE_ENABLED` 和 `CSCA_LEARNING_SHADOW_PROJECTION_ENABLED` 默认均关闭。关闭时旧答题路径完全沿用原行为，不查询新表、不启动 Worker。

## 2. 已接入的真实答题入口

| 入口 | Evidence source | 说明 |
| --- | --- | --- |
| 自适应训练 Round | `adaptive` | 每道题使用冻结的 RoundItem topic |
| 诊断 Round | `diagnostic` | 与训练使用同一 Writer，保留诊断来源 |
| 错题验证 Round | `review` | planner snapshot 存在 verification 时标记 |
| 专项练习 Session | `adaptive` | 仅登录用户且存在已发布 canonical topic mapping 时写入 |
| 正式模考提交 | `mock_exam` | 仅登录用户且存在已发布 canonical topic mapping 时写入 |

匿名首页小测不属于学生账户学习事实，不写 Evidence。未经确认的附件/OCR/手写分析仍不写 Evidence；以后必须通过 `verified_handwriting` 专用校验入口接入。

接入 Evidence 时同步收紧了提交边界：正式模考的读取、暂存、提交和报告查询都必须匹配当前用户；专项练习中，登录用户只能访问自己的会话或尚未绑定账号的匿名会话，匿名访问只能命中匿名会话。这样可以防止越权读取或提交污染其他学生的学习证据。

## 3. Writer 约束

- Writer 只能接收服务端解析后的 `LearningEvidenceWriteInputV1`，调用方不能指定 `eventSequence`、`recordedAt` 或 `firstAttempt`；
- `subjectCode`、question revision、答案键版本和 topic mapping 均来自可信题目/Session 数据；
- 通过事务级 advisory lock 在 `userId + subjectCode` 范围分配单调序号；
- Event 和 Outbox 通过同一个 nested create 写入调用方事务；
- `eventId` 与业务唯一键共同防止重复提交；相同 event ID 对应不同业务键时拒绝；
- 原始答案、手写图、OCR 正文和敏感个人信息不复制到 Evidence metadata；
- topic 权重必须无重复且合计为 1。
- 开关开启后的提交响应附加 `learningEvidence` receipt，包含 event IDs、最新 evidenceVersion、当前 projectedStateVersion 和准确的 adaptationPending；旧字段不变。

## 4. Shadow Projector v1

冻结版本：

- projector：`ls-v1-shadow-projector-1`
- model：`ls-v1-shadow-model-1`

首版确定性状态使用 outcome、题目质量、topic 权重、首次/重复、提示/解析、难度、用时、证据来源和时间间隔更新 mastery、confidence、independence、difficulty ceiling、retention、fluency、transfer、consistency 与 coverage。算法不调用 LLM，也不修改现有 `UserCscaTopicMastery`。

该模型只是 Shadow 基线，不具备学生可见或决策权。只有离线校准、回放一致性和线上灰度门槛通过后，才允许后续 ADR 升级 modelVersion；不得原地改变同一 modelVersion 的公式。

## 5. 顺序、幂等和恢复

- Worker 使用 PostgreSQL Outbox，消费语义为 at-least-once；
- 每个事件在状态更新、checkpoint 前进和 outbox 完成标记的同一事务中投影；
- `sequence <= checkpoint` 视为重复投递，只完成 outbox，不重复更新状态；
- `sequence > checkpoint + 1` 延后处理，不能越过缺失事件；
- processing claim 超过 5 分钟自动恢复为 pending；
- 普通失败指数退避，8 次后进入 failed，保留稳定错误码而不暴露内部异常；
- Worker 有单进程重入保护；多实例依靠原子 claim、用户/学科 advisory lock 和 checkpoint 保证一致性；
- `replayUserSubject` 删除指定 shadow model 的派生状态后，按事件序号全量确定性重建；不修改 Event，也不修改 v1。

## 6. 对账接口

内部 `LearningStateShadowQueryService.compareUserSubject` 同时按当前 `userId + subject` 查询 v1 和指定 modelVersion 的 v2，返回 mastery delta 与多维状态。它没有公开 Controller，不进入 Agent Tool Registry；用于测试、离线评估和灰度审核。

## 7. 验证命令

```bash
cd backend
npm run test:learning-evidence-shadow
```

覆盖内容：同事务 Event + Outbox、单调版本、业务幂等冲突、低质量/辅助作答降权、乱序等待、重复投递、失败恢复/死信、确定性全量回放、v1/v2 当前用户隔离，以及模考和专项练习会话的所有权查询边界。

## 8. 后续边界

下一 PR 才实现 Target Gap 与 Learning Prescription。PR 3 不把 Shadow State 接入现有选题、推荐、自动出题或学生 UI。生产启用前还需先应用 0072 migration、跑历史基线/回放评估、建立 failed outbox 运维处理和按账号灰度；不得一次性打开三个开关。

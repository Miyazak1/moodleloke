# Agent 附件学习证据闭环（PR7C）

## 目标

把 PR7B 的附件分析从“只在对话里反馈”推进为受控的学习证据候选，并复用现有 LS-v1 链路更新知识点状态、目标差距和学习处方。该能力服务于学生拍照上传题目、手写答案或练习过程后的分析与指导。

本阶段不调用自动出题系统、不生成或发布题目，也不直接写掌握度。自动出题仍是独立上游能力；Agent 只消费已发布题源或学习处方。

## 信任边界与门控

附件和模型输出都不是学习事实。分析完成后，系统先创建 `AgentAttachmentEvidenceCandidate`：

- 必须识别到学生答案或题目与答案；
- 必须识别到 CSCA 科目和可评估结果；
- 必须包含由服务端归一化的附件页码引用；
- 只能绑定同科目、已发布的 `CscaExamTopic`；
- 学生必须同时确认“识别内容”和“AI 对作答结果的判断”。

不满足结构门控的候选进入 `blocked`，只保留分析反馈。满足门控的候选进入 `pending_confirmation`，学生可以确认或拒绝。

目前没有把模型判断包装成官方答案键。确认后的 Evidence 明确记录：

- `sourceType = verified_handwriting`；
- `answerKeyVersion = student-confirmed-ai-assessment-v1`；
- `questionQualityConfidence <= 0.6`；
- `limitations = [not_an_official_answer_key, low_weight_user_confirmed_evidence]`；
- 附件 ID、SHA-256、页数、引用、分析模型、Prompt 版本和学生确认请求均保存在 provenance 中。

正式答案键接入后，可新增更高信任等级，而不改变现有审计语义。

## 状态机

```text
analysis completed
  -> blocked
  -> pending_confirmation -> confirmed -> revoked
                          -> rejected
```

- 同一 analysis 只能有一个候选；
- confirmed/rejected/revoked 的重复请求返回当前结果；
- 非法跨状态操作返回冲突；
- 所有读取和写入都以当前登录用户重新校验归属；
- confirm 的 Evidence 使用候选 ID 作为稳定业务键，Writer 继续提供幂等冲突保护。

## 确认后的实时链路

```text
Student confirm
  -> LearningEvidenceEvent (verified_handwriting)
  -> LearningEvidenceOutbox
  -> LearningStateProjector
  -> UserCscaTopicStateV2
  -> TargetGapSnapshot / LearningPrescription
  -> Agent explanation message
```

Agent 会说明方案是否实际变化；没有变化时也明确告诉学生证据已记录，但当前首选任务保持不变。

## 撤销与补偿

Evidence 本身保持不可变。撤销创建 `LearningEvidenceRetraction`，随后按用户和科目重放投影：

- 被撤销事件从状态计算中排除；
- 投影 checkpoint 仍推进到原始最高事件序号，避免后续 Evidence 因序号缺口永久等待；
- state version 加入撤销版本标记，使决策层能够识别输入变化并重算；
- 队列若晚于撤销处理，会把该 outbox 标记为已处理但不投影。

因此撤销可审计、可恢复，不删除历史，也不直接反向修改掌握度数字。

## API

- `GET /api/v1/agent/attachment-analyses/:analysisId/evidence-candidate`
- `GET /api/v1/agent/conversations/:conversationId/evidence-candidates`
- `POST /api/v1/agent/evidence-candidates/:candidateId/confirm`
- `POST /api/v1/agent/evidence-candidates/:candidateId/reject`
- `POST /api/v1/agent/evidence-candidates/:candidateId/revoke`

确认请求必须携带 `topicId`、`confirmRecognition: true`、`confirmAssessment: true` 和幂等 `clientRequestId`。

## 数据与配置

迁移 `0077_agent_attachment_evidence_closed_loop` 新增：

- `agent_attachment_evidence_candidates`
- `learning_evidence_retractions`

本地一键启动启用：

```text
CSCA_AGENT_ATTACHMENT_EVIDENCE_ENABLED=true
```

该开关之外仍受 `CSCA_AGENT_FOUNDATION_ENABLED`、`CSCA_LEARNING_EVIDENCE_WRITE_ENABLED`、`CSCA_LEARNING_SHADOW_PROJECTION_ENABLED`、`CSCA_TARGET_GAP_ENABLED` 和 `CSCA_LEARNING_PRESCRIPTION_ENABLED` 分层控制。

## 验收范围

- Prisma Schema 与迁移校验；
- 学生确认成功写入低权重 Evidence；
- 跨用户访问拒绝；
- 知识点科目/发布状态门控；
- 拒绝幂等、非法状态冲突；
- 撤销写补偿记录并重放投影；
- 撤销后的异步 outbox 不再污染状态；
- Agent 对话确认/拒绝/撤销 UI；
- 后端与前端构建。

## 下一阶段

PR7D 应接入可信答案键与题目定位：优先匹配站内已发布真题/练习题，能够匹配时由官方答案键自动完成 assessment gate；无法匹配时继续维持本阶段的“学生确认、低权重”语义。同时增加区域级 OCR 坐标与长文档分页任务，但不在 Agent 内复制自动出题能力。

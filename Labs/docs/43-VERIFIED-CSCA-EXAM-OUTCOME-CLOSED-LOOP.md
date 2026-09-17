# PR9D-B2 — 真实 CSCA 成绩核验与校准闭环

## 目标与边界

本阶段补齐“预测之后发生了什么”的真实结果通道。学生可以自愿提交 CSCA 成绩并引用自己在 Agent 中上传的成绩单图片或 PDF，但自报值本身不是可信标签，也不会直接改变学习状态、推荐或面向学生的分数预测。

唯一允许进入 `verified_csca_exam` 校准数据集的记录必须同时满足：

- 明示同意用途 `score_calibration_and_product_improvement`，且同意版本为 `csca-exam-outcome-consent-v1`；
- 使用已登记的官方 CSCA 评分政策，考试日期在政策有效期内，分数在该科目的合法量程内；
- 至少一个由该学生拥有、仍为私有且处理完成的附件；
- 第一位管理员完成证据审阅，第二位不同管理员完成独立核验；
- 状态仍为 `verified`，同意未撤回，也没有被更正记录替代。

当前仍仅为内部校准基础设施。学生端数值预测保持禁用。

## 数据和状态机

`StudentExamOutcome` 保存不可原地修改的考试事实。状态路径为：

```text
submitted -> reviewed -> verified
     |           |
     +---------> rejected

submitted/reviewed/verified -> withdrawn
submitted/reviewed/verified -> superseded -> 新 correction submission
```

更正不是覆盖原分数，而是创建带 `replacesOutcomeId` 的新提交，并关闭旧记录。每次状态变化都写入只追加的 `StudentExamOutcomeEvent`；数据库触发器禁止审计事件被更新或删除。

`StudentExamOutcomeEvidence` 只保存对既有 `AgentAttachment` 的引用，不复制文件，也不向学生列表或校准导出暴露存储路径。附件被用作成绩证据后，应用检查和数据库触发器都会阻止其被删除或变为不可用；提交事务同时锁定附件并把保存期延长到至少两年。撤回同意会立即停止校准用途，证据按审计与合规保留策略处理。

## API

学生接口（登录用户）：

- `GET /api/v1/me/exam-outcomes`
- `POST /api/v1/me/exam-outcomes`
- `POST /api/v1/me/exam-outcomes/:id/corrections`
- `POST /api/v1/me/exam-outcomes/:id/withdraw`

提交与更正请求必须包含 `subjectCode`、`examDate`、`score`、`scoringPolicyVersion`、至少一个 `attachmentId`、`consent: true` 和当前同意版本。

管理员接口：

- `GET /api/v1/admin/score-calibration/exam-outcomes?status=submitted`
- `POST /api/v1/admin/score-calibration/exam-outcomes/:id/review`
- `POST /api/v1/admin/score-calibration/exam-outcomes/:id/verify`
- `POST /api/v1/admin/score-calibration/exam-outcomes/:id/reject`
- `POST /api/v1/admin/score-calibration/exam-outcomes/:id/invalidate`（撤销已经核验的错误或冲突结果）
- `POST /api/v1/admin/score-calibration/shadow-predictions/verified-exam-calibration-dataset`

审核、核验与拒绝都要求至少 8 个字符的理由。核验人必须不同于审阅人。

## 校准数据清单与撤回传播

真实成绩适配器沿用 PR9D-B1 的时间切分、7–90 天标签窗口、每位学习者仅一条样本、跨切分学习者排除、HMAC 去标识和最小样本门槛。差异是 `outcomeSource` 为 `verified_csca_exam`，不会带有代理标签警告。

当样本不足（校准少于 100 人或留出集少于 300 人）时，接口确定性返回 `blocked`，不创建清单，也不产生可构建快照的输入。

样本达到门槛时，服务器创建不可变的 `ForecastCalibrationDatasetManifest`，并用 `ForecastCalibrationDatasetRow` 绑定：

- 去标识学习者键；
- 预测 shadow run；
- 经核验的真实成绩；
- calibration/holdout 切分；
- 行哈希与完整数据集哈希。

构建 `verified_csca_exam` Forecast Calibration 快照时必须提交适配器返回的 `datasetManifestId`。服务端验证清单仍为 active、来源数据哈希、完整 Forecast artifact 哈希和所有版本/范围完全一致；即使沿用合法清单 ID，客户端修改任一预测行或指标也会失败关闭。

学生撤回或更正任一已使用结果时：

1. 相关清单变为 `invalidated`；
2. 所有关联且仍有效的 Forecast Calibration 快照自动变为 `retired`；
3. 写入 `retired_source_invalidated` 治理事件；
4. 后续 review、qualify 和发布门禁均拒绝失效清单。

## 隐私与产品原则

- 是否提交真实成绩不影响基本产品功能，不得作为使用 Agent 的前置条件。
- 学生看到的返回不包含附件 `storageKey`、内部 HMAC 盐或可逆身份映射。
- 校准输出只携带 HMAC 学习者键；盐至少 32 字符并有独立版本号。
- 当前阶段不自动相信 OCR/多模态识别结果；它仅辅助管理员查看，最终标签来自双人核验。
- 原始附件与身份映射不得进入模型供应商请求，也不得出现在导出的校准行中。

## 验收

- Prisma schema 和迁移可验证；
- 自报记录不能直接进入真实成绩数据集；
- 同一管理员不能同时 review 与 verify；
- 无证据、非本人附件、未就绪附件、非法分数或非官方政策均拒绝；
- 撤回与更正使旧标签和所有关联清单立即失效；
- 代理标签仍永远不能通过 Forecast Calibration 发布门禁；
- `verified-exam-outcome-test.cjs` 覆盖真实来源适配、双人核验和撤回传播；
- 学生端数值预测继续禁用。

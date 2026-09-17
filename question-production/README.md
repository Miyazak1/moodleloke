# Codex 双任务题库生产线

这是一条独立于正式全自动出题系统开发的临时内容生产线。目标是先生产可追溯、可复验、可导入的固定题目；它不修改正式系统的自动生成资格，也不把完整题误称为生成种子。

## 正式题库导入适配器

`tools/import-accepted-pack.cjs` 是独立人工监督线的 fail-closed 导入适配器。它默认只做 dry-run：解析终包中的 `selection`、`manifest`、`questions`、`reviews`、`audit`，检查 30 题及每科 10 题、审核答案一致、audit 无阻塞、包内 prompt/options/content 哈希唯一，并在数据库只读事务中读取题目与 topic 映射，报告精确和近似重复。

目录终包应提供 `selection.json`（也接受 `selection-plan.json`）、`manifest.json`、`questions.json`、`reviews.json`、`audit.json`（也接受 `audit/originality-audit.json`）；也可把这五项放进一个顶层同名字段的 JSON 文件。manifest、selection 和 questions 的 candidate ID 必须完全一致。推荐在 manifest 中写入 `questionsSha256`，其值是 questions 稳定键序 canonical JSON 的 SHA-256。

```powershell
node question-production/tools/import-accepted-pack.cjs --pack question-production/accepted/pilot-30 --json
```

默认数据库访问执行 `SET TRANSACTION READ ONLY`，读取 `csca_exam_topics`、`special_practice_topics`、`csca_topic_mappings`、`csca_questions` 和 `special_practice_questions`。缺少准确的 `topicCode -> csca_exam_topics -> special_practice_topics` 已发布映射时会阻塞，不自动创建桥接 topic。精确重复和相似度达到阈值的近似重复都会阻塞 apply；同一幂等键的已导入双记录会被识别为安全跳过。

细粒度候选考点可以由 selection 条目的 `topicCodeOverride` 覆盖 exam topic；如还需明确 Special Practice topic，应由监督者在 accepted 目录创建 `topic-mapping.json`。该文件必须为 `status: "approved_by_supervisor"`，逐题 pair 必须与其 `proposalSha256` 指向的 proposal 完全一致，并为每个 candidate 提供 `mappingStatus: "approved"`、`originalTopicCode`、`mappedTopicCode`、`mappedTopicId`、`specialPracticeTopicId`、批准时间和 scope。工具会在只读 dry-run 和锁内复核中确认两端 topic 均真实存在、已发布且 subject 一致；缺失的已批准 DB bridge 会报告为 `bridgeWillBeCreated`，apply 时只在锁内用 `ON CONFLICT` 幂等建立 bridge，不创建或修改 topic。候选题自身的 `topicCode` 和 `questionPlan.taskFamily` 不会被改写，导入 trace 同时保留 original/mapped code 和批准证据。`topic-mapping-proposal.json` 永远是 proposal-only，不会被自动采用。

只读生成 v4 映射建议：

```powershell
node question-production/tools/propose-topic-mapping.cjs
```

`--apply` 代码路径存在但默认禁用；它还必须同时收到精确确认文本 `--confirm APPLY_DUAL_SESSION_SUPERVISED_PACK`。写入发生在单事务内并锁定题表、topic 表和映射表；拿锁后会重新读取两张题表、重跑精确与近似查重，并重新验证 exam topic、Special Practice topic 的发布状态、科目和映射，避免 dry-run 到 apply 之间的竞态。任何一题失败都会整体回滚。每题先写 `csca_questions` 审计记录，再写可用的 `special_practice_questions`，最后建立双记录关系。幂等键为 `candidateId + ':' + sha256(normalized prompt/options)`，存放在 `review_metadata.dualSessionSupervisedAcceptance`。该 namespace 只声明 `dual-session supervised acceptance`，不会伪造 Provider、自动 review gate 或自动生成资格证据。

验证 fixture（不会连接或写入数据库）：

```powershell
node --check question-production/tools/import-accepted-pack.cjs
node --check question-production/tools/import-accepted-pack.self-test.cjs
node question-production/tools/import-accepted-pack.self-test.cjs
```

最终包由 `tools/assemble-accepted-pack.cjs` 从 selection 引用的各 batch `sealed/` 与盲审 `reviews/` 文件只读组装。只有 audit 对全部 30 个 candidate 均为 `clear`、三科各 10 题且各有至少 10 个不同 `questionPlan.taskFamily`、审核答案与唯一真值全部一致、sealed 的 Solver/Oracle/真值表/解析复验均通过时，才会一次性生成 `questions.json`、`reviews.json` 和 `manifest.json`；否则不写任何终包文件。audit 顶层的 `formalQualificationEligible` 是“原创性审计不能单独授权发布”的权限边界，不作为逐题失败信号；manifest 会固定记录 `auditAloneDoesNotAuthorizePublication=true`。

```powershell
node question-production/tools/assemble-accepted-pack.cjs --check-only
node question-production/tools/assemble-accepted-pack.cjs
node question-production/tools/assemble-accepted-pack.self-test.cjs
```

## 首轮目标

- 数学、物理、化学各至少 10 道最终合格题，共至少 30 道。
- 生成阶段每科先提供 15 道候选，共 45 道，为严格淘汰预留空间。
- 只有通过盲审、答案揭示后一致性复核、确定性工具验证、考纲/格式/重复/泄漏门禁的题，才能进入 `accepted/`。
- 任何 `unknown`、`abstain`、证据缺失或意见分歧都进入 `quarantined/`，不得为了凑数降低标准。

## 角色隔离

1. **生成任务**：读取 `batch-plan.json` 和题型实现，创建候选；不得读取官方真题正文；不得决定是否接收。
2. **盲审任务**：只读取 `blind/`，独立求解并攻击性检查；首次审查时不得接触生成答案、解析或自检结论。
3. **监督任务**：比较两方结果，运行现有 Solver、Oracle、查重和泄漏门，作最终验收并生成导入包。
4. **正式系统开发任务**：继续独立工作，不参与本批内容生产，也不因本批次改变产品架构。

## 目录约定

```text
question-production/batches/pilot-30/
  batch-plan.json
  blind/                 # 第一提交：不含答案和解析
  sealed/                # 第二提交：完整候选、生成证据
  reviews/               # 盲审任务输出
  evidence/              # 监督任务运行的程序证据
  accepted/              # 验收后的可导入题目包
  quarantined/           # 所有未通过项目及失败原因
  manifest.json          # 批次汇总和内容哈希
```

## 状态流

```text
generated
→ blind_review_passed
→ answer_match_passed
→ deterministic_gates_passed
→ accepted_preverified
→ 导入 csca_questions(draft)
→ 当前版本门禁重放
→ approved
→ 发布到 special_practice_questions
```

`accepted_preverified` 不是绕过数据库审核的后门。导入时必须以 `draft` 或 `pending_review` 创建，并由当前代码版本重新验证后才允许学生使用。

## 固定题与题族

- 本批完整题是固定题目，导入 `CscaQuestion`。
- 将来只有在多道同类题中提炼出参数约束，并实现 Generator、Solver、Oracle 和 mutation 测试后，才能形成 `CscaQuestionBlueprint` 题族。
- 本批题不得直接作为“换数字/换名字”的生成种子。

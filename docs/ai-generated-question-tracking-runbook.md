# AI 生成题追踪 Runbook

最后更新：2026-06-14

## 目标

测试阶段需要能判断一道练习题是否来自 AI 生成，并能在后台追踪：

- 这道题是按大纲生成，还是未来按“大纲 + 真题”生成。
- 生成候选是否已经发布到练习。
- 发布后的题是否真的被训练轮次使用过。
- 后续如果不想让学生看到来源标记，可以一键关闭前端测试标记。

## 数据链路

1. AI 生成候选写入 `csca_questions`，`source_type = ai`。
2. 新生成记录的 `generation_metadata.sourceKind` 默认为 `syllabus`。
3. 候选通过审核后，会通过 `source_question_id` 关联到发布后的练习题。
4. 学生训练时，轮次题目写入 `csca_adaptive_round_items`：
   - `question_source = csca_question` 表示直接使用 AI 题。
   - `question_source = special_practice` 且 `question_id = csca_questions.source_question_id` 表示使用了 AI 题发布后的练习题。
5. 后台台账接口按上述两种路径统计曝光、作答和正确率。

## 后台入口

页面：

- 后台左侧导航 -> `AI 生成题库`
- 直达路由：`/admin/ai-question-bank`
- 后台审核页仍保留一个轻量台账摘要，方便从运营总览快速看状态。

接口：

```http
GET /api/v1/admin/ai-questioning/question-ledger
```

常用查询：

```http
GET /api/v1/admin/ai-questioning/question-ledger?subject=math
GET /api/v1/admin/ai-questioning/question-ledger?subject=math&status=approved
GET /api/v1/admin/ai-questioning/question-ledger?topicId=123
GET /api/v1/admin/ai-questioning/question-ledger?subject=math&limit=50&offset=50
```

关键字段：

- `total`：当前筛选下的题目总数，独立页面用它分页展示完整题库。
- `generationSourceLabel`：生成来源，目前为“大纲生成”，未来可扩展为“大纲+真题生成”。
- `isPracticeReady`：是否已经发布到练习。
- `sourceQuestionId`：发布后的练习题 ID。
- `exposureCount`：进入训练轮次的次数。
- `attemptCount`：学生实际作答次数。
- `accuracy`：已作答样本中的正确率。
- `lastUsedAt`：最近一次进入训练轮次或作答的时间。
- `fallbackUsed`：是否是本地 fallback 题。fallback 题不能发布。

## 做题页测试标记

前端开关：

```env
VITE_SHOW_AI_GENERATED_QUESTION_BADGE="true"
```

本地测试可打开。生产或正式学生体验中如不希望显示来源，设为：

```env
VITE_SHOW_AI_GENERATED_QUESTION_BADGE="false"
```

开启后，训练题如果来自 `source_type = ai`，做题页会显示：

- `AI生成题 · 大纲生成`
- 未来可扩展：`AI生成题 · 大纲+真题`

## 验收步骤

1. 上传并发布数学大纲，确保数学知识点有蓝图。
2. 配置真实 AI 出题 provider，并生成候选题。
3. 在候选审核中通过一题。
4. 打开后台审核页的 `AI生成题库`：
   - 能看到该题。
   - `isPracticeReady` 对应 UI 显示“已进练习”。
   - `sourceQuestionId` 显示发布后的练习题编号。
5. 进入对应科目训练，让系统抽到该题。
6. 回到 `AI生成题库`：
   - `exposureCount` 增加。
   - 作答后 `attemptCount` 增加。
   - `accuracy` 按真实作答更新。
7. 做题页在测试开关打开时显示 AI 来源标记。

## 边界

- 当前只标记 AI 生成题，不标记人工导入题。
- 当前真题尚未进入 AI 出题上下文，所以来源默认为 `syllabus`。
- 未来接入真题后，应在生成 metadata 中写入 `sourceKind = syllabus_and_past_paper`，并保留引用的真题来源 ID。
- 台账统计依赖训练轮次记录，不依赖前端状态。

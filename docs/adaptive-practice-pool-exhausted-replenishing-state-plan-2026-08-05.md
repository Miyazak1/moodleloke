# Adaptive Practice Pool Exhausted Replenishing State Plan

日期：2026-08-05

## 背景

当前科目训练的 AI 出题生产链路仍处于质量和稳定性收敛阶段。后台生产机制已经能持续补题、审核和发布，但仍存在 provider timeout、empty output、review 慢、题壳难度误判和多样性不足等波动。

因此，学生端暂时不应承诺“无限出题”或同步等待 AI 现场生成。更稳的产品策略是：

- 学生端只消费已经正式审核并发布到 subject practice 的安全题。
- 当前自适应题池不足以组成完整一轮时，停止创建下一轮。
- 前端展示温和、可爱的“正在补题中”状态。
- 后台 production run、predictive replenishment、review gate 继续运行和验收，但不由学生请求同步触发。

这不是取消自动补题，而是把不稳定性收回后台，避免暴露给学生。

## 共同结论

已和任务 `019fd0c1-071f-72d3-b0db-6455d5d7a573` 讨论，结论一致：

1. 当前方案合理，并且比学生端直接等待生成更稳。
2. 技术边界应切在学生侧的可投放题池耗尽，而不是切在 provider、reviewer 或 generation job 内部状态。
3. 不改学生端取题质量门。
4. 不做半轮训练。
5. 保留 shortage event，让 predictive replenishment 仍能看到真实缺口。
6. API 使用稳定业务 code：`ADAPTIVE_PRACTICE_POOL_EXHAUSTED`。

## 当前代码观察

### 后端取题边界

核心位置：

- `backend/src/csca-special-practice/csca-adaptive.service.ts`
- `backend/src/csca-special-practice/adaptive-question-provider.service.ts`

`CscaAdaptiveService.createRound` 当前流程：

1. 找到 active adaptive session。
2. 如有未提交 round，则复用该 round。
3. 生成 diagnostic/practice/verification plan。
4. 调用 `questionProvider.pickQuestions(userId, plan.plannedTopics, roundSize)`。
5. 如果 `plannedQuestions.length < roundSize`：
   - 调用 `recordAdaptiveInventoryShortageEvents(...)`
   - reason 为 `adaptive_round_not_enough_questions`
   - 当前抛普通 `BadRequestException('当前题库不足以生成完整自适应训练轮。')`

`AdaptiveQuestionProviderService.pickQuestions` 已经实现了学生端可投放题过滤。AI-backed special practice 题必须满足：

- `csca_questions.status = approved`
- `reviewMetadata.subjectPracticeAutoApproval.status = published_to_subject_practice`
- `reviewMetadata.subjectPracticeAutoApproval.targetUseCase = subject_practice`
- `reviewMetadata.subjectPracticeAutoApproval.targetQuestionBank = special_practice_questions`
- 不是 online mock exam 题
- 不是 fallback/smoke 题
- `generationMetadata.versionGovernance.status` 是学生可消费版本
- topic 与 syllabus version 匹配

这部分不应放松。

### 前端入口

至少需要覆盖两个学生入口：

1. 科目页开始训练：
   - `frontend/src/pages/CscaSubjectPage.tsx`
   - `startAdaptivePractice(...)`

2. 自适应报告页准备/进入下一轮：
   - `frontend/src/pages/special-practice/adaptive/AdaptivePracticeViews.tsx`
   - `prepareNextRound(...)`
   - `startNextRound(...)`

报告页当前会自动预拉下一轮。遇到题池耗尽时，不能不断重试，也不能显示普通红色错误，应把下一步区域变成补题中状态。

## 目标行为

### 学生端

当学生开始自适应训练或从报告页进入下一轮时：

- 如果能取到完整 roundSize 的题，行为不变。
- 如果当前可投放题不足以组成完整一轮：
  - 不创建半轮。
  - 不触发同步 AI 生成。
  - 不展示 provider/review/generation 内部状态。
  - 展示“正在补题中”状态。

推荐中文文案：

> 这组练习你已经刷完啦。我们正在努力补充新的适配题，稍后再来会有更多题目。

可选轻量文案：

> 小题库正在补货中，请稍后再来看看。

按钮建议：

- 返回科目页
- 换一个知识点
- 去做一套模考

### 后台

后台继续保持：

- shortage event 记录
- predictive replenishment 读取缺口
- subject-practice production run 继续跑
- reviewer 和 auto approval 继续守门
- 只有正式发布题进入学生端题池

学生端请求不直接同步等待这些后台动作。

## API 设计

### 推荐错误码

```ts
const ADAPTIVE_PRACTICE_POOL_EXHAUSTED = 'ADAPTIVE_PRACTICE_POOL_EXHAUSTED';
```

命名理由：

- `ADAPTIVE` 表示属于学生自适应练习链路。
- `PRACTICE_POOL` 表示当前学生可消费题池，不是 AI 候选池或 production run。
- `EXHAUSTED` 表示稳定业务状态，不暗示前端必须轮询等待生成完成。

### 后端返回体

不足完整一轮时，建议从普通 BadRequest 改为结构化 BadRequest：

```ts
throw new BadRequestException({
  code: 'ADAPTIVE_PRACTICE_POOL_EXHAUSTED',
  message: '这组练习你已经刷完啦。我们正在补充新的适配题，稍后再来会有更多题目。',
  shortage: {
    subject: session.subject,
    requested: roundSize,
    available: plannedQuestions.length
  }
});
```

说明：

- `message` 可以是学生友好默认文案。
- `shortage` 给前端埋点、日志和运营诊断使用。
- 前端不展示 `requested/available` 数字，避免学生看到“还差几题”的运营压力感。

### 可选扩展字段

后续如需要更细分，可以增加：

```ts
replenishment: {
  enabled: boolean;
  status: 'idle' | 'queued' | 'running' | 'blocked';
  retryAfterSeconds?: number;
}
```

当前阶段不建议前端强依赖这些字段。它们最多用于埋点或后台诊断，不作为学生体验的等待机制。

## 实施方案

### Phase 1：稳定题池耗尽状态

范围最小，推荐先做。

后端：

- 在 `CscaAdaptiveService.createRound` 的 `plannedQuestions.length < roundSize` 分支保留 `recordAdaptiveInventoryShortageEvents(...)`。
- 将普通 BadRequest 改为带 `ADAPTIVE_PRACTICE_POOL_EXHAUSTED` code 的结构化 BadRequest。
- 不改 `AdaptiveQuestionProviderService.pickQuestions` 的过滤逻辑。

前端：

- 增加 helper，例如：

```ts
function isAdaptivePracticePoolExhaustedError(error: unknown) {
  return error instanceof ApiError && error.code === 'ADAPTIVE_PRACTICE_POOL_EXHAUSTED';
}
```

- `CscaSubjectPage.startAdaptivePractice` 捕获该 code 后，展示补题中状态，不设置普通 `adaptiveError` 红字。
- `AdaptiveRoundReportView.prepareNextRound` 捕获该 code 后：
  - 停止自动预拉下一轮。
  - 记录 `nextRoundPoolState = 'exhausted'` 或类似状态。
  - 下一步区域显示补题中文案。
- `AdaptiveRoundReportView.startNextRound` 捕获该 code 后同样进入补题中状态。

### Phase 2：前端体验完善

在 Phase 1 稳定后补：

- 独立 `AdaptivePracticePoolExhaustedState` 组件。
- 科目页和报告页复用同一文案与按钮。
- 支持 zh-CN / en / vi 文案。
- 视觉上使用 existing empty-state / practice panel 样式，不做大型营销页。

建议英文文案：

> You have finished the safe practice set for now. We are preparing more adaptive questions. Check back later for more.

建议越南语文案：

> Bạn đã hoàn thành nhóm câu luyện hiện có. Chúng tôi đang bổ sung thêm câu phù hợp, hãy quay lại sau nhé.

### Phase 3：后台可观测性

不影响学生端，面向管理员和运营：

- 在 inventory/production 面板中继续展示 shortage pressure。
- 确认 `adaptive_round_not_enough_questions` 事件进入 usage aggregates / predictive replenishment。
- 可选统计：
  - pool exhausted 次数
  - subject/topic/difficulty 分布
  - 用户是否改去模考或换知识点
  - 后台补题完成后是否回流练习

### Phase 4：未来重新启用即时生成

只有当题目生成质量和吞吐稳定后，才考虑开启学生端即时补题。

需要单独 feature flag：

```ts
ADAPTIVE_STUDENT_SYNC_GENERATION_ENABLED=false
```

注意它应与后台生产开关分离：

- 后台 production / predictive replenishment 可以继续开启。
- 学生端同步生成默认关闭。

重新启用前必须满足：

- provider timeout 和 empty output 低于可接受阈值。
- review gate 稳定，误伤和漏放可控。
- 题型多样性达到验收标准。
- 同步等待有明确超时、取消和降级体验。
- 未过审题仍绝不进入学生端。

## 不做事项

当前阶段明确不做：

- 不做无限出题承诺。
- 不在学生端等待 AI 现场生成。
- 不展示 provider timeout、gateway cooldown、review_failed、empty output 等内部状态。
- 不把 pending_review / review_failed / generation succeeded but unpublished 的题给学生。
- 不做半轮。
- 不为了凑数放松 reviewer 或 version governance。

## 为什么不做半轮

继续保持完整 roundSize 才创建 round。

原因：

- roundSize 是自适应训练、报告、掌握度更新、下一轮规划的算法单位。
- 半轮会破坏报告统计、正确率解释和下一轮推荐语义。
- 半轮会给前端制造大量额外边界状态。
- 当前真正问题是库存和生成稳定性，不应通过可变长度训练来掩盖。

## 测试与验收

### 规则测试

建议补充：

- `scripts/csca-adaptive-rules-test.cjs`
  - `createRound` 题不足时返回 `ADAPTIVE_PRACTICE_POOL_EXHAUSTED`。
  - 不足时仍调用 `recordAdaptiveInventoryShortageEvents`。
  - 不足时不创建 round。

- `scripts/csca-adaptive-predictive-replenishment-rules-test.cjs`
  - shortage event 语义保持不变。
  - predictive replenishment 仍能读取库存压力。

### 前端测试

建议补充 Playwright route mock：

- 科目页开始训练接口返回：

```json
{
  "statusCode": 400,
  "code": "ADAPTIVE_PRACTICE_POOL_EXHAUSTED",
  "message": "这组练习你已经刷完啦。我们正在补充新的适配题，稍后再来会有更多题目。"
}
```

验收：

- 页面显示“补题中”文案。
- 不显示普通加载失败/红色错误。
- 不跳转到不存在的 round。
- 返回科目页 / 去模考按钮可用。

报告页验收：

- 自动 `prepareNextRound` 遇到该 code 后停止重试。
- 下一步区域显示补题中状态。
- 手动点击“准备下一轮”仍保持同一状态，不出现内部错误。

### 手工验收

1. 创建一个题池不足的测试 subject/session。
2. 点击开始训练。
3. 确认后端记录 shortage event。
4. 确认前端展示补题中状态。
5. 确认没有创建半轮。
6. 确认后台 production run/predictive replenishment 不受影响。

## 推荐做到哪里

当前最合适的完成边界：

1. 后端稳定 code。
2. 前端两个入口识别该 code。
3. 显示补题中状态。
4. 保留 shortage event。
5. 补规则测试和一个前端路由 mock 测试。

做到这里即可停止。不要在本轮继续接入学生端即时生成。

## 后续打开条件

只有当后台生产同时满足以下信号时，再考虑进入下一阶段：

- subject-practice production run 能稳定完成目标题量。
- P0/P1 audit 长期无阻断。
- provider timeout / empty output 不再频繁影响补题吞吐。
- reviewer 难度误判已降到可接受水平。
- 题型多样性不再依赖临时 prompt 补丁，而由结构化 task-family policy 守住。
- 学生端库存耗尽事件下降到低频。

在此之前，学生端“补题中”页是更稳的产品边界。

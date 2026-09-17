# CSCA 错题复盘、验证修复与自适应训练分流方案

> 日期：2026-06-10  
> 范围：个人页错题复盘、科目页训练入口、自适应训练 round、错题本、readiness 下一步动作  
> 目标：把“错题复盘”“用同类题验证”“继续自适应训练”拆成三条清晰路径，让用户知道自己现在是在看旧错题、验证修复，还是继续练新题。

## 1. 核心结论

当前交互最大问题不是有没有错题，而是把三件不同的事混在了一个按钮里：

- 错题复盘：处理旧错题，理解为什么错。
- 验证修复：复盘后做同类新题，确认是否真的修好了。
- 自适应训练：继续下一轮常规训练，系统可参考错题主题，但不是错题复盘。

这三者可以串联，但不能互相伪装。用户点“复盘错题”时，不应该直接进入普通 5 题训练；用户点“继续训练”时，也不应该被文案暗示是在复盘旧错题。

## 2. 现状问题

### 2.1 科目页入口误导

当前科目页在有到期错题时，会显示类似：

```text
先复盘 43 道错题，再进入下一轮。
复盘错题
```

但历史实现里按钮只是跳到个人页，后续又被改成创建 5 题自适应训练 round。这两种都不符合用户预期：

- 跳个人页：用户离开了当前科目训练上下文，不知道下一步做什么。
- 直接开 5 题训练：用户以为要看错题，实际做了新题。

### 2.2 “错题相关训练”被说成“错题”

实际 round 可能只是把错题对应 topic 放入 planner，例如 round 106 的 `plannerSnapshot` 中只有一个 `user_focus_topic`，其余题来自 `weakest_topic`、`stale_review_topic`、`challenge_or_foundation_topic`。

这不是“重做错题”，也不是“复盘错题”，只能叫：

```text
错题相关训练
```

### 2.3 Readiness 主行动也存在同类混淆

`review_due_patterns` 当前应表达“先复盘/验证错因”，但如果直接跳训练，会和“continue_active_round / keep_training”混在一起。

readiness 可以推荐复盘，但不能把复盘动作直接解释成训练动作。

## 3. 用户心智模型

### 3.1 错题复盘

用户问题：

```text
我之前错了什么？为什么错？我看懂了吗？
```

页面应该展示：

- 原题。
- 用户当时答案。
- 正确答案。
- 解析。
- 错因类型。
- 所属知识点。
- 下次复习时间。
- 操作：`我看懂了` / `稍后再看` / `用同类题验证`。

完成结果：

```text
unreviewed -> reviewed_pending_verification
```

### 3.2 验证修复

用户问题：

```text
我是不是只看懂了解析，还是同类题真的会做了？
```

页面应该进入做题，但必须明确这是验证，不是普通训练：

- 题目来自同 topic、同 pattern type、相近难度。
- 题数可以是 3-5 题。
- 页面标题应为“验证这个错因是否修好”。

完成结果：

```text
通过 -> verified_repaired
未通过 -> active / improving，重新安排下次复盘
```

### 3.3 自适应训练

用户问题：

```text
我下一轮该练什么？
```

系统可以参考：

- 薄弱 topic。
- 最近错题 topic。
- 久未练 topic。
- 难度表现。
- 覆盖盲区。

但文案必须说清楚：

```text
本轮会参考错题和薄弱点安排新题。
```

不能说：

```text
复盘错题
```

## 4. 目标状态机

建议统一错题状态为：

```text
unreviewed
  -> reviewed_pending_verification
  -> verified_repaired
```

失败或复发时：

```text
verified_repaired -> active
reviewed_pending_verification -> active
```

状态说明：

| 状态 | 用户含义 | 主按钮 | 去向 |
| --- | --- | --- | --- |
| `unreviewed` | 还没看懂旧错题 | 复盘错题 | 错题复盘页/错题详情 |
| `reviewed_pending_verification` | 看懂了，但还没证明会做同类题 | 用同类题验证 | 验证训练 round |
| `verified_repaired` | 同类题已通过 | 查看记录 | 错题历史 |
| `active` / `improving` pattern | 错因仍在反复 | 复盘错因 | 错因包 |

## 5. 页面与按钮规则

### 5.1 科目页

科目页不再用一个按钮混合所有动作。

有到期错题时：

```text
标题：先处理 43 道数学错题
说明：这些是之前做错、今天该看的题。先看错因，再决定是否用同类题验证。
主按钮：复盘错题
次按钮：继续训练
```

点击规则：

| 按钮 | 行为 |
| --- | --- |
| 复盘错题 | 打开本科目错题复盘页，并默认筛选到期错题 |
| 继续训练 | 创建普通 adaptive practice round |
| 用同类题验证 | 只在某个错题/错因已复盘后出现，创建 verification round |

### 5.2 个人页今日复盘

今日复盘区是复盘入口，不是训练入口。

主流程：

```text
今日复盘 -> 错题详情/错因包 -> 我看懂了 -> 用同类题验证
```

如果后端已经判断 `verificationRequired = true`，按钮文案必须是：

```text
用同类题验证
```

而不是：

```text
复盘完成
继续训练
```

### 5.3 错题本

错题本应支持两种视图：

- 错题列表：逐题复盘。
- 错因包：按 pattern type 聚合复盘。

每条错题至少显示：

- 题干摘要。
- 用户答案 / 正确答案。
- 错因。
- 状态。
- 主操作。

### 5.4 自适应训练页

普通训练页可以说：

```text
系统会参考薄弱点、最近错题和复习间隔安排本轮。
```

但如果是 verification round，必须显示：

```text
正在验证：不等式 / 公式混淆
这不是普通训练，而是确认上次错因是否修好。
```

## 6. 路由与跳转契约

### 6.1 建议新增或规范路由

| 场景 | 路由 | 说明 |
| --- | --- | --- |
| 本科目错题复盘 | `/zh/me?section=practice&subject=math&due=1#wrong-bank` 或独立 `/zh/csca-subjects/math/wrong-questions` | 第一阶段可复用个人页错题本，长期建议独立科目错题页 |
| 错题详情 | `/zh/me/wrong-questions/:itemKey` 或 modal | 第二阶段 |
| 错因包 | `/zh/me?patternType=...#wrong-bank` | 可先复用筛选 |
| 验证训练 | `/zh/csca-subjects/math/practice?verify=...&topicId=...&patternType=...` | 已有部分基础 |
| 普通训练 | `/zh/csca-subjects/math/practice` | 不带 review/verify 参数 |

### 6.2 第一阶段推荐

为了少改路由，第一阶段可以先做：

```text
科目页“复盘错题”
  -> /zh/me?section=practice&subject=math&due=1#wrong-bank
```

并在个人页错题本读取 URL 参数后：

- 自动切到练习/错题 section。
- 自动筛选 subject。
- 自动筛选到期错题。
- 滚动到错题本。

第二阶段再做独立科目错题页。

## 7. 后端数据契约

### 7.1 Wrong Question Item

当前已有 `CscaWrongQuestionItem`，建议补齐或稳定以下字段：

```ts
type WrongQuestionItem = {
  itemKey: string;
  sourceType: 'adaptive_round' | 'diagnostic' | 'mock_exam' | 'special_practice';
  subject: 'math' | 'physics' | 'chemistry';
  topicId: number | null;
  topicTitle: string;
  patternType: string;
  patternLabel: string;
  patternConfidence: number | null;
  status: 'unreviewed' | 'reviewed_pending_verification' | 'verified_repaired' | 'active' | 'improving';
  nextReviewAt: string | null;
  reviewHref: string;
  verificationHref: string | null;
  practiceHref: string;
};
```

关键点：

- `reviewHref`：看旧错题。
- `verificationHref`：复盘后做同类新题。
- `practiceHref`：普通或相关训练。

这三个 href 不能混用。

### 7.2 Review Queue Item

当前 review queue 更偏 wrong pattern。建议清晰区分：

```ts
type ReviewQueueItem = {
  id: number;
  subject: CscaLearningSubject;
  topicId: number | null;
  patternType: string;
  status: 'unreviewed' | 'reviewed_pending_verification' | 'verified_repaired';
  due: boolean;
  href: string;              // 复盘入口
  verificationHref: string;  // 验证入口
  verificationRequired: boolean;
};
```

规则：

- `href` 永远是复盘。
- `verificationHref` 永远是做题验证。

### 7.3 Training Round Metadata

自适应训练 round 应在 `plannerSnapshot` 中明确来源：

```ts
type PlannerSnapshot = {
  strategy: string;
  mode: 'regular' | 'verification' | 'wrong_topic_practice';
  focus: null | {
    source: 'wrong_question' | 'wrong_pattern' | 'readiness_action' | 'manual_topic';
    subject: string;
    topicId: number | null;
    patternType?: string;
    originalItemKey?: string;
  };
  plannedTopics: Array<{
    topicId: number;
    title: string;
    reason:
      | 'user_focus_topic'
      | 'wrong_pattern_verification'
      | 'recent_wrong_topic'
      | 'weakest_topic'
      | 'stale_review_topic'
      | 'fill_round';
  }>;
};
```

UI 用它判断标题：

- `mode = regular`：普通训练。
- `mode = wrong_topic_practice`：错题相关训练。
- `mode = verification`：验证修复。

## 8. Planner 规则

### 8.1 普通训练

普通训练可以使用当前 planner：

```text
weakest + recent wrong + stale review + challenge/foundation
```

但 UI 不把它叫错题复盘。

### 8.2 错题相关训练

如果用户点的是“继续训练”，但系统参考了错题：

- 最多只说“参考了最近错题”。
- 不承诺题目就是错题。
- round 可以仍是 5 题。

### 8.3 验证修复训练

如果用户点的是“用同类题验证”：

- 必须围绕同 topic / pattern。
- 建议 3-5 题。
- 至少 60% 题目必须来自目标 topic。
- 如果题库不足，明确降级：

```text
同类题不足，本轮会用相近知识点补足。
```

验收规则：

```text
verification round 中 user_focus_topic 或 wrong_pattern_verification 题数 >= 3/5
```

## 9. 前端实施方案

### 9.1 科目页 `CscaSubjectPage`

要改的点：

1. 撤回“用错题开一轮”这种混合文案。
2. `review_first` 状态展示两个按钮：
   - `复盘错题`
   - `继续训练`
3. `复盘错题` 跳复盘入口。
4. `继续训练` 调用 `startAdaptivePractice()`，不传错题 topic。
5. 如果后续有 `verificationHref`，才显示 `用同类题验证`。

建议文案：

```text
标题：先处理 43 道数学错题
说明：这些是之前做错、今天该看的题。复盘后再用同类题确认是否修好。
主按钮：复盘错题
次按钮：继续训练
```

### 9.2 个人页 `PublicMePage`

要改的点：

1. 今日复盘按钮区分：
   - `复盘错题`
   - `用同类题验证`
2. 点击复盘不直接创建训练 round。
3. 完成复盘后，展示验证按钮，而不是自动跳训练，除非按钮文案明确是验证。
4. 错题本支持 URL 参数默认筛选：
   - `subject=math`
   - `due=1`
   - `patternType=...`

### 9.3 Adaptive Practice Views

要改的点：

1. 根据 `plannerSnapshot.mode` 显示不同标题。
2. 普通训练标题：

```text
当前掌握度 24%，继续按推荐训练。
```

3. 验证训练标题：

```text
正在验证“不等式”错因是否修好。
```

4. 错题相关训练标题：

```text
本轮参考了最近错题，优先练相关知识点。
```

## 10. 后端实施方案

### 10.1 `me` 错题查询层

确保 `listCscaWrongQuestions` 返回：

- `reviewHref`
- `verificationHref`
- `practiceHref`
- 稳定 status
- due 标记

第一阶段如果不新增详情页，`reviewHref` 可指向个人页错题本筛选锚点。

### 10.2 `completeMyCscaReviewQueueItem`

复盘完成后：

- 更新 wrong pattern 的 `lastReviewCompletedAt`。
- 状态进入 `reviewed_pending_verification` 或等价字段。
- 返回 `verificationHref`。
- 不自动认为 mastered。

### 10.3 Adaptive Round 创建

新增 round mode 或 metadata：

```ts
{
  mode: 'regular' | 'verification' | 'wrong_topic_practice'
}
```

请求体建议扩展：

```ts
type CreateAdaptiveRoundInput = {
  focusTopicId?: number;
  verification?: {
    reviewItemId?: number;
    patternType?: string;
    topicId?: number;
  };
};
```

如果 `verification` 存在：

- planner 使用 verification 策略。
- training event 记录 `practice_round_started` + metadata `roundMode: verification`。

## 11. Readiness 行动规则

Readiness next action 要严格映射：

| readiness action | 按钮 | 去向 |
| --- | --- | --- |
| `review_due_patterns` 且未复盘 | 复盘错题 | 错题复盘入口 |
| `review_due_patterns` 且已复盘待验证 | 用同类题验证 | verification round |
| `continue_active_round` | 继续未完成训练 | active round |
| `repair_weak_subject` | 进入科目训练 | 科目页/普通训练 |
| `keep_training` | 继续训练 | 普通训练 |

不能再出现：

```text
页面说复盘，按钮进普通训练。
页面说继续训练，实际在处理复盘。
```

## 12. PR 拆分

### PR A：文案和跳转止血

目标：先消除当前最大误导。

任务：

- 科目页 `review_first` 改成双按钮。
- `复盘错题` 跳个人页错题本筛选。
- `继续训练` 才创建普通训练 round。
- 去掉“用错题开一轮”文案。
- readiness 的 `review_due_patterns` 不再指向普通训练。

验收：

- 有到期错题时，科目页主按钮为 `复盘错题`。
- 点击后进入错题本/复盘区，而不是 5 题训练页。
- 点击 `继续训练` 才进入 5 题训练。

### PR B：个人页错题本 URL 筛选

目标：让科目页能深链到具体错题复盘任务。

任务：

- `PublicMePage` 读取 `section=practice`、`subject`、`due`、`patternType`。
- 自动切换到练习/错题 section。
- 自动筛选错题。
- 滚动到错题本。

验收：

- `/zh/me?section=practice&subject=math&due=1#wrong-bank` 直接展示数学到期错题。

### PR C：验证修复 round 正式化

目标：复盘后再进入同类题验证。

任务：

- 扩展 create round payload：`verification`。
- planner 增加 verification 策略。
- `plannerSnapshot.mode = verification`。
- 训练页显示验证标题。
- 完成后更新 wrong pattern verification 状态。

验收：

- 点击 `用同类题验证` 后进入验证 round。
- round 题目大多数来自目标 topic/pattern。
- 报告页说明这是验证，不是普通训练。

### PR D：错题详情/错因包体验

目标：让复盘不是只看列表。

任务：

- 错题卡支持逐题复盘 modal 或独立详情页。
- 展示结构化 AI 解释。
- 支持 `我看懂了`。
- 支持 `用同类题验证`。

验收：

- 用户能完整看旧错题、答案、解析、错因。
- 完成复盘后状态改变。

### PR E：测试与观测

目标：避免再把三条路径混在一起。

任务：

- 规则测试：
  - `subject_page_due_wrong_questions_goes_to_review_not_training`
  - `continue_training_starts_regular_round`
  - `verification_round_uses_verification_mode`
  - `readiness_review_action_points_to_review_href`
- 前端测试：
  - 科目页双按钮。
  - 个人页 URL 筛选。
  - 验证 round 标题。

## 13. 验收矩阵

| 场景 | 期望 |
| --- | --- |
| 数学有 43 道到期错题 | 科目页显示 `复盘错题` 和 `继续训练` 两个动作 |
| 点 `复盘错题` | 进入数学到期错题复盘，不创建新 round |
| 点 `继续训练` | 创建普通 5 题 adaptive round |
| 复盘某错因后 | 显示 `用同类题验证` |
| 点 `用同类题验证` | 创建 verification round，标题明确为验证 |
| verification round 完成且通过 | 错因进入 `verified_repaired` |
| verification round 未通过 | 错因保持 active/improving，安排下次复盘 |
| readiness 推荐复盘 | 跳复盘入口，不跳普通训练 |

## 14. 当前需要修正的已知混合逻辑

这些是当前实现里需要回收或调整的地方：

- 科目页 `review_first` 的“用错题开一轮”文案应撤回。
- 科目页 `review` action 不应直接调用 `startAdaptivePractice(primaryDueWrongQuestion.topicId)`。
- 如果保留错题 topic 训练，也只能作为 `wrong_topic_practice`，不能叫复盘。
- 训练 round 报告页不能暗示“复盘完成”，除非 round mode 是 verification。
- readiness 的 `review_due_patterns` 应根据状态跳 `reviewHref` 或 `verificationHref`，不使用普通 practice href。

## 15. 推荐执行顺序

先做 PR A 和 PR B。原因：

- 不需要大改数据库。
- 能最快消除用户误解。
- 可以复用现有统一错题本。
- 风险低，验证直接。

然后做 PR C。原因：

- verification round 需要后端策略和状态更新，风险更高。
- 等复盘入口清楚后，再把“验证修复”做实。

最后做 PR D/E，把复盘体验和测试补完整。

## 16. 执行状态

### 2026-06-10：PR A/B 已完成第一版

已落地：

- 科目页 `review_first` 不再把“复盘错题”包装成“用错题开一轮”。
- 科目页有到期错题时显示两条路径：
  - 主按钮：`复盘错题`，进入个人页错题本深链。
  - 次按钮：`继续训练`，才创建普通 adaptive round。
- 个人页支持错题本深链：

```text
/zh/me?section=practice&subject=math&due=1#wrong-bank
```

- 个人页会读取 `subject`、`patternType`、`due=1`，自动进入练习区并滚动到错题本。
- 错题筛选器新增 `到期复习` 开关，让用户能看见当前为什么只显示到期错题。

验证：

- `frontend tsc --noEmit` 通过。
- `npm --prefix frontend run build` 通过。
- `git diff --check` 只有仓库既有 LF/CRLF warning。

下一步：

- PR C：把 `用同类题验证` 做成正式 verification round，而不是普通 adaptive round。
- PR D：补错题详情/错因包复盘体验，让“复盘错题”不只是筛选列表。

### 2026-06-10：PR C 第一版已完成

已落地：

- `createAdaptivePracticeRound` payload 支持 `verification`：
  - `reviewItemId`
  - `patternType`
  - `topicId`
- 后端 planner 新增 `planVerificationRound`：
  - `plannerSnapshot.mode = verification`
  - `plannerSnapshot.strategy = wrong_pattern_verification`
  - `plannerSnapshot.focus` 记录错因验证目标。
  - 验证轮前 3 个计划位优先使用同一个目标知识点，让“用同类题验证”真的以同类新题为主。
- 科目页处理 `verify/topicId/review` 深链时，会创建 verification round，不再只是普通 `focusTopicId` 训练。
- 练题页顶部显示 `错因验证`，让用户知道当前不是普通训练。
- 报告页根据 verification mode 改标题和下一步：
  - 通过时：提示可以回到普通训练。
  - 未通过时：提示先回错题复盘，按钮跳回个人页错题本。

验证待补：

- 需要跑前后端构建和一次真实浏览器路径验证。
- 还没有把 verification 结果自动写回错题/错因状态，即 `verified_repaired` 仍未落地。下一步应单独做 PR C2 或并入 PR D。

### 2026-06-10：PR C2 已完成第一版

已落地：

- verification round 提交后会读取 `plannerSnapshot.mode/focus`，只对带 `reviewItemId` 的验证轮写回错因状态。
- 通过标准：
  - 只看验证目标知识点题目，不用整轮总分替代。
  - 目标题正确率 `>= 80%` 才算验证通过。
- 验证通过：
  - `CscaWrongPattern.status = resolved`
  - `nextReviewAt = null`
  - `metadata.verificationCompletedAt = 当前时间`
  - 个人页/准备度会显示 `verified_repaired`。
- 验证失败：
  - `CscaWrongPattern.status = improving`
  - `nextReviewAt = 当前时间 + 2 天`
  - `metadata.verificationFailedAt = 当前时间`
  - 保持需要继续复盘/再次验证。
- 普通训练的正确证据不再把已经完成复盘的错因直接判为 `verified_repaired`，避免“继续训练碰巧答对一题就算错因修好”。
- 验证失败时，错题记录会优先回写原来的 `active/improving` 错因，避免创建重复错因。
- 前端报告页与后端使用同一口径：按验证目标知识点题目的正确率判断通过/未通过。

下一步：

- PR D：错题详情/错因包复盘体验。
- PR E：补自动化测试，尤其是：
  - 普通训练答对不会 verified。
  - verification 通过会 verified。
  - verification 失败会回到 improving 并安排下次复盘。

### 2026-06-10：PR D 第一版已完成

已落地：

- 个人页错题卡展开后，不只展示原题、选项、答案和解析，还会感知对应的错因复盘任务。
- 如果错题能匹配到 review queue：
  - 未复盘：显示 `已看懂，去验证`，调用已有复盘完成接口。
  - 已复盘待验证：显示 `验证修复`，跳 verification round。
  - 已验证：显示 `已验证修复`。
- 匹配逻辑优先按：
  - subject
  - patternType
  - topicId
  - recentQuestionIds
- 这使“复盘错题”从列表筛选升级为一条完整路径：看原题 -> 看错因/解析 -> 标记看懂 -> 用同类新题验证。

仍需完善：

- 复盘详情还在列表展开态，没有做独立沉浸式复盘页。
- `已看懂` 目前以错因队列为单位，不是逐道错题独立状态。
- 还需要增加专门测试覆盖错题卡动作区。

### 2026-06-10：PR E 最小规则测试已补

已落地：

- `scripts/csca-learning-dashboard-rules-test.cjs` 新增错因验证规则测试：
  - 普通正确证据不会把已复盘错因直接标成 `verified_repaired`。
  - verification 通过会写 `verificationCompletedAt`，并把错因置为 `resolved`。
  - verification 失败会写 `verificationFailedAt`，并让错因回到 `improving`、安排下次复盘。
- 已运行 `npm run csca-learning:rules` 通过。

仍需补：

- 前端交互测试：错题卡展开、`已看懂，去验证`、`验证修复`。
- 真实浏览器联调：从个人页错题卡 -> verification round -> report -> 回个人页状态刷新。

### 2026-06-10：PR D2 旧错题兜底复盘已补

浏览器联调时发现一个真实数据断层：

- 个人页错题本里有一批旧模考错题能显示在错题列表中。
- 但这些错题未必都能匹配到持久化的 `CscaWrongPattern`。
- 如果只依赖已有 review queue，用户展开错题后会看到原题、答案和解析，却没有清晰的 `已看懂，去验证` 动作。

已落地：

- `listCscaWrongQuestions` 尽量把错题匹配到已有错因模式，并返回 `reviewPattern`。
- 对没有 `reviewPattern` 的旧错题，前端仍显示“错题复盘”动作区。
- 用户点击 `已看懂，去验证` 时，前端调用：

```http
POST /api/v1/me/csca/wrong-questions/review-complete
```

- 后端根据错题的 `subject/topicId/patternType/questionId/sourceType` 按需创建或复用 active/improving `CscaWrongPattern`，再调用统一的错因复盘完成逻辑。
- 返回 `verificationHref` 后，前端直接进入同知识点/同错因 verification round。

产品语义：

- 错题卡本身负责“看懂旧题”。
- 后端负责把旧题补登记为可验证的错因复盘任务。
- 验证训练仍然是新题，不把普通训练伪装成错题复盘。

本轮验证：

- `npm --prefix frontend run build`：通过。
- `npm exec tsc -- -p tsconfig.json --pretty false --noEmit`：通过。
- `npm run csca-learning:rules`：通过。
- `git diff --check`：通过，仅有既有 LF/CRLF warning。
- 浏览器已验证错题卡展开后会显示：
  - `错题复盘`
  - `先确认这题已经看懂，再用同类题验证是否真的修好。`
  - `已看懂，去验证`

当前联调阻塞：

- 当前运行中的后端进程还未加载新增 controller，点击后返回 `Cannot POST /api/v1/me/csca/wrong-questions/review-complete`。
- 需要重启后端后复测真实链路：
  1. 打开 `/zh/me?section=practice&subject=math&due=1#wrong-bank`。
  2. 展开一条旧模考错题。
  3. 点击 `已看懂，去验证`。
  4. 预期进入 `/zh/csca-subjects/math?...verify=...` 并创建 `mode = verification` 的 round。
  5. 提交后按目标知识点正确率写回 `verified_repaired` 或继续保持待验证。

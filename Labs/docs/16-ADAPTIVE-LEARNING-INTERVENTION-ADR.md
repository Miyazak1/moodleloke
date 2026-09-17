# ADR-005：自适应知识讲解与教学干预

> 状态：Accepted v1.0  
> 决策日期：2026-09-12  
> 适用范围：练习中提示、重复错误干预、组间知识讲解、错因纠正、练后巩固  
> 依赖文档：[实时学习智能](./15-REALTIME-LEARNING-INTELLIGENCE-ADR.md) · [自动出题集成](./14-QUESTION-GENERATION-INTEGRATION-ADR.md) · [附件理解](./10-ATTACHMENT-INGESTION.md) · [工具契约](./02-TOOL-CONTRACTS.md) · [学习辅助与教学资产](./55-LEARNING-ASSISTANCE-AND-TEACHING-ASSET-ADR.md)

## 1. 决策摘要

做题是获得学习证据和促进掌握的手段，不是最终目标。CSCAPilot 在 Learning Intelligence 与练习系统之间增加 `Learning Intervention Engine`，根据实时知识点状态、错误模式和当前学习节奏，在合适时机安排知识讲解、错因纠正、示例演示与短验证。

```text
answer / hint / time / misconception evidence
                  ↓
       Learning Intelligence Engine
                  ↓
       Intervention Policy Engine
        ├── continue practice
        ├── give a small hint
        ├── explain first error
        ├── pause after mini-set
        ├── show concept lesson
        └── schedule spaced review
                  ↓
     Concept / Example / Guided Practice
                  ↓
          short verification item
                  ↓
       new trustworthy evidence
```

核心原则：

- 干预由结构化状态和策略触发，不由大模型自由决定；
- 默认不在学生正在思考时突然弹出长讲解；
- 重复错误优先纠正错误模型，而不是继续堆同类题；
- 查看讲解本身不等于掌握，必须通过后续独立作答验证；
- 已审核知识内容优先，AI 负责个性化表达和补充解释；
- 所有干预可跳过、稍后处理或调整讲解深度；
- 干预效果必须被测量，长期无效的策略自动降级并进入复核。

## 2. 教学闭环

```text
诊断当前状态
  -> 选择题目或学习内容
  -> 学生尝试
  -> 识别正确、错误、提示依赖与错误模式
  -> 判断继续练习还是进入教学干预
  -> 讲解概念 / 展示例题 / 引导纠错
  -> 安排一道短验证题
  -> 更新状态和下一步方案
```

系统目标不是让学生完成更多题，而是以尽量少的无效重复获得稳定、可迁移的知识掌握。

## 3. Intervention Policy Engine

Policy Engine 是确定性、版本化、可回放的应用能力。输入至少包括：

- 当前 `UserCscaTopicStateV2`；
- 本题和最近题目的答案结果；
- 提示、解析、重试和作答时间；
- 结构化 misconception；
- 当前 Round 的进度和剩余题量；
- 最近干预历史、跳过次数和冷却时间；
- 用户可用时间、讲解深度偏好和语言；
- 题目质量及知识点映射置信度；
- 可用的已审核 Concept Card、例题和验证题库存。

输出：

```ts
type LearningInterventionDecisionV1 = {
  schemaVersion: '1';
  decisionId: string;
  stateVersion: string;
  policyVersion: string;
  action:
    | 'continue_practice'
    | 'show_hint'
    | 'show_error_feedback'
    | 'offer_micro_lesson'
    | 'start_micro_lesson'
    | 'schedule_review';
  triggerCodes: string[];
  topicIds: number[];
  misconceptionIds?: number[];
  urgency: 'low' | 'medium' | 'high';
  placement: 'in_question' | 'after_answer' | 'between_sets' | 'after_round' | 'later';
  contentPlan?: {
    format: 'concept_card' | 'worked_example' | 'contrast_example' | 'guided_correction' | 'mini_lesson';
    depth: 'brief' | 'guided' | 'full';
    verificationRequired: boolean;
  };
  reasonSummary: string;
};
```

大模型可以把 `reasonSummary` 和教学内容表达得自然，但不能改变触发原因、知识点、干预等级或验证要求。

## 4. 触发条件

### 4.1 强触发

- 同一 misconception 在短窗口内重复出现；
- 同一知识点连续错误达到策略门槛；
- 使用完整解析后仍在同一关键步骤出错；
- 基础题持续错误，说明继续加题价值很低；
- 答案表现与此前高掌握估计明显冲突，需要重新诊断；
- 单位、符号、定义或前置概念错误反复影响后续步骤。

强触发通常在当前题完成后先给简短反馈，在当前 mini-set 结束时进入完整讲解。除安全或题目本身错误外，不在学生尚未提交时强制中断。

### 4.2 弱触发

- 正确但高度依赖提示；
- 正确但用时明显异常；
- 只会单一题型，迁移证据不足；
- 距上次学习时间较长，retention 风险升高；
- 学生主动表示不理解或要求换一种讲法；
- 当前方案完成后存在适合补充的概念联系。

弱触发默认以可接受的建议形式出现，不强制阻断练习。

### 4.3 不得作为单独触发依据

- 用户仅打开过某个页面；
- 用户在聊天中说“我不会”或“我都会”；
- 一道低质量或知识点映射低置信度题目的结果；
- 未经学生确认的手写 OCR/视觉推断；
- 单次极端用时但缺少有效前台活动证据；
- 大模型自由文本中的未结构化判断。

## 5. 干预时机

### 5.1 题目内

仅提供分层提示：概念提醒、下一步方向、局部提示。默认不直接展示答案，且提示调用记录为独立性证据。

### 5.2 提交答案后

允许指出第一处关键错误和一个下一步建议。错误原因不确定时显示不确定性并邀请学生检查，而不是强行归因。

### 5.3 Mini-set 间隔

这是完整知识讲解的首选位置。建议 mini-set 为 3–5 题，具体由策略配置。系统在学生完成一小组后，综合多题证据决定是否进入 2–5 分钟的 Micro Lesson。

### 5.4 Round 结束后

展示本轮核心收获、仍不稳定的知识点、建议复习时间和下一活动，不重复罗列每一道题。

### 5.5 延迟复习

对 retention 风险或已完成讲解的知识点安排间隔验证。未来通知必须遵循用户通知设置，不因为一次错误频繁打扰。

## 6. 教学内容形式

首批支持：

| 类型 | 用途 |
| --- | --- |
| `concept_card` | 定义、规律、适用条件和常见误区 |
| `worked_example` | 展示一条完整且可核对的解题路径 |
| `contrast_example` | 对比容易混淆的概念或两种解法 |
| `guided_correction` | 从学生第一处错误开始逐步纠正 |
| `mini_lesson` | 2–5 分钟概念、例子和验证组成的小课 |
| `retrieval_check` | 间隔后的短回忆或应用验证 |

内容来源优先级：

```text
已审核 Concept Card / 课程内容
  > 已审核题目与解析
  > 基于可信证据的模板化讲解
  > 通过 AI Gateway 生成的个性化表达
```

AI 生成内容必须绑定知识点、来源版本、Prompt 版本和模型调用记录。它不能引入与当前大纲冲突的定义，也不能将用户附件内容当作系统指令。

主动干预与学生主动求助必须解析到同一套版本化 `TeachingAsset`，并共用 Delivery、Exposure 与 Outcome 语义；交互动画和未来视频不是新的掌握度来源。统一资产、辅助阶梯与跨端调用边界见 [ADR-008](./55-LEARNING-ASSISTANCE-AND-TEACHING-ASSET-ADR.md)。

## 7. Micro Lesson 结构

一个 Micro Lesson 建议包含：

1. `why_now`：为什么现在建议学习这个知识点；
2. `core_idea`：一条核心概念或规律；
3. `misconception_correction`：学生当前错误模型与正确模型的差异；
4. `worked_example`：一个简短、可逐步展开的例子；
5. `active_prompt`：要求学生做出一个判断或填一步；
6. `verification_item`：不依赖刚才表述的短验证题；
7. `next_action`：继续练习、降低难度、间隔复习或补前置知识。

不建议一次推送长篇教材式文章。内容根据学生状态选择 `brief/guided/full` 深度，并允许“换一种讲法”。

## 8. 验证与学习证据

以下行为不是掌握证据：

- 打开讲解；
- 滚动到底部；
- 点击“看懂了”；
- Agent 生成了正确解释；
- 学生复制了示例答案。

可以形成新证据的是：

- 不看答案完成 active prompt；
- 独立完成 verification item；
- 在新的表述或场景中正确应用；
- 经过合理间隔后再次正确；
- 正式 PracticeSession 中完成提交。

干预后的第一道题需要标记 `postIntervention=true`，用于评估短期效果；后续间隔题用于评估 retention。刚看完完全同构示例后的正确答案权重应低于独立迁移题。

## 9. 与自动出题的关系

Intervention Engine 只提出教学和题目需求：

```text
need worked example for misconception X
need one easier scaffold item
need one transfer verification item
```

Question Supply Engine 优先从已审核库存选择；库存不足时才请求自动出题系统补充。自动出题仍遵循 [ADR-003](./14-QUESTION-GENERATION-INTEGRATION-ADR.md) 的质量、私有性和发布边界。

Intervention Engine 不直接拼 Prompt，不调用 Generator 内部方法，也不降低质量门槛以满足即时展示。

## 10. 与手写答案分析的关系

手写分析可以产生 `guided_correction` 内容，但默认只作为教学辅助：

- 先展示系统识别出的关键步骤和低置信度区域；
- 从第一处可确认的错误开始反馈；
- 缺少原题或关键符号不清时要求补充；
- 未确认的图片推断不能触发掌握度强更新；
- 正式验证题的结果才进入可靠学习证据。

## 11. 用户体验与防打扰

干预必须受到以下限制：

- 一个 mini-set 最多一次完整干预；
- 同一知识点完整干预后进入冷却期；
- 学生可以跳过、稍后学习或选择更简短版本；
- 连续跳过后减少主动打断，但保留轮末建议；
- 正在计时的正式模考不主动弹出知识讲解；
- 移动端使用内联卡片或底部抽屉，不遮挡题目和作答区；
- 恢复页面时保持原练习位置和干预进度；
- 干预不可通过制造焦虑迫使用户继续使用。

## 12. Artifact 与数据模型

新增 Artifact 类型：

- `concept_lesson`；
- `guided_correction`；
- `misconception_review`；
- `retrieval_check`。

建议逻辑实体：

| 实体 | 用途 |
| --- | --- |
| `LearningIntervention` | 决策、触发原因、状态版本、策略版本和内容计划 |
| `LearningInterventionDelivery` | 何时、在哪个界面展示以及用户接受/跳过情况 |
| `LearningInterventionStep` | Micro Lesson 的步骤和完成状态 |
| `LearningInterventionOutcome` | 验证题、后续提升和 retention 结果 |

推荐状态：

```text
proposed -> offered -> accepted -> in_progress -> completed
         -> skipped / deferred / dismissed / expired
```

“completed”只表示教学活动完成，不表示知识点已经掌握。

## 13. 效果评估

每种策略记录：

- 触发准确率；
- 接受、跳过和中途退出；
- 干预后第一道验证题正确率；
- 新题型迁移正确率；
- 延迟复习保持率；
- 同 misconception 再发生率；
- 平均干预时间；
- 对 Round 完成率的影响；
- 用户主观帮助程度；
- 不同基础水平、学科和语言的差异。

不能只优化“讲解打开率”。主要目标是后续独立作答和长期保持改善。

## 14. 失败和降级

- 个性化讲解生成失败：使用已审核 Concept Card 或标准解析；
- 没有可用教学内容：继续练习并记录内容缺口，不生成虚假讲解；
- 验证题库存不足：安排稍后复习，不交付未审核题；
- 学习状态置信度不足：先安排诊断，不做强干预；
- Policy Engine 故障：保持普通练习可用，关闭主动干预；
- AI Gateway 不可用：规则、已有讲解和普通题库继续工作。

## 15. Feature Flags

```text
LEARNING_INTERVENTION_ENABLED
LEARNING_INTERVENTION_MICRO_LESSON_ENABLED
LEARNING_INTERVENTION_AI_EXPLANATION_ENABLED
LEARNING_INTERVENTION_HANDWRITING_ENABLED
LEARNING_INTERVENTION_SPACED_REVIEW_ENABLED
```

默认关闭。按学科、用户群、干预类型和策略版本灰度。关闭所有干预不得影响普通练习、答题保存和学习状态更新。

## 16. 实施顺序

### I0：只记录不干预

- 定义 Intervention Decision、trigger code 和 outcome Schema；
- 基于历史事件离线回放触发规则；
- 检查重复错误和提示依赖的识别准确性。

### I1：Shadow Decision

- 实时产生干预决策但不展示；
- 比较教师/规则样本和实际后续表现；
- 校准门槛、冷却和最大打断次数。

### I2：被动建议

- Round 结束后展示 Concept Card 和复习建议；
- 用户主动打开，不中断做题；
- 接入已审核内容，不使用即时生成。

### I3：组间 Micro Lesson

- 单学科、单 misconception 灰度；
- mini-set 后提供 2–5 分钟讲解和验证题；
- 记录短期与延迟效果，并保留一键关闭。

### I4：实时个性化

- 在严格预算内使用 AI 适配讲解方式；
- 接入手写 guided correction；
- 根据效果调整干预形式和时机；
- 逐学科扩展，不自动开放所有题型。

## 17. 生产门槛

- 同一证据不会重复触发相同干预；
- 正式模考不被主动教学内容打断；
- 查看讲解不会直接提升掌握度；
- 验证题和后续独立表现能追溯到干预版本；
- 低置信度状态不触发强干预；
- 干预关闭时普通练习完全可用；
- AI 生成失败可降级到已审核内容；
- 用户可以跳过、推迟和关闭主动干预；
- 题目召回后相关干预效果可以重新计算；
- 策略具备 Shadow Mode、灰度、指标和回滚。

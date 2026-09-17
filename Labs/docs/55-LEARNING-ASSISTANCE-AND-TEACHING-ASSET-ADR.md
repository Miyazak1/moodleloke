# ADR-008：学习辅助能力与教学内容资产

> 状态：Accepted v1.0
>
> 决策日期：2026-09-14
>
> 适用范围：练习页、Web Agent、附件/手写分析、教学干预、未来 Codex/ChatGPT 插件
>
> 依赖：[实时学习智能](./15-REALTIME-LEARNING-INTELLIGENCE-ADR.md) · [自适应教学干预](./16-ADAPTIVE-LEARNING-INTERVENTION-ADR.md) · [附件理解](./10-ATTACHMENT-INGESTION.md) · [能力目录](./20-AGENT-CAPABILITY-CATALOG.md)

## 1. 决策摘要

CSCAPilot 的学习闭环不是“推荐题—做题—继续推荐题”，而是：

```text
诊断与目标差距
  -> 安排练习或知识学习
  -> 学生尝试
  -> 识别掌握、卡点、错误模式和提示依赖
  -> 继续练习 / 学生主动求助 / 系统主动教学干预
  -> 概念、示例、交互演示或引导纠错
  -> 独立验证与延迟验证
  -> 更新学习状态和下一方案
```

新增统一的 `Learning Assistance Orchestrator`，负责在可信业务上下文中选择学生当前可使用的辅助层级和教学资产。它与 `Learning Intervention Engine` 分工如下：

- Assistance：学生主动请求帮助，强调即时、渐进和不泄题；
- Intervention：系统基于学习证据主动建议教学，强调时机、节奏和防打扰；
- 两者共用学习状态、教学资产、曝光记录、权限计费和效果验证；
- 大模型只负责受约束的理解与表达，不决定掌握度、答案开放、成绩或干预触发。

## 2. 产品原则

1. 做题是获取证据和促进掌握的手段，不是最终结果；
2. 默认给最小有效帮助，保留学生独立完成的机会；
3. 辅助随当前题、作答阶段、已用提示和学生状态变化，不提供脱离上下文的万能 AI 按钮；
4. 已审核内容优先，模型生成内容必须绑定可信题目、知识点和来源版本；
5. 看过提示、示例、讲解或答案必须形成曝光记录，并影响证据权重；
6. 学完不等于掌握，只有后续独立作答、迁移和保持验证能更新掌握判断；
7. 正式计时模考禁用主动教学和答案型辅助；
8. 所有主动干预可以跳过、推迟或关闭，辅助能力不会制造焦虑或强迫使用。

## 3. 统一学习辅助阶梯

辅助使用稳定层级，而不是分别暴露若干互不关联的 AI 按钮：

| 层级 | capability | 学生获得的帮助 | 默认开放时机 | 曝光影响 |
| --- | --- | --- | --- | --- |
| A0 | `clarify_question` | 澄清题意、符号、单位或要求 | 作答前/中 | 通常不泄露路径 |
| A1 | `recall_concept` | 指出所需概念、公式适用条件 | 作答中 | `concept_seen` |
| A2 | `next_step_hint` | 给一个方向或下一步，不给最终答案 | 作答中 | `hint_seen`，降低独立性 |
| A3 | `check_work` | 检查当前步骤并定位第一处可确认错误 | 有草稿/手写过程 | `guided_seen` |
| A4 | `explain_differently` | 换一种语言、表示法或直观方式解释 | 已有讲解后 | `explanation_seen` |
| A5 | `show_related_example` | 展示不同数值或不同结构的已审核例题 | 卡点持续时 | `example_seen` |
| A6 | `show_full_solution` | 展示当前题完整解析和答案 | 提交后或明确确认 | `answer_seen`，本题不再是独立测量 |
| A7 | `learn_prerequisite` | 暂停当前路径，补前置知识并返回 | 确认前置缺口后 | 单独教学活动 |

学生还可以随时使用不改变该阶梯的通用动作：上传图片/手写答案、询问局部问题、举报题目或判断、稍后学习、关闭主动建议。

### 3.1 防止答案泄露

- Orchestrator 根据会话类型、题目状态和既有曝光计算 `maxAllowedLevel`；
- 模型只能在服务端提供的层级、题目版本和允许字段中生成内容；
- 学生连续请求“再提示一点”时逐级提升并记录曝光，不一次跳到完整解析；
- `show_full_solution` 在未提交题上要求明确确认，并标记本题不再作为独立掌握证据；
- 正式模考只允许无解题信息的界面帮助、术语澄清和技术支持。

## 4. Learning Assistance Orchestrator

该服务是版本化、可审计的应用编排层，不属于 LLM Router，也不直接计算掌握度。

### 4.1 输入

- 当前用户和授权 Scope；
- channel：`practice | agent | attachment | plugin`；
- 当前 `roundId/questionId` 或可信附件分析引用；
- 作答阶段、草稿/已提交状态和当前会话模式；
- 已有 `AssistanceExposure`；
- 当前知识点状态、错误模式和置信度；
- 可用教学资产、语言、无障碍和讲解偏好；
- 权益、额度和组织策略。

### 4.2 输出

```ts
type LearningAssistanceDecisionV1 = {
  schemaVersion: '1';
  decisionId: string;
  policyVersion: string;
  contextVersion: string;
  availableActions: Array<{
    action: 'clarify_question' | 'recall_concept' | 'next_step_hint' |
      'check_work' | 'explain_differently' | 'show_related_example' |
      'show_full_solution' | 'learn_prerequisite';
    enabled: boolean;
    reasonCode: string;
    estimatedCost?: number;
    confirmationRequired: boolean;
  }>;
  recommendedAction?: string;
  maxAllowedLevel: 'A0' | 'A1' | 'A2' | 'A3' | 'A4' | 'A5' | 'A6' | 'A7';
};
```

执行结果生成版本化 `learning_assistance` Artifact，引用题目、作答、知识点、教学资产、模型请求和曝光记录。刷新、重试和跨端恢复不得重复扣费或重复记曝光。

## 5. 教学资产统一模型

所有主动教学和学生主动辅助共用 `TeachingAsset`，避免 Concept Card、动画、视频和 AI 文案形成互不兼容的数据孤岛。

### 5.1 资产类型

```text
concept_card
worked_example
contrast_example
guided_correction_template
interactive_demo
micro_lesson
retrieval_check
video_lesson          # 后期
```

### 5.2 核心字段

```ts
type TeachingAssetV1 = {
  id: string;
  version: number;
  type: string;
  status: 'draft' | 'review' | 'approved' | 'published' | 'retired';
  subject: 'math' | 'physics' | 'chemistry';
  topicIds: number[];
  prerequisiteTopicIds: number[];
  misconceptionCodes: string[];
  language: 'zh-CN' | 'en' | 'bilingual';
  difficultyBand: string;
  estimatedMinutes: number;
  renderer: 'rich_text' | 'step_sequence' | 'interactive_component' | 'video';
  payloadSchemaVersion: string;
  sourceRefs: Array<{ type: string; id: string; version: string }>;
  reviewState: string;
};
```

资产必须有版本、发布状态、知识点映射、来源、审核和下架能力。AI 可以针对学生生成临时表达层，但不能覆盖已审核核心事实；临时内容必须保留所依据资产版本和模型调用记录。

## 6. 交互动画与视频路线

### 6.1 前期：参数化交互组件

优先使用受控 React/HTML/SVG/Canvas 组件，而不是生成视频：

- 数学：函数参数与图像变化、几何变换、向量关系；
- 物理：受力图、运动过程、波形和电路状态；
- 化学：粒子变化、平衡移动、滴定过程和实验装置。

每个组件使用白名单 `componentKey + version + validated props` 渲染，禁止执行资产中任意脚本。组件输出可记录关键交互和 active prompt 答案，但拖动、播放或浏览本身不算掌握证据。

### 6.2 后期：教学视频

视频沿用同一 `TeachingAsset`：保存封面、时长、字幕、章节、知识点、来源、审核状态和配套 active prompt。模型可定位相关章节或总结已审核字幕，不能把“播放完成”视为掌握。

## 7. 主动干预与主动求助的合流

```text
Learning Intelligence ──> Intervention Policy ──> offer
                                                │
Student request ─────────> Assistance Policy ───┤
                                                ↓
                                      Teaching Asset Resolver
                                                ↓
                                  Delivery + Exposure + Outcome
```

- Intervention 决定是否、何时建议教学以及教学目标；
- Assistance 决定当前请求允许到哪一层帮助；
- Asset Resolver 只从发布且匹配的内容中选择，缺少内容时返回结构化缺口；
- Delivery 保存学生接受、跳过、推迟、开始和完成；
- Exposure 保存实际看到的提示、示例、解析和答案；
- Outcome 只引用后续可靠验证证据，不由模型直接写入。

## 8. Web、Agent 与插件交互

### 8.1 练习页

题目附近只保留轻量的“向 Agent 求助”入口，不展开大型辅助面板。知识回忆、渐进提示和手写检查由常驻 Composer 绑定当前题发起，反馈进入聊天流；需要动画、视频、手写详情或结构化教学时，只切换任务区内容，聊天区始终存在。上传手写过程复用 Composer 附件能力，结果回到当前题而不是创建孤立聊天。

### 8.2 Web Agent

Agent 可解释为什么建议某项辅助、承接追问和展示 Teaching Artifact。服务端必须将对话请求绑定到真实题目/round/附件引用；只有自由知识问答时才进入普通聊天降级。

### 8.3 插件

插件调用同一 Capability Facade，通过 OAuth 所有权验证。首期不传二进制文件；可使用网页深链继续手写上传。插件不得获得比 Web 更高的答案、成绩或内容发布权限。

## 9. Capability 边界

对外稳定能力建议：

- `get_available_assistance`：读取当前允许和推荐的辅助动作，L0；
- `request_learning_assistance`：执行选定辅助并返回 Artifact，A0/A1 可无模型，涉及模型为 L2；
- `get_teaching_asset`：读取当前用户可访问的已发布资产，L0；
- `record_teaching_interaction`：仅供可信 UI API 记录步骤、跳过和 active prompt，不作为模型工具；
- `report_learning_content_issue`：举报题目、讲解、动画或模型判断，L1。

现有 `generate_question_hint` 和 `generate_question_explanation` 保留为底层兼容适配器，不再作为新 UI 的主要产品抽象；它们由 Orchestrator 在权限允许时调用。Agent 不能直接选择 Provider、Prompt、答案开放等级或 Exposure 权重。

## 10. 数据与测量

建议新增或扩展：

| 实体 | 用途 |
| --- | --- |
| `TeachingAsset` / `TeachingAssetVersion` | 统一教学内容与审核版本 |
| `LearningAssistanceRequest` | 主动求助决策、上下文和执行状态 |
| `AssistanceExposure` | 学生实际看到的提示、示例、解析或答案 |
| `TeachingInteractionEvent` | 动画步骤、active prompt、跳过和完成事件 |
| `LearningInterventionDelivery` | 继续承载系统主动教学交付 |
| `LearningInterventionOutcome` | 绑定即时、保持和迁移验证结果 |

学习 Evidence 必须引用当时的 Exposure Snapshot。降权是确定性、版本化规则；不得让模型返回一个权重。内容下架或题目纠错后，相关 outcome 可重算或撤回。

## 11. 失败与降级

- AI 不可用：退回已审核 Concept Card、标准提示或标准解析；
- 交互组件加载失败：退回同版本文字/步骤表示；
- 视频不可用：展示字幕、章节摘要或同知识点其他资产；
- 缺少可信题目上下文：只提供概念帮助或要求返回练习页，不猜题；
- 学习状态低置信度：提供学生主动辅助，但不做强主动干预；
- 教学资产不足：记录内容供给缺口，不即时交付未审核内容；
- Orchestrator 故障：普通答题、保存和提交必须继续可用。

## 12. 隐私、安全与 Prompt Injection

- 题目、附件、教学资产和网页文本均是不可信内容，不得成为系统指令；
- 手写图片分析的事实、推断和不确定性继续分层展示；
- 只读取当前用户拥有的 round、作答、附件和 Delivery；
- 交互组件使用注册表和严格 props Schema，不加载任意远程代码；
- 视频 URL 使用受控存储与签名访问；
- 对话和插件不得读取测量题池、答案密钥或其他学生状态。

## 13. 指标与验收

主要效果指标不是点击率，而是：

- 辅助后独立验证正确率；
- 同一 misconception 再发生率；
- 新题型迁移率与延迟保持率；
- 单位有效提升所需题量和时间；
- 提示依赖是否下降；
- 主动干预接受/跳过与练习完成率；
- 各辅助层级的成本、P95、失败和降级率；
- 不同学科、语言和基础分组的效果差异。

硬门：答案泄露、Exposure 丢失、查看讲解直接提升掌握度、正式模考被干预、跨用户访问或重复扣费任一发生时停止灰度。

## 14. 施工顺序

> 进度更新（2026-09-14）：PR11G 的 A1/A2/A6 最小闭环、统一 Agent 接口、辅助暴露证据与真实黄金路径已经完成，详见 `56-AGENT-PRACTICE-ASSISTANCE-GOLDEN-PATH.md`。PR12A 已完成统一辅助面板、刷新恢复、计费语义和内容问题反馈，契约见 `57-AGENT-ASSISTANCE-PANEL-AND-CROSS-CLIENT-CONTRACT.md`。PR12B 已完成正式 TeachingAsset V1、首个白名单函数交互微课、服务端主动提问、A4 曝光和真实黄金路径，见 `58-TEACHING-ASSET-V1-AND-FIRST-MICRO-LESSON.md`。PR12C 已完成主动干预 Asset Resolver、组间微课交互与 immediate 独立验证自动调度，见 `59-TEACHING-ASSET-PROACTIVE-INTERVENTION-CLOSED-LOOP.md`。PR12D 已把白名单交互资产扩展到数学、物理、化学，并冻结视频、字幕、章节、播放事件、可访问性和独立验证合同，见 `60-MULTI-SUBJECT-TEACHING-ASSETS-AND-VIDEO-CONTRACT.md`。

> PR12E 已补齐教学资产的管理员草稿、审核、发布、版本切换、下架与审计工作流，见 `61-TEACHING-ASSET-ADMIN-PUBLISHING-WORKFLOW.md`。

> PR12F 已补齐教学资产的参与、完成、即时检查、独立新题验证、跨时间稳定性和逐版本运营反馈，且明确禁止把完成率直接当作掌握度，见 `62-TEACHING-ASSET-EFFECTIVENESS-FEEDBACK-LOOP.md`。

> PR12G 已把效果信号转成管理员质量复核队列，支持版本退化识别、人工确认、解决与重新打开，并继续禁止自动下架和自动改写掌握度，见 `63-TEACHING-ASSET-QUALITY-REVIEW-QUEUE.md`。

### PR11G：真实练习闭环中的辅助最小集

- 冻结 `get_available_assistance/request_learning_assistance` v1 DTO；
- 在“今日方案 → 练习 → 作答 → 状态刷新”黄金路径加入 A1、A2 和提交后 A6；
- 写入 Exposure，并验证掌握证据的独立性降权；
- 普通答题在辅助服务关闭或失败时仍可完成。

### PR12A：统一辅助面板与跨端契约

- 上下文辅助 UI、恢复、计费确认和举报；
- Web Agent 绑定 round/question；
- 插件开放只读可用动作与受控请求能力。

### PR12B：首个交互 Micro Lesson

- 先选数学函数作为单知识点试点；
- 发布一个受审核、参数化的交互组件；
- 记录 active prompt，并接独立验证题。

### PR12C：主动推送合流

- 已将已有 Shadow/Delivery 干预接入同一 Asset Resolver；
- 已在 Agent 训练 mini-set 报告间隔展示重复错误触发的微课；
- 已保留冷却、跳过、推迟语义，并在完成后自动建立 immediate 独立验证；
- 完成与 A4 暴露均不直接改变掌握度。

### PR12D：多学科与视频资产

- 已扩展物理、化学白名单交互案例，并复用统一交付、A4 暴露和独立验证链路；
- 已冻结视频、字幕、章节、播放事件、可访问性和配套验证契约；
- 视频 renderer 仍未开放；达到媒体处理、内容审核、性能、播放会话和可访问性门槛后再灰度。

## 15. 非目标

- 当前不建设完整 LMS、直播课或教师排课系统；
- 当前不让模型实时生成并执行任意动画代码；
- 当前不把所有题都配成长视频；
- 当前不允许学生或 Agent 直接调用自动出题内部接口；
- 当前不以“完成教学内容数量”替代真实能力提升。

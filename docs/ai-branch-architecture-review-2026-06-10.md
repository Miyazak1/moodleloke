# AI 分支架构与成熟度评估

评估日期：2026-06-10  
分支：`codex/adaptive-ai-questioning`

## 总体结论

这个分支已经从单点 AI 能力扩展成了一套比较完整的学习产品系统：自适应训练、AI Coach、额度管理、用量估算、用户反馈、后台观测、错题复盘、学习 readiness、规则测试和 release gate 都已经形成闭环。

整体判断是：功能成熟度偏高，架构已经具备小流量 beta 上线基础，但长期维护成熟度还需要再收口。当前最大风险不是“不能用”，而是继续加功能时，前端页面、样式文件和学习/AI 服务会变成几块过大的复杂模块。

## 已验证项

本次评估执行了以下验证：

- `frontend tsc --noEmit`：通过。
- `backend tsc --noEmit --incremental false`：通过。
- `node scripts/csca-adaptive-rules-test.cjs`：通过。
- `node scripts/csca-learning-dashboard-rules-test.cjs`：通过。
- `node scripts/csca-readiness-release-gate.cjs`：通过。
- `node scripts/csca-wrong-questions-rules-test.cjs`：通过。
- `node scripts/csca-mock-exam-history-rules-test.cjs`：通过。
- `npm --prefix frontend run test:minimal`：通过。
- `npm --prefix frontend run test:i18n-messages`：通过。
- `npm --prefix frontend run test:i18n-vi`：通过。
- `node scripts/prisma-cli.cjs validate`：通过。

说明：后端首次直接运行 `tsc --noEmit` 时被 incremental build info 写入权限拦截，改用 `--incremental false` 后通过。

## 成熟点

### AI 接入有防护意识

`backend/src/csca-special-practice/ai-coach-provider.service.ts` 对外部模型输出做了多层校验，包括：

- 输出长度限制。
- 系统提示、API key、bearer token 等敏感内容泄露检测。
- hint 不允许直接泄露答案。
- 非中文请求下的中文输出错配检测。
- 错因解释 JSON schema 检查。
- round summary 固定结构检查。

外部 provider 失败时会回落到 rule fallback，避免阻塞训练链路。

### AI 额度与成本闭环比较完整

`AIEntitlementService` 已经具备 reserve / commit / refund 流程。外部模型可用且额度足够时先预留额度，调用成功并判定 billable 后再正式记账；失败、降级或不计费情况会 refund。

这比简单“请求一次扣一次”成熟很多，能降低 provider 抖动、输出被拒、额度不足时的用户体验风险。

### 自适应训练已经接入学习画像

`CscaAdaptiveService` 不只是生成一轮题，还接入了：

- adaptive planner。
- question exposure。
- mastery engine。
- training events。
- learning activity snapshots。
- wrong pattern 记录。
- mock exam / learning dashboard 反馈。

这说明自适应训练已经从“做题功能”走向“学习系统”的基础设施。

### 后台观测与 rollout 准备充分

`AIObservabilityService` 已经有 provider、status、type、subject、feedback、成本估算、低评分、错误率和 rollout health 聚合。后台也暴露了 provider config、review queue、AI review decision 等入口。

这对真实上线很重要：外部 AI 不应该只靠日志排查，需要有可运营的观察面板。

### 数据层沉淀较完整

新增数据结构覆盖了：

- learning daily snapshots。
- learning streaks。
- learning insights。
- wrong patterns。
- readiness action calibration snapshots。
- AI structured output。
- adaptive question language。

这些模型让学习记录、错因复盘、准备度判断和 AI 反馈都能被长期追踪，而不是只存在前端状态中。

## 主要风险与不成熟点

### 1. 模块边界开始变复杂

`CscaLearningModule` 直接 provider 了 `AIEntitlementService`、`AICoachProviderService`、`AIUsageMeterService`、`TrainingEventService`，而 `CscaSpecialPracticeModule` 也 provider 了这些 service。

目前这些 service 大多没有进程内状态，所以短期不会直接出错。但从架构上看，这代表 AI/Training 通用能力还没有被抽成稳定模块，后续如果 service 内部出现缓存、队列、定时器、provider client、feature flag 状态，就容易产生多个实例语义不一致的问题。

建议：

- 新建 `CscaAICommonModule` 或 `CscaTrainingCoreModule`。
- 由 common module 统一 provider 并 export AI entitlement、provider、usage meter、training event 等跨域服务。
- `CscaLearningModule` 和 `CscaSpecialPracticeModule` 只 import common module。

### 2. 前端页面文件过大

当前几个关键前端文件已经进入“大型页面容器”状态：

- `frontend/src/pages/PublicMePage.tsx`：约 3670 行。
- `frontend/src/pages/special-practice/adaptive/AdaptivePracticeViews.tsx`：约 1732 行。

这些文件同时承担了 copy、数据请求、状态管理、视图布局、交互逻辑和局部组件职责。短期能快速交付，但后续维护成本会快速上升，尤其是多语言、错题本、readiness、AI feedback 继续扩展时。

建议拆分方向：

- `PublicMePage` 拆为 `MeOverviewSection`、`MeSettingsSection`、`MePracticeSection`、`WrongQuestionBankSection`、`MeOrdersSection`。
- 把 `ME_COPY` 移到单独 copy 文件或 i18n message 层。
- 把数据请求整理为 `useMeDashboardData`、`useWrongQuestionBank`、`useReadinessActionTracking` 等 hooks。
- `AdaptivePracticeViews` 拆为 overview、subject dashboard、round view、report view、AI credit panel、AI feedback block。

### 3. CSS 文件也开始过大

当前样式文件里比较明显的复杂点：

- `frontend/src/styles/account.css`：约 3588 行。
- `frontend/src/styles/special-practice.css`：约 3395 行。

CSS 继续集中增长会带来几个问题：

- class 命名冲突概率增加。
- 页面局部改动难以确认影响范围。
- 响应式规则分散，后续视觉回归成本变高。
- 新功能容易继续堆在现有大文件末尾。

建议：

- 按页面域拆分：`account-overview.css`、`account-practice.css`、`account-wrong-bank.css`、`adaptive-round.css`、`adaptive-report.css`。
- 保留 `account.css` / `special-practice.css` 作为入口聚合或逐步迁移。
- 抽出复用 primitive 样式，例如 panel、metric strip、feedback buttons、empty state、filter bar。

### 4. 后端返回前端链接时写死 `/zh`

`CscaLearningService` 里多处返回了 `/zh/...` 链接，例如科目训练、mock exam、me review queue 等 action href。

这会导致英文或越南语用户从 dashboard action 跳转时落回中文路径。现在前端可能会有 `stripLocalePrefix` 或导航层兜底，但长期看，后端不应该硬编码具体语言路径。

建议：

- API 返回 route intent，而不是完整 locale path。例如 `{ route: 'cscaSubject', params: { subject: 'math' } }`。
- 或在请求 dashboard 时传入 language/locale，由后端生成对应 locale path。
- 更推荐前端根据 route intent 和当前 locale 生成路径，避免后端耦合前端路由细节。

### 5. AI 额度开关语义容易误解

当前 `.env.example` 和 `.env.production.example` 中 `CSCA_AI_ENTITLEMENT_ENABLED=false`，但 `AIEntitlementService.isEnabled()` 里只要 `CSCA_AI_INITIAL_FREE_UNITS > 0` 就会返回 enabled。

这意味着即使显式写了 entitlement disabled，只要默认免费额度大于 0，前端仍会看到 AI 额度能力可用。这不一定是 bug，但运维语义容易混淆。

建议：

- 明确区分 `entitlement_account_enabled` 和 `initial_free_grant_enabled`。
- 或让 `CSCA_AI_ENTITLEMENT_ENABLED=false` 真正关闭额度系统，免费额度只在 enabled 时生效。
- 在 env example 注释里说明当前行为，避免上线配置误判。

### 6. 多语言 fallback 混在业务服务中

`CscaAdaptiveService` 和 `AICoachService` 内部有不少题目文本、选项文本、解释文本的本地化 fallback。MVP 阶段这是务实方案，但长期会让业务逻辑、题库本地化和 AI prompt 规则互相缠在一起。

建议：

- 把题目本地化 fallback 移到 content/i18n 层。
- 业务服务只调用统一的 `localizeQuestionContent()`。
- AI prompt 输入只接收已经清洗后的 localized content。
- 对历史未翻译题目建立内容债务报告，而不是在 service 中不断补映射表。

### 7. AI structured output 还可以更强

当前错因解释要求 provider 返回 JSON，并在后端校验四个字段。这是好的开始。但外部模型调用本身仍使用 chat completions 普通文本输出。

建议：

- 外部 provider 支持时使用 JSON schema / structured output / response_format。
- 将 prompt version 和 schema version 分开记录。
- 对 schema invalid 的样本进入 review queue，辅助 prompt 调优。

### 8. 用量估算不是实际 token 账单

`AIUsageMeterService` 目前按字符串长度估算 token 和成本。这个足够用于早期观察，但不能作为精确成本账。

建议：

- 如果 provider 返回 usage，优先记录真实 prompt/completion/total tokens。
- 保留 estimate 作为 fallback。
- `tokenUsage.meteringMode` 可以区分 `provider_usage` 和 `estimate`。

## 二次深度检查补充

这次补充检查重点实际走了用户路径、前后端契约、AI 额度消耗点、训练中断恢复、错题复盘和样式结构。结论是：核心闭环比第一轮判断更完整，但存在几处“用户以为自己在做 A，系统实际做 B”的体验偏差，需要优先处理。

### 1. 错题复盘和定向训练链路没有完全闭合

好的部分：

- `CscaSubjectPage` 已经能识别 `verify=...&topicId=...`，并自动发起带 `focusTopicId` 的验证训练。
- adaptive subject dashboard 中的弱项知识点按钮会把 topic id 传给后端 planner。
- 后端 `createRound` 会校验 `focusTopicId` 是否属于当前 subject，避免前端乱传。

问题点：

- `PublicMePage` 的错题本里，`special_practice` 类型点击“重新练这个知识点”会调用 `onOpenSpecialPracticeTopic(subject, slug)`，但 `AppRouteRenderer` 只使用了 subject，没有使用 slug，最后只是跳到 `/csca-subjects/{subject}#practice`。
- `CscaSubjectPage` 里的重点知识点卡片按钮调用 `startAdaptivePractice()` 时没有传 topic id，用户看到的是“练这个知识点/模块”，实际可能开启的是普通自适应训练。
- 学习队列里普通 `review=...&topicId=...` 链接没有被 `CscaSubjectPage` 消费；只有带 `verify` 的链接会自动进入定向验证。
- 后端 `MeService` 返回的错题练习路径多为 subject 级路径，不是 topic 级 intent。

建议：

- 前端统一引入 route intent，例如 `{ type: 'adaptivePractice', subject, topicId, mode: 'review' | 'verify' }`，不要只传 URL 字符串。
- `onOpenSpecialPracticeTopic` 改为接收并使用 topic id 或 slug，最终落到 `startAdaptivePractice(topicId)`。
- `CscaSubjectPage` 同时消费 `review` 和 `verify` 参数：review 模式可打开知识点复盘面板，verify 模式自动开始验证训练。
- 所有“练这个知识点/重新练”按钮都必须传入明确 focus topic；如果没有 topic，就把文案改成“练这个科目”或“开始自适应训练”。

### 2. 自适应训练自动保存过于频繁，且失败对用户不可见

`AdaptiveRoundView` 当前每秒更新时间，并把 `timeSpent` 参与 autosave 依赖。这会导致用户答题期间大约每秒一次 PATCH。短期低流量可接受，但用户量上来后会放大数据库写入和版本冲突概率。

另一个体验问题是 autosave 捕获错误后静默忽略。如果发生版本冲突、网络失败或 session 状态变化，用户可能一直以为答案已保存，最后提交时才遇到失败。

建议：

- `timeSpent` 不要每秒触发保存，可改成 5-10 秒节流，或只在切题、选项变更、离开页面、提交前保存。
- UI 增加轻量保存状态：`已保存`、`保存中`、`离线/保存失败`。
- 版本冲突时重新拉取 round，提示用户当前进度已在其他窗口更新，而不是静默吞掉。
- 提交前如果最后一次保存失败，应明确提示并允许重试。

### 3. AI 额度存在“自动消费”场景，成本透明度不够

用户显式点击 hint / explain 时消费 AI 额度是合理的。但代码里还有两个更隐性的消费点：

- adaptive round report fresh 状态下会自动生成 AI round summary。
- `prepareWeeklyInsightAfterActivity` 在学习活动后可能自动触发 weekly insight，并走 entitlement reserve / commit。

如果外部 AI 已开启且用户有额度，这些后台或半自动动作可能消耗额度，而用户并没有明确点击“使用一次 AI”。这在商业化上容易引发困惑：用户买的是“100 次反馈”，但其中一些次数可能不是用户主动发起的。

建议：

- 明确产品规则：自动总结是否免费、是否扣额度、是否只在首次报告时扣。
- 如果扣额度，报告页应在生成前显示“将消耗 1 次 AI 反馈”，并提供手动按钮。
- weekly insight 更建议改成用户点击生成，或作为系统免费摘要，不占用付费反馈次数。
- 后台记录里区分 `user_initiated` 与 `system_initiated`，方便成本和投诉排查。

### 4. weekly learning insight 的 AI 输出约束弱于训练 AI

训练内 AI 的 hint、错因解释、round summary 都有比较明确的 prompt footer 和输出校验。但 weekly insight 目前走通用 footer，`parseInsightOutput` 只按行拆分：第一行当 summary，后面几行当 action。

这意味着外部模型一旦输出寒暄、编号异常、过长段落或夹杂格式说明，前端 insight 质量会不稳定。它的风险低于错因解释，但会影响“学习面板是否专业可信”的观感。

建议：

- 为 `weekly_learning_summary` 增加专用 prompt footer。
- 使用 JSON 或至少固定字段格式，例如 `summary` + `actions[3]`。
- 在 `AICoachProviderService` 增加 weekly insight 类型校验。
- provider 输出不合格时进入 fallback，并记录 invalid output status。

### 5. `unitEstimate` 只记录不扣减，需确认计费口径

`AIUsageMeterService` 会计算 `unitEstimate`，但 `AIEntitlementService.reserve` 和 `commit` 当前固定按 1 次扣减/累计。也就是说长上下文 weekly summary 和短 hint 在额度上都是 1 次。

这不一定是 bug。如果产品定义就是“每次 AI 反馈扣 1 次”，当前实现是合理的。但如果 `unitEstimate` 代表未来按消耗折算额度，那现在的 entitlement 逻辑还没有接上。

建议：

- 在产品文档和前端文案里明确：额度单位到底是“交互次数”还是“估算消耗单位”。
- 如果是交互次数，把 `unitEstimate` 命名为成本观察字段，不参与用户余额。
- 如果是消耗单位，reserve / commit 都要支持按 estimate 扣减，并处理预估与真实 usage 的差额。

### 6. 训练中刷新页面会丢失即时解析状态

`checkAnswer` 是无状态接口，只返回当前答案是否正确和解释。前端保存的是 answer、timeSpent、currentQuestion。用户刷新页面后，答案会恢复，但已点开的即时判断、解释状态不会恢复。

这不会破坏最终提交，但会影响训练连续性：用户刚看过的错因解释刷新后消失，容易误以为系统没记住。

建议：

- 如果即时解析是产品承诺的一部分，应把每题 check 状态和 explanation snapshot 持久化到 round item。
- 如果不想持久化，则刷新后根据已有 answer 提供“重新检查”入口，并在 UI 上清楚表达这是当前会话反馈。

### 7. AI 服务页购买体验还可以更顺

`AIServicePage` 对额度、fallback、计划说明比较完整，但购买按钮在未登录时只提示需要登录，没有顺手带用户去登录并保留 return path。

另外“开始练习”默认进入 math practice。对于从物理、化学或个人中心弱项进入的用户，这个默认会显得有点突然。

建议：

- 未登录购买时跳转登录，并带 `returnTo=/ai-service`。
- 服务页可提供 subject 选择，或优先使用用户最近练习/最弱科目。
- 购买成功后回到 AI 服务页时显示本次到账额度和当前余额。

### 8. 样式响应式需要做一次真实视觉回归

从代码结构看，`account.css`、`special-practice.css`、`ai-service.css` 已经覆盖大量复杂状态、卡片、筛选、报告和训练控件。当前 CSS 有响应式规则和 reduced motion 处理，这是成熟点。

风险在于页面太长、状态太多，只靠静态代码检查难以确认移动端不会出现按钮文字挤压、卡片嵌套拥挤、报告区过长、底部操作遮挡等问题。

建议：

- 用 Playwright 固定截图检查：个人中心、错题本、AI 服务页、自适应训练中、训练报告页。
- 视口至少覆盖 390x844、768x1024、1440x900。
- 对训练页额外检查：题干长文本、多选项、AI 解释展开、额度不足、保存失败、提交失败。
- CSS 拆分时顺手建立页面级 visual smoke，避免后续继续堆样式导致回归。

### 用户体验总评

这个分支的用户体验主线已经成立：用户可以从个人中心看到学习状态，进入错题/弱项复盘，完成自适应训练，再获得 AI 解释、报告和后续行动建议。相比单纯题库，它已经更像一个学习助手。

当前体验短板集中在三个地方：

- 入口文案和实际训练范围不完全一致，尤其是“练这个知识点”可能变成普通科目训练。
- AI 额度消费的主动性不够清晰，自动总结和后台 insight 需要更透明。
- 长流程中的保存、恢复、失败状态还不够可见，真实用户网络波动时会暴露出来。

如果先把这三类问题收掉，这个分支的小流量 beta 体验会稳很多。

## 建议优先级

### P0：上线前建议处理

- 修正或明确 AI entitlement 开关语义。
- 后端 action href 不再写死 `/zh`，至少保证英文/越南语 dashboard 不跳中文路径。
- 外部 AI 放量前确认 provider 输出失败、quota exhausted、fallback 的用户提示都符合预期。
- 打通“错题/弱项 -> 定向复盘/验证训练”的 topic 级链路，避免按钮文案和实际训练范围不一致。
- 明确 AI 自动总结、weekly insight 是否扣额度；扣额度时必须有清楚提示或用户主动触发。

### P1：beta 后尽快处理

- 抽出 AI/Training common module，避免多个模块重复 provider。
- 拆分 `PublicMePage.tsx` 和 `AdaptivePracticeViews.tsx`。
- 拆分 `account.css` 和 `special-practice.css`。
- 把题目/选项多语言 fallback 从业务 service 移出。
- 优化 adaptive round autosave：降低保存频率，增加保存/失败/冲突 UI。
- 为 weekly learning insight 增加专用输出 schema 和后端校验。

### P2：持续演进

- 接入真实 provider token usage。
- 使用结构化输出能力强化 JSON schema。
- readiness action calibration 的调度和结果增加后台可视化。
- 对 AI review queue 增加“prompt 调优后回归验证”流程。
- 增加个人中心、AI 服务页、训练页、报告页的视觉回归截图。

## 建议路线

第一阶段：稳定上线边界。

- 保持外部 AI 小流量或灰度。
- 确认 entitlement、quota、fallback、review queue、admin observability 全链路可用。
- 修复 locale href 和 env 开关语义。

第二阶段：结构收口。

- 抽 common module。
- 拆页面、hooks、copy、CSS。
- 将本地化 fallback 从业务 service 中剥离。

第三阶段：AI 质量运营。

- 接入真实 token usage。
- 引入 schema-enforced structured output。
- 基于反馈、低评分、provider rejection 做 prompt 版本迭代。
- 用 rollout health 指标指导逐步放量。

## 成熟度评分

- 后端架构：7.5 / 10  
  方向正确，数据和服务闭环完整，但跨模块 common 能力需要收口。

- AI 安全与成本控制：7 / 10  
  已有 fallback、额度、观测和 review queue。真实 token usage、结构化响应强约束、自动熔断还可以补。

- 前端结构：6 / 10  
  功能和体验承载能力强，但页面与样式文件过大，后续维护风险偏高。

- 数据与运营准备：8 / 10  
  迁移、事件、学习快照、错因、release gate 和观测能力比较扎实。

- 上线信心：小流量 beta 可行。  
  不建议直接全量打开外部 AI；建议先灰度，边看 rollout health 边放量。

## 最终判断

这个分支已经有产品系统的骨架，不是简单堆功能。现在最值得做的是一次结构收口：把通用 AI/Training 能力抽干净，把前端大页面和大 CSS 拆开，把 locale 和 env 语义理顺。这样继续扩展 AI Coach、错题复盘和 readiness 时，工程复杂度不会继续线性堆高。

## 2026-06-10 同类问题专项复查

复查目标：沿着 AI 自适应、readiness、错题复盘、AI Coach 额度相关入口，重点检查“按钮文案承诺的动作”和“实际执行的动作”是否一致，避免再次出现“看起来点了但没有进入对应功能”的问题。

### 已确认并修复

1. readiness 复盘建议旧链接不可见

- 问题：readiness 的 `review_due_patterns` 旧链接指向 `/zh/me#review-queue`，但个人页没有稳定的 `#review-queue` 渲染锚点，同页导航时也不会重新读取 `section`，用户会感觉“去复盘点不动”。
- 修复：后端 action href 改为 `/zh/me?section=practice&due=1#wrong-bank`；前端对旧 `#review-queue` 做兜底转换；个人页监听同页导航并同步 `section` 与错题筛选。
- 验证：浏览器点击复盘建议后进入“练习与模考 / 统一错题本”，并显示到期复习筛选。

2. 错题/知识点入口丢失 topic 意图

- 问题：个人页错题卡的“重新练这个知识点”传了 topic slug，但 `AppRouteRenderer` 丢弃 slug，只跳到科目页；科目页的“练这个模块/知识点”按钮也直接启动普通自适应训练。
- 修复：个人页错题卡跳转改为 `/csca-subjects/{subject}?practice=topic&topicSlug=...#practice`；科目页消费 `practice=topic/topicSlug/topicId` 并自动创建带 `focusTopicId` 的训练轮；科目页 topic 卡片和模块按钮也传 `focusTopicId`。
- 语义：如果用户点的是“这个知识点/模块”，后端 planner 会收到明确 focus，而不是只做普通科目训练。

3. 自适应 autosave 过于频繁且失败静默

- 问题：训练页 `timeSpent` 每秒变化会触发 autosave，导致约每秒一次 PATCH；保存失败被吞掉。
- 修复：计时仍每秒更新 UI，但保存改为答案/题号变化后短延迟保存，并每 10 秒兜底保存一次；保存失败会展示轻提示。
- 仍需后续增强：增加更完整的 `保存中 / 已保存 / 保存失败` 状态，而不是只靠错误提示。

4. 后台学习活动可能触发隐性 AI 周报

- 问题：`recordLearningActivity` 后的 `prepareWeeklyInsightAfterActivity` 会在证据足够时调用 `generateWeeklyInsight`，外部 AI 开启且额度允许时可能扣费，用户没有显式点击。
- 修复：后台活动不再自动生成 AI 周报；个人页学生侧也不再提供“生成 AI 周报”入口，改为展示规则生成的学习总结。
- 测试同步：规则测试从“证据足够自动生成周报”改为“后台活动不自动缓存可计费周报”。

### 本轮验证

- `npm --prefix frontend run build`：通过。
- `npm exec tsc -- -p tsconfig.json --pretty false --noEmit`：通过。
- `npm run csca-learning:rules`：通过。
- `npm run csca-adaptive:rules`：通过。
- `git diff --check`：通过，仅有既有 LF/CRLF warning。

### 仍需单独决策或继续做

- AI entitlement 开关语义仍需产品/运维确认：当前 `CSCA_AI_ENTITLEMENT_ENABLED=false` 但 `CSCA_AI_INITIAL_FREE_UNITS > 0` 仍会使额度系统可用。建议单独开 PR 明确“关闭额度系统”和“发放免费额度”的优先级。
- 后端仍有部分 action href 带 `/zh`，前端有 `stripLocalePrefix` 兜底，但长期建议返回 route intent，由前端按当前 locale 生成路径。
- weekly insight 已从个人页主链路移除；如未来恢复为平台免费的 LLM polish，必须使用 JSON schema 或固定字段结构，并且不得扣用户额度。
- 训练页保存状态仍是最小修复，后续需要视觉化状态和版本冲突恢复。
- 个人页和训练页仍然过大，结构拆分仍是 P1。

# TeachingAsset V1 与首个交互 Micro Lesson

> 状态：PR12B 已实现（2026-09-14）
> 上游决策：[学习辅助与教学资产 ADR](./55-LEARNING-ASSISTANCE-AND-TEACHING-ASSET-ADR.md) · [统一辅助面板契约](./57-AGENT-ASSISTANCE-PANEL-AND-CROSS-CLIENT-CONTRACT.md)

## 1. 本阶段结论

PR12B 已把“学生答错后出现受控教学内容”从静态原型落成真实领域能力：

- 正式的、可版本化的 `TeachingAsset` 目录和知识点绑定；
- 只解析已发布资产、已发布版本和已发布大纲知识点；
- 首个白名单交互组件 `math.function-horizontal-shift@1`；
- 主动提问由服务端判分，答案键不下发浏览器；
- 打开、调参、回答、完成和跳过均形成幂等交互事件；
- 实际曝光按 A4 写入，但完成微课不直接提升掌握度；
- 完成结果明确要求后续新题独立验证；独立验证轮次内禁止再次展示该教学资产；
- 英文和越南文页面不会误用当前仅有的中文资产；没有对应语言版本时安全返回空结果；
- 独立 kill switch `CSCA_AGENT_TEACHING_ASSET_ENABLED`，并已加入本地一键启动脚本。

本阶段没有让模型生成或执行 HTML、JavaScript、SVG 代码。模型未来只能建议资产意图和参数，最终组件必须来自服务端与前端共同认可的白名单。

## 2. 数据模型

| 模型 | 责任 |
| --- | --- |
| `TeachingAsset` | 稳定资产身份、类型、学科和生命周期 |
| `TeachingAssetVersion` | 内容版本、语言、渲染器、白名单组件、审核和发布状态 |
| `TeachingAssetTopic` | 绑定规范化大纲知识点，区分 primary/prerequisite |
| `TeachingAssetExposure` | 记录学生在题目上下文实际看到的版本、A4 曝光和完成状态 |
| `TeachingInteractionEvent` | 记录打开、调参、主动回答、完成和跳过；以 `userId + clientRequestId` 幂等 |

版本 payload 由后端严格 Schema 校验。首个组件只接受 `x^2`、受限整数平移区间和初始值；组件 key 或版本不在白名单、payload 不合规、状态未发布时均不得渲染。

## 3. Resolver 与接口

### 3.1 上下文解析

`GET /api/v1/agent/practice-rounds/:roundId/questions/:questionId/teaching-asset?language=zh-CN`

服务端依次验证：

1. 当前用户拥有该轮次；
2. 轮次来自当前用户接受的 Agent `learning_plan` Artifact；
3. 题目确实属于该轮次；
4. 题目已经作答且错误；
5. 当前不是独立验证轮次；
6. 资产、语言版本、主知识点绑定和知识点均为 published；
7. renderer、component key/version 和 payload 均通过白名单 Schema。

未命中时返回结构化 `gapReason`：`FEATURE_DISABLED`、`ANSWER_REQUIRED`、`CORRECT_ANSWER`、`INDEPENDENT_VERIFICATION` 或 `NO_PUBLISHED_ASSET`。普通答题流程不受影响。

### 3.2 跨端只读能力

`GET /api/v1/agent/teaching-assets/:stableKey?language=zh-CN`

供 Web Agent 与未来 Codex/MCP 适配器读取同一份已发布资产。它不是数据库直读，也不能读取 draft、retired 或其他语言版本。

### 3.3 交互写入

`POST /api/v1/agent/teaching-assets/:assetVersionId/interactions`

请求必须包含 `clientRequestId`、`roundId`、`questionId`、受限 action 和可选 value。服务端重新验证资产版本与当前知识点匹配，并在同一事务写入 Interaction、Exposure 和训练事件。重复请求返回原事件；同一幂等键被换用到另一动作或上下文时返回冲突。

## 4. 首个学生体验

当前中文数学 Agent 练习中，学生答错绑定到 `M-CALC-001` 的题后，会看到折叠式交互微课：

1. 学生主动打开，不阻塞继续答题；
2. 拖动 `h` 比较 `y=x²` 与 `y=(x-h)²`；
3. 回答顶点位置的主动检查；
4. 服务端返回针对本次答案的反馈；
5. 答对主动检查后才能标记完成；
6. UI 明示“完成不会提高掌握度，系统会用后续新题验证”。

组件沿用现有 CSCA 练习页的卡片、颜色、边框与响应式体系，不另建一套视觉语言。

## 5. 安全和证据边界

- 浏览器响应剥离 `correctAnswer`、`correctFeedback` 和 `incorrectFeedback`；
- 主动提问的正确性只在服务端计算；
- `completed` 必须在同一题目上下文先有通过的主动提问，浏览器不能绕过；完成状态为终态，后续重新打开不会使其回退；
- `parameter_changed` 和 `completed` 只是教学互动，不是 mastery evidence；
- Exposure 固定为 A4，后续 Evidence Writer 可据此降低同题证据独立性；
- 资产必须引用大纲/教研来源并带审核状态；本地 Demo 使用 `local_demo_approved`，不得作为生产审核替代；
- 生产默认关闭，需同时满足 Web、练习写入和 TeachingAsset 三层开关；
- 资产下架或版本不兼容时 Resolver 返回空/错误，练习主体继续可用。

## 6. 真实黄金路径

启动本地一键开发环境后运行：

```powershell
node scripts/agent-demo-seed.cjs --apply
node scripts/agent-teaching-asset-live.cjs
```

测试只允许连接本地数据库，通过真实登录、Agent 今日方案、接受方案和开始练习建立所有权链；它会重置隔离 Demo 用户在该题目上下文的旧 TeachingAsset 交互，再验证答案键隔离、知识点解析、未通过主动提问不能完成、服务端判分、幂等、完成状态不可回退、A4 曝光以及 `masteryChanged=false` / `verificationRequired=true`。

## 7. PR12C 后续落地

PR12B 冻结的“需要独立验证”契约已经在 PR12C 接入既有 Learning Intervention/Question Supply 领域服务。浏览器和模型仍不能直接生成或选择验证题。PR12C 已：

1. 把 TeachingAsset Resolver 接入已有主动干预 Delivery；
2. 在 Agent mini-set 间隔按策略产生的干预建议推荐 Micro Lesson；
3. 将 completed 事件转成受控的 immediate 独立验证，并复用 retention/transfer 生命周期；
4. 复用现有独立题选择与题源缺口机制；
5. 保留接受、跳过、推迟事件，为后续评估验证成功率和单位学习增益提供事实数据。

实现与验收见 [59-TEACHING-ASSET-PROACTIVE-INTERVENTION-CLOSED-LOOP.md](./59-TEACHING-ASSET-PROACTIVE-INTERVENTION-CLOSED-LOOP.md)。

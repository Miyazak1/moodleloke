# PR11C：Agent 固定评测与本地 Demo Gate

## 1. 目标

为 API Agent 建立可重复、可阻断回归的离线评测，并准备一条显式启用的本地真实接口黄金路径。普通测试默认不调用模型 API；只有操作者使用 `--live` 才可能产生模型调用和费用。

## 2. 离线固定评测

数据集：`backend/scripts/fixtures/agent-intent-eval-v1.json`

命令：

```powershell
cd E:\CODE\CSCALITE\backend
npm run build
npm run eval:agent:fixed
```

聚合验收命令：

```powershell
npm run verify:agent:pr11c
```

固定门槛：

| 指标 | 门槛 |
| --- | ---: |
| 常规意图准确率 | `>= 95%` |
| 提示注入安全通过率 | `100%` |
| Provider/Schema/事实 key 回退 | `100%` |
| 规则路由 P95 | `<= 10ms` |
| 每段 Provider 最大尝试 | `1` |
| 路由加事实编排单轮最大输出预算 | `400 tokens` |

2026-09-14 当前结果：

- 常规意图 `47/47`；
- 提示注入 `6/6`；
- 合约与回退检查 `7/7`；
- 本次规则路由 P95 约 `0.11ms`；
- Verdict：`pass`。

这个结果只证明固定集和协议边界通过，不等于真实 Provider 的自然语言质量已经验收。

## 3. 覆盖范围

- 中文与英文的今日方案、学习状态、错题、模考、真题、能力帮助和越界请求；
- 多轮历史是否进入受限 Router 上下文；
- 提示注入、额外工具字段和未知事实 key 是否被拒绝；
- Provider 不可用是否退回确定性规则；
- 空学习证据、空错题、空模考和空真题是否返回诚实空状态；
- Conversation 读取和用户学习数据是否带 `userId` 约束；
- 查询路由是否只调用对应只读 Capability，且不创建计划 Artifact；
- Provider 尝试次数与 token 上限是否保持在预算内。

## 4. 本地黄金路径 Gate

先用 `start-cscalite-dev.bat` 启动正式本地环境，再执行：

```powershell
cd E:\CODE\CSCALITE
node scripts\agent-demo-gate.cjs
```

默认只检查后端健康和 `/zh/agent` 前端入口，不登录、不写数据、不调用模型。

完整真实接口验收必须显式执行：

```powershell
node scripts\agent-demo-gate.cjs --live
```

Live Gate 优先使用 `.local/agent-demo-credentials.json` 中的隔离演示账号，文件不存在时才回退到显式环境变量或管理员 bootstrap 凭据。它创建一个带时间戳的 Agent 对话，顺序验证学习状态、错题、模考、真题、能力帮助和提示注入。除了 Run、工具和消息落库，它还要求四类查询回答包含可验证的演示证据，空状态不能冒充 Demo 通过。它不会调用自动出题或修改学习掌握度，但会调用已配置的 LLM Router/Grounded Response，产生少量 API 费用。

## 5. 当前验收状态

- 离线固定门：通过；
- 后端编译和既有 Agent/Capability 回归：通过；
- Live Gate 脚本：已完成；
- 2026-09-14 已完成真实 Provider 五轮连续彩排：`30/30` Run 完成、`20/20` 工具调用完成、`50/50` 模型网关调用成功；
- 隔离数据、实测延迟、费用和复现方式见 [52-AGENT-LIVE-DEMO-REHEARSAL.md](./52-AGENT-LIVE-DEMO-REHEARSAL.md)。

## 6. 下一阶段

PR11D 已完成 API 级真实接口和模型彩排。下一步是浏览器级黄金路径 E2E：从登录后的 `/zh/agent` 真实操作 Composer，验证流式状态、会话恢复、错误反馈、附件分析与窄屏布局；任何真实模型表现偏差回写固定集后再调整 Router，而不是放宽工具权限。

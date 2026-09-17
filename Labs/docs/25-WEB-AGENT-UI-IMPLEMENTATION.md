# Web Agent 学习工作台 UI 实施记录

> 状态：PR 5 Web UI implemented, feature off by default
>
> 更新时间：2026-09-13
>
> 依赖：[Web Agent Runtime](./24-WEB-AGENT-RUNTIME-TODAY-PLAN-IMPLEMENTATION.md) · [产品规格](./01-PRODUCT-SPEC.md) · [首条垂直切片](./18-FIRST-VERTICAL-SLICE.md)

> [!IMPORTANT]
> 本文记录的是 PR 5 的早期实施状态。后续产品决策已由 [Agent 单一学习旅程与对话式教学干预 ADR](./80-AGENT-LEARNING-JOURNEY-AND-CONVERSATIONAL-TEACHING-ADR.md) 更新：面向学生的“新建会话 + 最近会话”将迁移为单一学习旅程导航；底层会话对象继续用于恢复、审计和上下文隔离。

## 1. 产品与设计结论

本阶段把 `/agent` 接入生产前端，完成第一条 Today Plan 的学生端闭环。`Labs` 静态原型只提供信息架构参考，不是视觉或交互规范。

视觉源事实按以下优先级执行：

1. 当前 CSCAPilot 首页与公共页设计系统；
2. 站点现有 Header、随机用户头像、语言切换、导航和响应式断点；
3. 已有科目训练、模考、错题和账户页面的真实深链与状态；
4. Labs 原型中的会话、方案 Artifact、学习上下文三段结构。

因此页面不是通用 ChatGPT 克隆，而是 CSCAPilot 的学习工作台：浅色科学网格作为背景，蓝色承担主行动，薄荷绿表示可信反馈，荧光绿和珊瑚色只作有限强调；卡片、按钮、圆角、描边、头像和排版继续使用站点既有语言。

## 2. 页面结构

桌面端使用三栏：

- 左栏：新建会话、最近会话、只读边界说明；
- 中栏：消息、Run 状态、Today Plan Artifact、Composer；
- 右栏：当前首选任务和事实来源。

移动端不是机械缩放三栏：

- 会话历史压成可横向滚动的顶部轨道；
- 学习上下文栏隐藏，关键依据保留在方案卡内；
- 消息区独立滚动，Composer 始终留在剩余视口内；
- 方案指标改成两列，主操作改为整行按钮；
- 工作区高度由真实 Header 占用后的剩余空间决定，不假定固定导航高度。

## 3. 真实功能闭环

当前 UI 只连接已经落地的后端能力：

```text
登录用户
  -> 读取会话历史
  -> 提交“我今天该学什么？”
  -> 创建幂等 message/run
  -> 订阅可恢复 SSE
  -> 显示持久化 assistant message
  -> 渲染 learning_plan Artifact
  -> 通过受约束写能力创建 Round，并在 Agent 类型化工作区内完成
```

页面刷新后会读取最近 Run。若 Run 仍未结束，则重新订阅事件流。断线重连同时传递 `Last-Event-ID` 和 `?after=`，避免重放已消费进度；达到终态后重新查询会话与 Artifact，SSE 文本不充当最终业务结果。

题源不足时保留方案和理由，但主操作显示“题源暂不足”且不可点击。UI 不绕过后端库存判断，也不调用自动出题。

## 4. 诚实能力边界

本阶段明确不伪装以下能力已经完成：

- Composer 附件按钮以禁用状态展示，文档、图片、OCR 和手写答案分析留到附件 Worker 阶段；
- 不在前端计算或写入 Mastery、Gap、Prescription；
- 只允许从有效的系统 Prescription 创建现有自适应练习；不修改目标或触发自动出题；
- 不用虚构成绩、进度或能力雷达填充空状态；
- 大模型尚未参与 Today Plan 决策。

## 5. Feature Flags

入口需要前后端同时开启：

```text
VITE_AGENT_WEB_ENABLED=true
AGENT_WEB_ENABLED=true
CSCA_AGENT_PRACTICE_WRITE_ENABLED=true
```

两个开关均默认关闭。前端关闭时不在主导航展示 Agent；即使直接访问 `/agent`，也只显示内测说明。后端关闭时继续拒绝创建会话和 Run。这样可以独立部署静态资源而不意外开放未准备好的能力。

## 6. 实现位置

- 页面：`frontend/src/pages/AgentPage.tsx`
- 页面样式：`frontend/src/styles/agent.css`
- API 与 SSE：`frontend/src/lib/api-agent.ts`
- 前端开关：`frontend/src/lib/agent-feature.ts`
- 路由接入：`frontend/src/lib/routes.ts`、`frontend/src/components/AppRouteRenderer.tsx`
- 导航接入：`frontend/src/lib/app-nav-items.ts`
- 页面壳：`frontend/src/App.tsx`、`frontend/src/styles/layout.css`
- 三语文案：`frontend/src/i18n/messages/{zh-CN,en,vi}.ts`
- 浏览器测试：`frontend/e2e/agent-runtime.spec.ts`

## 7. 验证

```bash
cd frontend
npm run build
npm run test:minimal
npm run test:css-architecture
npm run test:e2e:agent -- --workers=1
```

Agent 浏览器测试在独立配置中强制开启前端 flag，并用稳定 fixture 模拟已登录用户、对话、Artifact 和终态 Run。桌面与手机项目共同检查：

- 关键内容和真实深链存在；
- 页面无水平溢出；
- 历史、方案按钮、Composer 和禁用附件入口可访问；
- Composer 完整位于当前视口内；
- 随机用户头像复用现有 `UserAvatar`。

## 8. 下一阶段

练习写闭环已在 `26-AGENT-PRACTICE-CLOSED-LOOP-IMPLEMENTATION.md` 落地。后续阶段：

1. 完成 review/verification 任务的结构化闭环和 Outcome 结算；
2. 接入附件上传、异步解析、OCR 与多模态分析；
3. 最后让 API 大模型承担解释、归纳和受约束意图识别，不覆盖结构化学习决策。

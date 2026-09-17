# PR12L：当前题手写引导纠错浏览器黄金路径

## 1. 目标

验证 PR12K 不只通过服务层测试，而能在真实浏览器、真实数据库和真实多模态 Provider 下完成以下闭环：

`今日方案 → Agent 创建练习 → 当前题上传手写图片 → A3 引导纠错 → 刷新恢复 → 正式作答提交 → Agent 结算`

本路径同时冻结一条安全边界：手写过程检查是学习辅助，不是正式作答证据，不能直接修改成绩或知识点掌握度。

## 2. 已实现的测试入口

```powershell
cd frontend
npm run test:e2e:agent:handwriting:live
```

配置文件：`frontend/playwright.agent-handwriting-live.config.ts`
用例文件：`frontend/e2e/agent-handwriting-guided-live.spec.ts`

该用例依赖隔离 Demo 账号和 `.local/agent-demo-fixtures/handwritten-function-answer.png`，不使用线上学生数据。

## 3. 覆盖范围

- 真实登录、创建 Agent 会话并请求“我今天学什么”；
- 从学习方案 Artifact 创建真实自适应练习；
- 在当前题上传 PNG 手写作答并调用真实视觉模型；
- 校验返回模式为 `handwritten_solution_review`、深度为 `guided`；
- 校验服务端绑定的 `roundId`、`questionId` 与当前题一致；
- 校验非 `full` 模式不返回完整解法；
- 校验 `masteryMutation=false`；
- 校验 Evidence Candidate 查询为空，且懒加载查询不能绕过该边界；
- 对比检查前后 mastery 快照完全一致；
- 刷新页面后，从会话分析记录恢复已完成的手写反馈；
- 在 390×844 视口校验反馈可见且无横向溢出；
- 获取最新轮次版本后提交正式答案，避免与页面自动保存发生版本竞争；
- 完成练习提交与 Agent settle。

## 4. 本轮真实实测

实测日期：2026-09-14。

| 项目 | 结果 |
|---|---|
| 浏览器测试 | 1/1 通过 |
| Playwright 用例耗时 | 13.7 秒 |
| 测试进程总耗时 | 15.1 秒 |
| Provider / 模型 | DeepSeek / `deepseek-v4-flash-vision-exp` |
| 模型请求延迟 | 10,023 ms |
| Token | 输入 1,413；输出 2,048；合计 3,461 |
| 估算成本 | USD 0.00332508 |
| 手写反馈刷新恢复 | 通过 |
| 移动端横向溢出 | 0 px，门槛 ≤ 2 px |
| 直接掌握度写入 | 无 |
| 正式 Evidence Candidate | 无 |

测试过程中还识别并关闭了三类真实问题：

1. 视觉模型在 4,800 输出预算下可能以 `finishReason=length` 截断 JSON；默认预算提高到 8,000，并允许通过环境变量在 1,200–12,000 范围内调整；
2. 页面刷新后原先只存在于 React 内存中的反馈会丢失；现在按练习轮次保存专用会话 ID，并从服务端分析记录恢复；
3. 虽然自动证据创建已关闭，Evidence Candidate 的 GET 懒创建路径仍可能绕过边界；现在服务端同时检查持久化的 `evidenceCandidateAllowed=false`。

## 5. 发布边界

- `CSCA_ATTACHMENT_ANALYSIS_MAX_TOKENS` 未配置时使用 8,000；提高的是允许输出上限，实际按 Provider 返回量计费；
- 当前结果仍是 A3 学习辅助，不参与正式 mastery 投影；
- 只有学生完成正常选择题提交后，正式答题链路才写入学习证据；
- 独立验证、已提交轮次和未作答时请求完整解法继续由服务端拒绝；
- 生产启用仍应对模型截断率、P95 延迟、单次成本、失败率和刷新恢复失败率设置监控。

## 6. 结论

PR12L 达到本地真实黄金路径退出条件。当前题手写检查已经从“接口可用”推进到“浏览器可演示、状态可恢复、移动端不破版、证据边界不可绕过、正式练习可继续结算”。

# Teaching Asset Registry

## 目标

教学资产是 Agent 可调度的学习能力，不是新的课程页面。学生始终保留聊天上下文；存在做题任务时，教学内容出现在聊天辅助面，主任务状态与答题进度保持不变。

## 当前注册能力

运行时白名单当前包含两组能力：

- 3 个原生 Micro Lesson：`math.function-horizontal-shift@1`、`physics.newton-second-law@1`、`chemistry.acid-base-neutralization@1`；
- 35 个复用现有可视化器的 TeachingAsset 组件，覆盖数学、物理和化学。完整键集合以 `backend/src/agent/teaching-asset-registry.ts` 和 `frontend/src/components/agent/TeachingVisualizerCatalog.tsx` 为准。

组件进入白名单不代表已经生产发布。数据库版本仍必须通过正式知识点绑定、审核、发布和题源验证门。第一批已修正的正式绑定为：

| 正式知识点 | Registry key | 类型 | 展示面 |
| --- | --- | --- | --- |
| `M-FUNC-001` 函数的概念与性质 | `visualizer.math.function-transform@1` | 交互模拟 | assistant |
| `M-FUNC-002` 基本初等函数 | `visualizer.math.elementary-functions@1` | 交互模拟 | assistant |
| `M-INEQ-001` 不等式的基本性质与解法 | `visualizer.math.inequality-solutions@1` | 交互模拟 | assistant |

首个生产验收门只覆盖 `M-FUNC-001`。另两个绑定保留为后续扩展，等待各自题源达到最低容量。

## 契约

- 后端只下发已注册且已发布、已审核、版本匹配的资产；
- 前端只通过 `TeachingAssetRenderer` 查找具体渲染器；
- 未知组件显示可恢复的 fallback，不关闭聊天或当前任务；
- `preservesPrimaryTask = true`；
- `completionChangesMastery = false`，完成教学后必须使用新题独立验证；
- 打开、参数变化、即时问题和完成状态继续写入教学互动事件。

## 扩展新类型

新增动画或视频时，需要同时完成：后端 payload schema、后端 capability registry、前端 renderer registry、管理端审核预览、互动事件策略和契约测试。不得在 AgentPage 内新增按组件名判断的分支。

## 生产门禁

运行 `node scripts/agent-teaching-production-readiness.cjs` 查看只读报告；发布流水线追加 `--strict` 启用失败退出。门禁复用正式独立验证选题器，检查每个目标知识点的发布资产、可用题量以及即时、保持和迁移三阶段供应，不调用自动出题，也不修改数据库。

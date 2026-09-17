# Teaching Asset Registry

## 目标

教学资产是 Agent 可调度的学习能力，不是新的课程页面。学生始终保留聊天上下文；存在做题任务时，教学内容出现在聊天辅助面，主任务状态与答题进度保持不变。

## 当前注册能力

| Registry key | 类型 | 展示面 |
| --- | --- | --- |
| `math.function-horizontal-shift@1` | 交互模拟 | assistant |
| `physics.newton-second-law@1` | 交互模拟 | assistant |
| `chemistry.acid-base-neutralization@1` | 交互模拟 | assistant |

## 契约

- 后端只下发已注册且已发布、已审核、版本匹配的资产；
- 前端只通过 `TeachingAssetRenderer` 查找具体渲染器；
- 未知组件显示可恢复的 fallback，不关闭聊天或当前任务；
- `preservesPrimaryTask = true`；
- `completionChangesMastery = false`，完成教学后必须使用新题独立验证；
- 打开、参数变化、即时问题和完成状态继续写入教学互动事件。

## 扩展新类型

新增动画或视频时，需要同时完成：后端 payload schema、后端 capability registry、前端 renderer registry、管理端审核预览、互动事件策略和契约测试。不得在 AgentPage 内新增按组件名判断的分支。

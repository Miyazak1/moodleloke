# Agent 评估后连续学习契约

状态：已实现（本地 MVP）

## 1. 用户结果

学生完成 Agent 原生模考后，可在报告中的实时学习复盘卡直接选择“生成并查看下一项任务”。系统返回当前对话，生成一张新的 Agent 学习任务卡；学生不需要自行判断该练什么，也不会被导向旧科目训练或模考列表。

## 2. 实现路径

报告按钮提交一个受控的 Agent continuation run：

- 意图：`today_plan`；
- 页面实体：`mock_attempt`；
- 实体 ID：刚完成且属于当前用户的 attempt ID；
- 对话：保留原 Agent conversation；
- 请求：使用独立 `clientRequestId`，沿用消息与 run 的幂等、状态和事件机制。

Runner 收到 `mock_attempt` 上下文后，按顺序执行：

1. 消费待处理学习证据；
2. 读取个人学习档案和考试目标；
3. 读取最新 Target Gap；
4. 读取最新 Prescription；
5. 绑定需要复习的具体错题记录；
6. 对练习任务执行已审核题源预检；
7. 将 Prescription 物化为新的 `learning_plan` Artifact；
8. 在同一对话中发布可执行任务卡。

## 3. 边界

- 按钮不会直接调用自动出题系统。
- 题源不足时仍可生成说明性任务卡，但不会提供不可执行入口；缺口仅进入既有题源恢复流程。
- 未设置目标、证据仍在更新或决策不可用时，不生成可能过期的任务。
- 新任务仍需学生点击任务卡确认开始；生成下一步不等于代替学生接受并开始任务。
- 模考报告本身只提供本次卷面事实，不输出未经校准的成绩预测。

## 4. 验收标准

- continuation 请求必须携带 `mock_attempt` 上下文；
- Runner 必须在读取决策前运行证据投影；
- 新 Artifact 的 `generatedFrom` 必须是 `learning_prescription`；
- 新 Artifact 必须重新执行题源可用性判断；
- Agent URL 返回原 conversation，页面展示新任务卡；
- 全流程不出现主站导航或旧科目训练页面跳转。

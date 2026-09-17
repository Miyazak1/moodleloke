# PR12K：上下文绑定的手写过程引导纠错

> 状态：Implemented
>
> 日期：2026-09-14
>
> 依赖：[附件理解](./10-ATTACHMENT-INGESTION.md) · [学习辅助与教学资产](./55-LEARNING-ASSISTANCE-AND-TEACHING-ASSET-ADR.md)

## 1. 本阶段解决的问题

既有附件链路已经能上传图片、识别手写内容并形成可确认的低权重证据，但通用图片分析不能替代“检查当前题解题过程”。本阶段把学习辅助阶梯中的 A3 `check_work` 接入 Agent 安排的真实练习题：学生在当前题拍照上传草稿，系统读取服务端可信题目上下文，定位第一处可确认问题并给下一步线索。

## 2. 已实现闭环

```text
Agent 安排的练习题
  -> 学生点击“检查手写过程”并上传 PNG/JPEG/WebP
  -> 私有附件存储和文件签名校验
  -> 服务端验证 user / artifact / round / question 归属
  -> 多模态 API 读取可信题目上下文与不可信图片
  -> transcription / observation / inference / uncertainty 分层
  -> 第一处错误 + guided next hint
  -> 记录 A3 辅助曝光和 usedHint
  -> 不直接修改答案、成绩、Evidence 或掌握度
```

前端把入口放在练习页现有“学习辅助”区域。上传会建立私有 Agent 会话用于附件生命周期和恢复，结果按当前 `questionId` 隔离展示。

## 3. 服务端契约

`POST /api/v1/agent/attachments/:attachmentId/analyses` 新增向后兼容字段：

```ts
{
  clientRequestId: string;
  mode: 'handwritten_solution_review';
  roundId: number;
  questionId: number;
  responseDepth: 'hint' | 'guided' | 'full';
  language: 'zh' | 'en' | 'vi';
}
```

普通附件分析未传 `mode` 时继续使用 `general_review`。`roundId` 与 `questionId` 必须同时提供，并且只允许用于手写过程审阅。

结构化结果新增：

- `transcription`：图片中实际识别到的内容；
- `observations`：可直接观察的步骤；
- `inferences`：教学判断；
- `uncertainties`：低置信度数字、符号、上下标、单位等；
- `firstError`：第一处可确认错误；
- `feedback.nextHint / guidedSteps / fullSolution`；
- `questionContextRequired`；
- `questionContext`：只返回非答案型来源元数据；
- `masteryMutation: false`。

## 4. 安全和教学边界

1. 题目正文、选项、讲解和知识点由服务端根据当前用户可访问的轮次解析，客户端不能注入题目正文或答案键。
2. 图片和学生备注始终是不可信证据；其中的提示词、命令、角色或工具请求全部忽略。
3. 默认 `guided`，只定位第一处可确认问题并给分步线索；非 `full` 响应由服务端清空 `fullSolution`。
4. 未提交答案时请求 `full` 返回 `ANSWER_REQUIRED`。
5. `intervention_verification` 独立验证轮次返回 `INDEPENDENT_VERIFICATION_NO_ASSISTANCE`。
6. 已提交轮次不再接受过程检查。
7. 只有答案、没有可信题目且图片中也没有可读原题时，服务端强制 `not_assessable` 并要求补充题目。
8. 上下文绑定的 A3 分析不创建附件 Evidence Candidate；正式学习事实仍由现有答题提交与评分链路生成。
9. 成功检查会记录 `learning_assistance_exposed` 和 `usedHint=true`，防止该题之后被误判为完全独立作答。

## 5. 验证

- 后端 Nest TypeScript 编译通过；
- 前端生产构建通过；
- `agent-attachment-analysis-test.cjs` 覆盖通用模式兼容、上下文快照、A3 候选证据隔离、独立验证阻断、完整解法门和既有多题视觉解析合同。

## 6. 后续阶段

下一阶段应做真实浏览器黄金路径和恢复能力：使用真实演示账号完成“进入 Agent 练习—上传手写图片—获得 guided correction—刷新恢复—提交答案—确认掌握度只来自正式答题”的连续彩排，并补充失败重试、移动端拍照和真实 Provider 指标。

# Agent 原生真题题目定位与引用式分析

状态：PR12N 第四步已实现
范围：公开真题资料、可信源卷、网页 Agent

## 1. 目标

学生在 Agent 内打开真题后，可以选择明确的题号、定位 PDF 页码并请求分析。回答必须绑定已发布真题和现有可信源题记录；没有绑定、来源未启用或使用策略禁止展示时，系统明确显示“索引不可用”，不得从 PDF 标题、模型记忆或客户端文本猜题。

## 2. 数据边界

`PastPaper.sourceDocumentId` 显式指向 `CscaSourceDocument`。绑定由管理员在真题资料后台完成，并满足：

- 资料与源卷科目相同；
- 源卷类型为 `past_paper` 且状态为 `active`；
- `usagePolicy.allowQuestionDisplay` 和 `allowPromptRawText` 未被禁止；
- 删除源卷时绑定置空，公开 PDF 本身不被删除。

一个可信源卷可以服务多个语言或套装中的公开资料记录。Agent 不复制源题正文到新的事实表，`CscaSourceQuestion` 继续作为题号、页码、题干、选项、答案和解析的事实来源。

## 3. 运行链路

```text
公开真题卡片
  -> Agent 真题工作区
  -> GET /api/v1/agent/past-papers/:slug/questions
  -> 选择 sourceQuestionId / 跳转 PDF #page
  -> Composer 提交 pageContext
       entityRef = { type: past_paper, id: slug }
       selectedQuestionId = sourceQuestionId
  -> Agent Runtime 重新校验发布、绑定、来源状态和使用策略
  -> 返回结构化 pastPaperQuestion + pastPaperCitations
  -> 引用卡可重新打开原卷并恢复题目定位
```

客户端的 slug、题目 ID 和页码都只是定位请求，不是事实。服务端只接受属于当前已发布资料所绑定源卷的题目 ID；回答中的页码和题号重新从数据库读取。

## 4. 回答政策

第一版采用确定性引用回答：显示源题题干和选项；只有公开资料标记含答案/解析且源卷策略允许复用时，才展示已入库答案和解析。缺少已核验解析时明确说明不可用，不调用模型补写。

下一步的引导式讲题应建立在本契约之上：模型只接收当前服务端返回的题目事实和允许的辅助层级，产出观察、推理与引用分离的结构化结果；不得绕过“完整解析会影响独立测量资格”的学习辅助政策。

## 5. 后台与发布

真题资料后台新增“可信题目索引”选择器。旧资料迁移后仍可正常阅读和下载，但在完成显式绑定前不会出现可分析题号。生产发布顺序为：

1. 执行迁移 `0095_past_paper_source_binding`；
2. 确认真题源卷处于 active 且允许展示；
3. 在真题资料后台选择同科目源卷并保存；
4. 用学生账号检查题号、页码、引用返回和刷新恢复；
5. 再逐份开放 Agent 引用能力。

## 6. 验收

- 未绑定资料只能阅读 PDF，并显示可信索引缺失原因；
- 绑定错误科目、停用来源或禁止展示的来源不能保存或读取；
- 题号选择会定位原卷 PDF 页码；
- Composer 请求携带结构化题目上下文；
- 服务端拒绝跨资料伪造的 sourceQuestionId；
- 回答保存题号、页码、来源标签和源题 ID，引用卡可恢复定位；
- 真题下载审计、附件私有数据和自动出题生产域保持隔离。

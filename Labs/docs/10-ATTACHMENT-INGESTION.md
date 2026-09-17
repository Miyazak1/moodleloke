# CSCAPilot Agent 文档与图片理解方案

状态：Draft v0.1  
定位：Composer 核心能力，从 `WA-F0` 开始建设并在 `WA-P1` 达到用户发布门槛，不是装饰性上传入口。阶段定义见 [19-ARCHITECTURE-CLOSURE-ADR.md](./19-ARCHITECTURE-CLOSURE-ADR.md)。

## 1. 用户价值

学生最自然的使用方式往往不是描述题目，而是直接上传或粘贴：

- 真题、讲义、作业或笔记 PDF；
- DOCX 学习资料；
- 单题截图、试卷照片、手写过程；
- 含公式、表格、图像和实验装置的页面。

Agent 应能识别内容、回答问题、总结资料、提取题目、分析错误，并把结论引用到原文件的具体页面或图片区域。

附件的首要用途是学习理解与辅导：

1. 上传讲义、真题或笔记，进行总结、问答、知识点梳理和学习建议；
2. 拍摄单题、图表或实验装置，识别题意并分步骤讲解；
3. 拍摄学生手写答案或演算过程，定位第一处错误并给出提示；
4. 对照原题、标准答案或已有解析，分析方法差异和改进方向。

“根据附件自动出题”不是附件默认行为，仅在用户明确提出且自动出题能力另行开放时，通过独立的 Question Generation Capability 执行。

## 2. 产品边界

### WA-F0 支持

- Composer 选择文件、拖放、粘贴截图；
- PDF、DOCX、PNG、JPEG、WebP；
- 数字 PDF 文本与版面提取；
- 扫描 PDF 和图片 OCR；
- 公式、表格、图表和题目结构的尽力识别；
- 多文件随同一条消息提交；
- 对全文或选定附件提问、总结、比较与题目分析；
- 回答提供附件名、页码，条件允许时提供区域引用；
- 上传、扫描、解析、就绪、失败、取消和重试状态；
- 用户删除附件和会话级隐私控制。

### 首版不支持

- 自动把用户附件发布为公开真题；
- 任意 URL 抓取；
- 音频、视频、压缩包和可执行文件；
- 宏、脚本或嵌入对象执行；
- 无限制文件大小、页数或永久知识库；
- 承诺所有手写、复杂公式和低清图片都能完全正确识别。

## 3. 与真题后台的隔离

| 对话附件 | 公共真题资料 |
|---|---|
| 默认私有，属于用户/会话 | 经管理员编辑和发布 |
| 用于当前对话理解 | 用于全站展示与下载 |
| 可按保留策略删除 | 遵守内容运营生命周期 |
| 不自动获得公开 slug | 有公开路由与可见性规则 |
| 不因上传而成为题库来源 | 需专门审核/导入流程 |

未来若允许“提交为资料”，必须创建独立审核工作流，不能直接改变附件可见性。

## 4. Composer 交互

### 4.1 添加入口

- 回形针按钮打开文件选择；
- 桌面端拖放到 Composer；
- 粘贴剪贴板图片；
- 移动端选择相册、相机或文件；
- 入口附近展示支持格式和当前限制。
- 拍照后允许裁切、旋转、调整多图顺序，并在模糊、反光、分辨率过低或题目边缘缺失时先提示重拍。

### 4.2 附件队列

每个附件卡显示缩略图或类型图标、文件名、大小、页数、处理状态、进度，以及取消、删除和失败重试。识别质量不足时显示具体警告，例如“第 3 页较模糊”。附件层必须留在 Composer 布局流内，不能遮挡能力菜单、输入框或学习上下文。

### 4.3 发送规则

- 文件至少完成安全扫描和服务端登记后才能随消息发送；
- 内容仍在解析时，可以创建消息，但 Run 进入有时限的 `waiting_for_attachments`；
- 用户可以先上传再补充问题，此时展示总结、解释、提取题目等快捷任务；
- 删除尚未发送的附件立即取消上传；
- 已随消息发送的附件移除需要明确确认，并保留审计事件。

## 5. 支持格式与限制

限制必须由服务端策略接口返回，前端不得硬编码为最终事实。建议内测起点：

| 类型 | 格式 | 建议初始限制 |
|---|---|---|
| 文档 | PDF、DOCX | 50 MB/文件，最多 200 页 |
| 图片 | PNG、JPEG、WebP | 20 MB/文件，限制解码后像素总量 |
| 单条消息 | 混合附件 | 最多 5 个、总计 100 MB |

最终值根据解析耗时、移动网络、存储和模型成本调整。Nginx/API Gateway 限制必须容纳应用层上限和 multipart 开销；应用层仍要独立校验。

## 6. 上传协议

推荐两阶段上传，避免大文件穿过 Agent 消息接口：

```text
POST /agent/attachments/upload-sessions
  -> 创建私有附件记录和短时上传目标
Client uploads bytes
POST /agent/attachments/{id}/complete
  -> 验证对象、实际大小、hash 和所有权
  -> 启动扫描与解析
GET /agent/attachments/{id}
  -> 状态、进度与 metadata
POST message with attachmentIds[]
  -> 服务端再次验证所有权和状态
```

如果当前部署暂不具备对象存储，可通过受保护的流式端点写入现有持久卷的独立 private namespace；API 契约仍保持两阶段，便于以后迁移。

## 7. 处理流水线

```text
received -> quarantined -> type_and_size_verified
  -> malware_scanned -> normalized
  -> text_layout_extracted
  -> OCR / vision enrichment when needed
  -> chunks_and_citations_created -> ready

any stage -> failed / rejected / cancelled
```

### 7.1 确定性解析优先

- 数字 PDF 先提取文本、页码和坐标；
- DOCX 提取段落、标题、表格和图片关系；
- 不为可靠提取的普通文字重复使用昂贵视觉模型；
- 扫描页、复杂图表和低置信度区域再进入 OCR/视觉理解；
- 保留原始文件，不用 OCR 文本覆盖原始证据。

### 7.2 学科内容增强

- 公式保留 LaTeX/结构化表示及原图区域；
- 表格保留行列关系；
- 图表记录标题、轴、单位、图例和读取置信度；
- 物理/化学装置图保留 crop 供多模态分析；
- 题号、选项、答案区和学生作答尽量分离。

旋转、裁边、透视校正、去噪和对比度增强只产生派生版本。置信度低时告诉用户并建议重新拍摄或指定区域，不得静默猜测。

## 8. 分析与检索

小附件可在上下文预算内加载相关全文、页面图像或区域 crop。大文档按标题、页面、题目和版面块切分，建立会话级私有索引，先检索相关 chunks 再加载证据；多页总结使用分层摘要。

首批分析模式：

- `document_qa`
- `image_question_analysis`
- `handwritten_solution_review`
- `document_summary`
- `question_extraction`
- `document_compare`
- `knowledge_mapping`

所有结论区分“文件明确写出”“OCR/视觉识别”和“模型推断”。

### 8.1 手写答案审阅

手写答案审阅使用独立模式 `handwritten_solution_review`。它至少需要以下一种题目上下文：

- 站内当前题目的可信 `questionId`；
- 同一张照片中同时包含原题和学生答案；
- 一个原题附件加一个或多个答案附件。

如果只有答案、无法可靠确定原题，Agent 应要求补充题目，不能猜测题意后评分。

处理分层：

```text
original image
  -> orientation / crop / quality check
  -> OCR transcription with regions and confidence
  -> formula and diagram reconstruction
  -> compare against trusted question context
  -> step-level reasoning analysis
  -> teaching feedback and next hint
```

结果必须区分：

- `transcription`：系统实际识别到的文字、公式和图形；
- `observations`：可从图片直接观察到的步骤；
- `inferences`：模型对思路和错误原因的判断；
- `uncertainties`：模糊、遮挡、无法辨认或上下文不足；
- `feedback`：第一处关键错误、提示、改进方法和可选完整讲解；
- `citations`：对应图片区域、页码或站内题目版本。

默认采用提示优先：先指出第一处关键问题并给下一步线索，用户要求后再展示完整解法。低置信度数字、符号、正负号、上下标、单位和化学计量数必须标记并请求用户确认，不能静默修正。

独立图片分析只生成辅导结果，不自动提交题目、不自动修改成绩、错题本或掌握度。如果分析绑定正式 PracticeSession，仍必须通过现有答题提交和评分流程才能更新学习记录。

### 8.2 附件分析契约

```ts
type AnalyzeAttachmentsInputV1 = {
  schemaVersion: '1';
  attachmentIds: string[];
  mode:
    | 'document_qa'
    | 'document_summary'
    | 'image_question_analysis'
    | 'handwritten_solution_review'
    | 'question_extraction'
    | 'document_compare'
    | 'knowledge_mapping';
  questionId?: string;
  questionAttachmentIds?: string[];
  userInstruction?: string;
  responseDepth?: 'hint' | 'guided' | 'full';
};
```

服务端根据 `mode` 校验必要上下文，并将 `questionId` 解析为当前用户可访问的不可变题目版本。`responseDepth` 默认 `guided`；它控制教学展开程度，不改变图片事实提取结果。

## 9. 引用模型

```ts
type AttachmentCitation = {
  attachmentId: string;
  attachmentName: string;
  pageNumber?: number;
  chunkId?: string;
  boundingBox?: { x: number; y: number; width: number; height: number };
  quote?: string;
  extractionMethod: 'native_text' | 'ocr' | 'vision' | 'derived';
  confidence?: number;
};
```

点击引用时打开受控预览并定位页面/区域。引用不能使用本地路径、长期公开 URL 或可访问其他用户附件的地址。

## 10. 数据模型

建议新增：

- `AgentAttachment`：所有权、会话、metadata、状态、存储键和保留期；
- `AgentAttachmentPage`：页面、尺寸、提取状态和派生图像引用；
- `AgentAttachmentChunk`：文本、页码、区域、方法、置信度和检索引用；
- `AgentAttachmentAnalysis`：分析类型、输入版本、结果、引用、模型调用和用量；
- `AgentMessageAttachment`：消息与附件的多对多快照关系。

原始字节存入私有文件存储，PostgreSQL 只保存 storage key、hash 和 metadata。

## 11. 额度与成本

- 上传、安全扫描、数字文本提取默认不扣 AI 额度；
- OCR 是否收费根据最终供应商成本决定；
- 多模态分析、长文总结和题目解析属于 CSCAPilot 托管 AI；
- 重复问题可复用提取结果，但新生成结果按现有政策计量；
- 失败或没有有效结果时不得重复扣费；
- 界面在执行前标注可能消耗额度；无限额度仍受文件和并发限制。

## 12. 安全要求

- 私有存储桶或 private namespace，默认无公开读取；
- 扩展名、声明 MIME、实际 MIME、magic bytes 和解码结果交叉验证；
- 恶意软件扫描、隔离区和超时清理；
- 禁止执行宏、JavaScript、嵌入文件和外部关系；
- 解析在低权限、无外网、资源受限的 worker 中执行；
- 限制页数、像素、解压倍率、CPU、内存和处理时长；
- 内容始终是不可信数据，不能改变 Agent policy；
- 每次预览、下载和分析都重新验证所有权；
- 日志不记录完整正文；存储与传输加密。
- 发送给模型的派生图片删除 EXIF、定位、设备等元数据；原图中的敏感 metadata 不进入普通日志或模型请求。

## 13. 状态与错误

状态：`created/uploading/uploaded/scanning/extracting/ready/failed/rejected/cancelled/deleted`。

错误至少包括：不支持格式、超过限制、文件损坏、疑似恶意、解析超时、OCR 失败、内容为空、额度不足、附件越权和附件过期。错误信息给出压缩、拆分、重新拍摄、换格式或重试等下一步，不能只显示通用 400/500。

## 14. 隐私与生命周期

- 默认属于当前用户并绑定创建会话；
- 首版为会话级保存，不自动进入长期资料库；
- 用户可单独删除附件或删除会话；
- 删除先撤销访问，再清理原文件、派生页、chunks 和索引；
- 安全审计只保留 hash、事件和必要 metadata；
- “保存到资料库”未来必须由用户主动选择。

## 15. WA-F0/WA-P1 验收标准

- 选择、拖放和粘贴均可添加支持格式；
- 上传与处理状态真实可见，可取消和重试；
- 数字 PDF、扫描 PDF、DOCX、题目截图均有固定评估集；
- 回答至少引用附件名与页码，支持场景可定位区域；
- 用户 A 无法访问用户 B 的附件；
- 恶意、超限、损坏文件安全拒绝；
- 附件 Prompt Injection 不能改变权限或确认规则；
- 失败不产生不应有的 AI 扣费；
- 删除按策略清理文件、派生内容与索引；
- 手机和桌面 Composer 不遮挡、溢出或误发送。

## 16. 实施顺序

1. 数据模型与策略接口；
2. 私有上传会话、完成确认与状态查询；
3. 安全扫描和解析 worker；
4. PDF/DOCX 原生提取；
5. 图片/扫描 PDF OCR 与视觉增强；
6. Composer 队列、进度、取消和预览；
7. 消息附件引用与 `waiting_for_attachments`；
8. 私有检索、分析工具与引用渲染；
9. 额度、限流、保留与删除；
10. 安全、质量、性能和移动端门禁。

## 17. 技术选型

技术主方案为“本地确定性解析 + 托管模型 API”：Docling 负责数字 PDF/DOCX 原生快速解析，扫描件和复杂文档通过 `DocumentParserProvider` 调用经评估的托管解析端点；PaddleOCR-VL-1.6 与 PP-OCRv6 只作为 `DEMO-V1` 本地参考实现和固定评估基线。题图、手写过程、装置图和图表的语义分析通过现有 AI Gateway 调用 `deepseek-v4-flash-vision-exp`，文本编排继续使用 `deepseek-v4-flash`。现有 AI Gateway 需要增加多模态 message part、asset 权限解析和 provider capability。生产业务服务器不部署 OCR/视觉模型。完整决策、隐私边界、降级与评估门槛见 [11-OCR-MULTIMODAL-ADR.md](./11-OCR-MULTIMODAL-ADR.md)。

## 18. 待确认事项

- `WA-F0` 使用私有持久卷，何时迁移 S3 兼容对象存储；
- Document Parser 主/备 Provider、固定 API 版本、数据驻留与保留策略；本地评估基线的固定 revision、runtime 和参数；
- 视觉 API 的图片裁剪、token、并发和月度预算；
- 初始文件、页数、像素和消息总量限制的压测定稿；
- OCR 是否计入 AI 额度；
- 默认附件保留期限；
- 是否在 `WA-P1` 提供“保存到个人资料库”；
- 手写分析首发科目与质量门槛。

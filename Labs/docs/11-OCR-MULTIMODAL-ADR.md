# ADR-001：OCR 与多模态分析技术选型

状态：Accepted for spike；通过 CSCAPilot 固定评估集后冻结镜像与模型版本  
日期：2026-09-12  
适用范围：网页 Agent 私有 PDF、DOCX 和图片附件

## 1. 决策摘要

采用“本地确定性文档处理 + 托管模型 API”的分层方案。`DEMO-V1` 可用固定开源 OCR 模型做本地评估；`WA-F0` 及生产环境不部署模型推理服务，统一通过 `DocumentParserProvider` 调用受控 API：

```text
NestJS Attachment Orchestrator
  -> ClamAV：隔离与恶意文件扫描
  -> Docling：数字 PDF / DOCX 原生文本与结构快速通道
  -> DocumentParserProvider API：扫描 PDF、图片、复杂版面、公式、表格和图表主解析器
       reference implementation/evaluation baseline: PaddleOCR-VL-1.6 / PP-OCRv6
  -> DeepSeek V4 Flash Vision API：题图、手写步骤、装置图和图表的语义分析
  -> DeepSeek V4 Flash API：结合可引用证据进行工具编排并生成最终回答
```

Document Parser API 负责建立可复用、可定位的文档事实层，DeepSeek Vision API 负责开放式视觉理解和学科推理。PaddleOCR-VL/PP-OCRv6 作为选型评估基线，不构成必须自托管的生产部署要求。Docling 不再作为扫描文档的最高精度主解析器，只负责原生文档快速通道。

文本、视觉和文档 OCR 模型均不在生产业务服务器部署。文本与视觉任务统一通过现有 AI Gateway 调用托管 API：文本任务使用 `deepseek-v4-flash`，视觉任务使用 `deepseek-v4-flash-vision-exp`；文档解析通过独立 `DocumentParserProvider` 契约调用经评估的托管端点。业务代码只依赖 provider capability 和 task policy，不直接绑定供应商；现有模型配置和密钥池继续继承，不覆盖。

## 2. 选型原则

- 生产 Provider 必须提供可固定版本的 API、数据处理条款、区域与保留策略；开源实现用于可重复评估和供应商替换基线；
- 文档原文、OCR 结果和模型推断分层保存，不能相互静默覆盖；
- 每条回答能绑定附件、页码和区域，而不是只返回无来源的自由文本；
- 快速通道避免为数字 PDF 的可靠文本重复产生多模态 API 成本；
- 模型名称只是配置，业务 API、任务状态和引用结构不绑定具体供应商；
- “公开榜单最好”不能替代 CSCAPilot 数学、物理、化学真题评估。

## 3. 为什么不能只用一个多模态模型

通用视觉模型擅长解释“图中表达什么、学生哪一步错、装置如何工作”，但若直接充当所有文档的事实层，会带来：

- 密集页面缩放后小字、上下标和符号丢失；
- 页码、阅读顺序和坐标不稳定；
- 长文档逐页生成的延迟和显存成本过高；
- 同一文件重复提问会重复推理；
- 生成模型可能补全原文中不存在的内容；
- 很难形成可审计的精确引用。

因此先生成稳定的页面、区块、文字、公式和坐标，再把相关 crop 与证据交给通用视觉模型。

## 4. 原生文档快速通道：Docling

独立、仅内网可访问的 Docling 服务负责：

- 数字 PDF 的原生文本、页码、版面和阅读顺序；
- DOCX 标题、段落、列表、表格和图片关系；
- 统一 JSON/Markdown 中间表示；
- 基础 chunk 与坐标生成；
- 判断页面是否需要进入 Document Parser API。

`DEMO-V1` 可使用固定 revision 的本地开源引擎；线上确定性 Docling 服务通过独立的 Agent Queue Redis 排队，不复用当前无持久化 Redis。生产部署不得自动下载或启动 OCR/视觉模型；模型型解析由 `DocumentParserProvider` API 完成。NestJS 始终是附件所有权、任务状态和引用数据的事实来源。

## 5. 文档主解析器：DocumentParserProvider

扫描 PDF、图片及复杂页面默认调用版本化 `DocumentParserProvider`。统一响应必须覆盖文本、版面、公式、表格、图表、页码、区域坐标、置信度和 Provider 版本。PaddleOCR-VL-1.6 是首选评估参考实现，PP-OCRv6 是轻量基线；生产选择必须经过固定评估集、成本、隐私和数据驻留审查，不在 CSCAPilot 业务服务器部署 vLLM/SGLang/FastDeploy 等推理运行时。

触发条件：

- 页面没有可靠 text layer；
- 原生文本覆盖率、阅读顺序或字符质量低于门槛；
- 图片附件包含文字、公式、表格或图表；
- 页面存在旋转、拍照透视、阴影或复杂多栏；
- Docling 结果与页面视觉特征明显冲突。

每页保存模型版本、输入图 hash、预处理参数、区块类型、文本/LaTeX/表格结构、坐标、阅读顺序和置信信息。原生文本与视觉解析结果并存；发生冲突时标记差异，不能直接覆盖。

## 6. 轻量降级与复核：Provider fallback / PP-OCRv6 评估基线

生产降级优先切换第二个托管 Document Parser Provider；`DEMO-V1` 可使用 PP-OCRv6 作为本地降级和复核基线，用于：

- 基础中文/英文 OCR 的低成本路径；
- 简单、清晰、单栏页面的低延迟通道；
- 对主 Parser 的关键数字、题号和短文本进行抽样复核；
- Parser Provider 故障时在演示环境保留基本可用性。

PP-StructureV3 保留为评估候选和确定性复杂版面回退，不再默认进入每个困难页。最终是否保留由固定评估集决定，避免长期维护重复能力。

## 7. 托管多模态推理：DeepSeek Vision API

语义视觉分析使用现有 DeepSeek Gateway 的独立 vision task policy，模型为 `deepseek-v4-flash-vision-exp`。官方 API 支持 OpenAI-compatible Chat Completions 和 Responses 格式，并接受 JPEG、PNG、GIF、WebP 的图片输入。普通文本任务继续使用 `deepseek-v4-flash`。

视觉模型用于：

- 数学、物理、化学题图的理解与推理；
- 学生手写步骤的错误定位；
- 实验装置、受力图、电路图和化学结构的语义解释；
- 图表趋势、变量关系和题目要求分析；
- OCR/公式存在歧义时结合局部图像消歧。

输入时优先发送检索命中的 region crop，而不是整份 PDF，并同时提供 Document Parser 提取的相关文字、公式、坐标和用户问题。演示版使用受控 base64 data URL；生产版可评估短期 Files API `file_id`。不得创建公开附件 URL。严格限制单次图片数量、总像素、调用次数和输出 token；输出必须符合结构化 schema，并分别标注观察、引用和推断。

只有 vision task 才能路由到视觉模型；纯文本模型收到图片会返回 400，因此 Gateway 必须在发送前校验 capability。私有附件发送到供应商前需经过隐私告知、派生图裁剪和最小化处理。

## 8. 建议部署形态

```text
Local demo / Production Web host
  NestJS + PostgreSQL + Redis + private uploads
  ClamAV/demo scanner + Docling + OCR worker
                 |
                 | controlled content parts
                 v
Existing AI Gateway
  text task   -> deepseek-v4-flash API
  vision task -> deepseek-v4-flash-vision-exp API
```

不采购、不维护 GPU 推理服务器。API key 仅存在后端，浏览器不能直连供应商。AI Gateway 负责超时、重试、限流、模型能力校验、用量记录、熔断和降级；供应商故障不得影响网站的非 AI 功能。

## 9. 配置建议

```text
CSCA_ATTACHMENT_DOCUMENT_PARSER=managed_api
CSCA_ATTACHMENT_DOCUMENT_PROVIDER=<reviewed-provider>
CSCA_ATTACHMENT_DOCUMENT_PROVIDER_VERSION=<frozen-version>
CSCA_ATTACHMENT_OCR_FALLBACK_PROVIDER=<reviewed-fallback-provider>
CSCA_ATTACHMENT_LOCAL_REFERENCE_MODEL=PaddlePaddle/PaddleOCR-VL-1.6
CSCA_ATTACHMENT_VISION_PROVIDER=deepseek
CSCA_ATTACHMENT_VISION_MODEL=deepseek-v4-flash-vision-exp
CSCA_ATTACHMENT_VISION_MAX_IMAGES_PER_CALL=6
CSCA_ATTACHMENT_VISION_MAX_CALLS_PER_RUN=3
CSCA_ATTACHMENT_VISION_TIMEOUT_MS=90000
```

生产初始通过 allowlist 和 rollout flag 开启。所有模型配置使用独立 namespace，不修改现有 DeepSeek 文本模型、Google 登录、SMTP、数据库和其他线上环境变量。

## 10. AI Gateway 必要改造

现有 `AiGatewayMessage.content` 仅支持字符串，需增加多模态 content part：

```ts
type AiGatewayContentPart =
  | { type: 'text'; text: string }
  | { type: 'image'; assetId: string; detail?: 'low' | 'high' | 'original' | 'auto' };

type AiGatewayMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string | AiGatewayContentPart[];
};
```

业务层只能提交受控 `assetId`，不能直接注入任意 URL/base64。Gateway/worker 在最后一步解析为内部图片输入，并执行格式、尺寸、数量、所有权和任务类型复核。

Provider config 声明 `text/json/vision` capability；vision task 不得路由到纯文本模型。日志只记录派生图 hash、像素、模型版本和耗时，不记录原图/base64。失败调用遵守现有额度预留与退款语义。

## 11. 安全与隔离

- 原始文件先进入 quarantine，ClamAV 通过后才允许解析；
- worker 使用非 root、只读根文件系统和隔离临时目录；
- OCR worker 默认禁止任意出网；只有 AI Gateway 允许访问白名单供应商域名；
- 限制 CPU、内存、PID、磁盘、页数、像素和处理时间；
- DOCX 外部关系、宏和嵌入对象不执行；
- 所有提取结果通过 schema 校验再写入主库；
- 文档内容始终是不可信数据，不能改变 Agent policy 或调用权限。

## 12. 存储与检索

`WA-F0` 复用现有 `cscalite-uploads` 持久卷的独立私有目录：

```text
/app/uploads/agent-private/original/
/app/uploads/agent-private/derived/
/app/uploads/agent-private/quarantine/
```

公共真题与私有附件不得共用下载路由。`WA-F0` chunks 存 PostgreSQL，按附件、页码、标题、题号和版面类型做词法召回；只有固定评估证明不足时再引入 pgvector。后续迁移 S3 兼容私有对象存储时保持 storage adapter 与 API 契约不变。

## 13. 状态机

```text
uploading -> uploaded -> quarantined -> scanning
  -> extracting_native
  -> document_parse_pending / document_parsing
  -> vision_pending / vision_running
  -> indexing -> ready

any active state -> failed / rejected / cancelled
ready -> deleting -> deleted
```

每个阶段保存 attempt、worker/model version、开始结束时间、错误码和可重试性。

## 14. 质量与性能门槛

- 数字 PDF 成功提取率 ≥ 99%；
- 清晰中英文扫描页字符准确率 ≥ 95%；
- 引用页码正确率 ≥ 99%，不存在的引用为 0；
- 题目截图关键文字、数字和单位准确率 ≥ 95%；
- 公式、表格、图表、手写和装置图分别评分；
- 数学/物理/化学题图语义分析单独计算正确率，不能被 OCR 分数替代；
- worker 崩溃不影响主 API，失败不重复扣费；
- OCR 与远程 API 路径分别记录 P50/P95 延迟、内存、token、成本和失败率。

## 15. 冻结前 Spike

准备至少 180 份页级样本，数学、物理、化学各 60 份，覆盖数字 PDF、中英文扫描、公式、表格、图表、装置图、手机拍照、低清、手写和 Prompt Injection。

比较：

1. Docling 原生快速通道；
2. PP-OCRv6 CPU 基线；
3. PaddleOCR-VL-1.6 主解析；
4. PaddleOCR-VL-1.6 + `deepseek-v4-flash-vision-exp` region crop；
5. 仅 Vision API 读取整页，作为反例基线；
6. PP-StructureV3 与 olmOCR 2 作为文档解析对照候选。

记录字符/公式/表格/阅读顺序准确率、引用、学科回答正确率、拒答质量、耗时、资源占用和失败率。评估通过后冻结模型 revision、容器 digest、runtime 版本和参数；禁止自动跟随 `latest`。

## 16. 明确不选择

- 不让通用 VLM 直接读取并生成整份 PDF 的唯一事实版本；
- 不把每页无条件发送给远程视觉 API；
- 不把 OCR 文本当作百分之百正确的标准答案；
- 不允许浏览器 OCR 结果绕过服务端校验直接写主库；
- 不把用户附件混入公共真题存储和索引；
- 不使用公开 URL 暴露私有附件；
- 不为追求“最新版”自动替换已经冻结的生产模型。

## 17. 官方依据

- [PaddleOCR-VL-1.6 官方说明](https://github.com/PaddlePaddle/PaddleOCR/blob/main/docs/version3.x/algorithm/PaddleOCR-VL/PaddleOCR-VL-1.6.en.md)
- [PaddleOCR-VL-1.6 模型卡](https://huggingface.co/PaddlePaddle/PaddleOCR-VL-1.6)
- [PaddleOCR GitHub 与 Apache 2.0 License](https://github.com/PaddlePaddle/PaddleOCR)
- [DeepSeek Vision API](https://api-docs.deepseek.com/guides/vision/)
- [DeepSeek Models & Pricing](https://api-docs.deepseek.com/quick_start/pricing/)
- [Docling 支持格式](https://docling-project.github.io/docling/usage/supported_formats/)
- [Docling Serve 部署](https://github.com/docling-project/docling/blob/main/docs/usage/api_server/deployment.md)
- [OmniDocBench（CVPR 2025）](https://openaccess.thecvf.com/content/CVPR2025/papers/Ouyang_OmniDocBench_Benchmarking_Diverse_PDF_Document_Parsing_with_Comprehensive_Annotations_CVPR_2025_paper.pdf)

# Moodlelike 自动出题插件架构

> 状态：阶段 1、v1.1、v1.2、v1.3 与 v1.4a 已实现；Provider、部署、候选写入和跨进程任务协议边界已建立
> 日期：2026-09-28
> 适用范围：CSCA 数学、物理、化学题目生产与审核

## 1. 决策

自动出题系统作为 Moodlelike 的可替换题目引擎适配器存在，不直接成为学生做题状态机的一部分。

当前采用“配置切换后重启”的受控热插拔方式：替换或升级适配器不需要修改学生端、训练编排或题库读取接口，但需要重启后端服务。生产环境不加载任意目录中的 JavaScript，也不允许运行时注入未知代码。

这比真正的进程内动态加载更适合当前阶段：部署和回滚足够快，同时能保持依赖、权限、密钥和数据库写入边界可审计。

## 2. 不可破坏的边界

- 学生训练只读取已经通过审核并进入正式题库的题目；
- 插件关闭、阻塞、升级或故障时，学生继续使用已核验题库；
- Provider 密钥不会通过状态接口返回；
- 插件状态接口只允许管理员访问；
- 插件启用不等于允许写入，Provider 和生产 runner 必须同时通过门禁；
- 插件不得直接修改学生会话、作答记录或掌握度状态；
- 生产环境禁止加载任意运行时代码。

## 3. v1 契约

宿主契约版本为 `1`。一个适配器必须提供：

1. 稳定插件 ID、版本和显示名称；
2. 支持的能力列表：`question.generate`、`question.review`、`question.topic-map`；
3. Provider、模型和生产 runner 的无密钥运行状态；
4. 明确的阻塞原因；
5. 是否允许生成结果写入候选题流程。

管理端只读端点：

```text
GET /api/v1/admin/question-engine/plugins/status
```

当前内置适配器 ID：

```text
moodlelike-ai-questioning
```

## 4. 启用门禁

只有以下条件全部成立，`generationWritesEnabled` 才为 `true`：

1. `QUESTION_ENGINE_PLUGIN_ENABLED=true`；
2. `QUESTION_ENGINE_PLUGIN_ID` 命中已注册适配器；
3. `CSCA_AI_QUESTION_GENERATION_ENABLED=true`；
4. Provider 属于受支持列表；
5. 模型和生成密钥已经配置；
6. 自动生产 runner 或 AI questioning scheduler 已显式启用。

任何一项不满足时，状态为 `disabled` 或 `blocked`，学生侧回退始终为 `verified-bank-only`。

## 5. 更新和回滚

更新插件：

1. 在测试环境替换适配器实现；
2. 验证契约版本、只读状态端点和零 Provider 测试；
3. 保持 `QUESTION_ENGINE_PLUGIN_ENABLED=false` 部署；
4. 重启后端并检查插件注册状态；
5. 配置 Provider 后先启用插件宿主，不启用生产 runner；
6. 通过影子生成与人工审核后再开放生产 runner。

紧急回滚只需：

```env
QUESTION_ENGINE_PLUGIN_ENABLED=false
CSCA_SUBJECT_PRACTICE_PRODUCTION_ENABLED=false
CSCA_AI_QUESTIONING_SCHEDULER_ENABLED=false
```

随后重启后端。题库读取和学生训练不受影响。

## 6. 后续阶段

- 已完成 v1.1a：正式 `question.generate` Provider 调用必须通过插件宿主门禁；零 Provider 的本地内存预览与受控影子验证不受影响，也不获得发布授权；
- 已完成 v1.1b：`question.review` 和 `question.topic-map` 已使用各自独立的开关、模型和密钥状态，并收口到同一插件宿主门禁；
- 已完成 v1.2：`/api/v1/ops/ready` 暴露无密钥的 `questionEngine` 就绪状态；错误插件 ID、占位密钥、缺模型、缺 runner 或能力开关不一致都会 fail-closed，并进入生产部署预检；
- 已完成 v1.3：所有自动生成候选在唯一数据库写入边界前统一经过 schema、来源隔离、重复风险和质量门禁；阻塞结果不会创建 `csca_questions` 记录；
- 已完成 v1.4a：签名任务信封、能力/插件版本绑定、载荷摘要、短有效期、常量时间验签和单次 nonce 协议已实现；
- v1.4b：接入隔离 worker/sidecar 传输和共享 Redis nonce claim，完成真正的无主进程重启切换；
- v2：根据运行数据决定是否需要独立插件进程和滚动升级。

在 v1.4b 之前，“热插拔”明确表示快速替换适配器并重启服务，不表示在生产进程中动态执行第三方代码。

## 7. v1.2 部署预检

普通学生站部署必须保持题目生产关闭：

```bash
node scripts/moodlelike-integration-preflight.cjs --env-file=.env
```

独立题目生产部署必须显式使用生产模式：

```bash
node scripts/moodlelike-integration-preflight.cjs --env-file=.env --question-engine-production
```

两种模式都只读取配置，不调用 Provider、不写数据库、不生成候选题。生产模式会检查已注册插件、每项启用能力的 Provider、模型、非占位密钥，以及生成能力所需的 runner。运行中的同一结论可从受保护的 `/api/v1/ops/ready` 响应内读取；`questionEngine.status=blocked` 会使整体就绪状态降级。

## 8. v1.3 候选写入门禁

门禁策略版本为：

```text
question-engine-candidate-write-gate-v1
```

它位于 `csca_questions` 的自动候选 `INSERT` 之前，统一检查：

1. schema：科目、题目、解析、选项、唯一正确答案、知识点与蓝图身份；
2. 来源隔离：外部 Provider 必须带结构化投影证明、原题内容和可逆来源字段必须已移除、投影摘要必须存在；
3. 重复风险：精确/近重复提示、来源相似度和自动泄漏扫描；
4. 质量：确定性错误、失败维度、要求重新生成的审查结论和过低分数。

普通候选只要任一维度阻塞，就返回 `question_engine_candidate_write_blocked:<reason>`，生成任务失败且不会创建候选题记录。门禁通过后，其完整无密钥结论写入 `generation_metadata.candidateWriteGate`，便于后台审计。

`workClass=observation` 且明确 `suppressStudentPublication=true` 的生产影子样本可以把重复和质量失败作为 `observedBlockers` 保存，用于只读证据分析；它仍不能发布。结构错误或来源隔离错误不会因为观察模式而放行。

## 9. v1.4a 签名任务协议

跨进程协议版本：

```text
question-engine-task-v1
```

信封绑定任务 ID、随机 nonce、签发/过期时间、能力、插件 ID/版本/API 版本、规范化载荷 SHA-256、回复受众和签名 key ID，并使用至少 32 字符的独立 HMAC 密钥签名。验签采用常量时间比较，最大 TTL 为 300 秒；载荷篡改、能力错配、插件版本错配、过期任务和 nonce 重放都会 fail-closed。

当前生产执行模式仍固定为：

```env
QUESTION_ENGINE_EXECUTION_MODE=in-process
```

### v1.4b-1 传输安全底座

`sidecar` 只能用于后续联调配置检查。v1.4b-1 已完成双向签名结果信封、带超时和熔断的 HTTP 客户端、幂等任务 ID 请求头，以及 Redis `SET NX PX` 原子 nonce claim。结果载荷篡改、签名错误、响应重放、Redis 不可用和连续传输失败都会 fail-closed，且不会退回进程内 Provider 调用。

在 v1.4b-1 完成时，readiness 仍明确返回 `sidecar_execution_not_wired`，因为客户端尚未接入实际生成/审题/知识点映射调用。

### v1.4b-2 独立 worker 骨架

独立 worker 已作为 `deploy/docker-compose.prod.yml` 中默认不启动的 `question-engine` profile 落地。它以只读文件系统、无 Linux capabilities、`no-new-privileges` 和无宿主端口暴露方式运行，并提供内部 `/health` 与 `/v1/tasks/execute`：

1. 请求先完成协议头、幂等键、插件身份、能力、载荷摘要、时效和 HMAC 验签；
2. 已完成 task ID 优先返回 Redis 缓存结果，同一任务不会重复执行；
3. 新任务使用 Redis 原子 claim，占用失败且尚无缓存时返回 `task_replayed_or_in_progress`；
4. 结果始终通过双向结果信封签名；未接线能力返回签名后的 `capability_not_wired`；
5. worker 或 Redis 故障不会触发进程内 Provider 回退。

因此，v1.4b-2 完成的是隔离执行容器和协议闭环，不代表自动出题能力已经迁移。readiness 继续保持 `sidecar_execution_not_wired`。

### v1.4b-3 三项 Provider 能力路由

生成、审题（含 blind answer review）和知识点映射入口现在会在 sidecar 模式下把结构化输入交给传输适配器；worker 只实例化 AI Gateway、Prompt Builder 和三项 Provider 服务，不启动 Web、Auth、学生运行时或题库写入服务。候选题持久化和 `question-engine-candidate-write-gate-v1` 仍留在宿主。

启用 sidecar 必须同时满足：

```env
QUESTION_ENGINE_EXECUTION_MODE=sidecar
QUESTION_ENGINE_SIDECAR_ACTIVATION_ENABLED=true
QUESTION_ENGINE_WORKER_CAPABILITIES=question.generate,question.review,question.topic-map
```

并且 URL、签名密钥、key ID、Redis nonce store 及每项 Provider 配置全部通过预检。能力未声明时，宿主门禁直接关闭；传输、验签、Redis 或 worker 执行失败会让当前自动出题任务失败，不会回落到宿主进程内 Provider。默认值仍是 `in-process` 且 activation 关闭，所以本阶段不会自动改变现有生产路径。

### v1.4b-4 端到端契约、版本窗口与故障演练

Host → Worker → OpenAI-compatible Provider → Worker → Host 的完整协议链路已有纯本地假 Provider 契约测试，覆盖生成、审核、盲审和知识点映射。测试只返回内存夹具，不连接真实 Provider，不写数据库，也不发布学生题目。

Host 现在通过 `QUESTION_ENGINE_ACCEPTED_WORKER_VERSIONS` 显式声明兼容 Worker 版本。结果信封即使签名正确，只要版本不在列表中也会以 `worker_version_not_accepted` fail-closed。滚动升级时可临时填写逗号分隔的双版本窗口，升级完成后必须收窄为单一版本：

```env
QUESTION_ENGINE_WORKER_VERSION=1.0.0
QUESTION_ENGINE_ACCEPTED_WORKER_VERSIONS=1.0.0
```

自动化故障演练同时覆盖：响应篡改、旧版本 Worker、签名后的任务失败、HTTP 503、超时熔断、结果重放与 Redis 状态存储不可用。任一故障只终止当前自动出题调用，不会回退到 Host 内部 Provider；学生侧继续遵循 `verified-bank-only`。

v1.4b 的代码级协议闭环至此完成。生产仍保持 `in-process`，sidecar 上线前还必须在独立联调环境进行容器、Redis、网络与滚动升级实机演练并留存证据。

### v1.4c 独立联调与滚动升级工具

新增只读 Worker 健康探针，校验 `/health` 返回的协议版本、Worker 身份、兼容版本和能力清单。探针不发送任务，因此不会触发 Provider、候选题写入或发布。新增的 rollout plan 工具只打印基线、打开双版本窗口、升级 Worker、收窄窗口及回滚命令，不执行任何命令或修改 `.env`。

操作步骤、宝塔服务器上的 Compose 命令和失败判定见 `docs/question-engine-sidecar-rehearsal-runbook-2026-09-28.md`。正式学生站仍必须维持 `QUESTION_ENGINE_EXECUTION_MODE=in-process` 和 `QUESTION_ENGINE_SIDECAR_ACTIVATION_ENABLED=false`。

### v1.4d 运行态可观测性与就绪联动

管理后台的 Question Engine 页面现在会读取运行态摘要，展示 Worker 健康状态、探测时间与耗时、协议和版本阻塞项、传输熔断状态、连续失败次数，以及最近一次成功和失败。输出只包含运维元数据，不返回 Sidecar URL、签名密钥、Provider 密钥、任务载荷或题目内容。

Worker 健康探测只在以下两个条件同时成立时启用：

```env
QUESTION_ENGINE_EXECUTION_MODE=sidecar
QUESTION_ENGINE_SIDECAR_ACTIVATION_ENABLED=true
```

探测只向 Worker `/health` 发出 `GET` 请求，默认缓存 5 秒并合并并发请求；它不创建任务、不调用 Provider、不写数据库。可通过 `QUESTION_ENGINE_WORKER_HEALTH_TIMEOUT_MS` 和 `QUESTION_ENGINE_WORKER_HEALTH_CACHE_MS` 调整超时与缓存窗口。

受保护的 `/api/v1/ops/ready` 会在 Sidecar 已实际启用且出现 Worker 不可达、协议/身份/版本/能力不兼容或传输熔断时降级，并返回无密钥 blocker。未启用 Sidecar 时，运行态为 `not_applicable`，不会影响现有 `in-process` 生产路径。公开 `/health` 保持轻量、同步和无内部网络探测，避免外部健康检查放大 Worker 故障。

### v1.4e 可验证的演练证据

新增 `scripts/question-engine-sidecar-evidence.cjs`，把每个滚动升级或回滚阶段的 Worker 探针和可选运行态就绪响应收敛为版本化证据：

```text
question-engine-sidecar-rehearsal-evidence-v1
```

证据生成器核对协议、Worker 身份、精确版本、必需能力、探针 blocker、运行态健康和熔断状态；任一检查失败时输出 `blocked` 并返回非零状态。证据只保留安全摘要和原始输入的 SHA-256，不复制健康 URL、令牌、密钥、任务载荷或题目内容。输出文件使用“只创建、不覆盖”模式，避免误覆盖前一次演练记录。

本工具只验证已经采集的只读 JSON，不执行 Docker 命令、不调用 Provider、不创建任务、不写数据库，也不代表 Sidecar 获准切换。正式步骤与文件权限要求见独立联调 Runbook。

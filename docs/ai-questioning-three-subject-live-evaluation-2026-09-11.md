# 三科自动出题真实观察评估（2026-09-11）

## 执行边界

- 科目：数学、物理、化学。
- 每科 3 次，共 9 次 DeepSeek `deepseek-flash` 真实生成调用。
- 运行方式：`observation` 隔离任务；所有任务均设置 `suppressStudentPublication=true`。
- 硬限制：`max-provider-calls=9`、`max-estimated-cost-usd=0.09`、单次成本预留 `0.01 USD`、连续 2 次失败自动熔断。
- 数据影响：写入 9 个观察任务、9 个生成任务和 9 道非学生端候选题；没有写入学生训练题库。

## 原始运行证据

| 指标 | 结果 |
| --- | ---: |
| 真实调用 | 9 |
| 生成成功 | 9 / 9（100%） |
| 原始自动 `publishable` | 3 / 9（33.3%） |
| 数学 QuestionPlan 遵守 | 1 / 3（33.3%） |
| 总 token | 109,715 |
| 总延迟 | 255,094 ms |
| 平均延迟 | 28,344 ms |
| 估算费用 | 0.02204874 USD |
| 学生端发布违规 | 0 |
| 熔断/成本门禁触发 | 0 / 0 |

生成任务为 `#596`–`#604`，候选题为 `#583`–`#591`。9 个观察任务最终状态均为 `succeeded`，9 道题的 `sourceQuestionId` 均为 `null`。

## 失败分类与修复

### 审核器误判（已修复）

- 数学 `#583`：单根式定义域加坐标点代入被误判为中等公式计算。现在识别为直接函数图像点判断，难度为 basic、计算量为 light。
- 物理 `#584`、`#587`：用端点文字描述的线性 `s-t` 图像被“多条件/图像”规则误升为 medium/heavy。现在识别为直接斜率、方向与速率判断，难度为 basic、计算量为 light。
- 化学 `#585`：容量瓶定容操作导致浓度与 pH 偏差的定性判断被误识别为酸碱定量计算。现在识别为 basic 实验判断、计算量为 none。

修复后使用当前确定性审核器对同一批候选题重放：

| 科目 | 当前审核可通过 | 仍应拒绝 |
| --- | ---: | ---: |
| 数学 | 1 / 3 | 2 / 3 |
| 物理 | 3 / 3 | 0 / 3 |
| 化学 | 3 / 3 | 0 / 3 |
| 合计 | 7 / 9（77.8%） | 2 / 9（22.2%） |

### 真实生成偏离（继续拒绝）

- 数学 `#586`：基础函数计划要求一个直接性质或一个值判断，模型生成了两个点的复合判断；`candidate_plan_math_function_property_evidence_missing` 保持阻断。
- 数学 `#589`：模型引入参数点和解参数步骤，偏离 basic 单性质计划；同一 QuestionPlan 门禁保持阻断。

这些失败不是审核误杀，不能通过放宽门禁解决。数学基础函数提示已强化：点在图像上类型只能每个选项放一个候选坐标，禁止在题干引入两个命名点、参数点或解参数步骤，也禁止把解题教程写进学生题干。

## 本轮机制改进

- 三科真实观察脚本支持 `--plan` 只读预演和 `--per-subject=1..5` 批量执行。
- 真实执行必须显式给出与批次完全相等的 `--max-provider-calls`，并给出正数 `--max-estimated-cost-usd`。
- 每次调用后累计真实网关估算费用；达到预算前停止后续调用。
- 连续失败达到阈值后停止后续调用。
- 输出生成成功率、自动准入率、QuestionPlan 遵守率、token、延迟、费用和学生发布违规数。
- 所有者复核新增只写审核结果模式；该模式不调用模型、不发布学生端，也不错误消耗正式发布单元格容量。
- 所有者复核会重算 QuestionPlan 遵守和失败路线，清除旧策略遗留的失败码。

## QuestionPlan 只读校准进展

本批已有候选题又用于确定性、零模型成本的计划形态校准；这些校准不会接入学生发布门禁：

- 物理基础运动学单元 `#24` 的 4 道候选题全部匹配“直接运动学关系/图像判断”形态（4 / 4）。该模板随后被提升为 `physics_kinematics_basic_relation_v1` 受保护生产模板：全局开关默认关闭，并且即使开启也必须显式把单元 `#24` 加入白名单；其他物理家族仍保持影子审计。
- 化学基础 pH 单元 `#41` 的 4 道历史候选题全部匹配“pH 测量或溶液配制误差方向判断”形态（4 / 4）。该证据随后用于提升 `basic_ph_measurement_preparation_error_v1`；模板默认关闭，并且必须显式白名单 `41` 才会影响生成门禁，仍不允许直接发布学生端。

这一步说明物理、化学本轮 3 / 3 审核通过并非单纯来自放宽规则：候选题同时满足了对应的科目计划形态。物理只提升了已有 4 / 4 证据的基础运动学模板；化学和其他物理家族仍需扩大离线样本覆盖后再决定是否提升。

## 数学基础函数重试闭环修复

真实失败 `#586`、`#589` 暴露出两处会重复浪费调用的反馈链问题，现已在不调用模型的情况下修复：

- 基础函数首次生成要求“一个直接性质或值判断”，但旧重试清单统一要求函数题展示两个关联步骤。现在按 QuestionPlan 的 `targetDifficulty` 分流：basic 重试仍严格保持单函数、单目标，medium/hard 才要求多步关系。
- 候选题的 `questionPlanAdherence.failureCodes` 和 `questionPlanFailureRoute.reasonCodes` 原先没有进入单元重试记忆。现在两类结构失败码都会被汇总，并在最多 10 条的原因预算中优先于通用审核原因，避免最有操作价值的计划偏离被截断。
- 对基础函数的参数推断失败不再被错误翻译成“补充参数约束”，而是明确要求移除参数，回到一个完全显式函数上的直接性质、函数值或单点图像归属判断。
- 基础函数遵守检测现在会分别识别“双命名点复合判断”和“参数点求参”。对 `#586/#589` 做禁止学生发布的本地复核写回后，重试记忆已得到精确码：`candidate_plan_math_basic_function_multiple_named_points_forbidden` 与 `candidate_plan_math_parameter_inference_forbidden`；两题仍保持 `review_failed/regenerate`，没有被放宽准入。
- 生产审计新增 `questionPlanRetryMemory` 只读证据。运行 #1 当前显示 5 个候选中有 2 个结构失败贡献者，失败路线均为 `repair_candidate_rendering`，且没有把 provider/delivery 失败混入计划质量记忆。
- 单元 #13 的画像仍带有 `cognitiveSkill=multi_step_reasoning` 与 `readingLoad=high`，而基础函数 QuestionPlan 要求单目标。提示构建器现在显式解决这一冲突：一个性质规则加一次短选项核对视为完整推理路径，不再因通用画像指令强行追加第二性质、第二命名点、参数或长条件链；`difficultyBand=basic` 与 `calculationLoad=light` 仍保持硬约束。

这使下一次数学验证不仅测试首次提示，也测试真实生产重试能否针对结构失败改变题目骨架，从而提高每次付费调用转化为合格题的概率。

## 下一阶段准入标准

下一次真实调用应优先只验证数学基础函数提示修复，并保持观察隔离。建议在新增授权后执行数学 3 次；通过条件为：

1. DeepSeek 生成成功率 100%。
2. QuestionPlan 遵守率至少 2 / 3，目标 3 / 3。
3. 当前确定性审核 `publishable` 至少 2 / 3。
4. 学生端发布违规为 0。
5. 估算费用不超过显式预算，连续失败熔断正常工作。

在数学达到上述门槛前，不扩大到正式批量发布；物理基础运动学与化学基础 pH 已有受白名单保护的 QuestionPlan，其他题型仍不能只依赖通用 target profile。

## 当前数学运行的无模型验收

无模型验收已经从失效的固定 `math run #156` 迁移为可通过 `--math-run` 指定当前运行；当前恢复数据库使用 `run #1`，对应数学单元为 `#1`–`#17`。预检中的业务质量不足现在作为 `needs_attention` 证据返回，不再让验收脚本异常退出。

- `run #1` 的 17 / 17 个数学单元均达到 `plan_ready`，QuestionPlan 提示契约均通过，缺失必需短语为 0，调度器偏好被拒绝为 0。
- `cell #13` 的基础函数单目标契约可单独执行只读验收：计划模板为 `math_function_property_by_difficulty_v1`，调度家族为 `quadratic_function_properties`，并确认 QuestionPlan 覆盖画像中的 `readingLoad=high` 与 `multi_step_reasoning` 冲突。
- `cell #16/#17` 暴露并修复了模板匹配过宽的问题：标题“基本初等函数”以前先命中较短的“函数”通用模板，导致 `elementary_function_direct_property` / `elementary_function_exp_log_ordering` 调度提示被丢弃。模板选择现在在没有旧种子单元精确匹配时优先最长的标题关键词，因此两个单元都使用 `math_elementary_function_relation_v1`，调度偏好完整进入计划。
- 总体验收当前结论仍为 `needs_attention`：数学本运行已有 5 次生成但自动批准为 0，缺少修复后的新鲜真实门禁样本；观察后端开关关闭，且当前环境无法读取系统进程列表。该结论不会触发 Provider、数据库写入或学生端发布。

只读聚焦命令：

```powershell
node scripts/csca-subject-practice-no-provider-acceptance.cjs --math-basic-function-contract-only --math-basic-function-run=1 --math-basic-function-cell=13 --json
```

当前总体验收命令：

```powershell
node scripts/csca-subject-practice-no-provider-acceptance.cjs --math-run=1 --math-basic-function-run=1 --math-basic-function-cell=13 --json
```

## 当前数学恢复诊断与观察预检

- 校准脚本不再依赖已失效的固定单元 `#338`–`#367`，默认从指定科目和运行读取当前生产单元，并使用中央 QuestionPlan 重新判定候选题。
- 数学运行 `#1` 当前共有 5 个可校准样本，全部来自单元 `#13`；加入“学生题干不得包含解题脚手架”闸门后，中央 QuestionPlan 严格遵守为 1 / 5（20%）。主要失败码为：题干泄露解题步骤 3 次、函数性质证据不足 2 次、参数推断 1 次、基础函数双命名点 1 次、性质堆叠超限 1 次。该下降是历史样本被更准确识别，并非新生成质量退化。
- 恢复诊断现在能读取子进程以非零状态返回的结构化 JSON，不再把业务质量不足误报为脚本崩溃，也不再把结构化失败显示成 `[object Object]`。
- 观察预检把“物理可见性不足”和“数学家族窗口不足”改为本次观察要补齐的证据警告；已有运行中的生产 run 不再被误判为活跃生成任务。当前单元 `#13` 的状态为 `ready_after_observation_only_question_plan_backend_start`，没有待处理队列或任务阻塞。

## 物理基础运动学受保护生产模板

- `physics_kinematics_basic_relation_v1` 只匹配 basic 运动学，当前精确目标为运行 `#2`、单元 `#24`。
- 题目必须描述一个自洽运动情境，只使用一个直接的位移/时间/速度/加速度关系；或者用文字完整描述一段 `s-t` / `v-t` 直线图像。答案目标只能是一个数值、方向、斜率或运动事实，并要求单位或完整图像证据。
- 候选题遵守检查会拒绝缺少运动学关系的通用概念题，以及既没有单位也没有图像证据的题。单位与图像检测已加边界，避免把 JSON 字段 `text` 中的 `xt` 或英文单词中的裸 `s` 误识别成 `x-t` 图像或秒。
- 当前环境精确只读预览结果：计划构建和验证通过，提示词必需短语缺失为 0；默认门禁为 `disabled_shadow`，模拟显式白名单 `24` 时为 `plan_required`。预览没有调用 Provider、没有写数据库、没有发布学生端。

## 化学基础 pH 受保护生产模板

- `basic_ph_measurement_preparation_error_v1` 只匹配 basic 的 pH 测量或溶液配制误差判断，当前精确目标为运行 `#3`、单元 `#41`；该模板额外要求显式白名单，即使其他化学 QuestionPlan 已由全局开关启用也不会自动覆盖该单元。
- 题目必须只有一个可见操作偏差，并展示“操作 → 体积/浓度或 H+/OH- 方向 → pH 偏高、偏低或不变”的因果链；直接 pH 数值计算、酸碱混合、中和链和多个独立操作错误均被禁止。
- 题目指纹固定为 `experiment + comparison + option_judgement`，并区分 `ph_measurement` 与 `solution_preparation` 对象，以及试纸润湿、定容读数、转移/洗涤等操作变化，避免被误判为方程数值题而破坏去重和多样性控制。
- 旧影子分类器对 4 道真实候选题给出 4 / 4 题型匹配；中央 QuestionPlan 严格重放为 3 / 4。候选题 `#591` 因只判断操作规范、没有完整因果方向链而被 `candidate_plan_chemistry_basic_ph_causal_direction_missing` 正确阻断。
- 精确只读预览中，计划验证与提示词契约均通过，缺失必需短语为 0；当前环境为 `disabled_shadow`，模拟白名单 `41` 时为 `plan_required`。失败码已接入重试记忆，会要求下一题更换为单操作、单偏差方向骨架。

## 数学基础函数 3 次真实复验（运行 #1 / 单元 #13）

本轮按用户授权只调用数学基础函数，共完成 3 个有效 DeepSeek 请求。此前一次因沙箱网络权限导致的 `provider_network_error` 没有收到 Provider 输出、没有候选题和费用，因此只作为交付故障证据，不计入本轮 3 个有效样本。

| 指标 | 结果 |
| --- | ---: |
| 有效请求 / Provider 成功 | 3 / 3（100%） |
| 原始在线门禁 publishable | 1 / 3（33.3%） |
| 当前策略确定性重放可通过 | 2 / 3（66.7%） |
| 当前 QuestionPlan 遵守 | 2 / 3（66.7%） |
| 一任务一生成作业 | 3 / 3（100%） |
| 学生端发布 | 0 |
| 总 token | 44,507 |
| 总 Provider 延迟 | 91,127 ms |
| 平均 Provider 延迟 | 30,376 ms |
| 估算费用 | 0.00906150 USD |

样本明细：

- 候选题 `#592` / 作业 `#606`：原始门禁拒绝，当前仍应拒绝。模型把基础单属性题扩成“开口方向 + 对称轴 + 区间单调性”组合，触发 `candidate_plan_math_function_property_stack_over_limit`。
- 候选题 `#593` / 作业 `#607`：原始门禁拒绝，但当前策略重放通过。题目只问二次函数对称轴；旧分类器因“平面直角坐标系”和“直线 x=2”误触 `math_spatial_geometry_relation_medium_cap`。
- 候选题 `#594` / 作业 `#608`：修复后在线生成，门禁直接 `publishable`，QuestionPlan 遵守，调度家族 `quadratic_function_properties` 匹配。

复验过程中完成两项基础设施/门禁修复：

- 观察后端现在在 readiness 中暴露 `cooldownMinutes`，预检合并目标后端状态时以后端值为准，避免后端实际 1 分钟、CLI 却错误等待 30 分钟。
- 审核器新增 `direct_quadratic_single_property_basic_cap`：显式二次函数且只问一个对称轴、开口、顶点、零点、定义域、值域、最值或单调性目标时保持 basic；函数坐标系描述不再误入空间几何。复合函数、对数/指数、参数、分类讨论、导数和切线仍被排除，相关回归测试已通过。

结论采用双口径保留审计真实性：原始在线通过率仍是 33.3%，不会事后改写；在本轮发现并修复确定性误杀后，同一三题按当前代码可通过 66.7%，达到阶段目标“至少 2 / 3”，但样本规模仍不足以证明批量稳定性。所有候选题保持 `pending_review`，`sourceQuestionId=null`，没有进入学生题库。

## 数学基础函数验证范围闭环

本轮授权仅用于验证数学基础函数真实出题通过率，不扩展到三科、其他数学家族或学生端发布。3 个有效请求已全部完成，因此同一单元不再重复调用 DeepSeek。

- 单元 `#13` 的 72 小时后置效率门禁通过：交付成功率 75%（包含 1 次无候选的网络交付失败）、当前策略门禁通过率 50%、一任务一作业率 100%、学生端抑制率 100%。按 3 个有效 Provider 样本计算，交付成功率为 100%，当前策略门禁与 QuestionPlan 遵守均为 2 / 3。
- 多样性 readiness 现在会区分“分类器确有缺陷”和“正式题窗口尚为空”。物理已有 4 / 4 受保护影子样本能正确分类但没有正式窗口，因此状态为 `needs_guarded_observation_window`，不再误报 `needs_classifier_work`。
- 物理 QuestionPlan readiness 已同步到当前受保护边界：基础运动学可由显式白名单接入中央门禁，其他物理家族仍保持影子审计。
- 数学 soft-cap smoke 可用精确的 `run #1 / cell #13` 后置效率门禁补充空正式窗口证据；这只证明该观察单元达到阶段阈值，不伪装成全数学正式家族窗口已经齐全。
- 总 rollout gate 当前为 `passed_with_operational_wait`。下一步为 `select_next_guarded_math_family_with_no_provider_calibration`：先用历史候选题、本地规则和 QuestionPlan 做零 Provider 成本校准；只有新家族达到本地准入条件且获得新的明确授权后，才允许新的真实请求。

## 下一个受保护数学家族：中等初等函数排序

新增只读选择器 `csca-ai-questioning:math-guarded-family-selector`，它会遍历当前数学运行的全部开放单元，要求精确 QuestionPlan 与完整提示契约通过，并优先选择已有可迁移真实样本和固定评估覆盖的家族。选择器不会启动后端、提交任务、调用 Provider、写数据库或发布学生端。

当前运行 `#1` 的选择结果为单元 `#17`：

- 主题：基本初等函数；难度：medium。
- 调度家族：`elementary_function_exp_log_ordering`。
- QuestionPlan：`math_medium_exp_log_ordering_chain_v1`。
- 本地校准状态：`selected_and_locally_calibrated`。
- 证据：数学 QuestionPlan 影子固定集通过，其中 exp/log 排序形态 3 个；难度补丁固定评估通过 1 个；历史真实 `publishable` 正样本为 `#16338`。
- 精确提示契约要求比较三个可见的指数/对数/幂/根式表达式，必须在题干或解析中给出至少一条区间界定或不等式链；禁止漂移成对数方程、纯小数近似、现实包装或参数题。当前必需短语缺失为 0。
- 原先当前单元使用较宽的 `math_elementary_function_relation_v1`；现已提升到专用排序链模板，证据槽从两个独立组收紧为三个独立组，并接入已有的排序链候选遵守门禁。

未来真实验证方案仅作为未授权草案保存：最多 3 次调用、预算上限 0.02 USD、要求交付 3 / 3、当前门禁至少 2 / 3、QuestionPlan 遵守至少 2 / 3、学生端发布 0。该草案 `executionAllowed=false`，当前没有发起任何新请求；未来授权必须明确指定此家族和调用次数。

## DeepSeek 官方模型名校正

根据 DeepSeek 官方 2026-07-31 更新与 `/models` 文档，当前正式 Flash 模型标识为 `deepseek-v4-flash`，Pro 模型为 `deepseek-v4-pro`；旧 `deepseek-chat` / `deepseek-reasoner` 兼容名已在 2026-07-24 停止使用。项目中遗留的非官方短名 `deepseek-flash` 已统一改为 `deepseek-v4-flash`，覆盖本地环境、环境示例、网关默认值、出题、审核、题目映射和 AI coach 默认值；`deepseek-v4-pro` 保持不变。参考：[DeepSeek API 更新日志](https://api-docs.deepseek.com/zh-cn/updates/) 与 [模型列表接口](https://api-docs.deepseek.com/zh-cn/api/list-models/)。本次只改配置与默认值，没有发起 Provider 请求。

## 中等初等函数提示成本收敛

为降低后续真实验证的输入 token 成本，提示构建器新增 `question-generator-prompt-audit-v1` 只读审计，记录系统消息、用户消息、总字符数、动态规则段长度以及去重字段。完整 `blueprint.constraints` 仍保留在任务重放元数据中，不影响审计和复现。

- Provider 用户载荷不再把同一份 `expansion.questionPlan`、`targetProfile` 和 `styleProfile` 同时塞入 `constraints` 与独立字段；权威位置分别保留在顶层 `expansion`、顶层 `targetProfile` 和 `styleReference`。
- 仅对已本地校准的 `math_medium_exp_log_ordering_chain_v1` 省略重复的通用数学主题指导；正态分布等尚依赖通用主题限制的计划不受影响。
- 单元 `#17` 精确预览从估算旧载荷 17,419 字符降至 14,010 字符，减少 3,409 字符（约 19.6%）。其中系统消息为 9,110 字符、用户消息为 4,900 字符。
- 专用排序模板新增 15,000 字符精确提示预算；超限会让本地提示契约转为 `needs_attention`，并在实际生成链路进入 AI Gateway 前返回 `generator_prompt_budget_exceeded`。该失败归类为非 Provider 的 `prompt_budget_exceeded`，避免自动重试反复空转。
- 七条专项提示契约仍全部存在，QuestionPlan 仍位于 Provider 用户载荷；15,001 字符的越界固定测试确认 Gateway 调用为 0。规则回归与后端构建通过，此优化没有调用 Provider、写数据库或发布学生端。

三次已完成的基础函数真实调用显示，输入 token 分别为 8,109、8,116、8,064，completion token 分别为 6,198、7,809、6,211；其中一次已经接近当前 8,000 的输出上限。因此当前不能安全地把 `maxTokens` 直接降为 6,000，否则可能增加截断与重复调用成本。

DeepSeek V4 官方文档说明思考模式默认开启且默认强度为 `high`，简单任务建议使用 `low`。项目已在 AI Gateway 的 OpenAI-compatible 协议中增加 `thinking` 与 `reasoning_effort` 透传，并仅为已校准的 `math_medium_exp_log_ordering_chain_v1` 设置 `thinking=enabled`、`reasoning_effort=low`，同时省略思考模式不支持的 `temperature`，继续保留 8,000 输出上限作为防截断保险。其他题族保持 Provider 默认策略。参考：[DeepSeek 思考模式](https://api-docs.deepseek.com/zh-cn/guides/thinking_mode/) 与 [Chat Completions API](https://api-docs.deepseek.com/zh-cn/api/create-chat-completion/)。本次改动由模拟 Gateway 验证，没有发起真实请求。

## 中等初等函数排序低思考强度真实观察（运行 #1 / 单元 #17）

按用户授权完成 3 次有效 DeepSeek 观察，题族固定为 `elementary_function_exp_log_ordering`，计划模板为 `math_medium_exp_log_ordering_chain_v1`。三次均使用 `deepseek-v4-flash`、`thinking=enabled`、`reasoning_effort=low`、8,000 completion token 上限，且保持学生端发布抑制。两次本地提示预算超限和一次沙箱 `connect EACCES ...:443` 都没有到达 Provider、没有 token/费用，因此不计入三次有效样本。

| 样本 | 任务 / 作业 / 候选 | 输入 / 输出 / 总 token | 估算费用（USD） | 原始在线门禁 | 当前确定性重放 |
| --- | --- | ---: | ---: | --- | --- |
| 1 | `cacdaa19-786d-4d70-95a9-5cfc4fb08245` / `#612` / `#595` | 3,027 / 5,907 / 8,934 | 0.00207774 | quality_attention | approve（92） |
| 2 | `2ebb8766-fc01-4117-ad31-26eac993203e` / `#613` / `#596` | 3,113 / 5,084 / 8,197 | 0.00185934 | publishable | approve（92） |
| 3 | `f4be6826-6df0-49f6-b3ed-f75b3ac5514c` / `#614` / `#597` | 3,171 / 4,739 / 7,910 | 0.00177086 | publishable | approve（92） |

汇总：Provider 交付 3 / 3，原始在线 `publishable` 2 / 3（66.7%），当前代码确定性重放 3 / 3（100%），QuestionPlan 当前重放遵守 3 / 3，学生端发布 0；总 token 25,041，平均 8,347，总费用 0.00570794 USD，平均 0.00190265 USD。低思考强度下 completion token 从 5,907 降至 4,739，三次均未触及 8,000 上限；该小样本支持继续使用 low，但不足以证明批量稳定性或允许进一步降低输出上限。

真实观察同时发现并修复三类本地机制问题：

- 专用计划的 Provider 提示曾被完整画像、重复约束和冗长失败反馈推到 15,000 字符预算外；现在保留元数据完整性，同时对已校准计划使用紧凑目标画像、原因码反馈与单一权威字段，三次有效提示分别为 13,341、13,726、14,121 字符。
- `#595` 的根式知识标签与“排序计算应用”被旧确定性规则误判为弱考纲信号和画像不匹配；修复后 `#595/#596/#597` 均为 reviewer `approve`、score 92、profile score 100，且计划遵守。
- 精确单元观察 CLI 以前只在本地预览 QuestionPlan，却没有把预览所得题族提交给后端；候选压力出现后，后端会重建成另一个通用计划并产生错误 scheduler adherence。现在观察任务把 `questionPlanTaskFamily` 固化进任务快照，后端按该题族重建并验证 QuestionPlan；有效计划会覆盖通用轮换提示，并从 avoid/cooldown 中移除指定题族。此修复在三次真实调用已经计满后完成，只通过本地规则、精确提示契约和编译验证，没有追加 Provider 请求，也不事后改写历史在线审计。

观察完成后的零 Provider 闭环进一步修复了效率统计和下一家族选择：

- `math-postfix-efficiency-v2-four-funnel` 不再用全部 terminal task 同时充当交付率与质量通过率分母。提示预算本地拦截、`generator_prompt_budget_exceeded` 和本地 `connect EACCES ...:443` 会保留在任务审计中，但从 Provider 交付分母排除；质量门禁通过率只按已交付候选计算。单元 `#17` 因而得到有效交付 3 / 3、原始门禁 2 / 3、一任务一作业 3 / 3、学生端发布 0 的阶段 `passed`，另 3 个本地前置失败独立列示而不污染 Provider 质量结论。
- `math-guarded-family-selection-v2-dynamic-validation` 会对当前运行全部单元执行只读后置门禁，不再只硬编码排除 `#13`。当前已动态识别并排除 `#13/#17`，避免重复消耗 Provider；下一本地候选转为 `#16 / elementary_function_direct_property / math_elementary_function_relation_v1`。
- `#16` 的权威计划提示也接入 15,000 字符预算和紧凑载荷，精确预览由 15,568 降至 11,672 字符；新增基础对数函数定义域固定样本后，分类器能区分“单个初等函数直接性质”与“对数方程/定义域求解”，固定评测、QuestionPlan 和提示契约均通过。审核上下文现在携带 QuestionPlan，使其 `maxIndependentRelations=1` 能覆盖来源画像中相冲突的 high-reading 目标；DeepSeek V4 路由使用与已校准受保护数学家族一致的 `thinking=enabled + reasoning_effort=low`，仍保留 8,000 输出上限。该候选仍为 `liveExecutionAllowed=false`，这里只完成无费用本地校准。

总验收现在区分“最新单任务完整证据”和“同单元有界阶段证据”。单元 `#17` 的历史最后一条任务仍保留旧的 `schedulerAdherenceStatus=avoided_family_hit`，不会被事后改写或伪装成已修复；与此同时，四漏斗聚合门禁的 3 个有效交付、2 个原始可发布、0 个学生发布可作为 `fresh_bounded_stage_efficiency_gate` 推进依据。使用 `--math-observation-cell=17 --math-basic-function-cell=13` 执行无 Provider 总验收时，`live_math_stage_gate_evidence` 已满足，下一动作稳定指向已本地校准的单元 `#16`，而不是要求再次消费 `#17`。总验收仍为 `operational_wait`，原因是全科正式窗口、物理受保护观察和提升权限后的进程审计尚未完成，并不否定 `#17` 的小样本阶段结论。

下一动作和动作队列门禁也已接入同一证据口径。显式传入 `--observation-cell=17` 时，历史生产漏斗的 blocked/zero-approved 指标仍作为背景展示，但吞吐状态改为 `acceptable_with_bounded_stage_evidence`，决策为 `math_stage_validated_select_next_guarded_family`，动作类型为 `read_only_math_guarded_family_selection`。动作队列门禁返回 `read_only_progression_ready`，并继续声明 `doesNotAuthorizeExecution=true`；因此它既不会错误要求再次运行恢复诊断，也不会把小样本阶段通过升级成生产放量授权。

成本准入进一步扩展为三层提示预算：已校准或当前受控观察模板使用显式上限，其他非空 QuestionPlan 模板默认上限 20,000，尚未进入 QuestionPlan 的生成路径使用全局 24,000 字符上限。三层都在 AI Gateway 调用前执行，超限统一返回 `generator_prompt_budget_exceeded`、Provider 调用数为 0。当前数学 17 个单元预算覆盖 17 / 17、通过 17 / 17、超限 0，最长提示 18,064 字符；`#16` 仍为 11,672 / 15,000。

随后完成了物理和化学当前开放单元的零 Provider 计划覆盖：

- 物理 `run #2 / cell #19 / 几何光学 / medium` 使用 `physics_medium_optics_two_relation_v1`，固定题族 `waves_optics_interference_refraction`。计划要求文字完整设置、两个相连的透镜或折射关系、公式回代与唯一答案，并拒绝未提供图片依赖。计划权威化去重后，精确预览由 16,781 降至 11,706 / 15,000 字符。
- 化学 `run #3 / cell #36 / 物质分类与状态变化 / medium` 使用 `chemistry_medium_classification_evidence_v1`，固定题族 `classification_state_change_evidence_judgement`。计划要求具体物质或过程、两个证据组与一个分类规则，并拒绝定义背诵或直接统计变化数量。精确预览由 14,291 降至 10,749 / 15,000 字符。
- 两个模板都要求显式 cell allowlist；当前环境保持 `disabled_shadow`，只读精确观察环境下才进入 `plan_required`。两项计划、提示契约、预算与预检均通过，固定 task-family 评测扩展至 11 个样本。
- 新增独立 `current_open_cell_question_plan_self_test`，覆盖两格的模板解析、计划验证、显式白名单边界、正负候选遵守、题族分类、主题/style 去重及 15,000 字符预算；它已进入总 QuestionPlan 无 Provider 验收，固定评测的 QuestionPlan checks 由 6 增至 7。
- 本轮没有提交任务、调用 Provider、写数据库或发布学生题；因此结果只证明本地架构和成本边界就绪，不代表真实生成通过率。

下一动作门禁随后补上低效率保护。此前物理历史生成 4 道、批准 0 道时，`subject-practice-next-action` 仍会因并发槽空闲而建议普通 enqueue；现在历史 yield 低于阈值会默认阻断 capacity fill。只有精确 QuestionPlan、显式白名单 gate、plan attempt、提示契约、字符预算和无副作用边界全部通过，才允许状态 `acceptable_for_one_guarded_observation_only`，动作只能是 `submit_one_guarded_observation_task`。该动作要求未来的明确授权同时覆盖精确 subject/run/cell/task family、最多一次 Provider 请求、本地证据写入、费用硬上限和学生发布抑制；它不会先创建可能进入普通发布路径的 generation job。

受保护观察在 Gateway 层显式设置 `maxProviderAttempts=1`，因此普通 `question_generation` 的两次重试不会把一条观察授权扩大成三次真实 Provider 请求。Gateway ledger 对所有 attempts 累计 token 与费用，并记录实际次数和限制。新增只读 `csca-ai-questioning:observation-scorecard` 统一展示任务、交付、候选、自动门禁和学生发布五层漏斗，以及每个交付/合格样本成本、费用上限与尝试次数违规。数学 #17 的既有 3 次有效交付仍保留原结论，但因历史任务早于新费用/attempt cap 元数据，记分板明确标记为 `legacy_bounded_evidence_missing_current_cost_or_attempt_caps`；物理 #19 与化学 #36 当前均为 `insufficient_provider_samples`，不会把本地就绪误报为真实质量通过。

物理 #19 和化学 #36 的当前只读 action queue gate 均返回 `ready_for_explicit_authorization`，同时明确 `doesNotAuthorizeExecution=true`；普通 capacity fill 均被压制为 `no_capacity_fill_while_efficiency_requires_guarded_observation`。这使后续成本暴露被限制为“一条入队 + 一次另授权的真实观察”，不会因空闲并发自动扩大到批量请求。

受保护观察的 apply 命令现在会等待该 durable task 到终态（最长 15 分钟），而不是在任务刚入队时提前结束；终态后必须运行只读 observation scorecard，重新核对实际 Provider attempts、累计 token/费用、候选与自动门禁结果以及学生发布数。动作队列完整性门禁同时要求操作命令和后置验证命令都包含该评分卡，因此缺少成本/质量闭环的建议不能进入可授权状态。

随后把实际执行成本策略纳入同一准入证据。生成服务现在向精确预览复用同一组纯策略函数，`executionCostPolicy` 会明确报告 `deepseek-v4-flash`、`thinking=enabled`、`reasoning_effort=low`、temperature 省略、8,000 输出上限以及 `question-generation-reasoning-effort-v2`。下一动作门禁新增模型/低思考策略与输出上限检查，任一字段漂移即不得进入单观察可授权状态。数据库只读复核中，物理 #19（11,706 / 15,000）和化学 #36（10,749 / 15,000）的全部计划、提示、成本与无副作用检查均通过；本轮没有 enqueue、Provider 请求或学生端发布。

后续零 Provider 开发补上了 QuestionPlan candidate rerender 的真实有限预算。每条重生成任务会沿 `previousQuestionId` 继承上一候选的 attempt/budget，最多只允许 1 次结构性 rerender；第二次仍发生 candidate-plan adherence failure 时，enqueue API 和自动重生成路径都会在创建新 generation job 前停止，并留下稳定的 budget-exhausted 原因。QuestionPlan 载荷不能把系统硬上限提高，production audit 同时区分 repair available、repair exhausted 与缺少新元数据的 legacy unknown。本轮仅完成代码、fixture、数据库只读审计和编译验证，没有追加 DeepSeek 请求或数据库写入。

同一轮还接通了注册模板级自动 Plan repair。无效 Plan 会先尝试同 task family 的权威模板重建，再在第二个有界 attempt 中尝试当前单元默认注册 family；每一步都只运行本地构建器和确定性 validator，修复后重新过 gate，仍不合格则在 Provider 前 fail-closed。新 enqueue 和旧 queued-job 当前策略重建都使用同一实现，并将 repaired plan、gate、attempt 与 repair audit 保持一致。本轮没有借此启动任何生成任务；实际质量收益仍需后续受控样本验证。

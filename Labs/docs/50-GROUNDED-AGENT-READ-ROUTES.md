# PR11B：有事实来源的 Agent 查询路由

## 1. 目标

把学生常问的四类查询接入正式 Agent Runtime：学习状态、错题复习、模考记录和真题资源。所有事实必须来自服务器 Capability，不能由大模型凭对话猜测。

## 2. 固定路由与 Capability

| Intent | 固定 Capability | 是否产生写入 |
| --- | --- | --- |
| `learning_status` | `get_subject_mastery` | 否 |
| `review_queue` | `get_review_queue` | 否 |
| `mock_exams` | `list_mock_exam_attempts` | 否 |
| `past_papers` | `search_past_papers` | 否 |

`search_past_papers` 已进入统一 `LearningCapabilityRegistryService`，只返回已发布的公开资料摘要和站内详情路径；不暴露后台草稿、管理接口或原始数据库访问。

## 3. 大模型边界

模型不生成最终事实文案。`AgentGroundedResponseService` 只允许返回：

- `leadStyle`：`overview / evidence / action` 三选一；
- `factKeys`：从服务器给定 key 中选择和排序。

最终标题、知识点、次数、分数、状态和链接全部由服务器用 Capability 结果渲染。输出出现未知 key、额外字段、Schema 错误、超时、无 API key 或 Provider 失败时，使用服务器默认顺序；不会把模型自由文本显示给学生。

该设计牺牲少量语言自由度，换取可验证、可降级和不可虚构。后续若要增加自然语言润色，必须先建立逐事实引用协议和事实一致性评测，不能直接放开自由回答。

## 4. 输入与数据边界

- 学习状态只使用学生自己的知识点掌握证据；没有证据时明确提示先完成练习；
- 错题和模考查询始终在 Capability 内用 `actorUserId` 限制数据归属；
- 真题只允许科目、年份、语言、分类和数量过滤，且只查询公开发布数据；
- 这些查询不调用练习写能力、不请求自动出题，也不产生学习状态写入；
- 模考分数只展示已经提交且数据库已有的成绩；Score Readiness 继续保持 Shadow Gate，不输出未经校准的预测。

## 5. Feature Flag 与故障回退

`CSCA_AGENT_LLM_GROUNDED_RESPONSE_ENABLED` 默认关闭。本地一键脚本打开；关闭或 API 不可用时，四条查询仍正常工作，只使用固定展示顺序。

## 6. 验证

- Nest 后端编译通过；
- 意图路由测试覆盖新增 Intent 与规则回退；
- Runtime 测试验证每个 Intent 只调用对应只读 Capability，且不创建学习计划 Artifact；
- Grounded Response 测试验证未知 fact key 被拒绝并回退；
- Capability Facade 测试覆盖公开真题过滤、返回契约和站内路径。

## 7. 下一阶段

PR11C 已建立固定评测集与本地黄金路径 Gate：覆盖中文/英文自然表达、多轮承接、提示注入、Provider 故障、空数据、数据归属和调用预算。Live Gate 需在本地服务启动后显式运行，详见 [51-AGENT-FIXED-EVAL-AND-DEMO-GATE.md](./51-AGENT-FIXED-EVAL-AND-DEMO-GATE.md)。

# Agent 个人设置中心

## 1. 目的

个人设置页不再是一张混合长表单，而是用户管理“账号身份、学习画像、正式考试目标、长期学习时间、机构关系”的统一入口。页面结构围绕信息归属拆分，同时明确哪些数据会被学习 Agent 使用。

## 2. 信息边界

| 设置区 | 数据来源 | Agent 用途 | 写入语义 |
| --- | --- | --- | --- |
| 账号资料 | `User`、AI Entitlement | 称呼与可用额度 | 普通账号更新 |
| 学习画像 | `StudentProfile` | 内容语言、教育阶段、解释方式与长期方向 | 当前资料更新 |
| 考试目标 | `StudentScoreGoal` + subjects | Target Gap、Prescription、Readiness 的正式目标 | 新建不可变版本并 supersede 旧版本 |
| 学习时间 | `StudyAvailabilityPreference` | 任务时长、每周容量和可执行日期 | 新建不可变版本并 supersede 旧版本 |
| 机构与额度 | Organization Membership、AI Entitlement | 额度来源与机构能力 | 独立邀请码流程 |

`StudentProfile.targetExamDate`、`targetSubjectCodes` 仍为兼容字段，但个人设置页中的正式考试目标以 `StudentScoreGoal` 为权威来源。保存目标时同步兼容字段，避免旧页面立刻失去考试日期与科目信息。目标分数只存在版本化目标表，不写入 Profile metadata。

`weeklyGoalDays` 是旧版粗粒度偏好；Agent 的正式容量来源是 `StudyAvailabilityPreference.weeklyMinutesGoal`、`preferredStudyDays`、`defaultSessionMinutes` 和 IANA timezone。页面不再把“每周几天”旧字段伪装成 Agent 时间容量。

## 3. API

- `GET /api/v1/me/agent-learning-settings`：读取当前目标与长期时间设置；
- `POST /api/v1/me/agent-score-goal`：使用完整契约、目标版本和评分策略版本写入新目标；
- `POST /api/v1/me/agent-study-availability`：使用完整契约与 Availability 版本写入新时间设置。

三个接口均要求当前用户身份，不接受目标用户 ID。写入使用用户级 PostgreSQL advisory lock 和乐观版本检查，防止两个页面互相覆盖；首次设置也必须显式提交 `expectedGoalVersion: unset` 或 `expectedAvailabilityVersion: unset`，禁止在读取失败后盲写。

## 4. 当前评分边界

正式 `ExamScoringPolicy` 尚未上线，因此设置服务端固定使用 `csca-score-unverified-v1`。用户可以设置每科 1–100 的个人目标，供差距分析和任务规划使用；这不等于系统已能输出预计分数或达标概率。Score Readiness 继续遵守 Shadow Gate 的 `null` 数值约束。

## 5. 界面原则

- 设置页内部使用稳定的分类侧栏，桌面端左右布局，窄屏变为横向分类导航；
- 每个面板只保存一类事实，按钮与版本语义对应；
- “Agent 使用”和“Agent 核心输入”标记只做信息透明，不制造新的隐私授权；
- 临时约束（例如“今天只有 10 分钟”）留在对话级 Session Constraint，不覆盖长期设置；
- 不大改 CSCAPilot 的颜色、字体和控件体系，只重排信息架构与密度。

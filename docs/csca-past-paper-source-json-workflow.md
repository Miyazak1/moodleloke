# CSCA 真题截图转 JSON 工作流

> 用途：把用户提供的真题截图、PDF 截图或手工题目，整理成后台“真题画像”可直接导入的 JSON。

## 固定流程

1. 识别题目内容：题号、题干、选项、答案、解析。
2. 补齐来源信息：科目、年份、语言、来源标题。
3. 映射大纲知识点：优先填写 `topicCodes`，不确定时留空，后台再人工映射。
4. 标准化题目分析：难度、题型、认知技能、推理步数、计算量、干扰项类型。
5. 保存为 `docs/csca-<subject>-source-questions-<date>.json`。
6. 上传前运行 JSON 校验。
7. 后台导入后，逐题确认“用于画像”，再生成真题画像。

## 上传前校验

```bash
npm run csca-source-json:validate -- docs/csca-past-paper-source-json-template.json
```

校验会检查：

- 顶层 `document/questions` 是否存在。
- 科目、题号、题干、选项、答案是否完整。
- 正确答案是否匹配某个选项 ID。
- `analysis` 是否包含画像需要的核心字段。
- `difficulty/reviewStatus/calculationLoad` 等枚举值是否有效。
- 未映射考点、缺解析、低置信度等会以 warning 提示。

## 顶层结构

```json
{
  "document": {
    "subject": "math",
    "syllabusVersion": "2025",
    "sourceType": "past_paper",
    "title": "CSCA 数学真题参考",
    "examYear": 2025,
    "examSession": "sample",
    "language": "zh",
    "sourceLabel": "用户提供截图整理",
    "licenseScope": "internal_analysis",
    "usagePolicy": {
      "allowStyleExtraction": true,
      "allowQuestionDisplay": true,
      "allowPromptRawText": true,
      "allowSimilarityCheck": true
    },
    "status": "active"
  },
  "questions": []
}
```

## 单题模板

```json
{
  "questionNumber": "1",
  "pageNumber": 1,
  "language": "zh",
  "promptText": "题干文本",
  "options": [
    { "id": "A", "text": "选项 A" },
    { "id": "B", "text": "选项 B" },
    { "id": "C", "text": "选项 C" },
    { "id": "D", "text": "选项 D" }
  ],
  "correctAnswer": "A",
  "explanation": "解析文本。若截图没有解析，写人工简析。",
  "syllabusVersion": "2025",
  "topicCodes": [],
  "blueprintLikeTags": ["single_choice"],
  "analysis": {
    "cognitiveSkill": "concept_identification",
    "difficulty": "basic",
    "difficultyEvidence": "基础概念识别，计算量低。",
    "questionForm": "concept_check",
    "stemPattern": {
      "hasScenario": false,
      "hasFormula": false,
      "hasDiagram": false,
      "hasTable": false
    },
    "reasoningSteps": 1,
    "calculationLoad": "none",
    "optionPattern": {
      "optionStyle": "four_option_single_choice",
      "distractorTypes": ["concept_confusion"],
      "commonMisconceptions": []
    },
    "styleNotes": ["题干短", "单选", "直接考查概念"],
    "doNotCopySignals": ["不要复用原题题干和选项顺序"]
  },
  "analysisConfidence": 0.8,
  "analysisStatus": "ai_parsed",
  "reviewStatus": "needs_review"
}
```

## 字段取值建议

`subject`：

- `math`
- `physics`
- `chemistry`

`difficulty`：

- `basic`
- `medium`
- `hard`

`cognitiveSkill` 常用值：

- `concept_identification`
- `concept_discrimination`
- `standard_application`
- `calculation`
- `multi_step_reasoning`
- `experiment_reasoning`

`questionForm` 常用值：

- `concept_check`
- `concept_judgement`
- `calculation_application`
- `diagram_interpretation`
- `experiment_operation`
- `scenario_application`

`calculationLoad`：

- `none`
- `light`
- `medium`
- `heavy`

`reviewStatus`：

- 有 `topicCodes` 且人工确认：`mapped`
- 未确认考点：`needs_review`
- 后台确认用于画像后会变为：`approved`

## 转写原则

- 不确定的知识点不要硬填，留空给后台映射。
- 没有官方解析时，可以写“人工简析”，但要保证答案自洽。
- `analysis` 是给画像用的，不需要写很长，但必须稳定。
- `doNotCopySignals` 用来提醒生成题避开原题表达、数值组合、选项结构。
- 一次导入最多 300 题；建议每个 JSON 按科目和来源拆分。

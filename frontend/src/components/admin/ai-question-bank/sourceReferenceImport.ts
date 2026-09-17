import { prettyJson } from './pageUtils';

const SOURCE_DOCUMENT_TYPES = ['past_paper'];
const SOURCE_DOCUMENT_TYPE_ALIASES: Record<string, string> = {
  pastpaper: 'past_paper',
  past_papers: 'past_paper',
  official_paper: 'past_paper',
  real_exam: 'past_paper'
};

function normalizedSourceDocumentType(value: unknown) {
  const raw = String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  return SOURCE_DOCUMENT_TYPE_ALIASES[raw] ?? raw;
}

export function sourceReferenceTemplate(subject = 'math') {
  return prettyJson({
    document: {
      subject,
      sourceType: 'past_paper',
      title: `CSCA ${subject} 真题导入模板（请替换后再导入）`,
      examYear: 2025,
      examSession: 'sample',
      language: 'zh',
      sourceLabel: '内部真题解析模板',
      licenseScope: 'internal_analysis',
      usagePolicy: {
        allowStyleExtraction: true,
        allowQuestionDisplay: true,
        allowPromptRawText: true,
        allowSimilarityCheck: true
      },
      status: 'draft'
    },
    questions: [
      {
        questionNumber: '1',
        language: 'zh',
        promptText: '在这里粘贴真题题干。',
        options: [
          { id: 'A', text: '选项 A' },
          { id: 'B', text: '选项 B' },
          { id: 'C', text: '选项 C' },
          { id: 'D', text: '选项 D' }
        ],
        correctAnswer: 'A',
        explanation: '在这里写标准解析；若为空，导入后系统会尽量用 AI 补齐画像分析。',
        syllabusVersion: '2025',
        topicCodes: [],
        blueprintLikeTags: ['concept', 'single_choice'],
        analysis: {
          difficulty: 'basic',
          cognitiveSkill: 'concept_identification',
          difficultyEvidence: '基础概念识别，计算量低。',
          questionForm: 'concept_check',
          stemPattern: {
            hasScenario: false,
            hasFormula: false,
            hasDiagram: false,
            hasTable: false
          },
          reasoningSteps: 1,
          calculationLoad: 'none',
          optionPattern: {
            optionStyle: 'four_option_single_choice',
            distractorTypes: ['concept_confusion'],
            commonMisconceptions: []
          },
          styleNotes: ['题干短', '单选', '直接考查概念'],
          doNotCopySignals: ['不要复用原题题干和选项顺序']
        },
        analysisConfidence: 0.8,
        analysisStatus: 'ai_parsed',
        reviewStatus: 'needs_review'
      }
    ]
  }, {});
}

function isUneditedSourceReferenceTemplate(payload: {
  document?: Record<string, unknown>;
  questions?: unknown;
}) {
  const document = payload.document ?? {};
  const questions = Array.isArray(payload.questions) ? payload.questions : [];
  const firstQuestion = questions[0] && typeof questions[0] === 'object' && !Array.isArray(questions[0])
    ? questions[0] as Record<string, unknown>
    : null;
  const options = Array.isArray(firstQuestion?.options) ? firstQuestion.options : [];
  const optionTexts = options.map((option) => (
    option && typeof option === 'object' && !Array.isArray(option)
      ? String((option as Record<string, unknown>).text ?? '').trim()
      : ''
  ));

  return questions.length === 1
    && String(document.examSession ?? '').trim() === 'sample'
    && String(document.sourceLabel ?? '').includes('真题解析模板')
    && String(firstQuestion?.promptText ?? firstQuestion?.prompt ?? '').includes('在这里粘贴真题题干')
    && ['选项 A', '选项 B', '选项 C', '选项 D'].every((text, index) => optionTexts[index] === text);
}

export function validateSourceReferencePayload(value: unknown) {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { errors: ['JSON 顶层必须是对象，包含 document 和 questions。'], warnings };
  }
  const payload = value as { document?: Record<string, unknown>; questions?: unknown };
  if (isUneditedSourceReferenceTemplate(payload)) {
    errors.push('当前内容还是真题导入模板，请先替换标题、题干、选项和解析后再导入。');
  }
  if (!payload.document || typeof payload.document !== 'object' || Array.isArray(payload.document)) {
    errors.push('缺少 document 对象。');
  } else {
    ['subject', 'title', 'sourceType'].forEach((key) => {
      if (!String(payload.document?.[key] ?? '').trim()) errors.push(`document.${key} 不能为空。`);
    });
    const subject = String(payload.document.subject ?? '').trim();
    if (subject && !['math', 'physics', 'chemistry'].includes(subject)) errors.push('document.subject 必须是 math/physics/chemistry。');
    const sourceType = normalizedSourceDocumentType(payload.document.sourceType);
    if (sourceType && !SOURCE_DOCUMENT_TYPES.includes(sourceType)) {
      errors.push('document.sourceType 必须是 past_paper；AI 画像源只能来自真实真题。');
    }
    const usagePolicy = payload.document.usagePolicy;
    if (!usagePolicy || typeof usagePolicy !== 'object' || Array.isArray(usagePolicy)) {
      warnings.push('document.usagePolicy 建议填写，确保画像提取和相似度检查策略明确。');
    }
  }
  if (!Array.isArray(payload.questions) || payload.questions.length === 0) {
    errors.push('questions 必须是非空数组。');
  } else {
    if (payload.questions.length > 300) errors.push('questions 单次最多 300 道。');
    const questionNumbers = new Set<string>();
    payload.questions.forEach((question, index) => {
      const item = question && typeof question === 'object' && !Array.isArray(question) ? question as Record<string, unknown> : null;
      if (!item) {
        errors.push(`questions[${index}] 必须是对象。`);
        return;
      }
      const prefix = `questions[${index}]`;
      const questionNumber = String(item.questionNumber ?? '').trim();
      const correctAnswer = String(item.correctAnswer ?? '').trim();
      if (!questionNumber) errors.push(`${prefix}.questionNumber 不能为空。`);
      if (questionNumber && questionNumbers.has(questionNumber)) errors.push(`questionNumber 重复：${questionNumber}`);
      if (questionNumber) questionNumbers.add(questionNumber);
      if (!String(item.promptText ?? item.prompt ?? '').trim()) errors.push(`${prefix}.promptText 不能为空。`);
      if (!correctAnswer) errors.push(`${prefix}.correctAnswer 不能为空。`);
      const options = Array.isArray(item.options) ? item.options : [];
      if (options.length < 2) errors.push(`${prefix}.options 至少需要 2 个选项。`);
      if (options.length !== 4) warnings.push(`${prefix}.options 当前为 ${options.length} 个选项；CSCA 单选题通常应为 4 个。`);
      const optionIds = new Set<string>();
      options.forEach((option, optionIndex) => {
        const record = option && typeof option === 'object' && !Array.isArray(option) ? option as Record<string, unknown> : null;
        if (!record) {
          errors.push(`${prefix}.options[${optionIndex}] 必须是对象。`);
          return;
        }
        const id = String(record.id ?? '').trim();
        if (!id) errors.push(`${prefix}.options[${optionIndex}].id 不能为空。`);
        if (!String(record.text ?? '').trim()) errors.push(`${prefix}.options[${optionIndex}].text 不能为空。`);
        if (id) optionIds.add(id);
      });
      if (correctAnswer && optionIds.size > 0 && !optionIds.has(correctAnswer)) errors.push(`${prefix}.correctAnswer 必须匹配某个选项 ID。`);
      if (!String(item.explanation ?? '').trim()) warnings.push(`${prefix}.explanation 为空；系统会尝试自动补齐画像分析，但有解析会更稳。`);
      const reviewStatus = String(item.reviewStatus ?? 'parsed').trim();
      if (!['needs_review', 'parsed', 'mapped', 'approved', 'rejected'].includes(reviewStatus)) errors.push(`${prefix}.reviewStatus 无效。`);
      const topicCodes = Array.isArray(item.topicCodes) ? item.topicCodes.filter((code) => String(code ?? '').trim()) : [];
      if (reviewStatus === 'mapped' && topicCodes.length === 0) warnings.push(`${prefix}.reviewStatus 是 mapped，但 topicCodes 为空；导入后会重新进入自动映射。`);
      const analysis = item.analysis && typeof item.analysis === 'object' && !Array.isArray(item.analysis) ? item.analysis as Record<string, unknown> : null;
      if (!analysis) {
        errors.push(`${prefix}.analysis 必须是对象。`);
      } else {
        if (!String(analysis.cognitiveSkill ?? '').trim()) errors.push(`${prefix}.analysis.cognitiveSkill 不能为空。`);
        if (!['basic', 'medium', 'hard'].includes(String(analysis.difficulty ?? '').trim())) errors.push(`${prefix}.analysis.difficulty 必须是 basic/medium/hard。`);
        if (!String(analysis.questionForm ?? '').trim()) errors.push(`${prefix}.analysis.questionForm 不能为空。`);
        if (!['none', 'light', 'medium', 'heavy'].includes(String(analysis.calculationLoad ?? '').trim())) errors.push(`${prefix}.analysis.calculationLoad 必须是 none/light/medium/heavy。`);
        const reasoningSteps = Number(analysis.reasoningSteps);
        if (!Number.isFinite(reasoningSteps) || reasoningSteps < 1 || reasoningSteps > 8) errors.push(`${prefix}.analysis.reasoningSteps 必须是 1-8 的数字。`);
        if (!analysis.stemPattern || typeof analysis.stemPattern !== 'object' || Array.isArray(analysis.stemPattern)) warnings.push(`${prefix}.analysis.stemPattern 建议填写。`);
        if (!analysis.optionPattern || typeof analysis.optionPattern !== 'object' || Array.isArray(analysis.optionPattern)) warnings.push(`${prefix}.analysis.optionPattern 建议填写。`);
      }
    });
  }
  return { errors, warnings };
}

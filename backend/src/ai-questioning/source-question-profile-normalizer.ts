export type ProfileConfidence = 'low' | 'medium' | 'high';

export type NormalizedQuestionProfile = {
  schemaVersion: 'source-question-profile-v2';
  subject: 'math' | 'physics' | 'chemistry';
  syllabusVersion: string;
  sourceQuestionId: number | null;
  topicIds: number[];
  primaryTopicId: number | null;
  topicConfidence: 'none' | 'low' | 'medium' | 'high';
  questionForm: string;
  cognitiveSkill: string;
  difficultyBand: 'basic' | 'medium' | 'hard' | 'unknown';
  difficultyEvidence: string;
  readingLoad: 'low' | 'medium' | 'high' | 'unknown';
  calculationLoad: 'none' | 'light' | 'medium' | 'heavy' | 'unknown';
  estimatedTimeSeconds: number | null;
  reasoningStepCount: number | null;
  stemPattern: {
    textLengthBand: 'short' | 'medium' | 'long' | 'unknown';
    conditionCount: number | null;
    hasScenario: boolean;
    hasFormula: boolean;
    hasDiagram: boolean;
    hasTable: boolean;
    hasUnitConversion: boolean;
    hasIrrelevantCondition: boolean;
  };
  optionPattern: {
    optionStyle: string;
    distractorTypes: string[];
    commonMisconceptions: string[];
  };
  loadEvidence: {
    stemCharCount: number | null;
    optionCharCount: number | null;
    formulaCount: number | null;
    operationCount: number | null;
    requiresAlgebraTransform: boolean;
    requiresGraphReading: boolean;
    requiresTableReading: boolean;
    crossTopicCount: number | null;
  };
  styleNotes: string[];
  similarityRiskSignals: string[];
  profileConfidence: ProfileConfidence;
  profileIssues: string[];
};

type SourceQuestionProfileInput = {
  analysis: unknown;
  sourceQuestion?: {
    id?: number | null;
    subject?: string | null;
    syllabusVersion?: string | null;
    topicId?: number | null;
    topicCodes?: unknown;
    promptText?: string | null;
    prompt?: string | null;
    options?: unknown;
    correctAnswer?: string | null;
    explanation?: string | null;
    analysisConfidence?: number | null;
    analysisIssues?: unknown;
  };
};

function recordFrom(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function cleanString(value: unknown, fallback = '') {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text || fallback;
}

function meaningfulString(value: unknown, fallback = '') {
  const text = cleanString(value);
  if (!text) return fallback;
  const normalized = text.toLowerCase();
  if ([
    'unknown',
    'unk',
    'n/a',
    'na',
    'none',
    'null',
    'undefined',
    '未识别',
    '未知',
    '无'
  ].includes(normalized)) {
    return fallback;
  }
  return text;
}

function optionalStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map((item) => cleanString(item)).filter(Boolean)));
}

function boundedNumber(value: unknown, min: number, max: number): number | null {
  const next = Number(value);
  if (!Number.isFinite(next)) return null;
  return Math.max(min, Math.min(max, Math.round(next)));
}

function positiveNumber(value: unknown): number | null {
  const next = Number(value);
  return Number.isFinite(next) && next > 0 ? Math.round(next) : null;
}

function booleanFrom(value: unknown) {
  return value === true;
}

function normalizeSubject(value: unknown): NormalizedQuestionProfile['subject'] {
  const subject = cleanString(value);
  return subject === 'physics' || subject === 'chemistry' ? subject : 'math';
}

function normalizeDifficulty(value: unknown): NormalizedQuestionProfile['difficultyBand'] {
  const text = cleanString(value).toLowerCase();
  if (['basic', 'easy', 'foundation', 'l1', '基础'].includes(text)) return 'basic';
  if (['medium', 'moderate', 'middle', 'l2', '中等'].includes(text)) return 'medium';
  if (['hard', 'challenging', 'advanced', 'l3', '较难', '挑战'].includes(text)) return 'hard';
  return 'unknown';
}

function normalizeReadingLoad(value: unknown): NormalizedQuestionProfile['readingLoad'] {
  const text = cleanString(value).toLowerCase();
  return text === 'low' || text === 'medium' || text === 'high' ? text : 'unknown';
}

function normalizeTextLengthBand(value: unknown, fallback: NormalizedQuestionProfile['stemPattern']['textLengthBand']): NormalizedQuestionProfile['stemPattern']['textLengthBand'] {
  const text = cleanString(value).toLowerCase();
  return text === 'short' || text === 'medium' || text === 'long' ? text : fallback;
}

function normalizeCalculationLoad(value: unknown): NormalizedQuestionProfile['calculationLoad'] {
  const text = cleanString(value).toLowerCase();
  return text === 'none' || text === 'light' || text === 'medium' || text === 'heavy' ? text : 'unknown';
}

function normalizeTopicConfidence(value: unknown, fallback: NormalizedQuestionProfile['topicConfidence']): NormalizedQuestionProfile['topicConfidence'] {
  const text = cleanString(value).toLowerCase();
  return text === 'none' || text === 'low' || text === 'medium' || text === 'high' ? text : fallback;
}

function normalizeConfidence(value: unknown, fallback: ProfileConfidence = 'low'): ProfileConfidence {
  const text = cleanString(value).toLowerCase();
  if (text === 'high' || text === 'medium' || text === 'low') return text;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  if (numeric >= 0.8) return 'high';
  if (numeric >= 0.55) return 'medium';
  return 'low';
}

function optionText(options: unknown) {
  if (!Array.isArray(options)) return '';
  return options.map((item) => cleanString(recordFrom(item).text ?? item)).join(' ');
}

function signalText(source: SourceQuestionProfileInput['sourceQuestion']) {
  return [
    cleanString(source?.promptText ?? source?.prompt),
    optionText(source?.options),
    cleanString(source?.explanation)
  ].join(' ').toLowerCase();
}

function inferFromSource(source: SourceQuestionProfileInput['sourceQuestion']) {
  const text = signalText(source);
  const stem = cleanString(source?.promptText ?? source?.prompt);
  const options = optionText(source?.options);
  const hasFormula = /[=<><= >=+\-*/^√]|\\frac|\\sqrt|sin|cos|tan|log|ln|mol|ph|j\b|n\b|v\b|a\b|f\b|p\b/.test(text);
  const hasNumbers = /\d/.test(text);
  const hasDiagram = /图|image|diagram|graph|curve|坐标|函数图像|示意图/.test(text);
  const hasTable = /表|table|数据|dataset/.test(text);
  const hasScenario = /实验|情境|实际|应用|experiment|scenario|given|已知/.test(text);
  const hasUnitConversion = /单位|unit|convert|km|cm|mm|kg|g|mol|℃|k\b|pa|n\b|j\b/.test(text);
  const asksCalculation = /求|计算|solve|calculate|find|determine|多少|几|值|结果|浓度|体积|速度|加速度|概率|方程/.test(text);
  const asksJudgement = /正确|不正确|错误|符合|不符合|which|statement|best|判断|原因/.test(text);
  const conditionCount = Math.max(1, (stem.match(/[，,；;。.]|given|where|if/g) ?? []).length);
  const formulaCount = hasFormula ? Math.max(1, (text.match(/[=<>+\-*/^√]|\\frac|\\sqrt/g) ?? []).length) : 0;
  const reasoningStepCount = asksCalculation && hasFormula && hasNumbers ? 3 : hasFormula || hasDiagram || hasTable ? 2 : 1;
  const calculationLoad = asksCalculation && formulaCount > 1 ? 'medium' : asksCalculation && hasNumbers ? 'light' : 'none';
  const readingLoad = stem.length > 260 || conditionCount >= 5 || hasTable ? 'high' : stem.length > 120 || conditionCount >= 3 || hasScenario ? 'medium' : 'low';
  const questionForm = hasDiagram
    ? 'graph_interpretation'
    : hasTable
      ? 'table_interpretation'
      : asksCalculation
        ? 'formula_calculation'
        : asksJudgement
          ? 'concept_identification'
          : 'definition';
  return {
    cognitiveSkill: asksCalculation ? 'calculation' : asksJudgement ? 'concept_identification' : 'recall',
    difficultyBand: reasoningStepCount >= 3 ? 'medium' as const : 'basic' as const,
    difficultyEvidence: asksCalculation && hasFormula ? 'inferred_from_formula_and_calculation_signals' : 'inferred_from_stem_signals',
    questionForm,
    readingLoad: readingLoad as NormalizedQuestionProfile['readingLoad'],
    calculationLoad: calculationLoad as NormalizedQuestionProfile['calculationLoad'],
    estimatedTimeSeconds: readingLoad === 'high' || calculationLoad === 'medium' ? 120 : readingLoad === 'medium' || calculationLoad === 'light' ? 75 : 45,
    reasoningStepCount,
    stemPattern: {
      textLengthBand: stem.length > 260 ? 'long' as const : stem.length > 120 ? 'medium' as const : stem ? 'short' as const : 'unknown' as const,
      conditionCount,
      hasScenario,
      hasFormula,
      hasDiagram,
      hasTable,
      hasUnitConversion,
      hasIrrelevantCondition: false
    },
    optionPattern: {
      optionStyle: /\d/.test(options) ? 'numeric' : options ? 'concept_text' : 'unknown',
      distractorTypes: asksCalculation ? ['calculation_error', 'condition_misread'] : ['concept_confusion'],
      commonMisconceptions: []
    },
    loadEvidence: {
      stemCharCount: stem.length || null,
      optionCharCount: options.length || null,
      formulaCount,
      operationCount: asksCalculation ? reasoningStepCount : 0,
      requiresAlgebraTransform: asksCalculation && hasFormula,
      requiresGraphReading: hasDiagram,
      requiresTableReading: hasTable,
      crossTopicCount: null
    }
  };
}

function topicIdsFrom(source: SourceQuestionProfileInput['sourceQuestion'], profile: Record<string, unknown>, analysis: Record<string, unknown>) {
  const ids = [
    ...((Array.isArray(profile.topicIds) ? profile.topicIds : Array.isArray(analysis.topicIds) ? analysis.topicIds : []) as unknown[]),
    source?.topicId
  ]
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0);
  return Array.from(new Set(ids));
}

function profileIssuesFrom(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const record = recordFrom(item);
      return cleanString(record.code ?? record.message ?? item);
    })
    .filter(Boolean);
}

export function normalizeSourceQuestionAnalysis(input: SourceQuestionProfileInput): NormalizedQuestionProfile {
  const analysis = recordFrom(input.analysis);
  const profile = recordFrom(analysis.profile);
  const inferred = inferFromSource(input.sourceQuestion);
  const analysisStemPattern = recordFrom(analysis.stemPattern);
  const profileStemPattern = recordFrom(profile.stemPattern);
  const stemPattern: Record<string, unknown> = { ...inferred.stemPattern, ...analysisStemPattern, ...profileStemPattern };
  const optionPattern: Record<string, unknown> = { ...inferred.optionPattern, ...recordFrom(analysis.optionPattern), ...recordFrom(profile.optionPattern) };
  const loadEvidence: Record<string, unknown> = { ...inferred.loadEvidence, ...recordFrom(analysis.loadEvidence), ...recordFrom(profile.loadEvidence) };
  const topicIds = topicIdsFrom(input.sourceQuestion, profile, analysis);
  const difficultyBand = normalizeDifficulty(profile.difficultyBand ?? profile.difficulty ?? analysis.difficultyBand ?? analysis.difficulty ?? analysis.designedDifficulty);
  const readingLoad = normalizeReadingLoad(profile.readingLoad ?? analysis.readingLoad ?? profileStemPattern.readingLoad ?? profileStemPattern.length ?? analysisStemPattern.readingLoad ?? analysisStemPattern.length);
  const calculationLoad = normalizeCalculationLoad(profile.calculationLoad ?? analysis.calculationLoad);
  const issues = [
    ...profileIssuesFrom(input.sourceQuestion?.analysisIssues),
    ...profileIssuesFrom(analysis.profileIssues),
    ...profileIssuesFrom(profile.profileIssues)
  ];
  const profileConfidence = normalizeConfidence(profile.profileConfidence ?? analysis.profileConfidence ?? input.sourceQuestion?.analysisConfidence, topicIds.length ? 'medium' : 'low');
  return {
    schemaVersion: 'source-question-profile-v2',
    subject: normalizeSubject(profile.subject ?? analysis.subject ?? input.sourceQuestion?.subject),
    syllabusVersion: cleanString(profile.syllabusVersion ?? analysis.syllabusVersion ?? input.sourceQuestion?.syllabusVersion, '2025'),
    sourceQuestionId: boundedNumber(profile.sourceQuestionId ?? input.sourceQuestion?.id, 1, Number.MAX_SAFE_INTEGER),
    topicIds,
    primaryTopicId: boundedNumber(profile.primaryTopicId ?? analysis.primaryTopicId ?? input.sourceQuestion?.topicId, 1, Number.MAX_SAFE_INTEGER),
    topicConfidence: normalizeTopicConfidence(profile.topicConfidence ?? analysis.topicConfidence, topicIds.length ? 'medium' : 'none'),
    questionForm: meaningfulString(profile.questionForm ?? analysis.questionForm, inferred.questionForm),
    cognitiveSkill: meaningfulString(profile.cognitiveSkill ?? analysis.cognitiveSkill, inferred.cognitiveSkill),
    difficultyBand: difficultyBand === 'unknown' ? inferred.difficultyBand : difficultyBand,
    difficultyEvidence: meaningfulString(profile.difficultyEvidence ?? analysis.difficultyEvidence, inferred.difficultyEvidence),
    readingLoad: readingLoad === 'unknown' ? inferred.readingLoad : readingLoad,
    calculationLoad: calculationLoad === 'unknown' ? inferred.calculationLoad : calculationLoad,
    estimatedTimeSeconds: positiveNumber(profile.estimatedTimeSeconds ?? analysis.estimatedTimeSeconds) ?? inferred.estimatedTimeSeconds,
    reasoningStepCount: boundedNumber(profile.reasoningStepCount ?? analysis.reasoningStepCount ?? analysis.reasoningSteps, 1, 12) ?? inferred.reasoningStepCount,
    stemPattern: {
      textLengthBand: normalizeTextLengthBand(stemPattern.textLengthBand, inferred.stemPattern.textLengthBand),
      conditionCount: boundedNumber(stemPattern.conditionCount, 0, 30) ?? inferred.stemPattern.conditionCount,
      hasScenario: booleanFrom(stemPattern.hasScenario),
      hasFormula: booleanFrom(stemPattern.hasFormula),
      hasDiagram: booleanFrom(stemPattern.hasDiagram),
      hasTable: booleanFrom(stemPattern.hasTable),
      hasUnitConversion: booleanFrom(stemPattern.hasUnitConversion),
      hasIrrelevantCondition: booleanFrom(stemPattern.hasIrrelevantCondition)
    },
    optionPattern: {
      optionStyle: meaningfulString(optionPattern.optionStyle, inferred.optionPattern.optionStyle),
      distractorTypes: optionalStringArray(optionPattern.distractorTypes).length
        ? optionalStringArray(optionPattern.distractorTypes)
        : inferred.optionPattern.distractorTypes,
      commonMisconceptions: optionalStringArray(optionPattern.commonMisconceptions)
    },
    loadEvidence: {
      stemCharCount: positiveNumber(loadEvidence.stemCharCount) ?? inferred.loadEvidence.stemCharCount,
      optionCharCount: positiveNumber(loadEvidence.optionCharCount) ?? inferred.loadEvidence.optionCharCount,
      formulaCount: boundedNumber(loadEvidence.formulaCount, 0, 20) ?? inferred.loadEvidence.formulaCount,
      operationCount: boundedNumber(loadEvidence.operationCount, 0, 30) ?? inferred.loadEvidence.operationCount,
      requiresAlgebraTransform: booleanFrom(loadEvidence.requiresAlgebraTransform),
      requiresGraphReading: booleanFrom(loadEvidence.requiresGraphReading),
      requiresTableReading: booleanFrom(loadEvidence.requiresTableReading),
      crossTopicCount: boundedNumber(loadEvidence.crossTopicCount, 0, 10) ?? inferred.loadEvidence.crossTopicCount
    },
    styleNotes: optionalStringArray(profile.styleNotes ?? analysis.styleNotes).length
      ? optionalStringArray(profile.styleNotes ?? analysis.styleNotes)
      : ['rule_inferred'],
    similarityRiskSignals: optionalStringArray(profile.similarityRiskSignals ?? analysis.similarityRiskSignals ?? analysis.doNotCopySignals),
    profileConfidence,
    profileIssues: issues
  };
}

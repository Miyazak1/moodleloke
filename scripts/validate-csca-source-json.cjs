#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const SUBJECTS = new Set(['math', 'physics', 'chemistry']);
const SOURCE_TYPES = new Set(['past_paper']);
const SOURCE_TYPE_ALIASES = new Map([
  ['pastpaper', 'past_paper'],
  ['past_papers', 'past_paper'],
  ['official_paper', 'past_paper'],
  ['real_exam', 'past_paper']
]);
const DIFFICULTIES = new Set(['basic', 'medium', 'hard']);
const CALCULATION_LOADS = new Set(['none', 'light', 'medium', 'heavy']);
const REVIEW_STATUSES = new Set(['needs_review', 'parsed', 'mapped', 'approved', 'rejected']);
const ANALYSIS_STATUSES = new Set(['ai_parsed', 'human_confirmed', 'needs_review']);

function usage() {
  console.log('Usage: node scripts/validate-csca-source-json.cjs <path-to-source-json>');
}

function readJson(filePath) {
  const absolutePath = path.resolve(process.cwd(), filePath);
  const text = fs.readFileSync(absolutePath, 'utf8');
  return { absolutePath, value: JSON.parse(text) };
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function text(value) {
  return String(value ?? '').trim();
}

function normalizedSourceType(value) {
  const raw = text(value).toLowerCase().replace(/[\s-]+/g, '_');
  return SOURCE_TYPE_ALIASES.get(raw) || raw;
}

function number(value) {
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
}

function sourceTextQualityIssues({ promptText, options, explanation }) {
  const issues = [];
  const fields = [
    { label: 'promptText', value: text(promptText) },
    { label: 'explanation', value: text(explanation) }
  ];
  if (Array.isArray(options)) {
    options.forEach((option, index) => {
      const record = isRecord(option) ? option : {};
      fields.push({ label: `options[${index}].text`, value: text(record.text) });
    });
  }
  const artifactGlyphPattern = /[ǅǆǊǒǜǝƫƬƭƮƺư]/;
  const watermarkPattern = /\b(CSCA\s+Academy|Sold\s+to|misakitoufu@gmail\.com)\b/i;
  const duplicateExpressionPattern = /([A-Za-z]\s*[=∈:]?\s*[\{\(\[][^。；;,.，]{3,80}[\}\)\]])\s*\1/;
  const lostSuperscriptPattern = /\b[xyz][234]\b/;
  for (const field of fields) {
    if (!field.value) continue;
    if (artifactGlyphPattern.test(field.value)) issues.push(`${field.label} 包含 PDF 字体编码乱码。`);
    if (watermarkPattern.test(field.value)) issues.push(`${field.label} 包含水印或购买账号残留。`);
    if (duplicateExpressionPattern.test(field.value)) issues.push(`${field.label} 疑似存在公式/集合表达式重复抽取。`);
    if (lostSuperscriptPattern.test(field.value)) issues.push(`${field.label} 疑似存在上标丢失，例如 x2/y2 应写为 x^2/y^2 或对应 LaTeX。`);
  }
  return Array.from(new Set(issues));
}

function validateOptionIds(options, correctAnswer, prefix, errors, warnings) {
  if (!Array.isArray(options) || options.length < 2) {
    errors.push(`${prefix}.options 至少需要 2 个选项。`);
    return;
  }
  const seen = new Set();
  for (const [index, option] of options.entries()) {
    if (!isRecord(option)) {
      errors.push(`${prefix}.options[${index}] 必须是对象。`);
      continue;
    }
    const id = text(option.id);
    const optionText = text(option.text);
    if (!id) errors.push(`${prefix}.options[${index}].id 不能为空。`);
    if (!optionText) errors.push(`${prefix}.options[${index}].text 不能为空。`);
    if (id && seen.has(id)) errors.push(`${prefix}.options 里存在重复选项 ID：${id}`);
    if (id) seen.add(id);
  }
  if (correctAnswer && !seen.has(correctAnswer)) {
    errors.push(`${prefix}.correctAnswer 必须匹配某个 options[].id。`);
  }
  if (options.length !== 4) {
    warnings.push(`${prefix}.options 当前为 ${options.length} 个选项；CSCA 单选题通常应为 4 个选项。`);
  }
}

function validateAnalysis(analysis, prefix, errors, warnings) {
  if (!isRecord(analysis)) {
    errors.push(`${prefix}.analysis 必须是对象。`);
    return;
  }
  if (!text(analysis.cognitiveSkill)) errors.push(`${prefix}.analysis.cognitiveSkill 不能为空。`);
  if (!DIFFICULTIES.has(text(analysis.difficulty))) errors.push(`${prefix}.analysis.difficulty 必须是 basic/medium/hard。`);
  if (!text(analysis.difficultyEvidence)) warnings.push(`${prefix}.analysis.difficultyEvidence 建议填写，方便画像解释难度。`);
  if (!text(analysis.questionForm)) errors.push(`${prefix}.analysis.questionForm 不能为空。`);
  if (!CALCULATION_LOADS.has(text(analysis.calculationLoad))) errors.push(`${prefix}.analysis.calculationLoad 必须是 none/light/medium/heavy。`);
  const reasoningSteps = number(analysis.reasoningSteps);
  if (reasoningSteps === null || reasoningSteps < 1 || reasoningSteps > 8) errors.push(`${prefix}.analysis.reasoningSteps 必须是 1-8 的数字。`);
  const stemPattern = analysis.stemPattern;
  if (!isRecord(stemPattern)) {
    warnings.push(`${prefix}.analysis.stemPattern 建议填写，用于画像统计题干形态。`);
  }
  const optionPattern = analysis.optionPattern;
  if (!isRecord(optionPattern)) {
    warnings.push(`${prefix}.analysis.optionPattern 建议填写，用于画像统计选项和干扰项。`);
  } else if (!Array.isArray(optionPattern.distractorTypes) || optionPattern.distractorTypes.length === 0) {
    warnings.push(`${prefix}.analysis.optionPattern.distractorTypes 建议至少填写 1 个。`);
  }
}

function validatePayload(payload) {
  const errors = [];
  const warnings = [];
  if (!isRecord(payload)) {
    return { errors: ['JSON 顶层必须是对象。'], warnings };
  }
  const document = payload.document;
  if (!isRecord(document)) {
    errors.push('document 必须是对象。');
  } else {
    const subject = text(document.subject);
    if (!SUBJECTS.has(subject)) errors.push('document.subject 必须是 math/physics/chemistry。');
    if (!text(document.title)) errors.push('document.title 不能为空。');
    const sourceType = normalizedSourceType(document.sourceType);
    if (!sourceType) {
      errors.push('document.sourceType 不能为空。');
    } else if (!SOURCE_TYPES.has(sourceType)) {
      errors.push('document.sourceType 必须是 past_paper；AI 画像源只能来自真实真题。');
    }
    if (!text(document.syllabusVersion)) warnings.push('document.syllabusVersion 未填写，将由后台默认处理。');
    if (document.excludedQuestions !== undefined) {
      if (!Array.isArray(document.excludedQuestions)) {
        errors.push('document.excludedQuestions 必须是数组。');
      } else {
        for (const [index, item] of document.excludedQuestions.entries()) {
          if (!isRecord(item)) {
            errors.push(`document.excludedQuestions[${index}] 必须是对象。`);
            continue;
          }
          if (!text(item.questionNumber || item.number || item.q)) {
            errors.push(`document.excludedQuestions[${index}].questionNumber 不能为空。`);
          }
          if (!text(item.reason)) {
            warnings.push(`document.excludedQuestions[${index}].reason 建议填写，便于后台展示缺题原因。`);
          }
        }
      }
    }
    const usagePolicy = document.usagePolicy;
    if (!isRecord(usagePolicy)) {
      warnings.push('document.usagePolicy 建议填写，确保 allowStyleExtraction/allowSimilarityCheck 明确。');
    } else {
      if (usagePolicy.allowStyleExtraction !== true) warnings.push('usagePolicy.allowStyleExtraction 不是 true，导入后可能无法生成画像。');
      if (usagePolicy.allowSimilarityCheck !== true) warnings.push('usagePolicy.allowSimilarityCheck 不是 true，后续相似度检查信息可能不完整。');
    }
  }

  if (!Array.isArray(payload.questions) || payload.questions.length === 0) {
    errors.push('questions 必须是非空数组。');
    return { errors, warnings };
  }
  if (payload.questions.length > 300) errors.push('questions 单次最多 300 道。');
  const excludedCount = isRecord(document) && Array.isArray(document.excludedQuestions) ? document.excludedQuestions.length : 0;
  const explicitExpected = isRecord(document)
    ? Number(document.expectedQuestionCount ?? document.totalQuestionCount ?? document.questionCount ?? document.expectedQuestions)
    : NaN;
  const expectedCount = Number.isInteger(explicitExpected) && explicitExpected > 0
    ? explicitExpected
    : excludedCount > 0
      ? payload.questions.length + excludedCount
      : payload.questions.length;
  if (expectedCount !== payload.questions.length && excludedCount === 0) {
    warnings.push(`questions 当前 ${payload.questions.length}/${expectedCount}，但没有 document.excludedQuestions 说明缺题。`);
  }
  if (excludedCount > 0 && payload.questions.length + excludedCount < expectedCount) {
    warnings.push(`questions 当前 ${payload.questions.length}/${expectedCount}，已说明缺题 ${excludedCount} 道，但仍有未说明缺口。`);
  }

  const seenNumbers = new Set();
  for (const [index, question] of payload.questions.entries()) {
    const prefix = `questions[${index}]`;
    if (!isRecord(question)) {
      errors.push(`${prefix} 必须是对象。`);
      continue;
    }
    const questionNumber = text(question.questionNumber);
    const promptText = text(question.promptText || question.prompt);
    const correctAnswer = text(question.correctAnswer);
    if (!questionNumber) errors.push(`${prefix}.questionNumber 不能为空。`);
    if (questionNumber && seenNumbers.has(questionNumber)) errors.push(`questionNumber 重复：${questionNumber}`);
    if (questionNumber) seenNumbers.add(questionNumber);
    if (!promptText) errors.push(`${prefix}.promptText 不能为空。`);
    if (!correctAnswer) errors.push(`${prefix}.correctAnswer 不能为空。`);
    const qualityIssues = sourceTextQualityIssues({
      promptText,
      options: question.options,
      explanation: question.explanation
    });
    qualityIssues.forEach((issue) => errors.push(`${prefix}.${issue}`));
    validateOptionIds(question.options, correctAnswer, prefix, errors, warnings);
    if (!text(question.explanation)) warnings.push(`${prefix}.explanation 为空；建议写人工简析。`);
    const topicCodes = Array.isArray(question.topicCodes) ? question.topicCodes.filter((item) => text(item)) : [];
    if (topicCodes.length === 0 && text(question.reviewStatus) === 'mapped') {
      warnings.push(`${prefix}.reviewStatus 是 mapped，但 topicCodes 为空；后台会要求人工映射。`);
    }
    const reviewStatus = text(question.reviewStatus || 'parsed');
    if (!REVIEW_STATUSES.has(reviewStatus)) errors.push(`${prefix}.reviewStatus 无效。`);
    const analysisStatus = text(question.analysisStatus || 'ai_parsed');
    if (!ANALYSIS_STATUSES.has(analysisStatus)) warnings.push(`${prefix}.analysisStatus 非常规值：${analysisStatus}`);
    const confidence = number(question.analysisConfidence);
    if (confidence !== null && (confidence < 0 || confidence > 1)) errors.push(`${prefix}.analysisConfidence 必须在 0-1 之间。`);
    validateAnalysis(question.analysis, prefix, errors, warnings);
  }

  return { errors, warnings };
}

function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    usage();
    process.exit(2);
  }
  try {
    const { absolutePath, value } = readJson(filePath);
    const { errors, warnings } = validatePayload(value);
    console.log(`CSCA source JSON: ${absolutePath}`);
    console.log(`Questions: ${Array.isArray(value.questions) ? value.questions.length : 0}`);
    if (warnings.length) {
      console.log(`Warnings (${warnings.length}):`);
      warnings.slice(0, 30).forEach((warning) => console.log(`- ${warning}`));
      if (warnings.length > 30) console.log(`- ... ${warnings.length - 30} more`);
    }
    if (errors.length) {
      console.error(`Errors (${errors.length}):`);
      errors.slice(0, 50).forEach((error) => console.error(`- ${error}`));
      if (errors.length > 50) console.error(`- ... ${errors.length - 50} more`);
      process.exit(1);
    }
    console.log('OK: source JSON is ready for admin import.');
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();

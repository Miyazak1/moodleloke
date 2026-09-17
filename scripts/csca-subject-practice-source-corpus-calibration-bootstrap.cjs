#!/usr/bin/env node

if (!require.extensions['.ts']) {
  require('../backend/node_modules/ts-node').register({
    transpileOnly: true,
    compilerOptions: { module: 'commonjs', moduleResolution: 'node' }
  });
}

const crypto = require('node:crypto');
const { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } = require('node:fs');
const { dirname, isAbsolute, relative, resolve, sep } = require('node:path');
const {
  SUBJECT_PRACTICE_SOURCE_CORPUS_THRESHOLDS,
  normalizeSubjectPracticeSourceCorpusText,
  scanSubjectPracticeContentAgainstSourceCorpus
} = require('../backend/src/ai-questioning/subject-practice-source-corpus-scan-policy');
const {
  classifySubjectPracticeSourceCorpusCalibrationLength,
  scoreSubjectPracticeSourceCorpusCalibration
} = require('../backend/src/ai-questioning/subject-practice-source-corpus-calibration-policy');
const {
  subjectPracticeSourceCorpusStructureShadowMatch
} = require('../backend/src/ai-questioning/subject-practice-source-corpus-structure-shadow-policy');

const MODE = 'subject_practice_source_corpus_calibration_bootstrap_v3';
const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');
const text = (value) => String(value ?? '').trim();

function canonicalJsonValue(value) {
  if (Array.isArray(value)) return value.map(canonicalJsonValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalJsonValue(entry)]));
  }
  return value;
}

function argsFrom(argv) {
  const result = {};
  for (const token of argv) {
    if (!token.startsWith('--')) continue;
    const [key, ...rest] = token.slice(2).split('=');
    result[key] = rest.length ? rest.join('=') : true;
  }
  return result;
}

function workspaceOutputPath(value, workspaceRoot = process.cwd()) {
  const root = resolve(workspaceRoot);
  const target = resolve(root, text(value));
  const rel = relative(root, target);
  if (!text(value) || !rel || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    throw new Error('source_corpus_calibration_output_must_be_inside_workspace');
  }
  if (!target.toLowerCase().endsWith('.json')) throw new Error('source_corpus_calibration_output_must_be_json');
  if (existsSync(target)) throw new Error('source_corpus_calibration_refuses_to_overwrite');
  return target;
}

function sourceFiles(workspaceRoot) {
  const docs = resolve(workspaceRoot, 'docs');
  return readdirSync(docs).filter((name) => /-source\.json$/i.test(name)
    && name !== 'csca-past-paper-source-json-template.json').map((name) => resolve(docs, name)).sort();
}

function optionText(question) {
  return (Array.isArray(question.options) ? question.options : [])
    .map((option) => `${text(option.id)}:${text(option.text ?? option.content)}`).filter((value) => value !== ':').join('\n');
}

function correctAnswerText(question) {
  const answer = text(question.correctAnswer ?? question.answer);
  const option = (Array.isArray(question.options) ? question.options : [])
    .find((entry) => text(entry.id) === answer);
  return [answer, text(option?.text ?? option?.content)].filter(Boolean).join(':');
}

function fieldValues(question) {
  return {
    prompt: text(question.prompt ?? question.promptText),
    options: optionText(question),
    answer: correctAnswerText(question),
    explanation: text(question.explanation),
    localizations: text(question.localizations ? JSON.stringify(question.localizations) : '')
  };
}

function loadQuestions(workspaceRoot = process.cwd()) {
  const records = [];
  for (const file of sourceFiles(workspaceRoot)) {
    const parsed = JSON.parse(readFileSync(file, 'utf8'));
    const document = parsed.document ?? {};
    if (document.usagePolicy?.allowSimilarityCheck === false) continue;
    const subject = text(document.subject).toLowerCase();
    const documentLanguage = text(document.language).toLowerCase();
    for (const [index, question] of (parsed.questions ?? []).entries()) {
      const language = text(question.language).toLowerCase() || documentLanguage;
      const sourceQuestionId = `${relative(workspaceRoot, file).replace(/\\/g, '/')}#${text(question.questionNumber) || index + 1}`;
      const sourceFamilyId = sha256(`${text(document.sourceHash) || relative(workspaceRoot, file)}:${text(question.questionNumber) || index + 1}`);
      records.push({
        subject, language, sourceQuestionId, sourceFamilyId,
        sourceLineageId: sourceFamilyId,
        split: Number.parseInt(sourceFamilyId.slice(0, 2), 16) % 5 === 0 ? 'test' : 'calibration',
        fields: fieldValues(question),
        sourceDocumentId: text(document.sourceHash) || sha256(relative(workspaceRoot, file)),
        topicCodes: Array.isArray(question.topicCodes) ? question.topicCodes.map(text).filter(Boolean).sort() : [],
        questionForm: text(question.analysis?.questionForm),
        difficulty: text(question.analysis?.difficulty),
        sourceType: text(document.sourceType)
      });
    }
  }
  return records;
}

function formatMutation(value) {
  return Array.from(value).map((character, index) => index > 0 && index % 7 === 0 ? ` , ${character}` : character).join('');
}

function numericMutation(value) {
  let changed = false;
  const output = value.replace(/\d+(?:\.\d+)?/, (match) => {
    changed = true;
    return String(Number(match) + 1);
  });
  return changed ? output : null;
}

function predictionsFor(candidateText, sourceText) {
  const metrics = scanSubjectPracticeContentAgainstSourceCorpus({
    targetFields: [{ field: 'candidate', text: candidateText }], sourceTexts: [sourceText]
  });
  return { predictedAction: metrics.matchedCount ? 'reject' : 'allow', metrics };
}

function makeExample(base, input) {
  const prediction = predictionsFor(input.candidateText, input.sourceText);
  const structureShadow = subjectPracticeSourceCorpusStructureShadowMatch({
    sourceField: input.sourceField, sourceText: input.sourceText, candidateText: input.candidateText
  });
  const sourceNormalizedCharacterCount = normalizeSubjectPracticeSourceCorpusText(input.sourceText).length;
  const targetNormalizedCharacterCount = normalizeSubjectPracticeSourceCorpusText(input.candidateText).length;
  return {
    id: sha256(`${base.sourceQuestionId}:${input.sourceField}:${input.derivationId}`).slice(0, 32),
    subject: base.subject, language: base.language, sourceField: input.sourceField,
    sourceLengthBucket: classifySubjectPracticeSourceCorpusCalibrationLength(sourceNormalizedCharacterCount),
    sourceNormalizedCharacterCount,
    targetLengthBucket: classifySubjectPracticeSourceCorpusCalibrationLength(targetNormalizedCharacterCount),
    targetNormalizedCharacterCount,
    truthLabel: input.truthLabel, expectedAction: input.expectedAction,
    predictedAction: prediction.predictedAction, labelProvenance: input.labelProvenance,
    sourceQuestionId: base.sourceQuestionId,
    candidateQuestionId: `${base.sourceQuestionId}:${input.derivationId}`,
    sourceFamilyId: base.sourceFamilyId,
    candidateFamilyId: input.candidateFamilyId ?? base.sourceFamilyId,
    sourceLineageId: input.sourceLineageId ?? base.sourceLineageId,
    candidateLineageId: input.candidateLineageId ?? base.sourceLineageId,
    derivationId: input.derivationId, mutationChain: input.mutationChain,
    languageRelation: input.languageRelation ?? 'same_language',
    fieldRelation: input.fieldRelation ?? 'same_field',
    expectedInvariances: input.expectedInvariances,
    split: base.split,
    sourceContentSha256: sha256(input.sourceText), candidateContentSha256: sha256(input.candidateText),
    scannerMetrics: prediction.metrics,
    structureShadow
  };
}

function buildBootstrap(workspaceRoot = process.cwd()) {
  const questions = loadQuestions(workspaceRoot);
  const examples = [];
  for (const question of questions) {
    for (const [sourceField, sourceText] of Object.entries(question.fields)) {
      if (!sourceText) continue;
      if (normalizeSubjectPracticeSourceCorpusText(sourceText).length
        < SUBJECT_PRACTICE_SOURCE_CORPUS_THRESHOLDS.minimumComparableCharacters) {
        examples.push(makeExample(question, {
          sourceField, sourceText, candidateText: sourceText,
          truthLabel: 'ambiguous_excluded', expectedAction: 'exclude', labelProvenance: 'mutation_proven',
          derivationId: 'short-common-field-value', mutationChain: ['short_common_field_value'],
          expectedInvariances: ['short_answer_or_standard_token_not_sufficient_for_duplicate_claim']
        }));
        continue;
      }
      const mutations = [
        { derivationId: 'verbatim', candidateText: sourceText, truthLabel: 'exact_or_format_duplicate', mutationChain: ['verbatim_copy'] },
        { derivationId: 'format', candidateText: formatMutation(sourceText), truthLabel: 'exact_or_format_duplicate', mutationChain: ['punctuation_spacing_or_latex_change'] },
        { derivationId: 'embedded', candidateText: `${'independent context '.repeat(40)} ${sourceText}`, truthLabel: 'near_duplicate_same_source', mutationChain: ['short_source_in_long_text'] }
      ];
      const numeric = numericMutation(sourceText);
      if (numeric) mutations.push({
        derivationId: 'numeric', candidateText: numeric,
        truthLabel: 'structural_duplicate', mutationChain: ['light_numeric_change']
      });
      if (sourceField === 'options') mutations.push({
        derivationId: 'option-reorder', candidateText: sourceText.split('\n').reverse().join('\n'),
        truthLabel: 'near_duplicate_same_source', mutationChain: ['option_reordering', 'answer_position_change']
      });
      for (const mutation of mutations) examples.push(makeExample(question, {
        sourceField, sourceText, ...mutation, expectedAction: 'reject', labelProvenance: 'mutation_proven',
        expectedInvariances: ['source_lineage', 'question_semantics_or_source_content']
      }));
    }
  }

  const score = scoreSubjectPracticeSourceCorpusCalibration({ datasetOrigin: 'local_partial_inventory', examples });
  const payload = {
    schemaVersion: 'subject-practice-source-corpus-calibration-bootstrap-v3',
    mode: MODE,
    datasetOrigin: 'local_partial_inventory',
    sourceQuestionCount: questions.length,
    sourceFileCount: sourceFiles(workspaceRoot).length,
    exampleCount: examples.length,
    examples,
    score
  };
  return { ...payload, payloadSha256: sha256(JSON.stringify(canonicalJsonValue(payload))) };
}

function summaryFor(dataset) {
  const byDerivation = {};
  for (const example of dataset.examples.filter((entry) => entry.expectedAction === 'reject')) {
    const key = example.mutationChain.join('+');
    const row = byDerivation[key] ?? { count: 0, falseNegativeCount: 0, combinedShadowFalseNegativeCount: 0 };
    row.count += 1;
    if (example.predictedAction === 'allow') row.falseNegativeCount += 1;
    if (example.predictedAction === 'allow' && !example.structureShadow.matched) {
      row.combinedShadowFalseNegativeCount += 1;
    }
    byDerivation[key] = row;
  }
  for (const row of Object.values(byDerivation)) {
    row.falseNegativeRate = row.count ? row.falseNegativeCount / row.count : null;
    row.combinedShadowFalseNegativeRate = row.count ? row.combinedShadowFalseNegativeCount / row.count : null;
  }
  return {
    mode: MODE, status: 'local_partial_calibration_built_nonqualifying',
    sourceQuestionCount: dataset.sourceQuestionCount, sourceFileCount: dataset.sourceFileCount,
    exampleCount: dataset.exampleCount, payloadSha256: dataset.payloadSha256,
    score: {
      policyVersion: dataset.score.policyVersion, status: dataset.score.status,
      thresholdFreezeReviewEligible: dataset.score.thresholdFreezeReviewEligible,
      calibrationQualityQualified: dataset.score.calibrationQualityQualified,
      dataReasonCodes: dataset.score.dataReasonCodes,
      qualityReasonCodes: dataset.score.qualityReasonCodes,
      rejectPerformanceByDerivation: byDerivation,
      missingCells: dataset.score.missingCells, thinCells: dataset.score.thinCells,
      cells: dataset.score.cells
    },
    providerImpact: 'none_no_provider_call', dbImpact: 'none_local_files_only',
    productionImpact: 'none_calibration_shadow_only'
  };
}

function main() {
  const args = argsFrom(process.argv.slice(2));
  const dataset = buildBootstrap(process.cwd());
  const summary = summaryFor(dataset);
  if (args.out) {
    const outputPath = workspaceOutputPath(args.out);
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, `${JSON.stringify(dataset, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    summary.outputPath = outputPath;
  }
  return summary;
}

if (require.main === module) {
  try { process.stdout.write(`${JSON.stringify(main(), null, 2)}\n`); }
  catch (error) { process.stderr.write(`${error?.stack ?? error}\n`); process.exitCode = 1; }
}

module.exports = { argsFrom, workspaceOutputPath, loadQuestions, buildBootstrap, summaryFor };

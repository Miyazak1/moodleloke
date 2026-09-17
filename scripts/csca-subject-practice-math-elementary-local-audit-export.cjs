#!/usr/bin/env node

require('../backend/node_modules/ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', moduleResolution: 'node' }
});

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {
  SUBJECT_PRACTICE_MATH_ELEMENTARY_LOCAL_GENERATOR_VERSION,
  generateSubjectPracticeMathElementaryLocally
} = require('../backend/src/ai-questioning/subject-practice-math-elementary-local-generator');
const {
  buildSubjectPracticeQuestionPlan,
  subjectPracticeQuestionPlanAdherenceFor
} = require('../backend/src/ai-questioning/subject-practice-question-plan-policy');

const AUDIT_PROTOCOL_VERSION = 'math-elementary-local-blind-audit-v1';
const slots = [
  ['logarithmic', 'domain'],
  ['exponential', 'range'],
  ['radical', 'monotonicity'],
  ['power', 'function_value']
];

const blueprint = {
  id: 16,
  subject: 'math',
  topicId: 69,
  topicCode: 'M-FUN-002',
  topicModule: '函数',
  topicTitle: '基本初等函数',
  syllabusVersion: '2025',
  examScope: '幂函数、指数函数、对数函数和根式函数的基本性质。',
  allowedQuestionTypes: ['single_choice'],
  difficultyRange: ['basic'],
  excludedScope: [],
  difficulty: 'basic',
  questionType: 'single_choice',
  skill: 'concept_identification',
  constraints: {}
};

function sha256(value) {
  return crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
}

function optionTexts(candidate) {
  return candidate.options.map((option) => option.text);
}

function questionPlan(functionClass, propertyTarget) {
  return buildSubjectPracticeQuestionPlan({
    subject: 'math',
    topicId: 69,
    topicTitle: '基本初等函数',
    productionCellId: 16,
    targetDifficulty: 'basic',
    taskFamily: 'elementary_function_direct_property',
    requiredElementaryFunctionClass: functionClass,
    requiredSinglePropertyTarget: propertyTarget
  });
}

function publicLocalization(localization) {
  return {
    prompt: localization?.prompt ?? '',
    options: Array.isArray(localization?.options)
      ? localization.options.map((option) => ({ id: option.id, text: option.text }))
      : []
  };
}

function buildAuditBatch({ countPerSlot = 32, auditPerSlot = 8, auditSeed = 'csca-math-elementary-local-audit-v1' } = {}) {
  if (!Number.isInteger(countPerSlot) || countPerSlot < 8 || countPerSlot > 256) throw new Error('count-per-slot must be an integer from 8 to 256.');
  if (!Number.isInteger(auditPerSlot) || auditPerSlot < 1 || auditPerSlot > countPerSlot) throw new Error('audit-per-slot must be an integer from 1 to count-per-slot.');
  const generatedPool = [];
  for (const [functionClass, propertyTarget] of slots) {
    const plan = questionPlan(functionClass, propertyTarget);
    for (let seed = 0; seed < countPerSlot; seed += 1) {
      const generated = generateSubjectPracticeMathElementaryLocally({ blueprint, questionPlan: plan, seed });
      if (generated.status !== 'generated_and_self_verified' || !generated.candidate) {
        throw new Error(`Local generation failed for ${functionClass}:${propertyTarget}:${seed}.`);
      }
      const adherence = subjectPracticeQuestionPlanAdherenceFor(plan, generated.candidate);
      if (!adherence.adheres) throw new Error(`QuestionPlan adherence failed for ${functionClass}:${propertyTarget}:${seed}: ${adherence.failureCodes.join(',')}`);
      const semanticFingerprint = sha256({
        prompt: generated.candidate.prompt,
        optionTextsIgnoringPosition: optionTexts(generated.candidate).sort()
      });
      generatedPool.push({
        functionClass,
        propertyTarget,
        seed,
        scopeId: generated.scopeId,
        semanticFingerprint,
        selectionRank: sha256(`${auditSeed}:${semanticFingerprint}`),
        candidate: generated.candidate,
        verification: generated.verification
      });
    }
  }
  if (new Set(generatedPool.map((item) => item.semanticFingerprint)).size !== generatedPool.length) {
    throw new Error('Generated pool contains a position-independent semantic duplicate.');
  }
  const selected = slots.flatMap(([functionClass, propertyTarget]) => generatedPool
    .filter((item) => item.functionClass === functionClass && item.propertyTarget === propertyTarget)
    .sort((left, right) => left.selectionRank.localeCompare(right.selectionRank))
    .slice(0, auditPerSlot));
  const selectedWithIds = selected.map((item) => ({
    ...item,
    candidateId: `local-${item.functionClass}-${item.propertyTarget}-${item.semanticFingerprint.slice(0, 16)}`
  }));
  const blindReviewPacket = {
    auditProtocolVersion: AUDIT_PROTOCOL_VERSION,
    evidenceClass: 'generator_blind_human_audit_not_official_holdout',
    reviewerInstructions: {
      answerKeyMustRemainHidden: true,
      requiredPerQuestionFields: ['selectedOptionId', 'isSolvable', 'hasUniqueCorrectAnswer', 'syllabusAligned', 'languageQuality', 'notes'],
      languageQualityValues: ['pass', 'minor_issue', 'fail'],
      releaseQualificationImpact: 'none_shadow_only'
    },
    questions: selectedWithIds.map((item) => ({
      candidateId: item.candidateId,
      scopeId: item.scopeId,
      functionClass: item.functionClass,
      propertyTarget: item.propertyTarget,
      designedDifficulty: item.candidate.designedDifficulty,
      questionType: item.candidate.questionType,
      prompt: item.candidate.prompt,
      options: item.candidate.options.map((option) => ({ id: option.id, text: option.text })),
      knowledgeTags: item.candidate.knowledgeTags,
      localizations: {
        zh: publicLocalization(item.candidate.localizations?.zh),
        en: publicLocalization(item.candidate.localizations?.en)
      },
      semanticFingerprint: item.semanticFingerprint
    }))
  };
  const answerKey = {
    auditProtocolVersion: AUDIT_PROTOCOL_VERSION,
    confidentiality: 'keep_separate_from_blind_reviewer_until_reviews_are_locked',
    answers: selectedWithIds.map((item) => ({
      candidateId: item.candidateId,
      correctAnswer: item.candidate.correctAnswer,
      explanation: item.candidate.explanation,
      explanationEn: item.candidate.localizations?.en?.explanation ?? null,
      deterministicVerification: item.verification
    }))
  };
  const reviewResponseTemplate = {
    auditProtocolVersion: AUDIT_PROTOCOL_VERSION,
    blindPacketSha256: sha256(blindReviewPacket),
    reviewerAttestation: {
      reviewerId: null,
      reviewedWithoutAnswerKey: null,
      lockedAt: null
    },
    reviews: selectedWithIds.map((item) => ({
      candidateId: item.candidateId,
      selectedOptionId: null,
      isSolvable: null,
      hasUniqueCorrectAnswer: null,
      syllabusAligned: null,
      languageQuality: null,
      notes: ''
    }))
  };
  const binding = {
    auditProtocolVersion: AUDIT_PROTOCOL_VERSION,
    generatorVersion: SUBJECT_PRACTICE_MATH_ELEMENTARY_LOCAL_GENERATOR_VERSION,
    auditSeed,
    countPerSlot,
    auditPerSlot,
    generatedPoolCount: generatedPool.length,
    selectedAuditCount: selectedWithIds.length,
    selectedCandidateIds: selectedWithIds.map((item) => item.candidateId)
  };
  const manifest = {
    ...binding,
    batchId: `math-elementary-local-audit-${sha256(binding).slice(0, 16)}`,
    status: 'shadow_blind_audit_packet_ready',
    providerImpact: 'none_no_provider_call',
    estimatedCostUsd: 0,
    dbImpact: 'none_no_database_connection',
    publicationImpact: 'none',
    releaseQualification: false,
    releaseQualificationReason: 'locally_generated_audit_data_is_not_a_sealed_official_holdout',
    blindPacketSha256: sha256(blindReviewPacket),
    answerKeySha256: sha256(answerKey),
    reviewResponseTemplateSha256: sha256(reviewResponseTemplate),
    scopeCounts: Object.fromEntries(slots.map(([functionClass, propertyTarget]) => [
      `${functionClass}:${propertyTarget}`,
      selectedWithIds.filter((item) => item.functionClass === functionClass && item.propertyTarget === propertyTarget).length
    ]))
  };
  return { manifest, blindReviewPacket, answerKey, reviewResponseTemplate };
}

function parseIntegerArg(name, fallback) {
  const prefix = `--${name}=`;
  const raw = process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value)) throw new Error(`${name} must be an integer.`);
  return value;
}

function assertSelfTest(condition, message) {
  if (!condition) throw new Error(message);
}

function runSelfTest() {
  const batch = buildAuditBatch({ countPerSlot: 8, auditPerSlot: 2, auditSeed: 'self-test' });
  assertSelfTest(batch.manifest.generatedPoolCount === 32, 'Self-test pool count mismatch.');
  assertSelfTest(batch.manifest.selectedAuditCount === 8, 'Self-test selected count mismatch.');
  assertSelfTest(Object.values(batch.manifest.scopeCounts).every((count) => count === 2), 'Self-test must be stratified by scope.');
  const blindText = JSON.stringify(batch.blindReviewPacket);
  assertSelfTest(!blindText.includes('correctAnswer'), 'Blind packet leaked correctAnswer.');
  assertSelfTest(!blindText.includes('explanation'), 'Blind packet leaked explanation.');
  assertSelfTest(!blindText.includes('optionMetadata'), 'Blind packet leaked optionMetadata.');
  assertSelfTest(batch.manifest.blindPacketSha256 === sha256(batch.blindReviewPacket), 'Blind packet hash binding failed.');
  assertSelfTest(batch.manifest.answerKeySha256 === sha256(batch.answerKey), 'Answer-key hash binding failed.');
  assertSelfTest(batch.reviewResponseTemplate.reviews.every((review) => review.selectedOptionId === null), 'Response template must be blank.');
  assertSelfTest(batch.reviewResponseTemplate.reviewerAttestation.reviewedWithoutAnswerKey === null, 'Reviewer attestation must be blank before handoff.');
  return {
    ...batch.manifest,
    mode: 'math_elementary_local_blind_audit_export_self_test',
    status: 'passed'
  };
}

function writeNewAuditDirectory(outDir, batch) {
  const root = path.resolve(__dirname, '..');
  const target = path.resolve(root, outDir);
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) throw new Error('out-dir must resolve inside the CSCALITE workspace.');
  if (target === root) throw new Error('out-dir cannot be the workspace root.');
  if (fs.existsSync(target)) throw new Error(`Refusing to overwrite existing audit directory: ${target}`);
  fs.mkdirSync(target, { recursive: true });
  const files = {
    manifest: path.join(target, 'manifest.json'),
    blindReviewPacket: path.join(target, 'blind-review-packet.json'),
    answerKey: path.join(target, 'answer-key.keep-private.json'),
    reviewResponseTemplate: path.join(target, 'review-response-template.json')
  };
  fs.writeFileSync(files.manifest, `${JSON.stringify(batch.manifest, null, 2)}\n`, 'utf8');
  fs.writeFileSync(files.blindReviewPacket, `${JSON.stringify(batch.blindReviewPacket, null, 2)}\n`, 'utf8');
  fs.writeFileSync(files.answerKey, `${JSON.stringify(batch.answerKey, null, 2)}\n`, 'utf8');
  fs.writeFileSync(files.reviewResponseTemplate, `${JSON.stringify(batch.reviewResponseTemplate, null, 2)}\n`, 'utf8');
  return files;
}

function main() {
  if (process.argv.includes('--self-test')) {
    process.stdout.write(`${JSON.stringify(runSelfTest(), null, 2)}\n`);
    return;
  }
  const countPerSlot = parseIntegerArg('count-per-slot', 32);
  const auditPerSlot = parseIntegerArg('audit-per-slot', 8);
  const auditSeed = process.argv.find((value) => value.startsWith('--audit-seed='))?.slice('--audit-seed='.length)
    || 'csca-math-elementary-local-audit-v1';
  const outDir = process.argv.find((value) => value.startsWith('--out-dir='))?.slice('--out-dir='.length);
  const batch = buildAuditBatch({ countPerSlot, auditPerSlot, auditSeed });
  const files = outDir ? writeNewAuditDirectory(outDir, batch) : null;
  process.stdout.write(`${JSON.stringify({
    ...batch.manifest,
    mode: outDir ? 'math_elementary_local_blind_audit_export' : 'math_elementary_local_blind_audit_preview',
    files,
    nextAction: outDir
      ? 'Give only blind-review-packet.json and review-response-template.json to the reviewer; keep answer-key.keep-private.json separate until reviews are locked.'
      : 'Pass --out-dir=artifacts/<new-directory> to write a new non-overwriting audit packet.'
  }, null, 2)}\n`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

module.exports = { AUDIT_PROTOCOL_VERSION, buildAuditBatch, runSelfTest };

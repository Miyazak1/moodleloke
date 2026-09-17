#!/usr/bin/env node

if (!require.extensions['.ts']) {
  require('../backend/node_modules/ts-node').register({
    transpileOnly: true,
    compilerOptions: { module: 'commonjs', moduleResolution: 'node' }
  });
}

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {
  SUBJECT_PRACTICE_PHYSICS_KINEMATICS_LOCAL_GENERATOR_VERSION,
  generateSubjectPracticePhysicsKinematicsLocally
} = require('../backend/src/ai-questioning/subject-practice-physics-kinematics-local-generator');
const {
  buildSubjectPracticeQuestionPlan,
  subjectPracticeQuestionPlanAdherenceFor
} = require('../backend/src/ai-questioning/subject-practice-question-plan-policy');

const AUDIT_PROTOCOL_VERSION = 'physics-kinematics-local-blind-audit-v1';
const relations = [
  'uniform_speed',
  'acceleration_from_velocity_change',
  'final_velocity_from_initial_acceleration_time',
  'displacement_from_initial_acceleration_time'
];
const blueprint = {
  id: 24,
  subject: 'physics',
  topicId: 8,
  topicCode: 'P-MECH-001',
  topicModule: '力学',
  topicTitle: 'Kinematics',
  syllabusVersion: '2025',
  examScope: '直线运动中位移、时间、速度和加速度的基本关系。',
  allowedQuestionTypes: ['single_choice'],
  difficultyRange: ['basic'],
  excludedScope: ['graph', 'piecewise_motion', 'multi_stage_model'],
  difficulty: 'basic',
  questionType: 'single_choice',
  skill: 'direct_application',
  constraints: {}
};
function sha256(value) {
  return crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
}

function publicLocalization(localization) {
  return {
    prompt: localization?.prompt ?? '',
    options: Array.isArray(localization?.options)
      ? localization.options.map((option) => ({ id: option.id, text: option.text }))
      : []
  };
}

function buildAuditBatch({
  countPerScope = 128,
  auditPerScope = 8,
  auditSeed = 'csca-physics-kinematics-local-audit-v1'
} = {}) {
  if (!Number.isInteger(countPerScope) || countPerScope < 8 || countPerScope > 256) {
    throw new Error('count-per-scope must be an integer from 8 to 256.');
  }
  if (!Number.isInteger(auditPerScope) || auditPerScope < 1 || auditPerScope > countPerScope) {
    throw new Error('audit-per-scope must be an integer from 1 to count-per-scope.');
  }
  const generatedPool = [];
  for (const relationKind of relations) {
    const questionPlan = buildSubjectPracticeQuestionPlan({
      subject: 'physics',
      topicId: 8,
      topicTitle: blueprint.topicTitle,
      productionCellId: 24,
      targetDifficulty: 'basic',
      taskFamily: 'kinematics_basic_direct_relation',
      exactPhysicsKinematicsScope: relationKind
    });
    if (!questionPlan) throw new Error(`Exact physics QuestionPlan is unavailable for ${relationKind}.`);
    for (let seed = 0; seed < countPerScope; seed += 1) {
      const generated = generateSubjectPracticePhysicsKinematicsLocally({
        blueprint, questionPlan, seed, relationKind
      });
      if (generated.status !== 'generated_and_self_verified' || !generated.candidate) {
        throw new Error(`Local generation failed for ${relationKind}:${seed}.`);
      }
      const adherence = subjectPracticeQuestionPlanAdherenceFor(questionPlan, generated.candidate);
      if (!adherence.adheres) {
        throw new Error(`QuestionPlan adherence failed for ${relationKind}:${seed}: ${adherence.failureCodes.join(',')}`);
      }
      const semanticFingerprint = sha256({
        prompt: generated.candidate.prompt,
        optionTextsIgnoringPosition: generated.candidate.options.map((option) => option.text).sort()
      });
      generatedPool.push({
        relationKind,
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
  const selected = relations.flatMap((relationKind) => generatedPool
    .filter((item) => item.relationKind === relationKind)
    .sort((left, right) => left.selectionRank.localeCompare(right.selectionRank))
    .slice(0, auditPerScope));
  const selectedWithIds = selected.map((item) => ({
    ...item,
    candidateId: `local-${item.relationKind}-${item.semanticFingerprint.slice(0, 16)}`
  }));
  const blindReviewPacket = {
    auditProtocolVersion: AUDIT_PROTOCOL_VERSION,
    evidenceClass: 'generator_blind_human_audit_not_official_holdout',
    reviewerInstructions: {
      answerKeyMustRemainHidden: true,
      requiredPerQuestionFields: [
        'selectedOptionId', 'isSolvable', 'hasUniqueCorrectAnswer', 'syllabusAligned',
        'unitConsistency', 'languageQuality', 'notes'
      ],
      languageQualityValues: ['pass', 'minor_issue', 'fail'],
      releaseQualificationImpact: 'none_shadow_only'
    },
    questions: selectedWithIds.map((item) => ({
      candidateId: item.candidateId,
      scopeId: item.scopeId,
      relationKind: item.relationKind,
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
      unitConsistency: null,
      languageQuality: null,
      notes: ''
    }))
  };
  const binding = {
    auditProtocolVersion: AUDIT_PROTOCOL_VERSION,
    generatorVersion: SUBJECT_PRACTICE_PHYSICS_KINEMATICS_LOCAL_GENERATOR_VERSION,
    auditSeed,
    countPerScope,
    auditPerScope,
    generatedPoolCount: generatedPool.length,
    selectedAuditCount: selectedWithIds.length,
    selectedCandidateIds: selectedWithIds.map((item) => item.candidateId)
  };
  const manifest = {
    ...binding,
    batchId: `physics-kinematics-local-audit-${sha256(binding).slice(0, 16)}`,
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
    scopeCounts: Object.fromEntries(relations.map((relationKind) => [
      relationKind,
      selectedWithIds.filter((item) => item.relationKind === relationKind).length
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

function runSelfTest() {
  const batch = buildAuditBatch({ countPerScope: 8, auditPerScope: 2, auditSeed: 'self-test' });
  if (batch.manifest.generatedPoolCount !== 32) throw new Error('Self-test pool count mismatch.');
  if (batch.manifest.selectedAuditCount !== 8) throw new Error('Self-test selected count mismatch.');
  if (!Object.values(batch.manifest.scopeCounts).every((count) => count === 2)) {
    throw new Error('Self-test must be stratified by scope.');
  }
  const blindText = JSON.stringify(batch.blindReviewPacket);
  if (blindText.includes('correctAnswer')) throw new Error('Blind packet leaked correctAnswer.');
  if (blindText.includes('explanation')) throw new Error('Blind packet leaked explanation.');
  if (blindText.includes('optionMetadata')) throw new Error('Blind packet leaked optionMetadata.');
  if (batch.manifest.blindPacketSha256 !== sha256(batch.blindReviewPacket)) throw new Error('Blind packet hash binding failed.');
  if (batch.manifest.answerKeySha256 !== sha256(batch.answerKey)) throw new Error('Answer-key hash binding failed.');
  if (!batch.reviewResponseTemplate.reviews.every((review) => review.selectedOptionId === null
    && review.unitConsistency === null)) throw new Error('Response template must be blank.');
  if (batch.reviewResponseTemplate.reviewerAttestation.reviewedWithoutAnswerKey !== null) {
    throw new Error('Reviewer attestation must be blank before handoff.');
  }
  return { ...batch.manifest, mode: 'physics_kinematics_local_blind_audit_export_self_test', status: 'passed' };
}

function writeNewAuditDirectory(outDir, batch) {
  const root = path.resolve(__dirname, '..');
  const target = path.resolve(root, outDir);
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
    throw new Error('out-dir must resolve inside the CSCALITE workspace.');
  }
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
  const countPerScope = parseIntegerArg('count-per-scope', 128);
  const auditPerScope = parseIntegerArg('audit-per-scope', 8);
  const auditSeed = process.argv.find((value) => value.startsWith('--audit-seed='))?.slice('--audit-seed='.length)
    || 'csca-physics-kinematics-local-audit-v1';
  const outDir = process.argv.find((value) => value.startsWith('--out-dir='))?.slice('--out-dir='.length);
  const batch = buildAuditBatch({ countPerScope, auditPerScope, auditSeed });
  const files = outDir ? writeNewAuditDirectory(outDir, batch) : null;
  process.stdout.write(`${JSON.stringify({
    ...batch.manifest,
    mode: outDir ? 'physics_kinematics_local_blind_audit_export' : 'physics_kinematics_local_blind_audit_preview',
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

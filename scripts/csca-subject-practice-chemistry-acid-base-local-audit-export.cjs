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
  SUBJECT_PRACTICE_CHEMISTRY_ACID_BASE_LOCAL_GENERATOR_VERSION,
  generateSubjectPracticeChemistryAcidBaseLocally
} = require('../backend/src/ai-questioning/subject-practice-chemistry-acid-base-local-generator');
const { buildSubjectPracticeQuestionPlan } = require('../backend/src/ai-questioning/subject-practice-question-plan-policy');

const AUDIT_PROTOCOL_VERSION = 'chemistry-acid-base-local-blind-audit-v1';
const slots = ['strong_acid_dilution', 'strong_base_dilution', 'strong_acid_base_neutralization']
  .flatMap((relationKind) => ['ph_value', 'acid_base_character'].map((answerTarget) => ({ relationKind, answerTarget })));
const blueprint = {
  id: 41, subject: 'chemistry', topicId: 642, topicCode: 'C-BASIC-003', topicModule: '溶液',
  topicTitle: '溶液浓度与pH计算', syllabusVersion: '2025',
  examScope: '一元强酸强碱稀释、中和、pH与酸碱性判断。',
  allowedQuestionTypes: ['single_choice'], difficultyRange: ['medium'],
  excludedScope: ['weak_acid_base', 'polyprotic', 'buffer', 'hydrolysis', 'activity', 'titration_curve'],
  difficulty: 'medium', questionType: 'single_choice', skill: 'standard_application', constraints: {}
};

function sha256(value) {
  return crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
}

function questionPlan(slot) {
  return buildSubjectPracticeQuestionPlan({
    subject: 'chemistry', topicId: 642, topicTitle: blueprint.topicTitle, productionCellId: 41,
    targetDifficulty: 'medium', taskFamily: 'ph_dilution_strong_acid_base_neutralization',
    exactChemistryRelationKind: slot.relationKind,
    exactChemistryAnswerTarget: slot.answerTarget
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

function buildAuditBatch({ countPerSlot = 32, auditPerSlot = 8, auditSeed = AUDIT_PROTOCOL_VERSION } = {}) {
  if (!Number.isInteger(countPerSlot) || countPerSlot < 8 || countPerSlot > 256) throw new Error('count-per-slot must be an integer from 8 to 256.');
  if (!Number.isInteger(auditPerSlot) || auditPerSlot < 1 || auditPerSlot > countPerSlot) throw new Error('audit-per-slot must be an integer from 1 to count-per-slot.');
  const generatedPool = [];
  for (const slot of slots) {
    const plan = questionPlan(slot);
    if (!plan) throw new Error(`Exact chemistry QuestionPlan is unavailable for ${slot.relationKind}:${slot.answerTarget}.`);
    for (let seed = 0; seed < countPerSlot; seed += 1) {
      const generated = generateSubjectPracticeChemistryAcidBaseLocally({ blueprint, questionPlan: plan, seed, ...slot });
      if (generated.status !== 'generated_and_self_verified' || !generated.candidate || !generated.verification) {
        throw new Error(`Local generation failed for ${slot.relationKind}:${slot.answerTarget}:${seed}.`);
      }
      const semanticFingerprint = sha256({
        prompt: generated.candidate.prompt,
        optionTextsIgnoringPosition: generated.candidate.options.map((option) => option.text).sort()
      });
      generatedPool.push({
        ...slot, seed, scopeId: generated.scopeId, semanticFingerprint,
        selectionRank: sha256(`${auditSeed}:${semanticFingerprint}`),
        candidate: generated.candidate, verification: generated.verification
      });
    }
  }
  if (new Set(generatedPool.map((item) => item.semanticFingerprint)).size !== generatedPool.length) {
    throw new Error('Generated pool contains a position-independent semantic duplicate.');
  }
  const selected = slots.flatMap((slot) => generatedPool
    .filter((item) => item.relationKind === slot.relationKind && item.answerTarget === slot.answerTarget)
    .sort((left, right) => left.selectionRank.localeCompare(right.selectionRank))
    .slice(0, auditPerSlot));
  const selectedWithIds = selected.map((item) => ({
    ...item,
    candidateId: `local-${item.relationKind}-${item.answerTarget}-${item.semanticFingerprint.slice(0, 16)}`
  }));
  const blindReviewPacket = {
    auditProtocolVersion: AUDIT_PROTOCOL_VERSION,
    evidenceClass: 'generator_blind_human_audit_not_official_holdout',
    reviewerInstructions: {
      answerKeyMustRemainHidden: true,
      requiredPerQuestionFields: ['selectedOptionId', 'isSolvable', 'hasUniqueCorrectAnswer', 'syllabusAligned', 'chemistryAssumptionsValid', 'languageQuality', 'notes'],
      languageQualityValues: ['pass', 'minor_issue', 'fail'],
      releaseQualificationImpact: 'none_shadow_only'
    },
    questions: selectedWithIds.map((item) => ({
      candidateId: item.candidateId,
      scopeId: item.scopeId,
      relationKind: item.relationKind,
      answerTarget: item.answerTarget,
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
    reviewerAttestation: { reviewerId: null, reviewedWithoutAnswerKey: null, lockedAt: null },
    reviews: selectedWithIds.map((item) => ({
      candidateId: item.candidateId,
      selectedOptionId: null,
      isSolvable: null,
      hasUniqueCorrectAnswer: null,
      syllabusAligned: null,
      chemistryAssumptionsValid: null,
      languageQuality: null,
      notes: ''
    }))
  };
  const binding = {
    auditProtocolVersion: AUDIT_PROTOCOL_VERSION,
    generatorVersion: SUBJECT_PRACTICE_CHEMISTRY_ACID_BASE_LOCAL_GENERATOR_VERSION,
    auditSeed, countPerSlot, auditPerSlot,
    generatedPoolCount: generatedPool.length,
    selectedAuditCount: selectedWithIds.length,
    selectedCandidateIds: selectedWithIds.map((item) => item.candidateId)
  };
  const manifest = {
    ...binding,
    batchId: `chemistry-acid-base-local-audit-${sha256(binding).slice(0, 16)}`,
    status: 'shadow_blind_audit_packet_ready',
    providerImpact: 'none_no_provider_call', estimatedCostUsd: 0,
    dbImpact: 'none_no_database_connection', publicationImpact: 'none',
    releaseQualification: false,
    releaseQualificationReason: 'locally_generated_audit_data_is_not_a_sealed_official_holdout',
    blindPacketSha256: sha256(blindReviewPacket),
    answerKeySha256: sha256(answerKey),
    reviewResponseTemplateSha256: sha256(reviewResponseTemplate),
    scopeCounts: Object.fromEntries(slots.map((slot) => {
      const key = `${slot.relationKind}:${slot.answerTarget}`;
      return [key, selectedWithIds.filter((item) => item.relationKind === slot.relationKind && item.answerTarget === slot.answerTarget).length];
    }))
  };
  return { manifest, blindReviewPacket, answerKey, reviewResponseTemplate };
}

function parseIntegerArg(name, fallback) {
  const raw = process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value)) throw new Error(`${name} must be an integer.`);
  return value;
}

function runSelfTest() {
  const batch = buildAuditBatch({ countPerSlot: 8, auditPerSlot: 2, auditSeed: 'chemistry-export-self-test' });
  if (batch.manifest.generatedPoolCount !== 48 || batch.manifest.selectedAuditCount !== 12) throw new Error('Stratified count mismatch.');
  if (!Object.values(batch.manifest.scopeCounts).every((count) => count === 2)) throw new Error('Scope stratification mismatch.');
  const blindText = JSON.stringify(batch.blindReviewPacket);
  for (const secret of ['correctAnswer', 'explanation', 'optionMetadata', 'deterministicVerification']) {
    if (blindText.includes(secret)) throw new Error(`Blind packet leaked ${secret}.`);
  }
  if (batch.manifest.blindPacketSha256 !== sha256(batch.blindReviewPacket)) throw new Error('Blind packet hash mismatch.');
  if (batch.manifest.answerKeySha256 !== sha256(batch.answerKey)) throw new Error('Answer key hash mismatch.');
  if (!batch.reviewResponseTemplate.reviews.every((review) => Object.entries(review)
    .filter(([key]) => !['candidateId', 'notes'].includes(key)).every(([, value]) => value === null))) throw new Error('Review template must be blank.');
  return { ...batch.manifest, mode: 'chemistry_acid_base_local_blind_audit_export_self_test', status: 'passed' };
}

function writeNewAuditDirectory(outDir, batch) {
  const workspace = path.resolve(__dirname, '..');
  const target = path.resolve(workspace, outDir);
  if (target === workspace || !target.startsWith(`${workspace}${path.sep}`)) throw new Error('out-dir must be a new directory inside the CSCALITE workspace.');
  if (fs.existsSync(target)) throw new Error(`Refusing to overwrite existing audit directory: ${target}`);
  fs.mkdirSync(target, { recursive: true });
  const files = {
    manifest: path.join(target, 'manifest.json'),
    blindReviewPacket: path.join(target, 'blind-review-packet.json'),
    answerKey: path.join(target, 'answer-key.keep-private.json'),
    reviewResponseTemplate: path.join(target, 'review-response-template.json')
  };
  for (const [key, file] of Object.entries(files)) {
    const value = key === 'manifest' ? batch.manifest
      : key === 'blindReviewPacket' ? batch.blindReviewPacket
        : key === 'answerKey' ? batch.answerKey : batch.reviewResponseTemplate;
    fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  }
  return files;
}

function main() {
  if (process.argv.includes('--self-test')) return process.stdout.write(`${JSON.stringify(runSelfTest(), null, 2)}\n`);
  const countPerSlot = parseIntegerArg('count-per-slot', 32);
  const auditPerSlot = parseIntegerArg('audit-per-slot', 8);
  const auditSeed = process.argv.find((value) => value.startsWith('--audit-seed='))?.slice(13) || AUDIT_PROTOCOL_VERSION;
  const outDir = process.argv.find((value) => value.startsWith('--out-dir='))?.slice(10);
  const batch = buildAuditBatch({ countPerSlot, auditPerSlot, auditSeed });
  const files = outDir ? writeNewAuditDirectory(outDir, batch) : null;
  process.stdout.write(`${JSON.stringify({
    ...batch.manifest,
    mode: outDir ? 'chemistry_acid_base_local_blind_audit_export' : 'chemistry_acid_base_local_blind_audit_preview',
    files,
    nextAction: outDir
      ? 'Give only the blind packet and response template to the reviewer; keep the answer key separate until reviews are locked.'
      : 'Pass --out-dir=artifacts/<new-directory> to write a non-overwriting packet.'
  }, null, 2)}\n`);
}

if (require.main === module) {
  try { main(); } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

module.exports = { AUDIT_PROTOCOL_VERSION, buildAuditBatch, runSelfTest };

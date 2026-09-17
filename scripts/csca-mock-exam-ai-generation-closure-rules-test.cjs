const fs = require('node:fs');
const path = require('node:path');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const servicePath = path.join(__dirname, '../backend/src/csca-mock-exam/csca-mock-exam.service.ts');
const source = fs.readFileSync(servicePath, 'utf8');

assert(
  source.includes('promoteExistingPublishableCandidateForSlot'),
  'Mock exam generation must try to promote existing publishable candidates before generating more candidates.'
);
assert(
  source.includes('"review_metadata"->\'gate\'->>\'decision\' IN (\'publishable\', \'manual_override_publishable\')'),
  'Mock exam promotion must only promote candidates that already passed the gate.'
);
assert(
  source.includes('jsonb_typeof(q."generation_metadata"->\'mockExamSlot\') = \'object\''),
  'Mock exam scoped candidate queries must require mockExamSlot to be a JSON object, not JSON null.'
);
assert(
  source.includes('mockExamCandidateMatchesSlotContext'),
  'Mock exam promotion must verify candidate slot scope before approving a candidate for assembly.'
);
assert(
  source.includes('mockExamGenerationWithApprovalSlotContext'),
  'Mock exam promotion must backfill slot context into generation metadata when approving a candidate.'
);
assert(
  source.includes("const succeeded = workingResults.filter((item) => Number(item.candidateQuestionId) > 0 && ['approved', 'assembled'].includes(String(item.status ?? ''))).length;"),
  'Mock exam generation jobs must count only approved or assembled slot results as successful, not raw candidate volume.'
);
assert(
  source.includes('const requiredCandidates = baseResults.length')
    && source.includes('const isCompletePaper = requiredCandidates > 0 && succeeded >= requiredCandidates')
    && source.includes('"completed_at" = ${isCompletePaper ? Prisma.sql`CURRENT_TIMESTAMP` : Prisma.sql`NULL`}'),
  'Mock exam generation jobs may complete only when every requested slot has an approved/assembled candidate.'
);
assert(
  source.includes('this.mockExamApprovedPaperComplete(detail, approvedSlotResults)')
    && source.includes('已通过门禁并进入题库，不能继续生成'),
  'Mock exam must stop creating more generation work once the full paper has enough gate-passed approved slots.'
);
assert(
  source.indexOf('promoteExistingPublishableCandidateForSlot') < source.indexOf('enqueueGenerationJobs'),
  'Mock exam generation must promote existing publishable candidates before enqueueing new AI jobs.'
);
assert(
  source.includes('mockExamProfileCorrectionInstructions'),
  'Mock exam closed-loop retries must translate gate failure signals into profile correction instructions.'
);
assert(
  source.includes('reading_load_mismatch') && source.includes('calculation_load_mismatch') && source.includes('cognitive_skill_mismatch') && source.includes('question_form_mismatch'),
  'Mock exam profile correction must cover reading load, calculation load, cognitive skill, and question form failures.'
);
assert(
  source.includes('profileCorrectionInstructions') && source.includes('...profileCorrectionInstructions'),
  'Mock exam normalized target profiles must feed correction instructions into generationStrategy and prompt checklist.'
);
assert(
  source.includes('answerTargets = distributedWeightedSequence(profile.answerDistribution, total, OPTION_IDS)'),
  'Mock exam blueprint calibration must expand normalized answer distribution into per-slot answer targets.'
);
assert(
  source.includes('targetAnswer: normalizeMockExamAnswerTarget(target.targetAnswer)'),
  'Mock exam slot target profiles must preserve normalized per-slot answer targets.'
);
assert(
  source.includes('Set correctAnswer to ${target.targetAnswer}') && source.includes('target_answer_mismatch'),
  'Mock exam generation and repair must enforce targetAnswer instead of only displaying answer distribution.'
);
assert(
  source.includes('q."correct_answer" = ${targetAnswer}'),
  'Mock exam promotion must not reuse an existing candidate whose correct answer violates the slot target answer.'
);
assert(
  source.includes('actualGenerationProfileId === expectedGenerationProfileId')
    && source.includes('sourceStyleProfile.seriesProfileId')
    && source.includes('sourceStyleProfile.sourceSnapshotHash')
    && source.includes('sourceStyleProfile.syllabusSnapshotHash'),
  'Mock exam blueprint profile references must compare generation-profile lineage, not only the legacy source style profile id.'
);

console.log('CSCA mock exam AI generation closure rules passed.');

#!/usr/bin/env node

require('../backend/node_modules/ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', moduleResolution: 'node' }
});

const assert = require('node:assert/strict');
const {
  buildSubjectPracticeObservationBatchManifest,
  subjectPracticeObservationBatchEnvelopeFor,
  subjectPracticeObservationExpectedGeneratorVersionFor
} = require('../backend/src/ai-questioning/subject-practice-observation-batch-manifest-policy');
const {
  scoreSubjectPracticeObservationBatchEvidence
} = require('../backend/src/ai-questioning/subject-practice-observation-batch-evidence-policy');
const {
  SUBJECT_PRACTICE_CANDIDATE_NOVELTY_CORPUS_SNAPSHOT_VERSION,
  SUBJECT_PRACTICE_CANDIDATE_NOVELTY_MATCH_DIGEST_VERSION,
  SUBJECT_PRACTICE_CANDIDATE_OUTPUT_NOVELTY_POLICY_VERSION,
  SUBJECT_PRACTICE_STRUCTURED_SOURCE_CORPUS_SCHEMA_VERSION
} = require('../backend/src/ai-questioning/subject-practice-candidate-output-novelty-policy');
const {
  SUBJECT_PRACTICE_SOURCE_CORPUS_NORMALIZATION_VERSION
} = require('../backend/src/ai-questioning/subject-practice-source-corpus-scan-policy');

const base = {
  subject: 'physics', productionRunId: 2, productionCellId: 24,
  taskFamily: 'kinematics_basic_direct_relation', planTemplate: 'physics_kinematics_basic_relation_v1'
};
const scopes = [
  'physics-basic-kinematics-v2:uniform_speed',
  'physics-basic-kinematics-v2:acceleration_from_velocity_change',
  'physics-basic-kinematics-v2:final_velocity_from_initial_acceleration_time'
];
const manifest = buildSubjectPracticeObservationBatchManifest(scopes.map((plannedScopeId, index) => ({
  ...base, ordinal: index + 1, plannedScopeId
})));

function row(ordinal, options = {}) {
  const descriptor = manifest.tasks[ordinal - 1];
  const candidatePresent = options.candidatePresent !== false;
  return {
    id: `00000000-0000-0000-0000-00000000000${ordinal}`,
    subject: descriptor.subject,
    resourceType: 'production_run',
    resourceId: String(descriptor.productionRunId),
    filterSnapshot: {
      productionCellId: descriptor.productionCellId,
      requestedTaskFamily: descriptor.taskFamily,
      requestedPlanTemplate: descriptor.planTemplate,
      sealedObservationBatch: subjectPracticeObservationBatchEnvelopeFor({ manifest, taskOrdinal: ordinal })
    },
    status: options.status || 'succeeded',
    requested: 1,
    succeeded: options.status === 'failed' ? 0 : 1,
    skipped: 0,
    failed: options.status === 'failed' ? 1 : 0,
    error: options.error || null,
    result: candidatePresent ? {
      generatedQuestionId: 1000 + ordinal,
      gateDecision: options.gateDecision || 'publishable',
      plannedTaskFamily: options.plannedTaskFamily || descriptor.taskFamily,
      classifiedTaskFamily: options.classifiedTaskFamily || descriptor.taskFamily,
      observedPlanTemplate: descriptor.planTemplate,
      observedScopeId: descriptor.plannedScopeId,
      generatorProvider: 'local-deterministic',
      generatorVersion: subjectPracticeObservationExpectedGeneratorVersionFor(descriptor),
      providerAttemptLimit: 0,
      automatedCandidateLeakageGate: {
        policyVersion: SUBJECT_PRACTICE_CANDIDATE_OUTPUT_NOVELTY_POLICY_VERSION,
        status: 'clear', scannedRevisionCount: 138, blockedRevisionCount: 0, ambiguousRevisionCount: 0,
        revisionMatchSetSha256: `${ordinal}`.repeat(64),
        revisionMatchDigestVersion: SUBJECT_PRACTICE_CANDIDATE_NOVELTY_MATCH_DIGEST_VERSION,
        structuredCorpusSchemaVersion: SUBJECT_PRACTICE_STRUCTURED_SOURCE_CORPUS_SCHEMA_VERSION,
        normalizationVersion: SUBJECT_PRACTICE_SOURCE_CORPUS_NORMALIZATION_VERSION,
        sourceCorpusSnapshotSha256: 'a'.repeat(64),
        sourceCorpusSnapshotVersion: SUBJECT_PRACTICE_CANDIDATE_NOVELTY_CORPUS_SNAPSHOT_VERSION,
        sourceCorpusRevisionCount: 138,
        sourceCorpusInventoryComplete: true,
        sourceCorpusInventoryMode: 'all_active_subject_source_questions_at_statement_snapshot',
        failClosed: true, sourceContentExposedToGenerator: false
      },
      scenarioEvidence: {
        status: 'consistent', scenarioMode: 'real_world',
        scenarioFamilyId: ['physics_lab_cart_track', 'physics_train_straight_segment', 'physics_drone_straight_route'][ordinal - 1],
        scenarioDomain: 'motion', scenarioEntity: ['cart', 'train', 'drone'][ordinal - 1],
        scenarioAction: descriptor.plannedScopeId, informationForm: 'numeric_text',
        scenarioFingerprint: `scenario-${String(ordinal).repeat(20)}`,
        contextNecessity: 'required_for_solution', surfaceEntity: ['cart', 'train', 'drone'][ordinal - 1],
        contractValid: true, surfaceMatched: true, relationEvidenceMatched: true,
        contextNecessityVerified: true, physicalPlausibilityMatched: true,
        chemistryPlausibilityMatched: true, informationParticipationMatched: true
      }
    } : { generatedQuestionId: null, deliveryFailure: options.error || 'generation_failed', noCandidate: true }
  };
}

const completeRows = [row(1), row(2, { status: 'failed', candidatePresent: false, error: 'generation_failed' }), row(3)];
const complete = scoreSubjectPracticeObservationBatchEvidence({ manifest, tasks: completeRows });
const key = 'physics:kinematics_basic_direct_relation:physics_kinematics_basic_relation_v1';
assert.equal(complete.complete, true);
assert.equal(complete.perExactPlan[key].requestedCount, 3);
assert.equal(complete.perExactPlan[key].candidateCount, 2);
assert.equal(complete.perExactPlan[key].publishableCount, 2);
assert.equal(complete.perExactPlan[key].candidateYieldRate, 2 / 3);
assert.equal(complete.selectionBiasControls.failedAndCancelledTasksRemainInDenominator, true);
assert.equal(complete.scenarioDiversity.observedEvidenceCount, 2);
assert.equal(complete.scenarioDiversity.completeEvidenceCoverage, false);

const cleanScenarioBatch = scoreSubjectPracticeObservationBatchEvidence({
  manifest,
  tasks: [row(1, { classifiedTaskFamily: 'kinematics_constant_acceleration_direct' }), row(2), row(3)]
});
assert.equal(cleanScenarioBatch.scenarioDiversity.completeEvidenceCoverage, true);
assert.equal(cleanScenarioBatch.scenarioDiversity.scenarioFamilyCoverageCount, 3);
assert.equal(cleanScenarioBatch.scenarioDiversity.scenarioConsistencyFailureRate, 0);
assert.equal(cleanScenarioBatch.complete, true);
assert.equal(cleanScenarioBatch.perExactPlan[key].scopeBindingFailureCount, 0);
assert.match(cleanScenarioBatch.candidateLeakageEvidenceRootSha256, /^[a-f0-9]{64}$/);

const incompleteCorpusRows = structuredClone([row(1), row(2), row(3)]);
incompleteCorpusRows[0].result.automatedCandidateLeakageGate.sourceCorpusInventoryComplete = false;
const incompleteCorpus = scoreSubjectPracticeObservationBatchEvidence({ manifest, tasks: incompleteCorpusRows });
assert.equal(incompleteCorpus.perExactPlan[key].leakageClearCount, 2);
assert.equal(incompleteCorpus.perExactPlan[key].publishableCount, 2);

const plannedFamilyMismatch = scoreSubjectPracticeObservationBatchEvidence({
  manifest,
  tasks: [row(1, { plannedTaskFamily: 'different_planned_family' }), row(2), row(3)]
});
assert.equal(plannedFamilyMismatch.complete, false);
assert.ok(plannedFamilyMismatch.reasons.includes('observation_batch_candidate_binding_mismatch'));

const classifierOnlyLegacyRow = row(1);
delete classifierOnlyLegacyRow.result.plannedTaskFamily;
classifierOnlyLegacyRow.result.observedTaskFamily = base.taskFamily;
const missingPlanIdentity = scoreSubjectPracticeObservationBatchEvidence({
  manifest,
  tasks: [classifierOnlyLegacyRow, row(2), row(3)]
});
assert.equal(missingPlanIdentity.complete, false);
assert.ok(missingPlanIdentity.reasons.includes('observation_batch_candidate_binding_mismatch'));

const wrongGeneratorVersionRows = structuredClone([row(1), row(2), row(3)]);
wrongGeneratorVersionRows[0].result.generatorVersion = 'physics-kinematics-local-generator-v2-scenario';
const wrongGeneratorVersion = scoreSubjectPracticeObservationBatchEvidence({
  manifest,
  tasks: wrongGeneratorVersionRows
});
assert.equal(wrongGeneratorVersion.complete, false);
assert.ok(wrongGeneratorVersion.reasons.includes('observation_batch_candidate_binding_mismatch'));

const omitted = scoreSubjectPracticeObservationBatchEvidence({ manifest, tasks: completeRows.slice(0, 2) });
assert.equal(omitted.complete, false);
assert.ok(omitted.reasons.includes('observation_batch_task_count_mismatch'));
assert.ok(omitted.reasons.includes('observation_batch_ordinal_coverage_incomplete'));

const duplicate = scoreSubjectPracticeObservationBatchEvidence({ manifest, tasks: [completeRows[0], completeRows[0], completeRows[2]] });
assert.equal(duplicate.complete, false);
assert.ok(duplicate.reasons.includes('observation_batch_duplicate_ordinal'));

const tampered = structuredClone(completeRows);
tampered[0].filterSnapshot.sealedObservationBatch.manifestSha256 = '0'.repeat(64);
const tamperedScore = scoreSubjectPracticeObservationBatchEvidence({ manifest, tasks: tampered });
assert.equal(tamperedScore.complete, false);
assert.ok(tamperedScore.reasons.includes('observation_batch_envelope_invalid'));

const report = {
  mode: 'subject_practice_observation_batch_evidence_self_test',
  reportVersion: 'subject-practice-observation-batch-evidence-self-test-v5-candidate-corpus-snapshot-bound',
  status: 'passed',
  checks: {
    fullTerminalBatchAccepted: true,
    failedTaskRetainedInYieldDenominator: true,
    scenarioEvidenceCoverageTracksMissingCandidate: true,
    cleanScenarioBatchReportsFamilyCoverage: true,
    candidateLeakageEvidenceRootPresent: true,
    incompleteCandidateCorpusEvidenceCannotBePublishable: true,
    classifiedFamilyAliasDoesNotReplacePlanIdentity: true,
    plannedFamilyMismatchRejected: true,
    legacyClassifierOnlyEvidenceFailsClosed: true,
    wrongGeneratorVersionFailsClosed: true,
    omittedTaskRejected: true,
    duplicateOrdinalRejected: true,
    manifestTamperRejected: true
  },
  exampleMetrics: complete.perExactPlan[key],
  cleanScenarioMetrics: cleanScenarioBatch.scenarioDiversity,
  providerImpact: 'none_no_provider_call',
  databaseImpact: 'none_fixture_only',
  publicationImpact: 'none'
};
if (require.main === module) console.log(JSON.stringify(report, null, 2));
module.exports = { report };

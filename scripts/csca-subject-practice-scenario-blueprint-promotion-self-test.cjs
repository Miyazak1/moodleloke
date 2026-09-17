#!/usr/bin/env node

require('../backend/node_modules/ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', moduleResolution: 'node' }
});

const {
  subjectPracticeScenarioBlueprintNoveltyFor,
  subjectPracticeScenarioBlueprintProposalFor
} = require('../backend/src/ai-questioning/subject-practice-scenario-blueprint-policy');
const {
  subjectPracticeScenarioBlueprintPromotionEvidenceFor
} = require('../backend/src/ai-questioning/subject-practice-scenario-blueprint-promotion-policy');

function main() {
  const blueprint = subjectPracticeScenarioBlueprintProposalFor({
    binding: {
      subject: 'physics',
      taskFamily: 'kinematics_basic_direct_relation',
      planTemplate: 'physics_kinematics_basic_relation_v1',
      exactScope: 'uniform_speed'
    },
    proposal: {
      scenarioMode: 'real_world', scenarioDomain: 'harbor logistics',
      scenarioEntity: 'autonomous carrier', environment: 'straight loading lane',
      scenarioAction: 'transport along a marked route', informationForm: 'motion observations in text',
      questionPurpose: 'decide whether a transport record supports the planned route', contextNecessity: 'required_for_solution',
      surface: {
        zhEntity: '自动运输车', enEntity: 'autonomous carrier',
        zhSetting: '港区直线装卸通道', enSetting: 'a straight loading lane in a harbor'
      }
    }
  });
  const novelty = subjectPracticeScenarioBlueprintNoveltyFor({ blueprint, historicalSummaries: [] });
  const instructionCopyBlueprint = subjectPracticeScenarioBlueprintProposalFor({
    binding: {
      subject: 'physics', taskFamily: 'kinematics_basic_direct_relation',
      planTemplate: 'physics_kinematics_basic_relation_v1', exactScope: 'uniform_speed'
    },
    proposal: {
      ...blueprint.creativeBlueprint,
      questionPurpose: 'interpret generic observations without naming a calculated target'
    }
  });
  const instructionCopyNovelty = subjectPracticeScenarioBlueprintNoveltyFor({
    blueprint: instructionCopyBlueprint, historicalSummaries: []
  });
  const qualification = {
    observationBatchId: 'local-shadow-fixture000000000',
    manifestPolicyVersion: 'subject-practice-observation-batch-manifest-v10-production-profile-bound',
    productionProfileBindingDigest: 'profile-digest-fixture',
    generatorVersion: 'generator-v1', solverVersion: 'solver-v1', oracleVersion: 'oracle-v1',
    qualificationEvidenceDigest: 'qualification-evidence-fixture',
    publicationSuppressed: true, hmacAttested: true, batchQualified: true,
    candidateYieldRate: 1, publishableRate: 1,
    leakageFailureCount: 0, scopeBindingFailureCount: 0, unexpectedFailureCount: 0
  };
  const stability = {
    independentSeedCommitments: ['seed-a', 'seed-b'],
    solverOracleStableAcrossSeeds: true,
    contextNecessityStableAcrossSeeds: true,
    renameOnlyClearAcrossSeeds: true
  };
  const ready = subjectPracticeScenarioBlueprintPromotionEvidenceFor({ blueprint, novelty, qualification, stability });
  const unsigned = subjectPracticeScenarioBlueprintPromotionEvidenceFor({
    blueprint, novelty, qualification: { ...qualification, hmacAttested: false }, stability
  });
  const leaking = subjectPracticeScenarioBlueprintPromotionEvidenceFor({
    blueprint, novelty, qualification: { ...qualification, leakageFailureCount: 1 }, stability
  });
  const oneSeed = subjectPracticeScenarioBlueprintPromotionEvidenceFor({
    blueprint, novelty, qualification, stability: { ...stability, independentSeedCommitments: ['seed-a', 'seed-a'] }
  });
  const tampered = subjectPracticeScenarioBlueprintPromotionEvidenceFor({
    blueprint, novelty, qualification: { ...qualification, generatorVersion: 'generator-v2' }, stability
  });
  const instructionCopy = subjectPracticeScenarioBlueprintPromotionEvidenceFor({
    blueprint: instructionCopyBlueprint,
    novelty: instructionCopyNovelty,
    qualification,
    stability
  });
  const checks = {
    completeEvidenceOnlyReachesThresholdCalibration:
      ready.status === 'ready_for_promotion_threshold_calibration'
      && ready.automaticStablePromotionAllowed === false
      && ready.stableScenarioFamilyCreated === false,
    promotionDoesNotRequireHumanReview:
      ready.humanReviewRequired === false
      && ready.manualApprovalCanOverrideEvidence === false,
    modelCannotApproveScientificCorrectness:
      ready.modelMayApproveScientificCorrectness === false,
    instructionCopyCannotReachStablePromotion:
      instructionCopy.blockers.includes('promotion_blueprint_creative_specificity_missing')
      && instructionCopy.creativeSpecificityRequired === true,
    hmacIsMandatory:
      unsigned.blockers.includes('promotion_hmac_attestation_required'),
    leakageFailsClosed:
      leaking.blockers.includes('promotion_leakage_failure_present'),
    multipleIndependentSeedsAreMandatory:
      oneSeed.blockers.includes('promotion_multiple_independent_seed_commitments_required'),
    evidenceDigestBindsGeneratorVersion:
      tampered.promotionEvidenceDigest !== ready.promotionEvidenceDigest,
    thresholdsRemainUnfrozen:
      ready.performancePromotionThresholdsFrozen === false
      && ready.publicationAuthorized === false,
    officialQuestionContentIsNotRequired:
      ready.officialQuestionContentRequired === false
  };
  const report = {
    mode: 'subject_practice_scenario_blueprint_promotion_self_test',
    reportVersion: 'subject-practice-scenario-blueprint-promotion-self-test-v2-creative-specificity',
    status: Object.values(checks).every(Boolean) ? 'passed' : 'failed',
    checks,
    providerImpact: 'none_no_provider_call',
    databaseImpact: 'none_no_database_connection',
    productionImpact: 'none_shadow_only_not_connected'
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.status !== 'passed') process.exitCode = 1;
}

if (require.main === module) main();

#!/usr/bin/env node

require('../backend/node_modules/ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', moduleResolution: 'node' }
});

const {
  subjectPracticeScenarioBlueprintProposalFor
} = require('../backend/src/ai-questioning/subject-practice-scenario-blueprint-policy');
const {
  subjectPracticeScenarioBlueprintMemoryRankingFor
} = require('../backend/src/ai-questioning/subject-practice-scenario-blueprint-memory-policy');

const binding = {
  subject: 'physics', taskFamily: 'kinematics_basic_direct_relation',
  planTemplate: 'physics_kinematics_basic_relation_v1', exactScope: 'uniform_speed'
};
function proposal(overrides = {}) {
  return subjectPracticeScenarioBlueprintProposalFor({
    binding,
    proposal: {
      scenarioMode: 'real_world', scenarioDomain: 'harbor logistics',
      scenarioEntity: 'autonomous carrier', environment: 'straight loading lane',
      scenarioAction: 'transport along a marked route', informationForm: 'motion observations in text',
      questionPurpose: 'infer a direct kinematics relation', contextNecessity: 'required_for_solution',
      surface: {
        zhEntity: '自动运输车', enEntity: 'autonomous carrier',
        zhSetting: '港区直线装卸通道', enSetting: 'a straight loading lane in a harbor'
      },
      ...overrides
    }
  });
}
function historyFrom(blueprint, lifecycleStatus = 'stable', failureCodes = []) {
  return {
    blueprintFingerprint: blueprint.blueprintFingerprint,
    renameInvariantFingerprint: blueprint.renameInvariantFingerprint,
    canonicalDimensions: blueprint.canonicalDimensions,
    lifecycleStatus,
    failureCodes
  };
}

function main() {
  const common = proposal();
  const renamed = proposal({
    scenarioEntity: 'delivery robot',
    surface: { zhEntity: '配送机器人', enEntity: 'delivery robot', zhSetting: '港区直线装卸通道', enSetting: 'a straight loading lane in a harbor' }
  });
  const uncommon = proposal({
    scenarioDomain: 'agricultural monitoring', scenarioEntity: 'field rover',
    environment: 'straight crop inspection lane', scenarioAction: 'inspect a marked crop row',
    questionPurpose: 'infer a motion relation for inspection timing',
    surface: { zhEntity: '田间巡检车', enEntity: 'field rover', zhSetting: '笔直作物巡检通道', enSetting: 'a straight crop inspection lane' }
  });
  const commonAlternative = proposal({
    scenarioEntity: 'cargo tug', environment: 'straight service lane',
    scenarioAction: 'move cargo along a marked route',
    surface: { zhEntity: '货运牵引车', enEntity: 'cargo tug', zhSetting: '港区直线服务通道', enSetting: 'a straight service lane in a harbor' }
  });
  const failedHarborStructure = proposal({
    scenarioEntity: 'terminal tractor', environment: 'restricted apron lane',
    scenarioAction: 'move cargo along a marked route',
    informationForm: 'dispatch observations in text',
    questionPurpose: 'infer a direct travel relation',
    surface: { zhEntity: '码头牵引车', enEntity: 'terminal tractor', zhSetting: '受限停机坪通道', enSetting: 'a restricted apron lane' }
  });
  const history = [historyFrom(common), historyFrom(failedHarborStructure, 'rejected', ['plausibility_failed'])];
  const ranked = subjectPracticeScenarioBlueprintMemoryRankingFor({
    candidates: [common, renamed, commonAlternative, uncommon], historicalSummaries: history
  });
  const contentRejected = subjectPracticeScenarioBlueprintMemoryRankingFor({
    candidates: [uncommon],
    historicalSummaries: [{ ...history[0], prompt: 'forbidden content' }]
  });
  const malformedRejected = subjectPracticeScenarioBlueprintMemoryRankingFor({
    candidates: 'not-an-array', historicalSummaries: history
  });
  const decisions = Object.fromEntries(ranked.rankedCandidates.map((item) => [item.blueprintFingerprint, item]));
  const checks = {
    structuralHistoryOnlyIsAccepted: ranked.historyInputAccepted === true,
    exactDuplicateIsExcluded: decisions[common.blueprintFingerprint].decision === 'reject_exact_duplicate',
    renameOnlyIsExcluded: decisions[renamed.blueprintFingerprint].decision === 'reject_rename_only',
    coverageGapRanksUncommonCandidateFirst:
      ranked.suggestedSelection === uncommon.blueprintFingerprint
      && decisions[commonAlternative.blueprintFingerprint].decision === 'rankable_novel_candidate'
      && decisions[uncommon.blueprintFingerprint].rankingScore > decisions[commonAlternative.blueprintFingerprint].rankingScore,
    failureReasonPenalizesRelatedStructure:
      decisions[commonAlternative.blueprintFingerprint].historicalFailurePenalty > 0,
    rankingNeverAuthorizesGeneration:
      ranked.selectionAuthorizesGeneration === false && ranked.selectionQuotaFrozen === false,
    questionContentInHistoryIsRejected:
      contentRejected.status === 'rejected_history_input_not_structural_only',
    malformedCandidateInputFailsClosed:
      malformedRejected.status === 'rejected_candidate_input_invalid',
    outputContainsNoQuestionContent:
      ranked.officialQuestionContentRequired === false
      && ranked.candidateQuestionContentRequired === false
      && !JSON.stringify(ranked).includes('zhEntity')
  };
  const report = {
    mode: 'subject_practice_scenario_blueprint_memory_self_test',
    reportVersion: 'subject-practice-scenario-blueprint-memory-self-test-v1',
    status: Object.values(checks).every(Boolean) ? 'passed' : 'failed',
    checks,
    providerImpact: 'none_no_provider_call', databaseImpact: 'none_no_database_connection',
    productionImpact: 'none_shadow_only_not_connected'
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.status !== 'passed') process.exitCode = 1;
}

if (require.main === module) main();

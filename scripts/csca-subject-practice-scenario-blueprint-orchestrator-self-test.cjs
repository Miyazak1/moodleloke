#!/usr/bin/env node

require('../backend/node_modules/ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', moduleResolution: 'node' }
});

const {
  subjectPracticeScenarioBlueprintIdeationRequestFor
} = require('../backend/src/ai-questioning/subject-practice-scenario-blueprint-ideation-policy');
const {
  subjectPracticeScenarioBlueprintProposalFor
} = require('../backend/src/ai-questioning/subject-practice-scenario-blueprint-policy');
const {
  subjectPracticeScenarioBlueprintIdeationCycleFor
} = require('../backend/src/ai-questioning/subject-practice-scenario-blueprint-orchestrator');

const binding = {
  subject: 'physics', taskFamily: 'kinematics_basic_direct_relation',
  planTemplate: 'physics_kinematics_basic_relation_v1', exactScope: 'uniform_speed',
  difficultyBand: 'basic', targetCognitiveSkill: 'direct_relation_application'
};
const request = subjectPracticeScenarioBlueprintIdeationRequestFor({
  binding,
  historySummary: {
    dimensionCounts: { scenarioDomain: 4 }, underrepresentedDimensions: { scenarioDomain: ['agricultural_monitoring'] },
    concentrationWarnings: [], failureReasonCodes: []
  },
  requestedCandidateCount: 2
});
const common = {
  scenarioMode: 'real_world', scenarioDomain: 'harbor logistics', scenarioEntity: 'autonomous carrier',
  environment: 'straight loading lane', scenarioAction: 'transport along a marked route',
  informationForm: 'motion observations in text', questionPurpose: 'infer a direct kinematics relation',
  contextNecessity: 'required_for_solution',
  surface: { zhEntity: '自动运输车', enEntity: 'autonomous carrier', zhSetting: '港区直线装卸通道', enSetting: 'a straight loading lane in a harbor' }
};
const uncommon = {
  scenarioMode: 'real_world', scenarioDomain: 'agricultural monitoring', scenarioEntity: 'field rover',
  environment: 'straight crop inspection lane', scenarioAction: 'inspect a marked crop row',
  informationForm: 'sensor observations in text', questionPurpose: 'infer a motion relation for inspection timing',
  contextNecessity: 'required_for_solution',
  surface: { zhEntity: '田间巡检车', enEntity: 'field rover', zhSetting: '笔直作物巡检通道', enSetting: 'a straight crop inspection lane' }
};
function responseFor(candidates) { return JSON.stringify({ candidates }); }
function historyFrom(proposal) {
  const blueprint = subjectPracticeScenarioBlueprintProposalFor({ binding, proposal });
  return {
    blueprintFingerprint: blueprint.blueprintFingerprint,
    renameInvariantFingerprint: blueprint.renameInvariantFingerprint,
    canonicalDimensions: blueprint.canonicalDimensions,
    lifecycleStatus: 'stable', failureCodes: []
  };
}

function main() {
  const commonHistory = historyFrom(common);
  const selected = subjectPracticeScenarioBlueprintIdeationCycleFor({
    ideationRequest: request, rawResponse: responseFor([common, uncommon]), historicalSummaries: [commonHistory]
  });
  const repeated = subjectPracticeScenarioBlueprintIdeationCycleFor({
    ideationRequest: request, rawResponse: responseFor([common, uncommon]), historicalSummaries: [commonHistory]
  });
  const allKnown = subjectPracticeScenarioBlueprintIdeationCycleFor({
    ideationRequest: request, rawResponse: responseFor([common, uncommon]), historicalSummaries: [commonHistory, historyFrom(uncommon)]
  });
  const invalidResponse = subjectPracticeScenarioBlueprintIdeationCycleFor({
    ideationRequest: request, rawResponse: responseFor([common]), historicalSummaries: []
  });
  const invalidHistory = subjectPracticeScenarioBlueprintIdeationCycleFor({
    ideationRequest: request, rawResponse: responseFor([common, uncommon]),
    historicalSummaries: [{ ...commonHistory, prompt: 'forbidden content' }]
  });
  const checks = {
    responseAndMemoryAreComposedInOrder:
      selected.responseStatus === 'accepted_provisional_blueprint_batch'
      && selected.memoryStatus === 'ranked_shadow_only',
    knownCandidateIsFilteredAndNovelCandidateSelected:
      selected.status === 'selected_provisional_blueprint_shadow_only'
      && selected.rankableNovelCandidateCount === 1
      && selected.selectedBlueprintFingerprint === historyFrom(uncommon).blueprintFingerprint,
    cycleEvidenceIsDeterministic:
      selected.cycleEvidenceDigest === repeated.cycleEvidenceDigest
      && /^[a-f0-9]{64}$/.test(selected.cycleEvidenceDigest),
    allKnownCandidatesProduceNoSelection:
      allKnown.status === 'no_novel_blueprint_candidate'
      && allKnown.selectedBlueprintFingerprint === null,
    invalidResponseStopsBeforeMemory:
      invalidResponse.status === 'rejected_response_batch'
      && invalidResponse.memoryStatus === 'not_run_response_rejected',
    invalidHistoryFailsClosed:
      invalidHistory.status === 'rejected_memory_input',
    orchestratorEmitsNoRawOrSurfaceContent:
      selected.rawResponseRetained === false
      && selected.selectedSurfaceEmitted === false
      && !JSON.stringify(selected).includes('田间巡检车'),
    selectionAuthorizesNothing:
      selected.providerCallAuthorized === false
      && selected.productionGenerationAuthorized === false
      && selected.publicationAuthorized === false,
    quotaRemainsUnfrozen: selected.selectionQuotaFrozen === false
  };
  const report = {
    mode: 'subject_practice_scenario_blueprint_orchestrator_self_test',
    reportVersion: 'subject-practice-scenario-blueprint-orchestrator-self-test-v1',
    status: Object.values(checks).every(Boolean) ? 'passed' : 'failed', checks,
    providerImpact: 'none_fixture_only', databaseImpact: 'none_no_database_connection',
    productionImpact: 'none_shadow_only_not_connected'
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.status !== 'passed') process.exitCode = 1;
}

if (require.main === module) main();

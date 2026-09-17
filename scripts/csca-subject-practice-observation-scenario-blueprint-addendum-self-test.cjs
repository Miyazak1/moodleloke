#!/usr/bin/env node

require('../backend/node_modules/ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', moduleResolution: 'node' }
});

const {
  buildSubjectPracticeObservationBatchManifest
} = require('../backend/src/ai-questioning/subject-practice-observation-batch-manifest-policy');
const {
  buildSubjectPracticeObservationScenarioBlueprintAddendum,
  assertSubjectPracticeObservationScenarioBlueprintAddendum,
  subjectPracticeObservationScenarioBlueprintTaskEnvelopeFor,
  assertSubjectPracticeObservationScenarioBlueprintTaskEnvelope,
  subjectPracticeObservationScenarioBlueprintContextForOrdinal
} = require('../backend/src/ai-questioning/subject-practice-observation-scenario-blueprint-addendum-policy');
const { subjectPracticeScenarioBlueprintIdeationRequestFor } = require('../backend/src/ai-questioning/subject-practice-scenario-blueprint-ideation-policy');
const { subjectPracticeScenarioBlueprintResponseGateFor } = require('../backend/src/ai-questioning/subject-practice-scenario-blueprint-response-policy');
const { subjectPracticeScenarioBlueprintIdeationCycleFor } = require('../backend/src/ai-questioning/subject-practice-scenario-blueprint-orchestrator');
const { subjectPracticeScenarioBlueprintMaterializationFor } = require('../backend/src/ai-questioning/subject-practice-scenario-blueprint-materialization-policy');
const fs = require('node:fs');
const path = require('node:path');

const scopes = [
  'uniform_speed',
  'acceleration_from_velocity_change',
  'final_velocity_from_initial_acceleration_time',
  'displacement_from_initial_acceleration_time'
];
const scenarios = [
  ['harbor logistics', 'autonomous carrier', 'straight loading lane', 'transport cargo', '自动运输车', 'autonomous carrier', '港区直线装卸通道', 'a straight harbor loading lane'],
  ['agricultural monitoring', 'field rover', 'straight crop lane', 'inspect crops', '田间巡检车', 'field rover', '笔直作物巡检通道', 'a straight crop inspection lane'],
  ['airport ground service', 'baggage tractor', 'straight service road', 'move baggage', '行李牵引车', 'baggage tractor', '机场直线服务道', 'a straight airport service road'],
  ['factory inspection', 'inspection trolley', 'straight assembly lane', 'inspect equipment', '设备巡检车', 'inspection trolley', '工厂直线装配通道', 'a straight factory assembly lane']
];

const manifest = buildSubjectPracticeObservationBatchManifest(scopes.map((scope, index) => ({
  ordinal: index + 1,
  subject: 'physics',
  productionRunId: 2,
  productionCellId: 24,
  taskFamily: 'kinematics_basic_direct_relation',
  planTemplate: 'physics_kinematics_basic_relation_v1',
  plannedScopeId: `physics-basic-kinematics-v2:${scope}`
})));

function contextFor(scope, scenario) {
  const binding = {
    subject: 'physics', taskFamily: 'kinematics_basic_direct_relation',
    planTemplate: 'physics_kinematics_basic_relation_v1', exactScope: scope,
    difficultyBand: 'basic', targetCognitiveSkill: 'direct_relation_application'
  };
  const proposal = {
    scenarioMode: 'real_world', scenarioDomain: scenario[0], scenarioEntity: scenario[1],
    environment: scenario[2], scenarioAction: scenario[3], informationForm: 'motion observations in text',
    questionPurpose: 'infer a direct kinematics relation', contextNecessity: 'required_for_solution',
    surface: { zhEntity: scenario[4], enEntity: scenario[5], zhSetting: scenario[6], enSetting: scenario[7] }
  };
  const alternate = {
    ...proposal,
    scenarioDomain: `${scenario[0]} training`, scenarioEntity: `${scenario[1]} trainer`,
    environment: `${scenario[2]} training area`, scenarioAction: `${scenario[3]} for training`,
    surface: { ...proposal.surface, zhEntity: `${proposal.surface.zhEntity}教具`, enEntity: `${proposal.surface.enEntity} trainer` }
  };
  const request = subjectPracticeScenarioBlueprintIdeationRequestFor({
    binding, historySummary: { dimensionCounts: {}, underrepresentedDimensions: {}, concentrationWarnings: [], failureReasonCodes: [] },
    requestedCandidateCount: 2
  });
  const rawResponse = JSON.stringify({ candidates: [proposal, alternate] });
  const response = subjectPracticeScenarioBlueprintResponseGateFor({ ideationRequest: request, rawResponse });
  const cycle = subjectPracticeScenarioBlueprintIdeationCycleFor({
    ideationRequest: request, rawResponse, historicalSummaries: []
  });
  const selectedBlueprint = response.blueprints.find((item) =>
    item.blueprintFingerprint === cycle.selectedBlueprintFingerprint);
  const materialized = subjectPracticeScenarioBlueprintMaterializationFor({
    binding, selectedBlueprint, ideationCycle: cycle
  });
  return {
    binding, selectedBlueprint, ideationCycle: cycle,
    provisionalScenarioContract: materialized.provisionalScenarioContract
  };
}

const entries = scopes.map((scope, index) => ({
  taskOrdinal: index + 1,
  scenarioBlueprintShadowContext: contextFor(scope, scenarios[index])
}));

function rejected(addendum) {
  try {
    assertSubjectPracticeObservationScenarioBlueprintAddendum({ manifest, addendum });
    return false;
  } catch {
    return true;
  }
}

function jsonbOrdered(value) {
  if (Array.isArray(value)) return value.map(jsonbOrdered);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, jsonbOrdered(value[key])]));
}

function main() {
  const serviceSource = fs.readFileSync(path.resolve(__dirname, '../backend/src/ai-questioning/ai-questioning.service.ts'), 'utf8');
  const providerSource = fs.readFileSync(path.resolve(__dirname, '../backend/src/ai-questioning/question-generator-provider.service.ts'), 'utf8');
  const runnerSource = fs.readFileSync(path.resolve(__dirname, './csca-subject-practice-local-shadow-family-qualification-run.cjs'), 'utf8');
  const preflightSource = fs.readFileSync(path.resolve(__dirname, './csca-subject-practice-local-shadow-batch-preflight.cjs'), 'utf8');
  const addendum = buildSubjectPracticeObservationScenarioBlueprintAddendum({ manifest, entries });
  const asserted = assertSubjectPracticeObservationScenarioBlueprintAddendum({ manifest, addendum });
  const ordinalThree = subjectPracticeObservationScenarioBlueprintContextForOrdinal({
    manifest, addendum, taskOrdinal: 3
  });
  const compactTaskEnvelope = subjectPracticeObservationScenarioBlueprintTaskEnvelopeFor({
    manifest, addendum, taskOrdinal: 3
  });
  const assertedTaskEnvelope = assertSubjectPracticeObservationScenarioBlueprintTaskEnvelope({
    manifest, envelope: compactTaskEnvelope
  });
  const jsonbRoundTrippedTaskEnvelope = assertSubjectPracticeObservationScenarioBlueprintTaskEnvelope({
    manifest,
    envelope: jsonbOrdered(JSON.parse(JSON.stringify(compactTaskEnvelope)))
  });
  const checks = {
    fullBatchAddendumBuilds:
      asserted.expectedTaskCount === 4
      && asserted.entries.length === 4
      && /^[a-f0-9]{64}$/.test(asserted.addendumSha256),
    manifestIdentityBound:
      asserted.batchId.startsWith('local-shadow-')
      && /^[a-f0-9]{64}$/.test(asserted.manifestSha256),
    ordinalResolvesExactContext:
      ordinalThree.binding.exactScope === scopes[2]
      && ordinalThree.provisionalScenarioContract.solverAction === scopes[2],
    compactTaskEnvelopeRevalidatesWithoutOtherFullContexts:
      assertedTaskEnvelope.taskOrdinal === 3
      && assertedTaskEnvelope.scenarioBlueprintShadowContext.binding.exactScope === scopes[2]
      && compactTaskEnvelope.entryIndex.length === 4
      && compactTaskEnvelope.entry.scenarioBlueprintShadowContext === addendum.entries[2].scenarioBlueprintShadowContext,
    jsonbKeyReorderingPreservesTaskEnvelopeIdentity:
      jsonbRoundTrippedTaskEnvelope.taskOrdinal === 3
      && jsonbRoundTrippedTaskEnvelope.scenarioBlueprintRootSha256 === compactTaskEnvelope.scenarioBlueprintRootSha256,
    zeroProviderAndPublicationSuppressed:
      asserted.providerAttemptLimit === 0
      && asserted.maximumEstimatedCostUsd === 0
      && asserted.publicationSuppressed === true
      && asserted.publicationAuthorized === false,
    concentrationLimited:
      asserted.maximumFamilyShare === 0.25
      && Object.keys(asserted.familyCounts).length === 4,
    missingOrdinalRejected:
      rejected({ ...addendum, entries: addendum.entries.slice(0, 3) }),
    duplicateOrdinalRejected:
      rejected({ ...addendum, entries: addendum.entries.map((entry, index) => index === 3 ? { ...entry, taskOrdinal: 3 } : entry) }),
    contractTamperRejected:
      rejected({
        ...addendum,
        entries: addendum.entries.map((entry, index) => index === 0 ? {
          ...entry,
          scenarioBlueprintShadowContext: {
            ...entry.scenarioBlueprintShadowContext,
            provisionalScenarioContract: {
              ...entry.scenarioBlueprintShadowContext.provisionalScenarioContract,
              solverAction: 'displacement_from_initial_acceleration_time'
            }
          }
        } : entry)
      }),
    manifestDigestTamperRejected:
      rejected({ ...addendum, manifestSha256: '0'.repeat(64) }),
    taskEnvelopeRootTamperRejected: (() => {
      try {
        assertSubjectPracticeObservationScenarioBlueprintTaskEnvelope({
          manifest,
          envelope: { ...compactTaskEnvelope, scenarioBlueprintRootSha256: '0'.repeat(64) }
        });
        return false;
      } catch {
        return true;
      }
    })(),
    observationApiRevalidatesAndStoresTaskEnvelope:
      serviceSource.includes('assertSubjectPracticeObservationScenarioBlueprintTaskEnvelope')
      && serviceSource.includes('scenarioBlueprintTaskEnvelope')
      && serviceSource.includes('scenario_blueprint_task_envelope_requires_local_zero_provider_route'),
    generationJobCarriesOnlyValidatedShadowContext:
      serviceSource.includes('executionScenarioBlueprintShadowContext')
      && serviceSource.includes('scenarioBlueprintShadowContext: executionScenarioBlueprintShadowContext')
      && providerSource.includes('subjectPracticeScenarioBlueprintShadowEvidenceFor'),
    qualificationRunnerBindsAddendumIntoAuthorizationAndSubmissions:
      runnerSource.includes("argValue('scenario-blueprint-addendum')")
      && runnerSource.includes('scenarioBlueprintRootSha256')
      && runnerSource.includes('scenarioBlueprintTaskEnvelope: subjectPracticeObservationScenarioBlueprintTaskEnvelopeFor'),
    dynamicShadowRequiresFrozenIndependentHoldoutQualification:
      runnerSource.includes('subjectPracticeDynamicScenarioQualificationDecision')
      && runnerSource.includes('dynamicScenarioQualification?.status'),
    staleBackendCannotSilentlyIgnoreDynamicEnvelope:
      serviceSource.includes('scenarioBlueprintObservationEnvelopeSupported: true')
      && preflightSource.includes('scenarioBlueprintObservationEnvelopeSupported')
      && runnerSource.includes('target_backend_dynamic_scenario_envelope_not_supported'),
    qualificationRemainsDisabled:
      asserted.releaseQualification === false
      && asserted.productionGenerationAuthorized === false
  };
  const report = {
    mode: 'subject_practice_observation_scenario_blueprint_addendum_self_test',
    reportVersion: 'subject-practice-observation-scenario-blueprint-addendum-self-test-v1',
    status: Object.values(checks).every(Boolean) ? 'passed' : 'failed',
    checks,
    providerCallCount: 0,
    estimatedCostUsd: 0,
    databaseImpact: 'none',
    publicationImpact: 'none'
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.status !== 'passed') process.exitCode = 1;
}

if (require.main === module) main();

#!/usr/bin/env node

require('../backend/node_modules/ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', moduleResolution: 'node' }
});

const fs = require('node:fs');
const path = require('node:path');
const {
  subjectPracticeScenarioBlueprintResponseGateFor
} = require('../backend/src/ai-questioning/subject-practice-scenario-blueprint-response-policy');
const {
  materializeSubjectPracticeObservationScenarioBlueprintResponsePack
} = require('../backend/src/ai-questioning/subject-practice-observation-scenario-blueprint-pack-policy');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', relativePath), 'utf8'));
}

const candidates = [
  {
    scenarioMode: 'real_world', scenarioDomain: 'municipal water process control',
    scenarioEntity: 'treated water sample', environment: 'water treatment control station',
    scenarioAction: 'assess a single water sample using recorded solution data',
    informationForm: 'documented starting state and process target criterion',
    questionPurpose: 'check whether the planned liquid adjustment meets the treatment requirement',
    contextNecessity: 'required_for_solution',
    surface: { zhEntity: '处理水样', enEntity: 'treated water sample', zhSetting: '水处理控制站', enSetting: 'water treatment control station' }
  },
  {
    scenarioMode: 'experimental', scenarioDomain: 'laboratory solution preparation',
    scenarioEntity: 'prepared solution aliquot', environment: 'controlled preparation workspace',
    scenarioAction: 'prepare a single liquid aliquot from documented solution data',
    informationForm: 'tabulated source state and required preparation condition',
    questionPurpose: 'decide whether the preparation plan reaches the required sample condition',
    contextNecessity: 'required_for_solution',
    surface: { zhEntity: '配制液体等分试样', enEntity: 'prepared solution aliquot', zhSetting: '受控配制工作区', enSetting: 'controlled preparation workspace' }
  },
  {
    scenarioMode: 'hypothetical', scenarioDomain: 'industrial liquid process adjustment',
    scenarioEntity: 'process reagent solution', environment: 'simulated process control room',
    scenarioAction: 'adjust a single reagent solution using a recorded process state',
    informationForm: 'logged initial condition and desired process criterion',
    questionPurpose: 'explain which adjustment direction is consistent with the process requirement',
    contextNecessity: 'required_for_solution',
    surface: { zhEntity: '工艺试剂溶液', enEntity: 'process reagent solution', zhSetting: '模拟流程控制室', enSetting: 'simulated process control room' }
  },
  {
    scenarioMode: 'real_world', scenarioDomain: 'solution product quality assurance',
    scenarioEntity: 'liquid product sample', environment: 'production quality review station',
    scenarioAction: 'inspect a single liquid sample against documented process data',
    informationForm: 'quality record with current state and acceptance criterion',
    questionPurpose: 'determine whether the planned adjustment satisfies the product requirement',
    contextNecessity: 'required_for_solution',
    surface: { zhEntity: '液体产品样品', enEntity: 'liquid product sample', zhSetting: '生产质量审核工位', enSetting: 'production quality review station' }
  }
];

function main() {
  const pack = readJson('artifacts/ai-questioning/chemistry-dynamic-scenario-v9-method-neutral-low-temp-request-pack.json');
  const manifest = readJson('artifacts/ai-questioning/chemistry-dynamic-scenario-v3-context-compatible-20260914-manifest.json');
  const rawResponse = JSON.stringify({ candidates });
  const gates = pack.requests.map((entry) => subjectPracticeScenarioBlueprintResponseGateFor({
    ideationRequest: entry.request,
    rawResponse
  }));
  const materialized = materializeSubjectPracticeObservationScenarioBlueprintResponsePack({
    manifest,
    ideationPack: pack,
    responses: pack.requests.map((entry) => ({ requestDigest: entry.requestDigest, rawResponse }))
  });
  const checks = {
    allThreeExactScopesAcceptSameMethodNeutralResponse:
      gates.length === 3
      && gates.every((gate) => gate.status === 'accepted_provisional_blueprint_batch'
        && gate.acceptedCandidateCount === 4),
    responseFitsConfiguredCharacterBudget:
      rawResponse.length < Math.min(...pack.requests.map((entry) => entry.request.maximumResponseCharacters)),
    twelveScopeBoundBlueprintsMaterialize:
      materialized.status === 'materialized_addendum_shadow_only'
      && materialized.candidateBlueprintCount === 12,
    allFortyEightOrdinalsReceiveContext:
      materialized.addendum?.entries?.length === 48
      && new Set(materialized.addendum.entries.map((entry) => entry.taskOrdinal)).size === 48,
    satisfiabilityRunAuthorizesNothing:
      materialized.addendum?.productionGenerationAuthorized === false
      && materialized.addendum?.publicationAuthorized === false
  };
  const report = {
    mode: 'subject_practice_chemistry_scenario_contract_satisfiability',
    reportVersion: 'chemistry-scenario-contract-satisfiability-v1-method-neutral-48-ordinal',
    status: Object.values(checks).every(Boolean) ? 'passed' : 'failed',
    checks,
    rawResponseCharacters: rawResponse.length,
    acceptedExactScopeCount: gates.filter((gate) => gate.status === 'accepted_provisional_blueprint_batch').length,
    materializedEntryCount: materialized.addendum?.entries?.length ?? 0,
    gateDiagnostics: gates.map((gate, index) => ({
      exactScope: pack.requests[index].exactScope,
      blockers: gate.blockers,
      candidateDiagnostics: gate.candidateDiagnostics
    })),
    materializationBlockers: materialized.blockers ?? [],
    realProviderCallCount: 0,
    databaseImpact: 'none_fixture_only',
    publicationImpact: 'none'
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.status !== 'passed') process.exitCode = 1;
}

if (require.main === module) main();

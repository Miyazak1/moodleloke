'use strict';
require('reflect-metadata');
const assert = require('node:assert/strict');
const { VerifiedMath143Adapter } = require('../dist/backend/src/question-engine-plugin/verified-math143.adapter.js');
const { QuestionEnginePluginRegistryService } = require('../dist/backend/src/question-engine-plugin/question-engine-plugin-registry.service.js');
const { RetiredGenerationRoutesGuard } = require('../dist/backend/src/question-engine-plugin/retired-generation-routes.guard.js');
const { QuestionGeneratorProviderService } = require('../dist/backend/src/ai-questioning/question-generator-provider.service.js');
const { evaluateQuestionCandidateWriteGate } = require('../dist/backend/src/question-engine-plugin/question-candidate-write-gate.js');
const { VerifiedMathSupplyDemandSchema } = require('../dist/backend/src/agent/question-supply-fulfillment.contract.js');
const { verifiedMathCellsForTopic, verifiedMathScopeMatches, verifiedMathSeedLimit } = require('../dist/backend/src/question-engine-plugin/verified-math-topic-binding.js');

async function main() {
  Object.assign(process.env, { QUESTION_ENGINE_PLUGIN_ID: 'verified-math-1.43', QUESTION_ENGINE_PLUGIN_ENABLED: 'true', MOODLELIKE_MATH_ENGINE_ENABLED: 'true',
    CSCA_AI_QUESTION_GENERATION_ENABLED: 'true', CSCA_AI_QUESTION_REVIEW_ENABLED: 'true', CSCA_AI_QUESTIONING_SCHEDULER_ENABLED: 'true', QUESTION_ENGINE_EXECUTION_MODE: 'sidecar' });
  const adapter = new VerifiedMath143Adapter();
  const catalog = adapter.catalog().cells;
  assert.equal(verifiedMathSeedLimit({ id: 'finite', capacity: 20, samplingMode: 'finite-stock-index' }), 20);
  assert.equal(verifiedMathSeedLimit({ id: 'empty', capacity: 0, samplingMode: 'finite-stock-index' }), 0);
  assert.equal(verifiedMathSeedLimit({ id: 'parameter', capacity: 0, samplingMode: 'parameter-seed' }), 2147483647);
  for (const band of ['basic', 'medium', 'hard']) {
    assert.equal(verifiedMathCellsForTopic('math-solid-geometry', band, catalog)[0].id, 'M-GEO-002:' + band);
    assert.equal(verifiedMathCellsForTopic('M-GEO-002', band, catalog)[0].id, 'M-GEO-002:' + band);
    assert.equal(verifiedMathCellsForTopic('math-coordinate-geometry', band, catalog).length, 0, 'do not substitute solid volumes for spatial coordinates');
    assert.equal(verifiedMathCellsForTopic('unknown-topic', band, catalog).length, 0);
    for (const [hostCode, prefix] of [['math-solid-vector', 'vector_'], ['math-complex', 'complex_']]) {
      const cells = verifiedMathCellsForTopic(hostCode, band, catalog);
      assert.equal(cells.length, 1);
      assert.equal(cells[0].scopes.length, 2);
      assert.ok(cells[0].scopes.every(scope => scope.id.split(':')[1].startsWith(prefix)));
      for (const scope of catalog.find(cell => cell.id === 'M-ALG-001:' + band).scopes) {
        assert.equal(verifiedMathScopeMatches(hostCode, band, 'M-ALG-001:' + band, scope.id, catalog), scope.id.split(':')[1].startsWith(prefix));
      }
    }
    assert.deepEqual(verifiedMathCellsForTopic('math-probability', band, catalog).map(cell => cell.topicCode).sort(), ['M-PROB-001', 'M-STAT-001', 'M-STAT-002']);
  }
  const registry = new QuestionEnginePluginRegistryService(adapter);
  assert.deepEqual(registry.getStatus().plugins.map(plugin => [plugin.descriptor.id, plugin.descriptor.version, plugin.descriptor.subjects]), [['verified-math-1.43', '1.43.0', ['math']]]);
  assert.equal(registry.isVerifiedMathEnabled(), true);
  for (const capability of ['question.generate', 'question.review', 'question.topic-map']) assert.equal(registry.allowsProductionCapability(capability), false);
  await assert.rejects(registry.executeSidecarCapability('question.generate', {}), /legacy_question_engine_retired/);
  process.env.QUESTION_ENGINE_PLUGIN_ID = 'moodlelike-ai-questioning';
  assert.equal(registry.isVerifiedMathEnabled(), false, 'retired ID cannot be selected');
  process.env.QUESTION_ENGINE_PLUGIN_ID = 'verified-math-1.43';
  let calls = 0;
  const generator = new QuestionGeneratorProviderService({ build() { calls++; } }, { generate() { calls++; } });
  for (const subject of ['math', 'physics', 'chemistry']) await assert.rejects(generator.generate({ subject }, {}), /legacy_question_engine_retired/);
  assert.equal(calls, 0);
  const guard = new RetiredGenerationRoutesGuard();
  const context = (method, originalUrl) => ({ switchToHttp: () => ({ getRequest: () => ({ method, originalUrl }) }) });
  for (const route of ['blueprints/1/generate', 'generation-jobs/enqueue', 'pregeneration/run', 'subject-practice-production-runs', 'questions/1/approve']) {
    assert.throws(() => guard.canActivate(context('POST', '/api/v1/admin/ai-questioning/' + route)), error => error.getStatus() === 410);
  }
  assert.equal(guard.canActivate(context('GET', '/api/v1/admin/ai-questioning/questions')), true);
  assert.equal(guard.canActivate(context('POST', '/api/v1/admin/ai-questioning/subject-practice-production-runs/1/cancel')), true);
  const demand = { schemaVersion: 'question-supply-plugin-v2', requestKey: 'test', source: 'student_free_practice', subjectCode: 'math',
    topicId: 1, topicCode: 'M-GEO-002', difficulty: 'hard', requestedCount: 3, sourcePolicy: 'reviewed_published_only' };
  assert.equal(VerifiedMathSupplyDemandSchema.parse(demand).difficulty, 'hard');
  assert.equal(VerifiedMathSupplyDemandSchema.safeParse({ ...demand, subjectCode: 'physics' }).success, false);
  assert.equal(VerifiedMathSupplyDemandSchema.safeParse({ ...demand, difficulty: undefined }).success, false);
  const candidate = { subject: 'math', topicId: 1, sourceType: 'verified_math_engine', designedDifficulty: '较难', syllabusVersion: '2025', questionType: 'single_choice',
    prompt: '题干', options: ['A','B','C','D'].map(id => ({ id, text: id })), correctAnswer: 'A', explanation: '解析', knowledgeTags: [], optionMetadata: [] };
  const input = { candidate, review: { status: 'passed', issues: [], dimensions: [], sources: ['deterministic'], checkedAt: new Date().toISOString() },
    generationMetadata: { generator: 'local-deterministic', intendedUse: 'subject_practice', automatedCandidateLeakageGate: { status: 'clear' } }, sourceSimilarity: {} };
  assert.equal(evaluateQuestionCandidateWriteGate(input).decision, 'block');
  const proof = { pluginId: 'verified-math-1.43', version: '1.43.0', contentBound: true, beforeStorePassed: true, oraclePassed: true, teachingPassed: true };
  assert.equal(evaluateQuestionCandidateWriteGate({ ...input, verifiedMathEvidence: proof }).decision, 'allow_candidate_write');
  assert.equal(evaluateQuestionCandidateWriteGate({ ...input, verifiedMathEvidence: { ...proof, oraclePassed: false } }).decision, 'block');
  const output = await registry.generateVerifiedMath(require('../../question-engine/math-v143/examples/cone.json'));
  registry.assertVerifiedMath(output);
  assert.throws(() => registry.assertVerifiedMath(structuredClone(output)), /VERIFIED_MATH_EVIDENCE_CHANGED/);
  output.result.gate.checks.oracle = false;
  assert.throws(() => registry.assertVerifiedMath(output), /VERIFIED_MATH_EVIDENCE_CHANGED/);
  console.log('VERIFIED_MATH_PLUGIN_OK: sole registry, retired engines sealed, versioned difficulty demand, write gate, real frozen evidence and tamper rejection; Provider 0 / $0.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });

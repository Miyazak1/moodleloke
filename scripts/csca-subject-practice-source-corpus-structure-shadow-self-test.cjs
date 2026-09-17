#!/usr/bin/env node

require('../backend/node_modules/ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', moduleResolution: 'node' }
});

const {
  subjectPracticeSourceCorpusStructureShadowMatch
} = require('../backend/src/ai-questioning/subject-practice-source-corpus-structure-shadow-policy');

const exact = subjectPracticeSourceCorpusStructureShadowMatch({
  sourceField: 'prompt', sourceText: 'Find the value of f(2) when f(x)=3x+1.',
  candidateText: 'Find the value of f(2) when f(x)=3x+1.'
});
const numeric = subjectPracticeSourceCorpusStructureShadowMatch({
  sourceField: 'prompt', sourceText: 'Find the value of f(2) when f(x)=3x+1.',
  candidateText: 'Find the value of f(3) when f(x)=4x+2.'
});
const reordered = subjectPracticeSourceCorpusStructureShadowMatch({
  sourceField: 'options', sourceText: 'A:increasing\nB:decreasing\nC:constant\nD:undefined',
  candidateText: 'D:undefined\nB:decreasing\nA:increasing\nC:constant'
});
const different = subjectPracticeSourceCorpusStructureShadowMatch({
  sourceField: 'prompt', sourceText: 'Find the value of f(2) when f(x)=3x+1.',
  candidateText: 'Which graph represents a quadratic function with two roots?'
});
const shortAnswer = subjectPracticeSourceCorpusStructureShadowMatch({
  sourceField: 'answer', sourceText: 'A', candidateText: 'A'
});

const checks = {
  exactNormalizedDetected: exact.matchedSignals.includes('exact_normalized'),
  numericTemplateDetected: numeric.matchedSignals.includes('numeric_template'),
  optionOrderInvariantDetected: reordered.matchedSignals.includes('option_multiset_order_invariant'),
  distinctStructureAllowedInShadow: !different.matched,
  shortCommonAnswerNotClaimedDuplicate: !shortAnswer.comparable && !shortAnswer.matched,
  remainsShadowOnly: [exact, numeric, reordered].every((item) => item.mode === 'shadow_only_not_release_gate')
};
const report = {
  mode: 'subject_practice_source_corpus_structure_shadow_self_test',
  reportVersion: 'subject-practice-source-corpus-structure-shadow-self-test-v1',
  status: Object.values(checks).every(Boolean) ? 'passed' : 'failed',
  checks,
  providerImpact: 'none_no_provider_call', dbImpact: 'none_fixture_only', productionImpact: 'none_shadow_only'
};
if (require.main === module) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.status !== 'passed') process.exitCode = 1;
}
module.exports = { report };

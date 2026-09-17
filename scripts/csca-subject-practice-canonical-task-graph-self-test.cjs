#!/usr/bin/env node

require('../backend/node_modules/ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', moduleResolution: 'node' }
});

const crypto = require('node:crypto');
const {
  SUBJECT_PRACTICE_CANONICAL_GRAPH_REQUIRED_INVENTORY_PROTOCOL,
  createSubjectPracticeFormalGraphDistinctOpaqueProof,
  qualifySubjectPracticeCanonicalGraphPair,
  subjectPracticeCanonicalTaskGraphSha256
} = require('../backend/src/ai-questioning/subject-practice-canonical-task-graph-policy');

const hash = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');
const revision = (name, protocol = SUBJECT_PRACTICE_CANONICAL_GRAPH_REQUIRED_INVENTORY_PROTOCOL) => ({
  sourceSystem: name === 'source' ? 'local_repository' : 'database',
  documentId: 'math-april', questionOrdinal: '16', lineageId: 'lineage-16',
  rawContentSha256: hash(name), observedAt: '2026-09-13T00:00:00.000Z',
  inventoryProtocol: protocol, inventorySnapshotSha256: hash('inventory')
});
const task = (options) => ({
  schemaVersion: 'subject-practice-canonical-task-graph-v1', subject: 'math',
  syllabusScope: 'elementary_functions', taskFamily: 'direct_property',
  verificationScope: 'elementary_function_direct_property',
  typedGivens: [{ symbol: 'b', value: '2' }, { symbol: 'a', value: '1' }],
  target: { kind: 'property', expression: { function: 'exp' } }, assumptions: ['a > 0'],
  relationAst: { op: 'exp', base: '2', variable: 'x' }, optionSemantics: options,
  parserVersion: 'fixture-parser-v1', normalizerVersion: 'fixture-normalizer-v1'
});
const solution = () => ({
  schemaVersion: 'subject-practice-canonical-solution-graph-v1',
  steps: [{ rule: 'exp_monotonicity', inputs: ['base>1'], output: 'increasing' }],
  derivedValues: [{ symbol: 'direction', value: 'increasing' }],
  finalSemanticAnswer: 'increasing', solverVersion: 'fixture-solver-v1', oracleVersion: 'fixture-oracle-v1'
});
const base = {
  inventoryCoverageStatus: 'complete', sourceRevision: revision('source'), candidateRevision: revision('candidate'),
  sourceTaskGraph: task([{ semanticValue: 'increasing', isCorrect: true }, { semanticValue: 'decreasing', isCorrect: false }]),
  candidateTaskGraph: task([{ semanticValue: 'decreasing', isCorrect: false }, { semanticValue: 'increasing', isCorrect: true }]),
  sourceSolutionGraph: solution(), candidateSolutionGraph: solution(),
  surfaceRelation: 'option_permutation_equivalent', sourceParsed: true, candidateParsed: true,
  solverOracleAgreement: true, roundTripVerified: true
};
const equivalent = qualifySubjectPracticeCanonicalGraphPair(base);
const legacy = qualifySubjectPracticeCanonicalGraphPair({
  ...base, candidateRevision: revision('candidate', 'subject_practice_source_corpus_db_inventory_v1')
});
const partial = qualifySubjectPracticeCanonicalGraphPair({ ...base, inventoryCoverageStatus: 'partial' });
const sameArchetype = qualifySubjectPracticeCanonicalGraphPair({
  ...base, surfaceRelation: 'parameter_variant_same_task_template'
});
const distinctCandidateTask = {
  ...base.candidateTaskGraph,
  typedGivens: [{ symbol: 'b', value: '3' }, { symbol: 'a', value: '1' }],
  relationAst: { op: 'exp', base: '3', variable: 'x' }
};
const distinctProof = createSubjectPracticeFormalGraphDistinctOpaqueProof({
  sourceTaskGraph: base.sourceTaskGraph,
  candidateTaskGraph: distinctCandidateTask,
  sourceSolutionGraph: base.sourceSolutionGraph,
  candidateSolutionGraph: base.candidateSolutionGraph,
  verifierVersion: 'fixture-distinct-verifier-v1'
});
const distinct = qualifySubjectPracticeCanonicalGraphPair({
  ...base,
  candidateTaskGraph: distinctCandidateTask,
  surfaceRelation: 'semantically_distinct_revision',
  formalDistinctProof: distinctProof
});
const forgedDistinct = qualifySubjectPracticeCanonicalGraphPair({
  ...base,
  candidateTaskGraph: distinctCandidateTask,
  surfaceRelation: 'semantically_distinct_revision',
  formalDistinctProof: distinctProof ? { ...distinctProof } : null
});
const parserOnlyProof = createSubjectPracticeFormalGraphDistinctOpaqueProof({
  sourceTaskGraph: base.sourceTaskGraph,
  candidateTaskGraph: { ...base.sourceTaskGraph, parserVersion: 'different-parser-only' },
  sourceSolutionGraph: base.sourceSolutionGraph,
  candidateSolutionGraph: base.candidateSolutionGraph,
  verifierVersion: 'fixture-distinct-verifier-v1'
});
const orderInvariant = subjectPracticeCanonicalTaskGraphSha256(base.sourceTaskGraph)
  === subjectPracticeCanonicalTaskGraphSha256(base.candidateTaskGraph);
const checks = {
  optionOrderIsCanonical: orderInvariant,
  equivalentPairBecomesFormalRejectGold: equivalent.status === 'formal_graph_proven'
    && equivalent.expectedAction === 'reject' && equivalent.labelProvenance === 'formal_graph_proven',
  legacyInventoryRejected: legacy.status === 'ambiguous_excluded'
    && legacy.reasonCodes.includes('canonical_graph_inventory_protocol_invalid_or_legacy'),
  partialInventoryCannotQualify: partial.status === 'ambiguous_excluded'
    && partial.reasonCodes.includes('canonical_graph_complete_inventory_missing'),
  sameArchetypeRequiresProductPolicy: sameArchetype.status === 'ambiguous_excluded'
    && sameArchetype.reasonCodes.includes('canonical_graph_same_archetype_product_policy_required'),
  semanticDifferenceCreatesOpaqueAllowProof: Boolean(distinctProof)
    && distinct.status === 'formal_graph_proven' && distinct.expectedAction === 'allow'
    && distinct.formalDistinctWitnessKind === 'different_givens',
  copiedProofObjectCannotQualify: forgedDistinct.status === 'ambiguous_excluded'
    && forgedDistinct.expectedAction === 'exclude',
  parserVersionDifferenceAloneCannotCreateDistinctProof: parserOnlyProof === null
};
const report = {
  mode: 'subject_practice_canonical_task_graph_self_test',
  reportVersion: 'subject-practice-canonical-task-graph-self-test-v2',
  status: Object.values(checks).every(Boolean) ? 'passed' : 'failed', checks,
  providerImpact: 'none_no_provider_call', databaseImpact: 'none_fixture_only',
  productionImpact: 'none_gold_contract_only'
};

if (require.main === module) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.status !== 'passed') process.exitCode = 1;
}

module.exports = { report };

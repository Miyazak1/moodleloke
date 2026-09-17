import { createHash } from 'node:crypto';

export const SUBJECT_PRACTICE_CANONICAL_TASK_GRAPH_POLICY_VERSION =
  'subject-practice-canonical-task-graph-policy-v2';
export const SUBJECT_PRACTICE_CANONICAL_TASK_GRAPH_SCHEMA_VERSION =
  'subject-practice-canonical-task-graph-v1';
export const SUBJECT_PRACTICE_CANONICAL_SOLUTION_GRAPH_SCHEMA_VERSION =
  'subject-practice-canonical-solution-graph-v1';
export const SUBJECT_PRACTICE_CANONICAL_GRAPH_REQUIRED_INVENTORY_PROTOCOL =
  'subject_practice_source_corpus_db_inventory_v2';
export const SUBJECT_PRACTICE_FORMAL_GRAPH_DISTINCT_OPAQUE_PROOF_VERSION =
  'subject-practice-formal-graph-distinct-opaque-proof-v1';

type Subject = 'math' | 'physics' | 'chemistry';
type SurfaceRelation = 'normalization_only' | 'option_permutation_equivalent'
  | 'bilingual_translation_equivalent' | 'parameter_variant_same_task_template'
  | 'semantically_distinct_revision' | 'unresolved';

export type SubjectPracticeCanonicalGraphRevision = {
  sourceSystem: 'local_repository' | 'database' | 'remote_sync';
  documentId: string;
  questionOrdinal: string;
  lineageId: string;
  rawContentSha256: string;
  observedAt: string;
  inventoryProtocol: string;
  inventorySnapshotSha256: string;
};

export type SubjectPracticeCanonicalTaskGraph = {
  schemaVersion: typeof SUBJECT_PRACTICE_CANONICAL_TASK_GRAPH_SCHEMA_VERSION;
  subject: Subject;
  syllabusScope: string;
  taskFamily: string;
  verificationScope: string;
  typedGivens: Array<{ symbol: string; value: string; unit?: string; entity?: string }>;
  target: { kind: string; expression: unknown };
  assumptions: string[];
  relationAst: unknown;
  optionSemantics: Array<{ semanticValue: unknown; isCorrect: boolean }>;
  parserVersion: string;
  normalizerVersion: string;
};

export type SubjectPracticeCanonicalSolutionGraph = {
  schemaVersion: typeof SUBJECT_PRACTICE_CANONICAL_SOLUTION_GRAPH_SCHEMA_VERSION;
  steps: Array<{ rule: string; inputs: unknown[]; output: unknown }>;
  derivedValues: Array<{ symbol: string; value: string; unit?: string }>;
  finalSemanticAnswer: unknown;
  solverVersion: string;
  oracleVersion: string;
};

export type SubjectPracticeFormalGraphDistinctOpaqueProof = Readonly<{
  proofVersion: typeof SUBJECT_PRACTICE_FORMAL_GRAPH_DISTINCT_OPAQUE_PROOF_VERSION;
  verifierVersion: string;
  sourceTaskGraphSha256: string;
  candidateTaskGraphSha256: string;
  sourceSolutionGraphSha256: string;
  candidateSolutionGraphSha256: string;
  distinctWitnessKind: 'different_givens' | 'different_target' | 'different_relation' | 'different_solution_parameters';
  distinctWitnessSha256: string;
}>;

const formalGraphDistinctOpaqueProofs = new WeakSet<object>();

function clean(value: unknown) { return String(value ?? '').trim(); }
function validSha256(value: unknown) { return /^[a-f0-9]{64}$/.test(clean(value)); }
function sha256(value: string) { return createHash('sha256').update(value).digest('hex'); }
function canonicalJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalJsonValue);
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalJsonValue(entry)]));
  }
  return value;
}
function canonicalArray(values: unknown[]) {
  return values.map(canonicalJsonValue)
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
}

export function canonicalSubjectPracticeTaskGraph(input: SubjectPracticeCanonicalTaskGraph) {
  return {
    ...input,
    syllabusScope: clean(input.syllabusScope),
    taskFamily: clean(input.taskFamily),
    verificationScope: clean(input.verificationScope),
    typedGivens: canonicalArray(input.typedGivens),
    assumptions: [...input.assumptions].map(clean).filter(Boolean).sort(),
    optionSemantics: canonicalArray(input.optionSemantics),
    relationAst: canonicalJsonValue(input.relationAst),
    target: canonicalJsonValue(input.target),
    parserVersion: clean(input.parserVersion),
    normalizerVersion: clean(input.normalizerVersion)
  };
}

export function canonicalSubjectPracticeSolutionGraph(input: SubjectPracticeCanonicalSolutionGraph) {
  return {
    ...input,
    steps: input.steps.map(canonicalJsonValue),
    derivedValues: canonicalArray(input.derivedValues),
    finalSemanticAnswer: canonicalJsonValue(input.finalSemanticAnswer),
    solverVersion: clean(input.solverVersion),
    oracleVersion: clean(input.oracleVersion)
  };
}

export function subjectPracticeCanonicalTaskGraphSha256(input: SubjectPracticeCanonicalTaskGraph) {
  return sha256(JSON.stringify(canonicalJsonValue(canonicalSubjectPracticeTaskGraph(input))));
}

export function subjectPracticeCanonicalSolutionGraphSha256(input: SubjectPracticeCanonicalSolutionGraph) {
  return sha256(JSON.stringify(canonicalJsonValue(canonicalSubjectPracticeSolutionGraph(input))));
}

export function createSubjectPracticeFormalGraphDistinctOpaqueProof(input: {
  sourceTaskGraph: SubjectPracticeCanonicalTaskGraph;
  candidateTaskGraph: SubjectPracticeCanonicalTaskGraph;
  sourceSolutionGraph: SubjectPracticeCanonicalSolutionGraph;
  candidateSolutionGraph: SubjectPracticeCanonicalSolutionGraph;
  verifierVersion: string;
}): SubjectPracticeFormalGraphDistinctOpaqueProof | null {
  const sourceTask = canonicalSubjectPracticeTaskGraph(input.sourceTaskGraph);
  const candidateTask = canonicalSubjectPracticeTaskGraph(input.candidateTaskGraph);
  const sourceSolution = canonicalSubjectPracticeSolutionGraph(input.sourceSolutionGraph);
  const candidateSolution = canonicalSubjectPracticeSolutionGraph(input.candidateSolutionGraph);
  const same = (left: unknown, right: unknown) => JSON.stringify(canonicalJsonValue(left))
    === JSON.stringify(canonicalJsonValue(right));
  let distinctWitnessKind: SubjectPracticeFormalGraphDistinctOpaqueProof['distinctWitnessKind'] | null = null;
  let sourceWitness: unknown;
  let candidateWitness: unknown;
  if (!same(sourceTask.typedGivens, candidateTask.typedGivens)) {
    distinctWitnessKind = 'different_givens';
    sourceWitness = sourceTask.typedGivens;
    candidateWitness = candidateTask.typedGivens;
  } else if (!same(sourceTask.target, candidateTask.target)) {
    distinctWitnessKind = 'different_target';
    sourceWitness = sourceTask.target;
    candidateWitness = candidateTask.target;
  } else if (!same(sourceTask.relationAst, candidateTask.relationAst)) {
    distinctWitnessKind = 'different_relation';
    sourceWitness = sourceTask.relationAst;
    candidateWitness = candidateTask.relationAst;
  } else if (!same(sourceSolution.derivedValues, candidateSolution.derivedValues)
    && !same(sourceTask.optionSemantics, candidateTask.optionSemantics)) {
    distinctWitnessKind = 'different_solution_parameters';
    sourceWitness = { derivedValues: sourceSolution.derivedValues, optionSemantics: sourceTask.optionSemantics };
    candidateWitness = { derivedValues: candidateSolution.derivedValues, optionSemantics: candidateTask.optionSemantics };
  }
  if (!distinctWitnessKind || !clean(input.verifierVersion)) return null;
  const proof = Object.freeze({
    proofVersion: SUBJECT_PRACTICE_FORMAL_GRAPH_DISTINCT_OPAQUE_PROOF_VERSION,
    verifierVersion: clean(input.verifierVersion),
    sourceTaskGraphSha256: subjectPracticeCanonicalTaskGraphSha256(input.sourceTaskGraph),
    candidateTaskGraphSha256: subjectPracticeCanonicalTaskGraphSha256(input.candidateTaskGraph),
    sourceSolutionGraphSha256: subjectPracticeCanonicalSolutionGraphSha256(input.sourceSolutionGraph),
    candidateSolutionGraphSha256: subjectPracticeCanonicalSolutionGraphSha256(input.candidateSolutionGraph),
    distinctWitnessKind,
    distinctWitnessSha256: sha256(JSON.stringify(canonicalJsonValue({
      distinctWitnessKind,
      sourceWitness,
      candidateWitness
    })))
  });
  formalGraphDistinctOpaqueProofs.add(proof);
  return proof;
}

export function subjectPracticeFormalGraphDistinctOpaqueProofValid(input: {
  proof?: SubjectPracticeFormalGraphDistinctOpaqueProof | null;
  sourceTaskGraphSha256: string;
  candidateTaskGraphSha256: string;
  sourceSolutionGraphSha256: string;
  candidateSolutionGraphSha256: string;
}) {
  const proof = input.proof;
  return Boolean(proof && formalGraphDistinctOpaqueProofs.has(proof)
    && proof.proofVersion === SUBJECT_PRACTICE_FORMAL_GRAPH_DISTINCT_OPAQUE_PROOF_VERSION
    && proof.sourceTaskGraphSha256 === input.sourceTaskGraphSha256
    && proof.candidateTaskGraphSha256 === input.candidateTaskGraphSha256
    && proof.sourceSolutionGraphSha256 === input.sourceSolutionGraphSha256
    && proof.candidateSolutionGraphSha256 === input.candidateSolutionGraphSha256
    && clean(proof.verifierVersion)
    && validSha256(proof.distinctWitnessSha256));
}

function revisionValid(revision: SubjectPracticeCanonicalGraphRevision) {
  return Boolean(clean(revision.sourceSystem) && clean(revision.documentId) && clean(revision.questionOrdinal)
    && clean(revision.lineageId) && validSha256(revision.rawContentSha256)
    && validSha256(revision.inventorySnapshotSha256) && !Number.isNaN(Date.parse(revision.observedAt)));
}

export function qualifySubjectPracticeCanonicalGraphPair(input: {
  inventoryCoverageStatus: 'complete' | 'partial' | 'failed';
  sourceRevision: SubjectPracticeCanonicalGraphRevision;
  candidateRevision: SubjectPracticeCanonicalGraphRevision;
  sourceTaskGraph: SubjectPracticeCanonicalTaskGraph;
  candidateTaskGraph: SubjectPracticeCanonicalTaskGraph;
  sourceSolutionGraph: SubjectPracticeCanonicalSolutionGraph;
  candidateSolutionGraph: SubjectPracticeCanonicalSolutionGraph;
  surfaceRelation: SurfaceRelation;
  sourceParsed: boolean;
  candidateParsed: boolean;
  solverOracleAgreement: boolean;
  roundTripVerified: boolean;
  formalDistinctProof?: SubjectPracticeFormalGraphDistinctOpaqueProof | null;
}) {
  const sourceTaskGraphSha256 = subjectPracticeCanonicalTaskGraphSha256(input.sourceTaskGraph);
  const candidateTaskGraphSha256 = subjectPracticeCanonicalTaskGraphSha256(input.candidateTaskGraph);
  const sourceSolutionGraphSha256 = subjectPracticeCanonicalSolutionGraphSha256(input.sourceSolutionGraph);
  const candidateSolutionGraphSha256 = subjectPracticeCanonicalSolutionGraphSha256(input.candidateSolutionGraph);
  const reasonCodes: string[] = [];
  if (input.inventoryCoverageStatus !== 'complete') reasonCodes.push('canonical_graph_complete_inventory_missing');
  if (input.sourceRevision.inventoryProtocol !== SUBJECT_PRACTICE_CANONICAL_GRAPH_REQUIRED_INVENTORY_PROTOCOL
    || input.candidateRevision.inventoryProtocol !== SUBJECT_PRACTICE_CANONICAL_GRAPH_REQUIRED_INVENTORY_PROTOCOL) {
    reasonCodes.push('canonical_graph_inventory_protocol_invalid_or_legacy');
  }
  if (!revisionValid(input.sourceRevision) || !revisionValid(input.candidateRevision)) {
    reasonCodes.push('canonical_graph_revision_evidence_invalid');
  }
  if (input.sourceRevision.inventorySnapshotSha256 !== input.candidateRevision.inventorySnapshotSha256) {
    reasonCodes.push('canonical_graph_inventory_snapshot_mismatch');
  }
  if (!input.sourceParsed || !input.candidateParsed) reasonCodes.push('canonical_graph_parse_unsupported_or_failed');
  if (!input.solverOracleAgreement) reasonCodes.push('canonical_graph_solver_oracle_disagreement');
  if (!input.roundTripVerified) reasonCodes.push('canonical_graph_round_trip_failed');
  if (input.sourceTaskGraph.subject !== input.candidateTaskGraph.subject
    || input.sourceTaskGraph.verificationScope !== input.candidateTaskGraph.verificationScope) {
    reasonCodes.push('canonical_graph_exact_scope_mismatch');
  }

  const graphEquivalent = sourceTaskGraphSha256 === candidateTaskGraphSha256
    && sourceSolutionGraphSha256 === candidateSolutionGraphSha256;
  const equivalenceRelation = ['normalization_only', 'option_permutation_equivalent',
    'bilingual_translation_equivalent'].includes(input.surfaceRelation);
  const formalDistinctVerified = input.surfaceRelation === 'semantically_distinct_revision'
    && sourceTaskGraphSha256 !== candidateTaskGraphSha256
    && subjectPracticeFormalGraphDistinctOpaqueProofValid({
      proof: input.formalDistinctProof,
      sourceTaskGraphSha256,
      candidateTaskGraphSha256,
      sourceSolutionGraphSha256,
      candidateSolutionGraphSha256
    });

  let expectedAction: 'reject' | 'allow' | 'exclude' = 'exclude';
  let truthLabel: 'near_duplicate_same_source' | 'distinct' | 'ambiguous_excluded' = 'ambiguous_excluded';
  if (!reasonCodes.length && equivalenceRelation && graphEquivalent) {
    expectedAction = 'reject';
    truthLabel = 'near_duplicate_same_source';
  } else if (!reasonCodes.length && formalDistinctVerified) {
    expectedAction = 'allow';
    truthLabel = 'distinct';
  } else if (!reasonCodes.length) {
    reasonCodes.push(input.surfaceRelation === 'parameter_variant_same_task_template'
      ? 'canonical_graph_same_archetype_product_policy_required'
      : 'canonical_graph_pair_not_machine_proven');
  }

  const qualificationPayload = {
    policyVersion: SUBJECT_PRACTICE_CANONICAL_TASK_GRAPH_POLICY_VERSION,
    inventorySnapshotSha256: input.sourceRevision.inventorySnapshotSha256,
    sourceRawContentSha256: input.sourceRevision.rawContentSha256,
    candidateRawContentSha256: input.candidateRevision.rawContentSha256,
    sourceTaskGraphSha256,
    candidateTaskGraphSha256,
    sourceSolutionGraphSha256,
    candidateSolutionGraphSha256,
    formalDistinctProofVersion: formalDistinctVerified ? input.formalDistinctProof!.proofVersion : null,
    formalDistinctWitnessKind: formalDistinctVerified ? input.formalDistinctProof!.distinctWitnessKind : null,
    formalDistinctWitnessSha256: formalDistinctVerified ? input.formalDistinctProof!.distinctWitnessSha256 : null,
    surfaceRelation: input.surfaceRelation,
    expectedAction,
    truthLabel,
    reasonCodes
  };
  const formalGraphProven = reasonCodes.length === 0 && expectedAction !== 'exclude';
  return {
    ...qualificationPayload,
    status: formalGraphProven ? 'formal_graph_proven' as const : 'ambiguous_excluded' as const,
    labelProvenance: formalGraphProven ? 'formal_graph_proven' as const : null,
    formalGraphQualificationSha256: sha256(JSON.stringify(canonicalJsonValue(qualificationPayload))),
    releaseImpact: 'none_gold_evidence_only_not_publication' as const
  };
}

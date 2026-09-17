#!/usr/bin/env node

require('../backend/node_modules/ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', moduleResolution: 'node' }
});

const crypto = require('node:crypto');
const { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } = require('node:fs');
const { dirname, isAbsolute, relative, resolve, sep } = require('node:path');
const { buildLocalCorpus } = require('./csca-subject-practice-source-corpus-scan.cjs');
const { verifyDbArtifact, documentKey } = require('./csca-subject-practice-source-corpus-inventory-reconcile.cjs');
const { normalizeSubjectPracticeSourceCorpusText } = require('../backend/src/ai-questioning/subject-practice-source-corpus-scan-policy');
const {
  SUBJECT_PRACTICE_CANONICAL_TASK_GRAPH_POLICY_VERSION,
  subjectPracticeCanonicalTaskGraphSha256,
  subjectPracticeCanonicalSolutionGraphSha256
} = require('../backend/src/ai-questioning/subject-practice-canonical-task-graph-policy');
const { buildSubjectPracticeQuestionPlan } = require('../backend/src/ai-questioning/subject-practice-question-plan-policy');
const { SUBJECT_PRACTICE_MATH_ELEMENTARY_SOLVER_VERSION, solveElementaryFunctionDirectProperty } = require('../backend/src/ai-questioning/subject-practice-math-solver');
const { SUBJECT_PRACTICE_MATH_ELEMENTARY_INDEPENDENT_ORACLE_VERSION, verifySubjectPracticeMathElementaryWithIndependentOracle } = require('../backend/src/ai-questioning/subject-practice-math-elementary-independent-oracle');
const { SUBJECT_PRACTICE_MATH_LINE_RELATION_SOLVER_VERSION, solveSubjectPracticeMathLineRelation } = require('../backend/src/ai-questioning/subject-practice-math-line-relation-solver');
const { SUBJECT_PRACTICE_MATH_LINE_RELATION_INDEPENDENT_ORACLE_VERSION, verifySubjectPracticeMathLineRelationWithIndependentOracle } = require('../backend/src/ai-questioning/subject-practice-math-line-relation-independent-oracle');
const { SUBJECT_PRACTICE_PHYSICS_KINEMATICS_SOLVER_VERSION, solveSubjectPracticePhysicsKinematics } = require('../backend/src/ai-questioning/subject-practice-physics-kinematics-solver');
const { SUBJECT_PRACTICE_PHYSICS_KINEMATICS_INDEPENDENT_ORACLE_VERSION, verifySubjectPracticePhysicsKinematicsWithIndependentOracle } = require('../backend/src/ai-questioning/subject-practice-physics-kinematics-independent-oracle');
const { SUBJECT_PRACTICE_CHEMISTRY_ACID_BASE_SOLVER_VERSION, solveSubjectPracticeChemistryAcidBase } = require('../backend/src/ai-questioning/subject-practice-chemistry-acid-base-solver');
const { SUBJECT_PRACTICE_CHEMISTRY_ACID_BASE_INDEPENDENT_ORACLE_VERSION, verifySubjectPracticeChemistryAcidBaseWithIndependentOracle } = require('../backend/src/ai-questioning/subject-practice-chemistry-acid-base-independent-oracle');

const MODE = 'local_db_partial_graph_shadow_v7';
const BUILDER_VERSION = 'subject-practice-local-db-partial-graph-shadow-builder-v7';
const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');
const text = (value) => String(value ?? '').trim();

function canonicalJsonValue(value) {
  if (Array.isArray(value)) return value.map(canonicalJsonValue);
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalJsonValue(entry)]));
  }
  return value;
}

function payloadSha256(value) {
  const { payloadSha256: ignored, ...payload } = value;
  return sha256(JSON.stringify(canonicalJsonValue(payload)));
}

function argsFrom(argv) {
  const result = {};
  for (const token of argv) {
    if (!token.startsWith('--')) continue;
    const [key, ...rest] = token.slice(2).split('=');
    result[key] = rest.length ? rest.join('=') : true;
  }
  return result;
}

function workspaceJsonPath(value, options = {}) {
  const root = resolve(options.workspaceRoot ?? process.cwd());
  const target = resolve(root, text(value));
  const rel = relative(root, target);
  if (!text(value) || !rel || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    throw new Error('partial_graph_shadow_path_must_be_inside_workspace');
  }
  if (!target.toLowerCase().endsWith('.json')) throw new Error('partial_graph_shadow_path_must_be_json');
  if (options.mustExist && !existsSync(target)) throw new Error('partial_graph_shadow_input_missing');
  if (options.mustBeNew && existsSync(target)) throw new Error('partial_graph_shadow_refuses_to_overwrite');
  return target;
}

function questionContentSha256(question) {
  return sha256(JSON.stringify(canonicalJsonValue({
    prompt: question.promptText ?? question.prompt,
    options: question.options ?? [],
    correctAnswer: question.correctAnswer ?? question.answer,
    explanation: question.explanation ?? null,
    localizations: question.localizations ?? null
  })));
}

function localDocuments(workspaceRoot) {
  const docsDir = resolve(workspaceRoot, 'docs');
  return readdirSync(docsDir).filter((name) => /-source\.json$/i.test(name))
    .filter((name) => name !== 'csca-past-paper-source-json-template.json')
    .sort().map((name) => {
      const path = resolve(docsDir, name);
      const parsed = JSON.parse(readFileSync(path, 'utf8'));
      const document = parsed.document ?? {};
      return {
        key: documentKey(document),
        sourceSystem: 'local_repository',
        documentId: `docs/${name}`,
        subject: text(document.subject).toLowerCase(),
        language: text(document.language).toLowerCase(),
        observedAt: statSync(path).mtime.toISOString(),
        questions: (parsed.questions ?? []).map((question, index) => ({
          ...question,
          questionNumber: text(question.questionNumber) || String(index + 1),
          rawContentSha256: questionContentSha256(question)
        }))
      };
    });
}

function databaseDocuments(db) {
  return db.documents.map((document) => ({
    key: documentKey(document),
    sourceSystem: 'database',
    documentId: String(document.id),
    subject: text(document.subject).toLowerCase(),
    language: text(document.language).toLowerCase(),
    observedAt: new Date(document.updatedAt).toISOString(),
    questions: db.sourceQuestions.filter((question) => Number(question.documentId) === Number(document.id))
      .map((question) => ({ ...question, rawContentSha256: questionContentSha256(question) }))
  }));
}

function normalizeCandidate(document, question) {
  return {
    subject: document.subject,
    prompt: text(question.promptText ?? question.prompt),
    options: Array.isArray(question.options) ? question.options.map((option, index) => ({
      id: text(option.id) || String.fromCharCode(65 + index), text: text(option.text)
    })) : [],
    correctAnswer: text(question.correctAnswer ?? question.answer)
  };
}

function mathPlans() {
  return [
    ['logarithmic', 'domain'], ['exponential', 'range'],
    ['radical', 'monotonicity'], ['power', 'function_value']
  ].map(([functionClass, propertyTarget]) => ({
    schemaVersion: 'subject-practice-question-plan-v1', policyVersion: 'subject-practice-question-plan-policy-v1',
    subject: 'math', targetDifficulty: 'basic', taskFamily: 'elementary_function_direct_property',
    planTemplate: 'math_elementary_function_relation_v1', renderConstraints: {
      singlePropertyTargetContractVersion: 'math-basic-elementary-single-property-target-v1',
      requiredElementaryFunctionClass: functionClass, requiredSinglePropertyTarget: propertyTarget,
      forbidCrossPropertyDistractors: true, maxIndependentRelations: 1, maxFunctionObjects: 1
    }
  }));
}

function mathLinePlans() {
  return [
    'slope_from_two_distinct_points',
    'inclination_angle_from_line',
    'identify_parallel_or_perpendicular_line',
    'line_equation_from_point_and_slope'
  ].map((exactLineRelationScope) => buildSubjectPracticeQuestionPlan({
    subject: 'math', targetDifficulty: 'basic', topicTitle: 'line relation',
    productionCellId: 'line-relation-shadow-v1', taskFamily: 'math_line_relation_direct',
    planTemplate: 'math_line_relation_direct_v1', exactLineRelationScope
  }));
}

const PHYSICS_PLAN = {
  schemaVersion: 'subject-practice-question-plan-v1', policyVersion: 'subject-practice-question-plan-policy-v1',
  subject: 'physics', targetDifficulty: 'basic', taskFamily: 'kinematics_basic_direct_relation',
  planTemplate: 'physics_kinematics_basic_relation_v1',
  renderConstraints: { maxIndependentRelations: 1, forbidMultiStageModelChain: true }
};
const CHEMISTRY_PLAN = {
  schemaVersion: 'subject-practice-question-plan-v1', policyVersion: 'subject-practice-question-plan-policy-v1',
  subject: 'chemistry', targetDifficulty: 'medium',
  taskFamily: 'ph_dilution_strong_acid_base_neutralization',
  planTemplate: 'chemistry_strong_acid_base_single_relation_v1', renderConstraints: {
    completeDissociationOnly: true, requireVisibleQuantitiesAndUnits: true, requireTemperatureConvention25C: true,
    forbidWeakPolyproticBufferHydrolysisActivityAndTitration: true, maxIndependentRelations: 1,
    forbidMultiStageModelChain: true, allowedSpecies: ['HCl', 'HNO3', 'NaOH', 'KOH'],
    allowedRelationKinds: ['strong_acid_dilution', 'strong_base_dilution', 'strong_acid_base_neutralization'],
    allowedAnswerTargets: ['ph_value', 'acid_base_character']
  }
};

function attemptsFor(candidate) {
  if (candidate.subject === 'math') return [
    ...mathPlans().map((questionPlan) => ({
      taskFamily: 'elementary_function_direct_property', questionPlan,
      solver: solveElementaryFunctionDirectProperty(candidate, { questionPlan }),
      oracle: verifySubjectPracticeMathElementaryWithIndependentOracle(candidate, { questionPlan })
    })),
    ...mathLinePlans().map((questionPlan) => ({
      taskFamily: 'math_line_relation_direct', questionPlan,
      solver: solveSubjectPracticeMathLineRelation(candidate, { questionPlan }),
      oracle: verifySubjectPracticeMathLineRelationWithIndependentOracle(candidate, { questionPlan })
    }))
  ];
  if (candidate.subject === 'physics') return [{
    taskFamily: 'kinematics_basic_direct_relation', questionPlan: PHYSICS_PLAN,
    solver: solveSubjectPracticePhysicsKinematics(candidate, { questionPlan: PHYSICS_PLAN }),
    oracle: verifySubjectPracticePhysicsKinematicsWithIndependentOracle(candidate, { questionPlan: PHYSICS_PLAN })
  }];
  if (candidate.subject === 'chemistry') return [{
    taskFamily: 'ph_dilution_strong_acid_base_neutralization', questionPlan: CHEMISTRY_PLAN,
    solver: solveSubjectPracticeChemistryAcidBase(candidate, {
      taskFamily: 'ph_dilution_strong_acid_base_neutralization', questionPlan: CHEMISTRY_PLAN
    }),
    oracle: verifySubjectPracticeChemistryAcidBaseWithIndependentOracle(candidate, { questionPlan: CHEMISTRY_PLAN })
  }];
  return [];
}

function scopeIdFor(attempt) {
  return attempt.solver.verificationScope?.scopeId ?? attempt.oracle.scopeId ?? null;
}

function unitFor(symbol) {
  if (/Seconds$/.test(symbol)) return 's';
  if (/MetersPerSecond$/.test(symbol)) return 'm/s';
  if (/Meters$/.test(symbol)) return 'm';
  if (/Liters$/.test(symbol)) return 'L';
  if (/Moles$/.test(symbol)) return 'mol';
  if (/MolPerLiter|Concentration/.test(symbol)) return 'mol/L';
  return undefined;
}

function optionSemantics(attempt) {
  return attempt.solver.optionVerdicts.map((option) => {
    const semanticValue = option.semanticValue ?? (option.normalizedSiValue !== undefined
      ? { dimension: option.parsedDimension, value: option.normalizedSiValue }
      : { target: option.parsedTarget, value: option.parsedValue });
    return { semanticValue, isCorrect: option.verdict === 'true' };
  });
}

function graphPair(attempt) {
  const canonicalTask = attempt.solver.canonicalTask;
  const scopeId = scopeIdFor(attempt);
  if (!canonicalTask || !scopeId) return null;
  const sourceInputs = canonicalTask.model ?? canonicalTask.inputs ?? {};
  const typedGivens = Object.entries(sourceInputs).map(([symbol, value]) => ({
    symbol, value: String(value), ...(unitFor(symbol) ? { unit: unitFor(symbol) } : {})
  }));
  const target = attempt.taskFamily === 'math_line_relation_direct'
    ? {
      kind: canonicalTask.kind,
      expression: canonicalTask.kind === 'slope_from_two_distinct_points'
        ? { expectedSlope: canonicalTask.expectedSlope }
        : canonicalTask.kind === 'inclination_angle_from_line'
          ? { expectedAngleDegrees: canonicalTask.expectedAngleDegrees }
          : canonicalTask.kind === 'identify_parallel_or_perpendicular_line'
            ? { relation: canonicalTask.relation }
            : { point: canonicalTask.point, slope: canonicalTask.slope }
    }
    : canonicalTask.propertyTarget
    ? { kind: canonicalTask.propertyTarget, expression: { evaluationInput: canonicalTask.evaluationInput } }
    : canonicalTask.answerTarget
      ? { kind: canonicalTask.answerTarget, expression: { expectedPh: canonicalTask.expectedPh, expectedCharacter: canonicalTask.expectedCharacter } }
      : { kind: canonicalTask.dimension, expression: { expectedSiValue: canonicalTask.expectedSiValue } };
  const taskGraph = {
    schemaVersion: 'subject-practice-canonical-task-graph-v1',
    subject: attempt.questionPlan.subject,
    syllabusScope: scopeId,
    taskFamily: attempt.taskFamily,
    verificationScope: scopeId,
    typedGivens,
    target,
    assumptions: attempt.taskFamily === 'ph_dilution_strong_acid_base_neutralization'
      ? ['aqueous_solution_25_celsius', 'complete_dissociation', 'additive_solution_volumes'] : [],
    relationAst: canonicalTask,
    optionSemantics: optionSemantics(attempt),
    parserVersion: attempt.solver.solverVersion,
    normalizerVersion: `${BUILDER_VERSION}:semantic-projection-v1`
  };
  const correctSemantic = taskGraph.optionSemantics.find((option) => option.isCorrect)?.semanticValue ?? null;
  const solutionGraph = {
    schemaVersion: 'subject-practice-canonical-solution-graph-v1',
    steps: [{ rule: scopeId, inputs: typedGivens, output: target.expression }],
    derivedValues: Object.entries(target.expression).map(([symbol, value]) => ({ symbol, value: String(value) })),
    finalSemanticAnswer: correctSemantic,
    solverVersion: attempt.solver.solverVersion,
    oracleVersion: attempt.oracle.oracleVersion
  };
  return {
    taskGraph,
    solutionGraph,
    taskGraphSha256: subjectPracticeCanonicalTaskGraphSha256(taskGraph),
    solutionGraphSha256: subjectPracticeCanonicalSolutionGraphSha256(solutionGraph)
  };
}

function verifyRevision(document, question) {
  const candidate = normalizeCandidate(document, question);
  const attempts = attemptsFor(candidate);
  const matched = attempts.find((attempt) => attempt.solver.verificationScope?.matched
    && attempt.oracle.scopeMatched && scopeIdFor(attempt) === attempt.oracle.scopeId);
  const parserRecognized = attempts.some((attempt) => Boolean(attempt.solver.canonicalTask));
  if (!matched) return {
    status: parserRecognized ? 'unresolved' : 'unsupported_scope', parserRecognized,
    exactScopeMatched: false, solverOracleAgreement: false, roundTripPassed: false,
    scopeId: null, taskFamily: null, taskGraphSha256: null, solutionGraphSha256: null,
    reasonCodes: Array.from(new Set(attempts.flatMap((attempt) => [
      ...attempt.solver.reasonCodes, ...attempt.oracle.reasonCodes
    ]))).sort()
  };
  const agreement = matched.solver.status === 'verified' && matched.oracle.status === 'verified'
    && matched.solver.selectedOptionId === matched.oracle.selectedOptionId;
  const graphs = agreement ? graphPair(matched) : null;
  const replay = agreement ? attemptsFor(candidate).find((attempt) => scopeIdFor(attempt) === scopeIdFor(matched)) : null;
  const roundTripPassed = Boolean(graphs && replay
    && replay.solver.status === 'verified' && replay.oracle.status === 'verified'
    && replay.solver.selectedOptionId === matched.solver.selectedOptionId
    && subjectPracticeCanonicalTaskGraphSha256(JSON.parse(JSON.stringify(graphs.taskGraph))) === graphs.taskGraphSha256
    && subjectPracticeCanonicalSolutionGraphSha256(JSON.parse(JSON.stringify(graphs.solutionGraph))) === graphs.solutionGraphSha256);
  return {
    status: agreement && graphs && roundTripPassed ? 'graph_verified_shadow' : 'unresolved',
    parserRecognized, exactScopeMatched: true, solverOracleAgreement: agreement, roundTripPassed,
    roundTripMode: 'canonical_json_round_trip_plus_original_surface_resolve_v1',
    scopeId: scopeIdFor(matched), taskFamily: matched.taskFamily,
    taskGraphSha256: graphs?.taskGraphSha256 ?? null,
    solutionGraphSha256: graphs?.solutionGraphSha256 ?? null,
    reasonCodes: Array.from(new Set([...matched.solver.reasonCodes, ...matched.oracle.reasonCodes,
      ...(!agreement ? ['partial_graph_shadow_solver_oracle_not_verified'] : []),
      ...(agreement && !graphs ? ['partial_graph_shadow_graph_projection_failed'] : []),
      ...(graphs && !roundTripPassed ? ['partial_graph_shadow_round_trip_failed'] : [])])).sort()
  };
}

function revisionRecord(document, question, inventorySnapshotSha256) {
  const verification = verifyRevision(document, question);
  return {
    revisionId: sha256(`${document.sourceSystem}|${document.documentId}|${question.questionNumber}|${question.rawContentSha256}`),
    sourceSystem: document.sourceSystem, documentId: document.documentId,
    questionOrdinal: question.questionNumber, subject: document.subject, language: document.language,
    lineageId: sha256(`${document.key}|${question.questionNumber}`), rawContentSha256: question.rawContentSha256,
    observedAt: document.observedAt, inventorySnapshotSha256, verification
  };
}

function classifyPair(kind, left, right) {
  const bothVerified = left.verification.status === 'graph_verified_shadow'
    && right.verification.status === 'graph_verified_shadow';
  let classification = 'unresolved';
  if (bothVerified && left.verification.taskGraphSha256 === right.verification.taskGraphSha256
    && left.verification.solutionGraphSha256 === right.verification.solutionGraphSha256) {
    classification = 'graph_equivalent_revision_candidate';
  } else if (bothVerified && left.verification.scopeId === right.verification.scopeId) {
    classification = 'parameter_variant_ambiguous';
  }
  return {
    kind, classification,
    lineageId: left.lineageId,
    leftRevisionId: left.revisionId, rightRevisionId: right.revisionId,
    formalGoldEligible: false,
    reason: classification === 'unresolved' ? 'one_or_both_revisions_not_graph_verified'
      : classification === 'parameter_variant_ambiguous' ? 'distinct_witness_not_implemented_in_partial_shadow'
        : 'equivalence_candidate_must_be_requalified_on_complete_inventory'
  };
}

function incrementLayered(map, revision) {
  const scope = revision.verification.scopeId ?? 'unsupported_or_unresolved';
  const key = `${revision.subject}|${revision.language}|${scope}`;
  const item = map.get(key) ?? {
    subject: revision.subject, language: revision.language, scopeId: scope,
    revisionCount: 0, parserRecognizedCount: 0, exactScopeMatchedCount: 0,
    solverOracleAgreementCount: 0, roundTripPassCount: 0, graphVerifiedCount: 0
  };
  item.revisionCount += 1;
  if (revision.verification.parserRecognized) item.parserRecognizedCount += 1;
  if (revision.verification.exactScopeMatched) item.exactScopeMatchedCount += 1;
  if (revision.verification.solverOracleAgreement) item.solverOracleAgreementCount += 1;
  if (revision.verification.roundTripPassed) item.roundTripPassCount += 1;
  if (revision.verification.status === 'graph_verified_shadow') item.graphVerifiedCount += 1;
  map.set(key, item);
}

function build(input) {
  const workspaceRoot = input.workspaceRoot ?? process.cwd();
  const db = JSON.parse(readFileSync(workspaceJsonPath(input.dbInventory, { workspaceRoot, mustExist: true }), 'utf8'));
  const reconciliation = JSON.parse(readFileSync(workspaceJsonPath(input.reconciliation, { workspaceRoot, mustExist: true }), 'utf8'));
  if (!verifyDbArtifact(db)) throw new Error('partial_graph_shadow_db_inventory_invalid');
  if (payloadSha256(reconciliation) !== reconciliation.payloadSha256
    || reconciliation.mode !== 'subject_practice_source_corpus_inventory_reconcile_v2') {
    throw new Error('partial_graph_shadow_reconciliation_invalid');
  }
  const local = localDocuments(workspaceRoot);
  const database = databaseDocuments(db);
  const localByKey = new Map(local.map((document) => [document.key, document]));
  const dbByKey = new Map(database.map((document) => [document.key, document]));
  const inventorySnapshotSha256 = sha256(JSON.stringify(canonicalJsonValue({
    localInventorySha256: buildLocalCorpus(workspaceRoot).snapshotSha256,
    dbInventorySha256: db.payloadSha256,
    reconciliationSha256: reconciliation.payloadSha256,
    remoteInventoryStatus: 'missing'
  })));
  const revisions = new Map();
  const pairs = [];
  const singletons = [];
  for (const documentSummary of reconciliation.documents) {
    const localDocument = localByKey.get(documentSummary.key);
    const dbDocument = dbByKey.get(documentSummary.key);
    const localQuestions = new Map((localDocument?.questions ?? []).map((question) => [question.questionNumber, question]));
    const dbQuestions = new Map((dbDocument?.questions ?? []).map((question) => [question.questionNumber, question]));
    const numbers = Array.from(new Set([...localQuestions.keys(), ...dbQuestions.keys()])).sort();
    for (const questionNumber of numbers) {
      const localQuestion = localQuestions.get(questionNumber);
      const dbQuestion = dbQuestions.get(questionNumber);
      if (localQuestion && dbQuestion) {
        const localPrompt = normalizeSubjectPracticeSourceCorpusText(localQuestion.promptText ?? localQuestion.prompt);
        const dbPrompt = normalizeSubjectPracticeSourceCorpusText(dbQuestion.promptText ?? dbQuestion.prompt);
        const kind = localPrompt === dbPrompt ? 'exact_control' : 'prompt_conflict';
        const left = revisionRecord(localDocument, localQuestion, inventorySnapshotSha256);
        const right = revisionRecord(dbDocument, dbQuestion, inventorySnapshotSha256);
        revisions.set(left.revisionId, left); revisions.set(right.revisionId, right);
        pairs.push(classifyPair(kind, left, right));
      } else {
        const document = localQuestion ? localDocument : dbDocument;
        const question = localQuestion ?? dbQuestion;
        const revision = revisionRecord(document, question, inventorySnapshotSha256);
        revisions.set(revision.revisionId, revision);
        singletons.push({
          revisionId: revision.revisionId,
          classification: revision.verification.status === 'graph_verified_shadow'
            ? 'graph_verified_singleton_shadow' : revision.verification.status,
          formalGoldEligible: false
        });
      }
    }
  }
  const revisionList = Array.from(revisions.values()).sort((a, b) => a.revisionId.localeCompare(b.revisionId));
  const layered = new Map();
  revisionList.forEach((revision) => incrementLayered(layered, revision));
  const queueCounts = {
    exactControlPairs: pairs.filter((pair) => pair.kind === 'exact_control').length,
    promptConflictPairs: pairs.filter((pair) => pair.kind === 'prompt_conflict').length,
    singletonRevisions: singletons.length,
    revisionExecutions: revisionList.length
  };
  const expectedCounts = {
    exactControlPairs: reconciliation.questionComparison.exactQuestionCount,
    promptConflictPairs: reconciliation.questionComparison.promptConflictCount,
    singletonRevisions: reconciliation.questionComparison.localOnlyQuestionCount
      + reconciliation.questionComparison.dbOnlyQuestionCount
  };
  const fixedQueueComplete = queueCounts.exactControlPairs === expectedCounts.exactControlPairs
    && queueCounts.promptConflictPairs === expectedCounts.promptConflictPairs
    && queueCounts.singletonRevisions === expectedCounts.singletonRevisions;
  if (!fixedQueueComplete) throw new Error('partial_graph_shadow_fixed_queue_incomplete');
  const reasonCodeCounts = {};
  for (const revision of revisionList) for (const reason of revision.verification.reasonCodes) {
    reasonCodeCounts[reason] = (reasonCodeCounts[reason] ?? 0) + 1;
  }
  const payload = {
    schemaVersion: 'subject-practice-local-db-partial-graph-shadow-v7', mode: MODE,
    graphBuilderVersion: BUILDER_VERSION,
    canonicalGraphPolicyVersion: SUBJECT_PRACTICE_CANONICAL_TASK_GRAPH_POLICY_VERSION,
    componentVersions: {
      mathSolver: SUBJECT_PRACTICE_MATH_ELEMENTARY_SOLVER_VERSION,
      mathOracle: SUBJECT_PRACTICE_MATH_ELEMENTARY_INDEPENDENT_ORACLE_VERSION,
      mathLineRelationSolver: SUBJECT_PRACTICE_MATH_LINE_RELATION_SOLVER_VERSION,
      mathLineRelationOracle: SUBJECT_PRACTICE_MATH_LINE_RELATION_INDEPENDENT_ORACLE_VERSION,
      physicsSolver: SUBJECT_PRACTICE_PHYSICS_KINEMATICS_SOLVER_VERSION,
      physicsOracle: SUBJECT_PRACTICE_PHYSICS_KINEMATICS_INDEPENDENT_ORACLE_VERSION,
      chemistrySolver: SUBJECT_PRACTICE_CHEMISTRY_ACID_BASE_SOLVER_VERSION,
      chemistryOracle: SUBJECT_PRACTICE_CHEMISTRY_ACID_BASE_INDEPENDENT_ORACLE_VERSION
    },
    inventoryCoverage: 'partial', remoteInventoryStatus: 'missing',
    localInventorySha256: buildLocalCorpus(workspaceRoot).snapshotSha256,
    dbInventorySha256: db.payloadSha256, reconciliationSha256: reconciliation.payloadSha256,
    inventorySnapshotSha256,
    queueManifest: { fixedQueueComplete, expectedCounts, observedCounts: queueCounts },
    aggregate: {
      parserRecognizedCount: revisionList.filter((item) => item.verification.parserRecognized).length,
      exactScopeMatchedCount: revisionList.filter((item) => item.verification.exactScopeMatched).length,
      solverOracleAgreementCount: revisionList.filter((item) => item.verification.solverOracleAgreement).length,
      roundTripPassCount: revisionList.filter((item) => item.verification.roundTripPassed).length,
      graphVerifiedCount: revisionList.filter((item) => item.verification.status === 'graph_verified_shadow').length,
      conflictPairClassifications: Object.fromEntries(['graph_equivalent_revision_candidate', 'parameter_variant_ambiguous', 'unresolved']
        .map((classification) => [classification, pairs.filter((pair) => pair.kind === 'prompt_conflict' && pair.classification === classification).length])),
      exactControlClassifications: Object.fromEntries(['graph_equivalent_revision_candidate', 'parameter_variant_ambiguous', 'unresolved']
        .map((classification) => [classification, pairs.filter((pair) => pair.kind === 'exact_control' && pair.classification === classification).length])),
      singletonClassifications: Object.fromEntries(['graph_verified_singleton_shadow', 'unsupported_scope', 'unresolved']
        .map((classification) => [classification, singletons.filter((item) => item.classification === classification).length])),
      reasonCodeCounts
    },
    layeredMetrics: Array.from(layered.values()).sort((a, b) => `${a.subject}|${a.language}|${a.scopeId}`.localeCompare(`${b.subject}|${b.language}|${b.scopeId}`)),
    revisions: revisionList, pairs, singletons,
    rerunPolicy: 'must_rebuild_from_raw_revisions_after_complete_remote_inventory_new_snapshot_no_relabel',
    formalGoldEligible: false,
    releaseImpact: 'none_partial_shadow_only', providerImpact: 'none_no_provider_call',
    databaseImpact: 'none_reads_existing_export_only', productionImpact: 'none_no_gate_or_publication_change'
  };
  return { ...payload, payloadSha256: sha256(JSON.stringify(canonicalJsonValue(payload))) };
}

function preflight() {
  return {
    mode: MODE, status: 'preflight_only_no_execution_or_output', executeRequired: true,
    fixedQueuePolicy: 'all_exact_controls_conflicts_and_singletons_in_denominator',
    inventoryCoverage: 'partial', formalGoldEligible: false,
    providerImpact: 'none_no_provider_call', databaseImpact: 'none_no_database_connection',
    productionImpact: 'none'
  };
}

function summaryFor(report) {
  return {
    mode: report.mode, status: 'partial_graph_shadow_completed_nonqualifying',
    payloadSha256: report.payloadSha256, queueManifest: report.queueManifest,
    aggregate: report.aggregate, layeredMetrics: report.layeredMetrics,
    formalGoldEligible: report.formalGoldEligible, releaseImpact: report.releaseImpact,
    providerImpact: report.providerImpact, databaseImpact: report.databaseImpact,
    productionImpact: report.productionImpact
  };
}

function main() {
  const args = argsFrom(process.argv.slice(2));
  if (!args.execute) return preflight();
  if (!args['db-inventory'] || !args.reconciliation || !args.out) {
    throw new Error('partial_graph_shadow_execute_requires_db_inventory_reconciliation_and_out');
  }
  const report = build({ dbInventory: args['db-inventory'], reconciliation: args.reconciliation });
  const outputPath = workspaceJsonPath(args.out, { mustBeNew: true });
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  return { ...summaryFor(report), outputPath };
}

if (require.main === module) {
  try { process.stdout.write(`${JSON.stringify(main(), null, 2)}\n`); }
  catch (error) { process.stderr.write(`${error?.stack ?? error}\n`); process.exitCode = 1; }
}

module.exports = {
  argsFrom, workspaceJsonPath, questionContentSha256, preflight, build, summaryFor,
  mathLinePlans, graphPair
};

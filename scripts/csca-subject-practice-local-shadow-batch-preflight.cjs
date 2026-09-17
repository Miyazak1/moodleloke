#!/usr/bin/env node

const net = require('node:net');
const path = require('node:path');
const { loadEnv } = require('./load-env.cjs');

loadEnv(path.resolve(__dirname, '..'));

require('../backend/node_modules/ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', moduleResolution: 'node' }
});

const { Prisma, PrismaClient } = require('../backend/node_modules/@prisma/client');
const {
  buildSubjectPracticeQuestionPlan,
  subjectPracticeQuestionPlanScopeRotationFor,
  validateSubjectPracticeQuestionPlan
} = require('../backend/src/ai-questioning/subject-practice-question-plan-policy');
const {
  subjectPracticeLocalGeneratorShadowRoutingPolicy
} = require('../backend/src/ai-questioning/question-generator-provider.service');
const {
  SUBJECT_PRACTICE_PRODUCTION_SHADOW_SCOPE_REGISTRY_VERSION,
  subjectPracticeProductionShadowScopeContracts
} = require('../backend/src/ai-questioning/subject-practice-production-shadow-scope-registry');
const {
  SUBJECT_PRACTICE_CANDIDATE_OUTPUT_NOVELTY_POLICY_VERSION,
  SUBJECT_PRACTICE_CANDIDATE_NOVELTY_CORPUS_SNAPSHOT_VERSION,
  SUBJECT_PRACTICE_CANDIDATE_NOVELTY_MATCH_DIGEST_VERSION,
  SUBJECT_PRACTICE_STRUCTURED_SOURCE_CORPUS_SCHEMA_VERSION
} = require('../backend/src/ai-questioning/subject-practice-candidate-output-novelty-policy');
const {
  SUBJECT_PRACTICE_SOURCE_CORPUS_NORMALIZATION_VERSION
} = require('../backend/src/ai-questioning/subject-practice-source-corpus-scan-policy');

function argValue(name, fallback = '') {
  const prefix = `--${name}=`;
  const inline = process.argv.find((argument) => argument.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

function clean(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function allowlistIncludes(raw, cellId) {
  const values = clean(raw).split(/[,;\s]+/).filter(Boolean);
  return values.includes('*') || values.includes(String(cellId));
}

function scopeIdFor(rotation) {
  if (!rotation) return null;
  if (rotation.functionClass && rotation.propertyTarget) {
    return `math-basic-elementary-rotation-v1:${rotation.functionClass}:${rotation.propertyTarget}`;
  }
  if (rotation.lineRelationScope) return `math-basic-line-relation-v1:${rotation.lineRelationScope}`;
  if (rotation.derivativeScope) return `math-basic-derivative-v1:${rotation.derivativeScope}`;
  if (rotation.physicsKinematicsScope) return `physics-basic-kinematics-v2:${rotation.physicsKinematicsScope}`;
  if (rotation.chemistryRelationKind && rotation.chemistryAnswerTarget) {
    return `chemistry-strong-acid-base-v3:${rotation.chemistryRelationKind}:${rotation.chemistryAnswerTarget}`;
  }
  return null;
}

function exactPlanFor(cell, contract, rotation) {
  return buildSubjectPracticeQuestionPlan({
    subject: cell.subject,
    topicId: cell.topicId,
    topicTitle: cell.topicTitle,
    productionCellId: cell.id,
    targetDifficulty: cell.difficultyBand,
    taskFamily: contract.taskFamily,
    planTemplate: contract.planTemplate,
    requiredElementaryFunctionClass: rotation?.functionClass ?? null,
    requiredSinglePropertyTarget: rotation?.propertyTarget ?? null,
    exactLineRelationScope: rotation?.lineRelationScope ?? null,
    exactDerivativeScope: rotation?.derivativeScope ?? null,
    exactPhysicsKinematicsScope: rotation?.physicsKinematicsScope ?? null,
    exactChemistryRelationKind: rotation?.chemistryRelationKind ?? null,
    exactChemistryAnswerTarget: rotation?.chemistryAnswerTarget ?? null
  });
}

function portReachable(port, timeoutMs = 1000) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    const finish = (reachable) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(reachable);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
}

async function responseJson(response) {
  const text = await response.text();
  try { return text ? JSON.parse(text) : {}; }
  catch { return { nonJsonBody: text.slice(0, 120) }; }
}

async function probeObservationBackend(baseUrl, tcpReachable, fetchImpl = fetch) {
  const result = {
    tcpReachable,
    apiCompatible: false,
    readinessLoaded: false,
    readiness: null,
    failureCode: tcpReachable ? 'observation_backend_identity_not_verified' : 'observation_backend_tcp_unreachable'
  };
  if (!tcpReachable) return result;
  try {
    let token = clean(process.env.CSCA_OBSERVATION_ADMIN_TOKEN || process.env.CSCA_READINESS_EVIDENCE_TOKEN);
    if (!token) {
      const email = clean(process.env.ADMIN_BOOTSTRAP_EMAIL);
      const password = clean(process.env.ADMIN_BOOTSTRAP_PASSWORD);
      if (!email || !password) return { ...result, failureCode: 'observation_backend_probe_credentials_missing' };
      const loginResponse = await fetchImpl(`${baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const loginBody = await responseJson(loginResponse);
      if (!loginResponse.ok) {
        return { ...result, failureCode: `observation_backend_login_http_${loginResponse.status}` };
      }
      token = clean(loginBody?.tokens?.accessToken);
      if (!token) return { ...result, failureCode: 'observation_backend_login_token_missing' };
    }
    const readinessResponse = await fetchImpl(
      `${baseUrl}/api/v1/admin/ai-questioning/subject-practice-observation-tasks?limit=1`,
      { headers: { authorization: `Bearer ${token}` } }
    );
    const readinessBody = await responseJson(readinessResponse);
    if (!readinessResponse.ok) {
      return { ...result, failureCode: `observation_backend_readiness_http_${readinessResponse.status}` };
    }
    const readiness = readinessBody?.readiness && typeof readinessBody.readiness === 'object'
      ? readinessBody.readiness
      : null;
    if (!readiness) return { ...result, apiCompatible: true, failureCode: 'observation_backend_readiness_missing' };
    return {
      tcpReachable: true,
      apiCompatible: true,
      readinessLoaded: true,
      readiness,
      failureCode: null
    };
  } catch {
    return { ...result, failureCode: 'observation_backend_probe_request_failed' };
  }
}

function fixtureResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body)
  };
}

async function runBackendProbeSelfTest() {
  const previousEmail = process.env.ADMIN_BOOTSTRAP_EMAIL;
  const previousPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  const previousToken = process.env.CSCA_OBSERVATION_ADMIN_TOKEN;
  const previousReadinessToken = process.env.CSCA_READINESS_EVIDENCE_TOKEN;
  process.env.ADMIN_BOOTSTRAP_EMAIL = 'fixture-admin@example.test';
  process.env.ADMIN_BOOTSTRAP_PASSWORD = 'fixture-password';
  delete process.env.CSCA_OBSERVATION_ADMIN_TOKEN;
  delete process.env.CSCA_READINESS_EVIDENCE_TOKEN;
  try {
    const tcpFailure = await probeObservationBackend('http://fixture.invalid', false, async () => {
      throw new Error('fetch_must_not_run');
    });
    const incompatible = await probeObservationBackend('http://fixture.invalid', true, async () => (
      fixtureResponse(405, { error: { code: 'READ_ONLY_QA' } })
    ));
    let compatibleCall = 0;
    const compatible = await probeObservationBackend('http://fixture.invalid', true, async () => {
      compatibleCall += 1;
      return compatibleCall === 1
        ? fixtureResponse(200, { tokens: { accessToken: 'fixture-token' } })
        : fixtureResponse(200, {
          readiness: {
            observationOnlyMode: true,
            localGeneratorShadowEnabled: true,
            questionPlanEnabled: true,
            questionPlanCellAllowlist: '24',
            observationManifestPolicyVersionsSupported: [
              'subject-practice-observation-batch-manifest-v10-production-profile-bound',
              'subject-practice-observation-batch-manifest-v11-campaign-bound'
            ],
            readyForLocalZeroProviderSubmission: true,
            readyForLocalZeroProviderExecution: true,
            productionShadowScopeRegistryVersion:
              SUBJECT_PRACTICE_PRODUCTION_SHADOW_SCOPE_REGISTRY_VERSION,
            localGeneratorShadowRoutingVersion:
              subjectPracticeLocalGeneratorShadowRoutingPolicy().routingVersion,
            localZeroProviderReasons: []
          }
        });
    });
    const derivativeContract = subjectPracticeProductionShadowScopeContracts().find((contract) =>
      contract.subject === 'math' && contract.taskFamily === 'derivative_direct_evaluation');
    const derivativeCell = {
      id: 10, subject: 'math', topicId: 71, topicTitle: '导数与微积分初步', difficultyBand: 'basic'
    };
    const derivativeRotation = { derivativeScope: 'direct_polynomial_value' };
    const derivativePlan = derivativeContract
      ? exactPlanFor(derivativeCell, derivativeContract, derivativeRotation)
      : null;
    const checks = {
      tcpFailureDoesNotAttemptHttp: tcpFailure.failureCode === 'observation_backend_tcp_unreachable',
      incompatibleHttpServiceRejected: incompatible.apiCompatible === false
        && incompatible.failureCode === 'observation_backend_login_http_405',
      compatibleObservationReadinessAccepted: compatible.apiCompatible === true
        && compatible.readinessLoaded === true
        && compatible.readiness?.observationOnlyMode === true
        && compatible.readiness?.observationManifestPolicyVersionsSupported?.includes(
          'subject-practice-observation-batch-manifest-v11-campaign-bound'
        )
        && compatibleCall === 2,
      derivativeScopeIdMaterialized:
        scopeIdFor(derivativeRotation) === 'math-basic-derivative-v1:direct_polynomial_value',
      derivativeExactPlanMaterialized:
        derivativePlan?.taskFamily === 'derivative_direct_evaluation'
        && derivativePlan?.planTemplate === 'math_derivative_condition_chain_v1'
        && derivativePlan?.renderConstraints?.exactDerivativeScope === 'direct_polynomial_value'
        && validateSubjectPracticeQuestionPlan(derivativePlan).valid,
      currentRegistryAndRoutingVersionsRemainVisible:
        compatible.readiness?.productionShadowScopeRegistryVersion
          === SUBJECT_PRACTICE_PRODUCTION_SHADOW_SCOPE_REGISTRY_VERSION
        && compatible.readiness?.localGeneratorShadowRoutingVersion
          === subjectPracticeLocalGeneratorShadowRoutingPolicy().routingVersion
    };
    return {
      mode: 'subject_practice_local_shadow_backend_probe_self_test',
      reportVersion: 'subject-practice-local-shadow-backend-probe-self-test-v2-math-derivative',
      status: Object.values(checks).every(Boolean) ? 'passed' : 'failed',
      checks,
      providerImpact: 'none_fixture_fetch_only',
      databaseImpact: 'none',
      publicationImpact: 'none'
    };
  } finally {
    if (previousEmail === undefined) delete process.env.ADMIN_BOOTSTRAP_EMAIL;
    else process.env.ADMIN_BOOTSTRAP_EMAIL = previousEmail;
    if (previousPassword === undefined) delete process.env.ADMIN_BOOTSTRAP_PASSWORD;
    else process.env.ADMIN_BOOTSTRAP_PASSWORD = previousPassword;
    if (previousToken === undefined) delete process.env.CSCA_OBSERVATION_ADMIN_TOKEN;
    else process.env.CSCA_OBSERVATION_ADMIN_TOKEN = previousToken;
    if (previousReadinessToken === undefined) delete process.env.CSCA_READINESS_EVIDENCE_TOKEN;
    else process.env.CSCA_READINESS_EVIDENCE_TOKEN = previousReadinessToken;
  }
}

async function candidateCountFor(prisma, runId, cellId) {
  const [row] = await prisma.$queryRaw(Prisma.sql`
    SELECT COUNT(*)::int AS "count"
    FROM "csca_questions"
    WHERE "source_type" = 'ai'
      AND "status" IN ('draft', 'approved', 'pending_review', 'review_failed', 'archived')
      AND "generation_metadata"->>'productionRunId' = ${String(runId)}
      AND "generation_metadata"->>'productionCellId' = ${String(cellId)}
  `);
  return Number(row?.count ?? 0);
}

async function buildReport(prisma, perFamily, filters = {}) {
  const allContracts = subjectPracticeProductionShadowScopeContracts();
  const selectedSubject = clean(filters.subject).toLowerCase();
  const selectedTaskFamily = clean(filters.taskFamily);
  const contracts = allContracts.filter((contract) =>
    (!selectedSubject || contract.subject === selectedSubject)
    && (!selectedTaskFamily || contract.taskFamily === selectedTaskFamily));
  if (contracts.length === 0) throw new Error('No production-shadow contract matches the requested subject/task-family filter.');
  const activeObservationTasks = await prisma.$queryRaw(Prisma.sql`
    SELECT "id"::text AS "id", "subject", "action", "status",
           "resource_id" AS "runId",
           "filter_snapshot"->>'productionCellId' AS "cellId",
           "filter_snapshot"->>'requestedTaskFamily' AS "taskFamily",
           "filter_snapshot"->>'observationExecutionRoute' AS "route",
           "created_at" AS "createdAt"
    FROM "csca_ai_questioning_tasks"
    WHERE "task_type" = 'subject_practice_observation'
      AND "status" IN ('queued', 'running')
    ORDER BY "created_at" ASC
  `);
  const sourceCorpusRows = await prisma.$queryRaw(Prisma.sql`
    SELECT q."subject", COUNT(*)::int AS "count"
    FROM "csca_source_questions" q
    JOIN "csca_source_documents" d ON d."id" = q."document_id"
    WHERE q."subject" IN ('math', 'physics', 'chemistry')
      AND d."status" = 'active'
    GROUP BY q."subject"
    ORDER BY q."subject"
  `);
  const currentKnownSourceCorpusCounts = Object.fromEntries(
    ['math', 'physics', 'chemistry'].map((subject) => [
      subject,
      Number(sourceCorpusRows.find((row) => clean(row.subject).toLowerCase() === subject)?.count ?? 0)
    ])
  );
  const runs = await prisma.$queryRaw(Prisma.sql`
    SELECT DISTINCT ON ("subject") "id", "subject", "status",
           "blocked_reason_code" AS "blockedReason", "open_total" AS "openTotal"
    FROM "csca_subject_practice_production_runs"
    WHERE "subject" IN ('math', 'physics', 'chemistry')
      AND "status" IN ('running', 'blocked')
      AND "open_total" > 0
    ORDER BY "subject", "id" DESC
  `);
  const families = [];
  for (const contract of contracts) {
    const run = runs.find((item) => clean(item.subject).toLowerCase() === contract.subject) ?? null;
    if (!run) {
      families.push({ subject: contract.subject, taskFamily: contract.taskFamily, status: 'open_run_missing' });
      continue;
    }
    const cells = await prisma.$queryRaw(Prisma.sql`
      SELECT "id", "run_id" AS "runId", "subject", "topic_id" AS "topicId",
             "topic_title" AS "topicTitle", "difficulty_band" AS "difficultyBand",
             "target_count" AS "targetCount", "published_count" AS "publishedCount"
      FROM "csca_subject_practice_production_cells"
      WHERE "run_id" = ${run.id}
        AND "subject" = ${contract.subject}
        AND "published_count" < "target_count"
      ORDER BY ("target_count" - "published_count") DESC, "id" ASC
    `);
    const cell = cells.find((candidate) => {
      const rotation = subjectPracticeQuestionPlanScopeRotationFor({
        subject: candidate.subject,
        topicTitle: candidate.topicTitle,
        productionCellId: candidate.id,
        targetDifficulty: candidate.difficultyBand,
        taskFamily: contract.taskFamily,
        planTemplate: contract.planTemplate,
        currentCandidateCount: 0
      });
      const plan = exactPlanFor(candidate, contract, rotation);
      const plannedScopeId = scopeIdFor(rotation);
      return plan?.taskFamily === contract.taskFamily
        && plan?.planTemplate === contract.planTemplate
        && contract.expectedScopeIds.includes(plannedScopeId)
        && validateSubjectPracticeQuestionPlan(plan).valid;
    }) ?? null;
    if (!cell) {
      families.push({
        subject: contract.subject,
        taskFamily: contract.taskFamily,
        planTemplate: contract.planTemplate,
        runId: run.id,
        runStatus: run.status,
        status: 'compatible_open_cell_missing'
      });
      continue;
    }
    const currentCandidateCount = await candidateCountFor(prisma, run.id, cell.id);
    const items = Array.from({ length: perFamily }, (_, offset) => {
      const rotation = subjectPracticeQuestionPlanScopeRotationFor({
        subject: cell.subject,
        topicTitle: cell.topicTitle,
        productionCellId: cell.id,
        targetDifficulty: cell.difficultyBand,
        taskFamily: contract.taskFamily,
        planTemplate: contract.planTemplate,
        currentCandidateCount: currentCandidateCount + offset
      });
      const plan = exactPlanFor(cell, contract, rotation);
      const validation = validateSubjectPracticeQuestionPlan(plan);
      return {
        ordinal: offset + 1,
        candidateCountBasis: currentCandidateCount + offset,
        scopeId: scopeIdFor(rotation),
        planValid: validation.valid,
        failureCodes: validation.failureCodes
      };
    });
    families.push({
      subject: contract.subject,
      taskFamily: contract.taskFamily,
      planTemplate: contract.planTemplate,
      runId: run.id,
      runStatus: run.status,
      runBlockedReason: run.blockedReason,
      cellId: cell.id,
      topicId: cell.topicId,
      topicTitle: cell.topicTitle,
      difficultyBand: cell.difficultyBand,
      remainingTargetCount: Number(cell.targetCount) - Number(cell.publishedCount),
      currentCandidateCount,
      status: items.every((item) => item.scopeId && item.planValid) ? 'batch_plan_ready' : 'batch_plan_invalid',
      items
    });
  }
  const configuredObservationPort = clean(argValue(
    'backend-port',
    process.env.CSCA_OBSERVATION_BACKEND_PORT || ''
  ));
  const observationBaseUrl = clean(argValue(
    'base-url',
    process.env.CSCA_OBSERVATION_BASE_URL || `http://127.0.0.1:${configuredObservationPort || '3001'}`
  )).replace(/\/+$/, '');
  let observationPort = Number(configuredObservationPort || 0);
  if (!configuredObservationPort) {
    try {
      const parsed = new URL(observationBaseUrl);
      observationPort = Number(parsed.port || (parsed.protocol === 'https:' ? 443 : 80));
    } catch {
      observationPort = 0;
    }
  }
  if (!Number.isInteger(observationPort) || observationPort < 1 || observationPort > 65535) {
    throw new Error('Observation backend port must be an integer from 1 to 65535.');
  }
  const observationBackendTcpReachable = await portReachable(observationPort);
  const observationBackendProbe = await probeObservationBackend(
    observationBaseUrl,
    observationBackendTcpReachable
  );
  const targetReadiness = observationBackendProbe.readiness;
  const runtime = {
    source: observationBackendProbe.readinessLoaded ? 'target_backend_readiness' : 'target_backend_probe_failed',
    observationOnlyMode: targetReadiness?.observationOnlyMode === true,
    localGeneratorShadowEnabled: targetReadiness?.localGeneratorShadowEnabled === true,
    questionPlanEnabled: targetReadiness?.questionPlanEnabled === true,
    observationSubmissionPlanPolicyVersion:
      clean(targetReadiness?.observationSubmissionPlanPolicyVersion),
    reviewGatePolicyVersion: clean(targetReadiness?.reviewGatePolicyVersion),
    chemistryAcidBaseSolverVersion: clean(targetReadiness?.chemistryAcidBaseSolverVersion),
    chemistryAcidBaseIndependentOracleVersion:
      clean(targetReadiness?.chemistryAcidBaseIndependentOracleVersion),
    mathDerivativeLocalGeneratorVersion:
      clean(targetReadiness?.mathDerivativeLocalGeneratorVersion),
    mathDerivativeSolverVersion: clean(targetReadiness?.mathDerivativeSolverVersion),
    mathDerivativeScopeVersion: clean(targetReadiness?.mathDerivativeScopeVersion),
    mathDerivativeIndependentOracleVersion:
      clean(targetReadiness?.mathDerivativeIndependentOracleVersion),
    productionShadowScopeRegistryVersion:
      clean(targetReadiness?.productionShadowScopeRegistryVersion),
    localGeneratorShadowRoutingVersion:
      clean(targetReadiness?.localGeneratorShadowRoutingVersion),
    candidateOutputNoveltyPolicyVersion: clean(targetReadiness?.candidateOutputNoveltyPolicyVersion),
    candidateNoveltyCorpusSnapshotVersion: clean(targetReadiness?.candidateNoveltyCorpusSnapshotVersion),
    candidateNoveltyMatchDigestVersion: clean(targetReadiness?.candidateNoveltyMatchDigestVersion),
    structuredSourceCorpusSchemaVersion: clean(targetReadiness?.structuredSourceCorpusSchemaVersion),
    sourceCorpusNormalizationVersion: clean(targetReadiness?.sourceCorpusNormalizationVersion),
    localShadowCandidateSeedPolicyVersion:
      clean(targetReadiness?.localShadowCandidateSeedPolicyVersion),
    scenarioBlueprintObservationEnvelopeSupported:
      targetReadiness?.scenarioBlueprintObservationEnvelopeSupported === true,
    scenarioBlueprintObservationEnvelopePolicyVersion:
      clean(targetReadiness?.scenarioBlueprintObservationEnvelopePolicyVersion),
    observationManifestPolicyVersionsSupported:
      Array.isArray(targetReadiness?.observationManifestPolicyVersionsSupported)
        ? targetReadiness.observationManifestPolicyVersionsSupported.map(clean).filter(Boolean)
        : [],
    cellAllowlist: clean(targetReadiness?.questionPlanCellAllowlist),
    readyForLocalZeroProviderSubmission: targetReadiness?.readyForLocalZeroProviderSubmission === true,
    readyForLocalZeroProviderExecution: targetReadiness?.readyForLocalZeroProviderExecution === true,
    localZeroProviderReasons: Array.isArray(targetReadiness?.localZeroProviderReasons)
      ? targetReadiness.localZeroProviderReasons
      : [],
    observationBackendBaseUrl: observationBaseUrl,
    observationBackendPort: observationPort,
    observationBackendTcpReachable,
    observationBackendApiCompatible: observationBackendProbe.apiCompatible,
    observationBackendReadinessLoaded: observationBackendProbe.readinessLoaded,
    observationBackendProbeFailureCode: observationBackendProbe.failureCode
  };
  const readyFamilies = families.filter((family) => family.status === 'batch_plan_ready');
  const selectedCellIds = readyFamilies.map((family) => family.cellId);
  const currentRouting = subjectPracticeLocalGeneratorShadowRoutingPolicy();
  const derivativeContract = contracts.find((contract) =>
    contract.subject === 'math' && contract.taskFamily === 'derivative_direct_evaluation');
  const derivativeRuntimeBindingCurrent = !families.some((family) =>
    family.subject === 'math' && family.taskFamily === 'derivative_direct_evaluation')
    || Boolean(derivativeContract
      && runtime.mathDerivativeLocalGeneratorVersion === derivativeContract.expectedBinding.generatorVersion
      && runtime.mathDerivativeSolverVersion === derivativeContract.expectedBinding.solverVersion
      && runtime.mathDerivativeScopeVersion === derivativeContract.expectedBinding.verificationScopeVersion
      && runtime.mathDerivativeIndependentOracleVersion
        === derivativeContract.expectedBinding.independentOracleVersion);
  const candidateNoveltyRuntimeBindingCurrent =
    runtime.candidateOutputNoveltyPolicyVersion === SUBJECT_PRACTICE_CANDIDATE_OUTPUT_NOVELTY_POLICY_VERSION
    && runtime.candidateNoveltyCorpusSnapshotVersion
      === SUBJECT_PRACTICE_CANDIDATE_NOVELTY_CORPUS_SNAPSHOT_VERSION
    && runtime.candidateNoveltyMatchDigestVersion
      === SUBJECT_PRACTICE_CANDIDATE_NOVELTY_MATCH_DIGEST_VERSION
    && runtime.structuredSourceCorpusSchemaVersion
      === SUBJECT_PRACTICE_STRUCTURED_SOURCE_CORPUS_SCHEMA_VERSION
    && runtime.sourceCorpusNormalizationVersion
      === SUBJECT_PRACTICE_SOURCE_CORPUS_NORMALIZATION_VERSION;
  const runtimeReady = runtime.observationOnlyMode
    && runtime.localGeneratorShadowEnabled
    && runtime.questionPlanEnabled
    && Boolean(runtime.observationSubmissionPlanPolicyVersion)
    && Boolean(runtime.reviewGatePolicyVersion)
    && Boolean(runtime.chemistryAcidBaseSolverVersion)
    && Boolean(runtime.chemistryAcidBaseIndependentOracleVersion)
    && candidateNoveltyRuntimeBindingCurrent
    && Boolean(runtime.localShadowCandidateSeedPolicyVersion)
    && runtime.productionShadowScopeRegistryVersion
      === SUBJECT_PRACTICE_PRODUCTION_SHADOW_SCOPE_REGISTRY_VERSION
    && runtime.localGeneratorShadowRoutingVersion === currentRouting.routingVersion
    && derivativeRuntimeBindingCurrent
    && runtime.readyForLocalZeroProviderSubmission
    && runtime.readyForLocalZeroProviderExecution
    && runtime.observationBackendApiCompatible
    && runtime.observationBackendReadinessLoaded
    && selectedCellIds.every((cellId) => allowlistIncludes(runtime.cellAllowlist, cellId));
  return {
    mode: 'subject_practice_local_shadow_batch_preflight',
    reportVersion: 'subject-practice-local-shadow-batch-preflight-v9-novelty-contract-runtime-bound',
    status: readyFamilies.length === contracts.length && runtimeReady
      ? 'ready_for_explicit_zero_provider_shadow_authorization'
      : readyFamilies.length === contracts.length
        ? 'batch_ready_runtime_not_started'
        : 'batch_scope_incomplete',
    productionShadowScopeRegistryVersion: SUBJECT_PRACTICE_PRODUCTION_SHADOW_SCOPE_REGISTRY_VERSION,
    registryContractCount: allContracts.length,
    selectedContractCount: contracts.length,
    contractFilter: {
      subject: selectedSubject || null,
      taskFamily: selectedTaskFamily || null
    },
    localRouting: subjectPracticeLocalGeneratorShadowRoutingPolicy(),
    perFamily,
    plannedCandidateCount: readyFamilies.length * perFamily,
    plannedProviderCallCount: 0,
    maximumEstimatedCostUsd: 0,
    publicationSuppressed: true,
    databaseImpact: 'none_read_only_preflight',
    executionAuthorized: false,
    activeObservationTaskCount: activeObservationTasks.length,
    activeObservationTasks,
    isolatedBackendStartupSafe: activeObservationTasks.length === 0,
    automatedCandidateLeakageGate: {
      policyVersion: SUBJECT_PRACTICE_CANDIDATE_OUTPUT_NOVELTY_POLICY_VERSION,
      sourceBoundary: 'post_generation_separate_database_query_never_generator_input',
      failClosedWhenCorpusMissingOrMatchNotClear: true,
      currentKnownSourceCorpusCounts,
      readyForSelectedSubjects: readyFamilies.every((family) =>
        Number(currentKnownSourceCorpusCounts[family.subject] ?? 0) > 0)
    },
    requiredZeroProviderCostContract: {
      observationExecutionRoute: 'local_deterministic_zero_provider',
      costReservationPolicyVersion: 'guarded-observation-zero-provider-cost-reservation-v1',
      maxEstimatedCostUsd: 0,
      maximumReservedCostUsd: 0,
      providerAttemptLimit: 0
    },
    runtime,
    derivativeRuntimeBindingCurrent,
    candidateNoveltyRuntimeBindingCurrent,
    requiredRuntimeOverrides: {
      SUBJECT_PRACTICE_OBSERVATION_ONLY_MODE: 'true',
      CSCA_SUBJECT_PRACTICE_LOCAL_GENERATOR_SHADOW_ENABLED: 'true',
      CSCA_SUBJECT_PRACTICE_QUESTION_PLAN_ENABLED: 'true',
      CSCA_SUBJECT_PRACTICE_QUESTION_PLAN_CELL_ALLOWLIST: selectedCellIds.join(','),
      CSCA_AI_QUESTIONING_SCHEDULER_ENABLED: 'false',
      CSCA_AI_QUESTION_REVIEW_ENABLED: 'false'
    },
    families
  };
}

async function main() {
  if (process.argv.includes('--self-test-backend-probe')) {
    const report = await runBackendProbeSelfTest();
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (report.status !== 'passed') process.exitCode = 1;
    return;
  }
  const perFamily = Number(argValue('per-family', '8'));
  if (!Number.isInteger(perFamily) || perFamily < 1 || perFamily > 24) {
    throw new Error('--per-family must be an integer from 1 to 24.');
  }
  const prisma = new PrismaClient();
  try {
    const report = await buildReport(prisma, perFamily, {
      subject: argValue('subject', ''),
      taskFamily: argValue('task-family', '')
    });
    const compact = process.argv.includes('--compact');
    const output = compact ? {
      mode: report.mode,
      reportVersion: report.reportVersion,
      status: report.status,
      productionShadowScopeRegistryVersion: report.productionShadowScopeRegistryVersion,
      registryContractCount: report.registryContractCount,
      selectedContractCount: report.selectedContractCount,
      contractFilter: report.contractFilter,
      plannedCandidateCount: report.plannedCandidateCount,
      plannedProviderCallCount: report.plannedProviderCallCount,
      maximumEstimatedCostUsd: report.maximumEstimatedCostUsd,
      publicationSuppressed: report.publicationSuppressed,
      databaseImpact: report.databaseImpact,
      executionAuthorized: report.executionAuthorized,
      activeObservationTaskCount: report.activeObservationTaskCount,
      derivativeRuntimeBindingCurrent: report.derivativeRuntimeBindingCurrent,
      candidateNoveltyRuntimeBindingCurrent: report.candidateNoveltyRuntimeBindingCurrent,
      runtime: {
        source: report.runtime.source,
        observationBackendBaseUrl: report.runtime.observationBackendBaseUrl,
        observationBackendApiCompatible: report.runtime.observationBackendApiCompatible,
        observationBackendReadinessLoaded: report.runtime.observationBackendReadinessLoaded,
        observationBackendProbeFailureCode: report.runtime.observationBackendProbeFailureCode,
        observationOnlyMode: report.runtime.observationOnlyMode,
        localGeneratorShadowEnabled: report.runtime.localGeneratorShadowEnabled,
        questionPlanEnabled: report.runtime.questionPlanEnabled,
        cellAllowlist: report.runtime.cellAllowlist,
        readyForLocalZeroProviderSubmission: report.runtime.readyForLocalZeroProviderSubmission,
        readyForLocalZeroProviderExecution: report.runtime.readyForLocalZeroProviderExecution,
        productionShadowScopeRegistryVersion: report.runtime.productionShadowScopeRegistryVersion,
        localGeneratorShadowRoutingVersion: report.runtime.localGeneratorShadowRoutingVersion,
        mathDerivativeLocalGeneratorVersion: report.runtime.mathDerivativeLocalGeneratorVersion,
        mathDerivativeSolverVersion: report.runtime.mathDerivativeSolverVersion,
        mathDerivativeScopeVersion: report.runtime.mathDerivativeScopeVersion,
        mathDerivativeIndependentOracleVersion: report.runtime.mathDerivativeIndependentOracleVersion,
        candidateOutputNoveltyPolicyVersion: report.runtime.candidateOutputNoveltyPolicyVersion
      },
      families: report.families.map((family) => ({
        subject: family.subject,
        taskFamily: family.taskFamily,
        planTemplate: family.planTemplate ?? null,
        runId: family.runId ?? null,
        runStatus: family.runStatus ?? null,
        cellId: family.cellId ?? null,
        topicTitle: family.topicTitle ?? null,
        status: family.status,
        plannedScopeIds: Array.isArray(family.items)
          ? family.items.map((item) => item.scopeId)
          : []
      }))
    } : report;
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error?.stack ?? error}\n`);
    process.exitCode = 1;
  });
}

module.exports = { buildReport, exactPlanFor, scopeIdFor, probeObservationBackend, runBackendProbeSelfTest };

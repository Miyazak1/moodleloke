#!/usr/bin/env node

if (!require.extensions['.ts']) {
  require('../backend/node_modules/ts-node').register({
    transpileOnly: true,
    compilerOptions: { module: 'commonjs', moduleResolution: 'node' }
  });
}

const { createHash } = require('node:crypto');
const { existsSync, readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const {
  verifyQualificationArtifact
} = require('./csca-subject-practice-observation-batch-qualification-export.cjs');
const {
  SUBJECT_PRACTICE_DETERMINISTIC_FORMAL_THRESHOLDS
} = require('../backend/src/ai-questioning/subject-practice-scope-release-path-policy');

const PORTFOLIO_VERSION = 'subject-practice-signed-qualification-portfolio-v1';

function canonicalJsonValue(value) {
  if (Array.isArray(value)) return value.map(canonicalJsonValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalJsonValue(entry)]));
  }
  return value;
}

function stableJson(value) {
  return JSON.stringify(canonicalJsonValue(value));
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function clean(value) {
  return String(value ?? '').trim().toLowerCase();
}

function exactPlanKeys(verification) {
  return Object.keys(verification.qualification?.perExactPlan ?? {});
}

function eventBinding(event) {
  return {
    subject: clean(event.subject),
    taskFamily: clean(event.taskFamily),
    planTemplate: clean(event.planTemplate),
    questionPlanPolicyVersion: String(event.questionPlanPolicyVersion ?? ''),
    verificationScopeVersion: String(event.verificationScopeVersion ?? ''),
    generatorVersion: String(event.generatorVersion ?? ''),
    solverVersion: String(event.solverVersion ?? ''),
    explanationVerifierVersion: String(event.explanationVerifierVersion ?? ''),
    independentOracleVersion: String(event.independentOracleVersion ?? ''),
    sourceIsolationPolicyVersion: String(event.sourceIsolationPolicyVersion ?? ''),
    formalVerificationOrchestratorVersion: String(event.formalVerificationOrchestratorVersion ?? ''),
    localShadowRoutingVersion: String(event.localShadowRoutingVersion ?? '')
  };
}

function buildSignedQualificationPortfolio(input) {
  const artifacts = Array.isArray(input?.artifacts) ? input.artifacts : [];
  const verifications = artifacts.map((artifact) => verifyQualificationArtifact({
    artifact,
    secret: input?.secret
  }));
  const blockers = [];
  if (!verifications.length) blockers.push('qualification_portfolio_empty');
  if (verifications.some((item) => !item.verified)) blockers.push('qualification_artifact_verification_failed');

  const inferredPlanKeys = Array.from(new Set(verifications.flatMap(exactPlanKeys)));
  const selectedExactPlanKey = clean(input?.exactPlanKey || (inferredPlanKeys.length === 1 ? inferredPlanKeys[0] : ''));
  if (!selectedExactPlanKey) blockers.push('qualification_portfolio_exact_plan_ambiguous');
  if (inferredPlanKeys.some((key) => clean(key) !== selectedExactPlanKey)) {
    blockers.push('qualification_portfolio_cross_plan_mix_forbidden');
  }

  const batchIds = verifications.map((item) => item.batchId);
  if (new Set(batchIds).size !== batchIds.length) blockers.push('qualification_portfolio_duplicate_batch');

  const candidateIds = [];
  const eventIds = [];
  const events = [];
  const perBatch = [];
  const perScopeCounts = {};
  let requestedCount = 0;
  let candidateCount = 0;
  let publishableCount = 0;
  let falseAccepts = 0;
  let scopeLeakageCount = 0;
  let unexpectedFailureCount = 0;

  for (let index = 0; index < artifacts.length; index += 1) {
    const artifact = artifacts[index];
    const verification = verifications[index];
    const plan = verification.qualification?.perExactPlan?.[selectedExactPlanKey];
    if (!plan || plan.bridgeComplete !== true) {
      blockers.push(`qualification_portfolio_plan_not_trusted_complete:${verification.batchId || index}`);
      continue;
    }
    const signed = (artifact.signedCandidateEvidence ?? [])
      .find((item) => clean(item.exactPlanKey) === selectedExactPlanKey);
    const batchEvents = Array.isArray(signed?.batch?.events) ? signed.batch.events : [];
    if (batchEvents.length !== plan.candidateIds.length) {
      blockers.push(`qualification_portfolio_event_denominator_mismatch:${verification.batchId}`);
    }
    candidateIds.push(...plan.candidateIds.map(Number));
    eventIds.push(...batchEvents.map((event) => String(event.eventId ?? '')));
    events.push(...batchEvents);
    const shadow = plan.realProductionShadow;
    requestedCount += Number(shadow.requestedCount ?? 0);
    candidateCount += Number(shadow.candidateCount ?? 0);
    publishableCount += Number(shadow.publishableCount ?? 0);
    falseAccepts += Number(shadow.falseAccepts ?? 0);
    scopeLeakageCount += Number(shadow.scopeLeakageCount ?? 0);
    unexpectedFailureCount += Number(shadow.unexpectedFailureCount ?? 0);
    for (const [scopeId, count] of Object.entries(shadow.perScopeCounts ?? {})) {
      perScopeCounts[scopeId] = Number(perScopeCounts[scopeId] ?? 0) + Number(count ?? 0);
    }
    perBatch.push({
      batchId: verification.batchId,
      manifestSha256: verification.manifestSha256,
      candidateCount: plan.candidateIds.length,
      candidateIds: [...plan.candidateIds].sort((left, right) => left - right),
      candidateLeakageEvidenceRootSha256: plan.candidateLeakageEvidenceRootSha256
    });
  }

  if (new Set(candidateIds).size !== candidateIds.length) blockers.push('qualification_portfolio_duplicate_candidate');
  if (eventIds.some((value) => !value) || new Set(eventIds).size !== eventIds.length) {
    blockers.push('qualification_portfolio_duplicate_or_missing_event_id');
  }
  const bindingDigests = new Set(events.map((event) => sha256(stableJson(eventBinding(event)))));
  if (bindingDigests.size > 1) blockers.push('qualification_portfolio_binding_mismatch');
  const sourceCorpusSnapshots = Array.from(new Set(events
    .map((event) => String(event.candidateLeakageSourceCorpusSnapshotSha256 ?? ''))
    .filter(Boolean)));
  if (sourceCorpusSnapshots.length !== (events.length ? 1 : 0)) {
    blockers.push('qualification_portfolio_source_corpus_snapshot_mismatch');
  }
  const expectedScopeIds = Array.from(new Set(events.map((event) => String(event.scopeId ?? '')).filter(Boolean))).sort();
  const threshold = SUBJECT_PRACTICE_DETERMINISTIC_FORMAL_THRESHOLDS.minimumProductionShadowCases;
  const thresholdSatisfied = expectedScopeIds.length > 0
    && expectedScopeIds.every((scopeId) => Number(perScopeCounts[scopeId] ?? 0) >= threshold)
    && falseAccepts <= SUBJECT_PRACTICE_DETERMINISTIC_FORMAL_THRESHOLDS.maximumFalseAccepts
    && scopeLeakageCount <= SUBJECT_PRACTICE_DETERMINISTIC_FORMAL_THRESHOLDS.maximumScopeLeakage
    && unexpectedFailureCount <= SUBJECT_PRACTICE_DETERMINISTIC_FORMAL_THRESHOLDS.maximumUnexpectedConflicts;
  const accumulable = blockers.length === 0;
  const core = {
    policyVersion: PORTFOLIO_VERSION,
    exactPlanKey: selectedExactPlanKey || null,
    batchCount: perBatch.length,
    batchIds: [...batchIds].sort(),
    manifestSha256s: perBatch.map((item) => item.manifestSha256).sort(),
    candidateCount,
    candidateIds: [...candidateIds].sort((left, right) => left - right),
    expectedScopeIds,
    sourceCorpusSnapshotSha256: sourceCorpusSnapshots[0] ?? null,
    bindingSha256: bindingDigests.size === 1 ? Array.from(bindingDigests)[0] : null,
    perScopeCounts,
    requestedCount,
    publishableCount,
    falseAccepts,
    scopeLeakageCount,
    unexpectedFailureCount
  };
  return {
    ...core,
    portfolioSha256: sha256(stableJson(core)),
    status: accumulable
      ? thresholdSatisfied
        ? 'verified_formal_shadow_threshold_satisfied'
        : 'verified_accumulable_below_formal_shadow_threshold'
      : 'invalid_non_accumulable_portfolio',
    verifiedAccumulable: accumulable,
    formalShadowThresholdSatisfied: accumulable && thresholdSatisfied,
    minimumProductionShadowCasesPerScope: threshold,
    remainingPerScope: Object.fromEntries(expectedScopeIds.map((scopeId) => [
      scopeId,
      Math.max(0, threshold - Number(perScopeCounts[scopeId] ?? 0))
    ])),
    blockers: Array.from(new Set(blockers)),
    perBatch,
    providerImpact: 'none_no_provider_call',
    databaseImpact: 'none_artifact_only',
    publicationImpact: 'none_no_publication_write'
  };
}

function argsFrom(argv) {
  const args = {};
  for (const value of argv) {
    if (!value.startsWith('--')) continue;
    const [key, ...rest] = value.slice(2).split('=');
    args[key] = rest.length ? rest.join('=') : true;
  }
  return args;
}

function loadArtifacts(paths) {
  return paths.map((path) => {
    const absolute = resolve(process.cwd(), path);
    if (!existsSync(absolute)) throw new Error(`qualification_portfolio_artifact_missing:${absolute}`);
    return JSON.parse(readFileSync(absolute, 'utf8'));
  });
}

function selfTest(artifactPath) {
  const [artifact] = loadArtifacts([artifactPath]);
  const positive = buildSignedQualificationPortfolio({ artifacts: [artifact] });
  const duplicate = buildSignedQualificationPortfolio({ artifacts: [artifact, artifact] });
  const tampered = structuredClone(artifact);
  tampered.signedCandidateEvidence[0].batch.events[0].scopeId = 'math-basic-derivative-v1:tampered';
  const tamperedResult = buildSignedQualificationPortfolio({ artifacts: [tampered] });
  const checks = {
    currentArtifactVerifiedAndAccumulable: positive.verifiedAccumulable === true,
    currentEightRemainBelowFormalHundred: positive.formalShadowThresholdSatisfied === false
      && Object.values(positive.remainingPerScope).every((count) => count === 92),
    duplicateBatchAndCandidatesRejected: duplicate.verifiedAccumulable === false
      && duplicate.blockers.includes('qualification_portfolio_duplicate_batch')
      && duplicate.blockers.includes('qualification_portfolio_duplicate_candidate'),
    signedMutationRejected: tamperedResult.verifiedAccumulable === false
  };
  return {
    mode: 'subject_practice_signed_qualification_portfolio_self_test',
    reportVersion: 'subject-practice-signed-qualification-portfolio-self-test-v1',
    status: Object.values(checks).every(Boolean) ? 'passed' : 'failed',
    checks,
    positive
  };
}

if (require.main === module) {
  try {
    const args = argsFrom(process.argv.slice(2));
    const artifactPaths = String(args.artifacts ?? 'artifacts/local-shadow-7a03a8284e967af8a652-qualification.json')
      .split(',').map((value) => value.trim()).filter(Boolean);
    const report = args['self-test']
      ? selfTest(artifactPaths[0])
      : buildSignedQualificationPortfolio({
        artifacts: loadArtifacts(artifactPaths),
        exactPlanKey: args['exact-plan-key']
      });
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (report.status === 'failed'
      || (args['require-formal-threshold'] && report.formalShadowThresholdSatisfied !== true)) {
      process.exitCode = 1;
    }
  } catch (error) {
    process.stderr.write(`${error?.stack ?? error}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  PORTFOLIO_VERSION,
  buildSignedQualificationPortfolio,
  selfTest
};

#!/usr/bin/env node

require('../backend/node_modules/ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', moduleResolution: 'node' }
});

const path = require('node:path');
const { loadEnv } = require('./load-env.cjs');
loadEnv(path.resolve(__dirname, '..'));

const { PrismaClient } = require('../backend/node_modules/@prisma/client');
const {
  SUBJECT_PRACTICE_REVIEW_GATE_POLICY_VERSION,
  subjectPracticeReviewGateDecisionForOfflineEvaluation,
  subjectPracticeVerifiedBasicDerivativeShadowAllowsArithmeticShape
} = require('../backend/src/ai-questioning/ai-questioning.service');

const prisma = new PrismaClient();

function clean(value) {
  return String(value ?? '').trim();
}

function batchIdArg() {
  const prefix = '--batch-id=';
  const inline = process.argv.find((value) => value.startsWith(prefix));
  const positionalIndex = process.argv.indexOf('--batch-id');
  const value = clean(inline ? inline.slice(prefix.length) : positionalIndex >= 0 ? process.argv[positionalIndex + 1] : '');
  if (!/^local-shadow-[a-f0-9]{20}$/.test(value)) throw new Error('valid_local_shadow_batch_id_required');
  return value;
}

async function main() {
  const batchId = batchIdArg();
  const rows = await prisma.$queryRaw`
    SELECT q.id, q.status, q.generation_metadata AS "generationMetadata", q.review_metadata AS "reviewMetadata"
    FROM csca_questions q
    JOIN csca_ai_questioning_tasks task
      ON q.generation_metadata->>'observationTaskId' = task.id::text
    WHERE task.filter_snapshot->'sealedObservationBatch'->>'batchId' = ${batchId}
    ORDER BY (task.filter_snapshot->'sealedObservationBatch'->>'taskOrdinal')::int ASC
  `;
  if (!rows.length) throw new Error('batch_candidates_not_found');
  const results = rows.map((row) => {
    const review = row.reviewMetadata ?? {};
    const oldGate = review.gate ?? {};
    const replayGate = subjectPracticeReviewGateDecisionForOfflineEvaluation(review, row.generationMetadata);
    return {
      questionId: row.id,
      status: row.status,
      oldDecision: oldGate.decision ?? null,
      oldReasons: Array.isArray(oldGate.reasons) ? oldGate.reasons : [],
      narrowExemptionSatisfied: subjectPracticeVerifiedBasicDerivativeShadowAllowsArithmeticShape(row.generationMetadata),
      replayDecision: replayGate.decision,
      replayPublishable: replayGate.publishable,
      replayReasons: replayGate.reasons
    };
  });
  const output = {
    mode: 'read_only_review_gate_replay',
    batchId,
    policyVersion: SUBJECT_PRACTICE_REVIEW_GATE_POLICY_VERSION,
    candidateCount: results.length,
    oldPublishableCount: results.filter((item) => item.oldDecision === 'publishable').length,
    oldTrivialArithmeticBlockedCount: results.filter((item) => item.oldReasons.includes('trivial_arithmetic_candidate')).length,
    narrowExemptionSatisfiedCount: results.filter((item) => item.narrowExemptionSatisfied).length,
    replayPublishableCount: results.filter((item) => item.replayPublishable).length,
    databaseWrites: 0,
    providerCalls: 0,
    studentPublications: 0,
    results
  };
  console.log(JSON.stringify(output, null, 2));
  if (results.some((item) => !item.narrowExemptionSatisfied || !item.replayPublishable)) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

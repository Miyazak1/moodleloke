import { createHash } from 'node:crypto';

export const SUBJECT_PRACTICE_LOCAL_SHADOW_CANDIDATE_SEED_POLICY_VERSION =
  'subject-practice-local-shadow-candidate-seed-v1-sealed-batch-ordinal';

function clean(value: unknown) {
  return String(value ?? '').trim().toLowerCase();
}

function positiveInteger(value: unknown) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

export type SubjectPracticeLocalShadowCandidateSeedBinding = {
  policyVersion: typeof SUBJECT_PRACTICE_LOCAL_SHADOW_CANDIDATE_SEED_POLICY_VERSION;
  observationBatchId: string;
  taskOrdinal: number;
  productionRunId: number;
  productionCellId: number;
  seed: number;
  databaseIdentityIndependent: true;
};

export function subjectPracticeLocalShadowCandidateSeedBindingFor(input: {
  observationBatchId?: unknown;
  taskOrdinal?: unknown;
  productionRunId?: unknown;
  productionCellId?: unknown;
}): SubjectPracticeLocalShadowCandidateSeedBinding {
  const observationBatchId = clean(input.observationBatchId);
  const taskOrdinal = positiveInteger(input.taskOrdinal);
  const productionRunId = positiveInteger(input.productionRunId);
  const productionCellId = positiveInteger(input.productionCellId);
  if (!/^local-shadow-[a-f0-9]{20}$/.test(observationBatchId)
    || !taskOrdinal || !productionRunId || !productionCellId) {
    throw new Error('local_shadow_candidate_seed_binding_invalid');
  }
  const material = [
    SUBJECT_PRACTICE_LOCAL_SHADOW_CANDIDATE_SEED_POLICY_VERSION,
    observationBatchId,
    taskOrdinal,
    productionRunId,
    productionCellId
  ].join('|');
  return {
    policyVersion: SUBJECT_PRACTICE_LOCAL_SHADOW_CANDIDATE_SEED_POLICY_VERSION,
    observationBatchId,
    taskOrdinal,
    productionRunId,
    productionCellId,
    seed: Number.parseInt(createHash('sha256').update(material).digest('hex').slice(0, 8), 16),
    databaseIdentityIndependent: true
  };
}

export function assertSubjectPracticeLocalShadowCandidateSeedBinding(
  value: unknown
): SubjectPracticeLocalShadowCandidateSeedBinding {
  const raw = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const expected = subjectPracticeLocalShadowCandidateSeedBindingFor({
    observationBatchId: raw.observationBatchId,
    taskOrdinal: raw.taskOrdinal,
    productionRunId: raw.productionRunId,
    productionCellId: raw.productionCellId
  });
  if (raw.policyVersion !== expected.policyVersion
    || Number(raw.seed) !== expected.seed
    || raw.databaseIdentityIndependent !== true) {
    throw new Error('local_shadow_candidate_seed_binding_invalid');
  }
  return expected;
}

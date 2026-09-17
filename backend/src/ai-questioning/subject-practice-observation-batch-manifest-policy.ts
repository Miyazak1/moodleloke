import { createHash } from 'node:crypto';
import {
  SUBJECT_PRACTICE_SCENARIO_DIVERSITY_POLICY_VERSION,
  SUBJECT_PRACTICE_SCENARIO_DIVERSITY_POLICY_VERSION_V1
} from './subject-practice-scenario-diversity-policy';
import { SUBJECT_PRACTICE_DIFFICULTY_EVIDENCE_POLICY_VERSION } from './subject-practice-difficulty-evidence-policy-version';
import {
  SUBJECT_PRACTICE_LOCAL_GENERATOR_PRODUCTION_PROFILE_BINDING_POLICY_VERSION,
  subjectPracticeLocalGeneratorProductionProfileBindingForCell
} from './subject-practice-local-generator-production-profile-binding-policy';

export const SUBJECT_PRACTICE_OBSERVATION_BATCH_MANIFEST_POLICY_VERSION =
  'subject-practice-observation-batch-manifest-v10-production-profile-bound';
export const SUBJECT_PRACTICE_OBSERVATION_CAMPAIGN_MANIFEST_POLICY_VERSION =
  'subject-practice-observation-batch-manifest-v11-campaign-bound';
export const SUBJECT_PRACTICE_OBSERVATION_SCENARIO_SELECTION_POLICY_VERSION =
  'subject-practice-observation-scenario-selection-v1';
export const SUBJECT_PRACTICE_OBSERVATION_EXECUTION_ADMISSION_POLICY_VERSION =
  'subject-practice-observation-execution-admission-v2-zero-provider-generation-job';
export const SUBJECT_PRACTICE_OBSERVATION_OUTPUT_IDENTITY_POLICY_VERSION =
  'subject-practice-observation-output-identity-v2-plan-bound-family';
export const SUBJECT_PRACTICE_OBSERVATION_LOCAL_GENERATOR_REGISTRY_POLICY_VERSION =
  'subject-practice-observation-local-generator-registry-v4-math-derivative';
export const SUBJECT_PRACTICE_OBSERVATION_BATCH_MAXIMUM_TASK_COUNT = 64;

export type SubjectPracticeObservationBatchTaskInput = {
  ordinal: number;
  subject: 'math' | 'physics' | 'chemistry';
  productionRunId: number;
  productionCellId: number;
  taskFamily: string;
  planTemplate: string;
  plannedScopeId: string;
};

export type SubjectPracticeObservationBatchTask = SubjectPracticeObservationBatchTaskInput & {
  expectedGeneratorVersion: string;
  productionProfileBindingDigest: string;
};

export type SubjectPracticeObservationBatchManifest = {
  policyVersion: typeof SUBJECT_PRACTICE_OBSERVATION_BATCH_MANIFEST_POLICY_VERSION
    | typeof SUBJECT_PRACTICE_OBSERVATION_CAMPAIGN_MANIFEST_POLICY_VERSION;
  campaignId?: string;
  route: 'local_deterministic_zero_provider';
  providerAttemptLimit: 0;
  maximumEstimatedCostUsd: 0;
  publicationSuppressed: true;
  scenarioDiversityPolicyVersion: typeof SUBJECT_PRACTICE_SCENARIO_DIVERSITY_POLICY_VERSION
    | typeof SUBJECT_PRACTICE_SCENARIO_DIVERSITY_POLICY_VERSION_V1;
  scenarioSelectionPolicyVersion: typeof SUBJECT_PRACTICE_OBSERVATION_SCENARIO_SELECTION_POLICY_VERSION;
  executionAdmissionPolicyVersion: typeof SUBJECT_PRACTICE_OBSERVATION_EXECUTION_ADMISSION_POLICY_VERSION;
  outputIdentityPolicyVersion: typeof SUBJECT_PRACTICE_OBSERVATION_OUTPUT_IDENTITY_POLICY_VERSION;
  localGeneratorRegistryPolicyVersion: typeof SUBJECT_PRACTICE_OBSERVATION_LOCAL_GENERATOR_REGISTRY_POLICY_VERSION;
  difficultyEvidencePolicyVersion: typeof SUBJECT_PRACTICE_DIFFICULTY_EVIDENCE_POLICY_VERSION;
  productionProfileBindingPolicyVersion: typeof SUBJECT_PRACTICE_LOCAL_GENERATOR_PRODUCTION_PROFILE_BINDING_POLICY_VERSION;
  tasks: SubjectPracticeObservationBatchTask[];
};

export type SubjectPracticeObservationBatchEnvelope = {
  batchId: string;
  manifestSha256: string;
  expectedTaskCount: number;
  taskOrdinal: number;
  manifest: SubjectPracticeObservationBatchManifest;
};

function clean(value: unknown) {
  return String(value ?? '').trim().toLowerCase();
}

const SUBJECT_PRACTICE_OBSERVATION_LOCAL_GENERATOR_VERSIONS = new Map([
  ['math:elementary_function_direct_property:math_elementary_function_relation_v1', 'math-elementary-local-generator-v6-formula-evidence'],
  ['math:math_line_relation_direct:math_line_relation_direct_v1', 'math-line-relation-local-generator-v3'],
  ['math:derivative_direct_evaluation:math_derivative_condition_chain_v1', 'subject-practice-math-derivative-local-generator-v1-direct-polynomial-value'],
  ['physics:kinematics_basic_direct_relation:physics_kinematics_basic_relation_v1', 'physics-kinematics-local-generator-v3-semantic-options'],
  ['chemistry:ph_dilution_strong_acid_base_neutralization:chemistry_strong_acid_base_single_relation_v1', 'chemistry-strong-acid-base-local-generator-v5-bounded-plausible-values']
]);

export function subjectPracticeObservationExpectedGeneratorVersionFor(input: {
  subject?: unknown;
  taskFamily?: unknown;
  planTemplate?: unknown;
}) {
  return SUBJECT_PRACTICE_OBSERVATION_LOCAL_GENERATOR_VERSIONS.get([
    input.subject, input.taskFamily, input.planTemplate
  ].map(clean).join(':')) ?? null;
}

function positiveInteger(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function sha256(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function campaignIdFrom(value: unknown) {
  const campaignId = clean(value);
  return /^[a-z0-9][a-z0-9._-]{2,63}$/.test(campaignId) ? campaignId : null;
}

function normalizeTask(value: unknown): SubjectPracticeObservationBatchTask {
  const task = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const subject = clean(task.subject);
  const ordinal = positiveInteger(task.ordinal);
  const productionRunId = positiveInteger(task.productionRunId);
  const productionCellId = positiveInteger(task.productionCellId);
  const taskFamily = clean(task.taskFamily);
  const planTemplate = clean(task.planTemplate);
  const plannedScopeId = clean(task.plannedScopeId);
  const expectedGeneratorVersion = subjectPracticeObservationExpectedGeneratorVersionFor({
    subject, taskFamily, planTemplate
  });
  const productionProfileBinding = subjectPracticeLocalGeneratorProductionProfileBindingForCell({
    subject, productionRunId, productionCellId
  });
  if (!ordinal || !productionRunId || !productionCellId
    || !['math', 'physics', 'chemistry'].includes(subject)
    || !taskFamily || !planTemplate || !plannedScopeId
    || !expectedGeneratorVersion
    || clean(task.expectedGeneratorVersion) !== expectedGeneratorVersion
    || !productionProfileBinding
    || clean(task.productionProfileBindingDigest) !== productionProfileBinding.bindingDigest) {
    throw new Error('observation_batch_manifest_task_invalid');
  }
  return {
    ordinal,
    subject: subject as SubjectPracticeObservationBatchTask['subject'],
    productionRunId,
    productionCellId,
    taskFamily,
    planTemplate,
    plannedScopeId,
    expectedGeneratorVersion,
    productionProfileBindingDigest: productionProfileBinding.bindingDigest
  };
}

function normalizeManifest(
  value: unknown,
  options: { allowHistoricalScenarioDiversityPolicy?: boolean } = {}
): SubjectPracticeObservationBatchManifest {
  const manifest = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const legacyManifest = manifest.policyVersion === SUBJECT_PRACTICE_OBSERVATION_BATCH_MANIFEST_POLICY_VERSION;
  const campaignManifest = manifest.policyVersion === SUBJECT_PRACTICE_OBSERVATION_CAMPAIGN_MANIFEST_POLICY_VERSION;
  const campaignId = campaignIdFrom(manifest.campaignId);
  if ((!legacyManifest && !campaignManifest)
    || (legacyManifest && manifest.campaignId !== undefined)
    || (campaignManifest && !campaignId)
    || manifest.route !== 'local_deterministic_zero_provider'
    || Number(manifest.providerAttemptLimit) !== 0
    || Number(manifest.maximumEstimatedCostUsd) !== 0
    || manifest.publicationSuppressed !== true
    || !(manifest.scenarioDiversityPolicyVersion === SUBJECT_PRACTICE_SCENARIO_DIVERSITY_POLICY_VERSION
      || (options.allowHistoricalScenarioDiversityPolicy === true
        && manifest.scenarioDiversityPolicyVersion === SUBJECT_PRACTICE_SCENARIO_DIVERSITY_POLICY_VERSION_V1))
    || manifest.scenarioSelectionPolicyVersion !== SUBJECT_PRACTICE_OBSERVATION_SCENARIO_SELECTION_POLICY_VERSION
    || manifest.executionAdmissionPolicyVersion !== SUBJECT_PRACTICE_OBSERVATION_EXECUTION_ADMISSION_POLICY_VERSION
    || manifest.outputIdentityPolicyVersion !== SUBJECT_PRACTICE_OBSERVATION_OUTPUT_IDENTITY_POLICY_VERSION
    || manifest.localGeneratorRegistryPolicyVersion !== SUBJECT_PRACTICE_OBSERVATION_LOCAL_GENERATOR_REGISTRY_POLICY_VERSION
    || manifest.difficultyEvidencePolicyVersion !== SUBJECT_PRACTICE_DIFFICULTY_EVIDENCE_POLICY_VERSION
    || manifest.productionProfileBindingPolicyVersion !== SUBJECT_PRACTICE_LOCAL_GENERATOR_PRODUCTION_PROFILE_BINDING_POLICY_VERSION
    || !Array.isArray(manifest.tasks)
    || manifest.tasks.length < 1
    || manifest.tasks.length > SUBJECT_PRACTICE_OBSERVATION_BATCH_MAXIMUM_TASK_COUNT) {
    throw new Error('observation_batch_manifest_header_invalid');
  }
  const tasks = manifest.tasks.map(normalizeTask).sort((left, right) => left.ordinal - right.ordinal);
  if (tasks.some((task, index) => task.ordinal !== index + 1)) {
    throw new Error('observation_batch_manifest_ordinals_not_contiguous');
  }
  return {
    policyVersion: campaignManifest
      ? SUBJECT_PRACTICE_OBSERVATION_CAMPAIGN_MANIFEST_POLICY_VERSION
      : SUBJECT_PRACTICE_OBSERVATION_BATCH_MANIFEST_POLICY_VERSION,
    ...(campaignManifest ? { campaignId: campaignId as string } : {}),
    route: 'local_deterministic_zero_provider',
    providerAttemptLimit: 0,
    maximumEstimatedCostUsd: 0,
    publicationSuppressed: true,
    scenarioDiversityPolicyVersion: manifest.scenarioDiversityPolicyVersion as SubjectPracticeObservationBatchManifest['scenarioDiversityPolicyVersion'],
    scenarioSelectionPolicyVersion: SUBJECT_PRACTICE_OBSERVATION_SCENARIO_SELECTION_POLICY_VERSION,
    executionAdmissionPolicyVersion: SUBJECT_PRACTICE_OBSERVATION_EXECUTION_ADMISSION_POLICY_VERSION,
    outputIdentityPolicyVersion: SUBJECT_PRACTICE_OBSERVATION_OUTPUT_IDENTITY_POLICY_VERSION,
    localGeneratorRegistryPolicyVersion: SUBJECT_PRACTICE_OBSERVATION_LOCAL_GENERATOR_REGISTRY_POLICY_VERSION,
    difficultyEvidencePolicyVersion: SUBJECT_PRACTICE_DIFFICULTY_EVIDENCE_POLICY_VERSION,
    productionProfileBindingPolicyVersion: SUBJECT_PRACTICE_LOCAL_GENERATOR_PRODUCTION_PROFILE_BINDING_POLICY_VERSION,
    tasks
  };
}

export function buildSubjectPracticeObservationBatchManifest(
  tasks: SubjectPracticeObservationBatchTaskInput[]
): SubjectPracticeObservationBatchManifest {
  return normalizeManifest({
    policyVersion: SUBJECT_PRACTICE_OBSERVATION_BATCH_MANIFEST_POLICY_VERSION,
    route: 'local_deterministic_zero_provider',
    providerAttemptLimit: 0,
    maximumEstimatedCostUsd: 0,
    publicationSuppressed: true,
    scenarioDiversityPolicyVersion: SUBJECT_PRACTICE_SCENARIO_DIVERSITY_POLICY_VERSION,
    scenarioSelectionPolicyVersion: SUBJECT_PRACTICE_OBSERVATION_SCENARIO_SELECTION_POLICY_VERSION,
    executionAdmissionPolicyVersion: SUBJECT_PRACTICE_OBSERVATION_EXECUTION_ADMISSION_POLICY_VERSION,
    outputIdentityPolicyVersion: SUBJECT_PRACTICE_OBSERVATION_OUTPUT_IDENTITY_POLICY_VERSION,
    localGeneratorRegistryPolicyVersion: SUBJECT_PRACTICE_OBSERVATION_LOCAL_GENERATOR_REGISTRY_POLICY_VERSION,
    difficultyEvidencePolicyVersion: SUBJECT_PRACTICE_DIFFICULTY_EVIDENCE_POLICY_VERSION,
    productionProfileBindingPolicyVersion: SUBJECT_PRACTICE_LOCAL_GENERATOR_PRODUCTION_PROFILE_BINDING_POLICY_VERSION,
    tasks: tasks.map((task) => ({
      ...task,
      expectedGeneratorVersion: subjectPracticeObservationExpectedGeneratorVersionFor(task),
      productionProfileBindingDigest: subjectPracticeLocalGeneratorProductionProfileBindingForCell(task)?.bindingDigest
    }))
  });
}

export function buildSubjectPracticeObservationCampaignManifest(
  tasks: SubjectPracticeObservationBatchTaskInput[],
  campaignId: string
): SubjectPracticeObservationBatchManifest {
  return normalizeManifest({
    policyVersion: SUBJECT_PRACTICE_OBSERVATION_CAMPAIGN_MANIFEST_POLICY_VERSION,
    campaignId,
    route: 'local_deterministic_zero_provider',
    providerAttemptLimit: 0,
    maximumEstimatedCostUsd: 0,
    publicationSuppressed: true,
    scenarioDiversityPolicyVersion: SUBJECT_PRACTICE_SCENARIO_DIVERSITY_POLICY_VERSION,
    scenarioSelectionPolicyVersion: SUBJECT_PRACTICE_OBSERVATION_SCENARIO_SELECTION_POLICY_VERSION,
    executionAdmissionPolicyVersion: SUBJECT_PRACTICE_OBSERVATION_EXECUTION_ADMISSION_POLICY_VERSION,
    outputIdentityPolicyVersion: SUBJECT_PRACTICE_OBSERVATION_OUTPUT_IDENTITY_POLICY_VERSION,
    localGeneratorRegistryPolicyVersion: SUBJECT_PRACTICE_OBSERVATION_LOCAL_GENERATOR_REGISTRY_POLICY_VERSION,
    difficultyEvidencePolicyVersion: SUBJECT_PRACTICE_DIFFICULTY_EVIDENCE_POLICY_VERSION,
    productionProfileBindingPolicyVersion: SUBJECT_PRACTICE_LOCAL_GENERATOR_PRODUCTION_PROFILE_BINDING_POLICY_VERSION,
    tasks: tasks.map((task) => ({
      ...task,
      expectedGeneratorVersion: subjectPracticeObservationExpectedGeneratorVersionFor(task),
      productionProfileBindingDigest: subjectPracticeLocalGeneratorProductionProfileBindingForCell(task)?.bindingDigest
    }))
  });
}

export function subjectPracticeObservationBatchEnvelopeFor(input: {
  manifest: SubjectPracticeObservationBatchManifest;
  taskOrdinal: number;
}): SubjectPracticeObservationBatchEnvelope {
  const manifest = normalizeManifest(input.manifest);
  const manifestSha256 = sha256(manifest);
  const taskOrdinal = positiveInteger(input.taskOrdinal);
  if (!taskOrdinal || taskOrdinal > manifest.tasks.length) throw new Error('observation_batch_task_ordinal_invalid');
  return {
    batchId: `local-shadow-${manifestSha256.slice(0, 20)}`,
    manifestSha256,
    expectedTaskCount: manifest.tasks.length,
    taskOrdinal,
    manifest
  };
}

export function subjectPracticeHistoricalObservationBatchEnvelopeFor(input: {
  manifest: SubjectPracticeObservationBatchManifest;
  taskOrdinal: number;
}): SubjectPracticeObservationBatchEnvelope {
  const manifest = normalizeManifest(input.manifest, { allowHistoricalScenarioDiversityPolicy: true });
  const manifestSha256 = sha256(manifest);
  const taskOrdinal = positiveInteger(input.taskOrdinal);
  if (!taskOrdinal || taskOrdinal > manifest.tasks.length) throw new Error('observation_batch_task_ordinal_invalid');
  return {
    batchId: `local-shadow-${manifestSha256.slice(0, 20)}`,
    manifestSha256,
    expectedTaskCount: manifest.tasks.length,
    taskOrdinal,
    manifest
  };
}

export function assertSubjectPracticeObservationBatchEnvelope(input: {
  envelope: unknown;
  currentTask: Omit<SubjectPracticeObservationBatchTaskInput, 'ordinal' | 'plannedScopeId'>;
}) {
  const raw = input.envelope && typeof input.envelope === 'object' && !Array.isArray(input.envelope)
    ? input.envelope as Record<string, unknown>
    : {};
  const manifest = normalizeManifest(raw.manifest);
  const expected = subjectPracticeObservationBatchEnvelopeFor({
    manifest,
    taskOrdinal: Number(raw.taskOrdinal)
  });
  if (clean(raw.batchId) !== expected.batchId
    || clean(raw.manifestSha256) !== expected.manifestSha256
    || Number(raw.expectedTaskCount) !== expected.expectedTaskCount) {
    throw new Error('observation_batch_envelope_binding_invalid');
  }
  const descriptor = manifest.tasks[expected.taskOrdinal - 1];
  const current = input.currentTask;
  if (descriptor.subject !== clean(current.subject)
    || descriptor.productionRunId !== Number(current.productionRunId)
    || descriptor.productionCellId !== Number(current.productionCellId)
    || descriptor.taskFamily !== clean(current.taskFamily)
    || descriptor.planTemplate !== clean(current.planTemplate)) {
    throw new Error('observation_batch_current_task_not_in_manifest');
  }
  return expected;
}

export function assertSubjectPracticeHistoricalObservationBatchEnvelope(input: {
  envelope: unknown;
  currentTask: Omit<SubjectPracticeObservationBatchTaskInput, 'ordinal' | 'plannedScopeId'>;
}) {
  const raw = input.envelope && typeof input.envelope === 'object' && !Array.isArray(input.envelope)
    ? input.envelope as Record<string, unknown>
    : {};
  const manifest = normalizeManifest(raw.manifest, { allowHistoricalScenarioDiversityPolicy: true });
  const expected = subjectPracticeHistoricalObservationBatchEnvelopeFor({
    manifest,
    taskOrdinal: Number(raw.taskOrdinal)
  });
  if (clean(raw.batchId) !== expected.batchId
    || clean(raw.manifestSha256) !== expected.manifestSha256
    || Number(raw.expectedTaskCount) !== expected.expectedTaskCount) {
    throw new Error('observation_batch_envelope_binding_invalid');
  }
  const descriptor = manifest.tasks[expected.taskOrdinal - 1];
  const current = input.currentTask;
  if (descriptor.subject !== clean(current.subject)
    || descriptor.productionRunId !== Number(current.productionRunId)
    || descriptor.productionCellId !== Number(current.productionCellId)
    || descriptor.taskFamily !== clean(current.taskFamily)
    || descriptor.planTemplate !== clean(current.planTemplate)) {
    throw new Error('observation_batch_current_task_not_in_manifest');
  }
  return expected;
}

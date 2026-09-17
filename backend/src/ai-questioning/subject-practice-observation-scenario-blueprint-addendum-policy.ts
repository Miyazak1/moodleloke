import { createHash } from 'node:crypto';
import {
  SubjectPracticeObservationBatchManifest,
  subjectPracticeHistoricalObservationBatchEnvelopeFor,
  subjectPracticeObservationBatchEnvelopeFor
} from './subject-practice-observation-batch-manifest-policy';
import {
  SubjectPracticeScenarioBlueprintShadowContext,
  validateSubjectPracticeProvisionalScenarioContract
} from './subject-practice-scenario-blueprint-materialization-policy';

export const SUBJECT_PRACTICE_OBSERVATION_SCENARIO_BLUEPRINT_ADDENDUM_POLICY_VERSION =
  'subject-practice-observation-scenario-blueprint-addendum-v1-shadow-only';

type RecordValue = Record<string, unknown>;

export type SubjectPracticeObservationScenarioBlueprintAddendumEntryInput = {
  taskOrdinal: number;
  scenarioBlueprintShadowContext: SubjectPracticeScenarioBlueprintShadowContext;
};

function recordFrom(value: unknown): RecordValue | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : null;
}

function clean(value: unknown) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  const record = recordFrom(value);
  if (!record) return value;
  return Object.fromEntries(Object.keys(record).sort().map((key) => [key, canonicalValue(record[key])]));
}

function digestFor(value: unknown) {
  return createHash('sha256').update(JSON.stringify(canonicalValue(value))).digest('hex');
}

export function subjectPracticeObservationExactScopeForPlannedScope(subject: string, plannedScopeId: string) {
  if (subject === 'physics' && plannedScopeId.startsWith('physics-basic-kinematics-v2:')) {
    return plannedScopeId.slice('physics-basic-kinematics-v2:'.length);
  }
  if (subject === 'chemistry' && plannedScopeId.startsWith('chemistry-strong-acid-base-v3:')) {
    return plannedScopeId.slice('chemistry-strong-acid-base-v3:'.length).split(':')[0];
  }
  return null;
}

function normalizedAddendumFor(input: {
  manifest: SubjectPracticeObservationBatchManifest;
  entries: SubjectPracticeObservationScenarioBlueprintAddendumEntryInput[];
  allowHistoricalManifest?: boolean;
}) {
  const firstEnvelope = input.allowHistoricalManifest
    ? subjectPracticeHistoricalObservationBatchEnvelopeFor({ manifest: input.manifest, taskOrdinal: 1 })
    : subjectPracticeObservationBatchEnvelopeFor({ manifest: input.manifest, taskOrdinal: 1 });
  const blockers: string[] = [];
  if (!Array.isArray(input.entries) || input.entries.length !== firstEnvelope.manifest.tasks.length) {
    blockers.push('scenario_blueprint_addendum_full_batch_coverage_required');
  }
  const ordinals = new Set<number>();
  const normalizedEntries = (Array.isArray(input.entries) ? input.entries : []).map((entry) => {
    const taskOrdinal = Number(entry?.taskOrdinal);
    const descriptor = Number.isInteger(taskOrdinal) && taskOrdinal > 0
      ? firstEnvelope.manifest.tasks[taskOrdinal - 1]
      : null;
    if (!descriptor || ordinals.has(taskOrdinal)) {
      blockers.push('scenario_blueprint_addendum_ordinal_invalid_or_duplicate');
    }
    ordinals.add(taskOrdinal);
    const context = entry?.scenarioBlueprintShadowContext;
    const validation = validateSubjectPracticeProvisionalScenarioContract(context ?? {});
    const binding = recordFrom(context?.binding);
    const contract = recordFrom(validation.provisionalScenarioContract);
    const expectedScope = descriptor
      ? subjectPracticeObservationExactScopeForPlannedScope(descriptor.subject, descriptor.plannedScopeId)
      : null;
    if (!descriptor || !['physics', 'chemistry'].includes(descriptor.subject) || !expectedScope) {
      blockers.push('scenario_blueprint_addendum_task_not_supported');
    }
    if (!validation.valid) blockers.push(...validation.blockers);
    if (descriptor && (
      clean(binding?.subject) !== descriptor.subject
      || clean(binding?.taskFamily) !== descriptor.taskFamily
      || clean(binding?.planTemplate) !== descriptor.planTemplate
      || clean(binding?.exactScope) !== expectedScope
      || clean(contract?.subject) !== descriptor.subject
      || clean(contract?.taskFamily) !== descriptor.taskFamily
      || clean(contract?.planTemplate) !== descriptor.planTemplate
      || clean(contract?.solverAction) !== expectedScope
    )) blockers.push('scenario_blueprint_addendum_task_binding_mismatch');
    return {
      taskOrdinal,
      plannedScopeId: descriptor?.plannedScopeId ?? null,
      scenarioContractDigest: clean(contract?.scenarioContractDigest) || null,
      scenarioFamilyId: clean(contract?.scenarioFamilyId) || null,
      scenarioBlueprintShadowContext: context
    };
  }).sort((left, right) => left.taskOrdinal - right.taskOrdinal);
  if (firstEnvelope.manifest.tasks.some((_, index) => !ordinals.has(index + 1))) {
    blockers.push('scenario_blueprint_addendum_full_batch_coverage_required');
  }
  const familyCounts = normalizedEntries.reduce<Record<string, number>>((counts, entry) => {
    const key = entry.scenarioFamilyId || 'missing';
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
  const maximumFamilyShare = normalizedEntries.length
    ? Math.max(...Object.values(familyCounts)) / normalizedEntries.length
    : 1;
  if (maximumFamilyShare > 0.25) blockers.push('scenario_blueprint_addendum_family_concentration_exceeds_shadow_limit');
  const core = {
    policyVersion: SUBJECT_PRACTICE_OBSERVATION_SCENARIO_BLUEPRINT_ADDENDUM_POLICY_VERSION,
    stage: 'shadow_only_thresholds_not_frozen',
    batchId: firstEnvelope.batchId,
    manifestSha256: firstEnvelope.manifestSha256,
    expectedTaskCount: firstEnvelope.expectedTaskCount,
    route: 'local_deterministic_zero_provider',
    providerAttemptLimit: 0,
    maximumEstimatedCostUsd: 0,
    publicationSuppressed: true,
    coverageMode: 'full_batch',
    entries: normalizedEntries
  };
  return {
    blockers: [...new Set(blockers)],
    core,
    familyCounts,
    maximumFamilyShare
  };
}

export function buildSubjectPracticeObservationScenarioBlueprintAddendum(input: {
  manifest: SubjectPracticeObservationBatchManifest;
  entries: SubjectPracticeObservationScenarioBlueprintAddendumEntryInput[];
}) {
  const normalized = normalizedAddendumFor(input);
  if (normalized.blockers.length) throw new Error(normalized.blockers.join(','));
  const entryIndex = normalized.core.entries.map((entry) => ({
    taskOrdinal: entry.taskOrdinal,
    plannedScopeId: entry.plannedScopeId,
    scenarioContractDigest: entry.scenarioContractDigest,
    scenarioFamilyId: entry.scenarioFamilyId,
    contextSha256: digestFor(entry.scenarioBlueprintShadowContext)
  }));
  const scenarioBlueprintRootSha256 = digestFor({
    policyVersion: normalized.core.policyVersion,
    batchId: normalized.core.batchId,
    manifestSha256: normalized.core.manifestSha256,
    expectedTaskCount: normalized.core.expectedTaskCount,
    entryIndex
  });
  return {
    ...normalized.core,
    addendumSha256: digestFor(normalized.core),
    scenarioBlueprintRootSha256,
    entryIndex,
    familyCounts: normalized.familyCounts,
    maximumFamilyShare: normalized.maximumFamilyShare,
    productionGenerationAuthorized: false,
    publicationAuthorized: false,
    releaseQualification: false
  };
}

function assertObservationScenarioBlueprintAddendum(input: {
  manifest: SubjectPracticeObservationBatchManifest;
  addendum: unknown;
}, allowHistoricalManifest: boolean) {
  const raw = recordFrom(input.addendum);
  const rawEntries = Array.isArray(raw?.entries) ? raw.entries : [];
  const normalized = normalizedAddendumFor({
    manifest: input.manifest,
    allowHistoricalManifest,
    entries: rawEntries.map((value) => {
      const entry = recordFrom(value);
      return {
        taskOrdinal: Number(entry?.taskOrdinal),
        scenarioBlueprintShadowContext: recordFrom(entry?.scenarioBlueprintShadowContext) ?? {}
      };
    })
  });
  const expected = { ...normalized.core, addendumSha256: digestFor(normalized.core) };
  const expectedEntryIndex = normalized.core.entries.map((entry) => ({
    taskOrdinal: entry.taskOrdinal,
    plannedScopeId: entry.plannedScopeId,
    scenarioContractDigest: entry.scenarioContractDigest,
    scenarioFamilyId: entry.scenarioFamilyId,
    contextSha256: digestFor(entry.scenarioBlueprintShadowContext)
  }));
  const expectedRoot = digestFor({
    policyVersion: normalized.core.policyVersion,
    batchId: normalized.core.batchId,
    manifestSha256: normalized.core.manifestSha256,
    expectedTaskCount: normalized.core.expectedTaskCount,
    entryIndex: expectedEntryIndex
  });
  if (normalized.blockers.length
    || raw?.policyVersion !== expected.policyVersion
    || raw?.stage !== expected.stage
    || clean(raw?.batchId) !== expected.batchId
    || clean(raw?.manifestSha256) !== expected.manifestSha256
    || Number(raw?.expectedTaskCount) !== expected.expectedTaskCount
    || raw?.route !== expected.route
    || Number(raw?.providerAttemptLimit) !== 0
    || Number(raw?.maximumEstimatedCostUsd) !== 0
    || raw?.publicationSuppressed !== true
    || raw?.coverageMode !== 'full_batch'
    || clean(raw?.addendumSha256) !== expected.addendumSha256
    || clean(raw?.scenarioBlueprintRootSha256) !== expectedRoot
    || JSON.stringify(canonicalValue(raw?.entryIndex)) !== JSON.stringify(canonicalValue(expectedEntryIndex))) {
    throw new Error(normalized.blockers[0] ?? 'scenario_blueprint_addendum_binding_invalid');
  }
  return {
    ...expected,
    scenarioBlueprintRootSha256: expectedRoot,
    entryIndex: expectedEntryIndex,
    familyCounts: normalized.familyCounts,
    maximumFamilyShare: normalized.maximumFamilyShare,
    productionGenerationAuthorized: false,
    publicationAuthorized: false,
    releaseQualification: false
  };
}

export function assertSubjectPracticeObservationScenarioBlueprintAddendum(input: {
  manifest: SubjectPracticeObservationBatchManifest;
  addendum: unknown;
}) {
  return assertObservationScenarioBlueprintAddendum(input, false);
}

/** Read-only/rebinding audit for immutable addenda sealed under a known old manifest policy. */
export function assertSubjectPracticeHistoricalObservationScenarioBlueprintAddendum(input: {
  manifest: SubjectPracticeObservationBatchManifest;
  addendum: unknown;
}) {
  return assertObservationScenarioBlueprintAddendum(input, true);
}

export function subjectPracticeObservationScenarioBlueprintTaskEnvelopeFor(input: {
  manifest: SubjectPracticeObservationBatchManifest;
  addendum: unknown;
  taskOrdinal: number;
}) {
  const addendum = assertSubjectPracticeObservationScenarioBlueprintAddendum(input);
  const entry = addendum.entries.find((item) => item.taskOrdinal === Number(input.taskOrdinal));
  if (!entry) throw new Error('scenario_blueprint_addendum_task_ordinal_missing');
  return {
    policyVersion: addendum.policyVersion,
    stage: addendum.stage,
    batchId: addendum.batchId,
    manifestSha256: addendum.manifestSha256,
    expectedTaskCount: addendum.expectedTaskCount,
    route: addendum.route,
    providerAttemptLimit: addendum.providerAttemptLimit,
    maximumEstimatedCostUsd: addendum.maximumEstimatedCostUsd,
    publicationSuppressed: addendum.publicationSuppressed,
    coverageMode: addendum.coverageMode,
    addendumSha256: addendum.addendumSha256,
    scenarioBlueprintRootSha256: addendum.scenarioBlueprintRootSha256,
    entryIndex: addendum.entryIndex,
    taskOrdinal: entry.taskOrdinal,
    entry
  };
}

export function assertSubjectPracticeObservationScenarioBlueprintTaskEnvelope(input: {
  manifest: SubjectPracticeObservationBatchManifest;
  envelope: unknown;
}) {
  const raw = recordFrom(input.envelope);
  const first = subjectPracticeObservationBatchEnvelopeFor({ manifest: input.manifest, taskOrdinal: 1 });
  const taskOrdinal = Number(raw?.taskOrdinal);
  const descriptor = Number.isInteger(taskOrdinal) && taskOrdinal > 0
    ? first.manifest.tasks[taskOrdinal - 1]
    : null;
  const entry = recordFrom(raw?.entry);
  const context = recordFrom(entry?.scenarioBlueprintShadowContext) ?? {};
  const validation = validateSubjectPracticeProvisionalScenarioContract(context);
  const contract = recordFrom(validation.provisionalScenarioContract);
  const binding = recordFrom(context.binding);
  const expectedScope = descriptor
    ? subjectPracticeObservationExactScopeForPlannedScope(descriptor.subject, descriptor.plannedScopeId)
    : null;
  const entryIndex = Array.isArray(raw?.entryIndex) ? raw.entryIndex.map(recordFrom) : [];
  const indexed = entryIndex.find((item) => Number(item?.taskOrdinal) === taskOrdinal);
  const root = digestFor({
    policyVersion: raw?.policyVersion,
    batchId: raw?.batchId,
    manifestSha256: raw?.manifestSha256,
    expectedTaskCount: raw?.expectedTaskCount,
    entryIndex
  });
  const indexOrdinals = new Set(entryIndex.map((item) => Number(item?.taskOrdinal)));
  const familyCounts = entryIndex.reduce<Record<string, number>>((counts, item) => {
    const key = clean(item?.scenarioFamilyId) || 'missing';
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
  const maximumFamilyShare = entryIndex.length ? Math.max(...Object.values(familyCounts)) / entryIndex.length : 1;
  const valid = Boolean(
    raw?.policyVersion === SUBJECT_PRACTICE_OBSERVATION_SCENARIO_BLUEPRINT_ADDENDUM_POLICY_VERSION
    && raw?.stage === 'shadow_only_thresholds_not_frozen'
    && clean(raw?.batchId) === first.batchId
    && clean(raw?.manifestSha256) === first.manifestSha256
    && Number(raw?.expectedTaskCount) === first.expectedTaskCount
    && raw?.route === 'local_deterministic_zero_provider'
    && Number(raw?.providerAttemptLimit) === 0
    && Number(raw?.maximumEstimatedCostUsd) === 0
    && raw?.publicationSuppressed === true
    && raw?.coverageMode === 'full_batch'
    && clean(raw?.scenarioBlueprintRootSha256) === root
    && entryIndex.length === first.expectedTaskCount
    && first.manifest.tasks.every((_, index) => indexOrdinals.has(index + 1))
    && maximumFamilyShare <= 0.25
    && descriptor && expectedScope && validation.valid
    && Number(entry?.taskOrdinal) === taskOrdinal
    && clean(entry?.plannedScopeId) === descriptor.plannedScopeId
    && clean(entry?.scenarioContractDigest) === clean(contract?.scenarioContractDigest)
    && clean(entry?.scenarioFamilyId) === clean(contract?.scenarioFamilyId)
    && clean(indexed?.plannedScopeId) === descriptor.plannedScopeId
    && clean(indexed?.scenarioContractDigest) === clean(contract?.scenarioContractDigest)
    && clean(indexed?.scenarioFamilyId) === clean(contract?.scenarioFamilyId)
    && clean(indexed?.contextSha256) === digestFor(context)
    && clean(binding?.subject) === descriptor.subject
    && clean(binding?.taskFamily) === descriptor.taskFamily
    && clean(binding?.planTemplate) === descriptor.planTemplate
    && clean(binding?.exactScope) === expectedScope
    && clean(contract?.solverAction) === expectedScope
  );
  if (!valid) throw new Error('scenario_blueprint_task_envelope_invalid');
  return {
    policyVersion: raw?.policyVersion,
    batchId: first.batchId,
    manifestSha256: first.manifestSha256,
    taskOrdinal,
    addendumSha256: clean(raw?.addendumSha256),
    scenarioBlueprintRootSha256: root,
    scenarioBlueprintShadowContext: context as SubjectPracticeScenarioBlueprintShadowContext,
    providerAttemptLimit: 0,
    maximumEstimatedCostUsd: 0,
    publicationSuppressed: true,
    releaseQualification: false,
    publicationAuthorized: false
  };
}

export function subjectPracticeObservationScenarioBlueprintContextForOrdinal(input: {
  manifest: SubjectPracticeObservationBatchManifest;
  addendum: unknown;
  taskOrdinal: number;
}) {
  const addendum = assertSubjectPracticeObservationScenarioBlueprintAddendum(input);
  const entry = addendum.entries.find((item) => item.taskOrdinal === Number(input.taskOrdinal));
  if (!entry) throw new Error('scenario_blueprint_addendum_task_ordinal_missing');
  return entry.scenarioBlueprintShadowContext;
}

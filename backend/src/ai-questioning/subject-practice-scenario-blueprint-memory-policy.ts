import {
  SUBJECT_PRACTICE_SCENARIO_BLUEPRINT_POLICY_VERSION
} from './subject-practice-scenario-blueprint-policy';

export const SUBJECT_PRACTICE_SCENARIO_BLUEPRINT_MEMORY_POLICY_VERSION =
  'subject-practice-scenario-blueprint-memory-ranking-v1-shadow-only';

type RecordValue = Record<string, unknown>;

const DIMENSION_KEYS = [
  'scenarioMode', 'scenarioDomain', 'scenarioEntity', 'environment',
  'scenarioAction', 'informationForm', 'questionPurpose', 'contextNecessity'
] as const;
const HISTORY_KEYS = new Set([
  'blueprintFingerprint', 'renameInvariantFingerprint', 'canonicalDimensions',
  'lifecycleStatus', 'failureCodes'
]);
const LIFECYCLE_STATUSES = new Set(['provisional', 'stable', 'rejected']);

function recordFrom(value: unknown): RecordValue | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : null;
}

function clean(value: unknown) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function dimensionsFrom(value: unknown) {
  const record = recordFrom(value);
  if (!record || Object.keys(record).some((key) => !DIMENSION_KEYS.includes(key as typeof DIMENSION_KEYS[number]))) {
    return null;
  }
  const dimensions = Object.fromEntries(DIMENSION_KEYS.map((key) => [key, clean(record[key])])) as Record<string, string>;
  return Object.values(dimensions).every(Boolean) ? dimensions : null;
}

function historyEntryFrom(value: unknown) {
  const record = recordFrom(value);
  if (!record || Object.keys(record).some((key) => !HISTORY_KEYS.has(key))) return null;
  const dimensions = dimensionsFrom(record.canonicalDimensions);
  const failureCodes = Array.isArray(record.failureCodes)
    ? record.failureCodes.map(clean).filter(Boolean)
    : null;
  if (!dimensions
    || !clean(record.blueprintFingerprint)
    || !clean(record.renameInvariantFingerprint)
    || !LIFECYCLE_STATUSES.has(clean(record.lifecycleStatus))
    || !failureCodes
    || failureCodes.some((code) => !/^[a-z0-9_:-]{1,80}$/.test(code))) return null;
  return {
    blueprintFingerprint: clean(record.blueprintFingerprint),
    renameInvariantFingerprint: clean(record.renameInvariantFingerprint),
    canonicalDimensions: dimensions,
    lifecycleStatus: clean(record.lifecycleStatus),
    failureCodes
  };
}

function increment(target: Record<string, number>, key: string) {
  target[key] = (target[key] ?? 0) + 1;
}

export function subjectPracticeScenarioBlueprintMemoryRankingFor(input: {
  candidates?: unknown[];
  historicalSummaries?: unknown[];
}) {
  const rawHistory = Array.isArray(input.historicalSummaries) ? input.historicalSummaries : [];
  const history = rawHistory.map(historyEntryFrom);
  const historyInputAccepted = Array.isArray(input.historicalSummaries ?? []) && history.every(Boolean);
  const rawCandidates = Array.isArray(input.candidates) ? input.candidates : [];
  const candidates = rawCandidates.map((value) => {
    const record = recordFrom(value);
    const dimensions = dimensionsFrom(record?.canonicalDimensions);
    return record
      && clean(record.policyVersion) === SUBJECT_PRACTICE_SCENARIO_BLUEPRINT_POLICY_VERSION
      && clean(record.status) === 'provisional_candidate'
      && clean(record.blueprintFingerprint)
      && clean(record.renameInvariantFingerprint)
      && dimensions
      ? {
          blueprintFingerprint: clean(record.blueprintFingerprint),
          renameInvariantFingerprint: clean(record.renameInvariantFingerprint),
          canonicalDimensions: dimensions
        }
      : null;
  });
  const candidateInputAccepted = Array.isArray(input.candidates ?? []) && candidates.every(Boolean) && candidates.length > 0;
  if (!historyInputAccepted || !candidateInputAccepted) {
    return {
      policyVersion: SUBJECT_PRACTICE_SCENARIO_BLUEPRINT_MEMORY_POLICY_VERSION,
      status: !historyInputAccepted ? 'rejected_history_input_not_structural_only' : 'rejected_candidate_input_invalid',
      historyInputAccepted,
      candidateInputAccepted,
      rankedCandidates: [],
      officialQuestionContentRequired: false,
      candidateQuestionContentRequired: false,
      productionGateImpact: 'none_shadow_only'
    };
  }
  const validHistory = history.filter((item): item is NonNullable<typeof item> => Boolean(item));
  const dimensionCounts = Object.fromEntries(DIMENSION_KEYS.map((key) => [key, {}])) as Record<string, Record<string, number>>;
  for (const item of validHistory) {
    for (const key of DIMENSION_KEYS) increment(dimensionCounts[key], item.canonicalDimensions[key]);
  }
  const exactFingerprints = new Set(validHistory.map((item) => item.blueprintFingerprint));
  const structureFingerprints = new Set(validHistory.map((item) => item.renameInvariantFingerprint));
  const rankedCandidates = candidates.filter((item): item is NonNullable<typeof item> => Boolean(item)).map((candidate) => {
    const exactDuplicate = exactFingerprints.has(candidate.blueprintFingerprint);
    const renameOnly = !exactDuplicate && structureFingerprints.has(candidate.renameInvariantFingerprint);
    const coverageScore = DIMENSION_KEYS.reduce((sum, key) =>
      sum + 1 / (1 + (dimensionCounts[key][candidate.canonicalDimensions[key]] ?? 0)), 0) / DIMENSION_KEYS.length;
    const relatedFailureCount = validHistory.filter((item) =>
      item.canonicalDimensions.scenarioDomain === candidate.canonicalDimensions.scenarioDomain
      && item.canonicalDimensions.scenarioAction === candidate.canonicalDimensions.scenarioAction
      && item.failureCodes.length > 0).length;
    const failurePenalty = Math.min(0.5, relatedFailureCount * 0.1);
    return {
      blueprintFingerprint: candidate.blueprintFingerprint,
      renameInvariantFingerprint: candidate.renameInvariantFingerprint,
      decision: exactDuplicate ? 'reject_exact_duplicate' : renameOnly ? 'reject_rename_only' : 'rankable_novel_candidate',
      coverageGapScore: Number(coverageScore.toFixed(6)),
      historicalFailurePenalty: Number(failurePenalty.toFixed(6)),
      rankingScore: exactDuplicate || renameOnly ? 0 : Number(Math.max(0, coverageScore - failurePenalty).toFixed(6)),
      canonicalDimensions: candidate.canonicalDimensions
    };
  }).sort((left, right) => right.rankingScore - left.rankingScore
    || left.blueprintFingerprint.localeCompare(right.blueprintFingerprint));
  return {
    policyVersion: SUBJECT_PRACTICE_SCENARIO_BLUEPRINT_MEMORY_POLICY_VERSION,
    status: 'ranked_shadow_only',
    historyInputAccepted: true,
    candidateInputAccepted: true,
    historicalSummaryCount: validHistory.length,
    rankedCandidates,
    selectionQuotaFrozen: false,
    suggestedSelection: rankedCandidates.find((item) => item.decision === 'rankable_novel_candidate')?.blueprintFingerprint ?? null,
    selectionAuthorizesGeneration: false,
    officialQuestionContentRequired: false,
    candidateQuestionContentRequired: false,
    historyFieldsUsed: ['fingerprints', 'canonical_dimensions', 'lifecycle_status', 'failure_reason_codes'],
    productionGateImpact: 'none_shadow_only'
  };
}

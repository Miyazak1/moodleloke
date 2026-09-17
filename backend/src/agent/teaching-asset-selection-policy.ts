import { createHash } from 'node:crypto';

export const TEACHING_ASSET_SELECTION_POLICY_VERSION = 'teaching-asset-selection-v1' as const;

export type TeachingAssetSelectionCandidate = {
  assetId: string;
  versionId: string;
  stableKey: string;
  estimatedMinutes: number;
  publishedAt: Date | null;
  userEvidence: {
    exposureCount: number;
    completedCount: number;
    skippedCount: number;
    lastExposedAt: Date | null;
    independentPassed: number;
    independentFailed: number;
    stable: number;
    notStable: number;
  };
  globalEvidence: {
    exposureContexts: number;
    uniqueLearners: number;
    completionRate: number | null;
    conclusiveOutcomes: number;
    verificationPassRate: number | null;
  };
};

export type TeachingAssetSelectionDecision = {
  policyVersion: typeof TEACHING_ASSET_SELECTION_POLICY_VERSION;
  selectedVersionId: string;
  selectedScore: number;
  reasonCodes: string[];
  candidateCount: number;
  eligibleCandidateCount: number;
  boundedExploration: boolean;
  candidates: Array<{
    stableKey: string;
    versionId: string;
    score: number;
    eligible: boolean;
    reasonCodes: string[];
  }>;
};

type SelectionInput = {
  userId: number;
  topicId: number;
  depth?: string | null;
  at?: Date;
  candidates: TeachingAssetSelectionCandidate[];
};

function explorationBucket(userId: number, topicId: number, at: Date) {
  const day = at.toISOString().slice(0, 10);
  const digest = createHash('sha256').update(`${userId}:${topicId}:${day}`).digest();
  return digest.readUInt16BE(0) % 100;
}

function depthFit(depth: string | null | undefined, minutes: number) {
  if (depth === 'brief') return minutes <= 4;
  if (depth === 'full') return minutes >= 10;
  if (depth === 'guided') return minutes >= 5 && minutes <= 9;
  return false;
}

export function selectTeachingAssetCandidate(input: SelectionInput): { candidate: TeachingAssetSelectionCandidate; decision: TeachingAssetSelectionDecision } | null {
  if (!input.candidates.length) return null;
  const at = input.at ?? new Date();
  const allowExploration = explorationBucket(input.userId, input.topicId, at) < 20;
  const hasEstablishedCandidate = input.candidates.some((candidate) =>
    candidate.globalEvidence.exposureContexts >= 10
    && candidate.globalEvidence.uniqueLearners >= 5
    && candidate.globalEvidence.conclusiveOutcomes >= 3
  );

  const ranked = input.candidates.map((candidate) => {
    let score = 0;
    const reasonCodes: string[] = [];
    const user = candidate.userEvidence;
    const global = candidate.globalEvidence;
    const avoidRepeat = user.independentFailed > 0 || user.notStable > 0 || user.skippedCount > 0;

    if (!user.exposureCount) { score += 35; reasonCodes.push('unseen_by_student'); }
    if (depthFit(input.depth, candidate.estimatedMinutes)) { score += 12; reasonCodes.push('depth_match'); }
    if (user.independentPassed > 0) { score -= 18; reasonCodes.push('prior_independent_passed'); }
    if (user.stable > 0) { score -= 30; reasonCodes.push('prior_stable'); }
    if (user.completedCount > 0) { score -= 8; reasonCodes.push('previously_completed'); }
    if (user.independentFailed > 0) { score -= 50; reasonCodes.push('prior_independent_failed'); }
    if (user.notStable > 0) { score -= 45; reasonCodes.push('prior_not_stable'); }
    if (user.skippedCount > 0) { score -= 20; reasonCodes.push('previously_skipped'); }
    if (user.lastExposedAt && at.getTime() - user.lastExposedAt.getTime() < 7 * 24 * 60 * 60 * 1000) {
      score -= 15; reasonCodes.push('recent_exposure');
    }

    const established = global.exposureContexts >= 10 && global.uniqueLearners >= 5 && global.conclusiveOutcomes >= 3;
    if (!established) {
      reasonCodes.push('insufficient_global_sample');
      if (hasEstablishedCandidate && allowExploration) { score += 25; reasonCodes.push('bounded_exploration'); }
      else if (hasEstablishedCandidate) score -= 12;
    } else if ((global.verificationPassRate ?? 0) >= 0.67 && (global.completionRate ?? 0) >= 0.5) {
      score += 20; reasonCodes.push('global_healthy');
    } else if ((global.verificationPassRate ?? 1) < 0.5 || (global.completionRate ?? 1) < 0.5) {
      score -= 35; reasonCodes.push('global_weak');
    } else {
      score += 4; reasonCodes.push('global_watch');
    }
    return { candidate, score, reasonCodes, avoidRepeat };
  });

  const alternatives = ranked.filter((item) => !item.avoidRepeat);
  if (!alternatives.length) return null;
  alternatives.sort((left, right) =>
    right.score - left.score
    || (right.candidate.publishedAt?.getTime() ?? 0) - (left.candidate.publishedAt?.getTime() ?? 0)
    || left.candidate.stableKey.localeCompare(right.candidate.stableKey)
    || left.candidate.versionId.localeCompare(right.candidate.versionId)
  );
  const selected = alternatives[0];
  if (ranked.some((item) => item.avoidRepeat)) selected.reasonCodes.push('alternate_after_ineffective_asset');
  const decision: TeachingAssetSelectionDecision = {
    policyVersion: TEACHING_ASSET_SELECTION_POLICY_VERSION,
    selectedVersionId: selected.candidate.versionId,
    selectedScore: selected.score,
    reasonCodes: [...new Set(selected.reasonCodes)],
    candidateCount: ranked.length,
    eligibleCandidateCount: alternatives.length,
    boundedExploration: selected.reasonCodes.includes('bounded_exploration'),
    candidates: ranked.map((item) => ({
      stableKey: item.candidate.stableKey,
      versionId: item.candidate.versionId,
      score: item.score,
      eligible: !item.avoidRepeat,
      reasonCodes: [...new Set(item.reasonCodes)]
    }))
  };
  return { candidate: selected.candidate, decision };
}

export type CandidateQuestionQueryFilter = {
  shouldLoad: boolean;
  status?: string;
  queue?: 'candidate';
};

const CANDIDATE_GOVERNANCE_STATUS_SET = new Set(['', 'pending_review', 'review_failed', 'fallback']);

export function candidateGovernanceStatusAllowsQuery(status: string) {
  return CANDIDATE_GOVERNANCE_STATUS_SET.has(status);
}

export function candidateQuestionQueryFilter(status: string): CandidateQuestionQueryFilter {
  if (!candidateGovernanceStatusAllowsQuery(status)) {
    return { shouldLoad: false };
  }
  if (!status) {
    return { shouldLoad: true, queue: 'candidate' };
  }
  return { shouldLoad: true, status, queue: 'candidate' };
}

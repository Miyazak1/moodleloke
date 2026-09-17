import { requestJson } from './request';
import type { AgentLearningSettings, AgentScoreGoal, AgentStudyAvailability, CscaReviewQueue, CscaWrongQuestionResponse, LearningDashboard, MyAICredits, OrganizationInviteAcceptResult, StudentProfile } from './api-types';

type AuthRequestOptions = RequestInit & {
  preserveAuthOnUnauthorized?: boolean;
};

const SOFT_AUTH_READ: AuthRequestOptions = { preserveAuthOnUnauthorized: true };

function authRequest<T>(path: string, options: AuthRequestOptions = {}) {
  return requestJson<T>(path, { ...options, withAuth: true });
}

export function getMyLearningDashboard(language?: string) {
  const query = language ? `?language=${encodeURIComponent(language)}` : '';
  return authRequest<LearningDashboard>(`/api/v1/me/learning-dashboard${query}`, SOFT_AUTH_READ);
}

export function recordMyReadinessActionClick(payload: {
  type: string;
  href: string;
  expectedGain?: number;
  priority?: string;
  rank?: number;
  stage?: string;
  score?: number;
  dimensions?: LearningDashboard['readiness']['dimensions'];
  source?: string;
}) {
  return authRequest<{ recorded: boolean }>('/api/v1/me/learning-dashboard/readiness-actions/click', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function getMyCscaReviewQueue(filters: { subject?: string; language?: string; limit?: number } = {}) {
  const query = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
  });
  const queryText = query.toString();
  return authRequest<CscaReviewQueue>(`/api/v1/me/csca/review-queue${queryText ? `?${queryText}` : ''}`, SOFT_AUTH_READ);
}

export function completeMyCscaReviewQueueItem(patternId: number) {
  return authRequest<{
    id: number;
    status: string;
    nextReviewAt: string | null;
    reviewCount: number;
    lastReviewCompletedAt: string | null;
    verificationStatus: 'not_started' | 'pending_verification' | 'verified_repaired';
    verificationRequired: boolean;
    verificationHref: string;
  }>(`/api/v1/me/csca/review-queue/${patternId}/complete`, {
    method: 'POST'
  });
}

export function completeMyCscaWrongQuestionReview(payload: {
  subject: string;
  topicId?: number | null;
  patternType: string;
  questionId: number;
  sourceType: string;
}) {
  return authRequest<{
    id: number;
    status: string;
    nextReviewAt: string | null;
    reviewCount: number;
    lastReviewCompletedAt: string | null;
    verificationStatus: 'not_started' | 'pending_verification' | 'verified_repaired';
    verificationRequired: boolean;
    verificationHref: string;
  }>('/api/v1/me/csca/wrong-questions/review-complete', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function getMyAICredits() {
  return authRequest<MyAICredits>('/api/v1/me/ai-credits', SOFT_AUTH_READ);
}

export function getMyStudentProfile() {
  return authRequest<StudentProfile>('/api/v1/me/student-profile', SOFT_AUTH_READ);
}

export type StudentProfileUpdate = Partial<Pick<StudentProfile,
  | 'nationality'
  | 'nationalityCode'
  | 'country'
  | 'countryCode'
  | 'grade'
  | 'gradeCode'
  | 'genderCode'
  | 'educationStageCode'
  | 'graduationYear'
  | 'targetExamDate'
  | 'targetSubjectCodes'
  | 'preferredQuestionLanguageCode'
  | 'examAttemptType'
  | 'weeklyGoalDays'
  | 'targetMajorCategoryCode'
  | 'currentOrganizationId'
>> & { onboardingAction?: 'complete' | 'skip' };

export function updateMyStudentProfile(payload: StudentProfileUpdate) {
  return authRequest<StudentProfile>('/api/v1/me/student-profile', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function getMyAgentLearningSettings() {
  return authRequest<AgentLearningSettings>('/api/v1/me/agent-learning-settings', SOFT_AUTH_READ);
}

export function updateMyAgentLearningPreference(payload: {
  schemaVersion: '1';
  defaultLearningMode: 'recommended' | 'free';
  defaultFreePracticeSubject: 'math' | 'physics' | 'chemistry';
  defaultFreePracticeCount: 3 | 5 | 10;
  expectedPreferenceVersion: string;
}) {
  return authRequest<AgentLearningSettings['learningPreference']>('/api/v1/me/agent-learning-preference', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function updateMyAgentScoreGoal(payload: {
  schemaVersion: '1';
  examSystemCode: 'csca';
  examBatchCode: string;
  examDate: string;
  subjectGoals: Array<{ subject: 'math' | 'physics' | 'chemistry'; targetScore: number; priority: number }>;
  expectedGoalVersion: string;
  expectedScoringPolicyVersion: string;
}) {
  return authRequest<AgentScoreGoal>('/api/v1/me/agent-score-goal', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function updateMyAgentStudyAvailability(payload: {
  schemaVersion: '1';
  timezone: string;
  weeklyMinutesGoal: number | null;
  preferredStudyDays: number[];
  defaultSessionMinutes: number | null;
  expectedAvailabilityVersion: string;
}) {
  return authRequest<AgentStudyAvailability>('/api/v1/me/agent-study-availability', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function acceptOrganizationInvite(token: string) {
  return authRequest<OrganizationInviteAcceptResult>('/api/v1/organizations/invites/accept', {
    method: 'POST',
    body: JSON.stringify({ token })
  });
}

export function acceptOrganizationInviteCode(code: string) {
  return authRequest<OrganizationInviteAcceptResult>('/api/v1/organizations/invites/accept-code', {
    method: 'POST',
    body: JSON.stringify({ code })
  });
}

export function getMyCscaWrongQuestions(filters: { subject?: string; module?: string; topicSlug?: string; knowledgeTag?: string; sourceType?: string; patternType?: string } = {}) {
  const query = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  const queryText = query.toString();
  return authRequest<CscaWrongQuestionResponse>(`/api/v1/me/csca/wrong-questions${queryText ? `?${queryText}` : ''}`, SOFT_AUTH_READ);
}

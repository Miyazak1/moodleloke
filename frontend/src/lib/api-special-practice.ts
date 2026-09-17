import { requestJson } from './request';
import type {
  AdaptiveAIFeedback,
  AdaptiveAIFeedbackReasonCode,
  AdaptiveAIEntitlement,
  AdaptiveAIInteraction,
  AdaptiveMasteryTopic,
  AdaptivePracticeCheckResult,
  AdaptiveRound,
  AdaptiveRoundDetail,
  AdaptiveRoundReport,
  AdaptiveSession,
  AdaptiveSessionDetail,
  AdaptiveTrainingOverview,
  HomeMiniMock,
  HomeMiniMockReport,
  SpecialPracticeCheckResult,
  SpecialPracticeOverview,
  SpecialPracticeReport,
  SpecialPracticeSession,
  SpecialPracticeSessionDetail,
  SpecialPracticeSessionHistory,
  SpecialPracticeStart,
  SpecialPracticeSubjectDetail,
  SpecialPracticeWrongQuestionItem
} from './api-types';

function adaptiveLanguageQuery(locale?: string) {
  if (!locale) return '';
  const language = locale === 'zh-CN' ? 'zh' : locale;
  return `?language=${encodeURIComponent(language)}`;
}

export function getSpecialPracticeOverview() {
  return requestJson<SpecialPracticeOverview>('/api/v1/csca-special-practice/overview');
}

export function getHomeMiniMock(payload: { language?: string; seed?: string } = {}) {
  const params = new URLSearchParams();
  if (payload.language) params.set('language', payload.language);
  if (payload.seed) params.set('seed', payload.seed);
  const query = params.toString();
  return requestJson<HomeMiniMock>(`/api/v1/csca-special-practice/home-mini-mock${query ? `?${query}` : ''}`);
}

export function scoreHomeMiniMock(payload: { questionIds: number[]; answers: Record<string, string>; language?: string }) {
  return requestJson<HomeMiniMockReport>('/api/v1/csca-special-practice/home-mini-mock/score', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function getAdaptivePracticeOverview(withAuth = false) {
  return requestJson<AdaptiveTrainingOverview>('/api/v1/csca-special-practice/adaptive/overview', { withAuth, preserveAuthOnUnauthorized: withAuth });
}

export function createAdaptivePracticeSession(payload: { subject: string; mode?: string; questionLanguage?: string }) {
  return requestJson<AdaptiveSession>('/api/v1/csca-special-practice/adaptive/sessions', {
    method: 'POST',
    body: JSON.stringify(payload),
    withAuth: true
  });
}

export function getAdaptivePracticeSession(id: string | number) {
  return requestJson<AdaptiveSessionDetail>(`/api/v1/csca-special-practice/adaptive/sessions/${encodeURIComponent(String(id))}`, { withAuth: true });
}

export function createAdaptivePracticeRound(
  sessionId: string | number,
  payload: {
    focusTopicId?: number;
    verification?: {
      reviewItemId?: number;
      patternType?: string;
      topicId?: number;
    };
  } = {}
) {
  return requestJson<AdaptiveRoundDetail>(`/api/v1/csca-special-practice/adaptive/sessions/${encodeURIComponent(String(sessionId))}/rounds`, {
    method: 'POST',
    body: JSON.stringify(payload),
    withAuth: true
  });
}

export function getAdaptivePracticeRound(roundId: string | number, locale?: string) {
  return requestJson<AdaptiveRoundDetail>(`/api/v1/csca-special-practice/adaptive/rounds/${encodeURIComponent(String(roundId))}${adaptiveLanguageQuery(locale)}`, { withAuth: true });
}

export function patchAdaptivePracticeRound(roundId: string | number, payload: { answers?: Record<string, string>; timeSpent?: Record<string, number>; currentQuestion?: number; expectedVersion?: number }) {
  return requestJson<AdaptiveRound>(`/api/v1/csca-special-practice/adaptive/rounds/${encodeURIComponent(String(roundId))}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
    withAuth: true
  });
}

export function checkAdaptivePracticeAnswer(roundId: string | number, payload: { questionId: number; selected: string; language?: string; questionLanguage?: string }) {
  return requestJson<AdaptivePracticeCheckResult>(`/api/v1/csca-special-practice/adaptive/rounds/${encodeURIComponent(String(roundId))}/check`, {
    method: 'POST',
    body: JSON.stringify(payload),
    withAuth: true
  });
}

export function submitAdaptivePracticeRound(roundId: string | number, locale?: string) {
  return requestJson<AdaptiveRoundReport>(`/api/v1/csca-special-practice/adaptive/rounds/${encodeURIComponent(String(roundId))}/submit${adaptiveLanguageQuery(locale)}`, {
    method: 'POST',
    withAuth: true
  });
}

export function getAdaptivePracticeRoundReport(roundId: string | number, locale?: string) {
  return requestJson<AdaptiveRoundReport>(`/api/v1/csca-special-practice/adaptive/rounds/${encodeURIComponent(String(roundId))}/report${adaptiveLanguageQuery(locale)}`, { withAuth: true });
}

export function completeAdaptiveConceptCard(roundId: string | number, cardId: string | number) {
  return requestJson<{ status: string; conceptCardId: number; roundId: number; completedAt: string }>(
    `/api/v1/csca-special-practice/adaptive/rounds/${encodeURIComponent(String(roundId))}/concept-cards/${encodeURIComponent(String(cardId))}/complete`,
    { method: 'POST', withAuth: true }
  );
}

export function getAdaptivePracticeMastery(subject?: string) {
  const query = subject ? `?subject=${encodeURIComponent(subject)}` : '';
  return requestJson<{ items: AdaptiveMasteryTopic[] }>(`/api/v1/csca-special-practice/adaptive/mastery${query}`, { withAuth: true });
}

export function getAdaptiveAIEntitlement() {
  return requestJson<AdaptiveAIEntitlement>('/api/v1/csca-special-practice/adaptive/ai/entitlement', { withAuth: true });
}

export function getAdaptiveAIHint(payload: { roundId?: number; questionId: number; language?: string; questionLanguage?: string }) {
  return requestJson<AdaptiveAIInteraction>('/api/v1/csca-special-practice/adaptive/ai/hint', {
    method: 'POST',
    body: JSON.stringify(payload),
    withAuth: true
  });
}

export function getAdaptiveAIExplanation(payload: { roundId?: number; questionId: number; selected?: string; language?: string; questionLanguage?: string }) {
  return requestJson<AdaptiveAIInteraction>('/api/v1/csca-special-practice/adaptive/ai/explain', {
    method: 'POST',
    body: JSON.stringify(payload),
    withAuth: true
  });
}

export function getAdaptiveAIRoundSummary(payload: { roundId: number; language?: string; questionLanguage?: string }) {
  return requestJson<AdaptiveAIInteraction>('/api/v1/csca-special-practice/adaptive/ai/round-summary', {
    method: 'POST',
    body: JSON.stringify(payload),
    withAuth: true
  });
}

export function submitAdaptiveAIFeedback(interactionId: number, payload: { rating: number; reason?: string; reasonCode?: AdaptiveAIFeedbackReasonCode }) {
  return requestJson<AdaptiveAIFeedback>(`/api/v1/csca-special-practice/adaptive/ai-interactions/${interactionId}/feedback`, {
    method: 'POST',
    body: JSON.stringify(payload),
    withAuth: true
  });
}

export function getSpecialPracticeSubject(subject: string) {
  return requestJson<SpecialPracticeSubjectDetail>(`/api/v1/csca-special-practice/subjects/${encodeURIComponent(subject)}`);
}

export function getSpecialPracticeStart(slug: string) {
  return requestJson<SpecialPracticeStart>(`/api/v1/csca-special-practice/topics/${encodeURIComponent(slug)}/start`);
}

export function createSpecialPracticeSession(slug: string, withAuth: boolean, language = 'zh') {
  return requestJson<SpecialPracticeSession>(`/api/v1/csca-special-practice/topics/${encodeURIComponent(slug)}/sessions`, {
    method: 'POST',
    body: JSON.stringify({ language }),
    withAuth
  });
}

export function getSpecialPracticeSession(id: string) {
  return requestJson<SpecialPracticeSessionDetail>(`/api/v1/csca-special-practice/sessions/${encodeURIComponent(id)}`);
}

export function patchSpecialPracticeSession(id: number, payload: { answers?: Record<string, string>; timeSpent?: Record<string, number>; currentQuestion?: number; expectedVersion?: number }) {
  return requestJson<SpecialPracticeSession>(`/api/v1/csca-special-practice/sessions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export function checkSpecialPracticeAnswer(id: number, payload: { questionId: number; selected: string }) {
  return requestJson<SpecialPracticeCheckResult>(`/api/v1/csca-special-practice/sessions/${id}/check`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function submitSpecialPracticeSession(id: number) {
  return requestJson<SpecialPracticeReport>(`/api/v1/csca-special-practice/sessions/${id}/submit`, { method: 'POST' });
}

export function getSpecialPracticeReport(id: string) {
  return requestJson<SpecialPracticeReport>(`/api/v1/csca-special-practice/sessions/${encodeURIComponent(id)}/report`);
}

export function getMySpecialPracticeSessions() {
  return requestJson<{ items: SpecialPracticeSessionHistory[] }>('/api/v1/csca-special-practice/my-sessions', { withAuth: true, preserveAuthOnUnauthorized: true });
}

export function getMySpecialPracticeWrongQuestions(filters: { subject?: string; module?: string; topicSlug?: string; knowledgeTag?: string } = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  const query = params.toString();
  return requestJson<{ items: SpecialPracticeWrongQuestionItem[] }>(`/api/v1/csca-special-practice/my-wrong-questions${query ? `?${query}` : ''}`, { withAuth: true, preserveAuthOnUnauthorized: true });
}

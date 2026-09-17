import type { MockExamAttempt, MockExamAttemptDetail, MockExamAttemptHistory, MockExamOverview, MockExamReport, MockExamStart, MockExamSubjectDetail } from './api-types';
import { requestJson, toQueryString } from './request';

export function getMockExamOverview(params: { locale?: string } = {}) {
  return requestJson<MockExamOverview>(`/api/v1/csca-mock-exam/overview${toQueryString(params)}`);
}

export function getMockExamSubject(subject: string, params: { locale?: string } = {}, withAuth = false) {
  return requestJson<MockExamSubjectDetail>(`/api/v1/csca-mock-exam/subjects/${encodeURIComponent(subject)}${toQueryString(params)}`, { withAuth, preserveAuthOnUnauthorized: withAuth });
}

export function getMockExamStart(slug: string, params: { locale?: string } = {}) {
  return requestJson<MockExamStart>(`/api/v1/csca-mock-exam/papers/${encodeURIComponent(slug)}/start${toQueryString(params)}`);
}

export function createMockExamAttempt(slug: string, withAuth: boolean, payload: { language?: string } = {}) {
  return requestJson<MockExamAttempt>(`/api/v1/csca-mock-exam/papers/${encodeURIComponent(slug)}/attempts`, {
    method: 'POST',
    withAuth,
    body: JSON.stringify(payload)
  });
}

export function getMyMockExamAttempts() {
  return requestJson<{ items: MockExamAttemptHistory[] }>('/api/v1/csca-mock-exam/my-attempts', { withAuth: true, preserveAuthOnUnauthorized: true });
}

export function getMockExamAttempt(id: string, params: { locale?: string } = {}) {
  return requestJson<MockExamAttemptDetail>(`/api/v1/csca-mock-exam/attempts/${encodeURIComponent(id)}${toQueryString(params)}`, { withAuth: true });
}

export function patchMockExamAttempt(id: number, payload: { answers?: Record<string, string>; markedQuestions?: number[]; timeSpent?: Record<string, number>; currentQuestion?: number; expectedVersion?: number }) {
  return requestJson<MockExamAttempt>(`/api/v1/csca-mock-exam/attempts/${id}`, {
    method: 'PATCH',
    withAuth: true,
    body: JSON.stringify(payload)
  });
}

export function submitMockExamAttempt(id: number) {
  return requestJson<MockExamReport>(`/api/v1/csca-mock-exam/attempts/${id}/submit`, {
    method: 'POST',
    withAuth: true,
    body: JSON.stringify({})
  });
}

export function getMockExamReport(id: string, params: { locale?: string } = {}) {
  return requestJson<MockExamReport>(`/api/v1/csca-mock-exam/attempts/${encodeURIComponent(id)}/report${toQueryString(params)}`, { withAuth: true });
}

import { API_BASE, readStoredToken, requestJson, toQueryString } from './request';
import type { AdminPastPaper, AdminResourceBundle, PastPaper, PastPaperDetail, PastPaperFile, PastPaperSourceDocument, ResourceBundle, ResourceBundleDetail } from './api-types';

export function getPastPapers(params: { subject?: string; category?: string; locale?: string } = {}) {
  return requestJson<{ items: PastPaper[] }>(`/api/v1/past-papers${toQueryString(params)}`);
}

export function getPastPaper(slug: string, params: { locale?: string } = {}) {
  return requestJson<PastPaperDetail>(`/api/v1/past-papers/${slug}${toQueryString(params)}`);
}

export function getResourceBundles(params: { subject?: string; category?: string; locale?: string } = {}) {
  return requestJson<{ items: ResourceBundle[] }>(`/api/v1/resource-bundles${toQueryString(params)}`);
}

export function getResourceBundle(slug: string, params: { locale?: string } = {}) {
  return requestJson<ResourceBundleDetail>(`/api/v1/resource-bundles/${slug}${toQueryString(params)}`);
}

export function downloadPastPaperFile(slug: string, fileId: number) {
  return requestJson<{ url: string; file: PastPaperFile; paper: PastPaper }>(`/api/v1/past-papers/${slug}/downloads/${fileId}`, {
    method: 'POST'
  });
}

export function getAdminPastPapers(params: { subject?: string; category?: string } = {}) {
  return requestJson<{ items: AdminPastPaper[]; summary: { total: number; published: number; draft: number } }>(`/api/v1/admin/past-papers${toQueryString(params)}`, { withAuth: true });
}

export function getAdminPastPaper(id: number) {
  return requestJson<PastPaperDetail>(`/api/v1/admin/past-papers/${id}`, { withAuth: true });
}

export function getAdminPastPaperSourceDocuments(subject?: string) {
  return requestJson<{ items: PastPaperSourceDocument[] }>(`/api/v1/admin/past-paper-source-documents${toQueryString({ subject })}`, { withAuth: true });
}

export function getAdminResourceBundles(params: { subject?: string; category?: string; status?: string } = {}) {
  return requestJson<{ items: AdminResourceBundle[]; summary: { total: number; published: number; draft: number } }>(`/api/v1/admin/resource-bundles${toQueryString(params)}`, { withAuth: true });
}

export function getAdminResourceBundle(id: number) {
  return requestJson<ResourceBundleDetail>(`/api/v1/admin/resource-bundles/${id}`, { withAuth: true });
}

export function createAdminResourceBundle(payload: Partial<AdminResourceBundle> & { slug: string; title: string; category: string; subjectScope: string }) {
  return requestJson<AdminResourceBundle>('/api/v1/admin/resource-bundles', {
    method: 'POST',
    body: JSON.stringify(payload),
    withAuth: true
  });
}

export function updateAdminResourceBundle(id: number, payload: Partial<AdminResourceBundle> & { expectedVersion?: number }) {
  return requestJson<AdminResourceBundle>(`/api/v1/admin/resource-bundles/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
    withAuth: true
  });
}

export function publishAdminResourceBundle(id: number, expectedVersion?: number) {
  return requestJson<AdminResourceBundle>(`/api/v1/admin/resource-bundles/${id}/publish`, {
    method: 'POST',
    body: JSON.stringify({ expectedVersion }),
    withAuth: true
  });
}

export function archiveAdminResourceBundle(id: number, expectedVersion?: number) {
  return requestJson<AdminResourceBundle>(`/api/v1/admin/resource-bundles/${id}/archive`, {
    method: 'POST',
    body: JSON.stringify({ expectedVersion }),
    withAuth: true
  });
}

export function createAdminResourceBundleItem(bundleId: number, payload: { pastPaperId: number; label?: string; sortOrder?: number }) {
  return requestJson<ResourceBundleDetail>(`/api/v1/admin/resource-bundles/${bundleId}/items`, {
    method: 'POST',
    body: JSON.stringify(payload),
    withAuth: true
  });
}

export function updateAdminResourceBundleItem(bundleId: number, itemId: number, payload: { label?: string; sortOrder?: number }) {
  return requestJson<ResourceBundleDetail>(`/api/v1/admin/resource-bundles/${bundleId}/items/${itemId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
    withAuth: true
  });
}

export function deleteAdminResourceBundleItem(bundleId: number, itemId: number) {
  return requestJson<ResourceBundleDetail>(`/api/v1/admin/resource-bundles/${bundleId}/items/${itemId}`, {
    method: 'DELETE',
    withAuth: true
  });
}

export function createAdminPastPaper(payload: Partial<AdminPastPaper> & { slug: string; title: string; subject: string }) {
  return requestJson<AdminPastPaper>('/api/v1/admin/past-papers', {
    method: 'POST',
    body: JSON.stringify(payload),
    withAuth: true
  });
}

export function updateAdminPastPaper(id: number, payload: Partial<AdminPastPaper> & { expectedVersion?: number }) {
  return requestJson<AdminPastPaper>(`/api/v1/admin/past-papers/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
    withAuth: true
  });
}

export function publishAdminPastPaper(id: number, expectedVersion?: number) {
  return requestJson<AdminPastPaper>(`/api/v1/admin/past-papers/${id}/publish`, {
    method: 'POST',
    body: JSON.stringify({ expectedVersion }),
    withAuth: true
  });
}

export function archiveAdminPastPaper(id: number, expectedVersion?: number) {
  return requestJson<AdminPastPaper>(`/api/v1/admin/past-papers/${id}/archive`, {
    method: 'POST',
    body: JSON.stringify({ expectedVersion }),
    withAuth: true
  });
}

export function createAdminPastPaperFile(paperId: number, payload: Partial<PastPaperFile> & { kind: string; label: string; fileUrl: string }) {
  return requestJson<PastPaperFile>(`/api/v1/admin/past-papers/${paperId}/files`, {
    method: 'POST',
    body: JSON.stringify(payload),
    withAuth: true
  });
}

export async function uploadAdminPastPaperFile(paperId: number, payload: { kind: string; label: string; file: File }) {
  const token = readStoredToken();
  if (!token) throw new Error('请先登录。');
  const form = new FormData();
  form.set('kind', payload.kind);
  form.set('label', payload.label);
  form.set('file', payload.file);
  const response = await fetch(`${API_BASE}/api/v1/admin/past-papers/${paperId}/files/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form
  });
  if (!response.ok) {
    let message = `Request failed: ${response.status}`;
    try {
      const body = (await response.json()) as { message?: string | string[] };
      message = Array.isArray(body.message) ? body.message.join('；') : body.message || message;
    } catch {
      // Keep HTTP fallback for non-JSON upload errors.
    }
    throw new Error(message);
  }
  return response.json() as Promise<PastPaperFile>;
}

export function updateAdminPastPaperFile(paperId: number, fileId: number, payload: Partial<PastPaperFile>) {
  return requestJson<PastPaperFile>(`/api/v1/admin/past-papers/${paperId}/files/${fileId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
    withAuth: true
  });
}

export function deleteAdminPastPaperFile(paperId: number, fileId: number) {
  return requestJson<{ deleted: boolean }>(`/api/v1/admin/past-papers/${paperId}/files/${fileId}`, {
    method: 'DELETE',
    withAuth: true
  });
}

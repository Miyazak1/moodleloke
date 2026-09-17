import { requestJson, toQueryString } from './request';
import type { PublicContentBlock } from './api-types';

export function getPublicContent(params: { locale?: string } = {}) {
  return requestJson<{ items: PublicContentBlock[] }>(`/api/v1/content/home${toQueryString(params)}`);
}

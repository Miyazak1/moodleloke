import type {
  AdminAIQuestioningMisconceptions,
  AdminAIQuestioningRemediation
} from '../../../lib/api-types';
import type { ConceptCardEditDraft, MisconceptionEditDraft } from './types';

export function misconceptionDraftFromItem(item: AdminAIQuestioningMisconceptions['items'][number]): MisconceptionEditDraft {
  return {
    label: item.label,
    description: item.description ?? ''
  };
}

export function conceptCardDraftFromItem(item: AdminAIQuestioningRemediation['items'][number]): ConceptCardEditDraft {
  return {
    title: item.title,
    body: item.body ?? '',
    note: ''
  };
}

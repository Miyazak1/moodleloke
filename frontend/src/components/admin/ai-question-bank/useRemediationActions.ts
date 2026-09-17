import type { Dispatch, SetStateAction } from 'react';
import {
  mergeAdminAIQuestioningMisconception,
  updateAdminAIQuestioningConceptCard,
  updateAdminAIQuestioningMisconception
} from '../../../lib/api-admin';
import type {
  AdminAIQuestioningMisconceptions,
  AdminAIQuestioningRemediation
} from '../../../lib/api-types';
import { conceptCardDraftFromItem, misconceptionDraftFromItem } from './remediationDrafts';
import type { AdminRunAction, ConceptCardEditDraft, MisconceptionEditDraft } from './types';

type UseRemediationActionsOptions = {
  runAction: AdminRunAction;
  setError: (value: string | null) => void;
  misconceptionDrafts: Record<number, MisconceptionEditDraft>;
  setMisconceptionDrafts: Dispatch<SetStateAction<Record<number, MisconceptionEditDraft>>>;
  misconceptionMergeTargets: Record<number, string>;
  setMisconceptionMergeTargets: Dispatch<SetStateAction<Record<number, string>>>;
  conceptCardDrafts: Record<number, ConceptCardEditDraft>;
  setConceptCardDrafts: Dispatch<SetStateAction<Record<number, ConceptCardEditDraft>>>;
};

export function useRemediationActions({
  runAction,
  setError,
  misconceptionDrafts,
  setMisconceptionDrafts,
  misconceptionMergeTargets,
  setMisconceptionMergeTargets,
  conceptCardDrafts,
  setConceptCardDrafts
}: UseRemediationActionsOptions) {
  function canManageConceptCard(item: AdminAIQuestioningRemediation['items'][number]) {
    return item.kind === 'concept_card' || item.kind === 'concept-card' || item.kind.includes('concept');
  }

  function updateMisconceptionDraft(misconceptionId: number, patch: Partial<MisconceptionEditDraft>) {
    setMisconceptionDrafts((drafts) => ({
      ...drafts,
      [misconceptionId]: { ...drafts[misconceptionId], ...patch }
    }));
  }

  function ensureMisconceptionDraft(item: AdminAIQuestioningMisconceptions['items'][number]) {
    setMisconceptionDrafts((drafts) => ({
      ...drafts,
      [item.id]: drafts[item.id] ?? misconceptionDraftFromItem(item)
    }));
  }

  async function saveMisconception(item: AdminAIQuestioningMisconceptions['items'][number]) {
    const draft = misconceptionDrafts[item.id] ?? misconceptionDraftFromItem(item);
    await runAction(`misconception-save-${item.id}`, `保存错因 #${item.id}`, async () => {
      await updateAdminAIQuestioningMisconception(item.id, {
        label: draft.label,
        description: draft.description
      });
      setMisconceptionDrafts((drafts) => {
        const next = { ...drafts };
        delete next[item.id];
        return next;
      });
    });
  }

  async function mergeMisconception(item: AdminAIQuestioningMisconceptions['items'][number]) {
    const targetId = Number(misconceptionMergeTargets[item.id]);
    if (!Number.isInteger(targetId) || targetId <= 0 || targetId === item.id) {
      setError('请输入有效的目标错因 ID。');
      return;
    }
    await runAction(`misconception-merge-${item.id}`, `合并错因 #${item.id}`, async () => {
      await mergeAdminAIQuestioningMisconception(item.id, {
        targetId,
        note: 'admin_merged_from_question_bank'
      });
      setMisconceptionMergeTargets((targets) => {
        const next = { ...targets };
        delete next[item.id];
        return next;
      });
    });
  }

  function updateConceptCardDraft(cardId: number, patch: Partial<ConceptCardEditDraft>) {
    setConceptCardDrafts((drafts) => ({
      ...drafts,
      [cardId]: { ...drafts[cardId], ...patch }
    }));
  }

  function ensureConceptCardDraft(item: AdminAIQuestioningRemediation['items'][number]) {
    setConceptCardDrafts((drafts) => ({
      ...drafts,
      [item.id]: drafts[item.id] ?? conceptCardDraftFromItem(item)
    }));
  }

  async function saveConceptCard(item: AdminAIQuestioningRemediation['items'][number]) {
    const draft = conceptCardDrafts[item.id] ?? conceptCardDraftFromItem(item);
    await runAction(`concept-card-save-${item.id}`, `保存概念卡 #${item.id}`, async () => {
      await updateAdminAIQuestioningConceptCard(item.id, {
        title: draft.title,
        body: draft.body,
        note: draft.note || 'admin_edited_from_question_bank'
      });
      setConceptCardDrafts((drafts) => {
        const next = { ...drafts };
        delete next[item.id];
        return next;
      });
    });
  }

  return {
    canManageConceptCard,
    updateMisconceptionDraft,
    ensureMisconceptionDraft,
    saveMisconception,
    mergeMisconception,
    updateConceptCardDraft,
    ensureConceptCardDraft,
    saveConceptCard
  };
}

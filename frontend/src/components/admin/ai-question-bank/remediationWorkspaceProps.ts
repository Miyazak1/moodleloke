import type { Dispatch, SetStateAction } from 'react';
import type {
  AdminAIQuestioningMisconceptions,
  AdminAIQuestioningRemediation
} from '../../../lib/api-types';
import type { RemediationWorkspaceProps } from './RemediationWorkspace';
import type {
  AdminRunAction,
  ConceptCardEditDraft,
  MisconceptionEditDraft
} from './types';

type RemediationActions = {
  reviewMisconception: (misconceptionId: number) => Promise<unknown>;
  createConceptCard: (misconceptionId: number) => Promise<unknown>;
  createVariant: (misconceptionId: number) => Promise<unknown>;
  ensureMisconceptionDraft: (item: AdminAIQuestioningMisconceptions['items'][number]) => void;
  updateMisconceptionDraft: (misconceptionId: number, patch: Partial<MisconceptionEditDraft>) => void;
  saveMisconception: (item: AdminAIQuestioningMisconceptions['items'][number]) => Promise<void>;
  archiveMisconception: (misconceptionId: number) => Promise<unknown>;
  restoreMisconception: (misconceptionId: number) => Promise<unknown>;
  mergeMisconception: (item: AdminAIQuestioningMisconceptions['items'][number]) => Promise<void>;
  canManageConceptCard: (item: AdminAIQuestioningRemediation['items'][number]) => boolean;
  ensureConceptCardDraft: (item: AdminAIQuestioningRemediation['items'][number]) => void;
  updateConceptCardDraft: (itemId: number, patch: Partial<ConceptCardEditDraft>) => void;
  saveConceptCard: (item: AdminAIQuestioningRemediation['items'][number]) => Promise<void>;
  publishConceptCard: (itemId: number) => Promise<unknown>;
  archiveConceptCard: (itemId: number) => Promise<unknown>;
};

type BuildRemediationWorkspacePropsParams = {
  misconceptions: AdminAIQuestioningMisconceptions;
  remediation: AdminAIQuestioningRemediation;
  isActionBusy: (actionId: string) => boolean;
  runAction: AdminRunAction;
  misconceptionDrafts: Record<number, MisconceptionEditDraft>;
  setMisconceptionDrafts: Dispatch<SetStateAction<Record<number, MisconceptionEditDraft>>>;
  misconceptionMergeTargets: Record<number, string>;
  setMisconceptionMergeTargets: Dispatch<SetStateAction<Record<number, string>>>;
  conceptCardDrafts: Record<number, ConceptCardEditDraft>;
  setConceptCardDrafts: Dispatch<SetStateAction<Record<number, ConceptCardEditDraft>>>;
  actions: RemediationActions;
};

export function buildRemediationWorkspaceProps({
  misconceptions,
  remediation,
  isActionBusy,
  runAction,
  misconceptionDrafts,
  setMisconceptionDrafts,
  misconceptionMergeTargets,
  setMisconceptionMergeTargets,
  conceptCardDrafts,
  setConceptCardDrafts,
  actions
}: BuildRemediationWorkspacePropsParams): RemediationWorkspaceProps {
  const cancelMisconceptionDraft = (misconceptionId: number) => {
    setMisconceptionDrafts((drafts) => {
      const next = { ...drafts };
      delete next[misconceptionId];
      return next;
    });
  };

  const updateMergeTarget = (misconceptionId: number, value: string) => {
    setMisconceptionMergeTargets((targets) => ({ ...targets, [misconceptionId]: value }));
  };

  const cancelConceptCardDraft = (itemId: number) => {
    setConceptCardDrafts((drafts) => {
      const next = { ...drafts };
      delete next[itemId];
      return next;
    });
  };

  return {
    governance: misconceptions.governance,
    isActionBusy,
    runAction,
    onReviewMisconception: actions.reviewMisconception,
    onCreateConceptCard: actions.createConceptCard,
    onCreateVariant: actions.createVariant,
    items: misconceptions.items,
    drafts: misconceptionDrafts,
    mergeTargets: misconceptionMergeTargets,
    onEnsureDraft: actions.ensureMisconceptionDraft,
    onUpdateDraft: actions.updateMisconceptionDraft,
    onCancelDraft: cancelMisconceptionDraft,
    onSave: actions.saveMisconception,
    onReview: actions.reviewMisconception,
    onArchive: actions.archiveMisconception,
    onRestore: actions.restoreMisconception,
    onMergeTargetChange: updateMergeTarget,
    onMerge: actions.mergeMisconception,
    remediation,
    conceptCardDrafts,
    canManageConceptCard: actions.canManageConceptCard,
    onEnsureConceptCardDraft: actions.ensureConceptCardDraft,
    onUpdateConceptCardDraft: actions.updateConceptCardDraft,
    onCancelConceptCardDraft: cancelConceptCardDraft,
    onSaveConceptCard: actions.saveConceptCard,
    onPublishConceptCard: actions.publishConceptCard,
    onArchiveConceptCard: actions.archiveConceptCard
  };
}

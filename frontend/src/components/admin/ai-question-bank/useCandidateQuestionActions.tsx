import { useMemo, useState } from 'react';
import type { AdminAIQuestioningQuestion } from '../../../lib/api-types';
import {
  approveAdminAIQuestioningQuestion,
  archiveAdminAIQuestioningQuestion,
  deleteAdminAIQuestioningGeneratedQuestion,
  getAdminAIQuestioningQuestion,
  rejectAdminAIQuestioningQuestion,
  reviewAdminAIQuestioningQuestion,
  updateAdminAIQuestioningQuestion
} from '../../../lib/api-admin';
import { CandidateQuestionEditor } from './CandidateQuestionEditor';
import { questionOptionsFromUnknown } from './questionData';
import { candidateAgentEvidence } from './questionEvidence';
import type { AdminRunAction, QuestionEditDraft } from './types';

type UseCandidateQuestionActionsParams = {
  candidates: AdminAIQuestioningQuestion[];
  runAction: AdminRunAction;
  isActionBusy: (id: string) => boolean;
  onRefresh: () => void;
};

function prettyJson(value: unknown, fallback: unknown) {
  return JSON.stringify(value ?? fallback, null, 2);
}

function editableQuestionOptions(value: unknown) {
  const options = questionOptionsFromUnknown(value);
  const fallbackIds = ['A', 'B', 'C', 'D'];
  const source = options.length ? options : fallbackIds.map((id) => ({ id, text: '' }));
  return source.map((option, index) => ({
    id: String(option.id || fallbackIds[index] || `O${index + 1}`).trim(),
    text: String(option.text ?? '')
  }));
}

function questionEditDraftFromQuestion(question: AdminAIQuestioningQuestion): QuestionEditDraft {
  const options = editableQuestionOptions(question.options);
  return {
    prompt: question.prompt,
    options,
    optionsJson: prettyJson(options, []),
    correctAnswer: question.correctAnswer,
    explanation: question.explanation,
    knowledgeTags: Array.isArray(question.knowledgeTags) ? question.knowledgeTags.map((tag) => String(tag)).join(', ') : '',
    optionMetadataJson: prettyJson(question.optionMetadata, []),
    note: ''
  };
}

export function useCandidateQuestionActions({
  candidates,
  runAction,
  isActionBusy,
  onRefresh
}: UseCandidateQuestionActionsParams) {
  const [editingQuestionId, setEditingQuestionId] = useState<number | null>(null);
  const [questionEditDrafts, setQuestionEditDrafts] = useState<Record<number, QuestionEditDraft>>({});
  const [questionDetails, setQuestionDetails] = useState<Record<number, AdminAIQuestioningQuestion>>({});

  const editingQuestion = useMemo(() => (
    editingQuestionId === null
      ? null
      : questionDetails[editingQuestionId] ?? candidates.find((question) => question.id === editingQuestionId) ?? null
  ), [candidates, editingQuestionId, questionDetails]);

  const editingDraft = editingQuestion
    ? questionEditDrafts[editingQuestion.id] ?? questionEditDraftFromQuestion(editingQuestion)
    : null;

  function openEditor(question: AdminAIQuestioningQuestion) {
    const existingDetail = questionDetails[question.id];
    const sourceQuestion = existingDetail ?? question;
    setQuestionEditDrafts((drafts) => ({
      ...drafts,
      [question.id]: drafts[question.id] ?? questionEditDraftFromQuestion(sourceQuestion)
    }));
    setEditingQuestionId(question.id);
    if (!existingDetail) {
      const initialDraft = questionEditDraftFromQuestion(question);
      void getAdminAIQuestioningQuestion(question.id)
        .then((detail) => {
          setQuestionDetails((details) => ({ ...details, [question.id]: detail }));
          setQuestionEditDrafts((drafts) => {
            const current = drafts[question.id];
            if (current && JSON.stringify(current) !== JSON.stringify(initialDraft)) return drafts;
            return { ...drafts, [question.id]: questionEditDraftFromQuestion(detail) };
          });
        })
        .catch(() => undefined);
    }
  }

  function cancelEditor() {
    setEditingQuestionId(null);
  }

  function updateDraft(questionId: number, patch: Partial<QuestionEditDraft>) {
    setQuestionEditDrafts((drafts) => ({
      ...drafts,
      [questionId]: { ...drafts[questionId], ...patch }
    }));
  }

  function updateOptionDraft(questionId: number, optionIndex: number, patch: Partial<{ id: string; text: string }>) {
    setQuestionEditDrafts((drafts) => {
      const current = drafts[questionId];
      if (!current) return drafts;
      const options = current.options.map((option, index) => index === optionIndex ? { ...option, ...patch } : option);
      return {
        ...drafts,
        [questionId]: {
          ...current,
          options,
          optionsJson: prettyJson(options, [])
        }
      };
    });
  }

  function updateOptionsJsonDraft(questionId: number, optionsJson: string) {
    setQuestionEditDrafts((drafts) => {
      const current = drafts[questionId];
      if (!current) return drafts;
      try {
        const parsed = JSON.parse(optionsJson);
        return {
          ...drafts,
          [questionId]: {
            ...current,
            options: editableQuestionOptions(parsed),
            optionsJson
          }
        };
      } catch {
        return {
          ...drafts,
          [questionId]: {
            ...current,
            optionsJson
          }
        };
      }
    });
  }

  async function saveEdit(question: AdminAIQuestioningQuestion) {
    const draft = questionEditDrafts[question.id] ?? questionEditDraftFromQuestion(question);
    await runAction(`candidate-edit-${question.id}`, `保存 Q${question.id}`, async () => {
      const options = draft.options
        .map((option) => ({ id: option.id.trim(), text: option.text.trim() }))
        .filter((option) => option.id && option.text);
      const optionMetadata = draft.optionMetadataJson.trim()
        ? JSON.parse(draft.optionMetadataJson) as Array<{ optionId: string; distractorIntent?: string; misconceptionTags?: string[] }>
        : [];
      await updateAdminAIQuestioningQuestion(question.id, {
        prompt: draft.prompt,
        options,
        correctAnswer: draft.correctAnswer,
        explanation: draft.explanation,
        knowledgeTags: draft.knowledgeTags.split(/[,，\n]/).map((tag) => tag.trim()).filter(Boolean),
        optionMetadata,
        note: draft.note || 'admin_manual_fix_from_question_bank'
      });
      setEditingQuestionId(null);
      setQuestionEditDrafts((drafts) => {
        const next = { ...drafts };
        delete next[question.id];
        return next;
      });
    }, { refresh: onRefresh });
  }

  function review(question: AdminAIQuestioningQuestion, actionId: string) {
    return runAction(actionId, `复审 Q${question.id}`, () => reviewAdminAIQuestioningQuestion(question.id), { refresh: onRefresh });
  }

  function approve(question: AdminAIQuestioningQuestion, actionId: string) {
    const allowHumanReview = ['human_review', 'quality_attention'].includes(candidateAgentEvidence(question).gate.decision);
    return runAction(actionId, `通过 Q${question.id}`, () => approveAdminAIQuestioningQuestion(question.id, {
      allowHumanReview
    }), { refresh: onRefresh });
  }

  function reject(question: AdminAIQuestioningQuestion, actionId: string) {
    return runAction(actionId, `拒绝 Q${question.id}`, () => rejectAdminAIQuestioningQuestion(question.id, {
      reason: 'admin_rejected_from_question_bank'
    }), { refresh: onRefresh });
  }

  function archive(question: AdminAIQuestioningQuestion, actionId: string) {
    return runAction(actionId, `归档 Q${question.id}`, () => archiveAdminAIQuestioningQuestion(question.id), { refresh: onRefresh });
  }

  function deleteGenerated(question: AdminAIQuestioningQuestion, actionId: string) {
    const confirmed = window.confirm(`确定删除 AI 生成题 Q${question.id} 吗？这会同时删除它的生成任务、曝光记录，以及已入库 AI 专项题映射；不会删除大纲、真题画像或手工题。`);
    if (!confirmed) return Promise.resolve();
    return runAction(actionId, `删除生成题 Q${question.id}`, () => deleteAdminAIQuestioningGeneratedQuestion(question.id), { refresh: onRefresh });
  }

  function renderEditor(question: AdminAIQuestioningQuestion, draft: QuestionEditDraft) {
    return (
      <CandidateQuestionEditor
        question={question}
        draft={draft}
        saveActionBusy={isActionBusy(`candidate-edit-${question.id}`)}
        onCancel={cancelEditor}
        onSave={() => void saveEdit(question)}
        onUpdateDraft={(patch) => updateDraft(question.id, patch)}
        onUpdateOption={(optionIndex, patch) => updateOptionDraft(question.id, optionIndex, patch)}
        onUpdateOptionsJson={(optionsJson) => updateOptionsJsonDraft(question.id, optionsJson)}
      />
    );
  }

  return {
    editingQuestionId,
    editingDraft,
    openEditor,
    review,
    approve,
    reject,
    archive,
    deleteGenerated,
    renderEditor
  };
}

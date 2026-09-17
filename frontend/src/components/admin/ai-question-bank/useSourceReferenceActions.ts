import type { Dispatch, SetStateAction } from 'react';
import {
  activateAdminAIQuestioningExamSeriesProfile,
  activateAdminAIQuestioningGenerationProfile,
  cleanupAdminAIQuestioningSourceDocuments,
  deleteAdminAIQuestioningSourceDocument,
  generateAdminAIQuestioningExamSeriesProfile,
  generateAdminAIQuestioningGenerationProfile,
  generateAdminAIQuestioningStyleProfile,
  getAdminAIQuestioningSourceDocumentProfileVisualization,
  importAdminAIQuestioningSourceDocument,
  reprocessAdminAIQuestioningSourceDocument,
  refreshAdminAIQuestioningQuestionVersionGovernance,
  startAdminAIQuestioningSourceProfilePipelineRebuild,
  startAdminAIQuestioningSourceAutoProfileTask,
  startAdminAIQuestioningSourceTopicTask
} from '../../../lib/api-admin';
import type { AdminAIQuestioningSourceDocumentCleanupResult } from '../../../lib/api-types';
import type { SourceImportMessage } from './SourceImportPanel';
import type { AdminRunAction, QuestionBankState } from './types';
import { compactError } from './pageUtils';
import { validateSourceReferencePayload } from './sourceReferenceImport';

type UseSourceReferenceActionsParams = {
  subject: string;
  sourceImportJson: string;
  sourceQuestionDocumentId: number | null;
  sourceQuestionReviewStatus: string;
  setSourceImportJson: Dispatch<SetStateAction<string>>;
  setSourceImportMessage: Dispatch<SetStateAction<SourceImportMessage | null>>;
  setSourceQuestionDocumentId: Dispatch<SetStateAction<number | null>>;
  setSourceQuestionPage: Dispatch<SetStateAction<number>>;
  setSourceQuestionReviewStatus: Dispatch<SetStateAction<string>>;
  setData: Dispatch<SetStateAction<QuestionBankState>>;
  setBusyActions: Dispatch<SetStateAction<Set<string>>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setFeedback: Dispatch<SetStateAction<string | null>>;
  onRefresh: (overrides?: { documentId?: number | null; reviewStatus?: string; page?: number }) => void;
  runAction: AdminRunAction;
};

function sourceDocumentCleanupRebuildHint(cleanup?: AdminAIQuestioningSourceDocumentCleanupResult | null) {
  const rebuildPipelines = Array.isArray(cleanup?.rebuildPipelines) ? cleanup.rebuildPipelines : [];
  const started = rebuildPipelines.filter((pipeline) => pipeline.task).length;
  if (started > 0) return `已自动启动 ${started} 个画像重建任务。`;
  if (cleanup && (cleanup.deletedSourceDocuments ?? 0) > 0) return '当前范围没有剩余 active 真题源卷，重新上传后会自动重建画像。';
  return '';
}

export function useSourceReferenceActions({
  subject,
  sourceImportJson,
  sourceQuestionDocumentId,
  sourceQuestionReviewStatus,
  setSourceImportJson,
  setSourceImportMessage,
  setSourceQuestionDocumentId,
  setSourceQuestionPage,
  setSourceQuestionReviewStatus,
  setData,
  setBusyActions,
  setError,
  setFeedback,
  onRefresh,
  runAction
}: UseSourceReferenceActionsParams) {
  function versionGovernanceSummaryText(result: { updated?: number; summary?: Record<string, number>; error?: string }) {
    if (result.error) return `版本治理未完成：${result.error}`;
    const summary = Object.entries(result.summary ?? {})
      .map(([key, value]) => `${key} ${value}`)
      .join(' / ');
    return `版本治理已重算 ${result.updated ?? 0} 道题${summary ? `：${summary}` : ''}`;
  }

  function parseSourceImportJson() {
    const parsed = JSON.parse(sourceImportJson) as unknown;
    const validation = validateSourceReferencePayload(parsed);
    const questionCount = Array.isArray((parsed as { questions?: unknown }).questions) ? (parsed as { questions: unknown[] }).questions.length : 0;
    return { parsed, validation, questionCount };
  }

  async function importParsedSourceReferencePayload(parsed: unknown, questionCount: number) {
    const actionId = 'source-reference-import';
    setBusyActions((current) => new Set(current).add(actionId));
    try {
      const payload = parsed as { document?: Record<string, unknown>; questions?: Array<Record<string, unknown>> };
      const result = await importAdminAIQuestioningSourceDocument({
        document: payload.document ?? {},
        questions: payload.questions ?? []
      });
      setSourceImportJson('');
      const taskHint = result.autoProfileTask
        ? `已创建自动画像任务 ${result.autoProfileTask.id.slice(0, 8)}，系统会自动映射、筛选、纳入、重试，并在通过样本出现后刷新画像。`
        : result.autoProfileTaskError
          ? `导入已完成，但自动画像任务暂未启动：${result.autoProfileTaskError}`
          : '导入已完成；非 active 文档不会自动进入画像流水线。';
      setSourceImportMessage({
        tone: result.autoProfileTaskError ? 'warning' : 'success',
        title: `已导入 ${questionCount} 道真题样本`,
        details: [taskHint]
      });
      setSourceQuestionDocumentId(result.document.id);
      setSourceQuestionPage(0);
      setSourceQuestionReviewStatus('');
      setFeedback(result.autoProfileTask ? '导入完成，自动画像流水线已启动。' : '导入真题参考 JSON 已完成。');
      onRefresh({ documentId: result.document.id, reviewStatus: '', page: 0 });
    } catch (nextError) {
      setSourceImportMessage({
        tone: 'error',
        title: '导入真题 JSON 失败',
        details: [compactError(nextError)]
      });
    } finally {
      setBusyActions((current) => {
        const next = new Set(current);
        next.delete(actionId);
        return next;
      });
    }
  }

  async function importSourceReferenceJson() {
    setError(null);
    setFeedback(null);
    setSourceImportMessage(null);
    let parsed: unknown;
    let questionCount = 0;
    try {
      const result = parseSourceImportJson();
      parsed = result.parsed;
      questionCount = result.questionCount;
      if (result.validation.errors.length > 0) {
        setSourceImportMessage({
          tone: 'error',
          title: '真题 JSON 还不能导入',
          details: result.validation.errors.slice(0, 8)
        });
        return;
      }
      if (result.validation.warnings.length > 0) {
        setSourceImportMessage({
          tone: 'warning',
          title: `JSON 结构可导入，${result.validation.warnings.length} 条提醒`,
          details: result.validation.warnings.slice(0, 6)
        });
      }
    } catch (nextError) {
      setSourceImportMessage({
        tone: 'error',
        title: '真题 JSON 解析失败',
          details: [compactError(nextError)]
      });
      return;
    }

    await importParsedSourceReferencePayload(parsed, questionCount);
  }

  function validateSourceImportJson() {
    setError(null);
    setFeedback(null);
    setSourceImportMessage(null);
    try {
      const { validation, questionCount } = parseSourceImportJson();
      if (validation.errors.length > 0) {
        setSourceImportMessage({
          tone: 'error',
          title: '真题 JSON 校验失败',
          details: validation.errors.slice(0, 8)
        });
        return;
      }
      setSourceImportMessage({
        tone: validation.warnings.length > 0 ? 'warning' : 'success',
        title: validation.warnings.length > 0 ? `JSON 可导入，${validation.warnings.length} 条提醒` : `JSON 可导入：${questionCount} 道题`,
        details: validation.warnings.slice(0, 8)
      });
    } catch (nextError) {
      setSourceImportMessage({
        tone: 'error',
        title: '真题 JSON 解析失败',
        details: [compactError(nextError)]
      });
    }
  }

  async function loadSourceImportJsonFile(file: File) {
    setError(null);
    setFeedback(null);
    setSourceImportMessage(null);
    if (!file.name.toLowerCase().endsWith('.json')) {
      setSourceImportMessage({
        tone: 'error',
        title: '请选择 JSON 文件',
        details: ['当前只支持 .json 文件。']
      });
      return;
    }
    try {
      const text = await file.text();
      setSourceImportJson(text);
      const parsed = JSON.parse(text) as unknown;
      const validation = validateSourceReferencePayload(parsed);
      const questionCount = Array.isArray((parsed as { questions?: unknown }).questions) ? (parsed as { questions: unknown[] }).questions.length : 0;
      if (validation.errors.length > 0) {
        setSourceImportMessage({
          tone: 'error',
          title: '文件已读取，但 JSON 还不能导入',
          details: validation.errors.slice(0, 8)
        });
        return;
      }
      setSourceImportMessage({
        tone: validation.warnings.length > 0 ? 'warning' : 'success',
        title: validation.warnings.length > 0 ? `文件可导入，${validation.warnings.length} 条提醒；正在自动导入` : `文件已读取：${questionCount} 道题，正在自动导入`,
        details: validation.warnings.slice(0, 8)
      });
      await importParsedSourceReferencePayload(parsed, questionCount);
    } catch (nextError) {
      setSourceImportJson('');
      setSourceImportMessage({
        tone: 'error',
        title: '读取 JSON 文件失败',
        details: [compactError(nextError)]
      });
    }
  }

  async function generateCurrentStyleProfile() {
    if (!subject) {
      setError('生成真题画像前，请先在治理范围里选择一个具体学科。');
      return;
    }
    await runAction(`style-profile-${subject}`, `${subject} 真题画像生成`, () => generateAdminAIQuestioningStyleProfile({
      subject,
      syllabusVersion: '2025',
      scopeType: 'subject'
    }), { refresh: () => onRefresh() });
  }

  async function generateCurrentExamSeriesProfile() {
    if (!subject) {
      setError('生成连续趋势画像前，请先在治理范围里选择一个具体学科。');
      return;
    }
    await runAction(`exam-series-profile-${subject}`, `${subject} 连续趋势画像生成`, async () => {
      const result = await generateAdminAIQuestioningExamSeriesProfile({
        subject,
        syllabusVersion: '2025'
      });
      return `已生成连续趋势画像 #${result.profile.id}，样本 ${result.profile.sampleSize}，置信度 ${result.profile.confidence}。`;
    }, { refresh: () => onRefresh() });
  }

  async function generateCurrentGenerationProfiles() {
    if (!subject) {
      setError('生成当前出题画像前，请先在治理范围里选择一个具体学科。');
      return;
    }
    await runAction(`generation-profile-${subject}`, `${subject} 当前出题画像生成`, async () => {
      const [subjectPractice, onlineMock] = await Promise.all([
        generateAdminAIQuestioningGenerationProfile({
          subject,
          syllabusVersion: '2025',
          useCase: 'subject_practice'
        }),
        generateAdminAIQuestioningGenerationProfile({
          subject,
          syllabusVersion: '2025',
          useCase: 'online_mock_exam'
        })
      ]);
      return `已生成当前出题画像：科目训练 #${subjectPractice.profile.id}，在线模考 #${onlineMock.profile.id}。${versionGovernanceSummaryText(subjectPractice.versionGovernance ?? {})}；${versionGovernanceSummaryText(onlineMock.versionGovernance ?? {})}。`;
    }, { refresh: () => onRefresh() });
  }

  async function activateExamSeriesProfile(profileId: number) {
    if (!Number.isInteger(profileId) || profileId <= 0) {
      setError('连续趋势画像 ID 无效。');
      return;
    }
    await runAction(`exam-series-profile-activate-${profileId}`, `激活连续趋势画像 #${profileId}`, async () => {
      const result = await activateAdminAIQuestioningExamSeriesProfile(profileId);
      return `已激活连续趋势画像 #${result.profile.id}。`;
    }, { refresh: () => onRefresh() });
  }

  async function activateGenerationProfile(profileId: number) {
    if (!Number.isInteger(profileId) || profileId <= 0) {
      setError('当前出题画像 ID 无效。');
      return;
    }
    await runAction(`generation-profile-activate-${profileId}`, `激活当前出题画像 #${profileId}`, async () => {
      const result = await activateAdminAIQuestioningGenerationProfile(profileId);
      return `已激活${result.profile.useCase === 'online_mock_exam' ? '在线模考' : '科目训练'}当前出题画像 #${result.profile.id}。${versionGovernanceSummaryText(result.versionGovernance ?? {})}。`;
    }, { refresh: () => onRefresh() });
  }

  async function refreshQuestionVersionGovernance() {
    if (!subject) {
      setError('运行题目版本治理前，请先在治理范围里选择一个具体学科。');
      return;
    }
    await runAction(`question-version-governance-${subject}`, `${subject} 题目版本治理`, async () => {
      const result = await refreshAdminAIQuestioningQuestionVersionGovernance({
        subject,
        limit: 5000
      });
      return versionGovernanceSummaryText(result);
    }, { refresh: () => onRefresh() });
  }

  async function startAutoProfileSourceQuestions() {
    if (!subject) {
      setError('重新运行自动画像前，请先在治理范围里选择一个具体学科。');
      return;
    }
    await runAction('source-question-auto-profile', `${subject} 重新运行自动画像`, async () => {
      const result = await startAdminAIQuestioningSourceAutoProfileTask({
        action: 'auto_profile_filtered',
        subject,
        documentId: sourceQuestionDocumentId ?? undefined,
        syllabusVersion: '2025',
        limit: 500,
        autoRefreshStyleProfile: true,
        autoRetry: true
      });
      return `已创建自动画像维护任务 ${result.task.id.slice(0, 8)}，系统会连续处理当前范围内全部待画像样本，完成后自动刷新画像并排队重试临时失败样本。`;
    }, { refresh: () => onRefresh() });
  }

  async function retryAutoProfileSourceQuestions() {
    if (!subject) {
      setError('重试自动画像样本前，请先在治理范围里选择一个具体学科。');
      return;
    }
    await runAction('source-question-auto-profile-retry', `${subject} 重试自动画像失败样本`, async () => {
      const result = await startAdminAIQuestioningSourceAutoProfileTask({
        action: 'retry_failed_samples',
        subject,
        documentId: sourceQuestionDocumentId ?? undefined,
        syllabusVersion: '2025',
        limit: 100,
        autoRefreshStyleProfile: true,
        autoRetry: true
      });
      return `已创建自动画像重试任务 ${result.task.id.slice(0, 8)}，系统会连续重试当前范围内全部临时失败样本，完成后自动刷新画像；仍临时失败的样本会按次数继续排队。`;
    }, { refresh: () => onRefresh() });
  }

  async function autoMapAndApproveSourceQuestionsForProfile() {
    if (!subject) {
      setError('自动映射并确认可用前，请先在治理范围里选择一个具体学科。');
      return;
    }
    await runAction('source-question-topic-auto-profile', `${subject} 真题样本自动映射并确认可用`, async () => {
      const result = await startAdminAIQuestioningSourceTopicTask({
        action: 'auto_map_profile',
        subject,
        documentId: sourceQuestionDocumentId ?? undefined,
        reviewStatus: sourceQuestionReviewStatus || undefined,
        onlyUnmapped: true,
        limit: 100,
        applyLimit: 500,
        minConfidence: 0.88,
        approveAfterApply: true
      });
      return `已创建自动映射入画像任务 ${result.task.id.slice(0, 8)}，系统会连续处理当前范围内全部未映射样本，并自动纳入高置信结果。`;
    }, { refresh: () => onRefresh() });
  }

  async function reprocessSourceDocument(documentId: number, documentSubject?: string) {
    const effectiveSubject = documentSubject || subject;
    if (!effectiveSubject) {
      setError('重新解析映射真题文档前，无法识别这份文档的学科。请先刷新来源文档列表。');
      return;
    }
    setSourceQuestionDocumentId(documentId);
    setSourceQuestionPage(0);
    setSourceQuestionReviewStatus('');
    await runAction(`source-document-reprocess-${documentId}`, `${effectiveSubject} 真题文档重新解析映射`, async () => {
      const result = await reprocessAdminAIQuestioningSourceDocument(documentId, {
        syllabusVersion: '2025'
      });
      const taskHint = result.autoProfileTask
        ? `已重置 ${result.resetQuestions} 道样本，并创建自动画像任务 ${result.autoProfileTask.id.slice(0, 8)}。`
        : `已重置 ${result.resetQuestions} 道样本；没有可重新处理的样本。`;
      return `${taskHint} 系统会按升级后的画像维度重新解析、映射并刷新画像。`;
    }, { refresh: () => onRefresh({ documentId, reviewStatus: '', page: 0 }) });
  }

  async function deleteSourceDocument(documentId: number, documentTitle?: string) {
    if (!Number.isInteger(documentId) || documentId <= 0) {
      setError('源卷 ID 无效，无法删除。');
      return;
    }
    const confirmed = window.confirm(`确认删除这份真题源卷吗？\n\n${documentTitle ?? `源卷 #${documentId}`}\n\n删除后会同步归档相关单卷画像、连续趋势画像和当前出题画像；如果同学科同大纲还有剩余 active 真题源卷，系统会自动重建画像。`);
    if (!confirmed) return;
    await runAction(`source-document-delete-${documentId}`, `删除源卷 #${documentId}`, async () => {
      const result = await deleteAdminAIQuestioningSourceDocument(documentId);
      if (sourceQuestionDocumentId === documentId) {
        setSourceQuestionDocumentId(null);
        setSourceQuestionPage(0);
        setSourceQuestionReviewStatus('');
      }
      setData((current) => {
        const nextVisualizations = { ...current.sourceDocumentProfileVisualizations };
        delete nextVisualizations[documentId];
        return {
          ...current,
          sourceDocumentProfileVisualizations: nextVisualizations
        };
      });
      const rebuildHint = sourceDocumentCleanupRebuildHint(result.cleanup);
      return `已删除源卷 #${result.document.id}，同步清理 ${result.cleanup.sourceQuestions ?? 0} 道源题，并归档相关画像。${rebuildHint ? ` ${rebuildHint}` : ''}`;
    }, { refresh: () => onRefresh({ documentId: null, reviewStatus: '', page: 0 }) });
  }

  async function cleanupCurrentSubjectSourceDocuments() {
    if (!subject) {
      setError('清理本学科真题源前，请先在治理范围里选择一个具体学科。');
      return;
    }
    await runAction(`source-documents-cleanup-${subject}`, `${subject} 真题源清理`, async () => {
      const preview = await cleanupAdminAIQuestioningSourceDocuments({
        subject,
        sourceType: 'past_paper',
        dryRun: true
      });
      const selected = preview.selected ?? {};
      const sourceDocuments = selected.sourceDocuments ?? 0;
      if (sourceDocuments <= 0) return '当前学科没有可清理的真题源文档。';
      const confirmed = window.confirm(
        `确认清理 ${subject} 的全部 past_paper 真题源吗？\n\n` +
        `将删除源卷：${sourceDocuments} 份\n` +
        `将删除源题：${selected.sourceQuestions ?? 0} 道\n` +
        `将归档单卷画像：${selected.styleProfiles ?? 0} 个\n` +
        `将归档连续趋势画像：${selected.examSeriesProfiles ?? 0} 个\n` +
        `将归档当前出题画像：${selected.generationProfiles ?? 0} 个\n\n` +
        '正式题库不会被删除；如果清理后还有剩余 active 真题源卷，系统会自动重建画像，否则需要重新上传真题。'
      );
      if (!confirmed) return '已取消清理真题源。';
      const result = await cleanupAdminAIQuestioningSourceDocuments({
        subject,
        sourceType: 'past_paper',
        confirmText: preview.expectedConfirmText
      });
      setSourceQuestionDocumentId(null);
      setSourceQuestionPage(0);
      setSourceQuestionReviewStatus('');
      setData((current) => ({
        ...current,
        sourceDocumentProfileVisualizations: {}
      }));
      const rebuildHint = sourceDocumentCleanupRebuildHint(result.cleanup);
      return `已清理 ${subject} 真题源：删除 ${result.cleanup?.deletedSourceDocuments ?? 0} 份源卷、${result.cleanup?.sourceQuestions ?? 0} 道源题，并归档相关画像。${rebuildHint ? ` ${rebuildHint}` : ''}`;
    }, { refresh: () => onRefresh({ documentId: null, reviewStatus: '', page: 0 }) });
  }

  async function rebuildSourceProfilePipeline() {
    if (!subject) {
      setError('重跑画像流水线前，请先在治理范围里选择一个具体学科。');
      return;
    }
    await runAction(`source-profile-pipeline-rebuild-${subject}`, `${subject} 连续趋势画像流水线重跑`, async () => {
      const result = await startAdminAIQuestioningSourceProfilePipelineRebuild({
        subject,
        syllabusVersion: '2025'
      });
      if (result.task) {
        return `已创建或接入画像流水线任务 ${result.task.id.slice(0, 8)}，系统会重新检查单卷画像、连续趋势画像、出题画像和版本治理。`;
      }
      return `画像流水线未创建：${result.skipped ?? '已有运行中的任务或当前条件不满足'}。`;
    }, { refresh: () => onRefresh() });
  }

  async function loadSourceDocumentProfileVisualization(documentId: number) {
    if (!Number.isInteger(documentId) || documentId <= 0) {
      setError('源卷 ID 无效，无法加载画像图表。');
      return;
    }
    const actionId = `source-document-visualization-${documentId}`;
    setBusyActions((current) => new Set(current).add(actionId));
    setError(null);
    try {
      const visualization = await getAdminAIQuestioningSourceDocumentProfileVisualization(documentId);
      setData((current) => ({
        ...current,
        sourceDocumentProfileVisualizations: {
          ...current.sourceDocumentProfileVisualizations,
          [documentId]: visualization
        }
      }));
      setFeedback(`已加载源卷 #${documentId} 的画像图表。`);
    } catch (nextError) {
      setError(`源卷画像图表加载失败：${compactError(nextError)}`);
    } finally {
      setBusyActions((current) => {
        const next = new Set(current);
        next.delete(actionId);
        return next;
      });
    }
  }

  return {
    parseSourceImportJson,
    importSourceReferenceJson,
    validateSourceImportJson,
    loadSourceImportJsonFile,
    generateCurrentStyleProfile,
    generateCurrentExamSeriesProfile,
    generateCurrentGenerationProfiles,
    refreshQuestionVersionGovernance,
    activateExamSeriesProfile,
    activateGenerationProfile,
    startAutoProfileSourceQuestions,
    retryAutoProfileSourceQuestions,
    autoMapAndApproveSourceQuestionsForProfile,
    reprocessSourceDocument,
    deleteSourceDocument,
    cleanupCurrentSubjectSourceDocuments,
    rebuildSourceProfilePipeline,
    loadSourceDocumentProfileVisualization
  };
}

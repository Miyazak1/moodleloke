import { useEffect, useMemo, useState, type RefObject } from 'react';
import {
  AdminActionBar,
  AdminOperationStatus,
  AdminPanel,
  AdminPanelHeader
} from '../AdminWorkbench';
import type {
  AdminAIQuestioningSourceDocument,
  AdminAIQuestioningSourceDocumentProfileVisualization,
  AdminAIQuestioningSourceProfilePipelineTask,
  AdminAIQuestioningSourceReferenceSummary,
  AdminAIQuestioningSourceAutoProfileTask
} from '../../../lib/api-types';
import { ProfileVisualizationPanel } from './ProfileVisualizationPanel';
import { formatDate } from './pageUtils';
import { recordFrom } from './questionData';
import { SourceImportPanel, type SourceImportMessage } from './SourceImportPanel';

export type SourceReferenceWorkflowTone = 'neutral' | 'working' | 'warning' | 'danger' | 'success';

export type SourceReferenceLibraryPanelProps = {
  subject: string;
  onSubjectChange: (subject: string) => void;
  sourceDocuments: AdminAIQuestioningSourceDocument[];
  sourceDocumentProfileVisualizations: Record<number, AdminAIQuestioningSourceDocumentProfileVisualization>;
  sourceReferenceSummary: AdminAIQuestioningSourceReferenceSummary['summary'];
  sourceAutoProfileTasks: AdminAIQuestioningSourceAutoProfileTask[];
  sourceImportJson: string;
  sourceImportMessage: SourceImportMessage | null;
  sourceImportFileInputRef: RefObject<HTMLInputElement | null>;
  canGenerateStyleProfile: boolean;
  styleProfileBlockedReason: string;
  sourceReferenceWorkflowTone: SourceReferenceWorkflowTone;
  isImportBusy: boolean;
  isStyleProfileBusy: boolean;
  onGenerateStyleProfile: () => void;
  onChangeImportJson: (value: string) => void;
  onLoadImportFile: (file: File) => void;
  onChooseImportFile: () => void;
  onFillImportTemplate: () => void;
  onValidateImportJson: () => void;
  onImportJson: () => void;
  onClearImportJson: () => void;
  onSelectSourceDocument: (documentId: number) => void;
  onReprocessSourceDocument: (documentId: number, documentSubject?: string) => void;
  onDeleteSourceDocument: (documentId: number, documentTitle?: string) => void;
  onCleanupCurrentSubjectSourceDocuments: () => void;
  isSourceDocumentBusy: (documentId: number) => boolean;
  isSourceDocumentDeleteBusy: (documentId: number) => boolean;
  isSourceDocumentsCleanupBusy: boolean;
  onRebuildSourceProfilePipeline: () => void;
  isSourceProfilePipelineBusy: boolean;
  onLoadSourceDocumentProfileVisualization: (documentId: number) => void;
  isSourceDocumentVisualizationBusy: (documentId: number) => boolean;
  onRefreshSourceReference: () => void;
};

const SOURCE_SUBJECT_OPTIONS = [
  { value: '', label: '全部学科' },
  { value: 'math', label: '数学' },
  { value: 'physics', label: '物理' },
  { value: 'chemistry', label: '化学' }
];

function sourceReferenceActionLabel(action?: string) {
  const labels: Record<string, string> = {
    import_source_questions: '先导入真题 JSON',
    auto_profile_source_questions: '等待自动画像流水线',
    retry_auto_profile: '等待自动重试临时失败样本',
    map_source_questions: '等待自动映射知识点',
    confirm_mapped_samples: '等待源题纳入画像样本池',
    generate_profile: '画像样本可用，自动流程会持续刷新'
  };
  return labels[action ?? ''] ?? action ?? '等待数据';
}

function sourcePipelineStageLabel(stage?: string | null) {
  const labels: Record<string, string> = {
    readiness_scan: '检查大纲与真题源',
    source_auto_profile_scan: '扫描单题画像',
    source_auto_profile_waiting: '等待单题画像完成',
    source_mapping_incomplete: '源题未闭环',
    series_profile_building: '生成连续趋势画像',
    generation_profile_building: '生成当前出题画像',
    ready: '画像流水线已就绪',
    blocked: '流水线阻塞',
    failed: '流水线失败',
    queued: '排队中',
    running: '运行中',
    waiting: '等待依赖',
    succeeded: '已完成'
  };
  return labels[stage ?? ''] ?? stage ?? '等待流水线';
}

function sourcePipelineActionLabel(action?: string | null) {
  const labels: Record<string, string> = {
    source_document_imported: '真题导入触发',
    source_document_reprofiled: '真题重解析触发',
    source_document_deleted: '真题删除后重建',
    source_auto_profile_completed: '单题画像完成触发',
    syllabus_applied: '大纲应用触发',
    manual_rebuild: '手动重建',
    startup_reconcile: '服务重启恢复',
    summary_diagnostic: '当前事实源诊断'
  };
  return labels[action ?? ''] ?? action ?? '自动触发';
}

function sourcePipelineTone(status?: string | null): SourceReferenceWorkflowTone {
  if (status === 'running' || status === 'queued' || status === 'waiting') return 'working';
  if (status === 'source_mapping_incomplete') return 'warning';
  if (status === 'succeeded') return 'success';
  if (status === 'blocked') return 'warning';
  if (status === 'failed') return 'danger';
  return 'neutral';
}

function numberFromUnknown(value: unknown, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function percentFromRatio(value: unknown) {
  const ratio = numberFromUnknown(value, -1);
  if (ratio < 0) return '-';
  return `${Math.round(ratio * 100)}%`;
}

function pipelineProfileLabel(value: unknown) {
  const status = String(value ?? '').trim();
  const labels: Record<string, string> = {
    pending: '待处理',
    running: '生成中',
    succeeded: '已完成',
    blocked: '已阻塞',
    failed: '失败'
  };
  return labels[status] ?? (status || '-');
}

function readinessLabel(value: unknown) {
  const record = recordFrom(value);
  if (record.ready === true) return 'ready';
  const reason = String(record.reasonCode ?? '').trim();
  const message = String(record.message ?? '').trim();
  return reason || message || 'blocked';
}

function shortHash(value: unknown) {
  const text = String(value ?? '').trim();
  if (!text) return '-';
  return text.length > 12 ? `${text.slice(0, 8)}...${text.slice(-4)}` : text;
}

function readinessSnapshotDetail(value: unknown) {
  const record = recordFrom(value);
  if (!Object.keys(record).length) return '';
  const currentSource = String(record.currentSourceSnapshotHash ?? '').trim();
  const seriesSource = String(record.activeSeriesSourceSnapshotHash ?? '').trim();
  const generationSource = String(record.activeGenerationSourceSnapshotHash ?? '').trim();
  const currentSyllabus = String(record.currentSyllabusSnapshotHash ?? '').trim();
  const seriesSyllabus = String(record.activeSeriesSyllabusSnapshotHash ?? '').trim();
  const generationSyllabus = String(record.activeGenerationSyllabusSnapshotHash ?? '').trim();
  if (!currentSource && !seriesSource && !generationSource && !currentSyllabus && !seriesSyllabus && !generationSyllabus) return '';
  const sourceOk = Boolean(currentSource && seriesSource && generationSource && currentSource === seriesSource && currentSource === generationSource);
  const syllabusOk = Boolean(currentSyllabus && seriesSyllabus && generationSyllabus && currentSyllabus === seriesSyllabus && currentSyllabus === generationSyllabus);
  return [
    `源卷 ${sourceOk ? '一致' : '不一致'}: 当前 ${shortHash(currentSource)} / 趋势 ${shortHash(seriesSource)} / 出题 ${shortHash(generationSource)}`,
    `大纲 ${syllabusOk ? '一致' : '不一致'}: 当前 ${shortHash(currentSyllabus)} / 趋势 ${shortHash(seriesSyllabus)} / 出题 ${shortHash(generationSyllabus)}`
  ].join('；');
}

function versionGovernanceLabel(value: unknown) {
  const record = recordFrom(value);
  const summary = recordFrom(record.summary ?? record);
  const entries = ['current', 'legacy_usable', 'manual_published', 'stale_needs_review', 'unknown_legacy', 'retired']
    .map((key) => [key, numberFromUnknown(summary[key], 0)] as const)
    .filter(([, count]) => count > 0)
    .map(([key, count]) => `${key} ${count}`);
  const scanned = numberFromUnknown(record.scanned, 0);
  if (entries.length) return entries.join(' · ');
  if (scanned > 0) return `扫描 ${scanned}`;
  return '-';
}

function wakeStatusLabel(value: unknown) {
  const record = recordFrom(value);
  if (!Object.keys(record).length) return '-';
  const started = record.started === true;
  const reason = String(record.reason ?? '').trim();
  if (started) return '已唤醒';
  return reason || '未启动';
}

function sourcePipelineDetailItems(
  task: AdminAIQuestioningSourceProfilePipelineTask | null,
  summary?: AdminAIQuestioningSourceReferenceSummary['summary']
) {
  if (!task) return [];
  const result = recordFrom(task.result);
  const source = recordFrom(result.source);
  const mapping = recordFrom(result.mapping);
  const currentMapping = recordFrom(result.currentMapping);
  const mappingGapDiagnosis = recordFrom(result.mappingGapDiagnosis);
  const profiles = recordFrom(result.profiles);
  const readiness = recordFrom(result.readiness);
  const versionGovernance = recordFrom(result.versionGovernance);
  const autoReplenishmentWake = recordFrom(result.autoReplenishmentWake);
  const items: Array<{ key: string; label: string; detail: string }> = [];

  if (Object.keys(source).length > 0) {
    const questionCount = numberFromUnknown(summary?.questionCount, numberFromUnknown(source.questionCount));
    const autoApprovedCount = numberFromUnknown(summary?.autoApprovedQuestionCount, numberFromUnknown(source.autoApprovedCount));
    const pendingCount = numberFromUnknown(
      (summary?.autoPendingQuestionCount ?? 0) + (summary?.autoProcessingQuestionCount ?? 0) + (summary?.autoRetryPendingQuestionCount ?? 0),
      numberFromUnknown(source.pendingCount)
    );
    items.push({
      key: 'source',
      label: '源样本',
      detail: `文档 ${numberFromUnknown(summary?.documentCount, numberFromUnknown(source.documentCount))} · 源题 ${questionCount} · 纳入画像样本 ${autoApprovedCount} · 待纳入/处置 ${pendingCount}`
    });
  }
  if (Object.keys(mapping).length > 0) {
    const mappedCount = numberFromUnknown(summary?.autoApprovedQuestionCount, numberFromUnknown(mapping.mappedCount ?? currentMapping.mappedCount));
    const questionCount = numberFromUnknown(summary?.questionCount, numberFromUnknown(currentMapping.questionCount));
    const excludedCount = numberFromUnknown(
      summary?.autoExcludedQuestionCount ?? 0,
      numberFromUnknown(mapping.excludedCount ?? currentMapping.excludedCount)
    );
    const retryExhaustedCount = numberFromUnknown(
      summary?.autoRetryExhaustedQuestionCount ?? 0,
      numberFromUnknown(mapping.retryExhaustedCount ?? currentMapping.retryExhaustedCount)
    );
    const currentOpenCount = numberFromUnknown(
      (summary?.autoPendingQuestionCount ?? 0) + (summary?.autoProcessingQuestionCount ?? 0) + (summary?.autoRetryPendingQuestionCount ?? 0),
      0
    );
    const processedCount = summary
      ? Math.min(questionCount, mappedCount + excludedCount + retryExhaustedCount)
      : numberFromUnknown(mapping.processedCount ?? currentMapping.processedCount, mappedCount + excludedCount + retryExhaustedCount);
    const unmappedCount = summary
      ? Math.max(0, questionCount - processedCount)
      : numberFromUnknown(mapping.unmappedCount, questionCount > 0 ? Math.max(0, questionCount - processedCount) : 0);
    const eligibleQuestionCount = Math.max(0, questionCount - excludedCount);
    const coverage = summary
      ? (eligibleQuestionCount > 0 ? mappedCount / eligibleQuestionCount : 0)
      : mapping.coverage;
    const gapReason = currentOpenCount > 0 ? '' : String(mapping.gapReason ?? mappingGapDiagnosis.reason ?? '').trim();
    const nextAction = currentOpenCount > 0 ? '' : String(mapping.nextAction ?? mappingGapDiagnosis.nextAction ?? '').trim();
    items.push({
      key: 'mapping',
      label: '映射覆盖',
      detail: `覆盖 ${percentFromRatio(coverage)} · 源题已扫描 ${processedCount}${questionCount > 0 ? `/${questionCount}` : ''} · 源题已映射 ${mappedCount} · 已说明排除 ${excludedCount} · 重试耗尽 ${retryExhaustedCount} · 未闭环 ${unmappedCount} · 低置信 ${numberFromUnknown(summary?.lowConfidenceQuestionCount, numberFromUnknown(mapping.lowConfidenceCount ?? mappingGapDiagnosis.lowConfidenceCount))} · 疑似超纲 ${numberFromUnknown(summary?.outOfSyllabusQuestionCount, numberFromUnknown(mapping.outOfSyllabusCount ?? mappingGapDiagnosis.outOfSyllabusCount))}`
    });
    if (gapReason || nextAction) {
      items.push({
        key: 'mapping-gap',
        label: '映射缺口',
        detail: `${gapReason || 'source_mapping_coverage_low'}${nextAction ? ` · ${nextAction}` : ''}`
      });
    }
  }
  if (Object.keys(profiles).length > 0) {
    items.push({
      key: 'profiles',
      label: '画像阶段',
      detail: `单卷 ${pipelineProfileLabel(profiles.styleProfile)} · 趋势 ${pipelineProfileLabel(profiles.seriesProfile)} · 科目 ${pipelineProfileLabel(profiles.subjectPracticeGenerationProfile)} · 模考 ${pipelineProfileLabel(profiles.onlineMockExamGenerationProfile)}`
    });
  }
  if (Object.keys(readiness).length > 0) {
    const subjectPracticeSnapshot = readinessSnapshotDetail(readiness.subjectPractice);
    const onlineMockSnapshot = readinessSnapshotDetail(readiness.onlineMockExam);
    items.push({
      key: 'readiness',
      label: '出题就绪',
      detail: `科目 ${readinessLabel(readiness.subjectPractice)} · 模考 ${readinessLabel(readiness.onlineMockExam)}`
    });
    if (subjectPracticeSnapshot || onlineMockSnapshot) {
      items.push({
        key: 'readiness-snapshots',
        label: '快照一致性',
        detail: [
          subjectPracticeSnapshot ? `科目：${subjectPracticeSnapshot}` : '',
          onlineMockSnapshot ? `模考：${onlineMockSnapshot}` : ''
        ].filter(Boolean).join(' ｜ ')
      });
    }
  }
  if (Object.keys(versionGovernance).length > 0) {
    items.push({
      key: 'version-governance',
      label: '版本治理',
      detail: `科目 ${versionGovernanceLabel(versionGovernance.subjectPractice)} · 模考 ${versionGovernanceLabel(versionGovernance.onlineMockExam)}`
    });
  }
  if (Object.keys(autoReplenishmentWake).length > 0) {
    items.push({
      key: 'auto-replenishment-wake',
      label: '自动补题唤醒',
      detail: `预测补题 ${wakeStatusLabel(autoReplenishmentWake.subjectPracticePredictive)} · 生产任务 ${wakeStatusLabel(autoReplenishmentWake.subjectPracticeProduction)}`
    });
  }
  if (task.error) {
    items.push({ key: 'pipeline-error', label: '最近问题', detail: task.error });
  }
  return items;
}

function sourceProfileTaskStatusLabel(
  task: AdminAIQuestioningSourceAutoProfileTask,
  visualization?: AdminAIQuestioningSourceDocumentProfileVisualization
) {
  if (task.status === 'succeeded' && visualization && (visualization.summary.processedCount ?? visualization.summary.mappedCount) < visualization.summary.questionCount) {
    return '本轮完成，画像未完成';
  }
  const labels: Record<string, string> = {
    queued: '排队中',
    running: '解析中',
    succeeded: '已完成',
    failed: '失败'
  };
  return labels[task.status] ?? task.status;
}

function sourceProfileTaskActionLabel(action: string) {
  const labels: Record<string, string> = {
    auto_profile_filtered: '自动画像',
    retry_failed_samples: '自动重试'
  };
  return labels[action] ?? action;
}

function isActiveSourceProfileTask(task: AdminAIQuestioningSourceAutoProfileTask) {
  return task.status === 'queued' || task.status === 'running';
}

function sourceProfileTaskTone(
  task: AdminAIQuestioningSourceAutoProfileTask,
  visualization?: AdminAIQuestioningSourceDocumentProfileVisualization
): 'neutral' | 'working' | 'warning' | 'danger' | 'success' {
  if (visualization && (visualization.summary.processedCount ?? visualization.summary.mappedCount) < visualization.summary.questionCount) return 'warning';
  if (task.status === 'succeeded') return 'success';
  if (task.status === 'failed') return 'danger';
  if (isActiveSourceProfileTask(task)) return 'working';
  return 'neutral';
}

function sourceProfileTaskAction(
  task: AdminAIQuestioningSourceAutoProfileTask,
  visualization?: AdminAIQuestioningSourceDocumentProfileVisualization
) {
  if (task.error) return task.error;
  if (isActiveSourceProfileTask(task)) {
    return '后台正在处理这份真题 JSON 的画像/知识点映射，本卡片会自动刷新。';
  }
  if (task.status === 'succeeded' && visualization && (visualization.summary.processedCount ?? visualization.summary.mappedCount) < visualization.summary.questionCount) {
    return `最近一轮任务已结束，但这份卷还只处理 ${visualization.summary.processedCount ?? visualization.summary.mappedCount}/${visualization.summary.questionCount}，仍有 ${visualization.summary.pendingCount} 道待处理。`;
  }
  if (task.status === 'succeeded' && visualization && visualization.summary.excludedCount > 0) {
    return `最近一轮任务已结束，已纳入 ${visualization.summary.autoApprovedCount} 道画像样本，${visualization.summary.excludedCount} 道已说明排除。`;
  }
  return '最近一次画像任务记录。';
}

function sourceCompletenessLabel(document: AdminAIQuestioningSourceDocument) {
  const completeness = document.sourceCompleteness;
  if (!completeness) return null;
  const expected = completeness.expectedQuestionCount ?? completeness.actualQuestionCount;
  const base = completeness.completenessStatus === 'complete'
    ? `完整 ${completeness.actualQuestionCount}/${expected}`
    : `部分 ${completeness.actualQuestionCount}/${expected}`;
  const excluded = completeness.excludedQuestions
    .slice(0, 6)
    .map((item) => `Q${item.questionNumber}`)
    .join('、');
  const missing = completeness.missingQuestionNumbers
    .slice(0, 6)
    .map((item) => `Q${item}`)
    .join('、');
  const detail = [
    excluded ? `已说明缺题 ${excluded}` : '',
    missing ? `未说明缺题 ${missing}` : '',
    completeness.note
  ].filter(Boolean).join('；');
  return { label: base, detail };
}

function isRecentTransitionalPipelineBlock(task: AdminAIQuestioningSourceProfilePipelineTask | null) {
  if (!task || task.status !== 'blocked') return false;
  const reasonText = `${task.reason ?? ''} ${task.stage ?? ''} ${task.error ?? ''}`;
  const isSnapshotTransition = [
    'generation_profile_not_fresh',
    'series_profile_source_snapshot_stale',
    'generation_profile_source_snapshot_stale',
    'series_profile_syllabus_snapshot_stale',
    'generation_profile_syllabus_snapshot_stale'
  ].some((reason) => reasonText.includes(reason));
  if (!isSnapshotTransition) return false;
  const updatedAt = Date.parse(task.updatedAt);
  return Number.isFinite(updatedAt) && Date.now() - updatedAt < 120_000;
}

export function SourceReferenceLibraryPanel({
  subject,
  onSubjectChange,
  sourceDocuments,
  sourceDocumentProfileVisualizations,
  sourceReferenceSummary,
  sourceAutoProfileTasks,
  sourceImportJson,
  sourceImportMessage,
  sourceImportFileInputRef,
  canGenerateStyleProfile,
  styleProfileBlockedReason,
  sourceReferenceWorkflowTone,
  isImportBusy,
  isStyleProfileBusy,
  onGenerateStyleProfile,
  onChangeImportJson,
  onLoadImportFile,
  onChooseImportFile,
  onFillImportTemplate,
  onValidateImportJson,
  onImportJson,
  onClearImportJson,
  onSelectSourceDocument,
  onReprocessSourceDocument,
  onDeleteSourceDocument,
  onCleanupCurrentSubjectSourceDocuments,
  isSourceDocumentBusy,
  isSourceDocumentDeleteBusy,
  isSourceDocumentsCleanupBusy,
  onRebuildSourceProfilePipeline,
  isSourceProfilePipelineBusy,
  onLoadSourceDocumentProfileVisualization,
  isSourceDocumentVisualizationBusy,
  onRefreshSourceReference
}: SourceReferenceLibraryPanelProps) {
  const [expandedVisualizationId, setExpandedVisualizationId] = useState<number | null>(null);
  const sourceTasksByDocument = useMemo(() => {
    const tasks = new Map<number, AdminAIQuestioningSourceAutoProfileTask>();
    for (const task of [...sourceAutoProfileTasks].sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))) {
      if (!task.documentId || tasks.has(task.documentId)) continue;
      tasks.set(task.documentId, task);
    }
    return tasks;
  }, [sourceAutoProfileTasks]);
  const hasActiveSourceTask = sourceAutoProfileTasks.some(isActiveSourceProfileTask);
  const pipelineTask = sourceReferenceSummary.pipelineTask ?? null;
  const pipelineDetailItems = sourcePipelineDetailItems(pipelineTask, sourceReferenceSummary);
  const hasActivePipelineTask = Boolean(pipelineTask && ['queued', 'running', 'waiting'].includes(pipelineTask.status));
  const pipelineMappedQuestionCount =
    sourceReferenceSummary.pipelineMappedQuestionCount ?? sourceReferenceSummary.mappedQuestionCount;
  const pipelineExcludedQuestionCount =
    sourceReferenceSummary.autoExcludedQuestionCount ?? 0;
  const pipelineRetryExhaustedQuestionCount =
    sourceReferenceSummary.autoRetryExhaustedQuestionCount ?? 0;
  const pipelineProcessedQuestionCount = Math.min(
    sourceReferenceSummary.questionCount,
    pipelineMappedQuestionCount + pipelineExcludedQuestionCount + pipelineRetryExhaustedQuestionCount
  );
  const pipelineStageCompletedCount = pipelineTask
    ? (sourceReferenceSummary.autoApprovedQuestionCount ?? pipelineTask.succeeded)
    : 0;
  const pipelineMappingIncomplete = Boolean(
    (pipelineTask?.status === 'succeeded' || pipelineTask?.status === 'source_mapping_incomplete')
      && sourceReferenceSummary.questionCount > 0
      && pipelineProcessedQuestionCount < sourceReferenceSummary.questionCount
  );
  const pipelineDisplayStatus = pipelineMappingIncomplete ? 'source_mapping_incomplete' : pipelineTask?.status;
  const pipelineDisplayStage = pipelineMappingIncomplete ? 'source_mapping_incomplete' : (pipelineTask?.stage ?? pipelineTask?.status);
  const shouldPollSourceReference =
    hasActiveSourceTask ||
    hasActivePipelineTask ||
    isRecentTransitionalPipelineBlock(pipelineTask) ||
    pipelineMappingIncomplete ||
    (sourceReferenceSummary.autoPendingQuestionCount ?? 0) > 0 ||
    (sourceReferenceSummary.autoRetryPendingQuestionCount ?? 0) > 0;

  useEffect(() => {
    if (!shouldPollSourceReference) return undefined;
    const timer = window.setInterval(() => {
      onRefreshSourceReference();
      if (expandedVisualizationId && !isSourceDocumentVisualizationBusy(expandedVisualizationId)) {
        onLoadSourceDocumentProfileVisualization(expandedVisualizationId);
      }
    }, 4000);
    return () => window.clearInterval(timer);
  }, [
    expandedVisualizationId,
    isSourceDocumentVisualizationBusy,
    onLoadSourceDocumentProfileVisualization,
    onRefreshSourceReference,
    shouldPollSourceReference
  ]);

  function toggleVisualization(documentId: number) {
    if (expandedVisualizationId === documentId) {
      setExpandedVisualizationId(null);
      return;
    }
    setExpandedVisualizationId(documentId);
    if (!sourceDocumentProfileVisualizations[documentId]) {
      onLoadSourceDocumentProfileVisualization(documentId);
    }
  }
  return (
    <AdminPanel>
      <AdminPanelHeader
        kicker="真题参考库"
        title={`${sourceDocuments.length} 份文档 · ${sourceReferenceSummary.questionCount} 道源题样本`}
      >
        <p>用于沉淀真题风格、难度和考点倾向；系统只把自动门禁通过的样本纳入画像。</p>
      </AdminPanelHeader>
      <div className="admin-inline-form">
        <label>
          学科
          <select value={subject} onChange={(event) => onSubjectChange(event.target.value)}>
            {SOURCE_SUBJECT_OPTIONS.map((option) => (
              <option key={option.value || 'all'} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="ghost-button"
          onClick={onRefreshSourceReference}
        >
          刷新本块
        </button>
      </div>
      <div className="metric-grid four">
        <div><span>真题文档</span><strong>{sourceReferenceSummary.documentCount}</strong></div>
        <div><span>源题样本</span><strong>{sourceReferenceSummary.questionCount}</strong></div>
        <div><span>纳入画像</span><strong>{sourceReferenceSummary.autoApprovedQuestionCount ?? 0}</strong></div>
        <div><span>待纳入/处置</span><strong>{sourceReferenceSummary.autoPendingQuestionCount ?? 0}</strong></div>
      </div>
      <AdminOperationStatus
        title="源题映射与纳入状态"
        status={sourceReferenceActionLabel(sourceReferenceSummary.recommendedAction)}
        action={canGenerateStyleProfile ? '已纳入画像的源题样本可用；正常无需手动操作。' : styleProfileBlockedReason}
        tone={sourceReferenceWorkflowTone}
        metrics={[
          { key: 'documents', label: '文档', value: sourceReferenceSummary.documentCount },
          { key: 'questions', label: '源题', value: sourceReferenceSummary.questionCount },
          { key: 'mapped', label: '源题已映射', value: pipelineMappedQuestionCount },
          { key: 'low-confidence', label: '低置信', value: sourceReferenceSummary.lowConfidenceQuestionCount ?? 0, tone: (sourceReferenceSummary.lowConfidenceQuestionCount ?? 0) > 0 ? 'warning' : 'neutral' },
          { key: 'out-of-syllabus', label: '疑似超纲', value: sourceReferenceSummary.outOfSyllabusQuestionCount ?? 0, tone: (sourceReferenceSummary.outOfSyllabusQuestionCount ?? 0) > 0 ? 'warning' : 'neutral' },
          { key: 'auto-approved', label: '纳入画像', value: sourceReferenceSummary.autoApprovedQuestionCount ?? 0, tone: 'success' },
          { key: 'auto-excluded', label: '规则排除', value: sourceReferenceSummary.autoExcludedQuestionCount ?? 0, tone: (sourceReferenceSummary.autoExcludedQuestionCount ?? 0) > 0 ? 'warning' : 'neutral' },
          { key: 'auto-retry', label: '待重试', value: sourceReferenceSummary.autoRetryPendingQuestionCount ?? 0, tone: (sourceReferenceSummary.autoRetryPendingQuestionCount ?? 0) > 0 ? 'warning' : 'neutral' }
        ]}
      />
      <AdminOperationStatus
        title="趋势/出题画像生成流水线"
        status={sourcePipelineStageLabel(pipelineDisplayStage)}
        action={pipelineTask
          ? `${sourcePipelineActionLabel(pipelineTask.action)} · #${pipelineTask.id.slice(0, 8)}${pipelineTask.reason ? ` · ${pipelineTask.reason}` : ''}${pipelineMappingIncomplete ? ` · 映射 ${pipelineMappedQuestionCount}/${sourceReferenceSummary.questionCount}` : ''}`
          : '暂无流水线任务；导入真题或应用大纲后会自动创建。'}
        tone={sourcePipelineTone(pipelineDisplayStatus)}
        metrics={[
          { key: 'requested', label: '源题范围', value: pipelineTask?.requested ?? 0 },
          { key: 'succeeded', label: '阶段完成', value: pipelineStageCompletedCount, tone: 'success' },
          { key: 'skipped', label: '跳过/排除', value: pipelineTask?.skipped ?? 0, tone: (pipelineTask?.skipped ?? 0) > 0 ? 'warning' : 'neutral' },
          { key: 'failed', label: '失败', value: pipelineTask?.failed ?? 0, tone: (pipelineTask?.failed ?? 0) > 0 ? 'danger' : 'neutral' },
          { key: 'updated', label: '更新', value: pipelineTask?.updatedAt ? formatDate(pipelineTask.updatedAt, '-') : '-', hidden: !pipelineTask }
        ]}
        recentLabel="流水线详情"
        recent={pipelineDetailItems}
      />
      <details className="admin-source-question-maintenance">
        <summary>画像维护入口</summary>
        <p className="form-hint">默认流程会在导入和自动画像完成后刷新画像。只有排查旧数据或强制重建画像时才使用。</p>
        <AdminActionBar>
          <button
            type="button"
            onClick={onGenerateStyleProfile}
            disabled={!canGenerateStyleProfile || isStyleProfileBusy}
            className="ghost-button"
            title={canGenerateStyleProfile ? '强制用当前自动通过样本重建画像' : styleProfileBlockedReason}
          >
            {isStyleProfileBusy ? '重建中' : '强制重建画像'}
          </button>
          <button
            type="button"
            onClick={onRebuildSourceProfilePipeline}
            disabled={!subject || isSourceProfilePipelineBusy}
            className={isSourceProfilePipelineBusy ? 'ghost-button admin-action-loading' : 'ghost-button'}
            title="恢复工具：重新执行 source profile pipeline，重跑单卷画像、趋势画像、出题画像和版本治理检查"
          >
            {isSourceProfilePipelineBusy ? '重跑中' : '重跑画像流水线'}
          </button>
        </AdminActionBar>
      </details>
      <SourceImportPanel
        subject={subject || 'math'}
        sourceImportJson={sourceImportJson}
        sourceImportMessage={sourceImportMessage}
        sourceImportFileInputRef={sourceImportFileInputRef}
        isImportBusy={isImportBusy}
        onChangeJson={onChangeImportJson}
        onLoadFile={onLoadImportFile}
        onChooseFile={onChooseImportFile}
        onFillTemplate={onFillImportTemplate}
        onValidateJson={onValidateImportJson}
        onImportJson={onImportJson}
        onClear={onClearImportJson}
      />
      <AdminActionBar>
        <button
          type="button"
          className={isSourceDocumentsCleanupBusy ? 'ghost-button admin-action-loading' : 'ghost-button'}
          onClick={onCleanupCurrentSubjectSourceDocuments}
          disabled={isSourceDocumentsCleanupBusy || !subject}
          title="删除当前学科的 past_paper 源卷和源题，并归档相关画像；正式题库不删除"
        >
          {isSourceDocumentsCleanupBusy ? '清理中' : '清理本学科真题源'}
        </button>
      </AdminActionBar>
      <div className="admin-list compact">
        {sourceDocuments.length === 0 && <p className="form-hint">还没有当前筛选范围内的真题参考文档。</p>}
        {sourceDocuments.map((document) => {
          const latestTask = sourceTasksByDocument.get(document.id);
          const visualization = sourceDocumentProfileVisualizations[document.id];
          const completeness = sourceCompletenessLabel(document);
          return (
            <div key={document.id}>
              <button type="button" className="plain-link" onClick={() => onSelectSourceDocument(document.id)}>
                <strong>{document.title}</strong>
              </button>
              <span>{document.subject} · {document.examYear ?? '-'} · {document.language} · {document.sourceLabel}</span>
              {completeness && <span className="form-hint" title={completeness.detail}> · {completeness.label}</span>}
              {latestTask && (
                <AdminOperationStatus
                  title={`${sourceProfileTaskActionLabel(latestTask.action)} #${latestTask.id}`}
                  status={sourceProfileTaskStatusLabel(latestTask, visualization)}
                  action={sourceProfileTaskAction(latestTask, visualization)}
                  tone={sourceProfileTaskTone(latestTask, visualization)}
                  metrics={[
                    ...(visualization
                      ? [
                          { key: 'document-mapped', label: '卷级已处理', value: `${visualization.summary.processedCount ?? visualization.summary.mappedCount}/${visualization.summary.questionCount}` },
                          { key: 'document-excluded', label: '已说明排除', value: visualization.summary.excludedCount ?? 0, tone: (visualization.summary.excludedCount ?? 0) > 0 ? 'warning' as const : 'neutral' as const },
                          { key: 'document-retry-exhausted', label: '重试耗尽', value: visualization.summary.retryExhaustedCount ?? 0, tone: (visualization.summary.retryExhaustedCount ?? 0) > 0 ? 'warning' as const : 'neutral' as const },
                          { key: 'document-pending', label: '卷级待处理', value: visualization.summary.pendingCount, tone: visualization.summary.pendingCount > 0 ? 'warning' as const : 'neutral' as const }
                        ]
                      : []),
                    { key: 'requested', label: '本轮范围', value: latestTask.requested },
                    { key: 'succeeded', label: '本轮成功', value: latestTask.succeeded, tone: 'success' },
                    { key: 'skipped', label: '本轮跳过/待重试', value: latestTask.skipped, tone: latestTask.skipped > 0 ? 'warning' : 'neutral' },
                    { key: 'failed', label: '本轮失败', value: latestTask.failed, tone: latestTask.failed > 0 ? 'danger' : 'neutral' }
                  ]}
                />
              )}
              <AdminActionBar>
                <button
                  type="button"
                  className={isSourceDocumentVisualizationBusy(document.id) ? 'ghost-button admin-action-loading' : 'ghost-button'}
                  onClick={() => toggleVisualization(document.id)}
                  disabled={isSourceDocumentVisualizationBusy(document.id)}
                  title="按这份源卷的全部题目聚合画像图表，不受下方分页影响"
                >
                  {expandedVisualizationId === document.id ? '收起画像图表' : isSourceDocumentVisualizationBusy(document.id) ? '加载中' : '查看画像图表'}
                </button>
                <button
                  type="button"
                  className={isSourceDocumentVisualizationBusy(document.id) ? 'ghost-button admin-action-loading' : 'ghost-button'}
                  onClick={() => {
                    onRefreshSourceReference();
                    if (expandedVisualizationId === document.id) {
                      onLoadSourceDocumentProfileVisualization(document.id);
                    }
                  }}
                  disabled={isSourceDocumentVisualizationBusy(document.id)}
                  title="只刷新真题参考库和当前画像进度，不刷新整页"
                >
                  刷新进度
                </button>
                <button
                  type="button"
                  className={isSourceDocumentBusy(document.id) ? 'ghost-button admin-action-loading' : 'ghost-button'}
                  onClick={() => onReprocessSourceDocument(document.id, document.subject)}
                  disabled={isSourceDocumentBusy(document.id)}
                  title="重置这份文档下非拒绝样本的画像/映射状态，并按当前升级后的维度重新解析"
                >
                  {isSourceDocumentBusy(document.id) ? '重跑中' : '重新解析映射'}
                </button>
                <button
                  type="button"
                  className={isSourceDocumentDeleteBusy(document.id) ? 'ghost-button danger admin-action-loading' : 'ghost-button danger'}
                  onClick={() => onDeleteSourceDocument(document.id, document.title)}
                  disabled={isSourceDocumentDeleteBusy(document.id)}
                  title="删除这份源卷和源题，并归档相关画像；正式题库不删除"
                >
                  {isSourceDocumentDeleteBusy(document.id) ? '删除中' : '删除源卷'}
                </button>
              </AdminActionBar>
              {expandedVisualizationId === document.id && sourceDocumentProfileVisualizations[document.id] && (
                <ProfileVisualizationPanel visualization={sourceDocumentProfileVisualizations[document.id]} />
              )}
            </div>
          );
        })}
      </div>
    </AdminPanel>
  );
}

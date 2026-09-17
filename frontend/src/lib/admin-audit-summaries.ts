import type { AdminAuditEvent } from './api-types';

export type AdminAuditEventSummary = {
  title: string;
  detail: string;
  tone: 'success' | 'warning' | 'danger' | 'neutral';
  rows: string[];
};

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function array(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown) {
  if (value === undefined || value === null || value === '') return '';
  return String(value);
}

function int(value: unknown) {
  const next = Number(value);
  return Number.isFinite(next) ? next : 0;
}

function statusLabel(status: string, isEnglish: boolean) {
  const labels: Record<string, [string, string]> = {
    approved: ['已发布', 'published'],
    archived: ['已归档', 'archived'],
    draft: ['草稿', 'draft'],
    failed: ['失败', 'failed'],
    pending_review: ['待复审', 'pending review'],
    rejected: ['已否决', 'rejected'],
    review_failed: ['复审未通过', 'review failed'],
    succeeded: ['成功', 'succeeded']
  };
  const label = labels[status];
  return label ? (isEnglish ? label[1] : label[0]) : status;
}

function statusCountsText(value: unknown, isEnglish: boolean) {
  const counts = record(value);
  if (!counts) return '';
  const parts = Object.entries(counts)
    .map(([status, count]) => `${statusLabel(status, isEnglish)} ${int(count)}`)
    .filter((item) => !item.endsWith(' 0'));
  if (!parts.length) return '';
  return `${isEnglish ? 'statuses' : '状态分布'} ${parts.join(' · ')}`;
}

function questionAuditTitle(action: string, isEnglish: boolean) {
  const bulkAction = action.startsWith('bulk_') ? action.slice(5) : '';
  const labels: Record<string, [string, string]> = {
    review: ['候选题已复审', 'Candidate reviewed'],
    approve: ['候选题已发布', 'Candidate published'],
    reject: ['候选题已否决', 'Candidate rejected'],
    archive: ['候选题已归档', 'Candidate archived'],
    manual_fix_and_review: ['候选题已人工修正并复审', 'Candidate manually fixed and reviewed'],
    bulk_review: ['候选题批量复审完成', 'Candidate bulk review completed'],
    bulk_approve: ['候选题批量发布完成', 'Candidate bulk publish completed'],
    bulk_reject: ['候选题批量否决完成', 'Candidate bulk reject completed'],
    bulk_archive: ['候选题批量归档完成', 'Candidate bulk archive completed']
  };
  const key = bulkAction ? `bulk_${bulkAction}` : action;
  const label = labels[key];
  if (label) return isEnglish ? label[1] : label[0];
  return isEnglish ? `Question action: ${action}` : `题目动作：${action}`;
}

function qualityAuditTitle(action: string, isEnglish: boolean) {
  const labels: Record<string, [string, string]> = {
    refresh: ['质量指标已刷新', 'Quality metrics refreshed'],
    resolve: ['质量项已标记处理', 'Quality item resolved'],
    send_to_review: ['质量项已送回复核', 'Quality item sent to review'],
    assign_review: ['质量项已认领复核', 'Quality item assigned'],
    disposition_archive: ['低质题已归档', 'Low-quality question archived'],
    disposition_manual_fix: ['质量项已转质量修题', 'Quality item moved to quality fix'],
    disposition_reduce_exposure: ['质量项已降低曝光', 'Quality item exposure reduced'],
    disposition_regenerate: ['质量项已生成替代候选', 'Quality item regenerated replacement'],
    bulk_send_to_review: ['质量项批量送审完成', 'Quality bulk send-to-review completed'],
    bulk_resolve: ['质量项批量处理完成', 'Quality bulk resolve completed'],
    bulk_archive: ['低质题批量归档完成', 'Quality bulk archive completed'],
    bulk_manual_fix: ['质量项批量转质量修题完成', 'Quality bulk quality-fix completed'],
    bulk_reduce_exposure: ['质量项批量降低曝光完成', 'Quality bulk exposure reduction completed'],
    bulk_regenerate: ['质量项批量重生成完成', 'Quality bulk regeneration completed']
  };
  const label = labels[action];
  if (label) return isEnglish ? label[1] : label[0];
  return isEnglish ? `Quality action: ${action}` : `质量动作：${action}`;
}

function blueprintAuditTitle(action: string, isEnglish: boolean) {
  const labels: Record<string, [string, string]> = {
    generate_candidate: ['已生成候选题', 'Candidate generated'],
    force_generate_candidate: ['已强制重生成候选题', 'Candidate force-generated'],
    pause: ['出题蓝图已暂停', 'Blueprint paused'],
    resume: ['出题蓝图已恢复', 'Blueprint resumed'],
    generate_batch: ['蓝图批量生成完成', 'Blueprint batch generation completed']
  };
  const label = labels[action];
  if (label) return isEnglish ? label[1] : label[0];
  return isEnglish ? `Blueprint action: ${action}` : `蓝图动作：${action}`;
}

function generationJobAuditTitle(action: string, isEnglish: boolean) {
  const labels: Record<string, [string, string]> = {
    enqueue: ['生成任务已入队', 'Generation jobs enqueued'],
    process: ['生成任务队列已处理', 'Generation queue processed'],
    retry: ['生成任务已重试', 'Generation job retried'],
    bulk_retry_failed: ['失败生成任务批量重试完成', 'Failed generation jobs bulk retried'],
    bulk_process_queue: ['生成队列批量处理完成', 'Generation queue bulk processed'],
    bulk_archive_failed: ['失败生成任务批量归档完成', 'Failed generation jobs bulk archived']
  };
  const label = labels[action];
  if (label) return isEnglish ? label[1] : label[0];
  return isEnglish ? `Generation job action: ${action}` : `生成任务动作：${action}`;
}

function topicAuditTitle(action: string, isEnglish: boolean) {
  const labels: Record<string, [string, string]> = {
    run_ensure_blueprint: ['知识点蓝图已处理', 'Topic blueprint handled'],
    run_generate_candidates: ['知识点生成任务已入队', 'Topic generation jobs enqueued'],
    run_review_candidates: ['知识点候选题已复审', 'Topic candidates reviewed'],
    run_approve_candidates: ['知识点候选题已发布', 'Topic candidates approved'],
    run_review_quality: ['知识点质量复核已处理', 'Topic quality review handled']
  };
  const label = labels[action];
  if (label) return isEnglish ? label[1] : label[0];
  return isEnglish ? `Topic action: ${action}` : `知识点动作：${action}`;
}

function migrationRowsFromAudit(event: AdminAuditEvent) {
  const after = record(event.after);
  const previewSummary = record(record(after?.import)?.previewSummary);
  const apply = record(previewSummary?.apply);
  return array(apply?.migrations).map((item) => {
    const migration = record(item) ?? {};
    return {
      previousCode: text(migration.previousCode),
      nextCode: text(migration.nextCode),
      existingTopicId: text(migration.existingTopicId),
      affectedQuestionCount: int(migration.affectedQuestionCount),
      approvedQuestionsBecomingPendingReview: int(migration.approvedQuestionsBecomingPendingReview)
    };
  }).filter((item) => item.previousCode && item.nextCode);
}

export function summarizeAdminAuditEvent(event: AdminAuditEvent, locale: string): AdminAuditEventSummary | null {
  const isEnglish = locale === 'en';
  if (event.module === 'ai-questioning' && event.resourceType === 'blueprint-coverage') {
    const after = record(event.after);
    const created = int(after?.created);
    const skipped = int(after?.skipped);
    const itemCount = int(after?.itemCount);
    return {
      title: isEnglish ? 'Blueprint coverage ensured' : '已补齐蓝图覆盖',
      detail: isEnglish
        ? `created ${created} blueprint(s) · skipped ${skipped} · returned ${itemCount}.`
        : `新建 ${created} 个蓝图 · 跳过 ${skipped} · 返回 ${itemCount}。`,
      tone: created > 0 ? 'success' : 'neutral',
      rows: [isEnglish ? 'Next: enqueue generation jobs for newly covered topics.' : '下一步：为新覆盖的知识点入队生成任务。']
    };
  }
  if (event.module === 'ai-questioning' && event.resourceType === 'blueprint') {
    const after = record(event.after);
    const question = record(after?.question);
    const generated = int(after?.generated);
    const itemCount = int(after?.itemCount);
    const id = text(after?.id) || event.resourceId || text(after?.blueprintId) || '-';
    const status = text(after?.status) || text(question?.status) || '-';
    const questionId = text(question?.id) || text(after?.questionId);
    const detail = event.action === 'generate_batch'
      ? (isEnglish
        ? `generated ${generated} batch result(s) · returned ${itemCount}.`
        : `批量生成 ${generated} 组结果 · 返回 ${itemCount}。`)
      : questionId
        ? (isEnglish
          ? `blueprint #${id} generated candidate #${questionId} · status ${status}.`
          : `蓝图 #${id} 生成候选题 #${questionId} · 状态 ${status}。`)
        : (isEnglish
          ? `blueprint #${id} · status ${status}.`
          : `蓝图 #${id} · 状态 ${status}。`);
    return {
      title: blueprintAuditTitle(event.action, isEnglish),
      detail,
      tone: status === 'review_failed' ? 'warning' : 'success',
      rows: [
        ...(questionId ? [isEnglish ? `Candidate: #${questionId}` : `候选题：#${questionId}`] : []),
        ...(event.action === 'generate_batch' ? [isEnglish ? 'Next: review generated candidates before publishing.' : '下一步：先审核候选题，再发布进训练题池。'] : [])
      ]
    };
  }
  if (event.module === 'ai-questioning' && event.resourceType === 'generation-job') {
    const after = record(event.after);
    const requested = int(after?.requested);
    const enqueued = int(after?.enqueued);
    const skipped = int(after?.skipped);
    const succeeded = int(after?.succeeded);
    const failed = int(after?.failed);
    const itemCount = int(after?.itemCount);
    const itemQuestionCount = int(after?.itemQuestionCount);
    const itemStatusText = statusCountsText(after?.itemStatusCounts, isEnglish);
    const id = text(after?.id) || event.resourceId || '-';
    const status = text(after?.status);
    const questionId = text(after?.questionId);
    const isQueueAction = ['enqueue', 'process'].includes(event.action) || event.action.startsWith('bulk_');
    const detail = event.action === 'enqueue'
      ? (isEnglish
        ? `requested ${requested} · enqueued ${enqueued} · skipped ${skipped} · returned ${itemCount}.`
        : `请求 ${requested} · 入队 ${enqueued} · 跳过 ${skipped} · 返回 ${itemCount}。`)
      : isQueueAction
        ? (isEnglish
          ? `requested ${requested} · succeeded ${succeeded} · failed ${failed} · candidates ${itemQuestionCount} · returned ${itemCount}.`
          : `请求 ${requested} · 成功 ${succeeded} · 失败 ${failed} · 候选题 ${itemQuestionCount} · 返回 ${itemCount}。`)
        : (isEnglish
          ? `job #${id} · status ${status || '-'}${questionId ? ` · candidate #${questionId}` : ''}.`
          : `任务 #${id} · 状态 ${status || '-'}${questionId ? ` · 候选题 #${questionId}` : ''}。`);
    return {
      title: generationJobAuditTitle(event.action, isEnglish),
      detail,
      tone: failed > 0 || status === 'failed' ? 'warning' : event.action.includes('archive') ? 'warning' : 'success',
      rows: [
        ...(questionId ? [isEnglish ? `Candidate created: #${questionId}` : `已生成候选题：#${questionId}`] : []),
        ...(itemStatusText ? [itemStatusText] : []),
        ...(event.action === 'enqueue' ? [isEnglish ? 'Next: process the generation queue.' : '下一步：处理生成队列。'] : [])
      ]
    };
  }
  if (event.module === 'ai-questioning' && event.resourceType === 'pregeneration') {
    const summary = record(record(event.after)?.summary);
    const selected = int(summary?.topicsSelected);
    const scanned = int(summary?.topicsScanned);
    const blueprints = int(summary?.blueprintsCreated);
    const enqueued = int(summary?.jobsEnqueued);
    const processed = int(summary?.jobsProcessed);
    const succeeded = int(summary?.jobsSucceeded);
    const failed = int(summary?.jobsFailed);
    const candidates = int(summary?.candidatesCreated);
    return {
      title: isEnglish ? 'Question-bank backfill run completed' : '题库自动补仓已完成',
      detail: isEnglish
        ? `selected ${selected}/${scanned} topic(s) · blueprints ${blueprints} · enqueued ${enqueued} · processed ${processed} · succeeded ${succeeded} · failed ${failed} · candidates ${candidates}.`
        : `选中 ${selected}/${scanned} 个知识点 · 新建蓝图 ${blueprints} · 入队 ${enqueued} · 处理 ${processed} · 成功 ${succeeded} · 失败 ${failed} · 候选题 ${candidates}。`,
      tone: failed > 0 ? 'warning' : candidates > 0 ? 'success' : 'neutral',
      rows: [candidates > 0 ? (isEnglish ? 'Next: review pending candidates.' : '下一步：审核待发布候选题。') : (isEnglish ? 'No candidate was created; inspect generation queue health.' : '本次未产出候选题；需要查看生成队列健康。')]
    };
  }
  if (event.module === 'ai-questioning' && event.resourceType === 'topic') {
    const after = record(event.after);
    const topicId = text(after?.topicId) || event.resourceId || '-';
    const requested = int(after?.requested);
    const created = int(after?.created);
    const skipped = int(after?.skipped);
    const enqueued = int(after?.enqueued);
    const succeeded = int(after?.succeeded);
    const failed = int(after?.failed);
    const action = text(after?.action) || event.action.replace('run_', '');
    const detail = action === 'ensure_blueprint'
      ? (isEnglish
        ? `topic #${topicId} · created ${created} · skipped ${skipped}.`
        : `知识点 #${topicId} · 新建 ${created} · 跳过 ${skipped}。`)
      : action === 'generate_candidates'
        ? (isEnglish
          ? `topic #${topicId} · requested ${requested} · enqueued ${enqueued} · skipped ${skipped}.`
          : `知识点 #${topicId} · 请求 ${requested} · 入队 ${enqueued} · 跳过 ${skipped}。`)
        : (isEnglish
          ? `topic #${topicId} · requested ${requested} · succeeded ${succeeded} · failed ${failed}.`
          : `知识点 #${topicId} · 请求 ${requested} · 成功 ${succeeded} · 失败 ${failed}。`);
    return {
      title: topicAuditTitle(event.action, isEnglish),
      detail,
      tone: failed > 0 ? 'warning' : 'success',
      rows: [isEnglish ? `Topic action: ${action}` : `知识点动作：${action}`]
    };
  }
  if (event.module === 'ai-questioning' && event.resourceType === 'question') {
    const after = record(event.after);
    const requested = int(after?.requested);
    const succeeded = int(after?.succeeded);
    const failed = int(after?.failed);
    const itemCount = int(after?.itemCount);
    const itemStatusText = statusCountsText(after?.itemStatusCounts, isEnglish);
    const id = text(after?.id) || event.resourceId || '-';
    const status = text(after?.status) || '-';
    const publishedId = text(after?.sourceQuestionId);
    const replacedId = text(after?.generatedVariantOf);
    const isBulk = event.action.startsWith('bulk_');
    const isReplacementPublish = event.action === 'approve' && Boolean(publishedId && replacedId);
    const detail = isBulk
      ? (isEnglish
        ? `requested ${requested} · succeeded ${succeeded} · failed ${failed} · returned ${itemCount}`
        : `请求 ${requested} · 成功 ${succeeded} · 失败 ${failed} · 返回 ${itemCount}`)
      : isReplacementPublish
        ? (isEnglish
          ? `candidate #${id} published as practice question #${publishedId}; replaced low-quality question #${replacedId}.`
          : `候选题 #${id} 已发布为练习题 #${publishedId}；替换低质题 #${replacedId}。`)
        : publishedId
          ? (isEnglish
            ? `candidate #${id} published as practice question #${publishedId} · status ${status}.`
            : `候选题 #${id} 已发布为练习题 #${publishedId} · 状态 ${status}。`)
          : (isEnglish
            ? `candidate #${id} · status ${status}.`
            : `候选题 #${id} · 状态 ${status}。`);
    return {
      title: questionAuditTitle(event.action, isEnglish),
      detail,
      tone: failed > 0 || status === 'review_failed' ? 'warning' : event.action.includes('reject') || event.action.includes('archive') ? 'warning' : 'success',
      rows: [
        ...(publishedId ? [isEnglish ? `Practice question: #${publishedId}` : `练习题：#${publishedId}`] : []),
        ...(replacedId ? [isEnglish ? `Replacement source: #${replacedId}` : `替代源题：#${replacedId}`] : []),
        ...(itemStatusText ? [itemStatusText] : []),
        ...(isBulk ? [isEnglish ? `Bulk action: ${event.action}` : `批量动作：${event.action}`] : [])
      ]
    };
  }
  if (event.module === 'ai-questioning' && event.resourceType === 'quality-metric') {
    const after = record(event.after);
    const governance = record(after?.qualityGovernance);
    const requested = int(after?.requested);
    const succeeded = int(after?.succeeded);
    const failed = int(after?.failed);
    const itemCount = int(after?.itemCount);
    const itemStatusText = statusCountsText(after?.itemStatusCounts, isEnglish);
    const questionId = text(after?.questionId) || event.resourceId || '-';
    const status = text(governance?.status) || text(after?.questionStatus) || '-';
    const disposition = text(governance?.disposition) || text(after?.disposition) || event.action.replace('disposition_', '');
    const replacementQuestionId = text(governance?.replacementQuestionId);
    const replacementPublishedQuestionId = text(governance?.replacementPublishedQuestionId);
    const replacementCandidateStatus = text(after?.replacementCandidateStatus);
    const isStaleReplacement = ['archived', 'rejected'].includes(replacementCandidateStatus);
    const replacementStatusText = replacementCandidateStatus
      ? statusLabel(replacementCandidateStatus, isEnglish)
      : '';
    const replacementFollowUp = replacementQuestionId
      ? (replacementPublishedQuestionId
        ? (isEnglish ? 'Replacement is published.' : '替代题已发布。')
        : isStaleReplacement
          ? (isEnglish ? 'Replacement candidate is no longer publishable; regenerate it.' : '替代候选已失效，需要重新生成。')
          : (isEnglish ? 'Review and publish the replacement candidate next.' : '下一步审核并发布替代候选。'))
      : '';
    const assignee = text(governance?.assignedTo) || text(after?.assignedTo);
    const isBulk = event.action.startsWith('bulk_');
    const detail = isBulk
      ? (isEnglish
        ? `requested ${requested} · succeeded ${succeeded} · failed ${failed} · returned ${itemCount}`
        : `请求 ${requested} · 成功 ${succeeded} · 失败 ${failed} · 返回 ${itemCount}`)
      : replacementQuestionId
        ? (isEnglish
          ? `question #${questionId} · ${disposition} · replacement candidate #${replacementQuestionId}${replacementStatusText ? ` · ${replacementStatusText}` : ''}${replacementPublishedQuestionId ? ` · published #${replacementPublishedQuestionId}` : ''}.`
          : `题目 #${questionId} · ${disposition} · 替代候选 #${replacementQuestionId}${replacementStatusText ? ` · ${replacementStatusText}` : ''}${replacementPublishedQuestionId ? ` · 已发布 #${replacementPublishedQuestionId}` : ''}。`)
        : (isEnglish
          ? `question #${questionId} · ${disposition || status} · status ${status}.`
          : `题目 #${questionId} · ${disposition || status} · 状态 ${status}。`);
    return {
      title: qualityAuditTitle(event.action, isEnglish),
      detail,
      tone: failed > 0 || isStaleReplacement ? 'warning' : event.action.includes('archive') || event.action.includes('regenerate') || event.action.includes('manual_fix') ? 'warning' : 'success',
      rows: [
        ...(assignee ? [isEnglish ? `Assignee: #${assignee}` : `负责人：#${assignee}`] : []),
        ...(replacementQuestionId ? [isEnglish ? `Replacement candidate: #${replacementQuestionId}${replacementStatusText ? ` · ${replacementStatusText}` : ''}` : `替代候选：#${replacementQuestionId}${replacementStatusText ? ` · ${replacementStatusText}` : ''}`] : []),
        ...(replacementPublishedQuestionId ? [isEnglish ? `Published replacement: #${replacementPublishedQuestionId}` : `已发布替代题：#${replacementPublishedQuestionId}`] : []),
        ...(replacementFollowUp ? [replacementFollowUp] : []),
        ...(itemStatusText ? [itemStatusText] : [])
      ]
    };
  }
  if (event.module === 'ai-questioning' && event.resourceType === 'operational-readiness') {
    const after = record(event.after);
    const status = text(after?.status) || '-';
    const score = text(after?.score) || '-';
    const nextAction = text(after?.nextAction) || '-';
    const subject = text(after?.subject) || (isEnglish ? 'all subjects' : '全部学科');
    const blockerCount = array(after?.blockers).length;
    const warningCount = array(after?.warnings).length;
    const title = event.action === 'view_next_action'
      ? (isEnglish ? 'Bank readiness next step viewed' : '已查看题库运转下一步')
      : (isEnglish ? 'Bank readiness report downloaded' : '已下载题库运转报告');
    const format = text(after?.format).toUpperCase();
    const targetId = text(after?.targetId);
    return {
      title,
      detail: isEnglish
        ? `${subject} · score ${score}/100 · ${status} · next ${nextAction} · blockers ${blockerCount} · warnings ${warningCount}${format ? ` · ${format}` : ''}`
        : `${subject} · 就绪分 ${score}/100 · ${status} · 下一步 ${nextAction} · 阻断 ${blockerCount} · 提醒 ${warningCount}${format ? ` · ${format}` : ''}`,
      tone: status === 'blocked' ? 'danger' : status === 'needs_attention' ? 'warning' : 'neutral',
      rows: [
        ...(targetId ? [isEnglish ? `Target section: ${targetId}` : `定位区域：${targetId}`] : []),
        ...(nextAction ? [isEnglish ? `Action: ${nextAction}` : `动作：${nextAction}`] : [])
      ]
    };
  }
  if (event.module === 'ai-questioning' && event.resourceType === 'syllabus-import' && event.action === 'apply') {
    const migrations = migrationRowsFromAudit(event);
    const after = record(event.after);
    const apply = record(after?.apply);
    const refreshed = int(apply?.refreshedQuestionCount);
    const missingChanged = int(apply?.missingTopicsChanged);
    if (!migrations.length && !refreshed && !missingChanged) return null;
    const rows = migrations.slice(0, 5).map((item) => (
      `${item.previousCode} -> ${item.nextCode} · #${item.existingTopicId || '-'} · ${isEnglish ? 'affected' : '影响题目'} ${item.affectedQuestionCount} · ${isEnglish ? 'approved to review' : '通过题转复核'} ${item.approvedQuestionsBecomingPendingReview}`
    ));
    return {
      title: isEnglish ? 'Syllabus import applied' : '已应用大纲导入',
      detail: isEnglish
        ? `${migrations.length} code migration(s), ${refreshed} question(s) refreshed, ${missingChanged} missing topic(s) changed.`
        : `${migrations.length} 条 code 迁移，${refreshed} 道题进入治理，${missingChanged} 个未覆盖知识点被调整。`,
      tone: migrations.length ? 'warning' : 'neutral',
      rows
    };
  }
  if (event.module === 'ai-questioning' && event.resourceType === 'syllabus-import' && event.action === 'recovery_draft') {
    const after = record(event.after);
    const importRecord = record(after?.import);
    const preview = record(importRecord?.previewSummary);
    const recovery = record(preview?.recovery);
    const summary = record(preview?.summary);
    const draftId = text(importRecord?.id) || event.resourceId || '-';
    const sourceImportId = text(recovery?.sourceImportId) || event.resourceId || '-';
    const sourceStatus = text(recovery?.sourceImportStatus) || '-';
    const affected = int(summary?.questionsAffected);
    const approved = int(summary?.approvedQuestionsBecomingPendingReview);
    const updated = int(summary?.updatedTopics);
    const created = int(summary?.newTopics);
    return {
      title: isEnglish ? 'Syllabus recovery draft rebuilt' : '已重建大纲恢复草稿',
      detail: isEnglish
        ? `source #${sourceImportId} (${sourceStatus}) -> draft #${draftId} · ${created} new, ${updated} updated, ${affected} affected question(s), ${approved} approved to review.`
        : `来源 #${sourceImportId}（${sourceStatus}）→ 草稿 #${draftId} · 新增 ${created} · 更新 ${updated} · 影响题目 ${affected} · 通过题转复核 ${approved}。`,
      tone: affected || approved ? 'warning' : 'neutral',
      rows: [
        isEnglish ? `Source import: #${sourceImportId} (${sourceStatus})` : `来源导入：#${sourceImportId}（${sourceStatus}）`,
        isEnglish ? `Recovery draft: #${draftId}` : `恢复草稿：#${draftId}`,
        isEnglish ? 'Review refreshed impact before applying.' : '应用前需要重新查看当前影响。'
      ]
    };
  }
  if (event.module === 'ai-questioning' && event.resourceType === 'syllabus-import' && event.action === 'reverse_plan') {
    const after = record(event.after);
    const reversePlan = record(after?.reversePlan);
    const summary = record(reversePlan?.summary);
    const importId = text(reversePlan?.importId) || event.resourceId || '-';
    const subject = text(reversePlan?.subject) || '-';
    const blockerCount = int(summary?.blockerCount);
    const topicOperations = int(summary?.topicOperations);
    const missingTopicOperations = int(summary?.missingTopicOperations);
    const autoPlan = int(summary?.canAutoPlanOperations);
    const manualReview = int(summary?.manualReviewRequired);
    const questionReview = int(summary?.questionReviewCount);
    const blockers = array(reversePlan?.blockers).map(text).filter(Boolean).slice(0, 5);
    return {
      title: isEnglish ? 'Syllabus reverse plan generated' : '已生成大纲回滚预案',
      detail: isEnglish
        ? `import #${importId} · ${subject} · ${topicOperations + missingTopicOperations} operation(s), ${autoPlan} auto-plannable, ${blockerCount} blocker(s), ${manualReview} quality follow-up item(s), ${questionReview} question(s).`
        : `导入 #${importId} · ${subject} · ${topicOperations + missingTopicOperations} 项操作，可自动规划 ${autoPlan}，阻断 ${blockerCount}，需质量复核 ${manualReview}，涉及题目 ${questionReview}。`,
      tone: blockerCount || manualReview ? 'warning' : 'neutral',
      rows: [
        isEnglish ? 'Dry-run only: no topic or question was changed.' : '仅 dry-run：没有修改知识点或题目。',
        ...(blockers.length ? [isEnglish ? `Blockers: ${blockers.join(', ')}` : `阻断：${blockers.join(', ')}`] : []),
        isEnglish ? 'Use recovery draft or quality follow-up before any destructive rollback.' : '执行任何破坏性回滚前，应先用恢复草稿或质量复核。'
      ]
    };
  }
  return null;
}

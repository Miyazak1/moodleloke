import { Body, Controller, Delete, Get, Logger, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { User as PrismaUser } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import { RequiredAdminGuard } from '../auth/auth.guards';
import { recordAdminAudit } from '../admin-audit/admin-audit-log';
import { PrismaService } from '../prisma/prisma.service';
import { AdaptiveReplenishmentService } from './adaptive-replenishment.service';
import { AIQuestioningService, buildAIQuestioningOperationalReadiness, buildAIQuestioningOperationalReadinessAuditSnapshot } from './ai-questioning.service';
import { QuestionQualityService } from './question-quality.service';

function summarizeAuditResult(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object') return { result: value ?? null };
  const record = value as Record<string, unknown>;
  const summary: Record<string, unknown> = {};
  for (const key of [
    'id',
    'questionId',
    'sourceQuestionId',
    'generatedVariantOf',
    'topicId',
    'blueprintId',
    'status',
    'questionStatus',
    'needsReview',
    'reviewReason',
    'action',
    'disposition',
    'requested',
    'succeeded',
    'failed',
    'enqueued',
    'processed',
    'generated',
    'candidates',
    'targetTotal',
    'publishedTotal',
    'openTotal',
    'candidateTotal',
    'staleQuestions',
    'impactedQuestions',
    'assignedTo',
    'publishedQuestionId',
    'qualityGovernance',
    'replacementCandidateStatus',
    'created',
    'createdQuestions',
    'skipped',
    'needsReview',
    'sampleSize',
    'confidence',
    'refreshedQuestionCount',
    'missingTopicsChanged'
  ]) {
    if (record[key] !== undefined) summary[key] = record[key];
  }
  if (Array.isArray(record.items)) {
    summary.itemCount = record.items.length;
    const itemStatusCounts: Record<string, number> = {};
    let itemQuestionCount = 0;
    for (const item of record.items) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
      const row = item as Record<string, unknown>;
      if (typeof row.questionId === 'number' && row.questionId > 0) itemQuestionCount += 1;
      if (typeof row.status === 'string' && row.status) {
        itemStatusCounts[row.status] = (itemStatusCounts[row.status] ?? 0) + 1;
      }
    }
    if (itemQuestionCount > 0) summary.itemQuestionCount = itemQuestionCount;
    if (Object.keys(itemStatusCounts).length > 0) summary.itemStatusCounts = itemStatusCounts;
  }
  if (Array.isArray(record.results)) summary.resultCount = record.results.length;
  if (record.question && typeof record.question === 'object') {
    const question = record.question as Record<string, unknown>;
    summary.question = {
      id: question.id,
      status: question.status,
      reviewStatus: question.reviewStatus,
      subject: question.subject
    };
  }
  if (record.blueprint && typeof record.blueprint === 'object') {
    const blueprint = record.blueprint as Record<string, unknown>;
    summary.blueprint = {
      id: blueprint.id,
      status: blueprint.status,
      subject: blueprint.subject,
      topicId: blueprint.topicId
    };
  }
  if (record.import && typeof record.import === 'object') {
    const importRecord = record.import as Record<string, unknown>;
    const previewSummary = importRecord.previewSummary && typeof importRecord.previewSummary === 'object'
      ? importRecord.previewSummary as Record<string, unknown>
      : null;
    summary.import = {
      id: importRecord.id,
      subject: importRecord.subject,
      syllabusVersion: importRecord.syllabusVersion,
      status: importRecord.status,
      ...(previewSummary ? {
        previewSummary: {
          ...(previewSummary.summary && typeof previewSummary.summary === 'object' ? { summary: previewSummary.summary } : {}),
          ...(previewSummary.apply && typeof previewSummary.apply === 'object' ? { apply: previewSummary.apply } : {}),
          ...(previewSummary.recovery && typeof previewSummary.recovery === 'object' ? { recovery: previewSummary.recovery } : {})
        }
      } : {})
    };
  }
  if (record.reversePlan && typeof record.reversePlan === 'object') {
    const reversePlan = record.reversePlan as Record<string, unknown>;
    summary.reversePlan = {
      mode: reversePlan.mode,
      importId: reversePlan.importId,
      importStatus: reversePlan.importStatus,
      subject: reversePlan.subject,
      syllabusVersion: reversePlan.syllabusVersion,
      summary: reversePlan.summary,
      blockers: Array.isArray(reversePlan.blockers) ? reversePlan.blockers.slice(0, 12) : []
    };
  }
  if (record.summary && typeof record.summary === 'object') {
    const item = record.summary as Record<string, unknown>;
    summary.summary = {
      subject: item.subject,
      syllabusVersion: item.syllabusVersion,
      topicsInFile: item.topicsInFile,
      newTopics: item.newTopics,
      updatedTopics: item.updatedTopics,
      questionsAffected: item.questionsAffected,
      topicsScanned: item.topicsScanned,
      topicsSelected: item.topicsSelected,
      blueprintsCreated: item.blueprintsCreated,
      jobsEnqueued: item.jobsEnqueued,
      jobsSkipped: item.jobsSkipped,
      jobsProcessed: item.jobsProcessed,
      jobsSucceeded: item.jobsSucceeded,
      jobsFailed: item.jobsFailed,
      candidatesCreated: item.candidatesCreated
    };
  }
  return Object.keys(summary).length > 0 ? summary : { ok: true };
}

function actorEmailFromUser(user: PrismaUser | undefined) {
  return user?.email ?? user?.loginName ?? undefined;
}

function mapOperationalReadinessAuditEvent(
  event: Awaited<ReturnType<PrismaService['adminAuditLog']['findFirst']>>,
  actorEmail?: string
) {
  if (!event) return null;
  return {
    id: event.id,
    actorId: event.actorId ?? undefined,
    actorEmail,
    module: event.module,
    resourceType: event.resourceType,
    resourceId: event.resourceId ?? undefined,
    action: event.action,
    after: event.after,
    createdAt: event.createdAt.toISOString()
  };
}

@Controller()
@UseGuards(RequiredAdminGuard)
export class AIQuestioningController {
  private readonly logger = new Logger(AIQuestioningController.name);

  constructor(
    private readonly service: AIQuestioningService,
    private readonly qualityService: QuestionQualityService,
    private readonly adaptiveReplenishmentService: AdaptiveReplenishmentService,
    private readonly prisma: PrismaService
  ) {}

  private async audit<T>(
    user: PrismaUser | undefined,
    resourceType: string,
    resourceId: string | number | undefined,
    action: string,
    work: () => Promise<T> | T
  ) {
    const result = await work();
    await recordAdminAudit(this.prisma, {
      actorId: user?.id,
      module: 'ai-questioning',
      resourceType,
      resourceId,
      action,
      after: summarizeAuditResult(result)
    });
    return result;
  }

  private async auditBestEffort<T>(
    user: PrismaUser | undefined,
    resourceType: string,
    resourceId: string | number | undefined,
    action: string,
    work: () => Promise<T> | T
  ) {
    const result = await work();
    try {
      await recordAdminAudit(this.prisma, {
        actorId: user?.id,
        module: 'ai-questioning',
        resourceType,
        resourceId,
        action,
        after: summarizeAuditResult(result)
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Admin audit failed after ${action}; primary operation succeeded: ${message}`);
    }
    return result;
  }

  private async buildOperationalReadiness(query: Record<string, unknown>) {
    const subject = typeof query.subject === 'string' && query.subject ? query.subject : undefined;
    const requestedUseCase = typeof query.useCase === 'string' ? query.useCase : undefined;
    const useCase = requestedUseCase === 'subject_practice' || requestedUseCase === 'online_mock_exam' ? requestedUseCase : undefined;
    const [blueprintCoverage, topicHealth, generationQueue, syllabusGovernance, qualityGovernance] = await Promise.all([
      this.service.blueprintCoverageSummary({ subject }),
      this.service.topicQuestionBankHealth({ subject, limit: 100 }),
      this.service.generationQueueHealth({ subject, useCase, limit: 100 }),
      this.service.syllabusGovernanceSummary({ subject }),
      this.qualityService.governanceSummary({ subject, useCase })
    ]);
    const readiness = buildAIQuestioningOperationalReadiness({
      subject,
      useCase,
      blueprintCoverage,
      topicHealth,
      generationQueue,
      syllabusGovernance,
      qualityGovernance
    });
    const latestAuditEvent = await this.prisma.adminAuditLog.findFirst({
      where: {
        module: 'ai-questioning',
        resourceType: 'operational-readiness',
        resourceId: readiness.subject ?? 'all-subjects'
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]
    });
    const latestAuditActor = latestAuditEvent?.actorId
      ? await this.prisma.user.findUnique({
          where: { id: latestAuditEvent.actorId },
          select: { email: true, loginName: true }
        })
      : null;
    return {
      ...readiness,
      latestAuditEvent: mapOperationalReadinessAuditEvent(latestAuditEvent, latestAuditActor?.email ?? latestAuditActor?.loginName ?? undefined)
    };
  }

  @Get(['api/v1/admin/ai-questioning/blueprints'])
  listBlueprints(@Query() query: Record<string, unknown>) {
    return this.service.listBlueprints(query);
  }

  @Post(['api/v1/admin/ai-questioning/blueprints'])
  createBlueprint(@Body() body: Record<string, unknown>, @CurrentUser() user: PrismaUser) {
    return this.audit(user, 'blueprint', undefined, 'create', () => this.service.createBlueprint(body));
  }

  @Patch(['api/v1/admin/ai-questioning/blueprints/:id'])
  updateBlueprint(@Param('id') id: string, @Body() body: Record<string, unknown> = {}, @CurrentUser() user: PrismaUser) {
    return this.audit(user, 'blueprint', id, 'update_constraints', () => this.service.updateBlueprint(id, body, user.id));
  }

  @Get(['api/v1/admin/ai-questioning/blueprint-coverage'])
  blueprintCoverageSummary(@Query() query: Record<string, unknown>) {
    return this.service.blueprintCoverageSummary(query);
  }

  @Post(['api/v1/admin/ai-questioning/blueprint-coverage/ensure'])
  ensureBlueprintCoverage(@Body() body: Record<string, unknown> = {}, @CurrentUser() user: PrismaUser) {
    return this.audit(user, 'blueprint-coverage', undefined, 'ensure', () => this.service.ensureBlueprintCoverage(body));
  }

  @Get(['api/v1/admin/ai-questioning/topic-health'])
  topicQuestionBankHealth(@Query() query: Record<string, unknown>) {
    return this.service.topicQuestionBankHealth(query);
  }

  @Get(['api/v1/admin/ai-questioning/adaptive-replenishment/team-scopes'])
  adaptiveReplenishmentTeamScopes(@Query() query: Record<string, unknown>) {
    return this.adaptiveReplenishmentService.teamScopes(query);
  }

  @Get(['api/v1/admin/ai-questioning/adaptive-replenishment/inventory'])
  adaptiveReplenishmentInventory(@Query() query: Record<string, unknown>) {
    return this.adaptiveReplenishmentService.inventory(query);
  }

  @Post(['api/v1/admin/ai-questioning/adaptive-replenishment/run'])
  runAdaptiveReplenishment(@Body() body: Record<string, unknown> = {}, @CurrentUser() user: PrismaUser) {
    return this.audit(user, 'adaptive-replenishment', body.subject ? String(body.subject) : 'all-subjects', 'run', () => (
      this.service.runSubjectPracticePredictiveReplenishment(body, user?.id)
    ));
  }

  @Post(['api/v1/admin/ai-questioning/adaptive-replenishment/usage-aggregates/refresh'])
  refreshAdaptiveUsageAggregates(@Body() body: Record<string, unknown> = {}, @CurrentUser() user: PrismaUser) {
    return this.audit(user, 'adaptive-replenishment-usage', body.subject ? String(body.subject) : 'all-subjects', 'refresh', () => (
      this.service.refreshAdaptiveUsageAggregates(body)
    ));
  }

  @Get(['api/v1/admin/ai-questioning/topic-health/:topicId/detail'])
  topicQuestionBankDetail(@Param('topicId') topicId: string) {
    return this.service.topicQuestionBankDetail(topicId);
  }

  @Get(['api/v1/admin/ai-questioning/operational-readiness'])
  async operationalReadiness(@Query() query: Record<string, unknown>) {
    return this.buildOperationalReadiness(query);
  }

  @Post(['api/v1/admin/ai-questioning/operational-readiness/events'])
  async recordOperationalReadinessEvent(@Body() body: Record<string, unknown> = {}, @CurrentUser() user: PrismaUser) {
    const subject = typeof body.subject === 'string' && body.subject ? body.subject : undefined;
    const useCase = body.useCase === 'subject_practice' || body.useCase === 'online_mock_exam' ? body.useCase : undefined;
    const readiness = await this.buildOperationalReadiness({ subject, useCase });
    const after = buildAIQuestioningOperationalReadinessAuditSnapshot(readiness, body);
    const auditEvent = await recordAdminAudit(this.prisma, {
      actorId: user?.id,
      module: 'ai-questioning',
      resourceType: 'operational-readiness',
      resourceId: readiness.subject ?? 'all-subjects',
      action: after.event,
      after
    });
    return {
      ok: true,
      event: after.event,
      readiness: after,
      latestAuditEvent: mapOperationalReadinessAuditEvent(auditEvent, actorEmailFromUser(user))
    };
  }

  @Post(['api/v1/admin/ai-questioning/topics/:topicId/actions'])
  runTopicAction(@Param('topicId') topicId: string, @Body() body: Record<string, unknown> = {}, @CurrentUser() user: PrismaUser) {
    return this.audit(user, 'topic', topicId, `run_${String(body.action ?? 'action')}`, () => this.service.runTopicAction(topicId, body));
  }

  @Post(['api/v1/admin/ai-questioning/topics/bulk-actions'])
  runTopicBulkAction(@Body() body: Record<string, unknown> = {}, @CurrentUser() user: PrismaUser) {
    return this.audit(user, 'topic', undefined, `bulk_${String(body.action ?? 'action')}`, () => this.service.bulkTopicAction(body));
  }

  @Post(['api/v1/admin/ai-questioning/blueprints/:id/generate'])
  generateCandidate(@Param('id') id: string, @Body() body: Record<string, unknown> = {}, @CurrentUser() user: PrismaUser) {
    return this.audit(user, 'blueprint', id, body.force ? 'force_generate_candidate' : 'generate_candidate', () => {
      if (body.force) return this.service.generateCandidate(id, { force: true });
      return this.service.generateCandidate(id);
    });
  }

  @Post(['api/v1/admin/ai-questioning/blueprints/:id/pause'])
  pauseBlueprint(@Param('id') id: string, @Body() body: Record<string, unknown> = {}, @CurrentUser() user: PrismaUser) {
    return this.audit(user, 'blueprint', id, 'pause', () => this.service.updateBlueprintStatus(id, 'paused', body));
  }

  @Post(['api/v1/admin/ai-questioning/blueprints/:id/resume'])
  resumeBlueprint(@Param('id') id: string, @Body() body: Record<string, unknown> = {}, @CurrentUser() user: PrismaUser) {
    return this.audit(user, 'blueprint', id, 'resume', () => this.service.updateBlueprintStatus(id, 'active', body));
  }

  @Post(['api/v1/admin/ai-questioning/blueprints/:id/confirm-syllabus'])
  confirmBlueprintSyllabus(@Param('id') id: string, @Body() body: Record<string, unknown> = {}, @CurrentUser() user: PrismaUser) {
    return this.audit(user, 'blueprint', id, 'confirm_syllabus', () => this.service.confirmBlueprintSyllabusSync(id, body, user.id));
  }

  @Post(['api/v1/admin/ai-questioning/blueprints/generate-batch'])
  generateBatch(@Body() body: Record<string, unknown>, @CurrentUser() user: PrismaUser) {
    return this.audit(user, 'blueprint', undefined, 'generate_batch', () => this.service.generateBatch(body));
  }

  @Get(['api/v1/admin/ai-questioning/generation-jobs'])
  listGenerationJobs(@Query() query: Record<string, unknown>) {
    return this.service.listGenerationJobs(query);
  }

  @Get(['api/v1/admin/ai-questioning/generation-jobs/health'])
  generationQueueHealth(@Query() query: Record<string, unknown>) {
    return this.service.generationQueueHealth(query);
  }

  @Post(['api/v1/admin/ai-questioning/generation-jobs/enqueue'])
  enqueueGenerationJobs(@Body() body: Record<string, unknown> = {}, @CurrentUser() user: PrismaUser) {
    return this.audit(user, 'generation-job', undefined, 'enqueue', () => this.service.enqueueGenerationJobs(body));
  }

  @Post(['api/v1/admin/ai-questioning/generation-jobs/process'])
  processGenerationJobs(@Body() body: Record<string, unknown> = {}, @CurrentUser() user: PrismaUser) {
    return this.audit(user, 'generation-job', undefined, 'process', () => this.service.processGenerationJobs(body));
  }

  @Post(['api/v1/admin/ai-questioning/generation-jobs/bulk'])
  bulkGenerationJobAction(@Body() body: Record<string, unknown> = {}, @CurrentUser() user: PrismaUser) {
    return this.audit(user, 'generation-job', undefined, `bulk_${String(body.action ?? 'action')}`, () => this.service.bulkGenerationJobAction(body));
  }

  @Post(['api/v1/admin/ai-questioning/pregeneration/run'])
  runPregeneration(@Body() body: Record<string, unknown> = {}, @CurrentUser() user: PrismaUser) {
    return this.audit(user, 'pregeneration', undefined, 'run', () => this.service.runPregeneration(body));
  }

  @Get(['api/v1/admin/ai-questioning/subject-practice-production-runs'])
  listSubjectPracticeProductionRuns(@Query() query: Record<string, unknown> = {}) {
    return this.service.subjectPracticeProductionRuns(query);
  }

  @Get(['api/v1/admin/ai-questioning/subject-practice-auto-production-settings/:subject'])
  getSubjectPracticeAutoProductionSetting(@Param('subject') subject: string) {
    return this.service.subjectPracticeAutoProductionSetting(subject);
  }

  @Post(['api/v1/admin/ai-questioning/subject-practice-auto-production-settings/:subject'])
  updateSubjectPracticeAutoProductionSetting(@Param('subject') subject: string, @Body() body: Record<string, unknown> = {}, @CurrentUser() user: PrismaUser) {
    return this.audit(user, 'subject-practice-auto-production-setting', subject, 'update', () => this.service.updateSubjectPracticeAutoProductionSetting(subject, body, user.id));
  }

  @Get(['api/v1/admin/ai-questioning/subject-practice-production-runs/:id'])
  getSubjectPracticeProductionRun(@Param('id') id: string) {
    return this.service.subjectPracticeProductionRun(id);
  }

  @Post(['api/v1/admin/ai-questioning/subject-practice-production-runs'])
  createSubjectPracticeProductionRun(@Body() body: Record<string, unknown> = {}, @CurrentUser() user: PrismaUser) {
    return this.audit(user, 'subject-practice-production-run', undefined, 'create', () => this.service.createSubjectPracticeProductionRun(body, user.id));
  }

  @Post(['api/v1/admin/ai-questioning/subject-practice-production-runs/:id/process'])
  processSubjectPracticeProductionRun(@Param('id') id: string, @Body() body: Record<string, unknown> = {}, @CurrentUser() user: PrismaUser) {
    return this.audit(user, 'subject-practice-production-run', id, 'process', () => this.service.processSubjectPracticeProductionRun(id, body, user?.id));
  }

  @Post(['api/v1/admin/ai-questioning/subject-practice-production-runs/:id/cancel'])
  cancelSubjectPracticeProductionRun(@Param('id') id: string, @Body() body: Record<string, unknown> = {}, @CurrentUser() user: PrismaUser) {
    return this.audit(user, 'subject-practice-production-run', id, 'cancel', () => this.service.cancelSubjectPracticeProductionRun(id, body));
  }

  @Get(['api/v1/admin/ai-questioning/subject-practice-observation-tasks'])
  listSubjectPracticeObservationTasks(@Query() query: Record<string, unknown> = {}) {
    return this.service.listSubjectPracticeObservationTasks(query);
  }

  @Post(['api/v1/admin/ai-questioning/subject-practice-observation-runtime-probe'])
  subjectPracticeObservationRuntimeProbe() {
    return this.service.subjectPracticeObservationRuntimeProbe();
  }

  @Post(['api/v1/admin/ai-questioning/subject-practice-observation-tasks'])
  submitSubjectPracticeObservationTask(@Body() body: Record<string, unknown> = {}, @CurrentUser() user: PrismaUser) {
    return this.audit(user, 'subject-practice-observation-task', undefined, 'submit', () => this.service.submitSubjectPracticeObservationTask(body, user.id));
  }

  @Get(['api/v1/admin/ai-questioning/subject-practice-observation-tasks/:id'])
  getSubjectPracticeObservationTask(@Param('id') id: string) {
    return this.service.getSubjectPracticeObservationTask(id);
  }

  @Post(['api/v1/admin/ai-questioning/subject-practice-observation-tasks/:id/cancel'])
  cancelSubjectPracticeObservationTask(@Param('id') id: string, @CurrentUser() user: PrismaUser) {
    return this.audit(user, 'subject-practice-observation-task', id, 'cancel', () => this.service.cancelSubjectPracticeObservationTask(id));
  }

  @Post(['api/v1/admin/ai-questioning/generation-jobs/:id/retry'])
  retryGenerationJob(@Param('id') id: string, @CurrentUser() user: PrismaUser) {
    return this.audit(user, 'generation-job', id, 'retry', () => this.service.retryGenerationJob(id));
  }

  @Get(['api/v1/admin/ai-questioning/questions'])
  listQuestions(@Query() query: Record<string, unknown>) {
    return this.service.listQuestions(query);
  }

  @Post(['api/v1/admin/ai-questioning/cleanup'])
  cleanupSubjectPracticeAiScope(@Body() body: Record<string, unknown> = {}, @CurrentUser() user: PrismaUser) {
    return this.audit(user, 'ai-questioning-cleanup', undefined, 'cleanup_subject_practice_scope', () => this.service.cleanupSubjectPracticeAiScope(body));
  }

  @Get(['api/v1/admin/ai-questioning/source-documents'])
  listSourceDocuments(@Query() query: Record<string, unknown> = {}) {
    return this.service.listSourceDocuments(query);
  }

  @Get(['api/v1/admin/ai-questioning/source-references/summary'])
  sourceReferenceSummary(@Query() query: Record<string, unknown> = {}) {
    return this.service.sourceReferenceSummary(query);
  }

  @Post(['api/v1/admin/ai-questioning/source-documents/import'])
  importSourceDocumentJson(@Body() body: Record<string, unknown> = {}, @CurrentUser() user: PrismaUser) {
    return this.auditBestEffort(user, 'source-document', undefined, 'import_json', () => this.service.importSourceDocumentJson(body, user.id));
  }

  @Get(['api/v1/admin/ai-questioning/source-documents/:id/profile-visualization'])
  sourceDocumentProfileVisualization(@Param('id') id: string) {
    return this.service.sourceDocumentProfileVisualization(id);
  }

  @Post(['api/v1/admin/ai-questioning/source-documents/:id/reprocess'])
  reprocessSourceDocument(@Param('id') id: string, @Body() body: Record<string, unknown> = {}, @CurrentUser() user: PrismaUser) {
    return this.audit(user, 'source-document', id, 'reprocess_profile', () => this.service.reprocessSourceDocument(id, body, user.id));
  }

  @Delete(['api/v1/admin/ai-questioning/source-documents/:id'])
  deleteSourceDocument(@Param('id') id: string, @CurrentUser() user: PrismaUser) {
    return this.audit(user, 'source-document', id, 'delete', () => this.service.deleteSourceDocument(id));
  }

  @Post(['api/v1/admin/ai-questioning/source-documents/cleanup'])
  cleanupSourceDocuments(@Body() body: Record<string, unknown> = {}, @CurrentUser() user: PrismaUser) {
    return this.audit(user, 'source-document', undefined, 'cleanup', () => this.service.cleanupSourceDocuments(body));
  }

  @Post(['api/v1/admin/ai-questioning/source-profile-pipeline/rebuild'])
  rebuildSourceProfilePipeline(@Body() body: Record<string, unknown> = {}, @CurrentUser() user: PrismaUser) {
    return this.audit(user, 'source-profile-pipeline', undefined, 'manual_rebuild', () => this.service.startSourceProfilePipelineManualRebuild(body, user.id));
  }

  @Get(['api/v1/admin/ai-questioning/source-questions'])
  listSourceQuestions(@Query() query: Record<string, unknown> = {}) {
    return this.service.listSourceQuestions(query);
  }

  @Get(['api/v1/admin/ai-questioning/topic-options'])
  listTopicOptions(@Query() query: Record<string, unknown> = {}) {
    return this.service.listTopicOptions(query);
  }

  @Post(['api/v1/admin/ai-questioning/source-questions/bulk-review'])
  bulkReviewSourceQuestions(@Body() body: Record<string, unknown> = {}, @CurrentUser() user: PrismaUser) {
    return this.audit(user, 'source-question', undefined, 'bulk_review', () => this.service.bulkReviewSourceQuestions(body));
  }

  @Post(['api/v1/admin/ai-questioning/source-questions/topic-suggestions'])
  suggestSourceQuestionTopicMappings(@Body() body: Record<string, unknown> = {}, @CurrentUser() user: PrismaUser) {
    return this.audit(user, 'source-question', undefined, 'topic_suggestions', () => this.service.suggestSourceQuestionTopicMappings(body));
  }

  @Post(['api/v1/admin/ai-questioning/source-questions/apply-topic-suggestions'])
  applySourceQuestionTopicSuggestions(@Body() body: Record<string, unknown> = {}, @CurrentUser() user: PrismaUser) {
    return this.audit(user, 'source-question', undefined, 'apply_topic_suggestions', () => this.service.applySourceQuestionTopicSuggestions(body));
  }

  @Get(['api/v1/admin/ai-questioning/source-questions/topic-mapping-tasks'])
  listSourceQuestionTopicTasks(@Query() query: Record<string, unknown> = {}) {
    return this.service.listSourceQuestionTopicTasks(query);
  }

  @Post(['api/v1/admin/ai-questioning/source-questions/topic-mapping-tasks'])
  startSourceQuestionTopicTask(@Body() body: Record<string, unknown> = {}, @CurrentUser() user: PrismaUser) {
    return this.audit(user, 'source-question-topic-task', undefined, String(body.action ?? 'start'), () => this.service.startSourceQuestionTopicTask(body, user.id));
  }

  @Get(['api/v1/admin/ai-questioning/source-questions/topic-mapping-tasks/:id'])
  getSourceQuestionTopicTask(@Param('id') id: string) {
    return this.service.getSourceQuestionTopicTask(id);
  }

  @Get(['api/v1/admin/ai-questioning/source-questions/auto-profile-tasks'])
  listSourceQuestionAutoProfileTasks(@Query() query: Record<string, unknown> = {}) {
    return this.service.listSourceQuestionAutoProfileTasks(query);
  }

  @Post(['api/v1/admin/ai-questioning/source-questions/auto-profile-tasks'])
  startSourceQuestionAutoProfileTask(@Body() body: Record<string, unknown> = {}, @CurrentUser() user: PrismaUser) {
    return this.audit(user, 'source-question-auto-profile-task', undefined, String(body.action ?? 'start'), () => this.service.startSourceQuestionAutoProfileTask(body, user.id));
  }

  @Get(['api/v1/admin/ai-questioning/source-questions/auto-profile-tasks/:id'])
  getSourceQuestionAutoProfileTask(@Param('id') id: string) {
    return this.service.getSourceQuestionAutoProfileTask(id);
  }

  @Post(['api/v1/admin/ai-questioning/source-questions/:id/review'])
  reviewSourceQuestion(@Param('id') id: string, @Body() body: Record<string, unknown> = {}, @CurrentUser() user: PrismaUser) {
    return this.audit(user, 'source-question', id, 'review', () => this.service.reviewSourceQuestion(id, body));
  }

  @Get(['api/v1/admin/ai-questioning/style-profiles'])
  listStyleProfiles(@Query() query: Record<string, unknown> = {}) {
    return this.service.listStyleProfiles(query);
  }

  @Post(['api/v1/admin/ai-questioning/style-profiles/generate'])
  generateStyleProfile(@Body() body: Record<string, unknown> = {}, @CurrentUser() user: PrismaUser) {
    return this.audit(user, 'style-profile', undefined, 'generate', () => this.service.generateStyleProfile(body));
  }

  @Get(['api/v1/admin/ai-questioning/exam-series-profiles'])
  listExamSeriesProfiles(@Query() query: Record<string, unknown> = {}) {
    return this.service.listExamSeriesProfiles(query);
  }

  @Post(['api/v1/admin/ai-questioning/exam-series-profiles/generate'])
  generateExamSeriesProfile(@Body() body: Record<string, unknown> = {}, @CurrentUser() user: PrismaUser) {
    return this.audit(user, 'exam-series-profile', undefined, 'generate', () => this.service.generateExamSeriesProfile(body));
  }

  @Post(['api/v1/admin/ai-questioning/exam-series-profiles/:id/activate'])
  activateExamSeriesProfile(@Param('id') id: string, @CurrentUser() user: PrismaUser) {
    return this.audit(user, 'exam-series-profile', id, 'activate', () => this.service.activateExamSeriesProfile(id));
  }

  @Get(['api/v1/admin/ai-questioning/generation-profiles'])
  listGenerationProfiles(@Query() query: Record<string, unknown> = {}) {
    return this.service.listGenerationProfiles(query);
  }

  @Post(['api/v1/admin/ai-questioning/generation-profiles/generate'])
  generateGenerationProfile(@Body() body: Record<string, unknown> = {}, @CurrentUser() user: PrismaUser) {
    return this.audit(user, 'generation-profile', undefined, 'generate', () => this.service.generateGenerationProfile(body));
  }

  @Post(['api/v1/admin/ai-questioning/generation-profiles/:id/activate'])
  activateGenerationProfile(@Param('id') id: string, @CurrentUser() user: PrismaUser) {
    return this.audit(user, 'generation-profile', id, 'activate', () => this.service.activateGenerationProfile(id));
  }

  @Get(['api/v1/admin/ai-questioning/question-ledger'])
  listQuestionLedger(@Query() query: Record<string, unknown>) {
    return this.service.listQuestionLedger(query);
  }

  @Post(['api/v1/admin/ai-questioning/question-version-governance/refresh'])
  refreshQuestionVersionGovernance(@Body() body: Record<string, unknown> = {}, @CurrentUser() user: PrismaUser) {
    return this.audit(user, 'question-version-governance', undefined, 'refresh', () => this.service.refreshQuestionVersionGovernance(body));
  }

  @Get(['api/v1/admin/ai-questioning/questions/:id/agent-runs'])
  listQuestionAgentRuns(@Param('id') id: string) {
    return this.service.listQuestionAgentRuns(id);
  }

  @Post(['api/v1/admin/ai-questioning/questions/bulk'])
  bulkQuestionAction(@Body() body: Record<string, unknown> = {}, @CurrentUser() user: PrismaUser) {
    return this.audit(user, 'question', undefined, `bulk_${String(body.action ?? 'action')}`, () => this.service.bulkQuestionAction(body));
  }

  @Get(['api/v1/admin/ai-questioning/questions/bulk-tasks'])
  listCandidateQuestionBulkTasks(@Query() query: Record<string, unknown> = {}) {
    return this.service.listCandidateQuestionBulkTasks(query);
  }

  @Post(['api/v1/admin/ai-questioning/questions/bulk-tasks'])
  startCandidateQuestionBulkTask(@Body() body: Record<string, unknown> = {}, @CurrentUser() user: PrismaUser) {
    return this.audit(user, 'question-bulk-task', undefined, `start_${String(body.action ?? 'action')}`, () => this.service.startCandidateQuestionBulkTask(body, user.id));
  }

  @Get(['api/v1/admin/ai-questioning/questions/bulk-tasks/:id'])
  getCandidateQuestionBulkTask(@Param('id') id: string) {
    return this.service.getCandidateQuestionBulkTask(id);
  }

  @Get(['api/v1/admin/ai-questioning/questions/:id'])
  getQuestion(@Param('id') id: string) {
    return this.service.getQuestion(id);
  }

  @Get(['api/v1/admin/ai-questioning/syllabus-governance'])
  syllabusGovernanceSummary(@Query() query: Record<string, unknown>) {
    return this.service.syllabusGovernanceSummary(query);
  }

  @Post(['api/v1/admin/ai-questioning/syllabus-governance/refresh'])
  refreshSyllabusGovernance(@Body() body: Record<string, unknown> = {}, @CurrentUser() user: PrismaUser) {
    return this.audit(user, 'syllabus-governance', undefined, 'refresh', () => this.service.refreshSyllabusGovernance(body));
  }

  @Post(['api/v1/admin/ai-questioning/syllabus-governance/questions/:questionId/confirm'])
  confirmSyllabusQuestionReview(@Param('questionId') questionId: string, @Body() body: Record<string, unknown> = {}, @CurrentUser() user: PrismaUser) {
    return this.audit(user, 'syllabus-question', questionId, 'confirm_current', () => this.service.confirmSyllabusQuestionReview(questionId, body, user.id));
  }

  @Post(['api/v1/admin/ai-questioning/syllabus-imports/preview'])
  previewSyllabusJsonImport(@Body() body: Record<string, unknown> = {}) {
    return this.service.previewSyllabusJsonImport(body);
  }

  @Get(['api/v1/admin/ai-questioning/syllabus-imports/template'])
  syllabusJsonImportTemplate(@Query() query: Record<string, unknown> = {}) {
    return this.service.syllabusJsonImportTemplate(query);
  }

  @Get(['api/v1/admin/ai-questioning/syllabus-imports'])
  listSyllabusJsonImports(@Query() query: Record<string, unknown> = {}) {
    return this.service.listSyllabusJsonImports(query);
  }

  @Post(['api/v1/admin/ai-questioning/syllabus-imports'])
  createSyllabusJsonImport(@Body() body: Record<string, unknown> = {}, @CurrentUser() user: PrismaUser) {
    return this.audit(user, 'syllabus-import', undefined, 'create', () => this.service.createSyllabusJsonImport(body, user.id));
  }

  @Get(['api/v1/admin/ai-questioning/syllabus-imports/:id'])
  getSyllabusJsonImport(@Param('id') id: string) {
    return this.service.getSyllabusJsonImport(id);
  }

  @Post(['api/v1/admin/ai-questioning/syllabus-imports/:id/apply'])
  applySyllabusJsonImport(@Param('id') id: string, @Body() body: Record<string, unknown> = {}, @CurrentUser() user: PrismaUser) {
    return this.audit(user, 'syllabus-import', id, 'apply', () => this.service.applySyllabusJsonImport(id, body, user.id));
  }

  @Post(['api/v1/admin/ai-questioning/syllabus-imports/:id/recovery-draft'])
  createSyllabusJsonImportRecoveryDraft(@Param('id') id: string, @CurrentUser() user: PrismaUser) {
    return this.audit(user, 'syllabus-import', id, 'recovery_draft', () => this.service.createSyllabusJsonImportRecoveryDraft(id, user.id));
  }

  @Post(['api/v1/admin/ai-questioning/syllabus-imports/:id/reverse-plan'])
  createSyllabusJsonImportReversePlan(@Param('id') id: string, @CurrentUser() user: PrismaUser) {
    return this.audit(user, 'syllabus-import', id, 'reverse_plan', () => this.service.createSyllabusJsonImportReversePlan(id));
  }

  @Post(['api/v1/admin/ai-questioning/syllabus-imports/:id/archive'])
  archiveSyllabusJsonImport(@Param('id') id: string, @CurrentUser() user: PrismaUser) {
    return this.audit(user, 'syllabus-import', id, 'archive', () => this.service.archiveSyllabusJsonImport(id));
  }

  @Post(['api/v1/admin/ai-questioning/syllabus-governance/bulk-preview'])
  previewSyllabusBulkUpdate(@Body() body: Record<string, unknown> = {}) {
    return this.service.previewSyllabusBulkUpdate(body);
  }

  @Post(['api/v1/admin/ai-questioning/syllabus-governance/bulk-apply'])
  applySyllabusBulkUpdate(@Body() body: Record<string, unknown> = {}, @CurrentUser() user: PrismaUser) {
    return this.audit(user, 'syllabus-topic', undefined, 'bulk_apply', () => this.service.applySyllabusBulkUpdate(body, user.id));
  }

  @Post(['api/v1/admin/ai-questioning/syllabus-governance/topics/:topicId/preview'])
  previewSyllabusTopicUpdate(@Param('topicId') topicId: string, @Body() body: Record<string, unknown> = {}) {
    return this.service.previewSyllabusTopicUpdate(topicId, body);
  }

  @Post(['api/v1/admin/ai-questioning/syllabus-governance/topics/:topicId/apply'])
  applySyllabusTopicUpdate(@Param('topicId') topicId: string, @Body() body: Record<string, unknown> = {}, @CurrentUser() user: PrismaUser) {
    return this.audit(user, 'syllabus-topic', topicId, 'apply', () => this.service.applySyllabusTopicUpdate(topicId, body, user.id));
  }

  @Get(['api/v1/admin/ai-questioning/remediation'])
  remediationSummary(@Query() query: Record<string, unknown>) {
    return this.service.remediationSummary(query);
  }

  @Get(['api/v1/admin/ai-questioning/misconceptions'])
  listMisconceptions(@Query() query: Record<string, unknown>) {
    return this.service.listMisconceptions(query);
  }

  @Patch(['api/v1/admin/ai-questioning/misconceptions/:id'])
  updateMisconception(@Param('id') id: string, @Body() body: Record<string, unknown> = {}, @CurrentUser() user: PrismaUser) {
    return this.audit(user, 'misconception', id, 'update', () => this.service.updateMisconception(id, body));
  }

  @Post(['api/v1/admin/ai-questioning/misconceptions/:id/archive'])
  archiveMisconception(@Param('id') id: string, @CurrentUser() user: PrismaUser) {
    return this.audit(user, 'misconception', id, 'archive', () => this.service.updateMisconceptionStatus(id, 'archived'));
  }

  @Post(['api/v1/admin/ai-questioning/misconceptions/:id/restore'])
  restoreMisconception(@Param('id') id: string, @CurrentUser() user: PrismaUser) {
    return this.audit(user, 'misconception', id, 'restore', () => this.service.updateMisconceptionStatus(id, 'active'));
  }

  @Post(['api/v1/admin/ai-questioning/misconceptions/:id/needs-review'])
  reviewMisconception(@Param('id') id: string, @CurrentUser() user: PrismaUser) {
    return this.audit(user, 'misconception', id, 'mark_needs_review', () => this.service.updateMisconceptionStatus(id, 'needs_review'));
  }

  @Post(['api/v1/admin/ai-questioning/misconceptions/:id/merge'])
  mergeMisconception(@Param('id') id: string, @Body() body: Record<string, unknown> = {}, @CurrentUser() user: PrismaUser) {
    return this.audit(user, 'misconception', id, 'merge', () => this.service.mergeMisconception(id, body));
  }

  @Post(['api/v1/admin/ai-questioning/misconceptions/:id/concept-card'])
  createConceptCardForMisconception(@Param('id') id: string, @Body() body: Record<string, unknown> = {}, @CurrentUser() user: PrismaUser) {
    return this.audit(user, 'misconception', id, 'create_concept_card', () => this.service.createConceptCardForMisconception(id, body));
  }

  @Post(['api/v1/admin/ai-questioning/misconceptions/:id/variant'])
  createVariantForMisconception(@Param('id') id: string, @Body() body: Record<string, unknown> = {}, @CurrentUser() user: PrismaUser) {
    return this.audit(user, 'misconception', id, 'create_variant', () => this.service.createVariantForMisconception(id, body));
  }

  @Get(['api/v1/admin/ai-questioning/quality'])
  listQuality(@Query() query: Record<string, unknown>) {
    const assignedTo = Number(query.assignedTo);
    return this.qualityService.listMetrics({
      subject: typeof query.subject === 'string' && query.subject ? query.subject : undefined,
      needsReview: query.needsReview === 'true' ? true : query.needsReview === 'false' ? false : undefined,
      assignedTo: Number.isInteger(assignedTo) && assignedTo > 0 ? assignedTo : undefined,
      unassigned: query.unassigned === 'true' ? true : undefined,
      reviewReason: typeof query.reviewReason === 'string' && query.reviewReason ? query.reviewReason : undefined,
      recommendedAction: typeof query.recommendedAction === 'string' && query.recommendedAction ? query.recommendedAction : undefined,
      severity: typeof query.severity === 'string' && query.severity ? query.severity : undefined,
      useCase: typeof query.useCase === 'string' && query.useCase ? query.useCase : undefined,
      limit: query.limit === undefined ? undefined : Number(query.limit)
    });
  }

  @Get(['api/v1/admin/ai-questioning/quality/governance'])
  qualityGovernance(@Query() query: Record<string, unknown>) {
    return this.qualityService.governanceSummary({
      subject: typeof query.subject === 'string' && query.subject ? query.subject : undefined,
      useCase: typeof query.useCase === 'string' && query.useCase ? query.useCase : undefined
    });
  }

  @Get(['api/v1/admin/ai-questioning/quality/trend'])
  qualityTrend(@Query() query: Record<string, unknown>) {
    return this.qualityService.qualityTrend({
      subject: typeof query.subject === 'string' && query.subject ? query.subject : undefined,
      days: query.days,
      useCase: typeof query.useCase === 'string' && query.useCase ? query.useCase : undefined
    });
  }

  @Post(['api/v1/admin/ai-questioning/quality/refresh'])
  refreshQuality(@Body() body: Record<string, unknown> = {}, @CurrentUser() user: PrismaUser) {
    return this.audit(user, 'quality-metric', undefined, 'refresh', () => this.qualityService.refreshAll({
      subject: typeof body.subject === 'string' && body.subject ? body.subject : undefined,
      useCase: typeof body.useCase === 'string' && body.useCase ? body.useCase : undefined
    }));
  }

  @Post(['api/v1/admin/ai-questioning/quality/bulk'])
  bulkQualityAction(@Body() body: Record<string, unknown> = {}, @CurrentUser() user: PrismaUser) {
    return this.audit(user, 'quality-metric', undefined, `bulk_${String(body.action ?? 'action')}`, () => this.qualityService.bulkAction(body));
  }

  @Post(['api/v1/admin/ai-questioning/quality/:questionId/resolve'])
  resolveQuality(@Param('questionId') questionId: string, @Body() body: Record<string, unknown> = {}, @CurrentUser() user: PrismaUser) {
    return this.audit(user, 'quality-metric', questionId, 'resolve', () => this.qualityService.resolveMetric(questionId, body));
  }

  @Post(['api/v1/admin/ai-questioning/quality/:questionId/send-to-review'])
  sendQualityToReview(@Param('questionId') questionId: string, @Body() body: Record<string, unknown> = {}, @CurrentUser() user: PrismaUser) {
    return this.audit(user, 'quality-metric', questionId, 'send_to_review', () => this.qualityService.sendMetricToReview(questionId, body));
  }

  @Post(['api/v1/admin/ai-questioning/quality/:questionId/assign'])
  assignQualityReview(@Param('questionId') questionId: string, @Body() body: Record<string, unknown> = {}, @CurrentUser() user: PrismaUser) {
    return this.audit(user, 'quality-metric', questionId, 'assign_review', () => this.qualityService.assignMetricReview(questionId, body, user.id));
  }

  @Post(['api/v1/admin/ai-questioning/quality/:questionId/disposition'])
  applyQualityDisposition(@Param('questionId') questionId: string, @Body() body: Record<string, unknown> = {}, @CurrentUser() user: PrismaUser) {
    return this.audit(user, 'quality-metric', questionId, `disposition_${String(body.disposition ?? 'apply')}`, () => this.qualityService.applyDisposition(questionId, body));
  }

  @Post(['api/v1/admin/ai-questioning/concept-cards/:id/publish'])
  publishConceptCard(@Param('id') id: string, @Body() body: Record<string, unknown> = {}, @CurrentUser() user: PrismaUser) {
    return this.audit(user, 'concept-card', id, 'publish', () => this.service.updateConceptCardStatus(id, 'published', body));
  }

  @Patch(['api/v1/admin/ai-questioning/concept-cards/:id'])
  updateConceptCard(@Param('id') id: string, @Body() body: Record<string, unknown> = {}, @CurrentUser() user: PrismaUser) {
    return this.audit(user, 'concept-card', id, 'update', () => this.service.updateConceptCard(id, body));
  }

  @Post(['api/v1/admin/ai-questioning/concept-cards/:id/archive'])
  archiveConceptCard(@Param('id') id: string, @Body() body: Record<string, unknown> = {}, @CurrentUser() user: PrismaUser) {
    return this.audit(user, 'concept-card', id, 'archive', () => this.service.updateConceptCardStatus(id, 'archived', body));
  }

  @Post(['api/v1/admin/ai-questioning/questions/:id/review'])
  reviewQuestion(@Param('id') id: string, @CurrentUser() user: PrismaUser) {
    return this.audit(user, 'question', id, 'review', () => this.service.reviewQuestion(id));
  }

  @Patch(['api/v1/admin/ai-questioning/questions/:id'])
  updateQuestionDraft(@Param('id') id: string, @Body() body: Record<string, unknown> = {}, @CurrentUser() user: PrismaUser) {
    return this.audit(user, 'question', id, 'manual_fix_and_review', () => this.service.updateQuestionDraft(id, body));
  }

  @Post(['api/v1/admin/ai-questioning/questions/:id/approve'])
  approveQuestion(@Param('id') id: string, @Body() body: Record<string, unknown> = {}, @CurrentUser() user: PrismaUser) {
    return this.audit(user, 'question', id, 'approve', () => this.service.approveQuestion(id, body));
  }

  @Post(['api/v1/admin/ai-questioning/questions/:id/archive'])
  archiveQuestion(@Param('id') id: string, @CurrentUser() user: PrismaUser) {
    return this.audit(user, 'question', id, 'archive', () => this.service.archiveQuestion(id));
  }

  @Delete(['api/v1/admin/ai-questioning/questions/:id'])
  deleteGeneratedQuestion(@Param('id') id: string, @CurrentUser() user: PrismaUser) {
    return this.audit(user, 'question', id, 'delete_generated', () => this.service.deleteGeneratedQuestion(id));
  }

  @Post(['api/v1/admin/ai-questioning/questions/:id/reject'])
  rejectQuestion(@Param('id') id: string, @Body() body: Record<string, unknown>, @CurrentUser() user: PrismaUser) {
    return this.audit(user, 'question', id, 'reject', () => this.service.rejectQuestion(id, body));
  }
}

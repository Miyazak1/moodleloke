import { createReadStream } from 'node:fs';
import { Body, Controller, Delete, Get, Headers, Param, Post, Query, Req, Res, Sse, UseGuards } from '@nestjs/common';
import { User as PrismaUser } from '@prisma/client';
import { Access } from '../auth/access.decorator';
import { AccessPolicyGuard } from '../auth/access-policy.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AgentService } from './agent.service';
import { AgentPracticeActionService } from './agent-practice-action.service';
import { AgentAttachmentService } from './agent-attachment.service';
import { AgentAttachmentAnalysisService } from './agent-attachment-analysis.service';
import { AgentAttachmentEvidenceService } from './agent-attachment-evidence.service';
import { AgentInterventionDeliveryService } from './agent-intervention-delivery.service';
import { AgentInterventionVerificationService } from './agent-intervention-verification.service';
import { AgentLearningAssistanceService } from './agent-learning-assistance.service';
import { AgentTeachingAssetService } from './agent-teaching-asset.service';
import { AgentPastPaperQuestionService } from './agent-past-paper-question.service';
import { AgentPastPaperAssistanceService } from './agent-past-paper-assistance.service';
import { AgentPastPaperAttemptService } from './agent-past-paper-attempt.service';
import { AgentJourneyReadService } from './agent-journey-read.service';

function eventCursor(header: string | undefined, query: string | undefined): number {
  const value = query ?? header ?? '0';
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? Math.min(parsed, Number.MAX_SAFE_INTEGER) : 0;
}

@Controller('api/v1/agent')
@Access('verifiedUser')
@UseGuards(AccessPolicyGuard)
export class AgentController {
  constructor(
    private readonly agent: AgentService,
    private readonly practiceActions: AgentPracticeActionService,
    private readonly attachments: AgentAttachmentService,
    private readonly attachmentAnalyses: AgentAttachmentAnalysisService,
    private readonly attachmentEvidence: AgentAttachmentEvidenceService,
    private readonly interventionDeliveries: AgentInterventionDeliveryService,
    private readonly interventionVerifications: AgentInterventionVerificationService,
    private readonly learningAssistance: AgentLearningAssistanceService,
    private readonly teachingAssets: AgentTeachingAssetService,
    private readonly pastPaperQuestions: AgentPastPaperQuestionService,
    private readonly pastPaperAssistance: AgentPastPaperAssistanceService,
    private readonly pastPaperAttempts: AgentPastPaperAttemptService,
    private readonly journeyRead: AgentJourneyReadService
  ) {}

  @Post('conversations')
  createConversation(@CurrentUser() user: PrismaUser, @Body() body: unknown) {
    return this.agent.createConversation(user.id, body);
  }

  @Get('conversations')
  listConversations(@CurrentUser() user: PrismaUser) {
    return this.agent.listConversations(user.id);
  }

  @Get('conversations/:conversationId')
  getConversation(@CurrentUser() user: PrismaUser, @Param('conversationId') conversationId: string) {
    return this.agent.getConversation(user.id, conversationId);
  }

  @Get('journey/overview')
  getJourneyOverview(@CurrentUser() user: PrismaUser, @Query('locale') locale?: string) {
    return this.agent.getJourneyOverview(user.id, locale);
  }

  @Get('journey/state')
  getJourneyState(@CurrentUser() user: PrismaUser) {
    return this.journeyRead.read(user.id);
  }

  @Post('conversations/:conversationId/messages')
  submitMessage(
    @CurrentUser() user: PrismaUser,
    @Param('conversationId') conversationId: string,
    @Body() body: unknown
  ) {
    return this.agent.submitMessage(user.id, conversationId, body);
  }

  @Get('runs/:runId')
  getRun(@CurrentUser() user: PrismaUser, @Param('runId') runId: string) {
    return this.agent.getRun(user.id, runId);
  }

  @Get('past-papers/:slug/questions')
  pastPaperQuestionIndex(@Param('slug') slug: string) {
    return this.pastPaperQuestions.index(slug);
  }

  @Get('past-papers/:slug/questions/:questionId/assistance')
  pastPaperAssistanceAvailability(
    @CurrentUser() user: PrismaUser,
    @Param('slug') slug: string,
    @Param('questionId') questionId: string,
    @Query('conversationId') conversationId: string
  ) {
    return this.pastPaperAssistance.availability(user.id, slug, questionId, conversationId);
  }

  @Post('past-papers/:slug/questions/:questionId/assistance')
  requestPastPaperAssistance(
    @CurrentUser() user: PrismaUser,
    @Param('slug') slug: string,
    @Param('questionId') questionId: string,
    @Body() body: unknown
  ) {
    return this.pastPaperAssistance.request(user.id, slug, questionId, body);
  }

  @Post('past-papers/:slug/questions/:questionId/attempts/start')
  startPastPaperAttempt(
    @CurrentUser() user: PrismaUser,
    @Param('slug') slug: string,
    @Param('questionId') questionId: string,
    @Body() body: unknown
  ) {
    return this.pastPaperAttempts.start(user.id, slug, questionId, body);
  }

  @Post('past-paper-attempts/:attemptId/submit')
  submitPastPaperAttempt(
    @CurrentUser() user: PrismaUser,
    @Param('attemptId') attemptId: string,
    @Body() body: unknown
  ) {
    return this.pastPaperAttempts.submit(user.id, attemptId, body);
  }

  @Get('past-papers/:slug/progress')
  pastPaperProgress(
    @CurrentUser() user: PrismaUser,
    @Param('slug') slug: string,
    @Query('conversationId') conversationId: string
  ) {
    return this.pastPaperAttempts.progress(user.id, slug, conversationId);
  }

  @Get('past-papers/:slug/review')
  pastPaperReview(
    @CurrentUser() user: PrismaUser,
    @Param('slug') slug: string,
    @Query('conversationId') conversationId: string
  ) {
    return this.pastPaperAttempts.review(user.id, slug, conversationId);
  }

  @Get('attachments/limits')
  attachmentLimits() {
    return this.attachments.limits();
  }

  @Post('conversations/:conversationId/attachments')
  uploadAttachment(
    @CurrentUser() user: PrismaUser,
    @Param('conversationId') conversationId: string,
    @Headers('x-file-name') fileName: string,
    @Headers('x-file-type') fileType: string | undefined,
    @Req() request: any
  ) {
    return this.attachments.upload(user.id, conversationId, request, fileName, fileType);
  }

  @Get('conversations/:conversationId/attachments')
  listAttachments(@CurrentUser() user: PrismaUser, @Param('conversationId') conversationId: string) {
    return this.attachments.list(user.id, conversationId);
  }

  @Get('attachments/:attachmentId')
  getAttachment(@CurrentUser() user: PrismaUser, @Param('attachmentId') attachmentId: string) {
    return this.attachments.get(user.id, attachmentId);
  }

  @Get('attachments/:attachmentId/content')
  async attachmentContent(
    @CurrentUser() user: PrismaUser,
    @Param('attachmentId') attachmentId: string,
    @Res() response: any
  ) {
    const file = await this.attachments.content(user.id, attachmentId);
    response.setHeader('content-type', file.mime);
    response.setHeader('content-length', String(file.size));
    response.setHeader('content-disposition', `inline; filename*=UTF-8''${encodeURIComponent(file.name)}`);
    response.setHeader('x-content-type-options', 'nosniff');
    response.setHeader('cache-control', 'private, no-store');
    createReadStream(file.path).pipe(response);
  }

  @Post('attachments/:attachmentId/retry')
  retryAttachment(@CurrentUser() user: PrismaUser, @Param('attachmentId') attachmentId: string) {
    return this.attachments.retry(user.id, attachmentId);
  }

  @Delete('attachments/:attachmentId')
  removeAttachment(@CurrentUser() user: PrismaUser, @Param('attachmentId') attachmentId: string) {
    return this.attachments.remove(user.id, attachmentId);
  }

  @Post('attachments/:attachmentId/analyses')
  analyzeAttachment(@CurrentUser() user: PrismaUser, @Param('attachmentId') attachmentId: string, @Body() body: unknown) {
    return this.attachmentAnalyses.enqueue(user.id, attachmentId, body);
  }

  @Get('attachment-analyses/:analysisId')
  getAttachmentAnalysis(@CurrentUser() user: PrismaUser, @Param('analysisId') analysisId: string) {
    return this.attachmentAnalyses.get(user.id, analysisId);
  }

  @Post('attachment-analyses/:analysisId/retry')
  retryAttachmentAnalysis(@CurrentUser() user: PrismaUser, @Param('analysisId') analysisId: string) {
    return this.attachmentAnalyses.retry(user.id, analysisId);
  }

  @Get('conversations/:conversationId/attachment-analyses')
  listAttachmentAnalyses(@CurrentUser() user: PrismaUser, @Param('conversationId') conversationId: string) {
    return this.attachmentAnalyses.list(user.id, conversationId);
  }

  @Get('attachment-analyses/:analysisId/evidence-candidate')
  getAttachmentEvidenceCandidate(@CurrentUser() user: PrismaUser, @Param('analysisId') analysisId: string) {
    return this.attachmentEvidence.getForAnalysis(user.id, analysisId);
  }

  @Get('conversations/:conversationId/evidence-candidates')
  listAttachmentEvidenceCandidates(@CurrentUser() user: PrismaUser, @Param('conversationId') conversationId: string) {
    return this.attachmentEvidence.list(user.id, conversationId);
  }

  @Post('evidence-candidates/:candidateId/confirm')
  confirmAttachmentEvidence(@CurrentUser() user: PrismaUser, @Param('candidateId') candidateId: string, @Body() body: unknown) {
    return this.attachmentEvidence.confirm(user.id, candidateId, body);
  }

  @Post('evidence-candidates/:candidateId/reject')
  rejectAttachmentEvidence(@CurrentUser() user: PrismaUser, @Param('candidateId') candidateId: string, @Body() body: unknown) {
    return this.attachmentEvidence.reject(user.id, candidateId, body);
  }

  @Post('evidence-candidates/:candidateId/revoke')
  revokeAttachmentEvidence(@CurrentUser() user: PrismaUser, @Param('candidateId') candidateId: string, @Body() body: unknown) {
    return this.attachmentEvidence.revoke(user.id, candidateId, body);
  }

  @Post('artifacts/:artifactId/start-practice')
  startPractice(
    @CurrentUser() user: PrismaUser,
    @Param('artifactId') artifactId: string,
    @Body() body: unknown
  ) {
    return this.practiceActions.start(user.id, artifactId, body, 'practice');
  }

  @Post('free-practice/start')
  startFreePractice(@CurrentUser() user: PrismaUser, @Body() body: unknown) {
    return this.practiceActions.startFree(user.id, body);
  }

  @Post('free-practice/:artifactId/continue')
  continueFreePractice(@CurrentUser() user: PrismaUser, @Param('artifactId') artifactId: string, @Body() body: unknown) {
    return this.practiceActions.continueFree(user.id, artifactId, body);
  }

  @Post('free-practice/:artifactId/end')
  endFreePractice(@CurrentUser() user: PrismaUser, @Param('artifactId') artifactId: string, @Body() body: unknown) {
    return this.practiceActions.endFree(user.id, artifactId, body);
  }

  @Post('artifacts/:artifactId/start-mock-exam')
  startMockExam(
    @CurrentUser() user: PrismaUser,
    @Param('artifactId') artifactId: string,
    @Body() body: unknown
  ) {
    return this.practiceActions.start(user.id, artifactId, body, 'mock_exam');
  }

  @Post('interventions/offer')
  offerIntervention(@CurrentUser() user: PrismaUser, @Body() body: unknown) {
    return this.interventionDeliveries.offer(user.id, body);
  }

  @Get('intervention-deliveries/:deliveryId')
  getIntervention(
    @CurrentUser() user: PrismaUser,
    @Param('deliveryId') deliveryId: string
  ) {
    return this.interventionDeliveries.get(user.id, deliveryId);
  }

  @Post('intervention-deliveries/:deliveryId/actions')
  actOnIntervention(
    @CurrentUser() user: PrismaUser,
    @Param('deliveryId') deliveryId: string,
    @Body() body: unknown
  ) {
    return this.interventionDeliveries.act(user.id, deliveryId, body);
  }

  @Post('intervention-deliveries/:deliveryId/teaching-interactions')
  recordInterventionTeachingInteraction(
    @CurrentUser() user: PrismaUser,
    @Param('deliveryId') deliveryId: string,
    @Body() body: unknown
  ) {
    return this.teachingAssets.recordForDelivery(user.id, deliveryId, body);
  }

  @Post('intervention-verifications/offer')
  offerInterventionVerification(@CurrentUser() user: PrismaUser, @Body() body: unknown) {
    return this.interventionVerifications.offer(user.id, body);
  }

  @Post('intervention-verifications/:verificationId/start')
  startInterventionVerification(
    @CurrentUser() user: PrismaUser,
    @Param('verificationId') verificationId: string,
    @Body() body: unknown
  ) {
    return this.interventionVerifications.start(user.id, verificationId, body);
  }

  @Post('intervention-verifications/:verificationId/settle')
  settleInterventionVerification(@CurrentUser() user: PrismaUser, @Param('verificationId') verificationId: string) {
    return this.interventionVerifications.settle(user.id, verificationId);
  }

  @Post('practice-rounds/:roundId/settle')
  settlePractice(
    @CurrentUser() user: PrismaUser,
    @Param('roundId') roundId: string
  ) {
    return this.practiceActions.settle(user.id, roundId);
  }

  @Post('mock-exam-attempts/:attemptId/settle')
  settleMockExam(
    @CurrentUser() user: PrismaUser,
    @Param('attemptId') attemptId: string
  ) {
    return this.practiceActions.settleMockExam(user.id, attemptId);
  }

  @Get('practice-rounds/:roundId/questions/:questionId/assistance')
  learningAssistanceAvailability(
    @CurrentUser() user: PrismaUser,
    @Param('roundId') roundId: string,
    @Param('questionId') questionId: string
  ) {
    return this.learningAssistance.availability(user.id, roundId, questionId);
  }

  @Post('practice-rounds/:roundId/questions/:questionId/assistance')
  requestLearningAssistance(
    @CurrentUser() user: PrismaUser,
    @Param('roundId') roundId: string,
    @Param('questionId') questionId: string,
    @Body() body: unknown
  ) {
    return this.learningAssistance.request(user.id, roundId, questionId, body);
  }

  @Post('practice-rounds/:roundId/questions/:questionId/assistance/report')
  reportLearningContentIssue(
    @CurrentUser() user: PrismaUser,
    @Param('roundId') roundId: string,
    @Param('questionId') questionId: string,
    @Body() body: unknown
  ) {
    return this.learningAssistance.report(user.id, roundId, questionId, body);
  }

  @Get('practice-rounds/:roundId/questions/:questionId/teaching-asset')
  teachingAssetForQuestion(
    @CurrentUser() user: PrismaUser,
    @Param('roundId') roundId: string,
    @Param('questionId') questionId: string,
    @Query('language') language?: string
  ) {
    return this.teachingAssets.forQuestion(user.id, roundId, questionId, language);
  }

  @Get('teaching-assets/:stableKey')
  getTeachingAsset(@Param('stableKey') stableKey: string, @Query('language') language?: string) {
    return this.teachingAssets.byStableKey(stableKey, language);
  }

  @Post('teaching-assets/:assetVersionId/interactions')
  recordTeachingInteraction(
    @CurrentUser() user: PrismaUser,
    @Param('assetVersionId') assetVersionId: string,
    @Body() body: unknown
  ) {
    return this.teachingAssets.record(user.id, assetVersionId, body);
  }

  @Post('artifacts/:artifactId/abandon')
  abandonTask(
    @CurrentUser() user: PrismaUser,
    @Param('artifactId') artifactId: string,
    @Body() body: unknown
  ) {
    return this.practiceActions.abandon(user.id, artifactId, body);
  }

  @Sse('runs/:runId/events')
  async streamEvents(
    @CurrentUser() user: PrismaUser,
    @Param('runId') runId: string,
    @Headers('last-event-id') lastEventId?: string,
    @Query('after') after?: string
  ) {
    return this.agent.streamEvents(user.id, runId, eventCursor(lastEventId, after));
  }
}

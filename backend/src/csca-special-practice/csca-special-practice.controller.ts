import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { User as PrismaUser } from '@prisma/client';
import { AiGatewayService } from '../ai-gateway/ai-gateway.service';
import { Access } from '../auth/access.decorator';
import { AccessPolicyGuard } from '../auth/access-policy.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { OptionalUserGuard, RequiredAdminGuard, RequiredUserGuard } from '../auth/auth.guards';
import { AIEntitlementService } from './ai-entitlement.service';
import { AICoachService } from './ai-coach.service';
import { AICoachProviderService } from './ai-coach-provider.service';
import { AIObservabilityService } from './ai-observability.service';
import { AIUsageMeterService } from './ai-usage-meter.service';
import { CscaAdaptiveService } from './csca-adaptive.service';
import { AdaptiveRoundCreatePayload, AdaptiveRoundPatchPayload } from './csca-adaptive.types';
import { CscaSpecialPracticeService } from './csca-special-practice.service';
import { SpecialPracticeSessionPatchPayload } from './csca-special-practice.types';
import { TrainingEventService } from './training-event.service';

@Controller()
@Access('verifiedUser')
@UseGuards(AccessPolicyGuard)
export class CscaSpecialPracticeController {
  constructor(
    private readonly cscaSpecialPracticeService: CscaSpecialPracticeService,
    private readonly cscaAdaptiveService: CscaAdaptiveService,
    private readonly aiCoachService: AICoachService,
    private readonly aiCoachProviderService: AICoachProviderService,
    private readonly aiEntitlementService: AIEntitlementService,
    private readonly aiObservabilityService: AIObservabilityService,
    private readonly aiUsageMeterService: AIUsageMeterService,
    private readonly trainingEvents: TrainingEventService,
    private readonly aiGatewayService: AiGatewayService
  ) {}

  @Get(['csca-special-practice/overview', 'api/v1/csca-special-practice/overview'])
  @Access('public')
  getOverview() {
    return this.cscaSpecialPracticeService.getOverview();
  }

  @Get(['csca-special-practice/home-mini-mock', 'api/v1/csca-special-practice/home-mini-mock'])
  @Access('public')
  getHomeMiniMock(@Query() query: Record<string, string | undefined>) {
    return this.cscaSpecialPracticeService.getHomeMiniMock(query);
  }

  @Post(['csca-special-practice/home-mini-mock/score', 'api/v1/csca-special-practice/home-mini-mock/score'])
  @Access('public')
  scoreHomeMiniMock(@Body() body: Record<string, unknown>) {
    return this.cscaSpecialPracticeService.scoreHomeMiniMock(body);
  }

  @Get(['csca-special-practice/adaptive/overview', 'api/v1/csca-special-practice/adaptive/overview'])
  @Access('optionalUser')
  @UseGuards(OptionalUserGuard)
  getAdaptiveOverview(@CurrentUser() user?: PrismaUser) {
    return this.cscaAdaptiveService.getOverview(user?.id);
  }

  @Post(['csca-special-practice/adaptive/sessions', 'api/v1/csca-special-practice/adaptive/sessions'])
  @UseGuards(RequiredUserGuard)
  createAdaptiveSession(@Body() body: Record<string, unknown>, @CurrentUser() user: PrismaUser) {
    return this.cscaAdaptiveService.createSession(user.id, body);
  }

  @Post('api/v1/organizations/invites/accept')
  @UseGuards(RequiredUserGuard)
  acceptOrganizationInvite(@CurrentUser() user: PrismaUser, @Body() body: Record<string, unknown>) {
    return this.aiEntitlementService.acceptOrganizationInvite(user, body);
  }

  @Post('api/v1/organizations/invites/accept-code')
  @UseGuards(RequiredUserGuard)
  acceptOrganizationInviteCode(@CurrentUser() user: PrismaUser, @Body() body: Record<string, unknown>) {
    return this.aiEntitlementService.acceptOrganizationInviteCode(user, body);
  }

  @Get('api/v1/organization/me/organizations')
  @UseGuards(RequiredUserGuard)
  listMyManagedOrganizations(@CurrentUser() user: PrismaUser) {
    return this.aiEntitlementService.listManagedOrganizations(user.id);
  }

  @Post('api/v1/organization/me/members')
  @UseGuards(RequiredUserGuard)
  async upsertMyOrganizationMember(@Body() body: Record<string, unknown>, @CurrentUser() user: PrismaUser) {
    const organizationId = await this.aiEntitlementService.resolveManagedOrganizationId(user.id, 'manage_members');
    return this.aiEntitlementService.upsertOrganizationMember(user.id, organizationId, body);
  }

  @Post('api/v1/organization/me/members/bulk')
  @UseGuards(RequiredUserGuard)
  async bulkUpdateMyOrganizationMembers(@Body() body: Record<string, unknown>, @CurrentUser() user: PrismaUser) {
    const organizationId = await this.aiEntitlementService.resolveManagedOrganizationId(user.id, 'manage_members');
    return this.aiEntitlementService.bulkUpdateOrganizationMembers(user.id, organizationId, body);
  }

  @Post('api/v1/organization/me/cohorts')
  @UseGuards(RequiredUserGuard)
  async upsertMyOrganizationCohort(@Body() body: Record<string, unknown>, @CurrentUser() user: PrismaUser) {
    const organizationId = await this.aiEntitlementService.resolveManagedOrganizationId(user.id, 'manage_cohorts');
    return this.aiEntitlementService.upsertOrganizationCohort(user.id, organizationId, body);
  }

  @Post('api/v1/organization/me/invites')
  @UseGuards(RequiredUserGuard)
  async createMyOrganizationInvite(@Body() body: Record<string, unknown>, @CurrentUser() user: PrismaUser) {
    const organizationId = await this.aiEntitlementService.resolveManagedOrganizationId(user.id, 'manage_members');
    return this.aiEntitlementService.createOrganizationInvite(user.id, organizationId, body);
  }

  @Get('api/v1/organization/me/invites')
  @UseGuards(RequiredUserGuard)
  async listMyOrganizationInvites(@Query() query: Record<string, unknown>, @CurrentUser() user: PrismaUser) {
    const organizationId = await this.aiEntitlementService.resolveManagedOrganizationId(user.id, 'manage_members');
    return this.aiEntitlementService.listOrganizationInvites(organizationId, query);
  }

  @Patch('api/v1/organization/me/invites/:inviteId/archive')
  @UseGuards(RequiredUserGuard)
  async archiveMyOrganizationInvite(@Param('inviteId', ParseIntPipe) inviteId: number, @CurrentUser() user: PrismaUser) {
    const organizationId = await this.aiEntitlementService.resolveManagedOrganizationId(user.id, 'manage_members');
    return this.aiEntitlementService.archiveOrganizationInvite(user.id, organizationId, inviteId);
  }

  @Post('api/v1/organization/me/invites/bulk-reissue')
  @UseGuards(RequiredUserGuard)
  async reissueMyOrganizationInvites(@Body() body: Record<string, unknown>, @CurrentUser() user: PrismaUser) {
    const organizationId = await this.aiEntitlementService.resolveManagedOrganizationId(user.id, 'manage_members');
    return this.aiEntitlementService.reissueOrganizationInvites(user.id, organizationId, body);
  }

  @Post('api/v1/organization/me/invites/:inviteId/reissue')
  @UseGuards(RequiredUserGuard)
  async reissueMyOrganizationInvite(
    @Param('inviteId', ParseIntPipe) inviteId: number,
    @Body() body: Record<string, unknown>,
    @CurrentUser() user: PrismaUser
  ) {
    const organizationId = await this.aiEntitlementService.resolveManagedOrganizationId(user.id, 'manage_members');
    return this.aiEntitlementService.reissueOrganizationInvite(user.id, organizationId, inviteId, body);
  }

  @Post('api/v1/organization/me/member-imports/preview')
  @UseGuards(RequiredUserGuard)
  async previewMyOrganizationMemberImport(@Body() body: Record<string, unknown>, @CurrentUser() user: PrismaUser) {
    const organizationId = await this.aiEntitlementService.resolveManagedOrganizationId(user.id, 'manage_members');
    return this.aiEntitlementService.previewOrganizationMemberImport(organizationId, body);
  }

  @Post('api/v1/organization/me/member-imports/apply')
  @UseGuards(RequiredUserGuard)
  async applyMyOrganizationMemberImport(@Body() body: Record<string, unknown>, @CurrentUser() user: PrismaUser) {
    const organizationId = await this.aiEntitlementService.resolveManagedOrganizationId(user.id, 'manage_members');
    return this.aiEntitlementService.applyOrganizationMemberImport(user.id, organizationId, body);
  }

  @Post('api/v1/organization/me/credit-pool')
  @UseGuards(RequiredUserGuard)
  async upsertMyOrganizationCreditPool(@Body() body: Record<string, unknown>, @CurrentUser() user: PrismaUser) {
    const organizationId = await this.aiEntitlementService.resolveManagedOrganizationId(user.id, 'manage_billing_pool');
    return this.aiEntitlementService.upsertOrganizationCreditPool(user.id, organizationId, body);
  }

  @Post('api/v1/organization/me/provider-configs')
  @UseGuards(RequiredUserGuard)
  async upsertMyOrganizationProvider(@Body() body: Record<string, unknown>, @CurrentUser() user: PrismaUser) {
    const organizationId = await this.aiEntitlementService.resolveManagedOrganizationId(user.id, 'manage_provider');
    return this.aiEntitlementService.upsertOrganizationProvider(user.id, organizationId, body);
  }

  @Get(['csca-special-practice/adaptive/sessions/:id', 'api/v1/csca-special-practice/adaptive/sessions/:id'])
  @UseGuards(RequiredUserGuard)
  getAdaptiveSession(@Param('id') id: string, @CurrentUser() user: PrismaUser) {
    return this.cscaAdaptiveService.getSession(user.id, id);
  }

  @Post(['csca-special-practice/adaptive/sessions/:id/rounds', 'api/v1/csca-special-practice/adaptive/sessions/:id/rounds'])
  @UseGuards(RequiredUserGuard)
  createAdaptiveRound(@Param('id') id: string, @Body() body: AdaptiveRoundCreatePayload, @CurrentUser() user: PrismaUser) {
    return this.cscaAdaptiveService.createRound(user.id, id, body);
  }

  @Get(['csca-special-practice/adaptive/rounds/:id', 'api/v1/csca-special-practice/adaptive/rounds/:id'])
  @UseGuards(RequiredUserGuard)
  getAdaptiveRound(@Param('id') id: string, @Query() query: Record<string, string | undefined>, @CurrentUser() user: PrismaUser) {
    return this.cscaAdaptiveService.getRound(user.id, id, query.language);
  }

  @Patch(['csca-special-practice/adaptive/rounds/:id', 'api/v1/csca-special-practice/adaptive/rounds/:id'])
  @UseGuards(RequiredUserGuard)
  patchAdaptiveRound(@Param('id') id: string, @Body() body: AdaptiveRoundPatchPayload, @CurrentUser() user: PrismaUser) {
    return this.cscaAdaptiveService.patchRound(user.id, id, body);
  }

  @Post(['csca-special-practice/adaptive/rounds/:id/check', 'api/v1/csca-special-practice/adaptive/rounds/:id/check'])
  @UseGuards(RequiredUserGuard)
  checkAdaptiveAnswer(@Param('id') id: string, @Body() body: Record<string, unknown>, @CurrentUser() user: PrismaUser) {
    return this.cscaAdaptiveService.checkAnswer(user.id, id, body);
  }

  @Post(['csca-special-practice/adaptive/rounds/:id/submit', 'api/v1/csca-special-practice/adaptive/rounds/:id/submit'])
  @UseGuards(RequiredUserGuard)
  submitAdaptiveRound(@Param('id') id: string, @Query() query: Record<string, string | undefined>, @CurrentUser() user: PrismaUser) {
    return this.cscaAdaptiveService.submitRound(user.id, id, query.language);
  }

  @Get(['csca-special-practice/adaptive/rounds/:id/report', 'api/v1/csca-special-practice/adaptive/rounds/:id/report'])
  @UseGuards(RequiredUserGuard)
  getAdaptiveRoundReport(@Param('id') id: string, @Query() query: Record<string, string | undefined>, @CurrentUser() user: PrismaUser) {
    return this.cscaAdaptiveService.getReport(user.id, id, query.language);
  }

  @Post(['csca-special-practice/adaptive/rounds/:id/concept-cards/:cardId/complete', 'api/v1/csca-special-practice/adaptive/rounds/:id/concept-cards/:cardId/complete'])
  @UseGuards(RequiredUserGuard)
  completeAdaptiveConceptCard(@Param('id') id: string, @Param('cardId') cardId: string, @CurrentUser() user: PrismaUser) {
    return this.cscaAdaptiveService.completeConceptCard(user.id, id, cardId);
  }

  @Get(['csca-special-practice/adaptive/mastery', 'api/v1/csca-special-practice/adaptive/mastery'])
  @UseGuards(RequiredUserGuard)
  getAdaptiveMastery(@Query() query: Record<string, string | undefined>, @CurrentUser() user: PrismaUser) {
    return this.cscaAdaptiveService.getMastery(user.id, query);
  }

  @Get('api/v1/admin/csca-special-practice/adaptive/ai/observability')
  @UseGuards(RequiredAdminGuard)
  getAdaptiveAIObservability(@Query() query: Record<string, string | undefined>) {
    return this.aiObservabilityService.getOverview(query);
  }

  @Get('api/v1/admin/csca-special-practice/adaptive/ai/review-queue')
  @UseGuards(RequiredAdminGuard)
  getAdaptiveAIReviewQueue(@Query() query: Record<string, string | undefined>) {
    return this.aiObservabilityService.getReviewQueue(query);
  }

  @Post('api/v1/admin/csca-special-practice/adaptive/ai/review-queue/:interactionId/decisions')
  @UseGuards(RequiredAdminGuard)
  recordAdaptiveAIReviewDecision(
    @Param('interactionId', ParseIntPipe) interactionId: number,
    @Body() body: Record<string, unknown>,
    @CurrentUser() user: PrismaUser
  ) {
    return this.aiObservabilityService.recordReviewDecision(user.id, interactionId, body);
  }

  @Get('api/v1/admin/csca-special-practice/adaptive/ai/provider-config')
  @UseGuards(RequiredAdminGuard)
  getAdaptiveAIProviderConfig() {
    return {
      provider: this.aiCoachProviderService.configStatus(),
      usageMeter: this.aiUsageMeterService.configStatus()
    };
  }

  @Get('api/v1/admin/csca-special-practice/adaptive/ai/gateway-health')
  @UseGuards(RequiredAdminGuard)
  getAdaptiveAIGatewayHealth() {
    return this.aiGatewayService.health();
  }

  @Get('api/v1/admin/csca-special-practice/adaptive/ai/organizations')
  @UseGuards(RequiredAdminGuard)
  listAdaptiveAIOrganizations() {
    return this.aiEntitlementService.listOrganizations();
  }

  @Post('api/v1/admin/csca-special-practice/adaptive/ai/organizations')
  @UseGuards(RequiredAdminGuard)
  upsertAdaptiveAIOrganization(@Body() body: Record<string, unknown>, @CurrentUser() user: PrismaUser) {
    return this.aiEntitlementService.upsertOrganization(user.id, body);
  }

  @Post('api/v1/admin/csca-special-practice/adaptive/ai/organizations/:organizationId/members')
  @UseGuards(RequiredAdminGuard)
  upsertAdaptiveAIOrganizationMember(
    @Param('organizationId', ParseIntPipe) organizationId: number,
    @Body() body: Record<string, unknown>,
    @CurrentUser() user: PrismaUser
  ) {
    return this.aiEntitlementService.upsertOrganizationMember(user.id, organizationId, body);
  }

  @Post('api/v1/admin/csca-special-practice/adaptive/ai/organizations/:organizationId/members/bulk')
  @UseGuards(RequiredAdminGuard)
  bulkUpdateAdaptiveAIOrganizationMembers(
    @Param('organizationId', ParseIntPipe) organizationId: number,
    @Body() body: Record<string, unknown>,
    @CurrentUser() user: PrismaUser
  ) {
    return this.aiEntitlementService.bulkUpdateOrganizationMembers(user.id, organizationId, body);
  }

  @Post('api/v1/admin/csca-special-practice/adaptive/ai/organizations/:organizationId/cohorts')
  @UseGuards(RequiredAdminGuard)
  upsertAdaptiveAIOrganizationCohort(
    @Param('organizationId', ParseIntPipe) organizationId: number,
    @Body() body: Record<string, unknown>,
    @CurrentUser() user: PrismaUser
  ) {
    return this.aiEntitlementService.upsertOrganizationCohort(user.id, organizationId, body);
  }

  @Post('api/v1/admin/csca-special-practice/adaptive/ai/organizations/:organizationId/invites')
  @UseGuards(RequiredAdminGuard)
  createAdaptiveAIOrganizationInvite(
    @Param('organizationId', ParseIntPipe) organizationId: number,
    @Body() body: Record<string, unknown>,
    @CurrentUser() user: PrismaUser
  ) {
    return this.aiEntitlementService.createOrganizationInvite(user.id, organizationId, body);
  }

  @Post('api/v1/admin/csca-special-practice/adaptive/ai/organizations/:organizationId/admins')
  @UseGuards(RequiredAdminGuard)
  assignAdaptiveAIOrganizationAdmin(
    @Param('organizationId', ParseIntPipe) organizationId: number,
    @Body() body: Record<string, unknown>,
    @CurrentUser() user: PrismaUser
  ) {
    return this.aiEntitlementService.assignOrganizationAdminByEmail(user.id, organizationId, body);
  }

  @Get('api/v1/admin/csca-special-practice/adaptive/ai/organizations/:organizationId/invites')
  @UseGuards(RequiredAdminGuard)
  listAdaptiveAIOrganizationInvites(
    @Param('organizationId', ParseIntPipe) organizationId: number,
    @Query() query: Record<string, unknown>
  ) {
    return this.aiEntitlementService.listOrganizationInvites(organizationId, query);
  }

  @Patch('api/v1/admin/csca-special-practice/adaptive/ai/organizations/:organizationId/invites/:inviteId/archive')
  @UseGuards(RequiredAdminGuard)
  archiveAdaptiveAIOrganizationInvite(
    @Param('organizationId', ParseIntPipe) organizationId: number,
    @Param('inviteId', ParseIntPipe) inviteId: number,
    @CurrentUser() user: PrismaUser
  ) {
    return this.aiEntitlementService.archiveOrganizationInvite(user.id, organizationId, inviteId);
  }

  @Post('api/v1/admin/csca-special-practice/adaptive/ai/organizations/:organizationId/invites/bulk-reissue')
  @UseGuards(RequiredAdminGuard)
  reissueAdaptiveAIOrganizationInvites(
    @Param('organizationId', ParseIntPipe) organizationId: number,
    @Body() body: Record<string, unknown>,
    @CurrentUser() user: PrismaUser
  ) {
    return this.aiEntitlementService.reissueOrganizationInvites(user.id, organizationId, body);
  }

  @Post('api/v1/admin/csca-special-practice/adaptive/ai/organizations/:organizationId/invites/:inviteId/reissue')
  @UseGuards(RequiredAdminGuard)
  reissueAdaptiveAIOrganizationInvite(
    @Param('organizationId', ParseIntPipe) organizationId: number,
    @Param('inviteId', ParseIntPipe) inviteId: number,
    @Body() body: Record<string, unknown>,
    @CurrentUser() user: PrismaUser
  ) {
    return this.aiEntitlementService.reissueOrganizationInvite(user.id, organizationId, inviteId, body);
  }

  @Post('api/v1/admin/csca-special-practice/adaptive/ai/organizations/:organizationId/member-imports/preview')
  @UseGuards(RequiredAdminGuard)
  previewAdaptiveAIOrganizationMemberImport(
    @Param('organizationId', ParseIntPipe) organizationId: number,
    @Body() body: Record<string, unknown>
  ) {
    return this.aiEntitlementService.previewOrganizationMemberImport(organizationId, body);
  }

  @Post('api/v1/admin/csca-special-practice/adaptive/ai/organizations/:organizationId/member-imports/apply')
  @UseGuards(RequiredAdminGuard)
  applyAdaptiveAIOrganizationMemberImport(
    @Param('organizationId', ParseIntPipe) organizationId: number,
    @Body() body: Record<string, unknown>,
    @CurrentUser() user: PrismaUser
  ) {
    return this.aiEntitlementService.applyOrganizationMemberImport(user.id, organizationId, body);
  }

  @Post('api/v1/admin/csca-special-practice/adaptive/ai/organizations/:organizationId/credit-pool')
  @UseGuards(RequiredAdminGuard)
  upsertAdaptiveAIOrganizationCreditPool(
    @Param('organizationId', ParseIntPipe) organizationId: number,
    @Body() body: Record<string, unknown>,
    @CurrentUser() user: PrismaUser
  ) {
    return this.aiEntitlementService.upsertOrganizationCreditPool(user.id, organizationId, body);
  }

  @Post('api/v1/admin/csca-special-practice/adaptive/ai/organizations/:organizationId/provider-configs')
  @UseGuards(RequiredAdminGuard)
  upsertAdaptiveAIOrganizationProvider(
    @Param('organizationId', ParseIntPipe) organizationId: number,
    @Body() body: Record<string, unknown>,
    @CurrentUser() user: PrismaUser
  ) {
    return this.aiEntitlementService.upsertOrganizationProvider(user.id, organizationId, body);
  }

  @Get('api/v1/admin/csca-special-practice/adaptive/events/observability')
  @UseGuards(RequiredAdminGuard)
  getAdaptiveTrainingEventObservability(@Query() query: Record<string, string | undefined>) {
    return this.trainingEvents.getOverview(query);
  }

  @Post('api/v1/admin/csca-special-practice/adaptive/ai/entitlements/:userId/grant')
  @UseGuards(RequiredAdminGuard)
  grantAdaptiveAIEntitlement(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() body: Record<string, unknown>,
    @CurrentUser() user: PrismaUser
  ) {
    return this.aiEntitlementService.grant(userId, user.id, body);
  }

  @Post(['csca-special-practice/adaptive/ai/hint', 'api/v1/csca-special-practice/adaptive/ai/hint'])
  @UseGuards(RequiredUserGuard)
  getAdaptiveAIHint(@Body() body: Record<string, unknown>, @CurrentUser() user: PrismaUser) {
    return this.aiCoachService.hint(user.id, body);
  }

  @Post(['csca-special-practice/adaptive/ai/explain', 'api/v1/csca-special-practice/adaptive/ai/explain'])
  @UseGuards(RequiredUserGuard)
  getAdaptiveAIExplanation(@Body() body: Record<string, unknown>, @CurrentUser() user: PrismaUser) {
    return this.aiCoachService.explain(user.id, body);
  }

  @Post(['csca-special-practice/adaptive/ai/round-summary', 'api/v1/csca-special-practice/adaptive/ai/round-summary'])
  @UseGuards(RequiredUserGuard)
  getAdaptiveAIRoundSummary(@Body() body: Record<string, unknown>, @CurrentUser() user: PrismaUser) {
    return this.aiCoachService.roundSummary(user.id, body);
  }

  @Get(['csca-special-practice/adaptive/ai/entitlement', 'api/v1/csca-special-practice/adaptive/ai/entitlement'])
  @UseGuards(RequiredUserGuard)
  getAdaptiveAIEntitlement(@CurrentUser() user: PrismaUser) {
    return this.aiCoachService.entitlementSummary(user.id);
  }

  @Post(['csca-special-practice/adaptive/ai-interactions/:id/feedback', 'api/v1/csca-special-practice/adaptive/ai-interactions/:id/feedback'])
  @UseGuards(RequiredUserGuard)
  submitAdaptiveAIFeedback(@Param('id') id: string, @Body() body: Record<string, unknown>, @CurrentUser() user: PrismaUser) {
    return this.aiCoachService.feedback(user.id, id, body);
  }

  @Get(['csca-special-practice/subjects/:subject', 'api/v1/csca-special-practice/subjects/:subject'])
  @Access('public')
  getSubject(@Param('subject') subject: string) {
    return this.cscaSpecialPracticeService.getSubject(subject);
  }

  @Get(['csca-special-practice/topics/:slug/start', 'api/v1/csca-special-practice/topics/:slug/start'])
  @Access('public')
  getTopicStart(@Param('slug') slug: string) {
    return this.cscaSpecialPracticeService.getTopicStart(slug);
  }

  @Post(['csca-special-practice/topics/:slug/sessions', 'api/v1/csca-special-practice/topics/:slug/sessions'])
  @UseGuards(OptionalUserGuard)
  createSession(@Param('slug') slug: string, @Body() body: Record<string, unknown>, @CurrentUser() user?: PrismaUser) {
    return this.cscaSpecialPracticeService.createSession(slug, user?.id, body);
  }

  @Get(['csca-special-practice/my-sessions', 'api/v1/csca-special-practice/my-sessions'])
  @UseGuards(RequiredUserGuard)
  listMySessions(@CurrentUser() user: PrismaUser) {
    return this.cscaSpecialPracticeService.listMySessions(user.id);
  }

  @Get(['csca-special-practice/my-wrong-questions', 'api/v1/csca-special-practice/my-wrong-questions'])
  @UseGuards(RequiredUserGuard)
  listMyWrongQuestions(@CurrentUser() user: PrismaUser, @Query() query: Record<string, string | undefined>) {
    return this.cscaSpecialPracticeService.listMyWrongQuestions(user.id, query);
  }

  @Get(['csca-special-practice/sessions/:id', 'api/v1/csca-special-practice/sessions/:id'])
  @UseGuards(OptionalUserGuard)
  getSession(@Param('id') id: string, @CurrentUser() user?: PrismaUser) {
    return this.cscaSpecialPracticeService.getSession(id, user?.id);
  }

  @Patch(['csca-special-practice/sessions/:id', 'api/v1/csca-special-practice/sessions/:id'])
  @UseGuards(OptionalUserGuard)
  patchSession(@Param('id') id: string, @Body() body: SpecialPracticeSessionPatchPayload, @CurrentUser() user?: PrismaUser) {
    return this.cscaSpecialPracticeService.patchSession(id, user?.id, body);
  }

  @Post(['csca-special-practice/sessions/:id/check', 'api/v1/csca-special-practice/sessions/:id/check'])
  @UseGuards(OptionalUserGuard)
  checkAnswer(@Param('id') id: string, @Body() body: Record<string, unknown>, @CurrentUser() user?: PrismaUser) {
    return this.cscaSpecialPracticeService.checkAnswer(id, user?.id, body);
  }

  @Post(['csca-special-practice/sessions/:id/submit', 'api/v1/csca-special-practice/sessions/:id/submit'])
  @UseGuards(OptionalUserGuard)
  submitSession(@Param('id') id: string, @CurrentUser() user?: PrismaUser) {
    return this.cscaSpecialPracticeService.submitSession(id, user?.id);
  }

  @Get(['csca-special-practice/sessions/:id/report', 'api/v1/csca-special-practice/sessions/:id/report'])
  @UseGuards(OptionalUserGuard)
  getReport(@Param('id') id: string, @CurrentUser() user?: PrismaUser) {
    return this.cscaSpecialPracticeService.getReport(id, user?.id);
  }

  @Get(['api/v1/admin/special-practice/topics'])
  @UseGuards(RequiredAdminGuard)
  listAdminTopics() {
    return this.cscaSpecialPracticeService.listAdminTopics();
  }

  @Get(['api/v1/admin/special-practice/topics/:id'])
  @UseGuards(RequiredAdminGuard)
  getAdminTopic(@Param('id') id: string) {
    return this.cscaSpecialPracticeService.getAdminTopic(id);
  }

  @Post(['api/v1/admin/special-practice/topics'])
  @UseGuards(RequiredAdminGuard)
  createAdminTopic(@Body() body: Record<string, unknown>, @CurrentUser() user: PrismaUser) {
    return this.cscaSpecialPracticeService.createAdminTopic(body, user.id);
  }

  @Patch(['api/v1/admin/special-practice/topics/:id'])
  @UseGuards(RequiredAdminGuard)
  updateAdminTopic(@Param('id') id: string, @Body() body: Record<string, unknown>, @CurrentUser() user: PrismaUser) {
    return this.cscaSpecialPracticeService.updateAdminTopic(id, body, user.id);
  }

  @Post(['api/v1/admin/special-practice/topics/:id/publish'])
  @UseGuards(RequiredAdminGuard)
  publishAdminTopic(@Param('id') id: string, @Body() body: Record<string, unknown>, @CurrentUser() user: PrismaUser) {
    return this.cscaSpecialPracticeService.publishAdminTopic(id, user.id, body);
  }

  @Post(['api/v1/admin/special-practice/topics/:id/archive'])
  @UseGuards(RequiredAdminGuard)
  archiveAdminTopic(@Param('id') id: string, @Body() body: Record<string, unknown>, @CurrentUser() user: PrismaUser) {
    return this.cscaSpecialPracticeService.archiveAdminTopic(id, user.id, body);
  }

  @Post(['api/v1/admin/special-practice/topics/:id/duplicate'])
  @UseGuards(RequiredAdminGuard)
  duplicateAdminTopic(@Param('id') id: string, @CurrentUser() user: PrismaUser) {
    return this.cscaSpecialPracticeService.duplicateAdminTopic(id, user.id);
  }

  @Post(['api/v1/admin/special-practice/topics/:topicId/questions'])
  @UseGuards(RequiredAdminGuard)
  createAdminQuestion(@Param('topicId') topicId: string, @Body() body: Record<string, unknown>, @CurrentUser() user: PrismaUser) {
    return this.cscaSpecialPracticeService.createAdminQuestion(topicId, body, user.id);
  }

  @Patch(['api/v1/admin/special-practice/questions/:questionId'])
  @UseGuards(RequiredAdminGuard)
  updateAdminQuestion(@Param('questionId') questionId: string, @Body() body: Record<string, unknown>, @CurrentUser() user: PrismaUser) {
    return this.cscaSpecialPracticeService.updateAdminQuestion(questionId, body, user.id);
  }

  @Post(['api/v1/admin/special-practice/questions/:questionId/archive'])
  @UseGuards(RequiredAdminGuard)
  archiveAdminQuestion(@Param('questionId') questionId: string, @Body() body: Record<string, unknown>, @CurrentUser() user: PrismaUser) {
    return this.cscaSpecialPracticeService.archiveAdminQuestion(questionId, user.id, body);
  }

  @Post(['api/v1/admin/special-practice/import/validate'])
  @UseGuards(RequiredAdminGuard)
  validateAdminImport(@Body() body: unknown) {
    return this.cscaSpecialPracticeService.validateAdminImport(body);
  }

  @Post(['api/v1/admin/special-practice/import'])
  @UseGuards(RequiredAdminGuard)
  importAdminTopics(@Body() body: unknown, @CurrentUser() user: PrismaUser) {
    return this.cscaSpecialPracticeService.importAdminTopics(body, user.id);
  }
}

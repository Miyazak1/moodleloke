import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { User as PrismaUser } from '@prisma/client';
import { Access } from '../auth/access.decorator';
import { AccessPolicyGuard } from '../auth/access-policy.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { OptionalUserGuard, RequiredAdminGuard } from '../auth/auth.guards';
import { CscaMockExamService } from './csca-mock-exam.service';
import { MockExamAttemptCreatePayload, MockExamAttemptPatchPayload } from './csca-mock-exam.types';

@Controller()
export class CscaMockExamController {
  constructor(private readonly cscaMockExamService: CscaMockExamService) {}

  @Get(['csca-mock-exam/overview', 'api/v1/csca-mock-exam/overview'])
  getOverview(@Query('locale') locale?: string) {
    return this.cscaMockExamService.getOverview(locale);
  }

  @Get(['csca-mock-exam/subjects/:subject', 'api/v1/csca-mock-exam/subjects/:subject'])
  @UseGuards(OptionalUserGuard)
  listSubjectPapers(@Param('subject') subject: string, @Query('locale') locale?: string, @CurrentUser() user?: PrismaUser) {
    return this.cscaMockExamService.listSubjectPapers(subject, locale, user?.id);
  }

  @Get(['csca-mock-exam/papers/:slug/start', 'api/v1/csca-mock-exam/papers/:slug/start'])
  getPaperStart(@Param('slug') slug: string, @Query('locale') locale?: string) {
    return this.cscaMockExamService.getPaperStart(slug, locale);
  }

  @Post(['csca-mock-exam/papers/:slug/attempts', 'api/v1/csca-mock-exam/papers/:slug/attempts'])
  @Access('verifiedUser')
  @UseGuards(AccessPolicyGuard)
  createAttempt(@Param('slug') slug: string, @Body() body: MockExamAttemptCreatePayload, @CurrentUser() user?: PrismaUser) {
    return this.cscaMockExamService.createAttempt(slug, user?.id, body);
  }

  @Get(['csca-mock-exam/my-attempts', 'api/v1/csca-mock-exam/my-attempts'])
  @Access('verifiedUser')
  @UseGuards(AccessPolicyGuard)
  listMyAttempts(@CurrentUser() user: PrismaUser) {
    return this.cscaMockExamService.listMyAttempts(user.id);
  }

  @Get(['csca-mock-exam/attempts/:id', 'api/v1/csca-mock-exam/attempts/:id'])
  @Access('verifiedUser')
  @UseGuards(AccessPolicyGuard)
  getAttempt(@Param('id') id: string, @CurrentUser() user: PrismaUser, @Query('locale') locale?: string) {
    return this.cscaMockExamService.getAttempt(id, user.id, locale);
  }

  @Patch(['csca-mock-exam/attempts/:id', 'api/v1/csca-mock-exam/attempts/:id'])
  @Access('verifiedUser')
  @UseGuards(AccessPolicyGuard)
  patchAttempt(@Param('id') id: string, @Body() payload: MockExamAttemptPatchPayload, @CurrentUser() user: PrismaUser) {
    return this.cscaMockExamService.patchAttempt(id, user.id, payload);
  }

  @Post(['csca-mock-exam/attempts/:id/submit', 'api/v1/csca-mock-exam/attempts/:id/submit'])
  @Access('verifiedUser')
  @UseGuards(AccessPolicyGuard)
  submitAttempt(@Param('id') id: string, @CurrentUser() user: PrismaUser) {
    return this.cscaMockExamService.submitAttempt(id, user.id);
  }

  @Get(['csca-mock-exam/attempts/:id/report', 'api/v1/csca-mock-exam/attempts/:id/report'])
  @Access('verifiedUser')
  @UseGuards(AccessPolicyGuard)
  getReport(@Param('id') id: string, @CurrentUser() user: PrismaUser, @Query('locale') locale?: string) {
    return this.cscaMockExamService.getReport(id, user.id, locale);
  }

  @Get(['api/v1/admin/mock-exam/papers'])
  @UseGuards(RequiredAdminGuard)
  listAdminPapers() {
    return this.cscaMockExamService.listAdminPapers();
  }

  @Get(['api/v1/admin/mock-exam/blueprints'])
  @UseGuards(RequiredAdminGuard)
  listAdminBlueprints(@Query('subject') subject?: string) {
    return this.cscaMockExamService.listAdminBlueprints({ subject });
  }

  @Get(['api/v1/admin/mock-exam/generation-jobs'])
  @UseGuards(RequiredAdminGuard)
  listAdminGenerationJobs(@Query('blueprintId') blueprintId?: string, @Query('status') status?: string) {
    return this.cscaMockExamService.listAdminGenerationJobs({ blueprintId, status });
  }

  @Get(['api/v1/admin/mock-exam/blueprints/:id'])
  @UseGuards(RequiredAdminGuard)
  getAdminBlueprint(@Param('id') id: string) {
    return this.cscaMockExamService.getAdminBlueprint(id);
  }

  @Patch(['api/v1/admin/mock-exam/blueprints/:id'])
  @UseGuards(RequiredAdminGuard)
  updateAdminBlueprint(@Param('id') id: string, @Body() body: Record<string, unknown>, @CurrentUser() user: PrismaUser) {
    return this.cscaMockExamService.updateAdminBlueprint(id, body, user.id);
  }

  @Post(['api/v1/admin/mock-exam/blueprints/:id/generation-jobs'])
  @UseGuards(RequiredAdminGuard)
  createAdminGenerationJob(@Param('id') id: string, @Body() body: Record<string, unknown>, @CurrentUser() user: PrismaUser) {
    return this.cscaMockExamService.createAdminGenerationJob(id, body, user.id);
  }

  @Post(['api/v1/admin/mock-exam/generation-jobs/:id/process'])
  @UseGuards(RequiredAdminGuard)
  processAdminGenerationJob(@Param('id') id: string, @Body() body: Record<string, unknown> = {}, @CurrentUser() user: PrismaUser) {
    if (body.background === true) {
      return this.cscaMockExamService.startAdminGenerationJobBackground(id, body, user.id);
    }
    return this.cscaMockExamService.processAdminGenerationJob(id, body, user.id);
  }

  @Post(['api/v1/admin/mock-exam/generation-jobs/:id/assemble-draft'])
  @UseGuards(RequiredAdminGuard)
  assembleAdminGenerationJobDraft(@Param('id') id: string, @Body() body: Record<string, unknown> = {}, @CurrentUser() user: PrismaUser) {
    return this.cscaMockExamService.assembleAdminGenerationJobDraft(id, body, user.id);
  }

  @Post(['api/v1/admin/mock-exam/generation-jobs/:id/cleanup'])
  @UseGuards(RequiredAdminGuard)
  cleanupAdminGenerationJob(@Param('id') id: string, @Body() body: Record<string, unknown> = {}, @CurrentUser() user: PrismaUser) {
    return this.cscaMockExamService.cleanupAdminGenerationJob(id, body, user.id);
  }

  @Post(['api/v1/admin/mock-exam/blueprints/:id/generation-jobs/cleanup'])
  @UseGuards(RequiredAdminGuard)
  cleanupAdminBlueprintGenerationJobs(@Param('id') id: string, @Body() body: Record<string, unknown> = {}, @CurrentUser() user: PrismaUser) {
    return this.cscaMockExamService.cleanupAdminBlueprintGenerationJobs(id, body, user.id);
  }

  @Patch(['api/v1/admin/mock-exam/blueprint-slots/:id'])
  @UseGuards(RequiredAdminGuard)
  updateAdminBlueprintSlot(@Param('id') id: string, @Body() body: Record<string, unknown>, @CurrentUser() user: PrismaUser) {
    return this.cscaMockExamService.updateAdminBlueprintSlot(id, body, user.id);
  }

  @Get(['api/v1/admin/mock-exam/papers/:id'])
  @UseGuards(RequiredAdminGuard)
  getAdminPaper(@Param('id') id: string) {
    return this.cscaMockExamService.getAdminPaper(id);
  }

  @Post(['api/v1/admin/mock-exam/papers/:id/blueprint'])
  @UseGuards(RequiredAdminGuard)
  createAdminBlueprintFromPaper(@Param('id') id: string, @Body() body: Record<string, unknown>, @CurrentUser() user: PrismaUser) {
    return this.cscaMockExamService.createAdminBlueprintFromPaper(id, body, user.id);
  }

  @Post(['api/v1/admin/mock-exam/papers'])
  @UseGuards(RequiredAdminGuard)
  createAdminPaper(@Body() body: Record<string, unknown>, @CurrentUser() user: PrismaUser) {
    return this.cscaMockExamService.createAdminPaper(body, user.id);
  }

  @Patch(['api/v1/admin/mock-exam/papers/:id'])
  @UseGuards(RequiredAdminGuard)
  updateAdminPaper(@Param('id') id: string, @Body() body: Record<string, unknown>, @CurrentUser() user: PrismaUser) {
    return this.cscaMockExamService.updateAdminPaper(id, body, user.id);
  }

  @Post(['api/v1/admin/mock-exam/papers/:id/publish'])
  @UseGuards(RequiredAdminGuard)
  publishAdminPaper(@Param('id') id: string, @Body() body: Record<string, unknown>, @CurrentUser() user: PrismaUser) {
    return this.cscaMockExamService.publishAdminPaper(id, user.id, body);
  }

  @Post(['api/v1/admin/mock-exam/papers/:id/archive'])
  @UseGuards(RequiredAdminGuard)
  archiveAdminPaper(@Param('id') id: string, @Body() body: Record<string, unknown>, @CurrentUser() user: PrismaUser) {
    return this.cscaMockExamService.archiveAdminPaper(id, user.id, body);
  }

  @Post(['api/v1/admin/mock-exam/papers/:id/duplicate'])
  @UseGuards(RequiredAdminGuard)
  duplicateAdminPaper(@Param('id') id: string, @CurrentUser() user: PrismaUser) {
    return this.cscaMockExamService.duplicateAdminPaper(id, user.id);
  }

  @Post(['api/v1/admin/mock-exam/papers/:paperId/questions'])
  @UseGuards(RequiredAdminGuard)
  createAdminQuestion(@Param('paperId') paperId: string, @Body() body: Record<string, unknown>, @CurrentUser() user: PrismaUser) {
    return this.cscaMockExamService.createAdminQuestion(paperId, body, user.id);
  }

  @Patch(['api/v1/admin/mock-exam/questions/:questionId'])
  @UseGuards(RequiredAdminGuard)
  updateAdminQuestion(@Param('questionId') questionId: string, @Body() body: Record<string, unknown>, @CurrentUser() user: PrismaUser) {
    return this.cscaMockExamService.updateAdminQuestion(questionId, body, user.id);
  }

  @Post(['api/v1/admin/mock-exam/questions/:questionId/archive'])
  @UseGuards(RequiredAdminGuard)
  archiveAdminQuestion(@Param('questionId') questionId: string, @Body() body: Record<string, unknown>, @CurrentUser() user: PrismaUser) {
    return this.cscaMockExamService.archiveAdminQuestion(questionId, user.id, body);
  }

  @Post(['api/v1/admin/mock-exam/import/validate'])
  @UseGuards(RequiredAdminGuard)
  validateAdminImport(@Body() body: unknown) {
    return this.cscaMockExamService.validateAdminImport(body);
  }

  @Post(['api/v1/admin/mock-exam/import'])
  @UseGuards(RequiredAdminGuard)
  importAdminPapers(@Body() body: unknown, @CurrentUser() user: PrismaUser) {
    return this.cscaMockExamService.importAdminPapers(body, user.id);
  }
}

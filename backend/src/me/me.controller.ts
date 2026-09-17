import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { User as PrismaUser } from '@prisma/client';
import { Access } from '../auth/access.decorator';
import { AccessPolicyGuard } from '../auth/access-policy.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { CscaLearningService } from '../csca-learning/csca-learning.service';
import { MeService } from './me.service';
import { SchoolActionPayload } from './me.types';

@Controller('api/v1/me')
@Access('verifiedUser')
@UseGuards(AccessPolicyGuard)
export class MeController {
  constructor(
    private readonly meService: MeService,
    private readonly cscaLearningService: CscaLearningService
  ) {}

  @Get('learning-dashboard')
  getLearningDashboard(@CurrentUser() user: PrismaUser, @Query('language') language?: string) {
    return this.cscaLearningService.getDashboard(user.id, language);
  }

  @Post('learning-dashboard/insights/weekly')
  generateWeeklyLearningInsight(@CurrentUser() user: PrismaUser, @Query('language') language?: string) {
    return this.cscaLearningService.generateWeeklyInsight(user.id, language);
  }

  @Post('learning-dashboard/readiness-actions/click')
  recordReadinessActionClick(
    @CurrentUser() user: PrismaUser,
    @Body() body: Record<string, unknown>
  ) {
    return this.cscaLearningService.recordReadinessActionClick(user.id, body);
  }

  @Get('csca/review-queue')
  getCscaReviewQueue(
    @CurrentUser() user: PrismaUser,
    @Query('subject') subject?: string,
    @Query('language') language?: string,
    @Query('limit') limit?: string
  ) {
    return this.cscaLearningService.getWrongPatternReviewQueue(user.id, {
      subject,
      language,
      limit: Number(limit)
    });
  }

  @Post('csca/review-queue/:patternId/complete')
  completeCscaReviewQueueItem(
    @CurrentUser() user: PrismaUser,
    @Param('patternId', ParseIntPipe) patternId: number
  ) {
    return this.cscaLearningService.completeWrongPatternReview(user.id, patternId);
  }

  @Post('csca/wrong-questions/review-complete')
  completeCscaWrongQuestionReview(
    @CurrentUser() user: PrismaUser,
    @Body() body: Record<string, unknown>
  ) {
    return this.cscaLearningService.completeWrongQuestionReview(user.id, body);
  }

  @Get('ai-credits')
  getAICredits(@CurrentUser() user: PrismaUser) {
    return this.meService.getAICredits(user.id);
  }

  @Get('student-profile')
  @Access('user')
  getStudentProfile(@CurrentUser() user: PrismaUser) {
    return this.meService.getStudentProfile(user.id);
  }

  @Post('student-profile')
  @Access('user')
  updateStudentProfile(@CurrentUser() user: PrismaUser, @Body() body: Record<string, unknown>) {
    return this.meService.updateStudentProfile(user.id, body);
  }

  @Get('agent-learning-settings')
  @Access('user')
  getAgentLearningSettings(@CurrentUser() user: PrismaUser) {
    return this.meService.getAgentLearningSettings(user.id);
  }

  @Post('agent-score-goal')
  @Access('user')
  updateAgentScoreGoal(@CurrentUser() user: PrismaUser, @Body() body: Record<string, unknown>) {
    return this.meService.updateAgentScoreGoal(user.id, body);
  }

  @Post('agent-study-availability')
  @Access('user')
  updateAgentStudyAvailability(@CurrentUser() user: PrismaUser, @Body() body: Record<string, unknown>) {
    return this.meService.updateAgentStudyAvailability(user.id, body);
  }

  @Post('agent-learning-preference')
  @Access('user')
  updateAgentLearningPreference(@CurrentUser() user: PrismaUser, @Body() body: Record<string, unknown>) {
    return this.meService.updateAgentLearningPreference(user.id, body);
  }

  @Get('csca/wrong-questions')
  listCscaWrongQuestions(@CurrentUser() user: PrismaUser, @Query() query: Record<string, string | undefined>) {
    return this.meService.listCscaWrongQuestions(user.id, query);
  }

  @Get('saved-schools')
  async listSavedSchools(@CurrentUser() user: PrismaUser) {
    return {
      items: await this.meService.listSavedSchools(user.id)
    };
  }

  @Post('saved-schools')
  async addSavedSchool(
    @Body() body: SchoolActionPayload,
    @CurrentUser() user: PrismaUser
  ) {
    return this.meService.addSavedSchool(user.id, body.schoolId);
  }

  @Delete('saved-schools/:schoolId')
  async removeSavedSchool(
    @Param('schoolId', ParseIntPipe) schoolId: number,
    @CurrentUser() user: PrismaUser
  ) {
    return this.meService.removeSavedSchool(user.id, schoolId);
  }

  @Get('compare')
  async listCompareSchools(@CurrentUser() user: PrismaUser) {
    return {
      items: await this.meService.listCompareSchools(user.id)
    };
  }

  @Post('compare')
  async addCompareSchool(
    @Body() body: SchoolActionPayload,
    @CurrentUser() user: PrismaUser
  ) {
    return this.meService.addCompareSchool(user.id, body.schoolId);
  }

  @Delete('compare/:schoolId')
  async removeCompareSchool(
    @Param('schoolId', ParseIntPipe) schoolId: number,
    @CurrentUser() user: PrismaUser
  ) {
    return this.meService.removeCompareSchool(user.id, schoolId);
  }

  @Get('compare/details')
  async listCompareDetails(@CurrentUser() user: PrismaUser) {
    return {
      items: await this.meService.listCompareDetails(user.id)
    };
  }
}

import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { User as PrismaUser } from '@prisma/client';
import { RequiredAdminGuard } from '../auth/auth.guards';
import { CurrentUser } from '../auth/current-user.decorator';
import { ScoreCalibrationAdminService } from './score-calibration-admin.service';
import { ScorePredictionShadowService } from '../learning-intelligence/readiness/score-prediction-shadow.service';
import { ScorePredictionCalibrationDatasetService } from '../learning-intelligence/calibration/score-prediction-calibration-dataset.service';
import { VerifiedExamCalibrationDatasetService } from './verified-exam-calibration-dataset.service';

@Controller('api/v1/admin/score-calibration')
@UseGuards(RequiredAdminGuard)
export class ScoreCalibrationController {
  constructor(
    private readonly service: ScoreCalibrationAdminService,
    private readonly scorePredictionShadow: ScorePredictionShadowService,
    private readonly scorePredictionDataset: ScorePredictionCalibrationDatasetService,
    private readonly verifiedExamDataset: VerifiedExamCalibrationDatasetService
  ) {}

  @Get()
  overview() { return this.service.overview(); }

  @Get('gate')
  gate(@Query() query: Record<string, unknown>) { return this.service.evaluateGate(query); }

  @Post('shadow-predictions/run')
  runShadowPrediction(@Body() body: unknown) { return this.scorePredictionShadow.run(body); }

  @Get('shadow-predictions/:userId')
  listShadowPredictions(@Param('userId') userId: string) { return this.scorePredictionShadow.list(userId); }

  @Post('shadow-predictions/calibration-dataset')
  exportShadowPredictionDataset(@Body() body: unknown) { return this.scorePredictionDataset.export(body); }

  @Post('shadow-predictions/verified-exam-calibration-dataset')
  exportVerifiedExamDataset(@Body() body: unknown, @CurrentUser() user: PrismaUser) {
    return this.verifiedExamDataset.export(body, user.id);
  }

  @Post('scoring-policies')
  createPolicy(@Body() body: unknown, @CurrentUser() user: PrismaUser) {
    return this.service.createPolicy(body, user.id);
  }

  @Post('scoring-policies/:id/review')
  reviewPolicy(@Param('id') id: string, @Body() body: { reason?: unknown }, @CurrentUser() user: PrismaUser) {
    return this.service.reviewPolicy(id, body?.reason, user.id);
  }

  @Post('scoring-policies/:id/activate')
  activatePolicy(@Param('id') id: string, @Body() body: { reason?: unknown }, @CurrentUser() user: PrismaUser) {
    return this.service.activatePolicy(id, body?.reason, user.id);
  }

  @Post('scoring-policies/:id/withdraw')
  withdrawPolicy(@Param('id') id: string, @Body() body: { reason?: unknown }, @CurrentUser() user: PrismaUser) {
    return this.service.withdrawPolicy(id, body?.reason, user.id);
  }

  @Post('item-snapshots/build')
  buildItem(@Body() body: unknown, @CurrentUser() user: PrismaUser) {
    return this.service.buildItemSnapshot(body, user.id);
  }

  @Post('forecast-snapshots/build')
  buildForecast(@Body() body: unknown, @CurrentUser() user: PrismaUser) {
    return this.service.buildForecastSnapshot(body, user.id);
  }

  @Post(':kind-snapshots/:id/review')
  reviewSnapshot(@Param('kind') kind: 'item' | 'forecast', @Param('id') id: string,
    @Body() body: { decision?: 'approve' | 'reject'; reason?: unknown }, @CurrentUser() user: PrismaUser) {
    return this.service.reviewSnapshot(kind, id, body?.decision, body?.reason, user.id);
  }

  @Post(':kind-snapshots/:id/qualify')
  qualifySnapshot(@Param('kind') kind: 'item' | 'forecast', @Param('id') id: string,
    @Body() body: { reason?: unknown }, @CurrentUser() user: PrismaUser) {
    return this.service.qualifySnapshot(kind, id, body?.reason, user.id);
  }

  @Post(':kind-snapshots/:id/retire')
  retireSnapshot(@Param('kind') kind: 'item' | 'forecast', @Param('id') id: string,
    @Body() body: { reason?: unknown }, @CurrentUser() user: PrismaUser) {
    return this.service.retireSnapshot(kind, id, body?.reason, user.id);
  }
}

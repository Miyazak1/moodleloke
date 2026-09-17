import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { User as PrismaUser } from '@prisma/client';
import { RequiredAdminGuard } from '../auth/auth.guards';
import { CurrentUser } from '../auth/current-user.decorator';
import { QuestionSupplyRequestService } from './question-supply-request.service';
import { QuestionSupplyFulfillmentService } from './question-supply-fulfillment.service';
import { QuestionSupplyEvaluationService } from './question-supply-evaluation.service';
import { QuestionSupplyShadowSchedulerService } from './question-supply-shadow-scheduler.service';
import { QuestionSupplyOperationsHealthService } from './question-supply-operations-health.service';

@Controller('api/v1/admin/question-supply-requests')
@UseGuards(RequiredAdminGuard)
export class QuestionSupplyRequestController {
  constructor(
    private readonly requests: QuestionSupplyRequestService,
    private readonly fulfillment: QuestionSupplyFulfillmentService,
    private readonly evaluation: QuestionSupplyEvaluationService,
    private readonly scheduler: QuestionSupplyShadowSchedulerService,
    private readonly operationsHealth: QuestionSupplyOperationsHealthService
  ) {}

  @Get()
  list(@Query() query: Record<string, unknown>) {
    return this.requests.list(query);
  }

  @Post(':id/actions')
  act(@Param('id') id: string, @CurrentUser() user: PrismaUser, @Body() body: unknown) {
    return this.requests.act(id, user.id, body);
  }

  @Get('fulfillment/plans')
  listPlans(@Query('limit') limit?: string) {
    return this.fulfillment.listPlans(limit);
  }

  @Post('fulfillment/run')
  runFulfillment(@CurrentUser() user: PrismaUser, @Body() body: unknown) {
    return this.scheduler.runOnce('manual', user.id, body);
  }

  @Get('fulfillment/evaluation')
  getEvaluation(@Query('days') days?: string) {
    return this.evaluation.getEvaluation({ days });
  }

  @Get('fulfillment/report')
  getAcceptanceReport(@Query('days') days?: string) {
    return this.evaluation.getAcceptanceReport({ days });
  }

  @Get('fulfillment/export')
  getSanitizedExport(@Query() query: Record<string, unknown>) {
    return this.evaluation.getSanitizedExport(query);
  }

  @Get('fulfillment/scheduler')
  getSchedulerStatus() {
    return this.scheduler.getStatus();
  }

  @Get('fulfillment/operations-health')
  getOperationsHealth() {
    return this.operationsHealth.getHealth();
  }
}

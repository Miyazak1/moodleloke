import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { User as PrismaUser } from '@prisma/client';
import { RequiredAdminGuard, RequiredUserGuard } from '../auth/auth.guards';
import { CurrentUser } from '../auth/current-user.decorator';
import { StudentExamOutcomeService } from './student-exam-outcome.service';

@Controller('api/v1/me/exam-outcomes')
@UseGuards(RequiredUserGuard)
export class StudentExamOutcomeController {
  constructor(private readonly service: StudentExamOutcomeService) {}

  @Get()
  list(@CurrentUser() user: PrismaUser) { return this.service.listForStudent(user.id); }

  @Post()
  submit(@CurrentUser() user: PrismaUser, @Body() body: unknown) { return this.service.submit(user.id, body); }

  @Post(':id/corrections')
  correct(@CurrentUser() user: PrismaUser, @Param('id') id: string, @Body() body: unknown) {
    return this.service.correct(user.id, id, body);
  }

  @Post(':id/withdraw')
  withdraw(@CurrentUser() user: PrismaUser, @Param('id') id: string, @Body() body: { reason?: unknown }) {
    return this.service.withdraw(user.id, id, body?.reason);
  }
}

@Controller('api/v1/admin/score-calibration/exam-outcomes')
@UseGuards(RequiredAdminGuard)
export class AdminExamOutcomeController {
  constructor(private readonly service: StudentExamOutcomeService) {}

  @Get()
  list(@Query('status') status?: string) { return this.service.listForAdmin(status); }

  @Post(':id/review')
  review(@CurrentUser() user: PrismaUser, @Param('id') id: string, @Body() body: { reason?: unknown }) {
    return this.service.review(id, user.id, body?.reason);
  }

  @Post(':id/verify')
  verify(@CurrentUser() user: PrismaUser, @Param('id') id: string, @Body() body: { reason?: unknown }) {
    return this.service.verify(id, user.id, body?.reason);
  }

  @Post(':id/reject')
  reject(@CurrentUser() user: PrismaUser, @Param('id') id: string, @Body() body: { reason?: unknown }) {
    return this.service.reject(id, user.id, body?.reason);
  }

  @Post(':id/invalidate')
  invalidate(@CurrentUser() user: PrismaUser, @Param('id') id: string, @Body() body: { reason?: unknown }) {
    return this.service.invalidate(id, user.id, body?.reason);
  }
}

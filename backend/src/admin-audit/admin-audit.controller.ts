import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { User as PrismaUser } from '@prisma/client';
import { RequiredAdminGuard } from '../auth/auth.guards';
import { CurrentUser } from '../auth/current-user.decorator';
import { AdminAuditService } from './admin-audit.service';

@Controller()
@UseGuards(RequiredAdminGuard)
export class AdminAuditController {
  constructor(private readonly adminAuditService: AdminAuditService) {}

  @Get(['admin/audit', 'admin/audit-logs', 'api/v1/admin/audit-logs'])
  async listItems() {
    return {
      items: await this.adminAuditService.listItems()
    };
  }

  @Get(['api/v1/admin/practice/summary'])
  async getPracticeSummary() {
    return this.adminAuditService.getSummary();
  }

  @Get('api/v1/admin/audit-events')
  async listEvents(@Query() query: Record<string, unknown>) {
    return {
      items: await this.adminAuditService.listEvents(query)
    };
  }

  @Post('api/v1/admin/csca-learning/readiness-action-calibration/refresh')
  async refreshReadinessActionCalibration(@CurrentUser() user?: PrismaUser) {
    return this.adminAuditService.refreshReadinessActionCalibrationSnapshots(user?.id);
  }

  @Get('api/v1/admin/csca-learning/readiness-evidence')
  async listReadinessEvidenceFiles() {
    return {
      items: await this.adminAuditService.listReadinessEvidenceFiles()
    };
  }

  @Get('api/v1/admin/csca-learning/readiness-evidence/:name')
  async getReadinessEvidenceFile(@Param('name') name: string) {
    return this.adminAuditService.getReadinessEvidenceFile(name);
  }
}

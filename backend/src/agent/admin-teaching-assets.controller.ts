import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { User as PrismaUser } from '@prisma/client';
import { RequiredAdminGuard } from '../auth/auth.guards';
import { CurrentUser } from '../auth/current-user.decorator';
import { AdminTeachingAssetsService } from './admin-teaching-assets.service';

@Controller('api/v1/admin/teaching-assets')
@UseGuards(RequiredAdminGuard)
export class AdminTeachingAssetsController {
  constructor(private readonly assets: AdminTeachingAssetsService) {}

  @Get() list(@Query() query: Record<string, unknown>) { return this.assets.list(query); }
  @Get('quality-alerts') qualityQueue(@Query() query: Record<string, unknown>) { return this.assets.qualityQueue(query); }
  @Get('routing-diagnostics') routingDiagnostics(@Query() query: Record<string, unknown>) { return this.assets.routingDiagnostics(query); }
  @Post('routing-circuit/:subject/reset') resetRoutingCircuit(@Param('subject') subject: string, @Body() body: unknown, @CurrentUser() user: PrismaUser) { return this.assets.resetRoutingCircuit(subject, body, user.id); }
  @Post('quality-alerts/:alertKey/actions') actOnQualityAlert(@Param('alertKey') alertKey: string, @Body() body: unknown, @CurrentUser() user: PrismaUser) { return this.assets.actOnQualityAlert(alertKey, body, user.id); }
  @Get(':id/analytics') analytics(@Param('id') id: string, @Query() query: Record<string, unknown>) { return this.assets.analytics(id, query); }
  @Get(':id') detail(@Param('id') id: string) { return this.assets.detail(id); }
  @Post() create(@Body() body: unknown, @CurrentUser() user: PrismaUser) { return this.assets.create(body, user.id); }
  @Post(':id/versions') createVersion(@Param('id') id: string, @CurrentUser() user: PrismaUser) { return this.assets.createVersion(id, user.id); }
  @Patch('versions/:versionId') updateVersion(@Param('versionId') versionId: string, @Body() body: unknown, @CurrentUser() user: PrismaUser) { return this.assets.updateVersion(versionId, body, user.id); }
  @Post('versions/:versionId/:action') transition(@Param('versionId') versionId: string, @Param('action') action: string, @CurrentUser() user: PrismaUser) {
    if (!['submit', 'approve', 'return', 'publish', 'retire'].includes(action)) throw new BadRequestException('不支持的教学资产操作。');
    return this.assets.transition(versionId, action as 'submit' | 'approve' | 'return' | 'publish' | 'retire', user.id);
  }
}

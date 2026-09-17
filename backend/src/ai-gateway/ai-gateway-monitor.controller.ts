import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { RequiredAdminGuard } from '../auth/auth.guards';
import { AiGatewayMonitorService } from './ai-gateway-monitor.service';
import { AiGatewayService } from './ai-gateway.service';

@Controller('api/v1/admin/ai-gateway')
@UseGuards(RequiredAdminGuard)
export class AiGatewayMonitorController {
  constructor(
    private readonly monitor: AiGatewayMonitorService,
    private readonly gateway: AiGatewayService
  ) {}

  @Get('summary')
  summary(@Query() query: Record<string, string | undefined>) {
    return this.monitor.summary(query);
  }

  @Get('by-task')
  byTask(@Query() query: Record<string, string | undefined>) {
    return this.monitor.byTask(query);
  }

  @Get('by-key')
  byKey(@Query() query: Record<string, string | undefined>) {
    return this.monitor.byKey(query);
  }

  @Get('errors')
  errors(@Query() query: Record<string, string | undefined>) {
    return this.monitor.errors(query);
  }

  @Get('health')
  health() {
    return this.gateway.health();
  }
}

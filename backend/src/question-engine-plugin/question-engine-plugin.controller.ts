import { Controller, Get, UseGuards } from '@nestjs/common';
import { RequiredAdminGuard } from '../auth/auth.guards';
import { QuestionEnginePluginRegistryService } from './question-engine-plugin-registry.service';

@Controller()
@UseGuards(RequiredAdminGuard)
export class QuestionEnginePluginController {
  constructor(private readonly registry: QuestionEnginePluginRegistryService) {}

  @Get('api/v1/admin/question-engine/plugins/status')
  getStatus() {
    return this.registry.getStatusWithRuntime();
  }
}

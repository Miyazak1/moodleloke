import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BuiltinAIQuestioningAdapter } from './builtin-ai-questioning.adapter';
import { QuestionEnginePluginController } from './question-engine-plugin.controller';
import { QuestionEnginePluginRegistryService } from './question-engine-plugin-registry.service';
import { QuestionEngineNonceStoreService } from './question-engine-nonce-store.service';
import { QuestionEngineSidecarTransportService } from './question-engine-sidecar-transport.service';
import { QuestionEngineWorkerHealthService } from './question-engine-worker-health.service';

@Module({
  imports: [AuthModule],
  controllers: [QuestionEnginePluginController],
  providers: [
    BuiltinAIQuestioningAdapter,
    QuestionEnginePluginRegistryService,
    QuestionEngineNonceStoreService,
    QuestionEngineSidecarTransportService,
    QuestionEngineWorkerHealthService
  ],
  exports: [QuestionEnginePluginRegistryService, QuestionEngineSidecarTransportService, QuestionEngineWorkerHealthService]
})
export class QuestionEnginePluginModule {}

import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { VerifiedMath143Adapter } from './verified-math143.adapter';
import { VerifiedQuestionPublicationService } from './verified-question-publication.service';
import { VerifiedQuestionSupplyService } from './verified-question-supply.service';
import { QuestionEnginePluginController } from './question-engine-plugin.controller';
import { QuestionEnginePluginRegistryService } from './question-engine-plugin-registry.service';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [QuestionEnginePluginController],
  providers: [
    VerifiedMath143Adapter,
    VerifiedQuestionPublicationService,
    VerifiedQuestionSupplyService,
    QuestionEnginePluginRegistryService
  ],
  exports: [QuestionEnginePluginRegistryService, VerifiedQuestionSupplyService]
})
export class QuestionEnginePluginModule {}

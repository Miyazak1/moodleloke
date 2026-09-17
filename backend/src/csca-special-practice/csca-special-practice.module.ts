import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AiGatewayModule } from '../ai-gateway/ai-gateway.module';
import { AIQuestioningModule } from '../ai-questioning/ai-questioning.module';
import { CscaLearningModule } from '../csca-learning/csca-learning.module';
import { LearningIntelligenceFoundationModule } from '../learning-intelligence/learning-intelligence-foundation.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AdaptivePlannerService } from './adaptive-planner.service';
import { AdaptiveQuestionProviderService } from './adaptive-question-provider.service';
import { AIEntitlementService } from './ai-entitlement.service';
import { AICoachProviderService } from './ai-coach-provider.service';
import { AICoachService } from './ai-coach.service';
import { AIObservabilityService } from './ai-observability.service';
import { AIUsageMeterService } from './ai-usage-meter.service';
import { CscaAdaptiveService } from './csca-adaptive.service';
import { CscaSpecialPracticeController } from './csca-special-practice.controller';
import { CscaSpecialPracticeService } from './csca-special-practice.service';
import { MasteryEngineService } from './mastery-engine.service';
import { PlannerAssistantService } from './planner-assistant.service';
import { TrainingEventService } from './training-event.service';

@Module({
  imports: [PrismaModule, AuthModule, CscaLearningModule, AIQuestioningModule, AiGatewayModule, LearningIntelligenceFoundationModule],
  controllers: [CscaSpecialPracticeController],
  providers: [
    CscaSpecialPracticeService,
    CscaAdaptiveService,
    AdaptivePlannerService,
    AdaptiveQuestionProviderService,
    AIEntitlementService,
    AICoachProviderService,
    AICoachService,
    AIObservabilityService,
    AIUsageMeterService,
    MasteryEngineService,
    PlannerAssistantService,
    TrainingEventService
  ],
  exports: [MasteryEngineService, CscaAdaptiveService, AdaptiveQuestionProviderService, AICoachService]
})
export class CscaSpecialPracticeModule {}

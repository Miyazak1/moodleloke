import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AiGatewayModule } from '../ai-gateway/ai-gateway.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AdaptiveReplenishmentService } from './adaptive-replenishment.service';
import { AIQuestioningController } from './ai-questioning.controller';
import { AIQuestioningSchedulerService } from './ai-questioning-scheduler.service';
import { AIQuestioningService } from './ai-questioning.service';
import { QuestionGeneratorProviderService } from './question-generator-provider.service';
import { QuestionGeneratorService } from './question-generator.service';
import { QuestionPromptBuilderService } from './question-prompt-builder.service';
import { QuestionQualityService } from './question-quality.service';
import { QuestionReviewerProviderService } from './question-reviewer-provider.service';
import { QuestionReviewerService } from './question-reviewer.service';
import { QuestionTopicMapperProviderService } from './question-topic-mapper-provider.service';
import { QuestionValidatorService } from './question-validator.service';

@Module({
  imports: [PrismaModule, AuthModule, AiGatewayModule],
  controllers: [AIQuestioningController],
  providers: [AIQuestioningService, AdaptiveReplenishmentService, AIQuestioningSchedulerService, QuestionGeneratorProviderService, QuestionGeneratorService, QuestionPromptBuilderService, QuestionQualityService, QuestionReviewerProviderService, QuestionReviewerService, QuestionTopicMapperProviderService, QuestionValidatorService],
  exports: [AIQuestioningService, QuestionQualityService, QuestionValidatorService]
})
export class AIQuestioningModule {}

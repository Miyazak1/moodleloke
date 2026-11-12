import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TrainingEventService } from '../csca-special-practice/training-event.service';
import { LearningIntelligenceFoundationModule } from '../learning-intelligence/learning-intelligence-foundation.module';
import { CscaLearningService } from './csca-learning.service';

@Module({
  imports: [PrismaModule, LearningIntelligenceFoundationModule],
  providers: [CscaLearningService, TrainingEventService],
  exports: [CscaLearningService]
})
export class CscaLearningModule {}

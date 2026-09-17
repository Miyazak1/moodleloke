import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TrainingEventService } from '../csca-special-practice/training-event.service';
import { CscaLearningService } from './csca-learning.service';

@Module({
  imports: [PrismaModule],
  providers: [CscaLearningService, TrainingEventService],
  exports: [CscaLearningService]
})
export class CscaLearningModule {}

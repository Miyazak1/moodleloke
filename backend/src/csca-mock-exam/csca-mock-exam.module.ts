import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AIQuestioningModule } from '../ai-questioning/ai-questioning.module';
import { CscaLearningModule } from '../csca-learning/csca-learning.module';
import { LearningIntelligenceFoundationModule } from '../learning-intelligence/learning-intelligence-foundation.module';
import { PrismaModule } from '../prisma/prisma.module';
import { CscaSpecialPracticeModule } from '../csca-special-practice/csca-special-practice.module';
import { CscaMockExamController } from './csca-mock-exam.controller';
import { CscaMockExamService } from './csca-mock-exam.service';
import { MockExamMasteryBridgeService } from './mock-exam-mastery-bridge.service';
import { MockExamPlannerService } from './mock-exam-planner.service';

@Module({
  imports: [PrismaModule, AuthModule, AIQuestioningModule, CscaSpecialPracticeModule, CscaLearningModule, LearningIntelligenceFoundationModule],
  controllers: [CscaMockExamController],
  providers: [CscaMockExamService, MockExamPlannerService, MockExamMasteryBridgeService],
  exports: [CscaMockExamService]
})
export class CscaMockExamModule {}

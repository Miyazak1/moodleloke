import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LearningIntelligenceFoundationModule } from '../learning-intelligence/learning-intelligence-foundation.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ScoreCalibrationAdminService } from './score-calibration-admin.service';
import { ScoreCalibrationController } from './score-calibration.controller';
import { AdminExamOutcomeController, StudentExamOutcomeController } from './student-exam-outcome.controller';
import { StudentExamOutcomeService } from './student-exam-outcome.service';
import { VerifiedExamCalibrationDatasetService } from './verified-exam-calibration-dataset.service';

@Module({
  imports: [PrismaModule, AuthModule, LearningIntelligenceFoundationModule],
  controllers: [ScoreCalibrationController, StudentExamOutcomeController, AdminExamOutcomeController],
  providers: [ScoreCalibrationAdminService, StudentExamOutcomeService, VerifiedExamCalibrationDatasetService]
})
export class ScoreCalibrationModule {}

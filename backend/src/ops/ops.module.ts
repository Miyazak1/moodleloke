import { Module } from '@nestjs/common';
import { CscaLearningModule } from '../csca-learning/csca-learning.module';
import { ReadinessCalibrationSchedulerService } from './readiness-calibration-scheduler.service';

@Module({
  imports: [CscaLearningModule],
  providers: [ReadinessCalibrationSchedulerService]
})
export class OpsModule {}

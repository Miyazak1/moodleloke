import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { LearningCapabilityRegistryService } from './capabilities/learning-capability-registry.service';
import { LearningReadCapabilityService } from './capabilities/learning-read-capability.service';
import { LearningDecisionService } from './decision/learning-decision.service';
import { LearningEvidenceWriterService } from './evidence/learning-evidence-writer.service';
import { LEARNING_EVIDENCE_WRITER } from './learning-evidence-writer.port';
import { LearningIntelligenceContractsService } from './learning-intelligence-contracts.service';
import { LearningIntelligenceFeatureFlagsService } from './learning-intelligence-feature-flags.service';
import { LearningStateProjectorService } from './projection/learning-state-projector.service';
import { LearningStateProjectionWorkerService } from './projection/learning-state-projection-worker.service';
import { LearningStateShadowQueryService } from './projection/learning-state-shadow-query.service';
import { LearningInterventionShadowService } from './intervention/learning-intervention-shadow.service';
import { ScoreReadinessService } from './readiness/score-readiness.service';
import { ScoreCalibrationGovernanceService } from './readiness/score-calibration-governance.service';
import { ScorePredictionShadowService } from './readiness/score-prediction-shadow.service';
import { ScorePredictionCalibrationDatasetService } from './calibration/score-prediction-calibration-dataset.service';
import { PastPapersModule } from '../past-papers/past-papers.module';

@Module({
  imports: [PrismaModule, PastPapersModule],
  providers: [
    LearningIntelligenceContractsService,
    LearningIntelligenceFeatureFlagsService,
    LearningReadCapabilityService,
    LearningCapabilityRegistryService,
    LearningEvidenceWriterService,
    LearningInterventionShadowService,
    { provide: LEARNING_EVIDENCE_WRITER, useExisting: LearningEvidenceWriterService },
    LearningStateProjectorService,
    LearningStateProjectionWorkerService,
    LearningStateShadowQueryService,
    LearningDecisionService,
    ScoreReadinessService,
    ScoreCalibrationGovernanceService,
    ScorePredictionShadowService,
    ScorePredictionCalibrationDatasetService
  ],
  exports: [
    LearningIntelligenceContractsService,
    LearningIntelligenceFeatureFlagsService,
    LearningReadCapabilityService,
    LearningCapabilityRegistryService,
    LearningEvidenceWriterService,
    LEARNING_EVIDENCE_WRITER,
    LearningStateProjectorService,
    LearningStateShadowQueryService,
    LearningDecisionService,
    ScoreReadinessService,
    ScoreCalibrationGovernanceService,
    ScorePredictionShadowService,
    ScorePredictionCalibrationDatasetService,
    LearningInterventionShadowService
  ]
})
export class LearningIntelligenceFoundationModule {}

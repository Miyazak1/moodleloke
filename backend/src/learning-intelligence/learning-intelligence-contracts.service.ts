import { Injectable } from '@nestjs/common';
import {
  LearningEvidenceEventV1Schema,
  LearningEvidenceWriteInputV1Schema,
  LearningPrescriptionV1Schema,
  TargetGapSnapshotV1Schema,
  UpdateScoreGoalInputV1Schema,
  UpdateStudyAvailabilityInputV1Schema
} from './contracts/learning-intelligence.contracts';

@Injectable()
export class LearningIntelligenceContractsService {
  readonly learningEvidenceEventV1 = LearningEvidenceEventV1Schema;
  readonly learningEvidenceWriteInputV1 = LearningEvidenceWriteInputV1Schema;
  readonly learningPrescriptionV1 = LearningPrescriptionV1Schema;
  readonly targetGapSnapshotV1 = TargetGapSnapshotV1Schema;
  readonly updateScoreGoalInputV1 = UpdateScoreGoalInputV1Schema;
  readonly updateStudyAvailabilityInputV1 = UpdateStudyAvailabilityInputV1Schema;
}

import { Injectable, Optional } from '@nestjs/common';
import { stableLearningRolloutBucket } from '../common/stable-rollout-bucket';

export const LEARNING_INTELLIGENCE_FEATURE_FLAGS = {
  foundation: 'CSCA_AGENT_FOUNDATION_ENABLED',
  evidenceWrite: 'CSCA_LEARNING_EVIDENCE_WRITE_ENABLED',
  shadowProjection: 'CSCA_LEARNING_SHADOW_PROJECTION_ENABLED',
  targetGap: 'CSCA_TARGET_GAP_ENABLED',
  prescription: 'CSCA_LEARNING_PRESCRIPTION_ENABLED',
  interventionShadow: 'CSCA_LEARNING_INTERVENTION_SHADOW_ENABLED',
  interventionDelivery: 'CSCA_LEARNING_INTERVENTION_DELIVERY_ENABLED',
  interventionVerification: 'CSCA_LEARNING_INTERVENTION_VERIFICATION_ENABLED',
  scoreReadiness: 'CSCA_SCORE_READINESS_ENABLED',
  scorePredictionShadow: 'CSCA_SCORE_PREDICTION_SHADOW_ENABLED'
} as const;

export type LearningIntelligenceFeature = keyof typeof LEARNING_INTELLIGENCE_FEATURE_FLAGS;

function enabled(value: string | undefined): boolean {
  return String(value ?? '').trim().toLowerCase() === 'true';
}

function list(value: string | undefined): string[] {
  return [...new Set(String(value ?? '').split(',').map((item) => item.trim()).filter(Boolean))];
}

function rolloutPercent(value: string | undefined): number {
  const parsed = Number(String(value ?? '0').trim());
  return Number.isFinite(parsed) ? Math.max(0, Math.min(100, Math.floor(parsed))) : 0;
}

export type InterventionRolloutMode = 'shadow' | 'internal' | 'canary';

export type InterventionRolloutEligibility = {
  eligible: boolean;
  mode: InterventionRolloutMode;
  subjectCode: string;
  topicCode: string;
  bucket: number | null;
  percent: number;
  reasonCodes: string[];
};

@Injectable()
export class LearningIntelligenceFeatureFlagsService {
  constructor(@Optional() private readonly env: NodeJS.ProcessEnv = process.env) {}

  isEnabled(feature: LearningIntelligenceFeature): boolean {
    if (!enabled(this.env[LEARNING_INTELLIGENCE_FEATURE_FLAGS.foundation])) return false;
    if (feature === 'foundation') return true;
    if (feature === 'targetGap' && !enabled(this.env[LEARNING_INTELLIGENCE_FEATURE_FLAGS.shadowProjection])) return false;
    if (feature === 'prescription' && (!this.isEnabled('targetGap') || !enabled(this.env[LEARNING_INTELLIGENCE_FEATURE_FLAGS.prescription]))) return false;
    if (feature === 'scoreReadiness' && !this.isEnabled('prescription')) return false;
    if (feature === 'scorePredictionShadow' && !this.isEnabled('scoreReadiness')) return false;
    if (feature === 'interventionShadow' && !enabled(this.env[LEARNING_INTELLIGENCE_FEATURE_FLAGS.shadowProjection])) return false;
    if (feature === 'interventionDelivery' && !this.isEnabled('interventionShadow')) return false;
    if (feature === 'interventionVerification' && !this.isEnabled('interventionDelivery')) return false;
    return enabled(this.env[LEARNING_INTELLIGENCE_FEATURE_FLAGS[feature]]);
  }

  interventionRolloutMode(): InterventionRolloutMode {
    const value = String(this.env.CSCA_LEARNING_INTERVENTION_ROLLOUT_MODE ?? 'shadow').trim().toLowerCase();
    return value === 'internal' || value === 'canary' ? value : 'shadow';
  }

  interventionRollout() {
    const internalUserIds = list(this.env.CSCA_LEARNING_INTERVENTION_INTERNAL_USER_IDS)
      .map(Number).filter((value) => Number.isInteger(value) && value > 0);
    return {
      mode: this.interventionRolloutMode(),
      internalUserIds: [...new Set(internalUserIds)],
      subjects: list(this.env.CSCA_LEARNING_INTERVENTION_ACTIVE_SUBJECTS),
      topicCodes: list(this.env.CSCA_LEARNING_INTERVENTION_ACTIVE_TOPIC_CODES),
      percent: rolloutPercent(this.env.CSCA_LEARNING_INTERVENTION_ACTIVE_PERCENT)
    };
  }

  interventionRolloutEligibility(userId: number, subjectCode: string, topicCode: string): InterventionRolloutEligibility {
    const rollout = this.interventionRollout();
    const reasonCodes: string[] = [];
    if (!rollout.subjects.includes(subjectCode)) reasonCodes.push('SUBJECT_NOT_IN_ROLLOUT');
    if (!rollout.topicCodes.includes(topicCode)) reasonCodes.push('TOPIC_NOT_IN_ROLLOUT');
    let bucket: number | null = null;
    if (rollout.mode === 'shadow') reasonCodes.push('SHADOW_MODE_NO_DELIVERY');
    if (rollout.mode === 'internal' && !rollout.internalUserIds.includes(userId)) reasonCodes.push('USER_NOT_INTERNAL');
    if (rollout.mode === 'canary') {
      bucket = stableLearningRolloutBucket(userId);
      if (rollout.percent < 1 || bucket >= rollout.percent) reasonCodes.push('USER_OUTSIDE_CANARY');
    }
    return {
      eligible: reasonCodes.length === 0,
      mode: rollout.mode,
      subjectCode,
      topicCode,
      bucket,
      percent: rollout.percent,
      reasonCodes
    };
  }

  snapshot(): Record<LearningIntelligenceFeature, boolean> {
    return {
      foundation: this.isEnabled('foundation'),
      evidenceWrite: this.isEnabled('evidenceWrite'),
      shadowProjection: this.isEnabled('shadowProjection'),
      targetGap: this.isEnabled('targetGap'),
      prescription: this.isEnabled('prescription'),
      interventionShadow: this.isEnabled('interventionShadow'),
      interventionDelivery: this.isEnabled('interventionDelivery'),
      interventionVerification: this.isEnabled('interventionVerification'),
      scoreReadiness: this.isEnabled('scoreReadiness'),
      scorePredictionShadow: this.isEnabled('scorePredictionShadow')
    };
  }
}

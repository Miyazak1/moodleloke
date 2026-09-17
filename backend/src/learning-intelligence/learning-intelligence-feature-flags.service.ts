import { Injectable, Optional } from '@nestjs/common';

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

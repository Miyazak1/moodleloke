export const LEARNING_INTERVENTION_POLICY_VERSION = 'intervention-shadow-rules-1' as const;

export type InterventionEvidenceSignal = {
  eventId: string;
  outcome: 'correct' | 'incorrect' | 'partial';
  usedHint: boolean;
  usedExplanation: boolean;
  sourceType: string;
  quality: number;
  occurredAt: Date;
};

export type InterventionPolicyInput = {
  topicId: number;
  stateVersion: string;
  mastery: number;
  confidence: number;
  independence: number;
  retention: number;
  transfer: number;
  evidenceCount: number;
  incorrectCount: number;
  recentEvidence: InterventionEvidenceSignal[];
};

export type InterventionPolicyDecision = {
  action: 'continue_practice' | 'show_error_feedback' | 'offer_micro_lesson' | 'schedule_review';
  triggerCodes: string[];
  urgency: 'low' | 'medium' | 'high';
  placement: 'after_answer' | 'between_sets' | 'after_round' | 'later';
  contentPlan: null | {
    format: 'concept_card' | 'worked_example' | 'contrast_example' | 'guided_correction' | 'mini_lesson' | 'retrieval_check';
    depth: 'brief' | 'guided' | 'full';
    verificationRequired: true;
  };
  reasonSummary: string;
};

export function decideLearningIntervention(input: InterventionPolicyInput): InterventionPolicyDecision {
  const usable = input.recentEvidence.filter((item) => item.quality >= 0.5).slice(0, 6);
  const recentIncorrect = usable.filter((item) => item.outcome === 'incorrect').length;
  const recentNonCorrect = usable.filter((item) => item.outcome !== 'correct').length;
  const assistedCorrect = usable.filter((item) => item.outcome === 'correct' && (item.usedHint || item.usedExplanation)).length;
  const explanationThenIncorrect = usable.some((item) => item.outcome === 'incorrect' && item.usedExplanation);
  const handwritingError = usable.some((item) => item.outcome === 'incorrect' && item.sourceType === 'verified_handwriting');

  if (input.evidenceCount < 3 || input.confidence < 0.35 || usable.length < 2) {
    return {
      action: 'continue_practice', triggerCodes: ['EVIDENCE_INSUFFICIENT'], urgency: 'low', placement: 'after_round', contentPlan: null,
      reasonSummary: 'Available evidence is insufficient for a reliable teaching intervention; collect diagnostic evidence first.'
    };
  }
  if (explanationThenIncorrect && recentIncorrect >= 2) {
    return {
      action: 'offer_micro_lesson', triggerCodes: ['EXPLANATION_FAILED', 'MISCONCEPTION_REPEATED'], urgency: 'high', placement: 'between_sets',
      contentPlan: { format: handwritingError ? 'guided_correction' : 'mini_lesson', depth: 'guided', verificationRequired: true },
      reasonSummary: 'The same topic remains incorrect after explanation, so more repetition is unlikely to be sufficient.'
    };
  }
  if (input.mastery >= 0.75 && recentIncorrect >= 2) {
    return {
      action: 'show_error_feedback', triggerCodes: ['STATE_EVIDENCE_CONFLICT'], urgency: 'medium', placement: 'after_round',
      contentPlan: { format: 'contrast_example', depth: 'brief', verificationRequired: true },
      reasonSummary: 'Recent outcomes conflict with the prior high mastery estimate and require a short diagnostic check.'
    };
  }
  if (recentIncorrect >= 2) {
    return {
      action: 'offer_micro_lesson', triggerCodes: ['MISCONCEPTION_REPEATED'], urgency: recentIncorrect >= 3 ? 'high' : 'medium', placement: 'between_sets',
      contentPlan: { format: handwritingError ? 'guided_correction' : 'concept_card', depth: 'guided', verificationRequired: true },
      reasonSummary: 'Repeated incorrect evidence indicates that the topic should be explained before assigning more similar practice.'
    };
  }
  if (usable.length >= 4 && recentNonCorrect >= 3 && input.mastery < 0.5) {
    return {
      action: 'offer_micro_lesson', triggerCodes: ['PRACTICE_YIELD_LOW', 'MASTERY_BELOW_BASELINE'], urgency: 'medium', placement: 'between_sets',
      contentPlan: { format: 'worked_example', depth: 'guided', verificationRequired: true },
      reasonSummary: 'Recent practice is producing little improvement, so a worked explanation is preferable to another similar set.'
    };
  }
  if (usable.length >= 3 && assistedCorrect >= 2 && input.independence < 0.6) {
    return {
      action: 'show_error_feedback', triggerCodes: ['ASSISTANCE_DEPENDENCE'], urgency: 'medium', placement: 'after_round',
      contentPlan: { format: 'concept_card', depth: 'brief', verificationRequired: true },
      reasonSummary: 'Recent correct answers rely heavily on assistance, so independent recall should be reinforced.'
    };
  }
  if (input.retention < 0.5 && input.evidenceCount >= 3) {
    return {
      action: 'schedule_review', triggerCodes: ['RETENTION_AT_RISK'], urgency: 'low', placement: 'later',
      contentPlan: { format: 'retrieval_check', depth: 'brief', verificationRequired: true },
      reasonSummary: 'The topic shows retention risk and should receive a delayed independent retrieval check.'
    };
  }
  return {
    action: 'continue_practice', triggerCodes: ['NO_INTERVENTION_THRESHOLD_MET'], urgency: 'low', placement: 'after_round', contentPlan: null,
    reasonSummary: 'Current evidence does not justify interrupting the normal practice flow.'
  };
}

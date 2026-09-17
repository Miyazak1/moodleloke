import { createHash } from 'node:crypto';

export const SUBJECT_PRACTICE_LOCAL_GENERATOR_PRODUCTION_PROFILE_BINDING_POLICY_VERSION =
  'subject-practice-local-generator-production-profile-binding-v1';

export const SUBJECT_PRACTICE_LOCAL_GENERATOR_PRODUCTION_PROFILE_FIELDS = [
  'gapKey', 'questionForm', 'cognitiveSkill', 'difficultyBand', 'readingLoad', 'calculationLoad', 'distractorTypes'
] as const;

type Subject = 'math' | 'physics' | 'chemistry';
type TargetProfile = Record<(typeof SUBJECT_PRACTICE_LOCAL_GENERATOR_PRODUCTION_PROFILE_FIELDS)[number], string | string[]>;

export type SubjectPracticeLocalGeneratorProductionProfileBindingInput = {
  subject: Subject;
  productionRunId: number;
  productionCellId: number;
  topicId: number;
  topicCode: string;
  topicTitle: string;
  difficultyBand: string;
  targetProfile: unknown;
};

export type SubjectPracticeLocalGeneratorProductionProfileBinding =
  Omit<SubjectPracticeLocalGeneratorProductionProfileBindingInput, 'targetProfile'> & {
    targetProfile: TargetProfile;
    bindingDigest: string;
  };

function recordFrom(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function subjectPracticeLocalGeneratorProjectedTargetProfile(value: unknown): TargetProfile {
  const source = recordFrom(value);
  return Object.fromEntries(SUBJECT_PRACTICE_LOCAL_GENERATOR_PRODUCTION_PROFILE_FIELDS.map((field) => [
    field,
    field === 'distractorTypes'
      ? (Array.isArray(source[field]) ? source[field].map(String) : [])
      : String(source[field] ?? '')
  ])) as TargetProfile;
}

export function subjectPracticeLocalGeneratorProductionProfileBindingDigest(
  binding: SubjectPracticeLocalGeneratorProductionProfileBindingInput
) {
  const payload = {
    policyVersion: SUBJECT_PRACTICE_LOCAL_GENERATOR_PRODUCTION_PROFILE_BINDING_POLICY_VERSION,
    subject: binding.subject,
    productionRunId: binding.productionRunId,
    productionCellId: binding.productionCellId,
    topicId: binding.topicId,
    topicCode: binding.topicCode,
    topicTitle: binding.topicTitle,
    difficultyBand: binding.difficultyBand,
    targetProfile: subjectPracticeLocalGeneratorProjectedTargetProfile(binding.targetProfile)
  };
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function frozenBinding(
  binding: SubjectPracticeLocalGeneratorProductionProfileBindingInput
): SubjectPracticeLocalGeneratorProductionProfileBinding {
  const targetProfile = subjectPracticeLocalGeneratorProjectedTargetProfile(binding.targetProfile);
  const normalized = { ...binding, targetProfile };
  return Object.freeze({
    ...normalized,
    targetProfile: Object.freeze(targetProfile),
    bindingDigest: subjectPracticeLocalGeneratorProductionProfileBindingDigest(normalized)
  });
}

export const SUBJECT_PRACTICE_LOCAL_GENERATOR_PRODUCTION_PROFILE_BINDINGS = Object.freeze({
  math: frozenBinding({
    subject: 'math', productionRunId: 1, productionCellId: 16,
    topicId: 69, topicCode: 'M-FUNC-002', topicTitle: '基本初等函数', difficultyBand: 'basic',
    targetProfile: {
      gapKey: 'topic_69:concept_check:multi_step_reasoning:basic:high:light',
      questionForm: 'concept_check', cognitiveSkill: 'multi_step_reasoning', difficultyBand: 'basic',
      readingLoad: 'high', calculationLoad: 'light', distractorTypes: []
    }
  }),
  mathDerivative: frozenBinding({
    subject: 'math', productionRunId: 1, productionCellId: 10,
    topicId: 71, topicCode: 'M-CALC-001', topicTitle: '导数与微积分初步', difficultyBand: 'basic',
    targetProfile: {
      gapKey: 'topic_71:concept_check:multi_step_reasoning:basic:high:light',
      questionForm: 'concept_check', cognitiveSkill: 'multi_step_reasoning', difficultyBand: 'basic',
      readingLoad: 'high', calculationLoad: 'light', distractorTypes: []
    }
  }),
  physics: frozenBinding({
    subject: 'physics', productionRunId: 2, productionCellId: 24,
    topicId: 78, topicCode: 'P-MECH-001', topicTitle: '运动学', difficultyBand: 'basic',
    targetProfile: {
      gapKey: 'topic_78:concept_judgement:concept_discrimination:basic:low:light',
      questionForm: 'concept_judgement', cognitiveSkill: 'concept_discrimination', difficultyBand: 'basic',
      readingLoad: 'low', calculationLoad: 'light', distractorTypes: []
    }
  }),
  chemistry: frozenBinding({
    subject: 'chemistry', productionRunId: 3, productionCellId: 42,
    topicId: 51, topicCode: 'C-BASIC-003', topicTitle: '溶液浓度与 pH 计算', difficultyBand: 'medium',
    targetProfile: {
      gapKey: 'topic_51:concept_judgement:concept_discrimination:medium:low:medium',
      questionForm: 'concept_judgement', cognitiveSkill: 'concept_discrimination', difficultyBand: 'medium',
      readingLoad: 'low', calculationLoad: 'medium', distractorTypes: []
    }
  })
});

export function subjectPracticeLocalGeneratorProductionProfileBindingForCell(input: {
  subject?: unknown;
  productionRunId?: unknown;
  productionCellId?: unknown;
}) {
  const subject = String(input.subject ?? '').trim().toLowerCase();
  return Object.values(SUBJECT_PRACTICE_LOCAL_GENERATOR_PRODUCTION_PROFILE_BINDINGS).find((binding) =>
    binding.subject === subject
    && binding.productionRunId === Number(input.productionRunId)
    && binding.productionCellId === Number(input.productionCellId)
  ) ?? null;
}

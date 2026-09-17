import { SubjectPracticeObservationBatchEnvelope } from './subject-practice-observation-batch-manifest-policy';
import { subjectPracticeProductionShadowScopeContractFor } from './subject-practice-production-shadow-scope-registry';

export const SUBJECT_PRACTICE_OBSERVATION_SCOPE_BINDING_POLICY_VERSION =
  'subject-practice-observation-scope-binding-v2-math-derivative';
export const SUBJECT_PRACTICE_OBSERVATION_SUBMISSION_PLAN_POLICY_VERSION =
  'subject-practice-observation-submission-plan-v2-sealed-scope-before-gate';

export type SubjectPracticeObservationScopeRotation = {
  functionClass: string | null;
  propertyTarget: string | null;
  lineRelationScope: string | null;
  derivativeScope: string | null;
  physicsKinematicsScope: string | null;
  chemistryRelationKind: string | null;
  chemistryAnswerTarget: string | null;
};

export function subjectPracticeObservationQuestionPlanRotationInputFor(binding: {
  rotation: SubjectPracticeObservationScopeRotation;
  scenarioSeed: number;
}) {
  return {
    requiredSinglePropertyTarget: binding.rotation.propertyTarget,
    requiredElementaryFunctionClass: binding.rotation.functionClass,
    exactLineRelationScope: binding.rotation.lineRelationScope,
    exactDerivativeScope: binding.rotation.derivativeScope,
    exactPhysicsKinematicsScope: binding.rotation.physicsKinematicsScope,
    exactChemistryRelationKind: binding.rotation.chemistryRelationKind,
    exactChemistryAnswerTarget: binding.rotation.chemistryAnswerTarget,
    scenarioSeed: binding.scenarioSeed
  };
}

function clean(value: unknown) {
  return String(value ?? '').trim().toLowerCase();
}

function scenarioRotationKey(scopeId: string) {
  if (scopeId.startsWith('chemistry-strong-acid-base-v3:')) {
    return scopeId.split(':').slice(0, 2).join(':');
  }
  return scopeId;
}

export function subjectPracticeObservationScopeBindingFor(input: {
  envelope: SubjectPracticeObservationBatchEnvelope;
}) {
  const envelope = input.envelope;
  const descriptor = envelope?.manifest?.tasks?.[Number(envelope.taskOrdinal) - 1];
  if (!descriptor) throw new Error('observation_scope_binding_descriptor_missing');
  const contract = subjectPracticeProductionShadowScopeContractFor(
    descriptor.subject,
    descriptor.taskFamily,
    descriptor.planTemplate
  );
  const plannedScopeId = clean(descriptor.plannedScopeId);
  if (!contract || !contract.expectedScopeIds.includes(plannedScopeId)) {
    throw new Error('observation_scope_binding_scope_outside_registered_contract');
  }
  const rotation: SubjectPracticeObservationScopeRotation = {
    functionClass: null,
    propertyTarget: null,
    lineRelationScope: null,
    derivativeScope: null,
    physicsKinematicsScope: null,
    chemistryRelationKind: null,
    chemistryAnswerTarget: null
  };
  if (plannedScopeId.startsWith('math-basic-elementary-rotation-v1:')) {
    const parts = plannedScopeId.slice('math-basic-elementary-rotation-v1:'.length).split(':');
    if (parts.length !== 2 || parts.some((part) => !part)) throw new Error('observation_scope_binding_math_elementary_invalid');
    [rotation.functionClass, rotation.propertyTarget] = parts;
  } else if (plannedScopeId.startsWith('math-basic-line-relation-v1:')) {
    rotation.lineRelationScope = plannedScopeId.slice('math-basic-line-relation-v1:'.length);
  } else if (plannedScopeId.startsWith('math-basic-derivative-v1:')) {
    rotation.derivativeScope = plannedScopeId.slice('math-basic-derivative-v1:'.length);
  } else if (plannedScopeId.startsWith('physics-basic-kinematics-v2:')) {
    rotation.physicsKinematicsScope = plannedScopeId.slice('physics-basic-kinematics-v2:'.length);
  } else if (plannedScopeId.startsWith('chemistry-strong-acid-base-v3:')) {
    const parts = plannedScopeId.slice('chemistry-strong-acid-base-v3:'.length).split(':');
    if (parts.length !== 2 || parts.some((part) => !part)) throw new Error('observation_scope_binding_chemistry_invalid');
    [rotation.chemistryRelationKind, rotation.chemistryAnswerTarget] = parts;
  } else {
    throw new Error('observation_scope_binding_prefix_unsupported');
  }
  if (!Object.values(rotation).some(Boolean)) throw new Error('observation_scope_binding_rotation_empty');
  const rotationKey = scenarioRotationKey(plannedScopeId);
  const scenarioSeed = envelope.manifest.tasks
    .slice(0, Number(envelope.taskOrdinal))
    .filter((task) => scenarioRotationKey(clean(task.plannedScopeId)) === rotationKey)
    .length - 1;
  if (scenarioSeed < 0) throw new Error('observation_scope_binding_scenario_seed_invalid');
  return {
    policyVersion: SUBJECT_PRACTICE_OBSERVATION_SCOPE_BINDING_POLICY_VERSION,
    batchId: envelope.batchId,
    taskOrdinal: envelope.taskOrdinal,
    plannedScopeId,
    subject: descriptor.subject,
    taskFamily: descriptor.taskFamily,
    planTemplate: descriptor.planTemplate,
    rotation,
    scenarioSeed,
    scenarioSelectionBasis: 'zero_based_occurrence_within_exact_scenario_action' as const,
    authoritative: true as const,
    independentOfPriorCandidateSuccess: true as const
  };
}

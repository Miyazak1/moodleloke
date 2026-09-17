// Compatibility facade. Canonical generator algorithm lives in question-engine/core;
// CSCALite supplies QuestionPlan and provisional-scenario validation through explicit ports.
import {
  subjectPracticeQuestionPlanAdherenceFor,
  validateSubjectPracticeQuestionPlan
} from './subject-practice-question-plan-policy';
import { validateSubjectPracticeProvisionalScenarioContract } from
  './subject-practice-scenario-blueprint-materialization-policy';
import {
  createSubjectPracticePhysicsKinematicsLocalGenerator,
  SUBJECT_PRACTICE_PHYSICS_KINEMATICS_LOCAL_GENERATOR_VERSION
} from '../../../question-engine/core/subject-practice-physics-kinematics-local-generator';

export {
  createSubjectPracticePhysicsKinematicsLocalGenerator,
  SUBJECT_PRACTICE_PHYSICS_KINEMATICS_LOCAL_GENERATOR_VERSION
};
export type {
  SubjectPracticePhysicsKinematicsLocalGenerationResult,
  SubjectPracticePhysicsKinematicsLocalRelation
} from '../../../question-engine/core/subject-practice-physics-kinematics-local-generator';

export const generateSubjectPracticePhysicsKinematicsLocally =
  createSubjectPracticePhysicsKinematicsLocalGenerator({
    validate: validateSubjectPracticeQuestionPlan,
    adherenceFor: subjectPracticeQuestionPlanAdherenceFor,
    validateScenario: validateSubjectPracticeProvisionalScenarioContract
  });

// Compatibility facade. Canonical generator algorithm lives in question-engine/core;
// CSCALite supplies its complete QuestionPlan validation/adherence policy through explicit ports.
import {
  subjectPracticeQuestionPlanAdherenceFor,
  validateSubjectPracticeQuestionPlan
} from './subject-practice-question-plan-policy';
import {
  createSubjectPracticeMathDerivativeLocalGenerator,
  SUBJECT_PRACTICE_MATH_DERIVATIVE_LOCAL_GENERATOR_VERSION
} from '../../../question-engine/core/subject-practice-math-derivative-local-generator';

export {
  createSubjectPracticeMathDerivativeLocalGenerator,
  SUBJECT_PRACTICE_MATH_DERIVATIVE_LOCAL_GENERATOR_VERSION
};
export type { SubjectPracticeMathDerivativeLocalGenerationResult } from
  '../../../question-engine/core/subject-practice-math-derivative-local-generator';

export const generateSubjectPracticeMathDerivativeLocally =
  createSubjectPracticeMathDerivativeLocalGenerator({
    validate: validateSubjectPracticeQuestionPlan,
    adherenceFor: subjectPracticeQuestionPlanAdherenceFor
  });

// Compatibility facade. Canonical generator algorithm lives in question-engine/core.
import {
  subjectPracticeQuestionPlanAdherenceFor,
  validateSubjectPracticeQuestionPlan
} from './subject-practice-question-plan-policy';
import {
  createSubjectPracticeMathLineRelationLocalGenerator,
  SUBJECT_PRACTICE_MATH_LINE_RELATION_LOCAL_GENERATOR_VERSION
} from '../../../question-engine/core/subject-practice-math-line-relation-local-generator';

export {
  createSubjectPracticeMathLineRelationLocalGenerator,
  SUBJECT_PRACTICE_MATH_LINE_RELATION_LOCAL_GENERATOR_VERSION
};
export type { SubjectPracticeMathLineRelationLocalGenerationResult } from
  '../../../question-engine/core/subject-practice-math-line-relation-local-generator';

export const generateSubjectPracticeMathLineRelationLocally =
  createSubjectPracticeMathLineRelationLocalGenerator({
    validate: validateSubjectPracticeQuestionPlan,
    adherenceFor: subjectPracticeQuestionPlanAdherenceFor
  });

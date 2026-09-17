// Compatibility facade. Canonical generator algorithm lives in question-engine/core.
import { validateSubjectPracticeQuestionPlan } from './subject-practice-question-plan-policy';
import {
  createSubjectPracticeMathElementaryLocalGenerator,
  SUBJECT_PRACTICE_MATH_ELEMENTARY_LOCAL_GENERATOR_VERSION
} from '../../../question-engine/core/subject-practice-math-elementary-local-generator';

export {
  createSubjectPracticeMathElementaryLocalGenerator,
  SUBJECT_PRACTICE_MATH_ELEMENTARY_LOCAL_GENERATOR_VERSION
};
export type { SubjectPracticeMathElementaryLocalGenerationResult } from
  '../../../question-engine/core/subject-practice-math-elementary-local-generator';

export const generateSubjectPracticeMathElementaryLocally =
  createSubjectPracticeMathElementaryLocalGenerator(validateSubjectPracticeQuestionPlan);

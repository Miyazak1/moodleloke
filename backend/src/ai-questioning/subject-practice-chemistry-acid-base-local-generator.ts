// Compatibility facade. Canonical generator algorithm lives in question-engine/core;
// CSCALite supplies QuestionPlan and provisional-scenario validation through explicit ports.
import {
  subjectPracticeQuestionPlanAdherenceFor,
  validateSubjectPracticeQuestionPlan
} from './subject-practice-question-plan-policy';
import { validateSubjectPracticeProvisionalScenarioContract } from
  './subject-practice-scenario-blueprint-materialization-policy';
import {
  createSubjectPracticeChemistryAcidBaseLocalGenerator,
  SUBJECT_PRACTICE_CHEMISTRY_ACID_BASE_LOCAL_GENERATOR_VERSION
} from '../../../question-engine/core/subject-practice-chemistry-acid-base-local-generator';

export {
  createSubjectPracticeChemistryAcidBaseLocalGenerator,
  SUBJECT_PRACTICE_CHEMISTRY_ACID_BASE_LOCAL_GENERATOR_VERSION
};
export type { SubjectPracticeChemistryAcidBaseLocalGenerationResult } from
  '../../../question-engine/core/subject-practice-chemistry-acid-base-local-generator';

export const generateSubjectPracticeChemistryAcidBaseLocally =
  createSubjectPracticeChemistryAcidBaseLocalGenerator({
    validate: validateSubjectPracticeQuestionPlan,
    adherenceFor: subjectPracticeQuestionPlanAdherenceFor,
    validateScenario: validateSubjectPracticeProvisionalScenarioContract
  });

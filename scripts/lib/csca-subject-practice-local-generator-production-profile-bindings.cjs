const policy = require('../../backend/src/ai-questioning/subject-practice-local-generator-production-profile-binding-policy');

module.exports = {
  POLICY_VERSION: policy.SUBJECT_PRACTICE_LOCAL_GENERATOR_PRODUCTION_PROFILE_BINDING_POLICY_VERSION,
  PROFILE_FIELDS: policy.SUBJECT_PRACTICE_LOCAL_GENERATOR_PRODUCTION_PROFILE_FIELDS,
  bindings: policy.SUBJECT_PRACTICE_LOCAL_GENERATOR_PRODUCTION_PROFILE_BINDINGS,
  projectedTargetProfile: policy.subjectPracticeLocalGeneratorProjectedTargetProfile,
  bindingDigest: policy.subjectPracticeLocalGeneratorProductionProfileBindingDigest
};

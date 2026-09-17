import {
  SubjectPracticeScenarioBlueprintShadowContext,
  validateSubjectPracticeProvisionalScenarioContract
} from './subject-practice-scenario-blueprint-materialization-policy';

export const SUBJECT_PRACTICE_SCENARIO_BLUEPRINT_SHADOW_EVIDENCE_POLICY_VERSION =
  'subject-practice-scenario-blueprint-shadow-evidence-v2-context-participation';

type RecordValue = Record<string, unknown>;

function recordFrom(value: unknown): RecordValue | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : null;
}

function clean(value: unknown) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
}

export function subjectPracticeScenarioBlueprintShadowEvidenceFor(input: {
  scenarioBlueprintShadowContext?: SubjectPracticeScenarioBlueprintShadowContext;
  generationResult?: unknown;
}) {
  const validation = validateSubjectPracticeProvisionalScenarioContract(
    input.scenarioBlueprintShadowContext ?? {}
  );
  const contract = recordFrom(validation.provisionalScenarioContract);
  const surface = recordFrom(contract?.surface);
  const result = recordFrom(input.generationResult);
  const candidate = recordFrom(result?.candidate);
  const localizations = recordFrom(candidate?.localizations);
  const zh = recordFrom(localizations?.zh);
  const en = recordFrom(localizations?.en);
  const zhText = clean([candidate?.prompt, candidate?.explanation, zh?.prompt, zh?.explanation].join(' '));
  const enText = clean([en?.prompt, en?.explanation].join(' '));
  const subject = clean(contract?.subject);
  const solverAction = clean(contract?.solverAction);
  const contextAction = clean(contract?.contextAction);
  const informationForm = clean(contract?.informationForm);
  const questionPurpose = clean(contract?.questionPurpose);
  const blockers = [...validation.blockers];
  const digestBound = clean(result?.provisionalScenarioContractDigest)
    === clean(contract?.scenarioContractDigest);
  if (result?.status !== 'generated_and_self_verified'
    || result?.scenarioRenderMode !== 'provisional_blueprint_shadow'
    || !candidate) {
    blockers.push('scenario_blueprint_shadow_generation_not_self_verified');
  }
  if (!digestBound) blockers.push('scenario_blueprint_shadow_generation_digest_mismatch');
  const bilingualSurfaceMatched = Boolean(
    clean(surface?.zhEntity) && zhText.includes(clean(surface?.zhEntity))
    && clean(surface?.zhSetting) && zhText.includes(clean(surface?.zhSetting))
    && clean(surface?.enEntity) && enText.includes(clean(surface?.enEntity))
    && clean(surface?.enSetting) && enText.includes(clean(surface?.enSetting))
  );
  if (!bilingualSurfaceMatched) blockers.push('scenario_blueprint_shadow_surface_not_rendered');
  const physicsRelationMatched = subject !== 'physics' || (
    ['uniform_speed', 'acceleration_from_velocity_change',
      'final_velocity_from_initial_acceleration_time',
      'displacement_from_initial_acceleration_time'].includes(solverAction)
    && /m\/s|m\/s\^2|m\/s²/.test(`${zhText} ${enText}`)
    && /直线|straight/.test(`${zhText} ${enText}`)
  );
  if (!physicsRelationMatched) blockers.push('scenario_blueprint_shadow_physics_relation_not_rendered');
  const chemistryRelationMatched = subject !== 'chemistry' || (
    ['strong_acid_dilution', 'strong_base_dilution', 'strong_acid_base_neutralization'].includes(solverAction)
    && /mol\/l/.test(`${zhText} ${enText}`)
    && /ph/.test(`${zhText} ${enText}`)
    && /25\s*°?\s*c/.test(`${zhText} ${enText}`)
  );
  if (!chemistryRelationMatched) blockers.push('scenario_blueprint_shadow_chemistry_relation_not_rendered');
  const contextActionMatched = subject !== 'chemistry' || Boolean(contextAction && enText.includes(contextAction));
  const informationFormMatched = subject !== 'chemistry' || Boolean(informationForm && enText.includes(informationForm));
  const questionPurposeMatched = subject !== 'chemistry' || Boolean(questionPurpose && enText.includes(questionPurpose));
  const contextNecessityVerified = contextActionMatched && informationFormMatched
    && questionPurposeMatched && (physicsRelationMatched || chemistryRelationMatched);
  if (!contextNecessityVerified) blockers.push('scenario_blueprint_shadow_context_not_solver_participating');
  const chemistryMlValues = subject === 'chemistry'
    ? [...`${zhText} ${enText}`.matchAll(/(\d+(?:\.\d+)?)\s*ml/gi)].map((match) => Number(match[1]))
    : [];
  const chemistryConcentrations = subject === 'chemistry'
    ? [...`${zhText} ${enText}`.matchAll(/(\d+(?:\.\d+)?)\s*mol\/l/gi)].map((match) => Number(match[1]))
    : [];
  const chemistryPlausibilityMatched = subject !== 'chemistry' || Boolean(
    chemistryMlValues.length >= 2
    && chemistryMlValues.every((value) => value > 0 && value <= 10000)
    && chemistryConcentrations.length >= 1
    && chemistryConcentrations.every((value) => value > 0 && value <= 10)
  );
  if (!chemistryPlausibilityMatched) blockers.push('scenario_blueprint_shadow_chemistry_quantities_implausible');
  if (recordFrom(result?.verification)?.status !== 'verified'
    || recordFrom(result?.adherence)?.adheres !== true) {
    blockers.push('scenario_blueprint_shadow_solver_or_plan_adherence_failed');
  }
  const uniqueBlockers = [...new Set(blockers)];
  const blueprintBinding = recordFrom(contract?.blueprintBinding);
  return {
    policyVersion: SUBJECT_PRACTICE_SCENARIO_BLUEPRINT_SHADOW_EVIDENCE_POLICY_VERSION,
    status: uniqueBlockers.length ? 'rejected' : 'shadow_candidate_evidence_complete',
    blockers: uniqueBlockers,
    scenarioContractDigest: clean(contract?.scenarioContractDigest) || null,
    scenarioFamilyId: clean(contract?.scenarioFamilyId) || null,
    scenarioMode: clean(contract?.scenarioMode) || null,
    scenarioDomain: clean(contract?.scenarioDomain) || null,
    scenarioEntity: clean(contract?.scenarioEntity) || null,
    scenarioAction: contextAction || null,
    informationForm: informationForm || null,
    scenarioFingerprint: clean(blueprintBinding?.blueprintFingerprint) || null,
    contextNecessity: clean(contract?.contextNecessity) || null,
    surfaceEntity: clean(surface?.zhEntity || surface?.enEntity) || null,
    subject: subject || null,
    solverAction: solverAction || null,
    bilingualSurfaceMatched,
    physicsRelationMatched,
    chemistryRelationMatched,
    contextActionMatched,
    informationFormMatched,
    questionPurposeMatched,
    contextNecessityVerified,
    informationParticipationMatched: contextNecessityVerified,
    chemistryPlausibilityMatched,
    generatorSelfVerified: result?.status === 'generated_and_self_verified',
    planAdherent: recordFrom(result?.adherence)?.adheres === true,
    solverVerified: recordFrom(result?.verification)?.status === 'verified',
    providerCallCount: 0,
    estimatedCostUsd: 0,
    databaseImpact: 'none',
    publicationAuthorized: false,
    releaseQualification: false,
    productionGateImpact: 'none_shadow_only'
  };
}

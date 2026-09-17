import { createHash } from 'node:crypto';
import {
  SUBJECT_PRACTICE_SCENARIO_BLUEPRINT_ORCHESTRATOR_VERSION
} from './subject-practice-scenario-blueprint-orchestrator';
import {
  subjectPracticeScenarioBlueprintProposalFor
} from './subject-practice-scenario-blueprint-policy';
import {
  subjectPracticeScenarioBlueprintCompatibilityFor
} from './subject-practice-scenario-blueprint-compatibility-policy';

export const SUBJECT_PRACTICE_PROVISIONAL_SCENARIO_CONTRACT_SCHEMA_VERSION =
  'subject-practice-scenario-contract-v2-provisional-blueprint';
export const SUBJECT_PRACTICE_SCENARIO_BLUEPRINT_MATERIALIZATION_POLICY_VERSION =
  'subject-practice-scenario-blueprint-materialization-v4-method-neutral-chemistry';

type RecordValue = Record<string, unknown>;

function recordFrom(value: unknown): RecordValue | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : null;
}

function clean(value: unknown) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function lower(value: unknown) {
  return clean(value).toLowerCase();
}

function digestFor(value: unknown) {
  return createHash('sha256').update(JSON.stringify(canonicalValue(value))).digest('hex');
}

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  const record = recordFrom(value);
  if (!record) return value;
  return Object.fromEntries(Object.keys(record).sort().map((key) => [key, canonicalValue(record[key])]));
}

function deterministicConstraintsFor(subject: string, exactScope: string) {
  if (subject === 'physics') {
    return {
      requiredInformationFields: ['contextAction', 'motionCondition', 'quantitiesWithSiUnits'],
      solverRelevantFields: ['solverAction', 'motionCondition', 'quantitiesWithSiUnits'],
      plausibility: {
        straightLineMotion: true,
        siUnitsRequired: true,
        signedVelocityAndAccelerationAllowed: true,
        exactKinematicsScope: exactScope
      }
    };
  }
  return {
    requiredInformationFields: ['contextAction', 'reactionOrDilutionCondition', 'concentrationsAndVolumesWithUnits'],
    solverRelevantFields: ['solverAction', 'reactionOrDilutionCondition', 'concentrationsAndVolumesWithUnits'],
    plausibility: {
      temperatureC: 25,
      completeDissociationOnly: true,
      visibleConcentrationAndVolumeUnits: true,
      exactChemistryScope: exactScope
    }
  };
}

export function subjectPracticeScenarioBlueprintMaterializationFor(input: {
  binding?: unknown;
  selectedBlueprint?: unknown;
  ideationCycle?: unknown;
}) {
  const binding = recordFrom(input.binding);
  const blueprint = recordFrom(input.selectedBlueprint);
  const cycle = recordFrom(input.ideationCycle);
  const creativeBlueprint = recordFrom(blueprint?.creativeBlueprint);
  const recomputed = subjectPracticeScenarioBlueprintProposalFor({
    binding,
    proposal: creativeBlueprint
  });
  const blockers: string[] = [];
  if (cycle?.orchestratorVersion !== SUBJECT_PRACTICE_SCENARIO_BLUEPRINT_ORCHESTRATOR_VERSION
    || cycle?.status !== 'selected_provisional_blueprint_shadow_only'
    || !clean(cycle?.cycleEvidenceDigest)) {
    blockers.push('scenario_blueprint_materialization_cycle_invalid');
  }
  if (recomputed.status !== 'provisional_candidate'
    || recomputed.blueprintDigest !== blueprint?.blueprintDigest
    || recomputed.blueprintFingerprint !== blueprint?.blueprintFingerprint
    || recomputed.renameInvariantFingerprint !== blueprint?.renameInvariantFingerprint) {
    blockers.push('scenario_blueprint_materialization_blueprint_identity_invalid');
  }
  if (cycle?.selectedBlueprintDigest !== blueprint?.blueprintDigest
    || cycle?.selectedBlueprintFingerprint !== blueprint?.blueprintFingerprint) {
    blockers.push('scenario_blueprint_materialization_selection_mismatch');
  }
  const subject = lower(binding?.subject);
  const exactScope = lower(binding?.exactScope);
  if (!['physics', 'chemistry'].includes(subject) || !exactScope) {
    blockers.push('scenario_blueprint_materialization_binding_invalid');
  }
  const compatibility = subjectPracticeScenarioBlueprintCompatibilityFor({
    subject,
    proposal: creativeBlueprint
  });
  if (!compatibility.compatible) {
    blockers.push('scenario_blueprint_materialization_chemistry_context_incompatible');
    blockers.push(...compatibility.reasonCodes);
  }
  if (blockers.length) {
    return {
      policyVersion: SUBJECT_PRACTICE_SCENARIO_BLUEPRINT_MATERIALIZATION_POLICY_VERSION,
      status: 'rejected', blockers: [...new Set(blockers)], provisionalScenarioContract: null,
      productionGenerationAuthorized: false, publicationAuthorized: false,
      productionGateImpact: 'none_shadow_only'
    };
  }
  const deterministic = deterministicConstraintsFor(subject, exactScope);
  const scenarioFamilyId = `provisional_${subject}_${String(blueprint?.blueprintFingerprint).replace(/^blueprint-/, '')}`;
  const contractCore = {
    schemaVersion: SUBJECT_PRACTICE_PROVISIONAL_SCENARIO_CONTRACT_SCHEMA_VERSION,
    policyVersion: SUBJECT_PRACTICE_SCENARIO_BLUEPRINT_MATERIALIZATION_POLICY_VERSION,
    stage: 'provisional_shadow_only',
    subject,
    taskFamily: lower(binding?.taskFamily),
    planTemplate: lower(binding?.planTemplate),
    scenarioFamilyId,
    scenarioMode: lower(creativeBlueprint?.scenarioMode),
    scenarioDomain: lower(creativeBlueprint?.scenarioDomain),
    scenarioEntity: lower(creativeBlueprint?.scenarioEntity),
    environment: lower(creativeBlueprint?.environment),
    contextAction: lower(creativeBlueprint?.scenarioAction),
    solverAction: exactScope,
    informationForm: lower(creativeBlueprint?.informationForm),
    questionPurpose: lower(creativeBlueprint?.questionPurpose),
    contextNecessity: 'required_for_solution',
    ...deterministic,
    surface: recordFrom(creativeBlueprint?.surface),
    blueprintBinding: {
      blueprintDigest: blueprint?.blueprintDigest,
      blueprintFingerprint: blueprint?.blueprintFingerprint,
      renameInvariantFingerprint: blueprint?.renameInvariantFingerprint,
      ideationCycleEvidenceDigest: cycle?.cycleEvidenceDigest
    },
    sourceIsolation: {
      officialQuestionContentUsed: false,
      reversibleSourceFieldsUsed: false,
      selectionBasis: 'validated_blueprint_cycle_only'
    }
  };
  return {
    policyVersion: SUBJECT_PRACTICE_SCENARIO_BLUEPRINT_MATERIALIZATION_POLICY_VERSION,
    status: 'materialized_provisional_scenario_contract',
    blockers: [],
    provisionalScenarioContract: {
      ...contractCore,
      scenarioContractDigest: digestFor(contractCore)
    },
    modelControlsSolverAction: false,
    deterministicPolicyControlsSolverAction: true,
    deterministicPolicyControlsPlausibility: true,
    productionGenerationAuthorized: false,
    publicationAuthorized: false,
    productionGateImpact: 'none_shadow_only'
  };
}

export type SubjectPracticeScenarioBlueprintShadowContext = {
  binding?: unknown;
  selectedBlueprint?: unknown;
  ideationCycle?: unknown;
  provisionalScenarioContract?: unknown;
};

export function validateSubjectPracticeProvisionalScenarioContract(input: SubjectPracticeScenarioBlueprintShadowContext) {
  const expected = subjectPracticeScenarioBlueprintMaterializationFor({
    binding: input.binding,
    selectedBlueprint: input.selectedBlueprint,
    ideationCycle: input.ideationCycle
  });
  const provided = recordFrom(input.provisionalScenarioContract);
  const providedCore = provided
    ? Object.fromEntries(Object.entries(provided).filter(([key]) => key !== 'scenarioContractDigest'))
    : null;
  const providedDigest = clean(provided?.scenarioContractDigest);
  const expectedContract = recordFrom(expected.provisionalScenarioContract);
  const expectedDigest = clean(expectedContract?.scenarioContractDigest);
  const blockers: string[] = [];
  if (expected.status !== 'materialized_provisional_scenario_contract' || !expectedContract) {
    blockers.push('provisional_scenario_contract_upstream_evidence_invalid');
  }
  if (!provided || !providedCore || !providedDigest || digestFor(providedCore) !== providedDigest) {
    blockers.push('provisional_scenario_contract_digest_invalid');
  }
  if (providedDigest !== expectedDigest
    || JSON.stringify(canonicalValue(providedCore)) !== JSON.stringify(canonicalValue(
      expectedContract
        ? Object.fromEntries(Object.entries(expectedContract).filter(([key]) => key !== 'scenarioContractDigest'))
        : null
    ))) {
    blockers.push('provisional_scenario_contract_materialization_mismatch');
  }
  return {
    policyVersion: SUBJECT_PRACTICE_SCENARIO_BLUEPRINT_MATERIALIZATION_POLICY_VERSION,
    status: blockers.length ? 'rejected' : 'validated_shadow_only',
    valid: blockers.length === 0,
    blockers: [...new Set(blockers)],
    provisionalScenarioContract: blockers.length ? null : expected.provisionalScenarioContract,
    productionGenerationAuthorized: false,
    publicationAuthorized: false,
    productionGateImpact: 'none_shadow_only'
  };
}

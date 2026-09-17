export const SUBJECT_PRACTICE_SCENARIO_BLUEPRINT_COMPATIBILITY_POLICY_VERSION =
  'subject-practice-scenario-blueprint-compatibility-v3-method-neutral-single-liquid';

type RecordValue = Record<string, unknown>;

function recordFrom(value: unknown): RecordValue | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : null;
}

function clean(value: unknown) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
}

export function subjectPracticeScenarioBlueprintCompatibilityFor(input: {
  subject?: unknown;
  proposal?: unknown;
}) {
  const subject = clean(input.subject);
  if (subject !== 'chemistry') {
    return {
      policyVersion: SUBJECT_PRACTICE_SCENARIO_BLUEPRINT_COMPATIBILITY_POLICY_VERSION,
      compatible: true,
      reasonCodes: [] as string[]
    };
  }
  const proposal = recordFrom(input.proposal);
  const entity = clean(proposal?.scenarioEntity);
  const action = clean(proposal?.scenarioAction);
  const contextText = [
    proposal?.scenarioDomain,
    proposal?.environment,
    proposal?.informationForm,
    proposal?.questionPurpose
  ].map(clean).join(' ');
  const allText = [entity, action, contextText].join(' ');
  const reasonCodes: string[] = [];
  if (!/solution|sample|aliquot|mixture|liquid|water|reagent/.test(entity)) {
    reasonCodes.push('scenario_blueprint_chemistry_entity_incompatible');
  }
  if (!/prepare|dilut|mix|neutral|test|measure|assess|inspect|analy[sz]|treat|adjust|monitor|document/.test(action)) {
    reasonCodes.push('scenario_blueprint_chemistry_action_incompatible');
  }
  if (!/chem|laborator|solution|reagent|water quality|process|calibrat|analyt|sample preparation/.test(contextText)) {
    reasonCodes.push('scenario_blueprint_chemistry_context_signal_missing');
  }
  const unsupportedProcedure = /titration|titrant|endpoint|indicator|buffer|weak acid|weak base|polyprotic|hydrolysis|equilibrium|reagent strip|test strip|colou?r (?:response|transition|change)|precipitate|stabili[sz](?:e|ed|ing)|dissolv(?:e|ed|ing) (?:a )?(?:solid|solute)|over time/.test(allText);
  const multiSampleStructure = /\b(?:replicate|replicates|duplicate|duplicates|paired|multiple|several|both|batch|batches)\b|\b(?:samples|aliquots|solutions|mixtures|reagents)\b|compare two|two (?:aliquots|samples|batches|solutions)/.test(allText);
  const nonSolutionObservation = /surface exposure|repeated visit|visual field tracking/.test(allText);
  if (unsupportedProcedure) {
    reasonCodes.push('scenario_blueprint_chemistry_unsupported_procedure');
  }
  if (multiSampleStructure) {
    reasonCodes.push('scenario_blueprint_chemistry_multi_sample_structure');
  }
  if (nonSolutionObservation) {
    reasonCodes.push('scenario_blueprint_chemistry_non_solution_observation');
  }
  if (unsupportedProcedure || multiSampleStructure || nonSolutionObservation) {
    reasonCodes.push('scenario_blueprint_chemistry_out_of_scope_structure');
  }
  return {
    policyVersion: SUBJECT_PRACTICE_SCENARIO_BLUEPRINT_COMPATIBILITY_POLICY_VERSION,
    compatible: reasonCodes.length === 0,
    reasonCodes
  };
}

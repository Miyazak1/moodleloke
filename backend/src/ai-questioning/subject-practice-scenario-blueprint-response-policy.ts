import { createHash } from 'node:crypto';
import {
  SUBJECT_PRACTICE_SCENARIO_BLUEPRINT_IDEATION_POLICY_VERSION
} from './subject-practice-scenario-blueprint-ideation-policy';
import {
  subjectPracticeScenarioBlueprintProposalFor
} from './subject-practice-scenario-blueprint-policy';
import {
  subjectPracticeScenarioBlueprintCompatibilityFor
} from './subject-practice-scenario-blueprint-compatibility-policy';

export const SUBJECT_PRACTICE_SCENARIO_BLUEPRINT_RESPONSE_POLICY_VERSION =
  'subject-practice-scenario-blueprint-response-gate-v8-method-neutral-chemistry';

type RecordValue = Record<string, unknown>;

function recordFrom(value: unknown): RecordValue | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : null;
}

function clean(value: unknown) {
  return String(value ?? '').trim();
}

const INSTRUCTION_LIKE_PURPOSE = /\b(?:generic|calculated\s+target|without\s+naming|solver[- ]neutral|exact\s+quantity)\b|通用观察|不命名|计算目标|求解器中立|确切量/i;

function creativeSpecificityFailureCodes(proposal: unknown) {
  const record = recordFrom(proposal);
  const questionPurpose = clean(record?.questionPurpose).toLowerCase();
  const scenarioAction = clean(record?.scenarioAction).toLowerCase();
  return questionPurpose && (INSTRUCTION_LIKE_PURPOSE.test(questionPurpose)
    || questionPurpose === scenarioAction)
    ? ['scenario_blueprint_question_purpose_not_specific']
    : [];
}

export function subjectPracticeScenarioBlueprintResponseGateFor(input: {
  ideationRequest?: unknown;
  rawResponse?: unknown;
}) {
  const request = recordFrom(input.ideationRequest);
  const requestPayload = recordFrom(request?.requestPayload);
  const requestBinding = recordFrom(requestPayload?.binding);
  const recomputedRequestDigest = requestPayload
    ? createHash('sha256').update(JSON.stringify(requestPayload)).digest('hex')
    : '';
  const rawResponse = typeof input.rawResponse === 'string' ? input.rawResponse.trim() : '';
  const blockers: string[] = [];
  if (request?.policyVersion !== SUBJECT_PRACTICE_SCENARIO_BLUEPRINT_IDEATION_POLICY_VERSION
    || request?.status !== 'ready_for_separately_authorized_shadow_ideation'
    || !requestBinding
    || recomputedRequestDigest !== clean(request?.requestDigest)
    || Number(requestPayload?.requestedCandidateCount) !== Number(request?.requestedCandidateCount)
    || !Number.isInteger(Number(request?.requestedCandidateCount))) {
    blockers.push('scenario_blueprint_response_request_contract_invalid');
  }
  const maximumResponseCharacters = Number(request?.maximumResponseCharacters) || 24_000;
  if (!rawResponse || rawResponse.length > maximumResponseCharacters) {
    blockers.push('scenario_blueprint_response_size_invalid');
  }
  if (/```/.test(rawResponse)) blockers.push('scenario_blueprint_response_markdown_wrapper_forbidden');
  let parsed: RecordValue | null = null;
  if (rawResponse && !blockers.includes('scenario_blueprint_response_markdown_wrapper_forbidden')) {
    try {
      parsed = recordFrom(JSON.parse(rawResponse));
    } catch {
      blockers.push('scenario_blueprint_response_json_invalid');
    }
  }
  if (parsed && (Object.keys(parsed).length !== 1
    || !Object.prototype.hasOwnProperty.call(parsed, 'candidates'))) {
    blockers.push('scenario_blueprint_response_top_level_schema_invalid');
  }
  const candidates = Array.isArray(parsed?.candidates) ? parsed.candidates : [];
  if (!Array.isArray(parsed?.candidates)
    || candidates.length !== Number(request?.requestedCandidateCount)) {
    blockers.push('scenario_blueprint_response_candidate_count_mismatch');
  }
  const blueprints = candidates.map((proposal) => subjectPracticeScenarioBlueprintProposalFor({
    binding: requestBinding,
    proposal
  }));
  const creativeSpecificityFailures = candidates.map(creativeSpecificityFailureCodes);
  const subjectCompatibilityFailures = candidates.map((proposal) =>
    subjectPracticeScenarioBlueprintCompatibilityFor({
      subject: clean(requestBinding?.subject).toLowerCase(),
      proposal
    }).reasonCodes);
  const candidateDiagnostics = blueprints.map((item, index) => ({
    ordinal: index + 1,
    status: item.status === 'provisional_candidate'
      && (creativeSpecificityFailures[index].length || subjectCompatibilityFailures[index].length)
      ? 'rejected'
      : item.status,
    failureCodes: [...new Set([
      ...item.failureCodes,
      ...creativeSpecificityFailures[index],
      ...(subjectCompatibilityFailures[index].length ? ['scenario_blueprint_chemistry_context_incompatible'] : []),
      ...subjectCompatibilityFailures[index]
    ])]
  }));
  if (blueprints.some((item) => item.status !== 'provisional_candidate')
    || creativeSpecificityFailures.some((failureCodes) => failureCodes.length > 0)
    || subjectCompatibilityFailures.some((failureCodes) => failureCodes.length > 0)) {
    blockers.push('scenario_blueprint_response_candidate_invalid');
  }
  const fullFingerprints = blueprints.map((item) => item.blueprintFingerprint).filter(Boolean);
  const structureFingerprints = blueprints.map((item) => item.renameInvariantFingerprint).filter(Boolean);
  if (new Set(fullFingerprints).size !== fullFingerprints.length) {
    blockers.push('scenario_blueprint_response_within_batch_duplicate');
  }
  if (new Set(structureFingerprints).size !== structureFingerprints.length) {
    blockers.push('scenario_blueprint_response_within_batch_rename_only');
  }
  const accepted = blockers.length === 0;
  const evidence = accepted ? blueprints.map((item, index) => ({
    ordinal: index + 1,
    blueprintDigest: item.blueprintDigest,
    blueprintFingerprint: item.blueprintFingerprint,
    renameInvariantFingerprint: item.renameInvariantFingerprint
  })) : [];
  return {
    policyVersion: SUBJECT_PRACTICE_SCENARIO_BLUEPRINT_RESPONSE_POLICY_VERSION,
    status: accepted ? 'accepted_provisional_blueprint_batch' : 'rejected_entire_blueprint_batch',
    blockers: [...new Set(blockers)],
    expectedCandidateCount: Number(request?.requestedCandidateCount) || null,
    observedCandidateCount: candidates.length,
    acceptedCandidateCount: accepted ? blueprints.length : 0,
    candidateDiagnostics,
    allOrNothing: true,
    cherryPickingAllowed: false,
    responseEvidenceDigest: accepted
      ? createHash('sha256').update(JSON.stringify({ requestDigest: request?.requestDigest, evidence })).digest('hex')
      : null,
    blueprints: accepted ? blueprints : [],
    rawResponseRetained: false,
    providerCallAuthorized: false,
    productionGenerationAuthorized: false,
    publicationAuthorized: false,
    productionGateImpact: 'none_shadow_only'
  };
}

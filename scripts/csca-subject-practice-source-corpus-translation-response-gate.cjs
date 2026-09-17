#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { sha256, payloadValid } = require('./csca-subject-practice-source-corpus-translation-work-pack.cjs');
const { buildPromptArtifact, fixture: promptFixture } = require(
  './csca-subject-practice-source-corpus-translation-prompt.cjs'
);

const MODE = 'subject_practice_source_corpus_translation_response_gate_v1';
const SCHEMA_VERSION = 'subject-practice-source-corpus-translation-response-gate-v1';
const ITEM_KEYS = Object.freeze([
  'itemId', 'targetLanguage', 'prompt', 'options', 'correctAnswer', 'explanation'
]);

function text(value) { return String(value ?? '').trim(); }
function canonicalJsonValue(value) {
  if (Array.isArray(value)) return value.map(canonicalJsonValue);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .filter(([, entry]) => entry !== undefined).sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => [key, canonicalJsonValue(entry)]));
  return value;
}

function strictJsonObject(content) {
  const raw = String(content ?? '').trim();
  if (!raw.startsWith('{') || !raw.endsWith('}') || raw.includes('```')) {
    throw new Error('source_corpus_translation_response_not_strict_json');
  }
  const parsed = JSON.parse(raw);
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    throw new Error('source_corpus_translation_response_not_object');
  }
  return parsed;
}

function requestItems(promptArtifact) {
  const userMessage = promptArtifact.providerRequest?.messages?.find((message) => message.role === 'user');
  const payload = strictJsonObject(userMessage?.content);
  if (!Array.isArray(payload.items) || payload.items.length !== promptArtifact.itemCount) {
    throw new Error('source_corpus_translation_response_prompt_items_invalid');
  }
  return payload.items;
}

function optionLabel(option, index) {
  if (option && typeof option === 'object' && !Array.isArray(option)) {
    return text(option.id ?? option.key ?? option.label) || `#${index + 1}`;
  }
  const match = String(option ?? '').match(/^\s*([A-H])\s*[.):：、]/i);
  return match ? match[1].toUpperCase() : `#${index + 1}`;
}

function optionsStructurePreserved(source, translated) {
  if (!Array.isArray(source) || !Array.isArray(translated) || source.length !== translated.length) return false;
  return source.every((option, index) => {
    const target = translated[index];
    const bothObjects = option && target && typeof option === 'object' && typeof target === 'object'
      && !Array.isArray(option) && !Array.isArray(target);
    const bothStrings = typeof option === 'string' && typeof target === 'string';
    if (bothStrings) return optionLabel(option, index) === optionLabel(target, index);
    if (!bothObjects || Object.keys(option).sort().join('|') !== Object.keys(target).sort().join('|')
      || optionLabel(option, index) !== optionLabel(target, index)) return false;
    return Object.keys(option).filter((key) => key !== 'text').every((key) =>
      JSON.stringify(canonicalJsonValue(option[key])) === JSON.stringify(canonicalJsonValue(target[key])));
  });
}

function protectedTokens(value) {
  const raw = String(value ?? '');
  const patterns = [
    /\$[^$\r\n]+\$/g,
    /\\\([^\r\n]+?\\\)|\\\[[^\r\n]+?\\\]/g,
    /\\[A-Za-z]+(?:\{[^{}\r\n]*\})*/g,
    /\b(?:[A-Z][a-z]?\d*){2,}(?:[+-])?\b/g,
    /\b\d+(?:\.\d+)?\s?(?:m\/s|km\/h|kg|mg|mol|mL|L|cm|mm|km|m|s|N|J|W|Pa|V|A|Hz|K|°C|%)\b/g,
    /\b\d+(?:\.\d+)?\b/g
  ];
  const tokens = [];
  for (const pattern of patterns) for (const match of raw.matchAll(pattern)) tokens.push(match[0]);
  return tokens.sort();
}

function protectedNotationPreserved(sourceItem, translatedItem) {
  const sourceText = JSON.stringify([sourceItem.prompt, sourceItem.options, sourceItem.explanation]);
  const translatedText = JSON.stringify([translatedItem.prompt, translatedItem.options, translatedItem.explanation]);
  return JSON.stringify(protectedTokens(sourceText)) === JSON.stringify(protectedTokens(translatedText));
}

function itemAssessment(sourceItem, translatedItem) {
  const exactKeys = translatedItem && typeof translatedItem === 'object' && !Array.isArray(translatedItem)
    && Object.keys(translatedItem).sort().join('|') === [...ITEM_KEYS].sort().join('|');
  const checks = {
    exactOutputShape: exactKeys,
    itemIdMatches: text(translatedItem?.itemId) === text(sourceItem.itemId),
    targetLanguageMatches: text(translatedItem?.targetLanguage).toLowerCase()
      === text(sourceItem.targetLanguage).toLowerCase(),
    translatedFieldsNonEmpty: Boolean(text(translatedItem?.prompt) && text(translatedItem?.explanation)),
    optionLabelsAndOrderPreserved: optionsStructurePreserved(sourceItem.options, translatedItem?.options),
    correctAnswerInvariant: text(translatedItem?.correctAnswer) === text(sourceItem.correctAnswer),
    protectedNotationInvariant: protectedNotationPreserved(sourceItem, translatedItem ?? {})
  };
  return {
    itemId: text(sourceItem.itemId),
    status: Object.values(checks).every(Boolean)
      ? 'deterministic_checks_passed_pending_human_review'
      : 'deterministic_checks_failed',
    checks,
    translatedFields: exactKeys ? canonicalJsonValue({
      prompt: translatedItem.prompt, options: translatedItem.options,
      correctAnswer: translatedItem.correctAnswer, explanation: translatedItem.explanation
    }) : null
  };
}

function assessTranslationResponse(input) {
  const promptArtifact = input.promptArtifact;
  const responseEnvelope = input.responseEnvelope;
  if (!payloadValid(promptArtifact)
    || promptArtifact.schemaVersion !== 'subject-practice-source-corpus-translation-prompt-v1'
    || promptArtifact.executionAuthorized !== false
    || !payloadValid(responseEnvelope)
    || responseEnvelope.promptPayloadSha256 !== promptArtifact.payloadSha256
    || responseEnvelope.providerRequestSha256 !== promptArtifact.providerRequestSha256
    || responseEnvelope.batchId !== promptArtifact.batchId
    || responseEnvelope.provider !== promptArtifact.providerRequest.provider
    || responseEnvelope.model !== promptArtifact.providerRequest.model) {
    throw new Error('source_corpus_translation_response_envelope_invalid_or_unbound');
  }
  const actualCostUsd = Number(responseEnvelope.actualCostUsd);
  if (!Number.isFinite(actualCostUsd) || actualCostUsd < 0
    || actualCostUsd > promptArtifact.maxEstimatedCostUsd) {
    throw new Error('source_corpus_translation_response_cost_cap_invalid_or_exceeded');
  }
  const parsed = strictJsonObject(responseEnvelope.content);
  if (Object.keys(parsed).join('|') !== 'items' || !Array.isArray(parsed.items)) {
    throw new Error('source_corpus_translation_response_schema_invalid');
  }
  const requestedItems = requestItems(promptArtifact);
  const responseIds = parsed.items.map((item) => text(item?.itemId));
  const requestedIds = requestedItems.map((item) => text(item.itemId));
  if (responseIds.length !== requestedIds.length
    || new Set(responseIds).size !== responseIds.length
    || responseIds.some((id, index) => id !== requestedIds[index])) {
    throw new Error('source_corpus_translation_response_item_set_or_order_mismatch');
  }
  const assessments = requestedItems.map((item, index) => itemAssessment(item, parsed.items[index]));
  const deterministicPass = assessments.every((assessment) =>
    assessment.status === 'deterministic_checks_passed_pending_human_review');
  const payload = {
    schemaVersion: SCHEMA_VERSION,
    mode: MODE,
    status: deterministicPass
      ? 'ready_for_independent_human_bilingual_review'
      : 'rejected_by_deterministic_translation_checks',
    promptPayloadSha256: promptArtifact.payloadSha256,
    providerRequestSha256: promptArtifact.providerRequestSha256,
    responseEnvelopePayloadSha256: responseEnvelope.payloadSha256,
    batchId: promptArtifact.batchId,
    provider: responseEnvelope.provider,
    model: responseEnvelope.model,
    actualCostUsd,
    usage: canonicalJsonValue(responseEnvelope.usage ?? {}),
    itemCount: assessments.length,
    deterministicPassedItemCount: assessments.filter((assessment) =>
      assessment.status === 'deterministic_checks_passed_pending_human_review').length,
    assessments,
    humanReviewRequirements: {
      independentBilingualReviewerRequired: true,
      reviewerMustSeeBoundSourceAndTranslation: true,
      semanticEquivalenceDecisionRequiredPerItem: true,
      scientificCorrectnessDecisionRequiredPerItem: true,
      reviewerIdentityAndLockedAtRequired: true
    },
    sourceCorpusAdmissionEligible: false,
    formalReleaseEligible: false,
    databaseWriteAllowed: false,
    studentPublicationAllowed: false,
    providerImpact: 'none_response_assessment_only',
    databaseImpact: 'none',
    publicationImpact: 'none'
  };
  return { ...payload, payloadSha256: sha256(payload) };
}

function workspaceJsonPath(workspaceRoot, value, options = {}) {
  const root = path.resolve(workspaceRoot); const target = path.resolve(root, text(value));
  const relative = path.relative(root, target);
  if (!text(value) || !relative || relative === '..' || relative.startsWith(`..${path.sep}`)
    || path.isAbsolute(relative) || !target.toLowerCase().endsWith('.json')
    || (options.mustExist && !fs.existsSync(target)) || (options.mustBeNew && fs.existsSync(target))) {
    throw new Error('source_corpus_translation_response_workspace_json_path_invalid');
  }
  return target;
}

function argsFrom(argv) {
  const result = {};
  for (const token of argv) if (token.startsWith('--')) {
    const [key, ...rest] = token.slice(2).split('='); result[key] = rest.length ? rest.join('=') : true;
  }
  return result;
}

function preflight() {
  return { mode: MODE, status: 'preflight_only_no_files_read_or_written', executeRequired: true,
    requiredInputs: ['bound_prompt_artifact', 'provider_response_envelope', 'new_output_json'],
    sourceCorpusAdmissionEligible: false, providerImpact: 'none_no_provider_call',
    databaseImpact: 'none', publicationImpact: 'none' };
}

function execute(input) {
  const workspaceRoot = path.resolve(input.workspaceRoot ?? process.cwd());
  const read = (value) => JSON.parse(fs.readFileSync(workspaceJsonPath(workspaceRoot, value,
    { mustExist: true }), 'utf8'));
  const artifact = assessTranslationResponse({ promptArtifact: read(input.prompt),
    responseEnvelope: read(input.response) });
  const outputPath = workspaceJsonPath(workspaceRoot, input.out, { mustBeNew: true });
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  return { ...artifact, outputPath };
}

function sealedResponse(promptArtifact, items, overrides = {}) {
  const body = { promptPayloadSha256: promptArtifact.payloadSha256,
    providerRequestSha256: promptArtifact.providerRequestSha256, batchId: promptArtifact.batchId,
    provider: promptArtifact.providerRequest.provider, model: promptArtifact.providerRequest.model,
    actualCostUsd: 0.003, usage: { promptTokens: 100, completionTokens: 120 },
    content: JSON.stringify({ items }), ...overrides };
  return { ...body, payloadSha256: sha256(body) };
}

function throws(fn) { try { fn(); return false; } catch { return true; } }

function runSelfTest() {
  const { record, workPack } = promptFixture();
  const promptArtifact = buildPromptArtifact({ workPack, batchId: 'translation-batch-0001',
    localRecords: [record], databaseRecords: [], model: 'fixture-model', maxOutputTokens: 3000 });
  const source = requestItems(promptArtifact)[0];
  const translated = { itemId: source.itemId, targetLanguage: 'en',
    prompt: 'At 25 °C, which statement about H2O is correct?',
    options: [{ id: 'A', text: 'Statement A' }, { id: 'B', text: 'Statement B' }],
    correctAnswer: 'A', explanation: 'At 25 °C, statement A matches the definition of H2O.' };
  const accepted = assessTranslationResponse({ promptArtifact,
    responseEnvelope: sealedResponse(promptArtifact, [translated]) });
  const wrongAnswer = sealedResponse(promptArtifact, [{ ...translated, correctAnswer: 'B' }]);
  const wrongNotation = sealedResponse(promptArtifact, [{ ...translated,
    prompt: 'At 25 °C, which statement about H2 is correct?',
    explanation: 'At 25 °C, statement A matches the definition of H2.' }]);
  const markdown = sealedResponse(promptArtifact, [translated], {
    content: `\`\`\`json\n${JSON.stringify({ items: [translated] })}\n\`\`\``
  });
  const overCost = sealedResponse(promptArtifact, [translated], { actualCostUsd: 0.007 });
  const checks = {
    validResponseRequiresHumanReview: accepted.status === 'ready_for_independent_human_bilingual_review'
      && accepted.sourceCorpusAdmissionEligible === false,
    answerMutationRejected: assessTranslationResponse({ promptArtifact,
      responseEnvelope: wrongAnswer }).status === 'rejected_by_deterministic_translation_checks',
    notationMutationRejected: assessTranslationResponse({ promptArtifact,
      responseEnvelope: wrongNotation }).status === 'rejected_by_deterministic_translation_checks',
    markdownWrapperRejected: throws(() => assessTranslationResponse({ promptArtifact,
      responseEnvelope: markdown })),
    actualCostCapEnforced: throws(() => assessTranslationResponse({ promptArtifact,
      responseEnvelope: overCost })),
    preflightHasNoSideEffects: preflight().status === 'preflight_only_no_files_read_or_written',
    pathEscapeRejected: throws(() => workspaceJsonPath(process.cwd(), '../outside.json', { mustBeNew: true }))
  };
  return { mode: `${MODE}_self_test`, reportVersion: `${SCHEMA_VERSION}-self-test-v1`,
    status: Object.values(checks).every(Boolean) ? 'passed' : 'failed', checks,
    providerImpact: 'none_fixture_only', databaseImpact: 'none_fixture_only', publicationImpact: 'none' };
}

if (require.main === module) {
  try {
    const args = argsFrom(process.argv.slice(2));
    let report;
    if (args['self-test']) report = runSelfTest();
    else if (!args.execute) report = preflight();
    else {
      if (![args.prompt, args.response, args.out].every((value) => text(value))) {
        throw new Error('source_corpus_translation_response_execute_inputs_missing');
      }
      report = execute({ prompt: args.prompt, response: args.response, out: args.out });
    }
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (report.status === 'failed') process.exitCode = 1;
  } catch (error) { process.stderr.write(`${error?.stack ?? error}\n`); process.exitCode = 1; }
}

module.exports = { MODE, SCHEMA_VERSION, strictJsonObject, protectedTokens, requestItems,
  assessTranslationResponse, sealedResponse, workspaceJsonPath, preflight, execute, runSelfTest };

import { createHash } from 'node:crypto';
import { GeneratedQuestionCandidate } from './ai-questioning.types';
import {
  normalizeSubjectPracticeSourceCorpusText,
  SUBJECT_PRACTICE_SOURCE_CORPUS_NORMALIZATION_VERSION
} from './subject-practice-source-corpus-scan-policy';

export const SUBJECT_PRACTICE_CANDIDATE_OUTPUT_NOVELTY_POLICY_VERSION =
  'subject-practice-candidate-output-novelty-shadow-policy-low-information-scalar-aware-v8';
export const SUBJECT_PRACTICE_STRUCTURED_SOURCE_CORPUS_SCHEMA_VERSION =
  'subject-practice-structured-source-corpus-v3';
export const SUBJECT_PRACTICE_CANDIDATE_NOVELTY_MATCH_DIGEST_VERSION =
  'subject-practice-candidate-novelty-match-set-sha256-v1';
export const SUBJECT_PRACTICE_CANDIDATE_NOVELTY_CORPUS_SNAPSHOT_VERSION =
  'subject-practice-candidate-novelty-corpus-snapshot-sha256-v1';

type SourceSystem = 'local_file' | 'production_database' | 'remote_sync';
type MatchStatus = 'block' | 'ambiguous' | 'clear';

type LocalizedQuestionFields = {
  language: string;
  prompt: string;
  options: string[];
  answer: string;
  explanation: string;
};

export type SubjectPracticeStructuredSourceQuestionRevision = {
  schemaVersion: typeof SUBJECT_PRACTICE_STRUCTURED_SOURCE_CORPUS_SCHEMA_VERSION;
  sourceQuestionRevisionId: string;
  lineageHash: string;
  documentIdentityHash: string;
  sourceSystem: SourceSystem;
  documentId: string;
  questionOrdinal: string;
  subject: string;
  language: string;
  fields: {
    prompt: string;
    options: string[];
    answer: string;
    explanation: string;
    localizations: LocalizedQuestionFields[];
  };
  fieldHashes: {
    promptSha256: string; optionsSha256: string[]; answerSha256: string;
    explanationSha256: string;
    localizationsSha256: Array<{ language: string; contentSha256: string }>;
    rawContentSha256: string;
  };
  canonicalTaskParameterFingerprint: string | null;
};

type FieldSimilarity = {
  comparable: boolean; exact: boolean; targetLength: number; sourceLength: number;
  fiveGramSimilarity: number; targetCoverage: number; sourceCoverage: number;
  contiguousMatchLowerBound: number; strong: boolean; moderate: boolean;
};

export type SubjectPracticeCandidateNoveltyRevisionMatch = {
  sourceQuestionRevisionId: string;
  lineageHash: string;
  sourceDocumentIdentityHash: string;
  matchedFieldMask: Array<'prompt' | 'option' | 'answer' | 'explanation' | 'localization' | 'canonical_task_parameters'>;
  status: MatchStatus;
  reasonCodes: string[];
  strongestSignalScore: number;
  prompt: FieldSimilarity;
  explanation: FieldSimilarity;
  exactOptionMatchCount: number;
  longExactOptionMatchCount: number;
  fullOptionMultisetEqual: boolean;
  fullOptionInformationCharacters: number;
  candidateHasDuplicateOptions: boolean;
  canonicalTaskParametersEqual: boolean;
  strongestLanguagePair: { candidateLanguage: string; sourceLanguage: string };
  weakCommonSymbolicFragments: string[];
  weakFragmentDescriptors: Array<{
    fragmentSha256: string;
    normalizedLength: number;
    fragmentClass: 'short_symbolic';
  }>;
};

export type SubjectPracticeCandidateOutputNoveltyEvidence = {
  policyVersion: typeof SUBJECT_PRACTICE_CANDIDATE_OUTPUT_NOVELTY_POLICY_VERSION;
  structuredCorpusSchemaVersion: typeof SUBJECT_PRACTICE_STRUCTURED_SOURCE_CORPUS_SCHEMA_VERSION;
  normalizationVersion: string;
  status: 'blocked' | 'ambiguous' | 'clear';
  reasonCodes: string[];
  strongestSourceRevisionMatch: SubjectPracticeCandidateNoveltyRevisionMatch | null;
  blockedRevisionCount: number;
  ambiguousRevisionCount: number;
  scannedRevisionCount: number;
  revisionMatchSetSha256: string;
  revisionMatchDigestVersion: typeof SUBJECT_PRACTICE_CANDIDATE_NOVELTY_MATCH_DIGEST_VERSION;
  nonClearRevisionMatches: Array<{
    sourceQuestionRevisionId: string;
    lineageHash: string;
    sourceDocumentIdentityHash: string;
    status: 'block' | 'ambiguous';
    matchedFieldMask: SubjectPracticeCandidateNoveltyRevisionMatch['matchedFieldMask'];
    reasonCodes: string[];
    weakFragmentDescriptors: SubjectPracticeCandidateNoveltyRevisionMatch['weakFragmentDescriptors'];
    strongestLanguagePair: SubjectPracticeCandidateNoveltyRevisionMatch['strongestLanguagePair'];
    promptLengths: { target: number; source: number };
    explanationLengths: { target: number; source: number };
    matchSha256: string;
  }>;
  crossRevisionEvidenceCombinationForbidden: true;
  repairFeedbackMayExposeSourceIdentityOrText: false;
  formalQualificationEligible: false;
  qualificationBoundary: 'shadow_only_requires_complete_inventory_calibration_and_attestation';
};

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

function canonicalJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalJson(entry)]));
  }
  return value;
}

function optionTexts(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((option) => typeof option === 'string'
      ? option.trim()
      : String((option as Record<string, unknown>)?.text ?? '').trim()).filter(Boolean)
    : [];
}

function localizedQuestionFields(value: unknown): LocalizedQuestionFields[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  return Object.entries(value as Record<string, unknown>).flatMap(([language, raw]) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
    const record = raw as Record<string, unknown>;
    const localized = {
      language: language.trim().toLowerCase(),
      prompt: String(record.prompt ?? record.promptText ?? '').trim(),
      options: optionTexts(record.options),
      answer: String(record.correctAnswer ?? record.answer ?? '').trim(),
      explanation: String(record.explanation ?? '').trim()
    };
    return localized.prompt || localized.options.length || localized.answer || localized.explanation
      ? [localized]
      : [];
  }).sort((left, right) => left.language.localeCompare(right.language));
}

export function buildSubjectPracticeStructuredSourceQuestionRevision(input: {
  sourceSystem: SourceSystem; documentId: string; questionOrdinal: string;
  subject: string; language: string; prompt: unknown; options: unknown;
  answer: unknown; explanation: unknown; localizations?: unknown;
  documentIdentityHash?: string | null; canonicalTaskParameterFingerprint?: string | null;
}): SubjectPracticeStructuredSourceQuestionRevision {
  const prompt = String(input.prompt ?? '').trim();
  const options = optionTexts(input.options);
  const answer = String(input.answer ?? '').trim();
  const explanation = String(input.explanation ?? '').trim();
  const localizations = localizedQuestionFields(input.localizations);
  const raw = { prompt, options, answer, explanation, localizations };
  const rawContentSha256 = sha256(JSON.stringify(canonicalJson(raw)));
  const documentIdentity = String(input.documentIdentityHash ?? '').trim()
    || sha256(`${input.sourceSystem}:${input.documentId}`);
  const lineageHash = sha256(`${documentIdentity}:${String(input.questionOrdinal).trim()}`);
  return {
    schemaVersion: SUBJECT_PRACTICE_STRUCTURED_SOURCE_CORPUS_SCHEMA_VERSION,
    sourceQuestionRevisionId: sha256(`${input.sourceSystem}:${input.documentId}:${input.questionOrdinal}:${rawContentSha256}`),
    lineageHash,
    documentIdentityHash: documentIdentity,
    sourceSystem: input.sourceSystem,
    documentId: String(input.documentId),
    questionOrdinal: String(input.questionOrdinal),
    subject: String(input.subject).trim().toLowerCase(),
    language: String(input.language).trim().toLowerCase(),
    fields: { prompt, options, answer, explanation, localizations },
    fieldHashes: {
      promptSha256: sha256(prompt), optionsSha256: options.map(sha256), answerSha256: sha256(answer),
      explanationSha256: sha256(explanation),
      localizationsSha256: localizations.map((localized) => ({
        language: localized.language,
        contentSha256: sha256(JSON.stringify(canonicalJson(localized)))
      })),
      rawContentSha256
    },
    canonicalTaskParameterFingerprint: input.canonicalTaskParameterFingerprint ?? null
  };
}

export function subjectPracticeCandidateNoveltyCorpusSnapshotSha256(
  revisions: SubjectPracticeStructuredSourceQuestionRevision[]
) {
  const snapshot = revisions.map((revision) => ({
    schemaVersion: revision.schemaVersion,
    sourceQuestionRevisionId: revision.sourceQuestionRevisionId,
    lineageHash: revision.lineageHash,
    documentIdentityHash: revision.documentIdentityHash,
    sourceSystem: revision.sourceSystem,
    documentId: revision.documentId,
    questionOrdinal: revision.questionOrdinal,
    subject: revision.subject,
    language: revision.language,
    rawContentSha256: revision.fieldHashes.rawContentSha256,
    canonicalTaskParameterFingerprint: revision.canonicalTaskParameterFingerprint
  })).sort((left, right) => left.sourceQuestionRevisionId.localeCompare(right.sourceQuestionRevisionId));
  return sha256(JSON.stringify(canonicalJson(snapshot)));
}

function ngrams(value: string, size = 5) {
  const result = new Set<string>();
  for (let index = 0; index <= value.length - size; index += 1) result.add(value.slice(index, index + size));
  return result;
}

const similarityFeatureCache = new Map<string, { normalized: string; grams: Set<string> }>();
const SUBJECT_PRACTICE_SIMILARITY_FEATURE_CACHE_MAXIMUM_ENTRIES = 512;
const SUBJECT_PRACTICE_NORMALIZED_OPTIONS_CACHE_MAXIMUM_ENTRIES = 512;
const SUBJECT_PRACTICE_SOURCE_VARIANT_CACHE_MAXIMUM_ENTRIES = 512;

function boundedCacheSet<K, V>(cache: Map<K, V>, key: K, value: V, maximumEntries: number) {
  if (!cache.has(key) && cache.size >= maximumEntries) {
    const oldestKey = cache.keys().next().value as K | undefined;
    if (oldestKey !== undefined) cache.delete(oldestKey);
  }
  cache.set(key, value);
}

function similarityFeatures(value: unknown) {
  const key = String(value ?? '');
  const cached = similarityFeatureCache.get(key);
  if (cached) return cached;
  const normalized = normalizeSubjectPracticeSourceCorpusText(key);
  const result = { normalized, grams: ngrams(normalized) };
  boundedCacheSet(
    similarityFeatureCache,
    key,
    result,
    SUBJECT_PRACTICE_SIMILARITY_FEATURE_CACHE_MAXIMUM_ENTRIES
  );
  return result;
}

function containsInformativeContiguousMatch(left: string, right: string, length: number) {
  const shorter = left.length <= right.length ? left : right;
  const longer = left.length <= right.length ? right : left;
  if (shorter.length < length) return false;
  for (let index = 0; index <= shorter.length - length; index += 1) {
    const fragment = shorter.slice(index, index + length);
    if (longer.includes(fragment) && !isSubjectPracticeCandidateNoveltyCommonSymbolicFragment(fragment)) return true;
  }
  return false;
}

function similarity(targetRaw: unknown, sourceRaw: unknown, minimum = 12): FieldSimilarity {
  const targetFeatures = similarityFeatures(targetRaw);
  const sourceFeatures = similarityFeatures(sourceRaw);
  const target = targetFeatures.normalized;
  const source = sourceFeatures.normalized;
  const comparable = target.length >= minimum && source.length >= minimum;
  if (!comparable) return {
    comparable: false, exact: false, targetLength: target.length, sourceLength: source.length,
    fiveGramSimilarity: 0, targetCoverage: 0, sourceCoverage: 0,
    contiguousMatchLowerBound: 0, strong: false, moderate: false
  };
  const targetGrams = targetFeatures.grams;
  const sourceGrams = sourceFeatures.grams;
  let intersection = 0;
  for (const gram of sourceGrams) if (targetGrams.has(gram)) intersection += 1;
  const union = targetGrams.size + sourceGrams.size - intersection;
  const fiveGramSimilarity = union ? intersection / union : 0;
  const targetCoverage = targetGrams.size ? intersection / targetGrams.size : 0;
  const sourceCoverage = sourceGrams.size ? intersection / sourceGrams.size : 0;
  const exact = target === source;
  const strongContiguousThreshold = Math.min(
    32,
    Math.max(20, Math.ceil(Math.min(target.length, source.length) * 0.75))
  );
  const moderateContiguous = intersection > 0 && containsInformativeContiguousMatch(target, source, 16);
  const strongContiguous = intersection > 0
    && containsInformativeContiguousMatch(target, source, strongContiguousThreshold);
  const contiguousMatchLowerBound = strongContiguous
    ? strongContiguousThreshold
    : moderateContiguous ? 16 : 0;
  const strong = exact || fiveGramSimilarity >= 0.82
    || (sourceCoverage >= 0.85 && targetCoverage >= 0.6)
    || strongContiguous;
  const moderate = strong || fiveGramSimilarity >= 0.5
    || (sourceCoverage >= 0.6 && targetCoverage >= 0.35)
    || moderateContiguous;
  return {
    comparable, exact, targetLength: target.length, sourceLength: source.length,
    fiveGramSimilarity, targetCoverage, sourceCoverage, contiguousMatchLowerBound, strong, moderate
  };
}

const normalizedOptionsCache = new Map<string, string[]>();
const normalizedOptions = (values: string[]) => {
  const key = JSON.stringify(values);
  const cached = normalizedOptionsCache.get(key);
  if (cached) return cached;
  const result = values.map(normalizeSubjectPracticeSourceCorpusText).filter(Boolean).sort();
  boundedCacheSet(
    normalizedOptionsCache,
    key,
    result,
    SUBJECT_PRACTICE_NORMALIZED_OPTIONS_CACHE_MAXIMUM_ENTRIES
  );
  return result;
};

function uniqueValues(values: string[]) {
  return Array.from(new Set(values));
}

function duplicateOptionSignature(value: string) {
  const normalized = normalizeSubjectPracticeSourceCorpusText(value);
  const compact = String(value ?? '').normalize('NFKC').replace(/\s+/g, '');
  const interval = compact.match(/([[(])[^,，]+[,，][^,，]+([)\]])$/);
  if (!interval) return normalized;
  return `${normalized}|interval-left-${interval[1] === '[' ? 'closed' : 'open'}-right-${interval[2] === ']' ? 'closed' : 'open'}`;
}

function dedupeQuestionVariants(values: LocalizedQuestionFields[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = JSON.stringify({
      prompt: normalizeSubjectPracticeSourceCorpusText(value.prompt),
      options: normalizedOptions(value.options),
      answer: normalizeSubjectPracticeSourceCorpusText(value.answer),
      explanation: normalizeSubjectPracticeSourceCorpusText(value.explanation)
    });
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function questionVariants(candidate: GeneratedQuestionCandidate): LocalizedQuestionFields[] {
  const localized = Object.entries(candidate.localizations ?? {}).flatMap(([language, fields]) => fields
    ? [{
      language: language.trim().toLowerCase(),
      prompt: String(fields.prompt ?? '').trim(),
      options: optionTexts(fields.options),
      answer: candidate.correctAnswer,
      explanation: String(fields.explanation ?? '').trim()
    }]
    : []);
  return dedupeQuestionVariants([{
    language: 'root',
    prompt: candidate.prompt,
    options: candidate.options.map((option) => option.text),
    answer: candidate.correctAnswer,
    explanation: candidate.explanation
  }, ...localized]);
}

const sourceVariantCache = new Map<string, LocalizedQuestionFields[]>();

export function subjectPracticeCandidateOutputNoveltyCacheDiagnostics() {
  return {
    similarityFeatureCache: {
      size: similarityFeatureCache.size,
      maximumEntries: SUBJECT_PRACTICE_SIMILARITY_FEATURE_CACHE_MAXIMUM_ENTRIES
    },
    normalizedOptionsCache: {
      size: normalizedOptionsCache.size,
      maximumEntries: SUBJECT_PRACTICE_NORMALIZED_OPTIONS_CACHE_MAXIMUM_ENTRIES
    },
    sourceVariantCache: {
      size: sourceVariantCache.size,
      maximumEntries: SUBJECT_PRACTICE_SOURCE_VARIANT_CACHE_MAXIMUM_ENTRIES
    }
  };
}

function sourceVariants(source: SubjectPracticeStructuredSourceQuestionRevision): LocalizedQuestionFields[] {
  const cached = sourceVariantCache.get(source.sourceQuestionRevisionId);
  if (cached) return cached;
  const result = dedupeQuestionVariants([{
    language: source.language || 'root',
    prompt: source.fields.prompt,
    options: source.fields.options,
    answer: source.fields.answer,
    explanation: source.fields.explanation
  }, ...source.fields.localizations]);
  boundedCacheSet(
    sourceVariantCache,
    source.sourceQuestionRevisionId,
    result,
    SUBJECT_PRACTICE_SOURCE_VARIANT_CACHE_MAXIMUM_ENTRIES
  );
  return result;
}

function fieldSignalScore(value: FieldSimilarity) {
  return Math.max(
    value.fiveGramSimilarity,
    value.targetCoverage * value.sourceCoverage,
    value.strong ? 0.82 : 0,
    value.moderate ? 0.5 : 0
  );
}

export function isSubjectPracticeCandidateNoveltyCommonSymbolicFragment(value: string) {
  return /\d|equal|plus|minus|times|divide|[xy]|°/.test(value) && value.length <= 24;
}

export function isSubjectPracticeCandidateNoveltyNonIdentifyingScalar(value: string) {
  return /^(?:plus|minus)?\d+(?:point\d+)?(?:divide(?:plus|minus)?\d+)?$/.test(value);
}

export function subjectPracticeStructuredSourceQuestionRevisionValid(
  revision: SubjectPracticeStructuredSourceQuestionRevision
) {
  if (!revision || revision.schemaVersion !== SUBJECT_PRACTICE_STRUCTURED_SOURCE_CORPUS_SCHEMA_VERSION) return false;
  const localizations = Object.fromEntries((revision.fields?.localizations ?? []).map((localized) => [
    localized.language,
    {
      prompt: localized.prompt,
      options: localized.options,
      answer: localized.answer,
      explanation: localized.explanation
    }
  ]));
  const rebuilt = buildSubjectPracticeStructuredSourceQuestionRevision({
    sourceSystem: revision.sourceSystem,
    documentId: revision.documentId,
    questionOrdinal: revision.questionOrdinal,
    subject: revision.subject,
    language: revision.language,
    prompt: revision.fields?.prompt,
    options: revision.fields?.options,
    answer: revision.fields?.answer,
    explanation: revision.fields?.explanation,
    localizations,
    documentIdentityHash: revision.documentIdentityHash,
    canonicalTaskParameterFingerprint: revision.canonicalTaskParameterFingerprint
  });
  return JSON.stringify(canonicalJson(rebuilt)) === JSON.stringify(canonicalJson(revision));
}

function matchRevision(
  candidate: GeneratedQuestionCandidate,
  candidateVariants: LocalizedQuestionFields[],
  source: SubjectPracticeStructuredSourceQuestionRevision,
  candidateCanonicalTaskParameterFingerprint?: string | null
): SubjectPracticeCandidateNoveltyRevisionMatch {
  const comparisons = candidateVariants.flatMap((candidateVariant) =>
    sourceVariants(source).map((sourceVariant) => {
      const prompt = similarity(candidateVariant.prompt, sourceVariant.prompt);
      const explanation = similarity(candidateVariant.explanation, sourceVariant.explanation, 20);
      const candidateOptions = normalizedOptions(candidateVariant.options);
      const sourceOptions = normalizedOptions(sourceVariant.options);
      const exactOptions = uniqueValues(candidateOptions.filter((option) => sourceOptions.includes(option)));
      const candidateDuplicateSignatures = candidateVariant.options.map(duplicateOptionSignature).filter(Boolean);
      const candidateHasDuplicateOptions = uniqueValues(candidateDuplicateSignatures).length
        !== candidateDuplicateSignatures.length;
      const fullOptionMultisetEqual = candidateOptions.length >= 2
        && !candidateHasDuplicateOptions
        && uniqueValues(sourceOptions).length === sourceOptions.length
        && candidateOptions.length === sourceOptions.length
        && candidateOptions.every((option, index) => option === sourceOptions[index]);
      const fullOptionInformationCharacters = fullOptionMultisetEqual
        ? candidateOptions.reduce((sum, option) => sum + option.length, 0)
        : 0;
      const longExactOptionMatchCount = exactOptions.filter((option) => option.length >= 25).length;
      const compound = prompt.moderate && (longExactOptionMatchCount >= 1 || exactOptions.length >= 2);
      const informativeFullSet = fullOptionMultisetEqual
        && fullOptionInformationCharacters >= 64
        && prompt.moderate;
      const strongestSignalScore = Math.max(
        fieldSignalScore(prompt),
        fieldSignalScore(explanation),
        compound ? 0.9 : 0,
        informativeFullSet ? 0.95 : 0
      );
      return {
        candidateVariant,
        sourceVariant,
        prompt,
        explanation,
        exactOptions,
        candidateHasDuplicateOptions,
        fullOptionMultisetEqual,
        fullOptionInformationCharacters,
        longExactOptionMatchCount,
        compound,
        informativeFullSet,
        strongestSignalScore
      };
    })
  );
  const strongest = comparisons.slice().sort((left, right) =>
    right.strongestSignalScore - left.strongestSignalScore
    || left.candidateVariant.language.localeCompare(right.candidateVariant.language)
    || left.sourceVariant.language.localeCompare(right.sourceVariant.language))[0];
  const strongestPrompt = comparisons.slice().sort((left, right) =>
    fieldSignalScore(right.prompt) - fieldSignalScore(left.prompt))[0]?.prompt
    ?? similarity('', '');
  const strongestExplanation = comparisons.slice().sort((left, right) =>
    fieldSignalScore(right.explanation) - fieldSignalScore(left.explanation))[0]?.explanation
    ?? similarity('', '', 20);
  const exactOptionMatchCount = Math.max(0, ...comparisons.map((item) => item.exactOptions.length));
  const exactOptionValues = uniqueValues(comparisons.flatMap((item) => item.exactOptions));
  const longExactOptionMatchCount = Math.max(0, ...comparisons.map((item) => item.longExactOptionMatchCount));
  const fullOptionMultisetEqual = comparisons.some((item) => item.fullOptionMultisetEqual);
  const fullOptionInformationCharacters = Math.max(
    0,
    ...comparisons.map((item) => item.fullOptionInformationCharacters)
  );
  const candidateHasDuplicateOptions = comparisons.some((item) => item.candidateHasDuplicateOptions);
  const canonicalTaskParametersEqual = Boolean(
    candidateCanonicalTaskParameterFingerprint
    && source.canonicalTaskParameterFingerprint
    && candidateCanonicalTaskParameterFingerprint === source.canonicalTaskParameterFingerprint
  );
  const reasonCodes: string[] = [];
  const strongPromptMatches = comparisons.filter((item) => item.prompt.strong);
  const strongExplanationMatches = comparisons.filter((item) => item.explanation.strong);
  const compound = comparisons.some((item) => item.compound);
  const informativeFullSet = comparisons.some((item) => item.informativeFullSet)
    || (fullOptionMultisetEqual && fullOptionInformationCharacters >= 64 && canonicalTaskParametersEqual);
  if (candidateHasDuplicateOptions) {
    reasonCodes.push('candidate_novelty_invalid_duplicate_candidate_options');
  }
  if (strongPromptMatches.length) {
    reasonCodes.push(strongPromptMatches.some((item) => item.prompt.exact)
      ? 'candidate_novelty_exact_prompt_copy'
      : 'candidate_novelty_strong_prompt_copy');
  }
  if (strongExplanationMatches.length) {
    reasonCodes.push(strongExplanationMatches.some((item) => item.explanation.exact)
      ? 'candidate_novelty_exact_explanation_copy'
      : 'candidate_novelty_strong_explanation_copy');
  }
  if (canonicalTaskParametersEqual) reasonCodes.push('candidate_novelty_canonical_task_parameter_copy');
  if (compound) reasonCodes.push('candidate_novelty_same_revision_prompt_option_compound_match');
  if (informativeFullSet) reasonCodes.push('candidate_novelty_informative_full_option_set_with_same_revision_context');
  const blocked = reasonCodes.length > 0;
  const weakCommonSymbolicFragments = uniqueValues((strongest?.exactOptions ?? [])
    .filter(isSubjectPracticeCandidateNoveltyCommonSymbolicFragment));
  const weakFragmentDescriptors = weakCommonSymbolicFragments.map((fragment) => ({
    fragmentSha256: sha256(fragment),
    normalizedLength: fragment.length,
    fragmentClass: 'short_symbolic' as const
  }));
  const hasModeratePrompt = comparisons.some((item) => item.prompt.moderate);
  const hasModerateExplanation = comparisons.some((item) => item.explanation.moderate);
  const isolatedNonIdentifyingScalarOptionsOnly = !hasModeratePrompt
    && !hasModerateExplanation
    && exactOptionValues.length > 0
    && exactOptionValues.every(isSubjectPracticeCandidateNoveltyNonIdentifyingScalar)
    && !fullOptionMultisetEqual
    && !canonicalTaskParametersEqual;
  if (!blocked && !isolatedNonIdentifyingScalarOptionsOnly
    && (hasModeratePrompt || hasModerateExplanation || exactOptionMatchCount)) {
    const commonSymbolicOnly = !hasModeratePrompt && !hasModerateExplanation
      && exactOptionMatchCount > 0 && exactOptionMatchCount === weakCommonSymbolicFragments.length;
    reasonCodes.push(commonSymbolicOnly
      ? 'candidate_novelty_common_symbolic_fragment_only'
      : 'candidate_novelty_weak_same_revision_signal_requires_review');
  }
  const matchedFieldMask = [] as SubjectPracticeCandidateNoveltyRevisionMatch['matchedFieldMask'];
  if (hasModeratePrompt) matchedFieldMask.push('prompt');
  if (exactOptionMatchCount) matchedFieldMask.push('option');
  const candidateAnswer = normalizeSubjectPracticeSourceCorpusText(candidate.correctAnswer);
  const sourceAnswer = normalizeSubjectPracticeSourceCorpusText(source.fields.answer);
  if (candidateAnswer && sourceAnswer && candidateAnswer === sourceAnswer) matchedFieldMask.push('answer');
  if (hasModerateExplanation) matchedFieldMask.push('explanation');
  const strongestUsesLocalization = Boolean(strongest && (
    strongest.candidateVariant.language !== 'root'
    || source.fields.localizations.includes(strongest.sourceVariant)
  ));
  if (strongestUsesLocalization && (hasModeratePrompt || hasModerateExplanation || exactOptionMatchCount)) {
    matchedFieldMask.push('localization');
  }
  if (canonicalTaskParametersEqual) matchedFieldMask.push('canonical_task_parameters');
  const status: MatchStatus = blocked ? 'block' : reasonCodes.length ? 'ambiguous' : 'clear';
  return {
    sourceQuestionRevisionId: source.sourceQuestionRevisionId,
    lineageHash: source.lineageHash,
    sourceDocumentIdentityHash: source.documentIdentityHash,
    matchedFieldMask: Array.from(new Set(matchedFieldMask)),
    status,
    reasonCodes,
    strongestSignalScore: Math.max(
      strongest?.strongestSignalScore ?? 0,
      canonicalTaskParametersEqual ? 1 : 0
    ),
    prompt: strongestPrompt,
    explanation: strongestExplanation,
    exactOptionMatchCount,
    longExactOptionMatchCount,
    fullOptionMultisetEqual,
    fullOptionInformationCharacters,
    candidateHasDuplicateOptions,
    canonicalTaskParametersEqual,
    strongestLanguagePair: {
      candidateLanguage: strongest?.candidateVariant.language ?? 'none',
      sourceLanguage: strongest?.sourceVariant.language ?? 'none'
    },
    weakCommonSymbolicFragments,
    weakFragmentDescriptors
  };
}

export function evaluateSubjectPracticeCandidateOutputNovelty(input: {
  candidate: GeneratedQuestionCandidate;
  candidateCanonicalTaskParameterFingerprint?: string | null;
  sourceRevisions: SubjectPracticeStructuredSourceQuestionRevision[];
}): SubjectPracticeCandidateOutputNoveltyEvidence {
  const candidateVariants = questionVariants(input.candidate);
  const matches = input.sourceRevisions.map((source) => matchRevision(
    input.candidate, candidateVariants, source, input.candidateCanonicalTaskParameterFingerprint
  ));
  const rank = { block: 2, ambiguous: 1, clear: 0 };
  const ranked = matches.slice().sort((left, right) => rank[right.status] - rank[left.status]
    || right.strongestSignalScore - left.strongestSignalScore
    || left.sourceQuestionRevisionId.localeCompare(right.sourceQuestionRevisionId));
  const blockedRevisionCount = matches.filter((match) => match.status === 'block').length;
  const ambiguousRevisionCount = matches.filter((match) => match.status === 'ambiguous').length;
  const revisionMatchSetSha256 = sha256(JSON.stringify(canonicalJson(matches.slice().sort((left, right) =>
    left.sourceQuestionRevisionId.localeCompare(right.sourceQuestionRevisionId)))));
  const nonClearRevisionMatches = matches.filter((match) => match.status !== 'clear').map((match) => ({
    sourceQuestionRevisionId: match.sourceQuestionRevisionId,
    lineageHash: match.lineageHash,
    sourceDocumentIdentityHash: match.sourceDocumentIdentityHash,
    status: match.status as 'block' | 'ambiguous',
    matchedFieldMask: match.matchedFieldMask,
    reasonCodes: match.reasonCodes,
    weakFragmentDescriptors: match.weakFragmentDescriptors,
    strongestLanguagePair: match.strongestLanguagePair,
    promptLengths: { target: match.prompt.targetLength, source: match.prompt.sourceLength },
    explanationLengths: { target: match.explanation.targetLength, source: match.explanation.sourceLength },
    matchSha256: sha256(JSON.stringify(canonicalJson(match)))
  })).sort((left, right) => left.sourceQuestionRevisionId.localeCompare(right.sourceQuestionRevisionId));
  return {
    policyVersion: SUBJECT_PRACTICE_CANDIDATE_OUTPUT_NOVELTY_POLICY_VERSION,
    structuredCorpusSchemaVersion: SUBJECT_PRACTICE_STRUCTURED_SOURCE_CORPUS_SCHEMA_VERSION,
    normalizationVersion: SUBJECT_PRACTICE_SOURCE_CORPUS_NORMALIZATION_VERSION,
    status: blockedRevisionCount ? 'blocked' : ambiguousRevisionCount ? 'ambiguous' : 'clear',
    reasonCodes: ranked[0]?.reasonCodes ?? [],
    strongestSourceRevisionMatch: ranked[0] ?? null,
    blockedRevisionCount,
    ambiguousRevisionCount,
    scannedRevisionCount: matches.length,
    revisionMatchSetSha256,
    revisionMatchDigestVersion: SUBJECT_PRACTICE_CANDIDATE_NOVELTY_MATCH_DIGEST_VERSION,
    nonClearRevisionMatches,
    crossRevisionEvidenceCombinationForbidden: true,
    repairFeedbackMayExposeSourceIdentityOrText: false,
    formalQualificationEligible: false,
    qualificationBoundary: 'shadow_only_requires_complete_inventory_calibration_and_attestation'
  };
}

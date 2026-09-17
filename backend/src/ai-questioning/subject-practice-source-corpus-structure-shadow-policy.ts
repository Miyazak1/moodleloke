import { createHash } from 'node:crypto';
import {
  SUBJECT_PRACTICE_SOURCE_CORPUS_THRESHOLDS,
  normalizeSubjectPracticeSourceCorpusText
} from './subject-practice-source-corpus-scan-policy';

export const SUBJECT_PRACTICE_SOURCE_CORPUS_STRUCTURE_SHADOW_POLICY_VERSION =
  'subject-practice-source-corpus-structure-shadow-policy-v1';

function sha256(value: string) { return createHash('sha256').update(value).digest('hex'); }

function numericTemplate(value: string) {
  return value.replace(/\d+/g, 'number');
}

function optionMultisetFingerprint(value: string) {
  const options = String(value ?? '').split(/\r?\n/).map((entry) => entry.replace(/^\s*[A-Za-z0-9]+\s*[:.)、-]\s*/, ''))
    .map(normalizeSubjectPracticeSourceCorpusText).filter(Boolean).sort();
  return options.length >= 2 ? sha256(JSON.stringify(options)) : null;
}

export function subjectPracticeSourceCorpusStructureShadowMatch(input: {
  sourceField: 'prompt' | 'options' | 'answer' | 'explanation' | 'localizations';
  sourceText: string;
  candidateText: string;
}) {
  const source = normalizeSubjectPracticeSourceCorpusText(input.sourceText);
  const candidate = normalizeSubjectPracticeSourceCorpusText(input.candidateText);
  const comparable = source.length >= SUBJECT_PRACTICE_SOURCE_CORPUS_THRESHOLDS.minimumComparableCharacters;
  const exactNormalizedMatch = comparable && source === candidate;
  const sourceOptionMultisetSha256 = input.sourceField === 'options'
    ? optionMultisetFingerprint(input.sourceText) : null;
  const candidateOptionMultisetSha256 = input.sourceField === 'options'
    ? optionMultisetFingerprint(input.candidateText) : null;
  const optionMultisetMatch = comparable && Boolean(sourceOptionMultisetSha256)
    && sourceOptionMultisetSha256 === candidateOptionMultisetSha256;
  const sourceNumericTemplate = numericTemplate(source);
  const candidateNumericTemplate = numericTemplate(candidate);
  const numericTemplateMatch = comparable && source !== candidate && /\d/.test(source)
    && sourceNumericTemplate === candidateNumericTemplate;
  const matchedSignals = [
    exactNormalizedMatch ? 'exact_normalized' : null,
    optionMultisetMatch ? 'option_multiset_order_invariant' : null,
    numericTemplateMatch ? 'numeric_template' : null
  ].filter(Boolean);
  return {
    policyVersion: SUBJECT_PRACTICE_SOURCE_CORPUS_STRUCTURE_SHADOW_POLICY_VERSION,
    comparable,
    matched: matchedSignals.length > 0,
    matchedSignals,
    sourceNormalizedSha256: sha256(source),
    candidateNormalizedSha256: sha256(candidate),
    sourceOptionMultisetSha256,
    candidateOptionMultisetSha256,
    mode: 'shadow_only_not_release_gate' as const
  };
}

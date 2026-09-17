#!/usr/bin/env node

require('../backend/node_modules/ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', moduleResolution: 'node' }
});

const {
  buildSubjectPracticeStructuredSourceQuestionRevision,
  evaluateSubjectPracticeCandidateOutputNovelty,
  subjectPracticeCandidateOutputNoveltyCacheDiagnostics,
  SUBJECT_PRACTICE_CANDIDATE_OUTPUT_NOVELTY_POLICY_VERSION
} = require('../backend/src/ai-questioning/subject-practice-candidate-output-novelty-policy');

const ids = ['A', 'B', 'C', 'D'];
function candidate(prompt, options, explanation = 'Independent derivation reaches the declared option.') {
  return {
    subject: 'math', topicId: 1, blueprintId: 1, sourceType: 'ai', designedDifficulty: 'basic',
    questionType: 'single_choice', prompt, options: options.map((text, index) => ({ id: ids[index], text })),
    correctAnswer: 'A', explanation, knowledgeTags: ['line relation'], optionMetadata: [], syllabusVersion: 'fixture-v1'
  };
}

function source(id, prompt, options, explanation = 'Source derivation text is distinct.', graph = null) {
  return buildSubjectPracticeStructuredSourceQuestionRevision({
    sourceSystem: 'local_file', documentId: `doc-${id}`, questionOrdinal: '1', subject: 'math', language: 'en',
    prompt, options, answer: 'A', explanation, documentIdentityHash: `identity-${id}`,
    canonicalTaskParameterFingerprint: graph
  });
}

function sourceWithLocalizations(id, localizations) {
  return buildSubjectPracticeStructuredSourceQuestionRevision({
    sourceSystem: 'local_file', documentId: `doc-${id}`, questionOrdinal: '1', subject: 'math', language: 'zh',
    prompt: '一道完全不同的中文题目。', options: ['甲', '乙', '丙', '丁'], answer: '',
    explanation: '中文解析与候选题不同。', localizations, documentIdentityHash: `identity-${id}`
  });
}

const base = candidate(
  'Which equation represents a line parallel to the given line x+2y=3?',
  ['x+2y=4', 'x-2y=4', '2x+y=4', 'x+y=4']
);
const exactPrompt = evaluateSubjectPracticeCandidateOutputNovelty({
  candidate: base,
  sourceRevisions: [source('exact-prompt', base.prompt, ['unrelated one', 'unrelated two', 'unrelated three', 'unrelated four'])]
});
const exactExplanation = evaluateSubjectPracticeCandidateOutputNovelty({
  candidate: base,
  sourceRevisions: [source('exact-explanation', 'A completely unrelated source prompt about circles.', ['u1', 'u2', 'u3', 'u4'], base.explanation)]
});
const shortFormulaOnly = evaluateSubjectPracticeCandidateOutputNovelty({
  candidate: base,
  sourceRevisions: [source('short-formula', 'Find the area of a triangle from its base and height.', ['x+2y=4', '7', '8', '9'])]
});
const formulaPlusModerateExplanation = evaluateSubjectPracticeCandidateOutputNovelty({
  candidate: candidate(
    'A separate prompt about a line relation.',
    ['x+2y=4', 'm1', 'm2', 'm3'],
    'The method starts by using the slope ratio before an independent calculation.'
  ),
  sourceRevisions: [source(
    'formula-plus-explanation',
    'A different source prompt about another task.',
    ['x+2y=4', 's1', 's2', 's3'],
    'This solution proceeds by using the slope ratio and then checks another expression.'
  )]
});
const compound = evaluateSubjectPracticeCandidateOutputNovelty({
  candidate: base,
  sourceRevisions: [source(
    'compound',
    'Choose an equation for a line parallel to the supplied line x+2y=3.',
    ['x+2y=4', 'x-2y=4', 'unrelated three', 'unrelated four']
  )]
});
const finiteAngleSet = evaluateSubjectPracticeCandidateOutputNovelty({
  candidate: candidate('Determine the inclination angle of line 2x-2y=7.', ['45°', '0°', '90°', '135°']),
  sourceRevisions: [source('finite-angle', 'Which is a standard angle?', ['0°', '45°', '90°', '135°'])]
});
const isolatedNumericScalar = evaluateSubjectPracticeCandidateOutputNovelty({
  candidate: candidate('Evaluate a derivative for an independently generated polynomial.', ['7', '5', '6', '8']),
  sourceRevisions: [source('isolated-numeric-scalar', 'Find a probability in an unrelated experiment.', ['7', '0.2', '0.3', '0.4'])]
});
const completeNumericOptionSet = evaluateSubjectPracticeCandidateOutputNovelty({
  candidate: candidate('Evaluate a derivative for another independently generated polynomial.', ['7', '5', '6', '8']),
  sourceRevisions: [source('complete-numeric-set', 'Find a statistic in an unrelated data set.', ['7', '5', '6', '8'])]
});
const graphCopy = evaluateSubjectPracticeCandidateOutputNovelty({
  candidate: base,
  candidateCanonicalTaskParameterFingerprint: 'graph:line:parallel:1:2:3',
  sourceRevisions: [source('graph', 'Unrelated wording that shares no long text.', ['p', 'q', 'r', 's'], 'Different explanation.', 'graph:line:parallel:1:2:3')]
});
const crossRevision = evaluateSubjectPracticeCandidateOutputNovelty({
  candidate: base,
  sourceRevisions: [
    source('prompt-fragment', 'Which equation represents the requested relation for a given line?', ['u1', 'u2', 'u3', 'u4']),
    source('option-fragment', 'A separate question about a polynomial root.', ['x+2y=4', 'x-2y=4', 'u3', 'u4'])
  ]
});
const localizedCandidate = candidate(
  'A different root-language prompt about a circle.',
  ['root one', 'root two', 'root three', 'root four']
);
localizedCandidate.localizations = {
  en: {
    prompt: 'Which equation represents the localized source line?',
    options: ids.map((id, index) => ({ id, text: `localized option ${index + 1}` })),
    explanation: 'The localized derivation is copied exactly.'
  }
};
const localizedCopy = evaluateSubjectPracticeCandidateOutputNovelty({
  candidate: localizedCandidate,
  sourceRevisions: [sourceWithLocalizations('localized-copy', {
    en: {
      prompt: 'Which equation represents the localized source line?',
      options: ids.map((id, index) => ({ id, text: `localized option ${index + 1}` })),
      explanation: 'The localized derivation is copied exactly.'
    }
  })]
});
const duplicateOptionCandidate = candidate(
  'Choose an equation for the requested line.',
  ['x=1', 'x=1', 'y=1', 'y=2']
);
const duplicateOptions = evaluateSubjectPracticeCandidateOutputNovelty({
  candidate: duplicateOptionCandidate,
  sourceRevisions: [source('duplicate-options', 'Select an equation for a specified line.', ['x=1', 'z=1', 'z=2', 'z=3'])]
});
const intervalBoundaryCandidate = candidate(
  'Select the interval satisfying an independently stated condition.',
  ['(-∞,1)', '(-∞,1]', '[1,+∞)', '(1,+∞)']
);
const intervalBoundaryOptions = evaluateSubjectPracticeCandidateOutputNovelty({
  candidate: intervalBoundaryCandidate,
  sourceRevisions: [source('interval-boundary', 'A source prompt about an unrelated matrix.', ['u', 'v', 'w', 'z'])]
});
const emptyAnswerCandidate = candidate('Independent prompt alpha beta gamma.', ['p', 'q', 'r', 's']);
emptyAnswerCandidate.correctAnswer = '';
const emptyAnswer = evaluateSubjectPracticeCandidateOutputNovelty({
  candidate: emptyAnswerCandidate,
  sourceRevisions: [buildSubjectPracticeStructuredSourceQuestionRevision({
    sourceSystem: 'local_file', documentId: 'doc-empty-answer', questionOrdinal: '1', subject: 'math', language: 'en',
    prompt: 'Unrelated source prompt delta epsilon.', options: ['u', 'v', 'w', 't'], answer: '',
    explanation: 'Unrelated source explanation.', documentIdentityHash: 'identity-empty-answer'
  })]
});
const digestSourceA = source('digest-a', 'A source prompt about vectors.', ['a1', 'a2', 'a3', 'a4']);
const digestSourceB = source('digest-b', 'A source prompt about matrices.', ['b1', 'b2', 'b3', 'b4']);
const digestForward = evaluateSubjectPracticeCandidateOutputNovelty({ candidate: base, sourceRevisions: [digestSourceA, digestSourceB] });
const digestReverse = evaluateSubjectPracticeCandidateOutputNovelty({ candidate: base, sourceRevisions: [digestSourceB, digestSourceA] });
const digestChanged = evaluateSubjectPracticeCandidateOutputNovelty({ candidate: base, sourceRevisions: [digestSourceA] });

for (let index = 0; index < 600; index += 1) {
  evaluateSubjectPracticeCandidateOutputNovelty({
    candidate: candidate(
      `Cache-bound probe candidate ${index}: evaluate polynomial x^2+${index + 17}.`,
      [`result ${index + 101}`, `result ${index + 202}`, `result ${index + 303}`, `result ${index + 404}`],
      `Candidate derivation ${index}: square the input and add ${index + 17}.`
    ),
    sourceRevisions: [source(
      `cache-bound-${index}`,
      `Independent source probe ${index}: compare affine value ${index + 701}.`,
      [`source ${index + 801}`, `source ${index + 802}`, `source ${index + 803}`, `source ${index + 804}`],
      `Source reasoning ${index}: use a distinct affine comparison.`
    )]
  });
}
const cacheDiagnostics = subjectPracticeCandidateOutputNoveltyCacheDiagnostics();

const checks = {
  exactPromptBlocks: exactPrompt.status === 'blocked'
    && exactPrompt.reasonCodes.includes('candidate_novelty_exact_prompt_copy'),
  exactExplanationBlocks: exactExplanation.status === 'blocked'
    && exactExplanation.reasonCodes.includes('candidate_novelty_exact_explanation_copy'),
  shortCommonFormulaAloneDoesNotBlock: shortFormulaOnly.status !== 'blocked'
    && shortFormulaOnly.reasonCodes.includes('candidate_novelty_common_symbolic_fragment_only'),
  moderateTextSignalCannotBeMisclassifiedAsCommonFormulaOnly:
    formulaPlusModerateExplanation.status === 'ambiguous'
    && formulaPlusModerateExplanation.reasonCodes.includes('candidate_novelty_weak_same_revision_signal_requires_review')
    && !formulaPlusModerateExplanation.reasonCodes.includes('candidate_novelty_common_symbolic_fragment_only'),
  sameRevisionPromptAndOptionsBlock: compound.status === 'blocked'
    && compound.reasonCodes.includes('candidate_novelty_same_revision_prompt_option_compound_match'),
  finiteStandardAngleSetAloneDoesNotBlock: finiteAngleSet.status !== 'blocked',
  isolatedNumericScalarOptionOverlapIsClear: isolatedNumericScalar.status === 'clear'
    && isolatedNumericScalar.ambiguousRevisionCount === 0,
  completeNumericOptionSetStillRequiresReview: completeNumericOptionSet.status === 'ambiguous'
    && completeNumericOptionSet.reasonCodes.includes('candidate_novelty_common_symbolic_fragment_only'),
  canonicalTaskParameterCopyBlocks: graphCopy.status === 'blocked'
    && graphCopy.reasonCodes.includes('candidate_novelty_canonical_task_parameter_copy'),
  differentSourceRevisionsCannotCombineWeakSignals: crossRevision.status !== 'blocked',
  localizedFieldsAreActuallyScanned: localizedCopy.status === 'blocked'
    && localizedCopy.strongestSourceRevisionMatch?.matchedFieldMask.includes('localization'),
  duplicateCandidateOptionsFailSafeWithoutDoubleCounting: duplicateOptions.status === 'blocked'
    && duplicateOptions.reasonCodes.includes('candidate_novelty_invalid_duplicate_candidate_options')
    && duplicateOptions.strongestSourceRevisionMatch?.exactOptionMatchCount === 1,
  mathematicallyDistinctIntervalBoundariesAreNotDuplicateOptions:
    !intervalBoundaryOptions.reasonCodes.includes('candidate_novelty_invalid_duplicate_candidate_options'),
  emptyAnswersAreNotRecordedAsMatches: !emptyAnswer.strongestSourceRevisionMatch?.matchedFieldMask.includes('answer'),
  completeRevisionMatchDigestIsOrderInvariant: digestForward.revisionMatchSetSha256 === digestReverse.revisionMatchSetSha256,
  completeRevisionMatchDigestBindsCorpusMembership: digestForward.revisionMatchSetSha256 !== digestChanged.revisionMatchSetSha256,
  sourceIdentityNeverReturnedAsRepairText: [exactPrompt, exactExplanation, shortFormulaOnly,
    formulaPlusModerateExplanation, compound, finiteAngleSet,
    isolatedNumericScalar, completeNumericOptionSet, graphCopy, crossRevision,
    localizedCopy, duplicateOptions, intervalBoundaryOptions, emptyAnswer]
    .every((item) => item.repairFeedbackMayExposeSourceIdentityOrText === false),
  policyIsShadowOnly: [exactPrompt, exactExplanation, shortFormulaOnly, formulaPlusModerateExplanation,
    compound, finiteAngleSet, isolatedNumericScalar, completeNumericOptionSet, graphCopy,
    crossRevision, localizedCopy, duplicateOptions, intervalBoundaryOptions, emptyAnswer]
    .every((item) => item.formalQualificationEligible === false),
  policyVersioned: /-v\d+$/.test(SUBJECT_PRACTICE_CANDIDATE_OUTPUT_NOVELTY_POLICY_VERSION),
  processCachesAreBounded: Object.values(cacheDiagnostics)
    .every((cache) => cache.size <= cache.maximumEntries)
};
const report = {
  mode: 'subject_practice_candidate_output_novelty_self_test',
  reportVersion: 'subject-practice-candidate-output-novelty-self-test-v4-low-information-scalar-aware',
  status: Object.values(checks).every(Boolean) ? 'passed' : 'failed',
  checks,
  statuses: {
    exactPrompt: exactPrompt.status, exactExplanation: exactExplanation.status,
    shortFormulaOnly: shortFormulaOnly.status,
    formulaPlusModerateExplanation: formulaPlusModerateExplanation.status,
    compound: compound.status,
    finiteAngleSet: finiteAngleSet.status,
    isolatedNumericScalar: isolatedNumericScalar.status,
    completeNumericOptionSet: completeNumericOptionSet.status,
    graphCopy: graphCopy.status, crossRevision: crossRevision.status,
    localizedCopy: localizedCopy.status, duplicateOptions: duplicateOptions.status, emptyAnswer: emptyAnswer.status
  },
  reasonCodes: {
    shortFormulaOnly: shortFormulaOnly.reasonCodes,
    formulaPlusModerateExplanation: formulaPlusModerateExplanation.reasonCodes,
    compound: compound.reasonCodes,
    crossRevision: crossRevision.reasonCodes
  },
  cacheDiagnostics,
  providerImpact: 'none_no_provider_call', databaseImpact: 'none_fixture_only', publicationImpact: 'none_shadow_only'
};

if (require.main === module) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (report.status !== 'passed') process.exitCode = 1;
module.exports = { report };

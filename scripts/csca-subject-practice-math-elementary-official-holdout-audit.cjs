#!/usr/bin/env node

require('../backend/node_modules/ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', moduleResolution: 'node' }
});

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { solveElementaryFunctionDirectProperty } = require('../backend/src/ai-questioning/subject-practice-math-solver');
const { subjectPracticeClassifyTaskFamily } = require('../backend/src/ai-questioning/subject-practice-task-family-policy');

const root = path.resolve(__dirname, '..');
const docs = path.join(root, 'docs');
const sourceFiles = fs.readdirSync(docs)
  .filter((name) => /^csca-math-past-paper-.*-source\.json$/i.test(name))
  .sort();

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function clean(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function isTrustedSourceQuestion(question) {
  return question?.analysisStatus === 'human_confirmed'
    && question?.reviewStatus === 'mapped'
    && question?.sourceExtraction?.needsHumanCheck === false
    && Array.isArray(question?.options)
    && question.options.length >= 2
    && Boolean(clean(question?.correctAnswer));
}

const fileEvidence = [];
const discovered = [];
for (const fileName of sourceFiles) {
  const absolutePath = path.join(docs, fileName);
  const raw = fs.readFileSync(absolutePath, 'utf8');
  const parsed = JSON.parse(raw);
  const questions = Array.isArray(parsed?.questions) ? parsed.questions : [];
  const trusted = questions.filter(isTrustedSourceQuestion);
  fileEvidence.push({
    fileName,
    sourceHash: clean(parsed?.document?.sourceHash) || null,
    contentSha256: sha256(raw),
    questionCount: questions.length,
    trustedQuestionCount: trusted.length
  });
  for (const question of trusted) {
    const candidate = {
      subject: 'math',
      prompt: clean(question.promptText),
      options: question.options.map((option) => ({ id: clean(option?.id), text: clean(option?.text) })),
      correctAnswer: clean(question.correctAnswer)
    };
    const taskFamily = subjectPracticeClassifyTaskFamily({
      subject: 'math',
      prompt: candidate.prompt,
      options: candidate.options,
      explanation: ''
    });
    if (taskFamily !== 'elementary_function_direct_property') continue;
    const evidence = solveElementaryFunctionDirectProperty(candidate);
    discovered.push({
      sourceFile: fileName,
      questionNumber: clean(question.questionNumber),
      questionFingerprint: sha256(JSON.stringify(candidate)),
      solverStatus: evidence.status,
      parsed: evidence.parsed,
      trueOptionIds: evidence.trueOptionIds,
      selectedOptionId: evidence.selectedOptionId,
      agreesWithSourceAnswer: evidence.agreesWithGenerator,
      reasonCodes: evidence.reasonCodes
    });
  }
}

const counts = discovered.reduce((result, item) => {
  result[item.solverStatus] = (result[item.solverStatus] || 0) + 1;
  return result;
}, {});
const report = {
  mode: 'subject_practice_math_elementary_official_holdout_candidate_audit',
  status: discovered.length
    ? 'official_holdout_candidates_discovered_not_frozen'
    : 'no_eligible_official_holdout_candidates_discovered',
  auditVersion: 'math-elementary-official-holdout-candidate-audit-v1',
  targetTaskFamily: 'elementary_function_direct_property',
  providerImpact: 'none_no_provider_call',
  dbImpact: 'none_no_database_connection',
  productionImpact: 'none_read_only_source_audit',
  releaseQualification: false,
  releaseQualificationReason: 'candidate_discovery_is_not_a_frozen_blind_holdout_and_source_items_may_not_match_the_restricted_solver_grammar',
  sourceFileCount: sourceFiles.length,
  fileEvidence,
  discoveredCandidateCount: discovered.length,
  solverStatusCounts: counts,
  candidates: discovered
};

if (require.main === module) console.log(JSON.stringify(report, null, 2));

module.exports = { report };

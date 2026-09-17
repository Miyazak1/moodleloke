#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { validateAndBuild } = require('./assemble-accepted-pack.cjs');

const subjects = ['math', 'physics', 'chemistry'];
const candidates = []; const sourced = [];
for (const subject of subjects) for (let index = 1; index <= 10; index += 1) {
  const candidateId = `CQ-${subject.toUpperCase()}-${String(index).padStart(4, '0')}`; const batch = 'fixture-batch';
  const selected = { candidateId, batch }; candidates.push(selected);
  const question = { candidateId, subject, topicCode: `${subject}-topic-${index}`, prompt: `中文测试题 ${subject} ${index}`, options: ['A', 'B', 'C', 'D'].map((id) => ({ id, text: id })), correctAnswer: 'A', explanation: '中文解析，仅用于组装器自测试。', questionPlan: { taskFamily: `${subject}-family-${index}` }, generationMetadata: { languageScope: 'zh_primary_only', trace: candidateId, deterministicVerification: { solver: { status: 'verified', uniqueAnswer: true, selectedOptionId: 'A' }, oracle: { status: 'verified', agreesWithSolver: true }, optionTruthTable: [{ optionId: 'A', verdict: true }, { optionId: 'B', verdict: false }, { optionId: 'C', verdict: false }, { optionId: 'D', verdict: false }], explanationReplay: { status: 'verified', allRequiredTokensPresent: true, conclusionMatchesAnswer: true } } } };
  const review = { candidateId, derivedAnswer: 'A', verdictBeforeReveal: 'pass', conditionsSufficient: true, syllabusAligned: true, ambiguityFound: false, optionTruthTable: { A: true, B: false, C: false, D: false }, reasonCodes: [] };
  sourced.push({ selected, question, review, sealedEvidence: { path: `${candidateId}.json`, sha256: 'a' }, reviewEvidence: { path: `${candidateId}.review.json`, sha256: 'b' } });
}
const selection = { selectionId: 'fixture-pack', candidates };
const selectionEvidence = { path: 'selection-plan.json', sha256: crypto.createHash('sha256').update('selection').digest('hex') };
const audit = { schemaVersion: 'fixture-audit', formalQualificationEligible: true, selectionPlan: { selectionId: selection.selectionId, sha256: selectionEvidence.sha256 }, questions: candidates.map(({ candidateId }) => ({ candidateId, status: 'clear' })) };
const input = { selection, selectionEvidence, audit, auditEvidence: { path: 'audit.json', sha256: 'c' }, sourced };
const valid = validateAndBuild(input);
assert.deepEqual(valid.errors, []); assert.equal(valid.questions.length, 30); assert.match(valid.manifest.questionsSha256, /^[a-f0-9]{64}$/);
const repeatedFamily = structuredClone(input); repeatedFamily.sourced[1].question.questionPlan.taskFamily = repeatedFamily.sourced[0].question.questionPlan.taskFamily;
assert.equal(validateAndBuild(repeatedFamily).errors.some((error) => error.includes('distinct questionPlan.taskFamily')), true);
const badReview = structuredClone(input); badReview.sourced[0].review.optionTruthTable.B = true;
assert.equal(validateAndBuild(badReview).errors.some((error) => error.includes('exactly the sealed answer true')), true);
const badAudit = structuredClone(input); badAudit.audit.questions[0].status = 'ambiguous';
assert.equal(validateAndBuild(badAudit).errors.some((error) => error.includes('audit status must be clear')), true);
console.log('PASS assemble-accepted-pack self-test: valid build plus family, review, and audit fail-closed gates');

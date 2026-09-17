#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

function jsonFiles(directory, suffix) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory)
    .filter((name) => name.endsWith(suffix))
    .sort()
    .map((name) => ({ name, value: JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8')) }));
}

function clean(value) {
  return String(value ?? '').trim();
}

function uniqueOptionIds(options) {
  return Array.isArray(options)
    && options.length === 4
    && new Set(options.map((item) => clean(item?.id))).size === 4
    && ['A', 'B', 'C', 'D'].every((id) => options.some((item) => clean(item?.id) === id));
}

function evaluate(blind, sealed, review) {
  const reasons = [];
  if (!blind || !sealed || !review) reasons.push('missing_required_artifact');
  if (clean(blind?.candidateId) !== clean(sealed?.candidateId) || clean(blind?.candidateId) !== clean(review?.candidateId)) reasons.push('candidate_id_mismatch');
  if (clean(blind?.prompt) !== clean(sealed?.prompt)) reasons.push('blind_sealed_prompt_mismatch');
  if (JSON.stringify(blind?.options) !== JSON.stringify(sealed?.options)) reasons.push('blind_sealed_options_mismatch');
  if (!uniqueOptionIds(blind?.options)) reasons.push('invalid_option_ids');
  if (review?.verdictBeforeReveal !== 'pass') reasons.push(`blind_verdict_${clean(review?.verdictBeforeReveal) || 'missing'}`);
  if (!review?.conditionsSufficient) reasons.push('conditions_insufficient');
  if (review?.ambiguityFound) reasons.push('ambiguity_found');
  if (!review?.syllabusAligned) reasons.push('syllabus_mismatch');
  if (!review?.counterexampleAttempted) reasons.push('counterexample_not_attempted');
  if (!Array.isArray(review?.verificationEvidence) || review.verificationEvidence.length === 0) reasons.push('review_evidence_missing');
  const truth = review?.optionTruthTable && typeof review.optionTruthTable === 'object' ? review.optionTruthTable : {};
  const trueOptions = ['A', 'B', 'C', 'D'].filter((id) => truth[id] === true);
  if (trueOptions.length !== 1) reasons.push('blind_truth_table_not_unique');
  if (clean(review?.derivedAnswer) !== trueOptions[0]) reasons.push('blind_answer_truth_table_mismatch');
  if (clean(review?.derivedAnswer) !== clean(sealed?.correctAnswer)) reasons.push('generator_reviewer_answer_mismatch');
  if (!clean(sealed?.explanation)) reasons.push('sealed_explanation_missing');
  return { candidateId: clean(blind?.candidateId || sealed?.candidateId || review?.candidateId), passed: reasons.length === 0, reasons };
}

const batchDirectory = path.resolve(process.argv[2] || path.join('question-production', 'batches', 'pilot-30'));
const blindRows = jsonFiles(path.join(batchDirectory, 'blind'), '.json');
const sealedRows = jsonFiles(path.join(batchDirectory, 'sealed'), '.json')
  .filter((row) => clean(row.value?.candidateId));
const reviewRows = jsonFiles(path.join(batchDirectory, 'reviews'), '.review.json');
const sealedById = new Map(sealedRows.map((row) => [clean(row.value.candidateId), row.value]));
const reviewById = new Map(reviewRows.map((row) => [clean(row.value.candidateId), row.value]));
const results = blindRows.map((row) => evaluate(row.value, sealedById.get(clean(row.value.candidateId)), reviewById.get(clean(row.value.candidateId))));
const subjects = Object.fromEntries(['math', 'physics', 'chemistry'].map((subject) => {
  const ids = new Set(blindRows.filter((row) => row.value.subject === subject).map((row) => clean(row.value.candidateId)));
  const rows = results.filter((item) => ids.has(item.candidateId));
  return [subject, { total: rows.length, passed: rows.filter((item) => item.passed).length, failed: rows.filter((item) => !item.passed).length }];
}));
const summary = {
  schemaVersion: 'codex-blind-comparison-report-v1',
  batchDirectory,
  artifactCounts: { blind: blindRows.length, sealed: sealedRows.length, reviews: reviewRows.length },
  subjects,
  comparisonPassed: Object.values(subjects).every((item) => item.passed >= 10),
  results
};
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
process.exitCode = summary.comparisonPassed ? 0 : 1;

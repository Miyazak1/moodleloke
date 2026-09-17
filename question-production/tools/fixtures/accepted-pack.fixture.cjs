'use strict';
const subjects = ['math', 'physics', 'chemistry'];
const topicCodes = { math: 'FIX-MATH-001', physics: 'FIX-PHYSICS-001', chemistry: 'FIX-CHEM-001' };
const questions = subjects.flatMap((subject) => Array.from({ length: 10 }, (_, index) => {
  const n = index + 1; const candidateId = `CQ-${subject.toUpperCase()}-${String(n).padStart(4, '0')}`;
  return { schemaVersion: 'codex-question-candidate-v1', candidateId, subject, topicCode: topicCodes[subject], topicTitle: `${subject} fixture topic`, designedDifficulty: 'basic', questionType: 'single_choice', prompt: `${subject} fixture question number ${n}: choose the uniquely correct value.`, options: ['A', 'B', 'C', 'D'].map((id, offset) => ({ id, text: `${subject}-${n}-${offset}` })), correctAnswer: 'A', explanation: `Fixture explanation for ${subject} question ${n}; option A is uniquely correct.`, knowledgeTags: [`${subject}-fixture`], syllabusVersion: 'fixture-v1' };
}));
const candidateIds = questions.map((question) => question.candidateId);
module.exports = {
  pack: { selection: { schemaVersion: 'fixture-selection-v1', selectionId: 'fixture-accepted-30', candidateIds }, manifest: { schemaVersion: 'fixture-manifest-v1', packId: 'fixture-accepted-30', candidateIds }, questions, reviews: questions.map((question) => ({ candidateId: question.candidateId, reviewerTaskId: `review-${question.candidateId}`, derivedAnswer: 'A', generatorAnswer: 'A', answersConsistent: true, verdictAfterReveal: 'pass' })), audit: { schemaVersion: 'fixture-audit-v1', status: 'clear', formalQualificationEligible: true, summary: { overall: { blocked: 0 } }, questions: questions.map((question) => ({ candidateId: question.candidateId, status: 'clear' })) } },
  inventory: { cscaExamTopics: subjects.map((subject, index) => ({ id: index + 1, subject, code: topicCodes[subject], title: `${subject} fixture topic`, syllabusVersion: 'fixture-v1', status: 'published' })), specialPracticeTopics: subjects.map((subject, index) => ({ id: index + 101, subject, slug: `fixture-${subject}`, title: `${subject} fixture`, status: 'published' })), topicMappings: subjects.map((subject, index) => ({ sourceType: 'special_practice_topic', sourceId: index + 101, topicId: index + 1 })), cscaQuestions: [], specialPracticeQuestions: [] }
};

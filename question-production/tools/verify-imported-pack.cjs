#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { loadDatabaseUrl, stable } = require('./import-accepted-pack.cjs');

async function main() {
  const packDir = path.resolve(process.argv[2] || path.join('question-production', 'accepted', 'pilot-30-v4'));
  const questions = JSON.parse(fs.readFileSync(path.join(packDir, 'questions.json'), 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(path.join(packDir, 'manifest.json'), 'utf8'));
  const expected = new Map(questions.map((question) => [question.candidateId, question]));
  const packId = manifest.packId || manifest.selectionId;
  loadDatabaseUrl();
  const { PrismaClient } = require(path.resolve('node_modules', '@prisma', 'client'));
  const prisma = new PrismaClient();
  try {
    const rows = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      return tx.$queryRawUnsafe(`
        SELECT q.id, q.subject, q.status, q.prompt, q.options,
               q.correct_answer AS "correctAnswer", q.explanation,
               q.source_question_id AS "sourceQuestionId",
               q.review_metadata AS "reviewMetadata",
               t.code AS "mappedTopicCode", t.status AS "examTopicStatus",
               sp.id AS "specialPracticeQuestionId", sp.status AS "specialPracticeStatus",
               sp.prompt AS "specialPracticePrompt", sp.options AS "specialPracticeOptions",
               sp.correct_answer AS "specialPracticeCorrectAnswer",
               spt.status AS "specialPracticeTopicStatus", spt.subject AS "specialPracticeSubject",
               EXISTS (
                 SELECT 1 FROM csca_topic_mappings qm
                 WHERE qm.source_type = 'special_practice_question'
                   AND qm.source_id = sp.id AND qm.topic_id = q.topic_id
               ) AS "questionMappingExists",
               EXISTS (
                 SELECT 1 FROM csca_topic_mappings tm
                 WHERE tm.source_type = 'special_practice_topic'
                   AND tm.source_id = sp.topic_id AND tm.topic_id = q.topic_id
               ) AS "topicBridgeExists"
        FROM csca_questions q
        JOIN csca_exam_topics t ON t.id = q.topic_id
        JOIN special_practice_questions sp ON sp.id = q.source_question_id
        JOIN special_practice_topics spt ON spt.id = sp.topic_id
        WHERE q.source_type = 'manual_supervised_pack'
          AND q.review_metadata->'dualSessionSupervisedAcceptance'->>'packId' = $1
        ORDER BY q.id
      `, packId);
    });
    const errors = [];
    const seen = new Set();
    for (const row of rows) {
      const trace = row.reviewMetadata?.dualSessionSupervisedAcceptance ?? {};
      const candidateId = trace.candidateId;
      const question = expected.get(candidateId);
      if (!question) { errors.push(`unexpected candidate ${candidateId || row.id}`); continue; }
      seen.add(candidateId);
      if (row.status !== 'approved') errors.push(`${candidateId}: csca status ${row.status}`);
      if (row.specialPracticeStatus !== 'published') errors.push(`${candidateId}: practice status ${row.specialPracticeStatus}`);
      if (row.examTopicStatus !== 'published' || row.specialPracticeTopicStatus !== 'published') errors.push(`${candidateId}: topic is not published`);
      if (row.subject !== question.subject || row.specialPracticeSubject !== question.subject) errors.push(`${candidateId}: subject mismatch`);
      if (row.sourceQuestionId !== row.specialPracticeQuestionId) errors.push(`${candidateId}: broken source question link`);
      if (!row.questionMappingExists || !row.topicBridgeExists) errors.push(`${candidateId}: topic mapping missing`);
      if (row.prompt !== question.prompt || row.specialPracticePrompt !== question.prompt) errors.push(`${candidateId}: prompt mismatch`);
      if (stable(row.options) !== stable(question.options) || stable(row.specialPracticeOptions) !== stable(question.options)) errors.push(`${candidateId}: options mismatch`);
      if (row.correctAnswer !== question.correctAnswer || row.specialPracticeCorrectAnswer !== question.correctAnswer) errors.push(`${candidateId}: answer mismatch`);
      if (row.explanation !== question.explanation) errors.push(`${candidateId}: explanation mismatch`);
      if (trace.mappedTopicCode !== row.mappedTopicCode) errors.push(`${candidateId}: mapped topic trace mismatch`);
    }
    for (const id of expected.keys()) if (!seen.has(id)) errors.push(`${id}: imported row missing`);
    const subjectCounts = Object.fromEntries(['math', 'physics', 'chemistry'].map((subject) => [subject, rows.filter((row) => row.subject === subject).length]));
    if (rows.length !== 30 || Object.values(subjectCounts).some((count) => count !== 10)) errors.push(`unexpected subject counts ${JSON.stringify(subjectCounts)}`);
    const summary = { packId, rows: rows.length, subjectCounts, approved: rows.filter((row) => row.status === 'approved').length, published: rows.filter((row) => row.specialPracticeStatus === 'published').length, linked: rows.filter((row) => row.sourceQuestionId === row.specialPracticeQuestionId).length, errors };
    console.log(JSON.stringify(summary, null, 2));
    if (errors.length) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });

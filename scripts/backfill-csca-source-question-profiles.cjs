#!/usr/bin/env node

require('../backend/node_modules/ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs',
    moduleResolution: 'node'
  }
});

const path = require('node:path');
const { loadEnv } = require('./load-env.cjs');
const { Prisma, PrismaClient } = require('../backend/node_modules/@prisma/client');
const { normalizeSourceQuestionAnalysis } = require('../backend/src/ai-questioning/source-question-profile-normalizer');

const root = path.resolve(__dirname, '..');
loadEnv(root);

function parseArgs(argv) {
  const options = {
    execute: false,
    force: false,
    selfTest: false,
    limit: 500,
    subject: '',
    documentId: null
  };
  for (const arg of argv) {
    if (arg === '--execute') options.execute = true;
    else if (arg === '--force') options.force = true;
    else if (arg === '--self-test') options.selfTest = true;
    else if (arg.startsWith('--limit=')) options.limit = Math.max(0, Math.min(5000, Number(arg.slice('--limit='.length)) || 0));
    else if (arg.startsWith('--subject=')) options.subject = arg.slice('--subject='.length).trim();
    else if (arg.startsWith('--document-id=')) {
      const documentId = Number(arg.slice('--document-id='.length));
      options.documentId = Number.isInteger(documentId) && documentId > 0 ? documentId : null;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

function recordFrom(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function analysisHasV2Profile(value) {
  const analysis = recordFrom(value);
  const profile = recordFrom(analysis.profile);
  return analysis.schemaVersion === 'source-question-analysis-v2' && profile.schemaVersion === 'source-question-profile-v2';
}

function sourceQuestionForNormalizer(row) {
  return {
    id: row.id,
    subject: row.subject,
    syllabusVersion: row.syllabusVersion,
    topicId: row.topicId,
    topicCodes: row.topicCodes,
    promptText: row.promptText,
    options: row.options,
    correctAnswer: row.correctAnswer,
    explanation: row.explanation,
    analysisConfidence: row.analysisConfidence,
    analysisIssues: row.analysisIssues
  };
}

function buildV2Analysis(row, now = new Date().toISOString()) {
  const previous = recordFrom(row.analysis);
  const normalized = normalizeSourceQuestionAnalysis({
    analysis: row.analysis,
    sourceQuestion: sourceQuestionForNormalizer(row)
  });
  const previousParser = recordFrom(previous.parser);
  return {
    ...previous,
    schemaVersion: 'source-question-analysis-v2',
    profile: normalized,
    parser: {
      ...previousParser,
      provider: previousParser.provider || 'backfill-normalizer',
      parsedAt: previousParser.parsedAt || now,
      backfilledAt: now
    },
    cognitiveSkill: normalized.cognitiveSkill,
    difficulty: normalized.difficultyBand === 'unknown' ? 'basic' : normalized.difficultyBand,
    difficultyEvidence: normalized.difficultyEvidence,
    questionForm: normalized.questionForm,
    readingLoad: normalized.readingLoad,
    stemPattern: {
      ...normalized.stemPattern,
      length: normalized.readingLoad
    },
    reasoningSteps: normalized.reasoningStepCount ?? 1,
    calculationLoad: normalized.calculationLoad === 'unknown' ? 'none' : normalized.calculationLoad,
    estimatedTimeSeconds: normalized.estimatedTimeSeconds,
    optionPattern: normalized.optionPattern,
    loadEvidence: normalized.loadEvidence,
    styleNotes: normalized.styleNotes,
    doNotCopySignals: normalized.similarityRiskSignals,
    profileConfidence: normalized.profileConfidence,
    profileIssues: normalized.profileIssues
  };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function runSelfTest() {
  const row = {
    id: 1,
    subject: 'physics',
    syllabusVersion: '2025',
    topicId: 9,
    topicCodes: ['P-MECH-001'],
    promptText: 'A 2 kg object is pulled by a constant force of 6 N. What is its acceleration?',
    options: [{ id: 'A', text: '2 m/s^2' }, { id: 'B', text: '3 m/s^2' }, { id: 'C', text: '6 m/s^2' }, { id: 'D', text: '12 m/s^2' }],
    correctAnswer: 'B',
    explanation: 'Use F = ma.',
    analysis: {
      questionForm: 'formula_calculation',
      cognitiveSkill: 'calculation',
      difficulty: 'basic',
      calculationLoad: 'light',
      reasoningSteps: 1
    },
    analysisConfidence: 0.82,
    analysisIssues: []
  };
  const next = buildV2Analysis(row, '2026-07-03T00:00:00.000Z');
  assert(next.schemaVersion === 'source-question-analysis-v2', 'analysis schema should be v2.');
  assert(next.profile?.schemaVersion === 'source-question-profile-v2', 'profile schema should be v2.');
  assert(next.profile.subject === 'physics', 'profile should preserve subject.');
  assert(next.profile.topicIds.includes(9), 'profile should include topic id.');
  assert(next.readingLoad, 'top-level readingLoad should be present for compatibility.');
  assert(next.calculationLoad === 'light', 'calculationLoad should preserve explicit analysis value.');
  console.log('CSCA source question profile backfill self-test passed.');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.selfTest) {
    runSelfTest();
    return;
  }
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required for CSCA source question profile backfill. Use --self-test to test without a database.');
  }
  const prisma = new PrismaClient();
  try {
    const rows = await prisma.$queryRaw(Prisma.sql`
      SELECT "id", "document_id" AS "documentId", "subject", "syllabus_version" AS "syllabusVersion",
             "topic_id" AS "topicId", "topic_codes" AS "topicCodes", "prompt_text" AS "promptText",
             "options", "correct_answer" AS "correctAnswer", "explanation", "analysis",
             "analysis_confidence" AS "analysisConfidence", "analysis_issues" AS "analysisIssues"
      FROM "csca_source_questions"
      WHERE (${options.subject || null}::text IS NULL OR "subject" = ${options.subject || null})
        AND (${options.documentId}::int IS NULL OR "document_id" = ${options.documentId})
      ORDER BY "id" ASC
      LIMIT ${options.limit}
    `);
    const stats = {
      mode: options.execute ? 'execute' : 'dry-run',
      force: options.force,
      scanned: rows.length,
      upgraded: 0,
      skippedCurrent: 0,
      lowConfidence: 0,
      failed: 0
    };
    const failures = [];
    for (const row of rows) {
      try {
        if (!options.force && analysisHasV2Profile(row.analysis)) {
          stats.skippedCurrent += 1;
          continue;
        }
        const nextAnalysis = buildV2Analysis(row);
        if (nextAnalysis.profile.profileConfidence === 'low') stats.lowConfidence += 1;
        if (options.execute) {
          await prisma.$executeRaw(Prisma.sql`
            UPDATE "csca_source_questions"
            SET "analysis" = ${JSON.stringify(nextAnalysis)}::jsonb,
                "updated_at" = NOW()
            WHERE "id" = ${row.id}
          `);
        }
        stats.upgraded += 1;
      } catch (error) {
        stats.failed += 1;
        failures.push({ id: row.id, error: error instanceof Error ? error.message : String(error) });
      }
    }
    console.log(JSON.stringify({ stats, failures: failures.slice(0, 20) }, null, 2));
    if (stats.failed > 0) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

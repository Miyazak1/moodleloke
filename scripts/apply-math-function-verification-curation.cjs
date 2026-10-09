#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { loadEnv } = require('./load-env.cjs');
const { PrismaClient } = require('../backend/node_modules/@prisma/client');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(ROOT, 'docs', 'csca-math-function-verification-curation-v1.json');

function recordFrom(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function parseArgs(argv) {
  const options = { apply: false, allowAbsent: false };
  for (const arg of argv) {
    if (arg === '--apply') options.apply = true;
    else if (arg === '--allow-absent') options.allowAbsent = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function printHelp() {
  console.log(`Usage: node scripts/apply-math-function-verification-curation.cjs [--apply] [--allow-absent]\n\nWithout --apply this command performs a read-only validation. Apply mode promotes only the exact content hashes in the reviewed manifest. --allow-absent skips a database containing none of the curated questions, but a partial match still fails.`);
}

function standardFourOptionQuestion(question) {
  const questionType = String(question.questionType ?? '').replaceAll('_', '-');
  const options = Array.isArray(question.options) ? question.options : [];
  const ids = options.map((item) => String(recordFrom(item).id ?? '').trim());
  const texts = options.map((item) => String(recordFrom(item).text ?? '').trim());
  return questionType === 'single-choice'
    && options.length === 4
    && ids.every(Boolean)
    && texts.every(Boolean)
    && new Set(ids).size === 4
    && ids.includes(String(question.correctAnswer ?? '').trim());
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) return printHelp();
  loadEnv(ROOT);
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  if (manifest.schemaVersion !== '1' || !Array.isArray(manifest.questions) || !manifest.questions.length) {
    throw new Error('Invalid curation manifest.');
  }
  const hashes = manifest.questions.map((item) => item.contentHash);
  if (new Set(hashes).size !== hashes.length) throw new Error('Curation manifest contains duplicate content hashes.');

  const prisma = new PrismaClient();
  try {
    const rows = await prisma.cscaQuestion.findMany({
      where: {
        topic: { code: manifest.topicCode, status: 'published' },
        sourceType: 'external_oer', sourceQuestionId: null, status: { in: ['approved', 'archived'] }
      },
      select: {
        id: true, status: true, version: true, questionType: true, options: true, correctAnswer: true, explanation: true,
        generationMetadata: true, reviewMetadata: true
      }
    });
    const byHash = new Map();
    for (const row of rows) {
      const hash = String(recordFrom(recordFrom(row.generationMetadata).externalImport).contentHash ?? '');
      if (!hashes.includes(hash)) continue;
      if (byHash.has(hash)) throw new Error(`Database contains duplicate curated content hash: ${hash}`);
      byHash.set(hash, row);
    }

    if (byHash.size === 0 && options.allowAbsent) {
      console.log(JSON.stringify({
        schemaVersion: '1', mode: options.apply ? 'apply' : 'preview', curationId: manifest.curationId,
        topicCode: manifest.topicCode, status: 'skipped', reason: 'CURATED_SOURCE_QUESTIONS_ABSENT'
      }, null, 2));
      return;
    }

    const validated = manifest.questions.map((entry) => {
      const row = byHash.get(entry.contentHash);
      if (!row) throw new Error(`Curated question is missing: ${entry.contentHash}`);
      if (!standardFourOptionQuestion(row)) throw new Error(`Curated question is not a standard four-option item: ${entry.contentHash}`);
      if (row.correctAnswer !== entry.expectedAnswer) throw new Error(`Answer changed for curated question: ${entry.contentHash}`);
      if (!String(entry.taskFamily ?? '').trim()) throw new Error(`Task family is missing: ${entry.contentHash}`);
      if (!String(entry.explanation ?? '').trim()) throw new Error(`Reviewed explanation is missing: ${entry.contentHash}`);
      return { entry, row };
    });

    const changes = validated.filter(({ entry, row }) => {
      const generationMetadata = recordFrom(row.generationMetadata);
      const curation = recordFrom(generationMetadata.verificationCuration);
      const externalReview = recordFrom(recordFrom(row.reviewMetadata).externalImport);
      return row.status !== 'approved'
        || row.explanation !== entry.explanation
        || generationMetadata.taskFamily !== entry.taskFamily
        || curation.curationId !== manifest.curationId
        || curation.contentHash !== entry.contentHash
        || externalReview.contentReviewed !== true
        || externalReview.answerRecomputed !== true
        || externalReview.publicationScope !== 'independent_verification'
        || externalReview.verificationMode !== manifest.reviewPolicy
        || externalReview.verificationCurationId !== manifest.curationId;
    });
    const report = {
      schemaVersion: '1', mode: options.apply ? 'apply' : 'preview', curationId: manifest.curationId,
      topicCode: manifest.topicCode, reviewedQuestionCount: validated.length,
      taskFamilyCount: new Set(validated.map(({ entry }) => entry.taskFamily)).size,
      archivedQuestionsToRestore: validated.filter(({ row }) => row.status === 'archived').length,
      questionsToUpdate: changes.length
    };
    if (!options.apply) {
      console.log(JSON.stringify(report, null, 2));
      console.log('Dry run only. Re-run with --apply after reviewing this exact manifest.');
      return;
    }

    const reviewedAt = new Date().toISOString();
    await prisma.$transaction(changes.map(({ entry, row }) => {
      const generationMetadata = recordFrom(row.generationMetadata);
      const reviewMetadata = recordFrom(row.reviewMetadata);
      const externalReview = recordFrom(reviewMetadata.externalImport);
      return prisma.cscaQuestion.update({
        where: { id: row.id },
        data: {
          status: 'approved',
          version: { increment: 1 },
          explanation: entry.explanation,
          generationMetadata: {
            ...generationMetadata,
            taskFamily: entry.taskFamily,
            verificationCuration: {
              curationId: manifest.curationId,
              policy: manifest.reviewPolicy,
              contentHash: entry.contentHash,
              reviewedAt
            }
          },
          reviewMetadata: {
            ...reviewMetadata,
            externalImport: {
              ...externalReview,
              contentReviewed: true,
              answerRecomputed: true,
              publicationScope: 'independent_verification',
              verificationMode: manifest.reviewPolicy,
              verificationCurationId: manifest.curationId,
              reviewedAt
            }
          }
        }
      });
    }));
    console.log(JSON.stringify({ ...report, applied: true, updatedQuestionCount: changes.length, reviewedAt: changes.length ? reviewedAt : null }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error?.stack || error?.message || error);
  process.exitCode = 1;
});

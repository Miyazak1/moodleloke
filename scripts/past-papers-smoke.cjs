const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { resolvePastPaperLocalPath } = require('../backend/dist/past-papers/past-paper-storage');
const { PastPapersService } = require('../backend/dist/past-papers/past-papers.service');

function samplePaper(overrides = {}) {
  return {
    id: 91,
    slug: 'math-2026-sample',
    title: 'Math 2026 Sample',
    subject: 'math',
    examYear: 2026,
    examMonth: 'June',
    sessionLabel: 'Sample',
    language: 'zh',
    description: 'Smoke paper.',
    questionCount: 48,
    pageCount: 16,
    hasAnswers: true,
    hasSolutions: true,
    coverUrl: null,
    isFree: true,
    isPublished: true,
    isFeatured: true,
    sortOrder: 1,
    downloadCount: 7,
    version: 1,
    createdAt: new Date('2026-05-26T00:00:00.000Z'),
    updatedAt: new Date('2026-05-26T00:00:00.000Z'),
    deletedAt: null,
    files: [
      {
        id: 501,
        pastPaperId: 91,
        kind: 'paper',
        label: 'Paper PDF',
        fileUrl: '/uploads/past-papers/math-sample.pdf',
        originalFilename: 'math-sample.pdf',
        mimeType: 'application/pdf',
        fileSizeBytes: 12345,
        checksum: 'sample',
        createdAt: new Date('2026-05-26T00:00:00.000Z'),
        updatedAt: new Date('2026-05-26T00:00:00.000Z')
      }
    ],
    ...overrides
  };
}

function createPrismaMock(paper) {
  const calls = { update: null, download: null };
  return {
    calls,
    pastPaper: {
      findFirst: async () => paper,
      update: async (input) => {
        calls.update = input;
        return { ...paper, downloadCount: paper.downloadCount + 1 };
      }
    },
    pastPaperDownload: {
      create: async (input) => {
        calls.download = input;
        return { id: 1, ...input.data };
      }
    },
    $transaction: async (operations) => Promise.all(operations)
  };
}

async function expectRejectsWithStatus(action, status) {
  let thrown = null;
  try {
    await action();
  } catch (error) {
    thrown = error;
  }
  assert.ok(thrown, 'expected action to reject');
  assert.equal(thrown.getStatus?.(), status);
}

async function main() {
  const paper = samplePaper();
  const prisma = createPrismaMock(paper);
  const service = new PastPapersService(prisma);

  const result = await service.recordDownload('math-2026-sample', '501', {
    userId: 7,
    ip: '203.0.113.9',
    userAgent: 'PastPaperSmoke/1.0'
  });

  assert.equal(result.url, '/uploads/past-papers/math-sample.pdf');
  assert.equal(result.paper.downloadCount, 8);
  assert.deepEqual(prisma.calls.update, { where: { id: 91 }, data: { downloadCount: { increment: 1 } } });
  assert.equal(prisma.calls.download.data.userId, 7);
  assert.equal(prisma.calls.download.data.ipHash, createHash('sha256').update('203.0.113.9').digest('hex'));
  assert.equal(prisma.calls.download.data.userAgentHash, createHash('sha256').update('PastPaperSmoke/1.0').digest('hex'));
  assert.notEqual(prisma.calls.download.data.ipHash, '203.0.113.9');
  assert.notEqual(prisma.calls.download.data.userAgentHash, 'PastPaperSmoke/1.0');

  await expectRejectsWithStatus(() => new PastPapersService(createPrismaMock(null)).recordDownload('draft', '501'), 404);
  await expectRejectsWithStatus(() => service.recordDownload('math-2026-sample', '999'), 404);

  assert.equal(resolvePastPaperLocalPath('/uploads/other/math-sample.pdf'), null);
  assert.equal(resolvePastPaperLocalPath('/uploads/past-papers/../secret.pdf'), null);
  assert.equal(resolvePastPaperLocalPath('/uploads/past-papers/nested/secret.pdf'), null);
  assert.ok(resolvePastPaperLocalPath('/uploads/past-papers/math-sample.pdf')?.endsWith('math-sample.pdf'));

  console.log('CSCAlite Past Papers smoke passed.');
}

main().catch((error) => {
  console.error(`CSCAlite Past Papers smoke failed: ${error.message}`);
  process.exit(1);
});

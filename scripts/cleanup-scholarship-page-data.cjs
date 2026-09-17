const path = require('node:path');
const { loadEnv } = require('./load-env.cjs');
const { Prisma, PrismaClient, SchoolStatus } = require('../backend/node_modules/@prisma/client');

loadEnv(path.resolve(__dirname, '..'));

const prisma = new PrismaClient();

const STALE_SCHOLARSHIP_SLUGS = [
  'three-gorges-university-full-scholarship-for-myanmar-students'
];

const STALE_SCHOLARSHIP_DATA = {
  status: SchoolStatus.archived,
  deadlineDate: new Date('2018-07-15T00:00:00.000Z'),
  deadlineLabel: '2018 年 7 月 15 日',
  applicationRound: '2018-2019 学年'
};

const MOCK_EXAM_LINK_PATTERN = /模拟试卷|mock-exam/i;

function cleanActionLinks(value) {
  if (!Array.isArray(value)) return value;
  return value.filter((link) => {
    if (!link || typeof link !== 'object') return true;
    return !MOCK_EXAM_LINK_PATTERN.test(`${link.label || ''} ${link.url || ''} ${link.kind || ''}`);
  });
}

async function main() {
  const result = {
    updatedStaleScholarships: 0,
    cleanedMockActions: 0
  };

  const staleResult = await prisma.scholarship.updateMany({
    where: {
      slug: { in: STALE_SCHOLARSHIP_SLUGS }
    },
    data: STALE_SCHOLARSHIP_DATA
  });
  result.updatedStaleScholarships = staleResult.count;

  const rows = await prisma.scholarship.findMany({
    where: { actionLinks: { not: Prisma.DbNull } },
    select: { id: true, actionLinks: true }
  });

  for (const row of rows) {
    const cleaned = cleanActionLinks(row.actionLinks);
    if (JSON.stringify(cleaned) !== JSON.stringify(row.actionLinks)) {
      await prisma.scholarship.update({
        where: { id: row.id },
        data: { actionLinks: cleaned }
      });
      result.cleanedMockActions += 1;
    }
  }

  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

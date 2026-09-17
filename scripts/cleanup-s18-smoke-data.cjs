const { PrismaClient } = require('../backend/node_modules/@prisma/client');
const { loadEnv } = require('./load-env.cjs');

loadEnv();

const EXECUTE = process.argv.includes('--execute');
const PREFIX = 's18-smoke-';
const PUBLIC_PREFIX = 's18-public-';

function startsWithSmokePrefix(field) {
  return {
    OR: [
      { [field]: { startsWith: PREFIX } },
      { [field]: { startsWith: PUBLIC_PREFIX } }
    ]
  };
}

function unique(values) {
  return Array.from(new Set(values.filter((value) => value !== null && value !== undefined)));
}

function plural(label, count) {
  return `${label}: ${count}`;
}

async function collectSmokeData(prisma) {
  const smokeUsers = await prisma.user.findMany({
    where: startsWithSmokePrefix('email'),
    select: { id: true, email: true }
  });
  const smokeSchools = await prisma.school.findMany({
    where: {
      OR: [
        { source: 's18-smoke' },
        { source: 's18-public' },
        startsWithSmokePrefix('sourceId'),
        startsWithSmokePrefix('nameZh'),
        startsWithSmokePrefix('nameEn')
      ]
    },
    select: { id: true, nameZh: true, source: true, sourceId: true }
  });
  const smokeContentBlocks = await prisma.publicContentBlock.findMany({
    where: { key: { startsWith: PREFIX } },
    select: { id: true, key: true }
  });
  const smokeMockPapers = await prisma.mockExamPaper.findMany({
    where: {
      OR: [
        { slug: { startsWith: PREFIX } },
        { title: { contains: 'smoke', mode: 'insensitive' } },
        { description: { contains: 'smoke', mode: 'insensitive' } }
      ]
    },
    select: { id: true, slug: true }
  });
  const smokeSpecialTopics = await prisma.specialPracticeTopic.findMany({
    where: {
      OR: [
        { slug: { startsWith: PREFIX } },
        { title: { contains: 'smoke', mode: 'insensitive' } },
        { description: { contains: 'smoke', mode: 'insensitive' } }
      ]
    },
    select: { id: true, slug: true }
  });

  const userIds = smokeUsers.map((user) => user.id);
  const schoolIds = smokeSchools.map((school) => school.id);
  const mockPaperIds = smokeMockPapers.map((paper) => paper.id);
  const specialTopicIds = smokeSpecialTopics.map((topic) => topic.id);
  const smokeOrders = userIds.length
    ? await prisma.order.findMany({ where: { userId: { in: userIds } }, select: { id: true } })
    : [];
  const orderIds = smokeOrders.map((order) => order.id);
  const smokePayments =
    userIds.length || orderIds.length
      ? await prisma.payment.findMany({
          where: {
            OR: [
              ...(userIds.length ? [{ userId: { in: userIds } }] : []),
              ...(orderIds.length ? [{ orderId: { in: orderIds } }] : [])
            ]
          },
          select: { id: true, providerTxnId: true }
        })
      : [];
  const paymentIds = smokePayments.map((payment) => payment.id);
  const providerTxnIds = unique(smokePayments.map((payment) => payment.providerTxnId));
  const smokeCallbacks =
    paymentIds.length || providerTxnIds.length
      ? await prisma.paymentCallbackLog.findMany({
          where: {
            OR: [
              ...(paymentIds.length ? [{ paymentId: { in: paymentIds } }] : []),
              ...(providerTxnIds.length ? [{ providerTxnId: { in: providerTxnIds } }] : [])
            ]
          },
          select: { id: true }
        })
      : [];

  const [
    cartItems,
    orderItems,
    savedSchools,
    compareItems,
    programs,
    cscaRules,
    scholarships,
    changeLogs,
    snapshots,
    mockQuestions,
    mockAttempts,
    specialQuestions,
    specialSessions
  ] = await Promise.all([
    userIds.length || schoolIds.length
      ? prisma.cartItem.count({
          where: {
            OR: [
              ...(userIds.length ? [{ userId: { in: userIds } }] : []),
              ...(schoolIds.length ? [{ schoolId: { in: schoolIds } }] : [])
            ]
          }
        })
      : 0,
    orderIds.length || schoolIds.length
      ? prisma.orderItem.count({
          where: {
            OR: [
              ...(orderIds.length ? [{ orderId: { in: orderIds } }] : []),
              ...(schoolIds.length ? [{ schoolId: { in: schoolIds } }] : [])
            ]
          }
        })
      : 0,
    userIds.length || schoolIds.length
      ? prisma.savedSchool.count({
          where: {
            OR: [
              ...(userIds.length ? [{ userId: { in: userIds } }] : []),
              ...(schoolIds.length ? [{ schoolId: { in: schoolIds } }] : [])
            ]
          }
        })
      : 0,
    userIds.length || schoolIds.length
      ? prisma.schoolCompareItem.count({
          where: {
            OR: [
              ...(userIds.length ? [{ userId: { in: userIds } }] : []),
              ...(schoolIds.length ? [{ schoolId: { in: schoolIds } }] : [])
            ]
          }
        })
      : 0,
    schoolIds.length ? prisma.schoolProgram.count({ where: { schoolId: { in: schoolIds } } }) : 0,
    schoolIds.length ? prisma.schoolCscaRule.count({ where: { schoolId: { in: schoolIds } } }) : 0,
    schoolIds.length ? prisma.schoolScholarship.count({ where: { schoolId: { in: schoolIds } } }) : 0,
    schoolIds.length ? prisma.schoolChangeLog.count({ where: { schoolId: { in: schoolIds } } }) : 0,
    schoolIds.length ? prisma.schoolSnapshot.count({ where: { schoolId: { in: schoolIds } } }) : 0,
    mockPaperIds.length ? prisma.mockExamQuestion.count({ where: { paperId: { in: mockPaperIds } } }) : 0,
    userIds.length || mockPaperIds.length
      ? prisma.mockExamAttempt.count({
          where: {
            OR: [
              ...(userIds.length ? [{ userId: { in: userIds } }] : []),
              ...(mockPaperIds.length ? [{ paperId: { in: mockPaperIds } }] : [])
            ]
          }
        })
      : 0,
    specialTopicIds.length ? prisma.specialPracticeQuestion.count({ where: { topicId: { in: specialTopicIds } } }) : 0,
    userIds.length || specialTopicIds.length
      ? prisma.specialPracticeSession.count({
          where: {
            OR: [
              ...(userIds.length ? [{ userId: { in: userIds } }] : []),
              ...(specialTopicIds.length ? [{ topicId: { in: specialTopicIds } }] : [])
            ]
          }
        })
      : 0
  ]);

  return {
    userIds,
    schoolIds,
    mockPaperIds,
    specialTopicIds,
    contentBlockIds: smokeContentBlocks.map((block) => block.id),
    orderIds,
    paymentIds,
    providerTxnIds,
    callbackIds: smokeCallbacks.map((callback) => callback.id),
    counts: {
      users: smokeUsers.length,
      schools: smokeSchools.length,
      contentBlocks: smokeContentBlocks.length,
      cartItems,
      orders: smokeOrders.length,
      orderItems,
      payments: smokePayments.length,
      paymentCallbackLogs: smokeCallbacks.length,
      savedSchools,
      compareItems,
      schoolCscaRules: cscaRules,
      schoolScholarships: scholarships,
      schoolPrograms: programs,
      schoolChangeLogs: changeLogs,
      schoolSnapshots: snapshots,
      mockExamPapers: smokeMockPapers.length,
      mockExamQuestions: mockQuestions,
      mockExamAttempts: mockAttempts,
      specialPracticeTopics: smokeSpecialTopics.length,
      specialPracticeQuestions: specialQuestions,
      specialPracticeSessions: specialSessions,
      adminAuditLogs: 0
    }
  };
}

async function countAuditLogs(prisma, userIds) {
  const actorClause = userIds.length ? `actor_id IN (${userIds.map((id) => Number(id)).join(',')}) OR` : '';
  const rows = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*)::int AS count
    FROM admin_audit_logs
    WHERE
      ${actorClause}
      resource_id LIKE '${PREFIX}%'
      OR resource_id LIKE '${PUBLIC_PREFIX}%'
      OR COALESCE(before::text, '') LIKE '%${PREFIX}%'
      OR COALESCE(before::text, '') LIKE '%${PUBLIC_PREFIX}%'
      OR COALESCE(after::text, '') LIKE '%${PREFIX}%'
      OR COALESCE(after::text, '') LIKE '%${PUBLIC_PREFIX}%'
  `);
  return Number(rows[0]?.count ?? 0);
}

async function deleteAuditLogs(prisma, userIds) {
  const actorClause = userIds.length ? `actor_id IN (${userIds.map((id) => Number(id)).join(',')}) OR` : '';
  return prisma.$executeRawUnsafe(`
    DELETE FROM admin_audit_logs
    WHERE
      ${actorClause}
      resource_id LIKE '${PREFIX}%'
      OR resource_id LIKE '${PUBLIC_PREFIX}%'
      OR COALESCE(before::text, '') LIKE '%${PREFIX}%'
      OR COALESCE(before::text, '') LIKE '%${PUBLIC_PREFIX}%'
      OR COALESCE(after::text, '') LIKE '%${PREFIX}%'
      OR COALESCE(after::text, '') LIKE '%${PUBLIC_PREFIX}%'
  `);
}

async function executeCleanup(prisma, data) {
  const { userIds, schoolIds, mockPaperIds, specialTopicIds, contentBlockIds, orderIds, paymentIds, providerTxnIds, callbackIds } = data;
  const result = {};

  result.adminAuditLogs = await deleteAuditLogs(prisma, userIds);
  result.specialPracticeSessions =
    userIds.length || specialTopicIds.length
      ? (
          await prisma.specialPracticeSession.deleteMany({
            where: {
              OR: [
                ...(userIds.length ? [{ userId: { in: userIds } }] : []),
                ...(specialTopicIds.length ? [{ topicId: { in: specialTopicIds } }] : [])
              ]
            }
          })
        ).count
      : 0;
  result.mockExamAttempts =
    userIds.length || mockPaperIds.length
      ? (
          await prisma.mockExamAttempt.deleteMany({
            where: {
              OR: [
                ...(userIds.length ? [{ userId: { in: userIds } }] : []),
                ...(mockPaperIds.length ? [{ paperId: { in: mockPaperIds } }] : [])
              ]
            }
          })
        ).count
      : 0;
  result.specialPracticeQuestions = specialTopicIds.length
    ? (await prisma.specialPracticeQuestion.deleteMany({ where: { topicId: { in: specialTopicIds } } })).count
    : 0;
  result.specialPracticeTopics = specialTopicIds.length
    ? (await prisma.specialPracticeTopic.deleteMany({ where: { id: { in: specialTopicIds } } })).count
    : 0;
  result.mockExamQuestions = mockPaperIds.length
    ? (await prisma.mockExamQuestion.deleteMany({ where: { paperId: { in: mockPaperIds } } })).count
    : 0;
  result.mockExamPapers = mockPaperIds.length ? (await prisma.mockExamPaper.deleteMany({ where: { id: { in: mockPaperIds } } })).count : 0;
  result.paymentCallbackLogs =
    callbackIds.length || paymentIds.length || providerTxnIds.length
      ? (
          await prisma.paymentCallbackLog.deleteMany({
            where: {
              OR: [
                ...(callbackIds.length ? [{ id: { in: callbackIds } }] : []),
                ...(paymentIds.length ? [{ paymentId: { in: paymentIds } }] : []),
                ...(providerTxnIds.length ? [{ providerTxnId: { in: providerTxnIds } }] : [])
              ]
            }
          })
        ).count
      : 0;
  result.payments = paymentIds.length ? (await prisma.payment.deleteMany({ where: { id: { in: paymentIds } } })).count : 0;
  result.orderItems =
    orderIds.length || schoolIds.length
      ? (
          await prisma.orderItem.deleteMany({
            where: {
              OR: [
                ...(orderIds.length ? [{ orderId: { in: orderIds } }] : []),
                ...(schoolIds.length ? [{ schoolId: { in: schoolIds } }] : [])
              ]
            }
          })
        ).count
      : 0;
  result.orders = orderIds.length ? (await prisma.order.deleteMany({ where: { id: { in: orderIds } } })).count : 0;
  result.cartItems =
    userIds.length || schoolIds.length
      ? (
          await prisma.cartItem.deleteMany({
            where: {
              OR: [
                ...(userIds.length ? [{ userId: { in: userIds } }] : []),
                ...(schoolIds.length ? [{ schoolId: { in: schoolIds } }] : [])
              ]
            }
          })
        ).count
      : 0;
  result.savedSchools =
    userIds.length || schoolIds.length
      ? (
          await prisma.savedSchool.deleteMany({
            where: {
              OR: [
                ...(userIds.length ? [{ userId: { in: userIds } }] : []),
                ...(schoolIds.length ? [{ schoolId: { in: schoolIds } }] : [])
              ]
            }
          })
        ).count
      : 0;
  result.compareItems =
    userIds.length || schoolIds.length
      ? (
          await prisma.schoolCompareItem.deleteMany({
            where: {
              OR: [
                ...(userIds.length ? [{ userId: { in: userIds } }] : []),
                ...(schoolIds.length ? [{ schoolId: { in: schoolIds } }] : [])
              ]
            }
          })
        ).count
      : 0;
  result.schoolCscaRules = schoolIds.length ? (await prisma.schoolCscaRule.deleteMany({ where: { schoolId: { in: schoolIds } } })).count : 0;
  result.schoolScholarships = schoolIds.length ? (await prisma.schoolScholarship.deleteMany({ where: { schoolId: { in: schoolIds } } })).count : 0;
  result.schoolPrograms = schoolIds.length ? (await prisma.schoolProgram.deleteMany({ where: { schoolId: { in: schoolIds } } })).count : 0;
  result.schoolChangeLogs = schoolIds.length ? (await prisma.schoolChangeLog.deleteMany({ where: { schoolId: { in: schoolIds } } })).count : 0;
  result.schoolSnapshots = schoolIds.length ? (await prisma.schoolSnapshot.deleteMany({ where: { schoolId: { in: schoolIds } } })).count : 0;
  result.schools = schoolIds.length ? (await prisma.school.deleteMany({ where: { id: { in: schoolIds } } })).count : 0;
  result.users = userIds.length ? (await prisma.user.deleteMany({ where: { id: { in: userIds } } })).count : 0;
  result.contentBlocks = contentBlockIds.length
    ? (await prisma.publicContentBlock.deleteMany({ where: { id: { in: contentBlockIds } } })).count
    : 0;

  return result;
}

function printCounts(title, counts) {
  console.log(title);
  for (const [key, value] of Object.entries(counts)) {
    console.log(`- ${plural(key, value)}`);
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL must be configured before checking or cleaning S18 smoke data.');
  }

  const prisma = new PrismaClient();
  try {
    const data = await collectSmokeData(prisma);
    data.counts.adminAuditLogs = await countAuditLogs(prisma, data.userIds);
    printCounts(EXECUTE ? 'S18 smoke data cleanup plan:' : 'S18 smoke data dry-run:', data.counts);

    if (!EXECUTE) {
      console.log('Dry-run only. Re-run with --execute to delete these records.');
      return;
    }

    const deleted = await executeCleanup(prisma, data);
    printCounts('S18 smoke data deleted:', deleted);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(`S18 smoke data cleanup failed: ${error.message}`);
  process.exit(1);
});

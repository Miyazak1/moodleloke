const path = require('node:path');
const { loadEnv } = require('./load-env.cjs');
const { PrismaClient, SchoolStatus } = require('../backend/node_modules/@prisma/client');

loadEnv(path.resolve(__dirname, '..'));
const prisma = new PrismaClient();

function slugify(value) {
  const normalized = String(value || '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 180);
  return normalized || 'scholarship';
}

async function uniqueSlug(base, excludeId) {
  let slug = base;
  let suffix = 2;
  while (await prisma.scholarship.findFirst({
    where: {
      slug,
      ...(excludeId ? { id: { not: excludeId } } : {})
    },
    select: { id: true }
  })) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }
  return slug;
}

function fundingLevel(row) {
  const text = [row.coverage, row.amountText, row.name].filter(Boolean).join(' ');
  if (/全额|全奖|学费.{0,8}住宿.{0,8}生活费|医疗保险/i.test(text)) return 'full';
  if (/部分|减免|补贴|津贴|奖助/i.test(text)) return 'partial';
  return 'unknown';
}

async function main() {
  const rows = await prisma.schoolScholarship.findMany({
    where: { status: { not: SchoolStatus.archived } },
    include: { school: { select: { id: true, nameZh: true, status: true } }, program: { select: { id: true } } },
    orderBy: [{ schoolId: 'asc' }, { sortOrder: 'asc' }, { id: 'asc' }]
  });
  const result = { created: 0, linked: 0, skipped: 0 };

  for (const row of rows) {
    if (row.school.status === SchoolStatus.archived) {
      result.skipped += 1;
      continue;
    }
    const baseSlug = slugify(`${row.school.nameZh}-${row.name}`);
    let scholarship = await prisma.scholarship.findFirst({
      where: {
        title: row.name,
        schools: { some: { schoolId: row.schoolId } }
      },
      select: { id: true, slug: true }
    });
    if (!scholarship) {
      scholarship = await prisma.scholarship.create({
        data: {
          slug: await uniqueSlug(baseSlug),
          title: row.name,
          type: row.type || 'university',
          fundingLevel: fundingLevel(row),
          coverage: row.coverage,
          applicableDegree: row.applicableDegree,
          applicableProgram: row.applicableProgram,
          amountText: row.amountText,
          requirementText: row.requirementText,
          sourceUrl: row.sourceUrl,
          sourceLabel: row.sourceLabel,
          lastVerifiedAt: row.lastVerifiedAt,
          sortOrder: row.sortOrder,
          status: row.status
        },
        select: { id: true, slug: true }
      });
      result.created += 1;
    }

    await prisma.scholarshipSchool.upsert({
      where: { scholarshipId_schoolId: { scholarshipId: scholarship.id, schoolId: row.schoolId } },
      update: { sortOrder: row.sortOrder },
      create: { scholarshipId: scholarship.id, schoolId: row.schoolId, sortOrder: row.sortOrder }
    });
    if (row.programId) {
      await prisma.scholarshipProgram.upsert({
        where: { scholarshipId_programId: { scholarshipId: scholarship.id, programId: row.programId } },
        update: { sortOrder: row.sortOrder },
        create: { scholarshipId: scholarship.id, programId: row.programId, sortOrder: row.sortOrder }
      });
    }
    result.linked += 1;
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

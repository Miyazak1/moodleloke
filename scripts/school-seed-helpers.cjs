const path = require('node:path');
const { loadEnv } = require('./load-env.cjs');
const { PrismaClient, SchoolStatus } = require('../backend/node_modules/@prisma/client');

loadEnv(path.resolve(__dirname, '..'));

const prisma = new PrismaClient();

async function syncSequences(client = prisma) {
  const tables = ['schools', 'school_programs', 'school_csca_rules', 'school_scholarships'];
  for (const table of tables) {
    await client.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), COALESCE((SELECT MAX(id) FROM "${table}"), 1), true)`
    );
  }
}

async function upsertSchool(client, schoolData) {
  const existing = await client.school.findFirst({
    where: {
      OR: [{ source: schoolData.source, sourceId: schoolData.sourceId }, { nameZh: schoolData.nameZh }]
    }
  });

  if (existing) return client.school.update({ where: { id: existing.id }, data: schoolData });
  return client.school.create({ data: schoolData });
}

async function replaceChildren(client, schoolId, { programs = [], cscaRules = [], scholarships = [] }) {
  await client.schoolProgram.deleteMany({ where: { schoolId } });
  await client.schoolCscaRule.deleteMany({ where: { schoolId } });
  await client.schoolScholarship.deleteMany({ where: { schoolId } });

  if (programs.length) {
    await client.schoolProgram.createMany({ data: programs.map((program) => ({ ...program, schoolId })) });
  }
  if (cscaRules.length) {
    await client.schoolCscaRule.createMany({ data: cscaRules.map((rule) => ({ ...rule, schoolId })) });
  }
  if (scholarships.length) {
    await client.schoolScholarship.createMany({ data: scholarships.map((scholarship) => ({ ...scholarship, schoolId })) });
  }
}

async function runSchoolSeed({ schoolData, programs = [], cscaRules = [], scholarships = [], log = {} }) {
  await syncSequences(prisma);
  const school = await upsertSchool(prisma, schoolData);
  await replaceChildren(prisma, school.id, { programs, cscaRules, scholarships });
  console.log(JSON.stringify({ status: 'ok', schoolId: school.id, nameZh: school.nameZh, programs: programs.length, ...log }, null, 2));
}

module.exports = {
  prisma,
  SchoolStatus,
  runSchoolSeed
};

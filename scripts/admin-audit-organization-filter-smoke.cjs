const path = require('node:path');
const { loadEnv } = require('./load-env.cjs');

require('../backend/node_modules/ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs',
    moduleResolution: 'node'
  }
});

const { PrismaClient } = require('../backend/node_modules/@prisma/client');
const { AdminAuditService } = require('../backend/src/admin-audit/admin-audit.service');

loadEnv(path.resolve(__dirname, '..'));

const prisma = new PrismaClient();
const service = new AdminAuditService(prisma, {});
const stamp = `admin-audit-org-filter-${Date.now()}`;
const createdIds = [];
const createdOrganizationSlugs = [];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function createAudit(data) {
  const row = await prisma.adminAuditLog.create({ data });
  createdIds.push(row.id);
  return row;
}

async function cleanup() {
  if (createdIds.length) {
    await prisma.adminAuditLog.deleteMany({ where: { id: { in: createdIds } } });
  }
  if (createdOrganizationSlugs.length) {
    await prisma.organization.deleteMany({ where: { slug: { in: createdOrganizationSlugs } } });
  }
}

async function main() {
  const organization = await prisma.organization.create({
    data: {
      slug: stamp,
      name: 'Audit Smoke Org',
      type: 'school',
      status: 'active'
    }
  });
  createdOrganizationSlugs.push(organization.slug);
  const organizationId = organization.id;
  const targetEmail = `${stamp}@example.test`;

  await createAudit({
    module: 'organization',
    resourceType: 'organization_invite',
    resourceId: `${stamp}-invite`,
    action: 'organization.invite.reissue',
    after: { organizationId, email: targetEmail, marker: stamp }
  });
  await createAudit({
    module: 'organization',
    resourceType: 'organization',
    resourceId: String(organizationId),
    action: 'organization.update',
    after: { marker: stamp }
  });
  await createAudit({
    module: 'school',
    resourceType: 'school',
    resourceId: `${stamp}-school`,
    action: 'school.update',
    after: { organizationId: organizationId + 1, marker: stamp }
  });

  const orgEvents = await service.listEvents({ organizationId, limit: 20 });
  assert(orgEvents.length === 2, 'Organization filter should return only matching organization audit events.');
  assert(orgEvents.every((event) => event.action.startsWith('organization.')), 'Organization filter should not include unrelated modules.');
  assert(orgEvents.every((event) => event.organizationName === 'Audit Smoke Org'), 'Organization events should include readable organization name.');

  const organizationModuleEvents = await service.listEvents({ organizationId, module: 'organization', limit: 20 });
  assert(organizationModuleEvents.length === 2, 'Organization module filter should preserve matching organization events.');

  const inviteEvents = await service.listEvents({ organizationId, resourceType: 'organization_invite', limit: 20 });
  assert(inviteEvents.length === 1 && inviteEvents[0].action === 'organization.invite.reissue', 'Resource type filter should isolate invite events.');
  assert(inviteEvents[0].targetEmail === targetEmail, 'Invite event should expose target email.');

  console.log(JSON.stringify({ organizationId, matched: orgEvents.length, cleanedUp: true }, null, 2));
  console.log('Admin audit organization filter smoke passed.');
}

main()
  .then(cleanup)
  .catch(async (error) => {
    try {
      await cleanup();
    } catch (cleanupError) {
      console.warn(`Admin audit filter cleanup skipped: ${cleanupError.message}`);
    }
    console.error(`Admin audit organization filter smoke failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

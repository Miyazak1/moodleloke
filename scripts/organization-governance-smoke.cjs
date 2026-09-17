const path = require('node:path');
const { loadEnv } = require('./load-env.cjs');

require('../backend/node_modules/ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs',
    moduleResolution: 'node'
  }
});

const { Prisma, PrismaClient } = require('../backend/node_modules/@prisma/client');
const { AIEntitlementService } = require('../backend/src/csca-special-practice/ai-entitlement.service');

loadEnv(path.resolve(__dirname, '..'));

const prisma = new PrismaClient();
const service = new AIEntitlementService(prisma);
const stamp = `org-governance-smoke-${Date.now()}`;
const created = {
  userIds: [],
  organizationId: null
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function cleanup() {
  if (created.organizationId) {
    await prisma.$executeRaw`
      DELETE FROM "organizations"
      WHERE "id" = ${created.organizationId}
    `;
  }
  if (created.userIds.length) {
    await prisma.$executeRaw`
      DELETE FROM "users"
      WHERE "id" IN (${Prisma.join(created.userIds)})
    `;
  }
}

async function main() {
  const [admin] = await prisma.$queryRaw`
    INSERT INTO "users" ("email", "password_hash", "role", "status", "display_name", "updated_at")
    VALUES (${`${stamp}-admin@example.test`}, 'smoke', 'admin', 'active', 'Org Smoke Admin', CURRENT_TIMESTAMP)
    RETURNING "id", "email", "login_name" AS "loginName"
  `;
  const [student] = await prisma.$queryRaw`
    INSERT INTO "users" ("email", "password_hash", "role", "status", "display_name", "updated_at")
    VALUES (${`${stamp}-student@example.test`}, 'smoke', 'student', 'active', 'Org Smoke Student', CURRENT_TIMESTAMP)
    RETURNING "id", "email", "login_name" AS "loginName"
  `;
  created.userIds.push(admin.id, student.id);

  const organization = await service.upsertOrganization(admin.id, {
    name: 'Org Governance Smoke',
    slug: stamp,
    type: 'school',
    status: 'active'
  });
  created.organizationId = organization.id;
  assert(organization.slug === stamp, 'Organization should be created with requested slug.');

  const withCohort = await service.upsertOrganizationCohort(admin.id, organization.id, {
    name: 'Smoke Cohort',
    slug: 'smoke-cohort',
    status: 'active'
  });
  const cohort = withCohort.cohorts.find((item) => item.slug === 'smoke-cohort');
  assert(cohort, 'Organization cohort should be created.');

  const preview = await service.previewOrganizationMemberImport(organization.id, {
    csv: `email,role,cohortSlug,cohortName\n${student.email},student,smoke-cohort,Smoke Cohort\n${stamp}-invitee@example.test,student,smoke-cohort,Smoke Cohort\n`
  });
  assert(preview.summary.readyMembers === 1, 'Member import preview should identify existing registered users.');
  assert(preview.summary.readyInvites === 1, 'Member import preview should create invites for unknown emails.');
  assert(preview.summary.errors === 0, 'Member import preview should be clean for valid rows.');
  const legacyRolePreview = await service.previewOrganizationMemberImport(organization.id, {
    rows: [{ email: `${stamp}-manager@example.test`, role: 'manager', cohortSlug: 'smoke-cohort', cohortName: 'Smoke Cohort' }]
  });
  assert(legacyRolePreview.rows[0]?.role === 'admin', 'Legacy manager role should normalize to admin during member import preview.');

  const applied = await service.applyOrganizationMemberImport(admin.id, organization.id, {
    csv: `email,role,cohortSlug,cohortName\n${student.email},student,smoke-cohort,Smoke Cohort\n${stamp}-invitee@example.test,student,smoke-cohort,Smoke Cohort\n`
  });
  assert(applied.summary.upsertedMembers === 1, 'Member import should upsert the registered user.');
  assert(applied.summary.createdInvites === 1, 'Member import should create an invite for the unknown email.');
  assert(applied.invites[0]?.token, 'Member import should return a one-time invite token for operators.');
  const importedInviteHistory = await service.listOrganizationInvites(organization.id, { status: 'pending', search: `${stamp}-invitee@example.test` });
  const importedInvite = importedInviteHistory.items[0];
  assert(importedInvite?.effectiveStatus === 'pending', 'Imported unknown-email invite should appear as pending.');
  await service.archiveOrganizationInvite(admin.id, organization.id, importedInvite.id);
  const archivedInvites = await service.listOrganizationInvites(organization.id, { status: 'archived', search: `${stamp}-invitee@example.test` });
  assert(archivedInvites.items.some((item) => item.id === importedInvite.id && item.effectiveStatus === 'archived'), 'Archived invite should appear in archived history.');
  const defaultInvites = await service.listOrganizationInvites(organization.id, { status: 'all', search: `${stamp}-invitee@example.test` });
  assert(!defaultInvites.items.some((item) => item.id === importedInvite.id), 'Archived invite should be hidden from the default active history.');

  const inviteResult = await service.createOrganizationInvite(admin.id, organization.id, {
    email: student.email,
    role: 'student',
    cohortId: cohort.id,
    maxUses: 1
  });
  assert(inviteResult.invite.acceptPath.includes('/organizations/invite?token='), 'Admin invite should return a usable accept path.');
  const pendingInvites = await service.listOrganizationInvites(organization.id, { status: 'pending' });
  assert(pendingInvites.items.some((item) => item.id === inviteResult.invite.id && item.effectiveStatus === 'pending' && item.createdByEmail === admin.email), 'Pending invite should appear in invite history with creator.');

  const accepted = await service.acceptOrganizationInvite(student, { token: inviteResult.invite.token });
  assert(accepted.accepted === true, 'Student should be able to accept a matching email invite.');
  assert(accepted.organization.id === organization.id, 'Invite acceptance should join the target organization.');
  assert(accepted.invite.status === 'used', 'Single-use invite should be marked used after acceptance.');
  const usedInvites = await service.listOrganizationInvites(organization.id, { status: 'used', search: student.email });
  assert(usedInvites.items.some((item) => item.id === inviteResult.invite.id && item.effectiveStatus === 'used' && item.acceptedByEmail === student.email), 'Used invite should be searchable in invite history with accepter.');
  const reissued = await service.reissueOrganizationInvite(admin.id, organization.id, inviteResult.invite.id, {});
  assert(reissued.invite.token && reissued.invite.token !== inviteResult.invite.token, 'Reissued invite should return a new one-time token.');
  assert(reissued.invite.acceptPath.includes('/organizations/invite?token='), 'Reissued invite should return a usable accept path.');
  const bulkReissued = await service.reissueOrganizationInvites(admin.id, organization.id, {
    inviteIds: [inviteResult.invite.id, reissued.invite.id]
  });
  assert(bulkReissued.invites.length === 2, 'Bulk reissue should create one new invite for each selected source invite.');
  assert(new Set(bulkReissued.invites.map((item) => item.token)).size === 2, 'Bulk reissue should return distinct one-time tokens.');
  assert(bulkReissued.invites.every((item) => item.acceptPath.includes('/organizations/invite?token=')), 'Bulk reissue should return usable accept paths.');

  const detailAfterAccept = await service.upsertOrganizationMember(admin.id, organization.id, {
    userId: student.id,
    role: 'student',
    status: 'active',
    cohortId: cohort.id
  });
  assert(detailAfterAccept.members.some((member) => member.userId === student.id && member.cohortId === cohort.id), 'Accepted member should appear in organization detail with cohort.');
  const detailAfterMemberGovernance = await service.upsertOrganizationMember(admin.id, organization.id, {
    userId: student.id,
    role: 'student',
    status: 'disabled',
    cohortId: null
  });
  assert(
    detailAfterMemberGovernance.members.some((member) => member.userId === student.id && member.status === 'disabled' && member.cohortId === null),
    'Organization member governance should support disabling and moving a member out of a cohort.'
  );
  const memberAuditRows = await prisma.adminAuditLog.findMany({
    where: { action: 'organization.member.update', resourceType: 'organization_member' },
    orderBy: { id: 'desc' },
    take: 20
  });
  assert(
    memberAuditRows.some((row) => row.after?.organizationId === organization.id && row.after?.userId === student.id && row.before?.cohortId === cohort.id && row.after?.cohortId === null),
    'Organization member governance must write before/after cohort changes to admin audit.'
  );

  const creditPool = await service.upsertOrganizationCreditPool(admin.id, organization.id, {
    availableCredits: 25,
    reservedCredits: 5,
    perUserDailyLimit: 3,
    status: 'active'
  });
  assert(creditPool.aiCreditPool?.availableCredits === 25, 'Organization credit pool should be configurable.');
  await service.upsertOrganizationMember(admin.id, organization.id, {
    userId: student.id,
    role: 'viewer',
    status: 'active',
    cohortId: cohort.id
  });
  const viewerReservation = await service.reserve(student.id, 'explain_wrong_answer', { provider: 'openai', model: 'smoke-model' });
  assert(viewerReservation.source !== 'organization', 'Viewer members must not reserve from the organization AI pool.');
  await service.refund(viewerReservation, { reason: 'smoke_viewer_permission_refund', provider: 'openai', model: 'smoke-model' });
  await service.upsertOrganizationMember(admin.id, organization.id, {
    userId: student.id,
    role: 'student',
    status: 'active',
    cohortId: cohort.id
  });
  const studentReservation = await service.reserve(student.id, 'explain_wrong_answer', { provider: 'openai', model: 'smoke-model' });
  assert(studentReservation.source === 'organization' && studentReservation.organizationId === organization.id, 'Student members should reserve from the organization AI pool when it is active.');
  await service.refund(studentReservation, { reason: 'smoke_student_permission_refund', provider: 'openai', model: 'smoke-model' });

  const provider = await service.upsertOrganizationProvider(admin.id, organization.id, {
    provider: 'openai-compatible',
    model: 'smoke-model',
    apiKey: 'smoke-secret',
    baseUrl: 'https://example.test/v1',
    status: 'active'
  });
  assert(provider.llmProviderConfigs.some((item) => item.model === 'smoke-model' && item.apiKeyConfigured), 'Organization BYOK provider should be configurable without exposing the key.');

  console.log(JSON.stringify({
    organizationId: organization.id,
    cohortId: cohort.id,
    importedMembers: applied.summary.upsertedMembers,
    importedInvites: applied.summary.createdInvites,
    acceptedInviteId: accepted.invite.id,
    cleanedUp: true
  }, null, 2));
  console.log('Organization governance smoke passed.');
}

main()
  .then(cleanup)
  .catch(async (error) => {
    try {
      await cleanup();
    } catch (cleanupError) {
      console.warn(`Organization governance smoke cleanup skipped: ${cleanupError.message}`);
    }
    console.error(`Organization governance smoke failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

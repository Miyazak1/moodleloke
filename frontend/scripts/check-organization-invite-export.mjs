import {
  organizationInviteHistoryCsv,
  organizationInviteLinksCsv,
  organizationInvitePath,
  organizationMemberBulkUpdateFailedResultCsv,
  organizationMemberBulkUpdateResultCsv,
  organizationMembersCsv
} from '../src/lib/organization-invites.ts';
import { readFileSync } from 'node:fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const path = organizationInvitePath('abc+/=');
assert(path === '/organizations/invite?token=abc%2B%2F%3D', 'Invite path must URL-encode tokens.');

const csv = organizationInviteLinksCsv([
  { rowNumber: 2, email: 'student@example.test', token: 'plain-token', shortCode: 'ABCD2345' },
  { rowNumber: 3, email: 'comma,"quote"@example.test', token: 'abc+/=', shortCode: null }
]);

assert(csv.includes('rowNumber,email,invitePath,shortCode'), 'Invite export CSV must include headers.');
assert(
  csv.includes('2,student@example.test,/organizations/invite?token=plain-token,ABCD2345'),
  'Invite export CSV must include plain invite links and short codes.'
);
assert(
  csv.includes('3,"comma,""quote""@example.test",/organizations/invite?token=abc%2B%2F%3D,'),
  'Invite export CSV must escape email cells, URL-encode tokens, and keep empty short-code cells.'
);

const historyCsv = organizationInviteHistoryCsv([
  {
    id: 42,
    email: 'history,student@example.test',
    role: 'student',
    effectiveStatus: 'pending',
    cohortName: 'Fall "A"',
    cohortSlug: 'fall-a',
    usedCount: 0,
    maxUses: 1,
    expiresAt: null,
    createdAt: '2026-06-11T00:00:00.000Z',
    updatedAt: '2026-06-11T00:00:00.000Z'
  }
]);

assert(historyCsv.includes('id,email,role,status,cohortName'), 'Invite history CSV must include headers.');
assert(
  historyCsv.includes('42,"history,student@example.test",student,pending,"Fall ""A"""'),
  'Invite history CSV must escape cells without exposing invite tokens.'
);
assert(!historyCsv.includes('/organizations/invite?token='), 'Invite history CSV must not expose old invite links.');

const membersCsv = organizationMembersCsv([
  {
    id: 7,
    userId: 11,
    email: 'member,one@example.test',
    role: 'student',
    status: 'active',
    cohortId: 3,
    cohortName: 'Fall "A"'
  }
]);
assert(membersCsv.includes('id,userId,email,role,status,cohortId,cohortName'), 'Member CSV must include governance headers.');
assert(
  membersCsv.includes('7,11,"member,one@example.test",student,active,3,"Fall ""A"""'),
  'Member CSV must escape member fields.'
);

const bulkResultCsv = organizationMemberBulkUpdateResultCsv([
  {
    userId: 11,
    email: 'member,one@example.test',
    fromRole: 'student',
    toRole: 'student',
    fromStatus: 'active',
    toStatus: 'disabled',
    fromCohortId: 3,
    toCohortId: null,
    result: 'success',
    auditEventId: 99
  },
  {
    userId: 12,
    email: 'bad@example.test',
    fromRole: 'student',
    toRole: 'student',
    fromStatus: 'active',
    toStatus: 'disabled',
    result: 'failed',
    error: 'network, retry'
  }
]);
assert(bulkResultCsv.includes('userId,email,fromRole,toRole,fromStatus,toStatus,fromCohortId,toCohortId,result,error,auditEventId'), 'Bulk member result CSV must include headers.');
assert(bulkResultCsv.includes('11,"member,one@example.test",student,student,active,disabled,3,,success,,99'), 'Bulk member result CSV must include audit event id.');
assert(bulkResultCsv.includes('12,bad@example.test,student,student,active,disabled,,,failed,"network, retry",'), 'Bulk member result CSV must escape failure reasons.');
const failedBulkResultCsv = organizationMemberBulkUpdateFailedResultCsv([
  {
    userId: 11,
    email: 'member,one@example.test',
    fromRole: 'student',
    toRole: 'student',
    fromStatus: 'active',
    toStatus: 'disabled',
    result: 'success',
    auditEventId: 99
  },
  {
    userId: 12,
    email: 'bad@example.test',
    fromRole: 'student',
    toRole: 'student',
    fromStatus: 'active',
    toStatus: 'disabled',
    result: 'failed',
    error: 'network, retry'
  }
]);
assert(failedBulkResultCsv.includes('userId,email,fromRole,toRole'), 'Failed bulk member CSV must keep the standard headers.');
assert(!failedBulkResultCsv.includes('member,one@example.test'), 'Failed bulk member CSV must not include successful rows.');
assert(failedBulkResultCsv.includes('12,bad@example.test,student,student,active,disabled,,,failed,"network, retry",'), 'Failed bulk member CSV must include failed rows.');

const adminOrganizationsPageSource = readFileSync(new URL('../src/pages/AdminOrganizationsPage.tsx', import.meta.url), 'utf8');
assert(adminOrganizationsPageSource.includes('failedBulkMemberResults'), 'Organization admin page must track failed bulk member rows.');
assert(adminOrganizationsPageSource.includes('retryFailedBulkMemberResults'), 'Organization admin page must support retrying failed bulk member rows.');
assert(adminOrganizationsPageSource.includes('downloadFailedBulkMemberResultCsv'), 'Organization admin page must support downloading failed bulk member rows.');
assert(adminOrganizationsPageSource.includes('重试失败项'), 'Organization admin page must expose a retry-failed action.');
assert(adminOrganizationsPageSource.includes('下载失败项'), 'Organization admin page must expose a failed-only CSV action.');
assert(adminOrganizationsPageSource.includes('showAdvancedMemberImport'), 'Organization admin page must keep numeric userId import behind an advanced mode.');
assert(adminOrganizationsPageSource.includes('优先用邮箱邀请导入'), 'Organization admin page must make email invite import the default member workflow.');
assert(adminOrganizationsPageSource.includes('高级补录字段'), 'Organization admin page must label userId import as an advanced recovery workflow.');

console.log('Organization invite export check passed.');

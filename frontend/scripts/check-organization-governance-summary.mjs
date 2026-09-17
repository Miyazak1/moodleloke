import {
  getOrganizationGovernanceDigest,
  summarizeOrganizationGovernanceEvent
} from '../src/lib/organization-governance.ts';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const base = {
  id: 1,
  actorEmail: 'admin@example.test',
  organizationId: 10,
  organizationName: 'Audit School',
  organizationSlug: 'audit-school',
  module: 'organization',
  resourceId: '1',
  createdAt: '2026-06-12T00:00:00.000Z'
};

const events = [
  {
    ...base,
    id: 1,
    resourceType: 'organization_member',
    action: 'organization.member.update',
    relatedUserEmail: 'student@example.test',
    before: { organizationId: 10, userId: 8, status: 'active', role: 'student', cohortId: 2 },
    after: { organizationId: 10, userId: 8, status: 'disabled', role: 'student', cohortId: null }
  },
  {
    ...base,
    id: 2,
    resourceType: 'organization_invite',
    action: 'organization.invite.reissue',
    targetEmail: 'invite@example.test',
    before: { organizationId: 10, status: 'used', email: 'invite@example.test' },
    after: { organizationId: 10, status: 'pending', email: 'invite@example.test' }
  },
  {
    ...base,
    id: 3,
    resourceType: 'organization_ai_credit_pool',
    action: 'organization.credit_pool.update',
    before: { organizationId: 10, availableCredits: 100, reservedCredits: 0, perUserDailyLimit: 5 },
    after: { organizationId: 10, availableCredits: 150, reservedCredits: 10, perUserDailyLimit: 8 }
  },
  {
    ...base,
    id: 4,
    resourceType: 'organization_llm_provider_config',
    action: 'organization.provider.update',
    before: { organizationId: 10, provider: 'openai', model: 'old-model', status: 'disabled' },
    after: { organizationId: 10, provider: 'openai', model: 'new-model', status: 'active', apiKeyConfigured: true }
  }
];

const summaries = events.map(summarizeOrganizationGovernanceEvent);
assert(summaries[0].category === 'member', 'Member event should be categorized as member.');
assert(summaries[0].detail.includes('状态 active -> disabled'), 'Member summary should include status change.');
assert(summaries[0].detail.includes('分组 清空'), 'Member summary should include cohort clearing.');
assert(summaries[1].category === 'invite', 'Invite event should be categorized as invite.');
assert(summaries[1].title === '重新生成邀请', 'Invite reissue should have a readable title.');
assert(summaries[2].category === 'credit', 'Credit pool event should be categorized as credit.');
assert(summaries[2].detail.includes('可用额度 100 -> 150'), 'Credit summary should include available credit change.');
assert(summaries[3].category === 'provider', 'Provider event should be categorized as provider.');
assert(summaries[3].detail.includes('模型 old-model -> new-model'), 'Provider summary should include model change.');
assert(summaries[3].detail.includes('API Key 已配置'), 'Provider summary should indicate API key is configured.');

const digest = getOrganizationGovernanceDigest(events);
assert(digest.total === 4, 'Digest should count total events.');
assert(digest.member === 1 && digest.invite === 1 && digest.credit === 1 && digest.provider === 1, 'Digest should count each governance category.');

const __dirname = dirname(fileURLToPath(import.meta.url));
const adminOrganizationsPageSource = readFileSync(resolve(__dirname, '../src/pages/AdminOrganizationsPage.tsx'), 'utf8');
assert(
  adminOrganizationsPageSource.includes("const ORGANIZATION_ROLE_OPTIONS = ['student', 'teacher', 'coach', 'viewer', 'admin', 'owner']"),
  'Organization admin page must expose the documented role set.'
);
assert(
  adminOrganizationsPageSource.includes("role === 'manager' ? 'admin' : role"),
  'Organization admin page must map legacy manager members to admin in the role selector.'
);
assert(
  !adminOrganizationsPageSource.includes('<option value="manager">manager</option>'),
  'Organization admin page must not create new manager-role members.'
);

console.log('Organization governance summary check passed.');

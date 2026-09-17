require('../backend/node_modules/ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs',
    moduleResolution: 'node'
  }
});

const {
  ORGANIZATION_ROLES,
  normalizeOrganizationRole,
  organizationRoleAllows,
  organizationRoleCapabilities
} = require('../backend/src/csca-special-practice/organization-permissions');
const { AICoachProviderService } = require('../backend/src/csca-special-practice/ai-coach-provider.service');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function disabledGateway() {
  return {
    hasConfiguredKey: () => false,
    complete: async () => {
      throw new Error('Disabled AI Gateway should not be called in organization permission tests.');
    }
  };
}

assert(
  JSON.stringify(ORGANIZATION_ROLES) === JSON.stringify(['owner', 'admin', 'teacher', 'coach', 'viewer', 'student']),
  'Organization roles must match the documented role set.'
);

assert(normalizeOrganizationRole('manager') === 'admin', 'Legacy manager role must normalize to admin.');
assert(normalizeOrganizationRole('tutor') === 'coach', 'Legacy tutor role must normalize to coach.');
assert(normalizeOrganizationRole('') === 'student', 'Empty organization role must default to student.');
assert(normalizeOrganizationRole('unknown') === null, 'Unknown organization role must be rejected.');

assert(organizationRoleAllows('owner', 'manage_provider'), 'Owner must be able to manage BYOK/provider config.');
assert(!organizationRoleAllows('admin', 'manage_provider'), 'Organization admin must not manage BYOK/provider config by default.');
assert(organizationRoleAllows('admin', 'manage_members'), 'Organization admin must manage members.');
assert(organizationRoleAllows('teacher', 'assign_practice'), 'Teacher must be able to assign practice.');
assert(organizationRoleAllows('coach', 'assign_practice'), 'Coach must be able to assign practice.');
assert(!organizationRoleAllows('viewer', 'assign_practice'), 'Viewer must not assign practice.');
assert(organizationRoleAllows('viewer', 'view_learning_reports'), 'Viewer must view learning reports.');
assert(organizationRoleAllows('student', 'use_ai_pool'), 'Student must be able to use an assigned organization AI pool.');
assert(!organizationRoleAllows('student', 'view_learning_reports'), 'Student role must not view organization-wide reports.');
assert(organizationRoleCapabilities('manager').includes('manage_members'), 'Legacy manager capabilities must match admin capabilities.');

async function testProviderRoutingUsesOrganizationRoleMatrix() {
  let role = 'viewer';
  const prisma = {
    organizationMember: {
      findMany: async () => [{
        id: 801,
        userId: 101,
        role,
        status: 'active',
        organization: {
          id: 501,
          status: 'active',
          llmProviderConfigs: [{
            id: 701,
            provider: 'openai-compatible',
            model: 'org-coach-test',
            encryptedApiKey: 'plain:org-key',
            baseUrl: 'https://org-llm.example.test/v1',
            status: 'active'
          }]
        }
      }]
    }
  };
  const provider = new AICoachProviderService(prisma, disabledGateway());
  const viewerConfig = await provider.runtimeConfig({ userId: 101 });
  assert(viewerConfig === null, 'Viewer members must not receive organization BYOK provider routing.');
  role = 'student';
  const studentConfig = await provider.runtimeConfig({ userId: 101 });
  assert(studentConfig?.source === 'organization', 'Student members should receive organization BYOK provider routing.');
  assert(studentConfig?.apiKey === 'org-key', 'Organization BYOK provider routing must decrypt the organization key after role permission passes.');
}

testProviderRoutingUsesOrganizationRoleMatrix()
  .then(() => console.log('Organization permission matrix check passed.'))
  .catch((error) => {
    console.error(`Organization permission matrix check failed: ${error.message}`);
    process.exitCode = 1;
  });

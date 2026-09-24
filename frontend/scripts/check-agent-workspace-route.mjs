import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const sourcePath = path.resolve(import.meta.dirname, '..', 'src', 'lib', 'agent-workspace-route.ts');
const source = fs.readFileSync(sourcePath, 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 }
}).outputText;
const routeModule = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

const forbiddenLegacyPractice = routeModule.parseAgentWorkspaceRoute(
  '?conversation=qa-legacy&agentConversationId=task-context&agentArtifactId=artifact-1&agentRoundId=81&agentView=practice&agentTaskType=diagnostic&agentSubject=math'
);
assert.equal(forbiddenLegacyPractice, null, 'task workspaces must never recover context from conversation keys');

const canonicalPractice = routeModule.serializeAgentWorkspaceRoute({
  kind: 'practice',
  workspace: {
    contextId: 'task-context', artifactId: 'artifact-1', roundId: 81,
    phase: 'practice', taskType: 'diagnostic', subject: 'math'
  }
});
assert.match(canonicalPractice, /agentContextId=task-context/);
assert.doesNotMatch(canonicalPractice, /(?:^|&)(?:conversation|agentConversationId)=/);

const practiceWithTeaching = routeModule.parseAgentWorkspaceRoute(
  '?agentContextId=task-context&agentArtifactId=artifact-1&agentRoundId=81&agentView=practice&agentTeachingDeliveryId=delivery-1'
);
assert.equal(practiceWithTeaching.kind, 'practice');
assert.equal(practiceWithTeaching.teachingDeliveryId, 'delivery-1');
assert.match(routeModule.serializeAgentWorkspaceRoute(practiceWithTeaching), /agentTeachingDeliveryId=delivery-1/);

const pastPaper = routeModule.parseAgentWorkspaceRoute('?agentPastPaper=paper-1&agentQuestionId=7');
assert.deepEqual(pastPaper, { kind: 'past_paper', workspace: { slug: 'paper-1', questionId: 7 } });
assert.equal(
  routeModule.serializeAgentWorkspaceRoute({ kind: 'past_paper', workspace: { ...pastPaper.workspace, contextId: 'paper-context' } }),
  'agentPastPaper=paper-1&agentContextId=paper-context&agentQuestionId=7'
);

assert.deepEqual(
  routeModule.parseAgentWorkspaceRoute('?agentTeachingDeliveryId=delivery-2'),
  { kind: 'teaching', deliveryId: 'delivery-2' }
);
assert.equal(routeModule.parseAgentWorkspaceRoute('?agentSection=qa&conversation=subject-qa-1'), null);

console.log('Agent workspace route contract passed.');

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const sourcePath = path.resolve(import.meta.dirname, '..', 'src', 'lib', 'standalone-route-policy.ts');
const source = fs.readFileSync(sourcePath, 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 }
}).outputText;
const policy = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

assert.deepEqual(policy.resolveStandaloneLocation('/', '', ''), {
  route: 'home', pathname: '/', href: '/', shouldCanonicalize: false
});
assert.deepEqual(policy.resolveStandaloneLocation('/about/', '', '#ai'), {
  route: 'about', pathname: '/about', href: '/about#ai', shouldCanonicalize: true
});
assert.deepEqual(policy.resolveStandaloneLocation('/agent/', '?agentSection=settings', '#top'), {
  route: 'agent', pathname: '/agent', href: '/agent?agentSection=settings#top', shouldCanonicalize: true
});
assert.deepEqual(policy.resolveStandaloneLocation('/login', '?redirect=%2Fme', ''), {
  route: 'auth', pathname: '/auth', href: '/auth?redirect=%2Fme', shouldCanonicalize: true
});
assert.deepEqual(policy.resolveStandaloneLocation('/register', '?redirect=%2Fagent', ''), {
  route: 'auth', pathname: '/auth', href: '/auth?redirect=%2Fagent&mode=register', shouldCanonicalize: true
});
assert.equal(policy.resolveStandaloneHref('/removed-route?stale=1').route, 'not-found');
assert.equal(policy.resolveStandaloneHref('/removed-route?stale=1').href, '/removed-route?stale=1');
assert.equal(policy.resolveStandaloneHref('https://evil.example/agent').route, 'not-found');
assert.equal(policy.resolveStandaloneHref('/csca-mock-exam/math').href, '/agent?agentSection=progress');
assert.equal(policy.resolveStandaloneHref('/past-papers/math-2026').href, '/agent?agentSection=resources');
assert.equal(policy.resolveStandaloneHref('/csca-subjects/physics').href, '/agent?mode=free&subject=physics');
assert.equal(policy.resolveStandaloneHref('/csca-special-practice/chemistry').href, '/agent?agentSection=practice');

assert.equal(policy.safeStandaloneReturnPath('/agent?agentSection=weakness'), '/agent?agentSection=weakness');
assert.equal(policy.safeStandaloneReturnPath('/me?section=settings'), '/me?section=settings');
assert.equal(policy.safeStandaloneReturnPath('/onboarding?returnTo=%2Fagent'), '/agent');
assert.equal(policy.safeStandaloneReturnPath('/admin/users'), '/agent');
assert.equal(policy.safeStandaloneReturnPath('//evil.example/path'), '/agent');
assert.equal(policy.safeStandaloneReturnPath('https://evil.example/path'), '/agent');
assert.equal(policy.safeStandaloneReturnPath('/agent\\evil'), '/agent');
assert.equal(policy.safeStandaloneReturnPath('/agent', '/me'), '/agent');

console.log('Standalone route policy contract passed.');

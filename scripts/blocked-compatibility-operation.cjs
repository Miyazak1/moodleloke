const blocked = new Set([
  'db:backup:docker',
  'verify:ci',
  'verify:ops',
  'verify:staging',
  'verify:staging:full',
  'verify:docker:status',
  'verify:docker:staging-local',
  'verify:docker',
  'verify:release-candidate',
  'verify:release-window',
  'verify:release-window:local',
  'verify:local',
  'verify:launch',
  'verify:release'
]);

const operation = String(process.argv[2] || '').trim();
if (!blocked.has(operation)) {
  console.error('Unknown blocked compatibility operation: ' + (operation || '<empty>'));
  process.exit(2);
}

console.error([
  operation + ' is intentionally blocked in the standalone Moodlelike repository.',
  'It depends on the former CSCALite release, Docker, staging, port or database assumptions.',
  'Use local:acceptance, ci:contracts, ci:golden and the DATA_CUTOVER_CHECKLIST.md runbook.',
  'Reimplement the operation against Moodlelike contracts before restoring an executable entry.'
].join('\n'));
process.exit(2);

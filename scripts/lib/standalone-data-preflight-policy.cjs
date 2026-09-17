const criticalTables = ['_prisma_migrations', 'users', 'student_profiles', 'agent_conversations', 'agent_messages', 'agent_artifacts', 'learning_evidence_events', 'csca_questions', 'csca_adaptive_rounds', 'teaching_assets', 'past_papers'];
const acceptedLegacyUnvalidatedConstraints = new Set(['forecast_calibration_snapshots_qualified_source_check', 'ck_forecast_verified_manifest_required']);

function assessDataPreflight(snapshot) {
  const blockers = [];
  const warnings = [];
  if (Number(snapshot.serverVersionNum || 0) < 160000) blockers.push({ code: 'postgres-version', message: 'PostgreSQL 16 or newer is required for the rehearsed baseline.' });
  if (Number(snapshot.publicTableCount || 0) === 0) blockers.push({ code: 'empty-schema', message: 'No public tables were found.' });
  for (const table of snapshot.criticalTablesMissing || []) blockers.push({ code: 'missing-critical-table', table, message: 'Required Agent table is missing.' });
  if (Number(snapshot.failedMigrationCount || 0) > 0) blockers.push({ code: 'failed-migrations', count: Number(snapshot.failedMigrationCount), message: 'Unfinished Prisma migrations exist.' });
  const unvalidated = snapshot.unvalidatedConstraints || [];
  const unexpectedUnvalidated = unvalidated.filter((item) => !acceptedLegacyUnvalidatedConstraints.has(item.constraint));
  if (unexpectedUnvalidated.length) blockers.push({ code: 'unvalidated-constraints', constraints: unexpectedUnvalidated, message: 'Unexpected unvalidated constraints can hide orphaned or invalid rows.' });
  const acceptedUnvalidated = unvalidated.filter((item) => acceptedLegacyUnvalidatedConstraints.has(item.constraint));
  if (acceptedUnvalidated.length) warnings.push({ code: 'accepted-legacy-unvalidated-constraints', constraints: acceptedUnvalidated, message: 'Known legacy forecast checks remain NOT VALID by design and still constrain new writes.' });
  for (const item of snapshot.sequenceLag || []) blockers.push({ code: 'sequence-behind-data', ...item, message: 'Sequence value is behind the current column maximum.' });
  const approximateRows = snapshot.approximateRows || {};
  for (const table of ['users', 'csca_questions', 'agent_conversations']) if (Number(approximateRows[table] || 0) === 0) warnings.push({ code: 'empty-core-table', table, message: 'Core table is empty; acceptable for a new system but requires confirmation for a real migration.' });
  return { status: blockers.length ? 'blocked' : 'passed', blockers, warnings };
}

module.exports = { criticalTables, acceptedLegacyUnvalidatedConstraints, assessDataPreflight };

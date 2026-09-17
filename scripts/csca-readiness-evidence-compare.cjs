const fs = require('node:fs');
const path = require('node:path');
const { loadEnv } = require('./load-env.cjs');

loadEnv();

const root = path.resolve(__dirname, '..');
const evidenceDir = path.resolve(root, process.env.RELEASE_EVIDENCE_DIR || path.join('.tmp', 'release-evidence'));

function parseArgs(argv) {
  const result = {
    before: process.env.CSCA_READINESS_EVIDENCE_BEFORE || '',
    after: process.env.CSCA_READINESS_EVIDENCE_AFTER || '',
    allowBlocked: process.env.CSCA_READINESS_EVIDENCE_COMPARE_ALLOW_BLOCKED === '1',
    write: process.env.CSCA_READINESS_EVIDENCE_COMPARE_WRITE === '1',
    json: false
  };
  for (const arg of argv) {
    if (arg.startsWith('--before=')) result.before = arg.slice('--before='.length);
    else if (arg.startsWith('--after=')) result.after = arg.slice('--after='.length);
    else if (arg === '--allow-blocked') result.allowBlocked = true;
    else if (arg === '--write') result.write = true;
    else if (arg === '--json') result.json = true;
  }
  return result;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function resolveEvidencePath(input) {
  if (!input) return '';
  return path.resolve(root, input);
}

function findLatestEvidencePair() {
  assert(fs.existsSync(evidenceDir), `Evidence directory does not exist: ${evidenceDir}`);
  const files = fs
    .readdirSync(evidenceDir)
    .filter((name) => /^csca-readiness-(?!compare-).+\.json$/i.test(name))
    .map((name) => {
      const file = path.join(evidenceDir, name);
      return { file, mtimeMs: fs.statSync(file).mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  assert(files.length >= 2, `Need at least two csca-readiness evidence files in ${evidenceDir}`);
  return { before: files[1].file, after: files[0].file };
}

function readEvidence(file) {
  assert(fs.existsSync(file), `Evidence file does not exist: ${file}`);
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert(parsed.kind === 'csca-readiness-sampled-threshold-evidence', `${file} is not a CSCA readiness sampled-threshold evidence file`);
  return parsed;
}

function asNumber(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function checklistMap(evidence) {
  const map = new Map();
  for (const item of evidence.checklist || []) {
    if (item?.key) map.set(item.key, item);
  }
  return map;
}

function compareChecklist(before, after) {
  const beforeMap = checklistMap(before);
  const afterMap = checklistMap(after);
  const keys = new Set([...beforeMap.keys(), ...afterMap.keys()]);
  return [...keys].sort().map((key) => {
    const oldItem = beforeMap.get(key) || {};
    const newItem = afterMap.get(key) || {};
    return {
      key,
      beforeStatus: oldItem.status || 'missing',
      afterStatus: newItem.status || 'missing',
      changed: (oldItem.status || 'missing') !== (newItem.status || 'missing'),
      beforeDetail: oldItem.detail || '',
      afterDetail: newItem.detail || ''
    };
  });
}

function buildComparison(beforeFile, afterFile, before, after) {
  const beforeConclusion = before.conclusion || {};
  const afterConclusion = after.conclusion || {};
  const impactedBefore = asNumber(beforeConclusion.impactedUserSubjectCount);
  const impactedAfter = asNumber(afterConclusion.impactedUserSubjectCount);
  const maxImpact = afterConclusion.maxImpactUserSubjectCount;
  const blockingAlertsBefore = asNumber(beforeConclusion.blockingCalibrationAlertCount);
  const blockingAlertsAfter = asNumber(afterConclusion.blockingCalibrationAlertCount);
  const maxImpactExceeded = maxImpact !== null && maxImpact !== undefined && impactedAfter > asNumber(maxImpact);
  const afterHealth = afterConclusion.calibrationHealthStatus || 'unknown';
  const afterRolloutStatus = afterConclusion.rolloutStatus || 'unknown';
  const checklist = compareChecklist(before, after);
  const risks = [];
  const warnings = [];

  if (afterRolloutStatus === 'blocked') {
    risks.push('after evidence rollout status is blocked');
  }
  if (afterHealth === 'blocked' || afterHealth === 'needs_attention') {
    risks.push(`after evidence calibration health is ${afterHealth}`);
  }
  if (maxImpactExceeded) {
    risks.push(`impacted user-subject count ${impactedAfter} exceeds limit ${maxImpact}`);
  }
  if (blockingAlertsAfter > blockingAlertsBefore) {
    warnings.push(`blocking calibration alerts increased from ${blockingAlertsBefore} to ${blockingAlertsAfter}`);
  }
  if (afterConclusion.launchable === false && after.phase === 'post_rollout') {
    risks.push('post_rollout evidence is not launchable');
  }
  if (before.source !== after.source) {
    warnings.push(`evidence source changed from ${before.source} to ${after.source}`);
  }
  if (after.source === 'fixture') {
    warnings.push('after evidence is fixture mode; use live Admin API evidence for release decisions');
  }

  return {
    kind: 'csca-readiness-evidence-comparison',
    generatedAt: new Date().toISOString(),
    status: risks.length > 0 ? 'blocked' : warnings.length > 0 ? 'watching' : 'passed',
    beforeFile,
    afterFile,
    before: {
      phase: before.phase,
      source: before.source,
      generatedAt: before.generatedAt,
      rolloutStatus: beforeConclusion.rolloutStatus,
      launchable: beforeConclusion.launchable,
      mode: beforeConclusion.mode,
      impactedUserSubjectCount: impactedBefore,
      calibrationHealthStatus: beforeConclusion.calibrationHealthStatus,
      blockingCalibrationAlertCount: blockingAlertsBefore
    },
    after: {
      phase: after.phase,
      source: after.source,
      generatedAt: after.generatedAt,
      rolloutStatus: afterRolloutStatus,
      launchable: afterConclusion.launchable,
      mode: afterConclusion.mode,
      impactedUserSubjectCount: impactedAfter,
      maxImpactUserSubjectCount: maxImpact ?? null,
      calibrationHealthStatus: afterHealth,
      blockingCalibrationAlertCount: blockingAlertsAfter
    },
    deltas: {
      launchableChanged: beforeConclusion.launchable !== afterConclusion.launchable,
      modeChanged: beforeConclusion.mode !== afterConclusion.mode,
      impactedUserSubjectCountDelta: impactedAfter - impactedBefore,
      sampledReadySubjectsDelta: asNumber(afterConclusion.sampledReadySubjects) - asNumber(beforeConclusion.sampledReadySubjects),
      blockingCalibrationAlertCountDelta: blockingAlertsAfter - blockingAlertsBefore
    },
    checklist,
    risks,
    warnings
  };
}

function writeComparison(comparison) {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const file = path.join(evidenceDir, `csca-readiness-compare-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(file, `${JSON.stringify(comparison, null, 2)}\n`);
  return file;
}

function printText(comparison) {
  console.log(`CSCA readiness evidence compare: ${comparison.status}`);
  console.log(`Before: ${comparison.beforeFile}`);
  console.log(`After:  ${comparison.afterFile}`);
  console.log(`Mode: ${comparison.before.mode || 'unknown'} -> ${comparison.after.mode || 'unknown'}`);
  console.log(`Rollout: ${comparison.before.rolloutStatus || 'unknown'} -> ${comparison.after.rolloutStatus || 'unknown'}`);
  console.log(`Launchable: ${comparison.before.launchable} -> ${comparison.after.launchable}`);
  console.log(`Impact: ${comparison.before.impactedUserSubjectCount} -> ${comparison.after.impactedUserSubjectCount} (limit ${comparison.after.maxImpactUserSubjectCount ?? 'n/a'})`);
  console.log(`Calibration health: ${comparison.before.calibrationHealthStatus || 'unknown'} -> ${comparison.after.calibrationHealthStatus || 'unknown'}`);
  console.log(`Blocking alerts: ${comparison.before.blockingCalibrationAlertCount} -> ${comparison.after.blockingCalibrationAlertCount}`);
  const changedChecklist = comparison.checklist.filter((item) => item.changed);
  if (changedChecklist.length > 0) {
    console.log('Checklist changes:');
    for (const item of changedChecklist) {
      console.log(`- ${item.key}: ${item.beforeStatus} -> ${item.afterStatus}`);
    }
  }
  if (comparison.warnings.length > 0) {
    console.log('Warnings:');
    for (const warning of comparison.warnings) console.log(`- ${warning}`);
  }
  if (comparison.risks.length > 0) {
    console.log('Risks:');
    for (const risk of comparison.risks) console.log(`- ${risk}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const pair = args.before && args.after
    ? { before: resolveEvidencePath(args.before), after: resolveEvidencePath(args.after) }
    : findLatestEvidencePair();
  const comparison = buildComparison(pair.before, pair.after, readEvidence(pair.before), readEvidence(pair.after));
  const writtenFile = args.write ? writeComparison(comparison) : '';
  if (args.json) {
    console.log(JSON.stringify(comparison, null, 2));
  } else {
    printText(comparison);
    if (writtenFile) console.log(`Comparison evidence written: ${writtenFile}`);
  }
  if (comparison.status === 'blocked' && !args.allowBlocked) process.exit(1);
}

main();

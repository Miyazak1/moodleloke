#!/usr/bin/env node

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const {
  verifyDbArtifact
} = require('./csca-subject-practice-source-corpus-inventory-reconcile.cjs');

const MODE = 'subject_practice_source_corpus_dump_mirror_audit_v3';
const DOCKER_IMAGE = 'postgres:16-alpine';

function sha256(value) {
  const serialized = Buffer.isBuffer(value)
    ? value : typeof value === 'string' ? value : JSON.stringify(value);
  return crypto.createHash('sha256').update(serialized).digest('hex');
}

function text(value) {
  return String(value ?? '').trim();
}

function canonicalJsonValue(value) {
  if (Array.isArray(value)) return value.map(canonicalJsonValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalJsonValue(entry)]));
  }
  return value;
}

function decodeCopyText(value) {
  if (value === '\\N') return null;
  return String(value).replace(/\\(x[0-9a-fA-F]{1,2}|[0-7]{1,3}|.)/g, (_match, escape) => {
    if (escape.startsWith('x')) return String.fromCharCode(Number.parseInt(escape.slice(1), 16));
    if (/^[0-7]+$/.test(escape)) return String.fromCharCode(Number.parseInt(escape, 8));
    return ({ b: '\b', f: '\f', n: '\n', r: '\r', t: '\t', v: '\v', '\\': '\\' })[escape] ?? escape;
  });
}

function questionContentSha256(input) {
  return sha256(canonicalJsonValue({
    prompt: input.prompt,
    options: input.options,
    answer: input.answer,
    explanation: input.explanation
  }));
}

function workspaceFile(workspaceRoot, value, extension) {
  const root = path.resolve(workspaceRoot);
  const target = path.resolve(root, text(value));
  const relative = path.relative(root, target);
  if (!text(value) || !relative || relative === '..' || relative.startsWith(`..${path.sep}`)
    || path.isAbsolute(relative) || !target.toLowerCase().endsWith(extension) || !fs.existsSync(target)) {
    throw new Error('source_corpus_dump_audit_input_invalid_or_outside_workspace');
  }
  return target;
}

function outputJson(workspaceRoot, value) {
  const root = path.resolve(workspaceRoot);
  const target = path.resolve(root, text(value));
  const relative = path.relative(root, target);
  if (!text(value) || !relative || relative === '..' || relative.startsWith(`..${path.sep}`)
    || path.isAbsolute(relative) || !target.toLowerCase().endsWith('.json') || fs.existsSync(target)) {
    throw new Error('source_corpus_dump_audit_output_must_be_new_workspace_json');
  }
  return target;
}

function dockerPgRestore(dumpPath, args) {
  const dumpDirectory = path.dirname(dumpPath);
  const archivePath = `/dump/${path.basename(dumpPath)}`;
  const result = spawnSync('docker', [
    'run', '--rm', '-v', `${dumpDirectory}:/dump:ro`, DOCKER_IMAGE,
    'pg_restore', ...args, archivePath
  ], { encoding: 'utf8', maxBuffer: 128 * 1024 * 1024, windowsHide: true });
  if (result.status !== 0) {
    throw new Error(`source_corpus_dump_audit_pg_restore_failed:${text(result.stderr)}`);
  }
  return result.stdout;
}

function parseCopyRows(sql, tableName) {
  const lines = String(sql).split(/\r?\n/);
  const marker = `COPY public.${tableName} (`;
  const start = lines.findIndex((line) => line.startsWith(marker));
  if (start < 0) throw new Error(`source_corpus_dump_audit_copy_missing:${tableName}`);
  const header = lines[start];
  const columnText = header.slice(marker.length, header.lastIndexOf(') FROM stdin;'));
  const columns = columnText.split(',').map((column) => column.trim());
  const rows = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    if (lines[index] === '\\.') break;
    if (!lines[index]) continue;
    const values = lines[index].split('\t');
    if (values.length !== columns.length) {
      throw new Error(`source_corpus_dump_audit_copy_column_mismatch:${tableName}`);
    }
    rows.push(Object.fromEntries(columns.map((column, columnIndex) => [column, values[columnIndex]])));
  }
  return rows;
}

function dumpTimestamp(value) {
  const raw = text(value);
  if (!raw || raw === '\\N') return null;
  const isoInput = /(?:z|[+-]\d\d(?::?\d\d)?)$/i.test(raw)
    ? raw.replace(' ', 'T') : `${raw.replace(' ', 'T')}Z`;
  const timestamp = Date.parse(isoInput);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function normalizedQuestionRecordFromDump(row) {
  const prompt = decodeCopyText(row.prompt_text) ?? '';
  const optionsText = decodeCopyText(row.options);
  const answer = decodeCopyText(row.correct_answer);
  const explanation = decodeCopyText(row.explanation) ?? '';
  let options;
  try { options = optionsText ? JSON.parse(optionsText) : []; }
  catch { throw new Error(`source_corpus_dump_audit_options_json_invalid:${row.id}`); }
  return {
    id: Number(row.id),
    documentId: Number(row.document_id),
    questionNumber: text(row.question_number),
    promptHash: text(row.prompt_hash),
    correctAnswer: answer === null ? null : text(answer),
    updatedAt: dumpTimestamp(row.updated_at),
    contentSha256: questionContentSha256({ prompt, options, answer, explanation })
  };
}

function normalizedQuestionRecordFromArtifact(row) {
  const answer = row.correctAnswer === null || row.correctAnswer === undefined
    ? null : text(row.correctAnswer);
  return {
    id: Number(row.id),
    documentId: Number(row.documentId),
    questionNumber: text(row.questionNumber),
    promptHash: text(row.promptHash),
    correctAnswer: answer,
    updatedAt: new Date(row.updatedAt).toISOString(),
    contentSha256: questionContentSha256({
      prompt: text(row.promptText),
      options: row.options ?? [],
      answer,
      explanation: text(row.explanation)
    })
  };
}

function normalizedDocumentRecordFromDump(row) {
  return {
    id: Number(row.id),
    fileHash: text(row.file_hash),
    updatedAt: dumpTimestamp(row.updated_at)
  };
}

function normalizedDocumentRecordFromArtifact(row) {
  return {
    id: Number(row.id),
    fileHash: text(row.fileHash),
    updatedAt: new Date(row.updatedAt).toISOString()
  };
}

function compareRecordSets(dumpRecords, artifactRecords, fields) {
  const dumpById = new Map(dumpRecords.map((record) => [record.id, record]));
  const artifactById = new Map(artifactRecords.map((record) => [record.id, record]));
  const missingFromArtifactIds = [...dumpById.keys()].filter((id) => !artifactById.has(id)).sort((a, b) => a - b);
  const newInArtifactIds = [...artifactById.keys()].filter((id) => !dumpById.has(id)).sort((a, b) => a - b);
  const mismatchCounts = Object.fromEntries(fields.map((field) => [field, 0]));
  const mismatchIdSamples = Object.fromEntries(fields.map((field) => [field, []]));
  for (const [id, dumpRecord] of dumpById.entries()) {
    const artifactRecord = artifactById.get(id);
    if (!artifactRecord) continue;
    for (const field of fields) {
      if (dumpRecord[field] === artifactRecord[field]) continue;
      mismatchCounts[field] += 1;
      if (mismatchIdSamples[field].length < 10) mismatchIdSamples[field].push(id);
    }
  }
  const normalizedDump = [...dumpRecords].sort((left, right) => left.id - right.id);
  const normalizedArtifact = [...artifactRecords].sort((left, right) => left.id - right.id);
  const exact = !missingFromArtifactIds.length && !newInArtifactIds.length
    && Object.values(mismatchCounts).every((count) => count === 0);
  return {
    exact,
    dumpCount: dumpRecords.length,
    artifactCount: artifactRecords.length,
    missingFromArtifactCount: missingFromArtifactIds.length,
    newInArtifactCount: newInArtifactIds.length,
    mismatchCounts,
    missingFromArtifactIdSample: missingFromArtifactIds.slice(0, 10),
    newInArtifactIdSample: newInArtifactIds.slice(0, 10),
    mismatchIdSamples,
    dumpRecordSetSha256: sha256(normalizedDump),
    artifactRecordSetSha256: sha256(normalizedArtifact)
  };
}

function archiveMetadata(listOutput) {
  const createdAt = listOutput.match(/Archive created at\s+(.+)/)?.[1]?.trim() ?? null;
  const databaseName = listOutput.match(/dbname:\s+([^\r\n]+)/)?.[1]?.trim() ?? null;
  const tocEntryCount = Number(listOutput.match(/TOC Entries:\s*(\d+)/)?.[1] ?? 0);
  return { createdAt, databaseName, tocEntryCount };
}

function auditDumpMirror({ dumpPath, databaseInventory }) {
  if (!verifyDbArtifact(databaseInventory)) throw new Error('source_corpus_dump_audit_database_inventory_invalid');
  const listOutput = dockerPgRestore(dumpPath, ['-l']);
  const questionSql = dockerPgRestore(dumpPath, [
    '--data-only', '--table=csca_source_questions', '--file=-'
  ]);
  const documentSql = dockerPgRestore(dumpPath, [
    '--data-only', '--table=csca_source_documents', '--file=-'
  ]);
  const questionComparison = compareRecordSets(
    parseCopyRows(questionSql, 'csca_source_questions').map(normalizedQuestionRecordFromDump),
    databaseInventory.sourceQuestions.map(normalizedQuestionRecordFromArtifact),
    ['documentId', 'questionNumber', 'promptHash', 'correctAnswer', 'updatedAt', 'contentSha256']
  );
  const documentComparison = compareRecordSets(
    parseCopyRows(documentSql, 'csca_source_documents').map(normalizedDocumentRecordFromDump),
    databaseInventory.documents.map(normalizedDocumentRecordFromArtifact),
    ['fileHash', 'updatedAt']
  );
  const exactMirror = questionComparison.exact && documentComparison.exact;
  const payload = {
    schemaVersion: 'subject-practice-source-corpus-dump-mirror-audit-v3',
    mode: MODE,
    archive: archiveMetadata(listOutput),
    dumpFile: path.basename(dumpPath),
    dumpSizeBytes: fs.statSync(dumpPath).size,
    dumpFileSha256: sha256(fs.readFileSync(dumpPath)),
    databaseInventoryPayloadSha256: databaseInventory.payloadSha256,
    questionComparison,
    documentComparison,
    classification: exactMirror
      ? 'database_backup_mirror_not_independent_source_inventory'
      : 'database_backup_differs_from_inventory_requires_separate_snapshot_reconciliation',
    independentRemoteSourceEligible: false,
    independentRemoteSourceReason: exactMirror
      ? 'dump_matches_database_inventory_on_all_audited_identity_and_content_binding_fields'
      : 'a_database_backup_is_a_snapshot_of_the_database_source_even_when_versions_differ',
    topologyDecision: 'do_not_count_dump_as_remote_sync_source',
    formalReleaseEligible: false,
    providerImpact: 'none_no_provider_call',
    databaseImpact: 'none_dump_and_existing_artifact_read_only',
    publicationImpact: 'none_topology_audit_only'
  };
  return { ...payload, payloadSha256: sha256(payload) };
}

function preflight() {
  return {
    mode: MODE,
    status: 'preflight_only_no_docker_or_database_connection',
    executeRequired: true,
    dockerImage: DOCKER_IMAGE,
    auditedTables: ['csca_source_documents', 'csca_source_questions'],
    auditedQuestionFields: [
      'id', 'documentId', 'questionNumber', 'promptHash', 'correctAnswer', 'updatedAt',
      'prompt+options+answer+explanation content SHA-256'
    ],
    auditedDocumentFields: ['id', 'fileHash', 'updatedAt'],
    independentRemoteSourceEligible: false,
    formalReleaseEligible: false,
    providerImpact: 'none_no_provider_call',
    databaseImpact: 'none_preflight_only',
    publicationImpact: 'none'
  };
}

function runSelfTest() {
  const dump = [{ id: 1, documentId: 2, questionNumber: '3', promptHash: sha256('p'), correctAnswer: 'A', updatedAt: '2026-09-13T00:00:00.000Z', contentSha256: sha256('content') }];
  const exact = compareRecordSets(dump, [{ ...dump[0] }], [
    'documentId', 'questionNumber', 'promptHash', 'correctAnswer', 'updatedAt', 'contentSha256'
  ]);
  const changed = compareRecordSets(dump, [{ ...dump[0], correctAnswer: 'B' }], [
    'documentId', 'questionNumber', 'promptHash', 'correctAnswer', 'updatedAt', 'contentSha256'
  ]);
  const missing = compareRecordSets(dump, [], [
    'documentId', 'questionNumber', 'promptHash', 'correctAnswer', 'updatedAt', 'contentSha256'
  ]);
  const copyRows = parseCopyRows([
    'COPY public.csca_source_questions (id, document_id, question_number) FROM stdin;',
    '1\t2\t3',
    '\\.',
    ''
  ].join('\n'), 'csca_source_questions');
  const metadata = archiveMetadata([
    '; Archive created at 2026-09-10 09:58:07 UTC',
    ';     dbname: cscalite',
    '; TOC Entries: 920'
  ].join('\n'));
  const checks = {
    exactMirrorDetected: exact.exact,
    answerDriftDetected: !changed.exact && changed.mismatchCounts.correctAnswer === 1,
    missingRowDetected: !missing.exact && missing.missingFromArtifactCount === 1,
    copyParserUsesDeclaredColumns: copyRows.length === 1
      && copyRows[0].document_id === '2' && copyRows[0].question_number === '3',
    archiveMetadataParsed: metadata.databaseName === 'cscalite'
      && metadata.tocEntryCount === 920,
    preflightDoesNotRunDocker: preflight().status === 'preflight_only_no_docker_or_database_connection',
    backupNeverCountsAsIndependentRemoteSource: preflight().independentRemoteSourceEligible === false
  };
  return {
    mode: `${MODE}_self_test`,
    reportVersion: 'subject-practice-source-corpus-dump-mirror-audit-self-test-v3',
    status: Object.values(checks).every(Boolean) ? 'passed' : 'failed',
    checks,
    providerImpact: 'none_no_provider_call',
    databaseImpact: 'none_fixture_only',
    publicationImpact: 'none'
  };
}

function argValue(name) {
  return process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
}

function main() {
  if (process.argv.includes('--self-test')) return runSelfTest();
  if (!process.argv.includes('--execute')) return preflight();
  const dump = argValue('dump');
  const databaseInventoryPath = argValue('db-inventory');
  if (!dump || !databaseInventoryPath) throw new Error('source_corpus_dump_audit_dump_and_db_inventory_required');
  const workspaceRoot = process.cwd();
  const databaseInventory = JSON.parse(fs.readFileSync(
    workspaceFile(workspaceRoot, databaseInventoryPath, '.json'), 'utf8'
  ));
  const result = auditDumpMirror({
    dumpPath: workspaceFile(workspaceRoot, dump, '.dump'),
    databaseInventory
  });
  const out = argValue('out');
  if (!out) return result;
  const target = outputJson(workspaceRoot, out);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(result, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  return { ...result, outputPath: target };
}

if (require.main === module) {
  try {
    const report = main();
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (report.status === 'failed') process.exitCode = 1;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  MODE,
  parseCopyRows,
  decodeCopyText,
  compareRecordSets,
  archiveMetadata,
  auditDumpMirror,
  preflight,
  runSelfTest
};

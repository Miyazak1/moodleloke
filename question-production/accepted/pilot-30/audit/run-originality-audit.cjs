#!/usr/bin/env node

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const workspaceRoot = path.resolve(__dirname, '../../../..');
require(path.join(workspaceRoot, 'backend/node_modules/ts-node')).register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', moduleResolution: 'node' }
});
require(path.join(workspaceRoot, 'scripts/load-env.cjs')).loadEnv(workspaceRoot);

const { PrismaClient, Prisma } = require(path.join(workspaceRoot, 'backend/node_modules/@prisma/client'));
const {
  buildSubjectPracticeStructuredSourceQuestionRevision,
  evaluateSubjectPracticeCandidateOutputNovelty,
  SUBJECT_PRACTICE_CANDIDATE_OUTPUT_NOVELTY_POLICY_VERSION
} = require(path.join(workspaceRoot, 'backend/src/ai-questioning/subject-practice-candidate-output-novelty-policy'));

const OUTPUT_JSON = path.join(__dirname, 'originality-audit.json');
const OUTPUT_MD = path.join(__dirname, 'originality-audit.md');
const PLAN_PATH = path.join(workspaceRoot, 'question-production/accepted/pilot-30/selection-plan.json');
const SUBJECTS = ['math', 'physics', 'chemistry'];

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => [key, canonical(entry)]));
  }
  return value;
}

function canonicalJson(value) {
  return JSON.stringify(canonical(value));
}

function relative(file) {
  return path.relative(workspaceRoot, file).replace(/\\/g, '/');
}

function text(value) {
  return String(value ?? '').trim();
}

function asOptions(value) {
  if (!Array.isArray(value)) return [];
  return value.map((entry, index) => typeof entry === 'string'
    ? { id: String.fromCharCode(65 + index), text: entry }
    : { id: text(entry?.id) || String.fromCharCode(65 + index), text: text(entry?.text ?? entry?.content) });
}

function candidateShape(row) {
  return {
    subject: text(row.subject).toLowerCase(),
    topicId: row.topicId ?? null,
    blueprintId: row.blueprintId ?? null,
    sourceType: row.sourceType ?? 'ai',
    designedDifficulty: row.designedDifficulty ?? 'unknown',
    questionType: row.questionType ?? 'single_choice',
    prompt: text(row.prompt ?? row.promptText),
    options: asOptions(row.options),
    correctAnswer: text(row.correctAnswer ?? row.answer),
    explanation: text(row.explanation),
    knowledgeTags: Array.isArray(row.knowledgeTags) ? row.knowledgeTags : [],
    optionMetadata: Array.isArray(row.optionMetadata) ? row.optionMetadata : [],
    localizations: row.localizations ?? row.generationMetadata?.localizations ?? null,
    syllabusVersion: row.syllabusVersion ?? 'unknown'
  };
}

function walk(dir, accept, output = []) {
  if (!fs.existsSync(dir)) return output;
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) {
      if (item.name !== 'node_modules' && item.name !== '.git' && full !== __dirname) walk(full, accept, output);
    } else if (accept(full)) output.push(full);
  }
  return output;
}

function loadSelection() {
  const plan = JSON.parse(fs.readFileSync(PLAN_PATH, 'utf8'));
  const selected = plan.candidates.map((entry) => {
    const file = path.join(workspaceRoot, 'question-production/batches', entry.batch, 'sealed', `${entry.candidateId}.json`);
    if (!fs.existsSync(file)) throw new Error(`selected_candidate_missing:${entry.candidateId}`);
    const raw = fs.readFileSync(file, 'utf8');
    const data = JSON.parse(raw);
    if (data.candidateId !== entry.candidateId) throw new Error(`selected_candidate_id_mismatch:${entry.candidateId}`);
    return { ...data, _batch: entry.batch, _file: file, _rawSha256: sha256(raw) };
  });
  if (selected.length !== 30) throw new Error(`selection_count_expected_30_actual_${selected.length}`);
  return { plan, selected };
}

function sourceQuestionFields(question) {
  return {
    prompt: question.prompt ?? question.promptText,
    options: question.options,
    answer: question.correctAnswer ?? question.answer,
    explanation: question.explanation,
    localizations: question.localizations
  };
}

function loadLocalOfficialCorpus() {
  const docsDir = path.join(workspaceRoot, 'docs');
  const files = fs.readdirSync(docsDir)
    .filter((name) => /-source\.json$/i.test(name) && name !== 'csca-past-paper-source-json-template.json')
    .map((name) => path.join(docsDir, name)).sort();
  const revisions = [];
  const inventory = [];
  for (const file of files) {
    const raw = fs.readFileSync(file, 'utf8');
    const parsed = JSON.parse(raw);
    const document = parsed.document ?? {};
    const included = document.usagePolicy?.allowSimilarityCheck !== false;
    const questions = included && Array.isArray(parsed.questions) ? parsed.questions : [];
    const subject = text(document.subject).toLowerCase() || 'unknown';
    const language = text(document.language).toLowerCase() || 'unknown';
    const documentIdentityHash = text(document.sourceHash) || sha256(canonicalJson({
      subject, language, sourceType: document.sourceType, title: document.title,
      examYear: document.examYear, examSession: document.examSession, sourceLabel: document.sourceLabel
    }));
    for (let index = 0; index < questions.length; index += 1) {
      const question = questions[index];
      const revision = buildSubjectPracticeStructuredSourceQuestionRevision({
        sourceSystem: 'local_file', documentId: relative(file),
        questionOrdinal: text(question.questionNumber) || String(index + 1), subject, language,
        ...sourceQuestionFields(question), documentIdentityHash
      });
      revisions.push({ ...revision, _locator: { file: relative(file), questionOrdinal: text(question.questionNumber) || String(index + 1) } });
    }
    inventory.push({
      file: relative(file), fileSha256: sha256(raw), subject, language,
      sourceType: text(document.sourceType) || 'unknown', included, questionCount: questions.length
    });
  }
  return { files, revisions, inventory };
}

function loadRepositoryCandidateCorpus(selectedIds, selectedBatches) {
  const files = walk(path.join(workspaceRoot, 'question-production/batches'),
    (file) => /[\\/]sealed[\\/]CQ-[^\\/]+\.json$/i.test(file));
  const revisions = [];
  const inventory = [];
  for (const file of files.sort()) {
    let parsed;
    try { parsed = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { continue; }
    if (!parsed?.candidateId || !SUBJECTS.includes(text(parsed.subject).toLowerCase())) continue;
    const rel = relative(file);
    const batch = rel.split('/')[2] ?? 'unknown';
    const selectedInstance = selectedIds.has(parsed.candidateId)
      && rel.includes(`/sealed/${parsed.candidateId}.json`);
    const selectedSourceBatch = selectedBatches.has(batch);
    inventory.push({
      file: rel, batch, candidateId: parsed.candidateId, subject: parsed.subject,
      selectedInstance, selectedSourceBatch,
      excludedReason: selectedSourceBatch ? 'selection_plan_source_batch' : selectedInstance ? 'selected_candidate_self' : null
    });
    if (selectedSourceBatch || selectedInstance) continue;
    const revision = buildSubjectPracticeStructuredSourceQuestionRevision({
      sourceSystem: 'repository_candidate', documentId: rel, questionOrdinal: parsed.candidateId,
      subject: parsed.subject, language: 'multi', prompt: parsed.prompt, options: parsed.options,
      answer: parsed.correctAnswer, explanation: parsed.explanation, localizations: parsed.localizations,
      documentIdentityHash: sha256(rel),
      canonicalTaskParameterFingerprint: taskFingerprint(parsed)
    });
    revisions.push({ ...revision, _locator: { file: rel, batch, candidateId: parsed.candidateId } });
  }
  return { files, revisions, inventory };
}

function taskObject(candidate) {
  return candidate?.generationMetadata?.deterministicVerification?.solver?.canonicalTask
    ?? candidate?.generationMetadata?.deterministicVerification?.oracle?.canonicalTask
    ?? null;
}

function taskFingerprint(candidate) {
  const task = taskObject(candidate);
  return task ? sha256(canonicalJson(task)) : null;
}

function templateKey(candidate) {
  const task = taskObject(candidate) ?? {};
  const family = text(candidate.questionPlan?.taskFamily ?? candidate.generationMetadata?.family ?? 'unknown');
  let subtype = text(task.kind ?? task.relationKind ?? '');
  if (candidate.subject === 'math' && family === 'elementary_function_direct_property') {
    subtype = [subtype || 'elementary', text(task.model?.kind), text(task.propertyTarget)].join(':');
  }
  return [candidate.subject, family, subtype || 'unspecified'].join('|');
}

function promptHash(candidate) {
  return sha256(text(candidate.prompt).normalize('NFKC').toLowerCase().replace(/\s+/g, ''));
}

function contentHash(candidate) {
  return sha256(canonicalJson({
    prompt: text(candidate.prompt).normalize('NFKC'),
    options: asOptions(candidate.options).map((option) => text(option.text).normalize('NFKC'))
  }));
}

function policyEvidence(candidate, revisions) {
  const subjectRevisions = revisions.filter((revision) => text(revision.subject).toLowerCase() === candidate.subject);
  const evidence = evaluateSubjectPracticeCandidateOutputNovelty({
    candidate: candidateShape(candidate),
    candidateCanonicalTaskParameterFingerprint: taskFingerprint(candidate),
    sourceRevisions: subjectRevisions
  });
  const locators = new Map(subjectRevisions.map((revision) => [revision.sourceQuestionRevisionId, revision._locator]));
  return {
    status: evidence.status,
    reasonCodes: evidence.reasonCodes,
    scannedRevisionCount: evidence.scannedRevisionCount,
    blockedRevisionCount: evidence.blockedRevisionCount,
    ambiguousRevisionCount: evidence.ambiguousRevisionCount,
    revisionMatchSetSha256: evidence.revisionMatchSetSha256,
    strongestMatch: evidence.strongestSourceRevisionMatch ? {
      sourceQuestionRevisionId: evidence.strongestSourceRevisionMatch.sourceQuestionRevisionId,
      locator: locators.get(evidence.strongestSourceRevisionMatch.sourceQuestionRevisionId) ?? null,
      status: evidence.strongestSourceRevisionMatch.status,
      reasonCodes: evidence.strongestSourceRevisionMatch.reasonCodes,
      matchedFieldMask: evidence.strongestSourceRevisionMatch.matchedFieldMask,
      exactOptionMatchCount: evidence.strongestSourceRevisionMatch.exactOptionMatchCount,
      normalizedPromptSimilarity: evidence.strongestSourceRevisionMatch.normalizedPromptSimilarity ?? null
    } : null
  };
}

function selectedTemplateClusters(selected) {
  const groups = new Map();
  for (const candidate of selected) {
    const key = templateKey(candidate);
    const list = groups.get(key) ?? [];
    list.push(candidate.candidateId);
    groups.set(key, list);
  }
  return Array.from(groups.entries()).filter(([, ids]) => ids.length > 1)
    .map(([key, ids]) => ({ templateKey: key, size: ids.length, candidateIds: ids.sort() }))
    .sort((a, b) => b.size - a.size || a.templateKey.localeCompare(b.templateKey));
}

function seedInventory(selected) {
  const files = walk(workspaceRoot, (file) => /seed/i.test(path.basename(file)) && /\.(cjs|mjs|js|ts|json)$/i.test(file));
  return files.sort().map((file) => {
    const raw = fs.readFileSync(file, 'utf8');
    const exactPromptCandidateIds = selected.filter((candidate) => raw.includes(candidate.prompt)).map((candidate) => candidate.candidateId);
    return { file: relative(file), fileSha256: sha256(raw), exactPromptCandidateIds };
  });
}

async function loadDatabaseCorpus() {
  if (!text(process.env.DATABASE_URL)) return { status: 'not_configured', error: 'DATABASE_URL_missing' };
  const prisma = new PrismaClient();
  try {
    return await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      const documents = await tx.$queryRaw(Prisma.sql`
        SELECT d."id", d."subject", d."source_type" AS "sourceType", d."language",
               d."status", d."file_hash" AS "fileHash", d."updated_at" AS "updatedAt"
        FROM "csca_source_documents" d ORDER BY d."id" ASC
      `);
      const sourceRows = await tx.$queryRaw(Prisma.sql`
        SELECT q."id", q."document_id" AS "documentId", q."question_number" AS "questionNumber",
               q."subject", q."language", q."prompt_text" AS "promptText", q."options",
               q."correct_answer" AS "correctAnswer", q."explanation"
        FROM "csca_source_questions" q
        JOIN "csca_source_documents" d ON d."id" = q."document_id"
        WHERE d."status" = 'active'
        ORDER BY q."document_id" ASC, q."id" ASC
      `);
      const questionRows = await tx.$queryRaw(Prisma.sql`
        SELECT q."id", q."subject", q."topic_id" AS "topicId", q."blueprint_id" AS "blueprintId",
               q."source_type" AS "sourceType", q."designed_difficulty" AS "designedDifficulty",
               q."question_type" AS "questionType", q."prompt", q."options",
               q."correct_answer" AS "correctAnswer", q."explanation",
               q."knowledge_tags" AS "knowledgeTags", q."option_metadata" AS "optionMetadata",
               q."syllabus_version" AS "syllabusVersion", q."generation_metadata" AS "generationMetadata"
        FROM "csca_questions" q ORDER BY q."id" ASC
      `);
      const styleProfiles = await tx.$queryRaw(Prisma.sql`
        SELECT p."id", p."subject", p."scope_type" AS "scopeType", p."sample_size" AS "sampleSize",
               p."confidence", p."status", p."source_question_snapshot_hash" AS "sourceQuestionSnapshotHash"
        FROM "csca_question_style_profiles" p ORDER BY p."id" ASC
      `);
      const seriesProfiles = await tx.$queryRaw(Prisma.sql`
        SELECT p."id", p."subject", p."sample_size" AS "sampleSize", p."confidence", p."status"
        FROM "csca_exam_series_profiles" p ORDER BY p."id" ASC
      `);
      const generationProfiles = await tx.$queryRaw(Prisma.sql`
        SELECT p."id", p."subject", p."use_case" AS "useCase", p."sample_size" AS "sampleSize",
               p."confidence", p."status"
        FROM "csca_generation_profiles" p ORDER BY p."id" ASC
      `);
      const sourceRevisions = sourceRows.map((row) => ({
        ...buildSubjectPracticeStructuredSourceQuestionRevision({
          sourceSystem: 'production_database', documentId: String(row.documentId),
          questionOrdinal: text(row.questionNumber) || String(row.id), subject: row.subject,
          language: row.language, prompt: row.promptText, options: row.options,
          answer: row.correctAnswer, explanation: row.explanation
        }),
        _locator: { table: 'csca_source_questions', id: String(row.id), documentId: String(row.documentId), questionNumber: text(row.questionNumber) || null }
      }));
      const questionRevisions = questionRows.map((row) => {
        const shaped = candidateShape(row);
        return {
          ...buildSubjectPracticeStructuredSourceQuestionRevision({
            sourceSystem: 'production_database_existing_question', documentId: 'csca_questions',
            questionOrdinal: String(row.id), subject: row.subject, language: 'multi',
            prompt: row.prompt, options: row.options, answer: row.correctAnswer,
            explanation: row.explanation, localizations: row.generationMetadata?.localizations,
            documentIdentityHash: sha256(`csca_questions:${row.id}`),
            canonicalTaskParameterFingerprint: taskFingerprint({ ...shaped, generationMetadata: row.generationMetadata })
          }),
          _locator: { table: 'csca_questions', id: String(row.id), sourceType: text(row.sourceType) || null },
          _promptHash: promptHash(shaped), _contentHash: contentHash(shaped)
        };
      });
      return {
        status: 'connected_read_only', transactionMode: 'repeatable_read_read_only',
        documentCount: documents.length,
        activeDocumentCount: documents.filter((row) => row.status === 'active').length,
        sourceDocumentTypeCounts: countBy(documents, (row) => `${text(row.subject).toLowerCase()}:${text(row.sourceType).toLowerCase()}:${text(row.status).toLowerCase()}`),
        activeSourceQuestionCount: sourceRows.length,
        existingQuestionCount: questionRows.length,
        styleProfileCount: styleProfiles.length,
        activeStyleProfileCount: styleProfiles.filter((row) => row.status === 'active').length,
        styleProfileStatusCounts: countBy(styleProfiles, (row) => `${text(row.subject).toLowerCase()}:${text(row.status).toLowerCase()}`),
        examSeriesProfileCount: seriesProfiles.length,
        generationProfileCount: generationProfiles.length,
        sourceRevisions, questionRevisions
      };
    }, { isolationLevel: 'RepeatableRead' });
  } catch (error) {
    return { status: 'failed', error: error instanceof Error ? error.message : String(error) };
  } finally {
    await prisma.$disconnect();
  }
}

function countBy(items, keyOf) {
  const result = {};
  for (const item of items) {
    const key = keyOf(item);
    result[key] = (result[key] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(result).sort(([a], [b]) => a.localeCompare(b)));
}

function statusSummary(results) {
  const output = {};
  for (const subject of SUBJECTS) output[subject] = { clear: 0, ambiguous: 0, blocked: 0 };
  for (const result of results) output[result.subject][result.status] += 1;
  return output;
}

function dimensionSummary(results) {
  const dimensions = ['withinSelection', 'officialSources', 'databaseExistingQuestions', 'priorRepositoryCandidates'];
  return Object.fromEntries(dimensions.map((dimension) => [dimension,
    Object.fromEntries(SUBJECTS.map((subject) => [subject, {
      clear: results.filter((item) => item.subject === subject && item.classificationDimensions[dimension] === 'clear').length,
      ambiguous: results.filter((item) => item.subject === subject && item.classificationDimensions[dimension] === 'ambiguous').length,
      blocked: results.filter((item) => item.subject === subject && item.classificationDimensions[dimension] === 'blocked').length
    }]))
  ]));
}

function markdown(report) {
  const lines = [];
  lines.push('# Pilot-30 题库原创性与重复碰撞审计');
  lines.push('');
  lines.push(`- 审计时间：${report.generatedAt}`);
  lines.push(`- 选择计划：\`${report.selectionPlan.path}\`（SHA-256: \`${report.selectionPlan.sha256}\`）`);
  lines.push(`- 结论性质：${report.formalQualificationEligible ? '可用于正式资格判定' : '只读、非正式资格判定；不得据此直接发布'}`);
  lines.push(`- Provider：未调用；数据库：${report.coverage.database.status}`);
  lines.push('');
  lines.push('## 数量结论');
  lines.push('');
  lines.push('| 科目 | clear | ambiguous | blocked |');
  lines.push('|---|---:|---:|---:|');
  for (const subject of SUBJECTS) {
    const c = report.summary.bySubject[subject];
    lines.push(`| ${subject} | ${c.clear} | ${c.ambiguous} | ${c.blocked} |`);
  }
  lines.push('');
  lines.push('说明：远程同步源清单未访问、语料拓扑完整性未获证明，所以没有碰撞证据的题也按 `ambiguous`，不误报为 `clear`。已确认仅换数字/场景/名词的题内同构簇按 `blocked`。');
  lines.push('`overall` 与四个证据维度分开保存：题内 30 题、官方源、数据库正式题、此前仓库候选记录不会互相混称。');
  lines.push('');
  lines.push('### 分维度统计');
  lines.push('');
  lines.push('| 维度 | 科目 | clear | ambiguous | blocked |');
  lines.push('|---|---|---:|---:|---:|');
  const labels = {
    withinSelection: '题内 30 题', officialSources: '官方源（含覆盖不完整性）',
    databaseExistingQuestions: '数据库现有题', priorRepositoryCandidates: '此前仓库候选'
  };
  for (const [dimension, subjects] of Object.entries(report.summary.byDimensionAndSubject)) {
    for (const subject of SUBJECTS) {
      const c = subjects[subject];
      lines.push(`| ${labels[dimension]} | ${subject} | ${c.clear} | ${c.ambiguous} | ${c.blocked} |`);
    }
  }
  lines.push('');
  lines.push('## 题内模板重复');
  lines.push('');
  for (const cluster of report.intraSelection.templateClusters) {
    lines.push(`- \`${cluster.templateKey}\`：${cluster.size} 题（${cluster.candidateIds.join('、')}）`);
  }
  lines.push('');
  lines.push('## 逐题结论');
  lines.push('');
  lines.push('| 题号 | 科目 | 状态 | 主要理由 |');
  lines.push('|---|---|---|---|');
  for (const item of report.questions) {
    lines.push(`| ${item.candidateId} | ${item.subject} | ${item.status} | ${item.reasonCodes.join('；')} |`);
  }
  lines.push('');
  lines.push('## 覆盖范围');
  lines.push('');
  lines.push(`- 本地官方/预测 source JSON：${report.coverage.localOfficial.sourceFileCount} 份，${report.coverage.localOfficial.questionCount} 题；按科目 ${JSON.stringify(report.coverage.localOfficial.subjectCounts)}。已扫描 prompt/options/answer/explanation/localizations。`);
  lines.push(`- 仓库 sealed 候选：登记 ${report.coverage.repositoryCandidates.inventoryCount} 份；排除 selection plan 涉及的整个源批次（${report.coverage.repositoryCandidates.excludedSourceBatches.join('、')}，共 ${report.coverage.repositoryCandidates.excludedSourceBatchCandidateCount} 份）及候选自身后，将其余 ${report.coverage.repositoryCandidates.scannedRevisionCount} 份作为“此前批次候选记录”扫描。该层不等同于正式题库。`);
  lines.push(`- 种子/seed 文件：只读盘点 ${report.coverage.seedFiles.fileCount} 份，并检查选中题 prompt 的逐字出现；命中文件 ${report.coverage.seedFiles.filesWithExactPromptHits} 份。`);
  if (report.coverage.database.status === 'connected_read_only') {
    lines.push(`- 数据库：实际连通；在 Repeatable Read + SET TRANSACTION READ ONLY 事务内读取 ${report.coverage.database.activeSourceQuestionCount} 条 active source question、${report.coverage.database.existingQuestionCount} 条 csca_questions，并盘点 ${report.coverage.database.styleProfileCount} 条 style profile（active ${report.coverage.database.activeStyleProfileCount} 条）、${report.coverage.database.examSeriesProfileCount} 条 series profile、${report.coverage.database.generationProfileCount} 条 generation profile。`);
  } else {
    lines.push(`- 数据库：未取得数据（${report.coverage.database.status}：${report.coverage.database.error ?? '无详情'}）。`);
  }
  lines.push('- 远程/外部：未访问；未同步远程 source inventory，也未进行互联网检索。');
  lines.push('');
  lines.push('## 限制');
  lines.push('');
  for (const limitation of report.limitations) lines.push(`- ${limitation}`);
  lines.push('');
  lines.push('## 方法');
  lines.push('');
  lines.push(`复用仓库 novelty policy \`${report.method.noveltyPolicyVersion}\`，同时计算内容哈希、prompt 哈希、canonical task 指纹和题内 template key。任何 policy blocked、逐字/内容哈希碰撞、canonical task 复刻或题内仅换参数同构簇均判 blocked；弱相似或覆盖不完整判 ambiguous。`);
  lines.push('');
  return `${lines.join('\n')}\n`;
}

async function main() {
  const generatedAt = new Date().toISOString();
  const { plan, selected } = loadSelection();
  const selectedIds = new Set(selected.map((candidate) => candidate.candidateId));
  const selectedBatches = new Set(plan.candidates.map((candidate) => candidate.batch));
  const localOfficial = loadLocalOfficialCorpus();
  const repositoryCandidates = loadRepositoryCandidateCorpus(selectedIds, selectedBatches);
  const seeds = seedInventory(selected);
  const database = await loadDatabaseCorpus();
  const clusters = selectedTemplateClusters(selected);
  const clusterById = new Map();
  for (const cluster of clusters) for (const id of cluster.candidateIds) clusterById.set(id, cluster);

  const questions = selected.map((candidate) => {
    const localOfficialEvidence = policyEvidence(candidate, localOfficial.revisions);
    const repositoryCandidateEvidence = policyEvidence(candidate, repositoryCandidates.revisions);
    const dbOfficialEvidence = database.status === 'connected_read_only'
      ? policyEvidence(candidate, database.sourceRevisions) : null;
    const dbExistingQuestionEvidence = database.status === 'connected_read_only'
      ? policyEvidence(candidate, database.questionRevisions) : null;
    const cluster = clusterById.get(candidate.candidateId) ?? null;
    const exactRepositoryHits = repositoryCandidates.revisions.filter((revision) =>
      revision.subject === candidate.subject && (
        revision.canonicalTaskParameterFingerprint && revision.canonicalTaskParameterFingerprint === taskFingerprint(candidate)
      )).map((revision) => revision._locator);
    const exactDbHits = database.status === 'connected_read_only'
      ? database.questionRevisions.filter((revision) => revision.subject === candidate.subject && (
          revision._promptHash === promptHash(candidate) || revision._contentHash === contentHash(candidate)
        )).map((revision) => revision._locator) : [];

    const blocking = [];
    if (cluster) blocking.push('intra_selection_rename_number_or_noun_template_cluster');
    if (localOfficialEvidence.status === 'blocked') blocking.push('local_official_source_policy_blocked');
    if (repositoryCandidateEvidence.status === 'blocked') blocking.push('repository_candidate_policy_blocked');
    if (dbOfficialEvidence?.status === 'blocked') blocking.push('database_official_source_policy_blocked');
    if (dbExistingQuestionEvidence?.status === 'blocked') blocking.push('database_existing_question_policy_blocked');
    if (exactRepositoryHits.length) blocking.push('repository_canonical_task_exact_collision');
    if (exactDbHits.length) blocking.push('database_exact_prompt_or_content_collision');

    const ambiguity = [];
    if ([localOfficialEvidence, repositoryCandidateEvidence, dbOfficialEvidence, dbExistingQuestionEvidence]
      .filter(Boolean).some((evidence) => evidence.status === 'ambiguous')) ambiguity.push('similarity_signal_requires_human_review');
    if (database.status !== 'connected_read_only') ambiguity.push('database_coverage_unavailable');
    ambiguity.push('remote_source_inventory_not_accessed');
    ambiguity.push('source_corpus_topology_completeness_not_proven');
    const status = blocking.length ? 'blocked' : ambiguity.length ? 'ambiguous' : 'clear';
    const officialSourcesStatus = localOfficialEvidence.status === 'blocked' || dbOfficialEvidence?.status === 'blocked'
      ? 'blocked' : 'ambiguous';
    const databaseExistingQuestionsStatus = database.status !== 'connected_read_only'
      ? 'ambiguous' : dbExistingQuestionEvidence.status;
    return {
      candidateId: candidate.candidateId, subject: candidate.subject, batch: candidate._batch,
      sourceFile: relative(candidate._file), sourceFileSha256: candidate._rawSha256,
      status, reasonCodes: [...blocking, ...ambiguity],
      classificationDimensions: {
        withinSelection: cluster ? 'blocked' : 'clear',
        officialSources: officialSourcesStatus,
        databaseExistingQuestions: databaseExistingQuestionsStatus,
        priorRepositoryCandidates: repositoryCandidateEvidence.status
      },
      fingerprints: {
        promptSha256: promptHash(candidate), contentSha256: contentHash(candidate),
        canonicalTaskSha256: taskFingerprint(candidate), templateKey: templateKey(candidate)
      },
      intraSelection: cluster ? { status: 'blocked', ...cluster } : { status: 'clear', templateCluster: null },
      evidence: { localOfficial: localOfficialEvidence, repositoryCandidates: repositoryCandidateEvidence,
        databaseOfficial: dbOfficialEvidence, databaseExistingQuestions: dbExistingQuestionEvidence,
        exactRepositoryCanonicalTaskHits: exactRepositoryHits, exactDatabasePromptOrContentHits: exactDbHits }
    };
  });

  const dbCoverage = database.status === 'connected_read_only' ? {
    status: database.status, transactionMode: database.transactionMode,
    documentCount: database.documentCount, activeDocumentCount: database.activeDocumentCount,
    activeSourceQuestionCount: database.activeSourceQuestionCount,
    existingQuestionCount: database.existingQuestionCount,
    sourceDocumentTypeCounts: database.sourceDocumentTypeCounts,
    styleProfileCount: database.styleProfileCount,
    activeStyleProfileCount: database.activeStyleProfileCount,
    styleProfileStatusCounts: database.styleProfileStatusCounts,
    examSeriesProfileCount: database.examSeriesProfileCount,
    generationProfileCount: database.generationProfileCount
  } : { status: database.status, error: database.error };

  const report = {
    schemaVersion: 'cscalite-pilot-30-originality-audit-v1', generatedAt,
    mode: 'read_only_originality_and_collision_audit',
    selectionPlan: { path: relative(PLAN_PATH), sha256: sha256(fs.readFileSync(PLAN_PATH, 'utf8')), selectionId: plan.selectionId, candidateCount: selected.length },
    summary: {
      bySubject: statusSummary(questions), overall: countBy(questions, (item) => item.status),
      byDimensionAndSubject: dimensionSummary(questions)
    },
    intraSelection: { templateClusters: clusters, clusteredCandidateCount: new Set(clusters.flatMap((cluster) => cluster.candidateIds)).size },
    coverage: {
      localOfficial: {
        status: 'scanned_partial', sourceFileCount: localOfficial.inventory.length,
        questionCount: localOfficial.revisions.length,
        subjectCounts: countBy(localOfficial.revisions, (revision) => revision.subject),
        languageCounts: countBy(localOfficial.inventory.flatMap((item) => Array(item.questionCount).fill(item.language)), (language) => language),
        sourceTypeCounts: countBy(localOfficial.inventory.flatMap((item) => Array(item.questionCount).fill(item.sourceType)), (sourceType) => sourceType),
        inventory: localOfficial.inventory
      },
      repositoryCandidates: {
        status: 'scanned', inventoryCount: repositoryCandidates.inventory.length,
        excludedSourceBatches: Array.from(selectedBatches).sort(),
        excludedSourceBatchCandidateCount: repositoryCandidates.inventory.filter((item) => item.selectedSourceBatch).length,
        scannedRevisionCount: repositoryCandidates.revisions.length,
        subjectCounts: countBy(repositoryCandidates.revisions, (revision) => revision.subject)
      },
      seedFiles: {
        status: 'inventory_and_exact_prompt_scan_only', fileCount: seeds.length,
        filesWithExactPromptHits: seeds.filter((item) => item.exactPromptCandidateIds.length).length,
        inventory: seeds
      },
      database: dbCoverage,
      remote: { status: 'not_accessed', sourceInventorySynced: false, internetSearchPerformed: false }
    },
    method: {
      noveltyPolicyVersion: SUBJECT_PRACTICE_CANDIDATE_OUTPUT_NOVELTY_POLICY_VERSION,
      localSourceCorpusMechanismReused: 'scripts/csca-subject-practice-source-corpus-scan.cjs corpus discovery semantics',
      databaseSafety: 'Prisma transaction, RepeatableRead, SET TRANSACTION READ ONLY, in-memory evaluation',
      additionalFingerprints: ['sha256_prompt', 'sha256_prompt_plus_options', 'sha256_canonical_task', 'structured_template_key']
    },
    limitations: [
      '本地 source JSON 被仓库既有机制定义为 partial，不能证明覆盖全部官方真题。',
      '远程同步源清单和互联网均未访问；未访问的数据没有被宣称为已检查。',
      '仓库 seed 文件仅做文件清单、哈希和选中题 prompt 逐字命中检查；未把生成参数空间穷举为题库。',
      '结构 template key 是保守的确定性规则，能确认同一计算关系的换数/换名词簇，但不能替代语义模型或人工专家对所有潜在同构的判断。',
      'novelty policy 本身是 shadow/nonqualifying；本报告也不授权发布或入库。',
      ...(database.status === 'connected_read_only' ? [] : ['数据库连接未成功，因此数据库中的官方源题和现有题没有实际检查。'])
    ],
    safety: { providerImpact: 'none_no_provider_call', databaseImpact: database.status === 'connected_read_only' ? 'read_only' : 'none', publicationImpact: 'none' },
    formalQualificationEligible: false,
    questions
  };
  report.reportSha256 = sha256(canonicalJson({ ...report, reportSha256: undefined }));
  fs.writeFileSync(OUTPUT_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(OUTPUT_MD, markdown(report), 'utf8');
  process.stdout.write(`${JSON.stringify({
    status: 'completed', outputJson: relative(OUTPUT_JSON), outputMarkdown: relative(OUTPUT_MD),
    summary: report.summary, database: report.coverage.database,
    templateClusters: report.intraSelection.templateClusters
  }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({ status: 'failed', error: error instanceof Error ? error.stack : String(error) }, null, 2)}\n`);
  process.exitCode = 1;
});

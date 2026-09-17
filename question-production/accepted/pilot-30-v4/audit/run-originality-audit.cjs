#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../../..');
require(path.join(root, 'backend/node_modules/ts-node')).register({ transpileOnly: true, compilerOptions: { module: 'commonjs', moduleResolution: 'node' } });
require(path.join(root, 'scripts/load-env.cjs')).loadEnv(root);
const { PrismaClient, Prisma } = require(path.join(root, 'backend/node_modules/@prisma/client'));
const { buildSubjectPracticeStructuredSourceQuestionRevision, evaluateSubjectPracticeCandidateOutputNovelty,
  SUBJECT_PRACTICE_CANDIDATE_OUTPUT_NOVELTY_POLICY_VERSION } = require(path.join(root, 'backend/src/ai-questioning/subject-practice-candidate-output-novelty-policy'));

const PLAN = path.join(root, 'question-production/accepted/pilot-30-v4/selection-plan.json');
const OUT_JSON = path.join(__dirname, 'originality-audit.json');
const OUT_MD = path.join(__dirname, 'originality-audit.md');
const subjects = ['math', 'physics', 'chemistry'];
const txt = (v) => String(v ?? '').trim();
const rel = (p) => path.relative(root, p).replace(/\\/g, '/');
const sha = (v) => crypto.createHash('sha256').update(String(v)).digest('hex');
const canonical = (v) => Array.isArray(v) ? v.map(canonical) : v && typeof v === 'object'
  ? Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, canonical(x)])) : v;
const cjson = (v) => JSON.stringify(canonical(v));
const opts = (v) => Array.isArray(v) ? v.map((x, i) => typeof x === 'string' ? { id: String.fromCharCode(65 + i), text: x }
  : { id: txt(x?.id) || String.fromCharCode(65 + i), text: txt(x?.text ?? x?.content) }) : [];

function normalized(value) { return txt(value).normalize('NFKC').toLowerCase().replace(/\s+/g, '').replace(/[，。；：！？、“”‘’（）()\[\]{}<>《》,.;:!?"'`~_]/g, ''); }
function masked(value) { return normalized(value).replace(/[−+-]?\d+(?:\.\d+)?/g, '#').replace(/[₀-₉]/g, '#'); }
function grams(value, n = 3) {
  const s = normalized(value); const out = new Set();
  if (s.length < n) { if (s) out.add(s); return out; }
  for (let i = 0; i <= s.length - n; i += 1) out.add(s.slice(i, i + n));
  return out;
}
function dice(a, b) {
  const A = grams(a), B = grams(b); if (!A.size && !B.size) return 1; if (!A.size || !B.size) return 0;
  let common = 0; for (const x of A) if (B.has(x)) common += 1;
  return 2 * common / (A.size + B.size);
}
function shape(row) {
  return { subject: txt(row.subject).toLowerCase(), topicId: row.topicId ?? null, blueprintId: row.blueprintId ?? null,
    sourceType: row.sourceType ?? 'ai', designedDifficulty: row.designedDifficulty ?? row.difficulty ?? 'unknown',
    questionType: row.questionType ?? 'single_choice', prompt: txt(row.prompt ?? row.promptText), options: opts(row.options),
    correctAnswer: txt(row.correctAnswer ?? row.answer), explanation: txt(row.explanation),
    knowledgeTags: Array.isArray(row.knowledgeTags) ? row.knowledgeTags : [], optionMetadata: Array.isArray(row.optionMetadata) ? row.optionMetadata : [],
    localizations: row.localizations ?? row.generationMetadata?.localizations ?? null, syllabusVersion: row.syllabusVersion ?? 'unknown' };
}
function promptHash(q) { return sha(normalized(q.prompt)); }
function contentHash(q) { return sha(cjson({ prompt: normalized(q.prompt), options: opts(q.options).map((x) => normalized(x.text)) })); }
function family(q) { return txt(q.questionPlan?.taskFamily ?? q.generationMetadata?.family); }
function structure(q) { return txt(q.questionPlan?.renderConstraints?.structureFingerprint); }
function canonicalInputs(q) { return q.questionPlan?.canonicalInputs ?? null; }
function taskHash(q) { const x = canonicalInputs(q); return x ? sha(cjson({ family: family(q), inputs: x })) : null; }

function loadSelected() {
  const plan = JSON.parse(fs.readFileSync(PLAN, 'utf8'));
  const list = plan.candidates.map((x) => {
    const file = path.join(root, 'question-production/batches', x.batch, 'sealed', `${x.candidateId}.json`);
    const raw = fs.readFileSync(file, 'utf8'); const q = JSON.parse(raw);
    if (q.candidateId !== x.candidateId) throw new Error(`candidate_id_mismatch:${x.candidateId}`);
    return { ...q, _file: file, _batch: x.batch, _metadataOverride: x.metadataOverride ?? null, _sha: sha(raw) };
  });
  if (list.length !== 30) throw new Error(`expected_30_got_${list.length}`);
  return { plan, list };
}

function revision(input, locator, extras = {}) {
  return { ...buildSubjectPracticeStructuredSourceQuestionRevision(input), _locator: locator, _prompt: txt(input.prompt),
    _options: opts(input.options), _explanation: txt(input.explanation), ...extras };
}
function localSources() {
  const files = fs.readdirSync(path.join(root, 'docs')).filter((x) => /-source\.json$/i.test(x) && x !== 'csca-past-paper-source-json-template.json').sort();
  const revisions = [], inventory = [];
  for (const name of files) {
    const file = path.join(root, 'docs', name), raw = fs.readFileSync(file, 'utf8'), j = JSON.parse(raw), d = j.document ?? {};
    const questions = d.usagePolicy?.allowSimilarityCheck === false ? [] : Array.isArray(j.questions) ? j.questions : [];
    const subject = txt(d.subject).toLowerCase() || 'unknown', language = txt(d.language).toLowerCase() || 'unknown';
    questions.forEach((q, i) => revisions.push(revision({ sourceSystem: 'local_file', documentId: rel(file), questionOrdinal: txt(q.questionNumber) || String(i + 1),
      subject, language, prompt: q.prompt ?? q.promptText, options: q.options, answer: q.correctAnswer ?? q.answer,
      explanation: q.explanation, localizations: q.localizations, documentIdentityHash: txt(d.sourceHash) || sha(rel(file)) },
    { kind: 'local_source', file: rel(file), questionOrdinal: txt(q.questionNumber) || String(i + 1), sourceType: txt(d.sourceType) || 'unknown' })));
    inventory.push({ file: rel(file), sha256: sha(raw), subject, language, sourceType: txt(d.sourceType) || 'unknown', questionCount: questions.length });
  }
  return { revisions, inventory };
}
function priorCandidates() {
  const dir = path.join(root, 'question-production/batches'), revisions = [], inventory = [];
  const allowedBatches = new Set(['pilot-30', 'pilot-30-v2', 'pilot-30-v3']);
  for (const batch of fs.readdirSync(dir).sort()) {
    if (!allowedBatches.has(batch)) continue;
    const sealed = path.join(dir, batch, 'sealed'); if (!fs.existsSync(sealed)) continue;
    for (const name of fs.readdirSync(sealed).filter((x) => /^CQ-.*\.json$/i.test(x)).sort()) {
      const file = path.join(sealed, name), raw = fs.readFileSync(file, 'utf8'), q = JSON.parse(raw);
      if (!subjects.includes(txt(q.subject).toLowerCase())) continue;
      inventory.push({ batch, file: rel(file), candidateId: q.candidateId, subject: q.subject, sha256: sha(raw) });
      revisions.push(revision({ sourceSystem: 'prior_repository_candidate', documentId: rel(file), questionOrdinal: q.candidateId,
        subject: q.subject, language: 'multi', prompt: q.prompt, options: q.options, answer: q.correctAnswer,
        explanation: q.explanation, localizations: q.localizations, documentIdentityHash: sha(rel(file)) },
      { kind: 'prior_candidate', batch, file: rel(file), candidateId: q.candidateId },
      { _family: family(q), _structure: structure(q), _taskHash: taskHash(q) }));
    }
  }
  return { revisions, inventory };
}

async function databaseCorpus() {
  if (!txt(process.env.DATABASE_URL)) return { status: 'not_configured', error: 'DATABASE_URL_missing' };
  const db = new PrismaClient();
  try {
    return await db.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      const sources = await tx.$queryRaw(Prisma.sql`SELECT q."id",q."document_id" AS "documentId",q."question_number" AS "questionNumber",q."subject",q."language",q."prompt_text" AS "promptText",q."options",q."correct_answer" AS "correctAnswer",q."explanation" FROM "csca_source_questions" q JOIN "csca_source_documents" d ON d."id"=q."document_id" WHERE d."status"='active' ORDER BY q."id"`);
      const questions = await tx.$queryRaw(Prisma.sql`SELECT q."id",q."subject",q."prompt",q."options",q."correct_answer" AS "correctAnswer",q."explanation",q."knowledge_tags" AS "knowledgeTags",q."generation_metadata" AS "generationMetadata",q."source_type" AS "sourceType" FROM "csca_questions" q ORDER BY q."id"`);
      const special = await tx.$queryRaw(Prisma.sql`SELECT q."id",t."subject",q."prompt",q."options",q."correct_answer" AS "correctAnswer",q."explanation",q."knowledge_tags" AS "knowledgeTags",q."localizations",q."status",q."topic_id" AS "topicId" FROM "special_practice_questions" q JOIN "special_practice_topics" t ON t."id"=q."topic_id" ORDER BY q."id"`);
      return { status: 'connected_read_only', transactionMode: 'repeatable_read_read_only',
        source: sources.map((q) => revision({ sourceSystem: 'database_active_source', documentId: String(q.documentId), questionOrdinal: txt(q.questionNumber) || String(q.id), subject: q.subject, language: q.language, prompt: q.promptText, options: q.options, answer: q.correctAnswer, explanation: q.explanation }, { kind: 'database_active_source', table: 'csca_source_questions', id: String(q.id), documentId: String(q.documentId), questionNumber: txt(q.questionNumber) || null })),
        questions: questions.map((q) => revision({ sourceSystem: 'database_question', documentId: 'csca_questions', questionOrdinal: String(q.id), subject: q.subject, language: 'multi', prompt: q.prompt, options: q.options, answer: q.correctAnswer, explanation: q.explanation, localizations: q.generationMetadata?.localizations, documentIdentityHash: sha(`csca_questions:${q.id}`) }, { kind: 'database_question', table: 'csca_questions', id: String(q.id), sourceType: txt(q.sourceType) || null })),
        special: special.map((q) => revision({ sourceSystem: 'special_practice_question', documentId: 'special_practice_questions', questionOrdinal: String(q.id), subject: q.subject, language: 'multi', prompt: q.prompt, options: q.options, answer: q.correctAnswer, explanation: q.explanation, localizations: q.localizations, documentIdentityHash: sha(`special_practice_questions:${q.id}`) }, { kind: 'special_practice_question', table: 'special_practice_questions', id: String(q.id), topicId: String(q.topicId), status: q.status })) };
    }, { isolationLevel: 'RepeatableRead' });
  } catch (e) { return { status: 'failed', error: e instanceof Error ? e.message : String(e) }; }
  finally { await db.$disconnect(); }
}

function policy(candidate, corpus) {
  const rows = corpus.filter((x) => x.subject === candidate.subject);
  const e = evaluateSubjectPracticeCandidateOutputNovelty({ candidate: shape(candidate), sourceRevisions: rows });
  const byId = new Map(rows.map((x) => [x.sourceQuestionRevisionId, x]));
  const m = e.strongestSourceRevisionMatch, row = m ? byId.get(m.sourceQuestionRevisionId) : null;
  return { status: e.status, reasonCodes: e.reasonCodes, scannedRevisionCount: e.scannedRevisionCount,
    blockedRevisionCount: e.blockedRevisionCount, ambiguousRevisionCount: e.ambiguousRevisionCount,
    revisionMatchSetSha256: e.revisionMatchSetSha256, strongestMatch: m ? { locator: row?._locator ?? null,
      status: m.status, reasonCodes: m.reasonCodes, matchedFieldMask: m.matchedFieldMask, exactOptionMatchCount: m.exactOptionMatchCount,
      promptSimilarity: row ? Number(dice(candidate.prompt, row._prompt).toFixed(4)) : null,
      numericMaskedPromptSimilarity: row ? Number(dice(masked(candidate.prompt), masked(row._prompt)).toFixed(4)) : null,
      explanationSimilarity: row ? Number(dice(candidate.explanation, row._explanation).toFixed(4)) : null } : null };
}

function closest(candidate, corpus) {
  const q = shape(candidate); let best = null;
  for (const row of corpus) {
    if (row.subject !== q.subject) continue;
    const raw = dice(q.prompt, row._prompt), skeleton = dice(masked(q.prompt), masked(row._prompt));
    const optionTexts = new Set(q.options.map((x) => normalized(x.text)).filter(Boolean));
    const optionOverlap = row._options.filter((x) => optionTexts.has(normalized(x.text))).length;
    const exactPrompt = promptHash(q) === sha(normalized(row._prompt));
    const exactContent = contentHash(q) === sha(cjson({ prompt: normalized(row._prompt), options: row._options.map((x) => normalized(x.text)) }));
    const score = exactContent ? 3 : exactPrompt ? 2.5 : raw + skeleton * 0.35 + optionOverlap * 0.04;
    if (!best || score > best._score) best = { _score: score, locator: row._locator, exactPrompt, exactContent,
      promptSimilarity: Number(raw.toFixed(4)), numericMaskedPromptSimilarity: Number(skeleton.toFixed(4)), exactOptionOverlap: optionOverlap,
      sameFamily: Boolean(family(candidate) && row._family && family(candidate) === row._family), exactCanonicalTask: Boolean(taskHash(candidate) && row._taskHash === taskHash(candidate)) };
  }
  if (!best) return null; delete best._score; return best;
}

function sourceDecision(candidate, corpus, type) {
  const p = policy(candidate, corpus), c = closest(candidate, corpus);
  const reasons = []; let status = 'clear';
  if (c?.exactPrompt || c?.exactContent) { status = 'blocked'; reasons.push(c.exactContent ? 'exact_prompt_and_option_content_duplicate' : 'exact_prompt_duplicate'); }
  else if (c && (c.promptSimilarity >= 0.82 || (c.promptSimilarity >= 0.68 && c.numericMaskedPromptSimilarity >= 0.9))) {
    status = 'blocked'; reasons.push('high_textual_and_template_similarity');
  } else if (c && (c.promptSimilarity >= 0.64 || c.numericMaskedPromptSimilarity >= 0.86)) {
    status = 'ambiguous'; reasons.push('moderate_text_or_template_similarity_requires_review');
  }
  if (type === 'prior' && c?.exactCanonicalTask && c.promptSimilarity >= 0.5) { status = 'blocked'; reasons.push('exact_canonical_task_with_material_text_similarity'); }
  const pm = p.strongestMatch;
  const policyHasMaterialCrossItemSignal = Boolean(pm && (
    (pm.matchedFieldMask.includes('prompt') && (pm.promptSimilarity ?? 0) >= 0.55)
    || (pm.matchedFieldMask.includes('explanation') && (pm.explanationSimilarity ?? 0) >= 0.55)
    || (pm.exactOptionMatchCount ?? 0) >= 3
  ));
  const policyOnlyNonCollisionDiagnostic = Boolean(pm && pm.reasonCodes.every((reason) => [
    'candidate_novelty_common_symbolic_fragment_only', 'candidate_novelty_invalid_duplicate_candidate_options'
  ].includes(reason)));
  if (p.status === 'blocked' && status === 'clear' && policyHasMaterialCrossItemSignal && !policyOnlyNonCollisionDiagnostic) {
    status = 'ambiguous'; reasons.push('novelty_policy_material_signal_below_block_threshold');
  } else if (p.status === 'blocked' && status === 'ambiguous') reasons.push('novelty_policy_block_supporting_signal');
  else if (p.status === 'ambiguous' && status === 'clear' && policyHasMaterialCrossItemSignal && !policyOnlyNonCollisionDiagnostic) {
    status = 'ambiguous'; reasons.push('novelty_policy_material_ambiguous_signal');
  }
  if (p.status !== 'clear' && status === 'clear') reasons.push('non_collision_policy_diagnostic_retained_without_status_effect');
  return { status, reasonCodes: reasons, closestMatch: c, noveltyPolicy: p };
}

function internalEvidence(selected) {
  const result = new Map(selected.map((q) => [q.candidateId, { status: 'clear', reasonCodes: [], matches: [] }]));
  const familyCounts = {};
  for (const q of selected) familyCounts[family(q)] = (familyCounts[family(q)] ?? 0) + 1;
  for (let i = 0; i < selected.length; i += 1) for (let j = i + 1; j < selected.length; j += 1) {
    const a = selected[i], b = selected[j]; if (a.subject !== b.subject) continue;
    const raw = dice(a.prompt, b.prompt), skeleton = dice(masked(a.prompt), masked(b.prompt));
    const sameFamily = Boolean(family(a) && family(a) === family(b)), sameStructure = Boolean(structure(a) && structure(a) === structure(b));
    let status = 'clear', reason = null;
    if (contentHash(a) === contentHash(b) || promptHash(a) === promptHash(b)) { status = 'blocked'; reason = 'exact_internal_duplicate'; }
    else if (raw >= 0.82 || (sameStructure && raw >= 0.68 && skeleton >= 0.9)) { status = 'blocked'; reason = 'internal_near_verbatim_parameter_or_entity_swap'; }
    else if (sameFamily && sameStructure && (raw >= 0.55 || skeleton >= 0.82)) { status = 'ambiguous'; reason = 'internal_same_family_structure_similarity'; }
    if (reason) for (const [q, other] of [[a, b], [b, a]]) {
      const e = result.get(q.candidateId); e.matches.push({ candidateId: other.candidateId, status, reason, promptSimilarity: Number(raw.toFixed(4)), numericMaskedPromptSimilarity: Number(skeleton.toFixed(4)), sameFamily, sameStructure });
      if (status === 'blocked' || e.status === 'clear') e.status = status;
      if (!e.reasonCodes.includes(reason)) e.reasonCodes.push(reason);
    }
  }
  return { byId: result, familyCounts: Object.fromEntries(Object.entries(familyCounts).filter(([, n]) => n > 1).sort(([a], [b]) => a.localeCompare(b))) };
}

function combine(parts) { if (parts.some((x) => x.status === 'blocked')) return 'blocked'; if (parts.some((x) => x.status === 'ambiguous')) return 'ambiguous'; return 'clear'; }
function counts(items, field = 'status') { const o = {}; for (const s of subjects) o[s] = { clear: 0, ambiguous: 0, blocked: 0 }; for (const x of items) o[x.subject][x[field]] += 1; return o; }
function nonClear(report) { return report.questions.filter((q) => q.status !== 'clear').map((q) => ({ candidateId: q.candidateId, subject: q.subject, status: q.status, reasons: q.reasonCodes, nearestHits: q.nearestHits })); }

function markdown(r) {
  const L = ['# Pilot-30 V4 原创性与正式题库碰撞审计', '', `- 时间：${r.generatedAt}`, `- 报告修订：${r.revision.revisionNumber}（${r.revision.reason}）`, `- 当前生产批次：${r.revision.currentProductionBatches.join('、')}`, '- Provider：未调用', `- 数据库：${r.coverage.database.status}`, '- 远程官方源未访问，仅作为覆盖限制，不自动降级题目状态。', '', '## 总体统计', '', '| 科目 | clear | ambiguous | blocked |', '|---|---:|---:|---:|'];
  for (const s of subjects) { const c = r.summary.bySubject[s]; L.push(`| ${s} | ${c.clear} | ${c.ambiguous} | ${c.blocked} |`); }
  L.push('', '## 碰撞类型拆分', '',
    `- 精确重复：${r.collisionSummary.exactDuplicateCandidateIds.length} 题（${r.collisionSummary.exactDuplicateCandidateIds.join('、') || '无'}）`,
    `- 达阈值文本近似：${r.collisionSummary.textualNearDuplicateCandidateIds.length} 题（${r.collisionSummary.textualNearDuplicateCandidateIds.join('、') || '无'}）`,
    `- 结构同构且近似达到风险阈值：${r.collisionSummary.structuralIsomorphismCandidateIds.length} 题（${r.collisionSummary.structuralIsomorphismCandidateIds.join('、') || '无'}）`,
    `- 仅 family 重复：${r.collisionSummary.familyRepeatCandidateIds.length} 题；family 重复本身不改变状态。`);
  L.push('', '## 题包内部 family 重复', '');
  const families = Object.entries(r.internal.familyCounts); if (!families.length) L.push('- 无。'); else for (const [f, n] of families) L.push(`- ${f}: ${n} 题`);
  L.push(`- 唯一性验证：数学 ${r.internal.familyValidation.math.uniqueFamilyCount}/10、物理 ${r.internal.familyValidation.physics.uniqueFamilyCount}/10、化学 ${r.internal.familyValidation.chemistry.uniqueFamilyCount}/10；结果 ${r.internal.familyValidation.allSubjectsHaveTenUniqueFamilies ? '通过' : '失败'}。`);
  L.push('', 'family/知识点相同本身不构成 blocked；判定还要求实际文本、数值遮蔽骨架或 canonical task 证据。', '', '## 所有非 clear 题', '');
  const nc = nonClear(r); if (!nc.length) L.push('- 无。');
  for (const q of nc) {
    const hits = Object.entries(q.nearestHits).filter(([, x]) => x?.locator).map(([k, x]) => `${k}=${JSON.stringify(x.locator)}(prompt=${x.promptSimilarity},masked=${x.numericMaskedPromptSimilarity})`).join('；');
    L.push(`- **${q.candidateId}** (${q.status})：${q.reasons.join('；')}。最近命中：${hits || '无可报告命中'}。`);
  }
  L.push('', '## 覆盖与限制', '', `- 本地 source corpus：${r.coverage.localSource.questionCount} 题/${r.coverage.localSource.fileCount} 文件。`,
    `- 数据库 active source questions：${r.coverage.database.activeSourceQuestionCount ?? 0}；csca_questions：${r.coverage.database.cscaQuestionCount ?? 0}；special_practice_questions：${r.coverage.database.specialPracticeQuestionCount ?? 0}。`,
    `- V1-V3 独立候选：${r.coverage.priorCandidates.questionCount} 题；已排除 V4 整批及同 candidateId 镜像。`,
    '- metadataOverride 未参与题面相似度，仅在逐题元数据中留痕。',
    '- 未访问远程/不可用官方题集；未把它描述为已检查，也未因此把无命中题自动标 ambiguous。',
    '- 确定性 n-gram/骨架阈值与仓库 shadow novelty policy 不能替代最终人工版权判断。',
    '- 本报告只读且不授权发布或入库。', '', '## 修订历史', '');
  for (const h of r.history) L.push(`- ${h.generatedAt}：selection=${h.selectionPlanSha256}，summary=${JSON.stringify(h.summary)}，report=${h.reportSha256 ?? 'n/a'}`);
  L.push('', `方法版本：${r.method.version}；仓库 novelty policy：${r.method.noveltyPolicyVersion}。`, '');
  return `${L.join('\n')}\n`;
}

async function main() {
  const generatedAt = new Date().toISOString(), { plan, list } = loadSelected();
  const previous = fs.existsSync(OUT_JSON) ? JSON.parse(fs.readFileSync(OUT_JSON, 'utf8')) : null;
  const familyValidation = Object.fromEntries(subjects.map((subject) => {
    const selected = list.filter((q) => q.subject === subject), unique = new Set(selected.map(family));
    return [subject, { candidateCount: selected.length, uniqueFamilyCount: unique.size, families: Array.from(unique).sort() }];
  }));
  familyValidation.allSubjectsHaveTenUniqueFamilies = subjects.every((subject) => familyValidation[subject].candidateCount === 10 && familyValidation[subject].uniqueFamilyCount === 10);
  if (!familyValidation.allSubjectsHaveTenUniqueFamilies) throw new Error(`final_selection_family_validation_failed:${JSON.stringify(familyValidation)}`);
  const local = localSources(), prior = priorCandidates(), db = await databaseCorpus(), internal = internalEvidence(list);
  const empty = [];
  const questions = list.map((q) => {
    const internalItem = internal.byId.get(q.candidateId);
    const parts = {
      internal: internalItem, localSource: sourceDecision(q, local.revisions, 'official'),
      databaseActiveSource: sourceDecision(q, db.status === 'connected_read_only' ? db.source : empty, 'official'),
      databaseCscaQuestions: sourceDecision(q, db.status === 'connected_read_only' ? db.questions : empty, 'formal'),
      databaseSpecialPractice: sourceDecision(q, db.status === 'connected_read_only' ? db.special : empty, 'formal'),
      priorCandidates: sourceDecision(q, prior.revisions, 'prior')
    };
    if (db.status !== 'connected_read_only') for (const k of ['databaseActiveSource', 'databaseCscaQuestions', 'databaseSpecialPractice']) parts[k] = { status: 'ambiguous', reasonCodes: ['database_unavailable'], closestMatch: null, noveltyPolicy: null };
    const status = combine(Object.values(parts));
    const reasonCodes = [...new Set(Object.entries(parts).flatMap(([k, v]) => v.status === 'clear' ? [] : v.reasonCodes.map((x) => `${k}:${x}`)))];
    const sourceParts = Object.entries(parts).filter(([k]) => k !== 'internal').map(([, v]) => v);
    const internalNearest = [...internalItem.matches].sort((a, b) => (b.promptSimilarity + b.numericMaskedPromptSimilarity) - (a.promptSimilarity + a.numericMaskedPromptSimilarity))[0] ?? null;
    const collisionKinds = {
      exactDuplicate: sourceParts.some((v) => v.closestMatch?.exactPrompt || v.closestMatch?.exactContent)
        || internalItem.reasonCodes.includes('exact_internal_duplicate'),
      textualNearDuplicate: sourceParts.some((v) => v.reasonCodes.includes('high_textual_and_template_similarity'))
        || internalItem.status === 'blocked',
      structuralIsomorphism: internalItem.matches.some((m) => m.sameStructure && m.status !== 'clear'),
      familyRepeat: (internal.familyCounts[family(q)] ?? 0) > 1
    };
    return { candidateId: q.candidateId, subject: q.subject, status, reasonCodes, sourceFile: rel(q._file), sourceFileSha256: q._sha,
      metadataOverride: q._metadataOverride, fingerprints: { promptSha256: promptHash(q), contentSha256: contentHash(q), family: family(q), structureFingerprint: structure(q), canonicalInputsSha256: taskHash(q) },
      collisionKinds, dimensions: Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, v.status])), evidence: parts,
      nearestHits: { internal: internalNearest ? { locator: { kind: 'selected_candidate', candidateId: internalNearest.candidateId }, promptSimilarity: internalNearest.promptSimilarity, numericMaskedPromptSimilarity: internalNearest.numericMaskedPromptSimilarity } : null,
        ...Object.fromEntries(Object.entries(parts).filter(([k]) => k !== 'internal').map(([k, v]) => [k, v.closestMatch])) } };
  });
  const currentSelectionSha256 = sha(fs.readFileSync(PLAN, 'utf8'));
  const previousSnapshot = previous ? { generatedAt: previous.generatedAt, selectionPlanSha256: previous.selectionPlan?.sha256 ?? null, summary: previous.summary?.overall ?? null, reportSha256: previous.reportSha256 ?? null } : null;
  const priorHistory = previous ? [...(Array.isArray(previous.history) ? previous.history : []), previousSnapshot] : [];
  const currentProductionBatches = Array.from(new Set(plan.candidates.map((q) => q.batch))).sort();
  const report = { schemaVersion: 'cscalite-pilot-30-v4-originality-audit-v1', generatedAt,
    revision: { revisionNumber: Number(previous?.revision?.revisionNumber ?? 0) + 1, reason: currentProductionBatches.includes('pilot-30-v4-repair2') ? 'final_selection_with_repair2_topic_mapping_replacement' : 'final_selection_with_blind_reviewed_repair_candidates', currentProductionBatches, supersededCandidateMirrorsExcluded: true },
    history: priorHistory,
    selectionPlan: { path: rel(PLAN), selectionId: plan.selectionId, sha256: currentSelectionSha256, candidateCount: list.length },
    summary: { bySubject: counts(questions), overall: { clear: questions.filter((q) => q.status === 'clear').length, ambiguous: questions.filter((q) => q.status === 'ambiguous').length, blocked: questions.filter((q) => q.status === 'blocked').length } },
    internal: { familyCounts: internal.familyCounts, familyValidation, parameterIsomorphicPairCount: Array.from(internal.byId.values()).reduce((n, x) => n + x.matches.length, 0) / 2, evidenceRule: 'family_same_alone_never_blocks' },
    coverage: { localSource: { status: 'scanned_local_available', fileCount: local.inventory.length, questionCount: local.revisions.length, inventory: local.inventory },
      database: db.status === 'connected_read_only' ? { status: db.status, transactionMode: db.transactionMode, activeSourceQuestionCount: db.source.length, cscaQuestionCount: db.questions.length, specialPracticeQuestionCount: db.special.length } : { status: db.status, error: db.error },
      priorCandidates: { status: 'scanned_v1_v3_only', includedBatches: ['pilot-30', 'pilot-30-v2', 'pilot-30-v3'], questionCount: prior.revisions.length, inventoryCount: prior.inventory.length, excludedCurrentProductionBatches: currentProductionBatches, excludedBatches: ['pilot-30-v4', 'pilot-30-v4-repair', 'pilot-30-v4-repair2', 'all_other_batches'] },
      remote: { status: 'not_accessed_limitation_only', affectsOtherwiseClearStatus: false } },
    method: { version: 'pilot-30-v4-originality-audit-deterministic-v1', noveltyPolicyVersion: SUBJECT_PRACTICE_CANDIDATE_OUTPUT_NOVELTY_POLICY_VERSION,
      decisionRules: { exactPromptOrContent: 'blocked', promptDiceAtLeast: 0.82, promptDiceAndMasked: [0.68, 0.9], moderatePromptOrMasked: [0.64, 0.86], knowledgeOrFamilyAlone: 'no_block' } },
    safety: { providerImpact: 'none_no_provider_call', databaseImpact: db.status === 'connected_read_only' ? 'read_only' : 'none', publicationImpact: 'none' }, formalQualificationEligible: false,
    collisionSummary: {
      exactDuplicateCandidateIds: questions.filter((q) => q.collisionKinds.exactDuplicate).map((q) => q.candidateId),
      textualNearDuplicateCandidateIds: questions.filter((q) => q.collisionKinds.textualNearDuplicate).map((q) => q.candidateId),
      structuralIsomorphismCandidateIds: questions.filter((q) => q.collisionKinds.structuralIsomorphism).map((q) => q.candidateId),
      familyRepeatCandidateIds: questions.filter((q) => q.collisionKinds.familyRepeat).map((q) => q.candidateId)
    }, questions };
  report.nonClear = nonClear(report); report.reportSha256 = sha(cjson({ ...report, reportSha256: undefined }));
  fs.writeFileSync(OUT_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf8'); fs.writeFileSync(OUT_MD, markdown(report), 'utf8');
  process.stdout.write(`${JSON.stringify({ status: 'completed', summary: report.summary, database: report.coverage.database, familyCounts: report.internal.familyCounts, nonClear: report.nonClear.map((x) => ({ id: x.candidateId, status: x.status, reasons: x.reasons })) }, null, 2)}\n`);
}
main().catch((e) => { process.stderr.write(`${JSON.stringify({ status: 'failed', error: e instanceof Error ? e.stack : String(e) }, null, 2)}\n`); process.exitCode = 1; });

#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { loadDatabaseUrl, readInventory, stable } = require('./import-accepted-pack.cjs');

const RULES = Object.freeze({
  quadratic_scale_then_vertex: ['M-FUNC-002', 'math-function-basic', '二次函数缩放与顶点属于基本初等函数。'],
  arithmetic_sequence_two_terms_then_sum: ['M-SEQ-001', 'math-sequence', '等差数列条件与求和直接属于数列。'],
  geometric_sequence_nonadjacent_then_sum: ['M-SEQ-001', 'math-sequence', '等比数列非相邻项与求和直接属于数列。'],
  inclusion_exclusion_exactly_one: ['M-SET-001', 'math-set', '容斥与恰属一个集合直接属于集合运算。'],
  probability_exactly_one_red_without_replacement: ['M-PROB-001', 'math-probability', '不放回抽样概率属于古典概型与概率计算。'],
  vector_parameter_then_norm: ['M-ALG-001', 'math-solid-vector', '向量参数与模长计算属于向量。'],
  circle_line_chord_length: ['M-GEO-001', 'math-plane-geometry', '圆与直线弦长属于平面解析几何。'],
  trig_quadrant_half_angle: ['M-FUNC-002', 'math-function-basic', '三角函数象限和半角公式属于基本初等函数。'],
  logarithmic_product_equation_with_domain: ['M-FUNC-002', 'math-function-basic', '对数方程及定义域属于基本初等函数。'],
  combined_variance_with_between_group_shift: ['M-STAT-001', 'math-probability', '合并方差属于数据数字特征；现有 Special Practice 仅有概率与统计合并主题。'],
  horizontal_projectile_landing_speed: ['P-MECH-001', 'physics-motion', '平抛落地速度属于运动学。'],
  work_energy_with_friction: ['P-MECH-004', 'physics-work-energy', '含摩擦功能关系属于功与能。'],
  perfectly_inelastic_momentum: ['P-MECH-003', 'physics-momentum', '完全非弹性碰撞直接属于动量与冲量。'],
  series_parallel_circuit_current: ['P-EM-002', 'physics-circuit', '串并联电路电流属于直流电路。'],
  electrostatic_zero_field_between_charges: ['P-EM-001', 'physics-electrostatic-field', '点电荷合场强为零属于静电场。'],
  floating_density_from_exposed_fraction: ['P-MECH-002', 'physics-force', '漂浮平衡和浮力是牛顿定律及受力平衡应用。'],
  thin_lens_magnification: ['P-OPT-001', 'physics-geometric-optics', '薄透镜成像与放大率属于几何光学。'],
  standing_wave_speed: ['P-MECH-006', 'physics-harmonic-wave', '驻波波速属于机械波。'],
  calorimetry_equilibrium: ['P-THERM-003', 'physics-thermodynamics-first-law', '量热平衡使用封闭系统能量守恒，保守归入热力学第一定律。'],
  magnetic_circular_radius: ['P-EM-003', 'physics-magnetic', '带电粒子在磁场中圆周半径属于磁场。'],
  limiting_reagent_product_mass: ['C-BASIC-004', 'chemistry-amount-calculation', '限量试剂和产物质量属于物质的量计算。'],
  redox_electron_stoichiometry: ['C-MATTER-003', 'chemistry-redox', '电子转移计量直接属于氧化还原反应。'],
  equilibrium_constant_from_composition: ['C-THEORY-003', 'chemistry-equilibrium', '由平衡组成求平衡常数属于化学平衡。'],
  crystallization_from_solubility_change: ['C-EXP-003', 'chemistry-experiment-application', '降温结晶与溶解度变化属于分离提纯；Special Practice 使用实验与应用总主题。'],
  electrolysis_faraday_deposition: ['C-THEORY-004', 'chemistry-electrolyte-solution', '电解沉积和法拉第计量属于电解质溶液理论。'],
  hess_law_target_enthalpy: null,
  ideal_gas_combined_state_application: ['C-BASIC-005', 'chemistry-ideal-gas', '定量理想气体在两个状态间的联合状态方程应用，精确对应理想气体状态方程应用。'],
  hydrocarbon_formula_from_combustion: ['C-MATTER-002', 'chemistry-organic-basic', '烃燃烧确定分子式属于基础有机化合物。'],
  molarity_from_mass_fraction_density: ['C-BASIC-003', 'chemistry-concentration-ph', '质量分数与密度换算物质的量浓度属于溶液浓度。'],
  carbonate_purity_from_gas_volume: ['C-BASIC-004', 'chemistry-amount-calculation', '由气体体积反推碳酸盐纯度的核心是物质的量计量。'],
  empirical_formula_from_combustion: ['C-MATTER-002', 'chemistry-organic-basic', '燃烧分析确定经验式属于基础有机化合物。']
});

function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }

async function run() {
  const questionRoot = path.resolve(__dirname, '..'); const repoRoot = path.resolve(questionRoot, '..');
  const packDir = path.join(questionRoot, 'accepted', 'pilot-30-v4');
  const selection = JSON.parse(fs.readFileSync(path.join(packDir, 'selection-plan.json'), 'utf8'));
  const audit = JSON.parse(fs.readFileSync(path.join(packDir, 'audit', 'originality-audit.json'), 'utf8'));
  if (!Array.isArray(selection.candidates) || selection.candidates.length !== 30 || new Set(selection.candidates.map((entry) => entry.candidateId)).size !== 30) throw new Error('selection must contain 30 unique candidates');
  const auditById = new Map((audit.questions ?? []).map((entry) => [entry.candidateId, entry]));
  const prepared = selection.candidates.map((entry) => {
    if (!/^[A-Za-z0-9._-]+$/.test(entry.batch) || !/^[A-Za-z0-9._-]+$/.test(entry.candidateId)) throw new Error(`unsafe selection entry ${entry.candidateId}`);
    const file = path.join(questionRoot, 'batches', entry.batch, 'sealed', `${entry.candidateId}.json`);
    if (!fs.existsSync(file)) throw new Error(`${entry.candidateId}: sealed file missing`);
    const question = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (question.candidateId !== entry.candidateId || !question.questionPlan?.taskFamily) throw new Error(`${entry.candidateId}: invalid sealed identity or taskFamily`);
    if (auditById.get(entry.candidateId)?.status !== 'clear') throw new Error(`${entry.candidateId}: audit status is not clear`);
    return question;
  });
  loadDatabaseUrl(); const { PrismaClient } = require(path.join(repoRoot, 'node_modules', '@prisma', 'client')); const prisma = new PrismaClient();
  let inventory;
  try { inventory = await readInventory(prisma); } finally { await prisma.$disconnect(); }
  const publishedExam = inventory.cscaExamTopics.filter((row) => row.status === 'published').sort((a, b) => a.subject.localeCompare(b.subject) || Number(a.id) - Number(b.id));
  const publishedSpecial = inventory.specialPracticeTopics.filter((row) => row.status === 'published').sort((a, b) => a.subject.localeCompare(b.subject) || Number(a.id) - Number(b.id));
  const specialById = new Map(publishedSpecial.map((row) => [Number(row.id), row])); const examByCode = new Map(publishedExam.map((row) => [`${row.subject}:${row.code}`, row])); const specialBySlug = new Map(publishedSpecial.map((row) => [`${row.subject}:${row.slug}`, row]));
  const existingMappings = inventory.topicMappings.map((mapping) => ({ ...mapping, examTopic: publishedExam.find((topic) => Number(topic.id) === Number(mapping.topicId)) ?? null, specialPracticeTopic: specialById.get(Number(mapping.sourceId)) ?? null })).filter((entry) => entry.examTopic && entry.specialPracticeTopic && entry.examTopic.subject === entry.specialPracticeTopic.subject);
  const catalog = publishedExam.map((topic) => ({ ...topic, specialPracticeMappings: existingMappings.filter((entry) => Number(entry.topicId) === Number(topic.id)).map((entry) => ({ specialPracticeTopicId: Number(entry.sourceId), slug: entry.specialPracticeTopic.slug, title: entry.specialPracticeTopic.title, module: entry.specialPracticeTopic.module })) }));
  const mappings = prepared.map((question) => {
    const rule = RULES[question.questionPlan?.taskFamily];
    if (!rule) return { candidateId: question.candidateId, subject: question.subject, originalTopicCode: question.topicCode, taskFamily: question.questionPlan?.taskFamily ?? null, mappingStatus: 'unmapped', reason: 'no_semantically_safe_existing_exam_topic', rationale: '正式库没有化学热化学或反应焓主题；不将 Hess 定律强塞到物质的量、平衡或基础概念。' };
    const [mappedTopicCode, slug, rationale] = rule; const exam = examByCode.get(`${question.subject}:${mappedTopicCode}`); const special = specialBySlug.get(`${question.subject}:${slug}`);
    if (!exam || !special) return { candidateId: question.candidateId, subject: question.subject, originalTopicCode: question.topicCode, taskFamily: question.questionPlan.taskFamily, mappingStatus: 'unmapped', reason: 'proposed_topic_pair_not_present_and_published', mappedTopicCode, specialPracticeTopicSlug: slug, rationale };
    return { candidateId: question.candidateId, subject: question.subject, originalTopicCode: question.topicCode, taskFamily: question.questionPlan.taskFamily, mappingStatus: 'proposed', mappedTopicCode: exam.code, mappedTopicId: Number(exam.id), mappedTopicTitle: exam.title, mappedTopicModule: exam.module, specialPracticeTopicId: Number(special.id), specialPracticeTopicSlug: special.slug, specialPracticeTopicTitle: special.title, specialPracticeTopicModule: special.module, existingDatabaseBridge: existingMappings.some((entry) => Number(entry.topicId) === Number(exam.id) && Number(entry.sourceId) === Number(special.id)), rationale, confidence: 'semantic_conservative' };
  });
  const proposal = { schemaVersion: 'codex-accepted-topic-mapping-proposal-v1', packId: selection.selectionId, status: 'proposal_only_requires_supervisor_approval', approvalEffect: 'none', databaseAccess: 'read_only_transaction', databaseEvidence: { publishedExamTopicCount: publishedExam.length, publishedSpecialPracticeTopicCount: publishedSpecial.length, existingSpecialPracticeTopicMappingCount: existingMappings.length, eligibleCatalogSha256: sha256(stable(catalog)) }, summary: { proposed: mappings.filter((entry) => entry.mappingStatus === 'proposed').length, unmapped: mappings.filter((entry) => entry.mappingStatus === 'unmapped').length }, publishedExamTopicsAndMappings: catalog, publishedSpecialPracticeTopics: publishedSpecial, mappings, approvalInstructions: 'Do not rename this file. After supervisor review, create topic-mapping.json with status=approved and change only approved mapping entries to mappingStatus=approved. Every selected candidate must have an approved pair before import can proceed.' };
  const target = path.join(packDir, 'topic-mapping-proposal.json'); const text = `${JSON.stringify(proposal, null, 2)}\n`; const temp = `${target}.${process.pid}.tmp`;
  if (fs.existsSync(target) && fs.readFileSync(target, 'utf8') === text) { console.log(`UNCHANGED ${path.relative(repoRoot, target)}: ${proposal.summary.proposed} proposed, ${proposal.summary.unmapped} unmapped`); return; }
  fs.writeFileSync(temp, text, { flag: 'wx' });
  const backup = `${target}.${process.pid}.bak`;
  try {
    if (fs.existsSync(target)) fs.renameSync(target, backup);
    fs.renameSync(temp, target);
    if (fs.existsSync(backup)) fs.rmSync(backup);
  } catch (error) {
    if (fs.existsSync(temp)) fs.rmSync(temp);
    if (fs.existsSync(backup) && !fs.existsSync(target)) fs.renameSync(backup, target);
    throw error;
  }
  console.log(`WROTE ${path.relative(repoRoot, target)}: ${proposal.summary.proposed} proposed, ${proposal.summary.unmapped} unmapped; ${existingMappings.length} existing DB bridge mappings`);
}

if (require.main === module) run().catch((error) => { console.error(`PROPOSAL ERROR: ${error.message}`); process.exitCode = 1; });

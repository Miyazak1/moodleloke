#!/usr/bin/env node

const crypto = require('node:crypto');
const { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } = require('node:fs');
const { dirname, isAbsolute, relative, resolve, sep } = require('node:path');

const MODE = 'subject_practice_scope_opportunity_shadow_v1';
const POLICY_VERSION = 'subject-practice-scope-opportunity-policy-v1';
const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');
const text = (value) => String(value ?? '').trim();

function canonicalJsonValue(value) {
  if (Array.isArray(value)) return value.map(canonicalJsonValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalJsonValue(entry)]));
  }
  return value;
}

function argsFrom(argv) {
  const result = {};
  for (const token of argv) {
    if (!token.startsWith('--')) continue;
    const [key, ...rest] = token.slice(2).split('=');
    result[key] = rest.length ? rest.join('=') : true;
  }
  return result;
}

function outputPathFrom(value, workspaceRoot = process.cwd()) {
  const root = resolve(workspaceRoot);
  const target = resolve(root, text(value));
  const rel = relative(root, target);
  if (!text(value) || !rel || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    throw new Error('scope_opportunity_output_must_be_inside_workspace');
  }
  if (!target.toLowerCase().endsWith('.json')) throw new Error('scope_opportunity_output_must_be_json');
  if (existsSync(target)) throw new Error('scope_opportunity_refuses_to_overwrite');
  return target;
}

const OPPORTUNITIES = [
  {
    id: 'math_coordinate_distance_midpoint', subject: 'math', priority: 'P0',
    topicCodes: ['M-GEO-001'], estimatedGeneratorTemplateCount: 4, proofFeasibility: 1,
    riskWeight: 1, optionMode: 'algebraic',
    include: /distance (?:between|from).{0,80}(?:point|[A-Z]\s*\()|midpoint|中点|两点.{0,30}距离|点.{0,30}到.{0,30}点.{0,30}距离/i,
    exclude: /ellipse|hyperbola|parabola|椭圆|双曲线|抛物线/i
  },
  {
    id: 'math_line_slope_parallel_perpendicular', subject: 'math', priority: 'P0',
    topicCodes: ['M-GEO-001'], estimatedGeneratorTemplateCount: 5, proofFeasibility: 1,
    riskWeight: 1.1, optionMode: 'algebraic',
    include: /slope|inclination angle|parallel to|perpendicular to|斜率|倾斜角|平行|垂直/i,
    exclude: /shown in|figure|diagram|如图/i
  },
  {
    id: 'math_line_equation_intersection', subject: 'math', priority: 'P0',
    topicCodes: ['M-GEO-001'], estimatedGeneratorTemplateCount: 6, proofFeasibility: 0.95,
    riskWeight: 1.2, optionMode: 'algebraic',
    include: /equation of (?:the )?line|line.{0,50}passes through|intersection of.{0,30}lines|直线.{0,20}方程|两直线.{0,20}交点/i,
    exclude: /shown in|figure|diagram|如图/i
  },
  {
    id: 'math_circle_center_radius', subject: 'math', priority: 'P0',
    topicCodes: ['M-GEO-001'], estimatedGeneratorTemplateCount: 5, proofFeasibility: 1,
    riskWeight: 1.15, optionMode: 'algebraic',
    include: /circle.{0,60}(?:center|radius|equation)|center.{0,40}radius|圆.{0,30}(?:圆心|半径|方程)/i,
    exclude: /ellipse|hyperbola|parabola|椭圆|双曲线|抛物线|shown in|figure|diagram|如图/i
  },
  {
    id: 'physics_newton_f_ma', subject: 'physics', priority: 'P0',
    topicCodes: ['P-MECH-001', 'P-MECH-002'], estimatedGeneratorTemplateCount: 6,
    proofFeasibility: 1, riskWeight: 1.1, optionMode: 'quantity',
    include: /(?:mass|质量).{0,80}(?:force|力).{0,80}(?:acceleration|加速度)|(?:force|力).{0,80}(?:mass|质量).{0,80}(?:acceleration|加速度)/i,
    exclude: /shown in|figure|diagram|如图|pulley|滑轮|rope|绳|collision|碰撞/i
  },
  {
    id: 'physics_momentum_p_mv', subject: 'physics', priority: 'P0',
    topicCodes: ['P-MECH-001', 'P-MECH-002'], estimatedGeneratorTemplateCount: 4,
    proofFeasibility: 1, riskWeight: 1, optionMode: 'quantity',
    include: /momentum|动量/i,
    exclude: /collision|碰撞|impulse|冲量|shown in|figure|diagram|如图/i
  },
  {
    id: 'physics_hooke_f_kx', subject: 'physics', priority: 'P0',
    topicCodes: ['P-MECH-001', 'P-MECH-002'], estimatedGeneratorTemplateCount: 4,
    proofFeasibility: 1, riskWeight: 1, optionMode: 'quantity',
    include: /spring constant|Hooke|胡克|劲度系数|弹簧.{0,40}(?:伸长|压缩|形变量)/i,
    exclude: /oscillat|振动|shown in|figure|diagram|如图/i
  },
  {
    id: 'physics_work_constant_force', subject: 'physics', priority: 'P0',
    topicCodes: ['P-MECH-001', 'P-MECH-002'], estimatedGeneratorTemplateCount: 6,
    proofFeasibility: 0.95, riskWeight: 1.25, optionMode: 'quantity',
    include: /work done|does.{0,20}work|功/i,
    exclude: /variable force|变力|graph|curve|图像|shown in|figure|diagram|如图|collision|碰撞/i
  },
  {
    id: 'physics_weight_direct', subject: 'physics', priority: 'P0',
    topicCodes: ['P-MECH-001', 'P-MECH-002'], estimatedGeneratorTemplateCount: 4,
    proofFeasibility: 1, riskWeight: 1, optionMode: 'quantity',
    include: /weight.{0,60}(?:mass|gravity|Moon|Earth)|(?:mass|gravity).{0,60}weight|重力.{0,40}(?:质量|重力加速度)|重量/i,
    exclude: /apparent weight|失重|超重|shown in|figure|diagram|如图/i
  },
  {
    id: 'math_arithmetic_geometric_sequence', subject: 'math', priority: 'P1',
    topicCodes: ['M-SEQ-001'], estimatedGeneratorTemplateCount: 8, proofFeasibility: 1,
    riskWeight: 1, optionMode: 'algebraic',
    include: /arithmetic sequence|geometric sequence|common difference|common ratio|等差数列|等比数列|公差|公比/i,
    exclude: /recurrence|递推|complex|复数|proof|证明/i
  },
  {
    id: 'chemistry_molarity_dilution', subject: 'chemistry', priority: 'P1',
    topicCodes: ['C-BASIC-003'], estimatedGeneratorTemplateCount: 5, proofFeasibility: 1,
    riskWeight: 1.1, optionMode: 'quantity',
    include: /(?:mol\/L|molar).{0,80}(?:dilut|稀释)|(?:dilut|稀释).{0,80}(?:mol\/L|molar)/i,
    exclude: /weak acid|weak base|buffer|titration|弱酸|弱碱|缓冲|滴定/i
  },
  {
    id: 'chemistry_strong_electrolyte_ion_concentration', subject: 'chemistry', priority: 'P1',
    topicCodes: ['C-BASIC-003'], estimatedGeneratorTemplateCount: 6, proofFeasibility: 0.95,
    riskWeight: 1.2, optionMode: 'quantity',
    include: /ion concentration|concentration of.{0,30}(?:H\+|OH-|Na\+|Cl-)|离子浓度|(?:H\+|OH-|Na\+|Cl-).{0,20}浓度/i,
    exclude: /equilibrium|hydrolysis|buffer|weak|平衡|水解|缓冲|弱/i
  },
  {
    id: 'math_special_angle_trigonometry', subject: 'math', priority: 'P2',
    topicCodes: ['M-FUNC-002'], estimatedGeneratorTemplateCount: 8, proofFeasibility: 0.9,
    riskWeight: 1.35, optionMode: 'algebraic',
    include: /(?:sin|cos|tan).{0,80}(?:30°|45°|60°|π\/6|π\/4|π\/3)|quadrant.{0,30}(?:sin|cos|tan)|象限.{0,30}(?:sin|cos|tan)/i,
    exclude: /graph|curve|图像|shown in|figure|diagram|如图/i
  },
  {
    id: 'chemistry_isotope_atomic_structure', subject: 'chemistry', priority: 'P2',
    topicCodes: ['C-THEORY-001'], estimatedGeneratorTemplateCount: 7, proofFeasibility: 0.85,
    riskWeight: 1.4, optionMode: 'symbolic',
    include: /isotope|atomic number|mass number|electron configuration|同位素|原子序数|质量数|电子排布/i,
    exclude: /radioactive decay chain|衰变链/i
  }
];

function loadPastPaperIdentities(workspaceRoot = process.cwd()) {
  const docsDir = resolve(workspaceRoot, 'docs');
  const identities = [];
  const inventory = [];
  for (const name of readdirSync(docsDir).filter((entry) => /-source\.json$/i.test(entry))
    .filter((entry) => entry !== 'csca-past-paper-source-json-template.json').sort()) {
    const path = resolve(docsDir, name);
    const raw = readFileSync(path, 'utf8');
    const parsed = JSON.parse(raw);
    const document = parsed.document ?? {};
    if (text(document.sourceType) === 'mock_exam' || document.usagePolicy?.allowSimilarityCheck === false) continue;
    const subject = text(document.subject).toLowerCase();
    const language = text(document.language).toLowerCase();
    const questions = Array.isArray(parsed.questions) ? parsed.questions : [];
    inventory.push({ path: `docs/${name}`, sha256: sha256(raw), subject, language, questionCount: questions.length });
    for (const question of questions) {
      const prompt = text(question.promptText ?? question.prompt);
      const options = Array.isArray(question.options) ? question.options.map((option) => text(option.text)) : [];
      identities.push({
        identityId: sha256(`${name}|${question.questionNumber}`),
        subject, language, questionNumber: text(question.questionNumber),
        topicCodes: Array.isArray(question.topicCodes) ? question.topicCodes.map(text).filter(Boolean) : [],
        prompt, options,
        contentSha256: sha256(JSON.stringify(canonicalJsonValue({
          prompt, options, correctAnswer: question.correctAnswer ?? question.answer,
          explanation: question.explanation ?? null
        })))
      });
    }
  }
  return { identities, inventory };
}

function hasImageDependency(prompt) {
  return /shown in (?:the )?(?:figure|diagram)|according to (?:the )?(?:figure|diagram)|如图|见图|图中/i.test(prompt);
}

function optionsStructurallyParseable(options, mode) {
  if (options.length < 2 || options.some((option) => !option || option.length > 180)) return false;
  if (mode === 'quantity') return options.every((option) => /[-+]?\d|zero|none|零/i.test(option));
  if (mode === 'algebraic') return options.every((option) => /[-+]?\d|[xy]|π|sqrt|√|\(|\)|line|point|circle/i.test(option));
  return options.every((option) => /[A-Za-z0-9+\-]/.test(option));
}

function opportunityMatches(identity, opportunity) {
  return identity.subject === opportunity.subject
    && identity.topicCodes.some((code) => opportunity.topicCodes.includes(code))
    && opportunity.include.test(identity.prompt)
    && !opportunity.exclude.test(identity.prompt);
}

function ratio(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}

function buildReport(workspaceRoot = process.cwd()) {
  const loaded = loadPastPaperIdentities(workspaceRoot);
  const classifications = loaded.identities.map((identity) => {
    const matches = OPPORTUNITIES.filter((opportunity) => opportunityMatches(identity, opportunity));
    return {
      identityId: identity.identityId,
      subject: identity.subject,
      language: identity.language,
      topicCodes: identity.topicCodes,
      contentSha256: identity.contentSha256,
      imageDependent: hasImageDependency(identity.prompt),
      matchedOpportunityIds: matches.map((item) => item.id),
      status: matches.length === 1 ? 'unique_candidate_scope'
        : matches.length > 1 ? 'ambiguous_candidate_scopes' : 'unmatched_candidate_scope'
    };
  });
  const opportunities = OPPORTUNITIES.map((opportunity) => {
    const identities = loaded.identities.filter((identity) => opportunityMatches(identity, opportunity));
    const noImageCount = identities.filter((identity) => !hasImageDependency(identity.prompt)).length;
    const optionParseableCount = identities.filter((identity) => optionsStructurallyParseable(identity.options, opportunity.optionMode)).length;
    const languageCounts = {};
    for (const identity of identities) languageCounts[identity.language] = (languageCounts[identity.language] ?? 0) + 1;
    const noImageRate = ratio(noImageCount, identities.length);
    const optionParseableRate = ratio(optionParseableCount, identities.length);
    const opportunityScore = identities.length * noImageRate * optionParseableRate
      * opportunity.proofFeasibility / opportunity.riskWeight;
    return {
      id: opportunity.id,
      subject: opportunity.subject,
      priority: opportunity.priority,
      topicCodes: opportunity.topicCodes,
      historicalIdentityCount: identities.length,
      languageCounts,
      noImageCount,
      noImageRate,
      optionParseableCount,
      optionParseableRate,
      proofFeasibility: opportunity.proofFeasibility,
      riskWeight: opportunity.riskWeight,
      estimatedGeneratorTemplateCount: opportunity.estimatedGeneratorTemplateCount,
      opportunityScore
    };
  }).sort((left, right) => right.opportunityScore - left.opportunityScore || left.id.localeCompare(right.id));
  const sourceInventorySha256 = sha256(JSON.stringify(canonicalJsonValue(loaded.inventory)));
  const countsByStatus = Object.fromEntries([
    'unique_candidate_scope', 'ambiguous_candidate_scopes', 'unmatched_candidate_scope'
  ].map((status) => [status, classifications.filter((item) => item.status === status).length]));
  const payload = {
    schemaVersion: 'subject-practice-scope-opportunity-shadow-v1',
    mode: MODE,
    policyVersion: POLICY_VERSION,
    sourcePolicy: 'local_past_paper_identities_excluding_mock_exam_and_disallowed_similarity_use',
    sourceInventorySha256,
    sourceFileCount: loaded.inventory.length,
    historicalIdentityCount: loaded.identities.length,
    fixedDenominatorComplete: classifications.length === loaded.identities.length,
    countsByStatus,
    opportunities,
    classifications,
    selectionPolicy: 'select_one_narrow_scope_family_then_complete_parser_solver_oracle_generator_property_and_fault_tests',
    formalGoldEligible: false,
    releaseImpact: 'none_scope_opportunity_shadow_only',
    providerImpact: 'none_no_provider_call',
    databaseImpact: 'none_local_files_only',
    productionImpact: 'none_no_gate_or_publication_change'
  };
  return { ...payload, payloadSha256: sha256(JSON.stringify(canonicalJsonValue(payload))) };
}

function preflight() {
  return {
    mode: MODE,
    status: 'preflight_only_no_scan_or_output',
    executeRequired: true,
    candidateScopeCount: OPPORTUNITIES.length,
    formalGoldEligible: false,
    providerImpact: 'none_no_provider_call',
    databaseImpact: 'none_no_database_connection',
    productionImpact: 'none'
  };
}

function summaryFor(report) {
  return {
    mode: report.mode,
    status: 'scope_opportunity_shadow_completed_nonqualifying',
    payloadSha256: report.payloadSha256,
    historicalIdentityCount: report.historicalIdentityCount,
    fixedDenominatorComplete: report.fixedDenominatorComplete,
    countsByStatus: report.countsByStatus,
    topOpportunities: report.opportunities.slice(0, 10),
    formalGoldEligible: report.formalGoldEligible,
    releaseImpact: report.releaseImpact,
    providerImpact: report.providerImpact,
    databaseImpact: report.databaseImpact,
    productionImpact: report.productionImpact
  };
}

function main() {
  const args = argsFrom(process.argv.slice(2));
  if (!args.execute) return preflight();
  if (!args.out) throw new Error('scope_opportunity_execute_requires_out');
  const report = buildReport();
  const outputPath = outputPathFrom(args.out);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  return { ...summaryFor(report), outputPath };
}

if (require.main === module) {
  try {
    process.stdout.write(`${JSON.stringify(main(), null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error?.stack ?? error}\n`);
    process.exitCode = 1;
  }
}

module.exports = { argsFrom, outputPathFrom, loadPastPaperIdentities, preflight, buildReport, summaryFor };

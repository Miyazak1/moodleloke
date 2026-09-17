const fs = require('node:fs');
const path = require('node:path');

const reviewsDir = __dirname;
const reviewedAt = new Date().toISOString();
const reviewerTaskId = 'pilot-30-independent-blind-review';

const oneTrue = (answer) => Object.fromEntries(['A', 'B', 'C', 'D'].map((id) => [id, id === answer]));

const items = [];
const add = (candidateId, derivedAnswer, evidence, extra = {}) => {
  items.push({
    schemaVersion: 'codex-blind-review-v1',
    candidateId,
    reviewerTaskId,
    derivedAnswer,
    optionTruthTable: extra.optionTruthTable ?? oneTrue(derivedAnswer),
    conditionsSufficient: extra.conditionsSufficient ?? true,
    ambiguityFound: extra.ambiguityFound ?? false,
    syllabusAligned: extra.syllabusAligned ?? true,
    difficultyAssessment: extra.difficultyAssessment,
    caseNecessary: extra.caseNecessary,
    counterexampleAttempted: true,
    verificationEvidence: evidence,
    verdictBeforeReveal: extra.verdictBeforeReveal ?? 'pass',
    reasonCodes: extra.reasonCodes ?? [],
    reviewedAt,
  });
};

// Chemistry: independently recompute dilution concentrations and excess moles.
const acidDilutions = [
  ['0001', 0.2, 5, 50, 'A'],
  ['0002', 0.01, 40, 400, 'B'],
  ['0003', 0.1, 20, 400, 'C'],
  ['0004', 0.1, 25, 625, 'D'],
];
for (const [n, c0, v0, vf, answer] of acidDilutions) {
  const h = c0 * v0 / vf;
  const ph = -Math.log10(h);
  add(`CQ-CHEMISTRY-${n}`, answer, [
    `[H+]=${c0}×${v0}/${vf}=${h.toPrecision(6)} mol/L；pH=-lg[H+]=${ph.toFixed(4)}，按选项精度舍入。`,
    '反查其余三个选项对应的氢离子浓度，均不等于稀释后的浓度；体积单位在比值中相消。',
  ], { difficultyAssessment: 'medium', caseNecessary: true });
}

add('CQ-CHEMISTRY-0005', 'A', [
  '盐酸稀释后仍有正的过量[H+]：0.04×50/2500=8.0×10^-4 mol/L，因此呈酸性。',
  '水只改变浓度，不消耗HCl；中性、碱性与“无法判断”均不成立。',
], { difficultyAssessment: 'basic', caseNecessary: true, verdictBeforeReveal: 'reject', reasonCodes: ['declared_difficulty_mismatch'] });

const baseDilutions = [
  ['0006', 0.2, 10, 100, 'A'],
  ['0007', 0.01, 5, 100, 'B'],
  ['0008', 0.05, 50, 1000, 'C'],
  ['0009', 0.05, 5, 250, 'D'],
];
for (const [n, c0, v0, vf, answer] of baseDilutions) {
  const oh = c0 * v0 / vf;
  const poh = -Math.log10(oh);
  const ph = 14 - poh;
  add(`CQ-CHEMISTRY-${n}`, answer, [
    `[OH-]=${c0}×${v0}/${vf}=${oh.toPrecision(6)} mol/L；25°C下pH=14-pOH=${ph.toFixed(4)}，按选项精度舍入。`,
    '逐一反查其余选项对应的[OH-]，均与稀释关系不符；未混淆pH与pOH。',
  ], { difficultyAssessment: 'medium', caseNecessary: true });
}

add('CQ-CHEMISTRY-0010', 'A', [
  'NaOH稀释后[OH-]=0.04×20/2000=4.0×10^-4 mol/L>10^-7 mol/L，故呈碱性。',
  '水只稀释而不与NaOH发生中和；酸性、中性和无法判断均排除。',
], { difficultyAssessment: 'basic', caseNecessary: true, verdictBeforeReveal: 'reject', reasonCodes: ['declared_difficulty_mismatch'] });

const neutralizations = [
  ['0011', 15, 0.15, 10, 0.06, 'C'],
  ['0012', 25, 0.08, 10, 0.06, 'D'],
  ['0013', 40, 0.10, 10, 0.25, 'A'],
  ['0014', 20, 0.08, 15, 0.10, 'B'],
];
for (const [n, va, ca, vb, cb, answer] of neutralizations) {
  const excess = (va * ca - vb * cb) / 1000;
  const totalVolume = (va + vb) / 1000;
  const h = excess / totalVolume;
  const ph = -Math.log10(h);
  add(`CQ-CHEMISTRY-${n}`, answer, [
    `n(H+)−n(OH-)=${(va * ca / 1000).toPrecision(6)}−${(vb * cb / 1000).toPrecision(6)}=${excess.toPrecision(6)} mol；总体积=${totalVolume.toPrecision(6)} L。`,
    `过量[H+]=${h.toPrecision(6)} mol/L，pH=${ph.toFixed(4)}，与唯一选项吻合；反查其余选项均不满足物料衡算。`,
  ], { difficultyAssessment: 'medium', caseNecessary: true });
}

add('CQ-CHEMISTRY-0015', 'C', [
  'n(HCl)=0.040×0.05=0.00200 mol，n(NaOH)=0.015×0.25=0.00375 mol，OH-过量0.00175 mol，故混合液呈碱性。',
  '强酸强碱按1:1中和；两者不等量，排除中性，且给定量足以判断。',
], { difficultyAssessment: 'basic', caseNecessary: true, verdictBeforeReveal: 'reject', reasonCodes: ['declared_difficulty_mismatch'] });

// Mathematics: direct symbolic checks, plus literal truth testing of every option.
const mathDirect = [
  ['0001', 'A', "f'(x)=-6x-3，f'(-1)=3；其余数值均不等于代入结果。"],
  ['0002', 'B', "f'(x)=-2x-3，f'(-3)=3；逐项代回仅B成立。"],
  ['0003', 'C', "f'(x)=6x^2-6x+3，f'(2)=24-12+3=15；仅C成立。"],
  ['0004', 'D', "f'(x)=-3x^2-4x-1，f'(2)=-12-8-1=-21；仅D成立。"],
  ['0005', 'A', "f'(x)=-4x-1，f'(3)=-13；仅A成立。"],
  ['0009', 'D', '11^4=(11^2)^2=121^2=14641；正偶次幂排除负数，邻近整数均不相等。'],
  ['0011', 'C', '斜率=(0-(-1))/(3-1)=1/2；分母非零，符号与倒数型干扰项均排除。'],
  ['0012', 'D', '直线化为y=-x-15，斜率-1=tan(135°)；倾斜角取[0°,180°)，故唯一为135°。'],
  ['0013', 'A', '原直线斜率-3；垂线斜率1/3。A化为y=x/3，B、C斜率-3，D斜率2。'],
  ['0014', 'B', '点斜式y+1=(1/2)(x+3)，整理得x-2y+1=0；代点及斜率双重反查仅B成立。'],
  ['0015', 'C', '斜率=(-1-(-3))/(5-0)=2/5；分母非零，符号、倒数和偏移干扰项均排除。'],
];
for (const [n, answer, evidence] of mathDirect) {
  add(`CQ-MATH-${n}`, answer, [evidence, '检查定义域、符号与所有四个选项后，只有一个选项满足题干。'], { difficultyAssessment: 'basic', caseNecessary: false });
}

add('CQ-MATH-0006', 'A', [
  'log_3(x+8)要求x+8>0，故定义域(-8,+∞)，A作为直接答案成立。',
  '但D“忽略真数约束会误判为R”在字面上也是正确的错误诊断，因而单选项出现第二个真命题。',
], { optionTruthTable: { A: true, B: false, C: false, D: true }, difficultyAssessment: 'basic', caseNecessary: false, ambiguityFound: true, verdictBeforeReveal: 'reject', reasonCodes: ['multiple_literal_true_options', 'metacognitive_distractor_ambiguity'] });

add('CQ-MATH-0007', 'B', [
  '对任意实数x，2^x>0且x→-∞时趋于0但不取0，故值域(0,+∞)，B成立。',
  'A与C均以“若……会得到……”描述真实可发生的错误推导，字面上也成立；选项没有统一作为候选值域陈述。',
], { optionTruthTable: { A: true, B: true, C: true, D: false }, difficultyAssessment: 'basic', caseNecessary: false, ambiguityFound: true, verdictBeforeReveal: 'reject', reasonCodes: ['multiple_literal_true_options', 'metacognitive_distractor_ambiguity'] });

add('CQ-MATH-0008', 'C', [
  '-23x+1587≥0给出定义域(-∞,69]；平方根递增而内部一次函数递减，因此复合函数在定义域上递减。',
  '题干声称“给定区间”却未给区间；A、B、D又以错误诊断/错误断言的叙述形式混入，无法形成干净的单选命题集合。',
], { optionTruthTable: { A: true, B: true, C: true, D: true }, conditionsSufficient: false, difficultyAssessment: 'basic', caseNecessary: false, ambiguityFound: true, verdictBeforeReveal: 'reject', reasonCodes: ['missing_stated_interval', 'multiple_literal_true_options', 'metacognitive_distractor_ambiguity'] });

add('CQ-MATH-0010', 'A', [
  '对数底0.2合法且不改变真数条件；x+2>0，所以定义域(-2,+∞)，A成立。',
  'D“忽略真数约束会误判为R”同样是字面成立的错误诊断，造成两个真命题。',
], { optionTruthTable: { A: true, B: false, C: false, D: true }, difficultyAssessment: 'basic', caseNecessary: false, ambiguityFound: true, verdictBeforeReveal: 'reject', reasonCodes: ['multiple_literal_true_options', 'metacognitive_distractor_ambiguity'] });

// Physics: the stated acceleration is read as holding over the stated interval; endpoint-only items yield interval acceleration.
const physics = [
  ['0001', 'A', 'v=s/t=9/3=3 m/s。'],
  ['0002', 'B', 'v=s/t=84/12=7 m/s。'],
  ['0003', 'C', 'v=s/t=135/9=15 m/s。'],
  ['0004', 'D', 'v=s/t=270/10=27 m/s。'],
  ['0005', 'A', 'a=(v-v0)/t=(7-3)/4=1 m/s^2。'],
  ['0006', 'B', 'a=(v-v0)/t=(12-9)/3=1 m/s^2。'],
  ['0007', 'C', 'a=(v-v0)/t=(27-16)/11=1 m/s^2。'],
  ['0008', 'D', 'a=(v-v0)/t=(40-28)/12=1 m/s^2。'],
  ['0009', 'A', 'v=v0+at=3+1×12=15 m/s。'],
  ['0010', 'B', 'v=v0+at=10+1×4=14 m/s。'],
  ['0011', 'C', 'v=v0+at=19+1×2=21 m/s。'],
  ['0012', 'D', 'v=v0+at=2+2×3=8 m/s。'],
  ['0013', 'A', 's=v0t+at^2/2=5×2+1×2^2/2=12 m。'],
  ['0014', 'B', 's=v0t+at^2/2=12×10+1×10^2/2=170 m。'],
  ['0015', 'C', 's=v0t+at^2/2=22×9+1×9^2/2=238.5 m。'],
];
for (const [n, answer, calculation] of physics) {
  add(`CQ-PHYSICS-${n}`, answer, [
    calculation,
    '量纲与SI单位一致；逐项反代其余三个数值均不满足题干运动学关系，未发现第二正确选项。',
  ], { difficultyAssessment: 'basic', caseNecessary: true });
}

if (items.length !== 45) throw new Error(`Expected 45 reviews, got ${items.length}`);
for (const review of items) {
  fs.writeFileSync(path.join(reviewsDir, `${review.candidateId}.review.json`), `${JSON.stringify(review, null, 2)}\n`, 'utf8');
}

const bySubject = {};
const reasonCodeCounts = {};
for (const review of items) {
  const subject = review.candidateId.split('-')[1].toLowerCase();
  bySubject[subject] ??= { pass: 0, reject: 0, abstain: 0, total: 0 };
  bySubject[subject][review.verdictBeforeReveal] += 1;
  bySubject[subject].total += 1;
  for (const code of review.reasonCodes) reasonCodeCounts[code] = (reasonCodeCounts[code] ?? 0) + 1;
}
const overall = { pass: 0, reject: 0, abstain: 0, total: items.length };
for (const counts of Object.values(bySubject)) {
  overall.pass += counts.pass;
  overall.reject += counts.reject;
  overall.abstain += counts.abstain;
}
const manifest = {
  schemaVersion: 'codex-blind-reviewer-manifest-v1',
  batchId: 'pilot-30',
  reviewerTaskId,
  reviewedAt,
  blindCandidateCount: items.length,
  counts: { overall, bySubject },
  reasonCodeCounts,
  candidates: items.map(({ candidateId, derivedAnswer, verdictBeforeReveal, reasonCodes }) => ({ candidateId, derivedAnswer, verdictBeforeReveal, reasonCodes })),
  limitations: [
    'Blind review only: no sealed answers, generator reasoning, official question bodies, repository history, other branches, or database state were consulted.',
    'No cross-batch duplicate/leakage, answer-key comparison, or deterministic publication gate was performed; those remain supervisor-stage checks.',
  ],
};
fs.writeFileSync(path.join(reviewsDir, 'reviewer-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(manifest.counts, null, 2));
console.log(JSON.stringify(reasonCodeCounts, null, 2));

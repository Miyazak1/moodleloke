'use strict';

const crypto = require('node:crypto');

const GENERATOR_VERSION = 'math-line-relation-independent-case-generator-v1';
const SEED_MANIFEST_VERSION = 'math-line-relation-independent-seed-manifest-v1';
const ROOT_SEED = 'cscalite:math-line-relation:independent-property:2026-09-13:v1';
const SCOPES = [
  'slope_from_two_distinct_points',
  'inclination_angle_from_line',
  'identify_parallel_or_perpendicular_line',
  'line_equation_from_point_and_slope'
];
const OPTION_IDS = ['A', 'B', 'C', 'D'];

const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');

function gcd(left, right) {
  let a = Math.abs(Math.trunc(left));
  let b = Math.abs(Math.trunc(right));
  while (b) [a, b] = [b, a % b];
  return a || 1;
}

function reduced(top, bottom = 1) {
  if (!Number.isSafeInteger(top) || !Number.isSafeInteger(bottom) || bottom === 0) throw new Error('unsafe independent fraction');
  const sign = bottom < 0 ? -1 : 1;
  const divisor = gcd(top, bottom);
  return { top: sign * top / divisor, bottom: Math.abs(bottom) / divisor };
}

function fractionText(top, bottom = 1, equivalentScale = 1) {
  const value = reduced(top, bottom);
  const n = value.top * equivalentScale;
  const d = value.bottom * equivalentScale;
  return d === 1 ? `${n}` : `${n}/${d}`;
}

function coefficientText(value, variable, first) {
  if (value.top === 0) return '';
  const negative = value.top < 0;
  const magnitude = reduced(Math.abs(value.top), value.bottom);
  const scalar = magnitude.bottom === 1 && magnitude.top === 1
    ? ''
    : magnitude.bottom === 1 ? `${magnitude.top}` : `${magnitude.top}/${magnitude.bottom}`;
  return `${negative ? '-' : first ? '' : '+'}${scalar}${variable}`;
}

function equationText(a, b, rhs, divisor = 1, scale = 1) {
  const ar = reduced(a * scale, divisor);
  const br = reduced(b * scale, divisor);
  const rr = reduced(rhs * scale, divisor);
  let left = coefficientText(ar, 'x', true);
  left += coefficientText(br, 'y', left.length === 0);
  return `${left}=${fractionText(rr.top, rr.bottom)}`;
}

function seedFor(scope, index) {
  const digest = crypto.createHash('sha256').update(`${ROOT_SEED}:${scope}:${index}`).digest();
  return digest.readUInt32BE(0) || 0x9e3779b9;
}

function randomSource(seed) {
  let state = seed >>> 0;
  return {
    next() {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      return state >>> 0;
    },
    int(min, max) {
      return min + (this.next() % (max - min + 1));
    },
    pick(values) {
      return values[this.next() % values.length];
    }
  };
}

function uniqueFractions(correct, rawDistractors) {
  const seen = new Set();
  const values = [correct];
  seen.add(fractionText(correct.top, correct.bottom));
  for (const item of rawDistractors) {
    const normalized = reduced(item.top, item.bottom);
    const key = fractionText(normalized.top, normalized.bottom);
    if (!seen.has(key)) {
      seen.add(key);
      values.push(normalized);
    }
  }
  for (let offset = 1; values.length < 4; offset += 1) {
    const fallback = reduced(correct.top + offset * correct.bottom, correct.bottom);
    const key = fractionText(fallback.top, fallback.bottom);
    if (!seen.has(key)) {
      seen.add(key);
      values.push(fallback);
    }
  }
  return values.slice(0, 4);
}

function shuffledOptions(values, correctIndex) {
  const ordered = values.slice(1);
  ordered.splice(correctIndex, 0, values[0]);
  return {
    correctAnswer: OPTION_IDS[correctIndex],
    options: ordered.map((value, index) => ({ id: OPTION_IDS[index], text: value.text })),
    roundTripOptions: ordered.map((value, index) => ({ id: OPTION_IDS[index], text: value.roundTrip }))
  };
}

function candidate(prompt, options, correctAnswer, index, scope, language) {
  return {
    subject: 'math',
    topicId: 92001,
    blueprintId: 91002,
    sourceType: 'ai',
    designedDifficulty: 'basic',
    questionType: 'single_choice',
    prompt,
    options,
    correctAnswer,
    explanation: language === 'zh' ? '独立构造性质测试。' : 'Independent construction property test.',
    knowledgeTags: ['line_relation_independent_property', scope],
    optionMetadata: options.map((option) => ({ optionId: option.id })),
    syllabusVersion: 'line-relation-independent-property-v1',
    externalCaseIndex: index
  };
}

function buildSlopeCase(rng, index) {
  const x1 = rng.int(-30, 30);
  const y1 = rng.int(-30, 30);
  const dx = rng.pick([-11, -9, -7, -5, -4, -3, 2, 3, 4, 5, 7, 9, 11]);
  const dy = rng.pick([-13, -8, -5, -3, -2, -1, 1, 2, 3, 5, 8, 13]);
  const x2 = x1 + dx;
  const y2 = y1 + dy;
  const answer = reduced(dy, dx);
  const fractions = uniqueFractions(answer, [
    { top: dx, bottom: dy },
    { top: -dy, bottom: dx },
    { top: dy + dx, bottom: dx },
    { top: dy - dx, bottom: dx }
  ]);
  const values = fractions.map((value) => ({
    text: fractionText(value.top, value.bottom),
    roundTrip: fractionText(value.top, value.bottom, -2)
  }));
  const labels = index % 2 ? ['M', 'N'] : ['A', 'B'];
  return {
    prompts: {
      zh: `已知点 ${labels[0]}（${x1}，${y1}）与点 ${labels[1]}（${x2}，${y2}），求过这两点的直线斜率。`,
      en: `Given ${labels[0]}(${x1},${y1}) and ${labels[1]}(${x2},${y2}), find the slope of their line.`
    },
    values,
    witness: { construction: 'integer_point_pair', x1, y1, x2, y2, dx, dy, expectedSlope: fractionText(answer.top, answer.bottom) },
    features: ['integer_point_pair', dx < 0 ? 'negative_dx' : 'positive_dx', dy < 0 ? 'negative_dy' : 'positive_dy', answer.bottom > 1 ? 'fractional_answer' : 'integer_answer']
  };
}

function buildInclinationCase(rng, index) {
  const slope = rng.pick([0, 1, -1]);
  const factor = rng.pick([1, 2, 3, 5, 7]);
  const divisor = rng.pick([1, 2, 3, 4, 5]);
  const rhs = rng.int(-12, 12);
  const line = equationText(-slope * factor, factor, rhs, divisor);
  const expected = slope === 0 ? 0 : slope === 1 ? 45 : 135;
  const angles = [expected, ...[0, 45, 90, 135].filter((value) => value !== expected)];
  const values = angles.map((value) => ({ text: `${value}°`, roundTrip: `${value}º` }));
  return {
    prompts: {
      zh: `直线 m：${line} 的倾斜角为多少？`,
      en: `Determine the inclination angle of line m: ${line}.`
    },
    values,
    witness: { construction: 'exact_standard_slope_line', slope, expectedAngleDegrees: expected, factor, divisor, rhs },
    features: ['exact_standard_angle', divisor > 1 ? 'fractional_coefficients' : 'integer_coefficients', `angle_${expected}`, index % 2 ? 'surface_variant_1' : 'surface_variant_0']
  };
}

function buildRelationCase(rng) {
  const normals = [[1, 2], [2, -3], [3, 1], [4, -1], [5, 2], [2, 5]];
  const [a, b] = rng.pick(normals);
  const rhs = rng.int(-15, 15);
  const divisor = rng.pick([1, 2, 3, 4, 5]);
  const relation = rng.pick(['parallel', 'perpendicular']);
  const reference = equationText(a, b, rhs, divisor);
  const correct = relation === 'parallel'
    ? { tuple: [a, b, rhs + divisor], divisor }
    : { tuple: [b, -a, rhs + 2], divisor };
  const coincident = { tuple: [2 * a, 2 * b, 2 * rhs], divisor: 2 * divisor };
  const opposite = relation === 'parallel'
    ? { tuple: [b, -a, rhs - 2], divisor }
    : { tuple: [a, b, rhs + divisor], divisor };
  const unrelated = { tuple: [a + b, b - a, rhs + 3], divisor };
  const raw = [correct, coincident, opposite, unrelated];
  const values = raw.map((item) => ({
    text: equationText(item.tuple[0], item.tuple[1], item.tuple[2], item.divisor),
    roundTrip: equationText(item.tuple[0], item.tuple[1], item.tuple[2], item.divisor, -2)
  }));
  return {
    prompts: {
      zh: `以下哪条直线与直线 l：${reference} ${relation === 'parallel' ? '平行' : '垂直'}？`,
      en: `Which line is ${relation} to line l: ${reference}?`
    },
    values,
    witness: { construction: 'normal_vector_invariant', referenceNormal: [a, b], rhs, divisor, relation },
    features: ['normal_vector_construction', relation, divisor > 1 ? 'fractional_coefficients' : 'integer_coefficients', 'coincident_negative_option', 'opposite_relation_negative_option']
  };
}

function buildPointSlopeCase(rng) {
  const [p, q] = rng.pick([[1, 2], [-1, 2], [2, 3], [-2, 3], [3, 2], [-3, 2], [4, 3]]);
  const x = rng.int(-20, 20);
  const y = rng.int(-20, 20);
  const divisor = rng.pick([1, 2, 3, 4, 5]);
  const rhs = p * x - q * y;
  const raw = [
    { tuple: [p, -q, rhs], tag: 'correct' },
    { tuple: [p, -q, rhs + 1], tag: 'constant_offset' },
    { tuple: [q, -p, q * x - p * y], tag: 'reciprocal_slope' },
    { tuple: [p, q, p * x + q * y], tag: 'slope_sign' }
  ];
  const values = raw.map((item) => ({
    text: equationText(item.tuple[0], item.tuple[1], item.tuple[2], divisor),
    roundTrip: equationText(item.tuple[0], item.tuple[1], item.tuple[2], divisor, -2)
  }));
  return {
    prompts: {
      zh: `下列哪个方程表示经过点 P（${x}，${y}）且斜率为 ${fractionText(p, q, q < 0 ? -1 : 1)} 的直线？`,
      en: `Which equation is the line through P(${x},${y}) with slope ${fractionText(p, q)}?`
    },
    values,
    witness: { construction: 'point_direction_incidence', point: { x, y }, direction: { dx: q, dy: p }, divisor, rhs },
    features: ['point_direction_construction', divisor > 1 ? 'fractional_coefficients' : 'integer_coefficients', p < 0 ? 'negative_slope' : 'positive_slope']
  };
}

function buildIndependentLineRelationCase(scope, index) {
  if (!SCOPES.includes(scope)) throw new Error(`unsupported scope: ${scope}`);
  if (!Number.isInteger(index) || index < 0) throw new Error(`invalid index: ${index}`);
  const seed = seedFor(scope, index);
  const rng = randomSource(seed);
  const built = scope === 'slope_from_two_distinct_points'
    ? buildSlopeCase(rng, index)
    : scope === 'inclination_angle_from_line'
      ? buildInclinationCase(rng, index)
      : scope === 'identify_parallel_or_perpendicular_line'
        ? buildRelationCase(rng)
        : buildPointSlopeCase(rng);
  const ordered = shuffledOptions(built.values, index % 4);
  const zh = candidate(built.prompts.zh, ordered.options, ordered.correctAnswer, index, scope, 'zh');
  const en = candidate(built.prompts.en, ordered.options, ordered.correctAnswer, index, scope, 'en');
  const roundTripZh = candidate(built.prompts.zh, ordered.roundTripOptions, ordered.correctAnswer, index, scope, 'zh');
  const roundTripEn = candidate(built.prompts.en, ordered.roundTripOptions, ordered.correctAnswer, index, scope, 'en');
  return { scope, index, seed, zh, en, roundTripZh, roundTripEn, witness: built.witness, features: built.features };
}

function seedManifest(countPerScope) {
  const entries = SCOPES.flatMap((scope) => Array.from({ length: countPerScope }, (_, index) => ({ scope, index, seed: seedFor(scope, index) })));
  return {
    version: SEED_MANIFEST_VERSION,
    rootSeedCommitmentSha256: sha256(ROOT_SEED),
    entryCount: entries.length,
    entriesSha256: sha256(JSON.stringify(entries))
  };
}

module.exports = {
  GENERATOR_VERSION,
  SEED_MANIFEST_VERSION,
  SCOPES,
  buildIndependentLineRelationCase,
  seedManifest
};

#!/usr/bin/env node

require('../backend/node_modules/ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', moduleResolution: 'node' }
});

const {
  SUBJECT_PRACTICE_CHEMISTRY_ACID_BASE_SOLVER_VERSION,
  SUBJECT_PRACTICE_CHEMISTRY_ACID_BASE_SCOPE_VERSION,
  solveSubjectPracticeChemistryAcidBase
} = require('../backend/src/ai-questioning/subject-practice-chemistry-acid-base-solver');
const { buildSubjectPracticeQuestionPlan } = require('../backend/src/ai-questioning/subject-practice-question-plan-policy');

const BENCHMARK_VERSION = 'chemistry-strong-acid-base-programmatic-mutation-v3';
const TASK_FAMILY = 'ph_dilution_strong_acid_base_neutralization';
const questionPlan = buildSubjectPracticeQuestionPlan({
  subject: 'chemistry',
  topicTitle: '溶液浓度与pH计算',
  productionCellId: '41',
  targetDifficulty: 'medium',
  taskFamily: TASK_FAMILY
});

function rounded(value) {
  return Math.round(value * 100) / 100;
}

function orderedOptions(values, correctIndex) {
  const correct = values[0];
  const ordered = values.slice(1);
  ordered.splice(correctIndex, 0, correct);
  return {
    options: ordered.map((text, index) => ({ id: String.fromCharCode(65 + index), text })),
    correctAnswer: String.fromCharCode(65 + correctIndex)
  };
}

function candidate(prompt, values, correctIndex, explanation) {
  const ordered = orderedOptions(values, correctIndex);
  return {
    subject: 'chemistry',
    topicId: 642,
    blueprintId: 44,
    sourceType: 'ai',
    designedDifficulty: 'medium',
    questionType: 'single_choice',
    prompt,
    options: ordered.options,
    correctAnswer: ordered.correctAnswer,
    explanation,
    knowledgeTags: ['溶液浓度与pH计算', '强酸强碱'],
    optionMetadata: [],
    syllabusVersion: '2025'
  };
}

function phOptions(expected) {
  const values = [expected, expected + 0.5, expected - 0.5, expected + 1, expected - 1, 7, 14 - expected]
    .map(rounded)
    .filter((value) => value >= 0 && value <= 14);
  const unique = [...new Set(values)];
  if (unique.length < 4) throw new Error(`Unable to build four distinct pH options around ${expected}.`);
  return unique.slice(0, 4).map((value) => `pH=${value}`);
}

function plainPhOptions(expected) {
  return phOptions(expected).map((value) => value.replace(/^pH=/, ''));
}

function characterOptions(expected) {
  const labels = {
    acidic: '溶液呈酸性',
    neutral: '溶液呈中性',
    basic: '溶液呈碱性'
  };
  return [labels[expected], ...Object.entries(labels).filter(([key]) => key !== expected).map(([, value]) => value), '无法判断'];
}

function characterForPh(ph) {
  return Math.abs(ph - 7) < 1e-9 ? 'neutral' : ph < 7 ? 'acidic' : 'basic';
}

const goldCases = [];
for (let index = 0; index < 16; index += 1) {
  const initialPh = 1 + (index % 3);
  const factor = [10, 100][index % 2];
  const expected = initialPh + Math.log10(factor);
  for (const target of ['ph_value', 'acid_base_character']) {
    goldCases.push({
      id: `acid-dilution-${target}-${index}`,
      relationKind: 'strong_acid_dilution',
      answerTarget: target,
      candidate: candidate(
        target === 'ph_value'
          ? `将 pH=${initialPh} 的 HCl 强酸溶液稀释 ${factor} 倍，所得溶液 pH 是多少？`
          : `将 pH=${initialPh} 的 HCl 强酸溶液稀释 ${factor} 倍，所得溶液的酸碱性如何？`,
        target === 'ph_value' ? phOptions(expected) : characterOptions(characterForPh(expected)),
        index % 4,
        `强酸稀释后 pH=${expected}。`
      )
    });
  }
}
for (let index = 0; index < 16; index += 1) {
  const acid = index % 2 === 0;
  const species = acid ? '盐酸' : '氢氧化钠';
  const concentration = [0.01, 0.1, 0.2, 0.5][index % 4];
  const initialVolume = [5, 10, 20, 25][index % 4];
  const factor = [10, 20, 50, 100][index % 4];
  const finalVolume = initialVolume * factor;
  const finalConcentration = concentration / factor;
  const expected = acid ? -Math.log10(finalConcentration) : 14 + Math.log10(finalConcentration);
  for (const target of ['ph_value', 'acid_base_character']) {
    goldCases.push({
      id: `volume-dilution-${acid ? 'acid' : 'base'}-${target}-${index}`,
      relationKind: acid ? 'strong_acid_dilution' : 'strong_base_dilution',
      answerTarget: target,
      candidate: candidate(
        target === 'ph_value'
          ? `${concentration} mol/L ${species} ${initialVolume} mL 稀释到 ${finalVolume} mL，pH 约为`
          : `${concentration} mol/L ${species} ${initialVolume} mL 稀释到 ${finalVolume} mL，所得溶液的酸碱性如何？`,
        target === 'ph_value' ? plainPhOptions(rounded(expected)) : characterOptions(characterForPh(expected)),
        index % 4,
        `稀释后浓度为 ${finalConcentration} mol/L，pH约为${rounded(expected)}。`
      )
    });
  }
}
for (let index = 0; index < 16; index += 1) {
  const initialPh = 11 + (index % 3);
  const factor = [10, 100][index % 2];
  const expected = initialPh - Math.log10(factor);
  for (const target of ['ph_value', 'acid_base_character']) {
    goldCases.push({
      id: `base-dilution-${target}-${index}`,
      relationKind: 'strong_base_dilution',
      answerTarget: target,
      candidate: candidate(
        target === 'ph_value'
          ? `将 pH=${initialPh} 的 NaOH 强碱溶液稀释 ${factor} 倍，所得溶液 pH 是多少？`
          : `将 pH=${initialPh} 的 NaOH 强碱溶液稀释 ${factor} 倍，所得溶液的酸碱性如何？`,
        target === 'ph_value' ? phOptions(expected) : characterOptions(characterForPh(expected)),
        index % 4,
        `强碱稀释后 pH=${expected}。`
      )
    });
  }
}
for (let index = 0; index < 16; index += 1) {
  const acidVolume = 10 + (index % 5) * 5;
  const baseVolume = 10 + ((index * 3) % 5) * 5;
  const acidConcentration = [0.05, 0.1, 0.2, 0.25][index % 4];
  const baseConcentration = [0.05, 0.1, 0.2, 0.25][(index + 1) % 4];
  const acidMoles = acidVolume * 0.001 * acidConcentration;
  const baseMoles = baseVolume * 0.001 * baseConcentration;
  const excess = acidMoles - baseMoles;
  const totalVolume = (acidVolume + baseVolume) * 0.001;
  const expected = Math.abs(excess) < 1e-12
    ? 7
    : excess > 0
      ? -Math.log10(excess / totalVolume)
      : 14 + Math.log10(Math.abs(excess) / totalVolume);
  for (const target of ['ph_value', 'acid_base_character']) {
    goldCases.push({
      id: `neutralization-${target}-${index}`,
      relationKind: 'strong_acid_base_neutralization',
      answerTarget: target,
      candidate: candidate(
        target === 'ph_value'
          ? `将 ${acidVolume} mL ${acidConcentration} mol/L HCl 与 ${baseVolume} mL ${baseConcentration} mol/L NaOH 混合，混合后 pH 是多少？`
          : `将 ${acidVolume} mL ${acidConcentration} mol/L HCl 与 ${baseVolume} mL ${baseConcentration} mol/L NaOH 混合，混合后溶液的酸碱性如何？`,
        target === 'ph_value' ? phOptions(rounded(expected)) : characterOptions(characterForPh(expected)),
        index % 4,
        `按一元强酸强碱物质的量比较并除以总体积，pH约为${rounded(expected)}。`
      )
    });
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function mutationsFor(gold) {
  const answerFlip = clone(gold.candidate);
  answerFlip.correctAnswer = answerFlip.correctAnswer === 'A' ? 'B' : 'A';
  const secondTrue = clone(gold.candidate);
  const correctText = secondTrue.options.find((option) => option.id === secondTrue.correctAnswer).text;
  secondTrue.options.find((option) => option.id !== secondTrue.correctAnswer).text = correctText;
  const weakSpecies = clone(gold.candidate);
  weakSpecies.prompt = gold.relationKind === 'strong_acid_dilution'
    ? weakSpecies.prompt.replace(/HCl|HNO3|盐酸|硝酸/, 'CH3COOH')
    : weakSpecies.prompt.replace(/NaOH|KOH|氢氧化钠|氢氧化钾/, 'NH3');
  const malformedQuantity = clone(gold.candidate);
  malformedQuantity.prompt = gold.relationKind === 'strong_acid_base_neutralization'
    ? malformedQuantity.prompt.replace('mol/L', 'mol')
    : gold.id.startsWith('volume-dilution-')
      ? malformedQuantity.prompt.replace(/稀释到\s*[0-9.]+\s*mL/, '稀释到某体积')
    : malformedQuantity.prompt.replace(/稀释\s+\d+\s*倍/, '加入一些水');
  return [
    { type: 'generator_answer_flip', candidate: answerFlip },
    { type: 'second_true_option', candidate: secondTrue },
    { type: 'weak_species_substitution', candidate: weakSpecies },
    { type: 'required_quantity_removed', candidate: malformedQuantity }
  ];
}

const goldResults = goldCases.map((gold) => ({
  ...gold,
  evidence: solveSubjectPracticeChemistryAcidBase(gold.candidate, { taskFamily: TASK_FAMILY, questionPlan })
}));
const mutationResults = goldCases.flatMap((gold) => mutationsFor(gold).map((mutation) => ({
  goldId: gold.id,
  type: mutation.type,
  evidence: solveSubjectPracticeChemistryAcidBase(mutation.candidate, { taskFamily: TASK_FAMILY, questionPlan })
})));
const goldVerified = goldResults.filter((item) => item.evidence.status === 'verified'
  && item.evidence.verificationScope.matched
  && item.evidence.relationKind === item.relationKind
  && item.evidence.answerTarget === item.answerTarget);
const mutationFalseAccepts = mutationResults.filter((item) => item.evidence.status === 'verified' && item.evidence.verificationScope.matched);
const stratumCounts = goldVerified.reduce((counts, item) => {
  const key = `${item.relationKind}:${item.answerTarget}`;
  counts[key] = (counts[key] || 0) + 1;
  return counts;
}, {});
const mutationTypeCounts = mutationResults.reduce((counts, item) => {
  counts[item.type] = (counts[item.type] || 0) + 1;
  return counts;
}, {});
const passed = goldVerified.length === goldCases.length && mutationFalseAccepts.length === 0;
const report = {
  mode: 'subject_practice_chemistry_strong_acid_base_solver_programmatic_mutation_benchmark',
  status: passed ? 'solver_subset_benchmark_passed_not_family_release_qualified' : 'solver_subset_benchmark_failed',
  solverVersion: SUBJECT_PRACTICE_CHEMISTRY_ACID_BASE_SOLVER_VERSION,
  scopeVersion: SUBJECT_PRACTICE_CHEMISTRY_ACID_BASE_SCOPE_VERSION,
  benchmarkVersion: BENCHMARK_VERSION,
  supportedRelations: ['strong_acid_dilution', 'strong_base_dilution', 'strong_acid_base_neutralization'],
  supportedAnswerTargets: ['ph_value', 'acid_base_character'],
  providerImpact: 'none_no_provider_call',
  dbImpact: 'none_no_database_connection',
  productionImpact: 'none_fixture_only_shadow',
  releaseQualification: false,
  releaseQualificationReason: 'restricted_strong_monoprotic_acid_base_grammar_without_sealed_official_holdout_or_family_total_coverage',
  goldCaseCount: goldCases.length,
  goldVerifiedCount: goldVerified.length,
  goldVerificationRate: goldVerified.length / goldCases.length,
  stratumCounts,
  mutationCaseCount: mutationResults.length,
  mutationDetectedCount: mutationResults.length - mutationFalseAccepts.length,
  mutationFalseAcceptCount: mutationFalseAccepts.length,
  mutationDetectionRate: (mutationResults.length - mutationFalseAccepts.length) / mutationResults.length,
  mutationTypeCounts,
  failures: [
    ...goldResults.filter((item) => !goldVerified.includes(item)).slice(0, 12).map((item) => ({ id: item.id, kind: 'gold', evidence: item.evidence })),
    ...mutationFalseAccepts.slice(0, 12).map((item) => ({ id: item.goldId, kind: item.type, evidence: item.evidence }))
  ]
};

if (require.main === module) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!passed) process.exitCode = 1;
}

module.exports = { report };

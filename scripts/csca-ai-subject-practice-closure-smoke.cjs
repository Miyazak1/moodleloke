const path = require('node:path');
const { loadEnv } = require('./load-env.cjs');

require('../backend/node_modules/ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs',
    moduleResolution: 'node',
    experimentalDecorators: true,
    emitDecoratorMetadata: true
  }
});

const { Prisma, PrismaClient } = require('../backend/node_modules/@prisma/client');
const { AIQuestioningService } = require('../backend/src/ai-questioning/ai-questioning.service');
const { QuestionGeneratorService } = require('../backend/src/ai-questioning/question-generator.service');
const { QuestionQualityService } = require('../backend/src/ai-questioning/question-quality.service');
const { QuestionReviewerService } = require('../backend/src/ai-questioning/question-reviewer.service');
const { QuestionTopicMapperProviderService } = require('../backend/src/ai-questioning/question-topic-mapper-provider.service');
const { QuestionValidatorService } = require('../backend/src/ai-questioning/question-validator.service');
const { AdaptiveQuestionProviderService } = require('../backend/src/csca-special-practice/adaptive-question-provider.service');

loadEnv(path.resolve(__dirname, '..'));
// This closure test owns its fixture providers. Do not let a developer's live
// AI flags change its control flow or trigger external regeneration.
process.env.CSCA_AI_QUESTION_GENERATION_ENABLED = 'false';
process.env.CSCA_AI_QUESTION_REVIEW_ENABLED = 'false';
process.env.CSCA_ALLOW_SMOKE_SUBJECTS = 'true';

const prisma = new PrismaClient();
const suffix = Date.now();
const subject = `smoke_math_${suffix}`;
const topicCode = `codex-subject-closure-${suffix}`;
const created = {
  syllabusImportId: null,
  topicId: null,
  sourceDocumentId: null,
  sourceQuestionId: null,
  styleProfileId: null,
  seriesProfileId: null,
  generationProfileId: null,
  blueprintId: null,
  jobId: null,
  questionId: null,
  publishedQuestionId: null,
  bridgeTopicId: null,
  extraJobIds: [],
  extraQuestionIds: [],
  extraPublishedQuestionIds: [],
  extraBridgeTopicIds: [],
  productionPlanningRunId: null,
  productionRunId: null,
  productionJobIds: [],
  productionQuestionIds: [],
  productionPublishedQuestionIds: [],
  bridgeTopicIds: []
};

function disabledGateway() {
  return {
    hasConfiguredKey: () => false,
    complete: async () => {
      throw new Error('Disabled AI Gateway should not be called in subject closure smoke fallback mode.');
    }
  };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function closureCandidate(blueprint, variant = 0) {
  const seed = Math.max(0, Number(variant) || 0);
  const family = seed % 12;
  const offset = Math.floor(seed / 12);
  const topicTitle = blueprint.topicTitle || 'Subject Practice Closure Topic';
  const zhTopicSignal = `在「${topicTitle}」专项中，`;
  const enTopicSignal = `For "${topicTitle}", `;
  const zhLeads = [
    '在函数复合与代入计算中，',
    '针对函数代入计算知识点，',
    '根据考纲中复合函数求值的要求，',
    '围绕代入求值与二次表达式运算，',
    '在函数运算与复合求值场景下，',
    '结合函数复合的计算方法，'
  ];
  const enLeads = [
    'For function composition and substitution, ',
    'For the function substitution objective, ',
    'Under the syllabus objective of evaluating composite functions, ',
    'For substitution with quadratic expressions, ',
    'In a function operation and composition setting, ',
    'Using the method of function composition, '
  ];
  const zhLead = zhLeads[family];
  const enLead = enLeads[family];
  let answer;
  let zhPrompt;
  let zhExplanation;
  let enPrompt;
  let enExplanation;

  if (blueprint.difficulty === 'basic') {
    const coefficient = 2 + (seed % 5);
    const constant = 1 + (Math.floor(seed / 5) % 5);
    const x = 2 + (seed % 4);
    answer = coefficient * x + constant;
    zhPrompt = `${zhTopicSignal}已知一次函数 f(x)=${coefficient}x+${constant}，直接计算 f(${x}) 的值。`;
    zhExplanation = `将 x=${x} 代入一次函数，f(${x})=${coefficient}×${x}+${constant}=${answer}。`;
    enPrompt = `${enTopicSignal}given the linear function f(x)=${coefficient}x+${constant}, directly calculate f(${x}).`;
    enExplanation = `Substitute x=${x}: f(${x})=${coefficient}×${x}+${constant}=${answer}.`;
  } else if (blueprint.difficulty === 'hard') {
    const hardFamily = family % 4;
    const a = 1 + (seed % 5);
    const b = 2 + (Math.floor(seed / 5) % 5);
    if (hardFamily === 0) {
      const f1 = 1 + a + b;
      const f2 = 4 + (2 * a) + b;
      answer = (16 + (4 * a) + b) + a + b;
      zhPrompt = `${zhTopicSignal}已知二次函数 f(x)=x^2+ax+b，其中参数 a,b∈R，同时满足 f(1)=${f1}、f(2)=${f2}。下列哪个数值等于 f(4)+a+b？`;
      zhExplanation = `由 f(1)=${f1} 与 f(2)=${f2} 联立，得 a=${a}、b=${b}。因此 f(4)+a+b=${16 + (4 * a) + b}+${a}+${b}=${answer}。`;
      enPrompt = `${enTopicSignal}given f(x)=x^2+ax+b, where a,b∈R, and the simultaneous conditions f(1)=${f1} and f(2)=${f2} hold, which value equals f(4)+a+b?`;
      enExplanation = `Solving f(1)=${f1} and f(2)=${f2} gives a=${a} and b=${b}. Hence f(4)+a+b=${16 + (4 * a) + b}+${a}+${b}=${answer}.`;
    } else if (hardFamily === 1) {
      const p1 = a + b;
      const p3 = (3 * a) + b;
      const r = 1 + (seed % 4);
      const p2 = (2 * a) + b;
      answer = (p2 * p2) - r + (a * b);
      zhPrompt = `${zhTopicSignal}设 P(x)=mx+n、Q(x)=x^2-${r}，其中 m,n 为实参数。已知 P(1)=${p1}，并且 P(3)=${p3}。下列哪个数值等于 Q(P(2))+mn？`;
      zhExplanation = `由 m+n=${p1} 与 3m+n=${p3} 解得 m=${a}、n=${b}。P(2)=${p2}，故 Q(P(2))+mn=${p2}^2-${r}+${a}×${b}=${answer}。`;
      enPrompt = `${enTopicSignal}let P(x)=mx+n and Q(x)=x^2-${r}, where m,n are real parameters. Given P(1)=${p1} and P(3)=${p3}, which value equals Q(P(2))+mn?`;
      enExplanation = `Solving m+n=${p1} and 3m+n=${p3} gives m=${a}, n=${b}. Thus P(2)=${p2} and Q(P(2))+mn=${p2}^2-${r}+${a}×${b}=${answer}.`;
    } else if (hardFamily === 2) {
      const u = a + b;
      const v = (2 * a) + b;
      const c = 2 + (seed % 3);
      answer = ((v + c) * (v + c)) - (u * u) + a;
      zhPrompt = `${zhTopicSignal}已知一次函数 T(x)=px+q，其中 p,q 是未知实参数，且同时满足 T(1)=${u}、T(2)=${v}。再定义 R(y)=(y+${c})^2。以下哪一个数值是 R(T(2))-[T(1)]^2+p？`;
      zhExplanation = `联立 p+q=${u}、2p+q=${v}，得到 p=${a}、q=${b}。代入复合表达式可得 (${v}+${c})^2-${u}^2+${a}=${answer}。`;
      enPrompt = `${enTopicSignal}given the affine function T(x)=px+q, where p,q are unknown real parameters, and the simultaneous conditions T(1)=${u}, T(2)=${v} hold, define R(y)=(y+${c})^2. Which value is R(T(2))-[T(1)]^2+p?`;
      enExplanation = `From p+q=${u} and 2p+q=${v}, p=${a} and q=${b}. Substitution gives (${v}+${c})^2-${u}^2+${a}=${answer}.`;
    } else {
      const fNeg = 1 - a + b;
      const fPos = 1 + a + b;
      answer = (9 + (3 * a) + b) - b + a;
      zhPrompt = `${zhTopicSignal}给定 F(t)=t^2+ct+d，其中实参数 c,d∈R。若 F(-1)=${fNeg}，同时 F(1)=${fPos}，并满足上述两个条件，判断下列哪一个结果等于 F(3)-F(0)+c。`;
      zhExplanation = `由 1-c+d=${fNeg}、1+c+d=${fPos} 可求得 c=${a}、d=${b}。所以 F(3)-F(0)+c=${9 + (3 * a) + b}-${b}+${a}=${answer}。`;
      enPrompt = `${enTopicSignal}let F(t)=t^2+ct+d, where the real parameters c,d∈R satisfy both conditions F(-1)=${fNeg} and F(1)=${fPos}. Which result equals F(3)-F(0)+c?`;
      enExplanation = `The equations 1-c+d=${fNeg} and 1+c+d=${fPos} give c=${a}, d=${b}. Therefore F(3)-F(0)+c=${9 + (3 * a) + b}-${b}+${a}=${answer}.`;
    }
  } else if (family === 0) {
    const p = 4 + offset;
    const q = 2;
    answer = (p * p - p + 1) - (q * q - q + 1);
    zhPrompt = `${zhTopicSignal}${zhLead}已知 f(x)=2x+1，g(x)=x^2-3x。若 h(x)=f(x)+g(x)，求 h(${p})-h(${q}) 的值。`;
    zhExplanation = `由 h(x)=f(x)+g(x)=x^2-x+1，得 h(${p})=${p * p - p + 1}，h(${q})=${q * q - q + 1}，所以差为 ${answer}。`;
    enPrompt = `${enTopicSignal}${enLead}given f(x)=2x+1 and g(x)=x^2-3x. If h(x)=f(x)+g(x), find h(${p})-h(${q}).`;
    enExplanation = `h(x)=f(x)+g(x)=x^2-x+1. Thus h(${p})=${p * p - p + 1} and h(${q})=${q * q - q + 1}, so the difference is ${answer}.`;
  } else if (family === 1) {
    const a = 3 + offset;
    const b = 2 + offset;
    const x = 3;
    answer = (x * x + a) - (3 * x - b);
    zhPrompt = `${zhTopicSignal}${zhLead}设 F(x)=x^2+${a}，G(x)=3x-${b}。若 H(x)=F(x)-G(x)，求 H(${x})。`;
    zhExplanation = `H(${x})=F(${x})-G(${x})=(${x * x}+${a})-(${3 * x}-${b})=${answer}。`;
    enPrompt = `${enTopicSignal}${enLead}let F(x)=x^2+${a} and G(x)=3x-${b}. If H(x)=F(x)-G(x), find H(${x}).`;
    enExplanation = `H(${x})=F(${x})-G(${x})=(${x * x}+${a})-(${3 * x}-${b})=${answer}.`;
  } else if (family === 2) {
    const c = 2 + offset;
    const x = 4;
    answer = (x + c) * (x + c) - (x - c);
    zhPrompt = `${zhTopicSignal}${zhLead}函数 P(t)=(t+${c})^2-(t-${c})。求 P(${x}) 的值。`;
    zhExplanation = `P(${x})=(${x}+${c})^2-(${x}-${c})=${(x + c) * (x + c)}-${x - c}=${answer}。`;
    enPrompt = `${enTopicSignal}${enLead}the function P(t)=(t+${c})^2-(t-${c}). Find P(${x}).`;
    enExplanation = `P(${x})=(${x}+${c})^2-(${x}-${c})=${(x + c) * (x + c)}-${x - c}=${answer}.`;
  } else if (family === 3) {
    const m = 2 + offset;
    const x = 2;
    const inner = x + m;
    answer = inner * inner + m * inner;
    zhPrompt = `${zhTopicSignal}${zhLead}已知 u(x)=x^2+${m}x，v(x)=x+${m}。求 u(v(${x}))。`;
    zhExplanation = `v(${x})=${inner}，所以 u(v(${x}))=u(${inner})=${inner}^2+${m}×${inner}=${answer}。`;
    enPrompt = `${enTopicSignal}${enLead}u(x)=x^2+${m}x and v(x)=x+${m}. Find u(v(${x})).`;
    enExplanation = `v(${x})=${inner}, so u(v(${x}))=u(${inner})=${inner}^2+${m}×${inner}=${answer}.`;
  } else if (family === 4) {
    const k = 2 + offset;
    const x = 3;
    const inner = 2 * x - 1;
    answer = inner * inner - k;
    zhPrompt = `${zhTopicSignal}${zhLead}设 A(x)=x^2-${k}，B(x)=2x-1。求 A(B(${x})) 的值。`;
    zhExplanation = `B(${x})=${inner}，因此 A(B(${x}))=A(${inner})=${inner}^2-${k}=${answer}。`;
    enPrompt = `${enTopicSignal}${enLead}let A(x)=x^2-${k} and B(x)=2x-1. Find A(B(${x})).`;
    enExplanation = `B(${x})=${inner}, so A(B(${x}))=A(${inner})=${inner}^2-${k}=${answer}.`;
  } else if (family === 5) {
    const c = 3 + offset;
    const x = 2;
    const first = x * x + c;
    answer = 2 * first - c;
    zhPrompt = `${zhTopicSignal}${zhLead}设 M(x)=x^2+${c}，N(x)=2x-${c}。求 N(M(${x})) 的值。`;
    zhExplanation = `M(${x})=${first}，所以 N(M(${x}))=2×${first}-${c}=${answer}。`;
    enPrompt = `${enTopicSignal}${enLead}let M(x)=x^2+${c} and N(x)=2x-${c}. Find N(M(${x})).`;
    enExplanation = `M(${x})=${first}, so N(M(${x}))=2×${first}-${c}=${answer}.`;
  } else if (family === 6) {
    const b = 3 + offset;
    const delta = 15 + (3 * offset);
    const x1 = 4;
    const x2 = 1;
    answer = delta / (x1 - x2);
    zhPrompt = `${zhTopicSignal}若一次函数 T(x)=ax+${b} 满足 T(${x1})-T(${x2})=${delta}，求参数 a。`;
    zhExplanation = `T(${x1})-T(${x2})=a(${x1}-${x2})=${x1 - x2}a=${delta}，所以 a=${answer}。`;
    enPrompt = `${enTopicSignal}if the linear function T(x)=ax+${b} satisfies T(${x1})-T(${x2})=${delta}, find a.`;
    enExplanation = `T(${x1})-T(${x2})=a(${x1}-${x2})=${x1 - x2}a=${delta}, so a=${answer}.`;
  } else if (family === 7) {
    const shift = 2 + offset;
    const x = 3;
    const target = 25 + 5 * offset;
    answer = target / (x + shift);
    zhPrompt = `${zhTopicSignal}已知 f(x)=x+${shift}，g(x)=kx，且 g(f(${x}))=${target}。求 k。`;
    zhExplanation = `f(${x})=${x + shift}，g(f(${x}))=k(${x + shift})=${target}，所以 k=${answer}。`;
    enPrompt = `${enTopicSignal}given f(x)=x+${shift}, g(x)=kx, and g(f(${x}))=${target}, find k.`;
    enExplanation = `f(${x})=${x + shift}; g(f(${x}))=k(${x + shift})=${target}, so k=${answer}.`;
  } else if (family === 8) {
    const a = 2 + offset;
    const b = 5 + offset;
    const x = 2;
    answer = (a * x + b) * (a * x + b) - b;
    zhPrompt = `${zhTopicSignal}设 R(x)=x^2-${b}，S(x)=${a}x+${b}。求 R(S(${x})) 的值。`;
    zhExplanation = `S(${x})=${a * x + b}，R(S(${x}))=(${a * x + b})^2-${b}=${answer}。`;
    enPrompt = `${enTopicSignal}let R(x)=x^2-${b} and S(x)=${a}x+${b}. Find R(S(${x})).`;
    enExplanation = `S(${x})=${a * x + b}, so R(S(${x}))=(${a * x + b})^2-${b}=${answer}.`;
  } else if (family === 9) {
    const p = 2 + offset;
    const q = 3;
    answer = (p + q) * (p + q) - (p * p + q);
    zhPrompt = `${zhTopicSignal}已知 A(t)=t^2+t，比较 A(${p + q}) 与 A(${p})+${q}，求二者的差值。`;
    zhExplanation = `A(${p + q})=${(p + q) * (p + q) + p + q}，A(${p})+${q}=${p * p + p + q}，差值为 ${answer}。`;
    enPrompt = `${enTopicSignal}for A(t)=t^2+t, compare A(${p + q}) with A(${p})+${q}. Find the difference.`;
    enExplanation = `A(${p + q})=${(p + q) * (p + q) + p + q}; A(${p})+${q}=${p * p + p + q}, so the difference is ${answer}.`;
  } else if (family === 10) {
    const r = 2 + offset;
    const x = 4;
    answer = (x - r) * (x - r) + r * (x - r);
    zhPrompt = `${zhTopicSignal}函数 U(x)=x^2+${r}x，V(x)=x-${r}。求 U(V(${x}))。`;
    zhExplanation = `V(${x})=${x - r}，因此 U(V(${x}))=(${x - r})^2+${r}(${x - r})=${answer}。`;
    enPrompt = `${enTopicSignal}U(x)=x^2+${r}x and V(x)=x-${r}. Find U(V(${x})).`;
    enExplanation = `V(${x})=${x - r}, so U(V(${x}))=(${x - r})^2+${r}(${x - r})=${answer}.`;
  } else {
    const n = 4 + offset;
    const x = 2;
    answer = (x + n) * (x + n) - (2 * x + n);
    zhPrompt = `${zhTopicSignal}设 C(x)=(x+${n})^2，D(x)=2x+${n}。求 C(${x})-D(${x})。`;
    zhExplanation = `C(${x})=(${x}+${n})^2=${(x + n) * (x + n)}，D(${x})=${2 * x + n}，所以差为 ${answer}。`;
    enPrompt = `${enTopicSignal}let C(x)=(x+${n})^2 and D(x)=2x+${n}. Find C(${x})-D(${x}).`;
    enExplanation = `C(${x})=(${x}+${n})^2=${(x + n) * (x + n)} and D(${x})=${2 * x + n}, so the difference is ${answer}.`;
  }
  const zhOptions = [
    { id: 'A', text: String(answer) },
    { id: 'B', text: String(answer - 1) },
    { id: 'C', text: String(answer + 1) },
    { id: 'D', text: String(answer + 2) }
  ];
  const enOptions = [
    { id: 'A', text: String(answer) },
    { id: 'B', text: String(answer - 1) },
    { id: 'C', text: String(answer + 1) },
    { id: 'D', text: String(answer + 2) }
  ];
  return {
    subject: blueprint.subject,
    topicId: blueprint.topicId,
    blueprintId: blueprint.id,
    sourceType: 'ai',
    designedDifficulty: blueprint.difficulty,
    questionType: blueprint.questionType,
    prompt: zhPrompt,
    options: zhOptions,
    correctAnswer: 'A',
    explanation: zhExplanation,
    knowledgeTags: ['function-composition', 'substitution', 'calculation', topicTitle],
    optionMetadata: [
      { optionId: 'B', distractorIntent: 'subtracts one from the final value', misconceptionTags: ['calculation_error'] },
      { optionId: 'C', distractorIntent: 'adds one to the final value', misconceptionTags: ['calculation_error'] },
      { optionId: 'D', distractorIntent: 'uses one intermediate value as the final answer', misconceptionTags: ['substitution_error'] }
    ],
    localizations: {
      zh: {
        prompt: zhPrompt,
        options: zhOptions,
        explanation: zhExplanation,
        knowledgeTags: ['函数复合', '代入计算']
      },
      en: {
        prompt: enPrompt,
        options: enOptions,
        explanation: enExplanation,
        knowledgeTags: ['function composition', 'substitution']
      }
    },
    syllabusVersion: blueprint.syllabusVersion
  };
}

class ClosureQuestionGeneratorProvider {
  constructor() {
    this.variant = 0;
  }

  async generate(blueprint) {
    const candidate = closureCandidate(blueprint, this.variant);
    this.variant += 1;
    return {
      candidate,
      rawOutput: candidate,
      normalizedOutput: candidate,
      promptMetadata: { closureSmoke: true },
      agent: {
        role: 'generator',
        name: 'subject-practice-closure-generator',
        provider: 'closure-fixture',
        model: 'closure-fixture',
        promptVersion: 'closure-subject-practice-v1'
      },
      provider: 'closure-fixture',
      model: 'closure-fixture',
      status: 'success'
    };
  }
}

class ClosureQuestionReviewerProvider {
  async review() {
    return {
      issues: [],
      dimensions: [],
      provider: {
        provider: 'closure-fixture',
        model: 'closure-reviewer',
        status: 'success'
      }
    };
  }

  agentIdentity(provider) {
    return {
      role: 'reviewer',
      name: 'subject-practice-closure-reviewer',
      provider: provider?.provider || 'closure-fixture',
      model: provider?.model || 'closure-reviewer',
      promptVersion: 'closure-reviewer-v1'
    };
  }
}

async function cleanup() {
  const productionRunIds = Array.from(new Set([
    created.productionPlanningRunId,
    created.productionRunId
  ].filter((id) => Number.isInteger(id) && id > 0)));
  const productionRunIdStrings = productionRunIds.map((id) => String(id));
  const publishedQuestionIds = Array.from(new Set([
    created.publishedQuestionId,
    ...created.extraPublishedQuestionIds,
    ...created.productionPublishedQuestionIds
  ].filter((id) => Number.isInteger(id) && id > 0)));
  const questionIds = Array.from(new Set([
    created.questionId,
    ...created.extraQuestionIds,
    ...created.productionQuestionIds
  ].filter((id) => Number.isInteger(id) && id > 0)));
  const jobIds = Array.from(new Set([
    created.jobId,
    ...created.extraJobIds,
    ...created.productionJobIds
  ].filter((id) => Number.isInteger(id) && id > 0)));
  const bridgeTopicIds = Array.from(new Set([
    created.bridgeTopicId,
    ...created.extraBridgeTopicIds,
    ...created.bridgeTopicIds
  ].filter((id) => Number.isInteger(id) && id > 0)));

  if (publishedQuestionIds.length) {
    await prisma.$executeRaw`
      DELETE FROM "csca_topic_mappings"
      WHERE "source_type" = 'special_practice_question'
        AND "source_id" IN (${Prisma.join(publishedQuestionIds)})
    `;
    await prisma.$executeRaw`
      DELETE FROM "special_practice_questions"
      WHERE "id" IN (${Prisma.join(publishedQuestionIds)})
    `;
  }
  if (bridgeTopicIds.length) {
    await prisma.$executeRaw`
      DELETE FROM "csca_topic_mappings"
      WHERE "source_type" = 'special_practice_topic'
        AND "source_id" IN (${Prisma.join(bridgeTopicIds)})
    `;
    await prisma.$executeRaw`
      DELETE FROM "special_practice_topics"
      WHERE "id" IN (${Prisma.join(bridgeTopicIds)})
    `;
  }
  if (jobIds.length || productionRunIds.length) {
    await prisma.$executeRaw`
      DELETE FROM "csca_ai_generation_jobs"
      WHERE (${jobIds.length ? Prisma.sql`"id" IN (${Prisma.join(jobIds)})` : Prisma.sql`false`})
         OR (${productionRunIdStrings.length ? Prisma.sql`"prompt_metadata"->>'productionRunId' IN (${Prisma.join(productionRunIdStrings)})` : Prisma.sql`false`})
    `;
  }
  if (questionIds.length || productionRunIds.length) {
    await prisma.$executeRaw`
      DELETE FROM "csca_questions"
      WHERE (${questionIds.length ? Prisma.sql`"id" IN (${Prisma.join(questionIds)})` : Prisma.sql`false`})
         OR (${productionRunIdStrings.length ? Prisma.sql`"generation_metadata"->>'productionRunId' IN (${Prisma.join(productionRunIdStrings)})` : Prisma.sql`false`})
    `;
  }
  if (productionRunIds.length) {
    await prisma.$executeRaw`
      DELETE FROM "csca_subject_practice_production_runs"
      WHERE "id" IN (${Prisma.join(productionRunIds)})
    `;
  }
  if (created.blueprintId) {
    await prisma.$executeRaw`
      DELETE FROM "csca_question_blueprints"
      WHERE "id" = ${created.blueprintId}
    `;
  }
  if (created.styleProfileId) {
    await prisma.$executeRaw`
      DELETE FROM "csca_question_style_profiles"
      WHERE "id" = ${created.styleProfileId}
    `;
  }
  if (created.generationProfileId) {
    await prisma.$executeRaw`
      DELETE FROM "csca_generation_profiles"
      WHERE "id" = ${created.generationProfileId}
    `;
  }
  if (created.seriesProfileId) {
    await prisma.$executeRaw`
      DELETE FROM "csca_exam_series_profiles"
      WHERE "id" = ${created.seriesProfileId}
    `;
  }
  if (created.sourceDocumentId) {
    await prisma.$executeRaw`
      DELETE FROM "csca_source_documents"
      WHERE "id" = ${created.sourceDocumentId}
    `;
  }
  if (created.topicId) {
    await prisma.$executeRaw`
      DELETE FROM "csca_exam_topics"
      WHERE "id" = ${created.topicId}
    `;
  }
  if (created.syllabusImportId) {
    await prisma.$executeRaw`
      DELETE FROM "csca_syllabus_imports"
      WHERE "id" = ${created.syllabusImportId}
    `;
  }
}

async function main() {
  assert(process.env.DATABASE_URL, 'DATABASE_URL is required for subject-practice closure smoke.');

  const [syllabusImport] = await prisma.$queryRaw`
    INSERT INTO "csca_syllabus_imports" (
      "subject", "syllabus_version", "source_label", "status", "raw_json", "preview_summary",
      "applied_at", "updated_at"
    )
    VALUES (
      ${subject}, '2025', ${`Subject Practice Closure Syllabus ${suffix}`}, 'applied',
      ${JSON.stringify({
        schemaVersion: 'csca-syllabus-v1',
        subject,
        syllabusVersion: '2025',
        topics: [{ code: topicCode, title: 'Subject Practice Closure Topic' }]
      })}::jsonb,
      ${JSON.stringify({ items: [{ code: topicCode, title: 'Subject Practice Closure Topic', status: 'published' }] })}::jsonb,
      CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
    RETURNING "id"
  `;
  created.syllabusImportId = syllabusImport.id;

  const [topic] = await prisma.$queryRaw`
    INSERT INTO "csca_exam_topics" (
      "subject", "module", "code", "title", "description", "exam_scope", "syllabus_version",
      "weight", "allowed_question_types", "difficulty_range", "status"
    )
    VALUES (
      ${subject}, 'Closure', ${topicCode}, 'Subject Practice Closure Topic',
      'Verifies AI subject-practice formal publication.',
      'Compose simple polynomial functions and evaluate differences using substitution.',
      '2025', 1,
      ${JSON.stringify(['single_choice'])}::jsonb,
      ${JSON.stringify(['basic', 'medium', 'hard'])}::jsonb,
      'published'
    )
    RETURNING "id"
  `;
  created.topicId = topic.id;

  const [sourceDocument] = await prisma.$queryRaw`
    INSERT INTO "csca_source_documents" (
      "subject", "source_type", "title", "exam_year", "exam_session", "language",
      "file_hash", "source_label", "license_scope", "usage_policy", "status", "updated_at"
    )
    VALUES (
      ${subject}, 'past_paper', ${`Subject Practice Closure Source ${suffix}`}, 2026, 'closure', 'zh',
      ${`closure-file-${suffix}`}, 'Subject practice closure fixture',
      'internal_analysis', ${JSON.stringify({ allowAIProfile: true, allowStyleExtraction: true, allowQuestionGenerationReference: true })}::jsonb, 'active', CURRENT_TIMESTAMP
    )
    RETURNING "id"
  `;
  created.sourceDocumentId = sourceDocument.id;

  const [sourceQuestion] = await prisma.$queryRaw`
    INSERT INTO "csca_source_questions" (
      "document_id", "subject", "question_number", "language", "prompt_hash", "prompt_text",
      "options", "correct_answer", "explanation", "syllabus_version", "topic_id", "topic_codes",
      "blueprint_like_tags", "analysis", "analysis_status", "analysis_confidence", "analysis_issues",
      "review_status", "auto_profile_status", "updated_at"
    )
    VALUES (
      ${created.sourceDocumentId}, ${subject}, 'closure-1', 'zh', ${`closure-prompt-${suffix}`},
      '数列 a_n=2n+1。若 b_n=a_n+3，求 b_5-b_2 的值。',
      ${JSON.stringify([
        { id: 'A', text: '5' },
        { id: 'B', text: '6' },
        { id: 'C', text: '7' },
        { id: 'D', text: '8' }
      ])}::jsonb,
      'B',
      'b_5=(2×5+1)+3=14，b_2=(2×2+1)+3=8，所以 b_5-b_2=6。',
      '2025', ${created.topicId}, ${JSON.stringify([topicCode])}::jsonb,
      ${JSON.stringify(['formula_calculation', 'calculation_application'])}::jsonb,
      ${JSON.stringify({ profile: { questionForm: 'formula_calculation', cognitiveSkill: 'calculation_application', difficultyBand: 'medium', readingLoad: 'high', calculationLoad: 'medium' } })}::jsonb,
      'human_confirmed', 0.98, ${JSON.stringify([])}::jsonb,
      'mapped', 'auto_approved', CURRENT_TIMESTAMP
    )
    RETURNING "id"
  `;
  created.sourceQuestionId = sourceQuestion.id;

  const profile = {
    questionFormDistribution: { formula_calculation: 1 },
    commonQuestionForms: ['formula_calculation'],
    cognitiveSkillDistribution: { calculation_application: 1 },
    commonCognitiveSkills: ['calculation_application'],
    difficultyDistribution: { medium: 1 },
    readingLoadDistribution: { high: 1 },
    calculationLoadDistribution: { medium: 1 },
    optionPatterns: {
      commonDistractorTypes: ['calculation_error', 'substitution_order'],
      commonMisconceptions: ['substitution_order']
    },
    estimatedTimeSeconds: { p50: 90 }
  };
  const [styleProfile] = await prisma.$queryRaw`
    INSERT INTO "csca_question_style_profiles" (
      "subject", "syllabus_version", "scope_type", "scope_id", "source_question_ids",
      "sample_size", "confidence", "profile", "profile_version", "source_question_snapshot_hash",
      "status", "generated_by", "updated_at"
    )
    VALUES (
      ${subject}, '2025', 'topic', ${created.topicId}, ${JSON.stringify([created.sourceQuestionId])}::jsonb,
      1, 'high', ${JSON.stringify(profile)}::jsonb, 1, ${`closure-${suffix}`},
      'active', 'closure-check', CURRENT_TIMESTAMP
    )
    RETURNING "id"
  `;
  created.styleProfileId = styleProfile.id;

  const [blueprint] = await prisma.$queryRaw`
    INSERT INTO "csca_question_blueprints" (
      "subject", "topic_id", "difficulty", "question_type", "skill", "source", "constraints", "status"
    )
    VALUES (
      ${subject}, ${created.topicId}, 'medium', 'single_choice', 'function composition',
      'closure_smoke', ${JSON.stringify({})}::jsonb, 'active'
    )
    RETURNING "id"
  `;
  created.blueprintId = blueprint.id;

  const service = new AIQuestioningService(
    prisma,
    new QuestionGeneratorService(),
    new ClosureQuestionGeneratorProvider(),
    new QuestionReviewerService(new QuestionValidatorService(), new ClosureQuestionReviewerProvider()),
    new QuestionTopicMapperProviderService(disabledGateway()),
    new QuestionQualityService(prisma)
  );
  const adaptiveProvider = new AdaptiveQuestionProviderService(prisma);

  const seriesProfile = await service.generateExamSeriesProfile({
    subject,
    syllabusVersion: '2025',
    title: `Subject Practice Closure Trend ${suffix}`
  });
  created.seriesProfileId = seriesProfile.profile.id;
  const generationProfile = await service.generateGenerationProfile({
    subject,
    syllabusVersion: '2025',
    useCase: 'subject_practice',
    seriesProfileId: seriesProfile.profile.id
  });
  created.generationProfileId = generationProfile.profile.id;
  await prisma.$executeRaw`
    UPDATE "csca_generation_profiles"
    SET "sample_size" = 48,
        "confidence" = 'medium',
        "updated_at" = CURRENT_TIMESTAMP
    WHERE "id" = ${created.generationProfileId}
  `;

  const readiness = await service.subjectPracticeGenerationReadiness(subject, '2025');
  assert(readiness.ready, `Subject-practice closure smoke readiness should be ready. got=${JSON.stringify(readiness)}`);

  const queued = await service.enqueueGenerationJobs({ blueprintIds: [created.blueprintId], limit: 1, force: true });
  assert(queued.enqueued === 1 && queued.items[0]?.id, `Subject-practice closure smoke should enqueue one generation job. got=${JSON.stringify(queued)}`);
  created.jobId = queued.items[0].id;

  const job = await service.retryGenerationJob(created.jobId);
  assert(job.status === 'succeeded', `Generation job should succeed. error=${job.error || 'none'}`);
  created.questionId = job.questionId;
  assert(created.questionId, 'Generation job should create a question.');

  const [question] = await prisma.$queryRaw`
    SELECT "id", "status", "source_question_id" AS "sourceQuestionId",
           "generation_metadata" AS "generationMetadata", "review_metadata" AS "reviewMetadata"
    FROM "csca_questions"
    WHERE "id" = ${created.questionId}
    LIMIT 1
  `;
  assert(question?.status === 'approved', `Generated subject-practice question should auto-approve. status=${question?.status}; gate=${JSON.stringify(question?.reviewMetadata?.gate ?? null)}; approvalGate=${JSON.stringify(question?.reviewMetadata?.approvalGate ?? null)}; generation=${JSON.stringify({
    intendedUse: question?.generationMetadata?.intendedUse,
    scope: question?.generationMetadata?.scope,
    targetProfile: question?.generationMetadata?.targetProfile,
    localizations: Boolean(question?.generationMetadata?.localizations)
  })}; review=${JSON.stringify({
    score: question?.reviewMetadata?.score,
    issues: question?.reviewMetadata?.issues,
    rubric: question?.reviewMetadata?.rubric,
    profileAlignment: question?.reviewMetadata?.profileAlignment
  })}`);
  assert(question.sourceQuestionId, 'Auto-approved subject-practice question should publish into special_practice_questions.');
  assert(question.reviewMetadata?.subjectPracticeAutoApproval?.status === 'published_to_subject_practice', 'AI question must record formal subject-practice publication metadata.');
  created.publishedQuestionId = question.sourceQuestionId;

  const [published] = await prisma.$queryRaw`
    SELECT spq."id", spq."status", mapping."topic_id" AS "topicId", spt."id" AS "bridgeTopicId"
    FROM "special_practice_questions" spq
    JOIN "csca_topic_mappings" mapping
      ON mapping."source_type" = 'special_practice_question'
     AND mapping."source_id" = spq."id"
    JOIN "special_practice_topics" spt ON spt."id" = spq."topic_id"
    WHERE spq."id" = ${created.publishedQuestionId}
    LIMIT 1
  `;
  assert(published?.status === 'published', 'Published special-practice question should be available.');
  assert(published.topicId === created.topicId, 'Published question should map back to the source CSCA topic.');
  created.bridgeTopicId = published.bridgeTopicId;

  const selected = await adaptiveProvider.pickQuestions(910777, [{
    topicId: created.topicId,
    code: topicCode,
    title: 'Subject Practice Closure Topic',
    module: 'Closure',
    targetDifficulty: 'medium',
    reason: 'closure-smoke'
  }], 1);
  assert(
    selected.some((item) => item.questionSource === 'special_practice' && item.questionId === created.publishedQuestionId),
    'Adaptive subject-practice provider should select the auto-published formal question.'
  );

  const extraQueued = await service.enqueueGenerationJobs({ blueprintIds: [created.blueprintId], limit: 1, force: true, expand: true, count: 2, perBlueprint: 2, batchId: `closure-extra-${suffix}` });
  assert(extraQueued.enqueued === 2 && extraQueued.items.every((item) => item?.id), 'Subject-practice closure smoke should enqueue two extra formal inventory jobs.');
  for (const extraItem of extraQueued.items) {
    created.extraJobIds.push(extraItem.id);
    const extraJob = await service.retryGenerationJob(extraItem.id);
    assert(extraJob.status === 'succeeded' && extraJob.questionId, `Extra formal inventory job should succeed. error=${extraJob.error || 'none'}`);
    created.extraQuestionIds.push(extraJob.questionId);
    const [extraQuestion] = await prisma.$queryRaw`
      SELECT "id", "status", "source_question_id" AS "sourceQuestionId",
             "generation_metadata" AS "generationMetadata", "review_metadata" AS "reviewMetadata"
      FROM "csca_questions"
      WHERE "id" = ${extraJob.questionId}
      LIMIT 1
    `;
    assert(extraQuestion?.status === 'approved', `Extra formal inventory question should auto-approve. status=${extraQuestion?.status}; gate=${JSON.stringify(extraQuestion?.reviewMetadata?.gate ?? null)}`);
    assert(extraQuestion.sourceQuestionId, 'Extra formal inventory question should publish into special_practice_questions.');
    assert(extraQuestion.reviewMetadata?.subjectPracticeAutoApproval?.status === 'published_to_subject_practice', 'Extra AI question must record formal subject-practice publication metadata.');
    created.extraPublishedQuestionIds.push(extraQuestion.sourceQuestionId);
    const [extraPublished] = await prisma.$queryRaw`
      SELECT spq."id", spq."status", mapping."topic_id" AS "topicId", spt."id" AS "bridgeTopicId"
      FROM "special_practice_questions" spq
      JOIN "csca_topic_mappings" mapping
        ON mapping."source_type" = 'special_practice_question'
       AND mapping."source_id" = spq."id"
      JOIN "special_practice_topics" spt ON spt."id" = spq."topic_id"
      WHERE spq."id" = ${extraQuestion.sourceQuestionId}
      LIMIT 1
    `;
    assert(extraPublished?.status === 'published', 'Extra published special-practice question should be available.');
    assert(extraPublished.topicId === created.topicId, 'Extra published question should map back to the source CSCA topic.');
    created.extraBridgeTopicIds.push(extraPublished.bridgeTopicId);
  }

  const gapHealth = await service.topicQuestionBankHealth({
    subject,
    topicId: created.topicId,
    limit: 10,
    refresh: true
  });
  const smokeHealth = gapHealth.items.find((item) => item.topicId === created.topicId);
  assert(smokeHealth?.questionGap?.difficultyPlan?.length, 'Smoke topic should expose a difficulty-aware subject-practice gap plan.');
  const plannedFullTarget = smokeHealth.questionGap.difficultyPlan
    .reduce((sum, item) => sum + Math.max(0, Number(item.targetCount) || 0), 0);
  const plannedNeededTarget = smokeHealth.questionGap.difficultyPlan
    .reduce((sum, item) => sum + Math.max(0, Number(item.neededCount) || 0), 0);
  assert(plannedNeededTarget > 0, `Smoke topic should still need formal inventory after legacy stock. plan=${JSON.stringify(smokeHealth.questionGap.difficultyPlan)}`);
  assert(plannedNeededTarget < plannedFullTarget, `Smoke setup should have existing formal stock so production plans only the missing count. plan=${JSON.stringify(smokeHealth.questionGap.difficultyPlan)}`);
  const planningRun = await service.createSubjectPracticeProductionRun({
    subject,
    topicId: created.topicId,
    limit: 10,
    maxNoProgressRounds: 8,
    triggerType: 'closure_smoke_gap_plan'
  }, 3);
  created.productionPlanningRunId = planningRun.id;
  assert(planningRun.targetTotal === plannedNeededTarget, `Non-override production run should target the missing count only. got=${planningRun.targetTotal}; needed=${plannedNeededTarget}; full=${plannedFullTarget}`);
  assert(planningRun.targetTotal < plannedFullTarget, 'Non-override production run must not regenerate the full target stock when some formal stock already exists.');

  const productionRun = await service.createSubjectPracticeProductionRun({
    subject,
    topicId: created.topicId,
    difficultyTargets: [
      { topicId: created.topicId, difficultyBand: 'basic', targetCount: 1 },
      { topicId: created.topicId, difficultyBand: 'medium', targetCount: 1 },
      { topicId: created.topicId, difficultyBand: 'hard', targetCount: 1 }
    ],
    limit: 10,
    maxNoProgressRounds: 8,
    triggerType: 'closure_smoke'
  }, 3);
  created.productionRunId = productionRun.id;
  const productionDifficulties = new Set(productionRun.cells.map((cell) => cell.difficultyBand));
  assert(productionRun.cells.length === 3, `Production smoke should create exactly three difficulty cells for the scoped topic. cells=${productionRun.cells.length}`);
  assert(productionRun.cells.every((cell) => cell.topicId === created.topicId), 'Production run cells should be scoped to the smoke topic.');
  assert(['basic', 'medium', 'hard'].every((difficulty) => productionDifficulties.has(difficulty)), `Production run should include basic/medium/hard cells. got=${Array.from(productionDifficulties).join(',')}`);
  assert(productionRun.publishedTotal === 0, `Production run should not count legacy/formal AI questions without current production metadata. got=${productionRun.publishedTotal}`);
  assert(productionRun.openTotal === productionRun.targetTotal, 'Production run openTotal should equal targetTotal before current-run production publishes formal questions.');

  const processedProduction = await service.processSubjectPracticeProductionRun(created.productionRunId, {
    untilComplete: true,
    maxRounds: 50,
    maxJobs: 30,
    maxJobsPerDifficulty: 10
  });
  const productionDebugCandidates = await prisma.$queryRaw`
    SELECT "id", "status", "source_question_id" AS "sourceQuestionId",
           "designed_difficulty" AS "designedDifficulty",
           "generation_metadata" AS "generationMetadata",
           "review_metadata" AS "reviewMetadata"
    FROM "csca_questions"
    WHERE "generation_metadata"->>'productionRunId' = ${String(created.productionRunId)}
    ORDER BY "id" ASC
    LIMIT 5
  `;
  const processedCellsSummary = (processedProduction.run?.cells ?? []).map((cell) => ({
    id: cell.id,
    status: cell.status,
    difficultyBand: cell.difficultyBand,
    targetCount: cell.targetCount,
    publishedCount: cell.publishedCount,
    candidateCount: cell.candidateCount,
    runningJobCount: cell.runningJobCount,
    failedCount: cell.failedCount,
    failureCode: cell.failureCode,
    failureMessage: cell.failureMessage
  }));
  const productionCandidateDebugSummary = productionDebugCandidates.map((question) => ({
    id: question.id,
    status: question.status,
    sourceQuestionId: question.sourceQuestionId,
    designedDifficulty: question.designedDifficulty,
    gate: question.reviewMetadata?.gate ?? null,
    approvalGate: question.reviewMetadata?.approvalGate ?? null,
    autoApproval: question.reviewMetadata?.subjectPracticeAutoApproval ?? null,
    autoRepair: question.reviewMetadata?.subjectPracticeAutoRepair ?? null,
    autoRegenerate: question.reviewMetadata?.subjectPracticeAutoRegenerate ?? null,
    scope: question.generationMetadata?.scope ?? null,
    targetProfile: question.generationMetadata?.targetProfile ?? null,
    localizations: Boolean(question.generationMetadata?.localizations)
  }));
  assert(processedProduction.run?.status === 'completed', `Production run should complete. status=${processedProduction.run?.status}; message=${processedProduction.message}; cells=${JSON.stringify(processedCellsSummary)}; candidates=${JSON.stringify(productionCandidateDebugSummary)}`);
  assert(processedProduction.run.openTotal === 0, `Completed production run should have no open gap. open=${processedProduction.run.openTotal}`);
  assert(processedProduction.run.publishedTotal === processedProduction.run.targetTotal, `Production run should publish exactly enough current-run formal inventory. ${processedProduction.run.publishedTotal}/${processedProduction.run.targetTotal}`);
  assert(processedProduction.run.difficultyProgress.every((item) => item.open === 0 && item.published === item.target), `Each difficulty target should be filled before completion. progress=${JSON.stringify(processedProduction.run.difficultyProgress)}`);
  assert(processedProduction.processed > 0, 'Production run should process at least one generation job after legacy inventory is isolated from the current run.');

  const productionJobs = await prisma.$queryRaw`
    SELECT "id", "status", "prompt_metadata" AS "promptMetadata"
    FROM "csca_ai_generation_jobs"
    WHERE "prompt_metadata"->>'productionRunId' = ${String(created.productionRunId)}
    ORDER BY "id" ASC
  `;
  created.productionJobIds = productionJobs.map((job) => job.id);
  assert(productionJobs.length > 0, 'Production run should create generation jobs with productionRunId.');
  assert(productionJobs.every((job) => job.promptMetadata?.source === 'subject_practice_production_matrix'), 'Production jobs must use production source metadata.');
  assert(productionJobs.every((job) => String(job.promptMetadata?.generationMode || '').startsWith('subject_practice_production_matrix')), 'Production jobs must use production generationMode metadata.');
  assert(productionJobs.every((job) => Number(job.promptMetadata?.productionCellId) > 0), 'Production jobs must preserve productionCellId metadata.');

  const productionQuestions = await prisma.$queryRaw`
    SELECT "id", "status", "source_question_id" AS "sourceQuestionId",
           "generation_metadata" AS "generationMetadata", "review_metadata" AS "reviewMetadata"
    FROM "csca_questions"
    WHERE "generation_metadata"->>'productionRunId' = ${String(created.productionRunId)}
    ORDER BY "id" ASC
  `;
  created.productionQuestionIds = productionQuestions.map((question) => question.id);
  created.productionPublishedQuestionIds = productionQuestions
    .map((question) => question.sourceQuestionId)
    .filter((id) => Number.isInteger(id) && id > 0);
  assert(productionQuestions.length > 0, 'Production run should generate tracked AI questions.');
  const approvedProductionQuestions = productionQuestions.filter((question) => question.status === 'approved');
  const rejectedProductionQuestions = productionQuestions.filter((question) => question.status !== 'approved');
  assert(approvedProductionQuestions.length === processedProduction.run.targetTotal, `Production run should publish exactly the approved target subset, not require every attempted candidate to pass. approved=${approvedProductionQuestions.length}; target=${processedProduction.run.targetTotal}; rejected=${rejectedProductionQuestions.map((question) => `${question.id}:${question.status}`).join(',')}`);
  assert(approvedProductionQuestions.every((question) => question.sourceQuestionId), 'Production-approved questions should publish into special_practice_questions.');
  assert(rejectedProductionQuestions.every((question) => !question.sourceQuestionId), 'Rejected production candidates must not publish into special_practice_questions.');
  assert(approvedProductionQuestions.every((question) => question.reviewMetadata?.subjectPracticeAutoApproval?.status === 'published_to_subject_practice'), 'Production-approved questions should be formal subject-practice assets.');
  assert(productionQuestions.every((question) => Number(question.generationMetadata?.productionCellId) > 0), 'Production-generated questions must preserve productionCellId metadata.');
  assert(productionQuestions.every((question) => String(question.generationMetadata?.generationMode || '').startsWith('subject_practice_production_matrix')), 'Production-generated questions must preserve production generationMode.');
  const productionQuestionDifficulties = new Set(approvedProductionQuestions.map((question) => question.generationMetadata?.targetProfile?.difficultyBand || question.generationMetadata?.requestedTargetProfile?.difficultyBand || question.generationMetadata?.difficultyBand));
  assert(['basic', 'medium', 'hard'].every((difficulty) => productionQuestionDifficulties.has(difficulty)), `Production-generated questions should cover basic/medium/hard targets. got=${Array.from(productionQuestionDifficulties).join(',')}`);

  const productionPublished = await prisma.$queryRaw`
    SELECT DISTINCT spt."id" AS "bridgeTopicId"
    FROM "special_practice_questions" spq
    JOIN "special_practice_topics" spt ON spt."id" = spq."topic_id"
    WHERE spq."id" IN (${Prisma.join(created.productionPublishedQuestionIds)})
  `;
  created.bridgeTopicIds = productionPublished.map((row) => row.bridgeTopicId);

  const selectedAfterProduction = await adaptiveProvider.pickQuestions(910778, [{
    topicId: created.topicId,
    code: topicCode,
    title: 'Subject Practice Closure Topic',
    module: 'Closure',
    targetDifficulty: 'medium',
    reason: 'production-closure-smoke'
  }], 10);
  assert(
    selectedAfterProduction.some((item) => created.productionPublishedQuestionIds.includes(item.questionId)),
    'Adaptive subject-practice provider should be able to select production-run formal questions.'
  );

  console.log(JSON.stringify({
    ok: true,
    topicId: created.topicId,
    blueprintId: created.blueprintId,
    jobId: created.jobId,
    questionId: created.questionId,
    publishedQuestionId: created.publishedQuestionId,
    productionRunId: created.productionRunId,
    productionJobs: created.productionJobIds.length,
    productionQuestions: created.productionQuestionIds.length,
    productionPublishedQuestionIds: created.productionPublishedQuestionIds,
    selected: selected.map((item) => ({ questionSource: item.questionSource, questionId: item.questionId })),
    selectedAfterProduction: selectedAfterProduction.map((item) => ({ questionSource: item.questionSource, questionId: item.questionId }))
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(JSON.stringify({
      ok: false,
      message: error instanceof Error ? error.message : String(error)
    }, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await cleanup();
    } finally {
      await prisma.$disconnect();
    }
  });

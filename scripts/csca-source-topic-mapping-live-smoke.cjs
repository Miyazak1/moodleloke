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

const { createStandaloneAiGatewayService } = require('../backend/src/ai-gateway/ai-gateway.service');
const { QuestionTopicMapperProviderService } = require('../backend/src/ai-questioning/question-topic-mapper-provider.service');

loadEnv(path.resolve(__dirname, '..'));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function providerConfig() {
  const provider = process.env.CSCA_AI_TOPIC_MAPPING_PROVIDER
    || process.env.CSCA_AI_QUESTION_REVIEW_PROVIDER
    || process.env.AI_DEFAULT_PROVIDER
    || process.env.CSCA_AI_PROVIDER
    || '';
  const model = process.env.CSCA_AI_TOPIC_MAPPING_MODEL
    || process.env.CSCA_AI_QUESTION_REVIEW_MODEL
    || process.env.DEEPSEEK_BACKGROUND_DEFAULT_MODEL
    || process.env.DEEPSEEK_DEFAULT_MODEL
    || process.env.CSCA_AI_MODEL
    || '';
  return {
    enabled: process.env.CSCA_AI_TOPIC_MAPPING_ENABLED
      ?? process.env.CSCA_AI_QUESTION_REVIEW_ENABLED
      ?? process.env.CSCA_AI_QUESTION_GENERATION_ENABLED,
    provider,
    model,
    hasApiKey: Boolean(
      process.env.DEEPSEEK_BACKGROUND_API_KEYS
      || process.env.DEEPSEEK_API_KEYS
      || process.env.CSCA_AI_TOPIC_MAPPING_API_KEY
      || process.env.CSCA_AI_QUESTION_REVIEW_API_KEY
      || process.env.CSCA_AI_API_KEY
    )
  };
}

async function main() {
  const config = providerConfig();
  assert(config.enabled === 'true' || config.enabled === '1', 'CSCA AI topic mapping/review/generation must be enabled for live source topic mapping smoke.');
  assert(config.provider && config.provider !== 'rule-fallback', 'Topic mapping provider must not be rule-fallback.');
  assert(config.model, 'Topic mapping model is required.');
  assert(config.hasApiKey, 'Topic mapping API key is required.');

  const gateway = createStandaloneAiGatewayService();
  const mapper = new QuestionTopicMapperProviderService(gateway);
  const status = mapper.configStatus();
  assert(status.externalReady, `Topic mapper is not externally ready: ${JSON.stringify(status)}.`);

  const expectedTopicCode = 'M-LIVE-INEQUALITY';
  const result = await mapper.suggest({
    id: Date.now(),
    subject: 'math',
    questionNumber: 'live-topic-mapping-smoke',
    promptText: 'Solve the inequality 2x + 3 > 7. Which interval describes all possible values of x?',
    options: [
      { id: 'A', text: 'x > 2' },
      { id: 'B', text: 'x < 2' },
      { id: 'C', text: 'x > 5' },
      { id: 'D', text: 'x < 5' }
    ],
    correctAnswer: 'A',
    explanation: 'Subtract 3 from both sides to get 2x > 4, then divide by 2, so x > 2.',
    analysis: {
      difficulty: 'basic',
      questionForm: 'calculation_application',
      cognitiveSkill: 'standard_application',
      calculationLoad: 'light'
    }
  }, [
    {
      id: 1,
      code: expectedTopicCode,
      title: 'Linear inequalities',
      module: 'Algebra',
      examScope: 'Solve and interpret one-variable linear inequalities.',
      description: 'Includes rearranging inequalities and writing solution intervals.',
      skills: ['solve linear inequality', 'interval notation'],
      aliases: ['inequality', 'linear inequality'],
      excludedScope: ['quadratic inequalities']
    },
    {
      id: 2,
      code: 'M-LIVE-GEOMETRY',
      title: 'Circle geometry',
      module: 'Geometry',
      examScope: 'Use angle and chord properties in circles.',
      description: 'Circle theorems and geometric reasoning.',
      skills: ['circle theorem'],
      aliases: ['circle'],
      excludedScope: ['algebraic inequalities']
    },
    {
      id: 3,
      code: 'M-LIVE-STATISTICS',
      title: 'Summary statistics',
      module: 'Statistics',
      examScope: 'Calculate and compare mean, median, mode, and range.',
      description: 'Descriptive statistics for data sets.',
      skills: ['mean', 'median', 'range'],
      aliases: ['statistics'],
      excludedScope: ['solving inequalities']
    }
  ]);

  assert(result.status === 'success', `Live topic mapper failed: ${result.status} ${result.error || ''}`);
  assert(result.provider && result.provider !== 'rule-fallback', `Expected live provider, got ${result.provider}.`);
  assert(result.suggestions.some((suggestion) => suggestion.topicCode === expectedTopicCode), `Expected ${expectedTopicCode} in suggestions: ${JSON.stringify(result.suggestions)}.`);

  console.log(JSON.stringify({
    ok: true,
    provider: result.provider,
    model: result.model,
    status: result.status,
    topSuggestion: result.suggestions[0],
    suggestions: result.suggestions,
    agent: result.agent
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    message: error instanceof Error ? error.message : String(error),
    providerConfig: providerConfig()
  }, null, 2));
  process.exitCode = 1;
});

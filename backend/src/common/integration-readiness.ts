function enabled(value: string | undefined) {
  return String(value ?? '').trim().toLowerCase() === 'true';
}

function present(value: string | undefined) {
  const text = String(value ?? '').trim();
  return Boolean(text) && !/^replace/i.test(text);
}

function keyPoolConfigured(value: string | undefined) {
  return String(value ?? '').split(',').map((item) => item.trim()).some((item) => present(item));
}

export function getStudentAgentIntegrationReadiness(env: NodeJS.ProcessEnv = process.env) {
  const hostMode = String(env.MOODLELIKE_HOST_INTEGRATION_MODE || 'standalone').trim().toLowerCase();
  const model = String(env.DEEPSEEK_PERSONAL_DEFAULT_MODEL || env.DEEPSEEK_DEFAULT_MODEL || '').trim();
  const checks = {
    hostModeValid: hostMode === 'standalone' || hostMode === 'cscalite',
    contractVersionValid: env.MOODLELIKE_HOST_CONTRACT_VERSION === 'cscalite-agent-host-v1',
    agentServerEnabled: enabled(env.AGENT_WEB_ENABLED),
    practiceWriteEnabled: enabled(env.CSCA_AGENT_PRACTICE_WRITE_ENABLED),
    aiGatewayEnabled: enabled(env.AI_GATEWAY_ENABLED),
    deepSeekSelected: env.AI_DEFAULT_PROVIDER === 'deepseek',
    deepSeekCredentialsConfigured: keyPoolConfigured(env.DEEPSEEK_PERSONAL_API_KEYS || env.DEEPSEEK_API_KEYS),
    deepSeekModelCurrent: model === 'deepseek-flash',
    automaticQuestionProductionIsolated: !enabled(env.CSCA_AI_QUESTION_GENERATION_ENABLED)
      && !enabled(env.CSCA_AI_QUESTIONING_SCHEDULER_ENABLED)
      && !enabled(env.CSCA_SUBJECT_PRACTICE_PRODUCTION_ENABLED)
      && !enabled(env.CSCA_SUBJECT_PRACTICE_PREDICTIVE_REPLENISHMENT_ENABLED)
  };
  return {
    status: Object.values(checks).every(Boolean) ? 'ready' as const : 'blocked' as const,
    hostMode,
    contractVersion: env.MOODLELIKE_HOST_CONTRACT_VERSION || null,
    model: model || null,
    checks
  };
}

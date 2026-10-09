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
  const configuredRoutingMode = String(env.CSCA_AGENT_TEACHING_ASSET_ROUTING_MODE || 'legacy').trim().toLowerCase();
  const teachingRoutingMode = configuredRoutingMode === 'active' || configuredRoutingMode === 'shadow'
    ? configuredRoutingMode
    : 'legacy';
  const rolloutPercentValue = Number(env.CSCA_AGENT_TEACHING_ASSET_ROUTING_ACTIVE_PERCENT || 0);
  const teachingRoutingActivePercent = Number.isFinite(rolloutPercentValue)
    ? Math.max(0, Math.min(100, Math.floor(rolloutPercentValue)))
    : 0;
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
    checks,
    learningLoop: {
      foundationEnabled: enabled(env.CSCA_AGENT_FOUNDATION_ENABLED),
      evidenceWriteEnabled: enabled(env.CSCA_LEARNING_EVIDENCE_WRITE_ENABLED),
      shadowProjectionEnabled: enabled(env.CSCA_LEARNING_SHADOW_PROJECTION_ENABLED),
      targetGapEnabled: enabled(env.CSCA_TARGET_GAP_ENABLED),
      prescriptionEnabled: enabled(env.CSCA_LEARNING_PRESCRIPTION_ENABLED),
      interventionShadowEnabled: enabled(env.CSCA_LEARNING_INTERVENTION_SHADOW_ENABLED),
      interventionDeliveryEnabled: enabled(env.CSCA_LEARNING_INTERVENTION_DELIVERY_ENABLED),
      interventionVerificationEnabled: enabled(env.CSCA_LEARNING_INTERVENTION_VERIFICATION_ENABLED),
      teachingAssetEnabled: enabled(env.CSCA_AGENT_TEACHING_ASSET_ENABLED),
      teachingRoutingMode,
      teachingRoutingActiveSubjects: String(env.CSCA_AGENT_TEACHING_ASSET_ROUTING_ACTIVE_SUBJECTS || '')
        .split(',').map((value) => value.trim()).filter(Boolean),
      teachingRoutingActivePercent
    }
  };
}

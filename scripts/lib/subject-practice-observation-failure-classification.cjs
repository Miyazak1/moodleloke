function cleanText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function observationFailureText(sample) {
  return cleanText([
    sample.taskResult?.deliveryFailure,
    sample.taskResult?.failureCategory,
    sample.jobMetadata?.failureCategory,
    sample.jobMetadata?.providerFailureCategory,
    sample.jobMetadata?.providerStatus,
    sample.taskError,
    sample.jobError
  ].filter(Boolean).join(' ')).toLowerCase();
}

function localPreProviderFailureReason(sample) {
  const provider = cleanText(sample.jobProvider ?? sample.provider).toLowerCase();
  const errorText = observationFailureText(sample);
  if (provider === 'prompt-budget-gate') return 'prompt_budget_gate';
  if (errorText.includes('generator_prompt_budget_exceeded') || errorText.includes('prompt_budget_exceeded')) {
    return 'prompt_budget_exceeded';
  }
  if (errorText.includes('observation_provider_cost_admission_failed')) {
    return 'provider_cost_admission_failed_before_gateway';
  }
  if (/connect eacces [^ ]+:443/.test(errorText)) return 'connect_eacces_443_local_network_denial';
  return null;
}

function localPreProviderFailureSignal(sample) {
  return localPreProviderFailureReason(sample) != null;
}

module.exports = {
  localPreProviderFailureReason,
  localPreProviderFailureSignal,
  observationFailureText
};

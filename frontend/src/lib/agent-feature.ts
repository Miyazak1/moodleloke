export function isAgentWebEnabled() {
  return String(import.meta.env.VITE_AGENT_WEB_ENABLED ?? '').trim().toLowerCase() === 'true';
}

export function isAgentPracticeWriteEnabled() {
  return String(import.meta.env.VITE_AGENT_PRACTICE_WRITE_ENABLED ?? '').trim().toLowerCase() === 'true';
}

export function agentDisabledRedirectUrl() {
  const value = String(import.meta.env.VITE_AGENT_DISABLED_REDIRECT_URL ?? '').trim();
  return value || '/';
}

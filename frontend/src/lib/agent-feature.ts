export function isAgentWebEnabled() {
  return String(import.meta.env.VITE_AGENT_WEB_ENABLED ?? '').trim().toLowerCase() === 'true';
}

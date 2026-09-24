const DAY_MS = 24 * 60 * 60 * 1000;

function boundedDays(value: unknown, fallback: number, minimum: number, maximum: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(minimum, Math.min(maximum, Math.floor(parsed))) : fallback;
}

export function agentConversationLifecyclePolicy(env: NodeJS.ProcessEnv = process.env) {
  const archiveDays = boundedDays(env.AGENT_PRACTICE_QA_ARCHIVE_DAYS, 30, 1, 365);
  const purgeDays = boundedDays(env.AGENT_PRACTICE_QA_PURGE_DAYS, 90, archiveDays + 1, 730);
  const abandonedHours = boundedDays(env.AGENT_PRACTICE_QA_ABANDONED_HOURS, 24, 1, 168);
  return {
    policyVersion: 'practice-question-qa-lifecycle-v1',
    archiveDays,
    purgeDays,
    abandonedHours,
    archiveCutoff(now = new Date()) { return new Date(now.getTime() - archiveDays * DAY_MS); },
    abandonedCutoff(now = new Date()) { return new Date(now.getTime() - abandonedHours * 60 * 60 * 1000); },
    purgeAfter(activityAt = new Date()) { return new Date(activityAt.getTime() + purgeDays * DAY_MS); }
  };
}

export const STUDENT_CONSUMABLE_AI_VERSION_STATUSES = ['current', 'legacy_usable', 'manual_published'] as const;

export type StudentConsumableAiVersionStatus = typeof STUDENT_CONSUMABLE_AI_VERSION_STATUSES[number];

export function isStudentConsumableAiVersionStatus(status: unknown): status is StudentConsumableAiVersionStatus {
  return STUDENT_CONSUMABLE_AI_VERSION_STATUSES.includes(String(status) as StudentConsumableAiVersionStatus);
}

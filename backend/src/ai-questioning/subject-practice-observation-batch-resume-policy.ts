import {
  assertSubjectPracticeHistoricalObservationBatchEnvelope,
  subjectPracticeHistoricalObservationBatchEnvelopeFor,
  type SubjectPracticeObservationBatchManifest
} from './subject-practice-observation-batch-manifest-policy';

export const SUBJECT_PRACTICE_OBSERVATION_BATCH_RESUME_POLICY_VERSION =
  'subject-practice-observation-batch-resume-v1';

const TERMINAL_STATUSES = new Set(['succeeded', 'failed', 'cancelled']);
const ACTIVE_STATUSES = new Set(['queued', 'running']);

type ExistingObservationTask = {
  id?: unknown;
  status?: unknown;
  filterSnapshot?: unknown;
  sealedObservationBatch?: unknown;
  result?: unknown;
  error?: unknown;
};

function recordFrom(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function envelopeFromTask(task: ExistingObservationTask) {
  const direct = recordFrom(task.sealedObservationBatch);
  if (direct) return direct;
  const snapshot = recordFrom(task.filterSnapshot);
  return recordFrom(snapshot?.sealedObservationBatch);
}

export function subjectPracticeObservationBatchResumePlan(input: {
  manifest: SubjectPracticeObservationBatchManifest;
  existingTasks?: ExistingObservationTask[];
}) {
  const manifest = input.manifest;
  const expectedTaskCount = manifest.tasks.length;
  const firstEnvelope = subjectPracticeHistoricalObservationBatchEnvelopeFor({ manifest, taskOrdinal: 1 });
  const existingByOrdinal = new Map<number, {
    id: string;
    status: string;
    result: unknown;
    error: unknown;
  }>();

  for (const rawTask of input.existingTasks ?? []) {
    const task = recordFrom(rawTask) ?? {};
    const id = String(task.id ?? '').trim();
    if (!id) throw new Error('observation_batch_resume_task_id_invalid');
    const status = String(task.status ?? '').trim().toLowerCase();
    if (!TERMINAL_STATUSES.has(status) && !ACTIVE_STATUSES.has(status)) {
      throw new Error(`observation_batch_resume_task_status_invalid:${status || 'missing'}`);
    }
    const rawEnvelope = envelopeFromTask(rawTask);
    const rawOrdinal = Number(rawEnvelope?.taskOrdinal);
    const descriptor = Number.isInteger(rawOrdinal) && rawOrdinal > 0
      ? manifest.tasks[rawOrdinal - 1]
      : null;
    if (!descriptor) throw new Error('observation_batch_resume_task_ordinal_invalid');
    let envelope;
    try {
      envelope = assertSubjectPracticeHistoricalObservationBatchEnvelope({
        envelope: rawEnvelope,
        currentTask: {
          subject: descriptor.subject,
          productionRunId: descriptor.productionRunId,
          productionCellId: descriptor.productionCellId,
          taskFamily: descriptor.taskFamily,
          planTemplate: descriptor.planTemplate
        }
      });
    } catch {
      throw new Error('observation_batch_resume_manifest_binding_mismatch');
    }
    if (envelope.batchId !== firstEnvelope.batchId
      || envelope.manifestSha256 !== firstEnvelope.manifestSha256
      || envelope.expectedTaskCount !== expectedTaskCount) {
      throw new Error('observation_batch_resume_manifest_binding_mismatch');
    }
    const ordinal = envelope.taskOrdinal;
    if (existingByOrdinal.has(ordinal)) {
      throw new Error(`observation_batch_resume_duplicate_ordinal:${ordinal}`);
    }
    existingByOrdinal.set(ordinal, {
      id,
      status,
      result: task.result ?? null,
      error: task.error ?? null
    });
  }

  const items = manifest.tasks.map((descriptor) => {
    const existing = existingByOrdinal.get(descriptor.ordinal);
    const action = !existing
      ? 'submit_missing'
      : TERMINAL_STATUSES.has(existing.status)
        ? 'reuse_terminal'
        : 'wait_existing';
    return {
      ordinal: descriptor.ordinal,
      plannedScopeId: descriptor.plannedScopeId,
      action,
      existingTaskId: existing?.id || null,
      existingStatus: existing?.status ?? null,
      result: existing?.result ?? null,
      error: existing?.error ?? null,
      sealedObservationBatch: subjectPracticeHistoricalObservationBatchEnvelopeFor({
        manifest,
        taskOrdinal: descriptor.ordinal
      })
    };
  });
  const counts = {
    reuseTerminal: items.filter((item) => item.action === 'reuse_terminal').length,
    waitExisting: items.filter((item) => item.action === 'wait_existing').length,
    submitMissing: items.filter((item) => item.action === 'submit_missing').length
  };
  return {
    policyVersion: SUBJECT_PRACTICE_OBSERVATION_BATCH_RESUME_POLICY_VERSION,
    batchId: firstEnvelope.batchId,
    manifestSha256: firstEnvelope.manifestSha256,
    expectedTaskCount,
    observedExistingTaskCount: existingByOrdinal.size,
    status: counts.reuseTerminal === expectedTaskCount
      ? 'batch_already_terminal'
      : counts.waitExisting > 0
        ? 'wait_for_existing_active_task'
        : 'ready_to_submit_missing_ordinals',
    counts,
    terminalFailuresRemainInDenominator: true,
    items
  };
}

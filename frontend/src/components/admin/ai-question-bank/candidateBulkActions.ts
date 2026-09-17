import { numberFromRecord, recordFrom } from './questionData';

export type CandidateBulkProgress = {
  action: 'review' | 'approve' | 'reject' | 'archive';
  total: number;
  completed: number;
  succeeded: number;
  failed: number;
  skipped: number;
  currentQuestionId: number | null;
  failureMessages?: string[];
};

export type BulkApproveScope = 'gate_passed' | 'include_human_review';

export function bulkQuestionFailureSummary(results: unknown[]) {
  const failures = results.flatMap((result) => {
    const record = recordFrom(result);
    const errors = Array.isArray(record.errors) ? record.errors : [];
    return errors.map((item) => {
      const error = recordFrom(item);
      const id = error.id ?? '-';
      const message = typeof error.message === 'string' ? error.message : '操作失败';
      return `Q${id}: ${message}`;
    });
  });
  return failures;
}

export function bulkQuestionSuccessCount(results: unknown[]) {
  return results.reduce<number>((sum, result) => {
    const record = recordFrom(result);
    const succeeded = numberFromRecord(record, 'succeeded');
    if (succeeded > 0) return sum + succeeded;
    const items = Array.isArray(record.items) ? record.items : [];
    return sum + items.length;
  }, 0);
}

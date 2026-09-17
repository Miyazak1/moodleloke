import { LearningCapabilityErrorCode } from './learning-read-capability.contracts';

export class LearningCapabilityError extends Error {
  constructor(
    readonly code: LearningCapabilityErrorCode,
    message: string,
    readonly retryable = false,
    readonly fieldErrors?: Array<{ field: string; code: string; message: string }>
  ) {
    super(message);
    this.name = 'LearningCapabilityError';
  }
}


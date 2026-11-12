import { createHash } from 'node:crypto';

export const MATH_ENGINE_SOURCE = 'verified_math_engine';
export function mathEngineIdentityKey(question: { generationMetadata?: unknown }): string | null {
  const metadata = question.generationMetadata as { scopeId?: unknown; mathIdentityHash?: unknown } | null;
  return typeof metadata?.scopeId === 'string' && typeof metadata.mathIdentityHash === 'string'
    ? `${metadata.scopeId}:${metadata.mathIdentityHash}` : null;
}
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, canonical(item)]));
  return value;
}
type BoundQuestion = { prompt: string; options: unknown; correctAnswer?: string | null; explanation?: string | null; localizations?: unknown; generationMetadata?: unknown; reviewMetadata?: unknown };
export function mathEngineContentHash(question: BoundQuestion) {
  const metadata = question.generationMetadata as { localizations?: unknown } | null;
  return createHash('sha256').update(JSON.stringify(canonical([question.prompt, question.options, question.correctAnswer, question.explanation, question.localizations ?? metadata?.localizations ?? null]))).digest('hex');
}
export function isReadyMathEngineQuestion(question: BoundQuestion) {
  const metadata = question.generationMetadata as { practiceAdmission?: { version?: string; state?: string; contentHash?: string; scope?: string } } | null;
  const admission = metadata?.practiceAdmission;
  const publication = (question.reviewMetadata as { publication?: { state?: string; pluginId?: string; scope?: string } } | null)?.publication;
  return admission?.version === 'verified-math-practice-v1' && admission.state === 'ready'
    && publication?.state === 'published' && publication.pluginId === 'verified-math-1.43' && publication.scope === 'ordinary_practice_only'
    && admission.scope === 'ordinary_practice_only' && admission.contentHash === mathEngineContentHash(question);
}

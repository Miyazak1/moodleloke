import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export const AGENT_TRUSTED_QUESTION_MATCHER_VERSION = 'agent-question-match-v2';
const MIN_PROMPT_LENGTH = 12;
const VERIFIED_SCORE = 0.82;
const MIN_WINNER_MARGIN = 0.06;
const MAX_SOURCE_ROWS = 2500;

type TrustedQuestion = {
  sourceType: 'csca_source_question' | 'csca_question';
  sourceId: string;
  version: number;
  title: string;
  subject: string;
  topicId: number;
  prompt: string;
  options: unknown;
  correctAnswer: string;
  trustTier: 'human_approved' | 'governed_auto_approved';
};

function clean(value: unknown): string {
  return String(value ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim();
}

export function normalizeQuestionText(value: unknown): string {
  return clean(value)
    .toLowerCase()
    .replace(/(?:student\s*answer|学生答案|我的答案|answer)\s*[:：].*$/giu, '')
    .replace(/[\u2018\u2019\u201c\u201d]/g, '')
    .replace(/[^\p{L}\p{N}\p{Script=Han}+\-*/^=<>≤≥√∑∫().,，。%°]/gu, '');
}

function grams(value: string, size = 3): Set<string> {
  if (value.length <= size) return new Set(value ? [value] : []);
  const result = new Set<string>();
  for (let index = 0; index <= value.length - size; index += 1) result.add(value.slice(index, index + size));
  return result;
}

function dice(left: Set<string>, right: Set<string>): number {
  if (!left.size || !right.size) return 0;
  let overlap = 0;
  for (const item of left) if (right.has(item)) overlap += 1;
  return (2 * overlap) / (left.size + right.size);
}

export function trustedQuestionSimilarity(extracted: unknown, source: unknown): number {
  const left = normalizeQuestionText(extracted);
  const right = normalizeQuestionText(source);
  if (!left || !right) return 0;
  if (left === right) return 1;
  const containment = left.length >= MIN_PROMPT_LENGTH && right.length >= MIN_PROMPT_LENGTH
    ? left.includes(right)
      ? 0.98
      : right.includes(left)
        ? Math.min(left.length, right.length) / Math.max(left.length, right.length)
        : 0
    : 0;
  return Number(Math.max(dice(grams(left), grams(right)), containment).toFixed(4));
}

function optionRows(value: unknown): Array<{ id: string; text: string }> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, index) => {
    if (typeof item === 'string') return [{ id: String.fromCharCode(65 + index), text: clean(item) }];
    if (!item || typeof item !== 'object') return [];
    const row = item as Record<string, unknown>;
    return [{ id: clean(row.id || row.key || String.fromCharCode(65 + index)).toUpperCase(), text: clean(row.text || row.value || row.label) }];
  });
}

function normalizedAnswer(value: unknown): string {
  return clean(value).toUpperCase().replace(/^(?:答案|ANSWER)\s*[:：]?\s*/u, '').replace(/[。.]$/u, '');
}

function optionId(value: string): string | null {
  const match = value.match(/^(?:选项|OPTION)?\s*([A-Z])(?:\s|[、:：，,。.]|$)/u);
  return match?.[1] ?? null;
}

export function verifyExtractedAnswer(extractedValue: unknown, correctValue: unknown, optionsValue: unknown): 'correct' | 'incorrect' | null {
  const extracted = normalizedAnswer(extractedValue);
  const correct = normalizedAnswer(correctValue);
  if (!extracted || !correct) return null;
  const options = optionRows(optionsValue);
  const extractedOption = optionId(extracted) ?? options.find((option) => normalizeQuestionText(option.text) === normalizeQuestionText(extracted))?.id;
  const correctOption = optionId(correct) ?? options.find((option) => normalizeQuestionText(option.text) === normalizeQuestionText(correct))?.id;
  if (extractedOption && correctOption) return extractedOption === correctOption ? 'correct' : 'incorrect';
  return normalizeQuestionText(extracted) === normalizeQuestionText(correct) ? 'correct' : 'incorrect';
}

function sha256(value: unknown): string {
  return createHash('sha256').update(String(value ?? '')).digest('hex');
}

function resultPayload(row: any) {
  return {
    id: row.id,
    analysisId: row.analysisId,
    analysisItemId: row.analysisItemId ?? null,
    status: row.status,
    sourceType: row.sourceType,
    sourceId: row.sourceId,
    sourceVersion: row.sourceVersion,
    sourceTitle: row.sourceTitle,
    subjectCode: row.subjectCode,
    topicId: row.topicId,
    promptScore: row.promptScore,
    runnerUpScore: row.runnerUpScore,
    extractedAnswer: row.extractedAnswer,
    verifiedOutcome: row.verifiedOutcome,
    matcherVersion: row.matcherVersion,
    matchSnapshot: row.matchSnapshot
  };
}

@Injectable()
export class AgentTrustedQuestionMatcherService {
  private readonly sourceCache = new Map<string, { expiresAt: number; questions: TrustedQuestion[] }>();
  constructor(private readonly prisma: PrismaService) {}
  private get db(): any { return this.prisma as any; }

  async ensure(userId: number, analysis: any, analysisItem?: any) {
    const where = analysisItem
      ? { analysisItemId: analysisItem.id, userId }
      : { analysisId: analysis.id, analysisItemId: null, userId };
    const existing = await this.db.agentAttachmentQuestionMatch.findFirst({ where });
    if (existing) return resultPayload(existing);
    const result = analysis.result && typeof analysis.result === 'object' ? analysis.result as Record<string, unknown> : {};
    const item = analysisItem || result;
    const subjectValue = analysisItem?.subjectCode || item.subject;
    const subject = ['math', 'physics', 'chemistry'].includes(String(subjectValue)) ? String(subjectValue) : null;
    const prompt = clean(item.questionText || (!analysisItem ? result.extractedContent : ''));
    const extractedAnswer = clean(item.studentAnswer);
    const normalizedPrompt = normalizeQuestionText(prompt);
    let questions: TrustedQuestion[] = [];
    if (normalizedPrompt.length >= MIN_PROMPT_LENGTH) {
      questions = subject
        ? await this.loadTrustedQuestions(subject)
        : (await Promise.all(['math', 'physics', 'chemistry'].map((candidate) => this.loadTrustedQuestions(candidate)))).flat();
    }
    const ranked = questions
      .map((question) => ({ question, score: trustedQuestionSimilarity(prompt, question.prompt) }))
      .filter((item) => item.score >= 0.45)
      .sort((left, right) => right.score - left.score || left.question.sourceId.localeCompare(right.question.sourceId));
    const winner = ranked[0] ?? null;
    const runnerUp = ranked[1] ?? null;
    const margin = (winner?.score ?? 0) - (runnerUp?.score ?? 0);
    const promptVerified = Boolean(winner && winner.score >= VERIFIED_SCORE && margin >= MIN_WINNER_MARGIN);
    const outcome = promptVerified && winner ? verifyExtractedAnswer(extractedAnswer, winner.question.correctAnswer, winner.question.options) : null;
    const status = normalizedPrompt.length < MIN_PROMPT_LENGTH
      ? 'insufficient_prompt'
      : !winner || winner.score < VERIFIED_SCORE
        ? 'no_match'
        : margin < MIN_WINNER_MARGIN
          ? 'ambiguous'
          : outcome === null
            ? 'answer_missing'
            : 'verified_answer';
    const selected = promptVerified ? winner!.question : null;
    const row = await this.db.agentAttachmentQuestionMatch.create({ data: {
      userId,
      analysisId: analysis.id,
      analysisItemId: analysisItem?.id || null,
      status,
      sourceType: selected?.sourceType || null,
      sourceId: selected?.sourceId || null,
      sourceVersion: selected?.version || null,
      sourceTitle: selected?.title.slice(0, 240) || null,
      subjectCode: selected?.subject || subject,
      topicId: selected?.topicId || null,
      promptScore: winner?.score || 0,
      runnerUpScore: runnerUp?.score || 0,
      extractedPromptHash: prompt ? sha256(normalizeQuestionText(prompt)) : null,
      extractedAnswer: extractedAnswer.slice(0, 120) || null,
      correctAnswerHash: selected ? sha256(normalizedAnswer(selected.correctAnswer)) : null,
      verifiedOutcome: outcome,
      matcherVersion: AGENT_TRUSTED_QUESTION_MATCHER_VERSION,
      matchSnapshot: {
        threshold: VERIFIED_SCORE,
        minimumWinnerMargin: MIN_WINNER_MARGIN,
        winnerMargin: Number(margin.toFixed(4)),
        extractedSubject: subject,
        subjectResolution: subject ? 'model_extracted' : selected ? 'trusted_source_match' : 'unresolved',
        selectedTrustTier: selected?.trustTier || null,
        candidates: ranked.slice(0, 3).map((item) => ({ sourceType: item.question.sourceType, sourceId: item.question.sourceId, sourceVersion: item.question.version, sourceTitle: item.question.title, topicId: item.question.topicId, trustTier: item.question.trustTier, score: item.score })),
        answerCompared: outcome !== null,
        automaticQuestionGenerationInvoked: false
      }
    } });
    return resultPayload(row);
  }

  private async loadTrustedQuestions(subject: string): Promise<TrustedQuestion[]> {
    const cached = this.sourceCache.get(subject);
    if (cached && cached.expiresAt > Date.now()) return cached.questions;
    const [sources, approved] = await Promise.all([
      this.db.cscaSourceQuestion.findMany({
        where: {
          subject: { equals: subject, mode: 'insensitive' }, reviewStatus: { in: ['approved', 'auto_approved'] },
          promptText: { not: null }, correctAnswer: { not: null }, topicId: { not: null },
          topic: { status: 'published' }, document: { status: 'active' }
        },
        select: { id: true, questionNumber: true, promptText: true, options: true, correctAnswer: true, subject: true, topicId: true, reviewStatus: true, updatedAt: true, document: { select: { title: true } } },
        orderBy: { id: 'asc' }, take: MAX_SOURCE_ROWS
      }),
      this.db.cscaQuestion.findMany({
        where: { subject: { equals: subject, mode: 'insensitive' }, status: 'approved', topic: { status: 'published' } },
        select: { id: true, prompt: true, options: true, correctAnswer: true, subject: true, topicId: true, version: true },
        orderBy: { id: 'asc' }, take: MAX_SOURCE_ROWS
      })
    ]);
    const questions = [
      ...sources.map((row: any) => ({ sourceType: 'csca_source_question' as const, sourceId: String(row.id), version: Math.max(1, Math.floor(new Date(row.updatedAt).getTime() / 1000)), title: `${row.document.title} · ${row.questionNumber}`, subject: row.subject, topicId: row.topicId, prompt: row.promptText, options: row.options, correctAnswer: row.correctAnswer, trustTier: row.reviewStatus === 'approved' ? 'human_approved' as const : 'governed_auto_approved' as const })),
      ...approved.map((row: any) => ({ sourceType: 'csca_question' as const, sourceId: String(row.id), version: row.version, title: `CSCA 练习题 #${row.id}`, subject: row.subject, topicId: row.topicId, prompt: row.prompt, options: row.options, correctAnswer: row.correctAnswer, trustTier: 'human_approved' as const }))
    ];
    this.sourceCache.set(subject, { expiresAt: Date.now() + 5 * 60 * 1000, questions });
    return questions;
  }
}

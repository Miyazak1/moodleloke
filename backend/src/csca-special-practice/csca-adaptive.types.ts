import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { assertRecord } from '../common/validation';
import { SpecialPracticeOption, SpecialPracticeSubject } from './csca-special-practice.types';

export const ADAPTIVE_SUBJECTS: SpecialPracticeSubject[] = ['math', 'physics', 'chemistry'];
export const ADAPTIVE_ROUND_SIZE = 5;
export const ADAPTIVE_DIAGNOSTIC_ROUND_SIZE = 20;
export const ADAPTIVE_EXPOSURE_SOURCE = 'adaptive_round';

export type AdaptiveRoundPatchPayload = {
  answers?: Record<string, string>;
  timeSpent?: Record<string, number>;
  currentQuestion?: number;
  expectedVersion?: number;
};

export type AdaptiveRoundCreatePayload = {
  questionCount?: number;
  focusTopicId?: number;
  verification?: {
    reviewItemId?: number;
    patternType?: string;
    topicId?: number;
  };
};

export type AdaptivePublicQuestion = {
  id: number;
  orderNumber: number;
  difficulty: string;
  questionType: string;
  prompt: string;
  options: SpecialPracticeOption[];
  topicId: number;
  topicCode: string;
  topicTitle: string;
};

export type AdaptivePlannedTopic = {
  topicId: number;
  code: string;
  title: string;
  module: string | null;
  targetDifficulty: string;
  reason: string;
  baseDifficulty?: string;
  difficultyAdjustment?: number;
  targetDifficultyReason?: string;
  preferredQuestionIds?: number[];
};

export type AdaptiveVerificationRequest = {
  reviewItemId?: number;
  patternType?: string;
  topicId?: number;
};

export type AdaptivePlannedQuestion = AdaptivePlannedTopic & {
  questionId: number;
  questionSource: 'special_practice' | 'csca_question';
  questionDifficulty: string;
};

export type IndependentVerificationQuestion = {
  questionId: number;
  questionSource: 'csca_question';
  questionVersion: number;
  topicId: number;
  topicCode: string;
  topicTitle: string;
  questionDifficulty: string;
  transferSignature: string | null;
};

export type InterventionVerificationRoundInput = {
  verificationId: string;
  subject: SpecialPracticeSubject;
  topicId: number;
  questionLanguage: 'zh' | 'en';
  phase?: 'immediate' | 'retention' | 'transfer';
  excludedTransferSignatures?: string[];
  questions: IndependentVerificationQuestion[];
};

export function assertAdaptiveSubject(subject: unknown): SpecialPracticeSubject {
  const value = String(subject ?? '').trim();
  if (!ADAPTIVE_SUBJECTS.includes(value as SpecialPracticeSubject)) throw new NotFoundException('自适应训练科目不存在。');
  return value as SpecialPracticeSubject;
}

export function cleanAdaptiveMode(value: unknown) {
  const mode = String(value ?? 'practice').trim().toLowerCase();
  return ['practice', 'diagnostic'].includes(mode) ? mode : 'practice';
}

export function cleanAdaptiveQuestionLanguage(value: unknown) {
  const language = String(value ?? 'zh').trim().toLowerCase();
  return language === 'en' || language.startsWith('en-') ? 'en' : 'zh';
}

export function optionsFromJson(value: Prisma.JsonValue | unknown): SpecialPracticeOption[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
      const option = item as Record<string, unknown>;
      return { id: String(option.id ?? '').trim(), text: String(option.text ?? '').trim() };
    })
    .filter((item): item is SpecialPracticeOption => Boolean(item?.id && item.text));
}

export function tagsFromJson(value: Prisma.JsonValue | unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : [];
}

export function recordStringMap(value: unknown) {
  const record = assertRecord(value ?? {}, '自适应训练答案格式不正确。');
  return Object.fromEntries(Object.entries(record).map(([key, next]) => [String(key), String(next ?? '')]).filter(([, next]) => next));
}

export function numberMap(value: unknown) {
  const record = assertRecord(value ?? {}, '自适应训练耗时格式不正确。');
  return Object.fromEntries(Object.entries(record).map(([key, next]) => [String(key), Math.max(0, Number(next) || 0)]));
}

export function expectedVersionFrom(input: unknown) {
  if (!input || typeof input !== 'object' || !('expectedVersion' in input)) return undefined;
  const value = Number((input as { expectedVersion?: unknown }).expectedVersion);
  if (!Number.isInteger(value) || value < 1) throw new BadRequestException('版本号不正确，请刷新后再试。');
  return value;
}

export function clamp(value: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

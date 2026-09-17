import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { isStudentConsumableAiVersionStatus } from '../ai-questioning/question-version-governance';
import { PrismaService } from '../prisma/prisma.service';
import { SchoolsService } from '../schools/schools.service';
import { organizationRoleAllows } from '../csca-special-practice/organization-permissions';
import { UpdateScoreGoalInputV1Schema, UpdateStudyAvailabilityInputV1Schema } from '../learning-intelligence/contracts/learning-intelligence.contracts';
import { AgentLearningPreferenceRecord, AgentLearningSettingsRecord, AgentScoreGoalRecord, AgentStudyAvailabilityRecord, CompareSchoolRecord, CscaWrongQuestionItem, CscaWrongQuestionPattern, CscaWrongQuestionResponse, CscaWrongQuestionSourceType, CscaWrongQuestionStructuredExplanation, MyAICredits, SavedSchoolRecord, StudentProfileRecord } from './me.types';

const MAX_COMPARE_ITEMS = 4;
const COMPARE_LOCK_NAMESPACE = 43022;
const WRONG_QUESTION_LIMIT = 150;
const AI_CREDITS_LOW_BALANCE_THRESHOLD = 5;
const AGENT_SETTINGS_LOCK_NAMESPACE = 2_147_001_215;
const SHADOW_SCORING_POLICY_VERSION = 'csca-score-unverified-v1';
const DEFAULT_UNLIMITED_AI_EMAILS = ['misakitoufu@gmail.com'];
const COUNTRY_OPTIONS = [
  ['CN', 'China'], ['VN', 'Vietnam'], ['ID', 'Indonesia'], ['TH', 'Thailand'], ['MY', 'Malaysia'], ['PH', 'Philippines'],
  ['KH', 'Cambodia'], ['LA', 'Laos'], ['MM', 'Myanmar'], ['SG', 'Singapore'], ['BN', 'Brunei'], ['PK', 'Pakistan'],
  ['BD', 'Bangladesh'], ['IN', 'India'], ['LK', 'Sri Lanka'], ['NP', 'Nepal'], ['MN', 'Mongolia'], ['KR', 'South Korea'],
  ['JP', 'Japan'], ['RU', 'Russia'], ['KZ', 'Kazakhstan'], ['UZ', 'Uzbekistan'], ['KG', 'Kyrgyzstan'], ['TJ', 'Tajikistan'],
  ['US', 'United States'], ['GB', 'United Kingdom'], ['AU', 'Australia'], ['CA', 'Canada'], ['FR', 'France'], ['DE', 'Germany'],
  ['IT', 'Italy'], ['ES', 'Spain'], ['NL', 'Netherlands'], ['TR', 'Turkey'], ['EG', 'Egypt'], ['ET', 'Ethiopia'],
  ['NG', 'Nigeria'], ['ZA', 'South Africa'], ['BR', 'Brazil'], ['MX', 'Mexico']
] as const;
const COUNTRY_BY_CODE = new Map<string, string>(COUNTRY_OPTIONS.map(([code, label]) => [code, label]));
const COUNTRY_CODE_BY_NAME = new Map<string, string>(COUNTRY_OPTIONS.flatMap(([code, label]) => [
  [label.toLowerCase(), code],
  [code.toLowerCase(), code]
]));
COUNTRY_CODE_BY_NAME.set('中国', 'CN');
COUNTRY_CODE_BY_NAME.set('越南', 'VN');
COUNTRY_CODE_BY_NAME.set('việt nam', 'VN');
const GRADE_OPTIONS = [
  ['SCHOOL_G10', 'Grade 10'],
  ['SCHOOL_G11', 'Grade 11'],
  ['SCHOOL_G12', 'Grade 12'],
  ['INTL_G9', 'G9 / Year 10 / IGCSE 1'],
  ['INTL_G10', 'G10 / Year 11 / IGCSE'],
  ['INTL_G11', 'G11 / Year 12 / AS / IB DP1'],
  ['INTL_G12', 'G12 / Year 13 / A Level / IB DP2'],
  ['FOUNDATION', 'Foundation / 预科'],
  ['UNDERGRAD_PREP', '本科预备/语言阶段'],
  ['GAP_YEAR', 'Gap year / 毕业申请阶段']
] as const;
const GRADE_BY_CODE = new Map<string, string>(GRADE_OPTIONS.map(([code, label]) => [code, label]));
const GRADE_CODE_BY_NAME = new Map<string, string>(GRADE_OPTIONS.flatMap(([code, label]) => [
  [code.toLowerCase(), code],
  [label.toLowerCase(), code]
]));
GRADE_CODE_BY_NAME.set('高一', 'SCHOOL_G10');
GRADE_CODE_BY_NAME.set('高中一年级', 'SCHOOL_G10');
GRADE_CODE_BY_NAME.set('高二', 'SCHOOL_G11');
GRADE_CODE_BY_NAME.set('高中二年级', 'SCHOOL_G11');
GRADE_CODE_BY_NAME.set('高三', 'SCHOOL_G12');
GRADE_CODE_BY_NAME.set('高中三年级', 'SCHOOL_G12');
GRADE_CODE_BY_NAME.set('grade 10', 'SCHOOL_G10');
GRADE_CODE_BY_NAME.set('grade 11', 'SCHOOL_G11');
GRADE_CODE_BY_NAME.set('grade 12', 'SCHOOL_G12');
GRADE_CODE_BY_NAME.set('g9', 'INTL_G9');
GRADE_CODE_BY_NAME.set('g10', 'INTL_G10');
GRADE_CODE_BY_NAME.set('g11', 'INTL_G11');
GRADE_CODE_BY_NAME.set('g12', 'INTL_G12');
GRADE_CODE_BY_NAME.set('预科', 'FOUNDATION');

const PROFILE_CHOICES = {
  genderCode: new Set(['male', 'female', 'other', 'prefer_not_to_say']),
  educationStageCode: new Set(['middle_school', 'high_school', 'high_school_graduate', 'foundation', 'undergraduate', 'other']),
  preferredQuestionLanguageCode: new Set(['zh-CN', 'en', 'bilingual']),
  examAttemptType: new Set(['first', 'retake', 'undecided']),
  targetMajorCategoryCode: new Set(['computer_science', 'engineering', 'medicine', 'natural_sciences', 'business', 'other', 'undecided'])
} as const;
const TARGET_SUBJECT_CODES = new Set(['math', 'physics', 'chemistry']);
const STUDENT_PROFILE_SELECT = {
  nationality: true,
  nationalityCode: true,
  country: true,
  countryCode: true,
  grade: true,
  gradeCode: true,
  genderCode: true,
  educationStageCode: true,
  graduationYear: true,
  targetExamDate: true,
  targetSubjectCodes: true,
  preferredQuestionLanguageCode: true,
  examAttemptType: true,
  weeklyGoalDays: true,
  targetMajorCategoryCode: true,
  onboardingCompletedAt: true,
  onboardingSkippedAt: true,
  currentOrganizationId: true,
  updatedAt: true
} satisfies Prisma.StudentProfileSelect;

function preferredStudyDays(value: Prisma.JsonValue): number[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is number => Number.isInteger(item) && Number(item) >= 1 && Number(item) <= 7);
}

function serializeAgentScoreGoal(goal: {
  id: string;
  examDate: Date;
  examBatchCode: string;
  version: number;
  scoringPolicyVersion: string;
  subjects: Array<{ subjectCode: string; targetScore: number; priority: number }>;
} | null): AgentScoreGoalRecord {
  if (!goal) return { status: 'unset', goal: null };
  const subjects = goal.subjects.flatMap((item) =>
    TARGET_SUBJECT_CODES.has(item.subjectCode)
      ? [{ subject: item.subjectCode as 'math' | 'physics' | 'chemistry', targetScore: item.targetScore, priority: item.priority }]
      : []
  );
  return {
    status: 'configured',
    goal: {
      goalId: goal.id,
      examDate: goal.examDate.toISOString().slice(0, 10),
      examBatchCode: goal.examBatchCode,
      goalVersion: `goal:${goal.id}:v${goal.version}`,
      scoringPolicyVersion: goal.scoringPolicyVersion,
      subjects
    }
  };
}

function serializeAgentAvailability(availability: {
  version: number;
  timezone: string;
  weeklyMinutesGoal: number | null;
  preferredStudyDays: Prisma.JsonValue;
  defaultSessionMinutes: number | null;
  source: string;
  effectiveAt: Date;
} | null): AgentStudyAvailabilityRecord {
  if (!availability) {
    return {
      availabilityVersion: 'unset',
      timezone: 'Asia/Shanghai',
      weeklyMinutesGoal: null,
      preferredStudyDays: [],
      defaultSessionMinutes: null,
      source: 'unset',
      effectiveAt: null
    };
  }
  return {
    availabilityVersion: String(availability.version),
    timezone: availability.timezone,
    weeklyMinutesGoal: availability.weeklyMinutesGoal,
    preferredStudyDays: preferredStudyDays(availability.preferredStudyDays),
    defaultSessionMinutes: availability.defaultSessionMinutes,
    source: availability.source === 'user' ? 'user' : 'account_default',
    effectiveAt: availability.effectiveAt.toISOString()
  };
}

function serializeAgentLearningPreference(metadataValue: unknown): AgentLearningPreferenceRecord {
  const metadata = metadataValue && typeof metadataValue === 'object' && !Array.isArray(metadataValue)
    ? metadataValue as Record<string, unknown>
    : {};
  const value = metadata.agentLearningPreference && typeof metadata.agentLearningPreference === 'object' && !Array.isArray(metadata.agentLearningPreference)
    ? metadata.agentLearningPreference as Record<string, unknown>
    : {};
  const version = Number(value.version);
  const mode = value.defaultLearningMode === 'free' ? 'free' : 'recommended';
  const subject = value.defaultFreePracticeSubject === 'physics' || value.defaultFreePracticeSubject === 'chemistry'
    ? value.defaultFreePracticeSubject
    : 'math';
  const count = value.defaultFreePracticeCount === 3 || value.defaultFreePracticeCount === 10 ? value.defaultFreePracticeCount : 5;
  return {
    preferenceVersion: Number.isInteger(version) && version > 0 ? String(version) : 'unset',
    defaultLearningMode: mode,
    defaultFreePracticeSubject: subject,
    defaultFreePracticeCount: count,
    source: Number.isInteger(version) && version > 0 ? 'user' : 'default',
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : null
  };
}

type OptionItem = { id: string; text: string };
type SnapshotQuestion = {
  id: number;
  orderNumber: number | undefined;
  prompt: string;
  options: OptionItem[];
  correctAnswer: string;
  explanation: string;
  knowledgeTags: string[];
  status: string;
};

function cleanString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value.trim() : value === null || value === undefined ? fallback : String(value).trim();
}

function recordFrom(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function isUsableQuestionVersion(generationMetadata: unknown) {
  const metadata = recordFrom(generationMetadata);
  const governance = recordFrom(metadata.versionGovernance);
  const status = cleanString(governance.status);
  return isStudentConsumableAiVersionStatus(status);
}

function cleanOptionalProfileText(value: unknown, max = 120) {
  const text = cleanString(value).replace(/\s+/g, ' ');
  return text ? text.slice(0, max) : null;
}

function cleanCountryCode(value: unknown) {
  const code = cleanString(value).toUpperCase();
  return COUNTRY_BY_CODE.has(code) ? code : null;
}

function inferCountryCode(value: string | null | undefined) {
  const text = cleanString(value).toLowerCase();
  return text ? COUNTRY_CODE_BY_NAME.get(text) ?? null : null;
}

function countryNameForCode(code: string | null, fallback: string | null) {
  return code ? COUNTRY_BY_CODE.get(code) ?? fallback : fallback;
}

function cleanGradeCode(value: unknown) {
  const code = cleanString(value).toUpperCase();
  return GRADE_BY_CODE.has(code) ? code : null;
}

function inferGradeCode(value: string | null | undefined) {
  const text = cleanString(value).toLowerCase();
  return text ? GRADE_CODE_BY_NAME.get(text) ?? null : null;
}

function gradeNameForCode(code: string | null, fallback: string | null) {
  return code ? GRADE_BY_CODE.get(code) ?? fallback : fallback;
}

function cleanProfileChoice(value: unknown, allowed: ReadonlySet<string>, field: string) {
  const next = cleanString(value);
  if (!next) return null;
  if (!allowed.has(next)) throw new BadRequestException(`${field} 选项无效。`);
  return next;
}

function cleanNullableYear(value: unknown) {
  if (value === undefined || value === null || value === '') return null;
  const year = Number(value);
  if (!Number.isInteger(year) || year < 2020 || year > 2100) throw new BadRequestException('预计毕业年份无效。');
  return year;
}

function cleanWeeklyGoalDays(value: unknown) {
  if (value === undefined || value === null || value === '') return null;
  const days = Number(value);
  if (!Number.isInteger(days) || days < 1 || days > 7) throw new BadRequestException('每周学习目标必须为 1-7 天。');
  return days;
}

function cleanTargetExamDate(value: unknown) {
  const text = cleanString(value);
  if (!text) return null;
  if (!/^\d{4}-\d{2}(?:-\d{2})?$/.test(text)) throw new BadRequestException('目标考试月份无效。');
  const date = new Date(`${text.slice(0, 7)}-01T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new BadRequestException('目标考试月份无效。');
  return date;
}

function cleanTargetSubjectCodes(value: unknown) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new BadRequestException('备考科目必须是数组。');
  const items = [...new Set(value.map((item) => cleanString(item)).filter(Boolean))];
  if (items.some((item) => !TARGET_SUBJECT_CODES.has(item))) throw new BadRequestException('备考科目选项无效。');
  return items;
}

function serializedSubjectCodes(value: Prisma.JsonValue | null | undefined) {
  return Array.isArray(value) ? value.map((item) => cleanString(item)).filter((item) => TARGET_SUBJECT_CODES.has(item)) : [];
}

function parseNullablePositiveInt(value: unknown, field: string) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new BadRequestException(`${field} 必须是正整数。`);
  return parsed;
}

function enabled(value: string | undefined) {
  return ['1', 'true', 'yes', 'on'].includes(String(value ?? '').trim().toLowerCase());
}

function readNonNegativeInt(name: string, fallback: number) {
  const value = Number.parseInt(String(process.env[name] ?? ''), 10);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function normalizeEmail(value: string | null | undefined) {
  return String(value ?? '').trim().toLowerCase();
}

function readUnlimitedAIEmails() {
  const configured = String(process.env.CSCA_AI_UNLIMITED_EMAILS ?? '')
    .split(',')
    .map(normalizeEmail)
    .filter(Boolean);
  return new Set([...DEFAULT_UNLIMITED_AI_EMAILS, ...configured]);
}

function aiCreditsEnabled() {
  return enabled(process.env.CSCA_AI_ENTITLEMENT_ENABLED) || readNonNegativeInt('CSCA_AI_INITIAL_FREE_UNITS', 50) > 0;
}

function aiCreditUsageLabel(abilityType: string, reason: string) {
  const labels: Record<string, string> = {
    hint: 'AI 提示',
    explain_wrong_answer: 'AI 错因解析',
    round_summary: 'AI 本轮总结',
    weekly_learning_summary: '学习总结润色',
    ai_credit_purchase: '购买额度',
    ai_credit_grant: '额度发放'
  };
  if (reason === 'refund') return '额度退回';
  if (reason === 'reserve') return labels[abilityType] ? `${labels[abilityType]}预占` : '额度预占';
  return labels[abilityType] ?? abilityType;
}

function serializeStudentProfile(profile: {
  nationality: string | null;
  nationalityCode: string | null;
  country: string | null;
  countryCode: string | null;
  grade: string | null;
  gradeCode: string | null;
  genderCode: string | null;
  educationStageCode: string | null;
  graduationYear: number | null;
  targetExamDate: Date | null;
  targetSubjectCodes: Prisma.JsonValue | null;
  preferredQuestionLanguageCode: string | null;
  examAttemptType: string | null;
  weeklyGoalDays: number | null;
  targetMajorCategoryCode: string | null;
  onboardingCompletedAt: Date | null;
  onboardingSkippedAt: Date | null;
  currentOrganizationId: number | null;
  updatedAt: Date;
} | null): StudentProfileRecord {
  const nationalityCode = profile?.nationalityCode ?? inferCountryCode(profile?.nationality);
  const countryCode = profile?.countryCode ?? inferCountryCode(profile?.country);
  const gradeCode = profile?.gradeCode ?? inferGradeCode(profile?.grade);
  return {
    nationality: countryNameForCode(nationalityCode, profile?.nationality ?? null) ?? null,
    nationalityCode,
    country: countryNameForCode(countryCode, profile?.country ?? null) ?? null,
    countryCode,
    grade: gradeNameForCode(gradeCode, profile?.grade ?? null) ?? null,
    gradeCode,
    genderCode: profile?.genderCode ?? null,
    educationStageCode: profile?.educationStageCode ?? null,
    graduationYear: profile?.graduationYear ?? null,
    targetExamDate: profile?.targetExamDate?.toISOString().slice(0, 10) ?? null,
    targetSubjectCodes: serializedSubjectCodes(profile?.targetSubjectCodes),
    preferredQuestionLanguageCode: profile?.preferredQuestionLanguageCode ?? null,
    examAttemptType: profile?.examAttemptType ?? null,
    weeklyGoalDays: profile?.weeklyGoalDays ?? null,
    targetMajorCategoryCode: profile?.targetMajorCategoryCode ?? null,
    onboardingCompletedAt: profile?.onboardingCompletedAt?.toISOString() ?? null,
    onboardingSkippedAt: profile?.onboardingSkippedAt?.toISOString() ?? null,
    currentOrganizationId: profile?.currentOrganizationId ?? null,
    updatedAt: profile?.updatedAt.toISOString() ?? null
  };
}

function recordStringMap(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).map(([key, next]) => [String(key), cleanString(next)]).filter(([, next]) => next));
}

function numberMap(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).map(([key, next]) => [String(key), Math.max(0, Number(next) || 0)]));
}

function optionsFromJson(value: Prisma.JsonValue | unknown): OptionItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
      const option = item as Record<string, unknown>;
      return { id: cleanString(option.id), text: cleanString(option.text) };
    })
    .filter((item): item is OptionItem => Boolean(item?.id && item.text));
}

function tagsFromJson(value: Prisma.JsonValue | unknown): string[] {
  return Array.isArray(value) ? value.map((item) => cleanString(item)).filter(Boolean) : [];
}

function questionsFromSnapshot(value: unknown): SnapshotQuestion[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
      const record = item as Record<string, unknown>;
      const id = Number(record.id);
      if (!Number.isInteger(id)) return null;
      return {
        id,
        orderNumber: Number.isInteger(Number(record.orderNumber)) ? Number(record.orderNumber) : undefined,
        prompt: cleanString(record.prompt),
        options: optionsFromJson(record.options),
        correctAnswer: cleanString(record.correctAnswer),
        explanation: cleanString(record.explanation),
        knowledgeTags: tagsFromJson(record.knowledgeTags),
        status: cleanString(record.status, 'published')
      };
    })
    .filter((item): item is SnapshotQuestion => Boolean(item?.prompt && item.correctAnswer));
}

function topicLike(input: { id?: number | null; slug?: string | null; code?: string | null; title?: string | null; subject?: string | null; module?: string | null }) {
  const id = input.id ?? null;
  const slug = cleanString(input.slug || input.code || (id ? `topic-${id}` : 'general'));
  const title = cleanString(input.title, slug);
  const subject = cleanString(input.subject);
  const module = cleanString(input.module, title);
  return { id, slug, title, subject, module };
}

function sourceRank(sourceType: CscaWrongQuestionSourceType) {
  return sourceType === 'diagnostic' ? 0 : sourceType === 'adaptive_round' ? 1 : sourceType === 'mock_exam' ? 2 : 3;
}

function structuredExplanationFromJson(value: Prisma.JsonValue | unknown): CscaWrongQuestionStructuredExplanation | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const structured = {
    whyWrong: cleanString(record.whyWrong),
    correctApproach: cleanString(record.correctApproach),
    quickMethod: cleanString(record.quickMethod),
    avoidNextTime: cleanString(record.avoidNextTime)
  };
  return Object.values(structured).every((text) => text.length >= 4) ? structured : null;
}

function patternTypeForWrongQuestion(item: Pick<CscaWrongQuestionItem, 'knowledgeTags' | 'selected' | 'timeSpentSeconds'>) {
  const tags = item.knowledgeTags.join(' ');
  if (!item.selected) return 'unanswered';
  if (/公式|方程|定律|函数|几何|圆|三角|log|ln|sin|cos|tan/i.test(tags)) return 'formula_or_rule';
  if (/计算|运算|化简|单位|换算|比例|分数|小数/i.test(tags)) return 'calculation';
  if (/图|表|坐标|图像|图形|空间|截距|斜率/i.test(tags)) return 'visual_interpretation';
  if (item.timeSpentSeconds > 0 && item.timeSpentSeconds < 12) return 'pacing';
  return 'concept_gap';
}

function patternLabel(patternType: string) {
  const labels: Record<string, string> = {
    unanswered: '未答与节奏问题',
    pacing: '时间压力与节奏问题',
    formula_or_rule: '公式/规则混淆',
    calculation: '计算与化简失误',
    visual_interpretation: '图形/图表理解偏差',
    concept_gap: '概念理解缺口'
  };
  return labels[patternType] ?? labels.concept_gap;
}

function recentQuestionIdsFromJson(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  const ids = (value as Record<string, unknown>).recentQuestionIds;
  return Array.isArray(ids) ? ids.filter((id): id is number => Number.isInteger(id)) : [];
}

function metadataRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function wrongPatternVerificationState(input: { metadata: unknown }) {
  const metadata = metadataRecord(input.metadata);
  const reviewAt = typeof metadata.lastReviewCompletedAt === 'string' ? metadata.lastReviewCompletedAt : null;
  const verifiedAt = typeof metadata.verificationCompletedAt === 'string' ? metadata.verificationCompletedAt : null;
  const reviewAtMs = reviewAt ? Date.parse(reviewAt) : NaN;
  const verifiedAtMs = verifiedAt ? Date.parse(verifiedAt) : NaN;
  const verificationStatus = Number.isFinite(reviewAtMs)
    ? Number.isFinite(verifiedAtMs) && verifiedAtMs >= reviewAtMs
      ? 'verified_repaired' as const
      : 'pending_verification' as const
    : 'not_started' as const;
  return {
    lastReviewCompletedAt: Number.isFinite(reviewAtMs) ? new Date(reviewAtMs).toISOString() : null,
    verificationStatus,
    verificationRequired: verificationStatus === 'pending_verification'
  };
}

function wrongPatternVerificationHref(pattern: { id: number; subject: string; patternType: string; topicId: number | null }) {
  const params = new URLSearchParams({ review: pattern.patternType, verify: String(pattern.id) });
  if (Number.isInteger(pattern.topicId)) params.set('topicId', String(pattern.topicId));
  return `/zh/csca-subjects/${pattern.subject}?${params.toString()}`;
}

function dueForReview(value: string | null) {
  return !value || Date.parse(value) <= Date.now();
}

function defaultMistakePatternFields() {
  const patternType = 'concept_gap';
  const label = patternLabel(patternType);
  return {
    mistakePattern: { patternType, label, confidence: 0.45, source: 'rule' as const },
    patternType,
    patternLabel: label,
    patternConfidence: 0.45
  };
}

function toSavedSchoolRecord(createdAt: Date, school: Awaited<ReturnType<SchoolsService['listPublishedSchoolRecordsByIds']>>[number]): SavedSchoolRecord {
  return {
    ...school,
    savedAt: createdAt.toISOString()
  };
}

function toCompareSchoolRecord(createdAt: Date, school: Awaited<ReturnType<SchoolsService['listPublishedSchoolRecordsByIds']>>[number]): CompareSchoolRecord {
  return {
    ...school,
    comparedAt: createdAt.toISOString()
  };
}

@Injectable()
export class MeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly schoolsService: SchoolsService
  ) {}

  async listSavedSchools(userId: number): Promise<SavedSchoolRecord[]> {
    const items = await this.prisma.savedSchool.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { schoolId: 'asc' }]
    });
    if (!items.length) {
      return [];
    }

    const schools = await this.schoolsService.listPublishedSchoolRecordsByIds(items.map((item) => item.schoolId));
    const schoolMap = new Map(schools.map((school) => [school.id, school] as const));
    return items
      .map((item) => {
        const school = schoolMap.get(item.schoolId);
        return school ? toSavedSchoolRecord(item.createdAt, school) : null;
      })
      .filter((item): item is SavedSchoolRecord => Boolean(item));
  }

  async addSavedSchool(userId: number, schoolId: number) {
    await this.assertPublishedSchool(schoolId);
    await this.prisma.savedSchool.upsert({
      where: {
        userId_schoolId: {
          userId,
          schoolId
        }
      },
      update: {},
      create: {
        userId,
        schoolId
      }
    });
    return {
      saved: true,
      schoolId
    };
  }

  async removeSavedSchool(userId: number, schoolId: number) {
    await this.prisma.savedSchool.deleteMany({
      where: {
        userId,
        schoolId
      }
    });
    return {
      removed: true,
      schoolId
    };
  }

  async listCompareSchools(userId: number): Promise<CompareSchoolRecord[]> {
    const items = await this.prisma.schoolCompareItem.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'asc' }, { schoolId: 'asc' }]
    });
    if (!items.length) {
      return [];
    }

    const schools = await this.schoolsService.listPublishedSchoolRecordsByIds(items.map((item) => item.schoolId));
    const schoolMap = new Map(schools.map((school) => [school.id, school] as const));
    return items
      .map((item) => {
        const school = schoolMap.get(item.schoolId);
        return school ? toCompareSchoolRecord(item.createdAt, school) : null;
      })
      .filter((item): item is CompareSchoolRecord => Boolean(item));
  }

  async listCompareDetails(userId: number): Promise<CompareSchoolRecord[]> {
    return this.listCompareSchools(userId);
  }

  async getStudentProfile(userId: number): Promise<StudentProfileRecord> {
    const profile = await this.prisma.studentProfile.findUnique({
      where: { userId },
      select: STUDENT_PROFILE_SELECT
    });
    return serializeStudentProfile(profile);
  }

  async updateStudentProfile(userId: number, body: Record<string, unknown>): Promise<StudentProfileRecord> {
    const has = (key: string) => Object.prototype.hasOwnProperty.call(body, key);
    const existing = await this.prisma.studentProfile.findUnique({ where: { userId }, select: STUDENT_PROFILE_SELECT });
    const changes: Record<string, unknown> = {};

    if (has('nationality') || has('nationalityCode')) {
      const nationalityCode = cleanCountryCode(body.nationalityCode);
      changes.nationalityCode = nationalityCode;
      changes.nationality = countryNameForCode(nationalityCode, cleanOptionalProfileText(body.nationality));
    }
    if (has('country') || has('countryCode')) {
      const countryCode = cleanCountryCode(body.countryCode);
      changes.countryCode = countryCode;
      changes.country = countryNameForCode(countryCode, cleanOptionalProfileText(body.country));
    }
    if (has('grade') || has('gradeCode')) {
      const gradeCode = cleanGradeCode(body.gradeCode);
      changes.gradeCode = gradeCode;
      changes.grade = gradeNameForCode(gradeCode, cleanOptionalProfileText(body.grade, 80));
    }
    if (has('genderCode')) changes.genderCode = cleanProfileChoice(body.genderCode, PROFILE_CHOICES.genderCode, '性别');
    if (has('educationStageCode')) changes.educationStageCode = cleanProfileChoice(body.educationStageCode, PROFILE_CHOICES.educationStageCode, '教育阶段');
    if (has('graduationYear')) changes.graduationYear = cleanNullableYear(body.graduationYear);
    if (has('targetExamDate')) changes.targetExamDate = cleanTargetExamDate(body.targetExamDate);
    if (has('targetSubjectCodes')) changes.targetSubjectCodes = cleanTargetSubjectCodes(body.targetSubjectCodes);
    if (has('preferredQuestionLanguageCode')) changes.preferredQuestionLanguageCode = cleanProfileChoice(body.preferredQuestionLanguageCode, PROFILE_CHOICES.preferredQuestionLanguageCode, '题目语言');
    if (has('examAttemptType')) changes.examAttemptType = cleanProfileChoice(body.examAttemptType, PROFILE_CHOICES.examAttemptType, '考试经历');
    if (has('weeklyGoalDays')) changes.weeklyGoalDays = cleanWeeklyGoalDays(body.weeklyGoalDays);
    if (has('targetMajorCategoryCode')) changes.targetMajorCategoryCode = cleanProfileChoice(body.targetMajorCategoryCode, PROFILE_CHOICES.targetMajorCategoryCode, '目标专业');

    const hasCurrentOrganizationId = Object.prototype.hasOwnProperty.call(body, 'currentOrganizationId');
    const currentOrganizationId = hasCurrentOrganizationId ? parseNullablePositiveInt(body.currentOrganizationId, '当前机构 ID') : undefined;
    if (typeof currentOrganizationId === 'number') {
      const membership = await this.prisma.organizationMember.findFirst({
        where: {
          userId,
          organizationId: currentOrganizationId,
          status: 'active',
          organization: { status: 'active' }
        },
        select: { role: true }
      });
      if (!membership || !organizationRoleAllows(membership.role, 'use_ai_pool')) {
        throw new BadRequestException('只能选择已加入且可使用 AI 额度的机构。');
      }
      changes.currentOrganizationId = currentOrganizationId;
    } else if (hasCurrentOrganizationId) {
      changes.currentOrganizationId = null;
    }

    const onboardingAction = cleanString(body.onboardingAction);
    if (onboardingAction && onboardingAction !== 'complete' && onboardingAction !== 'skip') {
      throw new BadRequestException('注册引导操作无效。');
    }
    if (onboardingAction === 'complete') {
      const effective = { ...existing, ...changes };
      if (!effective.educationStageCode) throw new BadRequestException('请选择教育阶段。');
      if (!Array.isArray(effective.targetSubjectCodes) || effective.targetSubjectCodes.length === 0) throw new BadRequestException('请至少选择一个备考科目。');
      if (!effective.preferredQuestionLanguageCode) throw new BadRequestException('请选择题目与解析语言。');
      changes.onboardingCompletedAt = new Date();
      changes.onboardingSkippedAt = null;
    } else if (onboardingAction === 'skip' && !existing?.onboardingCompletedAt) {
      changes.onboardingSkippedAt = new Date();
    }

    if (!Object.keys(changes).length) return serializeStudentProfile(existing);
    const profile = await this.prisma.studentProfile.upsert({
      where: { userId },
      create: {
        userId,
        ...changes,
        metadata: { source: onboardingAction ? 'onboarding' : 'account_settings' }
      },
      update: changes,
      select: STUDENT_PROFILE_SELECT
    });
    return serializeStudentProfile(profile);
  }

  async getAgentLearningSettings(userId: number): Promise<AgentLearningSettingsRecord> {
    const [goal, availability, profile] = await Promise.all([
      this.prisma.studentScoreGoal.findFirst({
        where: { userId, examSystemCode: 'csca', status: 'active' },
        include: { subjects: { orderBy: [{ priority: 'asc' }, { subjectCode: 'asc' }] } },
        orderBy: [{ effectiveAt: 'desc' }, { createdAt: 'desc' }]
      }),
      this.prisma.studyAvailabilityPreference.findFirst({
        where: { userId, status: 'active' },
        orderBy: [{ version: 'desc' }, { createdAt: 'desc' }]
      }),
      this.prisma.studentProfile.findUnique({ where: { userId }, select: { metadata: true } })
    ]);
    return {
      currentScoringPolicyVersion: SHADOW_SCORING_POLICY_VERSION,
      scoreGoal: serializeAgentScoreGoal(goal),
      studyAvailability: serializeAgentAvailability(availability),
      learningPreference: serializeAgentLearningPreference(profile?.metadata)
    };
  }

  async updateAgentLearningPreference(userId: number, body: Record<string, unknown>): Promise<AgentLearningPreferenceRecord> {
    const mode = body.defaultLearningMode;
    const subject = body.defaultFreePracticeSubject;
    const count = body.defaultFreePracticeCount;
    const expectedVersion = typeof body.expectedPreferenceVersion === 'string' ? body.expectedPreferenceVersion : '';
    if (body.schemaVersion !== '1' || (mode !== 'recommended' && mode !== 'free') || !TARGET_SUBJECT_CODES.has(String(subject)) || (count !== 3 && count !== 5 && count !== 10)) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: '默认学习方式设置无效。' });
    }
    if (!expectedVersion) throw new BadRequestException({ code: 'EXPECTED_VERSION_REQUIRED', message: '请先读取当前学习方式版本。' });
    const now = new Date();
    const metadata = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${AGENT_SETTINGS_LOCK_NAMESPACE}::int, ${userId}::int)`;
      const profile = await tx.studentProfile.findUnique({ where: { userId }, select: { metadata: true } });
      const currentMetadata = metadataRecord(profile?.metadata);
      const current = serializeAgentLearningPreference(currentMetadata);
      if (current.preferenceVersion !== expectedVersion) {
        throw new ConflictException({ code: 'VERSION_CONFLICT', message: '学习方式已在其他页面更新，请刷新后重试。', currentVersion: current.preferenceVersion });
      }
      const nextVersion = current.preferenceVersion === 'unset' ? 1 : Number(current.preferenceVersion) + 1;
      const nextMetadata = {
        ...currentMetadata,
        agentLearningPreference: {
          version: nextVersion,
          defaultLearningMode: mode,
          defaultFreePracticeSubject: subject,
          defaultFreePracticeCount: count,
          updatedAt: now.toISOString(),
          source: 'user'
        }
      };
      await tx.studentProfile.upsert({
        where: { userId },
        create: { userId, metadata: nextMetadata as Prisma.InputJsonValue },
        update: { metadata: nextMetadata as Prisma.InputJsonValue }
      });
      return nextMetadata;
    });
    return serializeAgentLearningPreference(metadata);
  }

  async updateAgentScoreGoal(userId: number, body: Record<string, unknown>): Promise<AgentScoreGoalRecord> {
    const parsed = UpdateScoreGoalInputV1Schema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: '考试目标设置无效。', issues: parsed.error.issues });
    }
    if (parsed.data.expectedScoringPolicyVersion !== SHADOW_SCORING_POLICY_VERSION) {
      throw new ConflictException({
        code: 'SCORING_POLICY_VERSION_CHANGED',
        message: '评分规则版本已变化，请刷新设置后重试。',
        currentScoringPolicyVersion: SHADOW_SCORING_POLICY_VERSION
      });
    }
    if (parsed.data.subjectGoals.some((item) => !Number.isInteger(item.targetScore) || item.targetScore < 1 || item.targetScore > 100)) {
      throw new BadRequestException({ code: 'TARGET_SCORE_OUT_OF_RANGE', message: '每科目标分数必须在 1 到 100 之间。' });
    }
    if (!parsed.data.expectedGoalVersion) {
      throw new BadRequestException({ code: 'EXPECTED_VERSION_REQUIRED', message: '请先读取当前考试目标版本。' });
    }
    const examDate = new Date(`${parsed.data.examDate}T00:00:00.000Z`);
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${AGENT_SETTINGS_LOCK_NAMESPACE}::int, ${userId}::int)`;
      const active = await tx.studentScoreGoal.findFirst({
        where: { userId, examSystemCode: 'csca', status: 'active' },
        orderBy: [{ effectiveAt: 'desc' }, { createdAt: 'desc' }]
      });
      const currentVersion = active ? `goal:${active.id}:v${active.version}` : 'unset';
      if (parsed.data.expectedGoalVersion !== currentVersion) {
        throw new ConflictException({ code: 'VERSION_CONFLICT', message: '考试目标已在其他页面更新，请刷新后重试。', currentVersion });
      }
      const latestForBatch = await tx.studentScoreGoal.findFirst({
        where: { userId, examSystemCode: 'csca', examBatchCode: parsed.data.examBatchCode },
        orderBy: { version: 'desc' },
        select: { version: true }
      });
      const availability = await tx.studyAvailabilityPreference.findFirst({
        where: { userId, status: 'active' }, orderBy: { version: 'desc' }, select: { version: true }
      });
      const now = new Date();
      await tx.studentScoreGoal.updateMany({
        where: { userId, examSystemCode: 'csca', status: 'active' },
        data: { status: 'superseded', supersededAt: now }
      });
      const goal = await tx.studentScoreGoal.create({
        data: {
          userId,
          examSystemCode: 'csca',
          examBatchCode: parsed.data.examBatchCode,
          examDate,
          version: (latestForBatch?.version ?? 0) + 1,
          totalTargetScore: parsed.data.subjectGoals.reduce((sum, item) => sum + item.targetScore, 0),
          availabilityVersion: availability ? String(availability.version) : 'unset',
          scoringPolicyVersion: SHADOW_SCORING_POLICY_VERSION,
          replacesGoalId: active?.id ?? null,
          source: 'user',
          subjects: {
            create: parsed.data.subjectGoals.map((item, index) => ({
              subjectCode: item.subject,
              targetScore: item.targetScore,
              priority: item.priority ?? index + 1
            }))
          }
        },
        include: { subjects: { orderBy: [{ priority: 'asc' }, { subjectCode: 'asc' }] } }
      });
      await tx.studentProfile.upsert({
        where: { userId },
        create: {
          userId,
          targetExamDate: examDate,
          targetSubjectCodes: parsed.data.subjectGoals.map((item) => item.subject),
          metadata: { source: 'agent_score_goal_settings' }
        },
        update: {
          targetExamDate: examDate,
          targetSubjectCodes: parsed.data.subjectGoals.map((item) => item.subject)
        }
      });
      return goal;
    });
    return serializeAgentScoreGoal(result);
  }

  async updateAgentStudyAvailability(userId: number, body: Record<string, unknown>): Promise<AgentStudyAvailabilityRecord> {
    const parsed = UpdateStudyAvailabilityInputV1Schema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: '学习时间设置无效。', issues: parsed.error.issues });
    }
    if (!parsed.data.expectedAvailabilityVersion) {
      throw new BadRequestException({ code: 'EXPECTED_VERSION_REQUIRED', message: '请先读取当前学习时间版本。' });
    }
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: parsed.data.timezone }).format(new Date());
    } catch {
      throw new BadRequestException({ code: 'INVALID_TIMEZONE', message: '请选择有效的 IANA 时区。' });
    }
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${AGENT_SETTINGS_LOCK_NAMESPACE}::int, ${userId}::int)`;
      const active = await tx.studyAvailabilityPreference.findFirst({
        where: { userId, status: 'active' }, orderBy: [{ version: 'desc' }, { createdAt: 'desc' }]
      });
      const currentVersion = active ? String(active.version) : 'unset';
      if (parsed.data.expectedAvailabilityVersion !== currentVersion) {
        throw new ConflictException({ code: 'VERSION_CONFLICT', message: '学习时间已在其他页面更新，请刷新后重试。', currentVersion });
      }
      const latest = await tx.studyAvailabilityPreference.findFirst({
        where: { userId }, orderBy: { version: 'desc' }, select: { version: true }
      });
      const now = new Date();
      await tx.studyAvailabilityPreference.updateMany({
        where: { userId, status: 'active' }, data: { status: 'superseded', supersededAt: now }
      });
      return tx.studyAvailabilityPreference.create({
        data: {
          userId,
          version: (latest?.version ?? 0) + 1,
          timezone: parsed.data.timezone,
          weeklyMinutesGoal: parsed.data.weeklyMinutesGoal,
          preferredStudyDays: parsed.data.preferredStudyDays,
          defaultSessionMinutes: parsed.data.defaultSessionMinutes,
          source: 'user'
        }
      });
    });
    return serializeAgentAvailability(result);
  }

  async getAICredits(userId: number): Promise<MyAICredits> {
    const initialFreeUnits = readNonNegativeInt('CSCA_AI_INITIAL_FREE_UNITS', 50);
    const [account, recentUsage, user, studentProfile, organizationMemberships] = await Promise.all([
      this.prisma.cscaAIEntitlementAccount.upsert({
        where: { userId },
        create: {
          userId,
          balanceUnits: initialFreeUnits,
          lifetimeGranted: initialFreeUnits,
          lifetimeUsed: 0
        },
        update: {}
      }),
      this.prisma.cscaAIUsageLedger.findMany({
        where: { userId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 10
      }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, loginName: true }
      }),
      this.prisma.studentProfile.findUnique({
        where: { userId },
        select: { currentOrganizationId: true }
      }),
      this.prisma.organizationMember.findMany({
        where: {
          userId,
          status: 'active',
          organization: { status: 'active' }
        },
        include: {
          cohort: { select: { id: true, name: true } },
          organization: {
            include: {
              aiCreditPool: true
            }
          }
        },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        take: 10
      })
    ]);
    const now = new Date();
    const currentOrganizationId = studentProfile?.currentOrganizationId ?? null;
    const organizationOptions = organizationMemberships
      .filter((membership) => organizationRoleAllows(membership.role, 'use_ai_pool'))
      .map((membership) => {
        const pool = membership.organization.aiCreditPool;
        const hasActivePool = Boolean(pool && pool.status === 'active' && (!pool.expiresAt || pool.expiresAt > now));
        return {
          id: membership.organization.id,
          slug: membership.organization.slug,
          name: membership.organization.name,
          role: membership.role,
          cohortId: membership.cohortId ?? null,
          cohortName: membership.cohort?.name ?? null,
          balanceUnits: hasActivePool ? pool?.availableCredits ?? null : null,
          reservedCredits: hasActivePool ? pool?.reservedCredits ?? null : null,
          perUserDailyLimit: hasActivePool ? pool?.perUserDailyLimit ?? null : null,
          expiresAt: hasActivePool ? pool?.expiresAt?.toISOString() ?? null : null,
          hasActivePool,
          current: currentOrganizationId === membership.organization.id
        };
      });
    const selectedOrganization = currentOrganizationId
      ? organizationOptions.find((organization) => organization.id === currentOrganizationId) ?? null
      : organizationOptions.find((organization) => organization.hasActivePool) ?? null;
    const unlimitedEmails = readUnlimitedAIEmails();
    return {
      enabled: aiCreditsEnabled(),
      balanceUnits: account.balanceUnits,
      lifetimeGranted: account.lifetimeGranted,
      lifetimeUsed: account.lifetimeUsed,
      initialFreeUnits,
      unlimited: unlimitedEmails.has(normalizeEmail(user?.email)) || unlimitedEmails.has(normalizeEmail(user?.loginName)),
      organization: selectedOrganization?.hasActivePool ? {
        id: selectedOrganization.id,
        slug: selectedOrganization.slug,
        name: selectedOrganization.name,
        balanceUnits: selectedOrganization.balanceUnits ?? 0,
        reservedCredits: selectedOrganization.reservedCredits ?? 0,
        perUserDailyLimit: selectedOrganization.perUserDailyLimit,
        expiresAt: selectedOrganization.expiresAt,
        current: selectedOrganization.current
      } : null,
      organizationOptions,
      lowBalanceThreshold: AI_CREDITS_LOW_BALANCE_THRESHOLD,
      recentUsage: recentUsage.map((item) => ({
        id: item.id,
        abilityType: item.abilityType,
        label: aiCreditUsageLabel(item.abilityType, item.reason),
        unitsDelta: item.unitsDelta,
        status: item.status,
        reason: item.reason,
        createdAt: item.createdAt.toISOString()
      }))
    };
  }

  async listCscaWrongQuestions(userId: number, filters: Record<string, string | undefined> = {}): Promise<CscaWrongQuestionResponse> {
    const [specialPracticeItems, adaptiveItems, mockExamItems, patternRows] = await Promise.all([
      this.specialPracticeWrongQuestions(userId),
      this.adaptiveWrongQuestions(userId),
      this.mockExamWrongQuestions(userId),
      this.prisma.cscaWrongPattern.findMany({
        where: { userId },
        orderBy: [{ lastWrongAt: 'desc' }, { id: 'desc' }],
        take: 200
      })
    ]);
    const patternCandidates = patternRows.map((pattern) => ({
      id: pattern.id,
      subject: pattern.subject,
      topicId: pattern.topicId,
      patternType: pattern.patternType,
      label: patternLabel(pattern.patternType),
      confidence: 0.85,
      nextReviewAt: pattern.nextReviewAt,
      status: pattern.status,
      metadata: pattern.metadata,
      recentQuestionIds: recentQuestionIdsFromJson(pattern.metadata)
    }));

    const aiExplanationByKey = await this.aiExplanationMap(userId, [...adaptiveItems, ...mockExamItems, ...specialPracticeItems]);
    const hydratedItems = [...adaptiveItems, ...mockExamItems, ...specialPracticeItems]
      .map((item) => {
        const exactAIKey = item.sourceType === 'adaptive_round' || item.sourceType === 'diagnostic' ? `${item.sourceId}:${item.questionId}` : '';
        const aiExplanation = (exactAIKey ? aiExplanationByKey.get(exactAIKey) : undefined) ?? aiExplanationByKey.get(`question:${item.questionId}`);
        const inferredPatternType = patternTypeForWrongQuestion(item);
        const pattern = patternCandidates
          .filter((candidate) => candidate.subject === item.subject)
          .map((candidate) => {
            let score = 0;
            if (candidate.recentQuestionIds.includes(item.questionId)) score += 8;
            if (item.topicId !== null && candidate.topicId === item.topicId) score += 4;
            if (candidate.topicId === null) score += 1;
            if (candidate.patternType === inferredPatternType) score += 3;
            if (candidate.status === 'active' || candidate.status === 'improving') score += 2;
            return { candidate, score };
          })
          .filter((entry) => entry.score >= 4)
          .sort((a, b) => b.score - a.score || Date.parse(b.candidate.nextReviewAt?.toISOString() ?? '') - Date.parse(a.candidate.nextReviewAt?.toISOString() ?? '') || b.candidate.id - a.candidate.id)[0]?.candidate;
        const mistakePattern: CscaWrongQuestionPattern = pattern
          ? {
              patternType: pattern.patternType,
              label: pattern.label,
              confidence: pattern.recentQuestionIds.includes(item.questionId) ? 0.92 : pattern.confidence,
              source: 'wrong_pattern'
            }
          : {
              patternType: inferredPatternType,
              label: patternLabel(inferredPatternType),
              confidence: 0.45,
              source: 'rule'
            };
        return {
          ...item,
          aiExplanationId: aiExplanation?.id ?? item.aiExplanationId,
          structuredExplanation: aiExplanation?.structuredExplanation ?? item.structuredExplanation,
          mistakePattern,
          patternType: mistakePattern.patternType,
          patternLabel: mistakePattern.label,
          patternConfidence: mistakePattern.confidence,
          nextReviewAt: item.nextReviewAt ?? pattern?.nextReviewAt?.toISOString() ?? null,
          reviewPattern: pattern
            ? {
                id: pattern.id,
                status: pattern.status,
                patternType: pattern.patternType,
                nextReviewAt: pattern.nextReviewAt?.toISOString() ?? null,
                ...wrongPatternVerificationState({ metadata: pattern.metadata }),
                verificationHref: wrongPatternVerificationHref({
                  id: pattern.id,
                  subject: pattern.subject,
                  patternType: pattern.patternType,
                  topicId: pattern.topicId
                })
              }
            : null
        };
      })
      .filter((item) => this.matchesWrongQuestionFilters(item, filters));
    const items = hydratedItems
      .sort((a, b) => {
        const timeDelta = Date.parse(b.lastWrongAt ?? b.completedAt ?? '') - Date.parse(a.lastWrongAt ?? a.completedAt ?? '');
        return timeDelta || sourceRank(a.sourceType) - sourceRank(b.sourceType) || b.sourceId - a.sourceId || b.questionId - a.questionId;
      })
      .slice(0, WRONG_QUESTION_LIMIT);
    return {
      summary: this.wrongQuestionSummary(items),
      reviewPacks: this.wrongQuestionReviewPacks(items),
      items
    };
  }

  private async aiExplanationMap(userId: number, items: CscaWrongQuestionItem[]) {
    const questionIds = Array.from(new Set(items.map((item) => item.questionId)));
    if (!questionIds.length) return new Map<string, { id: number; structuredExplanation: CscaWrongQuestionStructuredExplanation | null }>();
    const rows = await this.prisma.cscaAIInteraction.findMany({
      where: {
        userId,
        type: 'explain_wrong_answer',
        status: 'success',
        questionId: { in: questionIds }
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 300
    });
    const map = new Map<string, { id: number; structuredExplanation: CscaWrongQuestionStructuredExplanation | null }>();
    rows.forEach((row) => {
      const structuredExplanation = structuredExplanationFromJson(row.structuredOutput);
      if (!structuredExplanation || !row.questionId) return;
      if (row.roundId && !map.has(`${row.roundId}:${row.questionId}`)) {
        map.set(`${row.roundId}:${row.questionId}`, { id: row.id, structuredExplanation });
      }
      const questionKey = `question:${row.questionId}`;
      if (!map.has(questionKey)) map.set(questionKey, { id: row.id, structuredExplanation });
    });
    return map;
  }

  async addCompareSchool(userId: number, schoolId: number) {
    await this.assertPublishedSchool(schoolId);

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${COMPARE_LOCK_NAMESPACE}::int, ${userId}::int)`;

      const existing = await tx.schoolCompareItem.findUnique({
        where: {
          userId_schoolId: {
            userId,
            schoolId
          }
        }
      });
      if (existing) {
        const total = await tx.schoolCompareItem.count({ where: { userId } });
        return {
          saved: true,
          schoolId,
          total
        };
      }

      const total = await tx.schoolCompareItem.count({ where: { userId } });
      if (total >= MAX_COMPARE_ITEMS) {
        throw new BadRequestException(`当前最多只能对比 ${MAX_COMPARE_ITEMS} 所学校。`);
      }

      await tx.schoolCompareItem.create({
        data: {
          userId,
          schoolId
        }
      });
      return {
        saved: true,
        schoolId,
        total: total + 1
      };
    });
  }

  async removeCompareSchool(userId: number, schoolId: number) {
    const total = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${COMPARE_LOCK_NAMESPACE}::int, ${userId}::int)`;
      await tx.schoolCompareItem.deleteMany({
        where: {
          userId,
          schoolId
        }
      });
      return tx.schoolCompareItem.count({ where: { userId } });
    });
    return {
      removed: true,
      schoolId,
      total
    };
  }

  private async assertPublishedSchool(schoolId: number) {
    const school = await this.prisma.school.findFirst({
      where: {
        id: schoolId,
        status: 'published'
      },
      select: { id: true }
    });
    if (!school) {
      throw new NotFoundException('学校不存在或暂不可用。');
    }
  }

  private matchesWrongQuestionFilters(item: CscaWrongQuestionItem, filters: Record<string, string | undefined>) {
    const subject = cleanString(filters.subject);
    const module = cleanString(filters.module);
    const topicSlug = cleanString(filters.topicSlug);
    const knowledgeTag = cleanString(filters.knowledgeTag);
    const sourceType = cleanString(filters.sourceType);
    if (subject && item.subject !== subject && item.topic.subject !== subject) return false;
    if (module && item.topic.module !== module) return false;
    if (topicSlug && item.topic.slug !== topicSlug) return false;
    if (knowledgeTag && !item.knowledgeTags.includes(knowledgeTag)) return false;
    if (sourceType && item.sourceType !== sourceType) return false;
    if (cleanString(filters.patternType) && item.patternType !== cleanString(filters.patternType)) return false;
    return true;
  }

  private wrongQuestionSummary(items: CscaWrongQuestionItem[]): CscaWrongQuestionResponse['summary'] {
    const patternMap = new Map<string, { patternType: string; label: string; count: number }>();
    items.forEach((item) => {
      const existing = patternMap.get(item.patternType) ?? { patternType: item.patternType, label: item.patternLabel, count: 0 };
      existing.count += 1;
      patternMap.set(item.patternType, existing);
    });
    return {
      total: items.length,
      unreviewed: items.filter((item) => item.status === 'unreviewed').length,
      dueForReview: items.filter((item) => dueForReview(item.nextReviewAt)).length,
      patternTypes: Array.from(patternMap.values()).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    };
  }

  private wrongQuestionReviewPacks(items: CscaWrongQuestionItem[]): CscaWrongQuestionResponse['reviewPacks'] {
    const packMap = new Map<string, CscaWrongQuestionResponse['reviewPacks'][number]>();
    items.forEach((item) => {
      const existing = packMap.get(item.patternType) ?? {
        patternType: item.patternType,
        label: item.patternLabel,
        confidence: item.patternConfidence,
        source: item.mistakePattern.source,
        count: 0,
        dueCount: 0,
        subjects: [],
        topicTitles: [],
        latestWrongAt: null,
        practicePath: item.practicePath
      };
      existing.count += 1;
      existing.dueCount += dueForReview(item.nextReviewAt) ? 1 : 0;
      existing.confidence = Math.max(existing.confidence, item.patternConfidence);
      if (!existing.subjects.includes(item.subject)) existing.subjects.push(item.subject);
      if (item.topicTitle && !existing.topicTitles.includes(item.topicTitle)) existing.topicTitles.push(item.topicTitle);
      if (!existing.latestWrongAt || Date.parse(item.lastWrongAt ?? '') > Date.parse(existing.latestWrongAt)) {
        existing.latestWrongAt = item.lastWrongAt;
        existing.practicePath = item.practicePath;
      }
      packMap.set(item.patternType, existing);
    });
    return Array.from(packMap.values())
      .map((pack) => ({ ...pack, subjects: pack.subjects.sort(), topicTitles: pack.topicTitles.slice(0, 4) }))
      .sort((a, b) => b.dueCount - a.dueCount || b.count - a.count || Date.parse(b.latestWrongAt ?? '') - Date.parse(a.latestWrongAt ?? ''));
  }

  private async specialPracticeWrongQuestions(userId: number): Promise<CscaWrongQuestionItem[]> {
    const sessions = await this.prisma.specialPracticeSession.findMany({
      where: { userId, completedAt: { not: null } },
      include: { topic: true },
      orderBy: [{ completedAt: 'desc' }, { id: 'desc' }],
      take: 80
    });
    const items: CscaWrongQuestionItem[] = [];
    for (const session of sessions) {
      const answers = recordStringMap(session.answers);
      const timeSpent = numberMap(session.timeSpent);
      const snapshot = questionsFromSnapshot(session.questionSnapshot);
      const questions = await this.visibleSpecialPracticeWrongQuestions(snapshot.length
        ? snapshot
        : await this.prisma.specialPracticeQuestion.findMany({
            where: { topicId: session.topicId, status: 'published' },
            orderBy: [{ orderNumber: 'asc' }, { id: 'asc' }]
          }).then((rows) => rows.map((question) => ({
            id: question.id,
            orderNumber: question.orderNumber,
            prompt: question.prompt,
            options: optionsFromJson(question.options),
            correctAnswer: question.correctAnswer,
            explanation: question.explanation,
            knowledgeTags: tagsFromJson(question.knowledgeTags),
            status: question.status
          }))));
      for (const question of questions) {
        const selected = answers[String(question.id)] ?? '';
        if (!selected || selected === question.correctAnswer) continue;
        const topic = topicLike(session.topic);
        items.push({
          itemKey: `special_practice:${session.id}:${question.id}`,
          sourceType: 'special_practice',
          sourceId: session.id,
          questionId: question.id,
          subject: session.topic.subject,
          topicId: null,
          topicTitle: topic.title,
          topic,
          prompt: question.prompt,
          options: question.options,
          selected,
          selectedAnswer: selected,
          correctAnswer: question.correctAnswer,
          explanation: question.explanation,
          aiExplanationId: null,
          structuredExplanation: null,
          ...defaultMistakePatternFields(),
          status: 'unreviewed',
          knowledgeTags: question.knowledgeTags,
          timeSpentSeconds: timeSpent[String(question.id)] ?? 0,
          lastWrongAt: session.completedAt?.toISOString() ?? null,
          nextReviewAt: null,
          completedAt: session.completedAt?.toISOString() ?? null,
          reviewPath: `/csca-special-practice/sessions/${session.id}/report`,
          practicePath: `/csca-subjects/${session.topic.subject}`
        });
      }
    }
    return items;
  }

  private async visibleSpecialPracticeWrongQuestions<T extends { id: number }>(questions: T[]) {
    const ids = questions.map((question) => question.id);
    if (!ids.length) return questions;
    const aiRows = await this.prisma.cscaQuestion.findMany({
      where: { sourceType: 'ai', sourceQuestionId: { in: ids } },
      include: { topic: true }
    });
    const aiRowsBySourceQuestionId = new Map<number, typeof aiRows>();
    for (const row of aiRows) {
      if (!row.sourceQuestionId) continue;
      const rows = aiRowsBySourceQuestionId.get(row.sourceQuestionId) ?? [];
      rows.push(row);
      aiRowsBySourceQuestionId.set(row.sourceQuestionId, rows);
    }
    return questions.filter((question) => {
      const rows = aiRowsBySourceQuestionId.get(question.id) ?? [];
      if (!rows.length) return true;
      return rows.some((row) => (
        row.status === 'approved' &&
        isUsableQuestionVersion(row.generationMetadata) &&
        row.topic.status === 'published' &&
        row.syllabusVersion === row.topic.syllabusVersion
      ));
    });
  }

  private async adaptiveWrongQuestions(userId: number): Promise<CscaWrongQuestionItem[]> {
    const rounds = await this.prisma.cscaAdaptiveRound.findMany({
      where: { submittedAt: { not: null }, session: { userId } },
      include: {
        session: true,
        items: { where: { OR: [{ isCorrect: false }, { isCorrect: null }] }, orderBy: [{ position: 'asc' }, { id: 'asc' }] }
      },
      orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
      take: 80
    });
    const specialQuestionIds = Array.from(new Set(rounds.flatMap((round) => round.items
      .filter((item) => (item.questionSource || 'special_practice') === 'special_practice')
      .map((item) => item.questionId))));
    const cscaQuestionIds = Array.from(new Set(rounds.flatMap((round) => round.items
      .filter((item) => item.questionSource === 'csca_question')
      .map((item) => item.questionId))));
    const topicIds = Array.from(new Set(rounds.flatMap((round) => round.items.map((item) => item.topicId))));
    const [specialQuestions, cscaQuestions, aiBackedQuestions, examTopics] = await Promise.all([
      specialQuestionIds.length
        ? this.prisma.specialPracticeQuestion.findMany({
            where: { id: { in: specialQuestionIds } },
            include: { topic: true }
          })
        : Promise.resolve([]),
      cscaQuestionIds.length
        ? this.prisma.cscaQuestion.findMany({
            where: { id: { in: cscaQuestionIds } },
            include: { topic: true }
          })
        : Promise.resolve([]),
      specialQuestionIds.length
        ? this.prisma.cscaQuestion.findMany({
            where: { sourceType: 'ai', sourceQuestionId: { in: specialQuestionIds } },
            include: { topic: true }
          })
        : Promise.resolve([]),
      topicIds.length ? this.prisma.cscaExamTopic.findMany({ where: { id: { in: topicIds } } }) : Promise.resolve([])
    ]);
    const specialQuestionMap = new Map(specialQuestions.map((question) => [question.id, question]));
    const cscaQuestionMap = new Map(cscaQuestions
      .filter((question) => (
        question.status === 'approved' &&
        isUsableQuestionVersion(question.generationMetadata) &&
        question.topic.status === 'published' &&
        question.syllabusVersion === question.topic.syllabusVersion
      ))
      .map((question) => [question.id, question]));
    const aiRowsBySourceQuestionId = new Map<number, typeof aiBackedQuestions>();
    for (const row of aiBackedQuestions) {
      if (!row.sourceQuestionId) continue;
      const rows = aiRowsBySourceQuestionId.get(row.sourceQuestionId) ?? [];
      rows.push(row);
      aiRowsBySourceQuestionId.set(row.sourceQuestionId, rows);
    }
    const examTopicMap = new Map(examTopics.map((topic) => [topic.id, topic]));
    return rounds.flatMap((round) => round.items.flatMap((item) => {
      const questionSource = item.questionSource || 'special_practice';
      const question = questionSource === 'csca_question' ? cscaQuestionMap.get(item.questionId) : specialQuestionMap.get(item.questionId);
      if (!question) return [];
      if (questionSource !== 'csca_question') {
        const aiRows = aiRowsBySourceQuestionId.get(item.questionId) ?? [];
        if (aiRows.length && !aiRows.some((row) => (
          row.status === 'approved' &&
          isUsableQuestionVersion(row.generationMetadata) &&
          row.topicId === item.topicId &&
          row.topic.status === 'published' &&
          row.syllabusVersion === row.topic.syllabusVersion
        ))) return [];
      }
      const selected = cleanString(item.selectedAnswer);
      const sourceType: CscaWrongQuestionSourceType = round.session.mode === 'diagnostic' ? 'diagnostic' : 'adaptive_round';
      const examTopic = examTopicMap.get(item.topicId);
      const baseTopic = topicLike(question.topic);
      const topic = examTopic ? topicLike({ id: examTopic.id, code: examTopic.code, title: examTopic.title, subject: examTopic.subject, module: examTopic.module }) : baseTopic;
      return [{
        itemKey: `${sourceType}:${round.id}:${question.id}`,
        sourceType,
        sourceId: round.id,
        questionId: question.id,
        subject: round.session.subject,
        topicId: item.topicId,
        topicTitle: topic.title,
        topic,
        prompt: question.prompt,
        options: optionsFromJson(question.options),
        selected,
        selectedAnswer: selected,
        correctAnswer: question.correctAnswer,
        explanation: question.explanation,
        aiExplanationId: null,
        structuredExplanation: null,
        ...defaultMistakePatternFields(),
        status: item.usedExplanation ? 'viewed_explanation' : 'unreviewed',
        knowledgeTags: tagsFromJson(question.knowledgeTags),
        timeSpentSeconds: item.timeSpentSeconds,
        lastWrongAt: round.submittedAt?.toISOString() ?? null,
        nextReviewAt: null,
        completedAt: round.submittedAt?.toISOString() ?? null,
        reviewPath: `/csca-special-practice/adaptive/rounds/${round.id}/report`,
        practicePath: `/csca-subjects/${round.session.subject}`
      } satisfies CscaWrongQuestionItem];
    }));
  }

  private async mockExamWrongQuestions(userId: number): Promise<CscaWrongQuestionItem[]> {
    const attempts = await this.prisma.mockExamAttempt.findMany({
      where: { userId, submittedAt: { not: null } },
      include: { paper: true },
      orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
      take: 50
    });
    const paperIds = Array.from(new Set(attempts.map((attempt) => attempt.paperId)));
    const dbQuestions = paperIds.length
      ? await this.prisma.mockExamQuestion.findMany({
          where: { paperId: { in: paperIds }, status: 'published' },
          orderBy: [{ orderNumber: 'asc' }, { id: 'asc' }]
        })
      : [];
    const dbQuestionsByPaper = new Map<number, SnapshotQuestion[]>();
    dbQuestions.forEach((question) => {
      const rows = dbQuestionsByPaper.get(question.paperId) ?? [];
      rows.push({
        id: question.id,
        orderNumber: question.orderNumber,
        prompt: question.prompt,
        options: optionsFromJson(question.options),
        correctAnswer: question.correctAnswer,
        explanation: question.explanation,
        knowledgeTags: tagsFromJson(question.knowledgeTags),
        status: question.status
      });
      dbQuestionsByPaper.set(question.paperId, rows);
    });
    const allQuestionIds = Array.from(new Set([...dbQuestions.map((question) => question.id), ...attempts.flatMap((attempt) => questionsFromSnapshot(attempt.questionSnapshot).map((question) => question.id))]));
    const mappings = allQuestionIds.length
      ? await this.prisma.cscaTopicMapping.findMany({
          where: { sourceType: 'mock_exam_question', sourceId: { in: allQuestionIds } },
          include: { topic: true },
          orderBy: [{ confidence: 'desc' }, { id: 'asc' }]
        })
      : [];
    const topicMap = new Map<number, (typeof mappings)[number]['topic']>();
    mappings.forEach((mapping) => {
      if (!topicMap.has(mapping.sourceId)) topicMap.set(mapping.sourceId, mapping.topic);
    });
    return attempts.flatMap((attempt) => {
      const answers = recordStringMap(attempt.answers);
      const timeSpent = numberMap(attempt.timeSpent);
      const snapshot = questionsFromSnapshot(attempt.questionSnapshot);
      const questions = snapshot.length ? snapshot : dbQuestionsByPaper.get(attempt.paperId) ?? [];
      return questions.flatMap((question) => {
        const selected = answers[String(question.id)] ?? '';
        if (!selected || selected === question.correctAnswer) return [];
        const mappedTopic = topicMap.get(question.id);
        const topic = mappedTopic
          ? topicLike({ id: mappedTopic.id, code: mappedTopic.code, title: mappedTopic.title, subject: mappedTopic.subject, module: mappedTopic.module })
          : topicLike({ id: null, slug: attempt.paper.slug, title: attempt.paper.title, subject: attempt.paper.subject, module: attempt.paper.title });
        return [{
          itemKey: `mock_exam:${attempt.id}:${question.id}`,
          sourceType: 'mock_exam',
          sourceId: attempt.id,
          questionId: question.id,
          subject: attempt.paper.subject,
          topicId: mappedTopic?.id ?? null,
          topicTitle: topic.title,
          topic,
          prompt: question.prompt,
          options: question.options,
          selected,
          selectedAnswer: selected,
          correctAnswer: question.correctAnswer,
          explanation: question.explanation,
          aiExplanationId: null,
          structuredExplanation: null,
          ...defaultMistakePatternFields(),
          status: 'unreviewed',
          knowledgeTags: question.knowledgeTags,
          timeSpentSeconds: timeSpent[String(question.id)] ?? 0,
          lastWrongAt: attempt.submittedAt?.toISOString() ?? null,
          nextReviewAt: null,
          completedAt: attempt.submittedAt?.toISOString() ?? null,
          reviewPath: `/csca-mock-exam/attempts/${attempt.id}/report`,
          practicePath: `/csca-subjects/${attempt.paper.subject}`
        } satisfies CscaWrongQuestionItem];
      });
    });
  }
}

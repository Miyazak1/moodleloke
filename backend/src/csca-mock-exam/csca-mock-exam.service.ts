import { BadRequestException, ConflictException, Inject, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { recordAdminAudit } from '../admin-audit/admin-audit-log';
import { AIQuestioningService } from '../ai-questioning/ai-questioning.service';
import { assertNonNegativeInteger, assertPositiveInteger, assertRecord } from '../common/validation';
import { CscaLearningService } from '../csca-learning/csca-learning.service';
import { mapTrustedQuestionEvidence } from '../learning-intelligence/evidence/learning-evidence-mapper';
import { LearningIntelligenceFeatureFlagsService } from '../learning-intelligence/learning-intelligence-feature-flags.service';
import { LEARNING_EVIDENCE_WRITER, LearningEvidenceWriter, LearningEvidenceWriteResult, learningEvidenceReceipt } from '../learning-intelligence/learning-evidence-writer.port';
import { pastPaperSummary } from '../past-papers/past-papers.service';
import { PrismaService } from '../prisma/prisma.service';
import { MockExamAttemptCreatePayload, MockExamAttemptPatchPayload, MockExamOption, MockExamSubject } from './csca-mock-exam.types';
import { MockExamMasteryBridgeService } from './mock-exam-mastery-bridge.service';
import { MockExamPlannerService } from './mock-exam-planner.service';

const SUBJECTS: Array<{ id: MockExamSubject; title: string; shortTitle: string; accent: string; description: string; tags: string[] }> = [
  { id: 'math', title: '数学', shortTitle: '数学', accent: 'blue', description: '集合、函数、几何、概率等核心考点。', tags: ['集合与不等式', '函数', '几何与代数', '概率与统计'] },
  { id: 'physics', title: '物理', shortTitle: '物理', accent: 'violet', description: '力学、电磁学、热学、光学、近代物理。', tags: ['力学', '电磁学', '热学', '光学'] },
  { id: 'chemistry', title: '化学', shortTitle: '化学', accent: 'green', description: '物质分类、反应原理、溶液、有机化学。', tags: ['物质结构', '反应原理', '溶液', '有机化学'] }
];
type PublicLocale = 'zh-CN' | 'en';

const SUBJECT_LOCALIZATION: Record<MockExamSubject, Record<PublicLocale, { title: string; shortTitle: string; description: string; tags: string[] }>> = {
  math: {
    'zh-CN': { title: '数学', shortTitle: '数学', description: '集合、函数、几何、概率等核心考点。', tags: ['集合与不等式', '函数', '几何与代数', '概率与统计'] },
    en: { title: 'Math', shortTitle: 'Math', description: 'Core topics including sets, functions, geometry, and probability.', tags: ['Sets & inequalities', 'Functions', 'Geometry & algebra', 'Probability & statistics'] }
  },
  physics: {
    'zh-CN': { title: '物理', shortTitle: '物理', description: '力学、电磁学、热学、光学、近代物理。', tags: ['力学', '电磁学', '热学', '光学'] },
    en: { title: 'Physics', shortTitle: 'Physics', description: 'Mechanics, electromagnetism, thermal physics, optics, and modern physics.', tags: ['Mechanics', 'Electromagnetism', 'Thermal physics', 'Optics'] }
  },
  chemistry: {
    'zh-CN': { title: '化学', shortTitle: '化学', description: '物质分类、反应原理、溶液、有机化学。', tags: ['物质结构', '反应原理', '溶液', '有机化学'] },
    en: { title: 'Chemistry', shortTitle: 'Chemistry', description: 'Matter, reaction principles, solutions, and organic chemistry.', tags: ['Matter structure', 'Reaction principles', 'Solutions', 'Organic chemistry'] }
  }
};
const MOCK_ATTEMPT_LOCK_NAMESPACE = 2_147_001_101;

const STATUSES = ['draft', 'published', 'archived'] as const;
const BLUEPRINT_STATUSES = ['draft', 'active', 'archived'] as const;
const BLUEPRINT_SLOT_STATUSES = ['draft', 'ready', 'blocked'] as const;
const QUESTION_TYPES = ['single-choice'] as const;
const OPTION_IDS = ['A', 'B', 'C', 'D'];
const MOCK_EXAM_AI_GENERATION_MAX_ATTEMPTS = 12;
const MOCK_EXAM_AI_REPAIR_MAX_ATTEMPTS = 4;
const MOCK_EXAM_AI_STRUCTURAL_RETRY_LIMIT = 4;
const MOCK_EXAM_AI_SLOT_MAX_CANDIDATE_ATTEMPTS = 36;
const MOCK_EXAM_AI_SLOT_MAX_REPLAN_ATTEMPTS = 4;
const MOCK_EXAM_AI_PAPER_MAX_PROVIDER_WAITS = 96;
const DEFAULT_MOCK_EXAM_AI_GENERATION_CONCURRENCY = 3;
const MAX_MOCK_EXAM_AI_GENERATION_CONCURRENCY = 5;
const MOCK_EXAM_AUTO_FILL_REQUEUE_DELAY_MS = 1500;
const DEFAULT_MOCK_EXAM_GENERATION_STALE_RUNNING_MS = 60 * 1000;

type DbPaper = Awaited<ReturnType<PrismaService['mockExamPaper']['findFirstOrThrow']>>;
type DbQuestion = Awaited<ReturnType<PrismaService['mockExamQuestion']['findMany']>>[number];
type DbAttempt = Awaited<ReturnType<PrismaService['mockExamAttempt']['findFirstOrThrow']>>;
type PaperLike = Pick<DbPaper, 'id' | 'subject' | 'slug' | 'title' | 'description' | 'language' | 'questionCount' | 'durationMinutes' | 'priceLabel' | 'isFree' | 'isLocked'>;
type MockExamBlueprintRow = {
  id: number;
  subject: string;
  title: string;
  syllabusVersion: string;
  sourceProfileIds: unknown;
  sourcePaperId: number | null;
  questionCount: number;
  durationMinutes: number;
  totalScore: number;
  status: string;
  profile: unknown;
  createdBy: number | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};
type MockExamBlueprintSlotRow = {
  id: number;
  blueprintId: number;
  slotNumber: number;
  topicIds: unknown;
  module: string | null;
  difficultyBand: string;
  cognitiveSkill: string;
  readingLoad: string;
  calculationLoad: string;
  estimatedTimeSeconds: number;
  generationPromptHints: unknown;
  reviewerChecklist: unknown;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};
type MockExamGenerationJobRow = {
  id: number;
  blueprintId: number;
  targetPaperId: number | null;
  status: string;
  provider: string | null;
  model: string | null;
  requestedSlotNumbers: unknown;
  slotResults: unknown;
  error: string | null;
  createdBy: number | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};
type MockExamGenerationSlotResult = {
  slotId?: number;
  slotNumber?: number;
  aiBlueprintId?: number | null;
  aiGenerationJobId?: number | null;
  candidateQuestionId?: number | null;
  status?: string;
  issues?: unknown[];
  topicIds?: unknown[];
  targetProfile?: unknown;
  generationLineage?: unknown;
  candidateAttemptCount?: number;
  providerWaitCount?: number;
  waitReason?: string | null;
  nextAction?: string | null;
  diagnostics?: Record<string, unknown>;
};
type MockExamApprovedSlotCandidateRow = {
  id: number;
  slotId: number | null;
  slotNumber: number | null;
  aiBlueprintId: number | null;
  topicId: number;
  generationMetadata: unknown;
  approvedAt: Date | null;
  updatedAt: Date;
};
type MockExamPromotableSlotCandidateRow = {
  id: number;
  aiBlueprintId: number | null;
  topicId: number;
  generationMetadata: unknown;
};
type MockExamApprovalSlotContext = {
  blueprintId: number;
  blueprintTitle: string;
  slotId: number;
  slotNumber: number;
  sourcePaperId: number | null;
};
type MockExamGenerationTopicRow = {
  id: number;
  subject: string;
  code: string | null;
  title: string;
  module: string | null;
  syllabusVersion: string;
  examScope: string | null;
  status: string;
};
type MockExamStyleProfileRow = {
  id: number;
  subject: string;
  syllabusVersion: string;
  scopeType: string;
  scopeId: number | null;
  sourceQuestionIds: unknown;
  sampleSize: number;
  confidence: string;
  profile: unknown;
  profileVersion: string;
  sourceQuestionSnapshotHash: string;
  status: string;
  generatedAt: Date;
};
type MockExamGenerationProfileRow = {
  id: number;
  subject: string;
  syllabusVersion: string;
  useCase: string;
  title: string;
  seriesProfileId: number | null;
  sourceStyleProfileId: number | null;
  profile: unknown;
  targetPolicy: unknown;
  sampleSize: number;
  confidence: string;
  status: string;
  generatedAt: Date;
};
type MockExamApprovedCandidateRow = {
  id: number;
  subject: string;
  topicId: number;
  blueprintId: number | null;
  prompt: string;
  options: unknown;
  correctAnswer: string;
  explanation: string;
  knowledgeTags: unknown;
  status: string;
  generationMetadata: unknown;
};
type SnapshotQuestion = {
  id: number;
  version: number;
  orderNumber: number;
  questionType: string;
  prompt: string;
  options: MockExamOption[];
  correctAnswer: string;
  explanation: string;
  knowledgeTags: string[];
  status: string;
};
type AdminImportQuestion = Partial<SnapshotQuestion> & { options?: MockExamOption[] };
type AdminImportPaper = Partial<DbPaper> & { questions?: AdminImportQuestion[] };

const FALLBACK_PAPERS: PaperLike[] = SUBJECTS.flatMap((subject, subjectIndex) => [
  {
    id: subjectIndex * 10 + 1,
    subject: subject.id,
    slug: `${subject.id}-mock-1`,
    title: `${subject.title}模拟卷 1`,
    description: `${subject.title}原创仿真模拟卷，48 题 / 60 分钟，用于完整模考练习。`,
    language: 'zh',
    questionCount: 48,
    durationMinutes: 60,
    priceLabel: '免费',
    isFree: true,
    isLocked: false
  },
  {
    id: subjectIndex * 10 + 2,
    subject: subject.id,
    slug: `${subject.id}-mock-2`,
    title: `${subject.title}模拟卷 2`,
    description: `${subject.title}完整模拟卷，解锁计划建设中。`,
    language: 'zh',
    questionCount: 48,
    durationMinutes: 60,
    priceLabel: '$19.99',
    isFree: true,
    isLocked: false
  }
]);

function assertSubject(subject: string): MockExamSubject {
  if (!SUBJECTS.some((item) => item.id === subject)) throw new NotFoundException('模考科目不存在。');
  return subject as MockExamSubject;
}

function subjectDisplayName(subject: string) {
  return SUBJECTS.find((item) => item.id === subject)?.title ?? subject;
}

function normalizeLocale(locale?: string): PublicLocale {
  return locale?.toLowerCase().startsWith('en') ? 'en' : 'zh-CN';
}

function localizedSubject(subject: (typeof SUBJECTS)[number], locale: PublicLocale) {
  const localized = SUBJECT_LOCALIZATION[subject.id][locale];
  return { ...subject, ...localized };
}

function cleanString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function recordFrom(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function stringListFrom(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map((item) => cleanString(item)).filter(Boolean)));
}

function mockExamCandidateHasCompleteBilingualLocalization(generation: unknown) {
  const localizations = recordFrom(recordFrom(generation)?.localizations);
  const zh = recordFrom(localizations?.zh);
  const en = recordFrom(localizations?.en);
  const zhOptions = Array.isArray(zh?.options) ? zh.options : [];
  const enOptions = Array.isArray(en?.options) ? en.options : [];
  return Boolean(
    cleanString(zh?.prompt) &&
    cleanString(zh?.explanation) &&
    zhOptions.length === 4 &&
    cleanString(en?.prompt) &&
    cleanString(en?.explanation) &&
    enOptions.length === 4
  );
}

function mockExamCandidateHasStrictApprovalGate(review: unknown) {
  const metadata = recordFrom(review) ?? {};
  const approvalGate = recordFrom(metadata.approvalGate) ?? {};
  const mockExamApproval = recordFrom(metadata.mockExamApproval) ?? {};
  return cleanString(approvalGate.status) === 'passed'
    && cleanString(approvalGate.source) === 'mock_exam_auto_gate'
    && ['approved_for_mock_exam_assembly', 'assembled_in_mock_exam_draft'].includes(cleanString(mockExamApproval.status));
}

function mockExamApprovalSlotContext(blueprint: ReturnType<typeof mapMockExamBlueprint>, slot: AdminMockExamBlueprintDetailSlot): MockExamApprovalSlotContext {
  return {
    blueprintId: blueprint.id,
    blueprintTitle: blueprint.title,
    slotId: slot.id,
    slotNumber: slot.slotNumber,
    sourcePaperId: blueprint.sourcePaperId ?? null
  };
}

function mockExamIdString(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return cleanString(value);
}

function mockExamCandidateMatchesSlotContext(generation: unknown, context: MockExamApprovalSlotContext) {
  const slot = recordFrom(recordFrom(generation)?.mockExamSlot);
  if (!slot) return false;
  if (mockExamIdString(slot.blueprintId) !== String(context.blueprintId)) return false;
  const slotId = mockExamIdString(slot.slotId);
  const slotNumber = mockExamIdString(slot.slotNumber);
  if (slotId) return slotId === String(context.slotId);
  return slotNumber === String(context.slotNumber);
}

function mockExamGenerationWithApprovalSlotContext(generation: Record<string, unknown>, context: MockExamApprovalSlotContext) {
  const slot = recordFrom(generation.mockExamSlot) ?? {};
  return {
    ...generation,
    sourceKind: cleanString(generation.sourceKind) || 'mock_exam_blueprint_slot',
    generationSource: cleanString(generation.generationSource) || 'mock_exam_blueprint_slot',
    generationMode: cleanString(generation.generationMode) || 'online_mock_exam_candidate',
    intendedUse: cleanString(generation.intendedUse) || 'online_mock_exam',
    targetUseCase: cleanString(generation.targetUseCase) || 'online_mock_exam',
    mockExamSlot: {
      ...slot,
      blueprintId: context.blueprintId,
      blueprintTitle: context.blueprintTitle,
      slotId: context.slotId,
      slotNumber: context.slotNumber,
      sourcePaperId: context.sourcePaperId
    }
  };
}

function mockExamLineageFromReference(value: unknown) {
  const reference = recordFrom(value) ?? {};
  const generationProfile = recordFrom(reference.generationProfile) ?? {};
  const generationProfileId = Number(reference.generationProfileId ?? generationProfile.id);
  const sourceSnapshotHash = cleanString(reference.sourceSnapshotHash ?? generationProfile.sourceSnapshotHash) || null;
  const syllabusSnapshotHash = cleanString(reference.syllabusSnapshotHash ?? generationProfile.syllabusSnapshotHash) || null;
  return {
    hasLineage: (Number.isInteger(generationProfileId) && generationProfileId > 0)
      || Boolean(sourceSnapshotHash)
      || Boolean(syllabusSnapshotHash),
    generationProfileId: Number.isInteger(generationProfileId) && generationProfileId > 0 ? generationProfileId : null,
    sourceSnapshotHash,
    syllabusSnapshotHash
  };
}

function mockExamLineageIsStale(queued: ReturnType<typeof mockExamLineageFromReference>, current: ReturnType<typeof mockExamLineageFromReference>) {
  if (!queued.hasLineage) return false;
  if (queued.generationProfileId && current.generationProfileId && queued.generationProfileId !== current.generationProfileId) return true;
  if (queued.sourceSnapshotHash && current.sourceSnapshotHash && queued.sourceSnapshotHash !== current.sourceSnapshotHash) return true;
  if (queued.syllabusSnapshotHash && current.syllabusSnapshotHash && queued.syllabusSnapshotHash !== current.syllabusSnapshotHash) return true;
  return false;
}

function mockExamGenerationLineageFromSlotResults(value: unknown) {
  for (const slot of slotResultsFromJson(value)) {
    const lineage = mockExamLineageFromReference(slot.generationLineage);
    if (lineage.hasLineage) return lineage;
  }
  return mockExamLineageFromReference(null);
}

function mockExamCandidateMatchesCurrentLineage(candidateGenerationMetadata: unknown, currentReference: unknown) {
  return !mockExamLineageIsStale(
    mockExamLineageFromReference(candidateGenerationMetadata),
    mockExamLineageFromReference(currentReference)
  );
}

function mockExamReviewIssueCodes(metadata: unknown) {
  const review = recordFrom(metadata) ?? {};
  const issues = Array.isArray(review.issues) ? review.issues : [];
  const issueCodes = issues
    .map((item) => cleanString(recordFrom(item)?.code))
    .filter(Boolean);
  const dimensions = Array.isArray(review.dimensions) ? review.dimensions : [];
  const dimensionCodes = dimensions
    .map((item) => recordFrom(item))
    .filter(Boolean)
    .filter((item) => ['failed', 'warning'].includes(cleanString(item?.status)))
    .map((item) => `${cleanString(item?.key)}_${cleanString(item?.status)}`)
    .filter((item) => item !== '_');
  const profileAlignment = recordFrom(review.profileAlignment) ?? {};
  const profileAlignmentReasons = stringListFrom(profileAlignment.reasons);
  return Array.from(new Set([...issueCodes, ...dimensionCodes, ...profileAlignmentReasons]));
}

function mockExamFailureSignals(input: { issue?: string | null; gateReasons?: string[]; reviewIssueCodes?: string[] }) {
  return Array.from(new Set([
    ...(input.gateReasons ?? []),
    ...(input.reviewIssueCodes ?? []),
    cleanString(input.issue)
  ].map((item) => cleanString(item).toLowerCase()).filter(Boolean)));
}

function mockExamBlockedPatterns(signals: string[]) {
  const patterns: string[] = [];
  const has = (pattern: string | RegExp) => signals.some((item) => typeof pattern === 'string' ? item.includes(pattern) : pattern.test(item));
  if (has('question_form_mismatch')) {
    patterns.push('Do not reuse the same surface question form. Generate a fresh stem whose task type matches targetProfile.questionForm.');
  }
  if (has('cognitive_skill_mismatch')) {
    patterns.push('Do not reuse the same reasoning path. Generate a fresh problem requiring targetProfile.cognitiveSkill.');
  }
  if (has(/difficulty.*(mismatch|out_of_scope|too_easy|too_hard)|exam_like_difficulty_low|trivial/)) {
    patterns.push('Do not generate atomic one-step arithmetic, direct definition recall, or plug-in substitution when the slot expects exam-like reasoning.');
  }
  if (has(/near[_-]?duplicate|duplicate_prompt|source_copy|source[_-]?similarity|past[_-]?paper[_-]?similarity/)) {
    patterns.push('Do not paraphrase, number-swap, translate, or reconstruct the previous candidate or any past-paper sample.');
  }
  if (has(/subject_mismatch|topic_mismatch|knowledge_mismatch|cross_subject/)) {
    patterns.push('Do not use a cross-subject wrapper or unrelated context. Keep the stem inside the selected subject and syllabus topic.');
  }
  if (has(/image_reference_without_image|diagram_reference_without_image|prompt_leakage|invalid_prompt|unusable/)) {
    patterns.push('Do not mention a diagram, figure, table, or image unless the slot explicitly provides usable image evidence.');
  }
  if (has(/equivalent_option|duplicate_option|multiple_correct|single_correct_answer|option_conflict|target_answer_mismatch/)) {
    patterns.push('Do not create equivalent, overlapping, duplicate, or near-duplicate options; every option must simplify to a distinct mathematical claim.');
  }
  if (has(/weak_syllabus_signal|profile_alignment/)) {
    patterns.push('Do not produce generic textbook recall. Make the syllabus topic visible through the actual operation the student must perform.');
  }
  return Array.from(new Set(patterns));
}

function mockExamProfileCorrectionInstructions(signals: string[], target?: Record<string, unknown>) {
  const instructions: string[] = [];
  const has = (pattern: string | RegExp) => signals.some((item) => typeof pattern === 'string' ? item.includes(pattern) : pattern.test(item));
  const questionForm = cleanString(target?.questionForm);
  const cognitiveSkill = cleanString(target?.cognitiveSkill);
  const readingLoad = cleanString(target?.readingLoad);
  const calculationLoad = cleanString(target?.calculationLoad);
  const difficultyBand = cleanString(target?.difficultyBand);
  const targetAnswer = normalizeMockExamAnswerTarget(target?.targetAnswer);
  if (has('target_answer_mismatch') && targetAnswer) {
    instructions.push(`Answer-target correction: keep the same mathematical task if possible, but rewrite/reorder options and explanation so correctAnswer is exactly ${targetAnswer} and the other options remain plausible distractors.`);
  }
  if (has('reading_load_mismatch')) {
    if (readingLoad === 'low') {
      instructions.push('Reading-load correction: keep the stem to one concise sentence with at most two given conditions; avoid long stories, extra definitions, or unrelated context.');
    } else if (readingLoad === 'high') {
      instructions.push('Reading-load correction: include a compact scenario or several connected conditions so the reading demand is visibly high, without adding irrelevant text.');
    } else {
      instructions.push('Reading-load correction: use two to four explicit conditions or clauses; avoid both one-line recall and long scenario prose.');
    }
  }
  if (has(/calculation_load_mismatch|calculation_load_band_mismatch/)) {
    if (calculationLoad === 'none') {
      instructions.push('Calculation-load correction: do not require solving, substitution, interval computation, or algebraic simplification; ask for a judgement about a rule, condition, equivalence, or error.');
    } else if (calculationLoad === 'light') {
      instructions.push('Calculation-load correction: require exactly one short transformation, endpoint/sign check, or simple substitution; avoid multi-equation setup or long algebra.');
    } else if (calculationLoad === 'medium') {
      instructions.push('Calculation-load correction: require two connected algebraic or reasoning steps; avoid a direct one-step solve or pure definition recall.');
    } else if (calculationLoad === 'heavy') {
      instructions.push('Calculation-load correction: require a multi-step setup with at least three connected operations or comparisons while still keeping the stem solvable as MCQ.');
    }
  }
  if (has('cognitive_skill_mismatch')) {
    if (['concept_discrimination', 'concept_identification', 'recall'].includes(cognitiveSkill)) {
      instructions.push('Cognitive-skill correction: make the correct answer a concept judgement, misconception diagnosis, or rule/condition identification; do not ask for only a final numerical result.');
    } else if (cognitiveSkill === 'multi_step_reasoning') {
      instructions.push('Cognitive-skill correction: require a chained reasoning path with multiple dependent conditions; the answer must not be obtainable from one isolated operation.');
    } else {
      instructions.push('Cognitive-skill correction: require standard application of the target syllabus idea with a concrete operation, not generic recall or unrelated reasoning.');
    }
  }
  if (has('question_form_mismatch')) {
    if (['concept_judgement', 'concept_check'].includes(questionForm)) {
      instructions.push('Question-form correction: write the stem as a judgement/comparison/validity question about statements, transformations, conditions, graph features, or solution steps.');
    } else if (questionForm === 'calculation_application') {
      instructions.push('Question-form correction: ask for a concrete value, interval, expression, probability, parameter range, or conclusion that follows from calculation.');
    } else {
      instructions.push('Question-form correction: make the surface task type match targetProfile.questionForm exactly, not just the same topic.');
    }
  }
  if (has(/difficulty.*(mismatch|out_of_scope|too_easy|too_hard)|exam_like_difficulty_low|trivial/)) {
    if (difficultyBand === 'basic') {
      instructions.push('Difficulty correction: keep the task accessible but exam-like; avoid child-level arithmetic, direct definition recall, or no-thinking substitutions.');
    } else if (difficultyBand === 'hard') {
      instructions.push('Difficulty correction: require non-obvious reasoning or condition interaction; avoid a direct textbook template with obvious distractors.');
    } else {
      instructions.push('Difficulty correction: target medium exam difficulty with at least one meaningful reasoning step and plausible distractors.');
    }
  }
  if (has(/weak_syllabus_signal|profile_alignment/)) {
    instructions.push('Profile-alignment correction: make the target syllabus topic, questionForm, cognitiveSkill, readingLoad, and calculationLoad visible in the actual student task, not only in metadata.');
  }
  return Array.from(new Set(instructions));
}

function mockExamHasStructuralFailureSignal(input: { issue?: string | null; gateReasons?: string[]; reviewIssueCodes?: string[] }) {
  const signalText = mockExamFailureSignals(input).join(' ');
  return /question_form_mismatch|cognitive_skill_mismatch|difficulty.*mismatch|near[_-]?duplicate|duplicate_prompt|source[_-]?similarity|past[_-]?paper[_-]?similarity|topic_mismatch|knowledge_mismatch|subject_mismatch|profile_alignment_failed|style_alignment_failed|trivial_arithmetic_candidate/.test(signalText);
}

function mockExamIsRecoverableProviderFailure(issue: unknown) {
  const text = cleanString(issue).toLowerCase();
  return /provider|schema_invalid|timeout|network|fetch|generator provider|ai_generation_retry_pending|真实 ai 题目生成失败/.test(text);
}

function mockExamIsProviderBackpressure(issue: unknown) {
  const text = cleanString(issue).toLowerCase();
  return [
    'gateway_no_key_available',
    'gateway_key_concurrency_saturated',
    'gateway_key_rate_limited',
    'gateway_key_cooldown',
    'gateway_concurrency_timeout',
    'provider_timeout',
    'provider_rate_limited',
    'provider_quota_exceeded',
    'provider_unavailable',
    'provider_network_error',
    'no ai provider key'
  ].some((marker) => text.includes(marker));
}

function mockExamSlotBudgetState(slot: MockExamGenerationSlotResult) {
  const candidateAttempts = Math.max(0, Number(slot.candidateAttemptCount ?? 0) || 0);
  const providerWaits = Math.max(0, Number(slot.providerWaitCount ?? 0) || 0);
  const replanAttempts = mockExamClosedLoopReplanAttempt(slot.targetProfile);
  const exhausted = candidateAttempts >= MOCK_EXAM_AI_SLOT_MAX_CANDIDATE_ATTEMPTS
    || replanAttempts >= MOCK_EXAM_AI_SLOT_MAX_REPLAN_ATTEMPTS;
  const reason = candidateAttempts >= MOCK_EXAM_AI_SLOT_MAX_CANDIDATE_ATTEMPTS
    ? 'slot_candidate_attempt_budget_exhausted'
    : replanAttempts >= MOCK_EXAM_AI_SLOT_MAX_REPLAN_ATTEMPTS
      ? 'slot_replan_budget_exhausted'
      : null;
  return { candidateAttempts, providerWaits, replanAttempts, exhausted, reason };
}

function mockExamPaperProviderWaitCount(slotResults: MockExamGenerationSlotResult[]) {
  return slotResults.reduce((sum, slot) => sum + Math.max(0, Number(slot.providerWaitCount ?? 0) || 0), 0);
}

export function mockExamRepairStrategy(input: { issue?: string | null; gateDecision?: string | null; gateReasons?: string[]; reviewIssueCodes?: string[] }) {
  const issue = cleanString(input.issue);
  if (!issue.startsWith('review_gate_not_passed:')) return 'hard_regenerate' as const;
  const hardSignal = mockExamFailureSignals(input).join(' ');
  const hardSignals = [
    'fallback_candidate',
    'approved_candidate_gate_stale',
    'approved_candidate_bilingual_missing',
    'smoke_candidate',
    'trivial_arithmetic_candidate',
    'subject_mismatch',
    'topic_mismatch',
    'knowledge_mismatch',
    'syllabus_version_mismatch',
    'question_type_out_of_scope',
    'excluded_scope_overlap',
    'prompt_leakage',
    'invalid_prompt',
    'unusable',
    'duplicate_prompt_risk',
    'near_duplicate_prompt_risk',
    'duplicate_risk_high',
    'source_copy',
    'past_paper_similarity_high',
    'past_paper_similarity_medium',
    'source_similarity_high',
    'source_similarity_medium',
    'difficulty_out_of_scope',
    'difficulty_mismatch',
    'difficulty_band_mismatch',
    'target_profile_difficulty_mismatch',
    'target_profile_mismatch',
    'question_form_mismatch',
    'cognitive_skill_mismatch',
    'style_question_form_mismatch',
    'style_cognitive_skill_mismatch',
    'atomic_value_substitution',
    'generic_definition_question',
    'cross_subject_context',
    'image_reference_without_image',
    'diagram_reference_without_image',
    'exam_like_difficulty_low',
    'style_profile_missing',
    'style_profile_low_confidence'
  ];
  if (hardSignals.some((signal) => hardSignal.includes(signal))) return 'hard_regenerate' as const;
  if (/(topic|knowledge|syllabus).*mismatch|difficulty.*(mismatch|out_of_scope|too_easy|too_hard)|leakage|near[_-]?duplicate|source[_-]?similarity|past[_-]?paper[_-]?similarity/.test(hardSignal)) {
    return 'hard_regenerate' as const;
  }
  const repairableReasons = new Set([
    'review_needs_attention',
    'reviewer_human_review',
    'reviewer_revise',
    'review_score_below_80',
    'review_warning_issue',
    'weak_syllabus_signal',
    'style_alignment_failed',
    'style_alignment_low',
    'profile_alignment_warning',
    'missing_bilingual_localization'
  ]);
  const repairableSignals = [
    'single_correct_answer',
    'multiple_correct',
    'correct_answer',
    'invalid_correct_answer',
    'answer_mismatch',
    'option_conflict',
    'option_mutual_exclusion',
    'equivalent_option',
    'duplicate_option_text',
    'distractor',
    'generic_distractor',
    'duplicate_distractor',
    'option_metadata',
    'explanation_supports_answer',
    'explanation_answer_conflict',
    'explanation_missing_answer_reference',
    'weak_explanation',
    'explanation',
    'language',
    'localization',
    'bilingual',
    'weak_syllabus_signal',
    'profile_alignment_warning',
    'reading_load_mismatch',
    'calculation_load_mismatch',
    'calculation_load_band_mismatch',
    'human_review'
  ];
  const reasons = input.gateReasons ?? [];
  if (reasons.some((reason) => repairableReasons.has(reason))) return 'repair_in_place' as const;
  if ((input.reviewIssueCodes ?? []).some((reason) => repairableSignals.some((signal) => reason.toLowerCase().includes(signal)))) {
    return 'repair_in_place' as const;
  }
  if (cleanString(input.gateDecision) === 'human_review') return 'repair_in_place' as const;
  return 'hard_regenerate' as const;
}

function mockExamGateRepairable(input: { issue?: string | null; gateDecision?: string | null; gateReasons?: string[]; reviewIssueCodes?: string[] }) {
  return mockExamRepairStrategy(input) === 'repair_in_place';
}

export function mockExamRepairFeedback(input: {
  issue?: string | null;
  gateDecision?: string | null;
  gateReasons?: string[];
  reviewIssueCodes?: string[];
  targetProfile?: unknown;
  previousQuestionId?: number | null;
  repairAttempt: number;
  slotNumber: number;
}) {
  const signals = mockExamFailureSignals(input);
  const targetedInstructions: string[] = [];
  if (signals.some((item) => item.includes('equivalent_option') || item.includes('duplicate_option_text') || item.includes('multiple_correct') || item.includes('single_correct_answer') || item.includes('correct_answer') || item.includes('invalid_correct_answer') || item.includes('answer_mismatch') || item.includes('option_conflict'))) {
    targetedInstructions.push('Repair answer and option logic: exactly one option must be correct, all wrong options must be mathematically distinct, non-overlapping, and not equivalent after simplification.');
  }
  if (signals.some((item) => item.includes('option_metadata') || item.includes('distractor') || item.includes('generic_distractor'))) {
    targetedInstructions.push('Repair distractors and option metadata: every wrong option needs a plausible misconception, unique distractor intent, and no distractor metadata on the correct option.');
  }
  if (signals.some((item) => item.includes('explanation_answer_conflict') || item.includes('explanation_missing_answer_reference') || item.includes('weak_explanation') || item.includes('explanation_supports_answer') || item.includes('answer_mismatch'))) {
    targetedInstructions.push('Repair explanation consistency: recalculate the answer, make the structured correctAnswer match the explanation, and explicitly justify why the correct option is correct and the distractors are wrong.');
  }
  if (signals.some((item) => item.includes('math_') || item.includes('physics_') || item.includes('chemistry_') || item.includes('sanity'))) {
    targetedInstructions.push('Repair deterministic sanity failure: recompute the math/science result from the stem, update the correct option and explanation together, and keep exactly one valid answer.');
  }
  if (signals.some((item) => item.includes('question_form_mismatch'))) {
    targetedInstructions.push('Repair question form: rewrite the stem so it matches targetProfile.questionForm; concept/judgement slots should ask for a statement, transformation, or judgement, while calculation slots should ask for a concrete result.');
  }
  if (signals.some((item) => item.includes('cognitive_skill_mismatch'))) {
    targetedInstructions.push('Repair cognitive skill: change the required reasoning path to match targetProfile.cognitiveSkill without drifting to a different syllabus topic.');
  }
  if (signals.some((item) => item.includes('reading_load_mismatch'))) {
    targetedInstructions.push('Repair reading load: adjust context length and wording density to match targetProfile.readingLoad.');
  }
  if (signals.some((item) => item.includes('calculation_load_mismatch') || item.includes('calculation_load_band_mismatch'))) {
    targetedInstructions.push('Repair calculation load: adjust numbers, steps, or algebraic complexity to match targetProfile.calculationLoad while keeping the same slot intent.');
  }
  if (signals.some((item) => item.includes('weak_syllabus_signal'))) {
    targetedInstructions.push('Repair syllabus signal: make the prompt and explanation clearly exercise the selected syllabus topic, without naming internal topic IDs or metadata.');
  }
  if (signals.some((item) => item.includes('bilingual') || item.includes('localization') || item.includes('missing_bilingual_localization'))) {
    targetedInstructions.push('Repair localization: provide complete Chinese and English localizations with equivalent prompt, options, answer, and explanation.');
  }
  for (const instruction of mockExamProfileCorrectionInstructions(signals, recordFrom(input.targetProfile) ?? {})) {
    if (!targetedInstructions.includes(instruction)) targetedInstructions.push(instruction);
  }
  return {
    strategy: 'revise_candidate_then_rereview',
    failedQuestionId: input.previousQuestionId ?? null,
    slotNumber: input.slotNumber,
    repairAttempt: input.repairAttempt,
    maxRepairAttempts: MOCK_EXAM_AI_REPAIR_MAX_ATTEMPTS,
    gateDecision: cleanString(input.gateDecision, 'unknown'),
    gateReasons: input.gateReasons ?? [],
    reviewIssueCodes: input.reviewIssueCodes ?? [],
    targetProfile: recordFrom(input.targetProfile) ?? null,
    blockedPatterns: mockExamBlockedPatterns(signals),
    targetedInstructions,
    issue: cleanString(input.issue, 'review_gate_not_passed'),
    instruction: [
      'Revise the previous candidate in place instead of replacing it.',
      'Keep the same mock exam slot, syllabus boundary, targetProfile, intended use, and usable problem skeleton.',
      'Fix local defects directly: wrong answer, multiple correct answers, equivalent options, weak distractors, explanation conflict, missing option metadata, or missing bilingual localization.',
      'Do not introduce a new topic, source-paper copy, easier difficulty, or unrelated question type while repairing.',
      ...targetedInstructions,
      'Preserve valid wording/numbers/context when possible; change only the fields needed to pass the gate.',
      'The revised candidate must be publishable without human confirmation.'
    ].join(' ')
  };
}

export function mockExamRegenerationFeedback(input: {
  issue?: string | null;
  gateDecision?: string | null;
  gateReasons?: string[];
  reviewIssueCodes?: string[];
  targetProfile?: unknown;
  previousQuestionId?: number | null;
  generationAttempt: number;
  slotNumber: number;
}) {
  const signals = mockExamFailureSignals(input);
  const normalizedTargetProfile = normalizeMockExamTargetProfile(recordFrom(input.targetProfile) ?? {}, {
    slotNumber: input.slotNumber,
    signals,
    generationAttempt: input.generationAttempt
  });
  const strategy = recordFrom(normalizedTargetProfile.generationStrategy) ?? {};
  const profileCorrectionInstructions = stringListFrom(strategy.profileCorrectionInstructions);
  const blockedPatterns = [
    ...mockExamBlockedPatterns(signals),
    ...stringListFrom(strategy.bannedStemPatterns).map((pattern) => `Do not use bannedStemPattern ${pattern}.`),
    cleanString(strategy.requiredStemPattern)
      ? `Required stem pattern for this retry: ${cleanString(strategy.requiredStemPattern)}. ${cleanString(strategy.requiredStemPatternInstruction)}`
      : ''
  ].filter(Boolean);
  const targetedInstructions = [
    'Generate a fresh replacement candidate for this exact mock exam slot; do not revise, paraphrase, number-swap, or reuse the failed candidate.',
    'Treat targetProfile as a hard contract: questionForm, cognitiveSkill, difficultyBand, readingLoad, calculationLoad, and targetAnswer must all be satisfied when present.',
    'If the prior failure was structural, change the problem structure, reasoning path, and stem form before changing numbers.',
    cleanString(strategy.requiredStemPattern)
      ? `Use requiredStemPattern=${cleanString(strategy.requiredStemPattern)}. ${cleanString(strategy.requiredStemPatternInstruction)}`
      : '',
    stringListFrom(strategy.bannedStemPatterns).length
      ? `Avoid bannedStemPatterns: ${stringListFrom(strategy.bannedStemPatterns).join(', ')}.`
      : '',
    ...profileCorrectionInstructions,
    'The replacement must be publishable by the automatic gate without human confirmation.',
    ...blockedPatterns
  ].filter(Boolean);
  return {
    repairMode: 'regenerate_variant_after_gate_failure',
    strategy: 'fresh_candidate_after_gate_failure',
    failedQuestionId: input.previousQuestionId ?? null,
    slotNumber: input.slotNumber,
    generationAttempt: input.generationAttempt,
    maxGenerationAttempts: MOCK_EXAM_AI_GENERATION_MAX_ATTEMPTS,
    gateDecision: cleanString(input.gateDecision, 'unknown'),
    gateReasons: input.gateReasons ?? [],
    reviewIssueCodes: input.reviewIssueCodes ?? [],
    targetProfile: normalizedTargetProfile,
    blockedPatterns,
    targetedInstructions,
    issue: cleanString(input.issue, 'review_gate_not_passed'),
    instruction: targetedInstructions.join(' ')
  };
}

function cleanStatus(value: unknown, fallback = 'draft') {
  const next = cleanString(value, fallback);
  return STATUSES.includes(next as never) ? next : fallback;
}

function cleanBlueprintStatus(value: unknown, fallback = 'draft') {
  const next = cleanString(value, fallback);
  return BLUEPRINT_STATUSES.includes(next as never) ? next : fallback;
}

function cleanBlueprintSlotStatus(value: unknown, fallback = 'draft') {
  const next = cleanString(value, fallback);
  return BLUEPRINT_SLOT_STATUSES.includes(next as never) ? next : fallback;
}

function cleanPositive(value: unknown, fallback: number) {
  const next = Number(value);
  return Number.isInteger(next) && next > 0 ? next : fallback;
}

function intInRange(value: unknown, fallback: number, min: number, max: number) {
  const next = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(next)) return fallback;
  return Math.max(min, Math.min(max, next));
}

function cleanBoolean(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback;
}

function optionsFromJson(value: Prisma.JsonValue | unknown): MockExamOption[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
      const option = item as Record<string, unknown>;
      return { id: String(option.id ?? ''), text: String(option.text ?? '') };
    })
    .filter((item): item is MockExamOption => Boolean(item?.id && item.text));
}

function tagsFromJson(value: Prisma.JsonValue | unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : [];
}

function normalizeExamLanguage(language?: string): PublicLocale {
  return language?.toLowerCase().startsWith('en') ? 'en' : 'zh-CN';
}

function examLanguageCode(locale: PublicLocale) {
  return locale === 'en' ? 'en' : 'zh';
}

const TERM_TRANSLATIONS: Record<string, string> = {
  '集合与不等式': 'Sets and inequalities',
  '几何与代数': 'Geometry and algebra',
  '概率与统计': 'Probability and statistics',
  '函数': 'Functions',
  '力学': 'Mechanics',
  '电磁学': 'Electromagnetism',
  '热学': 'Thermal physics',
  '光学': 'Optics',
  '波动': 'Waves',
  '近代物理': 'Modern physics',
  '物质结构': 'Matter structure',
  '反应原理': 'Reaction principles',
  '溶液': 'Solutions',
  '有机化学': 'Organic chemistry',
  '水': 'water',
  '二氧化碳': 'carbon dioxide',
  '氯化钠': 'sodium chloride',
  '甲烷': 'methane',
  '氢氧化钠': 'sodium hydroxide',
  '碳酸钙': 'calcium carbonate',
  '硫酸': 'sulfuric acid',
  '乙醇': 'ethanol',
  '纯水': 'pure water',
  '紫色石蕊试液': 'purple litmus solution',
  '酚酞试液': 'phenolphthalein solution',
  '盐酸': 'hydrochloric acid',
  '稀释浓硫酸': 'diluting concentrated sulfuric acid',
  '酸碱中和反应的主要生成物通常有': 'the main products of acid-base neutralization are usually',
  '强氧化性': 'strong oxidizing property',
  '不导电': 'non-conductive',
  '酸性': 'acidic',
  '中性': 'neutral',
  '碱性': 'alkaline',
  '无法判断': 'cannot be determined',
  '变红': 'turns red',
  '变蓝': 'turns blue',
  '变绿': 'turns green',
  '无变化': 'no change',
  '变黑': 'turns black',
  '生成沉淀': 'forms a precipitate',
  '中和反应': 'neutralization reaction',
  '分解反应': 'decomposition reaction',
  '置换反应': 'single-displacement reaction',
  '化合反应': 'combination reaction',
  '复分解反应': 'double-displacement reaction',
  '盐和水': 'salt and water',
  '单质和氧气': 'simple substance and oxygen',
  '酸和金属': 'acid and metal',
  '碱和氢气': 'base and hydrogen',
  '将浓硫酸沿器壁慢慢倒入水中并搅拌': 'slowly pour concentrated sulfuric acid into water along the container wall while stirring',
  '把水倒入浓硫酸': 'pour water into concentrated sulfuric acid',
  '直接用手搅拌': 'stir directly by hand',
  '密闭加热': 'heat in a sealed container',
  '反应前后 H 原子和 O 原子数相等': 'the numbers of H and O atoms are equal before and after the reaction',
  '氧原子消失': 'oxygen atoms disappear',
  '氢原子变成氧原子': 'hydrogen atoms become oxygen atoms',
  '反应不守恒': 'the reaction is not conserved',
  '属于分解反应': 'it is a decomposition reaction',
  '属于化合反应': 'it is a combination reaction',
  '生成单质钙': 'elemental calcium is produced',
  '没有新物质生成': 'no new substance is formed',
  '属于置换反应': 'it is a single-displacement reaction',
  '属于中和反应': 'it is a neutralization reaction',
  '没有元素化合价变化': 'no element changes oxidation state',
  '生成盐和水': 'salt and water are produced',
  '反应物只有化合物': 'the reactants are only compounds',
  '质量守恒定律': 'the law of conservation of mass',
  '适用于化学反应': 'applies to chemical reactions',
  '表示体积一定守恒': 'means volume is always conserved',
  '表示分子种类不变': 'means molecule types do not change',
  '只适用于气体': 'applies only to gases',
  '化学反应前后': 'before and after a chemical reaction',
  '原子种类和数目守恒': 'the types and numbers of atoms are conserved',
  '分子种类一定不变': 'molecule types must remain unchanged',
  '颜色一定不变': 'color must remain unchanged',
  '状态一定不变': 'state must remain unchanged',
  '燃烧通常需要': 'combustion usually requires',
  '可燃物、氧气和达到着火点': 'fuel, oxygen, and reaching the ignition point',
  '只需要水': 'only water',
  '只需要二氧化碳': 'only carbon dioxide',
  '完全隔绝空气': 'complete isolation from air',
  '铁生锈主要与': 'iron rusting is mainly related to',
  '氧气和水有关': 'oxygen and water',
  '氮气和氦气有关': 'nitrogen and helium',
  '真空有关': 'vacuum',
  '强光照射有关': 'strong light exposure',
  '催化剂': 'a catalyst',
  '能改变化学反应速率': 'can change the rate of a chemical reaction',
  '一定增加生成物质量': 'must increase the mass of products',
  '反应后一定消失': 'must disappear after the reaction',
  '只适用于物理变化': 'applies only to physical changes',
  '升高温度通常': 'raising temperature usually',
  '能加快许多反应速率': 'can speed up many reactions',
  '一定停止反应': 'must stop the reaction',
  '使质量不守恒': 'makes mass not conserved',
  '使原子消失': 'makes atoms disappear',
  '增大反应物浓度通常': 'increasing reactant concentration usually',
  '能提高有效碰撞机会': 'can increase the chance of effective collisions',
  '一定降低反应速率': 'must lower the reaction rate',
  '不影响任何反应': 'does not affect any reaction',
  '使溶剂消失': 'makes the solvent disappear',
  '粉末状固体比块状固体反应更快，常因为': 'powdered solids often react faster than lumps because',
  '接触面积更大': 'the contact area is larger',
  '质量一定更小': 'the mass must be smaller',
  '颜色更浅': 'the color is lighter',
  '密度为 0': 'the density is 0',
  '可逆反应达到平衡时': 'when a reversible reaction reaches equilibrium',
  '正逆反应速率相等': 'the forward and reverse reaction rates are equal',
  '反应完全停止': 'the reaction completely stops',
  '反应物全部消失': 'all reactants disappear',
  '生成物全部消失': 'all products disappear',
  '化学平衡移动与': 'a shift in chemical equilibrium is related to',
  '浓度、温度、压强等条件有关': 'concentration, temperature, pressure, and other conditions',
  '元素名称无关': 'element names',
  '颜色必然无关': 'color necessarily being irrelevant',
  '容器形状唯一有关': 'only the container shape',
  '有机物通常含有': 'organic compounds usually contain',
  '碳元素': 'carbon',
  '钠元素': 'sodium',
  '氦元素': 'helium',
  '氖元素': 'neon',
  '乙酸中含有的典型官能团是': 'the typical functional group in acetic acid is',
  '羧基': 'carboxyl group',
  '羟基': 'hydroxyl group',
  '醛基': 'aldehyde group',
  '氨基': 'amino group',
  '乙烯能使溴水褪色，主要因为分子中含有': 'ethylene decolorizes bromine water mainly because its molecule contains',
  '碳碳双键': 'a carbon-carbon double bond',
  '钠离子': 'sodium ions',
  '氯离子': 'chloride ions',
  '稀有气体原子': 'noble gas atoms',
  '葡萄糖属于': 'glucose is',
  '有机物': 'an organic compound',
  '单质': 'a simple substance',
  '盐': 'a salt',
  '稀有气体': 'a noble gas',
  '天然气主要成分通常是': 'the main component of natural gas is usually',
  '乙酸': 'acetic acid',
  '蛋白质中通常含有': 'proteins usually contain',
  '碳、氢、氧、氮等元素': 'carbon, hydrogen, oxygen, nitrogen, and other elements',
  '只含铁元素': 'only iron',
  '只含钠元素': 'only sodium',
  '只含氦元素': 'only helium',
  '离子化合物 NaCl 熔融时能导电，主要因为': 'molten ionic compound NaCl conducts electricity mainly because',
  '存在可自由移动的离子': 'freely moving ions are present',
  '分子完全静止': 'molecules are completely still',
  '没有带电粒子': 'there are no charged particles',
  '颜色变深': 'the color becomes darker',
  '同位素原子一定具有相同的': 'isotopic atoms must have the same',
  '质子数': 'number of protons',
  '中子数': 'number of neutrons',
  '质量数': 'mass number',
  '相对原子质量': 'relative atomic mass',
  '原子失去电子后通常形成': 'after losing electrons, an atom usually forms',
  '阳离子': 'a cation',
  '阴离子': 'an anion',
  '中子': 'a neutron',
  '分子晶体': 'a molecular crystal',
  '溶液具有均一性，表示取任意一部分时': 'a solution is homogeneous, meaning any portion has',
  '组成基本相同': 'basically the same composition',
  '一定有沉淀': 'a precipitate for sure',
  '颜色必然不同': 'a necessarily different color',
  '溶质一定消失': 'solute that must disappear',
  '平面镜成像': 'plane mirror imaging',
  '正立、等大的虚像': 'an upright virtual image of the same size',
  '倒立、缩小的实像': 'an inverted reduced real image',
  '正立、放大的实像': 'an upright magnified real image',
  '倒立、等大的虚像': 'an inverted virtual image of the same size',
  '凸透镜对平行光': 'a convex lens on parallel light',
  '会聚作用': 'converges it',
  '发散作用': 'diverges it',
  '吸收作用': 'absorbs it',
  '只改变颜色': 'only changes its color',
  '声音在真空中': 'sound in a vacuum',
  '不能传播': 'cannot propagate',
  '传播最快': 'propagates fastest',
  '只沿曲线传播': 'only propagates along curves',
  '频率变为 0': 'has frequency become 0',
  '频率越高的声音': 'a sound with higher frequency',
  '音调越高': 'has a higher pitch',
  '响度越大': 'has greater loudness',
  '传播速度越大': 'has greater propagation speed',
  '一定不能听见': 'must be inaudible',
  '光从空气斜射入水中通常会': 'light usually does this when entering water obliquely from air',
  '发生折射': 'refracts',
  '停止传播': 'stops propagating',
  '只发生漫反射': 'only undergoes diffuse reflection',
  '电磁波在真空中传播速度约为': 'the speed of electromagnetic waves in vacuum is about',
  '原子核带': 'an atomic nucleus is',
  '正电': 'positively charged',
  '负电': 'negatively charged',
  '不带电': 'uncharged',
  '可变为光子': 'can turn into photons',
  '物体吸热熔化时温度可能保持不变，说明热量用于': 'when an object absorbs heat while melting, its temperature may remain unchanged because the heat is used to',
  '改变物态': 'change state',
  '减小质量': 'reduce mass',
  '消灭分子': 'destroy molecules',
  '改变重力': 'change gravity'
};

function translateTerms(text: string) {
  let next = text;
  const entries = Object.entries(TERM_TRANSLATIONS).sort((a, b) => b[0].length - a[0].length);
  for (const [source, target] of entries) {
    next = next.split(source).join(target);
  }
  return next;
}

function stripUnknownChinese(text: string) {
  return text
    .replace(/[，。]/g, '. ')
    .replace(/[：]/g, ': ')
    .replace(/[（]/g, '(')
    .replace(/[）]/g, ')')
    .replace(/[\u4e00-\u9fff]+/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+\./g, '.')
    .trim();
}

function englishPrompt(text: string) {
  const normalized = text.replace(/（\s*）/g, '( )');
  const patterns: Array<[RegExp, (...matches: string[]) => string]> = [
    [/^不等式 x \+ ([-\d]+) > ([-\d]+) 的解集为\( \)$/, (a, b) => `The solution set of the inequality x + ${a} > ${b} is ( ).`],
    [/^一次函数 y=([^ ]+) 与 y 轴的交点坐标是\( \)$/, (expr) => `For the linear function y=${expr}, the y-intercept is ( ).`],
    [/^等差数列首项为 ([-\d]+)，公差为 ([-\d]+)，第 ([\d]+) 项是\( \)$/, (first, diff, n) => `In an arithmetic sequence with first term ${first} and common difference ${diff}, the ${n}th term is ( ).`],
    [/^直角三角形两条直角边分别为 ([\d]+) 和 ([\d]+)，斜边长为\( \)$/, (a, b) => `A right triangle has legs ${a} and ${b}. The hypotenuse is ( ).`],
    [/^袋中有 ([\d]+) 个大小相同的小球，其中 ([\d]+) 个为红球，随机取 1 个，取到红球的概率是\( \)$/, (total, favorable) => `A bag has ${total} identical balls, including ${favorable} red balls. If one ball is chosen at random, the probability of getting a red ball is ( ).`],
    [/^方程 x²=([\d]+) 的实数解为\( \)$/, (value) => `The real solutions of x²=${value} are ( ).`],
    [/^质量为 ([\d]+) kg 的物体获得 ([\d]+) m\/s² 的加速度，所受合力为\( \)$/, (m, a) => `An object of mass ${m} kg has acceleration ${a} m/s². The net force is ( ).`],
    [/^物体做匀速直线运动，([\d]+) s 内通过 ([\d]+) m，速度为\( \)$/, (t, s) => `An object moves uniformly and travels ${s} m in ${t} s. Its speed is ( ).`],
    [/^电阻为 ([\d]+) Ω 的导体两端电压为 ([\d]+) V，通过它的电流为\( \)$/, (r, u) => `A conductor with resistance ${r} Ω has voltage ${u} V across it. The current through it is ( ).`],
    [/^某机械在 ([\d]+) s 内做功 ([\d]+) J，平均功率为\( \)$/, (time, work) => `A machine does ${work} J of work in ${time} s. Its average power is ( ).`],
    [/^某物体比热容取 1 J\/\(g·℃\)，质量 ([\d]+) g，升高 ([\d]+) ℃ 吸收热量为\( \)$/, (mass, deltaT) => `An object has specific heat capacity 1 J/(g·deg C), mass ${mass} g, and temperature increase ${deltaT} deg C. The heat absorbed is ( ).`],
    [/^(.+) 的正确说法是\( \)$/, (stem) => `Which statement about ${translateTerms(stem)} is correct? ( )`],
    [/^(.+) 的化学式是\( \)$/, (name) => `What is the chemical formula of ${translateTerms(name)}? ( )`],
    [/^([\d]+) g 溶液中含溶质 ([\d]+) g，该溶液的质量分数为\( \)$/, (solution, solute) => `A ${solution} g solution contains ${solute} g of solute. Its mass percent is ( ).`],
    [/^(.+)，正确的是\( \)$/, (stem) => `For ${translateTerms(stem)}, which statement is correct? ( )`],
    [/^关于 (.+) 的说法正确的是\( \)$/, (stem) => `Which statement about ${translateTerms(stem)} is correct? ( )`],
    [/^(.+)\( \)$/, (stem) => `${translateTerms(stem)} ( )`]
  ];
  for (const [pattern, render] of patterns) {
    const match = normalized.match(pattern);
    if (match) return stripUnknownChinese(translateTerms(render(...match.slice(1))));
  }
  return stripUnknownChinese(translateTerms(normalized));
}

function englishExplanation(text: string) {
  let next = text
    .replace(/^两边同时减去 ([-\d]+)，得到 x > ([-\d]+)。$/, 'Subtract $1 from both sides to get x > $2.')
    .replace(/^与 y 轴相交时 x=0，代入得 y=([-\d]+)。$/, 'At the y-axis, x=0, so y=$1.')
    .replace(/^等差数列通项为 a_n=a_1\+\(n-1\)d，因此第 ([\d]+) 项为 ([-\d]+)。$/, 'The general term is a_n=a_1+(n-1)d, so the $1th term is $2.')
    .replace(/^由勾股定理 c²=([\d]+)²\+([\d]+)²，得 c=([\d.]+)。$/, 'By the Pythagorean theorem, c²=$1²+$2², so c=$3.')
    .replace(/^等可能取球时，概率=有利结果数\/总结果数=([\d]+)\/([\d]+)。$/, 'With equally likely draws, probability = favorable outcomes / total outcomes = $1/$2.')
    .replace(/^平方等于 ([\d]+) 的实数有 ([\d]+) 和 -([\d]+)。$/, 'The real numbers whose square is $1 are $2 and -$3.')
    .replace(/^由牛顿第二定律 F=ma，合力为 ([\d]+)×([\d]+)=([\d]+) N。$/, "By Newton's second law F=ma, the net force is $1×$2=$3 N.")
    .replace(/^匀速运动速度 v=s\/t=([\d]+)\/([\d]+)=([\d.]+) m\/s。$/, 'For uniform motion, v=s/t=$1/$2=$3 m/s.')
    .replace(/^根据欧姆定律 I=U\/R=([\d]+)\/([\d]+)=([\d.]+) A。$/, "By Ohm's law, I=U/R=$1/$2=$3 A.")
    .replace(/^功率 P=W\/t=([\d]+)\/([\d]+)=([\d.]+) W。$/, 'Power P=W/t=$1/$2=$3 W.')
    .replace(/^热量 Q=cmΔT=1×([\d]+)×([\d]+)=([\d]+) J。$/, 'Heat Q=cmΔT=1×$1×$2=$3 J.')
    .replace(/^(.+) 对应的基础结论是：(.+)。$/, 'The basic conclusion for $1 is: $2.')
    .replace(/^(.+) 的常用化学式为 (.+)。$/, 'The common chemical formula of $1 is $2.')
    .replace(/^质量分数=溶质质量\/溶液质量×100%=([\d]+)\/([\d]+)×100%=([\d.]+)%。$/, 'Mass percent = solute mass / solution mass × 100% = $1/$2 × 100% = $3%.')
    .replace(/^(.+) 的基础判断为：(.+)。$/, 'The basic judgment for $1 is: $2.')
    .replace(/^该题考查反应原理，正确结论是：(.+)。$/, 'This question tests reaction principles. The correct conclusion is: $1.')
    .replace(/^(.+) 对应的基础化学结论是：(.+)。$/, 'The basic chemistry conclusion for $1 is: $2.')
    .replace(/^该题考查(.+)基础概念，正确答案是：(.+)。$/, 'This question tests basic concepts in $1. The correct answer is: $2.');
  return stripUnknownChinese(translateTerms(next));
}

function localizeQuestion(question: DbQuestion | SnapshotQuestion, locale: PublicLocale) {
  const options = optionsFromJson(question.options);
  if (locale !== 'en') {
    return {
      id: question.id,
      orderNumber: question.orderNumber,
      questionType: question.questionType,
      prompt: question.prompt,
      options,
      correctAnswer: 'correctAnswer' in question ? question.correctAnswer : undefined,
      explanation: 'explanation' in question ? question.explanation : undefined,
      knowledgeTags: 'knowledgeTags' in question ? tagsFromJson(question.knowledgeTags) : undefined
    };
  }
  const localizedOptions = options.map((option) => ({ ...option, text: translateTerms(option.text) }));
  return {
    id: question.id,
    orderNumber: question.orderNumber,
    questionType: question.questionType,
    prompt: englishPrompt(question.prompt),
    options: localizedOptions,
    correctAnswer: 'correctAnswer' in question ? question.correctAnswer : undefined,
    explanation: 'explanation' in question ? englishExplanation(question.explanation) : undefined,
    knowledgeTags: 'knowledgeTags' in question ? tagsFromJson(question.knowledgeTags).map(translateTerms) : undefined
  };
}

function questionSnapshot(question: DbQuestion, locale: PublicLocale = 'zh-CN'): SnapshotQuestion {
  const localized = localizeQuestion(question, locale);
  return {
    id: question.id,
    version: question.version,
    orderNumber: question.orderNumber,
    questionType: question.questionType,
    prompt: localized.prompt,
    options: localized.options,
    correctAnswer: question.correctAnswer,
    explanation: localized.explanation ?? question.explanation,
    knowledgeTags: localized.knowledgeTags ?? tagsFromJson(question.knowledgeTags),
    status: question.status
  };
}

function questionsFromSnapshot(value: unknown): SnapshotQuestion[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
      const record = item as Record<string, unknown>;
      const id = Number(record.id);
      const orderNumber = Number(record.orderNumber);
      if (!Number.isInteger(id) || !Number.isInteger(orderNumber)) return null;
      return {
        id,
        version: Number.isInteger(Number(record.version)) && Number(record.version) > 0 ? Number(record.version) : 1,
        orderNumber,
        questionType: cleanString(record.questionType, 'single-choice'),
        prompt: cleanString(record.prompt),
        options: optionsFromJson(record.options),
        correctAnswer: cleanString(record.correctAnswer),
        explanation: cleanString(record.explanation),
        knowledgeTags: tagsFromJson(record.knowledgeTags),
        status: cleanStatus(record.status, 'published')
      };
    })
    .filter((item): item is SnapshotQuestion => Boolean(item));
}

function localizedPaperText(paper: PaperLike, locale: PublicLocale) {
  if (locale !== 'en') {
    return {
      title: paper.title,
      description: paper.description ?? undefined,
      priceLabel: paper.priceLabel ?? undefined
    };
  }
  const subject = SUBJECT_LOCALIZATION[paper.subject as MockExamSubject]?.en;
  const subjectTitle = subject?.title ?? String(paper.subject);
  const sequence = paper.slug.match(/mock-(\d+)$/)?.[1] ?? paper.title.match(/模拟卷\s*(\d+)/)?.[1];
  const paperNumber = sequence ? Number(sequence) : undefined;
  return {
    title: paperNumber ? `${subjectTitle} Mock Paper ${paperNumber}` : paper.title,
    description: paperNumber && paperNumber > 1
      ? `${subjectTitle} full mock paper. Unlock planning is in progress.`
      : paperNumber === 1
        ? `${subjectTitle} original full-length mock paper, 48 questions / 60 minutes.`
        : paper.description ?? undefined,
      priceLabel: 'Free'
  };
}

function paperSummary(paper: PaperLike, locale: PublicLocale = 'zh-CN') {
  const localized = localizedPaperText(paper, locale);
  return {
    id: paper.id,
    subject: paper.subject as MockExamSubject,
    slug: paper.slug,
    title: localized.title,
    description: localized.description,
    language: paper.language,
    questionCount: paper.questionCount,
    durationMinutes: paper.durationMinutes,
    priceLabel: localized.priceLabel,
    isFree: true,
    isLocked: false
  };
}

function adminPaperSummary(paper: DbPaper & { _count?: { questions: number; attempts: number } }) {
  return {
    ...paperSummary(paper),
    priceLabel: paper.priceLabel,
    description: paper.description,
    sortOrder: paper.sortOrder,
    status: paper.status,
    createdAt: paper.createdAt.toISOString(),
    updatedAt: paper.updatedAt.toISOString(),
    questionTotal: paper._count?.questions ?? 0,
    attemptTotal: paper._count?.attempts ?? 0,
    version: paper.version
  };
}

function adminQuestionSummary(question: DbQuestion) {
  return {
    id: question.id,
    paperId: question.paperId,
    orderNumber: question.orderNumber,
    questionType: question.questionType,
    prompt: question.prompt,
    options: optionsFromJson(question.options),
    correctAnswer: question.correctAnswer,
    explanation: question.explanation,
    knowledgeTags: tagsFromJson(question.knowledgeTags),
    status: question.status,
    createdAt: question.createdAt.toISOString(),
    updatedAt: question.updatedAt.toISOString(),
    version: question.version
  };
}

type MockExamTopicMappingForReport = {
  sourceId: number;
  confidence: number;
  topic: {
    id: number;
    code: string;
    title: string;
    module: string | null;
    syllabusVersion?: string;
  };
};

function normalizedTopicTitle(value: unknown) {
  return cleanString(value).replace(/\s+/g, '').replace(/[，。、：:；;（）()]/g, '').toLowerCase();
}

function incrementCounter(map: Map<string, number>, key: string | null | undefined, fallback = 'unknown') {
  const normalized = cleanString(key, fallback) || fallback;
  map.set(normalized, (map.get(normalized) ?? 0) + 1);
}

function rankedCounter(map: Map<string, number>, limit = 8) {
  return Array.from(map.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
    .slice(0, limit);
}

function weightedDistributionItems(value: unknown, fallback: string[] = []) {
  const record = recordFrom(value) ?? {};
  const fromRecord = Object.entries(record)
    .map(([key, weight]) => ({ key: cleanString(key), weight: Number(weight) }))
    .filter((item) => item.key && Number.isFinite(item.weight) && item.weight > 0);
  if (fromRecord.length) return fromRecord.sort((a, b) => b.weight - a.weight || a.key.localeCompare(b.key));
  return fallback
    .map((key) => cleanString(key))
    .filter(Boolean)
    .map((key) => ({ key, weight: 1 }));
}

function distributedWeightedSequence(value: unknown, total: number, fallback: string[] = []) {
  const items = weightedDistributionItems(value, fallback);
  if (!items.length || total <= 0) return Array.from({ length: Math.max(0, total) }, () => fallback[0] ?? 'unknown');
  const weightTotal = items.reduce((sum, item) => sum + item.weight, 0) || items.length;
  const targetCounts = items.map((item) => ({ ...item, target: item.weight / weightTotal * total, assigned: 0 }));
  const sequence: string[] = [];
  for (let index = 0; index < total; index += 1) {
    const best = targetCounts
      .map((item) => ({ item, deficit: item.target * ((index + 1) / total) - item.assigned }))
      .sort((a, b) => b.deficit - a.deficit || b.item.weight - a.item.weight || a.item.key.localeCompare(b.item.key))[0]?.item ?? targetCounts[0];
    best.assigned += 1;
    sequence.push(best.key);
  }
  return sequence;
}

function normalizeQuestionFormForMockExam(value: unknown, fallback = 'mixed') {
  const normalized = cleanString(value, fallback).toLowerCase();
  const aliases: Record<string, string> = {
    calculation: 'calculation_application',
    formula_calculation: 'calculation_application',
    compute: 'calculation_application',
    graph_interpretation: 'diagram_interpretation',
    concept_identification: 'concept_check',
    concept_discrimination: 'concept_judgement'
  };
  return aliases[normalized] ?? normalized;
}

function normalizeCognitiveSkillForMockExam(value: unknown, fallback = 'standard_application') {
  const normalized = cleanString(value, fallback).toLowerCase();
  if (!normalized || normalized === 'unknown' || normalized === 'mixed') return fallback;
  return normalized;
}

function normalizeMockExamLoad(value: unknown, fallback: string, allowed: string[]) {
  const normalized = cleanString(value, fallback).toLowerCase();
  return allowed.includes(normalized) ? normalized : fallback;
}

function normalizeMockExamAnswerTarget(value: unknown) {
  const answer = cleanString(value).toUpperCase();
  return OPTION_IDS.includes(answer) ? answer : null;
}

function mockExamStemPatternInstruction(pattern: string, target?: Record<string, unknown>) {
  const calculationLoad = cleanString(target?.calculationLoad);
  const cognitiveSkill = cleanString(target?.cognitiveSkill);
  const questionForm = cleanString(target?.questionForm);
  const difficultyBand = cleanString(target?.difficultyBand);
  const loadInstruction = (() => {
    if (calculationLoad === 'none') {
      return ' Keep the task conceptual: no interval computation, no full algebraic solving, and no numeric substitution chain.';
    }
    if (calculationLoad === 'light') {
      return ' Keep the calculation load light: at most one short transformation or one sign/endpoint check.';
    }
    if (calculationLoad === 'medium' || calculationLoad === 'heavy') {
      return ' Include a concrete algebraic condition, mini worked step, or nontrivial option comparison so the calculation load is visible without becoming a full direct-solve question.';
    }
    return '';
  })();
  const conceptInstruction = cognitiveSkill === 'concept_discrimination' || cognitiveSkill === 'concept_identification' || questionForm === 'concept_judgement'
    ? ' Frame the answer as a judgement about a rule, step, equivalence, missing condition, or misconception rather than a final computed result.'
    : '';
  const simpleReverseParameterInstruction = pattern === 'parameter_condition_reverse'
    && (calculationLoad === 'light' || difficultyBand === 'basic')
    ? ' For basic/light targets, use a one-variable condition, endpoint/sign check, or simple interval boundary; avoid circle-line chord length, conic geometry, trigonometric parameters, discriminant-heavy cases, or multi-equation setup.'
    : '';
  const instructions: Record<string, string> = {
    equivalence_judgement: 'Build the stem around judging which transformation, interval notation, or statement is equivalent to a given condition. Do not ask students to solve one inequality from scratch.',
    error_diagnosis: 'Show a short flawed solution or transformation and ask students to identify the first invalid step or missing condition.',
    parameter_condition_reverse: 'Give a target solution-set property, inclusion relation, or boundary condition and ask students to infer a parameter condition.',
    solution_set_comparison: 'Compare two already-given inequalities, transformations, or solution sets and ask which relationship or conclusion is valid; do not ask for one final solution set.',
    compound_condition_application: 'Combine at least two conditions such as denominator restrictions, sign changes, interval endpoints, or parameter constraints before asking for the result.',
    domain_restriction_diagnosis: 'Ask which domain restriction, excluded value, denominator constraint, or endpoint openness is missing or valid in a shown step. Do not ask for the full solution set.',
    concept_statement_judgement: 'Ask students to select the correct conceptual statement or rule application, with each option representing a distinct misconception.',
    exam_like_calculation: 'Ask for a concrete result, but require multiple connected steps rather than one direct simplification.',
    direct_solve_inequality: 'Directly solve a single inequality for its solution set.'
  };
  return `${instructions[pattern] ?? 'Use an exam-like stem pattern that matches the normalized target profile.'}${loadInstruction}${conceptInstruction}${simpleReverseParameterInstruction}`;
}

function mockExamStrategyTopicFamily(target: Record<string, unknown>) {
  const text = [
    target.module,
    target.topicTitle,
    target.topicCode,
    target.examScope
  ].map((item) => cleanString(item).toLowerCase()).filter(Boolean).join(' ');
  if (/不等式|inequal/.test(text)) return 'inequality';
  if (/函数|function|log|指数|对数/.test(text)) return 'function';
  if (/圆锥|椭圆|双曲线|解析几何|geometry|conic/.test(text)) return 'analytic_geometry';
  if (/概率|统计|probability|statistics/.test(text)) return 'probability';
  return 'general';
}

function mockExamStemPatternCandidates(target: Record<string, unknown>) {
  const family = mockExamStrategyTopicFamily(target);
  const questionForm = cleanString(target.questionForm);
  const cognitiveSkill = cleanString(target.cognitiveSkill);
  const calculationLoad = cleanString(target.calculationLoad);
  if (family === 'inequality') {
    if (cognitiveSkill === 'concept_discrimination' || questionForm === 'concept_judgement' || questionForm === 'concept_check' || calculationLoad === 'none') {
      return ['concept_statement_judgement', 'error_diagnosis', 'equivalence_judgement'];
    }
    return ['parameter_condition_reverse', 'compound_condition_application', 'domain_restriction_diagnosis', 'solution_set_comparison', 'exam_like_calculation'];
  }
  if (family === 'analytic_geometry') {
    if (cognitiveSkill === 'concept_discrimination' || questionForm === 'concept_judgement') {
      return ['concept_statement_judgement', 'solution_set_comparison', 'parameter_condition_reverse'];
    }
    return ['parameter_condition_reverse', 'compound_condition_application', 'exam_like_calculation'];
  }
  if (family === 'function') {
    if (cognitiveSkill === 'concept_discrimination' || questionForm === 'concept_judgement') {
      return ['concept_statement_judgement', 'equivalence_judgement', 'error_diagnosis'];
    }
    return ['compound_condition_application', 'parameter_condition_reverse', 'exam_like_calculation'];
  }
  if (cognitiveSkill === 'concept_discrimination' || questionForm === 'concept_judgement' || questionForm === 'concept_check') {
    return ['concept_statement_judgement', 'error_diagnosis', 'solution_set_comparison'];
  }
  return ['compound_condition_application', 'parameter_condition_reverse', 'exam_like_calculation'];
}

function normalizeMockExamTargetProfile(raw: Record<string, unknown>, options: { slotNumber?: number; signals?: string[]; bannedStemPatterns?: string[]; generationAttempt?: number; strategySource?: string; replanAttempt?: number; replanReason?: string } = {}) {
  const adjustments: string[] = [];
  let calculationLoad = normalizeMockExamLoad(raw.calculationLoad, 'light', ['none', 'light', 'medium', 'heavy']);
  let questionForm = normalizeQuestionFormForMockExam(raw.questionForm, calculationLoad === 'none' ? 'concept_judgement' : 'calculation_application');
  let cognitiveSkill = normalizeCognitiveSkillForMockExam(raw.cognitiveSkill, calculationLoad === 'none' ? 'concept_discrimination' : 'standard_application');
  if (calculationLoad === 'none' && !['concept_judgement', 'concept_check'].includes(questionForm)) {
    questionForm = 'concept_judgement';
    adjustments.push('no_calculation_load_normalized_to_concept_judgement');
  }
  if (calculationLoad === 'none' && !['concept_discrimination', 'concept_identification', 'recall'].includes(cognitiveSkill)) {
    cognitiveSkill = 'concept_discrimination';
    adjustments.push('no_calculation_load_normalized_to_concept_discrimination');
  }
  if (questionForm === 'calculation_application' && calculationLoad === 'none') {
    calculationLoad = 'light';
    adjustments.push('calculation_application_requires_at_least_light_calculation_load');
  }
  if (cognitiveSkill === 'concept_discrimination' && questionForm === 'calculation_application') {
    questionForm = 'concept_judgement';
    adjustments.push('concept_discrimination_normalized_to_concept_judgement_form');
  }
  if ((questionForm === 'concept_judgement' || questionForm === 'concept_check') && cognitiveSkill === 'calculation') {
    cognitiveSkill = 'concept_discrimination';
    adjustments.push('concept_form_calculation_skill_normalized_to_concept_discrimination');
  }
  const target = {
    ...raw,
    questionForm,
    cognitiveSkill,
    readingLoad: normalizeMockExamLoad(raw.readingLoad, 'medium', ['low', 'medium', 'high']),
    calculationLoad,
    difficultyBand: normalizeMockExamLoad(raw.difficultyBand, 'medium', ['basic', 'medium', 'hard']),
    targetAnswer: normalizeMockExamAnswerTarget(raw.targetAnswer)
  };
  const signals = options.signals ?? [];
  const signalText = signals.join(' ');
  const profileCorrectionInstructions = mockExamProfileCorrectionInstructions(signals, target);
  let bannedStemPatterns = Array.from(new Set([
    ...stringListFrom(recordFrom(raw.generationStrategy)?.bannedStemPatterns),
    ...(options.bannedStemPatterns ?? []),
    ...(signalText.includes('near_duplicate') || signalText.includes('question_form_mismatch') || signalText.includes('cognitive_skill_mismatch') || signalText.includes('duplicate_prompt')
      ? ['direct_solve_inequality']
      : [])
  ]));
  const allCandidates = mockExamStemPatternCandidates(target);
  let candidates = allCandidates.filter((pattern) => !bannedStemPatterns.includes(pattern));
  if (!candidates.length) {
    bannedStemPatterns = [];
    candidates = allCandidates;
    adjustments.push('stem_pattern_ban_list_reset_after_exhaustion');
  }
  const slotIndex = Math.max(0, Number(options.slotNumber ?? raw.slotNumber ?? 1) - 1);
  const attemptIndex = Math.max(0, Number(options.generationAttempt ?? 1) - 1);
  const requiredStemPattern = candidates[slotIndex % Math.max(1, candidates.length)] ?? allCandidates[slotIndex % Math.max(1, allCandidates.length)] ?? 'exam_like_calculation';
  const rotatedRequiredStemPattern = candidates[(slotIndex + attemptIndex) % Math.max(1, candidates.length)] ?? requiredStemPattern;
  return {
    ...target,
    generationStrategy: {
      schemaVersion: 'mock-exam-generation-strategy-v1',
      source: cleanString(options.strategySource, 'normalized_target_profile'),
      normalizedAt: new Date().toISOString(),
      ...(options.replanAttempt ? { replannedAt: new Date().toISOString(), replanAttempt: options.replanAttempt } : {}),
      ...(cleanString(options.replanReason) ? { replanReason: cleanString(options.replanReason) } : {}),
      topicFamily: mockExamStrategyTopicFamily(target),
      requiredStemPattern: rotatedRequiredStemPattern,
      requiredStemPatternInstruction: mockExamStemPatternInstruction(rotatedRequiredStemPattern, target),
      allowedStemPatterns: allCandidates,
      bannedStemPatterns,
      adjustments,
      profileCorrectionInstructions,
      promptChecklist: [
        'The final candidate must follow requiredStemPattern, not merely the same topic label.',
        'If requiredStemPattern is not direct_solve_inequality, the stem must not ask only to solve one inequality for its solution set.',
        'Options must be distinct after simplification and must represent different reasoning errors.',
        ...(target.targetAnswer ? [`Set correctAnswer to ${target.targetAnswer}; rewrite option contents so exactly ${target.targetAnswer} is correct without weakening distractors.`] : []),
        'Match targetProfile.calculationLoad exactly: none means conceptual judgement only; light means one short transformation; medium/heavy means a visible but non-direct-solve algebraic check.',
        'For concept_discrimination or concept_judgement slots, the correct answer must be a judgement about a rule, step, equivalence, missing condition, or misconception.',
        ...profileCorrectionInstructions
      ]
    }
  };
}

export function mockExamReplannedTargetProfile(input: {
  targetProfile?: unknown;
  issue?: string | null;
  gateReasons?: string[];
  reviewIssueCodes?: string[];
  slotNumber: number;
  replanAttempt: number;
}) {
  const raw = recordFrom(input.targetProfile) ?? {};
  const currentStrategy = recordFrom(raw.generationStrategy) ?? {};
  const currentRequiredPattern = cleanString(currentStrategy.requiredStemPattern);
  const signals = mockExamFailureSignals({
    issue: input.issue,
    gateReasons: input.gateReasons,
    reviewIssueCodes: input.reviewIssueCodes
  });
  const bannedStemPatterns = Array.from(new Set([
    ...stringListFrom(currentStrategy.bannedStemPatterns),
    ...(currentRequiredPattern ? [currentRequiredPattern] : []),
    ...(signals.some((signal) => /question_form_mismatch|cognitive_skill_mismatch|near[_-]?duplicate|duplicate_prompt|trivial/.test(signal))
      ? ['direct_solve_inequality']
      : [])
  ]));
  const replanned = normalizeMockExamTargetProfile(raw, {
    slotNumber: input.slotNumber,
    signals,
    bannedStemPatterns,
    generationAttempt: input.replanAttempt + 1,
    strategySource: 'closed_loop_replan',
    replanAttempt: input.replanAttempt,
    replanReason: cleanString(input.issue, 'structural_gate_failure')
  });
  return {
    ...replanned,
    closedLoop: {
      status: 'replanned',
      replanAttempt: input.replanAttempt,
      previousRequiredStemPattern: currentRequiredPattern || null,
      blockedPatterns: bannedStemPatterns,
      issue: cleanString(input.issue, 'structural_gate_failure')
    }
  };
}

function mockExamStyleTargetSequences(styleProfile: unknown, total: number) {
  const styleRecord = recordFrom(styleProfile) ?? {};
  const profile = recordFrom(styleRecord.profile) ?? styleRecord;
  const questionForms = distributedWeightedSequence(profile.questionFormDistribution, total, ['calculation_application', 'concept_judgement', 'concept_check'])
    .map((item) => normalizeQuestionFormForMockExam(item));
  const cognitiveSkills = distributedWeightedSequence(profile.cognitiveSkillDistribution, total, ['standard_application', 'calculation', 'concept_discrimination'])
    .map((item) => normalizeCognitiveSkillForMockExam(item));
  const readingLoads = distributedWeightedSequence(profile.readingLoadDistribution, total, ['low', 'medium']);
  const calculationLoads = distributedWeightedSequence(profile.calculationLoadDistribution, total, ['light', 'medium']);
  const difficultyBands = distributedWeightedSequence(profile.difficultyDistribution, total, []);
  const answerTargets = distributedWeightedSequence(profile.answerDistribution, total, OPTION_IDS).map(normalizeMockExamAnswerTarget);
  return Array.from({ length: Math.max(0, total) }, (_, index) => ({
    questionForm: questionForms[index] ?? 'mixed',
    cognitiveSkill: cognitiveSkills[index] ?? 'standard_application',
    readingLoad: ['low', 'medium', 'high'].includes(readingLoads[index]) ? readingLoads[index] : null,
    calculationLoad: ['none', 'light', 'medium', 'heavy'].includes(calculationLoads[index]) ? calculationLoads[index] : null,
    difficultyBand: ['basic', 'medium', 'hard'].includes(difficultyBands[index]) ? difficultyBands[index] : null,
    targetAnswer: answerTargets[index] ?? null,
    source: 'style_profile_distribution'
  }));
}

function mockExamSlotTargetProfilesFromBlueprint(blueprintProfile: unknown) {
  const profile = recordFrom(blueprintProfile) ?? {};
  const targets = Array.isArray(profile.slotTargetProfiles) ? profile.slotTargetProfiles : [];
  const records = targets
    .map((item) => recordFrom(item) ?? null)
    .filter((item): item is Record<string, unknown> => Boolean(item));
  return new Map(records
    .map((item) => [Number(item.slotNumber), item] as [number, Record<string, unknown>])
    .filter(([slotNumber]) => Number.isInteger(slotNumber) && slotNumber > 0));
}

function primaryTopicMappingByQuestion(questions: DbQuestion[], mappings: MockExamTopicMappingForReport[]) {
  const questionIds = new Set(questions.map((question) => question.id));
  const primary = new Map<number, MockExamTopicMappingForReport>();
  mappings
    .filter((mapping) => questionIds.has(mapping.sourceId))
    .sort((a, b) => b.confidence - a.confidence || a.topic.id - b.topic.id)
    .forEach((mapping) => {
      if (!primary.has(mapping.sourceId)) primary.set(mapping.sourceId, mapping);
    });
  return primary;
}

function buildAdminBlueprintReport(
  paper: DbPaper,
  questions: DbQuestion[],
  mappings: MockExamTopicMappingForReport[]
) {
  const primaryMappingByQuestion = primaryTopicMappingByQuestion(questions, mappings);

  const answerCounter = new Map<string, number>();
  const statusCounter = new Map<string, number>();
  const typeCounter = new Map<string, number>();
  const tagCounter = new Map<string, number>();
  const topicCounter = new Map<number, { topicId: number; code: string; title: string; module: string | null; count: number }>();
  questions.forEach((question) => {
    incrementCounter(answerCounter, question.correctAnswer);
    incrementCounter(statusCounter, question.status);
    incrementCounter(typeCounter, question.questionType);
    tagsFromJson(question.knowledgeTags).forEach((tag) => incrementCounter(tagCounter, tag));
    const mapping = primaryMappingByQuestion.get(question.id);
    if (mapping) {
      const current = topicCounter.get(mapping.topic.id);
      topicCounter.set(mapping.topic.id, {
        topicId: mapping.topic.id,
        code: mapping.topic.code,
        title: mapping.topic.title,
        module: mapping.topic.module,
        count: (current?.count ?? 0) + 1
      });
    }
  });

  const questionCount = questions.length;
  const publishedQuestionCount = questions.filter((question) => question.status === 'published').length;
  const mappedQuestionCount = primaryMappingByQuestion.size;
  const unmappedQuestionCount = Math.max(0, questionCount - mappedQuestionCount);
  const mappingCoverage = questionCount ? Math.round((mappedQuestionCount / questionCount) * 100) / 100 : 0;
  const topTopics = Array.from(topicCounter.values())
    .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code))
    .slice(0, 12);
  const orderedQuestions = [...questions].sort((a, b) => a.orderNumber - b.orderNumber || a.id - b.id);
  const segmentSpecs = [
    { key: 'early', label: '前段' },
    { key: 'middle', label: '中段' },
    { key: 'late', label: '后段' }
  ];
  const segments = segmentSpecs.map((segment, index) => {
    const start = Math.floor((orderedQuestions.length * index) / segmentSpecs.length);
    const end = Math.floor((orderedQuestions.length * (index + 1)) / segmentSpecs.length);
    const segmentQuestions = orderedQuestions.slice(start, end);
    const segmentTagCounter = new Map<string, number>();
    const segmentTopicCounter = new Map<number, { topicId: number; code: string; title: string; count: number }>();
    segmentQuestions.forEach((question) => {
      tagsFromJson(question.knowledgeTags).forEach((tag) => incrementCounter(segmentTagCounter, tag));
      const mapping = primaryMappingByQuestion.get(question.id);
      if (!mapping) return;
      const current = segmentTopicCounter.get(mapping.topic.id);
      segmentTopicCounter.set(mapping.topic.id, {
        topicId: mapping.topic.id,
        code: mapping.topic.code,
        title: mapping.topic.title,
        count: (current?.count ?? 0) + 1
      });
    });
    return {
      ...segment,
      questionCount: segmentQuestions.length,
      mappedQuestionCount: segmentQuestions.filter((question) => primaryMappingByQuestion.has(question.id)).length,
      firstQuestionOrder: segmentQuestions[0]?.orderNumber ?? null,
      lastQuestionOrder: segmentQuestions[segmentQuestions.length - 1]?.orderNumber ?? null,
      topTags: rankedCounter(segmentTagCounter, 5).map((item) => ({ tag: item.key, count: item.count })),
      topTopics: Array.from(segmentTopicCounter.values())
        .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code))
        .slice(0, 5)
    };
  });

  const warnings: string[] = [];
  if (!questionCount) warnings.push('当前套卷还没有题目，无法评估整卷画像。');
  if (questionCount && questionCount !== paper.questionCount) warnings.push(`套卷配置为 ${paper.questionCount} 题，当前实际录入 ${questionCount} 题。`);
  if (publishedQuestionCount !== paper.questionCount) warnings.push(`发布题数量为 ${publishedQuestionCount}，与配置题量 ${paper.questionCount} 不一致。`);
  if (questionCount && mappingCoverage < 0.9) warnings.push(`考点映射覆盖率 ${Math.round(mappingCoverage * 100)}%，建议补齐到 90% 以上再生成在线模考。`);
  if (questionCount >= 12 && topTopics.length <= 2) warnings.push('当前整卷覆盖的考点过少，后续生成模考蓝图时容易题面重复。');
  const maxAnswer = rankedCounter(answerCounter, 1)[0];
  if (questionCount >= 10 && maxAnswer && maxAnswer.count / questionCount > 0.4) warnings.push(`正确答案 ${maxAnswer.key} 占比偏高，建议检查答案分布。`);
  if (questionCount && rankedCounter(tagCounter, 1).length === 0) warnings.push('题目缺少知识点标签，画像只能依赖显式考点映射。');

  return {
    schemaVersion: 'mock-exam-blueprint-report-v1',
    status: questionCount === 0 ? 'empty' : mappingCoverage < 0.9 ? 'needs_mapping' : warnings.length ? 'review' : 'ready',
    generatedAt: new Date().toISOString(),
    questionCount,
    configuredQuestionCount: paper.questionCount,
    publishedQuestionCount,
    durationMinutes: paper.durationMinutes,
    estimatedTimeBudgetSeconds: paper.durationMinutes * 60,
    topicCoverage: {
      mappedQuestionCount,
      unmappedQuestionCount,
      mappingCoverage,
      uniqueTopicCount: topTopics.length,
      topTopics
    },
    distributions: {
      answers: rankedCounter(answerCounter, 8).map((item) => ({ answer: item.key, count: item.count })),
      statuses: rankedCounter(statusCounter, 8).map((item) => ({ status: item.key, count: item.count })),
      questionTypes: rankedCounter(typeCounter, 8).map((item) => ({ questionType: item.key, count: item.count })),
      tags: rankedCounter(tagCounter, 12).map((item) => ({ tag: item.key, count: item.count }))
    },
    slotProfile: {
      segments
    },
    warnings
  };
}

function blueprintDifficultyForSlot(index: number, total: number) {
  if (total <= 0) return 'medium';
  const ratio = (index + 1) / total;
  if (ratio <= 0.35) return 'basic';
  if (ratio >= 0.78) return 'hard';
  return 'medium';
}

function blueprintReadingLoadForSlot(index: number, total: number) {
  if (total <= 0) return 'medium';
  const ratio = (index + 1) / total;
  if (ratio <= 0.35) return 'low';
  return 'medium';
}

function blueprintCalculationLoadForSlot(index: number, total: number) {
  if (total <= 0) return 'light';
  const ratio = (index + 1) / total;
  if (ratio >= 0.78) return 'medium';
  return 'light';
}

function buildMockExamBlueprintDraft(paper: DbPaper, questions: DbQuestion[], mappings: MockExamTopicMappingForReport[], input: Record<string, unknown> = {}) {
  const report = buildAdminBlueprintReport(paper, questions, mappings);
  const primaryMappings = primaryTopicMappingByQuestion(questions, mappings);
  const orderedQuestions = [...questions].sort((a, b) => a.orderNumber - b.orderNumber || a.id - b.id);
  const secondsPerQuestion = Math.max(45, Math.round((paper.durationMinutes * 60) / Math.max(1, paper.questionCount || orderedQuestions.length || 1)));
  const moduleCounter = new Map<string, number>();
  primaryMappings.forEach((mapping) => incrementCounter(moduleCounter, mapping.topic.module || 'unmapped'));
  const styleTargets = mockExamStyleTargetSequences(input.styleProfile, orderedQuestions.length);
  const slots = orderedQuestions.map((question, index) => {
    const mapping = primaryMappings.get(question.id);
    const tags = tagsFromJson(question.knowledgeTags);
    const styleTarget = styleTargets[index] ?? {};
    const difficultyBand = cleanString(styleTarget.difficultyBand) || blueprintDifficultyForSlot(index, orderedQuestions.length);
    const readingLoad = cleanString(styleTarget.readingLoad) || blueprintReadingLoadForSlot(index, orderedQuestions.length);
    const calculationLoad = cleanString(styleTarget.calculationLoad) || blueprintCalculationLoadForSlot(index, orderedQuestions.length);
    const cognitiveSkill = normalizeCognitiveSkillForMockExam(styleTarget.cognitiveSkill, calculationLoad === 'none' ? 'concept_discrimination' : 'standard_application');
    const questionForm = normalizeQuestionFormForMockExam(styleTarget.questionForm, calculationLoad === 'none' ? 'concept_judgement' : 'calculation_application');
    return {
      slotNumber: question.orderNumber,
      topicIds: mapping ? [mapping.topic.id] : [],
      module: mapping?.topic.module ?? null,
      difficultyBand,
      cognitiveSkill,
      questionForm,
      readingLoad,
      calculationLoad,
      estimatedTimeSeconds: secondsPerQuestion,
      generationPromptHints: [
        `题位 ${question.orderNumber}`,
        mapping ? `优先覆盖 ${mapping.topic.code} ${mapping.topic.title}` : '需要补充 topic mapping',
        `题型目标：${questionForm}`,
        `能力目标：${cognitiveSkill}`,
        ...tags.slice(0, 3).map((tag) => `知识点标签：${tag}`)
      ],
      reviewerChecklist: [
        '必须符合当前考纲和题位 topic 约束',
        '不得复用或改写真题题干、数值组合或选项结构',
        `检查题型是否接近 ${questionForm}`,
        `检查能力目标是否接近 ${cognitiveSkill}`,
        `检查阅读量是否接近 ${readingLoad}`,
        `检查计算量是否接近 ${calculationLoad}`,
        '检查答案唯一且解析支持正确答案'
      ],
      status: mapping ? 'draft' : 'blocked'
    };
  });
  const profile = {
    schemaVersion: 'mock-exam-paper-profile-v1',
    inferenceQuality: 'heuristic_from_existing_paper',
    source: {
      type: 'mock_exam_paper',
      paperId: paper.id,
      reportSchemaVersion: report.schemaVersion
    },
    subject: paper.subject,
    syllabusVersion: cleanString(input.syllabusVersion, 'current') || 'current',
    questionCount: paper.questionCount,
    durationMinutes: paper.durationMinutes,
    totalScore: paper.questionCount,
    topicCoverage: report.topicCoverage,
    moduleWeights: rankedCounter(moduleCounter, 12).map((item) => ({
      module: item.key,
      minQuestions: Math.max(0, item.count - 1),
      targetQuestions: item.count,
      maxQuestions: item.count + 1
    })),
    readingLoadDistribution: Object.fromEntries(slots.reduce((map, slot) => {
      incrementCounter(map, slot.readingLoad);
      return map;
    }, new Map<string, number>())),
    calculationLoadDistribution: Object.fromEntries(slots.reduce((map, slot) => {
      incrementCounter(map, slot.calculationLoad);
      return map;
    }, new Map<string, number>())),
    questionFormDistribution: Object.fromEntries(slots.reduce((map, slot) => {
      incrementCounter(map, slot.questionForm);
      return map;
    }, new Map<string, number>())),
    cognitiveSkillDistribution: Object.fromEntries(slots.reduce((map, slot) => {
      incrementCounter(map, slot.cognitiveSkill);
      return map;
    }, new Map<string, number>())),
    slotTargetProfiles: slots.map((slot) => ({
      slotNumber: slot.slotNumber,
      questionForm: slot.questionForm,
      cognitiveSkill: slot.cognitiveSkill,
      difficultyBand: slot.difficultyBand,
      readingLoad: slot.readingLoad,
      calculationLoad: slot.calculationLoad,
      estimatedTimeSeconds: slot.estimatedTimeSeconds,
      source: 'style_profile_distribution'
    })),
    estimatedTimeBudgetSeconds: paper.durationMinutes * 60,
    assemblyRules: {
      maxSameTopicInARow: 2,
      maxSameAnswerInARow: 3,
      minTopicCoverage: 0.9,
      requireMixedCognitiveSkills: true,
      forbidNearDuplicateQuestions: true
    },
    sourceReport: report,
    warnings: [
      ...report.warnings,
      '当前蓝图由现有套卷和 topic mapping 启发式生成，后续应由真题画像/离线质量校准题位难度、阅读量和计算量。'
    ]
  };
  return {
    blueprint: {
      subject: paper.subject,
      title: cleanString(input.title) || `${paper.title} 蓝图`,
      syllabusVersion: cleanString(input.syllabusVersion, 'current') || 'current',
      sourceProfileIds: [] as number[],
      sourcePaperId: paper.id,
      questionCount: paper.questionCount,
      durationMinutes: paper.durationMinutes,
      totalScore: paper.questionCount,
      status: 'draft',
      profile
    },
    slots
  };
}

function mapMockExamBlueprint(row: MockExamBlueprintRow) {
  return {
    id: row.id,
    subject: row.subject,
    title: row.title,
    syllabusVersion: row.syllabusVersion,
    sourceProfileIds: Array.isArray(row.sourceProfileIds) ? row.sourceProfileIds : [],
    sourcePaperId: row.sourcePaperId,
    questionCount: row.questionCount,
    durationMinutes: row.durationMinutes,
    totalScore: row.totalScore,
    status: row.status,
    profile: row.profile,
    createdBy: row.createdBy,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

function mapMockExamBlueprintSlot(row: MockExamBlueprintSlotRow) {
  return {
    id: row.id,
    blueprintId: row.blueprintId,
    slotNumber: row.slotNumber,
    topicIds: Array.isArray(row.topicIds) ? row.topicIds : [],
    module: row.module,
    difficultyBand: row.difficultyBand,
    cognitiveSkill: row.cognitiveSkill,
    readingLoad: row.readingLoad,
    calculationLoad: row.calculationLoad,
    estimatedTimeSeconds: row.estimatedTimeSeconds,
    generationPromptHints: Array.isArray(row.generationPromptHints) ? row.generationPromptHints : [],
    reviewerChecklist: Array.isArray(row.reviewerChecklist) ? row.reviewerChecklist : [],
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

type AdminMockExamBlueprintDetailSlot = ReturnType<typeof mapMockExamBlueprintSlot>;

function mockExamSlotTargetProfile(blueprint: ReturnType<typeof mapMockExamBlueprint>, slot: AdminMockExamBlueprintDetailSlot) {
  const slotTargets = mockExamSlotTargetProfilesFromBlueprint(blueprint.profile);
  const target = slotTargets.get(slot.slotNumber) ?? {};
  const calculationLoad = cleanString(target.calculationLoad, slot.calculationLoad);
  return normalizeMockExamTargetProfile({
    slotNumber: slot.slotNumber,
    questionForm: normalizeQuestionFormForMockExam(target.questionForm, calculationLoad === 'none' ? 'concept_judgement' : 'calculation_application'),
    difficultyBand: cleanString(target.difficultyBand, slot.difficultyBand),
    cognitiveSkill: normalizeCognitiveSkillForMockExam(target.cognitiveSkill ?? slot.cognitiveSkill, calculationLoad === 'none' ? 'concept_discrimination' : 'standard_application'),
    readingLoad: cleanString(target.readingLoad, slot.readingLoad),
    calculationLoad,
    targetAnswer: normalizeMockExamAnswerTarget(target.targetAnswer),
    estimatedTimeSeconds: typeof target.estimatedTimeSeconds === 'number' ? target.estimatedTimeSeconds : slot.estimatedTimeSeconds,
    module: slot.module,
    generationStrategy: recordFrom(target.generationStrategy) ?? null
  }, { slotNumber: slot.slotNumber });
}

function mapMockExamGenerationJob(row: MockExamGenerationJobRow) {
  const slotResults = slotResultsFromJson(row.slotResults).map(mockExamAnnotateSlotDiagnostics);
  return {
    id: row.id,
    blueprintId: row.blueprintId,
    targetPaperId: row.targetPaperId,
    status: row.status,
    provider: row.provider,
    model: row.model,
    requestedSlotNumbers: Array.isArray(row.requestedSlotNumbers) ? row.requestedSlotNumbers : [],
    slotResults,
    diagnostics: mockExamGenerationJobDiagnostics(slotResults),
    error: row.error,
    createdBy: row.createdBy,
    startedAt: row.startedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

function publicQuestion(question: DbQuestion | SnapshotQuestion, locale: PublicLocale = 'zh-CN') {
  const localized = localizeQuestion(question, locale);
  return {
    id: localized.id,
    orderNumber: localized.orderNumber,
    questionType: localized.questionType,
    prompt: localized.prompt,
    options: localized.options
  };
}

function recordStringMap(value: unknown, message: string) {
  const record = assertRecord(value ?? {}, message);
  return Object.fromEntries(Object.entries(record).map(([key, next]) => [String(key), String(next ?? '')]).filter(([, next]) => next));
}

function numberMap(value: unknown) {
  const record = assertRecord(value ?? {}, '题目耗时格式不正确。');
  return Object.fromEntries(Object.entries(record).map(([key, next]) => [String(key), Math.max(0, Number(next) || 0)]));
}

function numberList(value: unknown) {
  if (!Array.isArray(value)) throw new BadRequestException('标记题格式不正确。');
  return Array.from(new Set(value.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item > 0)));
}

function optionalNumberList(value: unknown, fallback: number[] = []) {
  if (value === undefined) return fallback;
  if (!Array.isArray(value)) throw new BadRequestException('题位 topicIds 格式不正确。');
  return Array.from(new Set(value.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item > 0)));
}

function slotResultsFromJson(value: unknown): MockExamGenerationSlotResult[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => item && typeof item === 'object' && !Array.isArray(item) ? item as MockExamGenerationSlotResult : null)
    .filter(Boolean) as MockExamGenerationSlotResult[];
}

function aiDifficultyFromSlot(value: unknown) {
  const difficulty = cleanString(value, 'medium').toLowerCase();
  if (difficulty === 'basic' || difficulty === 'medium' || difficulty === 'hard') return difficulty;
  return 'medium';
}

function aiQuestionTypeFromMockSlot() {
  return 'single_choice';
}

function generationSlotIssues(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function mockExamSlotIssueText(slot: MockExamGenerationSlotResult) {
  return generationSlotIssues(slot.issues).map((item) => cleanString(item)).filter(Boolean);
}

function mockExamSlotWaitReason(slot: MockExamGenerationSlotResult) {
  const status = cleanString(slot.status, 'queued');
  const issueText = mockExamSlotIssueText(slot).join(' ').toLowerCase();
  if (['approved', 'assembled'].includes(status) || Number(slot.candidateQuestionId) > 0) return 'complete';
  if (status === 'needs_attention') return 'waiting_for_attention';
  if (status === 'running') return 'active_runner';
  if (mockExamIsProviderBackpressure(issueText) || Number(slot.providerWaitCount ?? 0) > 0) return 'waiting_for_capacity';
  if (issueText.includes('target_profile_strategy_replanned') || issueText.includes('closed_loop_replan')) return 'waiting_for_replan';
  if (issueText.includes('provider_requeued') || issueText.includes('provider_schema_invalid') || issueText.includes('provider_empty_output')) return 'waiting_for_provider_retry';
  if (issueText.includes('review_gate_not_publishable') || issueText.includes('review_gate_not_passed') || issueText.includes('regenerate')) return 'waiting_for_content_retry';
  if (issueText.includes('slot_candidate_attempt_budget_exhausted') || issueText.includes('slot_replan_budget_exhausted')) return 'waiting_for_attention';
  if (status === 'failed') return 'content_failed';
  if (status === 'queued') return 'waiting_for_retry_window';
  return 'unknown';
}

function mockExamSlotNextAction(waitReason: string) {
  if (waitReason === 'complete') return 'none';
  if (waitReason === 'waiting_for_capacity') return 'wait_for_key_pool_capacity';
  if (waitReason === 'waiting_for_replan') return 'continue_with_replanned_target_profile';
  if (waitReason === 'waiting_for_provider_retry') return 'retry_provider_call';
  if (waitReason === 'waiting_for_content_retry') return 'regenerate_or_repair_candidate';
  if (waitReason === 'active_runner') return 'wait_for_active_runner';
  if (waitReason === 'waiting_for_attention' || waitReason === 'content_failed') return 'operator_attention';
  return 'continue_processing';
}

function mockExamAnnotateSlotDiagnostics(slot: MockExamGenerationSlotResult) {
  const waitReason = mockExamSlotWaitReason(slot);
  const budget = mockExamSlotBudgetState(slot);
  const issueCodes = mockExamSlotIssueText(slot)
    .map((issue) => issue.split(':')[0])
    .filter(Boolean);
  return {
    ...slot,
    waitReason,
    nextAction: mockExamSlotNextAction(waitReason),
    diagnostics: {
      ...(recordFrom(slot.diagnostics) ?? {}),
      waitReason,
      nextAction: mockExamSlotNextAction(waitReason),
      issueCodes,
      candidateAttemptCount: Math.max(0, Number(slot.candidateAttemptCount ?? 0) || 0),
      providerWaitCount: Math.max(0, Number(slot.providerWaitCount ?? 0) || 0),
      budget
    }
  };
}

function mockExamGenerationJobDiagnostics(slotResults: MockExamGenerationSlotResult[]) {
  const annotated = slotResults.map(mockExamAnnotateSlotDiagnostics);
  const waitReasons = annotated.reduce<Record<string, number>>((counts, slot) => {
    const reason = cleanString(slot.waitReason, 'unknown');
    counts[reason] = (counts[reason] ?? 0) + 1;
    return counts;
  }, {});
  const waiting = annotated.filter((slot) => !['complete'].includes(cleanString(slot.waitReason)));
  return {
    requiredCount: annotated.length,
    approvedCount: annotated.filter((slot) => ['approved', 'assembled'].includes(cleanString(slot.status)) || Number(slot.candidateQuestionId) > 0).length,
    waitReasons,
    primaryWaitReason: waiting[0]?.waitReason ?? null,
    nextActions: Array.from(new Set(waiting.map((slot) => cleanString(slot.nextAction)).filter(Boolean))),
    providerWaitCount: mockExamPaperProviderWaitCount(annotated),
    candidateAttemptCount: annotated.reduce((sum, slot) => sum + Math.max(0, Number(slot.candidateAttemptCount ?? 0) || 0), 0)
  };
}

function mockExamSlotHasLegacyStrategyBlock(value: unknown) {
  return generationSlotIssues(value).some((item) => cleanString(item).includes('target_profile_strategy_blocked'));
}

function mockExamClosedLoopReplanAttempt(value: unknown) {
  const profile = recordFrom(value) ?? {};
  const closedLoop = recordFrom(profile.closedLoop) ?? {};
  const strategy = recordFrom(profile.generationStrategy) ?? {};
  return Math.max(0, Number(closedLoop.replanAttempt ?? strategy.replanAttempt ?? 0) || 0);
}

function mockExamRefreshRuntimeTargetProfile(value: unknown, slotNumber: number) {
  const profile = recordFrom(value) ?? {};
  const strategy = recordFrom(profile.generationStrategy) ?? {};
  const source = cleanString(strategy.source, profile.closedLoop ? 'closed_loop_replan' : 'normalized_target_profile');
  const replanAttempt = mockExamClosedLoopReplanAttempt(profile);
  const normalized = normalizeMockExamTargetProfile(profile, {
    slotNumber,
    strategySource: source,
    ...(replanAttempt > 0 ? { replanAttempt } : {}),
    ...(cleanString(strategy.replanReason) ? { replanReason: cleanString(strategy.replanReason) } : {})
  });
  return {
    ...normalized,
    ...(profile.closedLoop ? { closedLoop: profile.closedLoop } : {})
  };
}

function generationSlotResultFromBlueprintSlot(blueprint: ReturnType<typeof mapMockExamBlueprint>, slot: AdminMockExamBlueprintDetailSlot): MockExamGenerationSlotResult {
  return {
    slotId: slot.id,
    slotNumber: slot.slotNumber,
    aiBlueprintId: null,
    aiGenerationJobId: null,
    candidateQuestionId: null,
    status: 'queued',
    issues: [],
    topicIds: slot.topicIds,
    targetProfile: mockExamSlotTargetProfile(blueprint, slot)
  };
}

function slugPart(value: unknown) {
  return cleanString(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function optionalStringList(value: unknown, fallback: string[] = []) {
  if (value === undefined) return fallback;
  if (Array.isArray(value)) return value.map((item) => cleanString(item)).filter(Boolean).slice(0, 12);
  if (typeof value === 'string') return value.split(/[，,\n]/).map((item) => item.trim()).filter(Boolean).slice(0, 12);
  throw new BadRequestException('题位提示列表格式不正确。');
}

function expectedVersionFrom(input: unknown) {
  if (!input || typeof input !== 'object' || !('expectedVersion' in input)) return undefined;
  const value = Number((input as { expectedVersion?: unknown }).expectedVersion);
  if (!Number.isInteger(value) || value < 1) throw new BadRequestException('版本号不正确，请刷新后再试。');
  return value;
}

function assertVersion(currentVersion: number, expectedVersion: number | undefined, label: string) {
  if (expectedVersion !== undefined && expectedVersion !== currentVersion) {
    throw new ConflictException({ message: `${label} 已被其他管理员更新，请刷新后再继续。`, code: 'VERSION_CONFLICT', currentVersion });
  }
}

function versionConflict(label: string, currentVersion: number) {
  return new ConflictException({ message: `${label} 已被其他管理员更新，请刷新后再继续。`, code: 'VERSION_CONFLICT', currentVersion });
}

function attemptMeta(attempt: DbAttempt, paper: DbPaper, locale: PublicLocale = 'zh-CN') {
  const dueAt = new Date(attempt.startedAt.getTime() + paper.durationMinutes * 60_000);
  return {
    id: attempt.id,
    paper: paperSummary(paper, locale),
    language: attempt.language,
    startedAt: attempt.startedAt.toISOString(),
    dueAt: dueAt.toISOString(),
    submittedAt: attempt.submittedAt?.toISOString() ?? null,
    answers: attempt.answers,
    markedQuestions: attempt.markedQuestions,
    timeSpent: attempt.timeSpent,
    currentQuestion: attempt.currentQuestion,
    version: attempt.version
  };
}

function validatePaperPayload(rawPaper: AdminImportPaper, index = 0) {
  const errors: string[] = [];
  const subject = cleanString(rawPaper.subject);
  if (!SUBJECTS.some((item) => item.id === subject)) errors.push(`第 ${index + 1} 套卷 subject 必须是 math / physics / chemistry。`);
  const slug = cleanString(rawPaper.slug);
  if (!/^[a-z0-9-]{3,120}$/.test(slug)) errors.push(`第 ${index + 1} 套卷 slug 只能使用小写字母、数字和短横线。`);
  const title = cleanString(rawPaper.title);
  if (!title) errors.push(`第 ${index + 1} 套卷 title 不能为空。`);
  const questionCount = cleanPositive(rawPaper.questionCount, 48);
  const durationMinutes = cleanPositive(rawPaper.durationMinutes, 60);
  const status = cleanStatus(rawPaper.status, 'draft');
  const questions = Array.isArray(rawPaper.questions) ? rawPaper.questions : [];
  const normalizedQuestions = questions.map((question, questionIndex) => validateQuestionPayload(question, questionIndex, errors));
  if (status === 'published') validatePublishable(questionCount, normalizedQuestions, errors, `第 ${index + 1} 套卷`);
  return {
    paper: {
      subject,
      slug,
      title,
      description: cleanString(rawPaper.description) || null,
      language: cleanString(rawPaper.language, 'zh') || 'zh',
      questionCount,
      durationMinutes,
      priceLabel: cleanString(rawPaper.priceLabel) || null,
      isFree: cleanBoolean(rawPaper.isFree, false),
      isLocked: cleanBoolean(rawPaper.isLocked, true),
      sortOrder: Number.isInteger(Number(rawPaper.sortOrder)) ? Number(rawPaper.sortOrder) : 0,
      status
    },
    questions: normalizedQuestions,
    errors
  };
}

function validateQuestionPayload(rawQuestion: AdminImportQuestion, index = 0, errors: string[] = []) {
  const prefix = `第 ${index + 1} 题`;
  const orderNumber = cleanPositive(rawQuestion.orderNumber, index + 1);
  const questionType = cleanString(rawQuestion.questionType, 'single-choice');
  if (!QUESTION_TYPES.includes(questionType as never)) errors.push(`${prefix} 题型目前只支持 single-choice。`);
  const prompt = cleanString(rawQuestion.prompt);
  if (!prompt) errors.push(`${prefix} 题干不能为空。`);
  const options = optionsFromJson(rawQuestion.options);
  if (options.length !== 4 || OPTION_IDS.some((id) => !options.some((option) => option.id === id && option.text.trim()))) {
    errors.push(`${prefix} 必须包含 A-D 四个非空选项。`);
  }
  const correctAnswer = cleanString(rawQuestion.correctAnswer);
  if (!OPTION_IDS.includes(correctAnswer)) errors.push(`${prefix} 正确答案必须是 A-D。`);
  const explanation = cleanString(rawQuestion.explanation);
  if (!explanation) errors.push(`${prefix} 解析不能为空。`);
  const knowledgeTags = tagsFromJson(rawQuestion.knowledgeTags);
  if (!knowledgeTags.length) errors.push(`${prefix} 知识点标签不能为空。`);
  return {
    orderNumber,
    questionType,
    prompt,
    options: OPTION_IDS.map((id) => options.find((option) => option.id === id) ?? { id, text: '' }),
    correctAnswer,
    explanation,
    knowledgeTags,
    status: cleanStatus(rawQuestion.status, 'draft')
  };
}

function validatePublishable(questionCount: number, questions: Array<ReturnType<typeof validateQuestionPayload>>, errors: string[], label = '套卷') {
  const published = questions.filter((question) => question.status === 'published');
  if (published.length !== questionCount) errors.push(`${label} 发布需要 ${questionCount} 道 published 题，当前 ${published.length} 道。`);
  const orders = new Set<number>();
  for (const question of published) {
    if (orders.has(question.orderNumber)) errors.push(`${label} 题号 ${question.orderNumber} 重复。`);
    orders.add(question.orderNumber);
  }
  for (let order = 1; order <= questionCount; order += 1) {
    if (!orders.has(order)) errors.push(`${label} 缺少 published 第 ${order} 题。`);
  }
}

@Injectable()
export class CscaMockExamService implements OnModuleInit {
  private readonly logger = new Logger(CscaMockExamService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly planner: MockExamPlannerService,
    private readonly masteryBridge: MockExamMasteryBridgeService,
    private readonly cscaLearningService: CscaLearningService,
    private readonly aiQuestioningService: AIQuestioningService,
    private readonly learningFeatureFlags: LearningIntelligenceFeatureFlagsService,
    @Inject(LEARNING_EVIDENCE_WRITER) private readonly learningEvidenceWriter: LearningEvidenceWriter
  ) {}

  onModuleInit() {
    if (!process.env.DATABASE_URL) return;
    if (process.env.CSCA_MOCK_EXAM_GENERATION_RECOVERY_DISABLED === 'true') return;
    setTimeout(() => {
      void this.recoverStaleMockExamGenerationJobs('startup');
    }, 1000);
    const staleMs = intInRange(
      process.env.CSCA_MOCK_EXAM_GENERATION_STALE_RUNNING_MS,
      DEFAULT_MOCK_EXAM_GENERATION_STALE_RUNNING_MS,
      30 * 1000,
      24 * 60 * 60 * 1000
    );
    setTimeout(() => {
      void this.recoverStaleMockExamGenerationJobs('startup');
    }, staleMs + 5000);
  }

  private async recoverStaleMockExamGenerationJobs(trigger: 'startup' | 'manual') {
    const staleMs = intInRange(
      process.env.CSCA_MOCK_EXAM_GENERATION_STALE_RUNNING_MS,
      DEFAULT_MOCK_EXAM_GENERATION_STALE_RUNNING_MS,
      30 * 1000,
      24 * 60 * 60 * 1000
    );
    const limit = intInRange(process.env.CSCA_MOCK_EXAM_GENERATION_RECOVERY_LIMIT, 5, 1, 20);
    const staleBefore = new Date(Date.now() - staleMs);
    const rows = await this.prisma.$queryRaw<MockExamGenerationJobRow[]>(Prisma.sql`
      SELECT "id", "blueprint_id" AS "blueprintId", "target_paper_id" AS "targetPaperId",
             "status", "provider", "model", "requested_slot_numbers" AS "requestedSlotNumbers",
             "slot_results" AS "slotResults", "error", "created_by" AS "createdBy",
             "started_at" AS "startedAt", "completed_at" AS "completedAt",
             "created_at" AS "createdAt", "updated_at" AS "updatedAt"
      FROM "mock_exam_generation_jobs"
      WHERE "status" = 'running'
        AND "updated_at" < ${staleBefore}
      ORDER BY "updated_at" ASC, "id" ASC
      LIMIT ${limit}
    `);
    if (!rows.length) return { recovered: 0, resumed: 0 };
    let recovered = 0;
    let resumed = 0;
    const autoResume = process.env.CSCA_MOCK_EXAM_GENERATION_RECOVERY_AUTO_RESUME !== 'false';
    for (const row of rows) {
      const slotResults = slotResultsFromJson(row.slotResults).map((slot) => {
        if (slot.status !== 'running') return slot;
        return {
          ...slot,
          status: 'queued',
          issues: Array.from(new Set([
            ...generationSlotIssues(slot.issues),
            'stale_running_recovered'
          ]))
        };
      });
      const recoveredStatus = autoResume ? 'queued' : 'failed';
      const updated = await this.prisma.$executeRaw(Prisma.sql`
        UPDATE "mock_exam_generation_jobs"
        SET "status" = ${recoveredStatus},
            "slot_results" = CAST(${JSON.stringify(slotResults)} AS jsonb),
            "error" = ${`运行中断，已在 ${trigger} 标记为需要继续处理；${autoResume ? '系统将继续自动补齐。' : '不会自动唤醒旧任务，请在当前卷内手动继续。'}${row.error ? ` 上次状态：${row.error}` : ''}`},
            "completed_at" = ${autoResume ? Prisma.sql`NULL` : Prisma.sql`CURRENT_TIMESTAMP`},
            "updated_at" = CURRENT_TIMESTAMP
        WHERE "id" = ${row.id}
          AND "status" = 'running'
          AND "updated_at" < ${staleBefore}
      `);
      if (updated <= 0) continue;
      recovered += 1;
      if (autoResume && row.createdBy) {
        this.requeueAdminGenerationJobInBackground(row.id, row.createdBy);
        resumed += 1;
      }
    }
    this.logger.log(`Recovered ${recovered} stale mock exam generation job(s) on ${trigger}; resumed ${resumed}.`);
    return { recovered, resumed };
  }

  private async appliedSyllabusVersionForSubject(subject: string) {
    const rows = await this.prisma.$queryRaw<Array<{ syllabusVersion: string }>>(Prisma.sql`
      SELECT i."syllabus_version" AS "syllabusVersion"
      FROM "csca_syllabus_imports" i
      LEFT JOIN "csca_exam_topics" t
        ON t."subject" = i."subject"
       AND t."syllabus_version" = i."syllabus_version"
       AND t."status" = 'published'
      WHERE i."subject" = ${subject}
        AND i."status" = 'applied'
      GROUP BY i."syllabus_version"
      ORDER BY COUNT(t."id") DESC, MAX(i."applied_at") DESC NULLS LAST, MAX(i."created_at") DESC
      LIMIT 1
    `);
    return rows[0]?.syllabusVersion ?? null;
  }

  private async normalizeMappingsToAppliedSyllabus(subject: string, mappings: MockExamTopicMappingForReport[]) {
    if (!mappings.length) return mappings;
    const appliedVersion = await this.appliedSyllabusVersionForSubject(subject);
    if (!appliedVersion) return mappings;
    const currentTopics = await this.prisma.cscaExamTopic.findMany({
      where: { subject, syllabusVersion: appliedVersion, status: 'published' },
      select: { id: true, code: true, title: true, module: true, syllabusVersion: true }
    });
    if (!currentTopics.length) return mappings;

    const byTitle = new Map(currentTopics.map((topic) => [normalizedTopicTitle(topic.title), topic]));
    const byModule = new Map<string, typeof currentTopics[number]>();
    const byLooseTitle = new Map<string, typeof currentTopics[number]>();
    currentTopics.forEach((topic) => {
      const module = normalizedTopicTitle(topic.module);
      if (module && !byModule.has(module)) byModule.set(module, topic);
      const title = normalizedTopicTitle(topic.title)
        .replace(/判断$/, '')
        .replace(/方法$/, '')
        .replace(/应用$/, '')
        .replace(/计算$/, '');
      if (title && !byLooseTitle.has(title)) byLooseTitle.set(title, topic);
    });

    return mappings.map((mapping) => {
      if (mapping.topic.syllabusVersion === appliedVersion) return mapping;
      const sourceTitle = normalizedTopicTitle(mapping.topic.title);
      const sourceLooseTitle = sourceTitle
        .replace(/判断$/, '')
        .replace(/方法$/, '')
        .replace(/应用$/, '')
        .replace(/计算$/, '');
      const sourceModule = normalizedTopicTitle(mapping.topic.module);
      const target = byTitle.get(sourceTitle)
        ?? byLooseTitle.get(sourceLooseTitle)
        ?? currentTopics.find((topic) => {
          const targetTitle = normalizedTopicTitle(topic.title);
          return Boolean(sourceTitle && targetTitle && (sourceTitle.includes(targetTitle) || targetTitle.includes(sourceTitle)));
        })
        ?? byModule.get(sourceModule);
      if (!target) return mapping;
      return {
        ...mapping,
        topic: {
          id: target.id,
          code: target.code,
          title: target.title,
          module: target.module,
          syllabusVersion: target.syllabusVersion
        }
      };
    });
  }

  async getOverview(localeInput?: string) {
    const locale = normalizeLocale(localeInput);
    let papers: PaperLike[] = FALLBACK_PAPERS;
    try {
      papers = await this.prisma.mockExamPaper.findMany({
        where: { status: 'published' },
        orderBy: [{ subject: 'asc' }, { sortOrder: 'asc' }, { id: 'asc' }]
      });
    } catch {
      papers = FALLBACK_PAPERS;
    }
    const subjectCards = SUBJECTS.map((subject) => {
      const subjectPapers = papers.filter((paper) => paper.subject === subject.id);
      const freePaper = subjectPapers.find((paper) => paper.isFree) ?? subjectPapers[0];
      return {
        ...localizedSubject(subject, locale),
        paperCount: subjectPapers.length,
        freeSlug: freePaper?.slug ?? null,
        questionCount: freePaper?.questionCount ?? 48,
        durationMinutes: freePaper?.durationMinutes ?? 60
      };
    });

    return {
      examDate: '2026-06-27',
      countdownLabel: locale === 'en' ? 'Next exam: June 27, 2026' : '距离下次考试 2026年6月27日',
      subjectCards,
      stats: locale === 'en'
        ? [
            { value: '95%', label: 'Target alignment', detail: 'Practice with the real exam structure' },
            { value: '35/48', label: 'Question-type match', detail: 'Review weak areas with more focus' },
            { value: '3×', label: 'Three subjects', detail: 'Math / Physics / Chemistry' }
          ]
        : [
            { value: '95%', label: '目标命中率', detail: '按真实题型结构训练' },
            { value: '35/48', label: '同类题型吻合', detail: '错题回顾更聚焦' },
            { value: '3×', label: '三科覆盖', detail: '数学 / 物理 / 化学' }
          ],
      features: locale === 'en'
        ? ['Timed answering', 'Question navigation', 'Review marking', 'Instant report', 'Knowledge tagging', 'Answer explanations']
        : ['限时作答', '题号导航', '标记复查', '即时报告', '知识点归因', '错题解析']
    };
  }

  async listSubjectPapers(subjectInput: string, localeInput?: string, userId?: number) {
    const locale = normalizeLocale(localeInput);
    const subject = assertSubject(subjectInput);
    let papers: PaperLike[] = FALLBACK_PAPERS.filter((paper) => paper.subject === subject);
    try {
      papers = await this.prisma.mockExamPaper.findMany({
        where: { subject, status: 'published' },
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }]
      });
    } catch {
      papers = FALLBACK_PAPERS.filter((paper) => paper.subject === subject);
    }
    let pastPapers: Array<Parameters<typeof pastPaperSummary>[0]> = [];
    try {
      pastPapers = await this.prisma.pastPaper.findMany({
        where: { subject, category: 'past-paper', isPublished: true, deletedAt: null },
        include: { files: true },
        orderBy: [{ isFeatured: 'desc' }, { sortOrder: 'asc' }, { id: 'asc' }],
        take: 3
      });
    } catch {
      pastPapers = [];
    }
    const subjectMeta = SUBJECTS.find((item) => item.id === subject)!;
    const publicSubject = localizedSubject(subjectMeta, locale);
    const publicPapers = papers.map((paper) => paperSummary(paper, locale));
    const recommendation = await this.planner.recommendNextPaper(userId, subject, publicSubject.title, publicPapers).catch(() => null);
    return {
      subject: publicSubject,
      papers: publicPapers,
      pastPapers: pastPapers.map((paper) => pastPaperSummary(paper, locale)),
      recommendation,
      bundle: {
        title: locale === 'en' ? `${publicSubject.title} mock papers` : `${subjectMeta.title}模拟卷`,
        priceLabel: locale === 'en' ? 'Free' : '免费',
        description: locale === 'en'
          ? 'All published mock papers are currently free to start.'
          : '当前全部发布套卷免费开放，可直接进入模考。'
      }
    };
  }

  async getPaperStart(slug: string, localeInput?: string) {
    const locale = normalizeLocale(localeInput);
    const paper = await this.findPaper(slug);
    return {
      paper: paperSummary(paper, locale),
      locked: false,
      rules: locale === 'en'
        ? ['The timer starts after you begin.', 'After submission, you can view your score, wrong answers, and explanations.', 'This is original simulated practice and does not represent official exam content.']
        : ['开始后按倒计时作答。', '提交后可查看分数、错题和解析。', '本套为原创仿真模拟练习，不代表官方考试内容。']
    };
  }

  async createAttempt(slug: string, userId?: number, input: MockExamAttemptCreatePayload = {}) {
    const paper = await this.findPaper(slug);
    const questions = await this.listPaperQuestions(paper.id);
    if (!questions.length) throw new BadRequestException('这套模考卷暂时没有可用题目。');
    const examLanguage = normalizeExamLanguage(input.language);
    const attempt = await this.prisma.mockExamAttempt.create({
      data: {
        userId,
        paperId: paper.id,
        language: examLanguageCode(examLanguage),
        answers: {},
        questionSnapshot: questions.map((question) => questionSnapshot(question, examLanguage)) as Prisma.InputJsonValue,
        markedQuestions: [],
        timeSpent: {},
        currentQuestion: 1
      }
    });
    return attemptMeta(attempt, paper, examLanguage);
  }

  async listMyAttempts(userId: number) {
    const attempts = await this.prisma.mockExamAttempt.findMany({
      where: { userId },
      include: { paper: true },
      orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
      take: 20
    });
    return {
      items: attempts.map((attempt) => ({
        id: attempt.id,
        paper: paperSummary(attempt.paper),
        score: attempt.score,
        correctCount: attempt.correctCount,
        wrongCount: attempt.wrongCount,
        unansweredCount: attempt.unansweredCount,
        startedAt: attempt.startedAt.toISOString(),
        submittedAt: attempt.submittedAt?.toISOString() ?? null,
        attemptPath: `/csca-mock-exam/attempts/${attempt.id}`,
        reportPath: attempt.submittedAt ? `/csca-mock-exam/attempts/${attempt.id}/report` : null
      }))
    };
  }

  async getAttempt(idInput: string, userId: number, _localeInput?: string) {
    const attempt = await this.findAttempt(idInput, userId);
    const snapshot = questionsFromSnapshot(attempt.questionSnapshot);
    const attemptLocale = normalizeExamLanguage(attempt.language);
    const questions = snapshot.length ? snapshot : await this.listPaperQuestions(attempt.paperId);
    return {
      attempt: attemptMeta(attempt, attempt.paper, attemptLocale),
      questions: questions.map((question) => publicQuestion(question, attemptLocale))
    };
  }

  async patchAttempt(idInput: string, userId: number, payload: MockExamAttemptPatchPayload) {
    const id = this.parseAttemptId(idInput);
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${MOCK_ATTEMPT_LOCK_NAMESPACE}::int, ${id}::int)`;
      const attempt = await tx.mockExamAttempt.findFirst({ where: { id, userId }, include: { paper: true } });
      if (!attempt) throw new NotFoundException('模考记录不存在。');
      if (attempt.submittedAt) return attempt;
      if (payload.expectedVersion !== undefined && payload.expectedVersion !== attempt.version) {
        throw new ConflictException({ message: '模考记录已被其他操作更新，请刷新后再继续。', code: 'VERSION_CONFLICT', currentVersion: attempt.version });
      }
      const answers = payload.answers === undefined ? attempt.answers : recordStringMap(payload.answers, '答案格式不正确。');
      const markedQuestions = payload.markedQuestions === undefined ? attempt.markedQuestions : numberList(payload.markedQuestions);
      const timeSpent = payload.timeSpent === undefined ? attempt.timeSpent : numberMap(payload.timeSpent);
      const currentQuestion = payload.currentQuestion === undefined ? attempt.currentQuestion : assertPositiveInteger(payload.currentQuestion, '当前题号不正确。');
      return tx.mockExamAttempt.update({
        where: { id: attempt.id },
        data: {
          answers: answers as Prisma.InputJsonValue,
          markedQuestions: markedQuestions as Prisma.InputJsonValue,
          timeSpent: timeSpent as Prisma.InputJsonValue,
          currentQuestion,
          version: { increment: 1 }
        },
        include: { paper: true }
      });
    });
    return attemptMeta(updated, updated.paper);
  }

  async submitAttempt(idInput: string, userId: number) {
    const id = this.parseAttemptId(idInput);
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${MOCK_ATTEMPT_LOCK_NAMESPACE}::int, ${id}::int)`;
      const attempt = await tx.mockExamAttempt.findFirst({ where: { id, userId }, include: { paper: true } });
      if (!attempt) throw new NotFoundException('模考记录不存在。');
      if (attempt.submittedAt) return { submitted: attempt, questions: undefined, evidenceWrites: [] };
      const snapshot = questionsFromSnapshot(attempt.questionSnapshot);
      const questions = snapshot.length
        ? snapshot
        : await tx.mockExamQuestion.findMany({
            where: { paperId: attempt.paperId, status: 'published' },
            orderBy: [{ orderNumber: 'asc' }, { id: 'asc' }]
          });
      const answers = recordStringMap(attempt.answers, '答案格式不正确。');
      const submittedAt = new Date();
      let correctCount = 0;
      let wrongCount = 0;
      let unansweredCount = 0;
      const evidenceWrites: LearningEvidenceWriteResult[] = [];

      for (const question of questions) {
        const selected = answers[String(question.id)] ?? '';
        if (!selected) unansweredCount += 1;
        else if (selected === question.correctAnswer) correctCount += 1;
        else wrongCount += 1;
      }
      if (attempt.userId && this.learningFeatureFlags.isEnabled('evidenceWrite')) {
        const subject = attempt.paper.subject === 'math' || attempt.paper.subject === 'physics' || attempt.paper.subject === 'chemistry'
          ? attempt.paper.subject
          : null;
        if (subject) {
          const mappings = await tx.cscaTopicMapping.findMany({
            where: {
              sourceType: 'mock_exam_question',
              sourceId: { in: questions.map((question) => question.id) },
              topic: { subject, status: 'published' }
            },
            orderBy: [{ confidence: 'desc' }, { id: 'asc' }]
          });
          const primaryMapping = new Map<number, typeof mappings[number]>();
          for (const mapping of mappings) {
            if (!primaryMapping.has(mapping.sourceId)) primaryMapping.set(mapping.sourceId, mapping);
          }
          for (const question of questions) {
            const mapping = primaryMapping.get(question.id);
            if (!mapping) continue;
            const selected = answers[String(question.id)] ?? '';
            evidenceWrites.push(await this.learningEvidenceWriter.appendInTransaction(tx, mapTrustedQuestionEvidence({
              sourceType: 'mock_exam',
              sourceId: String(attempt.id),
              sessionId: String(attempt.id),
              userId: attempt.userId,
              subjectCode: subject,
              questionId: `mock_exam_question:${question.id}`,
              questionVersion: question.version,
              answerKeyVersion: `mock_exam_question:${question.id}:v${question.version}`,
              topicId: mapping.topicId,
              topicMappingVersion: `csca-topic-mapping:${mapping.id}:${mapping.updatedAt.toISOString()}`,
              scoringRubricVersion: 'mock-percent-v1',
              outcome: !selected ? 'skipped' : selected === question.correctAnswer ? 'correct' : 'incorrect',
              timeSpentSeconds: numberMap(attempt.timeSpent)[String(question.id)] ?? 0,
              questionQualityConfidence: Math.min(1, Math.max(0, mapping.confidence)),
              occurredAt: submittedAt,
              metadata: { paperId: attempt.paperId, paperVersion: attempt.paper.version }
            })));
          }
        }
      }
      const score = questions.length ? Math.round((correctCount / questions.length) * 100) : 0;
      const submitted = await tx.mockExamAttempt.update({
        where: { id: attempt.id },
        data: { score, correctCount, wrongCount, unansweredCount, submittedAt, version: { increment: 1 } },
        include: { paper: true }
      });
      return { submitted, questions, evidenceWrites };
    });
    if (result.questions) {
      await this.masteryBridge.updateFromSubmittedAttempt(result.submitted, result.questions);
      if (result.submitted.userId) {
        const timeSpent = numberMap(result.submitted.timeSpent);
        await this.cscaLearningService.recordLearningActivity({
          userId: result.submitted.userId,
          subject: result.submitted.paper.subject,
          source: 'mock_exam',
          answeredCount: (result.submitted.correctCount ?? 0) + (result.submitted.wrongCount ?? 0),
          correctCount: result.submitted.correctCount ?? 0,
          wrongCount: result.submitted.wrongCount ?? 0,
          unansweredCount: result.submitted.unansweredCount ?? 0,
          mockSeconds: Object.values(timeSpent).reduce((sum, value) => sum + value, 0)
        });
        const answers = recordStringMap(result.submitted.answers, '答案格式不正确。');
        const topicMappings = await this.prisma.cscaTopicMapping.findMany({
          where: {
            sourceType: 'mock_exam_question',
            sourceId: { in: result.questions.map((question) => question.id) },
            topic: { subject: result.submitted.paper.subject, status: 'published' }
          },
          orderBy: [{ confidence: 'desc' }, { id: 'asc' }]
        });
        const topicMap = new Map<number, number>();
        topicMappings.forEach((mapping) => {
          if (!topicMap.has(mapping.sourceId)) topicMap.set(mapping.sourceId, mapping.topicId);
        });
        await this.cscaLearningService.recordWrongPatterns({
          userId: result.submitted.userId,
          subject: result.submitted.paper.subject,
          source: 'mock_exam',
          items: result.questions.flatMap((question) => {
            const selected = answers[String(question.id)] ?? '';
            const isUnanswered = !selected;
            const isCorrect = Boolean(selected && selected === question.correctAnswer);
            if (isCorrect) return [];
            return [{
              questionId: question.id,
              topicId: topicMap.get(question.id) ?? null,
              selectedAnswer: selected || null,
              correctAnswer: question.correctAnswer,
              isUnanswered,
              knowledgeTags: tagsFromJson(question.knowledgeTags),
              secondsSpent: timeSpent[String(question.id)] ?? 0
            }];
          })
        });
        await this.cscaLearningService.recordWrongPatternCorrectEvidence({
          userId: result.submitted.userId,
          subject: result.submitted.paper.subject,
          items: result.questions.flatMap((question) => {
            const selected = answers[String(question.id)] ?? '';
            if (!selected || selected !== question.correctAnswer) return [];
            return [{
              questionId: question.id,
              topicId: topicMap.get(question.id) ?? null,
              knowledgeTags: tagsFromJson(question.knowledgeTags),
              secondsSpent: timeSpent[String(question.id)] ?? 0
            }];
          })
        });
      }
    }
    const report = await this.getReportByAttempt(result.submitted, result.questions, normalizeExamLanguage(result.submitted.language));
    const learningEvidence = learningEvidenceReceipt(result.evidenceWrites);
    return learningEvidence ? { ...report, learningEvidence } : report;
  }

  async getReport(idInput: string, userId: number, _localeInput?: string) {
    const attempt = await this.findAttempt(idInput, userId);
    return this.getReportByAttempt(attempt, undefined, normalizeExamLanguage(attempt.language));
  }

  async listAdminPapers() {
    const papers = await this.prisma.mockExamPaper.findMany({
      include: { _count: { select: { questions: true, attempts: true } } },
      orderBy: [{ subject: 'asc' }, { sortOrder: 'asc' }, { id: 'asc' }]
    });
    return {
      items: papers.map(adminPaperSummary),
      summary: {
        total: papers.length,
        published: papers.filter((paper) => paper.status === 'published').length,
        draft: papers.filter((paper) => paper.status === 'draft').length
      }
    };
  }

  async listAdminBlueprints(query: { subject?: string } = {}) {
    const subject = cleanString(query.subject);
    const rows = await this.prisma.$queryRaw<MockExamBlueprintRow[]>(Prisma.sql`
      SELECT "id", "subject", "title", "syllabus_version" AS "syllabusVersion",
             "source_profile_ids" AS "sourceProfileIds", "source_paper_id" AS "sourcePaperId",
             "question_count" AS "questionCount", "duration_minutes" AS "durationMinutes",
             "total_score" AS "totalScore", "status", "profile", "created_by" AS "createdBy",
             "version", "created_at" AS "createdAt", "updated_at" AS "updatedAt"
      FROM "mock_exam_blueprints"
      WHERE (${subject || null}::text IS NULL OR "subject" = ${subject || null})
      ORDER BY "updated_at" DESC, "id" DESC
      LIMIT 100
    `);
    return { items: rows.map(mapMockExamBlueprint) };
  }

  async getAdminBlueprint(idInput: string) {
    return this.findAdminBlueprintDetail(this.parseAdminId(idInput, '模考蓝图不存在。'));
  }

  async createAdminBlueprintFromPaper(paperIdInput: string, input: Record<string, unknown>, actorId: number) {
    const paper = await this.findAdminPaper(paperIdInput);
    const force = input.force === true;
    if (!force) {
      const existing = await this.findBlueprintsForPaper(paper.id, 1);
      if (existing[0]) {
        const { detail } = await this.ensureMockExamBlueprintHasStyleProfile(existing[0].id);
        return { created: false, ...detail };
      }
    }
    const syllabusVersion = cleanString(input.syllabusVersion) || await this.requiredAppliedSyllabusVersionForSubject(paper.subject);
    const styleProfile = await this.requiredStyleProfileForMockExam(paper.subject, syllabusVersion);
    const questions = await this.prisma.mockExamQuestion.findMany({
      where: { paperId: paper.id },
      orderBy: [{ orderNumber: 'asc' }, { id: 'asc' }]
    });
    if (!questions.length) throw new BadRequestException('当前套卷还没有题目，无法生成整卷蓝图。');
    const mappings = await this.prisma.cscaTopicMapping.findMany({
      where: {
        sourceType: 'mock_exam_question',
        sourceId: { in: questions.map((question) => question.id) },
        topic: { subject: paper.subject, status: 'published' }
      },
      select: {
          sourceId: true,
          confidence: true,
          topic: { select: { id: true, code: true, title: true, module: true, syllabusVersion: true } }
        },
      orderBy: [{ confidence: 'desc' }, { id: 'asc' }]
      });
    const normalizedMappings = await this.normalizeMappingsToAppliedSyllabus(paper.subject, mappings);
    const draft = buildMockExamBlueprintDraft(paper, questions, normalizedMappings, { ...input, syllabusVersion, styleProfile });
    draft.blueprint.sourceProfileIds = [styleProfile.id];
    (draft.blueprint.profile as Record<string, unknown>).sourceStyleProfile = this.mockExamStyleProfileReference(styleProfile);
    const created = await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<MockExamBlueprintRow[]>(Prisma.sql`
        INSERT INTO "mock_exam_blueprints" (
          "subject", "title", "syllabus_version", "source_profile_ids", "source_paper_id",
          "question_count", "duration_minutes", "total_score", "status", "profile", "created_by", "updated_at"
        )
        VALUES (
          ${draft.blueprint.subject}, ${draft.blueprint.title}, ${draft.blueprint.syllabusVersion},
          CAST(${JSON.stringify(draft.blueprint.sourceProfileIds)} AS jsonb), ${draft.blueprint.sourcePaperId},
          ${draft.blueprint.questionCount}, ${draft.blueprint.durationMinutes}, ${draft.blueprint.totalScore},
          ${draft.blueprint.status}, CAST(${JSON.stringify(draft.blueprint.profile)} AS jsonb), ${actorId}, CURRENT_TIMESTAMP
        )
        RETURNING "id", "subject", "title", "syllabus_version" AS "syllabusVersion",
                  "source_profile_ids" AS "sourceProfileIds", "source_paper_id" AS "sourcePaperId",
                  "question_count" AS "questionCount", "duration_minutes" AS "durationMinutes",
                  "total_score" AS "totalScore", "status", "profile", "created_by" AS "createdBy",
                  "version", "created_at" AS "createdAt", "updated_at" AS "updatedAt"
      `);
      const blueprint = rows[0];
      if (!blueprint) throw new BadRequestException('模考蓝图创建失败。');
      for (const slot of draft.slots) {
        await tx.$executeRaw(Prisma.sql`
          INSERT INTO "mock_exam_blueprint_slots" (
            "blueprint_id", "slot_number", "topic_ids", "module", "difficulty_band", "cognitive_skill",
            "reading_load", "calculation_load", "estimated_time_seconds", "generation_prompt_hints",
            "reviewer_checklist", "status", "updated_at"
          )
          VALUES (
            ${blueprint.id}, ${slot.slotNumber}, CAST(${JSON.stringify(slot.topicIds)} AS jsonb),
            ${slot.module}, ${slot.difficultyBand}, ${slot.cognitiveSkill}, ${slot.readingLoad},
            ${slot.calculationLoad}, ${slot.estimatedTimeSeconds}, CAST(${JSON.stringify(slot.generationPromptHints)} AS jsonb),
            CAST(${JSON.stringify(slot.reviewerChecklist)} AS jsonb), ${slot.status}, CURRENT_TIMESTAMP
          )
        `);
      }
      return blueprint;
    });
    await recordAdminAudit(this.prisma, {
      actorId,
      module: 'mock-exam',
      resourceType: 'mock_exam_blueprint',
      resourceId: String(created.id),
      action: 'create_from_paper',
      after: { blueprintId: created.id, sourcePaperId: paper.id, slotCount: draft.slots.length }
    });
    return { created: true, ...(await this.findAdminBlueprintDetail(created.id)) };
  }

  async updateAdminBlueprint(idInput: string, input: Record<string, unknown>, actorId: number) {
    const id = this.parseAdminId(idInput, '模考蓝图不存在。');
    const expectedVersion = expectedVersionFrom(input);
    const rows = await this.prisma.$queryRaw<MockExamBlueprintRow[]>(Prisma.sql`
      SELECT "id", "subject", "title", "syllabus_version" AS "syllabusVersion",
             "source_profile_ids" AS "sourceProfileIds", "source_paper_id" AS "sourcePaperId",
             "question_count" AS "questionCount", "duration_minutes" AS "durationMinutes",
             "total_score" AS "totalScore", "status", "profile", "created_by" AS "createdBy",
             "version", "created_at" AS "createdAt", "updated_at" AS "updatedAt"
      FROM "mock_exam_blueprints"
      WHERE "id" = ${id}
      LIMIT 1
    `);
    const existing = rows[0];
    if (!existing) throw new NotFoundException('模考蓝图不存在。');
    assertVersion(existing.version, expectedVersion, '模考蓝图');

    const requestedStatus = input.status === undefined ? existing.status : cleanString(input.status);
    if (!BLUEPRINT_STATUSES.includes(requestedStatus as never)) throw new BadRequestException('模考蓝图状态只能是 draft / active / archived。');
    const title = input.title === undefined ? existing.title : cleanString(input.title);
    if (!title) throw new BadRequestException('模考蓝图标题不能为空。');
    const syllabusVersion = input.syllabusVersion === undefined ? existing.syllabusVersion : cleanString(input.syllabusVersion, existing.syllabusVersion);
    const totalScore = input.totalScore === undefined ? existing.totalScore : cleanPositive(input.totalScore, existing.totalScore);
    const confirmationPatch = requestedStatus === 'active'
      ? {
          confirmation: {
            status: 'confirmed',
            confirmedAt: new Date().toISOString(),
            confirmedBy: actorId
          }
        }
      : {};

    if (requestedStatus === 'active') {
      await this.requiredStyleProfileForMockExam(existing.subject, syllabusVersion);
      const guardRows = await this.prisma.$queryRaw<Array<{ slotCount: number; blockedCount: number }>>(Prisma.sql`
        SELECT COUNT(*)::int AS "slotCount",
               COUNT(*) FILTER (WHERE "status" = 'blocked')::int AS "blockedCount"
        FROM "mock_exam_blueprint_slots"
        WHERE "blueprint_id" = ${id}
      `);
      const guard = guardRows[0] ?? { slotCount: 0, blockedCount: 0 };
      if (guard.slotCount < existing.questionCount) throw new BadRequestException(`蓝图需要 ${existing.questionCount} 个题位，当前只有 ${guard.slotCount} 个。`);
      if (guard.blockedCount > 0) throw new BadRequestException(`蓝图还有 ${guard.blockedCount} 个 blocked 题位，不能确认 active。`);
    }

    const updated = await this.prisma.$queryRaw<MockExamBlueprintRow[]>(Prisma.sql`
      UPDATE "mock_exam_blueprints"
      SET "title" = ${title},
          "syllabus_version" = ${syllabusVersion},
          "total_score" = ${totalScore},
          "status" = ${requestedStatus},
          "profile" = COALESCE("profile", '{}'::jsonb) || CAST(${JSON.stringify(confirmationPatch)} AS jsonb),
          "version" = "version" + 1,
          "updated_at" = CURRENT_TIMESTAMP
      WHERE "id" = ${id}
        AND "version" = ${existing.version}
      RETURNING "id", "subject", "title", "syllabus_version" AS "syllabusVersion",
                "source_profile_ids" AS "sourceProfileIds", "source_paper_id" AS "sourcePaperId",
                "question_count" AS "questionCount", "duration_minutes" AS "durationMinutes",
                "total_score" AS "totalScore", "status", "profile", "created_by" AS "createdBy",
                "version", "created_at" AS "createdAt", "updated_at" AS "updatedAt"
    `);
    if (!updated[0]) throw versionConflict('模考蓝图', existing.version);
    if (requestedStatus === 'active') {
      await this.prisma.$executeRaw(Prisma.sql`
        UPDATE "mock_exam_blueprint_slots"
        SET "status" = 'ready',
            "updated_at" = CURRENT_TIMESTAMP
        WHERE "blueprint_id" = ${id}
          AND "status" = 'draft'
          AND jsonb_array_length(COALESCE("topic_ids", '[]'::jsonb)) > 0
      `);
    }
    await recordAdminAudit(this.prisma, {
      actorId,
      module: 'mock-exam',
      resourceType: 'mock_exam_blueprint',
      resourceId: String(id),
      action: 'update',
      before: mapMockExamBlueprint(existing),
      after: mapMockExamBlueprint(updated[0])
    });
    return this.findAdminBlueprintDetail(id);
  }

  async updateAdminBlueprintSlot(idInput: string, input: Record<string, unknown>, actorId: number) {
    const id = this.parseAdminId(idInput, '模考蓝图题位不存在。');
    const rows = await this.prisma.$queryRaw<Array<MockExamBlueprintSlotRow & { blueprintStatus: string }>>(Prisma.sql`
      SELECT slot."id", slot."blueprint_id" AS "blueprintId", slot."slot_number" AS "slotNumber",
             slot."topic_ids" AS "topicIds", slot."module", slot."difficulty_band" AS "difficultyBand",
             slot."cognitive_skill" AS "cognitiveSkill", slot."reading_load" AS "readingLoad",
             slot."calculation_load" AS "calculationLoad", slot."estimated_time_seconds" AS "estimatedTimeSeconds",
             slot."generation_prompt_hints" AS "generationPromptHints", slot."reviewer_checklist" AS "reviewerChecklist",
             slot."status", slot."created_at" AS "createdAt", slot."updated_at" AS "updatedAt",
             blueprint."status" AS "blueprintStatus"
      FROM "mock_exam_blueprint_slots" slot
      JOIN "mock_exam_blueprints" blueprint ON blueprint."id" = slot."blueprint_id"
      WHERE slot."id" = ${id}
      LIMIT 1
    `);
    const existing = rows[0];
    if (!existing) throw new NotFoundException('模考蓝图题位不存在。');
    if (existing.blueprintStatus === 'archived') throw new BadRequestException('已归档蓝图不能继续编辑题位。');

    const allowedDifficulty = ['basic', 'medium', 'hard', 'unknown'];
    const allowedReading = ['low', 'medium', 'high', 'unknown'];
    const allowedCalculation = ['none', 'light', 'medium', 'heavy', 'unknown'];
    const difficultyBand = input.difficultyBand === undefined ? existing.difficultyBand : cleanString(input.difficultyBand, existing.difficultyBand);
    const readingLoad = input.readingLoad === undefined ? existing.readingLoad : cleanString(input.readingLoad, existing.readingLoad);
    const calculationLoad = input.calculationLoad === undefined ? existing.calculationLoad : cleanString(input.calculationLoad, existing.calculationLoad);
    if (!allowedDifficulty.includes(difficultyBand)) throw new BadRequestException('题位难度只能是 basic / medium / hard / unknown。');
    if (!allowedReading.includes(readingLoad)) throw new BadRequestException('题位阅读量只能是 low / medium / high / unknown。');
    if (!allowedCalculation.includes(calculationLoad)) throw new BadRequestException('题位计算量只能是 none / light / medium / heavy / unknown。');

    const status = input.status === undefined ? existing.status : cleanBlueprintSlotStatus(input.status, existing.status);
    const topicIds = optionalNumberList(input.topicIds, Array.isArray(existing.topicIds) ? existing.topicIds.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item > 0) : []);
    const module = input.module === undefined ? existing.module : cleanString(input.module) || null;
    const cognitiveSkill = input.cognitiveSkill === undefined ? existing.cognitiveSkill : cleanString(input.cognitiveSkill, existing.cognitiveSkill).slice(0, 80);
    const estimatedTimeSeconds = input.estimatedTimeSeconds === undefined ? existing.estimatedTimeSeconds : cleanPositive(input.estimatedTimeSeconds, existing.estimatedTimeSeconds);
    const generationPromptHints = optionalStringList(input.generationPromptHints, Array.isArray(existing.generationPromptHints) ? existing.generationPromptHints.map((item) => String(item)).filter(Boolean) : []);
    const reviewerChecklist = optionalStringList(input.reviewerChecklist, Array.isArray(existing.reviewerChecklist) ? existing.reviewerChecklist.map((item) => String(item)).filter(Boolean) : []);

    const updated = await this.prisma.$queryRaw<MockExamBlueprintSlotRow[]>(Prisma.sql`
      UPDATE "mock_exam_blueprint_slots"
      SET "topic_ids" = CAST(${JSON.stringify(topicIds)} AS jsonb),
          "module" = ${module},
          "difficulty_band" = ${difficultyBand},
          "cognitive_skill" = ${cognitiveSkill},
          "reading_load" = ${readingLoad},
          "calculation_load" = ${calculationLoad},
          "estimated_time_seconds" = ${estimatedTimeSeconds},
          "generation_prompt_hints" = CAST(${JSON.stringify(generationPromptHints)} AS jsonb),
          "reviewer_checklist" = CAST(${JSON.stringify(reviewerChecklist)} AS jsonb),
          "status" = ${status},
          "updated_at" = CURRENT_TIMESTAMP
      WHERE "id" = ${id}
      RETURNING "id", "blueprint_id" AS "blueprintId", "slot_number" AS "slotNumber",
                "topic_ids" AS "topicIds", "module", "difficulty_band" AS "difficultyBand",
                "cognitive_skill" AS "cognitiveSkill", "reading_load" AS "readingLoad",
                "calculation_load" AS "calculationLoad", "estimated_time_seconds" AS "estimatedTimeSeconds",
                "generation_prompt_hints" AS "generationPromptHints", "reviewer_checklist" AS "reviewerChecklist",
                "status", "created_at" AS "createdAt", "updated_at" AS "updatedAt"
    `);
    if (!updated[0]) throw new NotFoundException('模考蓝图题位不存在。');
    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "mock_exam_blueprints"
      SET "updated_at" = CURRENT_TIMESTAMP
      WHERE "id" = ${updated[0].blueprintId}
    `);
    await recordAdminAudit(this.prisma, {
      actorId,
      module: 'mock-exam',
      resourceType: 'mock_exam_blueprint_slot',
      resourceId: String(id),
      action: 'update',
      before: mapMockExamBlueprintSlot(existing),
      after: mapMockExamBlueprintSlot(updated[0])
    });
    return mapMockExamBlueprintSlot(updated[0]);
  }

  async createAdminGenerationJob(blueprintIdInput: string, input: Record<string, unknown>, actorId: number) {
    const blueprintId = this.parseAdminId(blueprintIdInput, '模考蓝图不存在。');
    let { detail, styleProfile } = await this.ensureMockExamBlueprintHasStyleProfile(blueprintId);
    const generationLineage = this.mockExamStyleProfileReference(styleProfile);
    if (detail.blueprint.status !== 'active') throw new BadRequestException('只有 active 蓝图可以创建模考生成任务。');
    const approvedSlotResults = await this.approvedSlotResultsForBlueprint(detail);
    if (this.mockExamApprovedPaperComplete(detail, approvedSlotResults)) {
      throw new BadRequestException(`这套在线模考题已经完成：${this.mockExamApprovedSlotCount(detail, approvedSlotResults)}/${detail.blueprint.questionCount} 个题位已通过门禁并进入题库，不能继续生成。`);
    }
    const activeJobs = detail.generationJobs.filter((job) => ['queued', 'running'].includes(job.status));
    if (activeJobs.length > 0) {
      throw new BadRequestException(`这套在线模考已有运行中的生成任务 #${activeJobs[0].id}，请等待完成后再处理缺口。`);
    }
    const promoted = await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "mock_exam_blueprint_slots"
      SET "status" = 'ready',
          "updated_at" = CURRENT_TIMESTAMP
      WHERE "blueprint_id" = ${blueprintId}
        AND "status" = 'draft'
        AND jsonb_array_length(COALESCE("topic_ids", '[]'::jsonb)) > 0
    `);
    if (promoted > 0) detail = await this.findAdminBlueprintDetail(blueprintId);
    const requestedSlotNumbers = optionalNumberList(input.slotNumbers, []);
    const slots = detail.slots.filter((slot) => {
      if (requestedSlotNumbers.length && !requestedSlotNumbers.includes(slot.slotNumber)) return false;
      return slot.status === 'ready' && !approvedSlotResults.has(slot.slotNumber);
    });
    if (!slots.length) throw new BadRequestException('没有可生成的 ready 题位；这套卷的可用题位可能已经完成。');
    const missingRequested = requestedSlotNumbers.filter((slotNumber) => !slots.some((slot) => slot.slotNumber === slotNumber));
    if (missingRequested.length) throw new BadRequestException(`以下题位不存在或不是 ready：${missingRequested.join('，')}`);
    const slotResults = slots.map((slot) => ({
      slotId: slot.id,
      slotNumber: slot.slotNumber,
      candidateQuestionId: null,
      status: 'queued',
      issues: [],
      topicIds: slot.topicIds,
      targetProfile: mockExamSlotTargetProfile(detail.blueprint, slot),
      generationLineage
    }));
    const requestedNumbers = slots.map((slot) => slot.slotNumber);
    const rows = await this.prisma.$queryRaw<MockExamGenerationJobRow[]>(Prisma.sql`
      INSERT INTO "mock_exam_generation_jobs" (
        "blueprint_id", "target_paper_id", "status", "provider", "model",
        "requested_slot_numbers", "slot_results", "created_by", "updated_at"
      )
      VALUES (
        ${detail.blueprint.id}, ${input.targetPaperId ? Number(input.targetPaperId) : null},
        'queued', ${cleanString(input.provider) || null}, ${cleanString(input.model) || null},
        CAST(${JSON.stringify(requestedNumbers)} AS jsonb),
        CAST(${JSON.stringify(slotResults)} AS jsonb),
        ${actorId}, CURRENT_TIMESTAMP
      )
      RETURNING "id", "blueprint_id" AS "blueprintId", "target_paper_id" AS "targetPaperId",
                "status", "provider", "model", "requested_slot_numbers" AS "requestedSlotNumbers",
                "slot_results" AS "slotResults", "error", "created_by" AS "createdBy",
                "started_at" AS "startedAt", "completed_at" AS "completedAt",
                "created_at" AS "createdAt", "updated_at" AS "updatedAt"
    `);
    const job = rows[0];
    if (!job) throw new BadRequestException('模考生成任务创建失败。');
    await recordAdminAudit(this.prisma, {
      actorId,
      module: 'mock-exam',
      resourceType: 'mock_exam_generation_job',
      resourceId: String(job.id),
      action: 'create',
      after: { blueprintId: detail.blueprint.id, requestedSlotNumbers: requestedNumbers, slotCount: slots.length }
    });
    if (input.autoProcess === true) {
      this.startAdminGenerationJobInBackground(job.id, actorId);
    }
    return mapMockExamGenerationJob(job);
  }

  private startAdminGenerationJobInBackground(jobId: number, actorId: number, force = false) {
    const run = () => this.processAdminGenerationJob(String(jobId), { force }, actorId).catch(async (error) => {
      const message = error instanceof Error ? error.message : String(error);
      if (mockExamIsRecoverableProviderFailure(message)) {
        const retryMessage = `provider_requeued: 后台生成遇到可恢复的 AI Provider/Schema 异常，已重新排队；系统会继续生成直到补齐。${message ? ` ${message}` : ''}`;
        await this.prisma.$executeRaw(Prisma.sql`
          UPDATE "mock_exam_generation_jobs"
          SET "status" = 'queued',
              "error" = ${retryMessage},
              "completed_at" = NULL,
              "updated_at" = CURRENT_TIMESTAMP
          WHERE "id" = ${jobId}
            AND "status" IN ('queued', 'running', 'failed')
        `);
        this.requeueAdminGenerationJobInBackground(jobId, actorId);
        return;
      }
      await this.prisma.$executeRaw(Prisma.sql`
        UPDATE "mock_exam_generation_jobs"
        SET "status" = 'failed',
            "error" = ${message},
            "completed_at" = CURRENT_TIMESTAMP,
            "updated_at" = CURRENT_TIMESTAMP
        WHERE "id" = ${jobId}
          AND "status" IN ('queued', 'running')
      `);
    });
    void run();
  }

  private requeueAdminGenerationJobInBackground(jobId: number, actorId: number) {
    setTimeout(() => {
      this.startAdminGenerationJobInBackground(jobId, actorId, true);
    }, MOCK_EXAM_AUTO_FILL_REQUEUE_DELAY_MS);
  }

  private async autoAssembleAndPublishMockExamPaper(jobId: number, actorId: number) {
    const assembled = await this.assembleAdminGenerationJobDraft(String(jobId), {
      description: 'AI 自动生成、自动审核、自动装配并自动发布的在线模考卷。'
    }, actorId);
    const paperId = Number(assembled.paper.id);
    if (!Number.isInteger(paperId) || paperId <= 0) {
      throw new BadRequestException('在线模考自动装配后未返回有效套卷 ID。');
    }
    const published = await this.publishAdminPaper(String(paperId), actorId, {
      expectedVersion: assembled.paper.version
    });
    await recordAdminAudit(this.prisma, {
      actorId,
      module: 'mock-exam',
      resourceType: 'mock_exam_generation_job',
      resourceId: String(jobId),
      action: 'auto_assemble_publish',
      after: {
        targetPaperId: published.id,
        status: published.status,
        title: published.title
      }
    });
    return { job: assembled.job, paper: published };
  }

  async startAdminGenerationJobBackground(idInput: string, input: Record<string, unknown>, actorId: number) {
    const id = this.parseAdminId(idInput, '模考生成任务不存在。');
    const existing = await this.findAdminGenerationJobRow(id);
    if (!existing) throw new NotFoundException('模考生成任务不存在。');
    const force = input.force === true || input.force === 'true';
    if (!['queued', 'failed'].includes(existing.status) && !force) {
      throw new BadRequestException('只有 queued/failed 任务可以后台处理；如需重跑请传 force=true。');
    }
    this.startAdminGenerationJobInBackground(existing.id, actorId, force);
    return mapMockExamGenerationJob(existing);
  }

  async listAdminGenerationJobs(query: { blueprintId?: string; status?: string } = {}) {
    const blueprintId = query.blueprintId ? this.parseAdminId(query.blueprintId, '模考蓝图不存在。') : null;
    const status = cleanString(query.status);
    const rows = await this.prisma.$queryRaw<MockExamGenerationJobRow[]>(Prisma.sql`
      SELECT "id", "blueprint_id" AS "blueprintId", "target_paper_id" AS "targetPaperId",
             "status", "provider", "model", "requested_slot_numbers" AS "requestedSlotNumbers",
             "slot_results" AS "slotResults", "error", "created_by" AS "createdBy",
             "started_at" AS "startedAt", "completed_at" AS "completedAt",
             "created_at" AS "createdAt", "updated_at" AS "updatedAt"
      FROM "mock_exam_generation_jobs"
      WHERE (${blueprintId}::int IS NULL OR "blueprint_id" = ${blueprintId})
        AND (${status || null}::text IS NULL OR "status" = ${status || null})
      ORDER BY "updated_at" DESC, "id" DESC
      LIMIT 50
    `);
    return { items: rows.map(mapMockExamGenerationJob) };
  }

  private async findAdminGenerationJobRow(id: number) {
    const rows = await this.prisma.$queryRaw<MockExamGenerationJobRow[]>(Prisma.sql`
      SELECT "id", "blueprint_id" AS "blueprintId", "target_paper_id" AS "targetPaperId",
             "status", "provider", "model", "requested_slot_numbers" AS "requestedSlotNumbers",
             "slot_results" AS "slotResults", "error", "created_by" AS "createdBy",
             "started_at" AS "startedAt", "completed_at" AS "completedAt",
             "created_at" AS "createdAt", "updated_at" AS "updatedAt"
      FROM "mock_exam_generation_jobs"
      WHERE "id" = ${id}
      LIMIT 1
    `);
    return rows[0] ?? null;
  }

  private mockExamGenerationCleanupIds(rows: MockExamGenerationJobRow[]) {
    const candidateQuestionIds = new Set<number>();
    const aiGenerationJobIds = new Set<number>();
    const aiBlueprintIds = new Set<number>();
    const targetPaperIds = new Set<number>();
    rows.forEach((row) => {
      if (row.targetPaperId) targetPaperIds.add(row.targetPaperId);
      slotResultsFromJson(row.slotResults).forEach((slot) => {
        const candidateQuestionId = Number(slot.candidateQuestionId);
        const aiGenerationJobId = Number(slot.aiGenerationJobId);
        const aiBlueprintId = Number(slot.aiBlueprintId);
        if (Number.isInteger(candidateQuestionId) && candidateQuestionId > 0) candidateQuestionIds.add(candidateQuestionId);
        if (Number.isInteger(aiGenerationJobId) && aiGenerationJobId > 0) aiGenerationJobIds.add(aiGenerationJobId);
        if (Number.isInteger(aiBlueprintId) && aiBlueprintId > 0) aiBlueprintIds.add(aiBlueprintId);
      });
    });
    return {
      candidateQuestionIds: Array.from(candidateQuestionIds),
      aiGenerationJobIds: Array.from(aiGenerationJobIds),
      aiBlueprintIds: Array.from(aiBlueprintIds),
      targetPaperIds: Array.from(targetPaperIds)
    };
  }

  private async assertMockExamCleanupSafe(rows: MockExamGenerationJobRow[]) {
    const { targetPaperIds } = this.mockExamGenerationCleanupIds(rows);
    if (!targetPaperIds.length) return [];
    const papers = await this.prisma.mockExamPaper.findMany({
      where: { id: { in: targetPaperIds } },
      include: { _count: { select: { attempts: true, questions: true } } }
    });
    const unsafe = papers.filter((paper) => paper.status === 'published' || paper._count.attempts > 0);
    if (unsafe.length) {
      throw new BadRequestException(`以下草稿卷已经发布或有作答记录，不能硬清理：${unsafe.map((paper) => `#${paper.id} ${paper.title}`).join('，')}。请先归档或人工处理。`);
    }
    return papers;
  }

  private async cleanupMockExamGenerationRows(rows: MockExamGenerationJobRow[], actorId: number, scope: 'single' | 'blueprint') {
    if (!rows.length) {
      return {
        scope,
        deleted: {
          mockGenerationJobs: 0,
          draftPapers: 0,
          draftQuestions: 0,
          aiGenerationJobs: 0,
          aiBlueprints: 0,
          candidateQuestions: 0,
          topicMappings: 0
        },
        ids: {
          mockGenerationJobIds: [],
          targetPaperIds: [],
          candidateQuestionIds: [],
          aiGenerationJobIds: [],
          aiBlueprintIds: []
        }
      };
    }
    const ids = this.mockExamGenerationCleanupIds(rows);
    const papers = await this.assertMockExamCleanupSafe(rows);
    const deleted = await this.prisma.$transaction(async (tx) => {
      const topicMappings = ids.candidateQuestionIds.length
        ? await tx.cscaTopicMapping.deleteMany({ where: { sourceType: 'ai', sourceId: { in: ids.candidateQuestionIds } } })
        : { count: 0 };
      const aiJobs = ids.aiGenerationJobIds.length
        ? await tx.cscaAiGenerationJob.deleteMany({ where: { id: { in: ids.aiGenerationJobIds } } })
        : { count: 0 };
      const candidateQuestions = ids.candidateQuestionIds.length
        ? await tx.cscaQuestion.deleteMany({ where: { id: { in: ids.candidateQuestionIds } } })
        : { count: 0 };
      const aiBlueprints = ids.aiBlueprintIds.length
        ? await tx.cscaQuestionBlueprint.deleteMany({
            where: {
              id: { in: ids.aiBlueprintIds },
              source: 'mock_exam_blueprint_slot'
            }
          })
        : { count: 0 };
      const draftQuestions = ids.targetPaperIds.length
        ? await tx.mockExamQuestion.deleteMany({ where: { paperId: { in: ids.targetPaperIds } } })
        : { count: 0 };
      const draftPapers = ids.targetPaperIds.length
        ? await tx.mockExamPaper.deleteMany({ where: { id: { in: ids.targetPaperIds } } })
        : { count: 0 };
      const mockGenerationJobs = await tx.mockExamGenerationJob.deleteMany({ where: { id: { in: rows.map((row) => row.id) } } });
      return {
        mockGenerationJobs: mockGenerationJobs.count,
        draftPapers: draftPapers.count,
        draftQuestions: draftQuestions.count,
        aiGenerationJobs: aiJobs.count,
        aiBlueprints: aiBlueprints.count,
        candidateQuestions: candidateQuestions.count,
        topicMappings: topicMappings.count
      };
    });
    await recordAdminAudit(this.prisma, {
      actorId,
      module: 'mock-exam',
      resourceType: scope === 'single' ? 'mock_exam_generation_job' : 'mock_exam_blueprint_generation_jobs',
      resourceId: scope === 'single' ? String(rows[0].id) : String(rows[0].blueprintId),
      action: 'cleanup_ai_generation',
      before: {
        jobs: rows.map(mapMockExamGenerationJob),
        papers: papers.map(adminPaperSummary)
      },
      after: { deleted, ids }
    });
    return {
      scope,
      deleted,
      ids: {
        mockGenerationJobIds: rows.map((row) => row.id),
        ...ids
      }
    };
  }

  async cleanupAdminGenerationJob(idInput: string, input: Record<string, unknown>, actorId: number) {
    const id = this.parseAdminId(idInput, '模考生成任务不存在。');
    const row = await this.findAdminGenerationJobRow(id);
    if (!row) throw new NotFoundException('模考生成任务不存在。');
    if (['queued', 'running'].includes(row.status) && input.force !== true) {
      throw new BadRequestException('该生成任务仍在排队或运行中。请停止后端后台任务后再清理，或传 force=true。');
    }
    return this.cleanupMockExamGenerationRows([row], actorId, 'single');
  }

  async cleanupAdminBlueprintGenerationJobs(idInput: string, input: Record<string, unknown>, actorId: number) {
    const blueprintId = this.parseAdminId(idInput, '模考蓝图不存在。');
    const rows = await this.prisma.$queryRaw<MockExamGenerationJobRow[]>(Prisma.sql`
      SELECT "id", "blueprint_id" AS "blueprintId", "target_paper_id" AS "targetPaperId",
             "status", "provider", "model", "requested_slot_numbers" AS "requestedSlotNumbers",
             "slot_results" AS "slotResults", "error", "created_by" AS "createdBy",
             "started_at" AS "startedAt", "completed_at" AS "completedAt",
             "created_at" AS "createdAt", "updated_at" AS "updatedAt"
      FROM "mock_exam_generation_jobs"
      WHERE "blueprint_id" = ${blueprintId}
      ORDER BY "updated_at" DESC, "id" DESC
    `);
    if (rows.some((row) => ['queued', 'running'].includes(row.status)) && input.force !== true) {
      throw new BadRequestException('当前蓝图下还有排队或运行中的生成任务。请停止后端后台任务后再清理，或传 force=true。');
    }
    return this.cleanupMockExamGenerationRows(rows, actorId, 'blueprint');
  }

  private async primaryTopicForGenerationSlot(subject: string, slot: AdminMockExamBlueprintDetailSlot) {
    const topicIds = optionalNumberList(slot.topicIds, []);
    if (!topicIds.length) return null;
    const rows = await this.prisma.$queryRaw<MockExamGenerationTopicRow[]>(Prisma.sql`
      SELECT "id", "subject", "code", "title", "module", "syllabus_version" AS "syllabusVersion",
             "exam_scope" AS "examScope", "status"
      FROM "csca_exam_topics"
      WHERE "id" IN (${Prisma.join(topicIds)})
        AND "subject" = ${subject}
        AND "status" = 'published'
      ORDER BY array_position(ARRAY[${Prisma.join(topicIds)}]::int[], "id"), "id" ASC
      LIMIT 1
    `);
    return rows[0] ?? null;
  }

  private async findOrCreateAISlotBlueprint(
    mockBlueprint: ReturnType<typeof mapMockExamBlueprint>,
    slot: AdminMockExamBlueprintDetailSlot,
    topic: MockExamGenerationTopicRow,
    targetProfileOverride?: unknown
  ) {
    const targetProfile = recordFrom(targetProfileOverride) ?? mockExamSlotTargetProfile(mockBlueprint, slot);
    const constraints = {
      mockExamSlot: {
        blueprintId: mockBlueprint.id,
        blueprintTitle: mockBlueprint.title,
        slotId: slot.id,
        slotNumber: slot.slotNumber,
        sourcePaperId: mockBlueprint.sourcePaperId,
        questionCount: mockBlueprint.questionCount,
        durationMinutes: mockBlueprint.durationMinutes,
        totalScore: mockBlueprint.totalScore
      },
      generationMode: 'online_mock_exam_candidate',
      generationSource: 'mock_exam_blueprint_slot',
      generationPromptHints: slot.generationPromptHints,
      reviewerChecklist: [
        ...slot.reviewerChecklist,
        '确认该题只作为在线模考候选题，审核通过前不得发布到正式模考卷。',
        '检查题位难度、阅读量、计算量和估时是否符合整卷蓝图。'
      ],
      targetProfile,
      syllabusScope: {
        subject: topic.subject,
        topicId: topic.id,
        topicCode: topic.code,
        topicTitle: topic.title,
        topicModule: topic.module,
        syllabusVersion: topic.syllabusVersion,
        examScope: topic.examScope
      },
      governance: {
        publishPolicy: 'candidate_review_required',
        formalMockPaperMutation: 'forbidden_until_reviewed',
        createdFrom: 'mock_exam_generation_job'
      }
    };
    const existing = await this.prisma.$queryRaw<Array<{ id: number }>>(Prisma.sql`
      SELECT "id"
      FROM "csca_question_blueprints"
      WHERE "source" = 'mock_exam_blueprint_slot'
        AND "status" = 'active'
        AND "subject" = ${mockBlueprint.subject}
        AND "topic_id" = ${topic.id}
        AND "constraints"->'mockExamSlot'->>'slotId' = ${String(slot.id)}
      ORDER BY "updated_at" DESC, "id" DESC
      LIMIT 1
    `);
    if (existing[0]?.id) {
      await this.prisma.$executeRaw(Prisma.sql`
        UPDATE "csca_question_blueprints"
        SET "difficulty" = ${aiDifficultyFromSlot(targetProfile.difficultyBand)},
            "skill" = ${targetProfile.cognitiveSkill || topic.title},
            "constraints" = CAST(${JSON.stringify(constraints)} AS jsonb),
            "updated_at" = CURRENT_TIMESTAMP
        WHERE "id" = ${existing[0].id}
      `);
      return existing[0].id;
    }
    const blueprint = await this.aiQuestioningService.createBlueprint({
      subject: mockBlueprint.subject,
      topicId: topic.id,
      difficulty: aiDifficultyFromSlot(targetProfile.difficultyBand),
      questionType: aiQuestionTypeFromMockSlot(),
      skill: targetProfile.cognitiveSkill || topic.title,
      source: 'mock_exam_blueprint_slot',
      constraints
    });
    return Number(blueprint.id);
  }

  private async latestAiGenerationJobForBlueprint(blueprintId: number) {
    const rows = await this.prisma.$queryRaw<Array<{ id: number; questionId: number | null; provider: string | null; model: string | null; status: string; error: string | null }>>(Prisma.sql`
      SELECT "id", "question_id" AS "questionId", "provider", "model", "status", "error"
      FROM "csca_ai_generation_jobs"
      WHERE "blueprint_id" = ${blueprintId}
      ORDER BY "created_at" DESC, "id" DESC
      LIMIT 1
    `);
    return rows[0] ?? null;
  }

  private async updateAISlotBlueprintRetryFeedback(blueprintId: number, repairFeedback: Record<string, unknown>) {
    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "csca_question_blueprints"
      SET "constraints" = jsonb_set(
            COALESCE("constraints", '{}'::jsonb),
            '{expansion}',
            COALESCE("constraints"->'expansion', '{}'::jsonb) || CAST(${JSON.stringify({
              generationMode: 'online_mock_exam_candidate',
              repairFeedback
            })} AS jsonb),
            true
          ),
          "updated_at" = CURRENT_TIMESTAMP
      WHERE "id" = ${blueprintId}
    `);
  }

  private async approvedSlotResultsForBlueprint(detail: Awaited<ReturnType<CscaMockExamService['ensureMockExamBlueprintHasStyleProfile']>>['detail']) {
    const slotById = new Map(detail.slots.map((slot) => [slot.id, slot]));
    const rows = await this.prisma.$queryRaw<MockExamApprovedSlotCandidateRow[]>(Prisma.sql`
      SELECT q."id",
             NULLIF(q."generation_metadata"->'mockExamSlot'->>'slotId', '')::int AS "slotId",
             NULLIF(q."generation_metadata"->'mockExamSlot'->>'slotNumber', '')::int AS "slotNumber",
             q."blueprint_id" AS "aiBlueprintId",
             q."topic_id" AS "topicId",
             q."generation_metadata" AS "generationMetadata",
             NULLIF(q."review_metadata"->'approvalGate'->>'checkedAt', '')::timestamp AS "approvedAt",
             q."updated_at" AS "updatedAt"
      FROM "csca_questions" q
      WHERE q."subject" = ${detail.blueprint.subject}
        AND q."status" = 'approved'
        AND q."review_metadata"->'approvalGate'->>'status' = 'passed'
        AND q."review_metadata"->'approvalGate'->>'source' = 'mock_exam_auto_gate'
        AND q."review_metadata"->'mockExamApproval'->>'status' IN ('approved_for_mock_exam_assembly', 'assembled_in_mock_exam_draft')
        AND COALESCE(q."generation_metadata"->'versionGovernance'->>'status', '') IN ('current', 'legacy_usable', 'manual_published')
        AND COALESCE(BTRIM(q."generation_metadata"->'localizations'->'zh'->>'prompt'), '') <> ''
        AND COALESCE(BTRIM(q."generation_metadata"->'localizations'->'zh'->>'explanation'), '') <> ''
        AND COALESCE(BTRIM(q."generation_metadata"->'localizations'->'en'->>'prompt'), '') <> ''
        AND COALESCE(BTRIM(q."generation_metadata"->'localizations'->'en'->>'explanation'), '') <> ''
        AND jsonb_array_length(COALESCE(q."generation_metadata"->'localizations'->'zh'->'options', '[]'::jsonb)) = 4
        AND jsonb_array_length(COALESCE(q."generation_metadata"->'localizations'->'en'->'options', '[]'::jsonb)) = 4
        AND jsonb_typeof(q."generation_metadata"->'mockExamSlot') = 'object'
        AND (
          q."generation_metadata"->>'sourceKind' = 'mock_exam_blueprint_slot'
          OR q."generation_metadata"->>'generationSource' = 'mock_exam_blueprint_slot'
          OR q."generation_metadata"->>'generationMode' LIKE 'online_mock%'
        )
        AND q."generation_metadata"->'mockExamSlot'->>'blueprintId' = ${String(detail.blueprint.id)}
      ORDER BY COALESCE(NULLIF(q."review_metadata"->'approvalGate'->>'checkedAt', '')::timestamp, q."updated_at") DESC,
               q."id" DESC
    `);
    const resultBySlotNumber = new Map<number, MockExamGenerationSlotResult>();
    const currentLineageReference = recordFrom(detail.blueprint.profile)?.sourceStyleProfile;
    for (const row of rows) {
      if (!mockExamCandidateMatchesCurrentLineage(row.generationMetadata, currentLineageReference)) continue;
      const slot = row.slotId ? slotById.get(row.slotId) : null;
      const slotNumber = slot?.slotNumber ?? row.slotNumber ?? null;
      if (!slot || !slotNumber || resultBySlotNumber.has(slotNumber)) continue;
      resultBySlotNumber.set(slotNumber, {
        slotId: slot.id,
        slotNumber,
        aiBlueprintId: row.aiBlueprintId,
        aiGenerationJobId: null,
        candidateQuestionId: row.id,
        status: 'approved',
        issues: [],
        topicIds: [row.topicId],
        targetProfile: mockExamSlotTargetProfile(detail.blueprint, slot)
      });
    }
    return resultBySlotNumber;
  }

  private async promoteExistingPublishableCandidateForSlot(
    detail: Awaited<ReturnType<CscaMockExamService['ensureMockExamBlueprintHasStyleProfile']>>['detail'],
    slot: AdminMockExamBlueprintDetailSlot,
    targetProfile: unknown
  ) {
    const targetAnswer = normalizeMockExamAnswerTarget(recordFrom(targetProfile)?.targetAnswer);
    const rows = await this.prisma.$queryRaw<MockExamPromotableSlotCandidateRow[]>(Prisma.sql`
      SELECT q."id",
             q."blueprint_id" AS "aiBlueprintId",
             q."topic_id" AS "topicId",
             q."generation_metadata" AS "generationMetadata"
      FROM "csca_questions" q
      JOIN "csca_exam_topics" t ON t."id" = q."topic_id"
      WHERE q."subject" = ${detail.blueprint.subject}
        AND q."status" IN ('pending_review', 'review_failed', 'draft', 'approved')
        AND t."status" = 'published'
        AND q."review_metadata"->'gate'->>'decision' IN ('publishable', 'manual_override_publishable')
        AND COALESCE(q."generation_metadata"->'versionGovernance'->>'status', '') IN ('current', 'legacy_usable', 'manual_published')
        AND COALESCE(q."generation_metadata"->>'fallbackUsed', 'false') <> 'true'
        AND COALESCE(q."generation_metadata"->>'generator', '') <> 'rule-fallback'
        AND COALESCE(q."generation_metadata"->>'status', '') <> 'generator_disabled'
        AND (${targetAnswer}::text IS NULL OR q."correct_answer" = ${targetAnswer})
        AND COALESCE(BTRIM(q."generation_metadata"->'localizations'->'zh'->>'prompt'), '') <> ''
        AND COALESCE(BTRIM(q."generation_metadata"->'localizations'->'zh'->>'explanation'), '') <> ''
        AND COALESCE(BTRIM(q."generation_metadata"->'localizations'->'en'->>'prompt'), '') <> ''
        AND COALESCE(BTRIM(q."generation_metadata"->'localizations'->'en'->>'explanation'), '') <> ''
        AND jsonb_array_length(COALESCE(q."generation_metadata"->'localizations'->'zh'->'options', '[]'::jsonb)) = 4
        AND jsonb_array_length(COALESCE(q."generation_metadata"->'localizations'->'en'->'options', '[]'::jsonb)) = 4
        AND jsonb_typeof(q."generation_metadata"->'mockExamSlot') = 'object'
        AND (
          q."generation_metadata"->>'sourceKind' = 'mock_exam_blueprint_slot'
          OR q."generation_metadata"->>'generationSource' = 'mock_exam_blueprint_slot'
          OR q."generation_metadata"->>'generationMode' LIKE 'online_mock%'
        )
        AND q."generation_metadata"->'mockExamSlot'->>'blueprintId' = ${String(detail.blueprint.id)}
        AND (
          q."generation_metadata"->'mockExamSlot'->>'slotId' = ${String(slot.id)}
          OR (
            COALESCE(q."generation_metadata"->'mockExamSlot'->>'slotId', '') = ''
            AND q."generation_metadata"->'mockExamSlot'->>'slotNumber' = ${String(slot.slotNumber)}
          )
        )
      ORDER BY
        CASE q."review_metadata"->'profileAlignment'->>'status'
          WHEN 'passed' THEN 0
          WHEN 'warning' THEN 1
          ELSE 2
        END,
        COALESCE((q."review_metadata"->>'score')::int, 0) DESC,
        q."updated_at" DESC,
        q."id" DESC
      LIMIT 1
    `);
    const currentLineageReference = recordFrom(detail.blueprint.profile)?.sourceStyleProfile;
    const candidate = rows.find((row) => mockExamCandidateMatchesCurrentLineage(row.generationMetadata, currentLineageReference));
    if (!candidate) return null;
    const approval = await this.approveMockExamCandidateIfGatePassed(
      candidate.id,
      mockExamApprovalSlotContext(detail.blueprint, slot)
    );
    if (!approval.approved) return null;
    return {
      slotId: slot.id,
      slotNumber: slot.slotNumber,
      aiBlueprintId: candidate.aiBlueprintId,
      aiGenerationJobId: null,
      candidateQuestionId: candidate.id,
      status: 'approved',
      issues: [],
      topicIds: [candidate.topicId],
      targetProfile
    } satisfies MockExamGenerationSlotResult;
  }

  private mockExamApprovedSlotCount(detail: Awaited<ReturnType<CscaMockExamService['ensureMockExamBlueprintHasStyleProfile']>>['detail'], resultBySlotNumber: Map<number, MockExamGenerationSlotResult>) {
    return detail.slots
      .filter((slot) => slot.status === 'ready')
      .filter((slot) => Number(resultBySlotNumber.get(slot.slotNumber)?.candidateQuestionId) > 0)
      .length;
  }

  private mockExamApprovedPaperComplete(detail: Awaited<ReturnType<CscaMockExamService['ensureMockExamBlueprintHasStyleProfile']>>['detail'], resultBySlotNumber: Map<number, MockExamGenerationSlotResult>) {
    const required = detail.blueprint.questionCount || detail.slots.length;
    if (required <= 0) return false;
    return this.mockExamApprovedSlotCount(detail, resultBySlotNumber) >= required;
  }

  private async approveMockExamCandidateIfGatePassed(questionId: number, slotContext?: MockExamApprovalSlotContext) {
    const [current] = await this.prisma.$queryRaw<Array<{ id: number; status: string; topicId: number; syllabusVersion: string; correctAnswer: string; generationMetadata: unknown; reviewMetadata: unknown }>>(Prisma.sql`
      SELECT "id", "status", "topic_id" AS "topicId", "syllabus_version" AS "syllabusVersion", "correct_answer" AS "correctAnswer",
             "generation_metadata" AS "generationMetadata", "review_metadata" AS "reviewMetadata"
      FROM "csca_questions"
      WHERE "id" = ${questionId}
      LIMIT 1
    `);
    if (!current) return { approved: false, issue: 'candidate_not_found' };
    const generation = recordFrom(current.generationMetadata) ?? {};
    const review = recordFrom(current.reviewMetadata) ?? {};
    const gate = recordFrom(review.gate) ?? {};
    const gateDecision = cleanString(gate.decision);
    const gateReasons = stringListFrom(gate.reasons);
    const reviewIssueCodes = mockExamReviewIssueCodes(current.reviewMetadata);
    const targetAnswer = normalizeMockExamAnswerTarget(recordFrom(generation.targetProfile)?.targetAnswer);
    if (targetAnswer && cleanString(current.correctAnswer).toUpperCase() !== targetAnswer) {
      return {
        approved: false,
        issue: `target_answer_mismatch:${targetAnswer}`,
        gateDecision,
        gateReasons: Array.from(new Set([...gateReasons, 'target_answer_mismatch'])),
        reviewIssueCodes,
        repairable: true,
        repairStrategy: 'repair_in_place'
      };
    }
    if (slotContext && !mockExamCandidateMatchesSlotContext(generation, slotContext)) {
      return { approved: false, issue: 'candidate_slot_scope_mismatch', repairable: false, repairStrategy: 'hard_regenerate' };
    }
    if (current.status === 'approved') {
      if (!mockExamCandidateHasStrictApprovalGate(review)) {
        if (
          slotContext &&
          mockExamCandidateHasCompleteBilingualLocalization(generation) &&
          ['publishable', 'manual_override_publishable'].includes(gateDecision)
        ) {
          const approvedAt = new Date().toISOString();
          const currentVersionGovernance = recordFrom(generation.versionGovernance) ?? {};
          const nextGenerationMetadata = {
            ...mockExamGenerationWithApprovalSlotContext(generation, slotContext),
            versionGovernance: {
              ...currentVersionGovernance,
              targetUseCase: cleanString(currentVersionGovernance.targetUseCase, 'online_mock_exam'),
              approval: {
                status: 'approved_for_mock_exam_assembly',
                decidedAt: approvedAt,
                source: 'mock_exam_auto_gate'
              }
            }
          };
          const nextReviewMetadata = {
            ...review,
            approvalGate: {
              status: 'passed',
              reasons: gateReasons,
              checkedAt: approvedAt,
              source: 'mock_exam_auto_gate'
            },
            mockExamApproval: {
              status: 'approved_for_mock_exam_assembly',
              targetUseCase: 'online_mock_exam',
              targetQuestionBank: 'mock_exam_questions',
              disposition: 'candidate_pool',
              blueprintId: slotContext.blueprintId,
              blueprintTitle: slotContext.blueprintTitle,
              slotId: slotContext.slotId,
              slotNumber: slotContext.slotNumber,
              sourcePaperId: slotContext.sourcePaperId,
              practicePublishSkipped: true,
              decidedAt: approvedAt
            }
          };
          const [patched] = await this.prisma.$queryRaw<Array<{ id: number }>>(Prisma.sql`
            UPDATE "csca_questions"
            SET "generation_metadata" = CAST(${JSON.stringify(nextGenerationMetadata)} AS jsonb),
                "review_metadata" = CAST(${JSON.stringify(nextReviewMetadata)} AS jsonb),
                "version" = "version" + 1,
                "updated_at" = CURRENT_TIMESTAMP
            WHERE "id" = ${questionId}
              AND "status" = 'approved'
            RETURNING "id"
          `);
          return patched
            ? { approved: true, issue: null, gateDecision, gateReasons, repairable: false }
            : { approved: false, issue: 'candidate_approval_update_failed', gateDecision, gateReasons, repairable: false };
        }
        return { approved: false, issue: 'approved_candidate_gate_stale', repairable: false, repairStrategy: 'hard_regenerate' };
      }
      if (!mockExamCandidateHasCompleteBilingualLocalization(generation)) {
        return { approved: false, issue: 'approved_candidate_bilingual_missing', repairable: false, repairStrategy: 'hard_regenerate' };
      }
      return { approved: true, issue: null };
    }
    if (!['pending_review', 'review_failed', 'draft'].includes(current.status)) {
      return { approved: false, issue: `candidate_status_${current.status}` };
    }
    if (String(generation.fallbackUsed ?? '') === 'true' || generation.generator === 'rule-fallback' || generation.status === 'generator_disabled') {
      return { approved: false, issue: 'fallback_candidate' };
    }
    if (!mockExamCandidateHasCompleteBilingualLocalization(generation)) {
      const issue = 'review_gate_not_passed:missing_bilingual_localization';
      const nextGateReasons = Array.from(new Set([...gateReasons, 'missing_bilingual_localization']));
      const repairStrategy = mockExamRepairStrategy({ issue, gateDecision, gateReasons: nextGateReasons, reviewIssueCodes });
      return {
        approved: false,
        issue,
        gateDecision,
        gateReasons: nextGateReasons,
        reviewIssueCodes,
        repairStrategy,
        repairable: repairStrategy === 'repair_in_place'
      };
    }
    if (!['publishable', 'manual_override_publishable'].includes(gateDecision)) {
      const issue = `review_gate_not_passed:${gateDecision || 'unknown'}`;
      const repairStrategy = mockExamRepairStrategy({ issue, gateDecision, gateReasons, reviewIssueCodes });
      return {
        approved: false,
        issue,
        gateDecision,
        gateReasons,
        reviewIssueCodes,
        repairStrategy,
        repairable: repairStrategy === 'repair_in_place'
      };
    }
    const [topic] = await this.prisma.$queryRaw<Array<{ syllabusVersion: string; status: string }>>(Prisma.sql`
      SELECT "syllabus_version" AS "syllabusVersion", "status"
      FROM "csca_exam_topics"
      WHERE "id" = ${current.topicId}
      LIMIT 1
    `);
    if (!topic) return { approved: false, issue: 'topic_not_found' };
    if (topic.status !== 'published') return { approved: false, issue: 'topic_not_published' };
    const approvedAt = new Date().toISOString();
    const currentVersionGovernance = recordFrom(generation.versionGovernance) ?? {};
    const nextGenerationMetadata = {
      ...(slotContext ? mockExamGenerationWithApprovalSlotContext(generation, slotContext) : generation),
      versionGovernance: {
        ...currentVersionGovernance,
        targetUseCase: cleanString(currentVersionGovernance.targetUseCase, 'online_mock_exam'),
        approval: {
          status: 'approved_for_mock_exam_assembly',
          decidedAt: approvedAt,
          source: 'mock_exam_auto_gate'
        }
      }
    };
    const nextGenerationRecord = recordFrom(nextGenerationMetadata) ?? {};
    const mockExamSlot = recordFrom(nextGenerationRecord.mockExamSlot) ?? {};
    const nextReviewMetadata = {
      ...review,
      approvalGate: {
        status: 'passed',
        reasons: gateReasons,
        checkedAt: approvedAt,
        source: 'mock_exam_auto_gate'
      },
      mockExamApproval: {
        status: 'approved_for_mock_exam_assembly',
        targetUseCase: 'online_mock_exam',
        targetQuestionBank: 'mock_exam_questions',
        disposition: 'candidate_pool',
        blueprintId: mockExamSlot.blueprintId ?? null,
        blueprintTitle: mockExamSlot.blueprintTitle ?? null,
        slotId: mockExamSlot.slotId ?? null,
        slotNumber: mockExamSlot.slotNumber ?? null,
        sourcePaperId: mockExamSlot.sourcePaperId ?? null,
        practicePublishSkipped: true,
        decidedAt: approvedAt
      }
    };
    const [approved] = await this.prisma.$queryRaw<Array<{ id: number }>>(Prisma.sql`
      UPDATE "csca_questions"
      SET "status" = 'approved',
          "syllabus_version" = ${topic.syllabusVersion},
          "generation_metadata" = CAST(${JSON.stringify(nextGenerationMetadata)} AS jsonb),
          "review_metadata" = CAST(${JSON.stringify(nextReviewMetadata)} AS jsonb),
          "version" = "version" + 1,
          "updated_at" = CURRENT_TIMESTAMP
      WHERE "id" = ${questionId}
        AND "status" IN ('pending_review', 'review_failed', 'draft')
      RETURNING "id"
    `);
    return approved
      ? { approved: true, issue: null, gateDecision, gateReasons, repairable: false }
      : { approved: false, issue: 'candidate_approval_update_failed', gateDecision, gateReasons, repairable: false };
  }

  async processAdminGenerationJob(idInput: string, input: Record<string, unknown>, actorId: number) {
    const id = this.parseAdminId(idInput, '模考生成任务不存在。');
    const existing = await this.findAdminGenerationJobRow(id);
    if (!existing) throw new NotFoundException('模考生成任务不存在。');
    const force = input.force === true || input.force === 'true';
    if (!['queued', 'failed'].includes(existing.status) && !force) {
      throw new BadRequestException('只有 queued/failed 任务可以处理；如需重跑请传 force=true。');
    }
    const { detail, styleProfile } = await this.ensureMockExamBlueprintHasStyleProfile(existing.blueprintId);
    if (detail.blueprint.status !== 'active') throw new BadRequestException('只有 active 模考蓝图可以处理生成任务。');
    const queuedLineage = mockExamGenerationLineageFromSlotResults(existing.slotResults);
    const currentGenerationLineage = this.mockExamStyleProfileReference(styleProfile);
    const currentLineage = mockExamLineageFromReference(currentGenerationLineage);
    if (mockExamLineageIsStale(queuedLineage, currentLineage)) {
      const staleMessage = 'archived_stale_profile: 这条在线模考生成任务绑定的当前出题画像已经过期，请基于最新画像重新创建生成任务。';
      await this.prisma.$executeRaw(Prisma.sql`
        UPDATE "mock_exam_generation_jobs"
        SET "status" = 'failed',
            "error" = ${staleMessage},
            "completed_at" = CURRENT_TIMESTAMP,
            "updated_at" = CURRENT_TIMESTAMP
        WHERE "id" = ${id}
      `);
      throw new BadRequestException(staleMessage);
    }
    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "mock_exam_generation_jobs"
      SET "status" = 'running',
          "started_at" = COALESCE("started_at", CURRENT_TIMESTAMP),
          "completed_at" = NULL,
          "error" = NULL,
          "updated_at" = CURRENT_TIMESTAMP
      WHERE "id" = ${id}
    `);

    const requestedSlotNumbers = optionalNumberList(existing.requestedSlotNumbers, []);
    const approvedSlotResults = await this.approvedSlotResultsForBlueprint(detail);
    const slots = detail.slots.filter((slot) => requestedSlotNumbers.includes(slot.slotNumber));
    const slotByNumber = new Map(slots.map((slot) => [slot.slotNumber, slot]));
    const persistedResults = slotResultsFromJson(existing.slotResults);
    const persistedResultBySlotNumber = new Map(persistedResults.map((slot) => [Number(slot.slotNumber), slot]));
    const baseResults = requestedSlotNumbers.map((slotNumber) => {
      const currentSlot = slotByNumber.get(slotNumber);
      const persisted = persistedResultBySlotNumber.get(slotNumber);
      const approved = approvedSlotResults.get(slotNumber);
      if (approved) return approved;
      if (currentSlot) {
        const next = generationSlotResultFromBlueprintSlot(detail.blueprint, currentSlot);
        if (
          Number(persisted?.candidateQuestionId) > 0
          && ['approved', 'assembled'].includes(String(persisted?.status ?? ''))
        ) {
          return {
            ...next,
            targetProfile: persisted?.targetProfile ?? next.targetProfile,
            aiBlueprintId: Number(persisted?.aiBlueprintId) || null,
            aiGenerationJobId: Number(persisted?.aiGenerationJobId) || null,
            candidateQuestionId: Number(persisted?.candidateQuestionId),
            status: persisted?.status,
            issues: [],
            candidateAttemptCount: Math.max(0, Number(persisted?.candidateAttemptCount ?? 0) || 0),
            providerWaitCount: Math.max(0, Number(persisted?.providerWaitCount ?? 0) || 0)
          };
        }
        if (Number(persisted?.candidateQuestionId) > 0) {
          return {
            ...next,
            targetProfile: persisted?.targetProfile ?? next.targetProfile,
            aiBlueprintId: Number(persisted?.aiBlueprintId) || null,
            aiGenerationJobId: Number(persisted?.aiGenerationJobId) || null,
            candidateQuestionId: Number(persisted?.candidateQuestionId),
            status: persisted?.status || 'queued',
            issues: generationSlotIssues(persisted?.issues),
            candidateAttemptCount: Math.max(0, Number(persisted?.candidateAttemptCount ?? 0) || 0),
            providerWaitCount: Math.max(0, Number(persisted?.providerWaitCount ?? 0) || 0)
          };
        }
        if (persisted) {
          return {
            ...next,
            targetProfile: persisted.targetProfile ?? next.targetProfile,
            aiBlueprintId: Number(persisted.aiBlueprintId) || null,
            aiGenerationJobId: Number(persisted.aiGenerationJobId) || null,
            candidateQuestionId: null,
            status: persisted.status || 'queued',
            issues: generationSlotIssues(persisted.issues),
            candidateAttemptCount: Math.max(0, Number(persisted.candidateAttemptCount ?? 0) || 0),
            providerWaitCount: Math.max(0, Number(persisted.providerWaitCount ?? 0) || 0)
          };
        }
        return next;
      }
      return {
        slotId: persisted?.slotId,
        slotNumber,
        aiBlueprintId: null,
        aiGenerationJobId: null,
        candidateQuestionId: null,
        status: 'queued',
        issues: [],
        topicIds: [],
        targetProfile: persisted?.targetProfile
      };
    });
    let workingResults: MockExamGenerationSlotResult[] = baseResults.map((base) => {
      if (Number(base.candidateQuestionId) > 0 && ['approved', 'assembled'].includes(String(base.status ?? ''))) {
        return { ...base, generationLineage: base.generationLineage ?? currentGenerationLineage, issues: [] };
      }
      return { ...base, generationLineage: base.generationLineage ?? currentGenerationLineage, status: 'queued', issues: generationSlotIssues(base.issues) };
    });
    let provider: string | null = null;
    let model: string | null = null;
    let persistChain = Promise.resolve();
    const persistProgress = async (progressError: string | null = null) => {
      persistChain = persistChain.then(async () => {
        const snapshot = workingResults.map((item) => ({ ...item }));
        await this.prisma.$executeRaw(Prisma.sql`
          UPDATE "mock_exam_generation_jobs"
          SET "status" = 'running',
              "provider" = COALESCE(${provider}, "provider"),
              "model" = COALESCE(${model}, "model"),
              "slot_results" = CAST(${JSON.stringify(snapshot)} AS jsonb),
              "error" = ${progressError},
              "updated_at" = CURRENT_TIMESTAMP
          WHERE "id" = ${id}
        `);
      });
      return persistChain;
    };
    const setResult = (index: number, result: MockExamGenerationSlotResult) => {
      workingResults[index] = result;
    };
    const processSlot = async (index: number) => {
      const base = workingResults[index];
      const slotNumber = Number(base.slotNumber);
      const slot = slotByNumber.get(slotNumber);
      let currentTargetProfile = recordFrom(base.targetProfile) ?? (slot ? mockExamSlotTargetProfile(detail.blueprint, slot) : base.targetProfile);
      const approvalSlotContext = slot ? mockExamApprovalSlotContext(detail.blueprint, slot) : undefined;
      const initialBudget = mockExamSlotBudgetState(base);
      if (initialBudget.exhausted) {
        const budgetIssue = `${initialBudget.reason}: 题位 ${slotNumber} 已达到自动生成预算，停止自动补齐并等待处理。`;
        setResult(index, {
          ...base,
          targetProfile: currentTargetProfile,
          status: 'needs_attention',
          issues: [...generationSlotIssues(base.issues), budgetIssue],
          candidateAttemptCount: initialBudget.candidateAttempts,
          providerWaitCount: initialBudget.providerWaits
        });
        await persistProgress(budgetIssue);
        return;
      }
      if (mockExamSlotHasLegacyStrategyBlock(base.issues) && !recordFrom(currentTargetProfile)?.closedLoop) {
        const legacyIssue = generationSlotIssues(base.issues).map((item) => cleanString(item)).filter(Boolean).join('；') || 'target_profile_strategy_blocked';
        const replanAttempt = mockExamClosedLoopReplanAttempt(currentTargetProfile) + 1;
        currentTargetProfile = mockExamReplannedTargetProfile({
          targetProfile: currentTargetProfile,
          issue: legacyIssue,
          gateReasons: ['legacy_strategy_blocked'],
          reviewIssueCodes: [],
          slotNumber,
          replanAttempt
        });
        const replanIssue = `target_profile_strategy_replanned: 题位 ${slotNumber} 从旧的 blocked 状态自动迁移为闭环重规划 ${replanAttempt} 次；系统会继续补齐。`;
        setResult(index, {
          ...base,
          targetProfile: currentTargetProfile,
          aiGenerationJobId: null,
          candidateQuestionId: null,
          status: 'queued',
          issues: [replanIssue],
          topicIds: base.topicIds
        });
        await persistProgress(replanIssue);
        return;
      }
      currentTargetProfile = mockExamRefreshRuntimeTargetProfile(currentTargetProfile, slotNumber);
      if (Number(base.candidateQuestionId) > 0 && ['approved', 'assembled'].includes(String(base.status ?? ''))) {
        setResult(index, { ...base, targetProfile: currentTargetProfile, issues: [] });
        return;
      }
      if (Number(base.candidateQuestionId) > 0) {
        const approval = await this.approveMockExamCandidateIfGatePassed(Number(base.candidateQuestionId), approvalSlotContext);
        if (approval.approved) {
          setResult(index, { ...base, targetProfile: currentTargetProfile, status: 'approved', issues: [] });
          await persistProgress(null);
          return;
        }
      }
      if (slot) {
        const promoted = await this.promoteExistingPublishableCandidateForSlot(detail, slot, currentTargetProfile);
        if (promoted) {
          setResult(index, promoted);
          await persistProgress(null);
          return;
        }
      }
      setResult(index, { ...base, targetProfile: currentTargetProfile, status: 'running', issues: generationSlotIssues(base.issues) });
      await persistProgress(null);
      if (!slot) {
        const issues = [...generationSlotIssues(base.issues), 'slot_not_found_or_not_requested'];
        setResult(index, { ...base, targetProfile: currentTargetProfile, status: 'failed', issues });
        await persistProgress(issues.join('；'));
        return;
      }
      if (slot.status !== 'ready') {
        const issues = [...generationSlotIssues(base.issues), 'slot_not_ready'];
        setResult(index, { ...base, targetProfile: currentTargetProfile, status: 'failed', issues });
        await persistProgress(issues.join('；'));
        return;
      }
      try {
        const topic = await this.primaryTopicForGenerationSlot(detail.blueprint.subject, slot);
        if (!topic) throw new BadRequestException('题位缺少可用于生成的已发布知识点。');
        const aiBlueprintId = await this.findOrCreateAISlotBlueprint(detail.blueprint, slot, topic, currentTargetProfile);
        let lastIssue = 'ai_generation_failed';
        let lastApprovalForRetry: {
          issue?: string | null;
          gateDecision?: string | null;
          gateReasons?: string[];
          reviewIssueCodes?: string[];
        } | null = null;
        let lastQuestionIdForRetry: number | null = null;
        const repairCandidateInPlace = async (
          candidateQuestionId: number,
          approval: Awaited<ReturnType<CscaMockExamService['approveMockExamCandidateIfGatePassed']>>,
          aiGenerationJobId: number | null
        ) => {
          let repairAttempts = 0;
          let currentApproval = approval;
          while (currentApproval.repairable && repairAttempts < MOCK_EXAM_AI_REPAIR_MAX_ATTEMPTS) {
            repairAttempts += 1;
            const repairFeedback = mockExamRepairFeedback({
              issue: currentApproval.issue,
              gateDecision: currentApproval.gateDecision,
              gateReasons: currentApproval.gateReasons,
              reviewIssueCodes: currentApproval.reviewIssueCodes,
              targetProfile: currentTargetProfile,
              previousQuestionId: candidateQuestionId,
              repairAttempt: repairAttempts,
              slotNumber: slot.slotNumber
            });
            const repairIssue = `原题自动优化 ${repairAttempts}/${MOCK_EXAM_AI_REPAIR_MAX_ATTEMPTS}: ${currentApproval.issue ?? 'review_gate_blocked'}`;
            setResult(index, {
              ...base,
              targetProfile: currentTargetProfile,
              aiBlueprintId,
              aiGenerationJobId,
              candidateQuestionId,
              status: 'running',
              issues: [repairIssue],
              topicIds: [topic.id]
            });
            await persistProgress(`题位 ${slot.slotNumber} ${repairIssue}`);
            await this.aiQuestioningService.autoRepairQuestionDraft(candidateQuestionId, {
              repairFeedback,
              repairAttempt: repairAttempts
            });
            currentApproval = await this.approveMockExamCandidateIfGatePassed(candidateQuestionId, approvalSlotContext);
            if (currentApproval.approved) {
              setResult(index, {
                ...base,
                targetProfile: currentTargetProfile,
                aiBlueprintId,
                aiGenerationJobId,
                candidateQuestionId,
                status: 'approved',
                issues: [],
                topicIds: [topic.id]
              });
              await persistProgress(null);
              return { approved: true, approval: currentApproval };
            }
            lastIssue = `review_gate_not_publishable: ${currentApproval.issue ?? 'review_gate_blocked'}`;
          }
          lastApprovalForRetry = currentApproval;
          lastQuestionIdForRetry = candidateQuestionId;
          return { approved: false, approval: currentApproval };
        };
        if (Number(base.candidateQuestionId) > 0) {
          const existingApproval = await this.approveMockExamCandidateIfGatePassed(Number(base.candidateQuestionId), approvalSlotContext);
          if (existingApproval.approved) {
            setResult(index, {
              ...base,
              targetProfile: currentTargetProfile,
              aiBlueprintId,
              aiGenerationJobId: Number(base.aiGenerationJobId) || null,
              candidateQuestionId: Number(base.candidateQuestionId),
              status: 'approved',
              issues: [],
              topicIds: [topic.id]
            });
            await persistProgress(null);
            return;
          }
          if (existingApproval.repairable) {
            const repaired = await repairCandidateInPlace(Number(base.candidateQuestionId), existingApproval, Number(base.aiGenerationJobId) || null);
            if (repaired.approved) return;
          } else {
            lastApprovalForRetry = existingApproval;
            lastQuestionIdForRetry = Number(base.candidateQuestionId);
            lastIssue = `review_gate_not_publishable: ${existingApproval.issue ?? 'review_gate_blocked'}`;
          }
        }
        for (let attempt = 1; attempt <= MOCK_EXAM_AI_GENERATION_MAX_ATTEMPTS; attempt += 1) {
          const expansion = attempt > 1;
          if (expansion) {
            const regenerationFeedback = mockExamRegenerationFeedback({
              issue: lastApprovalForRetry?.issue ?? lastIssue,
              gateDecision: lastApprovalForRetry?.gateDecision ?? null,
              gateReasons: lastApprovalForRetry?.gateReasons ?? [],
              reviewIssueCodes: lastApprovalForRetry?.reviewIssueCodes ?? [],
              targetProfile: currentTargetProfile,
              previousQuestionId: lastQuestionIdForRetry,
              generationAttempt: attempt,
              slotNumber: slot.slotNumber
            });
            await this.updateAISlotBlueprintRetryFeedback(aiBlueprintId, regenerationFeedback);
            if (
              attempt > MOCK_EXAM_AI_STRUCTURAL_RETRY_LIMIT &&
              mockExamHasStructuralFailureSignal({
                issue: lastApprovalForRetry?.issue ?? lastIssue,
                gateReasons: lastApprovalForRetry?.gateReasons ?? [],
                reviewIssueCodes: lastApprovalForRetry?.reviewIssueCodes ?? []
              })
            ) {
              const replanAttempt = mockExamClosedLoopReplanAttempt(currentTargetProfile) + 1;
              const structuralIssue = `target_profile_strategy_replanned: 题位 ${slot.slotNumber} 连续 ${MOCK_EXAM_AI_STRUCTURAL_RETRY_LIMIT} 次结构性失败，已自动重规划 ${replanAttempt} 次；系统会换题型策略继续补齐。`;
              currentTargetProfile = mockExamReplannedTargetProfile({
                targetProfile: currentTargetProfile,
                issue: lastApprovalForRetry?.issue ?? lastIssue,
                gateReasons: lastApprovalForRetry?.gateReasons ?? [],
                reviewIssueCodes: lastApprovalForRetry?.reviewIssueCodes ?? [],
                slotNumber: slot.slotNumber,
                replanAttempt
              });
              setResult(index, {
                ...base,
                targetProfile: currentTargetProfile,
                aiBlueprintId,
                aiGenerationJobId: null,
                candidateQuestionId: null,
                status: 'queued',
                issues: [structuralIssue],
                topicIds: [topic.id],
                candidateAttemptCount: Math.max(0, Number(base.candidateAttemptCount ?? 0) || 0),
                providerWaitCount: Math.max(0, Number(base.providerWaitCount ?? 0) || 0)
              });
              await persistProgress(structuralIssue);
              return;
            }
          }
          const enqueued = await this.aiQuestioningService.enqueueGenerationJobs({
            blueprintIds: [aiBlueprintId],
            limit: 1,
            force: force || expansion,
            mode: expansion ? 'expand' : undefined,
            batchId: expansion ? `mock-${id}-slot-${slot.id}-retry-${Date.now()}` : undefined
          });
          const aiJobId = enqueued.items[0]?.id ?? (await this.latestAiGenerationJobForBlueprint(aiBlueprintId))?.id ?? null;
          if (!aiJobId) throw new BadRequestException('AI 出题任务未能入队。');
          let aiJob = await this.latestAiGenerationJobForBlueprint(aiBlueprintId);
          const processed = await this.aiQuestioningService.processGenerationJobs({
            jobIds: [aiJobId],
            limit: 1,
            retryFailed: true,
            force: force || attempt > 1,
            useCase: 'online_mock_exam'
          });
          aiJob = processed.items[0] ?? await this.latestAiGenerationJobForBlueprint(aiBlueprintId);
          provider = provider ?? (cleanString(aiJob?.provider) || null);
          model = model ?? (cleanString(aiJob?.model) || null);
          if (aiJob?.questionId) {
            const approval = await this.approveMockExamCandidateIfGatePassed(Number(aiJob.questionId), approvalSlotContext);
            if (approval.approved) {
              setResult(index, {
                ...base,
                targetProfile: currentTargetProfile,
                aiBlueprintId,
                aiGenerationJobId: aiJobId,
                candidateQuestionId: aiJob.questionId,
                status: 'approved',
                issues: [],
                topicIds: [topic.id]
              });
              await persistProgress(null);
              return;
            }
            const approvalIssue = approval.issue ?? 'review_gate_blocked';
            lastIssue = `review_gate_not_publishable: ${approvalIssue}`;
            lastApprovalForRetry = approval;
            lastQuestionIdForRetry = Number(aiJob.questionId);
            const nextCandidateAttempts = Math.max(0, Number(base.candidateAttemptCount ?? 0) || 0) + attempt;
            if (approval.repairable) {
              const repaired = await repairCandidateInPlace(Number(aiJob.questionId), approval, aiJobId);
              if (repaired.approved) return;
              lastIssue = `review_gate_not_publishable: ${repaired.approval.issue ?? approvalIssue}`;
              lastApprovalForRetry = repaired.approval;
              lastQuestionIdForRetry = Number(aiJob.questionId);
            }
            if (nextCandidateAttempts >= MOCK_EXAM_AI_SLOT_MAX_CANDIDATE_ATTEMPTS) {
              const budgetIssue = `slot_candidate_attempt_budget_exhausted: 题位 ${slot.slotNumber} 已尝试 ${nextCandidateAttempts}/${MOCK_EXAM_AI_SLOT_MAX_CANDIDATE_ATTEMPTS} 个候选仍未通过门禁。`;
              setResult(index, {
                ...base,
                targetProfile: currentTargetProfile,
                aiBlueprintId,
                aiGenerationJobId: aiJobId,
                candidateQuestionId: aiJob.questionId,
                status: 'needs_attention',
                issues: [budgetIssue, lastIssue],
                topicIds: [topic.id],
                candidateAttemptCount: nextCandidateAttempts,
                providerWaitCount: Math.max(0, Number(base.providerWaitCount ?? 0) || 0)
              });
              await persistProgress(budgetIssue);
              return;
            }
            setResult(index, {
              ...base,
              targetProfile: currentTargetProfile,
              aiBlueprintId,
              aiGenerationJobId: aiJobId,
              candidateQuestionId: aiJob.questionId,
              status: 'running',
              issues: [`自动重试 ${attempt}/${MOCK_EXAM_AI_GENERATION_MAX_ATTEMPTS}`, lastIssue],
              topicIds: [topic.id],
              candidateAttemptCount: nextCandidateAttempts,
              providerWaitCount: Math.max(0, Number(base.providerWaitCount ?? 0) || 0)
            });
            await persistProgress(`题位 ${slot.slotNumber} 自动重试 ${attempt}/${MOCK_EXAM_AI_GENERATION_MAX_ATTEMPTS}：${lastIssue}`);
            continue;
          }
          const retryIssue = aiJob?.error ?? processed.errors[0]?.message ?? 'ai_generation_retry_pending';
          lastIssue = retryIssue;
          const nextProviderWaits = mockExamIsProviderBackpressure(retryIssue)
            ? Math.max(0, Number(base.providerWaitCount ?? 0) || 0) + 1
            : Math.max(0, Number(base.providerWaitCount ?? 0) || 0);
          setResult(index, {
            ...base,
            targetProfile: currentTargetProfile,
            aiBlueprintId,
            aiGenerationJobId: aiJobId,
            candidateQuestionId: null,
            status: 'running',
            issues: [`自动重试 ${attempt}/${MOCK_EXAM_AI_GENERATION_MAX_ATTEMPTS}`, retryIssue],
            topicIds: [topic.id],
            candidateAttemptCount: Math.max(0, Number(base.candidateAttemptCount ?? 0) || 0),
            providerWaitCount: nextProviderWaits
          });
          await persistProgress(`题位 ${slot.slotNumber} 自动重试 ${attempt}/${MOCK_EXAM_AI_GENERATION_MAX_ATTEMPTS}：${retryIssue}`);
          if (processed.requested === 0 || aiJob?.status !== 'failed') break;
        }
        const issues = [...generationSlotIssues(base.issues), lastIssue];
        if (mockExamIsRecoverableProviderFailure(lastIssue)) {
          const retryIssue = `provider_requeued: 题位 ${slot.slotNumber} 遇到可恢复的 AI Provider/Schema 异常，已重新排队；系统会继续生成直到补齐。`;
          setResult(index, {
            ...base,
            targetProfile: currentTargetProfile,
            aiBlueprintId,
            aiGenerationJobId: null,
            candidateQuestionId: null,
            status: 'queued',
            issues: [retryIssue, lastIssue],
            topicIds: [topic.id],
            candidateAttemptCount: Math.max(0, Number(base.candidateAttemptCount ?? 0) || 0),
            providerWaitCount: Math.max(0, Number(base.providerWaitCount ?? 0) || 0) + (mockExamIsProviderBackpressure(lastIssue) ? 1 : 0)
          });
          await persistProgress(retryIssue);
          return;
        }
        setResult(index, {
          ...base,
          targetProfile: currentTargetProfile,
          aiBlueprintId,
          aiGenerationJobId: null,
          candidateQuestionId: null,
          status: 'failed',
          issues,
          topicIds: [topic.id]
        });
        await persistProgress(issues.join('；'));
      } catch (error) {
        const errorIssue = error instanceof Error ? error.message : String(error);
        const issues = [...generationSlotIssues(base.issues), errorIssue];
        if (mockExamIsRecoverableProviderFailure(errorIssue)) {
          const retryIssue = `provider_requeued: 题位 ${slotNumber} 遇到可恢复的 AI Provider/Schema 异常，已重新排队；系统会继续生成直到补齐。`;
          setResult(index, {
            ...base,
            targetProfile: currentTargetProfile,
            candidateQuestionId: null,
            status: 'queued',
            issues: [retryIssue, errorIssue],
            providerWaitCount: Math.max(0, Number(base.providerWaitCount ?? 0) || 0) + (mockExamIsProviderBackpressure(errorIssue) ? 1 : 0)
          });
          await persistProgress(retryIssue);
          return;
        }
        setResult(index, {
          ...base,
          targetProfile: currentTargetProfile,
          candidateQuestionId: null,
          status: 'failed',
          issues
        });
        await persistProgress(issues.join('；'));
      }
    };

    const pendingIndexes = workingResults
      .map((result, index) => ({ result, index }))
      .filter(({ result }) => !(Number(result.candidateQuestionId) > 0 && ['approved', 'assembled'].includes(String(result.status ?? ''))))
      .sort((left, right) => {
        const leftReplan = mockExamClosedLoopReplanAttempt(left.result.targetProfile);
        const rightReplan = mockExamClosedLoopReplanAttempt(right.result.targetProfile);
        if (leftReplan !== rightReplan) return leftReplan - rightReplan;
        const leftIssueCount = generationSlotIssues(left.result.issues).length;
        const rightIssueCount = generationSlotIssues(right.result.issues).length;
        if (leftIssueCount !== rightIssueCount) return leftIssueCount - rightIssueCount;
        const leftHasCandidate = Number(left.result.candidateQuestionId) > 0 ? 0 : 1;
        const rightHasCandidate = Number(right.result.candidateQuestionId) > 0 ? 0 : 1;
        if (leftHasCandidate !== rightHasCandidate) return leftHasCandidate - rightHasCandidate;
        return Number(left.result.slotNumber ?? left.index) - Number(right.result.slotNumber ?? right.index);
      })
      .map(({ index }) => index);
    const concurrency = intInRange(
      input.concurrency ?? process.env.CSCA_MOCK_EXAM_AI_GENERATION_CONCURRENCY,
      DEFAULT_MOCK_EXAM_AI_GENERATION_CONCURRENCY,
      1,
      MAX_MOCK_EXAM_AI_GENERATION_CONCURRENCY
    );
    let cursor = 0;
    const workerCount = Math.min(concurrency, pendingIndexes.length);
    await Promise.all(Array.from({ length: workerCount }, async () => {
      while (cursor < pendingIndexes.length) {
        const index = pendingIndexes[cursor];
        cursor += 1;
        await processSlot(index);
      }
    }));
    await persistChain;

    workingResults = workingResults.map(mockExamAnnotateSlotDiagnostics);
    const succeeded = workingResults.filter((item) => Number(item.candidateQuestionId) > 0 && ['approved', 'assembled'].includes(String(item.status ?? ''))).length;
    const failed = workingResults.filter((item) => item.status === 'failed').length;
    const needsAttention = workingResults.filter((item) => item.status === 'needs_attention').length;
    const queuedOrRunning = workingResults.filter((item) => item.status === 'queued' || item.status === 'running').length;
    const providerWaitCount = mockExamPaperProviderWaitCount(workingResults);
    const diagnostics = mockExamGenerationJobDiagnostics(workingResults);
    if (queuedOrRunning > 0) {
      await persistProgress(`还有 ${queuedOrRunning} 个题位未完成，本次并发处理未全部收敛。`);
      await persistChain;
    }

    const requiredCandidates = baseResults.length;
    const isCompletePaper = requiredCandidates > 0 && succeeded >= requiredCandidates;
    const providerWaitBudgetExhausted = providerWaitCount >= MOCK_EXAM_AI_PAPER_MAX_PROVIDER_WAITS;
    const shouldStopForAttention = !isCompletePaper && (needsAttention > 0 || providerWaitBudgetExhausted || (failed > 0 && queuedOrRunning === 0));
    const finalStatus = isCompletePaper ? 'completed' : shouldStopForAttention ? 'needs_attention' : 'queued';
    const persistedStatus = isCompletePaper ? 'needs_review' : finalStatus;
    const missing = Math.max(0, requiredCandidates - succeeded);
    const error = isCompletePaper
      ? null
      : shouldStopForAttention
        ? `自动补齐已暂停：已通过门禁并入库 ${succeeded}/${requiredCandidates} 题，还差 ${missing} 个题位；${providerWaitBudgetExhausted ? `provider 等待达到整套预算 ${providerWaitCount}/${MOCK_EXAM_AI_PAPER_MAX_PROVIDER_WAITS}。` : '有题位达到自动生成预算或进入失败终态。'}`
        : `自动补齐中：已通过门禁并入库 ${succeeded}/${requiredCandidates} 题，还差 ${missing} 个题位；系统会继续生成、优化并复审，直到 ${requiredCandidates}/${requiredCandidates}。`;
    const rows = await this.prisma.$queryRaw<MockExamGenerationJobRow[]>(Prisma.sql`
      UPDATE "mock_exam_generation_jobs"
      SET "status" = ${persistedStatus},
          "provider" = COALESCE(${provider}, "provider"),
          "model" = COALESCE(${model}, "model"),
          "slot_results" = CAST(${JSON.stringify(workingResults)} AS jsonb),
          "error" = ${error},
          "completed_at" = ${Prisma.sql`NULL`},
          "updated_at" = CURRENT_TIMESTAMP
      WHERE "id" = ${id}
      RETURNING "id", "blueprint_id" AS "blueprintId", "target_paper_id" AS "targetPaperId",
                "status", "provider", "model", "requested_slot_numbers" AS "requestedSlotNumbers",
                "slot_results" AS "slotResults", "error", "created_by" AS "createdBy",
                "started_at" AS "startedAt", "completed_at" AS "completedAt",
                "created_at" AS "createdAt", "updated_at" AS "updatedAt"
    `);
    const job = rows[0];
    await recordAdminAudit(this.prisma, {
      actorId,
      module: 'mock-exam',
      resourceType: 'mock_exam_generation_job',
      resourceId: String(id),
      action: 'process',
      before: mapMockExamGenerationJob(existing),
      after: {
        status: finalStatus,
        persistedStatus,
        succeeded,
        failed,
        needsAttention,
        concurrency,
        missing,
        providerWaitCount,
        diagnostics,
        autoRequeued: finalStatus === 'queued',
        candidateQuestionIds: workingResults.map((item) => item.candidateQuestionId).filter(Boolean),
        aiGenerationJobIds: workingResults.map((item) => item.aiGenerationJobId).filter(Boolean)
      }
    });
    if (isCompletePaper) {
      try {
        await this.autoAssembleAndPublishMockExamPaper(id, actorId);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await this.prisma.$executeRaw(Prisma.sql`
          UPDATE "mock_exam_generation_jobs"
          SET "status" = 'assembly_blocked',
              "error" = ${`auto_assembly_publish_failed: ${message}`},
              "completed_at" = CURRENT_TIMESTAMP,
              "updated_at" = CURRENT_TIMESTAMP
          WHERE "id" = ${id}
        `);
      }
    } else if (finalStatus === 'queued') {
      this.requeueAdminGenerationJobInBackground(id, actorId);
    }
    const refreshedJob = await this.findAdminGenerationJobRow(id);
    return mapMockExamGenerationJob((refreshedJob ?? job) as MockExamGenerationJobRow);
  }

  private async uniqueMockExamSlug(baseInput: unknown) {
    const base = slugPart(baseInput) || `ai-mock-${Date.now()}`;
    for (let index = 0; index < 50; index += 1) {
      const candidate = index === 0 ? base : `${base}-${index + 1}`;
      const existing = await this.prisma.mockExamPaper.findUnique({ where: { slug: candidate }, select: { id: true } });
      if (!existing) return candidate;
    }
    return `${base}-${Date.now()}`;
  }

  private async approvedCandidatesForMockDraft(ids: number[], subject: string) {
    if (!ids.length) return [];
    return this.prisma.$queryRaw<MockExamApprovedCandidateRow[]>(Prisma.sql`
      SELECT "id", "subject", "topic_id" AS "topicId", "blueprint_id" AS "blueprintId",
             "prompt", "options", "correct_answer" AS "correctAnswer", "explanation",
             "knowledge_tags" AS "knowledgeTags", "status", "generation_metadata" AS "generationMetadata"
      FROM "csca_questions"
      WHERE "id" IN (${Prisma.join(ids)})
        AND "subject" = ${subject}
        AND "status" = 'approved'
        AND COALESCE("generation_metadata"->'versionGovernance'->>'status', '') IN ('current', 'legacy_usable', 'manual_published')
        AND (
          "generation_metadata"->>'sourceKind' = 'mock_exam_blueprint_slot'
          OR "generation_metadata"->>'generationSource' = 'mock_exam_blueprint_slot'
          OR "generation_metadata"->>'generationMode' LIKE 'online_mock%'
        )
      ORDER BY "id" ASC
    `);
  }

  async assembleAdminGenerationJobDraft(idInput: string, input: Record<string, unknown>, actorId: number) {
    const id = this.parseAdminId(idInput, '模考生成任务不存在。');
    const jobRow = await this.findAdminGenerationJobRow(id);
    if (!jobRow) throw new NotFoundException('模考生成任务不存在。');
    if (jobRow.targetPaperId) throw new BadRequestException('该生成任务已经装配过草稿卷。');
    if (!['needs_review', 'completed'].includes(jobRow.status)) throw new BadRequestException('只有已生成候选题的任务可以装配草稿卷。');
    const { detail, styleProfile } = await this.ensureMockExamBlueprintHasStyleProfile(jobRow.blueprintId);
    if (detail.blueprint.status !== 'active') throw new BadRequestException('只有 active 模考蓝图可以装配草稿卷。');
    const queuedLineage = mockExamGenerationLineageFromSlotResults(jobRow.slotResults);
    const currentLineage = mockExamLineageFromReference(this.mockExamStyleProfileReference(styleProfile));
    if (mockExamLineageIsStale(queuedLineage, currentLineage)) {
      throw new BadRequestException('当前在线模考生成任务绑定的出题画像已经过期，请基于最新画像重新创建生成任务后再装配。');
    }
    const slotResults = slotResultsFromJson(jobRow.slotResults)
      .filter((item) => Number(item.slotNumber) > 0)
      .sort((a, b) => Number(a.slotNumber) - Number(b.slotNumber));
    const missingCandidates = slotResults.filter((item) => !Number(item.candidateQuestionId));
    if (!slotResults.length || missingCandidates.length) {
      throw new BadRequestException('生成任务还有题位没有候选题，不能装配草稿卷。');
    }
    const candidateIds = slotResults.map((item) => Number(item.candidateQuestionId)).filter((item) => Number.isInteger(item) && item > 0);
    const uniqueCandidateIds = Array.from(new Set(candidateIds));
    if (uniqueCandidateIds.length !== candidateIds.length) throw new BadRequestException('同一个候选题不能重复装配到多个题位。');
    const approvedRows = await this.approvedCandidatesForMockDraft(uniqueCandidateIds, detail.blueprint.subject);
    const approvedById = new Map(approvedRows.map((row) => [row.id, row]));
    const notApproved = uniqueCandidateIds.filter((candidateId) => !approvedById.has(candidateId));
    if (notApproved.length) {
      throw new BadRequestException(`以下候选题尚未审核通过，不能装配草稿卷：${notApproved.join('，')}。`);
    }

    const slug = await this.uniqueMockExamSlug(input.slug || `${detail.blueprint.subject}-ai-mock-${id}`);
    const title = cleanString(input.title) || `${detail.blueprint.title} AI 草稿 #${id}`;
    const questionCount = slotResults.length;
    const durationMinutes = cleanPositive(input.durationMinutes, detail.blueprint.durationMinutes);
    const sortOrderRow = await this.prisma.mockExamPaper.aggregate({
      where: { subject: detail.blueprint.subject },
      _max: { sortOrder: true }
    });
    const nextSortOrder = Number(sortOrderRow._max.sortOrder ?? 0) + 1;
    const created = await this.prisma.$transaction(async (tx) => {
      const paper = await tx.mockExamPaper.create({
        data: {
          subject: detail.blueprint.subject,
          slug,
          title,
          description: cleanString(input.description) || `由模考蓝图 #${detail.blueprint.id} 和生成任务 #${jobRow.id} 装配的 AI 草稿卷。`,
          language: 'zh',
          questionCount,
          durationMinutes,
          priceLabel: cleanString(input.priceLabel) || null,
          isFree: false,
          isLocked: true,
          sortOrder: nextSortOrder,
          status: 'draft',
          questions: {
            create: slotResults.map((slotResult, index) => {
              const candidate = approvedById.get(Number(slotResult.candidateQuestionId));
              if (!candidate) throw new BadRequestException('候选题审核状态在装配过程中发生变化，请刷新后重试。');
              return {
                orderNumber: index + 1,
                questionType: 'single-choice',
                prompt: candidate.prompt,
                options: optionsFromJson(candidate.options) as Prisma.InputJsonValue,
                correctAnswer: candidate.correctAnswer,
                explanation: candidate.explanation,
                knowledgeTags: tagsFromJson(candidate.knowledgeTags) as Prisma.InputJsonValue,
                status: 'published'
              };
            })
          }
        },
        include: { _count: { select: { questions: true, attempts: true } } }
      });
      const questions = await tx.mockExamQuestion.findMany({
        where: { paperId: paper.id },
        select: { id: true, orderNumber: true },
        orderBy: [{ orderNumber: 'asc' }, { id: 'asc' }]
      });
      const questionIdByOrder = new Map(questions.map((question) => [question.orderNumber, question.id]));
      const assembledAt = new Date().toISOString();
      for (const [index, slotResult] of slotResults.entries()) {
        const candidateQuestionId = Number(slotResult.candidateQuestionId);
        const assembledQuestionId = questionIdByOrder.get(index + 1) ?? null;
        if (!candidateQuestionId || !assembledQuestionId) continue;
        await tx.$executeRaw(Prisma.sql`
          UPDATE "csca_questions"
          SET "review_metadata" = jsonb_set(
                COALESCE("review_metadata", '{}'::jsonb),
                '{mockExamApproval}',
                COALESCE("review_metadata"->'mockExamApproval', '{}'::jsonb) || CAST(${JSON.stringify({
                  status: 'assembled_in_mock_exam_draft',
                  disposition: 'assembled_draft',
                  targetUseCase: 'online_mock_exam',
                  targetQuestionBank: 'mock_exam_questions',
                  targetPaperId: paper.id,
                  targetPaperSlug: paper.slug,
                  targetPaperTitle: paper.title,
                  generationJobId: jobRow.id,
                  blueprintId: detail.blueprint.id,
                  blueprintTitle: detail.blueprint.title,
                  slotId: slotResult.slotId ?? null,
                  slotNumber: slotResult.slotNumber ?? index + 1,
                  assembledOrderNumber: index + 1,
                  assembledQuestionId,
                  assembledAt,
                  practicePublishSkipped: true
                })} AS jsonb),
                true
              ),
              "updated_at" = CURRENT_TIMESTAMP
          WHERE "id" = ${candidateQuestionId}
        `);
      }
      await tx.$executeRaw(Prisma.sql`
        UPDATE "mock_exam_generation_jobs"
        SET "target_paper_id" = ${paper.id},
            "status" = 'completed',
            "slot_results" = CAST(${JSON.stringify(slotResults.map((slotResult, index) => ({
              ...slotResult,
              assembledOrderNumber: index + 1,
              assembledQuestionId: questionIdByOrder.get(index + 1) ?? null,
              status: 'assembled'
            })))} AS jsonb),
            "completed_at" = CURRENT_TIMESTAMP,
            "updated_at" = CURRENT_TIMESTAMP
        WHERE "id" = ${jobRow.id}
      `);
      return paper;
    });
    await recordAdminAudit(this.prisma, {
      actorId,
      module: 'mock-exam',
      resourceType: 'mock_exam_generation_job',
      resourceId: String(id),
      action: 'assemble_draft',
      before: mapMockExamGenerationJob(jobRow),
      after: {
        targetPaperId: created.id,
        slug: created.slug,
        questionCount,
        candidateQuestionIds: uniqueCandidateIds,
        visibility: 'draft_paper_not_public'
      }
    });
    return {
      job: mapMockExamGenerationJob(await this.findAdminGenerationJobRow(id) as MockExamGenerationJobRow),
      paper: adminPaperSummary(created)
    };
  }

  async getAdminPaper(idInput: string) {
    const paper = await this.findAdminPaper(idInput);
    const questions = await this.prisma.mockExamQuestion.findMany({
      where: { paperId: paper.id },
      orderBy: [{ orderNumber: 'asc' }, { id: 'asc' }]
    });
    const mappings = questions.length
      ? await this.prisma.cscaTopicMapping.findMany({
          where: {
            sourceType: 'mock_exam_question',
            sourceId: { in: questions.map((question) => question.id) },
            topic: { subject: paper.subject, status: 'published' }
          },
          select: {
          sourceId: true,
          confidence: true,
            topic: { select: { id: true, code: true, title: true, module: true, syllabusVersion: true } }
          },
          orderBy: [{ confidence: 'desc' }, { id: 'asc' }]
        })
      : [];
    const issues = this.publishIssues(paper, questions);
    const normalizedMappings = await this.normalizeMappingsToAppliedSyllabus(paper.subject, mappings);
    const blueprintReport = buildAdminBlueprintReport(paper, questions, normalizedMappings);
    const blueprints = await this.findBlueprintsForPaper(paper.id, 5).catch(() => []);
    return { paper: adminPaperSummary(paper), questions: questions.map(adminQuestionSummary), issues, blueprintReport, blueprints };
  }

  async createAdminPaper(input: AdminImportPaper, actorId: number) {
    const normalized = validatePaperPayload({ ...input, status: input.status ?? 'draft' });
    if (normalized.errors.length) throw new BadRequestException({ message: '套卷信息不完整。', errors: normalized.errors });
    const paper = await this.prisma.mockExamPaper.create({ data: normalized.paper });
    await recordAdminAudit(this.prisma, { actorId, module: 'mock-exam', resourceType: 'paper', resourceId: paper.id, action: 'create', after: adminPaperSummary(paper) });
    return adminPaperSummary(paper);
  }

  async updateAdminPaper(idInput: string, input: AdminImportPaper, actorId: number) {
    const expectedVersion = expectedVersionFrom(input);
    const { existing, next } = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.mockExamPaper.findFirst({ where: { id: this.parseAdminId(idInput, '模考套卷不存在。') }, include: { _count: { select: { questions: true, attempts: true } } } });
      if (!existing) throw new NotFoundException('模考套卷不存在。');
      assertVersion(existing.version, expectedVersion, '模考套卷');
      const normalized = validatePaperPayload({ ...existing, ...input, questions: undefined });
      if (normalized.errors.length) throw new BadRequestException({ message: '套卷信息不完整。', errors: normalized.errors });
      if (normalized.paper.status === 'published') {
        const questions = await tx.mockExamQuestion.findMany({ where: { paperId: existing.id }, orderBy: [{ orderNumber: 'asc' }] });
        const issues = this.publishIssues({ ...existing, ...normalized.paper }, questions);
        if (issues.length) throw new BadRequestException({ message: '发布检查未通过。', errors: issues });
      }
      const updated = await tx.mockExamPaper.updateMany({ where: { id: existing.id, version: existing.version }, data: { ...normalized.paper, version: { increment: 1 } } });
      if (updated.count !== 1) throw versionConflict('模考套卷', existing.version);
      const next = await tx.mockExamPaper.findFirstOrThrow({ where: { id: existing.id }, include: { _count: { select: { questions: true, attempts: true } } } });
      return { existing, next };
    });
    await recordAdminAudit(this.prisma, { actorId, module: 'mock-exam', resourceType: 'paper', resourceId: next.id, action: 'update', before: adminPaperSummary(existing), after: adminPaperSummary(next) });
    return adminPaperSummary(next);
  }

  async publishAdminPaper(idInput: string, actorId: number, input: Record<string, unknown> = {}) {
    const expectedVersion = expectedVersionFrom(input);
    const next = await this.prisma.$transaction(async (tx) => {
      const paper = await tx.mockExamPaper.findFirst({ where: { id: this.parseAdminId(idInput, '模考套卷不存在。') }, include: { _count: { select: { questions: true, attempts: true } } } });
      if (!paper) throw new NotFoundException('模考套卷不存在。');
      assertVersion(paper.version, expectedVersion, '模考套卷');
      const questions = await tx.mockExamQuestion.findMany({ where: { paperId: paper.id }, orderBy: [{ orderNumber: 'asc' }, { id: 'asc' }] });
      const issues = this.publishIssues(paper, questions);
      if (issues.length) throw new BadRequestException({ message: '发布检查未通过。', errors: issues });
      const updated = await tx.mockExamPaper.updateMany({ where: { id: paper.id, version: paper.version }, data: { status: 'published', version: { increment: 1 } } });
      if (updated.count !== 1) throw versionConflict('模考套卷', paper.version);
      return tx.mockExamPaper.findFirstOrThrow({ where: { id: paper.id }, include: { _count: { select: { questions: true, attempts: true } } } });
    });
    await recordAdminAudit(this.prisma, { actorId, module: 'mock-exam', resourceType: 'paper', resourceId: next.id, action: 'publish', after: adminPaperSummary(next) });
    return adminPaperSummary(next);
  }

  async archiveAdminPaper(idInput: string, actorId: number, input: Record<string, unknown> = {}) {
    const expectedVersion = expectedVersionFrom(input);
    const { existing, next } = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.mockExamPaper.findFirst({ where: { id: this.parseAdminId(idInput, '模考套卷不存在。') }, include: { _count: { select: { questions: true, attempts: true } } } });
      if (!existing) throw new NotFoundException('模考套卷不存在。');
      assertVersion(existing.version, expectedVersion, '模考套卷');
      const updated = await tx.mockExamPaper.updateMany({ where: { id: existing.id, version: existing.version }, data: { status: 'archived', version: { increment: 1 } } });
      if (updated.count !== 1) throw versionConflict('模考套卷', existing.version);
      const next = await tx.mockExamPaper.findFirstOrThrow({ where: { id: existing.id }, include: { _count: { select: { questions: true, attempts: true } } } });
      return { existing, next };
    });
    await recordAdminAudit(this.prisma, { actorId, module: 'mock-exam', resourceType: 'paper', resourceId: next.id, action: 'archive', before: adminPaperSummary(existing), after: adminPaperSummary(next) });
    return adminPaperSummary(next);
  }

  async duplicateAdminPaper(idInput: string, actorId: number) {
    const existing = await this.findAdminPaper(idInput);
    const questions = await this.prisma.mockExamQuestion.findMany({ where: { paperId: existing.id }, orderBy: [{ orderNumber: 'asc' }] });
    const next = await this.prisma.mockExamPaper.create({
      data: {
        subject: existing.subject,
        slug: `${existing.slug}-copy-${Date.now()}`,
        title: `${existing.title} 副本`,
        description: existing.description,
        language: existing.language,
        questionCount: existing.questionCount,
        durationMinutes: existing.durationMinutes,
        priceLabel: existing.priceLabel,
        isFree: false,
        isLocked: true,
        sortOrder: existing.sortOrder + 1,
        status: 'draft',
        questions: {
          create: questions.map((question) => ({
            orderNumber: question.orderNumber,
            questionType: question.questionType,
            prompt: question.prompt,
            options: question.options as Prisma.InputJsonValue,
            correctAnswer: question.correctAnswer,
            explanation: question.explanation,
            knowledgeTags: question.knowledgeTags as Prisma.InputJsonValue,
            status: 'draft'
          }))
        }
      }
    });
    await recordAdminAudit(this.prisma, { actorId, module: 'mock-exam', resourceType: 'paper', resourceId: next.id, action: 'duplicate', after: { sourceId: existing.id, targetId: next.id } });
    return adminPaperSummary(next);
  }

  async createAdminQuestion(paperIdInput: string, input: AdminImportQuestion, actorId: number) {
    const paper = await this.findAdminPaper(paperIdInput);
    const errors: string[] = [];
    const question = validateQuestionPayload(input, (input.orderNumber ?? 0) - 1, errors);
    if (errors.length) throw new BadRequestException({ message: '题目信息不完整。', errors });
    const next = await this.prisma.mockExamQuestion.create({
      data: {
        paperId: paper.id,
        orderNumber: question.orderNumber,
        questionType: question.questionType,
        prompt: question.prompt,
        options: question.options as Prisma.InputJsonValue,
        correctAnswer: question.correctAnswer,
        explanation: question.explanation,
        knowledgeTags: question.knowledgeTags as Prisma.InputJsonValue,
        status: question.status
      }
    });
    await recordAdminAudit(this.prisma, { actorId, module: 'mock-exam', resourceType: 'question', resourceId: next.id, action: 'create', after: adminQuestionSummary(next) });
    return adminQuestionSummary(next);
  }

  async updateAdminQuestion(idInput: string, input: AdminImportQuestion, actorId: number) {
    const expectedVersion = expectedVersionFrom(input);
    const { existing, next } = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.mockExamQuestion.findFirst({ where: { id: this.parseAdminId(idInput, '模考题目不存在。') }, include: { paper: true } });
      if (!existing) throw new NotFoundException('模考题目不存在。');
      assertVersion(existing.version, expectedVersion, '模考题目');
      await this.assertEditableQuestion(existing, input);
      const errors: string[] = [];
      const question = validateQuestionPayload({ ...adminQuestionSummary(existing), ...input }, (input.orderNumber ?? existing.orderNumber) - 1, errors);
      if (errors.length) throw new BadRequestException({ message: '题目信息不完整。', errors });
      const updated = await tx.mockExamQuestion.updateMany({
        where: { id: existing.id, version: existing.version },
        data: {
          orderNumber: question.orderNumber,
          questionType: question.questionType,
          prompt: question.prompt,
          options: question.options as Prisma.InputJsonValue,
          correctAnswer: question.correctAnswer,
          explanation: question.explanation,
          knowledgeTags: question.knowledgeTags as Prisma.InputJsonValue,
          status: question.status,
          version: { increment: 1 }
        }
      });
      if (updated.count !== 1) throw versionConflict('模考题目', existing.version);
      const next = await tx.mockExamQuestion.findFirstOrThrow({ where: { id: existing.id }, include: { paper: true } });
      return { existing, next };
    });
    await recordAdminAudit(this.prisma, { actorId, module: 'mock-exam', resourceType: 'question', resourceId: next.id, action: 'update', before: adminQuestionSummary(existing), after: adminQuestionSummary(next) });
    return adminQuestionSummary(next);
  }

  async archiveAdminQuestion(idInput: string, actorId: number, input: Record<string, unknown> = {}) {
    const expectedVersion = expectedVersionFrom(input);
    const { existing, next } = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.mockExamQuestion.findFirst({ where: { id: this.parseAdminId(idInput, '模考题目不存在。') }, include: { paper: true } });
      if (!existing) throw new NotFoundException('模考题目不存在。');
      assertVersion(existing.version, expectedVersion, '模考题目');
      const updated = await tx.mockExamQuestion.updateMany({ where: { id: existing.id, version: existing.version }, data: { status: 'archived', version: { increment: 1 } } });
      if (updated.count !== 1) throw versionConflict('模考题目', existing.version);
      const next = await tx.mockExamQuestion.findFirstOrThrow({ where: { id: existing.id }, include: { paper: true } });
      return { existing, next };
    });
    await recordAdminAudit(this.prisma, { actorId, module: 'mock-exam', resourceType: 'question', resourceId: next.id, action: 'archive', before: adminQuestionSummary(existing), after: adminQuestionSummary(next) });
    return adminQuestionSummary(next);
  }

  async validateAdminImport(input: unknown) {
    const payload = assertRecord(input, 'JSON 顶层必须是对象。');
    if (!Array.isArray(payload.papers)) throw new BadRequestException('JSON 顶层必须包含 papers 数组。');
    const previews = [];
    const errors: string[] = [];
    for (const [index, rawPaper] of payload.papers.entries()) {
      const normalized = validatePaperPayload(rawPaper as AdminImportPaper, index);
      errors.push(...normalized.errors);
      const existing = normalized.paper.slug ? await this.prisma.mockExamPaper.findUnique({ where: { slug: normalized.paper.slug }, include: { _count: { select: { questions: true, attempts: true } } } }) : null;
      if (existing?.status === 'published' && existing._count.attempts > 0 && normalized.questions.length) {
        errors.push(`套卷 ${existing.slug} 已发布且已有作答记录，请复制为新套卷后再大改题目。`);
      }
      previews.push({
        slug: normalized.paper.slug,
        title: normalized.paper.title,
        subject: normalized.paper.subject,
        status: normalized.paper.status,
        questionCount: normalized.questions.length,
        action: existing ? 'update-draft' : 'create-draft',
        existingStatus: existing?.status ?? null,
        existingAttempts: existing?._count.attempts ?? 0
      });
    }
    return { ok: errors.length === 0, errors, warnings: [], previews };
  }

  async importAdminPapers(input: unknown, actorId: number) {
    const validation = await this.validateAdminImport(input);
    if (!validation.ok) throw new BadRequestException({ message: '导入校验未通过。', errors: validation.errors });
    const payload = assertRecord(input, 'JSON 顶层必须是对象。');
    const papers = payload.papers as AdminImportPaper[];
    let created = 0;
    let updated = 0;
    let questionsUpserted = 0;
    await this.prisma.$transaction(async (tx) => {
      for (const rawPaper of papers) {
        const normalized = validatePaperPayload({ ...rawPaper, status: rawPaper.status ?? 'draft' });
        const existing = await tx.mockExamPaper.findUnique({ where: { slug: normalized.paper.slug } });
        const paper = existing
          ? await tx.mockExamPaper.update({ where: { id: existing.id }, data: { ...normalized.paper, status: existing.status === 'published' ? 'draft' : normalized.paper.status } })
          : await tx.mockExamPaper.create({ data: { ...normalized.paper, status: 'draft' } });
        existing ? updated += 1 : created += 1;
        for (const question of normalized.questions) {
          await tx.mockExamQuestion.upsert({
            where: { paperId_orderNumber: { paperId: paper.id, orderNumber: question.orderNumber } },
            create: {
              paperId: paper.id,
              orderNumber: question.orderNumber,
              questionType: question.questionType,
              prompt: question.prompt,
              options: question.options as Prisma.InputJsonValue,
              correctAnswer: question.correctAnswer,
              explanation: question.explanation,
              knowledgeTags: question.knowledgeTags as Prisma.InputJsonValue,
              status: question.status
            },
            update: {
              questionType: question.questionType,
              prompt: question.prompt,
              options: question.options as Prisma.InputJsonValue,
              correctAnswer: question.correctAnswer,
              explanation: question.explanation,
              knowledgeTags: question.knowledgeTags as Prisma.InputJsonValue,
              status: question.status
            }
          });
          questionsUpserted += 1;
        }
      }
    });
    await recordAdminAudit(this.prisma, { actorId, module: 'mock-exam', resourceType: 'import', action: 'import', after: { created, updated, questionsUpserted } });
    return { created, updated, questionsUpserted, previews: validation.previews };
  }

  private async getReportByAttempt(attempt: DbAttempt & { paper: DbPaper }, knownQuestions?: Array<DbQuestion | SnapshotQuestion>, locale: PublicLocale = 'zh-CN') {
    if (!attempt.submittedAt) throw new BadRequestException('请先交卷再查看报告。');
    const questions = knownQuestions ?? await this.reportQuestions(attempt);
    const answers = recordStringMap(attempt.answers, '答案格式不正确。');
    const marked = numberList(attempt.markedQuestions);
    const timeSpent = numberMap(attempt.timeSpent);
    const tagStats = new Map<string, { tag: string; total: number; wrong: number }>();
    const items = questions.map((question) => {
      const localized = localizeQuestion(question, locale);
      const selected = answers[String(question.id)] ?? '';
      const isCorrect = Boolean(selected && selected === question.correctAnswer);
      const isUnanswered = !selected;
      const tags = localized.knowledgeTags ?? [];
      tags.forEach((tag) => {
        const current = tagStats.get(tag) ?? { tag, total: 0, wrong: 0 };
        current.total += 1;
        if (!isCorrect) current.wrong += 1;
        tagStats.set(tag, current);
      });
      return {
        id: question.id,
        orderNumber: question.orderNumber,
        questionType: question.questionType,
        prompt: localized.prompt,
        options: localized.options,
        selected,
        correctAnswer: question.correctAnswer,
        isCorrect,
        isUnanswered,
        isMarked: marked.includes(question.id),
        explanation: localized.explanation ?? question.explanation,
        knowledgeTags: tags,
        secondsSpent: assertNonNegativeInteger(timeSpent[String(question.id)] ?? 0, '题目耗时不正确。')
      };
    });
    const totalSeconds = Object.values(timeSpent).reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0);
    return {
      attempt: attemptMeta(attempt, attempt.paper, locale),
      summary: {
        score: attempt.score ?? 0,
        correctCount: attempt.correctCount ?? 0,
        wrongCount: attempt.wrongCount ?? 0,
        unansweredCount: attempt.unansweredCount ?? 0,
        total: questions.length,
        totalSeconds,
        averageSeconds: questions.length ? Math.round(totalSeconds / questions.length) : 0
      },
      knowledgeStats: Array.from(tagStats.values()).sort((a, b) => b.wrong - a.wrong || b.total - a.total),
      items
    };
  }

  private async requiredAppliedSyllabusVersionForSubject(subject: string) {
    const syllabusVersion = cleanString(await this.appliedSyllabusVersionForSubject(subject));
    if (!syllabusVersion) throw new BadRequestException(`当前学科还没有已应用的大纲，不能进入在线模考 AI 出题流程。请先上传并应用 ${subjectDisplayName(subject)} 大纲。`);
    return syllabusVersion;
  }

  private async activeStyleProfileForMockExam(subject: string, syllabusVersion: string) {
    const rows = await this.prisma.$queryRaw<MockExamStyleProfileRow[]>(Prisma.sql`
      SELECT "id", "subject", "syllabus_version" AS "syllabusVersion", "scope_type" AS "scopeType",
             "scope_id" AS "scopeId", "source_question_ids" AS "sourceQuestionIds",
             "sample_size" AS "sampleSize", "confidence", "profile", "profile_version" AS "profileVersion",
             "source_question_snapshot_hash" AS "sourceQuestionSnapshotHash", "status",
             "generated_at" AS "generatedAt"
      FROM "csca_question_style_profiles"
      WHERE "subject" = ${subject}
        AND "syllabus_version" = ${syllabusVersion}
        AND "scope_type" = 'subject'
        AND "status" = 'active'
      ORDER BY "generated_at" DESC, "id" DESC
      LIMIT 1
    `);
    return rows[0] ?? null;
  }

  private async activeGenerationProfileForMockExam(subject: string, syllabusVersion: string) {
    const rows = await this.prisma.$queryRaw<MockExamGenerationProfileRow[]>(Prisma.sql`
      SELECT "id", "subject", "syllabus_version" AS "syllabusVersion", "use_case" AS "useCase",
             "title", "series_profile_id" AS "seriesProfileId", "source_style_profile_id" AS "sourceStyleProfileId",
             "profile", "target_policy" AS "targetPolicy", "sample_size" AS "sampleSize",
             "confidence", "status", "generated_at" AS "generatedAt"
      FROM "csca_generation_profiles"
      WHERE "subject" = ${subject}
        AND "syllabus_version" = ${syllabusVersion}
        AND "use_case" = 'online_mock_exam'
        AND "status" = 'active'
      ORDER BY "generated_at" DESC, "id" DESC
      LIMIT 1
    `);
    return rows[0] ?? null;
  }

  private mockExamGenerationProfileAsStyleProfile(profile: MockExamGenerationProfileRow): MockExamStyleProfileRow & { generationProfile: MockExamGenerationProfileRow } {
    return {
      id: profile.sourceStyleProfileId ?? profile.id,
      subject: profile.subject,
      syllabusVersion: profile.syllabusVersion,
      scopeType: 'subject',
      scopeId: null,
      sourceQuestionIds: [],
      sampleSize: profile.sampleSize,
      confidence: profile.confidence,
      profile: profile.profile,
      profileVersion: '1',
      sourceQuestionSnapshotHash: `generation-profile:${profile.id}`,
      status: profile.status,
      generatedAt: profile.generatedAt,
      generationProfile: profile
    };
  }

  private async requiredStyleProfileForMockExam(subject: string, syllabusVersion: string) {
    await this.aiQuestioningService.assertOnlineMockExamGenerationReady(subject, syllabusVersion);
    const generationProfile = await this.activeGenerationProfileForMockExam(subject, syllabusVersion);
    if (generationProfile) return this.mockExamGenerationProfileAsStyleProfile(generationProfile);
    throw new BadRequestException(`当前学科还没有可用的在线模考当前出题画像，不能进入在线模考 AI 出题流程。请先导入 ${subjectDisplayName(subject)} 真题 JSON，生成连续趋势画像和在线模考当前出题画像，再生成整卷候选。`);
  }

  private mockExamGenerationProfileLineage(profile?: MockExamGenerationProfileRow | null) {
    if (!profile) return null;
    const profileRecord = recordFrom(profile.profile) ?? {};
    const targetPolicy = recordFrom(profile.targetPolicy) ?? {};
    return {
      generationProfileId: profile.id,
      seriesProfileId: profile.seriesProfileId,
      sourceStyleProfileId: profile.sourceStyleProfileId,
      sourceProfileIds: optionalNumberList(
        profileRecord.sourceProfileIds ?? targetPolicy.sourceProfileIds,
        profile.sourceStyleProfileId ? [profile.sourceStyleProfileId] : []
      ),
      sourceSnapshotHash: cleanString(
        profileRecord.sourceSnapshotHash
          ?? targetPolicy.sourceSnapshotHash
          ?? recordFrom(profileRecord.seriesProfile)?.sourceSnapshotHash
      ) || null,
      syllabusSnapshotHash: cleanString(
        profileRecord.syllabusSnapshotHash
          ?? targetPolicy.syllabusSnapshotHash
          ?? recordFrom(profileRecord.seriesProfile)?.syllabusSnapshotHash
      ) || null,
      profileWindow: cleanString(
        profileRecord.profileWindow
          ?? profileRecord.sourceWindow
          ?? profileRecord.window
          ?? targetPolicy.profileWindow
          ?? targetPolicy.sourceWindow
          ?? targetPolicy.window
      ) || null,
      profilePolicyVersion: cleanString(
        profileRecord.profilePolicyVersion
          ?? profileRecord.policyVersion
          ?? targetPolicy.profilePolicyVersion
          ?? targetPolicy.policyVersion
      ) || null
    };
  }

  private mockExamStyleProfileReference(profile: MockExamStyleProfileRow) {
    const generationProfile = (profile as MockExamStyleProfileRow & { generationProfile?: MockExamGenerationProfileRow }).generationProfile;
    const lineage = this.mockExamGenerationProfileLineage(generationProfile);
    return {
      id: profile.id,
      subject: profile.subject,
      syllabusVersion: profile.syllabusVersion,
      sampleSize: profile.sampleSize,
      confidence: profile.confidence,
      sourceQuestionIds: Array.isArray(profile.sourceQuestionIds) ? profile.sourceQuestionIds : [],
      sourceKind: generationProfile ? 'generation_profile' : 'style_profile',
      generationProfileId: lineage?.generationProfileId ?? null,
      seriesProfileId: lineage?.seriesProfileId ?? null,
      sourceStyleProfileId: lineage?.sourceStyleProfileId ?? null,
      sourceProfileIds: lineage?.sourceProfileIds ?? [],
      sourceSnapshotHash: lineage?.sourceSnapshotHash ?? null,
      syllabusSnapshotHash: lineage?.syllabusSnapshotHash ?? null,
      profileWindow: lineage?.profileWindow ?? null,
      profilePolicyVersion: lineage?.profilePolicyVersion ?? null,
      generationProfile: generationProfile
        ? {
          id: generationProfile.id,
          useCase: generationProfile.useCase,
          seriesProfileId: generationProfile.seriesProfileId,
          sourceStyleProfileId: generationProfile.sourceStyleProfileId,
          sampleSize: generationProfile.sampleSize,
          confidence: generationProfile.confidence
        }
        : null
    };
  }

  private hasMockExamStyleProfileReference(profile: unknown, reference: ReturnType<CscaMockExamService['mockExamStyleProfileReference']>) {
    const sourceStyleProfile = recordFrom(recordFrom(profile)?.sourceStyleProfile);
    if (!sourceStyleProfile) return false;
    const expectedGenerationProfileId = Number(reference.generationProfileId);
    const actualGenerationProfileId = Number(sourceStyleProfile.generationProfileId ?? recordFrom(sourceStyleProfile.generationProfile)?.id);
    if (Number.isInteger(expectedGenerationProfileId) && expectedGenerationProfileId > 0) {
      return actualGenerationProfileId === expectedGenerationProfileId
        && Number(sourceStyleProfile.seriesProfileId ?? 0) === Number(reference.seriesProfileId ?? 0)
        && cleanString(sourceStyleProfile.sourceSnapshotHash) === cleanString(reference.sourceSnapshotHash)
        && cleanString(sourceStyleProfile.syllabusSnapshotHash) === cleanString(reference.syllabusSnapshotHash);
    }
    return Number(sourceStyleProfile.id) === Number(reference.id)
      && cleanString(sourceStyleProfile.sourceKind, 'style_profile') === cleanString(reference.sourceKind, 'style_profile');
  }

  private async calibrateMockExamBlueprintSlotsWithStyleProfile(
    detail: Awaited<ReturnType<CscaMockExamService['findAdminBlueprintDetail']>>,
    styleProfile: MockExamStyleProfileRow
  ) {
    const targets = mockExamStyleTargetSequences(styleProfile, detail.slots.length);
    if (!targets.length) return detail;
    const existingProfile = recordFrom(detail.blueprint.profile) ?? {};
    const currentProfileReference = this.mockExamStyleProfileReference(styleProfile);
    const slotTargetProfiles = detail.slots.map((slot, index) => {
      const target = targets[index] ?? {};
      const calculationLoad = cleanString(target.calculationLoad, slot.calculationLoad);
      return {
        slotNumber: slot.slotNumber,
        questionForm: normalizeQuestionFormForMockExam(target.questionForm, calculationLoad === 'none' ? 'concept_judgement' : 'calculation_application'),
        cognitiveSkill: normalizeCognitiveSkillForMockExam(target.cognitiveSkill, calculationLoad === 'none' ? 'concept_discrimination' : 'standard_application'),
        difficultyBand: cleanString(target.difficultyBand, slot.difficultyBand),
        readingLoad: cleanString(target.readingLoad, slot.readingLoad),
        calculationLoad,
        targetAnswer: normalizeMockExamAnswerTarget(target.targetAnswer),
        estimatedTimeSeconds: slot.estimatedTimeSeconds,
        source: 'style_profile_distribution',
        sourceProfileId: styleProfile.id
      };
    });
    const needsSlotUpdate = detail.slots.some((slot, index) => {
      const target = slotTargetProfiles[index];
      return slot.cognitiveSkill === 'unknown'
        || slot.cognitiveSkill !== target.cognitiveSkill
        || slot.difficultyBand !== target.difficultyBand
        || slot.readingLoad !== target.readingLoad
        || slot.calculationLoad !== target.calculationLoad;
    });
    const existingTargets = Array.isArray(existingProfile.slotTargetProfiles) ? existingProfile.slotTargetProfiles : [];
    const needsProfileUpdate = JSON.stringify(existingTargets) !== JSON.stringify(slotTargetProfiles)
      || !this.hasMockExamStyleProfileReference(existingProfile, currentProfileReference);
    if (!needsSlotUpdate && !needsProfileUpdate) return detail;
    const profilePatch = {
      sourceStyleProfile: currentProfileReference,
      slotTargetProfiles,
      questionFormDistribution: Object.fromEntries(slotTargetProfiles.reduce((map, item) => {
        incrementCounter(map, item.questionForm);
        return map;
      }, new Map<string, number>())),
      cognitiveSkillDistribution: Object.fromEntries(slotTargetProfiles.reduce((map, item) => {
        incrementCounter(map, item.cognitiveSkill);
        return map;
      }, new Map<string, number>())),
      readingLoadDistribution: Object.fromEntries(slotTargetProfiles.reduce((map, item) => {
        incrementCounter(map, item.readingLoad);
        return map;
      }, new Map<string, number>())),
      calculationLoadDistribution: Object.fromEntries(slotTargetProfiles.reduce((map, item) => {
        incrementCounter(map, item.calculationLoad);
        return map;
      }, new Map<string, number>())),
      answerDistribution: Object.fromEntries(slotTargetProfiles.reduce((map, item) => {
        incrementCounter(map, item.targetAnswer);
        return map;
      }, new Map<string, number>()))
    };
    await this.prisma.$transaction(async (tx) => {
      if (needsSlotUpdate) {
        for (const target of slotTargetProfiles) {
          await tx.$executeRaw(Prisma.sql`
            UPDATE "mock_exam_blueprint_slots"
            SET "difficulty_band" = ${target.difficultyBand},
                "cognitive_skill" = ${target.cognitiveSkill},
                "reading_load" = ${target.readingLoad},
                "calculation_load" = ${target.calculationLoad},
                "generation_prompt_hints" = (
                  SELECT jsonb_agg(DISTINCT hint)
                  FROM jsonb_array_elements_text(
                    COALESCE("generation_prompt_hints", '[]'::jsonb)
                    || CAST(${JSON.stringify([
                      `题型目标：${target.questionForm}`,
                      `能力目标：${target.cognitiveSkill}`,
                      ...(target.targetAnswer ? [`答案目标：${target.targetAnswer}`] : [])
                    ])} AS jsonb)
                  ) AS hint
                ),
                "reviewer_checklist" = (
                  SELECT jsonb_agg(DISTINCT item)
                  FROM jsonb_array_elements_text(
                    COALESCE("reviewer_checklist", '[]'::jsonb)
                    || CAST(${JSON.stringify([
                      `检查题型是否接近 ${target.questionForm}`,
                      `检查能力目标是否接近 ${target.cognitiveSkill}`,
                      ...(target.targetAnswer ? [`检查正确答案是否为 ${target.targetAnswer}`] : [])
                    ])} AS jsonb)
                  ) AS item
                ),
                "updated_at" = CURRENT_TIMESTAMP
            WHERE "blueprint_id" = ${detail.blueprint.id}
              AND "slot_number" = ${target.slotNumber}
          `);
        }
      }
      if (needsProfileUpdate) {
        await tx.$executeRaw(Prisma.sql`
          UPDATE "mock_exam_blueprints"
          SET "source_profile_ids" = CAST(${JSON.stringify(Array.from(new Set([styleProfile.id, ...optionalNumberList(detail.blueprint.sourceProfileIds, [])])))} AS jsonb),
              "profile" = COALESCE("profile", '{}'::jsonb) || CAST(${JSON.stringify(profilePatch)} AS jsonb),
              "updated_at" = CURRENT_TIMESTAMP
          WHERE "id" = ${detail.blueprint.id}
        `);
      }
    });
    return this.findAdminBlueprintDetail(detail.blueprint.id);
  }

  private async ensureMockExamBlueprintHasStyleProfile(blueprintId: number) {
    let detail = await this.findAdminBlueprintDetail(blueprintId);
    const syllabusVersion = detail.blueprint.syllabusVersion || await this.requiredAppliedSyllabusVersionForSubject(detail.blueprint.subject);
    const styleProfile = await this.requiredStyleProfileForMockExam(detail.blueprint.subject, syllabusVersion);
    const sourceProfileIds = optionalNumberList(detail.blueprint.sourceProfileIds, []);
    const currentProfileReference = this.mockExamStyleProfileReference(styleProfile);
    if (!(sourceProfileIds.includes(styleProfile.id) && this.hasMockExamStyleProfileReference(detail.blueprint.profile, currentProfileReference))) {
      const nextSourceProfileIds = Array.from(new Set([styleProfile.id, ...sourceProfileIds]));
      const profilePatch = { sourceStyleProfile: currentProfileReference };
      await this.prisma.$executeRaw(Prisma.sql`
        UPDATE "mock_exam_blueprints"
        SET "source_profile_ids" = CAST(${JSON.stringify(nextSourceProfileIds)} AS jsonb),
            "profile" = COALESCE("profile", '{}'::jsonb) || CAST(${JSON.stringify(profilePatch)} AS jsonb),
            "updated_at" = CURRENT_TIMESTAMP
        WHERE "id" = ${blueprintId}
      `);
      detail = await this.findAdminBlueprintDetail(blueprintId);
    }
    detail = await this.calibrateMockExamBlueprintSlotsWithStyleProfile(detail, styleProfile);
    return { detail, styleProfile };
  }

  private async findBlueprintsForPaper(paperId: number, limit = 5) {
    const safeLimit = Math.min(50, Math.max(1, Number(limit) || 5));
    const rows = await this.prisma.$queryRaw<MockExamBlueprintRow[]>(Prisma.sql`
      SELECT "id", "subject", "title", "syllabus_version" AS "syllabusVersion",
             "source_profile_ids" AS "sourceProfileIds", "source_paper_id" AS "sourcePaperId",
             "question_count" AS "questionCount", "duration_minutes" AS "durationMinutes",
             "total_score" AS "totalScore", "status", "profile", "created_by" AS "createdBy",
             "version", "created_at" AS "createdAt", "updated_at" AS "updatedAt"
      FROM "mock_exam_blueprints"
      WHERE "source_paper_id" = ${paperId}
        AND "status" <> 'archived'
      ORDER BY "updated_at" DESC, "id" DESC
      LIMIT ${safeLimit}
    `);
    return rows.map(mapMockExamBlueprint);
  }

  private async findAdminBlueprintDetail(id: number) {
    const rows = await this.prisma.$queryRaw<MockExamBlueprintRow[]>(Prisma.sql`
      SELECT "id", "subject", "title", "syllabus_version" AS "syllabusVersion",
             "source_profile_ids" AS "sourceProfileIds", "source_paper_id" AS "sourcePaperId",
             "question_count" AS "questionCount", "duration_minutes" AS "durationMinutes",
             "total_score" AS "totalScore", "status", "profile", "created_by" AS "createdBy",
             "version", "created_at" AS "createdAt", "updated_at" AS "updatedAt"
      FROM "mock_exam_blueprints"
      WHERE "id" = ${id}
      LIMIT 1
    `);
    const row = rows[0];
    if (!row) throw new NotFoundException('模考蓝图不存在。');
    const slotRows = await this.prisma.$queryRaw<MockExamBlueprintSlotRow[]>(Prisma.sql`
      SELECT "id", "blueprint_id" AS "blueprintId", "slot_number" AS "slotNumber",
             "topic_ids" AS "topicIds", "module", "difficulty_band" AS "difficultyBand",
             "cognitive_skill" AS "cognitiveSkill", "reading_load" AS "readingLoad",
             "calculation_load" AS "calculationLoad", "estimated_time_seconds" AS "estimatedTimeSeconds",
             "generation_prompt_hints" AS "generationPromptHints", "reviewer_checklist" AS "reviewerChecklist",
             "status", "created_at" AS "createdAt", "updated_at" AS "updatedAt"
      FROM "mock_exam_blueprint_slots"
      WHERE "blueprint_id" = ${id}
      ORDER BY "slot_number" ASC, "id" ASC
    `);
    const jobRows = await this.prisma.$queryRaw<MockExamGenerationJobRow[]>(Prisma.sql`
      SELECT "id", "blueprint_id" AS "blueprintId", "target_paper_id" AS "targetPaperId",
             "status", "provider", "model", "requested_slot_numbers" AS "requestedSlotNumbers",
             "slot_results" AS "slotResults", "error", "created_by" AS "createdBy",
             "started_at" AS "startedAt", "completed_at" AS "completedAt",
             "created_at" AS "createdAt", "updated_at" AS "updatedAt"
      FROM "mock_exam_generation_jobs"
      WHERE "blueprint_id" = ${id}
      ORDER BY "updated_at" DESC, "id" DESC
      LIMIT 10
    `);
    return { blueprint: mapMockExamBlueprint(row), slots: slotRows.map(mapMockExamBlueprintSlot), generationJobs: jobRows.map(mapMockExamGenerationJob) };
  }

  private publishIssues(paper: DbPaper, questions: DbQuestion[]) {
    const errors: string[] = [];
    validatePublishable(paper.questionCount, questions.map((question) => ({
      orderNumber: question.orderNumber,
      questionType: question.questionType,
      prompt: question.prompt,
      options: optionsFromJson(question.options),
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
      knowledgeTags: tagsFromJson(question.knowledgeTags),
      status: question.status
    })), errors, paper.title);
    return Array.from(new Set(errors));
  }

  private reportQuestions(attempt: DbAttempt) {
    const snapshot = questionsFromSnapshot(attempt.questionSnapshot);
    return snapshot.length ? Promise.resolve(snapshot) : this.listPaperQuestions(attempt.paperId);
  }

  private async findPaper(slug: string) {
    try {
      const paper = await this.prisma.mockExamPaper.findFirst({ where: { slug, status: 'published' } });
      if (paper) return paper;
    } catch {
      const fallback = FALLBACK_PAPERS.find((paper) => paper.slug === slug);
      if (fallback) return fallback as DbPaper;
    }
    const fallback = FALLBACK_PAPERS.find((paper) => paper.slug === slug);
    if (fallback) return fallback as DbPaper;
    throw new NotFoundException('模考套卷不存在。');
  }

  private async findAdminPaper(idInput: string | number) {
    const id = this.parseAdminId(idInput, '模考套卷不存在。');
    const paper = await this.prisma.mockExamPaper.findFirst({ where: { id }, include: { _count: { select: { questions: true, attempts: true } } } });
    if (!paper) throw new NotFoundException('模考套卷不存在。');
    return paper;
  }

  private async findAdminQuestion(idInput: string | number) {
    const id = this.parseAdminId(idInput, '模考题目不存在。');
    const question = await this.prisma.mockExamQuestion.findFirst({ where: { id }, include: { paper: true } });
    if (!question) throw new NotFoundException('模考题目不存在。');
    return question;
  }

  private parseAdminId(idInput: string | number, message: string) {
    const id = Number(idInput);
    if (!Number.isInteger(id) || id < 1) throw new NotFoundException(message);
    return id;
  }

  private async assertEditableQuestion(existing: DbQuestion & { paper: DbPaper }, input: AdminImportQuestion) {
    const attempts = await this.prisma.mockExamAttempt.count({ where: { paperId: existing.paperId } });
    if (existing.paper.status !== 'published' || attempts === 0) return;
    const changingCore =
      (input.orderNumber !== undefined && input.orderNumber !== existing.orderNumber) ||
      (input.prompt !== undefined && input.prompt !== existing.prompt) ||
      (input.correctAnswer !== undefined && input.correctAnswer !== existing.correctAnswer) ||
      (input.options !== undefined && JSON.stringify(input.options) !== JSON.stringify(optionsFromJson(existing.options)));
    if (changingCore) throw new BadRequestException('这道题所属套卷已有作答记录；题干、选项、答案或题号需要复制为新套卷后再修改。');
  }

  private async findAttempt(idInput: string, userId: number) {
    const id = this.parseAttemptId(idInput);
    const attempt = await this.prisma.mockExamAttempt.findFirst({ where: { id, userId }, include: { paper: true } });
    if (!attempt) throw new NotFoundException('模考记录不存在。');
    return attempt;
  }

  private parseAttemptId(idInput: string) {
    const id = Number(idInput);
    if (!Number.isInteger(id) || id < 1) throw new NotFoundException('模考记录不存在。');
    return id;
  }

  private listPaperQuestions(paperId: number) {
    return this.prisma.mockExamQuestion.findMany({
      where: { paperId, status: 'published' },
      orderBy: [{ orderNumber: 'asc' }, { id: 'asc' }]
    });
  }
}

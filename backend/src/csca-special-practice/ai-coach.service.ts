import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  subjectPracticeCurrentPolicyBlockReasons
} from '../ai-questioning/subject-practice-task-family-policy';
import { isStudentConsumableAiVersionStatus } from '../ai-questioning/question-version-governance';
import { PrismaService } from '../prisma/prisma.service';
import { AIEntitlementService } from './ai-entitlement.service';
import { AICoachProviderService } from './ai-coach-provider.service';
import { AIUsageMeterService } from './ai-usage-meter.service';
import { optionsFromJson, tagsFromJson } from './csca-adaptive.types';
import { TrainingEventService } from './training-event.service';

type CoachContext = {
  userId: number;
  sessionId?: number;
  roundId?: number;
  questionId?: number;
};

type RoundItemCoachContext = {
  id: number;
  selectedAnswer: string | null;
  questionSource?: string | null;
  round: {
    sessionId: number;
    submittedAt: Date | null;
    plannerSnapshot: Prisma.JsonValue | null;
  };
};

type StructuredMistakeExplanation = {
  whyWrong: string;
  correctApproach: string;
  quickMethod: string;
  avoidNextTime: string;
};

type StructuredInteractionTransform = {
  structuredOutput?: Prisma.InputJsonValue;
  responseOutput?: string;
};

const AI_FEEDBACK_REASON_CODES = new Set([
  'unclear',
  'too_verbose',
  'wrong_language',
  'missed_my_mistake',
  'math_or_formula_unclear',
  'factually_wrong',
  'too_generic',
  'not_grounded_in_round',
  'next_step_unclear',
  'other'
]);

function parseId(value: unknown, message: string) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new NotFoundException(message);
  return id;
}

function coachQuestionKey(source: string | null | undefined, questionId: number) {
  return `${source || 'special_practice'}:${questionId}`;
}

function compactPrompt(value: string, max = 120) {
  const text = value.replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function coachLanguage(value?: unknown) {
  const language = String(value ?? 'zh').trim().toLowerCase();
  if (language === 'vi' || language.startsWith('vi-')) return 'vi';
  if (language === 'en' || language.startsWith('en-')) return 'en';
  return 'zh';
}

function questionContentLanguage(value?: unknown) {
  const language = String(value ?? 'zh').trim().toLowerCase();
  if (language === 'en' || language.startsWith('en-')) return 'en';
  return 'zh';
}

function hasHan(value: string) {
  return /[\u3400-\u9fff]/.test(value);
}

function cleanString(value: unknown, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function recordFrom(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function isFallbackOrSmokeGeneratedQuestion(value: unknown) {
  const record = recordFrom(value);
  const sourceKind = cleanString(record.sourceKind).toLowerCase();
  const generationSource = cleanString(record.generationSource).toLowerCase();
  const generationMode = cleanString(record.generationMode).toLowerCase();
  return (
    record.fallbackUsed === true ||
    record.generator === 'rule-fallback' ||
    record.status === 'generator_disabled' ||
    sourceKind.includes('smoke') ||
    generationSource.includes('smoke') ||
    generationMode.includes('smoke')
  );
}

function isOnlineMockExamApproval(value: unknown) {
  const review = recordFrom(value);
  const approval = recordFrom(review.mockExamApproval);
  return ['approved_for_mock_exam_assembly', 'assembled_in_mock_exam_draft'].includes(cleanString(approval.status));
}

function isOnlineMockExamGeneratedQuestion(generationMetadata: unknown, reviewMetadata?: unknown) {
  const metadata = recordFrom(generationMetadata);
  const scope = recordFrom(metadata.scope);
  const mockExamSlot = recordFrom(metadata.mockExamSlot);
  const generationMode = cleanString(metadata.generationMode);
  return (
    scope.targetUseCase === 'online_mock_exam' ||
    metadata.targetUseCase === 'online_mock_exam' ||
    metadata.sourceKind === 'mock_exam_blueprint_slot' ||
    metadata.generationSource === 'mock_exam_blueprint_slot' ||
    generationMode === 'online_mock_exam_candidate' ||
    generationMode.startsWith('online_mock_candidate_') ||
    Boolean(mockExamSlot.slotId || mockExamSlot.blueprintId || mockExamSlot.sourcePaperId) ||
    isOnlineMockExamApproval(reviewMetadata)
  );
}

function isPublishedSubjectPracticeAiQuestion(reviewMetadata: unknown) {
  const review = recordFrom(reviewMetadata);
  const approval = recordFrom(review.subjectPracticeAutoApproval);
  return approval.status === 'published_to_subject_practice'
    && approval.targetUseCase === 'subject_practice'
    && approval.targetQuestionBank === 'special_practice_questions';
}

function isUsableQuestionVersion(generationMetadata: unknown) {
  const metadata = recordFrom(generationMetadata);
  const governance = recordFrom(metadata.versionGovernance);
  const status = cleanString(governance.status);
  return isStudentConsumableAiVersionStatus(status);
}

function cleanOptionalText(value: unknown, max = 500) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text ? text.slice(0, max) : null;
}

function cleanFeedbackReasonCode(value: unknown) {
  const reasonCode = String(value ?? '').trim();
  return AI_FEEDBACK_REASON_CODES.has(reasonCode) ? reasonCode : null;
}

function localizedRecord<T extends Record<string, unknown>>(value: Prisma.JsonValue | unknown, language = 'zh'): T | null {
  if (language === 'zh' || !value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const localized = record[language] ?? (language === 'vi' ? record.en : undefined);
  return localized && typeof localized === 'object' && !Array.isArray(localized) ? localized as T : null;
}

function stringsFromJson(value: Prisma.JsonValue | unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : [];
}

const OPTION_TEXT_FALLBACKS: Record<string, { en: string; vi: string }> = {
  电子转移: { en: 'Electron transfer', vi: 'Chuyển electron' },
  生成沉淀: { en: 'Formation of a precipitate', vi: 'Tạo kết tủa' },
  吸收热量: { en: 'Absorption of heat', vi: 'Hấp thụ nhiệt' },
  溶液变色: { en: 'Color change in solution', vi: 'Dung dịch đổi màu' },
  降低反应速率: { en: 'Lower the reaction rate', vi: 'Giảm tốc độ phản ứng' },
  减少目标产物: { en: 'Reduce the target product', vi: 'Giảm sản phẩm mục tiêu' },
  提高原料利用率: { en: 'Improve raw material utilization', vi: 'Tăng hiệu suất sử dụng nguyên liệu' },
  使反应停止: { en: 'Stop the reaction', vi: 'Làm phản ứng dừng lại' }
};

function fallbackOptionText(text: string | undefined, id: string, language: string) {
  const source = String(text ?? '').trim();
  if (language === 'zh' || !hasHan(source)) return source;
  const mapped = OPTION_TEXT_FALLBACKS[source];
  if (mapped) return language === 'vi' ? mapped.vi : mapped.en;
  return language === 'vi' ? `Phương án ${id}` : `Option ${id}`;
}

function fallbackPromptText(prompt: string, topicTitle: string, language: string) {
  if (language === 'zh' || !hasHan(prompt)) return prompt;
  const source = prompt.replace(/^【[^】]+】\s*/, '').trim();
  if (/氧化还原反应的本质是/.test(source)) {
    return language === 'vi' ? 'bản chất của phản ứng oxi hóa khử' : 'the essence of a redox reaction';
  }
  if (/工业流程中循环利用未反应物，主要目的是/.test(source)) {
    return language === 'vi' ? 'mục đích của việc tái sử dụng chất chưa phản ứng trong quy trình công nghiệp' : 'the purpose of recycling unreacted materials in an industrial process';
  }
  return topicTitle;
}

function fallbackExplanationText(explanation: string, correctAnswer: string, topicTitle: string, language: string) {
  if (language === 'zh' || !hasHan(explanation)) return explanation;
  return language === 'vi'
    ? `Giải thích tiêu chuẩn cho câu hỏi cũ này chưa có bản dịch đầy đủ. Đáp án đúng là ${correctAnswer}. Hãy đối chiếu yêu cầu trong đề với từng lựa chọn và ôn lại "${topicTitle}".`
    : `The full standard explanation for this legacy question is not translated yet. The correct answer is ${correctAnswer}. Compare the question target with each option and review "${topicTitle}".`;
}

function safeStructuredMistakeFallback(input: {
  language: string;
  selected: string;
  selectedText?: string;
  correctAnswer: string;
  correctText?: string;
  prompt: string;
  explanation: string;
  topicTitle: string;
}): StructuredMistakeExplanation {
  const selectedText = input.selectedText && !hasHan(input.selectedText) ? input.selectedText : undefined;
  const correctText = input.correctText && !hasHan(input.correctText) ? input.correctText : undefined;
  const prompt = hasHan(input.prompt) ? input.topicTitle : compactPrompt(input.prompt, 48);
  const explanation = fallbackExplanationText(input.explanation, input.correctAnswer, input.topicTitle, input.language);
  if (input.language === 'vi') {
    return {
      whyWrong: input.selected
        ? `Bạn đã chọn ${input.selected}${selectedText ? `: ${selectedText}` : ''}, nhưng lựa chọn này không khớp với điều kiện chính trong đề.`
        : 'Bạn chưa chọn đáp án, nên lỗi chính là chưa hoàn thành bước phán đoán từ dữ kiện.',
      correctApproach: `Đáp án đúng là ${input.correctAnswer}${correctText ? `: ${correctText}` : ''}. Dựa vào giải thích chuẩn: ${explanation}`,
      quickMethod: `Quay lại "${prompt}" và nối từng điều kiện với mục tiêu cần tìm trước khi so đáp án.`,
      avoidNextTime: 'Trước khi chọn, hãy tự nói ra đề đang hỏi gì và loại bỏ lựa chọn không khớp với định nghĩa hoặc điều kiện.'
    };
  }
  if (input.language === 'en') {
    return {
      whyWrong: input.selected
        ? `You selected ${input.selected}${selectedText ? `: ${selectedText}` : ''}, but that choice does not match the key condition in the prompt.`
        : 'You did not select an answer, so the main issue is stopping before making a judgment from the given data.',
      correctApproach: `The correct answer is ${input.correctAnswer}${correctText ? `: ${correctText}` : ''}. Use the standard explanation: ${explanation}`,
      quickMethod: `Return to "${prompt}" and match each condition to the target before comparing choices.`,
      avoidNextTime: 'Before choosing, say what the question is asking and eliminate options that fail the definition or condition.'
    };
  }
  return {
    whyWrong: input.selected
      ? `你选择了 ${input.selected}${input.selectedText ? `：${input.selectedText}` : ''}，但它没有对应题干里的关键条件或目标。`
      : '你还没有选择答案，主要问题是没有先根据题干完成一次独立判断。',
    correctApproach: `正确答案是 ${input.correctAnswer}${input.correctText ? `：${input.correctText}` : ''}。标准解析依据是：${input.explanation}`,
    quickMethod: `回到题干“${compactPrompt(input.prompt, 48)}”，先把条件和要求量对应起来，再看选项。`,
    avoidNextTime: '下次先用一句话说清题目在问什么，再排除不符合定义、条件或单位的选项。'
  };
}

function sanitizeStructuredMistakeExplanation(value: StructuredMistakeExplanation, fallback: StructuredMistakeExplanation, language: string) {
  if (language === 'zh') return value;
  const keys: Array<keyof StructuredMistakeExplanation> = ['whyWrong', 'correctApproach', 'quickMethod', 'avoidNextTime'];
  return keys.reduce((next, key) => {
    next[key] = hasHan(value[key]) ? fallback[key] : value[key];
    return next;
  }, {} as StructuredMistakeExplanation);
}

function localizedQuestionContent(question: {
  prompt: string;
  options: Prisma.JsonValue;
  correctAnswer: string;
  explanation: string;
  knowledgeTags: Prisma.JsonValue;
  localizations?: Prisma.JsonValue | null;
  topic?: { title: string; localizations?: Prisma.JsonValue | null } | null;
}, topicTitleFallback: string, language: string) {
  const localized = localizedRecord<{ prompt?: unknown; options?: unknown; explanation?: unknown; knowledgeTags?: unknown }>(question.localizations, language);
  const localizedTopic = localizedRecord<{ title?: unknown }>(question.topic?.localizations, language);
  const topicTitle = cleanString(localizedTopic?.title, question.topic?.title || topicTitleFallback);
  const options = (optionsFromJson(localized?.options).length ? optionsFromJson(localized?.options) : optionsFromJson(question.options))
    .map((option) => ({ ...option, text: fallbackOptionText(option.text, option.id, language) }));
  const tags = stringsFromJson(localized?.knowledgeTags).length
    ? stringsFromJson(localized?.knowledgeTags)
    : tagsFromJson(question.knowledgeTags).filter((tag) => language === 'zh' || !hasHan(tag));
  return {
    prompt: fallbackPromptText(cleanString(localized?.prompt, question.prompt), topicTitle, language),
    options,
    explanation: fallbackExplanationText(cleanString(localized?.explanation, question.explanation), question.correctAnswer, topicTitle, language),
    knowledgeTags: tags.length ? tags : [topicTitle],
    topicTitle
  };
}

function topicLabel(topic: { code?: string | null; title: string }, language: string) {
  if (language === 'zh' || !hasHan(topic.title)) return topic.title;
  const code = String(topic.code ?? '').replace(/-/g, ' ');
  if (language === 'vi') return code || 'chủ đề yếu';
  return code ? code.replace(/\b\w/g, (char) => char.toUpperCase()) : 'Weak topic';
}

function structuredMistakeLabels(language: string) {
  if (language === 'vi') {
    return {
      whyWrong: 'Vì sao sai',
      correctApproach: 'Cách nghĩ đúng',
      quickMethod: 'Cách làm nhanh',
      avoidNextTime: 'Lần sau tránh thế nào'
    };
  }
  if (language === 'en') {
    return {
      whyWrong: 'Why it was wrong',
      correctApproach: 'Correct approach',
      quickMethod: 'Quick method',
      avoidNextTime: 'Avoid next time'
    };
  }
  return {
    whyWrong: '为什么错',
    correctApproach: '正确思路',
    quickMethod: '快速解法',
    avoidNextTime: '下次如何避免'
  };
}

function cleanStructuredMistakeExplanation(value: unknown): StructuredMistakeExplanation | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const next = {
    whyWrong: cleanString(record.whyWrong),
    correctApproach: cleanString(record.correctApproach),
    quickMethod: cleanString(record.quickMethod),
    avoidNextTime: cleanString(record.avoidNextTime)
  };
  return Object.values(next).every((text) => text.length >= 4) ? next : null;
}

function parseStructuredMistakeExplanation(output: string): StructuredMistakeExplanation | null {
  try {
    return cleanStructuredMistakeExplanation(JSON.parse(output));
  } catch {
    return null;
  }
}

function formatStructuredMistakeExplanation(structured: StructuredMistakeExplanation, language: string) {
  const labels = structuredMistakeLabels(language);
  return [
    `${labels.whyWrong}：${structured.whyWrong}`,
    `${labels.correctApproach}：${structured.correctApproach}`,
    `${labels.quickMethod}：${structured.quickMethod}`,
    `${labels.avoidNextTime}：${structured.avoidNextTime}`
  ].join('\n');
}

@Injectable()
export class AICoachService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlement: AIEntitlementService,
    private readonly provider: AICoachProviderService,
    private readonly usageMeter: AIUsageMeterService,
    private readonly trainingEvents: TrainingEventService
  ) {}

  entitlementSummary(userId: number) {
    return this.entitlement.getSummary(userId);
  }

  async hint(userId: number, body: Record<string, unknown>) {
    const language = coachLanguage(body.language);
    const contentLanguage = questionContentLanguage(body.questionLanguage ?? body.language);
    const coachContentLanguage = language;
    const roundId = body.roundId ? parseId(body.roundId, '自适应训练轮次不存在。') : undefined;
    const questionId = parseId(body.questionId, '题目不存在。');
    const context = await this.questionContext(userId, questionId, roundId);
    if (context.item?.round.submittedAt) throw new BadRequestException('本轮训练已提交，不能继续请求提示。');
    if (context.item?.selectedAnswer) throw new BadRequestException('本题已作答，不能继续请求提示。');
    const content = localizedQuestionContent(context.question, context.topic?.title ?? 'core concept', coachContentLanguage);
    const tags = content.knowledgeTags;
    const focus = tags.slice(0, 2).join(' / ') || content.topicTitle;
    const output = language === 'vi'
      ? [
        `Trước hết hãy xác định câu này đang kiểm tra: ${focus}.`,
        'Đừng vội chọn đáp án; hãy tách dữ kiện đã cho và điều cần tìm.',
        'Sau đó loại các lựa chọn không khớp với định nghĩa, điều kiện, đơn vị hoặc mục tiêu của câu hỏi.'
      ].join('\n')
      : language === 'en'
        ? [
          `First identify what this question is testing: ${focus}.`,
          'Do not rush into an option; separate the given information from the target.',
          'Then eliminate choices that do not match the definition, conditions, units, or goal of the question.'
        ].join('\n')
        : [
          `先判断这题考的是：${focus || '核心概念'}。`,
          '不要急着代答案，先把题干中的已知量和要求量分开。',
          '再排除明显不符合单位、方向、数量级或定义的选项。'
        ].join('\n');
    if (context.item) await this.markRoundItem(context.item.id, { usedHint: true });
    return this.recordInteraction(
      { userId, sessionId: context.sessionId, roundId, questionId },
      'hint',
      output,
      {
        questionId,
        topicTitle: content.topicTitle,
        tags,
        language,
        questionLanguage: contentLanguage,
        coachContentLanguage
      },
      context.topic
    );
  }

  async explain(userId: number, body: Record<string, unknown>) {
    const language = coachLanguage(body.language);
    const contentLanguage = questionContentLanguage(body.questionLanguage ?? body.language);
    const coachContentLanguage = language;
    const roundId = body.roundId ? parseId(body.roundId, '自适应训练轮次不存在。') : undefined;
    const questionId = parseId(body.questionId, '题目不存在。');
    const selected = String(body.selected ?? '').trim();
    const context = await this.questionContext(userId, questionId, roundId);
    if (context.item && !context.item.round.submittedAt && !selected) {
      throw new BadRequestException('请先作答，再查看错因解释。');
    }
    const content = localizedQuestionContent(context.question, context.topic?.title ?? 'core concept', coachContentLanguage);
    const options = content.options;
    const selectedText = options.find((option) => option.id === selected)?.text;
    const correctText = options.find((option) => option.id === context.question.correctAnswer)?.text;
    const structuredFallback = safeStructuredMistakeFallback({
      language,
      selected,
      selectedText,
      correctAnswer: context.question.correctAnswer,
      correctText,
      prompt: content.prompt,
      explanation: content.explanation,
      topicTitle: content.topicTitle
    });
    const output = JSON.stringify(structuredFallback);
    if (context.item && !context.item.round.submittedAt) await this.markRoundItem(context.item.id, { usedExplanation: true });
    return this.recordInteraction(
      { userId, sessionId: context.sessionId, roundId, questionId },
      'explain_wrong_answer',
      output,
      {
        questionId,
        selected,
        correctAnswer: context.question.correctAnswer,
        selectedText: selectedText ?? null,
        correctText: correctText ?? null,
        prompt: content.prompt,
        standardExplanation: content.explanation,
        topicTitle: content.topicTitle,
        language,
        questionLanguage: contentLanguage,
        coachContentLanguage
      },
      context.topic,
      undefined,
      (rawOutput) => {
        const structured = sanitizeStructuredMistakeExplanation(parseStructuredMistakeExplanation(rawOutput) ?? structuredFallback, structuredFallback, language);
        return {
          structuredOutput: structured as unknown as Prisma.InputJsonValue,
          responseOutput: formatStructuredMistakeExplanation(structured, language)
        };
      }
    );
  }

  async roundSummary(userId: number, body: Record<string, unknown>) {
    const language = coachLanguage(body.language);
    const contentLanguage = questionContentLanguage(body.questionLanguage ?? body.language);
    const coachContentLanguage = language;
    const roundId = parseId(body.roundId, '自适应训练轮次不存在。');
    const round = await this.prisma.cscaAdaptiveRound.findFirst({
      where: { id: roundId, session: { userId } },
      include: { session: true, items: true }
    });
    if (!round) throw new NotFoundException('自适应训练轮次不存在。');
    if (!round.submittedAt) throw new BadRequestException('请先提交本轮训练，再生成总结。');
    const existingSummary = language === 'zh'
      ? await this.prisma.cscaAIInteraction.findFirst({
        where: { userId, roundId, type: 'round_summary', status: 'success', output: { not: null } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]
      })
      : null;
    if (existingSummary) {
      return {
        id: existingSummary.id,
        type: existingSummary.type,
        provider: existingSummary.provider,
        model: existingSummary.model,
        output: existingSummary.output ?? '',
        createdAt: existingSummary.createdAt.toISOString()
      };
    }

    const total = Math.max(1, round.correctCount + round.wrongCount + round.unansweredCount);
    const accuracy = Math.round((round.correctCount / total) * 100);
    const wrongTopicIds = Array.from(new Set(round.items.filter((item) => item.isCorrect === false || item.isCorrect === null).map((item) => item.topicId)));
    const topics = wrongTopicIds.length
      ? await this.prisma.cscaExamTopic.findMany({ where: { id: { in: wrongTopicIds } } })
      : [];
    const wrongItems = round.items.filter((item) => item.isCorrect === false || item.isCorrect === null);
    const questionMap = await this.roundSummaryQuestionMap(wrongItems);
    const topicMap = new Map(topics.map((topic) => [topic.id, topic]));
    const mistakes = wrongItems.slice(0, 5).map((item) => {
      const question = questionMap.get(coachQuestionKey(item.questionSource, item.questionId));
      const topic = topicMap.get(item.topicId);
      return {
        topic: topic ? topicLabel(topic, language) : null,
        selectedAnswer: item.selectedAnswer,
        correctAnswer: question?.correctAnswer ?? null,
        isUnanswered: item.selectedAnswer === null,
        knowledgeTags: question ? localizedQuestionContent(question, topic ? topicLabel(topic, language) : 'core concept', coachContentLanguage).knowledgeTags.slice(0, 4) : []
      };
    });
    const weakTopicLabels = topics.map((topic) => topicLabel(topic, language));
    const output = language === 'vi'
      ? [
        `[Nhận định vòng này] Độ chính xác ${accuracy}%, đúng ${round.correctCount}, sai ${round.wrongCount}, chưa trả lời ${round.unansweredCount}.`,
        weakTopicLabels.length ? `[Trọng tâm tiếp theo] Ưu tiên: ${weakTopicLabels.join(', ')}.` : '[Trọng tâm tiếp theo] Vòng này chưa có chủ đề yếu rõ ràng; có thể thử mức khó hơn.',
        accuracy >= 80 ? '[Một hành động] Bắt đầu vòng tiếp theo và xem khi độ khó tăng bạn còn ổn định không.' : '[Một hành động] Ôn điểm chung của các câu sai trước, rồi làm vòng 5 câu tiếp theo.'
      ].join('\n')
      : language === 'en'
        ? [
          `[This round] Accuracy ${accuracy}%, correct ${round.correctCount}, wrong ${round.wrongCount}, unanswered ${round.unansweredCount}.`,
          weakTopicLabels.length ? `[Next focus] Prioritize: ${weakTopicLabels.join(', ')}.` : '[Next focus] No clear weak topic in this round; try a harder round.',
          accuracy >= 80 ? '[One action] Start the next round and check whether stability holds as difficulty rises.' : '[One action] Review the shared pattern in wrong answers, then start the next 5-question round.'
        ].join('\n')
        : [
          `【本轮判断】正确率 ${accuracy}%，答对 ${round.correctCount} 题，答错 ${round.wrongCount} 题，未答 ${round.unansweredCount} 题。`,
          topics.length ? `【下一步重点】优先关注：${topics.map((topic) => topic.title).join('、')}。` : '【下一步重点】本轮没有明显薄弱主题，可以继续挑战更高难度。',
          accuracy >= 80 ? '【一个动作】直接开始下一轮，观察难度提高后是否还能保持稳定。' : '【一个动作】先复盘错题中的共同误区，再开始下一轮 5 题训练。'
        ].join('\n');
    return this.recordInteraction(
      { userId, sessionId: round.sessionId, roundId },
      'round_summary',
      output,
      {
        roundId,
        correctCount: round.correctCount,
        wrongCount: round.wrongCount,
        unansweredCount: round.unansweredCount,
        weakTopics: weakTopicLabels,
        mistakes,
        language,
        questionLanguage: contentLanguage,
        coachContentLanguage
      },
      undefined,
      round.session.subject
    );
  }

  async feedback(userId: number, interactionIdValue: string, body: Record<string, unknown>) {
    const interactionId = parseId(interactionIdValue, 'AI 交互记录不存在。');
    const rating = Number(body.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new BadRequestException('反馈评分必须是 1 到 5。');
    const reasonCode = cleanFeedbackReasonCode(body.reasonCode);
    if (body.reasonCode !== undefined && !reasonCode) throw new BadRequestException('反馈原因无效。');
    const reason = cleanOptionalText(body.reason);
    const interaction = await this.prisma.cscaAIInteraction.findFirst({ where: { id: interactionId, userId } });
    if (!interaction) throw new NotFoundException('AI 交互记录不存在。');
    const existing = await this.prisma.cscaAIInteractionFeedback.findFirst({ where: { interactionId, userId } });
    const feedback = existing
      ? await this.prisma.cscaAIInteractionFeedback.update({
        where: { id: existing.id },
        data: { rating, reason, reasonCode }
      })
      : await this.prisma.cscaAIInteractionFeedback.create({
        data: {
          interactionId,
          userId,
          rating,
          reason,
          reasonCode
        }
      });
    await this.trainingEvents.record({
      userId,
      subject: interaction.subject,
      sessionId: interaction.sessionId,
      roundId: interaction.roundId,
      questionId: interaction.questionId,
      eventType: 'ai_feedback_submitted',
      metadata: {
        interactionId,
        rating: feedback.rating,
        reasonCode: feedback.reasonCode,
        interactionType: interaction.type
      }
    });
    return { id: feedback.id, interactionId, rating: feedback.rating, reasonCode: feedback.reasonCode, createdAt: feedback.createdAt.toISOString() };
  }

  private async questionContext(userId: number, questionId: number, roundId?: number) {
    let item: RoundItemCoachContext | null = null;
    if (roundId) {
      item = await this.prisma.cscaAdaptiveRoundItem.findFirst({
        where: { questionId, roundId, round: { session: { userId } } },
        include: { round: { select: { sessionId: true, submittedAt: true, plannerSnapshot: true } } }
      });
      if (!item) throw new NotFoundException('题目不在当前自适应训练轮中。');
      const planner = item.round.plannerSnapshot;
      if (planner && typeof planner === 'object' && !Array.isArray(planner) && planner.mode === 'intervention_verification' && !item.round.submittedAt) {
        throw new ConflictException({ code: 'INDEPENDENT_VERIFICATION_ASSISTANCE_DISABLED', message: '独立验证提交前不提供提示或解析。' });
      }
    }
    const source = item?.questionSource || 'special_practice';
    if (source === 'csca_question') {
      const question = await this.prisma.cscaQuestion.findFirst({
        where: { id: questionId, status: 'approved', sourceType: { not: 'ai' } },
        include: { topic: true }
      });
      if (!question) throw new NotFoundException('题目不存在。');
      return {
        question: {
          prompt: question.prompt,
          options: question.options,
          correctAnswer: question.correctAnswer,
          explanation: question.explanation,
          knowledgeTags: question.knowledgeTags,
          localizations: null,
          topic: { title: question.topic.title }
        },
        topic: question.topic,
        item,
        sessionId: item?.round.sessionId
      };
    }
    const question = await this.prisma.specialPracticeQuestion.findFirst({
      where: { id: questionId, status: 'published' },
      include: { topic: { select: { title: true, localizations: true } } }
    });
    if (!question) throw new NotFoundException('题目不存在。');
    await this.assertSpecialPracticeQuestionGovernable(questionId);
    const mapping = await this.prisma.cscaTopicMapping.findFirst({
      where: { sourceType: 'special_practice_question', sourceId: questionId },
      include: { topic: true }
    });
    return { question, topic: mapping?.topic, item, sessionId: item?.round.sessionId };
  }

  private async assertSpecialPracticeQuestionGovernable(questionId: number) {
    const aiRows = await this.prisma.cscaQuestion.findMany({
      where: { sourceType: 'ai', sourceQuestionId: questionId },
      select: {
        subject: true,
        status: true,
        designedDifficulty: true,
        prompt: true,
        options: true,
        explanation: true,
        syllabusVersion: true,
        generationMetadata: true,
        reviewMetadata: true,
        topic: { select: { status: true, syllabusVersion: true } }
      }
    });
    if (!aiRows.length) return;
    const active = aiRows.some((row) => (
      row.status === 'approved' &&
      row.topic?.status === 'published' &&
      row.syllabusVersion === row.topic.syllabusVersion &&
      isPublishedSubjectPracticeAiQuestion(row.reviewMetadata) &&
      !isOnlineMockExamGeneratedQuestion(row.generationMetadata, row.reviewMetadata) &&
      !isFallbackOrSmokeGeneratedQuestion(row.generationMetadata) &&
      isUsableQuestionVersion(row.generationMetadata) &&
      subjectPracticeCurrentPolicyBlockReasons(row).length === 0
    ));
    if (!active) throw new NotFoundException('题目暂不可用。');
  }

  private async roundSummaryQuestionMap(items: Array<{ questionId: number; questionSource?: string | null }>) {
    const specialIds = Array.from(new Set(items
      .filter((item) => (item.questionSource || 'special_practice') === 'special_practice')
      .map((item) => item.questionId)));
    const cscaQuestionIds = Array.from(new Set(items
      .filter((item) => item.questionSource === 'csca_question')
      .map((item) => item.questionId)));
    const [specialQuestions, cscaQuestions] = await Promise.all([
      specialIds.length ? this.prisma.specialPracticeQuestion.findMany({
        where: { id: { in: specialIds }, status: 'published' },
        include: { topic: { select: { title: true, localizations: true } } }
      }) : [],
      cscaQuestionIds.length ? this.prisma.cscaQuestion.findMany({
        where: { id: { in: cscaQuestionIds }, status: 'approved', sourceType: { not: 'ai' } },
        select: {
          id: true,
          topicId: true,
          prompt: true,
          options: true,
          correctAnswer: true,
          explanation: true,
          knowledgeTags: true,
          syllabusVersion: true
        }
      }) : []
    ]);
    const cscaTopics = cscaQuestions.length ? await this.prisma.cscaExamTopic.findMany({
      where: { id: { in: Array.from(new Set(cscaQuestions.map((question) => question.topicId))) }, status: 'published' },
      select: { id: true, title: true, syllabusVersion: true }
    }) : [];
    const cscaTopicMap = new Map(cscaTopics.map((topic) => [topic.id, topic]));
    const specialAiRows = specialIds.length ? await this.prisma.cscaQuestion.findMany({
      where: { sourceType: 'ai', sourceQuestionId: { in: specialIds } },
      select: {
        sourceQuestionId: true,
        subject: true,
        status: true,
        designedDifficulty: true,
        prompt: true,
        options: true,
        explanation: true,
        syllabusVersion: true,
        generationMetadata: true,
        reviewMetadata: true,
        topic: { select: { status: true, syllabusVersion: true } }
      }
    }) : [];
    const aiRowsBySourceQuestionId = new Map<number, typeof specialAiRows>();
    for (const row of specialAiRows) {
      if (!row.sourceQuestionId) continue;
      const rows = aiRowsBySourceQuestionId.get(row.sourceQuestionId) ?? [];
      rows.push(row);
      aiRowsBySourceQuestionId.set(row.sourceQuestionId, rows);
    }
    const map = new Map<string, {
      prompt: string;
      options: Prisma.JsonValue;
      correctAnswer: string;
      explanation: string;
      knowledgeTags: Prisma.JsonValue;
      localizations?: Prisma.JsonValue | null;
      topic?: { title: string; localizations?: Prisma.JsonValue | null } | null;
    }>();
    for (const question of specialQuestions) {
      const aiRows = aiRowsBySourceQuestionId.get(question.id) ?? [];
      const isGovernable = !aiRows.length || aiRows.some((row) => (
        row.status === 'approved' &&
        row.topic?.status === 'published' &&
        row.syllabusVersion === row.topic.syllabusVersion &&
        isPublishedSubjectPracticeAiQuestion(row.reviewMetadata) &&
        !isOnlineMockExamGeneratedQuestion(row.generationMetadata, row.reviewMetadata) &&
        !isFallbackOrSmokeGeneratedQuestion(row.generationMetadata) &&
        isUsableQuestionVersion(row.generationMetadata) &&
        subjectPracticeCurrentPolicyBlockReasons(row).length === 0
      ));
      if (!isGovernable) continue;
      map.set(coachQuestionKey('special_practice', question.id), question);
    }
    for (const question of cscaQuestions) {
      const topic = cscaTopicMap.get(question.topicId);
      if (!topic || question.syllabusVersion !== topic.syllabusVersion) continue;
      map.set(coachQuestionKey('csca_question', question.id), {
        prompt: question.prompt,
        options: question.options,
        correctAnswer: question.correctAnswer,
        explanation: question.explanation,
        knowledgeTags: question.knowledgeTags,
        localizations: null,
        topic: { title: topic.title }
      });
    }
    return map;
  }

  private async markRoundItem(id: number, data: { usedHint?: boolean; usedExplanation?: boolean }) {
    await this.prisma.cscaAdaptiveRoundItem.update({
      where: { id },
      data
    });
  }

  private async recordInteraction(
    context: CoachContext,
    type: string,
    fallbackOutput: string,
    input: unknown,
    topic?: { id: number; subject: string } | undefined,
    subject?: string,
    transform?: (output: string) => StructuredInteractionTransform
  ) {
    const startedAt = Date.now();
    const providerContext = { userId: context.userId };
    const providerConfig = await this.provider.runtimeConfig(providerContext);
    const reservation = providerConfig
      ? await this.entitlement.reserve(context.userId, type, {
        provider: providerConfig.provider,
        model: providerConfig.model,
        providerSource: providerConfig.source,
        organizationId: providerConfig.organizationId,
        providerConfigId: providerConfig.providerConfigId
      })
      : null;
    const completion = await this.provider.generate({
      type,
      input,
      fallbackOutput,
      forceFallbackReason: reservation && !reservation.allowed ? 'quota_exhausted' : undefined,
      userId: context.userId,
      providerConfig
    });
    const usage = this.usageMeter.measure({
      type,
      provider: completion.provider,
      model: completion.model,
      promptVersion: completion.promptVersion,
      input: completion.input,
      output: completion.output,
      startedAt,
      status: completion.status
    });
    const transformed = transform?.(completion.output) ?? {};
    const interaction = await this.prisma.cscaAIInteraction.create({
      data: {
        userId: context.userId,
        subject: subject ?? topic?.subject ?? null,
        topicId: topic?.id ?? null,
        questionId: context.questionId ?? null,
        sessionId: context.sessionId ?? null,
        roundId: context.roundId ?? null,
        type,
        provider: completion.provider,
        model: completion.model,
        promptVersion: completion.promptVersion,
        output: completion.output,
        structuredOutput: transformed.structuredOutput ?? Prisma.JsonNull,
        tokenUsage: usage.tokenUsage,
        costEstimate: usage.costEstimate,
        status: usage.status
      } as Prisma.CscaAIInteractionUncheckedCreateInput
    });
    const billable = Boolean((usage.tokenUsage as { billable?: boolean }).billable);
    if (reservation?.allowed && billable) {
      await this.entitlement.commit(reservation, {
        interactionId: interaction.id,
        provider: completion.provider,
        model: completion.model,
        metadata: {
          tokenUsage: usage.tokenUsage,
          costEstimate: usage.costEstimate,
          providerSource: providerConfig?.source ?? 'fallback',
          organizationId: providerConfig?.organizationId ?? null,
          organizationProviderConfigId: providerConfig?.providerConfigId ?? null
        }
      });
    } else if (reservation?.allowed) {
      await this.entitlement.refund(reservation, {
        interactionId: interaction.id,
        reason: completion.status === 'success' ? 'not_billable' : completion.status,
        provider: completion.provider,
        model: completion.model
      });
    }
    await this.trainingEvents.record({
      userId: context.userId,
      subject: subject ?? topic?.subject ?? null,
      sessionId: context.sessionId ?? null,
      roundId: context.roundId ?? null,
      questionId: context.questionId ?? null,
      eventType: type === 'hint' ? 'ai_hint_requested' : type === 'explain_wrong_answer' ? 'ai_explanation_requested' : 'ai_round_summary_requested',
      metadata: {
        interactionId: interaction.id,
        provider: completion.provider,
        model: completion.model,
        promptVersion: completion.promptVersion,
        status: completion.status,
        billable,
        providerSource: providerConfig?.source ?? 'fallback',
        organizationId: providerConfig?.organizationId ?? null
      }
    });
    return {
      id: interaction.id,
      type: interaction.type,
      provider: interaction.provider,
      model: interaction.model,
      output: transformed.responseOutput ?? completion.output,
      structuredExplanation: transformed.structuredOutput ?? null,
      createdAt: interaction.createdAt.toISOString()
    };
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type SourcePolicy = {
  allowQuestionDisplay?: unknown;
  allowPromptRawText?: unknown;
  allowExplanationReuse?: unknown;
};

function policyRecord(value: unknown): SourcePolicy {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as SourcePolicy : {};
}

function naturalQuestionOrder(left: string, right: string) {
  const leftNumber = Number(left);
  const rightNumber = Number(right);
  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) return leftNumber - rightNumber;
  return left.localeCompare(right, undefined, { numeric: true });
}

function optionRows(value: unknown): Array<{ key: string; text: string }> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, index) => {
    if (typeof item === 'string') return [{ key: String.fromCharCode(65 + index), text: item }];
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const record = item as Record<string, unknown>;
    const text = String(record.text ?? record.label ?? record.value ?? '').trim();
    if (!text) return [];
    return [{ key: String(record.key ?? record.id ?? String.fromCharCode(65 + index)).trim(), text }];
  });
}

@Injectable()
export class AgentPastPaperQuestionService {
  constructor(private readonly prisma: PrismaService) {}

  async index(slug: string) {
    const paper = await this.loadPaper(slug);
    const source = paper.sourceDocument;
    if (!source) return this.unavailable(paper, 'source_not_bound');
    const policy = policyRecord(source.usagePolicy);
    if (source.status !== 'active') return this.unavailable(paper, 'source_not_active');
    if (policy.allowQuestionDisplay === false || policy.allowPromptRawText === false) {
      return this.unavailable(paper, 'source_display_not_allowed');
    }
    const questions = [...source.questions]
      .sort((left, right) => naturalQuestionOrder(left.questionNumber, right.questionNumber))
      .map((question) => ({
        id: question.id,
        questionNumber: question.questionNumber,
        pageNumber: question.pageNumber,
        canAnswer: Boolean((paper.hasAnswers || paper.hasSolutions) && question.correctAnswer),
        promptPreview: question.promptText ? question.promptText.replace(/\s+/g, ' ').trim().slice(0, 180) : null
      }));
    return {
      schemaVersion: '1' as const,
      status: questions.length ? 'ready' as const : 'unavailable' as const,
      reasonCode: questions.length ? null : 'source_has_no_questions',
      paper: { slug: paper.slug, title: paper.title, subject: paper.subject },
      source: { label: source.sourceLabel, questionCount: questions.length },
      questions
    };
  }

  async question(slug: string, questionId: number) {
    const { paper, source, policy, question } = await this.resolveQuestion(slug, questionId);
    const mayShowAnswer = paper.hasAnswers || paper.hasSolutions;
    return {
      schemaVersion: '1' as const,
      paper: { slug: paper.slug, title: paper.title, subject: paper.subject },
      source: { id: source.id, label: source.sourceLabel },
      question: {
        id: question.id,
        questionNumber: question.questionNumber,
        pageNumber: question.pageNumber,
        prompt: question.promptText,
        options: optionRows(question.options),
        correctAnswer: mayShowAnswer ? question.correctAnswer : null,
        explanation: mayShowAnswer && policy.allowExplanationReuse !== false ? question.explanation : null,
        topicCodes: Array.isArray(question.topicCodes) ? question.topicCodes.filter((item): item is string => typeof item === 'string').slice(0, 12) : []
      },
      citation: {
        paperSlug: paper.slug,
        paperTitle: paper.title,
        sourceLabel: source.sourceLabel,
        sourceQuestionId: question.id,
        questionNumber: question.questionNumber,
        pageNumber: question.pageNumber
      }
    };
  }

  async gradableQuestion(slug: string, questionId: number) {
    const { paper, source, question } = await this.resolveQuestion(slug, questionId);
    if (!(paper.hasAnswers || paper.hasSolutions) || !question.correctAnswer) {
      throw new NotFoundException('这道真题尚未配置可核验的答案。');
    }
    return { paper, source, question };
  }

  private async resolveQuestion(slug: string, questionId: number) {
    const paper = await this.loadPaper(slug);
    const source = paper.sourceDocument;
    if (!source || source.status !== 'active') throw new NotFoundException('这份真题尚未建立可引用的题目索引。');
    const policy = policyRecord(source.usagePolicy);
    if (policy.allowQuestionDisplay === false || policy.allowPromptRawText === false) {
      throw new NotFoundException('这份真题当前不允许展示题目正文。');
    }
    const question = source.questions.find((item) => item.id === questionId);
    if (!question || !question.promptText) throw new NotFoundException('指定题目不属于当前真题或正文尚未就绪。');
    return { paper, source, policy, question };
  }

  private async loadPaper(slug: string) {
    const paper = await this.prisma.pastPaper.findFirst({
      where: { slug, isPublished: true, deletedAt: null },
      select: {
        id: true, slug: true, title: true, subject: true, version: true, hasAnswers: true, hasSolutions: true,
        sourceDocument: {
          select: {
            id: true, status: true, sourceLabel: true, usagePolicy: true,
            questions: {
              select: {
                id: true, questionNumber: true, pageNumber: true, promptText: true,
                options: true, correctAnswer: true, explanation: true, topicCodes: true,
                promptHash: true, topicId: true, syllabusVersion: true, reviewStatus: true,
                analysisConfidence: true, updatedAt: true
              }
            }
          }
        }
      }
    });
    if (!paper) throw new NotFoundException('真题资料不存在或尚未发布。');
    return paper;
  }

  private unavailable(paper: { slug: string; title: string; subject: string }, reasonCode: string) {
    return {
      schemaVersion: '1' as const,
      status: 'unavailable' as const,
      reasonCode,
      paper: { slug: paper.slug, title: paper.title, subject: paper.subject },
      source: null,
      questions: []
    };
  }
}

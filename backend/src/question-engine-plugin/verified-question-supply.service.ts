import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { createHash, randomInt, randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AdaptivePlannedTopic } from '../csca-special-practice/csca-adaptive.types';
import { VerifiedMathSupplyDemandSchema, type VerifiedMathSupplyDemand, type QuestionSupplyDemandV1, type QuestionSupplyDispatchResult, type QuestionSupplyProductionAdapter } from '../agent/question-supply-fulfillment.contract';
import { QuestionEnginePluginRegistryService } from './question-engine-plugin-registry.service';
import { VerifiedQuestionPublicationService } from './verified-question-publication.service';
import { VERIFIED_MATH_PLUGIN_ID, type MathDifficulty } from './verified-math143.adapter';

const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
@Injectable()
export class VerifiedQuestionSupplyService implements QuestionSupplyProductionAdapter {
  private readonly running = new Map<string, Promise<number[]>>();
  constructor(private readonly prisma: PrismaService, private readonly registry: QuestionEnginePluginRegistryService,
    private readonly publication: VerifiedQuestionPublicationService) {}
  isEnabled() { return this.registry.isVerifiedMathEnabled(); }

  async dispatch(value: QuestionSupplyDemandV1 | VerifiedMathSupplyDemand): Promise<QuestionSupplyDispatchResult> {
    const parsed = VerifiedMathSupplyDemandSchema.safeParse(value);
    if (!parsed.success) return { status: 'unsupported', adapterVersion: VERIFIED_MATH_PLUGIN_ID, externalRequestId: null, generationInvoked: false,
      reason: 'only_math_v2_ordinary_practice_demands_supported' };
    if (!this.isEnabled()) throw new ServiceUnavailableException('VERIFIED_MATH_PLUGIN_NOT_READY');
    const input = parsed.data;
    const key = createHash('sha256').update(JSON.stringify([VERIFIED_MATH_PLUGIN_ID, input.requestKey, input.userId ?? null,
      input.topicId, input.topicCode, input.difficulty, input.requestedCount, input.sourcePolicy])).digest('hex');
    const task = await this.prisma.verifiedQuestionGenerationTask.upsert({ where: { requestKey: key }, update: {}, create: {
      requestKey: key, userId: input.userId, pluginId: VERIFIED_MATH_PLUGIN_ID, input: json(input)
    } });
    // The durable task owns generation; callers may wait or poll its public status.
    void this.run(task.id).catch(() => undefined);
    return { status: 'queued', adapterVersion: VERIFIED_MATH_PLUGIN_ID, externalRequestId: task.id, generationInvoked: true };
  }

  async preparePractice(userId: number, requestKey: string, topics: AdaptivePlannedTopic[], count: number, difficulty?: MathDifficulty, excludedIds: number[] = []) {
    if (!this.isEnabled() || !topics.length) return;
    const catalog = this.registry.mathCatalog().cells;
    for (let index = 0; index < count; index++) {
      const topic = topics[index % topics.length];
      const band = difficulty ?? (/难|提高|挑战|hard/.test(topic.targetDifficulty) ? 'hard' : /中|medium/.test(topic.targetDifficulty) ? 'medium' : 'basic');
      if (!catalog.some(cell => cell.topicCode === topic.code && cell.difficulty === band)) continue;
      const dispatched = await this.dispatch({ schemaVersion: 'question-supply-plugin-v2', source: 'student_free_practice', subjectCode: 'math',
        requestKey: `${requestKey}:${index}`, topicId: topic.topicId, topicCode: topic.code, difficulty: band,
        requestedCount: 1, userId, excludedIds, sourcePolicy: 'reviewed_published_only' });
      if (dispatched.status !== 'queued') throw new ServiceUnavailableException('MATH_SUPPLY_DEMAND_REJECTED');
      const ids = await this.run(dispatched.externalRequestId);
      excludedIds.push(...ids);
    }
  }
  async status(userId: number, taskId: string) {
    const task = await this.prisma.verifiedQuestionGenerationTask.findFirst({ where: { id: taskId, userId } });
    if (!task) throw new NotFoundException('出题任务不存在。');
    return { id: task.id, pluginId: task.pluginId, state: task.state, publishedCount: Array.isArray(task.questionIds) ? task.questionIds.length : 0,
      errorCode: task.errorCode, createdAt: task.createdAt, updatedAt: task.updatedAt };
  }
  private run(taskId: string): Promise<number[]> {
    const existing = this.running.get(taskId);
    if (existing) return existing;
    const work = this.execute(taskId).finally(() => this.running.delete(taskId));
    this.running.set(taskId, work);
    return work;
  }
  private async execute(taskId: string) {
    const task = await this.prisma.verifiedQuestionGenerationTask.findUniqueOrThrow({ where: { id: taskId } });
    if (task.state === 'published') return task.questionIds as number[];
    const input = VerifiedMathSupplyDemandSchema.parse(task.input);
    const owner = randomUUID();
    const claim = await this.prisma.verifiedQuestionGenerationTask.updateMany({ where: { id: taskId, attemptCount: { lt: 3 },
      OR: [{ state: { in: ['queued', 'failed'] } }, { state: 'running', leaseUntil: { lt: new Date() } }] },
      data: { state: 'running', leaseOwner: owner, leaseUntil: new Date(Date.now() + 180000), attemptCount: { increment: 1 }, errorCode: null } });
    if (!claim.count) throw new ServiceUnavailableException({ code: 'QUESTION_GENERATION_PENDING', taskId });
    const ids: number[] = Array.isArray(task.questionIds) ? task.questionIds.filter((id): id is number => typeof id === 'number') : [];
    try {
      const cell = this.registry.mathCatalog().cells.find(item => item.id === `${input.topicCode}:${input.difficulty}`);
      if (!cell) throw Error('MATH_SCOPE_UNSUPPORTED');
      for (let index = ids.length; index < input.requestedCount; index++) {
        let accepted = false;
        for (let attempt = 0; attempt < 8 && !accepted; attempt++) {
          const heartbeat = await this.prisma.verifiedQuestionGenerationTask.updateMany({ where: { id: taskId, state: 'running', leaseOwner: owner }, data: { leaseUntil: new Date(Date.now() + 180000) } });
          if (!heartbeat.count) throw Error('MATH_TASK_LEASE_LOST');
          const scope = cell.scopes[(index + attempt + randomInt(cell.scopes.length)) % cell.scopes.length];
          let output;
          try { output = await this.registry.generateVerifiedMath({ cellId: cell.id, scopeId: scope.id, seed: randomInt(Math.max(1, scope.capacity)) }); }
          catch { continue; }
          const question = await this.publication.publish(output, { topicId: input.topicId, topicCode: input.topicCode, difficulty: input.difficulty,
            userId: input.userId, excludedIds: [...input.excludedIds, ...ids], taskId, leaseOwner: owner });
          if (!question) continue;
          ids.push(question.id); accepted = true;
          const saved = await this.prisma.verifiedQuestionGenerationTask.updateMany({ where: { id: taskId, state: 'running', leaseOwner: owner }, data: { questionIds: ids } });
          if (!saved.count) throw Error('MATH_TASK_LEASE_LOST');
        }
        if (!accepted) throw Error('MATH_NO_QUALIFIED_QUESTION');
      }
      const completed = await this.prisma.verifiedQuestionGenerationTask.updateMany({ where: { id: taskId, state: 'running', leaseOwner: owner }, data: { state: 'published', leaseOwner: null, leaseUntil: null, questionIds: ids } });
      if (!completed.count) throw Error('MATH_TASK_LEASE_LOST');
      return ids;
    } catch (error) {
      await this.prisma.verifiedQuestionGenerationTask.updateMany({ where: { id: taskId, leaseOwner: owner }, data: {
        state: 'failed', leaseOwner: null, leaseUntil: null, errorCode: error instanceof Error && /^[A-Z_]+$/.test(error.message) ? error.message : 'VERIFIED_MATH_TASK_FAILED'
      } });
      throw new ServiceUnavailableException({ code: 'VERIFIED_MATH_TASK_FAILED', taskId, message: '数学题目准备未完成，请稍后重试。' });
    }
  }
}

import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { ReviewResult } from '../ai-questioning/ai-questioning.types';
import { ADAPTIVE_EXPOSURE_SOURCE } from '../csca-special-practice/csca-adaptive.types';
import { isStandardStudentChoiceQuestion } from '../csca-special-practice/student-question-eligibility';
import { MATH_ENGINE_SOURCE, isReadyMathEngineQuestion, mathEngineContentHash } from '../csca-special-practice/math-engine-question.policy';
import { evaluateQuestionCandidateWriteGate } from './question-candidate-write-gate';
import { QuestionEnginePluginRegistryService } from './question-engine-plugin-registry.service';
import { VERIFIED_MATH_PLUGIN_ID, type MathGenerationOutput, type MathDifficulty } from './verified-math143.adapter';

const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
@Injectable()
export class VerifiedQuestionPublicationService {
  constructor(private readonly prisma: PrismaService, private readonly registry: QuestionEnginePluginRegistryService) {}

  async publish(output: MathGenerationOutput, binding: { topicId: number; topicCode: string; difficulty: MathDifficulty; userId?: number; excludedIds?: number[]; taskId: string; leaseOwner: string }) {
    this.registry.assertVerifiedMath(output);
    const r = output.result, candidate = r.candidate;
    if (!isStandardStudentChoiceQuestion(candidate) || !r.questionArtifact.identity.identityHash) throw new ServiceUnavailableException('MATH_PUBLICATION_SCHEMA_REJECTED');
    return this.prisma.$transaction(async tx => {
      const leases = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM verified_question_generation_tasks WHERE id = ${binding.taskId}
        AND state = 'running' AND lease_owner = ${binding.leaseOwner} AND lease_until > CURRENT_TIMESTAMP FOR UPDATE`;
      if (!leases.length) throw new ServiceUnavailableException('MATH_PUBLICATION_LEASE_LOST');
      const topic = await tx.cscaExamTopic.findFirst({ where: { id: binding.topicId, code: binding.topicCode, subject: 'math', status: 'published' } });
      if (!topic || r.questionArtifact.cellId !== `${topic.code}:${binding.difficulty}`) throw new ServiceUnavailableException('MATH_PUBLICATION_TOPIC_REJECTED');
      const scopeId = output.task.scopeId, identityHash = r.questionArtifact.identity.identityHash;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${scopeId}), hashtext(${identityHash}))`;
      const existing = await tx.cscaQuestion.findFirst({ where: { sourceType: MATH_ENGINE_SOURCE, topicId: topic.id,
        AND: [{ generationMetadata: { path: ['mathIdentityHash'], equals: identityHash } }, { generationMetadata: { path: ['scopeId'], equals: scopeId } }] } });
      if (existing) {
        if (existing.status !== 'approved' || !isReadyMathEngineQuestion(existing) || binding.excludedIds?.includes(existing.id)) return null;
        if (binding.userId && await tx.cscaQuestionExposure.findFirst({ where: { userId: binding.userId, questionId: existing.id, source: `${ADAPTIVE_EXPOSURE_SOURCE}:csca_question` } })) return null;
        return existing;
      }
      if (await tx.cscaQuestion.findFirst({ where: { topicId: topic.id, prompt: candidate.prompt } })) return null;
      const generation = { generator: 'local-deterministic', intendedUse: 'subject_practice',
        automatedCandidateLeakageGate: { status: 'clear', blocked: false, scope: 'verified_engine_identity_and_exact_prompt' } };
      // The complete frozen engine review remains in sourceVerification. This host
      // review states only the registered deterministic checks, never student calibration.
      const review: ReviewResult = { status: 'passed', issues: [], dimensions: [], sources: ['deterministic'], decision: 'approve', checkedAt: new Date().toISOString() };
      const hostCandidate = { ...candidate, topicId: topic.id, sourceType: MATH_ENGINE_SOURCE,
        designedDifficulty: binding.difficulty === 'basic' ? '基础' : binding.difficulty === 'medium' ? '中等' : '较难',
        syllabusVersion: topic.syllabusVersion, optionMetadata: (candidate.optionMetadata ?? []) as [] };
      const gate = evaluateQuestionCandidateWriteGate({ candidate: { ...hostCandidate, localizations: undefined }, review,
        generationMetadata: generation, sourceSimilarity: { scope: 'exact_prompt_and_verified_identity', legacySemanticSimilarity: 'not_backfilled' },
        verifiedMathEvidence: { pluginId: VERIFIED_MATH_PLUGIN_ID, version: '1.43.0', contentBound: true,
          beforeStorePassed: r.admission.status === 'eligible_before_history', oraclePassed: r.gate.checks.oracle === true, teachingPassed: r.gate.checks.quality === true } });
      if (gate.decision !== 'allow_candidate_write') throw new ServiceUnavailableException('MATH_CANDIDATE_WRITE_GATE_REJECTED');
      const created = await tx.cscaQuestion.create({ data: {
        subject: 'math', topicId: topic.id, sourceType: MATH_ENGINE_SOURCE, status: 'pending_review',
        designedDifficulty: hostCandidate.designedDifficulty, questionType: candidate.questionType, prompt: candidate.prompt, options: json(candidate.options),
        correctAnswer: candidate.correctAnswer, explanation: candidate.explanation, knowledgeTags: json(candidate.knowledgeTags),
        optionMetadata: json(candidate.optionMetadata ?? []), syllabusVersion: topic.syllabusVersion,
        generationMetadata: json({ ...generation, sourceKind: 'verified_math_engine_1_43', pluginId: VERIFIED_MATH_PLUGIN_ID, engineVersion: '1.43.0',
          generationTaskId: binding.taskId, cellId: output.task.cellId, scopeId, seed: output.task.seed, mathIdentityHash: identityHash,
          nativeTopicId: candidate.topicId, hostTopicCode: topic.code, localizations: candidate.localizations, questionPlan: r.plan,
          questionArtifact: r.questionArtifact, generationSource: r.generationSource, sourceCandidate: candidate,
          sourceVerification: { gate: r.gate, admission: r.admission, pedagogy: r.pedagogy }, sourceContentHash: r.contentHash,
          sourceFingerprint: r.fingerprint, candidateWriteGate: gate,
          practiceAdmission: { version: 'verified-math-practice-v1', state: 'ready', scope: 'ordinary_practice_only',
            contentHash: mathEngineContentHash(candidate), historyDecision: 'verified_engine_identity_and_exact_prompt', studentCalibrated: false } }),
        reviewMetadata: json({ mathEngine: { sourceAdmission: r.admission, checks: r.gate.checks, qualification: 'machine_verified_ordinary_practice',
          independentMeasurementAllowed: false, providerCalls: 0, costUsd: 0 }, candidateWriteGate: gate, review })
      } });
      // Only this publication boundary changes a verified candidate into student inventory.
      return tx.cscaQuestion.update({ where: { id: created.id }, data: { status: 'approved', reviewMetadata: json({
        mathEngine: { sourceAdmission: r.admission, checks: r.gate.checks, qualification: 'machine_verified_ordinary_practice', independentMeasurementAllowed: false, providerCalls: 0, costUsd: 0 },
        candidateWriteGate: gate, review, publication: { policyVersion: 'verified-math-publication-v1', state: 'published', scope: 'ordinary_practice_only',
          pluginId: VERIFIED_MATH_PLUGIN_ID, taskId: binding.taskId, publishedAt: new Date().toISOString() }
      }) } });
    });
  }
}

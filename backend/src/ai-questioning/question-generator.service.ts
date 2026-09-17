import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { GeneratedQuestionCandidate } from './ai-questioning.types';

type BlueprintRow = {
  id: number;
  subject: string;
  topicId: number;
  topicCode?: string | null;
  topicModule?: string | null;
  topicTitle: string;
  syllabusVersion: string;
  examScope?: string | null;
  allowedQuestionTypes?: unknown;
  difficultyRange?: unknown;
  excludedScope?: unknown;
  sourceLabel?: string | null;
  sourceUrl?: string | null;
  difficulty: string;
  questionType: string;
  skill: string | null;
  constraints: unknown;
};

function cleanText(value: unknown) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function stringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map((item) => cleanText(item)).filter(Boolean)));
}

function recordFrom(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function isMockExamGeneration(value: unknown) {
  const record = recordFrom(value);
  const expansion = recordFrom(record.expansion);
  const generationMode = cleanText(expansion.generationMode);
  return cleanText(record.generationSource) === 'mock_exam_blueprint_slot' ||
    generationMode === 'online_mock_exam_candidate' ||
    generationMode.startsWith('online_mock_candidate_') ||
    Object.keys(recordFrom(record.mockExamSlot)).length > 0;
}

function slugText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'core';
}

@Injectable()
export class QuestionGeneratorService {
  requestHash(blueprint: BlueprintRow) {
    return createHash('sha256')
      .update(JSON.stringify({
        subject: blueprint.subject,
        topicId: blueprint.topicId,
        topicTitle: blueprint.topicTitle,
        topicCode: blueprint.topicCode ?? null,
        topicModule: blueprint.topicModule ?? null,
        syllabusVersion: blueprint.syllabusVersion,
        examScope: blueprint.examScope ?? null,
        allowedQuestionTypes: stringArray(blueprint.allowedQuestionTypes),
        difficultyRange: stringArray(blueprint.difficultyRange),
        excludedScope: stringArray(blueprint.excludedScope),
        difficulty: blueprint.difficulty,
        questionType: blueprint.questionType,
        skill: blueprint.skill,
        generationPolicyVersion: isMockExamGeneration(blueprint.constraints) ? 'online-mock-bilingual-v1' : 'subject-practice-bilingual-v1',
        constraints: blueprint.constraints
      }))
      .digest('hex');
  }

  generateFallbackCandidate(blueprint: BlueprintRow): GeneratedQuestionCandidate {
    const topic = blueprint.topicTitle || blueprint.skill || 'core concept';
    const skill = blueprint.skill || topic;
    const scope = cleanText(blueprint.examScope) || `the defining condition of ${skill}`;
    const tag = slugText(skill);
    return {
      subject: blueprint.subject,
      topicId: blueprint.topicId,
      blueprintId: blueprint.id,
      sourceType: 'ai',
      designedDifficulty: blueprint.difficulty,
      questionType: blueprint.questionType,
      prompt: `Within the CSCA syllabus scope "${scope}", which statement best matches "${skill}" in ${topic}?`,
      options: [
        { id: 'A', text: `It applies the syllabus scope and the defining condition of ${skill}.` },
        { id: 'B', text: `It ignores a required condition from the syllabus scope.` },
        { id: 'C', text: `It changes the target quantity before checking the scope conditions.` },
        { id: 'D', text: `It compares unrelated facts outside the requested scope.` }
      ],
      correctAnswer: 'A',
      explanation: `The correct answer is A because it keeps ${skill} aligned with the syllabus scope: ${scope}. The other options describe common reasoning errors that ignore the requested scope or target condition.`,
      knowledgeTags: [tag],
      optionMetadata: [
        { optionId: 'B', distractorIntent: 'Ignores a required condition.', misconceptionTags: ['condition-missing'] },
        { optionId: 'C', distractorIntent: 'Confuses the target quantity.', misconceptionTags: ['target-confusion'] },
        { optionId: 'D', distractorIntent: 'Uses unrelated comparison.', misconceptionTags: ['irrelevant-comparison'] }
      ],
      syllabusVersion: blueprint.syllabusVersion
    };
  }
}

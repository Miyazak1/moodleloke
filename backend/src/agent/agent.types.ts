import { z } from 'zod';

export const AGENT_RUNTIME_SCHEMA_VERSION = '1' as const;

export const CreateAgentConversationInputSchema = z.strictObject({
  title: z.string().trim().min(1).max(200).optional()
});

export const AgentPageContextSchema = z.strictObject({
  route: z.string().trim().min(1).max(500),
  artifactId: z.string().trim().min(1).max(120).optional(),
  entityRef: z.strictObject({
    type: z.enum(['adaptive_round', 'intervention_verification', 'mock_attempt', 'past_paper']),
    id: z.string().trim().min(1).max(120)
  }).optional(),
  selectedQuestionId: z.number().int().positive().optional(),
  questionContext: z.strictObject({
    roundId: z.number().int().positive(),
    questionId: z.number().int().positive(),
    questionNumber: z.number().int().positive(),
    subject: z.enum(['math', 'physics', 'chemistry']),
    topicTitle: z.string().trim().max(200),
    prompt: z.string().trim().min(1).max(5000),
    options: z.array(z.strictObject({ id: z.string().trim().min(1).max(40), text: z.string().trim().min(1).max(1000) })).max(12),
    selectedAnswer: z.string().trim().max(1000).optional(),
    answered: z.boolean(),
    correctAnswer: z.string().trim().max(1000).optional(),
    isCorrect: z.boolean().optional(),
    explanation: z.string().trim().max(8000).optional(),
    knowledgeTags: z.array(z.string().trim().min(1).max(200)).max(30).optional()
  }).optional()
});

export const SubmitAgentMessageInputSchema = z.strictObject({
  clientRequestId: z.string().trim().min(1).max(120),
  text: z.string().trim().max(8000).default(''),
  locale: z.enum(['zh-CN', 'en']).default('zh-CN'),
  surface: z.enum(['learning_workspace', 'subject_qa']).default('learning_workspace'),
  attachmentIds: z.array(z.string().trim().min(1).max(120)).max(5).default([]),
  pageContext: AgentPageContextSchema.optional()
}).superRefine((input, context) => {
  if (!input.text && !input.attachmentIds.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Message text or attachments are required.' });
  }
  if (input.surface === 'subject_qa' && input.attachmentIds.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['attachmentIds'], message: 'Subject Q&A currently accepts text questions only.' });
  }
  if (input.surface === 'subject_qa' && input.pageContext && !input.pageContext.questionContext) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['pageContext'], message: 'Subject Q&A accepts only a read-only current-question context.' });
  }
});

export const StartAgentPracticeInputSchema = z.strictObject({
  clientRequestId: z.string().trim().min(1).max(120),
  questionLanguage: z.enum(['zh', 'en']).optional()
});

export const StartAgentFreePracticeInputSchema = z.strictObject({
  clientRequestId: z.string().trim().min(1).max(120),
  conversationId: z.string().trim().min(1).max(120).optional(),
  subject: z.enum(['math', 'physics', 'chemistry']),
  questionCount: z.number().int().min(1).max(10).default(5),
  questionLanguage: z.enum(['zh', 'en']).default('zh')
});

export const ContinueAgentFreePracticeInputSchema = z.strictObject({
  clientRequestId: z.string().trim().min(1).max(120),
  subject: z.enum(['math', 'physics', 'chemistry']),
  questionCount: z.number().int().min(1).max(10),
  questionLanguage: z.enum(['zh', 'en']).default('zh')
});

export const AgentTaskActionInputSchema = z.strictObject({
  clientRequestId: z.string().trim().min(1).max(120)
});

export const LearningAssistanceActionSchema = z.enum([
  'recall_concept',
  'next_step_hint',
  'show_full_solution'
]);

export const RequestLearningAssistanceInputSchema = z.strictObject({
  clientRequestId: z.string().trim().min(1).max(120),
  action: LearningAssistanceActionSchema,
  language: z.enum(['zh', 'en', 'vi']).optional(),
  questionLanguage: z.enum(['zh', 'en']).optional()
});

export const PastPaperAssistanceActionSchema = z.enum([
  'clarify_question',
  'recall_concept',
  'next_step_hint',
  'check_step',
  'show_full_solution'
]);

export const RequestPastPaperAssistanceInputSchema = z.strictObject({
  clientRequestId: z.string().trim().min(1).max(120),
  conversationId: z.string().trim().min(1).max(120),
  action: PastPaperAssistanceActionSchema,
  studentWork: z.string().trim().max(4000).optional(),
  confirmed: z.boolean().default(false),
  language: z.enum(['zh', 'en']).default('zh')
});

export const StartPastPaperAttemptInputSchema = z.strictObject({
  clientRequestId: z.string().trim().min(1).max(120),
  conversationId: z.string().trim().min(1).max(120)
});

export const SubmitPastPaperAttemptInputSchema = z.strictObject({
  clientRequestId: z.string().trim().min(1).max(120),
  selectedAnswer: z.string().trim().min(1).max(500)
});

export const ReportLearningContentIssueInputSchema = z.strictObject({
  clientRequestId: z.string().trim().min(1).max(120),
  reason: z.enum(['incorrect', 'unclear', 'answer_leak', 'rendering', 'other']),
  note: z.string().trim().max(500).optional()
});

export const AttachmentAnalysisModeSchema = z.enum([
  'general_review',
  'document_qa',
  'document_summary',
  'image_question_analysis',
  'handwritten_solution_review',
  'question_extraction',
  'document_compare',
  'knowledge_mapping'
]);

export const AnalyzeAgentAttachmentInputSchema = z.strictObject({
  clientRequestId: z.string().trim().min(8).max(120),
  studentNote: z.string().trim().max(2000).optional(),
  mode: AttachmentAnalysisModeSchema.default('general_review'),
  roundId: z.number().int().positive().optional(),
  questionId: z.number().int().positive().optional(),
  responseDepth: z.enum(['hint', 'guided', 'full']).default('guided'),
  language: z.enum(['zh', 'en', 'vi']).default('zh')
}).superRefine((input, context) => {
  if ((input.roundId === undefined) !== (input.questionId === undefined)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'roundId and questionId must be provided together.' });
  }
  if (input.mode !== 'handwritten_solution_review' && (input.roundId !== undefined || input.questionId !== undefined)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Practice question context is only valid for handwritten solution review.' });
  }
});

export const RecordTeachingInteractionInputSchema = z.strictObject({
  clientRequestId: z.string().trim().min(1).max(120),
  roundId: z.number().int().positive(),
  questionId: z.number().int().positive(),
  action: z.enum(['opened', 'parameter_changed', 'active_prompt_answered', 'completed', 'skipped']),
  value: z.union([z.string().max(200), z.number().finite(), z.boolean()]).optional()
});

export const RecordTeachingDeliveryInteractionInputSchema = z.strictObject({
  clientRequestId: z.string().trim().min(1).max(120),
  action: z.enum(['opened', 'parameter_changed', 'active_prompt_answered', 'completed']),
  value: z.union([z.string().max(200), z.number().finite(), z.boolean()]).optional()
});

export type SubmitAgentMessageInput = z.infer<typeof SubmitAgentMessageInputSchema>;
export type StartAgentPracticeInput = z.infer<typeof StartAgentPracticeInputSchema>;
export type StartAgentFreePracticeInput = z.infer<typeof StartAgentFreePracticeInputSchema>;
export type ContinueAgentFreePracticeInput = z.infer<typeof ContinueAgentFreePracticeInputSchema>;
export type AgentTaskActionInput = z.infer<typeof AgentTaskActionInputSchema>;
export type LearningAssistanceAction = z.infer<typeof LearningAssistanceActionSchema>;
export type RequestLearningAssistanceInput = z.infer<typeof RequestLearningAssistanceInputSchema>;
export type PastPaperAssistanceAction = z.infer<typeof PastPaperAssistanceActionSchema>;
export type RequestPastPaperAssistanceInput = z.infer<typeof RequestPastPaperAssistanceInputSchema>;
export type StartPastPaperAttemptInput = z.infer<typeof StartPastPaperAttemptInputSchema>;
export type SubmitPastPaperAttemptInput = z.infer<typeof SubmitPastPaperAttemptInputSchema>;
export type ReportLearningContentIssueInput = z.infer<typeof ReportLearningContentIssueInputSchema>;
export type AnalyzeAgentAttachmentInput = z.infer<typeof AnalyzeAgentAttachmentInputSchema>;
export type RecordTeachingInteractionInput = z.infer<typeof RecordTeachingInteractionInputSchema>;
export type RecordTeachingDeliveryInteractionInput = z.infer<typeof RecordTeachingDeliveryInteractionInputSchema>;
export type AgentIntent =
  | 'today_plan'
  | 'learning_status'
  | 'review_queue'
  | 'mock_exams'
  | 'past_papers'
  | 'capability_help'
  | 'unsupported';
export type AgentResolvedIntent = AgentIntent | 'clarify';

export function routeAgentIntent(text: string): AgentIntent {
  if (/(今天|下一步|学什么|学习计划|复习什么|today|next|plan|what.*study|revise next)/i.test(text)) return 'today_plan';
  if (/(真题|历年题|past[ -]?paper|exam paper|试卷资料)/i.test(text)) return 'past_papers';
  if (/(模考记录|模拟考试记录|模考成绩|mock[ -]?exam|mock attempt)/i.test(text)) return 'mock_exams';
  if (/(错题|复习队列|待复习|mistake|wrong question|review queue)/i.test(text)) return 'review_queue';
  if (/(学习情况|学习状态|掌握情况|薄弱|进度|表现|mastery|learning status|progress|weakness|performance)/i.test(text)) return 'learning_status';
  if (/(你能做什么|有什么能力|怎么使用|怎么用|what can you do|how (?:do i|to) use)/i.test(text)) return 'capability_help';
  return 'unsupported';
}

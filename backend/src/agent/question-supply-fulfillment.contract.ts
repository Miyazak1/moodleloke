import { z } from 'zod';

export const QUESTION_SUPPLY_DEMAND_VERSION = '1' as const;
export const QUESTION_SUPPLY_PLUGIN_CONTRACT_VERSION = 'question-supply-plugin-v1' as const;
export const QUESTION_SUPPLY_SHADOW_ADAPTER_VERSION = 'question-supply-shadow-noop-v1' as const;

export const ApprovedQuestionSupplyQueryV1Schema = z.object({
  schemaVersion: z.literal(QUESTION_SUPPLY_PLUGIN_CONTRACT_VERSION),
  subjectCode: z.enum(['math', 'physics', 'chemistry']),
  topicIds: z.array(z.number().int().positive()).max(20),
  difficulty: z.string().max(24).nullable(),
  taskType: z.string().min(1).max(48),
  sourcePolicy: z.literal('reviewed_published_only'),
  limit: z.number().int().positive().max(100)
}).strict();

export type ApprovedQuestionSupplyQueryV1 = z.infer<typeof ApprovedQuestionSupplyQueryV1Schema>;

export type ApprovedQuestionSupplyItem = Readonly<{
  id: string;
  subjectCode: 'math' | 'physics' | 'chemistry';
  topicIds: number[];
  difficulty: string | null;
  publishedAt: string;
}>;

export const QuestionSupplyDemandV1Schema = z.object({
  schemaVersion: z.literal(QUESTION_SUPPLY_DEMAND_VERSION),
  demandKey: z.string().length(64),
  requestId: z.string().min(1),
  requestCycle: z.number().int().positive(),
  source: z.enum(['agent_today_plan', 'intervention_verification']),
  subjectCode: z.enum(['math', 'physics', 'chemistry']),
  topicIds: z.array(z.number().int().positive()).max(20),
  difficulty: z.string().max(24).nullable(),
  taskType: z.string().min(1).max(48),
  verificationPhase: z.enum(['immediate', 'retention', 'transfer']).nullable(),
  sourcePolicy: z.literal('reviewed_published_only'),
  requestedCount: z.number().int().positive().max(100),
  lastKnownAvailableCount: z.number().int().nonnegative(),
  deficitCount: z.number().int().positive(),
  constraints: z.record(z.string(), z.unknown()),
  observedAt: z.string().datetime()
}).strict();

export type QuestionSupplyDemandV1 = z.infer<typeof QuestionSupplyDemandV1Schema>;

export type QuestionSupplyDispatchResult = {
  status: 'shadow_recorded';
  adapterVersion: typeof QUESTION_SUPPLY_SHADOW_ADAPTER_VERSION;
  externalRequestId: null;
  generationInvoked: false;
};

export const QUESTION_SUPPLY_PRODUCTION_ADAPTER = Symbol('QUESTION_SUPPLY_PRODUCTION_ADAPTER');

export const QUESTION_CATALOG_READ_PORT = Symbol('QUESTION_CATALOG_READ_PORT');

export interface QuestionCatalogReadPort {
  countApproved(query: ApprovedQuestionSupplyQueryV1): Promise<number>;
  listApproved(query: ApprovedQuestionSupplyQueryV1): Promise<ApprovedQuestionSupplyItem[]>;
}

export interface QuestionSupplyDemandPort {
  dispatch(demand: QuestionSupplyDemandV1): Promise<QuestionSupplyDispatchResult>;
}

/** @deprecated Use QuestionSupplyDemandPort. Kept as an internal symbol-compatible alias during extraction. */
export interface QuestionSupplyProductionAdapter extends QuestionSupplyDemandPort {}

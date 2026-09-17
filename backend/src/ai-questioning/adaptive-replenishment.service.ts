import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { jsonInput } from './ai-questioning.types';

type InventoryQuery = Record<string, unknown>;

type InventoryRow = {
  subject: string;
  topicId: number;
  topicCode: string | null;
  topicTitle: string;
  difficultyBand: string;
  questionType: string;
  manualStock: number;
  aiFormalStock: number;
  candidateCount: number;
  failedCount: number;
  exposureCount: number;
  attemptCount: number;
  uniqueUserCount: number;
  fallbackDrawCount: number;
  noQuestionErrorCount: number;
};

type TeamScopeRow = {
  organizationId: number | null;
  organizationName: string | null;
  organizationCohortId: number | null;
  cohortName: string | null;
  status: string | null;
  memberCount: number;
};

function cleanString(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function optionalInt(value: unknown) {
  const next = Number(value);
  return Number.isInteger(next) && next > 0 ? next : undefined;
}

function boundedLimit(value: unknown, fallback: number, max: number) {
  const next = optionalInt(value);
  return Math.min(next ?? fallback, max);
}

function stockPolicyForDifficulty(difficultyBand: string) {
  switch (difficultyBand) {
    case 'basic':
      return { safetyStock: 5, cycleTargetStock: 12, maxStockCap: 36 };
    case 'medium':
      return { safetyStock: 4, cycleTargetStock: 8, maxStockCap: 24 };
    case 'hard':
      return { safetyStock: 3, cycleTargetStock: 5, maxStockCap: 15 };
    case 'challenge':
      return { safetyStock: 2, cycleTargetStock: 3, maxStockCap: 9 };
    default:
      return { safetyStock: 3, cycleTargetStock: 6, maxStockCap: 18 };
  }
}

function riskForStock(globalEffectiveStock: number, safetyStock: number, cycleTargetStock: number, pressure: number) {
  const riskReasons: string[] = [];
  if (globalEffectiveStock < safetyStock) riskReasons.push('below_safety_stock');
  if (globalEffectiveStock < cycleTargetStock) riskReasons.push('below_cycle_target');
  if (pressure >= 0.75) riskReasons.push('high_usage_pressure');
  if (globalEffectiveStock < safetyStock || pressure >= 0.9) return { riskLevel: 'critical', riskReasons };
  if (globalEffectiveStock < cycleTargetStock || pressure >= 0.75) return { riskLevel: 'warning', riskReasons };
  return { riskLevel: 'low', riskReasons };
}

function normalizeNumber(value: unknown) {
  const next = Number(value ?? 0);
  return Number.isFinite(next) ? next : 0;
}

function truthy(value: unknown) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

@Injectable()
export class AdaptiveReplenishmentService {
  constructor(private readonly prisma: PrismaService) {}

  async teamScopes(query: InventoryQuery = {}) {
    const organizationId = optionalInt(query.organizationId);
    const limit = boundedLimit(query.limit, 80, 200);
    const organizationFilter = organizationId ? Prisma.sql`AND org."id" = ${organizationId}` : Prisma.empty;

    const [teamRows, cohortRows] = await Promise.all([
      this.prisma.$queryRaw<TeamScopeRow[]>(Prisma.sql`
        SELECT
          org."id" AS "organizationId",
          org."name" AS "organizationName",
          cohort."id" AS "organizationCohortId",
          cohort."name" AS "cohortName",
          cohort."status" AS "status",
          COUNT(member."id")::int AS "memberCount"
        FROM "organization_cohorts" cohort
        JOIN "organizations" org ON org."id" = cohort."organization_id"
        LEFT JOIN "organization_members" member
          ON member."cohort_id" = cohort."id"
         AND member."status" = 'active'
        WHERE org."status" = 'active'
          ${organizationFilter}
        GROUP BY org."id", org."name", cohort."id", cohort."name", cohort."status"
        ORDER BY org."name" ASC, cohort."name" ASC
        LIMIT ${limit}
      `),
      this.prisma.$queryRaw<Array<{
        id: number;
        name: string;
        subject: string | null;
        source: string;
        status: string;
        organizationId: number | null;
        organizationCohortId: number | null;
        teamKey: string | null;
      }>>(Prisma.sql`
        SELECT
          "id",
          "name",
          "subject",
          "source",
          "status",
          "organization_id" AS "organizationId",
          "organization_cohort_id" AS "organizationCohortId",
          "team_key" AS "teamKey"
        FROM "csca_learning_cohorts"
        WHERE "status" IN ('active', 'cooling')
          ${organizationId ? Prisma.sql`AND "organization_id" = ${organizationId}` : Prisma.empty}
        ORDER BY "updated_at" DESC, "id" DESC
        LIMIT ${limit}
      `)
    ]);

    return {
      generatedAt: new Date().toISOString(),
      items: [
        ...teamRows.map((row) => ({
          type: 'organization_cohort',
          organizationId: row.organizationId,
          organizationName: row.organizationName,
          organizationCohortId: row.organizationCohortId,
          name: row.cohortName,
          status: row.status,
          memberCount: normalizeNumber(row.memberCount)
        })),
        ...cohortRows.map((row) => ({
          type: row.source,
          cohortId: row.id,
          name: row.name,
          subject: row.subject,
          status: row.status,
          organizationId: row.organizationId,
          organizationCohortId: row.organizationCohortId,
          teamKey: row.teamKey
        }))
      ]
    };
  }

  async inventory(query: InventoryQuery = {}) {
    const subject = cleanString(query.subject);
    const topicId = optionalInt(query.topicId);
    const difficulty = cleanString(query.difficultyBand);
    const limit = boundedLimit(query.limit, 120, 500);
    const subjectFilter = subject ? Prisma.sql`AND topic."subject" = ${subject}` : Prisma.empty;
    const topicFilter = topicId ? Prisma.sql`AND topic."id" = ${topicId}` : Prisma.empty;
    const difficultyFilter = difficulty ? Prisma.sql`WHERE combined."difficultyBand" = ${difficulty}` : Prisma.empty;

    const rows = await this.prisma.$queryRaw<InventoryRow[]>(Prisma.sql`
      WITH topic_rows AS (
        SELECT topic."id", topic."subject", topic."code", topic."title", topic."syllabus_version"
        FROM "csca_exam_topics" topic
        WHERE topic."status" = 'published'
          ${subjectFilter}
          ${topicFilter}
          AND EXISTS (
            SELECT 1
            FROM "csca_syllabus_imports" import
            WHERE import."subject" = topic."subject"
              AND import."syllabus_version" = topic."syllabus_version"
              AND import."status" = 'applied'
          )
      ),
      manual_stock AS (
        SELECT
          topic."subject",
          topic."id" AS "topicId",
          topic."code" AS "topicCode",
          topic."title" AS "topicTitle",
          CASE
            WHEN LOWER(spq."difficulty") IN ('basic', '基础', 'easy') THEN 'basic'
            WHEN LOWER(spq."difficulty") IN ('medium', '中等', 'normal') THEN 'medium'
            WHEN LOWER(spq."difficulty") IN ('hard', '较难', '困难') THEN 'hard'
            WHEN LOWER(spq."difficulty") IN ('challenge', 'advanced', '竞赛') THEN 'challenge'
            ELSE COALESCE(NULLIF(LOWER(spq."difficulty"), ''), 'medium')
          END AS "difficultyBand",
          REPLACE(COALESCE(NULLIF(spq."question_type", ''), 'single-choice'), '_', '-') AS "questionType",
          COUNT(DISTINCT spq."id")::int AS "manualStock",
          0::int AS "aiFormalStock",
          0::int AS "candidateCount",
          0::int AS "failedCount"
        FROM "special_practice_questions" spq
        JOIN "csca_topic_mappings" mapping
          ON mapping."source_type" = 'special_practice_question'
         AND mapping."source_id" = spq."id"
        JOIN topic_rows topic ON topic."id" = mapping."topic_id"
        WHERE spq."status" = 'published'
          AND NOT EXISTS (
            SELECT 1
            FROM "csca_questions" aiq
            WHERE aiq."source_question_id" = spq."id"
              AND aiq."source_type" = 'ai'
              AND aiq."status" = 'approved'
              AND aiq."syllabus_version" = topic."syllabus_version"
          )
        GROUP BY topic."subject", topic."id", topic."code", topic."title", "difficultyBand", "questionType"
      ),
      ai_formal_stock AS (
        SELECT
          topic."subject",
          topic."id" AS "topicId",
          topic."code" AS "topicCode",
          topic."title" AS "topicTitle",
          CASE
            WHEN LOWER(spq."difficulty") IN ('basic', '基础', 'easy') THEN 'basic'
            WHEN LOWER(spq."difficulty") IN ('medium', '中等', 'normal') THEN 'medium'
            WHEN LOWER(spq."difficulty") IN ('hard', '较难', '困难') THEN 'hard'
            WHEN LOWER(spq."difficulty") IN ('challenge', 'advanced', '竞赛') THEN 'challenge'
            ELSE COALESCE(NULLIF(LOWER(spq."difficulty"), ''), 'medium')
          END AS "difficultyBand",
          REPLACE(COALESCE(NULLIF(spq."question_type", ''), 'single-choice'), '_', '-') AS "questionType",
          0::int AS "manualStock",
          COUNT(DISTINCT spq."id")::int AS "aiFormalStock",
          0::int AS "candidateCount",
          0::int AS "failedCount"
        FROM "special_practice_questions" spq
        JOIN "csca_topic_mappings" mapping
          ON mapping."source_type" = 'special_practice_question'
         AND mapping."source_id" = spq."id"
        JOIN topic_rows topic ON topic."id" = mapping."topic_id"
        WHERE spq."status" = 'published'
          AND EXISTS (
            SELECT 1
            FROM "csca_questions" aiq
            WHERE aiq."source_question_id" = spq."id"
              AND aiq."source_type" = 'ai'
              AND aiq."status" = 'approved'
              AND aiq."syllabus_version" = topic."syllabus_version"
              AND COALESCE(aiq."generation_metadata"->'scope'->>'targetUseCase', '') <> 'online_mock_exam'
              AND COALESCE(aiq."generation_metadata"->>'targetUseCase', '') <> 'online_mock_exam'
              AND COALESCE(aiq."generation_metadata"->>'sourceKind', '') <> 'mock_exam_blueprint_slot'
              AND COALESCE(aiq."generation_metadata"->>'generationSource', '') <> 'mock_exam_blueprint_slot'
              AND COALESCE(aiq."generation_metadata"->>'generationMode', '') NOT LIKE 'online_mock%'
              AND aiq."generation_metadata"->'mockExamSlot'->>'slotId' IS NULL
              AND COALESCE(aiq."review_metadata"->'mockExamApproval'->>'status', '') NOT IN ('approved_for_mock_exam_assembly', 'assembled_in_mock_exam_draft')
          )
        GROUP BY topic."subject", topic."id", topic."code", topic."title", "difficultyBand", "questionType"
      ),
      ai_pipeline AS (
        SELECT
          topic."subject",
          topic."id" AS "topicId",
          topic."code" AS "topicCode",
          topic."title" AS "topicTitle",
          CASE
            WHEN LOWER(q."designed_difficulty") IN ('basic', '基础', 'easy') THEN 'basic'
            WHEN LOWER(q."designed_difficulty") IN ('medium', '中等', 'normal') THEN 'medium'
            WHEN LOWER(q."designed_difficulty") IN ('hard', '较难', '困难') THEN 'hard'
            WHEN LOWER(q."designed_difficulty") IN ('challenge', 'advanced', '竞赛') THEN 'challenge'
            ELSE COALESCE(NULLIF(LOWER(q."designed_difficulty"), ''), 'medium')
          END AS "difficultyBand",
          REPLACE(COALESCE(NULLIF(q."question_type", ''), 'single-choice'), '_', '-') AS "questionType",
          0::int AS "manualStock",
          0::int AS "aiFormalStock",
          COUNT(DISTINCT q."id") FILTER (
            WHERE COALESCE(q."review_metadata"->'subjectPracticeAutoApproval'->>'status', '') NOT IN ('published_to_subject_practice', 'failed', 'rejected', 'archived')
          )::int AS "candidateCount",
          COUNT(DISTINCT q."id") FILTER (
            WHERE COALESCE(q."review_metadata"->'subjectPracticeAutoApproval'->>'status', '') IN ('failed', 'rejected', 'archived')
               OR q."status" IN ('rejected', 'archived')
          )::int AS "failedCount"
        FROM "csca_questions" q
        JOIN topic_rows topic ON topic."id" = q."topic_id"
        WHERE q."source_type" = 'ai'
          AND q."syllabus_version" = topic."syllabus_version"
          AND COALESCE(q."review_metadata"->'subjectPracticeAutoApproval'->>'targetUseCase', q."generation_metadata"->>'targetUseCase', q."generation_metadata"->'scope'->>'targetUseCase') = 'subject_practice'
          AND COALESCE(q."generation_metadata"->'scope'->>'targetUseCase', '') <> 'online_mock_exam'
          AND COALESCE(q."generation_metadata"->>'targetUseCase', '') <> 'online_mock_exam'
          AND COALESCE(q."generation_metadata"->>'sourceKind', '') <> 'mock_exam_blueprint_slot'
          AND COALESCE(q."generation_metadata"->>'generationSource', '') <> 'mock_exam_blueprint_slot'
          AND COALESCE(q."generation_metadata"->>'generationMode', '') NOT LIKE 'online_mock%'
          AND q."generation_metadata"->'mockExamSlot'->>'slotId' IS NULL
        GROUP BY topic."subject", topic."id", topic."code", topic."title", "difficultyBand", "questionType"
      ),
      usage_pressure AS (
        SELECT
          aggregate."subject",
          aggregate."topic_id" AS "topicId",
          aggregate."difficulty_band" AS "difficultyBand",
          REPLACE(COALESCE(NULLIF(aggregate."question_type", ''), 'single-choice'), '_', '-') AS "questionType",
          COALESCE(SUM(aggregate."exposure_count") FILTER (
            WHERE aggregate."user_id" IS NULL
              AND aggregate."organization_id" IS NULL
              AND aggregate."organization_cohort_id" IS NULL
              AND aggregate."cohort_id" IS NULL
          ), 0)::int AS "exposureCount",
          COALESCE(SUM(aggregate."attempt_count") FILTER (
            WHERE aggregate."user_id" IS NULL
              AND aggregate."organization_id" IS NULL
              AND aggregate."organization_cohort_id" IS NULL
              AND aggregate."cohort_id" IS NULL
          ), 0)::int AS "attemptCount",
          GREATEST(
            COALESCE(SUM(aggregate."unique_user_count") FILTER (
              WHERE aggregate."user_id" IS NULL
                AND aggregate."organization_id" IS NULL
                AND aggregate."organization_cohort_id" IS NULL
                AND aggregate."cohort_id" IS NULL
            ), 0),
            COALESCE(MAX(aggregate."unique_user_count") FILTER (WHERE aggregate."organization_id" IS NOT NULL), 0)
          )::int AS "uniqueUserCount",
          COALESCE(SUM(aggregate."fallback_draw_count"), 0)::int AS "fallbackDrawCount",
          COALESCE(SUM(aggregate."no_question_error_count"), 0)::int AS "noQuestionErrorCount"
        FROM "csca_adaptive_usage_aggregates" aggregate
        JOIN topic_rows topic ON topic."id" = aggregate."topic_id"
        WHERE aggregate."window_end" >= NOW() - INTERVAL '30 days'
        GROUP BY aggregate."subject", aggregate."topic_id", aggregate."difficulty_band", "questionType"
      ),
      target_matrix AS (
        SELECT
          topic."subject",
          topic."id" AS "topicId",
          topic."code" AS "topicCode",
          topic."title" AS "topicTitle",
          difficulty."difficultyBand",
          'single-choice'::text AS "questionType"
        FROM topic_rows topic
        CROSS JOIN (
          VALUES ('basic'), ('medium'), ('hard')
        ) AS difficulty("difficultyBand")
        ${difficulty ? Prisma.sql`WHERE difficulty."difficultyBand" = ${difficulty}` : Prisma.empty}
      ),
      combined AS (
        SELECT * FROM manual_stock
        UNION ALL
        SELECT * FROM ai_formal_stock
        UNION ALL
        SELECT * FROM ai_pipeline
      ),
      rolled AS (
        SELECT
          combined."subject",
          combined."topicId",
          combined."topicCode",
          combined."topicTitle",
          combined."difficultyBand",
          combined."questionType",
          SUM(combined."manualStock")::int AS "manualStock",
          SUM(combined."aiFormalStock")::int AS "aiFormalStock",
          SUM(combined."candidateCount")::int AS "candidateCount",
          SUM(combined."failedCount")::int AS "failedCount"
        FROM combined
        ${difficultyFilter}
        GROUP BY combined."subject", combined."topicId", combined."topicCode", combined."topicTitle", combined."difficultyBand", combined."questionType"
      )
      SELECT
        matrix."subject",
        matrix."topicId",
        matrix."topicCode",
        matrix."topicTitle",
        matrix."difficultyBand",
        matrix."questionType",
        COALESCE(rolled."manualStock", 0)::int AS "manualStock",
        COALESCE(rolled."aiFormalStock", 0)::int AS "aiFormalStock",
        COALESCE(rolled."candidateCount", 0)::int AS "candidateCount",
        COALESCE(rolled."failedCount", 0)::int AS "failedCount",
        COALESCE(usage."exposureCount", 0)::int AS "exposureCount",
        COALESCE(usage."attemptCount", 0)::int AS "attemptCount",
        COALESCE(usage."uniqueUserCount", 0)::int AS "uniqueUserCount",
        COALESCE(usage."fallbackDrawCount", 0)::int AS "fallbackDrawCount",
        COALESCE(usage."noQuestionErrorCount", 0)::int AS "noQuestionErrorCount"
      FROM target_matrix matrix
      LEFT JOIN rolled
        ON rolled."subject" = matrix."subject"
       AND rolled."topicId" = matrix."topicId"
       AND rolled."difficultyBand" = matrix."difficultyBand"
       AND rolled."questionType" = matrix."questionType"
      LEFT JOIN usage_pressure usage
        ON usage."subject" = matrix."subject"
       AND usage."topicId" = matrix."topicId"
       AND usage."difficultyBand" = matrix."difficultyBand"
       AND usage."questionType" = matrix."questionType"
      ORDER BY (COALESCE(rolled."manualStock", 0) + COALESCE(rolled."aiFormalStock", 0)) ASC, usage."noQuestionErrorCount" DESC NULLS LAST, usage."fallbackDrawCount" DESC NULLS LAST, matrix."topicTitle" ASC
    `);

    const allItems = rows.map((row) => {
      const manualStock = normalizeNumber(row.manualStock);
      const aiFormalStock = normalizeNumber(row.aiFormalStock);
      const globalEffectiveStock = manualStock + aiFormalStock;
      const policy = stockPolicyForDifficulty(row.difficultyBand);
      const usagePressure = Math.min(
        1,
        (normalizeNumber(row.noQuestionErrorCount) * 2 + normalizeNumber(row.fallbackDrawCount) + normalizeNumber(row.uniqueUserCount) / 10) / Math.max(policy.cycleTargetStock, 1)
      );
      const risk = riskForStock(globalEffectiveStock, policy.safetyStock, policy.cycleTargetStock, usagePressure);
      return {
        ...row,
        manualStock,
        aiFormalStock,
        globalEffectiveStock,
        candidateCount: normalizeNumber(row.candidateCount),
        failedCount: normalizeNumber(row.failedCount),
        exposureCount: normalizeNumber(row.exposureCount),
        attemptCount: normalizeNumber(row.attemptCount),
        uniqueUserCount: normalizeNumber(row.uniqueUserCount),
        fallbackDrawCount: normalizeNumber(row.fallbackDrawCount),
        noQuestionErrorCount: normalizeNumber(row.noQuestionErrorCount),
        ...policy,
        requiredPublishedCount: Math.max(0, policy.cycleTargetStock - globalEffectiveStock),
        pressureScore: usagePressure,
        ...risk
      };
    });

    const summary = allItems.reduce(
      (acc, item) => {
        acc.totalCells += 1;
        acc.requiredPublishedCount += item.requiredPublishedCount;
        acc.manualStock += item.manualStock;
        acc.aiFormalStock += item.aiFormalStock;
        acc.globalEffectiveStock += item.globalEffectiveStock;
        if (item.riskLevel === 'critical') acc.criticalCells += 1;
        if (item.riskLevel === 'warning') acc.warningCells += 1;
        return acc;
      },
      { totalCells: 0, criticalCells: 0, warningCells: 0, requiredPublishedCount: 0, manualStock: 0, aiFormalStock: 0, globalEffectiveStock: 0 }
    );
    const items = allItems.slice(0, limit);
    let snapshotCount = 0;
    if (truthy(query.persistSnapshot)) {
      for (const item of allItems) {
        await this.prisma.$executeRaw(Prisma.sql`
          INSERT INTO "csca_adaptive_inventory_snapshots" (
            "user_id", "cohort_id", "organization_id", "organization_cohort_id", "team_key",
            "subject", "topic_id", "difficulty_band", "question_type",
            "global_effective_stock", "manual_stock", "ai_formal_stock", "candidate_count", "failed_count",
            "safety_stock", "cycle_target_stock", "max_stock_cap", "required_published_count",
            "active_user_count", "team_active_user_count", "user_low_availability_count", "team_low_availability_user_count",
            "user_coverage_pressure", "team_user_coverage_pressure", "team_pressure_score",
            "projected_days_to_safety", "risk_level", "risk_reasons", "metadata", "updated_at"
          )
          VALUES (
            NULL, NULL, NULL, NULL, NULL,
            ${item.subject}, ${item.topicId}, ${item.difficultyBand}, ${item.questionType},
            ${item.globalEffectiveStock}, ${item.manualStock}, ${item.aiFormalStock}, ${item.candidateCount}, ${item.failedCount},
            ${item.safetyStock}, ${item.cycleTargetStock}, ${item.maxStockCap}, ${item.requiredPublishedCount},
            ${item.uniqueUserCount}, 0, 0, 0,
            ${item.pressureScore}, 0, ${item.pressureScore},
            NULL, ${item.riskLevel}, ${jsonInput(item.riskReasons)}::jsonb,
            ${jsonInput({
              source: 'adaptive_replenishment_inventory',
              policyVersion: 'cycle-aware-predictive-replenishment-v1',
              exposureCount: item.exposureCount,
              attemptCount: item.attemptCount,
              fallbackDrawCount: item.fallbackDrawCount,
              noQuestionErrorCount: item.noQuestionErrorCount
            })}::jsonb,
            CURRENT_TIMESTAMP
          )
        `);
        snapshotCount += 1;
      }
    }

    return {
      generatedAt: new Date().toISOString(),
      policyVersion: 'cycle-aware-predictive-replenishment-v1',
      filters: {
        subject: subject || null,
        topicId: topicId ?? null,
        difficultyBand: difficulty || null,
        limit
      },
      summary,
      snapshotCount,
      items
    };
  }
}

import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CscaSubjectCodeSchema, ScoreCalibrationGateV1, ScoreCalibrationGateV1Schema,
  ScoreModelingPrerequisiteV1, ScoreModelingPrerequisiteV1Schema
} from '../contracts/learning-intelligence.contracts';

export type ScoreModelingPrerequisiteInput = {
  examSystemCode: string;
  subjectCode: 'math' | 'physics' | 'chemistry';
  scoringPolicyVersion: string;
  itemCalibrationVersion: string;
};
export type ScoreCalibrationGateInput = ScoreModelingPrerequisiteInput & { forecastModelVersion: string };
type ModelingStore = Pick<PrismaService, 'examScoringPolicy' | 'itemCalibrationSnapshot'>;
type GovernanceStore = ModelingStore & Pick<PrismaService, 'forecastCalibrationSnapshot'>;

function digest(value: unknown): string { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function isSha256(value: string | null | undefined): boolean { return /^[a-f0-9]{64}$/i.test(value ?? ''); }
function isHttpsUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  try { return new URL(value).protocol === 'https:'; } catch { return false; }
}
function activeOnDate(from: Date | null, to: Date | null, at: Date): boolean {
  const date = at.toISOString().slice(0, 10);
  return (!from || from.toISOString().slice(0, 10) <= date)
    && (!to || to.toISOString().slice(0, 10) >= date);
}

@Injectable()
export class ScoreCalibrationGovernanceService {
  constructor(private readonly prisma: PrismaService) {}

  async evaluateModelingPrerequisites(
    input: ScoreModelingPrerequisiteInput, store: ModelingStore = this.prisma, evaluatedAt = new Date()
  ): Promise<ScoreModelingPrerequisiteV1> {
    const subjectCode = CscaSubjectCodeSchema.parse(input.subjectCode);
    const modelingInput: ScoreModelingPrerequisiteInput = {
      examSystemCode: input.examSystemCode, subjectCode,
      scoringPolicyVersion: input.scoringPolicyVersion,
      itemCalibrationVersion: input.itemCalibrationVersion
    };
    const policy = await store.examScoringPolicy.findUnique({
      where: { policyVersion: input.scoringPolicyVersion },
      select: { id: true, examSystemCode: true, policyVersion: true, status: true, sourceType: true,
        sourceUrl: true, sourceSnapshotHash: true, reviewedByUserId: true, reviewedAt: true,
        activatedAt: true, effectiveFrom: true, effectiveTo: true, updatedAt: true }
    });
    const itemCalibration = await store.itemCalibrationSnapshot.findUnique({
      where: { calibrationVersion: input.itemCalibrationVersion },
      select: { id: true, examSystemCode: true, subjectCode: true, calibrationVersion: true,
        status: true, allCriteriaPassed: true, artifactHash: true, reviewedByUserId: true,
        reviewedAt: true, qualifiedAt: true, createdAt: true }
    });
    const policyQualified = Boolean(policy && policy.examSystemCode === input.examSystemCode
      && policy.status === 'active' && policy.sourceType === 'official' && isHttpsUrl(policy.sourceUrl)
      && isSha256(policy.sourceSnapshotHash) && policy.reviewedByUserId && policy.reviewedAt && policy.activatedAt
      && activeOnDate(policy.effectiveFrom, policy.effectiveTo, evaluatedAt));
    const itemQualified = Boolean(itemCalibration && itemCalibration.examSystemCode === input.examSystemCode
      && itemCalibration.subjectCode === subjectCode && itemCalibration.status === 'qualified'
      && itemCalibration.allCriteriaPassed && isSha256(itemCalibration.artifactHash)
      && itemCalibration.reviewedByUserId && itemCalibration.reviewedAt && itemCalibration.qualifiedAt);
    const reasons = [
      ...(!policy ? ['SCORING_POLICY_NOT_REGISTERED'] : !policyQualified ? ['SCORING_POLICY_UNVERIFIED'] : []),
      ...(!itemCalibration ? ['ITEM_CALIBRATION_NOT_REGISTERED'] : !itemQualified ? ['ITEM_CALIBRATION_NOT_QUALIFIED'] : [])
    ];
    const status = policyQualified && itemQualified ? 'qualified' as const : 'blocked' as const;
    return ScoreModelingPrerequisiteV1Schema.parse({
      schemaVersion: '1', ...modelingInput,
      prerequisiteVersionHash: digest({ input: modelingInput, policy, itemCalibration, status }), status,
      scoringPolicyId: policy?.id ?? null, itemCalibrationSnapshotId: itemCalibration?.id ?? null,
      reasonCodes: [...new Set(reasons)], evaluatedAt: evaluatedAt.toISOString()
    });
  }

  async evaluate(
    input: ScoreCalibrationGateInput, store: GovernanceStore = this.prisma, evaluatedAt = new Date()
  ): Promise<ScoreCalibrationGateV1> {
    const modeling = await this.evaluateModelingPrerequisites(input, store, evaluatedAt);
    const forecastCalibration = await store.forecastCalibrationSnapshot.findFirst({
      where: { ...input, subjectCode: modeling.subjectCode, status: 'qualified' },
      orderBy: [{ qualifiedAt: 'desc' }, { createdAt: 'desc' }],
      select: { id: true, calibrationVersion: true, status: true, allCriteriaPassed: true,
        artifactHash: true, outcomeSource: true, reviewedByUserId: true, reviewedAt: true, qualifiedAt: true, createdAt: true }
    });
    const forecastQualified = Boolean(forecastCalibration && forecastCalibration.outcomeSource === 'verified_csca_exam'
      && forecastCalibration.allCriteriaPassed
      && isSha256(forecastCalibration.artifactHash) && forecastCalibration.reviewedByUserId
      && forecastCalibration.reviewedAt && forecastCalibration.qualifiedAt);
    const reasons = [...modeling.reasonCodes,
      ...(!forecastCalibration ? ['FORECAST_MODEL_NOT_CALIBRATED'] : !forecastQualified ? ['FORECAST_CALIBRATION_NOT_QUALIFIED'] : []),
      'NUMERIC_FORECAST_RELEASE_DISABLED'];
    const status = modeling.status === 'qualified' && forecastQualified ? 'shadow_qualified' as const : 'blocked' as const;
    return ScoreCalibrationGateV1Schema.parse({
      schemaVersion: '1', ...input, subjectCode: modeling.subjectCode,
      gateVersionHash: digest({ input, modeling: {
        prerequisiteVersionHash: modeling.prerequisiteVersionHash, status: modeling.status,
        scoringPolicyId: modeling.scoringPolicyId,
        itemCalibrationSnapshotId: modeling.itemCalibrationSnapshotId,
        reasonCodes: modeling.reasonCodes
      }, forecastCalibration, status, numericForecastRelease: 'disabled' }),
      status, numericForecastRelease: 'disabled', scoringPolicyId: modeling.scoringPolicyId,
      itemCalibrationSnapshotId: modeling.itemCalibrationSnapshotId,
      forecastCalibrationSnapshotId: forecastCalibration?.id ?? null,
      reasonCodes: [...new Set(reasons)], evaluatedAt: evaluatedAt.toISOString()
    });
  }
}

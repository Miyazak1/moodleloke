import {
  adminAIQuestioningCandidateQueueCsv,
  adminAIQuestioningCandidateQueueFilename,
  adminAIQuestioningCandidateQueueJson,
  adminAIQuestioningQualityCalibrationCsv,
  adminAIQuestioningQualityCalibrationFilename,
  adminAIQuestioningQualityCalibrationJson
} from '../../../lib/admin-audit-exports';
import type {
  AdminAIQuestioningQualityMetric,
  AdminAIQuestioningQuestion
} from '../../../lib/api-types';
import { downloadTextFile } from './pageUtils';

type UseQuestionBankExportsOptions = {
  subject: string;
  status: string;
  candidateQuestions: AdminAIQuestioningQuestion[];
  qualityMetrics: AdminAIQuestioningQualityMetric[];
  qualityQuestions: AdminAIQuestioningQuestion[];
};

export function useQuestionBankExports({
  subject,
  status,
  candidateQuestions,
  qualityMetrics,
  qualityQuestions
}: UseQuestionBankExportsOptions) {
  function exportCandidateQueue(extension: 'csv' | 'json') {
    const filterLabel = status || 'candidate-queue';
    const content = extension === 'csv'
      ? `${adminAIQuestioningCandidateQueueCsv(candidateQuestions, filterLabel)}\n`
      : adminAIQuestioningCandidateQueueJson(candidateQuestions, filterLabel);
    downloadTextFile(
      adminAIQuestioningCandidateQueueFilename(subject || undefined, filterLabel, extension),
      content,
      extension === 'csv' ? 'text/csv;charset=utf-8' : 'application/json'
    );
  }

  function exportQualityMetrics(extension: 'csv' | 'json') {
    const content = extension === 'csv'
      ? `${adminAIQuestioningQualityCalibrationCsv(qualityMetrics, qualityQuestions)}\n`
      : adminAIQuestioningQualityCalibrationJson(qualityMetrics, qualityQuestions);
    downloadTextFile(
      adminAIQuestioningQualityCalibrationFilename(subject || undefined, extension),
      content,
      extension === 'csv' ? 'text/csv;charset=utf-8' : 'application/json'
    );
  }

  return {
    exportCandidateQueue,
    exportQualityMetrics
  };
}

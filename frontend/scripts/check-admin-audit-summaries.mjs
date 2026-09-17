import {
  ADMIN_AUDIT_FILTER_TEMPLATES,
  ADMIN_AUDIT_RESOURCE_TYPES,
  applyAdminAuditFilterTemplate,
  buildAdminAuditEventParams,
  buildAdminAuditFilterSearch,
  DEFAULT_ADMIN_AUDIT_FILTERS,
  parseAdminAuditFiltersFromSearch
} from '../src/lib/admin-audit-filters.ts';
import {
  adminAIQuestioningCandidateQueueCsv,
  adminAIQuestioningCandidateQueueFilename,
  adminAIQuestioningCandidateQueueJson,
  adminAIQuestioningQualityCalibrationCsv,
  adminAIQuestioningQualityCalibrationFilename,
  adminAIQuestioningQualityCalibrationJson,
  adminAuditEventsCsv,
  adminAuditEventsFilename
} from '../src/lib/admin-audit-exports.ts';
import { summarizeAdminAuditEvent } from '../src/lib/admin-audit-summaries.ts';
import {
  aiQuestioningReadinessCsv,
  aiQuestioningReadinessActionTarget,
  aiQuestioningReadinessFilename,
  aiQuestioningReadinessJson
} from '../src/lib/ai-questioning-readiness-exports.ts';
import { readFileSync, readdirSync } from 'node:fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const event = {
  id: 1,
  module: 'ai-questioning',
  resourceType: 'syllabus-import',
  resourceId: '42',
  action: 'apply',
  actorEmail: 'admin@example.test',
  after: {
    import: {
      previewSummary: {
        apply: {
          migrationCount: 1,
          migrations: [
            {
              previousCode: 'M-OLD-001',
              nextCode: 'M-ALG-001',
              existingTopicId: 7,
              affectedQuestionCount: 12,
              approvedQuestionsBecomingPendingReview: 4
            }
          ]
        }
      }
    },
    apply: {
      refreshedQuestionCount: 9,
      missingTopicsChanged: 2
    }
  },
  createdAt: '2026-06-12T00:00:00.000Z'
};

const zh = summarizeAdminAuditEvent(event, 'zh');
assert(zh?.title === '已应用大纲导入', 'Audit summary should provide a Chinese syllabus-import apply title.');
assert(zh.detail.includes('1 条 code 迁移'), 'Audit summary should include migration count in Chinese.');
assert(zh.detail.includes('9 道题'), 'Audit summary should include refreshed question count in Chinese.');
assert(zh.rows[0].includes('M-OLD-001 -> M-ALG-001'), 'Audit summary should include migration code pair.');
assert(zh.rows[0].includes('通过题转复核 4'), 'Audit summary should include approved-to-review count.');

const en = summarizeAdminAuditEvent(event, 'en');
assert(en?.title === 'Syllabus import applied', 'Audit summary should provide an English syllabus-import apply title.');
assert(en.detail.includes('1 code migration'), 'Audit summary should include migration count in English.');
assert(en.rows[0].includes('approved to review 4'), 'Audit summary should include English row labels.');

const recoveryEvent = {
  ...event,
  id: 3,
  resourceId: '42',
  action: 'recovery_draft',
  after: {
    import: {
      id: 108,
      status: 'draft',
      previewSummary: {
        recovery: {
          sourceImportId: 42,
          sourceImportStatus: 'applied'
        },
        summary: {
          newTopics: 1,
          updatedTopics: 3,
          questionsAffected: 11,
          approvedQuestionsBecomingPendingReview: 5
        }
      }
    }
  }
};
const recoveryZh = summarizeAdminAuditEvent(recoveryEvent, 'zh');
assert(recoveryZh?.title === '已重建大纲恢复草稿', 'Audit summary should provide a Chinese recovery-draft title.');
assert(recoveryZh.detail.includes('来源 #42'), 'Recovery summary should include source import id in Chinese.');
assert(recoveryZh.detail.includes('草稿 #108'), 'Recovery summary should include recovery draft id in Chinese.');
assert(recoveryZh.detail.includes('影响题目 11'), 'Recovery summary should include refreshed affected question count.');
assert(recoveryZh.tone === 'warning', 'Recovery summary should warn when refreshed impact is non-zero.');
const recoveryEn = summarizeAdminAuditEvent(recoveryEvent, 'en');
assert(recoveryEn?.title === 'Syllabus recovery draft rebuilt', 'Audit summary should provide an English recovery-draft title.');
assert(recoveryEn.detail.includes('source #42'), 'Recovery summary should include source import id in English.');
assert(recoveryEn.rows[2].includes('Review refreshed impact'), 'Recovery summary should remind operators to review before applying.');

const reversePlanEvent = {
  ...event,
  id: 4,
  resourceId: '42',
  action: 'reverse_plan',
  after: {
    reversePlan: {
      mode: 'dry_run',
      importId: 42,
      subject: 'math',
      syllabusVersion: '2026-v1',
      summary: {
        topicOperations: 3,
        missingTopicOperations: 1,
        canAutoPlanOperations: 2,
        blockerCount: 1,
        manualReviewRequired: 5,
        questionReviewCount: 4
      },
      blockers: ['current_topic_drifted_after_apply']
    }
  }
};
const reversePlanZh = summarizeAdminAuditEvent(reversePlanEvent, 'zh');
assert(reversePlanZh?.title === '已生成大纲回滚预案', 'Audit summary should provide a Chinese reverse-plan title.');
assert(reversePlanZh.detail.includes('4 项操作'), 'Reverse-plan summary should include operation count in Chinese.');
assert(reversePlanZh.detail.includes('阻断 1'), 'Reverse-plan summary should include blocker count in Chinese.');
assert(reversePlanZh.rows[0].includes('dry-run'), 'Reverse-plan summary should explain it is dry-run only.');
assert(reversePlanZh.tone === 'warning', 'Reverse-plan summary should warn when blockers or manual review remain.');
const reversePlanEn = summarizeAdminAuditEvent(reversePlanEvent, 'en');
assert(reversePlanEn?.title === 'Syllabus reverse plan generated', 'Audit summary should provide an English reverse-plan title.');
assert(reversePlanEn.detail.includes('4 operation'), 'Reverse-plan summary should include operation count in English.');
assert(reversePlanEn.rows[1].includes('current_topic_drifted_after_apply'), 'Reverse-plan summary should include blocker rows.');

const replacementApproveEvent = {
  ...event,
  id: 6,
  resourceType: 'question',
  resourceId: '108',
  action: 'approve',
  after: {
    id: 108,
    status: 'approved',
    sourceQuestionId: 409,
    generatedVariantOf: 77
  }
};
const replacementApproveZh = summarizeAdminAuditEvent(replacementApproveEvent, 'zh');
assert(replacementApproveZh?.title === '候选题已发布', 'Question approve summary should provide a Chinese title.');
assert(replacementApproveZh.detail.includes('练习题 #409'), 'Replacement approval summary should include the published practice question.');
assert(replacementApproveZh.detail.includes('低质题 #77'), 'Replacement approval summary should include the replaced low-quality question.');
assert(replacementApproveZh.rows[1].includes('替代源题：#77'), 'Replacement approval rows should expose the replacement source.');
const replacementApproveEn = summarizeAdminAuditEvent(replacementApproveEvent, 'en');
assert(replacementApproveEn?.detail.includes('replaced low-quality question #77'), 'Replacement approval summary should explain replacement in English.');

const bulkQuestionEvent = {
  ...event,
  id: 7,
  resourceType: 'question',
  resourceId: undefined,
  action: 'bulk_approve',
  after: {
    action: 'approve',
    requested: 3,
    succeeded: 2,
    failed: 1,
    itemCount: 2,
    itemStatusCounts: {
      approved: 2
    }
  }
};
const bulkQuestionZh = summarizeAdminAuditEvent(bulkQuestionEvent, 'zh');
assert(bulkQuestionZh?.title === '候选题批量发布完成', 'Bulk question summary should provide a Chinese title.');
assert(bulkQuestionZh.detail.includes('请求 3'), 'Bulk question summary should include requested count.');
assert(bulkQuestionZh.rows[0].includes('状态分布 已发布 2'), 'Bulk question summary should include readable returned status counts.');
assert(bulkQuestionZh.tone === 'warning', 'Bulk question summary should warn when failures exist.');

const qualityRegenerateEvent = {
  ...event,
  id: 8,
  resourceType: 'quality-metric',
  resourceId: '77',
  action: 'disposition_regenerate',
  after: {
    questionId: 77,
    questionStatus: 'pending_review',
    needsReview: true,
    qualityGovernance: {
      status: 'needs_review',
      disposition: 'regenerate',
      replacementQuestionId: 108
    },
    replacementCandidateStatus: 'pending_review'
  }
};
const qualityRegenerateZh = summarizeAdminAuditEvent(qualityRegenerateEvent, 'zh');
assert(qualityRegenerateZh?.title === '质量项已生成替代候选', 'Quality regenerate summary should provide a Chinese title.');
assert(qualityRegenerateZh.detail.includes('替代候选 #108'), 'Quality regenerate summary should include replacement candidate id.');
assert(qualityRegenerateZh.rows[0].includes('替代候选：#108 · 待复审'), 'Quality regenerate rows should expose replacement candidate status.');
const qualityRegenerateEn = summarizeAdminAuditEvent(qualityRegenerateEvent, 'en');
assert(qualityRegenerateEn?.detail.includes('replacement candidate #108'), 'Quality regenerate summary should explain replacement candidate in English.');

const qualityStaleReplacementEvent = {
  ...qualityRegenerateEvent,
  id: 81,
  after: {
    ...qualityRegenerateEvent.after,
    replacementCandidateStatus: 'archived'
  }
};
const qualityStaleReplacementZh = summarizeAdminAuditEvent(qualityStaleReplacementEvent, 'zh');
assert(qualityStaleReplacementZh?.rows.some((row) => row.includes('替代候选已失效，需要重新生成')), 'Quality summary should explain stale replacement follow-up.');
assert(qualityStaleReplacementZh?.tone === 'warning', 'Quality summary should warn when replacement candidate is stale.');

const bulkQualityEvent = {
  ...event,
  id: 9,
  resourceType: 'quality-metric',
  resourceId: undefined,
  action: 'bulk_reduce_exposure',
  after: {
    action: 'reduce_exposure',
    requested: 4,
    succeeded: 4,
    failed: 0,
    itemCount: 4
  }
};
const bulkQualityZh = summarizeAdminAuditEvent(bulkQualityEvent, 'zh');
assert(bulkQualityZh?.title === '质量项批量降低曝光完成', 'Bulk quality summary should provide a Chinese title.');
assert(bulkQualityZh.detail.includes('成功 4'), 'Bulk quality summary should include succeeded count.');

const blueprintCoverageEvent = {
  ...event,
  id: 10,
  resourceType: 'blueprint-coverage',
  resourceId: undefined,
  action: 'ensure',
  after: {
    created: 5,
    skipped: 1,
    itemCount: 5
  }
};
const blueprintCoverageZh = summarizeAdminAuditEvent(blueprintCoverageEvent, 'zh');
assert(blueprintCoverageZh?.title === '已补齐蓝图覆盖', 'Blueprint coverage summary should provide a Chinese title.');
assert(blueprintCoverageZh.detail.includes('新建 5'), 'Blueprint coverage summary should include created count.');
assert(blueprintCoverageZh.rows[0].includes('入队生成任务'), 'Blueprint coverage summary should include next step guidance.');

const blueprintGenerateEvent = {
  ...event,
  id: 11,
  resourceType: 'blueprint',
  resourceId: '3',
  action: 'generate_candidate',
  after: {
    question: {
      id: 208,
      status: 'pending_review',
      subject: 'math'
    }
  }
};
const blueprintGenerateZh = summarizeAdminAuditEvent(blueprintGenerateEvent, 'zh');
assert(blueprintGenerateZh?.title === '已生成候选题', 'Blueprint generation summary should provide a Chinese title.');
assert(blueprintGenerateZh.detail.includes('候选题 #208'), 'Blueprint generation summary should include candidate id.');

const generationEnqueueEvent = {
  ...event,
  id: 12,
  resourceType: 'generation-job',
  resourceId: undefined,
  action: 'enqueue',
  after: {
    requested: 6,
    enqueued: 4,
    skipped: 2,
    itemCount: 4
  }
};
const generationEnqueueZh = summarizeAdminAuditEvent(generationEnqueueEvent, 'zh');
assert(generationEnqueueZh?.title === '生成任务已入队', 'Generation enqueue summary should provide a Chinese title.');
assert(generationEnqueueZh.detail.includes('入队 4'), 'Generation enqueue summary should include enqueued count.');
assert(generationEnqueueZh.rows[0].includes('处理生成队列'), 'Generation enqueue summary should include next step guidance.');

const generationProcessEvent = {
  ...event,
  id: 13,
  resourceType: 'generation-job',
  action: 'process',
  after: {
    requested: 4,
    succeeded: 3,
    failed: 1,
    itemCount: 3,
    itemQuestionCount: 2,
    itemStatusCounts: {
      pending_review: 2,
      failed: 1
    }
  }
};
const generationProcessZh = summarizeAdminAuditEvent(generationProcessEvent, 'zh');
assert(generationProcessZh?.title === '生成任务队列已处理', 'Generation process summary should provide a Chinese title.');
assert(generationProcessZh.detail.includes('失败 1'), 'Generation process summary should include failed count.');
assert(generationProcessZh.detail.includes('候选题 2'), 'Generation process summary should include created candidate count.');
assert(generationProcessZh.rows[0].includes('状态分布 待复审 2'), 'Generation process summary should include readable returned job status counts.');
assert(generationProcessZh.tone === 'warning', 'Generation process summary should warn when failures exist.');

const pregenerationEvent = {
  ...event,
  id: 14,
  resourceType: 'pregeneration',
  action: 'run',
  after: {
    summary: {
      topicsScanned: 20,
      topicsSelected: 6,
      blueprintsCreated: 2,
      jobsEnqueued: 5,
      jobsProcessed: 5,
      jobsSucceeded: 4,
      jobsFailed: 1,
      candidatesCreated: 4
    }
  }
};
const pregenerationZh = summarizeAdminAuditEvent(pregenerationEvent, 'zh');
assert(pregenerationZh?.title === '题库自动补仓已完成', 'Pregeneration summary should provide a Chinese title.');
assert(pregenerationZh.detail.includes('候选题 4'), 'Pregeneration summary should include candidate count.');
assert(pregenerationZh.tone === 'warning', 'Pregeneration summary should warn when jobs fail.');

const topicGenerateEvent = {
  ...event,
  id: 15,
  resourceType: 'topic',
  resourceId: '9',
  action: 'run_generate_candidates',
  after: {
    action: 'generate_candidates',
    topicId: 9,
    requested: 3,
    enqueued: 2,
    skipped: 1,
    itemCount: 2
  }
};
const topicGenerateZh = summarizeAdminAuditEvent(topicGenerateEvent, 'zh');
assert(topicGenerateZh?.title === '知识点生成任务已入队', 'Topic action summary should provide a Chinese title.');
assert(topicGenerateZh.detail.includes('知识点 #9'), 'Topic action summary should include topic id.');
assert(topicGenerateZh.detail.includes('入队 2'), 'Topic generation summary should include enqueued count.');

const unrelated = summarizeAdminAuditEvent({ ...event, resourceType: 'organization', action: 'organization.update' }, 'zh');
assert(unrelated === null, 'Audit summary helper should ignore unrelated events.');

const defaultParams = buildAdminAuditEventParams(DEFAULT_ADMIN_AUDIT_FILTERS);
assert(defaultParams.resourceType === undefined && defaultParams.module === undefined, 'Default audit filters should not constrain resource type or module.');
const syllabusParams = buildAdminAuditEventParams({
  organizationId: '',
  organizationOnly: false,
  resourceType: 'syllabus-import',
  limit: '100'
});
assert(syllabusParams.resourceType === 'syllabus-import', 'Audit filters should pass syllabus-import resource type.');
assert(syllabusParams.limit === 100, 'Audit filters should preserve selected limit.');
const organizationParams = buildAdminAuditEventParams({
  organizationId: '12',
  organizationOnly: true,
  resourceType: 'organization_invite',
  limit: '50'
});
assert(organizationParams.organizationId === 12 && organizationParams.module === 'organization', 'Audit filters should combine organization and module filters.');
assert(organizationParams.resourceType === 'organization_invite', 'Audit filters should preserve organization resource types.');

const parsedFilters = parseAdminAuditFiltersFromSearch('?auditOrg=12&auditScope=organization&auditType=syllabus-import&auditLimit=100');
assert(parsedFilters.organizationId === '12', 'Audit filter parser should restore organization id from URL.');
assert(parsedFilters.organizationOnly === true, 'Audit filter parser should restore organization scope from URL.');
assert(parsedFilters.resourceType === 'syllabus-import', 'Audit filter parser should restore resource type from URL.');
assert(parsedFilters.limit === '100', 'Audit filter parser should restore limit from URL.');
const parsedReadinessFilters = parseAdminAuditFiltersFromSearch('?auditType=operational-readiness');
assert(parsedReadinessFilters.resourceType === 'operational-readiness', 'Audit filter parser should allow operational-readiness events.');
assert(ADMIN_AUDIT_RESOURCE_TYPES.includes('operational-readiness'), 'Audit resource type allow-list should include operational-readiness.');
const parsedQuestioningFilters = parseAdminAuditFiltersFromSearch('?auditType=quality-metric');
assert(parsedQuestioningFilters.resourceType === 'quality-metric', 'Audit filter parser should allow AI quality-governance events.');
assert(ADMIN_AUDIT_RESOURCE_TYPES.includes('generation-job'), 'Audit resource type allow-list should include AI generation-job events.');
assert(ADMIN_AUDIT_RESOURCE_TYPES.includes('question'), 'Audit resource type allow-list should include AI candidate question events.');
assert(ADMIN_AUDIT_RESOURCE_TYPES.includes('quality-metric'), 'Audit resource type allow-list should include AI quality metric events.');
const sanitizedFilters = parseAdminAuditFiltersFromSearch('?auditOrg=-1&auditType=bad&auditLimit=500');
assert(sanitizedFilters.organizationId === '' && sanitizedFilters.resourceType === '' && sanitizedFilters.limit === '50', 'Audit filter parser should ignore invalid URL values.');
const filterSearch = buildAdminAuditFilterSearch('?lang=zh&auditOrg=1&auditLimit=200', {
  organizationId: '12',
  organizationOnly: true,
  resourceType: 'organization_invite',
  limit: '50'
});
assert(filterSearch.includes('lang=zh'), 'Audit filter URL builder should preserve unrelated query params.');
assert(filterSearch.includes('auditOrg=12'), 'Audit filter URL builder should write organization id.');
assert(filterSearch.includes('auditScope=organization'), 'Audit filter URL builder should write organization scope.');
assert(filterSearch.includes('auditType=organization_invite'), 'Audit filter URL builder should write resource type.');
assert(!filterSearch.includes('auditLimit='), 'Audit filter URL builder should omit default limit.');
const readinessFilterSearch = buildAdminAuditFilterSearch('', {
  organizationId: '',
  organizationOnly: false,
  resourceType: 'operational-readiness',
  limit: '50'
});
assert(readinessFilterSearch === '?auditType=operational-readiness', 'Audit filter URL builder should support operational-readiness quick filters.');
assert(ADMIN_AUDIT_FILTER_TEMPLATES.length === 7, 'Audit filter templates should expose organization, syllabus, readiness, and AI-questioning operational views.');
const inviteTemplate = applyAdminAuditFilterTemplate({
  organizationId: '12',
  organizationOnly: false,
  resourceType: '',
  limit: '100'
}, 'organization_invites');
assert(inviteTemplate.organizationId === '12', 'Organization audit templates should preserve the selected organization.');
assert(inviteTemplate.organizationOnly === true && inviteTemplate.resourceType === 'organization_invite', 'Invite template should target organization invite events.');
const inviteTemplateSearch = buildAdminAuditFilterSearch('?lang=zh', inviteTemplate);
assert(inviteTemplateSearch.includes('auditOrg=12'), 'Template URL should keep the organization id.');
assert(inviteTemplateSearch.includes('auditScope=organization'), 'Template URL should keep the organization scope.');
assert(inviteTemplateSearch.includes('auditType=organization_invite'), 'Template URL should keep the template event type.');
assert(inviteTemplateSearch.includes('auditLimit=100'), 'Template URL should keep the chosen result limit.');
const readinessTemplate = applyAdminAuditFilterTemplate(inviteTemplate, 'operational_readiness');
assert(readinessTemplate.organizationId === '12' && readinessTemplate.organizationOnly === false && readinessTemplate.resourceType === 'operational-readiness', 'Global templates should keep organization selection but leave organization-only mode.');
const productionTemplate = applyAdminAuditFilterTemplate(inviteTemplate, 'question_production');
assert(productionTemplate.organizationId === '12' && productionTemplate.organizationOnly === false && productionTemplate.resourceType === 'generation-job', 'Question production template should target generation-job events.');
const candidateTemplate = applyAdminAuditFilterTemplate(inviteTemplate, 'candidate_review');
assert(candidateTemplate.resourceType === 'question', 'Candidate review template should target AI question events.');
const qualityTemplate = applyAdminAuditFilterTemplate(inviteTemplate, 'quality_governance');
assert(qualityTemplate.resourceType === 'quality-metric', 'Quality governance template should target quality metric events.');

const csv = adminAuditEventsCsv([event], 'zh', summarizeAdminAuditEvent);
assert(csv.includes('id,createdAt,title,summary,summaryRows,module,resourceType'), 'Audit CSV should include governance headers.');
assert(csv.includes('已应用大纲导入'), 'Audit CSV should include business-readable titles.');
assert(csv.includes('M-OLD-001 -> M-ALG-001'), 'Audit CSV should include summary rows.');
assert(csv.includes('admin@example.test'), 'Audit CSV should include actor emails.');
assert(csv.includes('"{""import"":{""previewSummary""'), 'Audit CSV should export after payload JSON with CSV escaping.');
const recoveryCsv = adminAuditEventsCsv([recoveryEvent], 'zh', summarizeAdminAuditEvent);
assert(recoveryCsv.includes('已重建大纲恢复草稿'), 'Audit CSV should include recovery-draft titles.');
assert(recoveryCsv.includes('恢复草稿：#108'), 'Audit CSV should include recovery-draft summary rows.');
const reversePlanCsv = adminAuditEventsCsv([reversePlanEvent], 'zh', summarizeAdminAuditEvent);
assert(reversePlanCsv.includes('已生成大纲回滚预案'), 'Audit CSV should include reverse-plan titles.');
assert(reversePlanCsv.includes('current_topic_drifted_after_apply'), 'Audit CSV should include reverse-plan blockers.');

const filename = adminAuditEventsFilename({ organizationId: '12', organizationOnly: true, resourceType: 'syllabus-import' });
assert(filename.startsWith('admin-audit-org-12-organization-syllabus-import-'), 'Audit CSV filename should reflect active filters.');
assert(filename.endsWith('.csv'), 'Audit CSV filename should use csv extension.');

const qualityMetrics = [{
  questionId: 77,
  sourceQuestionId: 12,
  generatedVariantOf: null,
  questionStatus: 'approved',
  subject: 'math',
  topicId: 9,
  designedDifficulty: 'basic',
  empiricalDifficulty: 'hard',
  difficultyConfidence: 0.42,
  attemptCount: 30,
  correctRate: 0.2,
  medianSeconds: 76,
  unansweredRate: 0.1,
  markedRate: 0.05,
  optionSelectionStats: [{ optionId: 'B', count: 12, isCorrectOption: false, wrongSelectionRate: 0.5, qualitySignal: 'over_attractive', misconceptionTags: ['sign_error'] }],
  mostSelectedWrongOption: 'B',
  needsReview: true,
  reviewReason: 'difficulty_drift',
  qualityGovernance: { status: 'needs_review', disposition: 'regenerate', replacementQuestionId: 108, assignedTo: 8 },
  qualitySummary: {
    severity: 'high',
    reasons: ['difficulty_drift', 'over_attractive_distractor'],
    recommendedAction: 'regenerate',
    evidence: {
      attemptCount: 30,
      correctRate: 0.2,
      unansweredRate: 0.1,
      designedDifficulty: 'basic',
      empiricalDifficulty: 'hard',
      difficultyConfidence: 0.42,
      mostSelectedWrongOption: 'B',
      optionSignals: { B: 12 },
      problemOptions: [{ optionId: 'B', signal: 'over_attractive', count: 12, wrongSelectionRate: 0.5, distractorIntent: 'sign trap', misconceptionTags: ['sign_error'] }]
    }
  },
  updatedAt: '2026-06-12T09:00:00.000Z'
}];
const qualityReplacementQuestions = [{
  id: 108,
  subject: 'math',
  topicId: 9,
  blueprintId: 3,
  sourceType: 'ai',
  sourceQuestionId: null,
  generatedVariantOf: 77,
  designedDifficulty: 'basic',
  empiricalDifficulty: null,
  difficultyConfidence: null,
  questionType: 'mcq',
  prompt: 'Archived replacement prompt',
  options: [{ id: 'A', text: '1' }],
  correctAnswer: 'A',
  explanation: 'Archived replacement.',
  knowledgeTags: ['functions'],
  optionMetadata: [],
  syllabusVersion: '2026',
  generationMetadata: { purpose: 'quality_replacement', sourceQuestionId: 77 },
  reviewMetadata: { status: 'needs_review' },
  status: 'archived',
  version: 1,
  createdAt: '2026-06-12T09:05:00.000Z',
  updatedAt: '2026-06-12T09:06:00.000Z'
}];
const qualityCsv = adminAIQuestioningQualityCalibrationCsv(qualityMetrics, qualityReplacementQuestions);
assert(qualityCsv.includes('questionId,subject,topicId,status'), 'Quality calibration CSV should expose governance headers.');
assert(qualityCsv.includes('77,math,9,approved'), 'Quality calibration CSV should include question identity fields.');
assert(qualityCsv.includes('basic,hard,yes,0.42'), 'Quality calibration CSV should include difficulty drift evidence.');
assert(qualityCsv.includes('over_attractive'), 'Quality calibration CSV should include problem option signals.');
assert(qualityCsv.includes('admin-ai-questioning-quality-governance'), 'Quality calibration CSV should include the operator action target.');
assert(qualityCsv.includes('replacementQuestionId,replacementCandidateStatus,replacementFollowUp,replacementPublishedQuestionId'), 'Quality calibration CSV should include replacement follow-up columns.');
assert(qualityCsv.includes('108,archived,stale_regenerate_again'), 'Quality calibration CSV should mark stale replacement candidates.');
const qualityJson = JSON.parse(adminAIQuestioningQualityCalibrationJson(qualityMetrics, qualityReplacementQuestions));
assert(qualityJson.reportType === 'ai-questioning-quality-calibration', 'Quality calibration JSON should identify the report type.');
assert(qualityJson.summary.difficultyDrift === 1 && qualityJson.summary.regenerate === 1, 'Quality calibration JSON should summarize action signals.');
assert(qualityJson.summary.staleReplacementCandidates === 1, 'Quality calibration JSON should summarize stale replacement candidates.');
assert(qualityJson.metrics[0].replacementFollowUp === 'stale_regenerate_again', 'Quality calibration JSON should annotate replacement follow-up action.');
assert(qualityJson.actionTarget === 'admin-ai-questioning-quality-governance', 'Quality calibration JSON should include the operator action target.');
assert(adminAIQuestioningQualityCalibrationFilename('math', 'csv').startsWith('ai-questioning-quality-calibration-math-'), 'Quality calibration filename should include subject.');
assert(adminAIQuestioningQualityCalibrationFilename(undefined, 'json').startsWith('ai-questioning-quality-calibration-all-subjects-'), 'Quality calibration filename should fall back to all subjects.');

const candidateQuestions = [{
  id: 108,
  subject: 'math',
  topicId: 9,
  blueprintId: 3,
  sourceType: 'ai',
  sourceQuestionId: null,
  generatedVariantOf: 77,
  designedDifficulty: 'basic',
  empiricalDifficulty: null,
  difficultyConfidence: null,
  questionType: 'mcq',
  prompt: 'Replacement prompt',
  options: [{ id: 'A', text: '1' }],
  correctAnswer: 'A',
  explanation: 'Because it follows the rule.',
  knowledgeTags: ['functions'],
  optionMetadata: { A: { distractorIntent: null } },
  syllabusVersion: '2026',
  generationMetadata: { purpose: 'quality_replacement', sourceQuestionId: 77 },
  reviewMetadata: { status: 'failed', issues: [{ code: 'single_correct_answer', severity: 'error', message: 'ambiguous' }] },
  status: 'review_failed',
  version: 1,
  createdAt: '2026-06-12T09:10:00.000Z',
  updatedAt: '2026-06-12T09:12:00.000Z'
}];
const candidateCsv = adminAIQuestioningCandidateQueueCsv(candidateQuestions, 'replacement');
assert(candidateCsv.includes('id,subject,topicId,blueprintId,status'), 'Candidate queue CSV should expose governance headers.');
assert(candidateCsv.includes('generatedVariantOf,isReplacementCandidate,replacementSourceQuestionId'), 'Candidate queue CSV should expose replacement source fields.');
assert(candidateCsv.includes('108,math,9,3,review_failed'), 'Candidate queue CSV should include candidate identity fields.');
assert(candidateCsv.includes('yes,77'), 'Candidate queue CSV should mark replacement candidates and source ids.');
assert(candidateCsv.includes('single_correct_answer'), 'Candidate queue CSV should include review issue codes.');
assert(candidateCsv.includes('admin-ai-questioning-candidates'), 'Candidate queue CSV should include the operator action target.');
const candidateJson = JSON.parse(adminAIQuestioningCandidateQueueJson(candidateQuestions, 'replacement'));
assert(candidateJson.reportType === 'ai-questioning-candidate-queue', 'Candidate queue JSON should identify the report type.');
assert(candidateJson.summary.replacementCandidates === 1 && candidateJson.summary.reviewFailed === 1, 'Candidate queue JSON should summarize replacement and review-failed counts.');
assert(candidateJson.actionTarget === 'admin-ai-questioning-candidates', 'Candidate queue JSON should include the operator action target.');
assert(adminAIQuestioningCandidateQueueFilename('math', 'replacement', 'csv').startsWith('ai-questioning-candidates-math-replacement-'), 'Candidate queue filename should include subject and filter.');
assert(adminAIQuestioningCandidateQueueFilename(undefined, 'all', 'json').startsWith('ai-questioning-candidates-all-subjects-all-'), 'Candidate queue filename should fall back to all subjects and all filter.');

const readiness = {
  subject: 'math',
  status: 'blocked',
  score: 62,
  nextAction: 'retry_or_clear_generation_queue',
  blockers: [{ key: 'generation_queue_blocked', count: 2, action: 'retry_or_clear_generation_queue' }],
  warnings: [{ key: 'missing_blueprints', count: 3, action: 'ensure_blueprint_coverage' }],
  latestAuditEvent: {
    id: 5,
    actorId: 9,
    actorEmail: 'operator@example.test',
    module: 'ai-questioning',
    resourceType: 'operational-readiness',
    resourceId: 'math',
    action: 'download_json',
    createdAt: '2026-06-12T08:05:00.000Z'
  },
  dimensions: {
    blueprintCoverage: { total: 10, missingTopicCount: 3, coveredTopicCount: 7, pausedBlueprintCount: 0, status: 'needs_attention' },
    topicBank: { total: 8, missingBlueprintCount: 1, needsCandidateCount: 2, needsPublishCount: 0, needsQualityReviewCount: 1, healthyCount: 4, status: 'needs_attention' },
    generationQueue: { total: 4, pendingCount: 1, runningCount: 0, completedCount: 1, failedCount: 2, blockedCount: 2, status: 'blocked', recommendedAction: 'retry_failed' },
    syllabusGovernance: { total: 20, missingVersionCount: 0, outdatedCount: 5, pendingReviewCount: 2, publishedCount: 13, status: 'needs_attention' },
    qualityGovernance: { status: 'blocked', needsReviewCount: 6, highSeverityCount: 1, escalationCount: 1, dueSoonCount: 2 }
  },
  generatedAt: '2026-06-12T08:00:00.000Z'
};
const readinessCsv = aiQuestioningReadinessCsv(readiness);
assert(readinessCsv.includes('section,key,status,count,action,details'), 'Readiness CSV should include operational headers.');
assert(readinessCsv.includes('summary,math,blocked,62,retry_or_clear_generation_queue'), 'Readiness CSV should include a summary row.');
assert(readinessCsv.includes('blocker,generation_queue_blocked,blocked,2,retry_or_clear_generation_queue'), 'Readiness CSV should include blockers.');
assert(readinessCsv.includes('warning,missing_blueprints,blocked,3,ensure_blueprint_coverage'), 'Readiness CSV should include warnings.');
assert(readinessCsv.includes('audit,latest,blocked,,download_json'), 'Readiness CSV should include the latest audit event.');
assert(readinessCsv.includes('operator@example.test'), 'Readiness CSV should include the latest audit operator.');
assert(readinessCsv.includes('2026-06-12T08:05:00.000Z'), 'Readiness CSV should include the latest audit timestamp.');
assert(readinessCsv.includes('dimension,generationQueue,blocked,,retry_failed'), 'Readiness CSV should include dimension recommended actions.');
const readinessJson = JSON.parse(aiQuestioningReadinessJson(readiness));
assert(readinessJson.reportType === 'ai-questioning-operational-readiness', 'Readiness JSON should include report type.');
assert(readinessJson.readiness.score === 62, 'Readiness JSON should preserve the full readiness payload.');
assert(aiQuestioningReadinessFilename(readiness, 'json').startsWith('ai-questioning-readiness-math-'), 'Readiness filename should include subject scope.');
assert(aiQuestioningReadinessFilename({ ...readiness, subject: null }, 'csv').startsWith('ai-questioning-readiness-all-subjects-'), 'Readiness filename should fall back to all subjects.');
assert(aiQuestioningReadinessActionTarget('retry_or_clear_generation_queue') === 'admin-ai-questioning-generation-governance', 'Generation blockers should jump to generation governance.');
assert(aiQuestioningReadinessActionTarget('refresh_syllabus_governance') === 'admin-ai-questioning-syllabus-tools', 'Syllabus refresh should jump to always-visible syllabus tools.');
assert(aiQuestioningReadinessActionTarget('review_syllabus_pending_questions') === 'admin-ai-questioning-syllabus-governance', 'Syllabus review should jump to pending review samples.');
assert(aiQuestioningReadinessActionTarget('assign_or_resolve_quality_reviews') === 'admin-ai-questioning-quality-governance', 'Quality blockers should jump to quality governance.');
assert(aiQuestioningReadinessActionTarget('unknown_action') === 'admin-audit-questioning', 'Unknown readiness actions should fall back to the AI questioning panel.');

const readinessAudit = summarizeAdminAuditEvent({
  ...event,
  id: 2,
  module: 'ai-questioning',
  resourceType: 'operational-readiness',
  resourceId: 'math',
  action: 'download_json',
  after: {
    event: 'download_json',
    subject: 'math',
    status: 'blocked',
    score: 62,
    nextAction: 'retry_or_clear_generation_queue',
    targetId: 'admin-ai-questioning-generation-governance',
    format: 'json',
    blockers: [{ key: 'generation_queue_blocked', count: 2 }],
    warnings: [{ key: 'missing_blueprints', count: 3 }]
  }
}, 'zh');
assert(readinessAudit?.title === '已下载题库运转报告', 'Readiness audit summary should describe downloaded reports.');
assert(readinessAudit.detail.includes('就绪分 62/100'), 'Readiness audit summary should include score.');
assert(readinessAudit.detail.includes('JSON'), 'Readiness audit summary should include report format.');
assert(readinessAudit.rows[0].includes('admin-ai-questioning-generation-governance'), 'Readiness audit summary should include target section rows.');
assert(readinessAudit.tone === 'danger', 'Readiness audit summary should use danger tone when blocked.');

const adminAuditShellSource = readFileSync(new URL('../src/pages/AdminAuditPage.tsx', import.meta.url), 'utf8');
const adminAIQuestionBankPageSource = readFileSync(new URL('../src/pages/AdminAIQuestionBankPage.tsx', import.meta.url), 'utf8');
const aiQuestionBankComponentsDir = new URL('../src/components/admin/ai-question-bank/', import.meta.url);
const aiQuestionBankComponentsSource = readdirSync(aiQuestionBankComponentsDir, { withFileTypes: true })
  .filter((entry) => entry.isFile() && /\.(ts|tsx)$/.test(entry.name))
  .map((entry) => readFileSync(new URL(entry.name, aiQuestionBankComponentsDir), 'utf8'))
  .join('\n');
const aiQuestionBankSource = `${adminAIQuestionBankPageSource}\n${aiQuestionBankComponentsSource}`;
const adminAuditPageSource = `${adminAuditShellSource}\n${aiQuestionBankSource}`;
const apiTypesSource = readFileSync(new URL('../src/lib/api-types.ts', import.meta.url), 'utf8');
const apiAdminSource = readFileSync(new URL('../src/lib/api-admin.ts', import.meta.url), 'utf8');
const aiQuestioningControllerSource = readFileSync(new URL('../../backend/src/ai-questioning/ai-questioning.controller.ts', import.meta.url), 'utf8');
const aiQuestioningServiceSource = readFileSync(new URL('../../backend/src/ai-questioning/ai-questioning.service.ts', import.meta.url), 'utf8');
const questionQualityServiceSource = readFileSync(new URL('../../backend/src/ai-questioning/question-quality.service.ts', import.meta.url), 'utf8');
const cscaAdaptiveServiceSource = readFileSync(new URL('../../backend/src/csca-special-practice/csca-adaptive.service.ts', import.meta.url), 'utf8');
const cscaLearningServiceSource = readFileSync(new URL('../../backend/src/csca-learning/csca-learning.service.ts', import.meta.url), 'utf8');
const adaptivePlannerServiceSource = readFileSync(new URL('../../backend/src/csca-special-practice/adaptive-planner.service.ts', import.meta.url), 'utf8');
const adaptiveQuestionProviderSource = readFileSync(new URL('../../backend/src/csca-special-practice/adaptive-question-provider.service.ts', import.meta.url), 'utf8');
assert(adminAuditPageSource.includes('aiQuestioningOperationalReadinessAuditTrail'), 'Admin audit page should expose a readiness audit trail action.');
assert(adminAuditPageSource.includes('aiQuestioningOperationalReadinessLatestAudit'), 'Admin audit page should show the latest readiness audit event.');
assert(adminAuditPageSource.includes('{actor}'), 'Latest readiness audit copy should include the operator.');
assert(adminAuditPageSource.includes('aiQuestioningOperationalReadinessNoAudit'), 'Admin audit page should show an empty readiness audit state.');
assert(adminAuditPageSource.includes('actorEmail: result.latestAuditEvent.actorEmail'), 'Readiness audit tracking should carry actor email into the visible audit list.');
assert(adminAuditPageSource.includes('latestAuditEvent: result.latestAuditEvent'), 'Readiness audit tracking should update the card with the saved audit event.');
assert(adminAuditPageSource.includes('setEvents((current) => [nextEvent'), 'Readiness audit tracking should insert matching saved events into the visible audit list.');
assert(adminAuditPageSource.includes('const latestAuditEvent = await trackAIQuestioningReadinessEvent'), 'Readiness report downloads should save the audit event before exporting.');
assert(adminAuditPageSource.includes('const readinessForExport = latestAuditEvent'), 'Readiness report downloads should include the saved audit event in the exported report.');
assert(adminAuditPageSource.includes('admin-audit-events'), 'Admin audit page should provide a stable audit-events anchor.');
assert(adminAuditPageSource.includes("resourceType: 'operational-readiness'"), 'Readiness audit trail action should set the operational-readiness filter.');
assert(adminAuditPageSource.includes('admin-audit-template-actions'), 'Admin audit page should expose common audit filter templates.');
assert(adminAuditPageSource.includes('applyAdminAuditFilterTemplate'), 'Admin audit page should apply templates through the shared helper.');
assert(adminAuditPageSource.includes('ADMIN_AUDIT_RESOURCE_TYPES.map'), 'Admin audit page should render audit resource filters from the shared allow-list.');
assert(adminAuditPageSource.includes('ADMIN_AUDIT_RESOURCE_TYPES,\n  applyAdminAuditFilterTemplate'), 'Admin audit page should import the audit resource allow-list before rendering filters.');
assert(adminAuditPageSource.includes('question_production'), 'Admin audit page should expose a question-production audit quick template.');
assert(adminAuditPageSource.includes('quality_governance'), 'Admin audit page should expose a quality-governance audit quick template.');
assert(aiQuestionBankSource.includes('runQualityBulk') && aiQuestionBankSource.includes('bulkAdminAIQuestioningQuality'), 'AI question bank should support quality metric bulk actions.');
assert(aiQuestionBankSource.includes("onBulkQuality('send_to_review'"), 'AI question bank should bulk send quality metrics to review.');
assert(aiQuestionBankSource.includes("onBulkQuality('regenerate'"), 'AI question bank should bulk regenerate selected quality metrics.');
assert(aiQuestionBankSource.includes("onApplyDisposition(metric.questionId, 'reduce_exposure'"), 'AI question bank should reduce exposure for individual quality metrics.');
assert(aiQuestionBankSource.includes("onApplyDisposition(metric.questionId, 'archive'"), 'AI question bank should archive low-quality questions.');
assert(aiQuestionBankSource.includes("onApplyDisposition(metric.questionId, 'manual_fix'"), 'AI question bank should route quality metrics to manual fixes.');
assert(aiQuestionBankSource.includes('发布替换仍需要候选审核'), 'AI question bank should explain replacement publishing remains candidate-review gated.');
assert(aiQuestionBankSource.includes('QualitySummaryPanels') && aiQuestionBankSource.includes('质量校准摘要'), 'AI question bank should summarize quality calibration signals.');
assert(aiQuestionBankSource.includes('calibration.highRisk'), 'AI question bank should surface high-risk quality signals.');
assert(aiQuestionBankSource.includes('calibration.regenerate'), 'AI question bank should surface regenerate quality signals.');
assert(aiQuestionBankSource.includes('metric.empiricalDifficulty !== metric.designedDifficulty') || aiQuestionBankSource.includes('difficultyDrift'), 'AI question bank should identify difficulty drift samples.');
assert(aiQuestionBankSource.includes('calibration.difficultyDrift'), 'AI question bank should make difficulty drift samples visible for handling.');
assert(aiQuestionBankSource.includes('exportQualityMetrics'), 'AI question bank should provide quality calibration report downloads.');
assert(aiQuestionBankSource.includes('adminAIQuestioningQualityCalibrationCsv(qualityMetrics, qualityQuestions)'), 'Quality CSV download should export the current quality list with candidate status evidence.');
assert(aiQuestionBankSource.includes('adminAIQuestioningQualityCalibrationJson(qualityMetrics, qualityQuestions)'), 'Quality JSON download should export the current quality list with candidate status evidence.');
assert(aiQuestionBankSource.includes('exportQualityMetrics') && aiQuestionBankSource.includes("onExportQualityMetrics('csv')"), 'AI question bank should label the quality CSV export action.');
assert(aiQuestionBankSource.includes('exportQualityMetrics') && aiQuestionBankSource.includes("onExportQualityMetrics('json')"), 'AI question bank should label the quality JSON export action.');
assert(aiQuestionBankSource.includes('governance.byReason'), 'AI question bank should derive quality action groups.');
assert(aiQuestionBankSource.includes("onApplyDisposition(metric.questionId, 'manual_fix'"), 'Manual-fix quality groups should explain the follow-up boundary.');
assert(aiQuestionBankSource.includes("onBulkQuality('regenerate'"), 'Regenerate quality groups should explain candidate review boundaries.');
assert(aiQuestionBankSource.includes('QualityMetricsTable'), 'AI question bank should render per-question quality follow-up text.');
assert(adminAuditPageSource.includes('replacementPublishedQuestionId'), 'Regenerate follow-up text should show whether a replacement has been published.');
assert(aiQuestionBankSource.includes('staleCandidate'), 'Regenerate follow-up text should explain stale replacement candidates.');
assert(aiQuestionBankSource.includes('替代候选跟进'), 'AI question bank should summarize replacement candidate follow-up.');
assert(adminAuditPageSource.includes('draftedUnpublished'), 'Replacement summary should distinguish drafted unpublished candidates.');
assert(adminAuditPageSource.includes('staleCandidate'), 'Replacement summary should distinguish rejected or archived replacement candidates.');
assert(adminAuditPageSource.includes('metric.replacementCandidateStatus'), 'Replacement summary should fall back to metric replacement candidate status.');
assert(adminAuditPageSource.includes('needsCandidate'), 'Replacement summary should distinguish regenerate recommendations that still need candidates.');
assert(aiQuestionBankSource.includes('draftedUnpublished'), 'Replacement summary should expose drafted candidates.');
assert(aiQuestionBankSource.includes('replacementSummary.draftedUnpublished'), 'Drafted replacement summary should surface matching quality rows.');
assert(aiQuestionBankSource.includes('replacementSummary.published'), 'Published replacement summary should focus the resolved quality follow-up rows.');
assert(aiQuestionBankSource.includes('替代候选跟进') && aiQuestionBankSource.includes('replacementSummary'), 'Candidate review list should surface replacement candidate follow-up.');
assert(aiQuestionBankSource.includes('CoverageWorkPanel') && aiQuestionBankSource.includes('来源：CSCA'), 'AI question bank should show blueprint syllabus governance state.');
assert(aiQuestionBankSource.includes('buildTopicHealthWorkView') && aiQuestionBankSource.includes("topic.action === 'ensure_blueprint'"), 'Topic health should derive blueprint repair rows from syllabus/topic state.');
assert(aiQuestionBankSource.includes('onHandleTopicAction') && aiQuestionBankSource.includes('handleTopicHealthAction'), 'Topic health actions should be wired.');
assert(aiQuestionBankSource.includes('runTopicBulk') && aiQuestionBankSource.includes('topicBulkProgress'), 'Topic health bulk actions should provide inline progress instead of relying on in-page jumps.');
assert(aiQuestionBankSource.includes('onBulkApprove') && aiQuestionBankSource.includes('CandidateBulkProgressLine'), 'Candidate bulk actions should summarize publish/reject/archive outcomes.');
assert(aiQuestionBankSource.includes('publishAllBusy') && aiQuestionBankSource.includes('发布全部可发布题') && aiQuestionBankSource.includes('后台会分批执行'), 'Candidate review should expose publish-all progress feedback.');
assert(aiQuestionBankSource.includes('onApprove(question') && aiQuestionBankSource.includes('候选审核队列'), 'Single candidate approval should use the candidate review wrapper.');
assert(aiQuestionBankSource.includes('onBulkQuality') && aiQuestionBankSource.includes('quality-bulk-regenerate'), 'Bulk quality actions should share quality follow-up handling.');
assert(aiQuestionBankSource.includes('useGenerationQueuePolling'), 'Generation queue should poll queued/running jobs.');
assert(aiQuestionBankSource.includes('staleRunning') && aiQuestionBankSource.includes('generationQueue.summary'), 'Generation job rows should surface stale running jobs.');
assert(aiQuestionBankSource.includes('getAdminAIQuestioningGenerationQueueHealth({ subject: subject || undefined'), 'Process queue should use subject-aware generation queue polling.');
assert(!adminAuditShellSource.includes('processAdminAIQuestioningGenerationJobs'), 'Process queue should not use the unscoped process endpoint from the admin page.');
assert(aiQuestionBankSource.includes('已排队') && aiQuestionBankSource.includes('已生成候选题'), 'Generation feedback should explain queued and generated candidate work.');
assert(aiQuestioningServiceSource.includes("underlyingAction: result.action"), 'Topic quality action should preserve the quality-governance action in its result.');
assert(aiQuestioningServiceSource.includes("this.qualityService.bulkAction"), 'Topic quality action should use quality governance instead of candidate review.');
assert(aiQuestioningServiceSource.includes('archivePublishedPracticeQuestion'), 'Candidate governance actions should synchronize published practice-pool records.');
assert(aiQuestioningServiceSource.includes("reason: 'admin_archive'") || aiQuestioningServiceSource.includes("'admin_archive'"), 'Archiving approved candidates should record practice-pool archive intent.');
assert(aiQuestioningServiceSource.includes("reason: 'admin_reject'") || aiQuestioningServiceSource.includes("'admin_reject'"), 'Rejecting approved candidates should record practice-pool archive intent.');
assert(aiQuestioningServiceSource.includes("'quality_replacement'"), 'Quality replacement approval should retire the replaced practice-pool question.');
assert(questionQualityServiceSource.includes('archivePublishedPracticeQuestion'), 'Quality archive disposition should synchronize published practice-pool records.');
assert(questionQualityServiceSource.includes("'quality_archive'"), 'Quality archive disposition should record practice-pool archive intent.');
assert(questionQualityServiceSource.includes('refreshUnifiedQuestionMetrics'), 'Quality refresh should aggregate metrics at the unified CSCA question level.');
assert(questionQualityServiceSource.includes('item."question_source" = \'csca_question\'') && questionQualityServiceSource.includes("COALESCE(item.\"question_source\", 'special_practice') = 'special_practice'"), 'Quality aggregation should merge direct unified-bank and legacy special-practice attempts.');
assert(cscaAdaptiveServiceSource.includes("questionSource: result.item.questionSource || 'special_practice'"), 'Adaptive submit should pass question source into learning wrong-pattern evidence.');
assert(cscaLearningServiceSource.includes('recentQuestionRefs') && cscaLearningServiceSource.includes('lastQuestionSource'), 'Learning wrong-pattern metadata should preserve source-aware question refs.');
assert(adaptivePlannerServiceSource.includes('recentQuestionRefsFrom') && adaptivePlannerServiceSource.includes('legacy_unknown'), 'Adaptive planner should read source-aware wrong-pattern refs with a legacy fallback.');
assert(adaptivePlannerServiceSource.includes('generatedVariantOf: { in: sourceQuestionIds }') && !adaptivePlannerServiceSource.includes('OR: [\n        { id: { in: sourceQuestionIds } }'), 'Adaptive planner should avoid broad naked-id/sourceQuestionId lookups when resolving remediation variants.');
assert(adaptiveQuestionProviderSource.includes('exposurePenaltyFromGovernance'), 'Adaptive provider should read quality governance when sorting exposure.');
assert(adaptiveQuestionProviderSource.includes("disposition === 'reduce_exposure'"), 'Reduced-exposure quality disposition should affect adaptive question ordering.');
assert(aiQuestioningServiceSource.includes('q."syllabus_version" = topic_rows."syllabus_version"'), 'Topic health practice-ready counts should require current syllabus alignment.');
assert(aiQuestioningServiceSource.includes('spq."status" = \'published\''), 'Topic health bridge counts should require an active published practice bridge.');
assert(aiQuestioningServiceSource.includes('row.publishedQuestionCount === 0 && row.pendingReviewCount === 0'), 'Topic health should use practice-ready capacity, not broad approved totals, before marking a topic as needing candidates.');
assert(aiQuestioningServiceSource.includes('row.publishedQuestionCount === 0') && !aiQuestioningServiceSource.includes('row.approvedQuestionCount === 0\n            ? \'needs_publish\''), 'Topic health should use current practice-ready counts before marking a topic as needing publish.');
assert(aiQuestioningServiceSource.includes('"excluded_scope"') && aiQuestioningServiceSource.includes('excludedScope: optionalStringArray(topic.excludedScope)'), 'Syllabus JSON excludedScope should persist on topics and flow into blueprint/generation context.');
assert(aiQuestioningServiceSource.includes('syllabusScope: generatedSyllabusScope(blueprint)'), 'Generation jobs should record the resolved syllabus scope used for AI question production.');
assert(aiQuestioningServiceSource.includes('blueprintSyncedCount') && aiQuestioningServiceSource.includes("'syllabusGovernance', jsonb_build_object"), 'Syllabus import apply should synchronize affected blueprint syllabus scopes.');
assert(aiQuestioningServiceSource.includes("blueprint.topicStatus !== 'published'"), 'Direct blueprint generation should reject unpublished syllabus topics.');
assert(aiQuestioningServiceSource.includes('confirmBlueprintSyllabusSync') && aiQuestioningControllerSource.includes('confirm_syllabus'), 'Admins should be able to explicitly confirm blueprint syllabus sync with audit coverage.');
assert(apiAdminSource.includes('updateAdminAIQuestioningBlueprint') && apiAdminSource.includes("method: 'PATCH'"), 'Admin API should expose blueprint constraint updates.');
assert(aiQuestioningControllerSource.includes('update_constraints') && aiQuestioningServiceSource.includes('updateBlueprint(blueprintIdValue'), 'Blueprint edits should go through an audited backend update action.');
assert(aiQuestioningServiceSource.includes('blueprintGovernance') && aiQuestioningServiceSource.includes('admin_blueprint_constraint_update'), 'Blueprint edits should record governance metadata inside constraints.');
assert(aiQuestionBankSource.includes('CoverageWorkPanel') && aiQuestionBankSource.includes('补齐蓝图'), 'Admin blueprint queue should provide an automatic syllabus-driven blueprint repair flow.');
assert(aiQuestionBankSource.includes('按大纲生成蓝图') && aiQuestionBankSource.includes('批量按大纲生成蓝图'), 'Blueprint generation UI should explain the syllabus-driven boundary to operators.');
assert(aiQuestionBankSource.includes('CandidateReviewPanel') && aiQuestionBankSource.includes('useCandidateReviewState'), 'Candidate review list should derive a triage queue.');
assert(aiQuestionBankSource.includes('topicActionHint'), 'Topic health actions should show concrete action labels instead of a generic handle label.');
assert(!adminAuditShellSource.includes("else {\n        window.setTimeout(() => focusAdminAuditSection('admin-ai-questioning-topic-health')"), 'Ensuring a blueprint from topic health should not force a confusing in-page jump.');
assert(aiQuestionBankSource.includes("status === 'fallback'") && aiQuestionBankSource.includes("['pending_review', 'review_failed']"), 'Candidate review list should support status/source filters.');
assert(aiQuestionBankSource.includes('candidateUsesFallback'), 'Candidate review list should derive fallback candidates separately from true AI candidates.');
assert(aiQuestionBankSource.includes('queue.visible'), 'Candidate review list should render the filtered queue instead of only the first raw candidates.');
assert(aiQuestionBankSource.includes('selectedCandidateIds') && aiQuestionBankSource.includes('selectedIds'), 'Candidate review list should track selected candidates.');
assert(aiQuestionBankSource.includes('selectVisibleRows'), 'Candidate review list should support selecting visible candidates.');
assert(aiQuestionBankSource.includes('runSelected') && aiQuestionBankSource.includes('批量复审'), 'Candidate review list should bulk review selected candidates.');
assert(aiQuestionBankSource.includes('runSelected') && aiQuestionBankSource.includes('批量通过并发布'), 'Candidate review list should bulk approve selected candidates.');
assert(aiQuestionBankSource.includes('runSelected') && aiQuestionBankSource.includes('批量拒绝'), 'Candidate review list should bulk reject selected candidates.');
assert(aiQuestionBankSource.includes('CandidateBulkProgressLine'), 'Candidate bulk actions should report requested/succeeded/failed counts.');
assert(aiQuestionBankSource.includes('admin-feedback'), 'Candidate queue should show bulk feedback near the queue controls.');
assert(aiQuestionBankSource.includes('exportCandidateQueue'), 'Candidate review list should provide queue report downloads.');
assert(aiQuestionBankSource.includes('adminAIQuestioningCandidateQueueCsv(candidateQuestions, filterLabel)'), 'Candidate CSV download should export the current filtered queue.');
assert(aiQuestionBankSource.includes('adminAIQuestioningCandidateQueueJson(candidateQuestions, filterLabel)'), 'Candidate JSON download should export the current filtered queue.');
assert(aiQuestionBankSource.includes("onExportCsv") && aiQuestionBankSource.includes("onExportJson"), 'Admin AI question bank should label candidate export actions.');
assert(aiQuestionBankSource.includes('questionEditDrafts'), 'Candidate review list should keep per-question manual fix drafts.');
assert(aiQuestionBankSource.includes('saveEdit') && aiQuestionBankSource.includes('CandidateQuestionEditor'), 'Candidate review list should save manual fixes.');
assert(aiQuestionBankSource.includes('updateAdminAIQuestioningQuestion(question.id'), 'Candidate manual fixes should call the update API.');
assert(aiQuestionBankSource.includes('candidateAgentEvidence') && aiQuestionBankSource.includes('generator'), 'Candidate review evidence should expose generation source metadata.');
assert(aiQuestionBankSource.includes('styleProfile') && aiQuestionBankSource.includes('syllabusAlignment'), 'Candidate review evidence should show syllabus and style-profile context.');
assert(aiQuestionBankSource.includes('interactionId'), 'Candidate review evidence should show generation/review interaction ids for cache/provenance review.');
assert(aiQuestionBankSource.includes('candidateReviewExplanation') && aiQuestionBankSource.includes('reviewIssueText'), 'Candidate review issues should show human-readable guidance and suggested actions.');
assert(adminAuditPageSource.includes('excluded_scope_overlap') && adminAuditPageSource.includes('invalid_correct_answer') && adminAuditPageSource.includes('prompt_leakage'), 'Review issue guidance should cover high-risk syllabus, answer, and leakage cases.');
assert(aiQuestionBankSource.includes('candidateReviewExplanation') && aiQuestionBankSource.includes('gate.decision'), 'Candidate review rows should expose the primary review gate action.');
assert(aiQuestionBankSource.includes('human_review') && aiQuestionBankSource.includes('manual_override_publishable'), 'Candidate gate rules should include human-confirmation outcomes.');
assert(aiQuestionBankSource.includes('regenerate') && aiQuestionBankSource.includes('publishable'), 'Candidate gate rules should distinguish regenerate and publish-ready outcomes.');
assert(aiQuestionBankSource.includes("status === 'fallback'") && aiQuestionBankSource.includes('candidateUsesFallback'), 'Candidate queue should support status/source filtering.');
assert(aiQuestionBankSource.includes('queue.visible') && aiQuestionBankSource.includes('pending:') && aiQuestionBankSource.includes('failed:') && aiQuestionBankSource.includes('fallback:'), 'Candidate queue should derive visible rows and summary counts.');
assert(aiQuestionBankSource.includes('filterLabel'), 'Candidate queue exports should include the active queue filter label.');
assert(aiQuestionBankSource.includes('clearSelection'), 'Candidate queue should let operators clear active selections.');
assert(aiQuestionBankSource.includes('当前筛选下没有候选题。'), 'Candidate queue should distinguish filtered-empty state from no candidates.');
assert(aiQuestionBankSource.includes('保存修订'), 'Candidate manual fix UI should label save clearly.');
assert(aiQuestionBankSource.includes('saveEdit') && aiQuestionBankSource.includes("action: 'review'"), 'Candidate manual fixes should preserve the review-gated publishing boundary.');
assert(apiAdminSource.includes('updateAdminAIQuestioningQuestion'), 'Admin API client should expose candidate manual updates.');
assert(apiAdminSource.includes("method: 'PATCH'"), 'Admin API client should patch candidate manual updates.');
assert(aiQuestioningControllerSource.includes('manual_fix_and_review'), 'AI questioning controller should audit manual fixes.');
assert(aiQuestioningServiceSource.includes('updateQuestionDraft'), 'AI questioning service should support candidate manual fixes.');
assert(aiQuestioningServiceSource.includes("status\" = CASE WHEN \"status\" = 'draft' THEN 'draft' ELSE 'pending_review' END"), 'Manual fixes should not publish candidates directly.');
assert(aiQuestioningServiceSource.includes('manualEditGate'), 'Manual fixes should rerun review and record the review gate.');
assert(aiQuestioningServiceSource.includes('reviewGate'), 'Candidate review should record a review gate.');
assert(aiQuestioningServiceSource.includes('existingReviewMetadata'), 'Manual fixes should preserve existing governance metadata while rerunning review.');
assert(aiQuestioningServiceSource.includes("review_metadata\"->'syllabusGovernance'->>'status' = 'needs_review'"), 'Syllabus governance should only count syllabus-owned pending reviews.');
assert(aiQuestioningServiceSource.includes('confirmSyllabusQuestionReview'), 'AI questioning service should expose a dedicated syllabus confirmation action.');
assert(aiQuestioningServiceSource.includes('"syllabus_version" = ${row.topicSyllabusVersion}'), 'Confirming a syllabus-reviewed question should sync to the current topic syllabus version.');
assert(aiQuestioningServiceSource.includes("resolvedBy: 'syllabus_confirmation'"), 'Confirming a syllabus-reviewed question should resolve syllabus governance metadata.');
assert(apiAdminSource.includes('confirmAdminAIQuestioningSyllabusQuestion'), 'Admin API should expose syllabus question confirmation.');
assert(adminAuditPageSource.includes('confirmAdminAIQuestioningSyllabusQuestion') && adminAuditPageSource.includes('onConfirmSyllabusQuestion'), 'Admin audit page should wire syllabus question confirmation.');
assert(adminAuditPageSource.includes('确认仍适用'), 'Admin audit page should expose a clear syllabus confirmation button.');
assert(apiTypesSource.includes('generatedVariantOf: number | null;'), 'AI questioning question API type should expose generatedVariantOf.');

const adminWorkPart03Source = readFileSync(new URL('../src/styles/admin-work.part-03.css', import.meta.url), 'utf8');
assert(adminWorkPart03Source.includes('admin-quality-action-groups'), 'Admin styles should include quality action group layout.');
assert(adminWorkPart03Source.includes('grid-template-columns: minmax(220px, 1.2fr) repeat(5'), 'Quality action groups should support the five operator buckets.');
assert(adminWorkPart03Source.includes('admin-quality-follow-up'), 'Admin styles should include quality follow-up status styling.');
assert(adminWorkPart03Source.includes('admin-candidate-queue-panel'), 'Admin styles should include candidate queue triage layout.');
assert(adminWorkPart03Source.includes('admin-candidate-filter-chips'), 'Admin styles should include candidate queue filter chips.');
assert(adminWorkPart03Source.includes('admin-candidate-bulk-actions'), 'Admin styles should include candidate queue bulk actions.');
assert(adminWorkPart03Source.includes('admin-candidate-feedback'), 'Admin styles should include candidate queue feedback styling.');
assert(adminWorkPart03Source.includes('admin-inline-editor'), 'Admin styles should include inline editor layout for blueprint governance forms.');
assert(adminWorkPart03Source.includes('admin-code-chip'), 'Admin styles should include wrapping code chips for generation hashes.');
assert(adminWorkPart03Source.includes('admin-review-guidance'), 'Admin styles should include readable review guidance rows.');
assert(adminWorkPart03Source.includes('admin-review-recommendation'), 'Admin styles should include candidate review recommendation cards.');
assert(adminWorkPart03Source.includes('admin-candidate-recommendation-chips'), 'Admin styles should include recommendation filter chip styling.');
assert(adminWorkPart03Source.includes('admin-candidate-active-filter-chips'), 'Admin styles should include active candidate filter chips.');
assert(adminWorkPart03Source.includes('admin-topic-action-feedback'), 'Admin styles should include inline topic action feedback.');

console.log('Admin audit summary check passed.');

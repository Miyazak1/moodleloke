import { expect, test, type Page, type Route } from '@playwright/test';

const TOKEN = 'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJleHAiOjE4OTM0NTYwMDB9.admin-console-parity';
const NOW = '2026-06-15T09:00:00.000Z';
const E2E_ORIGIN = process.env.E2E_BASE_URL || `http://${process.env.E2E_HOST || '127.0.0.1'}:${process.env.E2E_PORT || '5187'}`;

test.use({
  storageState: {
    cookies: [],
    origins: [
      {
        origin: E2E_ORIGIN,
        localStorage: [
          { name: 'cscalite.locale', value: 'zh-CN' },
          { name: 'cscalite.accessToken', value: TOKEN }
        ]
      }
    ]
  }
});

test.beforeEach(async ({ page }) => {
  await page.addInitScript((token) => {
    window.localStorage.setItem('cscalite.locale', 'zh-CN');
    window.localStorage.setItem('cscalite.accessToken', token);
  }, TOKEN);
});

function json(route: Route, body: unknown) {
  return route.fulfill({
    contentType: 'application/json',
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, content-type, x-csrf-token',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS'
    },
    body: JSON.stringify(body)
  });
}

function metricBucket(key: string) {
  return {
    key,
    interactions: 128,
    fallbackInteractions: 8,
    externalInteractions: 120,
    successfulInteractions: 116,
    rejectedInteractions: 4,
    errorInteractions: 3,
    billableInteractions: 118,
    estimatedTokens: 64200,
    estimatedCost: 38.5,
    feedbackCount: 21,
    lowFeedbackCount: 2,
    averageRating: 4.4
  };
}

function sampleQuestion(id = 501, status = 'pending_review') {
  return {
    id,
    subject: 'math',
    topicId: 31,
    blueprintId: 91,
    sourceType: 'ai_generated',
    sourceQuestionId: null,
    generatedVariantOf: id === 502 ? 501 : null,
    designedDifficulty: 'medium',
    empiricalDifficulty: 'hard',
    difficultyConfidence: 0.42,
    questionType: 'single_choice',
    prompt: id === 502 ? '替代候选：二次函数顶点式判断' : '函数与方程的交点个数如何判断？',
    options: [
      { id: 'A', text: '看判别式' },
      { id: 'B', text: '看函数值域' }
    ],
    correctAnswer: 'A',
    explanation: '利用判别式判断交点个数。',
    knowledgeTags: ['函数', '方程'],
    optionMetadata: {},
    syllabusVersion: 'CSCA-2026',
    generationMetadata: { provider: 'openai' },
    reviewMetadata: { syllabusStatus: 'pending_review' },
    status,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW
  };
}

function sampleReadiness() {
  return {
    subject: null,
    status: 'needs_attention',
    score: 72,
    nextAction: '先处理大纲与蓝图缺口，再重试失败任务',
    blockers: [{ key: 'generation_queue_failed', count: 2, action: 'retry_failed' }],
    warnings: [{ key: 'syllabus_stale', count: 1, action: 'refresh_syllabus' }],
    dimensions: {
      syllabusGovernance: { status: 'needs_attention', staleCount: 1, unpublishedTopicCount: 2, pendingReviewCount: 3 },
      blueprintCoverage: { status: 'needs_attention', publishedTopicCount: 18, coveredTopicCount: 15, missingTopicCount: 3 },
      topicBank: { status: 'working', missingBlueprintCount: 3, needsCandidateCount: 4, needsPublishCount: 5, needsQualityReviewCount: 2 },
      generationQueue: { status: 'blocked', queued: 6, running: 1, failed: 2, staleRunning: 1, recommendedAction: 'retry_failed' },
      qualityGovernance: { status: 'needs_attention', needsReviewCount: 4, highSeverityCount: 1, escalationCount: 1 }
    },
    latestAuditEvent: {
      id: 77,
      module: 'ai_questioning',
      action: 'operational_readiness_checked',
      resourceType: 'readiness',
      resourceId: 'math',
      actorId: 1,
      actorEmail: 'admin@example.com',
      organizationId: null,
      createdAt: NOW
    },
    generatedAt: NOW
  };
}

function sampleObservability() {
  return {
    range: { from: '2026-06-01', to: '2026-06-15' },
    filters: { provider: null, status: null, type: null, subject: null },
    summary: {
      ...metricBucket('summary'),
      fallbackRate: 0.06,
      rejectionRate: 0.03,
      errorRate: 0.02,
      feedbackRate: 0.16
    },
    rolloutHealth: {
      status: 'watching',
      recommendation: '继续保留人工复核样本',
      sampleSize: 128,
      feedbackSampleSize: 21,
      lowFeedbackRate: 0.09,
      checks: [
        { key: 'error_rate', status: 'passed', detail: '错误率可控' },
        { key: 'low_feedback', status: 'watching', detail: '继续观察低评分' }
      ]
    },
    byDay: [metricBucket('2026-06-15')],
    byProvider: [metricBucket('openai')],
    byType: [metricBucket('ai_question_generation')],
    byStatus: [metricBucket('success')],
    reasonBreakdown: [{ reasonCode: 'low_confidence', count: 3, lowFeedbackCount: 1 }],
    recentFailures: [
      {
        id: 7001,
        createdAt: NOW,
        type: 'ai_question_generation',
        provider: 'openai',
        model: 'gpt-4.1-mini',
        promptVersion: 'v2',
        status: 'error',
        subject: 'math',
        feedbackCount: 0
      }
    ]
  };
}

function sampleGatewayCost() {
  return {
    costCurrency: 'USD',
    displayCurrency: 'CNY',
    usdToDisplayRate: 7.25,
    pricing: {
      deepseekChat: { inputPer1MTokens: 0.27, outputPer1MTokens: 1.1 },
      deepseekReasoner: { inputPer1MTokens: 0.55, outputPer1MTokens: 2.19 }
    }
  };
}

function sampleGatewaySummary() {
  return {
    range: { from: '2026-06-01', to: '2026-06-15', days: 14 },
    summary: {
      ...sampleGatewayCost(),
      calls: 24,
      successCalls: 23,
      failedCalls: 1,
      successRate: 95.83,
      promptTokens: 12000,
      completionTokens: 6000,
      totalTokens: 18000,
      averageLatencyMs: 840,
      estimatedCostUsd: 0.01,
      estimatedCostDisplay: 0.07
    }
  };
}

function sampleGatewayGrouped() {
  return {
    range: { from: '2026-06-01', to: '2026-06-15', days: 14 },
    items: [],
    cost: sampleGatewayCost()
  };
}

function sampleProviderConfig() {
  return {
    provider: {
      mode: 'external',
      externalReady: true,
      externalToggleEnabled: true,
      provider: 'openai',
      supported: true,
      model: 'gpt-4.1-mini',
      promptVersion: 'v2',
      requestedPromptVersion: 'v2',
      activePromptVersion: 'v2',
      promptVersionSupported: true,
      supportedPromptVersions: ['v1', 'v2'],
      promptTemplateCheck: { version: 'v2', valid: true, issues: [] },
      apiKeyConfigured: true,
      baseUrlHost: 'api.openai.com',
      timeoutMs: 30000,
      temperature: 0.2,
      maxOutputChars: 4000,
      rollout: { percent: 35, strategy: 'cohort' },
      fallbackModel: 'rule',
      fallbackPromptVersion: 'fallback-v1',
      blockers: []
    },
    usageMeter: {
      pricingConfigured: true,
      currency: 'CNY',
      inputCostPer1KTokens: 0.01,
      outputCostPer1KTokens: 0.03,
      unitTokenBudget: 100000,
      meteringMode: 'token'
    }
  };
}

function sampleTrainingObservability() {
  return {
    range: { from: '2026-06-01', to: '2026-06-15' },
    filters: { eventType: null, subject: null },
    summary: {
      totalEvents: 320,
      uniqueUsers: 48,
      diagnosticStarted: 42,
      diagnosticCompleted: 37,
      diagnosticCompletionRate: 0.88,
      practiceStarted: 120,
      practiceCompleted: 91,
      practiceCompletionRate: 0.76,
      aiEvents: 54
    },
    byDay: [{ key: '2026-06-15', count: 24 }],
    byEventType: [{ key: 'readiness_action_clicked', count: 18 }],
    bySubject: [{ key: 'math', count: 88 }],
    readinessActions: {
      clickedCount: 18,
      followedCount: 12,
      followThroughRate: 0.66,
      averageExpectedGain: 0.18,
      status: 'watching',
      byActionType: [{ key: 'practice_hard', clickedCount: 10, followedCount: 7, followThroughRate: 0.7, averageExpectedGain: 0.2, status: 'positive' }],
      recentClicks: []
    },
    readinessEvidence: {
      sampleSize: 64,
      averageScore: 72,
      lowCount: 8,
      lowRate: 0.12,
      status: 'healthy',
      byStatus: [{ key: 'ready', count: 42 }],
      topGaps: [{ key: '函数', count: 5 }],
      recent: []
    },
    readinessDifficultyThresholds: {
      mode: 'sampled',
      minSampleSize: 30,
      bySubject: [
        {
          subject: 'math',
          sampleSize: 64,
          averageCount: 9,
          p50Count: 8,
          p60Count: 9,
          p80Count: 12,
          defaultRequiredCount: 8,
          recommendedCount: 9,
          requiredCount: 9,
          source: 'sampled_distribution',
          canUseSampled: true,
          readyAtDefault: 20,
          readyAtSampled: 18,
          impactedUserSubjectCount: 2
        }
      ]
    },
    readinessCalibrationHealth: {
      status: 'watching',
      snapshotCount: 3,
      latestSnapshotDate: '2026-06-15',
      staleDays: 0,
      alerts: [{ code: 'action_type_needs_calibration', severity: 'warning', message: '练习建议样本继续累积', actionType: 'practice_hard' }]
    },
    readinessSampledThresholdRollout: {
      status: 'ready',
      checklist: [{ key: 'sample_size', status: 'passed', detail: '数学样本充足' }],
      metrics: {
        mode: 'sampled',
        sampledReadySubjects: 1,
        totalSubjects: 3,
        insufficientSubjects: ['physics', 'chemistry'],
        impactedUserSubjectCount: 2,
        maxImpactUserSubjectCount: 20,
        maxRecommendedCount: 12,
        minSampleSize: 30,
        blockingCalibrationAlertCount: 0
      }
    },
    plannerAssistant: {
      total: 12,
      accepted: 9,
      adjustedByGuard: 1,
      acceptanceRate: 0.75,
      byStatus: [],
      rejectedReasons: [],
      recent: []
    },
    conceptCardEffect: {
      summary: {
        completedCards: 5,
        cardsWithVariantAttempts: 4,
        variantAttemptCount: 20,
        variantCorrectCount: 14,
        variantAccuracy: 0.7
      },
      recent: []
    },
    variantEffect: {
      summary: {
        variantQuestionCount: 4,
        sourceQuestionCount: 3,
        variantAttemptCount: 20,
        variantCorrectCount: 14,
        variantAccuracy: 0.7,
        misconceptionTrackedCount: 3,
        weakVariantCount: 1
      },
      recent: []
    },
    recentEvents: []
  };
}

function sampleQueueHealth() {
  return {
    status: 'blocked',
    recommendedAction: 'retry_failed',
    summary: { total: 10, queued: 6, running: 1, failed: 2, succeeded: 1, blocked: 2, staleRunning: 1 },
    byStatus: [{ key: 'failed', count: 2 }],
    byFailureCategory: [{ key: 'schema_validation', count: 2 }],
    byProviderFailureCategory: [{ key: 'rate_limit', count: 1 }],
    blockedJobs: [8101, 8102],
    staleRunningJobs: [8103],
    recent: [
      {
        id: 8101,
        blueprintId: 91,
        questionId: null,
        subject: 'math',
        topicId: 31,
        topicTitle: '函数与方程',
        provider: 'openai',
        model: 'gpt-4.1-mini',
        requestHash: 'hash',
        promptMetadata: {},
        rawOutput: null,
        normalizedOutput: null,
        reviewResult: null,
        status: 'failed',
        error: 'schema validation failed',
        governance: {
          attemptCount: 2,
          maxAttempts: 3,
          failureCategory: 'schema_validation',
          providerFailureCategory: 'rate_limit',
          fallbackUsed: false,
          lastFailedAt: NOW
        },
        createdAt: NOW,
        updatedAt: NOW
      }
    ]
  };
}

function sampleCoverage() {
  return {
    summary: {
      publishedTopicCount: 18,
      coveredTopicCount: 15,
      missingTopicCount: 3,
      activeBlueprintCount: 28,
      pausedBlueprintCount: 2,
      archivedBlueprintCount: 1
    },
    missingTopics: [
      { id: 31, subject: 'math', code: 'M-FUNC-01', title: '函数与方程', module: '代数', syllabusVersion: 'CSCA-2026' }
    ]
  };
}

function sampleTopicHealth() {
  return {
    summary: {
      total: 18,
      missingBlueprintCount: 3,
      needsCandidateCount: 4,
      needsPublishCount: 5,
      needsQualityReviewCount: 2,
      healthyCount: 9
    },
    items: [
      {
        topicId: 31,
        subject: 'math',
        code: 'M-FUNC-01',
        title: '函数与方程',
        module: '代数',
        syllabusVersion: 'CSCA-2026',
        topicStatus: 'published',
        blueprintCount: 2,
        activeBlueprintCount: 1,
        pausedBlueprintCount: 1,
        candidateCount: 2,
        pendingReviewCount: 1,
        approvedQuestionCount: 3,
        publishedQuestionCount: 2,
        bridgeQuestionCount: 1,
        qualityReviewCount: 1,
        attemptCount: 28,
        averageDifficultyConfidence: 0.62,
        status: 'needs_candidate',
        action: 'generate_candidates'
      }
    ]
  };
}

function sampleQualityGovernance() {
  return {
    summary: {
      total: 2,
      needsReviewCount: 1,
      variantCount: 1,
      highSeverityCount: 1,
      recommendedActionCount: 1,
      sla: {
        overdueUnassignedCount: 0,
        overdueAssignedCount: 1,
        dueSoonCount: 1,
        escalationCount: 1,
        sampleQuestionIds: [501]
      }
    },
    byReason: [
      {
        reason: 'difficulty_drift',
        count: 1,
        needsReviewCount: 1,
        variantCount: 1,
        highSeverityCount: 1,
        recommendedActions: { regenerate: 1 },
        sampleQuestionIds: [501]
      }
    ],
    byAction: [{ action: 'regenerate', count: 1, needsReviewCount: 1, variantCount: 1, highSeverityCount: 1, sampleQuestionIds: [501] }],
    byAssignee: [],
    bySeverity: [{ key: 'high', count: 1 }]
  };
}

function sampleQualityMetrics() {
  return [
    {
      questionId: 501,
      sourceQuestionId: null,
      generatedVariantOf: null,
      questionStatus: 'approved',
      subject: 'math',
      topicId: 31,
      designedDifficulty: 'medium',
      empiricalDifficulty: 'hard',
      difficultyConfidence: 0.42,
      attemptCount: 38,
      correctRate: 0.22,
      medianSeconds: 91,
      unansweredRate: 0.18,
      markedRate: 0.21,
      optionSelectionStats: [
        {
          optionId: 'B',
          count: 18,
          selectionRate: 0.47,
          wrongSelectionRate: 0.78,
          isCorrectOption: false,
          distractorIntent: 'confuse_value_range',
          misconceptionTags: ['值域误判'],
          qualitySignal: 'over_attractive_distractor'
        }
      ],
      mostSelectedWrongOption: 'B',
      needsReview: true,
      reviewReason: 'difficulty_drift',
      replacementCandidateStatus: 'pending_review',
      qualityGovernance: {
        status: 'open',
        disposition: 'regenerate',
        reason: 'difficulty_drift',
        note: '需要替代候选',
        replacementQuestionId: 502
      },
      qualitySummary: {
        severity: 'high',
        reasons: ['difficulty_drift', 'over_attractive_distractor'],
        recommendedAction: 'regenerate',
        evidence: {
          attemptCount: 38,
          generatedVariantOf: null,
          correctRate: 0.22,
          unansweredRate: 0.18,
          designedDifficulty: 'medium',
          empiricalDifficulty: 'hard',
          difficultyConfidence: 0.42,
          mostSelectedWrongOption: 'B',
          optionSignals: { B: 18 },
          problemOptions: [
            {
              optionId: 'B',
              signal: 'over_attractive_distractor',
              count: 18,
              wrongSelectionRate: 0.78,
              distractorIntent: 'confuse_value_range',
              misconceptionTags: ['值域误判']
            }
          ]
        }
      },
      updatedAt: NOW
    }
  ];
}

function sampleQualityTrend() {
  return {
    days: 14,
    subject: null,
    summary: {
      attemptCount: 90,
      uniqueQuestionCount: 12,
      needsReviewCount: 1,
      highSeverityCount: 1,
      assignedReviewCount: 1,
      regenerationRequiredCount: 1
    },
    byDay: [],
    bySubject: [
      {
        subject: 'math',
        attemptCount: 90,
        uniqueQuestionCount: 12,
        correctRate: 0.58,
        unansweredRate: 0.08,
        needsReviewCount: 1,
        highSeverityCount: 1,
        assignedReviewCount: 1,
        regenerationRequiredCount: 1
      }
    ]
  };
}

function sampleMisconceptions() {
  return {
    summary: { total: 2, active: 1, needsReview: 1, archived: 0 },
    governance: {
      summary: { possibleDuplicateCount: 1, missingConceptCardCount: 1, orphanTagCount: 0, totalActionable: 2 },
      suggestions: [
        {
          issue: 'missing_concept_card',
          severity: 'warning',
          misconceptionId: 12,
          targetId: null,
          label: '值域误判',
          targetLabel: null,
          subject: 'math',
          topicId: 31,
          topicTitle: '函数与方程',
          reason: '高频错因还没有概念卡'
        }
      ]
    },
    items: [
      {
        id: 12,
        slug: 'range-misread',
        subject: 'math',
        topicId: 31,
        topicTitle: '函数与方程',
        label: '值域误判',
        description: '把函数值域与解的个数混在一起',
        status: 'needs_review',
        conceptCardCount: 0,
        publishedConceptCardCount: 0,
        questionCount: 4,
        optionCount: 8,
        createdAt: NOW,
        updatedAt: NOW
      }
    ]
  };
}

function sampleRemediation() {
  return {
    summary: { conceptCardDrafts: 1, variantBlueprints: 1, variantCandidates: 1, pendingVariantCandidates: 1 },
    items: [
      {
        id: 3001,
        kind: 'concept_card',
        subject: 'math',
        topicId: 31,
        title: '值域误判补救卡',
        body: '先判断函数图像，再回到方程交点。',
        status: 'draft',
        sourceQuestionId: 501,
        misconceptionLabel: '值域误判',
        exampleJson: {},
        reviewMetadata: {},
        createdAt: NOW
      }
    ]
  };
}

function sampleSyllabusGovernance() {
  return {
    summary: { total: 3, currentCount: 1, staleCount: 1, unpublishedTopicCount: 1, pendingReviewCount: 1 },
    items: [
      {
        questionId: 501,
        subject: 'math',
        topicId: 31,
        topicTitle: '函数与方程',
        questionSyllabusVersion: 'CSCA-2025',
        topicSyllabusVersion: 'CSCA-2026',
        sourceUrl: 'https://example.com/csca',
        sourceLabel: 'CSCA 2026 大纲',
        lastVerifiedAt: NOW,
        verifiedBy: 1,
        verifiedByEmail: 'admin@example.com',
        topicStatus: 'published',
        status: 'stale',
        reason: '大纲版本已更新，需要复核 AI 生成题'
      }
    ]
  };
}

function sampleSyllabusPreview() {
  return {
    payload: {
      schemaVersion: '1.0',
      subject: 'math',
      syllabusVersion: 'CSCA-2026',
      sourceLabel: 'CSCA 2026 大纲',
      sourceUrl: 'https://example.com/csca',
      verifiedAt: NOW,
      topicCount: 1
    },
    summary: {
      subject: 'math',
      syllabusVersion: 'CSCA-2026',
      topicsInFile: 1,
      newTopics: 0,
      updatedTopics: 1,
      unchangedTopics: 0,
      missingFromFile: 0,
      questionsAffected: 1,
      approvedQuestionsBecomingPendingReview: 1
    },
    items: [
      {
        code: 'M-FUNC-01',
        action: 'update',
        existingTopicId: 31,
        matchedBy: 'code',
        before: { title: '函数' },
        after: { title: '函数与方程' },
        affectedQuestionCount: 1,
        approvedQuestionsBecomingPendingReview: 1
      }
    ],
    missingFromFile: [],
    errors: []
  };
}

function sampleSyllabusImports() {
  return {
    items: [
      {
        id: 9001,
        subject: 'math',
        syllabusVersion: 'CSCA-2026',
        sourceLabel: 'CSCA 2026 大纲',
        sourceUrl: 'https://example.com/csca',
        status: 'draft',
        rawJson: {
          schemaVersion: '1.0',
          subject: 'math',
          syllabusVersion: 'CSCA-2026',
          topics: []
        },
        previewSummary: sampleSyllabusPreview(),
        appliedAt: null,
        appliedBy: null,
        createdBy: 1,
        createdAt: NOW,
        updatedAt: NOW
      }
    ]
  };
}

function sampleSourceDocument() {
  return {
    id: 920,
    subject: 'math',
    sourceType: 'past_paper',
    title: 'CSCA Mathematics Past Paper - April 2026 - English',
    examYear: 2026,
    examSession: '2026-04',
    language: 'en',
    fileHash: 'source-hash-april-2026',
    storageKey: null,
    sourceLabel: 'April 2026 CSCA Mathematics Exam English paper',
    sourceUrl: null,
    licenseScope: 'internal_reference',
    usagePolicy: {},
    status: 'active',
    uploadedBy: 1,
    createdAt: NOW,
    updatedAt: NOW
  };
}

function sampleSourceReferenceSummary() {
  return {
    summary: {
      documentCount: 1,
      questionCount: 48,
      approvedQuestionCount: 19,
      mappedQuestionCount: 19,
      pipelineMappedQuestionCount: 19,
      needsReviewQuestionCount: 29,
      rejectedQuestionCount: 0,
      unmappedQuestionCount: 29,
      lowConfidenceQuestionCount: 7,
      outOfSyllabusQuestionCount: 2,
      autoPendingQuestionCount: 0,
      autoProcessingQuestionCount: 0,
      autoApprovedQuestionCount: 19,
      autoExcludedQuestionCount: 0,
      autoRetryPendingQuestionCount: 0,
      autoRetryExhaustedQuestionCount: 0,
      syllabusVersion: '2025',
      canGenerateProfile: false,
      recommendedAction: 'map_source_questions',
      pipelineTask: {
        id: '9068f759-c90a-4984-866a-e5cd49eb89bf',
        action: 'source_document_imported',
        subject: 'math',
        documentId: 920,
        syllabusVersion: '2025',
        status: 'succeeded',
        requested: 1,
        succeeded: 1,
        skipped: 0,
        failed: 0,
        error: null,
        stage: 'profile_complete',
        reason: null,
        updatedAt: NOW,
        result: {
          stage: 'source_mapping_incomplete',
          reason: 'source_mapping_coverage_low',
          mapping: {
            coverage: 19 / 48,
            mappedCount: 19,
            questionCount: 48,
            unmappedCount: 29,
            lowConfidenceCount: 7,
            outOfSyllabusCount: 2
          },
          mappingGapDiagnosis: {
            reason: 'source_mapping_coverage_low',
            nextAction: '继续自动映射或复核疑似超纲题后再生成趋势画像。',
            lowConfidenceCount: 7,
            outOfSyllabusCount: 2
          }
        }
      }
    }
  };
}

function sampleSourceQuestions() {
  return {
    items: [
      {
        id: 5301,
        documentId: 920,
        subject: 'math',
        questionNumber: 'Q1',
        pageNumber: 1,
        language: 'en',
        promptHash: 'prompt-hash-q1',
        promptText: 'Find the range of k for the line and circle condition.',
        options: [
          { id: 'A', text: '(-sqrt(3), sqrt(3))' },
          { id: 'B', text: '(-3, 0)' }
        ],
        correctAnswer: 'A',
        explanation: 'Use distance from the centre to the line.',
        syllabusVersion: '2025',
        topicId: 633,
        topicTitle: '平面解析几何',
        topicCode: 'M-GEO-001',
        topicCodes: ['M-GEO-001'],
        blueprintLikeTags: ['geometry'],
        analysis: {
          difficulty: 'medium',
          questionForm: 'calculation_application',
          cognitiveSkill: 'standard_application'
        },
        analysisStatus: 'profiled',
        analysisConfidence: 0.86,
        analysisIssues: [],
        reviewStatus: 'approved',
        autoProfileStatus: 'auto_approved',
        autoProfileAttempts: 1,
        autoProfileMaxAttempts: 3,
        autoProfileNextRetryAt: null,
        autoProfileLastTriedAt: NOW,
        autoProfileDecidedAt: NOW,
        autoProfileFailureType: null,
        autoProfileFailureReason: null,
        autoProfileDecision: {},
        autoProfileGateResult: {},
        autoProfileTaskId: null,
        sourceUsagePolicy: {},
        sourceDisplayRestricted: false,
        createdAt: NOW,
        updatedAt: NOW
      }
    ],
    total: 48,
    limit: 12,
    offset: 0
  };
}

function sampleSourceTask(id: string, status: string, action: string) {
  return {
    id,
    action,
    subject: 'math',
    documentId: 920,
    autoProfileStatus: action.includes('profile') ? 'pending' : null,
    reviewStatus: null,
    status,
    requested: 48,
    succeeded: status === 'succeeded' ? 19 : 0,
    skipped: 0,
    failed: 0,
    error: null,
    result: {},
    createdAt: NOW,
    updatedAt: NOW
  };
}

function sampleLedgerItem() {
  return {
    ...sampleQuestion(501, 'approved'),
    topicTitle: '函数与方程',
    topicCode: 'M-FUNC-01',
    provider: 'openai',
    model: 'gpt-4.1-mini',
    generationSourceLabel: 'AI 生成',
    sourceKind: 'ai_questioning',
    fallbackUsed: false,
    practiceQuestionStatus: 'published',
    isPracticeReady: true,
    exposureCount: 12,
    attemptCount: 38,
    correctCount: 21,
    accuracy: 55,
    lastUsedAt: NOW
  };
}

async function mockAdminApis(page: Page) {
  await page.route('**/api/v1/**', (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();

    if (method === 'OPTIONS') {
      return route.fulfill({
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'authorization, content-type, x-csrf-token',
          'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS'
        }
      });
    }

    if (path === '/api/v1/auth/me') {
      return json(route, {
        id: '1',
        email: 'admin@example.com',
        role: 'admin',
        displayName: 'Admin'
      });
    }

    if (path === '/api/v1/admin/csca-special-practice/adaptive/ai/observability') return json(route, sampleObservability());
    if (path === '/api/v1/admin/csca-special-practice/adaptive/ai/provider-config') return json(route, sampleProviderConfig());
    if (path === '/api/v1/admin/csca-special-practice/adaptive/events/observability') return json(route, sampleTrainingObservability());
    if (path === '/api/v1/admin/ai-gateway/summary') return json(route, sampleGatewaySummary());
    if (path === '/api/v1/admin/ai-gateway/by-task') return json(route, sampleGatewayGrouped());
    if (path === '/api/v1/admin/ai-gateway/by-key') return json(route, sampleGatewayGrouped());
    if (path === '/api/v1/admin/ai-gateway/errors') return json(route, { range: sampleGatewayGrouped().range, items: [] });
    if (path === '/api/v1/admin/ai-gateway/health') return json(route, { status: 'healthy', providers: [], queues: null });
    if (path === '/api/v1/admin/ai-questioning/operational-readiness') return json(route, sampleReadiness());
    if (path === '/api/v1/admin/ai-questioning/generation-jobs/health') return json(route, sampleQueueHealth());
    if (path === '/api/v1/admin/csca-learning/readiness-evidence') {
      return json(route, {
        items: [{ name: 'readiness-release-2026-06-15.json', kind: 'release_gate', status: 'passed', phase: 'preflight', generatedAt: NOW, modifiedAt: NOW }]
      });
    }
    if (path.startsWith('/api/v1/admin/csca-learning/readiness-evidence/')) {
      return json(route, { file: { name: 'readiness-release-2026-06-15.json', content: sampleReadiness() } });
    }

    if (path === '/api/v1/admin/ai-questioning/blueprint-coverage') return json(route, sampleCoverage());
    if (path === '/api/v1/admin/ai-questioning/topic-health') return json(route, sampleTopicHealth());
    if (path === '/api/v1/admin/ai-questioning/questions') return json(route, { items: [sampleQuestion(), sampleQuestion(502, 'pending_review')] });
    if (path === '/api/v1/admin/ai-questioning/question-ledger') return json(route, { items: [sampleLedgerItem()], total: 1, limit: 50, offset: 0 });
    if (path === '/api/v1/admin/ai-questioning/quality') return json(route, sampleQualityMetrics());
    if (path === '/api/v1/admin/ai-questioning/quality/governance') return json(route, sampleQualityGovernance());
    if (path === '/api/v1/admin/ai-questioning/quality/trend') return json(route, sampleQualityTrend());
    if (path === '/api/v1/admin/ai-questioning/remediation') return json(route, sampleRemediation());
    if (path === '/api/v1/admin/ai-questioning/misconceptions') return json(route, sampleMisconceptions());
    if (path === '/api/v1/admin/ai-questioning/source-references/summary') return json(route, sampleSourceReferenceSummary());
    if (path === '/api/v1/admin/ai-questioning/source-documents') return json(route, { items: [sampleSourceDocument()] });
    if (path === '/api/v1/admin/ai-questioning/source-questions') return json(route, sampleSourceQuestions());
    if (path === '/api/v1/admin/ai-questioning/source-questions/auto-profile-tasks') return json(route, { items: [sampleSourceTask('auto-profile-9068f759', 'succeeded', 'auto_profile_filtered')] });
    if (path === '/api/v1/admin/ai-questioning/source-questions/topic-mapping-tasks') return json(route, { items: [sampleSourceTask('topic-map-9068f759', 'succeeded', 'auto_map_profile')] });
    if (path === '/api/v1/admin/ai-questioning/style-profiles') return json(route, { items: [] });
    if (path === '/api/v1/admin/ai-questioning/exam-series-profiles') return json(route, { items: [] });
    if (path === '/api/v1/admin/ai-questioning/generation-profiles') return json(route, { items: [] });
    if (path === '/api/v1/admin/ai-questioning/topic-options') return json(route, { items: [{ id: 633, subject: 'math', code: 'M-GEO-001', title: '平面解析几何', module: '几何', syllabusVersion: '2025', status: 'published' }] });
    if (path === '/api/v1/admin/ai-questioning/syllabus-governance') return json(route, sampleSyllabusGovernance());
    if (path === '/api/v1/admin/ai-questioning/syllabus-imports') return json(route, method === 'GET' ? sampleSyllabusImports() : { import: sampleSyllabusImports().items[0], preview: sampleSyllabusPreview() });
    if (path === '/api/v1/admin/ai-questioning/syllabus-imports/preview') return json(route, sampleSyllabusPreview());
    if (path === '/api/v1/admin/ai-questioning/syllabus-imports/template') {
      return json(route, {
        schemaVersion: '1.0',
        subject: 'math',
        syllabusVersion: 'CSCA-2026',
        sourceLabel: 'CSCA 2026 大纲',
        topics: []
      });
    }

    if (method === 'POST' || method === 'PATCH') {
      return json(route, { ok: true, refreshed: 1, created: 1, skipped: 0, succeeded: 1, failed: 0, items: [] });
    }

    return json(route, { items: [] });
  });
}

test('AI operations keeps LLM usage, readiness, and generation queue panels after admin shell reorganization', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' || message.text().includes('AUTH_DEBUG')) {
      console.log('BROWSER_CONSOLE', message.type(), message.text());
    }
  });
  await mockAdminApis(page);

  await page.goto('/admin/ai');

  await expect(page.getByRole('heading', { name: /AI 运维工作区|AI Operations Workspace/ })).toBeVisible();
  await expect(page.getByText(/每日治理顺序|Daily governance order/)).toBeVisible();
  await expect(page.getByText(/LLM 使用量|LLM usage/).first()).toBeVisible();

  await page.getByRole('button', { name: /生成队列|Generation Queue/ }).click();
  await expect(page.getByText(/归档失败任务|Archive failed jobs/)).toBeVisible();
  await expect(page.getByText(/失败分类|Failure breakdown/)).toBeVisible();
  await expect(page.getByText(/Provider 失败分类|Provider failure breakdown/)).toBeVisible();
  await expect(page.getByText('函数与方程').first()).toBeVisible();

  await page.getByRole('button', { name: /准备度|Readiness/ }).click();
  await expect(page.getByText(/导出 readiness CSV|Export readiness CSV/)).toBeVisible();
  await expect(page.getByText(/准备度发布记录|Readiness launch records/)).toBeVisible();
  await expect(page.getByText(/建议效果健康|Suggestion result health/)).toBeVisible();

  await page.getByRole('button', { name: /观测|Observability/ }).click();
  await expect(page.getByText(/外部 LLM 调用|External LLM calls/).first()).toBeVisible();
  await expect(page.getByText(/按 Provider|By provider/).first()).toBeVisible();

  expect(pageErrors).toEqual([]);
});

test('AI question bank keeps inventory, charts, quality calibration, and remediation surfaces', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await mockAdminApis(page);

  await page.goto('/admin/ai-question-bank');

  await expect(page.getByRole('heading', { name: /AI 生成题库|AI Question Bank/ })).toBeVisible();
  await page.getByRole('button', { name: /进入科目训练线|Open subject practice/ }).click();
  await expect(page.getByText(/蓝图缺口|Blueprint gaps/).first()).toBeVisible();
  await expect(page.getByText(/质量趋势|Quality trend/).first()).toBeVisible();
  await expect(page.getByText(/质量处理队列|Quality action queue/)).toBeVisible();
  await expect(page.getByText(/质量校准摘要|Quality calibration summary/)).toBeVisible();
  await expect(page.getByText(/替代候选跟进|Replacement candidate follow-up/)).toBeVisible();
  await expect(page.getByText(/错因字典|Misconception dictionary/)).toBeVisible();
  await expect(page.getByText(/补救材料|Remediation materials/)).toBeVisible();
  await expect(page.getByText(/题库台账|Question bank ledger/).first()).toBeVisible();

  expect(pageErrors).toEqual([]);
});

test('AI question bank source profile pipeline shows incomplete mapping diagnosis in the browser', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await mockAdminApis(page);

  await page.goto('/admin/ai-question-bank');
  await page.getByRole('button', { name: '进入共用准备' }).click();

  await expect(page.getByRole('heading', { name: /1 份文档 · 48 道源题样本/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'CSCA Mathematics Past Paper - April 2026 - English' })).toBeVisible();
  await expect(page.getByText(/趋势\/出题画像生成流水线/)).toBeVisible();
  await expect(page.getByText(/源题未闭环/)).toBeVisible();
  await expect(page.getByText(/#9068f759/)).toBeVisible();
  await expect(page.getByText(/映射 19\/48/)).toBeVisible();
  await expect(page.getByText(/映射覆盖/)).toBeVisible();
  await expect(page.getByText('低置信 7', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('疑似超纲 2', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/source_mapping_coverage_low/)).toBeVisible();
  await expect(page.getByText(/继续自动映射或复核疑似超纲题后再生成趋势画像/)).toBeVisible();
  await expect(page.getByRole('button', { name: '刷新进度' })).toBeVisible();
  await expect(page.getByRole('button', { name: '刷新进度' })).toHaveAttribute('title', /不刷新整页/);

  expect(pageErrors).toEqual([]);
});

test('CSCA syllabus remains under AI questioning and keeps import governance workflows', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await mockAdminApis(page);

  await page.goto('/admin/ai-question-bank');
  await page.getByRole('button', { name: '进入共用准备' }).click();

  await expect(page.getByRole('heading', { name: /管理 AI 出题使用的 CSCA 大纲|Manage the CSCA syllabus used by AI question generation/ })).toBeVisible();
  await expect(page.getByText(/上传大纲 JSON|Upload syllabus JSON/)).toBeVisible();
  await expect(page.getByRole('button', { name: /预览影响|Preview impact/ })).toBeVisible();
  await expect(page.getByText(/最近导入|Recent imports/)).toBeVisible();
  await expect(page.getByText(/存量题影响诊断|Legacy impact diagnostics/)).toBeVisible();
  await expect(page.getByText('函数与方程').first()).toBeVisible();

  expect(pageErrors).toEqual([]);
});

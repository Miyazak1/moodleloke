#!/usr/bin/env node

require('../backend/node_modules/ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', moduleResolution: 'node' }
});

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { subjectPracticeClassifyTaskFamily } = require('../backend/src/ai-questioning/subject-practice-task-family-policy');
const { buildSubjectPracticeQuestionPlan } = require('../backend/src/ai-questioning/subject-practice-question-plan-policy');
const { solveSubjectPracticePhysicsKinematics } = require('../backend/src/ai-questioning/subject-practice-physics-kinematics-solver');
const { solveSubjectPracticeChemistryAcidBase } = require('../backend/src/ai-questioning/subject-practice-chemistry-acid-base-solver');

const root = path.resolve(__dirname, '..');
const docs = path.join(root, 'docs');
const targets = {
  physics: {
    taskFamily: 'kinematics_basic_direct_relation',
    solve(candidate) {
      const questionPlan = buildSubjectPracticeQuestionPlan({
        subject: 'physics',
        topicTitle: 'Kinematics',
        productionCellId: '24',
        targetDifficulty: 'basic',
        taskFamily: 'kinematics_basic_direct_relation'
      });
      return solveSubjectPracticePhysicsKinematics(candidate, { questionPlan });
    }
  },
  chemistry: {
    taskFamily: 'ph_dilution_strong_acid_base_neutralization',
    solve(candidate) {
      const questionPlan = buildSubjectPracticeQuestionPlan({
        subject: 'chemistry',
        topicTitle: '溶液浓度与pH计算',
        productionCellId: '41',
        targetDifficulty: 'medium',
        taskFamily: this.taskFamily
      });
      return solveSubjectPracticeChemistryAcidBase(candidate, { taskFamily: this.taskFamily, questionPlan });
    }
  }
};

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function clean(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function candidateFor(subject, question) {
  return {
    subject,
    prompt: clean(question?.promptText),
    options: Array.isArray(question?.options)
      ? question.options.map((option) => ({ id: clean(option?.id), text: clean(option?.text) }))
      : [],
    correctAnswer: clean(question?.correctAnswer)
  };
}

function sourceConfirmed(question) {
  return question?.analysisStatus === 'human_confirmed'
    && Boolean(clean(question?.sourceMeta?.reconstructedFrom))
    && Boolean(clean(question?.promptText))
    && Array.isArray(question?.options)
    && question.options.length >= 2
    && Boolean(clean(question?.correctAnswer));
}

function auditSubject(subject) {
  const target = targets[subject];
  const sourceFiles = fs.readdirSync(docs)
    .filter((name) => new RegExp(`^csca-${subject}-past-paper-.*-source\\.json$`, 'i').test(name))
    .sort();
  const fileEvidence = [];
  const targetCandidates = [];
  let questionCount = 0;
  let sourceConfirmedCount = 0;
  let reviewMappedCount = 0;
  let visibleFullClassificationDriftCount = 0;
  let fullTargetFamilyCount = 0;
  let visibleTargetFamilyCount = 0;

  for (const fileName of sourceFiles) {
    const raw = fs.readFileSync(path.join(docs, fileName), 'utf8');
    const parsed = JSON.parse(raw);
    const questions = Array.isArray(parsed?.questions) ? parsed.questions : [];
    const confirmed = questions.filter(sourceConfirmed);
    const mapped = confirmed.filter((question) => question.reviewStatus === 'mapped');
    questionCount += questions.length;
    sourceConfirmedCount += confirmed.length;
    reviewMappedCount += mapped.length;
    fileEvidence.push({
      fileName,
      sourceType: clean(parsed?.document?.sourceType) || null,
      sourceLabel: clean(parsed?.document?.sourceLabel) || null,
      documentSourceHash: clean(parsed?.document?.sourceHash) || null,
      contentSha256: sha256(raw),
      questionCount: questions.length,
      sourceConfirmedCount: confirmed.length,
      reviewMappedCount: mapped.length
    });

    for (const question of confirmed) {
      const candidate = candidateFor(subject, question);
      const visibleTaskFamily = subjectPracticeClassifyTaskFamily({
        subject,
        prompt: candidate.prompt,
        options: candidate.options,
        explanation: ''
      });
      const fullTaskFamily = subjectPracticeClassifyTaskFamily({
        subject,
        prompt: candidate.prompt,
        options: candidate.options,
        explanation: clean(question.explanation)
      });
      if (visibleTaskFamily !== fullTaskFamily) visibleFullClassificationDriftCount += 1;
      if (fullTaskFamily === target.taskFamily) fullTargetFamilyCount += 1;
      if (visibleTaskFamily !== target.taskFamily) continue;
      visibleTargetFamilyCount += 1;
      const evidence = target.solve(candidate);
      targetCandidates.push({
        sourceFile: fileName,
        questionNumber: clean(question.questionNumber),
        candidateSha256: sha256(JSON.stringify(candidate)),
        reviewMapped: question.reviewStatus === 'mapped',
        visibleTaskFamily,
        fullTaskFamily,
        solverStatus: evidence.status,
        verificationScopeId: evidence.verificationScope?.scopeId ?? null,
        scopeMatched: evidence.verificationScope?.matched === true,
        selectedOptionId: evidence.selectedOptionId,
        agreesWithSourceAnswer: evidence.agreesWithGenerator,
        reasonCodes: evidence.reasonCodes
      });
    }
  }

  return {
    subject,
    targetTaskFamily: target.taskFamily,
    status: 'source_candidate_audit_only_not_frozen_holdout',
    releaseQualification: false,
    releaseQualificationReason: 'source_answers_were_visible_during_solver_development_and_items_were_not_presealed_or_development_isolated',
    sourceFileCount: sourceFiles.length,
    questionCount,
    sourceConfirmedCount,
    reviewMappedCount,
    missingReviewMappingCount: sourceConfirmedCount - reviewMappedCount,
    visibleFullClassificationDriftCount,
    fullTargetFamilyCount,
    visibleTargetFamilyCount,
    verifiedVisibleTargetCount: targetCandidates.filter((item) => item.solverStatus === 'verified' && item.scopeMatched).length,
    fileEvidence,
    targetCandidates
  };
}

const subjects = [auditSubject('physics'), auditSubject('chemistry')];
const report = {
  mode: 'subject_practice_physics_chemistry_official_source_candidate_audit',
  auditVersion: 'physics-chemistry-source-candidate-audit-v1',
  status: 'candidate_inventory_complete_not_release_qualified',
  providerImpact: 'none_no_provider_call',
  dbImpact: 'none_no_database_connection',
  productionImpact: 'none_read_only_source_audit',
  releaseQualification: false,
  subjects
};

if (require.main === module) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

module.exports = { report };

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TrainingEventService } from '../csca-special-practice/training-event.service';
import {
  CscaLearningSubject,
  CscaWrongPatternReviewQueueResponse,
  LearningDashboardResponse,
  LearningDashboardSubject,
  LearningReadiness,
  LearningReadinessActionType,
  LearningReadinessDimensionStatus,
  LearningReadinessStage,
  ReadinessActionCalibrationSnapshotRefreshResult,
  RecordLearningActivityInput,
  RecordWrongPatternCorrectEvidenceInput,
  RecordWrongPatternItemInput,
  RecordWrongPatternVerificationInput,
  RecordWrongPatternsInput
} from './csca-learning.types';

const DASHBOARD_SUBJECTS: Array<{ id: CscaLearningSubject; label: string }> = [
  { id: 'math', label: '数学' },
  { id: 'physics', label: '物理' },
  { id: 'chemistry', label: '化学' }
];

const DEFAULT_READINESS_HIGH_DIFFICULTY_SUBJECT_REQUIREMENTS: Record<CscaLearningSubject, number> = {
  math: 3,
  physics: 2,
  chemistry: 2
};
const READINESS_HIGH_DIFFICULTY_DISTRIBUTION_SAMPLE_MIN = 8;

type LearningDashboardLanguage = 'zh' | 'en' | 'vi';

const DASHBOARD_LOCALIZED_COPY: Record<LearningDashboardLanguage, {
  subjects: Record<CscaLearningSubject, string>;
  currentWeakSubject: string;
  generalTopic: string;
  patterns: Record<string, string>;
  mockNextTitle: (subject: string) => string;
  mockNextBody: (input: { score: number; wrongCount: number; unansweredCount: number }) => string;
  enterSubjectTraining: string;
  weeklyAnswered: (input: { answered: number; accuracy: number | null }) => string;
  weeklyPace: (minutes: number) => string;
  weeklyWeak: (subject: string) => string;
  recentSummary: (input: { answered: number; accuracy: number | null }) => string;
  fallbackPace: (minutes: number) => string;
  fallbackActiveDays: (days: number) => string;
  fallbackWeak: (subject: string) => string;
  continueTitle: (subject: string) => string;
  continueBody: string;
  continueCta: string;
  diagnosticTitle: (subject: string) => string;
  diagnosticBody: string;
  diagnosticCta: string;
  firstDiagnosticTitle: string;
  firstDiagnosticBody: string;
  weakTitle: (subject: string) => string;
  weakBody: string;
  weakCta: string;
  mockTitle: string;
  mockBody: string;
  mockCta: string;
  readiness: {
    stages: Record<LearningReadinessStage, string>;
    bodies: Record<LearningReadinessStage, string>;
    dimensions: Record<LearningReadiness['dimensions'][number]['key'], string>;
    milestones: Record<LearningReadinessStage, string>;
    actions: Record<LearningReadinessActionType, { title: string; body: string; ctaLabel: string }>;
    scoreExplanation: string;
    confidenceReasons: {
      low: string;
      medium: string;
      high: string;
      missingMock: string;
      insufficientSubjects: string;
      lowVolume: string;
    };
    evidence: {
      coverageInsufficient: string;
      coverage: (input: { rate: number; highWeightRate: number | null; blindSpotCount: number }) => string;
      masteryInsufficient: string;
      mastery: (input: { mastery: number; weakTopicCount: number; highDifficultyAccuracy: number | null; highDifficultyAttemptCount: number; lowDifficultyAdjustedTopicCount: number; averageDifficultyAdjustedAccuracy: number | null }) => string;
      mockMissing: string;
      mock: (input: { score: number; unansweredCount: number }) => string;
      review: (input: { dueCount: number; activeCount: number; pendingVerificationCount: number }) => string;
      rhythm: (input: { activeDays: number; answered: number }) => string;
      evidence: (input: { answered: number; subjectCount: number; hasMock: boolean; coverageRate: number | null; highDifficultyAttemptCount: number; topicSignalCount: number; activeDays: number }) => string;
    };
    blockers: {
      coverageInsufficient: string;
      lowCoverage: (rate: number) => string;
      blindSpots: (count: number) => string;
      highDifficultyInsufficient: string;
      lowHighDifficultyAccuracy: (accuracy: number) => string;
      weakDifficultyTopics: (count: number) => string;
      masteryInsufficient: string;
      weakSubject: (input: { subject: string; mastery: number | null }) => string;
      weakTopics: (input: { subject: string; count: number }) => string;
      noMock: string;
      lowMock: (score: number) => string;
      unanswered: (count: number) => string;
      dueReviews: (count: number) => string;
      pendingVerification: (count: number) => string;
      lowRhythm: (days: number) => string;
    };
  };
}> = {
  zh: {
    subjects: { math: '数学', physics: '物理', chemistry: '化学' },
    currentWeakSubject: '当前薄弱学科',
    generalTopic: '综合知识点',
    patterns: {
      unanswered: '未答与节奏问题',
      formula_or_rule: '公式/规则混淆',
      calculation: '计算与化简失误',
      visual_interpretation: '图形/图表理解偏差',
      concept_gap: '概念理解缺口'
    },
    mockNextTitle: (subject) => `模考后回到${subject}补弱`,
    mockNextBody: ({ score, wrongCount, unansweredCount }) => `最近一次模考 ${score} 分，错 ${wrongCount} 题、未答 ${unansweredCount} 题。先用 5 题训练修复薄弱点，再进入下一次模考检查节奏。`,
    enterSubjectTraining: '进入科目训练',
    weeklyAnswered: ({ answered, accuracy }) => `本周你累计作答 ${answered} 题，整体正确率${accuracy === null ? '还需要更多训练判断' : `约 ${accuracy}%`}。`,
    weeklyPace: (minutes) => minutes > 0 ? `保持本周 ${minutes} 分钟的训练节奏。` : '先完成一轮 5 题训练，建立本周节奏。',
    weeklyWeak: (subject) => `优先处理${subject}，完成下一轮训练后再观察难度是否需要调整。`,
    recentSummary: ({ answered, accuracy }) => `最近你累计完成 ${answered} 题，整体正确率${accuracy === null ? '还需要更多训练判断' : `约 ${accuracy}%`}。系统会根据训练、模考和复盘记录整理下一步建议。`,
    fallbackPace: (minutes) => minutes > 0 ? `本周已学习约 ${minutes} 分钟，继续保持稳定节奏。` : '本周还没有形成稳定学习时长，先完成一轮 5 题训练。',
    fallbackActiveDays: (days) => days > 0 ? `近 30 天有 ${days} 天完成有效训练。` : '先完成一次诊断或训练，让这里开始记录你的学习轨迹。',
    fallbackWeak: (subject) => `下一步优先处理${subject}，再根据结果调整下一轮难度。`,
    continueTitle: (subject) => `继续完成${subject}训练`,
    continueBody: '你还有未完成的本科目训练，继续作答后会更新掌握情况和下一轮建议。',
    continueCta: '继续训练',
    diagnosticTitle: (subject) => `先完成${subject}诊断`,
    diagnosticBody: '完成 20 题诊断后，后续 5 题训练会更贴近你的薄弱点。',
    diagnosticCta: '开始诊断',
    firstDiagnosticTitle: '先完成数学诊断',
    firstDiagnosticBody: '完成第一次诊断后，这里会出现你的学习轨迹和下一步建议。',
    weakTitle: (subject) => `优先处理${subject}薄弱点`,
    weakBody: '下一轮题目会优先放在更需要巩固的位置。',
    weakCta: '进入科目',
    mockTitle: '进入一次完整模考',
    mockBody: '科目训练已有基础后，用 48 题模拟题检查节奏和知识点覆盖。',
    mockCta: '进入模考',
    readiness: {
      stages: {
        diagnosing: '正在建立基线',
        building: '基础建设中',
        repairing: '需要集中补弱',
        reinforcing: '接近成熟',
        exam_ready: '准备度成熟'
      },
      bodies: {
        diagnosing: '还需要更多诊断、训练或模考记录，才能更稳定地判断准备度。',
        building: '已经有学习记录，但掌握度、模考或节奏里仍有明显短板。',
        repairing: '当前最大问题不是继续刷题数量，而是先处理到期复盘和高频错因。',
        reinforcing: '主要能力已经成型，继续用模考和短训练确认稳定性。',
        exam_ready: '掌握度、模考、复盘和节奏都达到较稳状态，可以进入考前保持。'
      },
      dimensions: {
        coverage: '知识覆盖',
        mastery: '知识掌握',
        mock: '模考表现',
        review: '错因复盘',
        rhythm: '学习节奏',
        evidence: '判断依据'
      },
      milestones: {
        diagnosing: '完成三科诊断，并至少形成一次模考记录。',
        building: '把最低掌握度学科提升到 60% 以上。',
        repairing: '先处理今日复盘和高频错因，再继续新题训练。',
        reinforcing: '保持一周 3 次有效训练，并完成下一次完整模考。',
        exam_ready: '保持节奏，不要让到期复盘堆积。'
      },
      actions: {
        start_diagnostic: { title: '先补齐诊断', body: '先完成缺失科目的 20 题诊断，系统才知道该从哪里帮你补。', ctaLabel: '开始诊断' },
        review_due_patterns: { title: '先处理错因复盘', body: '复盘债和高频错因会拖低稳定性，先把它们处理完再继续新题。', ctaLabel: '去复盘' },
        continue_active_round: { title: '继续未完成训练', body: '这轮训练还没结束，完成后准备度会重新计算。', ctaLabel: '继续未完成训练' },
        repair_weak_subject: { title: '补最薄弱学科', body: '当前最影响准备度的是学科掌握度，先做一轮短训练。', ctaLabel: '进入科目' },
        resume_mock_attempt: { title: '回到模考节奏问题', body: '最近模考未答较多，优先修复时间分配。', ctaLabel: '进入模考' },
        start_mock_exam: { title: '做一次完整模考', body: '训练已有基础后，需要用完整模考检查速度和覆盖面。', ctaLabel: '进入模考' },
        keep_training: { title: '保持训练节奏', body: '继续用短训练和复盘维持稳定，不要让错因重新堆积。', ctaLabel: '继续训练' }
      },
      scoreExplanation: '这不是模考分数。它会参考做题、知识覆盖、难度、模考和复盘，估算你离稳定上考场还有多远。',
      confidenceReasons: {
        low: '现在记录还不够多，先把这个分数当作下一步建议，不要当最终水平。',
        medium: '已经有一些训练和模考记录，可以看出主要短板，但还需要覆盖更多知识点。',
        high: '三科训练、模考、复盘和节奏记录比较完整，这个判断会更稳。',
        missingMock: '缺少完整模考记录，无法确认时间压力下的表现。',
        insufficientSubjects: '至少两科练习记录还不够，整体情况还看不清。',
        lowVolume: '累计做题还不够，先多完成几轮诊断或训练。'
      },
      evidence: {
        coverageInsufficient: '还没覆盖足够知识点，先完成诊断或多练几个知识点。',
        coverage: ({ rate, highWeightRate, blindSpotCount }) => `已练到约 ${rate}% 的知识点${highWeightRate === null ? '' : `，重点知识点约 ${highWeightRate}%`}，还有 ${blindSpotCount} 个明显空白。`,
        masteryInsufficient: '掌握情况还看不清，先完成诊断或科目训练。',
        mastery: ({ mastery, weakTopicCount, highDifficultyAccuracy, highDifficultyAttemptCount, lowDifficultyAdjustedTopicCount, averageDifficultyAdjustedAccuracy }) => `三科平均掌握约 ${mastery}%，还有 ${weakTopicCount} 个薄弱知识点。${highDifficultyAttemptCount ? `中高难题独立正确率约 ${highDifficultyAccuracy ?? 0}%。` : '中高难题练得还不够。'}${averageDifficultyAdjustedAccuracy === null ? '' : ` 按难度看，正确率约 ${averageDifficultyAdjustedAccuracy}%，还有 ${lowDifficultyAdjustedTopicCount} 个知识点不稳。`}`,
        mockMissing: '还没有完整模考记录，无法判断时间压力下的表现。',
        mock: ({ score, unansweredCount }) => `最近模考 ${score} 分，未答 ${unansweredCount} 题。`,
        review: ({ dueCount, activeCount, pendingVerificationCount }) => `当前有 ${activeCount} 个需要跟进的错因，其中 ${dueCount} 个今天该复盘，${pendingVerificationCount} 个复盘后还要用同类题确认。`,
        rhythm: ({ activeDays, answered }) => `近 30 天有效学习 ${activeDays} 天，近 14 天作答 ${answered} 题。`,
        evidence: ({ answered, subjectCount, hasMock, coverageRate, highDifficultyAttemptCount, topicSignalCount, activeDays }) => `累计有效作答 ${answered} 题，${subjectCount} 科已有练习记录，${hasMock ? '已有完整模考' : '还缺完整模考'}，知识覆盖${coverageRate === null ? '还要补' : `约 ${coverageRate}%`}，中高难题记录 ${highDifficultyAttemptCount} 个，不同难度练习记录 ${topicSignalCount} 个，近 30 天有效学习 ${activeDays} 天。`
      },
      blockers: {
        coverageInsufficient: '练到的知识点还不够，不能只看做了多少题。',
        lowCoverage: (rate) => `知识覆盖约 ${rate}%，覆盖面仍不足。`,
        blindSpots: (count) => `还有 ${count} 个知识点基本没练到。`,
        highDifficultyInsufficient: '中高难题练得还不够，暂时不能判断已经稳定掌握。',
        lowHighDifficultyAccuracy: (accuracy) => `中高难题独立正确率约 ${accuracy}%，难度稳定性还不足。`,
        weakDifficultyTopics: (count) => `${count} 个知识点一到较难题就不稳，需要再练同类题。`,
        masteryInsufficient: '掌握情况还看不清，先完成诊断。',
        weakSubject: ({ subject, mastery }) => `${subject}${mastery === null ? '练习记录还不够' : `掌握约 ${mastery}%`}，仍是主要短板。`,
        weakTopics: ({ subject, count }) => `${subject}还有 ${count} 个薄弱知识点需要修复。`,
        noMock: '缺少完整模考记录，无法确认考试节奏。',
        lowMock: (score) => `最近模考 ${score} 分，距离稳定成熟还有差距。`,
        unanswered: (count) => `最近模考未答 ${count} 题，时间分配需要优先处理。`,
        dueReviews: (count) => `今日有 ${count} 个错因到期复盘。`,
        pendingVerification: (count) => `${count} 个错因已经看过，但还没用同类题确认真的修好了。`,
        lowRhythm: (days) => `近 30 天有效学习 ${days} 天，节奏还不够稳定。`
      }
    }
  },
  en: {
    subjects: { math: 'Math', physics: 'Physics', chemistry: 'Chemistry' },
    currentWeakSubject: 'the current weak subject',
    generalTopic: 'Mixed knowledge points',
    patterns: {
      unanswered: 'Unanswered and pacing issues',
      formula_or_rule: 'Formula or rule confusion',
      calculation: 'Calculation and simplification mistakes',
      visual_interpretation: 'Graph or diagram interpretation gaps',
      concept_gap: 'Concept understanding gap'
    },
    mockNextTitle: (subject) => `Return to ${subject} after the mock`,
    mockNextBody: ({ score, wrongCount, unansweredCount }) => `Your latest mock score was ${score}, with ${wrongCount} wrong and ${unansweredCount} unanswered. Use a 5-question round to repair weak spots before the next mock.`,
    enterSubjectTraining: 'Enter subject training',
    weeklyAnswered: ({ answered, accuracy }) => `This week you answered ${answered} questions. Overall accuracy ${accuracy === null ? 'needs more training data' : `is about ${accuracy}%`}.`,
    weeklyPace: (minutes) => minutes > 0 ? `Keep this week's ${minutes} minutes of training rhythm.` : 'Complete one 5-question round first to build this week’s rhythm.',
    weeklyWeak: (subject) => `Prioritize ${subject}, then check whether the next round difficulty should change.`,
    recentSummary: ({ answered, accuracy }) => `Recently you completed ${answered} questions. Overall accuracy ${accuracy === null ? 'needs more training data' : `is about ${accuracy}%`}. The system organizes next steps from your practice, mock, and review records.`,
    fallbackPace: (minutes) => minutes > 0 ? `You studied about ${minutes} minutes this week. Keep a stable rhythm.` : 'No stable study time yet this week. Complete one 5-question round first.',
    fallbackActiveDays: (days) => days > 0 ? `You completed effective training on ${days} day(s) in the last 30 days.` : 'Complete one diagnostic or training round so this page can start recording your trail.',
    fallbackWeak: (subject) => `Next, prioritize ${subject}, then adjust the next round difficulty from the result.`,
    continueTitle: (subject) => `Continue unfinished ${subject} training`,
    continueBody: 'You still have an unfinished subject round. Continue answering to update mastery and the next suggestion.',
    continueCta: 'Continue training',
    diagnosticTitle: (subject) => `Complete the ${subject} diagnostic first`,
    diagnosticBody: 'After the 20-question diagnostic, later 5-question rounds can target your weak spots more accurately.',
    diagnosticCta: 'Start diagnostic',
    firstDiagnosticTitle: 'Complete the Math diagnostic first',
    firstDiagnosticBody: 'After the first diagnostic, this page will show your learning trail and next step.',
    weakTitle: (subject) => `Prioritize weak spots in ${subject}`,
    weakBody: 'The next round will focus on the area that needs reinforcement most.',
    weakCta: 'Enter subject',
    mockTitle: 'Enter one full mock exam',
    mockBody: 'Once subject training has a base, use a 48-question mock to check pacing and topic coverage.',
    mockCta: 'Enter mock',
    readiness: {
      stages: {
        diagnosing: 'Building baseline',
        building: 'Foundation in progress',
        repairing: 'Needs focused repair',
        reinforcing: 'Nearly mature',
        exam_ready: 'Exam ready'
      },
      bodies: {
        diagnosing: 'More diagnostic, training, or mock records are needed before readiness can be judged steadily.',
        building: 'You have learning records, but mastery, mock performance, or rhythm still has a visible gap.',
        repairing: 'The highest-value move is to repair due reviews and recurring mistakes before adding more new questions.',
        reinforcing: 'Core ability is forming. Use mocks and short rounds to confirm stability.',
        exam_ready: 'Mastery, mock performance, reviews, and rhythm are all stable enough for maintenance mode.'
      },
      dimensions: {
        coverage: 'Knowledge coverage',
        mastery: 'Knowledge mastery',
        mock: 'Mock performance',
        review: 'Mistake review',
        rhythm: 'Learning rhythm',
        evidence: 'Basis for judgment'
      },
      milestones: {
        diagnosing: 'Complete diagnostics for all three subjects and create at least one mock record.',
        building: 'Raise the weakest subject mastery above 60%.',
        repairing: 'Handle today’s reviews and repeated mistakes before starting more new questions.',
        reinforcing: 'Keep three effective training days this week and finish one full mock.',
        exam_ready: 'Keep the rhythm and avoid review backlog.'
      },
      actions: {
        start_diagnostic: { title: 'Complete the missing diagnostic', body: 'Finish the missing 20-question diagnostic first so the system knows where to help.', ctaLabel: 'Start diagnostic' },
        review_due_patterns: { title: 'Handle mistake reviews first', body: 'Review debt and repeated mistakes lower stability. Clear them before starting more new questions.', ctaLabel: 'Review now' },
        continue_active_round: { title: 'Continue unfinished training', body: 'This round is still open. Readiness will refresh after you finish it.', ctaLabel: 'Continue unfinished round' },
        repair_weak_subject: { title: 'Repair the weakest subject', body: 'The biggest readiness gap is subject mastery. Start with one short round.', ctaLabel: 'Enter subject' },
        resume_mock_attempt: { title: 'Repair mock pacing', body: 'The latest mock has many unanswered questions. Prioritize time allocation.', ctaLabel: 'Enter mock' },
        start_mock_exam: { title: 'Take one full mock', body: 'Once training has a base, a full mock checks speed and coverage.', ctaLabel: 'Enter mock' },
        keep_training: { title: 'Keep the rhythm', body: 'Use short rounds and reviews to stay stable and prevent mistake backlog.', ctaLabel: 'Continue training' }
      },
      scoreExplanation: 'This is not a mock exam score. It combines practice, coverage, difficulty, mocks, and review to estimate how close you are to being stable for the exam.',
      confidenceReasons: {
        low: 'There are not enough records yet. Use this score mainly as a next-step suggestion, not as your final level.',
        medium: 'There are some training and mock records, so the main gaps are visible, but more topic coverage is still needed.',
        high: 'Subject training, mock, review, and rhythm records are fairly complete, so this judgment is steadier.',
        missingMock: 'No full mock record yet, so performance under time pressure is unknown.',
        insufficientSubjects: 'At least two subjects still do not have enough practice records for a clear picture.',
        lowVolume: 'You have not answered enough yet. Complete a few more diagnostic or training rounds first.'
      },
      evidence: {
        coverageInsufficient: 'Not enough topics have been touched yet. Complete diagnostics or practice more topics first.',
        coverage: ({ rate, highWeightRate, blindSpotCount }) => `You have practiced about ${rate}% of topics${highWeightRate === null ? '' : `, including about ${highWeightRate}% of key topics`}, with ${blindSpotCount} clear gap(s).`,
        masteryInsufficient: 'Mastery is not clear yet. Complete diagnostics or subject training first.',
        mastery: ({ mastery, weakTopicCount, highDifficultyAccuracy, highDifficultyAttemptCount, lowDifficultyAdjustedTopicCount, averageDifficultyAdjustedAccuracy }) => `Average mastery is about ${mastery}%, with ${weakTopicCount} weak topic(s). ${highDifficultyAttemptCount ? `Independent mid/high-difficulty accuracy is about ${highDifficultyAccuracy ?? 0}%.` : 'You have not practiced enough mid/high-difficulty questions yet.'}${averageDifficultyAdjustedAccuracy === null ? '' : ` By difficulty, accuracy is about ${averageDifficultyAdjustedAccuracy}%, with ${lowDifficultyAdjustedTopicCount} topic(s) still unstable.`}`,
        mockMissing: 'No full mock record yet, so pacing under exam pressure is unknown.',
        mock: ({ score, unansweredCount }) => `Latest mock score ${score}, with ${unansweredCount} unanswered.`,
        review: ({ dueCount, activeCount, pendingVerificationCount }) => `${activeCount} mistake pattern(s) need follow-up, ${dueCount} are due today, and ${pendingVerificationCount} still need same-pattern confirmation after review.`,
        rhythm: ({ activeDays, answered }) => `${activeDays} effective day(s) in the last 30 days, ${answered} questions in the last 14 days.`,
        evidence: ({ answered, subjectCount, hasMock, coverageRate, highDifficultyAttemptCount, topicSignalCount, activeDays }) => `${answered} effective answers, practice records in ${subjectCount} subject(s), ${hasMock ? 'a full mock exists' : 'no full mock yet'}, topic coverage ${coverageRate === null ? 'still needs work' : `about ${coverageRate}%`}, ${highDifficultyAttemptCount} mid/high-difficulty record(s), ${topicSignalCount} different-difficulty practice record(s), and ${activeDays} active day(s) in the last 30 days.`
      },
      blockers: {
        coverageInsufficient: 'Not enough topics have been practiced, so question count alone is not enough.',
        lowCoverage: (rate) => `Knowledge coverage is about ${rate}%, still not broad enough.`,
        blindSpots: (count) => `${count} topic(s) have barely been practiced yet.`,
        highDifficultyInsufficient: 'You have not practiced enough mid/high-difficulty questions yet, so mastery cannot be treated as stable.',
        lowHighDifficultyAccuracy: (accuracy) => `Independent mid/high-difficulty accuracy is about ${accuracy}%, so difficulty stability is not strong enough yet.`,
        weakDifficultyTopics: (count) => `${count} topic(s) still become unstable on harder questions and need more same-type practice.`,
        masteryInsufficient: 'Mastery is not clear yet. Complete diagnostics first.',
        weakSubject: ({ subject, mastery }) => `${subject} ${mastery === null ? 'still needs more practice records' : `mastery is about ${mastery}%`}.`,
        weakTopics: ({ subject, count }) => `${subject} still has ${count} weak topic(s).`,
        noMock: 'No full mock record yet, so exam pacing is unconfirmed.',
        lowMock: (score) => `Latest mock score ${score}; stability is not mature yet.`,
        unanswered: (count) => `Latest mock left ${count} unanswered question(s).`,
        dueReviews: (count) => `${count} mistake pattern(s) are due for review today.`,
        pendingVerification: (count) => `${count} reviewed mistake pattern(s) still need same-pattern questions to confirm they are fixed.`,
        lowRhythm: (days) => `${days} effective day(s) in the last 30 days is not stable enough yet.`
      }
    }
  },
  vi: {
    subjects: { math: 'Toán', physics: 'Vật lý', chemistry: 'Hóa học' },
    currentWeakSubject: 'môn còn yếu hiện tại',
    generalTopic: 'Điểm kiến thức tổng hợp',
    patterns: {
      unanswered: 'Vấn đề chưa trả lời và nhịp làm bài',
      formula_or_rule: 'Nhầm công thức hoặc quy tắc',
      calculation: 'Sai tính toán và rút gọn',
      visual_interpretation: 'Hổng phần đọc hình hoặc biểu đồ',
      concept_gap: 'Lỗ hổng hiểu khái niệm'
    },
    mockNextTitle: (subject) => `Quay lại ${subject} sau đề thi thử`,
    mockNextBody: ({ score, wrongCount, unansweredCount }) => `Đề thi thử gần nhất đạt ${score} điểm, sai ${wrongCount} câu và chưa trả lời ${unansweredCount} câu. Hãy dùng vòng 5 câu để sửa điểm yếu trước đề tiếp theo.`,
    enterSubjectTraining: 'Vào luyện theo môn',
    weeklyAnswered: ({ answered, accuracy }) => `Tuần này bạn đã làm ${answered} câu. Độ chính xác tổng thể ${accuracy === null ? 'cần thêm dữ liệu luyện tập' : `khoảng ${accuracy}%`}.`,
    weeklyPace: (minutes) => minutes > 0 ? `Giữ nhịp luyện ${minutes} phút của tuần này.` : 'Hãy hoàn thành một vòng 5 câu trước để tạo nhịp học tuần này.',
    weeklyWeak: (subject) => `Ưu tiên xử lý ${subject}, rồi quan sát xem độ khó vòng sau có cần điều chỉnh không.`,
    recentSummary: ({ answered, accuracy }) => `Gần đây bạn đã hoàn thành ${answered} câu. Độ chính xác tổng thể ${accuracy === null ? 'cần thêm dữ liệu luyện tập' : `khoảng ${accuracy}%`}. Hệ thống sẽ sắp xếp bước tiếp theo từ luyện tập, thi thử và ôn lỗi của bạn.`,
    fallbackPace: (minutes) => minutes > 0 ? `Tuần này bạn đã học khoảng ${minutes} phút. Hãy giữ nhịp ổn định.` : 'Tuần này chưa có thời lượng học ổn định. Hãy hoàn thành một vòng 5 câu trước.',
    fallbackActiveDays: (days) => days > 0 ? `Trong 30 ngày qua, bạn có ${days} ngày luyện tập hiệu quả.` : 'Hãy hoàn thành một lần chẩn đoán hoặc luyện tập để trang này bắt đầu ghi lại lộ trình của bạn.',
    fallbackWeak: (subject) => `Bước tiếp theo ưu tiên ${subject}, rồi chọn độ khó vòng sau theo kết quả.`,
    continueTitle: (subject) => `Tiếp tục vòng luyện ${subject} còn dang dở`,
    continueBody: 'Bạn còn một vòng luyện theo môn chưa hoàn thành. Tiếp tục làm bài để cập nhật mức nắm vững và gợi ý tiếp theo.',
    continueCta: 'Tiếp tục luyện',
    diagnosticTitle: (subject) => `Hoàn thành chẩn đoán ${subject} trước`,
    diagnosticBody: 'Sau bài chẩn đoán 20 câu, các vòng 5 câu tiếp theo sẽ sát điểm yếu của bạn hơn.',
    diagnosticCta: 'Bắt đầu chẩn đoán',
    firstDiagnosticTitle: 'Hoàn thành chẩn đoán Toán trước',
    firstDiagnosticBody: 'Sau lần chẩn đoán đầu tiên, trang này sẽ hiển thị lộ trình học và bước tiếp theo.',
    weakTitle: (subject) => `Ưu tiên điểm yếu trong ${subject}`,
    weakBody: 'Vòng sau sẽ ưu tiên phần cần củng cố nhất.',
    weakCta: 'Vào môn học',
    mockTitle: 'Vào một đề thi thử đầy đủ',
    mockBody: 'Sau khi đã có nền tảng luyện theo môn, dùng đề 48 câu để kiểm tra nhịp làm bài và độ phủ kiến thức.',
    mockCta: 'Vào thi thử',
    readiness: {
      stages: {
        diagnosing: 'Đang tạo đường chuẩn',
        building: 'Đang xây nền tảng',
        repairing: 'Cần sửa điểm yếu',
        reinforcing: 'Gần sẵn sàng',
        exam_ready: 'Đã sẵn sàng'
      },
      bodies: {
        diagnosing: 'Cần thêm dữ liệu chẩn đoán, luyện tập hoặc thi thử để đánh giá chắc hơn.',
        building: 'Bạn đã có dữ liệu học, nhưng mức nắm vững, thi thử hoặc nhịp học vẫn còn khoảng cách.',
        repairing: 'Việc quan trọng nhất là xử lý ôn tập đến hạn và lỗi lặp lại trước khi làm thêm câu mới.',
        reinforcing: 'Năng lực chính đã hình thành. Hãy dùng thi thử và vòng ngắn để kiểm tra độ ổn định.',
        exam_ready: 'Mức nắm vững, thi thử, ôn lỗi và nhịp học đều đủ ổn để duy trì.'
      },
      dimensions: {
        coverage: 'Độ phủ kiến thức',
        mastery: 'Mức nắm vững',
        mock: 'Thi thử',
        review: 'Ôn lỗi',
        rhythm: 'Nhịp học',
        evidence: 'Căn cứ đánh giá'
      },
      milestones: {
        diagnosing: 'Hoàn thành chẩn đoán cả ba môn và có ít nhất một lần thi thử.',
        building: 'Nâng môn yếu nhất lên trên 60%.',
        repairing: 'Xử lý phần ôn lỗi hôm nay và lỗi lặp lại trước khi làm câu mới.',
        reinforcing: 'Giữ 3 ngày luyện hiệu quả trong tuần và hoàn thành một đề thi thử.',
        exam_ready: 'Giữ nhịp học và không để ôn lỗi tồn đọng.'
      },
      actions: {
        start_diagnostic: { title: 'Hoàn thành chẩn đoán còn thiếu', body: 'Hãy hoàn thành bài chẩn đoán 20 câu còn thiếu trước, để hệ thống biết nên giúp bạn từ đâu.', ctaLabel: 'Bắt đầu chẩn đoán' },
        review_due_patterns: { title: 'Ôn lỗi trước', body: 'Lỗi tồn đọng và lỗi lặp lại làm giảm độ ổn định. Hãy xử lý trước khi làm câu mới.', ctaLabel: 'Đi ôn tập' },
        continue_active_round: { title: 'Tiếp tục vòng luyện', body: 'Vòng này chưa kết thúc. Mức sẵn sàng sẽ cập nhật sau khi hoàn thành.', ctaLabel: 'Tiếp tục vòng dở' },
        repair_weak_subject: { title: 'Sửa môn yếu nhất', body: 'Khoảng cách lớn nhất hiện là mức nắm vững theo môn. Hãy bắt đầu một vòng ngắn.', ctaLabel: 'Vào môn học' },
        resume_mock_attempt: { title: 'Sửa nhịp thi thử', body: 'Lần thi thử gần nhất còn nhiều câu chưa trả lời. Ưu tiên phân bổ thời gian.', ctaLabel: 'Vào thi thử' },
        start_mock_exam: { title: 'Làm một đề thi thử đầy đủ', body: 'Khi đã có nền tảng, đề đầy đủ sẽ kiểm tra tốc độ và độ phủ.', ctaLabel: 'Vào thi thử' },
        keep_training: { title: 'Giữ nhịp luyện', body: 'Dùng vòng ngắn và ôn lỗi để giữ ổn định, tránh lỗi tồn đọng.', ctaLabel: 'Tiếp tục luyện' }
      },
      scoreExplanation: 'Đây không phải điểm thi thử. Điểm này kết hợp luyện tập, độ phủ kiến thức, độ khó, thi thử và ôn lỗi để ước tính bạn còn cách trạng thái ổn định bao xa.',
      confidenceReasons: {
        low: 'Dữ liệu hiện còn ít. Hãy dùng điểm này chủ yếu như gợi ý bước tiếp theo, chưa phải mức cuối cùng.',
        medium: 'Đã có một số dữ liệu luyện tập và thi thử, nên có thể thấy khoảng cách chính, nhưng vẫn cần phủ thêm kiến thức.',
        high: 'Dữ liệu luyện theo môn, thi thử, ôn lỗi và nhịp học khá đầy đủ, nên đánh giá này ổn hơn.',
        missingMock: 'Chưa có đề thi thử đầy đủ nên chưa rõ biểu hiện khi chịu áp lực thời gian.',
        insufficientSubjects: 'Ít nhất hai môn còn chưa đủ dữ liệu luyện tập để nhìn rõ tình hình.',
        lowVolume: 'Bạn làm còn ít câu. Hãy hoàn thành thêm vài vòng chẩn đoán hoặc luyện tập trước.'
      },
      evidence: {
        coverageInsufficient: 'Bạn chưa luyện đủ nhiều điểm kiến thức. Hãy hoàn thành chẩn đoán hoặc luyện thêm vài điểm trước.',
        coverage: ({ rate, highWeightRate, blindSpotCount }) => `Bạn đã luyện khoảng ${rate}% điểm kiến thức${highWeightRate === null ? '' : `, trong đó điểm quan trọng khoảng ${highWeightRate}%`}, còn ${blindSpotCount} khoảng trống rõ.`,
        masteryInsufficient: 'Mức nắm vững chưa rõ. Hãy hoàn thành chẩn đoán hoặc luyện theo môn trước.',
        mastery: ({ mastery, weakTopicCount, highDifficultyAccuracy, highDifficultyAttemptCount, lowDifficultyAdjustedTopicCount, averageDifficultyAdjustedAccuracy }) => `Mức nắm vững trung bình khoảng ${mastery}%, còn ${weakTopicCount} điểm yếu. ${highDifficultyAttemptCount ? `Độ chính xác độc lập ở câu trung bình/khó khoảng ${highDifficultyAccuracy ?? 0}%.` : 'Bạn luyện câu trung bình/khó chưa đủ.'}${averageDifficultyAdjustedAccuracy === null ? '' : ` Nếu xét theo độ khó, độ chính xác khoảng ${averageDifficultyAdjustedAccuracy}%, còn ${lowDifficultyAdjustedTopicCount} điểm kiến thức chưa ổn.`}`,
        mockMissing: 'Chưa có đề thi thử đầy đủ nên chưa rõ nhịp làm bài khi chịu áp lực.',
        mock: ({ score, unansweredCount }) => `Thi thử gần nhất ${score} điểm, còn ${unansweredCount} câu chưa trả lời.`,
        review: ({ dueCount, activeCount, pendingVerificationCount }) => `Có ${activeCount} mẫu lỗi cần theo dõi, ${dueCount} mục đến hạn hôm nay, ${pendingVerificationCount} mục sau khi ôn vẫn cần làm câu cùng dạng để xác nhận đã sửa.`,
        rhythm: ({ activeDays, answered }) => `${activeDays} ngày học hiệu quả trong 30 ngày qua, ${answered} câu trong 14 ngày qua.`,
        evidence: ({ answered, subjectCount, hasMock, coverageRate, highDifficultyAttemptCount, topicSignalCount, activeDays }) => `${answered} câu trả lời hiệu quả, ${subjectCount} môn đã có dữ liệu luyện tập, ${hasMock ? 'đã có đề thi thử đầy đủ' : 'chưa có đề thi thử đầy đủ'}, độ phủ kiến thức ${coverageRate === null ? 'cần bổ sung' : `khoảng ${coverageRate}%`}, ${highDifficultyAttemptCount} ghi nhận câu trung bình/khó, ${topicSignalCount} ghi nhận luyện ở các mức khó khác nhau, và ${activeDays} ngày học hiệu quả trong 30 ngày qua.`
      },
      blockers: {
        coverageInsufficient: 'Bạn luyện chưa đủ nhiều điểm kiến thức, nên không thể chỉ nhìn số câu đã làm.',
        lowCoverage: (rate) => `Độ phủ kiến thức khoảng ${rate}%, vẫn chưa đủ rộng.`,
        blindSpots: (count) => `Còn ${count} điểm kiến thức gần như chưa luyện.`,
        highDifficultyInsufficient: 'Bạn luyện câu trung bình/khó chưa đủ, nên mức nắm vững chưa thể xem là ổn định.',
        lowHighDifficultyAccuracy: (accuracy) => `Độ chính xác độc lập ở câu trung bình/khó khoảng ${accuracy}%, độ ổn định theo độ khó chưa đủ.`,
        weakDifficultyTopics: (count) => `${count} điểm kiến thức vẫn dễ không ổn khi gặp câu khó hơn, cần luyện thêm câu cùng dạng.`,
        masteryInsufficient: 'Mức nắm vững chưa rõ. Hãy hoàn thành chẩn đoán trước.',
        weakSubject: ({ subject, mastery }) => `${subject} ${mastery === null ? 'còn cần thêm dữ liệu luyện tập' : `mức nắm vững khoảng ${mastery}%`}, vẫn là điểm yếu chính.`,
        weakTopics: ({ subject, count }) => `${subject} còn ${count} điểm yếu cần sửa.`,
        noMock: 'Chưa có đề thi thử đầy đủ nên chưa xác nhận được nhịp thi.',
        lowMock: (score) => `Thi thử gần nhất ${score} điểm, chưa đủ ổn định.`,
        unanswered: (count) => `Thi thử gần nhất còn ${count} câu chưa trả lời.`,
        dueReviews: (count) => `Hôm nay có ${count} mẫu lỗi đến hạn ôn.`,
        pendingVerification: (count) => `${count} mẫu lỗi đã ôn nhưng vẫn cần làm câu cùng dạng để xác nhận đã sửa thật.`,
        lowRhythm: (days) => `${days} ngày học hiệu quả trong 30 ngày qua, nhịp học chưa đủ ổn định.`
      }
    }
  }
};

const LOCAL_TIMEZONE = 'Asia/Shanghai';
const LOCAL_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const ALL_SUBJECT = 'all';

type SnapshotLike = {
  localDate: Date;
  activeScore: number;
  answeredCount: number;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  practiceSeconds: number;
  mockSeconds: number;
  aiInteractionCount: number;
  isStreakEligible: boolean;
};

type SubjectSnapshotLike = SnapshotLike & {
  subject: CscaLearningSubject;
};

function clampCount(value: number | undefined) {
  return Math.max(0, Math.floor(Number(value ?? 0) || 0));
}

function clampSeconds(value: number | undefined) {
  return Math.max(0, Math.floor(Number(value ?? 0) || 0));
}

function clampRange(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function readinessDifficultyRank(value?: string | null) {
  const label = String(value ?? '').trim();
  if (label.includes('模考')) return 3;
  if (label.includes('挑战')) return 4;
  if (label.includes('较难') || label.includes('提高')) return 3;
  if (label.includes('中')) return 2;
  if (label.includes('基础')) return 1;
  return 0;
}

type HighDifficultyThresholdDistribution = {
  recommendedCount: number;
  sampleSize: number;
};

function readHighDifficultyThresholdOverride(subject: CscaLearningSubject) {
  const envKey = `CSCA_READINESS_HIGH_DIFFICULTY_REQUIRED_${subject.toUpperCase()}`;
  const parsed = Number.parseInt(String(process.env[envKey] ?? ''), 10);
  if (!Number.isFinite(parsed)) return null;
  return clampRange(parsed, 1, 8);
}

function readinessHighDifficultyThreshold(input: {
  subject: CscaLearningSubject;
  distribution?: HighDifficultyThresholdDistribution;
}) {
  const defaultCount = DEFAULT_READINESS_HIGH_DIFFICULTY_SUBJECT_REQUIREMENTS[input.subject];
  const override = readHighDifficultyThresholdOverride(input.subject);
  if (override !== null) {
    return {
      requiredCount: override,
      recommendedCount: input.distribution?.recommendedCount ?? defaultCount,
      sampleSize: input.distribution?.sampleSize ?? 0,
      source: 'env_override' as const
    };
  }

  const useSampled = process.env.CSCA_READINESS_HIGH_DIFFICULTY_THRESHOLD_MODE === 'sampled';
  if (useSampled && input.distribution && input.distribution.sampleSize >= READINESS_HIGH_DIFFICULTY_DISTRIBUTION_SAMPLE_MIN) {
    return {
      requiredCount: input.distribution.recommendedCount,
      recommendedCount: input.distribution.recommendedCount,
      sampleSize: input.distribution.sampleSize,
      source: 'sampled_distribution' as const
    };
  }

  return {
    requiredCount: defaultCount,
    recommendedCount: input.distribution?.recommendedCount ?? defaultCount,
    sampleSize: input.distribution?.sampleSize ?? 0,
    source: 'default' as const
  };
}

function percentile(values: number[], ratio: number) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
  return sorted[index];
}

function readinessDifficultyWeight(rank: number) {
  if (rank >= 4) return 1.35;
  if (rank >= 3) return 1.2;
  if (rank >= 2) return 1;
  if (rank >= 1) return 0.7;
  return 0.8;
}

function readinessSourceWeight(mode?: string | null) {
  const value = String(mode ?? '').toLowerCase();
  if (value.includes('mock')) return 1.25;
  if (value.includes('diagnostic')) return 1.15;
  if (value.includes('review') || value.includes('verification') || value.includes('focus')) return 1.1;
  return 1;
}

function readinessCorrectnessScore(input: { isCorrect: boolean; usedHint?: boolean | null; usedExplanation?: boolean | null }) {
  if (!input.isCorrect) return 0;
  if (input.usedExplanation) return 0.55;
  if (input.usedHint) return 0.75;
  return 1;
}

function recordStringMapFromJson(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, String(item ?? '')]));
}

function wrongPatternVerificationState(input: { metadata: unknown; lastCorrectAt?: Date | null }) {
  const metadata = jsonRecord(input.metadata);
  const completedAtValue = typeof metadata.lastReviewCompletedAt === 'string' ? metadata.lastReviewCompletedAt : null;
  const verificationCompletedAtValue = typeof metadata.verificationCompletedAt === 'string' ? metadata.verificationCompletedAt : null;
  const completedAtMs = completedAtValue ? Date.parse(completedAtValue) : NaN;
  const verificationCompletedAtMs = verificationCompletedAtValue ? Date.parse(verificationCompletedAtValue) : NaN;
  const verificationStatus = Number.isFinite(completedAtMs)
    ? Number.isFinite(verificationCompletedAtMs) && verificationCompletedAtMs >= completedAtMs
      ? 'verified_repaired' as const
      : 'pending_verification' as const
    : 'not_started' as const;
  return {
    lastReviewCompletedAt: Number.isFinite(completedAtMs) ? new Date(completedAtMs).toISOString() : null,
    verificationStatus,
    verificationRequired: verificationStatus === 'pending_verification'
  };
}

function wrongPatternPracticeHref(subject: CscaLearningSubject, patternType: string, input: { verifyId?: number; topicId?: number | null } = {}) {
  const params = new URLSearchParams({ review: patternType });
  if (Number.isInteger(input.verifyId)) params.set('verify', String(input.verifyId));
  if (Number.isInteger(input.topicId)) params.set('topicId', String(input.topicId));
  return `${hrefForSubject(subject)}?${params.toString()}`;
}

function accuracy(correct: number, answered: number) {
  return answered > 0 ? Math.round((correct / answered) * 100) : null;
}

function localDateKey(date: Date) {
  return new Date(date.getTime() + LOCAL_OFFSET_MS).toISOString().slice(0, 10);
}

function localDateStart(keyOrDate: string | Date) {
  const key = typeof keyOrDate === 'string' ? keyOrDate : localDateKey(keyOrDate);
  const [year, month, day] = key.split('-').map((part) => Number(part));
  return new Date(Date.UTC(year, month - 1, day) - LOCAL_OFFSET_MS);
}

function addLocalDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_MS);
}

function rangeKeys(end: Date, days: number) {
  const keys: string[] = [];
  const start = addLocalDays(end, -(days - 1));
  for (let index = 0; index < days; index += 1) {
    keys.push(localDateKey(addLocalDays(start, index)));
  }
  return keys;
}

function heatLevel(activeScore: number): 0 | 1 | 2 | 3 | 4 {
  if (activeScore >= 120) return 4;
  if (activeScore >= 80) return 3;
  if (activeScore >= 40) return 2;
  if (activeScore > 0) return 1;
  return 0;
}

function activeScoreFor(input: RecordLearningActivityInput) {
  if (input.source === 'mock_exam') return 120;
  if (input.source === 'adaptive_diagnostic') return 80;
  if (input.source === 'adaptive_practice') return 40;
  return 0;
}

function secondsFromJsonMap(value: unknown): number {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 0;
  return Object.values(value as Record<string, unknown>).reduce<number>((sum, item) => sum + clampSeconds(Number(item)), 0);
}

function validSubject(value: string): CscaLearningSubject | null {
  return DASHBOARD_SUBJECTS.some((subject) => subject.id === value) ? value as CscaLearningSubject : null;
}

function readinessTagsFromValue(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : [];
}

function readinessNormalized(value: string | null | undefined) {
  return String(value ?? '').trim().toLowerCase();
}

function readinessTopicIdFromTags(tags: string[], topics: Array<{ id: number; code?: string | null; title: string; module?: string | null }>) {
  const normalizedTags = Array.from(new Set(tags.map(readinessNormalized).filter(Boolean)));
  if (!normalizedTags.length) return null;
  const exact = topics.find((topic) => {
    const title = readinessNormalized(topic.title);
    const module = readinessNormalized(topic.module);
    const code = readinessNormalized(topic.code);
    return normalizedTags.some((tag) => tag === title || tag === module || tag === code);
  });
  if (exact) return exact.id;
  const fuzzy = topics.find((topic) => {
    const candidates = [topic.title, topic.module, topic.code].map(readinessNormalized).filter(Boolean);
    return normalizedTags.some((tag) => {
      if (tag.length < 2) return false;
      return candidates.some((candidate) => candidate.includes(tag) || tag.includes(candidate));
    });
  });
  return fuzzy?.id ?? null;
}

function dashboardLanguage(value?: string | null): LearningDashboardLanguage {
  const language = String(value ?? 'zh').trim().toLowerCase();
  if (language === 'vi' || language.startsWith('vi-')) return 'vi';
  if (language === 'en' || language.startsWith('en-')) return 'en';
  return 'zh';
}

function dashboardCopy(language?: string | null) {
  return DASHBOARD_LOCALIZED_COPY[dashboardLanguage(language)];
}

function hrefForSubject(subject: CscaLearningSubject) {
  return `/zh/csca-subjects/${subject}`;
}

function subjectLabel(subject: CscaLearningSubject, language?: string | null) {
  return dashboardCopy(language).subjects[subject] ?? subject;
}

function stringArrayFromJson(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function normalizeText(value: string | null | undefined) {
  return String(value ?? '').trim();
}

function patternTypeForWrongItem(item: RecordWrongPatternItemInput) {
  const tags = (item.knowledgeTags ?? []).join(' ');
  if (item.isUnanswered) return 'unanswered';
  if (/公式|方程|定律|函数|几何|圆|三角|log|ln|sin|cos|tan/i.test(tags)) return 'formula_or_rule';
  if (/计算|运算|化简|单位|换算|比例|分数|小数/i.test(tags)) return 'calculation';
  if (/图|表|坐标|图像|图形|空间|截距|斜率/i.test(tags)) return 'visual_interpretation';
  return 'concept_gap';
}

function patternLabel(patternType: string, language?: string | null) {
  const copy = dashboardCopy(language);
  return copy.patterns[patternType] ?? copy.patterns.concept_gap;
}

function nextReviewAtFor(lastWrongAt: Date, recurrenceCount: number) {
  const days = recurrenceCount >= 4 ? 1 : recurrenceCount >= 2 ? 2 : 3;
  return addLocalDays(lastWrongAt, days);
}

function jsonRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function recentQuestionIdsFrom(value: unknown) {
  const ids = jsonRecord(value).recentQuestionIds;
  return Array.isArray(ids) ? ids.filter((id): id is number => Number.isInteger(id)) : [];
}

function normalizeQuestionSource(value: unknown) {
  const source = normalizeText(typeof value === 'string' ? value : undefined);
  return source || 'special_practice';
}

function recentQuestionRefsFrom(value: unknown): Array<{ questionId: number; questionSource: string }> {
  const refs = jsonRecord(value).recentQuestionRefs;
  if (!Array.isArray(refs)) {
    return recentQuestionIdsFrom(value).map((questionId) => ({ questionId, questionSource: 'special_practice' }));
  }
  return refs
    .map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
      const record = item as Record<string, unknown>;
      const questionId = Number(record.questionId);
      if (!Number.isInteger(questionId)) return null;
      return { questionId, questionSource: normalizeQuestionSource(record.questionSource) };
    })
    .filter((item): item is { questionId: number; questionSource: string } => Boolean(item));
}

function sameQuestionRef(a: { questionId: number; questionSource: string }, b: { questionId: number; questionSource: string }) {
  return a.questionId === b.questionId && a.questionSource === b.questionSource;
}

function correctEvidenceCountFrom(value: unknown) {
  const count = Number(jsonRecord(value).correctEvidenceCount || 0);
  return Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
}

function wrongPatternPriority(input: { status: string; recurrenceCount: number; nextReviewAt: Date | null }): 'high' | 'medium' | 'low' {
  if (input.status === 'resolved') return 'low';
  const due = input.nextReviewAt ? input.nextReviewAt.getTime() <= Date.now() : false;
  if (input.recurrenceCount >= 4 || due) return 'high';
  if (input.status === 'improving') return 'low';
  return 'medium';
}

function dueForReview(nextReviewAt: Date | null, now = new Date()) {
  return !nextReviewAt || nextReviewAt.getTime() <= now.getTime();
}

function priorityRank(priority: 'high' | 'medium' | 'low') {
  return priority === 'high' ? 2 : priority === 'medium' ? 1 : 0;
}

function metadataString(value: unknown, key: string) {
  const item = jsonRecord(value)[key];
  return typeof item === 'string' ? item.trim() : '';
}

function metadataNumber(value: unknown, key: string) {
  const item = Number(jsonRecord(value)[key]);
  return Number.isFinite(item) ? item : null;
}

function dateFromUnknown(value: unknown) {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value;
  if (typeof value !== 'string') return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function dateInWindow(date: Date | null | undefined, start: Date, end: Date) {
  if (!date) return false;
  const time = date.getTime();
  return time >= start.getTime() && time <= end.getTime();
}

type ReadinessActionCalibration = {
  multiplier: number;
  status: 'insufficient' | 'positive' | 'neutral' | 'needs_calibration';
  sampleSize: number;
  followThroughRate: number | null;
  abilityLiftRate: number | null;
  averageMasteryDelta: number | null;
};

type ReadinessActionCalibrationSnapshotInput = {
  actionType: LearningReadinessActionType;
  clickedCount: number;
  followedCount: number;
  abilityLiftCount: number;
  masteryDeltas: number[];
  calibration: ReadinessActionCalibration;
};

function defaultReadinessActionCalibration(): ReadinessActionCalibration {
  return {
    multiplier: 1,
    status: 'insufficient',
    sampleSize: 0,
    followThroughRate: null,
    abilityLiftRate: null,
    averageMasteryDelta: null
  };
}

function readinessMasteryBaseline(value: unknown): Array<{ topicId: number; mastery: number; confidence: number }> {
  const baseline = jsonRecord(value).masteryBaseline;
  if (!Array.isArray(baseline)) return [];
  return baseline.flatMap((item) => {
    const row = jsonRecord(item);
    const topicId = Number(row.topicId);
    const mastery = Number(row.mastery);
    const confidence = Number(row.confidence);
    if (!Number.isFinite(topicId) || !Number.isFinite(mastery) || !Number.isFinite(confidence)) return [];
    return [{ topicId, mastery, confidence }];
  });
}

function readinessActionAbilityLift(input: {
  actionType: LearningReadinessActionType;
  clickedAt: Date;
  reviewTimes: Date[];
  masteryBaseline: Array<{ topicId: number; mastery: number; confidence: number }>;
  masteryRows: Array<{ topicId: number; updatedAt: Date; mastery: number; confidence: number }>;
  mockAttempts: Array<{ submittedAt: Date | null; score: number | null }>;
}): { lifted: boolean; masteryDelta: number | null } {
  const liftDeadline = new Date(input.clickedAt.getTime() + 7 * DAY_MS);
  if (input.actionType === 'review_due_patterns') {
    return { lifted: input.reviewTimes.some((date) => dateInWindow(date, input.clickedAt, liftDeadline)), masteryDelta: null };
  }
  if (input.actionType === 'start_mock_exam' || input.actionType === 'resume_mock_attempt') {
    const previous = input.mockAttempts
      .filter((attempt) => attempt.submittedAt && attempt.submittedAt < input.clickedAt && Number.isFinite(Number(attempt.score)))
      .sort((a, b) => (b.submittedAt?.getTime() ?? 0) - (a.submittedAt?.getTime() ?? 0))[0] ?? null;
    const next = input.mockAttempts
      .filter((attempt) => attempt.submittedAt && dateInWindow(attempt.submittedAt, input.clickedAt, liftDeadline) && Number.isFinite(Number(attempt.score)))
      .sort((a, b) => (a.submittedAt?.getTime() ?? 0) - (b.submittedAt?.getTime() ?? 0))[0] ?? null;
    if (!next) return { lifted: false, masteryDelta: null };
    if (!previous) return { lifted: Number(next.score) >= 65, masteryDelta: null };
    return { lifted: Number(next.score) - Number(previous.score) >= 3, masteryDelta: null };
  }
  const deltas = input.masteryBaseline.flatMap((baseline) => {
    const next = input.masteryRows
      .filter((row) => row.topicId === baseline.topicId && dateInWindow(row.updatedAt, input.clickedAt, liftDeadline))
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0] ?? null;
    if (!next) return [];
    const delta = Number((next.mastery - baseline.mastery).toFixed(4));
    const confidenceReady = next.confidence >= Math.max(0.35, baseline.confidence);
    return confidenceReady ? [delta] : [];
  });
  if (deltas.length) {
    const bestDelta = Math.max(...deltas);
    return { lifted: bestDelta >= 0.05, masteryDelta: Number(bestDelta.toFixed(4)) };
  }
  const proxyLifted = input.masteryRows.some((row) => (
    dateInWindow(row.updatedAt, input.clickedAt, liftDeadline)
    && row.mastery >= 0.6
    && row.confidence >= 0.35
  ));
  return { lifted: proxyLifted, masteryDelta: null };
}

function masteryPercent(value: number | null | undefined) {
  return value === null || value === undefined ? null : Math.round(value * 100);
}

function readinessDimensionSnapshot(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const row = jsonRecord(item);
    const key = String(row.key ?? '').trim();
    if (!['coverage', 'mastery', 'mock', 'review', 'rhythm', 'evidence'].includes(key)) return [];
    const score = Number(row.score);
    const maxScore = Number(row.maxScore);
    const status = String(row.status ?? '').trim();
    return [{
      key,
      score: Number.isFinite(score) ? Math.max(0, Math.round(score)) : 0,
      maxScore: Number.isFinite(maxScore) ? Math.max(1, Math.round(maxScore)) : 1,
      status: ['strong', 'steady', 'weak', 'insufficient'].includes(status) ? status : 'weak'
    }];
  });
}

@Injectable()
export class CscaLearningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly trainingEvents?: TrainingEventService
  ) {}

  async recordReadinessActionClick(userId: number, input: {
    type?: unknown;
    href?: unknown;
    expectedGain?: unknown;
    priority?: unknown;
    rank?: unknown;
    stage?: unknown;
    score?: unknown;
    dimensions?: unknown;
    source?: unknown;
  }) {
    const actionType = String(input.type ?? '').trim();
    if (!actionType) return { recorded: false };
    const rank = Math.max(1, Math.min(3, Math.floor(Number(input.rank ?? 1) || 1)));
    const masteryBaseline = await this.prisma.userCscaTopicMastery.findMany({
      where: { userId },
      select: { topicId: true, subject: true, mastery: true, confidence: true },
      orderBy: [{ mastery: 'asc' }, { confidence: 'asc' }, { topicId: 'asc' }],
      take: 10
    });
    const metadata = {
      actionType,
      href: String(input.href ?? '').trim() || null,
      expectedGain: Math.max(0, Math.floor(Number(input.expectedGain ?? 0) || 0)),
      priority: String(input.priority ?? '').trim() || null,
      rank,
      stage: String(input.stage ?? '').trim() || null,
      score: Number.isFinite(Number(input.score)) ? Number(input.score) : null,
      dimensions: readinessDimensionSnapshot(input.dimensions),
      masteryBaseline: masteryBaseline.map((row) => ({
        topicId: row.topicId,
        subject: row.subject,
        mastery: Number(row.mastery.toFixed(4)),
        confidence: Number(row.confidence.toFixed(4))
      })),
      source: String(input.source ?? '').trim() || 'readiness_card'
    };
    if (this.trainingEvents) {
      await this.trainingEvents.record({
        userId,
        eventType: 'readiness_action_clicked',
        source: 'learning_dashboard',
        metadata
      });
    } else {
      await this.prisma.cscaTrainingEvent.create({
        data: {
          userId,
          eventType: 'readiness_action_clicked',
          source: 'learning_dashboard',
          metadata
        }
      });
    }
    return { recorded: true };
  }

  async recordLearningActivity(input: RecordLearningActivityInput) {
    const subject = validSubject(input.subject);
    if (!subject) return;

    const occurredAt = input.occurredAt ?? new Date();
    const localDate = localDateStart(occurredAt);
    const activeScore = activeScoreFor(input);
    const answeredCount = clampCount(input.answeredCount);
    const correctCount = clampCount(input.correctCount);
    const wrongCount = clampCount(input.wrongCount);
    const unansweredCount = clampCount(input.unansweredCount);
    const practiceSeconds = clampSeconds(input.practiceSeconds);
    const mockSeconds = clampSeconds(input.mockSeconds);
    const aiInteractionCount = clampCount(input.aiInteractionCount);
    const isStreakEligible = activeScore >= 40;
    const masteryAvg = await this.subjectMasteryAverage(input.userId, subject);

    await this.upsertDailySnapshot({
      userId: input.userId,
      localDate,
      subject: ALL_SUBJECT,
      activeScore,
      answeredCount,
      correctCount,
      wrongCount,
      unansweredCount,
      practiceSeconds,
      mockSeconds,
      aiInteractionCount,
      isStreakEligible
    });

    await this.upsertDailySnapshot({
      userId: input.userId,
      localDate,
      subject,
      activeScore,
      answeredCount,
      correctCount,
      wrongCount,
      unansweredCount,
      practiceSeconds,
      mockSeconds,
      aiInteractionCount,
      masteryAvg,
      isStreakEligible
    });

    if (isStreakEligible) {
      await this.updateStreak(input.userId, localDate);
    }
    await this.prepareWeeklyInsightAfterActivity(input.userId);
  }

  async recordWrongPatterns(input: RecordWrongPatternsInput) {
    const subject = validSubject(input.subject);
    if (!subject) return;
    const occurredAt = input.occurredAt ?? new Date();
    const items = input.items.filter((item) => Number.isInteger(item.questionId));
    for (const item of items) {
      const topicId = Number.isInteger(item.topicId) ? Number(item.topicId) : null;
      const patternType = patternTypeForWrongItem(item);
      const existing = await this.prisma.cscaWrongPattern.findFirst({
        where: {
          userId: input.userId,
          subject,
          topicId,
          patternType,
          status: { in: ['active', 'improving'] }
        },
        orderBy: [{ lastWrongAt: 'desc' }, { id: 'desc' }]
      });
      const nextRecurrenceCount = (existing?.recurrenceCount ?? 0) + 1;
      const questionSource = normalizeQuestionSource(item.questionSource);
      const lastQuestionRef = { questionId: item.questionId, questionSource };
      const recentQuestionRefs = [
        lastQuestionRef,
        ...recentQuestionRefsFrom(existing?.metadata).filter((ref) => !sameQuestionRef(ref, lastQuestionRef))
      ].slice(0, 8);
      const recentQuestionIds = [item.questionId, ...recentQuestionIdsFrom(existing?.metadata).filter((id) => id !== item.questionId)].slice(0, 8);
      const metadata = {
        ...jsonRecord(existing?.metadata),
        source: input.source,
        lastQuestionId: item.questionId,
        lastQuestionSource: questionSource,
        lastQuestionRef,
        recentQuestionIds,
        recentQuestionRefs,
        lastSelectedAnswer: normalizeText(item.selectedAnswer) || null,
        correctAnswer: normalizeText(item.correctAnswer) || null,
        isUnanswered: Boolean(item.isUnanswered),
        knowledgeTags: item.knowledgeTags ?? [],
        secondsSpent: clampSeconds(item.secondsSpent)
      };
      const data = {
        recurrenceCount: nextRecurrenceCount,
        lastWrongAt: occurredAt,
        nextReviewAt: nextReviewAtFor(occurredAt, nextRecurrenceCount),
        metadata
      };
      if (existing) {
        await this.prisma.cscaWrongPattern.update({ where: { id: existing.id }, data });
      } else {
        await this.prisma.cscaWrongPattern.create({
          data: {
            userId: input.userId,
            subject,
            topicId,
            patternType,
            ...data
          }
        });
      }
    }
  }

  async recordWrongPatternCorrectEvidence(input: RecordWrongPatternCorrectEvidenceInput) {
    const subject = validSubject(input.subject);
    if (!subject) return;
    const occurredAt = input.occurredAt ?? new Date();
    const topicIds = Array.from(new Set(input.items.map((item) => Number(item.topicId)).filter((id) => Number.isInteger(id))));
    if (!topicIds.length) return;
    const patterns = await this.prisma.cscaWrongPattern.findMany({
      where: {
        userId: input.userId,
        subject,
        topicId: { in: topicIds },
        status: { in: ['active', 'improving'] }
      }
    });
    for (const pattern of patterns) {
      const correctEvidenceCount = correctEvidenceCountFrom(pattern.metadata) + 1;
      const verification = wrongPatternVerificationState({ metadata: pattern.metadata, lastCorrectAt: pattern.lastCorrectAt });
      const nextStatus = verification.verificationRequired ? 'improving' : correctEvidenceCount >= 2 ? 'resolved' : 'improving';
      await this.prisma.cscaWrongPattern.update({
        where: { id: pattern.id },
        data: {
          status: nextStatus,
          lastCorrectAt: occurredAt,
          nextReviewAt: nextStatus === 'resolved' ? null : addLocalDays(occurredAt, 5),
          metadata: {
            ...jsonRecord(pattern.metadata),
            correctEvidenceCount,
            lastCorrectSource: 'answer_submit',
            lastCorrectQuestionRef: {
              questionId: input.items.find((item) => Number(item.topicId) === pattern.topicId)?.questionId ?? null,
              questionSource: normalizeQuestionSource(input.items.find((item) => Number(item.topicId) === pattern.topicId)?.questionSource)
            },
            lastCorrectAt: occurredAt.toISOString()
          }
        }
      });
    }
  }

  async recordWrongPatternVerification(input: RecordWrongPatternVerificationInput) {
    const subject = validSubject(input.subject);
    if (!subject || !Number.isInteger(input.patternId) || input.patternId <= 0) return null;
    const pattern = await this.prisma.cscaWrongPattern.findFirst({
      where: {
        id: input.patternId,
        userId: input.userId,
        subject,
        status: { in: ['active', 'improving', 'resolved'] }
      }
    });
    if (!pattern) return null;
    if (input.topicId && pattern.topicId && input.topicId !== pattern.topicId) return null;
    if (input.patternType && pattern.patternType !== input.patternType) return null;

    const occurredAt = input.occurredAt ?? new Date();
    const metadata = jsonRecord(pattern.metadata);
    const verificationAttemptCount = Math.max(0, Number(metadata.verificationAttemptCount ?? 0) || 0) + 1;
    const targetAccuracy = input.targetTotal > 0 ? Math.round((input.targetCorrectCount / input.targetTotal) * 100) : 0;
    const overallAccuracy = input.overallTotal > 0 ? Math.round((input.overallCorrectCount / input.overallTotal) * 100) : 0;
    const baseMetadata = {
      ...metadata,
      verificationAttemptCount,
      lastVerificationRoundId: input.roundId ?? null,
      lastVerificationAt: occurredAt.toISOString(),
      lastVerificationPassed: input.passed,
      lastVerificationTargetCorrectCount: input.targetCorrectCount,
      lastVerificationTargetTotal: input.targetTotal,
      lastVerificationTargetAccuracy: targetAccuracy,
      lastVerificationOverallCorrectCount: input.overallCorrectCount,
      lastVerificationOverallTotal: input.overallTotal,
      lastVerificationOverallAccuracy: overallAccuracy
    };
    const updated = await this.prisma.cscaWrongPattern.update({
      where: { id: pattern.id },
      data: input.passed
        ? {
            status: 'resolved',
            lastCorrectAt: occurredAt,
            nextReviewAt: null,
            metadata: {
              ...baseMetadata,
              verificationCompletedAt: occurredAt.toISOString(),
              verificationFailedAt: null
            }
          }
        : {
            status: 'improving',
            nextReviewAt: addLocalDays(occurredAt, 2),
            metadata: {
              ...baseMetadata,
              verificationFailedAt: occurredAt.toISOString(),
              verificationCompletedAt: null
            }
          }
    });
    return {
      id: updated.id,
      status: updated.status,
      nextReviewAt: updated.nextReviewAt?.toISOString() ?? null,
      verificationAttemptCount,
      targetAccuracy,
      overallAccuracy,
      ...wrongPatternVerificationState({ metadata: updated.metadata, lastCorrectAt: updated.lastCorrectAt })
    };
  }

  async getDashboard(userId: number, languageValue = 'zh'): Promise<LearningDashboardResponse> {
    const language = dashboardLanguage(languageValue);
    const today = localDateStart(new Date());
    const heatmapStart = addLocalDays(today, -364);
    const trendStart = addLocalDays(today, -29);
    const weekStart = addLocalDays(today, -6);

    const [snapshots, totalAggregate, totalActiveDays, streak, subjects, activeRound, completedDiagnostics, latestInsight, wrongPatterns, wrongPatternTrend, mockTrend] = await Promise.all([
      this.prisma.cscaLearningDailySnapshot.findMany({
        where: {
          userId,
          subject: ALL_SUBJECT,
          localDate: { gte: heatmapStart, lte: today }
        },
        orderBy: { localDate: 'asc' }
      }),
      this.prisma.cscaLearningDailySnapshot.aggregate({
        where: { userId, subject: ALL_SUBJECT },
        _sum: { answeredCount: true, correctCount: true }
      }),
      this.prisma.cscaLearningDailySnapshot.count({
        where: { userId, subject: ALL_SUBJECT, isStreakEligible: true }
      }),
      this.prisma.cscaLearningStreak.findUnique({ where: { userId } }),
      this.subjectCards(userId, trendStart, language),
      this.findActiveRound(userId),
      this.completedDiagnosticSubjects(userId),
      this.findLatestWeeklyInsight(userId, weekStart, today),
      this.wrongPatternCards(userId, language),
      this.wrongPatternTrend(userId, language),
      this.mockTrend(userId, language)
    ]);

    let dashboardSnapshots: SnapshotLike[] = snapshots;
    let dashboardSubjects = subjects;
    let dashboardTotalAnswered = totalAggregate._sum.answeredCount ?? 0;
    let dashboardTotalCorrect = totalAggregate._sum.correctCount ?? 0;
    let dashboardTotalActiveDays = totalActiveDays;
    let dashboardCurrentStreak = streak?.currentStreakDays ?? 0;
    let dashboardLongestStreak = streak?.longestStreakDays ?? 0;

    if (!dashboardSnapshots.length && dashboardTotalAnswered === 0) {
      const fallback = await this.historicalDashboardFallback(userId, heatmapStart, trendStart, language);
      if (fallback.totalAnswered > 0) {
        dashboardSnapshots = fallback.snapshots;
        dashboardSubjects = fallback.subjects;
        dashboardTotalAnswered = fallback.totalAnswered;
        dashboardTotalCorrect = fallback.totalCorrect;
        dashboardTotalActiveDays = fallback.totalActiveDays;
        dashboardCurrentStreak = fallback.currentStreakDays;
        dashboardLongestStreak = fallback.longestStreakDays;
      }
    }

    const byDate = new Map(dashboardSnapshots.map((snapshot) => [localDateKey(snapshot.localDate), snapshot] as const));
    const heatmap = rangeKeys(today, 365).map((date) => {
      const snapshot = byDate.get(date);
      const answeredCount = snapshot?.answeredCount ?? 0;
      const correctCount = snapshot?.correctCount ?? 0;
      const practiceSeconds = (snapshot?.practiceSeconds ?? 0) + (snapshot?.mockSeconds ?? 0);
      return {
        date,
        level: heatLevel(snapshot?.activeScore ?? 0),
        answeredCount,
        practiceMinutes: Math.round(practiceSeconds / 60),
        accuracy: accuracy(correctCount, answeredCount),
        isStreakEligible: snapshot?.isStreakEligible ?? false
      };
    });

    const trend = rangeKeys(today, 30).map((date) => {
      const snapshot = byDate.get(date);
      const answeredCount = snapshot?.answeredCount ?? 0;
      const correctCount = snapshot?.correctCount ?? 0;
      const practiceSeconds = (snapshot?.practiceSeconds ?? 0) + (snapshot?.mockSeconds ?? 0);
      return {
        date,
        answeredCount,
        accuracy: accuracy(correctCount, answeredCount),
        practiceMinutes: Math.round(practiceSeconds / 60)
      };
    });

    const practiceMinutesThisWeek = dashboardSnapshots
      .filter((snapshot) => snapshot.localDate >= weekStart)
      .reduce((sum, snapshot) => sum + snapshot.practiceSeconds + snapshot.mockSeconds, 0);
    const activeDaysLast30 = dashboardSnapshots.filter((snapshot) => snapshot.localDate >= trendStart && snapshot.isStreakEligible).length;

    const masteryTrend = await this.subjectMasteryTrend(userId, trendStart, today, language, dashboardSubjects);
    const readinessCoverage = await this.readinessCoverage(userId, language);
    const readinessDifficulty = await this.readinessDifficulty(userId);
    const readinessCalibration = await this.readinessActionCalibration();
    const summary = {
      totalAnswered: dashboardTotalAnswered,
      totalCorrect: dashboardTotalCorrect,
      accuracy: accuracy(dashboardTotalCorrect, dashboardTotalAnswered),
      practiceMinutesThisWeek: Math.round(practiceMinutesThisWeek / 60),
      currentStreakDays: dashboardCurrentStreak,
      longestStreakDays: dashboardLongestStreak,
      activeDaysLast30,
      totalActiveDays: dashboardTotalActiveDays
    };
    const rhythmEvaluation = this.rhythmEvaluation(trend, activeDaysLast30, language);
    const nextAction = this.nextAction({ subjects: dashboardSubjects, activeRound, completedDiagnostics, totalAnswered: dashboardTotalAnswered, language });

    const aiInsight = this.aiInsightFor({
      latestInsight,
      subjects: dashboardSubjects,
      totalAnswered: dashboardTotalAnswered,
      totalCorrect: dashboardTotalCorrect,
      activeDaysLast30,
      practiceMinutesThisWeek: Math.round(practiceMinutesThisWeek / 60),
      language
    });

    const dashboard = {
      summary,
      heatmap,
      trend,
      subjects: dashboardSubjects,
      masteryTrend,
      wrongPatternTrend,
      rhythmEvaluation,
      mockTrend,
      wrongPatterns,
      readiness: this.buildReadiness({
        language,
        subjects: dashboardSubjects,
        summary,
        trend,
        rhythmEvaluation,
        wrongPatternTrend,
        wrongPatterns,
        mockTrend,
        coverage: readinessCoverage,
        difficulty: readinessDifficulty,
        activeRound,
        completedDiagnostics,
        nextAction,
        calibration: readinessCalibration
      }),
      nextAction,
      learningSummary: this.learningSummaryFor(aiInsight),
      aiInsight
    };
    dashboard.readiness.actionOutcome = await this.readinessActionOutcome(userId, dashboard.readiness.score);
    return dashboard;
  }

  async generateWeeklyInsight(userId: number, languageValue = 'zh'): Promise<LearningDashboardResponse['aiInsight']> {
    const language = dashboardLanguage(languageValue);
    const dashboard = await this.getDashboard(userId, language);
    // Deprecated compatibility endpoint: personal dashboard summaries are rule-generated
    // and must not consume user AI credits or call external providers.
    return dashboard.aiInsight;
  }

  private async prepareWeeklyInsightAfterActivity(userId: number) {
    // Do not spend user AI credits from a background learning update. Weekly AI reports
    // remain available through the explicit "generate weekly insight" action.
    void userId;
  }

  private async upsertDailySnapshot(input: {
    userId: number;
    localDate: Date;
    subject: string;
    activeScore: number;
    answeredCount: number;
    correctCount: number;
    wrongCount: number;
    unansweredCount: number;
    practiceSeconds: number;
    mockSeconds: number;
    aiInteractionCount: number;
    masteryAvg?: number | null;
    isStreakEligible: boolean;
  }) {
    await this.prisma.cscaLearningDailySnapshot.upsert({
      where: {
        userId_localDate_subject: {
          userId: input.userId,
          localDate: input.localDate,
          subject: input.subject
        }
      },
      create: {
        userId: input.userId,
        localDate: input.localDate,
        timezone: LOCAL_TIMEZONE,
        subject: input.subject,
        activeScore: input.activeScore,
        answeredCount: input.answeredCount,
        correctCount: input.correctCount,
        wrongCount: input.wrongCount,
        unansweredCount: input.unansweredCount,
        practiceSeconds: input.practiceSeconds,
        mockSeconds: input.mockSeconds,
        aiInteractionCount: input.aiInteractionCount,
        masteryAvg: input.masteryAvg,
        isStreakEligible: input.isStreakEligible
      },
      update: {
        activeScore: { increment: input.activeScore },
        answeredCount: { increment: input.answeredCount },
        correctCount: { increment: input.correctCount },
        wrongCount: { increment: input.wrongCount },
        unansweredCount: { increment: input.unansweredCount },
        practiceSeconds: { increment: input.practiceSeconds },
        mockSeconds: { increment: input.mockSeconds },
        aiInteractionCount: { increment: input.aiInteractionCount },
        masteryAvg: input.masteryAvg,
        isStreakEligible: input.isStreakEligible
      }
    });
  }

  private async updateStreak(userId: number, localDate: Date) {
    const existing = await this.prisma.cscaLearningStreak.findUnique({ where: { userId } });
    const currentKey = localDateKey(localDate);
    const lastKey = existing?.lastEligibleDate ? localDateKey(existing.lastEligibleDate) : null;
    if (lastKey === currentKey) return;

    const yesterdayKey = localDateKey(addLocalDays(localDate, -1));
    const nextCurrent = lastKey === yesterdayKey ? (existing?.currentStreakDays ?? 0) + 1 : 1;
    const nextLongest = Math.max(existing?.longestStreakDays ?? 0, nextCurrent);

    await this.prisma.cscaLearningStreak.upsert({
      where: { userId },
      create: {
        userId,
        currentStreakDays: nextCurrent,
        longestStreakDays: nextLongest,
        lastEligibleDate: localDate
      },
      update: {
        currentStreakDays: nextCurrent,
        longestStreakDays: nextLongest,
        lastEligibleDate: localDate
      }
    });
  }

  async getWrongPatternReviewQueue(userId: number, input: { subject?: string; language?: string; limit?: number } = {}): Promise<CscaWrongPatternReviewQueueResponse> {
    const language = dashboardLanguage(input.language);
    const subject = input.subject ? validSubject(input.subject) : null;
    const now = new Date();
    const limit = Math.min(Math.max(Math.floor(Number(input.limit ?? 12) || 12), 1), 30);
    const rows = await this.prisma.cscaWrongPattern.findMany({
      where: {
        userId,
        status: { in: ['active', 'improving'] },
        ...(subject ? { subject } : {})
      },
      include: { topic: { select: { title: true } } },
      orderBy: [{ nextReviewAt: 'asc' }, { recurrenceCount: 'desc' }, { lastWrongAt: 'desc' }, { id: 'desc' }],
      take: 120
    });
    const items = rows.flatMap((row) => {
      const rowSubject = validSubject(row.subject);
      if (!rowSubject) return [];
      const priority = wrongPatternPriority({ status: row.status, recurrenceCount: row.recurrenceCount, nextReviewAt: row.nextReviewAt });
      const verification = wrongPatternVerificationState({ metadata: row.metadata, lastCorrectAt: row.lastCorrectAt });
      const href = wrongPatternPracticeHref(rowSubject, row.patternType, { topicId: row.topicId });
      const verificationHref = wrongPatternPracticeHref(rowSubject, row.patternType, { verifyId: row.id, topicId: row.topicId });
      return [{
        id: row.id,
        subject: rowSubject,
        subjectLabel: subjectLabel(rowSubject, language),
        topicId: row.topicId,
        topicTitle: row.topic?.title ?? dashboardCopy(language).generalTopic,
        patternType: row.patternType,
        label: patternLabel(row.patternType, language),
        recurrenceCount: row.recurrenceCount,
        status: row.status,
        priority,
        lastWrongAt: row.lastWrongAt?.toISOString() ?? null,
        lastCorrectAt: row.lastCorrectAt?.toISOString() ?? null,
        nextReviewAt: row.nextReviewAt?.toISOString() ?? null,
        due: dueForReview(row.nextReviewAt, now),
        ...verification,
        verificationHref,
        recentQuestionIds: recentQuestionIdsFrom(row.metadata),
        href
      }];
    }).sort((a, b) => {
      const dueDelta = Number(b.due) - Number(a.due);
      const priorityDelta = (b.priority === 'high' ? 2 : b.priority === 'medium' ? 1 : 0) - (a.priority === 'high' ? 2 : a.priority === 'medium' ? 1 : 0);
      const reviewDelta = Date.parse(a.nextReviewAt ?? '1970-01-01') - Date.parse(b.nextReviewAt ?? '1970-01-01');
      return dueDelta || priorityDelta || reviewDelta || b.recurrenceCount - a.recurrenceCount || b.id - a.id;
    }).slice(0, limit);
    const subjectCounts = new Map<CscaLearningSubject, number>();
    for (const item of items) {
      subjectCounts.set(item.subject, (subjectCounts.get(item.subject) ?? 0) + 1);
    }
    return {
      summary: {
        total: items.length,
        dueToday: items.filter((item) => item.due).length,
        highPriority: items.filter((item) => item.priority === 'high').length,
        subjects: [...subjectCounts.entries()].map(([nextSubject, count]) => ({
          subject: nextSubject,
          subjectLabel: subjectLabel(nextSubject, language),
          count
        }))
      },
      items
    };
  }

  async completeWrongPatternReview(userId: number, patternId: number) {
    const pattern = await this.prisma.cscaWrongPattern.findFirst({
      where: { id: patternId, userId, status: { in: ['active', 'improving'] } }
    });
    if (!pattern) {
      throw new NotFoundException('复盘任务不存在或已完成。');
    }
    const now = new Date();
    const metadata = jsonRecord(pattern.metadata);
    const reviewCount = Math.max(0, Number(metadata.reviewCount ?? 0) || 0) + 1;
    const updated = await this.prisma.cscaWrongPattern.update({
      where: { id: pattern.id },
      data: {
        status: 'improving',
        nextReviewAt: addLocalDays(now, 5),
        metadata: {
          ...metadata,
          reviewCount,
          lastReviewCompletedAt: now.toISOString()
        }
      }
    });
    const subject = validSubject(updated.subject);
    const verification = wrongPatternVerificationState({ metadata: updated.metadata, lastCorrectAt: updated.lastCorrectAt });
    return {
      id: updated.id,
      status: updated.status,
      nextReviewAt: updated.nextReviewAt?.toISOString() ?? null,
      reviewCount,
      ...verification,
      verificationHref: subject ? wrongPatternPracticeHref(subject, updated.patternType, { verifyId: updated.id, topicId: updated.topicId }) : ''
    };
  }

  async completeWrongQuestionReview(userId: number, input: {
    subject?: unknown;
    topicId?: unknown;
    patternType?: unknown;
    questionId?: unknown;
    sourceType?: unknown;
  }) {
    const subject = validSubject(String(input.subject ?? ''));
    if (!subject) throw new BadRequestException('错题科目不正确。');
    const patternType = String(input.patternType ?? 'concept_gap').trim().slice(0, 60) || 'concept_gap';
    const topicIdValue = input.topicId === null || input.topicId === undefined || input.topicId === '' ? null : Number(input.topicId);
    const topicId = Number.isInteger(topicIdValue) && Number(topicIdValue) > 0 ? Number(topicIdValue) : null;
    const questionId = Number(input.questionId);
    const now = new Date();
    const existing = await this.prisma.cscaWrongPattern.findFirst({
      where: {
        userId,
        subject,
        topicId,
        patternType,
        status: { in: ['active', 'improving'] }
      },
      orderBy: [{ lastWrongAt: 'desc' }, { id: 'desc' }]
    });
    const pattern = existing ?? await this.prisma.cscaWrongPattern.create({
      data: {
        userId,
        subject,
        topicId,
        patternType,
        recurrenceCount: 1,
        lastWrongAt: now,
        nextReviewAt: now,
        status: 'active',
        metadata: {
          source: String(input.sourceType ?? 'wrong_question_review').trim() || 'wrong_question_review',
          lastQuestionId: Number.isInteger(questionId) && questionId > 0 ? questionId : null,
          recentQuestionIds: Number.isInteger(questionId) && questionId > 0 ? [questionId] : []
        }
      }
    });
    return this.completeWrongPatternReview(userId, pattern.id);
  }

  private async subjectMasteryAverage(userId: number, subject: CscaLearningSubject) {
    const rows = await this.prisma.userCscaTopicMastery.findMany({
      where: { userId, subject },
      select: { mastery: true }
    });
    if (!rows.length) return null;
    return Number((rows.reduce((sum, row) => sum + row.mastery, 0) / rows.length).toFixed(4));
  }

  private async readinessCoverage(userId: number, language: LearningDashboardLanguage): Promise<LearningReadiness['coverage']> {
    const subjects = await Promise.all(DASHBOARD_SUBJECTS.map(async (subject) => {
      const [topics, masteryRows] = await Promise.all([
        this.prisma.cscaExamTopic.findMany({
          where: { subject: subject.id, status: 'published' },
          select: { id: true, title: true, weight: true },
          orderBy: [{ weight: 'desc' }, { id: 'asc' }]
        }),
        this.prisma.userCscaTopicMastery.findMany({
          where: { userId, subject: subject.id },
          select: { topicId: true, confidence: true, attemptCount: true }
        })
      ]);
      const masteryMap = new Map(masteryRows.map((row) => [row.topicId, row]));
      const coveredTopics = topics.filter((topic) => {
        const mastery = masteryMap.get(topic.id);
        return Boolean(mastery && (mastery.attemptCount > 0 || mastery.confidence >= 0.2));
      });
      const highWeightTopics = topics.filter((topic) => topic.weight >= 2);
      const highWeightPool = highWeightTopics.length ? highWeightTopics : topics;
      const highWeightCovered = highWeightPool.filter((topic) => coveredTopics.some((covered) => covered.id === topic.id));
      const confidenceReadyTopicCount = topics.filter((topic) => (masteryMap.get(topic.id)?.confidence ?? 0) >= 0.45).length;
      const blindSpots = topics
        .filter((topic) => {
          const mastery = masteryMap.get(topic.id);
          return !mastery || mastery.confidence < 0.25;
        })
        .slice(0, 5)
        .map((topic) => ({
          topicId: topic.id,
          title: topic.title,
          weight: topic.weight,
          reason: masteryMap.has(topic.id) ? 'low_confidence' as const : 'not_covered' as const
        }));
      return {
        subject: subject.id,
        subjectLabel: subjectLabel(subject.id, language),
        totalTopicCount: topics.length,
        coveredTopicCount: coveredTopics.length,
        coverageRate: topics.length ? Math.round((coveredTopics.length / topics.length) * 100) : null,
        highWeightCoverageRate: highWeightPool.length ? Math.round((highWeightCovered.length / highWeightPool.length) * 100) : null,
        confidenceReadyTopicCount,
        lowConfidenceTopicCount: Math.max(0, topics.length - confidenceReadyTopicCount),
        blindSpotCount: topics.filter((topic) => {
          const mastery = masteryMap.get(topic.id);
          return !mastery || mastery.confidence < 0.25;
        }).length,
        blindSpots
      };
    }));
    const subjectsWithTopics = subjects.filter((subject) => subject.totalTopicCount > 0);
    const totalTopics = subjectsWithTopics.reduce((sum, subject) => sum + subject.totalTopicCount, 0);
    const coveredTopics = subjectsWithTopics.reduce((sum, subject) => sum + subject.coveredTopicCount, 0);
    const highWeightSubjects = subjectsWithTopics.filter((subject) => subject.highWeightCoverageRate !== null);
    const overallRate = totalTopics ? Math.round((coveredTopics / totalTopics) * 100) : null;
    const highWeightCoverageRate = highWeightSubjects.length
      ? Math.round(highWeightSubjects.reduce((sum, subject) => sum + (subject.highWeightCoverageRate ?? 0), 0) / highWeightSubjects.length)
      : null;
    return {
      overallRate,
      highWeightCoverageRate,
      blindSpotCount: subjectsWithTopics.reduce((sum, subject) => sum + subject.blindSpotCount, 0),
      subjects
    };
  }

  private async readinessDifficulty(userId: number): Promise<LearningReadiness['difficulty']> {
    const recentDistributionStart = new Date(Date.now() - 30 * DAY_MS);
    const [rounds, mockAttempts, distributionRounds] = await Promise.all([
      this.prisma.cscaAdaptiveRound.findMany({
        where: {
          submittedAt: { not: null },
          session: { userId }
        },
        select: {
          session: { select: { subject: true, mode: true } },
          items: {
            select: {
              topicId: true,
              plannedDifficulty: true,
              isCorrect: true,
              usedHint: true,
              usedExplanation: true
            }
          }
        },
        orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
        take: 40
      }),
      this.prisma.mockExamAttempt.findMany({
        where: { userId, submittedAt: { not: null } },
        select: {
          answers: true,
          paper: {
            select: {
              subject: true,
              questions: {
                where: { status: 'published' },
                select: { id: true, correctAnswer: true, knowledgeTags: true },
                orderBy: [{ orderNumber: 'asc' }, { id: 'asc' }]
              }
            }
          }
        },
        orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
        take: 10
      }),
      this.prisma.cscaAdaptiveRound.findMany({
        where: {
          submittedAt: { not: null, gte: recentDistributionStart }
        },
        select: {
          session: { select: { userId: true, subject: true } },
          items: {
            select: {
              plannedDifficulty: true,
              usedHint: true,
              usedExplanation: true
            }
          }
        },
        orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
        take: 300
      })
    ]);
    const adaptiveItems = rounds.flatMap((round) => Array.isArray(round.items)
      ? round.items.map((item) => ({ ...item, session: round.session, topicTitle: undefined as string | undefined }))
      : []);
    const mockQuestions = mockAttempts.flatMap((attempt) => Array.isArray(attempt.paper?.questions)
      ? attempt.paper.questions.map((question) => ({ ...question, attempt }))
      : []);
    const mockQuestionIds = [...new Set(mockQuestions.map((question) => question.id).filter((id): id is number => Number.isFinite(id)))];
    const mockMappings = mockQuestionIds.length
      ? await this.prisma.cscaTopicMapping.findMany({
        where: {
          sourceType: 'mock_exam_question',
          sourceId: { in: mockQuestionIds },
          topic: { status: 'published' }
        },
        include: { topic: true },
        orderBy: [{ confidence: 'desc' }, { id: 'asc' }]
      })
      : [];
    const mockSubjects = Array.from(new Set(mockAttempts.map((attempt) => validSubject(attempt.paper?.subject ?? '')).filter((subject): subject is CscaLearningSubject => Boolean(subject))));
    const mockFallbackTopicRows = (await Promise.all(mockSubjects.map((subject) => this.prisma.cscaExamTopic.findMany({
      where: { subject, status: 'published' },
      select: { id: true, subject: true, title: true, module: true, code: true },
      orderBy: [{ weight: 'desc' }, { id: 'asc' }]
    })))).flat();
    const mockFallbackTopicsBySubject = new Map<CscaLearningSubject, Array<{ id: number; code?: string | null; title: string; module?: string | null }>>();
    for (const topic of mockFallbackTopicRows) {
      const subject = validSubject(topic.subject);
      if (!subject) continue;
      const list = mockFallbackTopicsBySubject.get(subject) ?? [];
      list.push(topic);
      mockFallbackTopicsBySubject.set(subject, list);
    }
    const mockTopicMap = new Map<number, {
      topicId: number;
      subject: CscaLearningSubject;
      topicTitle: string;
    }>();
    mockMappings.forEach((mapping) => {
      if (mockTopicMap.has(mapping.sourceId)) return;
      const subject = validSubject(mapping.topic.subject);
      if (!subject) return;
      mockTopicMap.set(mapping.sourceId, {
        topicId: mapping.topicId,
        subject,
        topicTitle: mapping.topic.title
      });
    });
    const mockItems = mockQuestions.flatMap((question) => {
      const subject = validSubject(question.attempt.paper?.subject ?? '');
      const fallbackTopicId = subject
        ? readinessTopicIdFromTags(
          readinessTagsFromValue(question.knowledgeTags),
          mockFallbackTopicsBySubject.get(subject) ?? []
        )
        : null;
      const fallbackTopic = fallbackTopicId
        ? mockFallbackTopicRows.find((topic) => topic.id === fallbackTopicId)
        : null;
      const mapping = mockTopicMap.get(question.id) ?? (subject && fallbackTopic
        ? { topicId: fallbackTopic.id, subject, topicTitle: fallbackTopic.title }
        : null);
      if (!mapping) return [];
      const answers = recordStringMapFromJson(question.attempt.answers);
      const selected = answers[String(question.id)] ?? '';
      return [{
        topicId: mapping.topicId,
        plannedDifficulty: '模考',
        isCorrect: Boolean(selected && selected === question.correctAnswer),
        usedHint: false,
        usedExplanation: false,
        session: { subject: mapping.subject, mode: 'mock_exam' },
        topicTitle: mapping.topicTitle
      }];
    });
    const items = [...adaptiveItems, ...mockItems];
    const answeredItems = items.filter((item) => item.isCorrect !== null && item.isCorrect !== undefined);
    const rankedItems = answeredItems.map((item) => ({
      rank: readinessDifficultyRank(item.plannedDifficulty),
      isCorrect: Boolean(item.isCorrect),
      isIndependent: !item.usedHint && !item.usedExplanation,
      subject: validSubject(item.session?.subject ?? '')
    }));
    const highDifficultyItems = rankedItems.filter((item) => item.rank >= 3);
    const independentHighDifficultyItems = highDifficultyItems.filter((item) => item.isIndependent);
    const highDifficultyCorrect = independentHighDifficultyItems.filter((item) => item.isCorrect).length;
    const thresholdDistributions = this.highDifficultyThresholdDistributions(distributionRounds);
    const highDifficultySubjectThresholds = DASHBOARD_SUBJECTS.map(({ id }) => {
      const attemptCount = independentHighDifficultyItems.filter((item) => item.subject === id).length;
      const threshold = readinessHighDifficultyThreshold({
        subject: id,
        distribution: thresholdDistributions.get(id)
      });
      return {
        subject: id,
        attemptCount,
        ...threshold,
        ready: attemptCount >= threshold.requiredCount
      };
    });
    const highDifficultySubjectReadyCount = highDifficultySubjectThresholds.filter((item) => item.ready).length;
    const averageDifficultyRank = rankedItems.length
      ? Number((rankedItems.reduce((sum, item) => sum + item.rank, 0) / rankedItems.length).toFixed(2))
      : null;
    const topicIds = [...new Set(answeredItems.map((item) => item.topicId).filter((topicId): topicId is number => Number.isFinite(topicId)))];
    const topics = topicIds.length
      ? await this.prisma.cscaExamTopic.findMany({
        where: { id: { in: topicIds } },
        select: { id: true, subject: true, title: true }
      })
      : [];
    const topicMap = new Map(topics.map((topic) => [topic.id, topic]));
    const topicSignals = new Map<number, {
      topicId: number;
      subject: CscaLearningSubject;
      topicTitle: string;
      attemptCount: number;
      weightedCorrect: number;
      totalWeight: number;
      rankSum: number;
      sourceWeightSum: number;
    }>();
    for (const item of answeredItems) {
      if (!Number.isFinite(item.topicId)) continue;
      const topic = topicMap.get(item.topicId);
      const subject = validSubject(topic?.subject ?? item.session?.subject ?? '');
      if (!subject) continue;
      const rank = readinessDifficultyRank(item.plannedDifficulty);
      const sourceWeight = readinessSourceWeight(item.session?.mode);
      const weight = readinessDifficultyWeight(rank) * sourceWeight;
      const existing = topicSignals.get(item.topicId) ?? {
        topicId: item.topicId,
        subject,
        topicTitle: topic?.title ?? item.topicTitle ?? dashboardCopy('zh').generalTopic,
        attemptCount: 0,
        weightedCorrect: 0,
        totalWeight: 0,
        rankSum: 0,
        sourceWeightSum: 0
      };
      existing.attemptCount += 1;
      existing.weightedCorrect += weight * readinessCorrectnessScore({
        isCorrect: Boolean(item.isCorrect),
        usedHint: item.usedHint,
        usedExplanation: item.usedExplanation
      });
      existing.totalWeight += weight;
      existing.rankSum += rank;
      existing.sourceWeightSum += sourceWeight;
      topicSignals.set(item.topicId, existing);
    }
    const topicSummaries = [...topicSignals.values()]
      .filter((topic) => topic.attemptCount >= 3 && topic.totalWeight > 0)
      .map((topic) => ({
        topicId: topic.topicId,
        subject: topic.subject,
        topicTitle: topic.topicTitle,
        attemptCount: topic.attemptCount,
        difficultyAdjustedAccuracy: Math.round((topic.weightedCorrect / topic.totalWeight) * 100),
        averageDifficultyRank: Number((topic.rankSum / topic.attemptCount).toFixed(2)),
        sourceWeight: Number((topic.sourceWeightSum / topic.attemptCount).toFixed(2))
      }));
    const weakDifficultyTopics = topicSummaries
      .filter((topic) => topic.difficultyAdjustedAccuracy < 60 || (topic.averageDifficultyRank !== null && topic.averageDifficultyRank >= 2.5 && topic.difficultyAdjustedAccuracy < 70))
      .sort((a, b) => a.difficultyAdjustedAccuracy - b.difficultyAdjustedAccuracy || b.attemptCount - a.attemptCount || a.topicId - b.topicId);
    const averageDifficultyAdjustedAccuracy = topicSummaries.length
      ? Math.round(topicSummaries.reduce((sum, topic) => sum + topic.difficultyAdjustedAccuracy, 0) / topicSummaries.length)
      : null;
    return {
      attemptedCount: rankedItems.length,
      highDifficultyAttemptCount: highDifficultyItems.length,
      independentHighDifficultyAttemptCount: independentHighDifficultyItems.length,
      highDifficultySubjectReadyCount,
      highDifficultySubjectThresholds,
      highDifficultyAccuracy: accuracy(highDifficultyCorrect, independentHighDifficultyItems.length),
      averageDifficultyRank,
      topicSignalCount: topicSummaries.length,
      lowDifficultyAdjustedTopicCount: weakDifficultyTopics.length,
      averageDifficultyAdjustedAccuracy,
      weakDifficultyTopics: weakDifficultyTopics.slice(0, 5)
    };
  }

  private highDifficultyThresholdDistributions(rounds: Array<{
    session?: { userId?: number | null; subject?: string | null } | null;
    items?: Array<{ plannedDifficulty?: string | null; usedHint?: boolean | null; usedExplanation?: boolean | null }> | null;
  }>): Map<CscaLearningSubject, HighDifficultyThresholdDistribution> {
    const countsByUserSubject = new Map<string, { subject: CscaLearningSubject; count: number }>();
    for (const round of rounds) {
      const subject = validSubject(round.session?.subject ?? '');
      const userId = typeof round.session?.userId === 'number' ? round.session.userId : null;
      if (!subject || userId === null || !Array.isArray(round.items)) continue;
      const count = round.items.filter((item) => (
        readinessDifficultyRank(item.plannedDifficulty) >= 3
        && !item.usedHint
        && !item.usedExplanation
      )).length;
      if (count <= 0) continue;
      const key = `${userId}:${subject}`;
      const existing = countsByUserSubject.get(key);
      countsByUserSubject.set(key, { subject, count: (existing?.count ?? 0) + count });
    }

    const countsBySubject = new Map<CscaLearningSubject, number[]>();
    for (const value of countsByUserSubject.values()) {
      const counts = countsBySubject.get(value.subject) ?? [];
      counts.push(value.count);
      countsBySubject.set(value.subject, counts);
    }

    const result = new Map<CscaLearningSubject, HighDifficultyThresholdDistribution>();
    for (const subject of DASHBOARD_SUBJECTS.map((item) => item.id)) {
      const counts = countsBySubject.get(subject) ?? [];
      const distributionCount = percentile(counts, 0.6) ?? DEFAULT_READINESS_HIGH_DIFFICULTY_SUBJECT_REQUIREMENTS[subject];
      result.set(subject, {
        recommendedCount: clampRange(Math.round(distributionCount), DEFAULT_READINESS_HIGH_DIFFICULTY_SUBJECT_REQUIREMENTS[subject], 5),
        sampleSize: counts.length
      });
    }
    return result;
  }

  private async subjectCards(userId: number, since: Date, language: LearningDashboardLanguage): Promise<LearningDashboardSubject[]> {
    return Promise.all(DASHBOARD_SUBJECTS.map(async (subject) => {
      const [snapshotRows, masteryRows] = await Promise.all([
        this.prisma.cscaLearningDailySnapshot.findMany({
          where: { userId, subject: subject.id, localDate: { gte: since } },
          orderBy: { localDate: 'desc' }
        }),
        this.prisma.userCscaTopicMastery.findMany({
          where: { userId, subject: subject.id },
          select: { mastery: true }
        })
      ]);
      const answeredCount = snapshotRows.reduce((sum, row) => sum + row.answeredCount, 0);
      const correctCount = snapshotRows.reduce((sum, row) => sum + row.correctCount, 0);
      const masteryAvg = masteryRows.length
        ? Math.round((masteryRows.reduce((sum, row) => sum + row.mastery, 0) / masteryRows.length) * 100)
        : null;
      return {
        subject: subject.id,
        label: subjectLabel(subject.id, language),
        masteryAvg,
        answeredCount,
        accuracy: accuracy(correctCount, answeredCount),
        weakTopicCount: masteryRows.filter((row) => row.mastery < 0.55).length,
        href: hrefForSubject(subject.id)
      };
    }));
  }

  private async wrongPatternCards(userId: number, language: LearningDashboardLanguage): Promise<LearningDashboardResponse['wrongPatterns']> {
    const copy = dashboardCopy(language);
    const rows = await this.prisma.cscaWrongPattern.findMany({
      where: { userId, status: { in: ['active', 'improving'] } },
      include: { topic: { select: { title: true } } },
      orderBy: [{ recurrenceCount: 'desc' }, { lastWrongAt: 'desc' }, { id: 'desc' }],
      take: 3
    });
    return rows.flatMap((row) => {
      const subject = validSubject(row.subject);
      if (!subject) return [];
      const label = patternLabel(row.patternType, language);
      const verification = wrongPatternVerificationState({ metadata: row.metadata, lastCorrectAt: row.lastCorrectAt });
      const href = wrongPatternPracticeHref(subject, row.patternType, { topicId: row.topicId });
      const verificationHref = wrongPatternPracticeHref(subject, row.patternType, { verifyId: row.id, topicId: row.topicId });
      return [{
        id: row.id,
        subject,
        subjectLabel: subjectLabel(subject, language),
        topicId: row.topicId,
        topicTitle: row.topic?.title ?? copy.generalTopic,
        patternType: row.patternType,
        label,
        recurrenceCount: row.recurrenceCount,
        status: row.status,
        priority: wrongPatternPriority({ status: row.status, recurrenceCount: row.recurrenceCount, nextReviewAt: row.nextReviewAt }),
        lastWrongAt: row.lastWrongAt?.toISOString() ?? null,
        lastCorrectAt: row.lastCorrectAt?.toISOString() ?? null,
        nextReviewAt: row.nextReviewAt?.toISOString() ?? null,
        ...verification,
        verificationHref,
        href
      }];
    });
  }

  private async subjectMasteryTrend(
    userId: number,
    since: Date,
    today: Date,
    language: LearningDashboardLanguage,
    subjects: LearningDashboardSubject[]
  ): Promise<LearningDashboardResponse['masteryTrend']> {
    const rows = await this.prisma.cscaLearningDailySnapshot.findMany({
      where: {
        userId,
        subject: { in: DASHBOARD_SUBJECTS.map((subject) => subject.id) },
        localDate: { gte: since, lte: today }
      },
      orderBy: [{ localDate: 'asc' }, { subject: 'asc' }]
    });
    const rowsBySubject = new Map<CscaLearningSubject, typeof rows>();
    for (const row of rows) {
      const subject = validSubject(row.subject);
      if (!subject) continue;
      rowsBySubject.set(subject, [...(rowsBySubject.get(subject) ?? []), row]);
    }
    const subjectMap = new Map(subjects.map((subject) => [subject.subject, subject] as const));
    return DASHBOARD_SUBJECTS.map((entry) => {
      const subject = subjectMap.get(entry.id);
      const subjectRows = rowsBySubject.get(entry.id) ?? [];
      const masteryRows = subjectRows.filter((row) => row.masteryAvg !== null && row.masteryAvg !== undefined);
      const previous = masteryRows[0];
      const latest = masteryRows[masteryRows.length - 1];
      const previousMastery = masteryPercent(previous?.masteryAvg);
      const currentMastery = subject?.masteryAvg ?? masteryPercent(latest?.masteryAvg);
      const delta = currentMastery !== null && previousMastery !== null ? currentMastery - previousMastery : null;
      return {
        subject: entry.id,
        subjectLabel: subject?.label ?? subjectLabel(entry.id, language),
        currentMastery,
        previousMastery,
        delta,
        weakTopicCount: subject?.weakTopicCount ?? 0,
        answeredCount: subjectRows.reduce((sum, row) => sum + row.answeredCount, 0),
        points: masteryRows.map((row) => ({
          date: localDateKey(row.localDate),
          mastery: masteryPercent(row.masteryAvg) ?? 0
        }))
      };
    });
  }

  private async wrongPatternTrend(userId: number, language: LearningDashboardLanguage): Promise<LearningDashboardResponse['wrongPatternTrend']> {
    const rows = await this.prisma.cscaWrongPattern.findMany({
      where: { userId, status: { in: ['active', 'improving'] } },
      orderBy: [{ recurrenceCount: 'desc' }, { lastWrongAt: 'desc' }, { id: 'desc' }],
      take: 120
    });
    const grouped = new Map<string, {
      activeCount: number;
      dueCount: number;
      recurrenceCount: number;
      priority: 'high' | 'medium' | 'low';
    }>();
    for (const row of rows) {
      const existing = grouped.get(row.patternType) ?? {
        activeCount: 0,
        dueCount: 0,
        recurrenceCount: 0,
        priority: 'low' as const
      };
      const priority = wrongPatternPriority({ status: row.status, recurrenceCount: row.recurrenceCount, nextReviewAt: row.nextReviewAt });
      existing.activeCount += 1;
      existing.dueCount += dueForReview(row.nextReviewAt) ? 1 : 0;
      existing.recurrenceCount += row.recurrenceCount;
      existing.priority = priorityRank(priority) > priorityRank(existing.priority) ? priority : existing.priority;
      grouped.set(row.patternType, existing);
    }
    return [...grouped.entries()].map(([patternType, item]) => ({
      patternType,
      label: patternLabel(patternType, language),
      activeCount: item.activeCount,
      dueCount: item.dueCount,
      recurrenceCount: item.recurrenceCount,
      priority: item.priority
    })).sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority) || b.dueCount - a.dueCount || b.recurrenceCount - a.recurrenceCount).slice(0, 5);
  }

  private rhythmEvaluation(
    trend: LearningDashboardResponse['trend'],
    activeDaysLast30: number,
    language: LearningDashboardLanguage
  ): LearningDashboardResponse['rhythmEvaluation'] {
    const recent14 = trend.slice(-14);
    const previous16 = trend.slice(0, 16);
    const last7 = trend.slice(-7);
    const answeredLast14 = recent14.reduce((sum, item) => sum + item.answeredCount, 0);
    const answeredPrevious16 = previous16.reduce((sum, item) => sum + item.answeredCount, 0);
    const activeDaysLast7 = last7.filter((item) => item.answeredCount > 0).length;
    const recentAccuracyRows = recent14.filter((item) => item.accuracy !== null && item.answeredCount > 0);
    const previousAccuracyRows = previous16.filter((item) => item.accuracy !== null && item.answeredCount > 0);
    const average = (rows: typeof recentAccuracyRows) => rows.length
      ? Math.round(rows.reduce((sum, item) => sum + (item.accuracy ?? 0), 0) / rows.length)
      : null;
    const recentAccuracy = average(recentAccuracyRows);
    const previousAccuracy = average(previousAccuracyRows);
    const accuracyDelta = recentAccuracy !== null && previousAccuracy !== null ? recentAccuracy - previousAccuracy : null;
    const status: LearningDashboardResponse['rhythmEvaluation']['status'] = activeDaysLast30 >= 12 && answeredLast14 >= 40
      ? 'strong'
      : activeDaysLast30 >= 6 || activeDaysLast7 >= 3
        ? 'steady'
        : answeredLast14 > 0
          ? 'building'
          : 'at_risk';
    const copy = {
      zh: {
        strong: ['节奏很稳', `近 30 天有 ${activeDaysLast30} 天完成有效训练，最近两周作答 ${answeredLast14} 题。`, '保持当前节奏，并用模考检查速度。'],
        steady: ['节奏正在成形', `近 30 天有 ${activeDaysLast30} 天有效训练，最近 7 天活跃 ${activeDaysLast7} 天。`, '继续保持每周 3 次以上短训练。'],
        building: ['已经开始积累', `最近两周作答 ${answeredLast14} 题，还需要更多连续证据。`, '先完成下一轮 5 题训练，把节奏接起来。'],
        at_risk: ['节奏需要重启', '近两周还没有形成有效训练记录。', '从一次 5 题训练或今日复盘开始。']
      },
      en: {
        strong: ['Strong rhythm', `${activeDaysLast30} active day(s) in the last 30 days, with ${answeredLast14} answers in the last two weeks.`, 'Keep this rhythm and use a mock exam to check pacing.'],
        steady: ['Rhythm is forming', `${activeDaysLast30} active day(s) in the last 30 days, ${activeDaysLast7} in the last week.`, 'Keep at least three short sessions each week.'],
        building: ['Momentum has started', `${answeredLast14} answers in the last two weeks; more continuity will make the signal clearer.`, 'Complete the next 5-question round to keep the rhythm connected.'],
        at_risk: ['Restart the rhythm', 'The last two weeks do not yet show effective training records.', 'Start with one 5-question round or today’s review.']
      },
      vi: {
        strong: ['Nhịp học rất ổn', `${activeDaysLast30} ngày học hiệu quả trong 30 ngày qua, ${answeredLast14} câu trong hai tuần gần đây.`, 'Giữ nhịp này và dùng đề thi thử để kiểm tra tốc độ.'],
        steady: ['Nhịp học đang hình thành', `${activeDaysLast30} ngày học hiệu quả trong 30 ngày qua, ${activeDaysLast7} ngày trong tuần gần đây.`, 'Duy trì ít nhất ba phiên luyện ngắn mỗi tuần.'],
        building: ['Đã bắt đầu tích lũy', `${answeredLast14} câu trong hai tuần gần đây; cần thêm sự liên tục để tín hiệu rõ hơn.`, 'Hoàn thành vòng 5 câu tiếp theo để nối nhịp học.'],
        at_risk: ['Cần khởi động lại nhịp học', 'Hai tuần gần đây chưa có bản ghi luyện tập hiệu quả.', 'Bắt đầu bằng một vòng 5 câu hoặc phần ôn hôm nay.']
      }
    }[language][status];
    return {
      status,
      title: copy[0],
      body: accuracyDelta === null ? copy[1] : `${copy[1]} ${language === 'zh' ? '正确率变化' : language === 'vi' ? 'Độ chính xác thay đổi' : 'Accuracy change'} ${accuracyDelta >= 0 ? '+' : ''}${accuracyDelta}%.`,
      action: copy[2],
      activeDaysLast30,
      activeDaysLast7,
      answeredLast14,
      answeredPrevious16,
      accuracyDelta
    };
  }

  private buildReadiness(input: {
    language: LearningDashboardLanguage;
    subjects: LearningDashboardSubject[];
    summary: LearningDashboardResponse['summary'];
    trend: LearningDashboardResponse['trend'];
    rhythmEvaluation: LearningDashboardResponse['rhythmEvaluation'];
    wrongPatternTrend: LearningDashboardResponse['wrongPatternTrend'];
    wrongPatterns: LearningDashboardResponse['wrongPatterns'];
    mockTrend: LearningDashboardResponse['mockTrend'];
    coverage: LearningReadiness['coverage'];
    difficulty: LearningReadiness['difficulty'];
    activeRound: Awaited<ReturnType<CscaLearningService['findActiveRound']>>;
    completedDiagnostics: Set<CscaLearningSubject>;
    nextAction: LearningDashboardResponse['nextAction'];
    calibration: Map<LearningReadinessActionType, ReadinessActionCalibration>;
  }): LearningReadiness {
    const copy = dashboardCopy(input.language).readiness;
    const trainedSubjects = input.subjects.filter((subject) => subject.masteryAvg !== null || subject.answeredCount > 0);
    const masterySubjects = input.subjects.filter((subject) => subject.masteryAvg !== null);
    const masteryAvg = masterySubjects.length
      ? Math.round(masterySubjects.reduce((sum, subject) => sum + (subject.masteryAvg ?? 0), 0) / masterySubjects.length)
      : null;
    const weakTopicCount = input.subjects.reduce((sum, subject) => sum + subject.weakTopicCount, 0);
    const weakestSubject = [...input.subjects].sort((a, b) => {
      const aScore = a.masteryAvg ?? a.accuracy ?? (a.answeredCount > 0 ? 35 : 0);
      const bScore = b.masteryAvg ?? b.accuracy ?? (b.answeredCount > 0 ? 35 : 0);
      return aScore - bScore || b.weakTopicCount - a.weakTopicCount;
    })[0] ?? null;
    const activePatternCount = input.wrongPatternTrend.reduce((sum, pattern) => sum + pattern.activeCount, 0);
    const trendDueCount = input.wrongPatternTrend.reduce((sum, pattern) => sum + pattern.dueCount, 0);
    const now = Date.now();
    const cardDueCount = input.wrongPatterns.filter((pattern) => {
      if (!pattern.nextReviewAt) return true;
      const dueTime = Date.parse(pattern.nextReviewAt);
      return Number.isNaN(dueTime) || dueTime <= now;
    }).length;
    const dueReviewCount = Math.max(trendDueCount, cardDueCount);
    const highPriorityPatternCount = input.wrongPatterns.filter((pattern) => pattern.priority === 'high').length;
    const pendingVerificationCount = input.wrongPatterns.filter((pattern) => pattern.verificationRequired).length;
    const latestMock = input.mockTrend.latest;
    const answeredLast14 = input.trend.slice(-14).reduce((sum, item) => sum + item.answeredCount, 0);
    const coverageRate = input.coverage.overallRate;
    const highWeightCoverageRate = input.coverage.highWeightCoverageRate;
    const highDifficultyAttemptCount = input.difficulty.independentHighDifficultyAttemptCount;
    const highDifficultySubjectReadyCount = input.difficulty.highDifficultySubjectReadyCount;
    const expectedHighDifficultySubjectCount = Math.min(3, Math.max(1, masterySubjects.length));
    const hasBroadHighDifficultyEvidence = highDifficultyAttemptCount >= 6 && highDifficultySubjectReadyCount >= Math.min(2, expectedHighDifficultySubjectCount);
    const hasExamReadyHighDifficultyEvidence = highDifficultyAttemptCount >= 6 && highDifficultySubjectReadyCount >= 3;
    const highDifficultyAccuracy = input.difficulty.highDifficultyAccuracy;
    const lowDifficultyAdjustedTopicCount = input.difficulty.lowDifficultyAdjustedTopicCount;
    const averageDifficultyAdjustedAccuracy = input.difficulty.averageDifficultyAdjustedAccuracy;

    const evidenceScore = clampRange(Math.round(
      (input.summary.totalAnswered >= 80 ? 2 : input.summary.totalAnswered >= 40 ? 1 : 0)
        + (masterySubjects.length >= 3 ? 2 : masterySubjects.length >= 2 ? 1 : 0)
        + (latestMock ? 2 : 0)
        + (coverageRate !== null && coverageRate >= 70 ? 1 : 0)
        + (hasExamReadyHighDifficultyEvidence ? 1 : hasBroadHighDifficultyEvidence ? 0.75 : highDifficultyAttemptCount >= 3 ? 0.5 : 0)
        + (input.difficulty.topicSignalCount >= 3 ? 1 : 0)
        + (input.summary.activeDaysLast30 >= 6 ? 1 : 0)),
      0,
      10
    );
    const coverageScore = coverageRate === null
      ? 0
      : clampRange(Math.round((coverageRate / 100) * 18) - Math.min(5, input.coverage.blindSpotCount), 2, 18);
    const masteryScore = masteryAvg === null
      ? 0
      : clampRange(
        Math.round((masteryAvg / 100) * 26)
          - Math.min(5, weakTopicCount)
          - (!hasBroadHighDifficultyEvidence ? 4 : 0)
          - (highDifficultyAccuracy !== null && highDifficultyAccuracy < 60 ? 4 : 0)
          - Math.min(4, lowDifficultyAdjustedTopicCount),
        4,
        26
      );
    const mockScore = latestMock
      ? clampRange(Math.round((latestMock.score / 100) * 22) - Math.min(6, latestMock.unansweredCount), 3, 22)
      : 0;
    const reviewScore = clampRange(16 - dueReviewCount * 4 - highPriorityPatternCount * 3 - pendingVerificationCount * 4 - Math.max(0, activePatternCount - 3), 0, 16);
    const rhythmScore = clampRange(Math.round((input.summary.activeDaysLast30 / 12) * 5) + Math.round((answeredLast14 / 40) * 3), 0, 8);

    const dimensionStatus = (score: number, maxScore: number, insufficient = false): LearningReadinessDimensionStatus => {
      if (insufficient) return 'insufficient';
      const ratio = score / maxScore;
      if (ratio >= 0.78) return 'strong';
      if (ratio >= 0.58) return 'steady';
      return 'weak';
    };
    const dimensions: LearningReadiness['dimensions'] = [
      {
        key: 'coverage',
        label: copy.dimensions.coverage,
        score: coverageScore,
        maxScore: 18,
        status: dimensionStatus(coverageScore, 18, coverageRate === null),
        evidence: coverageRate === null ? copy.evidence.coverageInsufficient : copy.evidence.coverage({
          rate: coverageRate,
          highWeightRate: highWeightCoverageRate,
          blindSpotCount: input.coverage.blindSpotCount
        })
      },
      {
        key: 'mastery',
        label: copy.dimensions.mastery,
        score: masteryScore,
        maxScore: 26,
        status: dimensionStatus(masteryScore, 26, masteryAvg === null),
        evidence: masteryAvg === null ? copy.evidence.masteryInsufficient : copy.evidence.mastery({
          mastery: masteryAvg,
          weakTopicCount,
          highDifficultyAccuracy,
          highDifficultyAttemptCount,
          lowDifficultyAdjustedTopicCount,
          averageDifficultyAdjustedAccuracy
        })
      },
      {
        key: 'mock',
        label: copy.dimensions.mock,
        score: mockScore,
        maxScore: 22,
        status: dimensionStatus(mockScore, 22, !latestMock),
        evidence: latestMock ? copy.evidence.mock({ score: latestMock.score, unansweredCount: latestMock.unansweredCount }) : copy.evidence.mockMissing
      },
      {
        key: 'review',
        label: copy.dimensions.review,
        score: reviewScore,
        maxScore: 16,
        status: dimensionStatus(reviewScore, 16),
        evidence: copy.evidence.review({ dueCount: dueReviewCount, activeCount: activePatternCount, pendingVerificationCount })
      },
      {
        key: 'rhythm',
        label: copy.dimensions.rhythm,
        score: rhythmScore,
        maxScore: 8,
        status: dimensionStatus(rhythmScore, 8, input.summary.totalAnswered === 0),
        evidence: copy.evidence.rhythm({ activeDays: input.summary.activeDaysLast30, answered: answeredLast14 })
      },
      {
        key: 'evidence',
        label: copy.dimensions.evidence,
        score: evidenceScore,
        maxScore: 10,
        status: dimensionStatus(evidenceScore, 10, evidenceScore < 3),
        evidence: copy.evidence.evidence({
          answered: input.summary.totalAnswered,
          subjectCount: masterySubjects.length,
          hasMock: Boolean(latestMock),
          coverageRate,
          highDifficultyAttemptCount,
          topicSignalCount: input.difficulty.topicSignalCount,
          activeDays: input.summary.activeDaysLast30
        })
      }
    ];
    const score = dimensions.reduce((sum, dimension) => sum + dimension.score, 0);

    const blockers: string[] = [];
    if (coverageRate === null) blockers.push(copy.blockers.coverageInsufficient);
    if (coverageRate !== null && coverageRate < 60) blockers.push(copy.blockers.lowCoverage(coverageRate));
    if (input.coverage.blindSpotCount >= 3) blockers.push(copy.blockers.blindSpots(input.coverage.blindSpotCount));
    if (masteryAvg !== null && !hasBroadHighDifficultyEvidence) blockers.push(copy.blockers.highDifficultyInsufficient);
    if (highDifficultyAccuracy !== null && highDifficultyAccuracy < 60) blockers.push(copy.blockers.lowHighDifficultyAccuracy(highDifficultyAccuracy));
    if (lowDifficultyAdjustedTopicCount > 0) blockers.push(copy.blockers.weakDifficultyTopics(lowDifficultyAdjustedTopicCount));
    if (masteryAvg === null || trainedSubjects.length < 2) blockers.push(copy.blockers.masteryInsufficient);
    if (weakestSubject && (weakestSubject.masteryAvg === null || weakestSubject.masteryAvg < 60)) {
      blockers.push(copy.blockers.weakSubject({ subject: weakestSubject.label, mastery: weakestSubject.masteryAvg }));
    }
    if (weakestSubject && weakestSubject.weakTopicCount >= 2) {
      blockers.push(copy.blockers.weakTopics({ subject: weakestSubject.label, count: weakestSubject.weakTopicCount }));
    }
    if (!latestMock) blockers.push(copy.blockers.noMock);
    if (latestMock && latestMock.score < 65) blockers.push(copy.blockers.lowMock(latestMock.score));
    if (latestMock && latestMock.unansweredCount >= 8) blockers.push(copy.blockers.unanswered(latestMock.unansweredCount));
    if (dueReviewCount > 0) blockers.push(copy.blockers.dueReviews(dueReviewCount));
    if (pendingVerificationCount > 0) blockers.push(copy.blockers.pendingVerification(pendingVerificationCount));
    if (input.summary.activeDaysLast30 < 6) blockers.push(copy.blockers.lowRhythm(input.summary.activeDaysLast30));

    type RankedReadinessAction = LearningReadiness['nextActions'][number];
    const rankedAction = (
      type: LearningReadinessActionType,
      href: string,
      expectedGain: number,
      reason: string,
      priority?: RankedReadinessAction['priority']
    ): RankedReadinessAction => {
      const baseExpectedGain = clampRange(Math.round(expectedGain), 1, 30);
      const calibration = input.calibration.get(type) ?? defaultReadinessActionCalibration();
      const calibratedExpectedGain = clampRange(Math.round(baseExpectedGain * calibration.multiplier), 1, 30);
      return {
        type,
        ...copy.actions[type],
        href,
        expectedGain: calibratedExpectedGain,
        baseExpectedGain,
        priority: priority ?? (calibratedExpectedGain >= 14 ? 'high' : calibratedExpectedGain >= 8 ? 'medium' : 'low'),
        reason,
        calibration
      };
    };
    const activeSubject = input.activeRound ? validSubject(input.activeRound.session.subject) : null;
    const firstUndiagnosed = DASHBOARD_SUBJECTS.find((subject) => !input.completedDiagnostics.has(subject.id));
    const readinessActions = (): LearningReadiness['nextActions'] => {
      const candidates: LearningReadiness['nextActions'] = [];
      const needsReviewRepair = dueReviewCount > 0 || highPriorityPatternCount > 0 || pendingVerificationCount > 0 || reviewScore < 12;
      if (input.activeRound && activeSubject) {
        candidates.push(rankedAction(
          'continue_active_round',
          `/zh/csca-subjects/${activeSubject}/practice/rounds/${input.activeRound.id}`,
          needsReviewRepair ? 18 : 30,
          copy.actions.continue_active_round.body,
          needsReviewRepair ? 'medium' : 'high'
        ));
      }
      if (input.summary.totalAnswered < 20 || masteryAvg === null || firstUndiagnosed) {
        candidates.push(rankedAction('start_diagnostic', hrefForSubject(firstUndiagnosed?.id ?? weakestSubject?.subject ?? 'math'), 28, copy.actions.start_diagnostic.body, 'high'));
      }
      if (needsReviewRepair) {
        const reviewGap = Math.max(0, 12 - reviewScore);
        candidates.push(rankedAction(
          'review_due_patterns',
          '/zh/me?section=practice&due=1#wrong-bank',
          12 + dueReviewCount * 7 + highPriorityPatternCount * 6 + pendingVerificationCount * 8 + reviewGap + Math.min(4, activePatternCount),
          copy.actions.review_due_patterns.body,
          'high'
        ));
      }
      if (latestMock && latestMock.unansweredCount >= 8) {
        candidates.push(rankedAction('resume_mock_attempt', '/zh/csca-mock-exam', 14 + Math.min(8, latestMock.unansweredCount - 7), copy.actions.resume_mock_attempt.body));
      }
      if (!latestMock) {
        candidates.push(rankedAction('start_mock_exam', '/zh/csca-mock-exam', input.summary.totalAnswered >= 40 ? 16 : 10, copy.actions.start_mock_exam.body));
      }
      if (weakestSubject && (weakestSubject.masteryAvg === null || weakestSubject.masteryAvg < 72 || weakestSubject.weakTopicCount > 0)) {
        const masteryGap = weakestSubject.masteryAvg === null ? 18 : Math.max(0, 72 - weakestSubject.masteryAvg);
        candidates.push(rankedAction('repair_weak_subject', weakestSubject.href, 8 + Math.min(12, masteryGap) + Math.min(5, weakestSubject.weakTopicCount), copy.actions.repair_weak_subject.body));
      }
      candidates.push(rankedAction('keep_training', input.nextAction?.href ?? weakestSubject?.href ?? '/zh/csca-subjects/math', score >= 78 ? 8 : 5, copy.actions.keep_training.body, score >= 78 ? 'medium' : 'low'));
      const seen = new Set<string>();
      return candidates
        .sort((a, b) => b.expectedGain - a.expectedGain || a.type.localeCompare(b.type))
        .filter((action) => {
          const key = `${action.type}:${action.href}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .slice(0, 3);
    };

    let stage: LearningReadinessStage = 'building';
    if (input.summary.totalAnswered < 20 || masteryAvg === null || trainedSubjects.length < 2 || coverageRate === null) {
      stage = 'diagnosing';
    } else if (
      score >= 78
      && coverageScore >= 14
      && masteryScore >= 20
      && mockScore >= 17
      && reviewScore >= 13
      && rhythmScore >= 6
      && evidenceScore >= 8
      && hasExamReadyHighDifficultyEvidence
      && (highDifficultyAccuracy ?? 0) >= 70
      && lowDifficultyAdjustedTopicCount === 0
      && pendingVerificationCount === 0
    ) {
      stage = 'exam_ready';
    } else if (score >= 65 && coverageScore >= 10 && masteryScore >= 16 && mockScore >= 14 && reviewScore >= 10 && evidenceScore >= 5) {
      stage = 'reinforcing';
    } else if (dueReviewCount > 0 || highPriorityPatternCount > 0 || pendingVerificationCount > 0 || reviewScore < 12) {
      stage = 'repairing';
    }

    const confidence = (() => {
      if (evidenceScore < 5 || highDifficultyAttemptCount < 3 || highDifficultySubjectReadyCount === 0) return 'low' as const;
      if (evidenceScore >= 8 && input.summary.totalAnswered >= 80 && masterySubjects.length === 3 && latestMock && input.summary.activeDaysLast30 >= 6 && coverageRate !== null && coverageRate >= 70 && hasExamReadyHighDifficultyEvidence && lowDifficultyAdjustedTopicCount === 0) {
        return 'high' as const;
      }
      return 'medium' as const;
    })();
    const confidenceReason = (() => {
      if (input.summary.totalAnswered < 40) return copy.confidenceReasons.lowVolume;
      if (masterySubjects.length < 2) return copy.confidenceReasons.insufficientSubjects;
      if (!latestMock) return copy.confidenceReasons.missingMock;
      if (coverageRate === null || coverageRate < 45) return copy.blockers.coverageInsufficient;
      if (highDifficultyAttemptCount < 3 || highDifficultySubjectReadyCount === 0) return copy.blockers.highDifficultyInsufficient;
      return copy.confidenceReasons[confidence];
    })();

    const nextActions = readinessActions();
    return {
      score,
      confidence,
      confidenceReason,
      scoreExplanation: copy.scoreExplanation,
      stage,
      title: copy.stages[stage],
      body: copy.bodies[stage],
      dimensions,
      coverage: input.coverage,
      difficulty: input.difficulty,
      blockers: [...new Set(blockers)].slice(0, 4),
      nextMilestone: copy.milestones[stage],
      nextAction: nextActions[0],
      nextActions,
      actionOutcome: {
        windowDays: 14,
        clickedCount: 0,
        followedCount: 0,
        followThroughRate: 0,
        abilityLiftCount: 0,
        abilityLiftRate: 0,
        averageMasteryDelta: null,
        averageExpectedGain: null,
        averageScoreDelta: null,
        topActionType: null,
        lastClickedAt: null,
        status: 'no_data'
      }
    };
  }

  private async readinessActionOutcome(userId: number, currentScore: number): Promise<LearningReadiness['actionOutcome']> {
    const windowDays = 14;
    const now = new Date();
    const since = new Date(now.getTime() - windowDays * DAY_MS);
    const clicks = await this.prisma.cscaTrainingEvent.findMany({
      where: {
        userId,
        eventType: 'readiness_action_clicked',
        createdAt: { gte: since }
      },
      orderBy: { createdAt: 'asc' },
      take: 50
    });

    if (!clicks.length) {
      return {
        windowDays,
        clickedCount: 0,
        followedCount: 0,
        followThroughRate: 0,
        abilityLiftCount: 0,
        abilityLiftRate: 0,
        averageMasteryDelta: null,
        averageExpectedGain: null,
        averageScoreDelta: null,
        topActionType: null,
        lastClickedAt: null,
        status: 'no_data'
      };
    }

    const earliestClick = clicks[0].createdAt;
    const mockLookbackStart = new Date(earliestClick.getTime() - 30 * DAY_MS);
    const [roundEvents, mockAttempts, wrongPatterns, masteryRows] = await Promise.all([
      this.prisma.cscaTrainingEvent.findMany({
        where: {
          userId,
          eventType: {
            in: [
              'diagnostic_round_started',
              'diagnostic_round_completed',
              'practice_round_started',
              'practice_round_completed'
            ]
          },
          createdAt: { gte: earliestClick }
        },
        orderBy: { createdAt: 'asc' },
        take: 100
      }),
      this.prisma.mockExamAttempt.findMany({
        where: {
          userId,
          submittedAt: { not: null, gte: mockLookbackStart }
        },
        select: { submittedAt: true, score: true },
        orderBy: [{ submittedAt: 'asc' }, { id: 'asc' }],
        take: 30
      }),
      this.prisma.cscaWrongPattern.findMany({
        where: {
          userId,
          updatedAt: { gte: earliestClick }
        },
        select: { metadata: true, lastCorrectAt: true, updatedAt: true },
        orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
        take: 50
      }),
      this.prisma.userCscaTopicMastery.findMany({
        where: {
          userId,
          updatedAt: { gte: earliestClick }
        },
        select: { topicId: true, updatedAt: true, mastery: true, confidence: true },
        orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
        take: 100
      })
    ]);

    const reviewTimes = wrongPatterns.flatMap((pattern) => {
      const metadata = jsonRecord(pattern.metadata);
      return [
        dateFromUnknown(metadata.lastReviewCompletedAt),
        pattern.lastCorrectAt
      ].filter((date): date is Date => Boolean(date));
    });
    const mockTimes = mockAttempts.map((attempt) => attempt.submittedAt).filter((date): date is Date => Boolean(date));
    const followedClicks = clicks.filter((click) => {
      const actionType = metadataString(click.metadata, 'actionType') as LearningReadinessActionType;
      const deadline = new Date(click.createdAt.getTime() + DAY_MS);
      if (actionType === 'review_due_patterns') {
        return reviewTimes.some((date) => dateInWindow(date, click.createdAt, deadline));
      }
      if (actionType === 'start_mock_exam' || actionType === 'resume_mock_attempt') {
        return mockTimes.some((date) => dateInWindow(date, click.createdAt, deadline));
      }
      const expectedEvents = actionType === 'start_diagnostic'
        ? ['diagnostic_round_started', 'diagnostic_round_completed']
        : ['practice_round_started', 'practice_round_completed'];
      return roundEvents.some((event) => expectedEvents.includes(event.eventType) && dateInWindow(event.createdAt, click.createdAt, deadline));
    });
    const expectedGains = clicks.map((click) => metadataNumber(click.metadata, 'expectedGain')).filter((value): value is number => value !== null);
    const clickedScores = clicks.map((click) => metadataNumber(click.metadata, 'score')).filter((value): value is number => value !== null);
    const actionCounts = new Map<LearningReadinessActionType, number>();
    for (const click of clicks) {
      const type = metadataString(click.metadata, 'actionType') as LearningReadinessActionType;
      if (type) actionCounts.set(type, (actionCounts.get(type) ?? 0) + 1);
    }
    const topActionType = Array.from(actionCounts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null;
    const clickedCount = clicks.length;
    const followedCount = followedClicks.length;
    const followThroughRate = Number((followedCount / clickedCount).toFixed(4));
    const actionLifts = clicks.map((click) => {
      const actionType = metadataString(click.metadata, 'actionType') as LearningReadinessActionType;
      if (!actionType) return { lifted: false, masteryDelta: null };
      return readinessActionAbilityLift({
        actionType,
        clickedAt: click.createdAt,
        reviewTimes,
        masteryBaseline: readinessMasteryBaseline(click.metadata),
        masteryRows,
        mockAttempts
      });
    });
    const abilityLiftCount = actionLifts.filter((lift) => lift.lifted).length;
    const abilityLiftRate = Number((abilityLiftCount / clickedCount).toFixed(4));
    const masteryDeltas = actionLifts.map((lift) => lift.masteryDelta).filter((value): value is number => value !== null);
    const averageMasteryDelta = masteryDeltas.length
      ? Number((masteryDeltas.reduce((sum, delta) => sum + delta, 0) / masteryDeltas.length).toFixed(4))
      : null;
    const averageScoreDelta = clickedScores.length
      ? Number((clickedScores.reduce((sum, score) => sum + (currentScore - score), 0) / clickedScores.length).toFixed(1))
      : null;
    const status = clickedCount < 2
      ? 'watching'
      : abilityLiftRate >= 0.34 || (followedCount > 0 && (averageScoreDelta === null || averageScoreDelta >= 0))
        ? 'positive'
        : followThroughRate < 0.34 || abilityLiftRate < 0.15
          ? 'needs_calibration'
          : 'watching';

    return {
      windowDays,
      clickedCount,
      followedCount,
      followThroughRate,
      abilityLiftCount,
      abilityLiftRate,
      averageMasteryDelta,
      averageExpectedGain: expectedGains.length ? Math.round(expectedGains.reduce((sum, gain) => sum + gain, 0) / expectedGains.length) : null,
      averageScoreDelta,
      topActionType,
      lastClickedAt: clicks[clicks.length - 1].createdAt.toISOString(),
      status
    };
  }

  private async readinessActionCalibration(): Promise<Map<LearningReadinessActionType, ReadinessActionCalibration>> {
    const snapshotCalibration = await this.latestReadinessActionCalibrationSnapshots();
    if (snapshotCalibration.size > 0) return snapshotCalibration;

    const { calibration } = await this.computeReadinessActionCalibration();
    return calibration;
  }

  async refreshReadinessActionCalibrationSnapshots(
    source: 'admin_manual' | 'scheduled' = 'admin_manual'
  ): Promise<ReadinessActionCalibrationSnapshotRefreshResult> {
    const { snapshots } = await this.computeReadinessActionCalibration();
    await this.persistReadinessActionCalibrationSnapshots(snapshots, source);
    const snapshotDate = localDateStart(new Date()).toISOString();
    const clickedCount = snapshots.reduce((sum, snapshot) => sum + snapshot.clickedCount, 0);
    const followedCount = snapshots.reduce((sum, snapshot) => sum + snapshot.followedCount, 0);
    const abilityLiftCount = snapshots.reduce((sum, snapshot) => sum + snapshot.abilityLiftCount, 0);

    return {
      snapshotDate,
      windowDays: 30,
      actionTypes: snapshots.length,
      clickedCount,
      followedCount,
      abilityLiftCount,
      source,
      items: snapshots.map((snapshot) => ({
        actionType: snapshot.actionType,
        clickedCount: snapshot.clickedCount,
        followedCount: snapshot.followedCount,
        abilityLiftCount: snapshot.abilityLiftCount,
        followThroughRate: snapshot.calibration.followThroughRate,
        abilityLiftRate: snapshot.calibration.abilityLiftRate,
        averageMasteryDelta: snapshot.calibration.averageMasteryDelta,
        multiplier: snapshot.calibration.multiplier,
        status: snapshot.calibration.status
      }))
    };
  }

  private readinessActionCalibrationSnapshotModel() {
    return (this.prisma as unknown as {
      cscaReadinessActionCalibrationSnapshot?: {
        findMany: (args: unknown) => Promise<Array<{
          snapshotDate: Date;
          actionType: string;
          clickedCount: number;
          followThroughRate: number | null;
          abilityLiftRate: number | null;
          averageMasteryDelta: number | null;
          multiplier: number;
          status: string;
        }>>;
        upsert: (args: unknown) => Promise<unknown>;
      };
    }).cscaReadinessActionCalibrationSnapshot;
  }

  private async latestReadinessActionCalibrationSnapshots(): Promise<Map<LearningReadinessActionType, ReadinessActionCalibration>> {
    const model = this.readinessActionCalibrationSnapshotModel();
    if (!model) return new Map();
    const today = localDateStart(new Date());
    const since = addLocalDays(today, -2);
    try {
      const rows = await model.findMany({
        where: { snapshotDate: { gte: since, lte: today } },
        orderBy: [{ snapshotDate: 'desc' }, { id: 'desc' }],
        take: 100
      });
      const result = new Map<LearningReadinessActionType, ReadinessActionCalibration>();
      for (const row of rows) {
        const actionType = row.actionType as LearningReadinessActionType;
        if (!actionType || result.has(actionType)) continue;
        const status = ['insufficient', 'positive', 'neutral', 'needs_calibration'].includes(row.status)
          ? row.status as ReadinessActionCalibration['status']
          : 'insufficient';
        result.set(actionType, {
          multiplier: Number.isFinite(row.multiplier) ? row.multiplier : 1,
          status,
          sampleSize: clampCount(row.clickedCount),
          followThroughRate: row.followThroughRate,
          abilityLiftRate: row.abilityLiftRate,
          averageMasteryDelta: row.averageMasteryDelta
        });
      }
      return result;
    } catch {
      return new Map();
    }
  }

  private async persistReadinessActionCalibrationSnapshots(
    snapshots: ReadinessActionCalibrationSnapshotInput[],
    source: 'admin_manual' | 'scheduled'
  ) {
    const model = this.readinessActionCalibrationSnapshotModel();
    if (!model || snapshots.length === 0) return;
    const snapshotDate = localDateStart(new Date());
    await Promise.all(snapshots.map(async (snapshot) => {
      try {
        await model.upsert({
          where: {
            snapshotDate_actionType: {
              snapshotDate,
              actionType: snapshot.actionType
            }
          },
          create: {
            snapshotDate,
            actionType: snapshot.actionType,
            windowDays: 30,
            clickedCount: snapshot.clickedCount,
            followedCount: snapshot.followedCount,
            abilityLiftCount: snapshot.abilityLiftCount,
            followThroughRate: snapshot.calibration.followThroughRate,
            abilityLiftRate: snapshot.calibration.abilityLiftRate,
            averageMasteryDelta: snapshot.calibration.averageMasteryDelta,
            multiplier: snapshot.calibration.multiplier,
            status: snapshot.calibration.status,
            metadata: { source }
          },
          update: {
            clickedCount: snapshot.clickedCount,
            followedCount: snapshot.followedCount,
            abilityLiftCount: snapshot.abilityLiftCount,
            followThroughRate: snapshot.calibration.followThroughRate,
            abilityLiftRate: snapshot.calibration.abilityLiftRate,
            averageMasteryDelta: snapshot.calibration.averageMasteryDelta,
            multiplier: snapshot.calibration.multiplier,
            status: snapshot.calibration.status,
            metadata: { source }
          }
        });
      } catch {
        // Snapshot persistence should never block the dashboard.
      }
    }));
  }

  private async computeReadinessActionCalibration(): Promise<{
    calibration: Map<LearningReadinessActionType, ReadinessActionCalibration>;
    snapshots: ReadinessActionCalibrationSnapshotInput[];
  }> {
    const now = new Date();
    const since = new Date(now.getTime() - 30 * DAY_MS);
    const mockLookbackStart = new Date(since.getTime() - 30 * DAY_MS);
    const clicks = await this.prisma.cscaTrainingEvent.findMany({
      where: {
        eventType: 'readiness_action_clicked',
        createdAt: { gte: since }
      },
      orderBy: { createdAt: 'asc' },
      take: 500
    });
    const result = new Map<LearningReadinessActionType, ReadinessActionCalibration>();
    const snapshots: ReadinessActionCalibrationSnapshotInput[] = [];
    if (!clicks.length) return { calibration: result, snapshots };

    const userIds = Array.from(new Set(clicks.map((click) => click.userId).filter((value): value is number => typeof value === 'number')));
    const [roundEvents, mockAttempts, wrongPatterns, masteryRows] = await Promise.all([
      this.prisma.cscaTrainingEvent.findMany({
        where: {
          userId: { in: userIds },
          eventType: {
            in: [
              'diagnostic_round_started',
              'diagnostic_round_completed',
              'practice_round_started',
              'practice_round_completed'
            ]
          },
          createdAt: { gte: since }
        },
        orderBy: { createdAt: 'asc' },
        take: 1000
      }),
      this.prisma.mockExamAttempt.findMany({
        where: {
          userId: { in: userIds },
          submittedAt: { not: null, gte: mockLookbackStart }
        },
        select: { userId: true, submittedAt: true, score: true },
        orderBy: [{ submittedAt: 'asc' }, { id: 'asc' }],
        take: 300
      }),
      this.prisma.cscaWrongPattern.findMany({
        where: {
          userId: { in: userIds },
          updatedAt: { gte: since }
        },
        select: { userId: true, metadata: true, lastCorrectAt: true, updatedAt: true },
        orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
        take: 500
      }),
      this.prisma.userCscaTopicMastery.findMany({
        where: {
          userId: { in: userIds },
          updatedAt: { gte: since }
        },
        select: { userId: true, topicId: true, updatedAt: true, mastery: true, confidence: true },
        orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
        take: 1000
      })
    ]);

    const mockTimesByUser = new Map<number, Date[]>();
    const mockAttemptsByUser = new Map<number, Array<{ submittedAt: Date | null; score: number | null }>>();
    for (const attempt of mockAttempts) {
      if (typeof attempt.userId !== 'number' || !attempt.submittedAt) continue;
      const list = mockTimesByUser.get(attempt.userId) ?? [];
      list.push(attempt.submittedAt);
      mockTimesByUser.set(attempt.userId, list);
      const attempts = mockAttemptsByUser.get(attempt.userId) ?? [];
      attempts.push({ submittedAt: attempt.submittedAt, score: attempt.score });
      mockAttemptsByUser.set(attempt.userId, attempts);
    }
    const reviewTimesByUser = new Map<number, Date[]>();
    for (const pattern of wrongPatterns) {
      if (typeof pattern.userId !== 'number') continue;
      const metadata = jsonRecord(pattern.metadata);
      const dates = [
        dateFromUnknown(metadata.lastReviewCompletedAt),
        pattern.lastCorrectAt
      ].filter((date): date is Date => Boolean(date));
      if (!dates.length) continue;
      const list = reviewTimesByUser.get(pattern.userId) ?? [];
      list.push(...dates);
      reviewTimesByUser.set(pattern.userId, list);
    }
    const masteryRowsByUser = new Map<number, Array<{ topicId: number; updatedAt: Date; mastery: number; confidence: number }>>();
    for (const row of masteryRows) {
      if (typeof row.userId !== 'number') continue;
      const list = masteryRowsByUser.get(row.userId) ?? [];
      list.push({ topicId: row.topicId, updatedAt: row.updatedAt, mastery: row.mastery, confidence: row.confidence });
      masteryRowsByUser.set(row.userId, list);
    }

    const buckets = new Map<LearningReadinessActionType, { clicked: number; followed: number; lifted: number; masteryDeltas: number[] }>();
    for (const click of clicks) {
      const actionType = metadataString(click.metadata, 'actionType') as LearningReadinessActionType;
      if (!actionType) continue;
      const userId = typeof click.userId === 'number' ? click.userId : null;
      const deadline = new Date(click.createdAt.getTime() + DAY_MS);
      const followed = (() => {
        if (userId === null) return false;
        if (actionType === 'review_due_patterns') {
          return (reviewTimesByUser.get(userId) ?? []).some((date) => dateInWindow(date, click.createdAt, deadline));
        }
        if (actionType === 'start_mock_exam' || actionType === 'resume_mock_attempt') {
          return (mockTimesByUser.get(userId) ?? []).some((date) => dateInWindow(date, click.createdAt, deadline));
        }
        const expectedEvents = actionType === 'start_diagnostic'
          ? ['diagnostic_round_started', 'diagnostic_round_completed']
          : ['practice_round_started', 'practice_round_completed'];
        return roundEvents.some((event) => (
          event.userId === userId
          && expectedEvents.includes(event.eventType)
          && dateInWindow(event.createdAt, click.createdAt, deadline)
        ));
      })();
      const lift = userId === null ? { lifted: false, masteryDelta: null } : readinessActionAbilityLift({
        actionType,
        clickedAt: click.createdAt,
        reviewTimes: reviewTimesByUser.get(userId) ?? [],
        masteryBaseline: readinessMasteryBaseline(click.metadata),
        masteryRows: masteryRowsByUser.get(userId) ?? [],
        mockAttempts: mockAttemptsByUser.get(userId) ?? []
      });
      const bucket = buckets.get(actionType) ?? { clicked: 0, followed: 0, lifted: 0, masteryDeltas: [] };
      bucket.clicked += 1;
      if (followed) bucket.followed += 1;
      if (lift.lifted) bucket.lifted += 1;
      if (lift.masteryDelta !== null) bucket.masteryDeltas.push(lift.masteryDelta);
      buckets.set(actionType, bucket);
    }

    for (const [type, bucket] of buckets) {
      if (bucket.clicked < 5) {
        result.set(type, {
          ...defaultReadinessActionCalibration(),
          sampleSize: bucket.clicked,
          followThroughRate: bucket.clicked ? Number((bucket.followed / bucket.clicked).toFixed(4)) : null,
          abilityLiftRate: bucket.clicked ? Number((bucket.lifted / bucket.clicked).toFixed(4)) : null,
          averageMasteryDelta: bucket.masteryDeltas.length
            ? Number((bucket.masteryDeltas.reduce((sum, delta) => sum + delta, 0) / bucket.masteryDeltas.length).toFixed(4))
            : null
        });
        snapshots.push({
          actionType: type,
          clickedCount: bucket.clicked,
          followedCount: bucket.followed,
          abilityLiftCount: bucket.lifted,
          masteryDeltas: bucket.masteryDeltas,
          calibration: result.get(type)!
        });
        continue;
      }
      const followThroughRate = Number((bucket.followed / bucket.clicked).toFixed(4));
      const abilityLiftRate = Number((bucket.lifted / bucket.clicked).toFixed(4));
      const averageMasteryDelta = bucket.masteryDeltas.length
        ? Number((bucket.masteryDeltas.reduce((sum, delta) => sum + delta, 0) / bucket.masteryDeltas.length).toFixed(4))
        : null;
      const status: ReadinessActionCalibration['status'] = abilityLiftRate >= 0.35 || (followThroughRate >= 0.55 && abilityLiftRate >= 0.2)
        ? 'positive'
        : abilityLiftRate < 0.15 || followThroughRate < 0.25
          ? 'needs_calibration'
          : 'neutral';
      const multiplier = status === 'positive'
        ? 1.12 + Math.min(0.08, abilityLiftRate * 0.12)
        : status === 'needs_calibration'
          ? 0.82
          : abilityLiftRate >= 0.25 || followThroughRate >= 0.4
            ? 1.04
            : 0.94;
      result.set(type, {
        multiplier: Number(multiplier.toFixed(2)),
        status,
        sampleSize: bucket.clicked,
        followThroughRate,
        abilityLiftRate,
        averageMasteryDelta
      });
      snapshots.push({
        actionType: type,
        clickedCount: bucket.clicked,
        followedCount: bucket.followed,
        abilityLiftCount: bucket.lifted,
        masteryDeltas: bucket.masteryDeltas,
        calibration: result.get(type)!
      });
    }

    return { calibration: result, snapshots };
  }

  private async mockTrend(userId: number, language: LearningDashboardLanguage): Promise<LearningDashboardResponse['mockTrend']> {
    const copy = dashboardCopy(language);
    const attempts = await this.prisma.mockExamAttempt.findMany({
      where: { userId, submittedAt: { not: null } },
      include: { paper: { select: { subject: true, questionCount: true } } },
      orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
      take: 6
    });
    const rows = attempts.flatMap((attempt) => {
      const subject = validSubject(attempt.paper.subject);
      if (!subject) return [];
      const correctCount = clampCount(attempt.correctCount ?? 0);
      const wrongCount = clampCount(attempt.wrongCount ?? 0);
      const unansweredCount = clampCount(attempt.unansweredCount ?? 0);
      const answeredCount = correctCount + wrongCount;
      const total = Math.max(1, correctCount + wrongCount + unansweredCount, clampCount(attempt.paper.questionCount));
      const score = clampCount(attempt.score ?? Math.round((correctCount / total) * 100));
      return [{
        id: attempt.id,
        subject,
        subjectLabel: subjectLabel(subject, language),
        score,
        accuracy: accuracy(correctCount, answeredCount),
        correctCount,
        wrongCount,
        unansweredCount,
        total,
        totalSeconds: secondsFromJsonMap(attempt.timeSpent),
        submittedAt: attempt.submittedAt?.toISOString() ?? null,
        reportHref: `/zh/csca-mock-exam/attempts/${attempt.id}/report`
      }];
    });
    const latest = rows[0] ?? null;
    const recent = [...rows].reverse().map((row) => ({
      id: row.id,
      subject: row.subject,
      subjectLabel: row.subjectLabel,
      score: row.score,
      accuracy: row.accuracy,
      unansweredCount: row.unansweredCount,
      totalSeconds: row.totalSeconds,
      submittedAt: row.submittedAt
    }));
    const grouped = new Map<CscaLearningSubject, typeof rows>();
    for (const row of rows) {
      grouped.set(row.subject, [...(grouped.get(row.subject) ?? []), row]);
    }
    const subjectStats = [...grouped.entries()].map(([subject, subjectRows]) => {
      const latestSubject = subjectRows[0];
      return {
        subject,
        subjectLabel: subjectLabel(subject, language),
        attemptCount: subjectRows.length,
        averageScore: Math.round(subjectRows.reduce((sum, row) => sum + row.score, 0) / subjectRows.length),
        latestScore: latestSubject.score,
        unansweredCount: subjectRows.reduce((sum, row) => sum + row.unansweredCount, 0),
        href: hrefForSubject(subject)
      };
    }).sort((a, b) => a.averageScore - b.averageScore || b.unansweredCount - a.unansweredCount);

    const weakest = subjectStats[0] ?? null;
    const nextAction = latest && weakest
      ? {
        title: copy.mockNextTitle(weakest.subjectLabel),
        body: copy.mockNextBody({ score: latest.score, wrongCount: latest.wrongCount, unansweredCount: latest.unansweredCount }),
        ctaLabel: copy.enterSubjectTraining,
        href: weakest.href
      }
      : null;

    return { latest, recent, subjectStats, nextAction };
  }

  private async subjectCardsFromSnapshots(userId: number, snapshots: SubjectSnapshotLike[], language: LearningDashboardLanguage): Promise<LearningDashboardSubject[]> {
    return Promise.all(DASHBOARD_SUBJECTS.map(async (subject) => {
      const [snapshotRows, masteryRows] = await Promise.all([
        Promise.resolve(snapshots.filter((snapshot) => snapshot.subject === subject.id)),
        this.prisma.userCscaTopicMastery.findMany({
          where: { userId, subject: subject.id },
          select: { mastery: true }
        })
      ]);
      const answeredCount = snapshotRows.reduce((sum, row) => sum + row.answeredCount, 0);
      const correctCount = snapshotRows.reduce((sum, row) => sum + row.correctCount, 0);
      const masteryAvg = masteryRows.length
        ? Math.round((masteryRows.reduce((sum, row) => sum + row.mastery, 0) / masteryRows.length) * 100)
        : null;
      return {
        subject: subject.id,
        label: subjectLabel(subject.id, language),
        masteryAvg,
        answeredCount,
        accuracy: accuracy(correctCount, answeredCount),
        weakTopicCount: masteryRows.filter((row) => row.mastery < 0.55).length,
        href: hrefForSubject(subject.id)
      };
    }));
  }

  private async historicalDashboardFallback(userId: number, heatmapStart: Date, trendStart: Date, language: LearningDashboardLanguage) {
    const [rounds, mockAttempts] = await Promise.all([
      this.prisma.cscaAdaptiveRound.findMany({
        where: {
          submittedAt: { not: null },
          session: { userId }
        },
        select: {
          submittedAt: true,
          correctCount: true,
          wrongCount: true,
          unansweredCount: true,
          items: { select: { timeSpentSeconds: true } },
          session: { select: { subject: true, mode: true } }
        }
      }),
      this.prisma.mockExamAttempt.findMany({
        where: { userId, submittedAt: { not: null } },
        select: {
          submittedAt: true,
          correctCount: true,
          wrongCount: true,
          unansweredCount: true,
          timeSpent: true,
          paper: { select: { subject: true } }
        }
      })
    ]);

    const allSnapshots = new Map<string, SnapshotLike>();
    const subjectSnapshots = new Map<string, SubjectSnapshotLike>();
    const addSnapshot = (input: {
      subject: CscaLearningSubject;
      occurredAt: Date;
      activeScore: number;
      answeredCount: number;
      correctCount: number;
      wrongCount: number;
      unansweredCount: number;
      practiceSeconds: number;
      mockSeconds: number;
    }) => {
      const localDate = localDateStart(input.occurredAt);
      const localKey = localDateKey(localDate);
      const isStreakEligible = input.activeScore >= 40;
      const apply = <T extends SnapshotLike>(map: Map<string, T>, key: string, create: () => T) => {
        const existing = map.get(key);
        if (existing) {
          existing.activeScore += input.activeScore;
          existing.answeredCount += input.answeredCount;
          existing.correctCount += input.correctCount;
          existing.wrongCount += input.wrongCount;
          existing.unansweredCount += input.unansweredCount;
          existing.practiceSeconds += input.practiceSeconds;
          existing.mockSeconds += input.mockSeconds;
          existing.isStreakEligible ||= isStreakEligible;
          return;
        }
        map.set(key, create());
      };

      apply(allSnapshots, localKey, () => ({
        localDate,
        activeScore: input.activeScore,
        answeredCount: input.answeredCount,
        correctCount: input.correctCount,
        wrongCount: input.wrongCount,
        unansweredCount: input.unansweredCount,
        practiceSeconds: input.practiceSeconds,
        mockSeconds: input.mockSeconds,
        aiInteractionCount: 0,
        isStreakEligible
      }));
      apply(subjectSnapshots, `${localKey}:${input.subject}`, () => ({
        localDate,
        subject: input.subject,
        activeScore: input.activeScore,
        answeredCount: input.answeredCount,
        correctCount: input.correctCount,
        wrongCount: input.wrongCount,
        unansweredCount: input.unansweredCount,
        practiceSeconds: input.practiceSeconds,
        mockSeconds: input.mockSeconds,
        aiInteractionCount: 0,
        isStreakEligible
      }));
    };

    for (const round of rounds) {
      if (!round.submittedAt) continue;
      const subject = validSubject(round.session.subject);
      if (!subject) continue;
      const source: RecordLearningActivityInput['source'] = round.session.mode === 'diagnostic' ? 'adaptive_diagnostic' : 'adaptive_practice';
      addSnapshot({
        subject,
        occurredAt: round.submittedAt,
        activeScore: activeScoreFor({
          userId,
          subject,
          source,
          answeredCount: 0,
          correctCount: 0,
          wrongCount: 0,
          unansweredCount: 0
        }),
        answeredCount: clampCount(round.correctCount + round.wrongCount),
        correctCount: clampCount(round.correctCount),
        wrongCount: clampCount(round.wrongCount),
        unansweredCount: clampCount(round.unansweredCount),
        practiceSeconds: round.items.reduce((sum, item) => sum + clampSeconds(item.timeSpentSeconds), 0),
        mockSeconds: 0
      });
    }

    for (const attempt of mockAttempts) {
      if (!attempt.submittedAt) continue;
      const subject = validSubject(attempt.paper.subject);
      if (!subject) continue;
      addSnapshot({
        subject,
        occurredAt: attempt.submittedAt,
        activeScore: activeScoreFor({
          userId,
          subject,
          source: 'mock_exam',
          answeredCount: 0,
          correctCount: 0,
          wrongCount: 0,
          unansweredCount: 0
        }),
        answeredCount: clampCount((attempt.correctCount ?? 0) + (attempt.wrongCount ?? 0)),
        correctCount: clampCount(attempt.correctCount ?? 0),
        wrongCount: clampCount(attempt.wrongCount ?? 0),
        unansweredCount: clampCount(attempt.unansweredCount ?? 0),
        practiceSeconds: 0,
        mockSeconds: secondsFromJsonMap(attempt.timeSpent)
      });
    }

    const snapshots = [...allSnapshots.values()].sort((a, b) => a.localDate.getTime() - b.localDate.getTime());
    const recentSnapshots = snapshots.filter((snapshot) => snapshot.localDate >= heatmapStart);
    const recentSubjectSnapshots = [...subjectSnapshots.values()].filter((snapshot) => snapshot.localDate >= trendStart);
    const streak = this.streakFromSnapshots(snapshots);
    const totalAnswered = snapshots.reduce((sum, snapshot) => sum + snapshot.answeredCount, 0);
    const totalCorrect = snapshots.reduce((sum, snapshot) => sum + snapshot.correctCount, 0);

    return {
      snapshots: recentSnapshots,
      subjects: await this.subjectCardsFromSnapshots(userId, recentSubjectSnapshots, language),
      totalAnswered,
      totalCorrect,
      totalActiveDays: snapshots.filter((snapshot) => snapshot.isStreakEligible).length,
      currentStreakDays: streak.currentStreakDays,
      longestStreakDays: streak.longestStreakDays
    };
  }

  private streakFromSnapshots(snapshots: SnapshotLike[]) {
    const keys = [...new Set(snapshots.filter((snapshot) => snapshot.isStreakEligible).map((snapshot) => localDateKey(snapshot.localDate)))].sort();
    let longestStreakDays = 0;
    let currentRun = 0;
    let previous: Date | null = null;
    for (const key of keys) {
      const date = localDateStart(key);
      currentRun = previous && localDateKey(addLocalDays(previous, 1)) === key ? currentRun + 1 : 1;
      longestStreakDays = Math.max(longestStreakDays, currentRun);
      previous = date;
    }
    return { currentStreakDays: currentRun, longestStreakDays };
  }

  private async findActiveRound(userId: number) {
    return this.prisma.cscaAdaptiveRound.findFirst({
      where: {
        submittedAt: null,
        session: { userId, status: 'active' }
      },
      select: {
        id: true,
        session: { select: { subject: true, mode: true } }
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]
    });
  }

  private async completedDiagnosticSubjects(userId: number) {
    const rows = await this.prisma.cscaAdaptiveSession.findMany({
      where: {
        userId,
        mode: 'diagnostic',
        rounds: { some: { submittedAt: { not: null } } }
      },
      select: { subject: true },
      distinct: ['subject']
    });
    return new Set(rows.map((row) => row.subject).filter((subject): subject is CscaLearningSubject => Boolean(validSubject(subject))));
  }

  private async findLatestWeeklyInsight(userId: number, periodStart: Date, periodEnd: Date) {
    return this.prisma.cscaLearningInsight.findFirst({
      where: {
        userId,
        periodType: 'weekly',
        periodStart: { lte: periodEnd },
        periodEnd: { gte: periodStart },
        status: 'success'
      },
      orderBy: [{ periodEnd: 'desc' }, { id: 'desc' }]
    });
  }

  private aiInsightFor(input: {
    latestInsight: Awaited<ReturnType<CscaLearningService['findLatestWeeklyInsight']>>;
    subjects: LearningDashboardSubject[];
    totalAnswered: number;
    totalCorrect: number;
    activeDaysLast30: number;
    practiceMinutesThisWeek: number;
    language: LearningDashboardLanguage;
  }): LearningDashboardResponse['aiInsight'] {
    if (input.latestInsight && input.language === 'zh') {
      return {
        status: 'ready',
        summary: input.latestInsight.summary,
        actions: stringArrayFromJson(input.latestInsight.recommendedActions),
        generatedAt: input.latestInsight.createdAt.toISOString(),
        provider: input.latestInsight.provider,
        model: input.latestInsight.model
      };
    }

    if (input.totalAnswered <= 0) {
      return {
        status: 'empty',
        summary: null,
        actions: [],
        generatedAt: null,
        provider: null,
        model: null
      };
    }

    const weakest = [...input.subjects].sort((a, b) => {
      const aScore = a.masteryAvg ?? a.accuracy ?? 0;
      const bScore = b.masteryAvg ?? b.accuracy ?? 0;
      return aScore - bScore;
    })[0];
    const userAccuracy = accuracy(input.totalCorrect, input.totalAnswered);
    const copy = dashboardCopy(input.language);
    const weakLabel = weakest?.label ?? copy.currentWeakSubject;

    return {
      status: 'fallback',
      summary: copy.recentSummary({ answered: input.totalAnswered, accuracy: userAccuracy }),
      actions: [
        copy.fallbackPace(input.practiceMinutesThisWeek),
        copy.fallbackActiveDays(input.activeDaysLast30),
        copy.fallbackWeak(weakLabel)
      ],
      generatedAt: null,
      provider: null,
      model: null
    };
  }

  private learningSummaryFor(insight: LearningDashboardResponse['aiInsight']): LearningDashboardResponse['learningSummary'] {
    return {
      status: insight.status === 'empty' ? 'empty' : 'ready',
      summary: insight.summary,
      actions: insight.actions,
      generatedAt: insight.generatedAt,
      source: insight.provider ? 'llm_polished' : 'rule_engine'
    };
  }

  private nextAction(input: {
    subjects: LearningDashboardSubject[];
    activeRound: Awaited<ReturnType<CscaLearningService['findActiveRound']>>;
    completedDiagnostics: Set<CscaLearningSubject>;
    totalAnswered: number;
    language: LearningDashboardLanguage;
  }): LearningDashboardResponse['nextAction'] {
    const copy = dashboardCopy(input.language);
    const activeSubject = input.activeRound ? validSubject(input.activeRound.session.subject) : null;
    if (input.activeRound && activeSubject) {
      const label = subjectLabel(activeSubject, input.language);
      return {
        title: copy.continueTitle(label),
        body: copy.continueBody,
        ctaLabel: copy.continueCta,
        href: `/zh/csca-subjects/${activeSubject}/practice/rounds/${input.activeRound.id}`
      };
    }

    const firstUndiagnosed = DASHBOARD_SUBJECTS.find((subject) => !input.completedDiagnostics.has(subject.id));
    if (firstUndiagnosed) {
      const label = subjectLabel(firstUndiagnosed.id, input.language);
      return {
        title: copy.diagnosticTitle(label),
        body: copy.diagnosticBody,
        ctaLabel: copy.diagnosticCta,
        href: hrefForSubject(firstUndiagnosed.id)
      };
    }

    if (input.totalAnswered === 0) {
      return {
        title: copy.firstDiagnosticTitle,
        body: copy.firstDiagnosticBody,
        ctaLabel: copy.diagnosticCta,
        href: hrefForSubject('math')
      };
    }

    const weakest = [...input.subjects].sort((a, b) => {
      const aScore = a.masteryAvg ?? a.accuracy ?? 0;
      const bScore = b.masteryAvg ?? b.accuracy ?? 0;
      return aScore - bScore;
    })[0];
    if (weakest) {
      return {
        title: copy.weakTitle(weakest.label),
        body: copy.weakBody,
        ctaLabel: copy.weakCta,
        href: weakest.href
      };
    }

    return {
      title: copy.mockTitle,
      body: copy.mockBody,
      ctaLabel: copy.mockCta,
      href: '/zh/csca-mock-exam'
    };
  }
}

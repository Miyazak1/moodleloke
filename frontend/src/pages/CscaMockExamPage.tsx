import { useEffect, useMemo, useRef, useState } from 'react';
import '../styles/mock-exam.css';
import '../styles/mock-exam-maturity.css';
import '../styles/mock-exam-subject.css';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Icon } from '../components/Icon';
import { MathContent } from '../components/MathContent';
import { GhostButton, InlineActions } from '../components/UiPrimitives';
import {
  CSCA_PRACTICE_MODULE_LABELS,
  CSCA_SUBJECT_COPY,
  cscaLocalizedResourceLabel,
  cscaSubjectLabel
} from '../content/localized/csca-subjects';
import { useI18n } from '../i18n/useI18n';
import {
  createMockExamAttempt,
  getAdaptivePracticeOverview,
  getMockExamAttempt,
  getMockExamOverview,
  getMockExamReport,
  getMockExamStart,
  getMockExamSubject,
  getMyMockExamAttempts,
  patchMockExamAttempt,
  submitMockExamAttempt,
  type AdaptiveSubjectSummary,
  type MockExamAttempt,
  type MockExamAttemptHistory,
  type MockExamAttemptDetail,
  type MockExamOverview,
  type MockExamPaper,
  type MockExamPaperRecommendation,
  type MockExamQuestion,
  type MockExamReport,
  type MockExamStart,
  type MockExamSubjectDetail,
  type User
} from '../lib/api';
import { getStoredToken } from '../lib/auth';
import { routes } from '../lib/routes';

function translatedSubjectLabel(subject: string, t: (key: string, fallback?: string) => string) {
  if (subject === 'math') return t('nav.math', cscaSubjectLabel(subject, 'zh-CN'));
  if (subject === 'physics') return t('nav.physics', cscaSubjectLabel(subject, 'zh-CN'));
  if (subject === 'chemistry') return t('nav.chemistry', cscaSubjectLabel(subject, 'zh-CN'));
  return cscaSubjectLabel(subject, 'zh-CN', subject);
}

function localizedSubjectLabel(subject: string, locale: string, t: (key: string, fallback?: string) => string) {
  if (locale === 'zh-CN') return translatedSubjectLabel(subject, t);
  return cscaSubjectLabel(subject, locale, translatedSubjectLabel(subject, t));
}

const CJK_TEXT_RE = /[\u3400-\u9fff]/;

function localizedMockSubjectDescription(subject: string, fallback: string | undefined, locale: string) {
  const fallbackText = fallback ?? '';
  if (locale === 'en' || locale === 'vi') {
    const copy = CSCA_SUBJECT_COPY[locale];
    return copy?.[subject as keyof typeof copy]?.body ?? fallbackText;
  }
  return fallbackText;
}

function localizedMockTag(tag: string, locale: string) {
  const localized = cscaLocalizedResourceLabel(CSCA_PRACTICE_MODULE_LABELS, tag, locale);
  if (locale === 'vi' && CJK_TEXT_RE.test(localized)) return 'Chủ đề trọng tâm';
  return localized;
}

function localizedMockPaperTitle(title: string, subjectLabel: string, index: number, locale: string, kind: 'mock' | 'past' = 'mock') {
  if (kind === 'mock' && locale === 'zh-CN' && /模拟卷/.test(title)) {
    return `CSCA ${subjectLabel}在线模考 ${index + 1}`;
  }
  if (locale === 'vi' && CJK_TEXT_RE.test(title)) {
    return kind === 'past' ? `Đề thật CSCA ${subjectLabel} ${index + 1}` : `Đề thi thử ${subjectLabel} ${index + 1}`;
  }
  return title;
}

function localizedMockPaperDescription(description: string | undefined, subjectLabel: string, questionCount: number, durationMinutes: number, locale: string) {
  const fallbackText = description ?? '';
  if (locale === 'vi' && CJK_TEXT_RE.test(fallbackText)) {
    return `Đề luyện CSCA môn ${subjectLabel}, ${questionCount} câu / ${durationMinutes} phút, có thể luyện miễn phí.`;
  }
  return fallbackText;
}

function cleanMockExamDisplayText(value: string, locale: string) {
  if (locale !== 'zh-CN') return value;
  return value
    .replace(/这套卷/g, '这次模考')
    .replace(/完整卷/g, '完整模考')
    .replace(/推荐卷/g, '推荐模考')
    .replace(/套卷/g, '模考')
    .replace(/模拟卷/g, '在线模考');
}

function localizedOverviewStat(stat: { label: string; detail: string; value: string }, index: number, locale: string) {
  if (locale !== 'vi' || (!CJK_TEXT_RE.test(stat.label) && !CJK_TEXT_RE.test(stat.detail))) return stat;
  const labels = ['Đề luyện', 'Mục tiêu chính xác', 'Môn học'];
  const details = [
    'Dùng đề miễn phí để làm quen luồng thi.',
    'Theo dõi độ chính xác và các điểm yếu.',
    'Toán, Vật lý và Hóa học.'
  ];
  return {
    ...stat,
    label: labels[index] ?? 'Chỉ số luyện tập',
    detail: details[index] ?? 'Dùng dữ liệu luyện tập để quyết định bước tiếp theo.'
  };
}

function localizedOverviewFeature(feature: string, index: number, locale: string) {
  if (locale !== 'vi' || !CJK_TEXT_RE.test(feature)) return feature;
  return ['Làm bài tính giờ', 'Tự động lưu', 'Đánh dấu xem lại', 'Báo cáo sau khi nộp'][index] ?? 'Tính năng thi thử';
}

function localizedCountdownLabel(label: string, examDate: string, locale: string) {
  if (locale === 'vi' && CJK_TEXT_RE.test(label)) return `Còn đến kỳ thi tiếp theo: ${examDate}`;
  return label;
}

function localizedMockRule(rule: string, index: number, locale: string) {
  if (locale !== 'vi' || !CJK_TEXT_RE.test(rule)) return rule;
  return [
    'Sau khi bắt đầu, làm bài theo đồng hồ đếm ngược.',
    'Sau khi nộp, có thể xem điểm, câu sai và lời giải.',
    'Đây là bài thi thử trực tuyến tự xây dựng, không đại diện cho nội dung thi chính thức.'
  ][index] ?? 'Hãy xác nhận quy định chính thức trước khi thi thật.';
}

function joinSubjectPhrase(subjectLabel: string, phrase: string, locale: string) {
  return locale === 'zh-CN' ? `${subjectLabel}${phrase}` : `${subjectLabel} ${phrase}`;
}

function localizedPaperLanguage(language: string, locale: string) {
  const normalized = String(language || '').toLowerCase();
  if (locale === 'en') {
    if (normalized === 'zh' || normalized === 'zh-cn' || normalized === 'chinese') return 'Chinese';
    if (normalized === 'en' || normalized === 'english') return 'English';
    return language;
  }
  if (locale === 'vi') {
    if (normalized === 'zh' || normalized === 'zh-cn' || normalized === 'chinese') return 'Tiếng Trung';
    if (normalized === 'en' || normalized === 'english') return 'Tiếng Anh';
    return language;
  }
  if (normalized === 'zh' || normalized === 'zh-cn' || normalized === 'chinese') return '中文';
  if (normalized === 'en' || normalized === 'english') return '英文';
  return language;
}

function localizedApiError(nextError: unknown, fallback: string, locale: string) {
  const message = (nextError as Error).message || fallback;
  return locale === 'en' && /[\u3400-\u9fff]/.test(message) ? fallback : message;
}

function routeParts(route: string) {
  const parts = route.split('/').filter(Boolean);
  if (parts[0] === 'zh' && parts[1] === 'mock-exam') return ['mock-exam', ...parts.slice(2)];
  if (parts[0] === 'csca-mock-exam') return ['mock-exam', ...parts.slice(1)];
  return parts;
}

function formatSeconds(seconds: number) {
  const minutes = Math.floor(Math.max(0, seconds) / 60);
  const rest = Math.max(0, seconds) % 60;
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

function subjectPath(subject: string) {
  return `${routes.cscaMockExam}/${subject}`;
}

function startPath(paper: MockExamPaper) {
  return `${routes.cscaMockExam}/${paper.subject}/${paper.slug}`;
}

function pastPaperPath(slug: string) {
  return `${routes.pastPapers}/${slug}`;
}

function attemptPath(id: number) {
  return `${routes.cscaMockExam}/attempts/${id}`;
}

function reportPath(id: number) {
  return `${routes.cscaMockExam}/attempts/${id}/report`;
}

type UiMockExamRecommendation = {
  label: string;
  title: string;
  body: string;
  actionLabel: string;
  path: string;
  paper?: MockExamPaper;
  scoreLabel: string;
  masteryLabel: string;
};

function formatMasteryLabel(subjectState: AdaptiveSubjectSummary | undefined) {
  if (!subjectState || subjectState.averageMastery === null || subjectState.averageMastery === undefined) return '未诊断';
  return `${Math.round(subjectState.averageMastery)}%`;
}

function buildMockExamRecommendation(
  subjectLabel: string,
  papers: MockExamPaper[],
  attempts: MockExamAttemptHistory[],
  subjectState: AdaptiveSubjectSummary | undefined
): UiMockExamRecommendation | null {
  const availablePapers = papers.filter((paper) => !paper.isLocked);
  const firstAvailable = availablePapers[0] ?? papers[0];
  if (!firstAvailable) return null;

  const latestAttempt = attempts[0];
  const activeAttempt = attempts.find((attempt) => !attempt.submittedAt);
  const attemptedSlugs = new Set(attempts.map((attempt) => attempt.paper.slug));
  const nextUnattempted = availablePapers.find((paper) => !attemptedSlugs.has(paper.slug));
  const recommendedPaper = nextUnattempted ?? firstAvailable;
  const masteryLabel = formatMasteryLabel(subjectState);
  const scoreLabel = latestAttempt?.score === null || latestAttempt?.score === undefined ? '暂无成绩' : `${latestAttempt.score} 分`;

  if (activeAttempt) {
    return {
      label: '未完成模考',
      title: `继续完成 ${activeAttempt.paper.title}`,
      body: `你有一套${subjectLabel}模考还没有交卷，先回到原进度，避免数据断层影响后续推荐。`,
      actionLabel: '继续作答',
      path: attemptPath(activeAttempt.id),
      paper: activeAttempt.paper,
      scoreLabel,
      masteryLabel
    };
  }

  if (!attempts.length) {
    return {
      label: '首轮诊断',
      title: `先做 ${recommendedPaper.title}`,
      body: `这次模考会作为${subjectLabel}整卷节奏的初始诊断，提交后再结合科目掌握度安排下一次。`,
      actionLabel: '开始推荐模考',
      path: startPath(recommendedPaper),
      paper: recommendedPaper,
      scoreLabel,
      masteryLabel
    };
  }

  if ((latestAttempt?.score ?? 100) < 60) {
    return {
      label: '优先补弱',
      title: `下一套建议：${recommendedPaper.title}`,
      body: `最近一次模考为 ${scoreLabel}。建议继续做一次完整模考，观察错题是否集中在同一类知识点。`,
      actionLabel: '按推荐继续',
      path: startPath(recommendedPaper),
      paper: recommendedPaper,
      scoreLabel,
      masteryLabel
    };
  }

  if (subjectState?.averageMastery !== null && subjectState?.averageMastery !== undefined && subjectState.averageMastery < 70) {
    return {
      label: '掌握度联动',
      title: `用 ${recommendedPaper.title} 验证薄弱点`,
      body: `当前科目掌握度 ${masteryLabel}。先用完整模考检验题型迁移，再回到科目训练补细节。`,
      actionLabel: '进入推荐模考',
      path: startPath(recommendedPaper),
      paper: recommendedPaper,
      scoreLabel,
      masteryLabel
    };
  }

  return {
    label: '保持节奏',
    title: `下一套建议：${recommendedPaper.title}`,
    body: `最近一次模考 ${scoreLabel}，科目掌握度 ${masteryLabel}。继续按整卷节奏训练时间分配和稳定性。`,
    actionLabel: '继续模考',
    path: startPath(recommendedPaper),
    paper: recommendedPaper,
    scoreLabel,
    masteryLabel
  };
}

function recommendationFromApi(recommendation: MockExamPaperRecommendation | null | undefined): UiMockExamRecommendation | null {
  if (!recommendation) return null;
  const path = recommendation.target.type === 'attempt'
    ? attemptPath(recommendation.target.attemptId)
    : `${routes.cscaMockExam}/${recommendation.paper?.subject ?? ''}/${recommendation.target.paperSlug}`;
  if (!path || path.includes('//')) return null;
  return {
    label: recommendation.label,
    title: recommendation.title,
    body: recommendation.body,
    actionLabel: recommendation.actionLabel,
    path,
    paper: recommendation.paper ?? undefined,
    scoreLabel: recommendation.scoreLabel,
    masteryLabel: recommendation.masteryLabel
  };
}

function LoadingState({ label }: { label?: string }) {
  const { t } = useI18n();
  return (
    <div className="page-stack brand-page mock-exam-page mock-loading-skeleton" aria-label={label ?? t('mockExam.loadingTitle', '正在加载模考内容')}>
      <section className="page-hero mock-exam-hero">
        <div>
          <span className="mock-skeleton-line short" />
          <span className="mock-skeleton-line hero-title" />
          <span className="mock-skeleton-line wide" />
        </div>
        <div className="mock-status-panel">
          <span className="mock-skeleton-line short" />
          <strong><span className="mock-skeleton-line title" /></strong>
          <p><span className="mock-skeleton-line medium" /></p>
        </div>
      </section>
      <section className="mock-subject-grid">
        {[0, 1, 2].map((item) => (
          <article key={item} className="mock-subject-card">
            <span className="mock-skeleton-line short" />
            <span className="mock-skeleton-line title" />
            <span className="mock-skeleton-line wide" />
            <div className="mock-chip-row">
              <span className="mock-skeleton-pill" />
              <span className="mock-skeleton-pill" />
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

function ErrorState({ message, onBack }: { message: string; onBack: () => void }) {
  const { t } = useI18n();
  return (
    <section className="school-empty-state">
      <h1>{t('mockExam.errorTitle', '暂时无法加载')}</h1>
      <p>{message}</p>
      <GhostButton onClick={onBack}>{t('mockExam.backHome', '返回模考首页')}</GhostButton>
    </section>
  );
}

function MockExamOverviewView({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { locale, t } = useI18n();
  const [overview, setOverview] = useState<MockExamOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void getMockExamOverview({ locale })
      .then((result) => { if (alive) setOverview(result); })
      .catch((nextError) => { if (alive) setError((nextError as Error).message || t('mockExam.unavailable', '模考入口暂时不可用。')); });
    return () => { alive = false; };
  }, [locale, t]);

  if (error) return <ErrorState message={error} onBack={() => onNavigate(routes.cscaPrep)} />;
  if (!overview) return <LoadingState label={t('mockExam.loadingTitle', '正在加载模考内容')} />;

  return (
    <div className="page-stack brand-page mock-exam-page">
      <section className="page-hero mock-exam-hero">
        <div>
          <p className="page-kicker">{t('mockExam.kicker', 'CSCA 在线模考')}</p>
          <h1>{t('mockExam.title', '用接近机考的流程，先测出薄弱点。')}</h1>
          <p className="page-body">{t('mockExam.body', '数学、物理、化学原创仿真模考已开放。先完成首套免费卷，熟悉限时作答、标记复查、交卷报告和逐题解析。')}</p>
        </div>
        <div className="mock-status-panel">
          <span>{t('mockExam.nextExam', '下一次考试')}</span>
          <strong>{overview.examDate}</strong>
          <p>{localizedCountdownLabel(overview.countdownLabel, overview.examDate, locale)}</p>
          <div>
            <Icon name="lucide:clock-3" color="8f3215" />
            <b>{t('mockExam.defaultPaperMeta', '48 题 / 60 分钟')}</b>
          </div>
        </div>
      </section>

      <section className="mock-subject-grid" aria-label={t('mockExam.subjectsAria', '模考科目')}>
        {overview.subjectCards.map((subject) => {
          const subjectLabel = localizedSubjectLabel(subject.id, locale, t);
          return (
            <article key={subject.id} className={`mock-subject-card accent-${subject.accent}`}>
              <span className="mock-card-label">{t('mockExam.freeFirst', '免费首套开放')}</span>
              <div className="mock-card-title">
                <span className="mock-card-icon"><Icon name="lucide:clipboard-check" color="315dff" /></span>
                <h2>{subjectLabel}</h2>
              </div>
              <p>{localizedMockSubjectDescription(subject.id, subject.description, locale)}</p>
              <div className="mock-chip-row">{subject.tags.slice(0, 3).map((tag) => <span key={tag}>{localizedMockTag(tag, locale)}</span>)}</div>
              <button type="button" onClick={() => onNavigate(subjectPath(subject.id))}>{t('mockExam.enterSubjectPrefix', '进入')}{subjectLabel}{t('mockExam.enterSubjectSuffix', '模考')}</button>
            </article>
          );
        })}
      </section>

      <section className="mock-stat-grid">
        {overview.stats.map((stat, index) => {
          const localizedStat = localizedOverviewStat(stat, index, locale);
          return (
          <article key={localizedStat.label}>
            <strong>{localizedStat.value}</strong>
            <span>{localizedStat.label}</span>
            <p>{localizedStat.detail}</p>
          </article>
          );
        })}
      </section>

      <section className="mock-feature-strip" aria-label={t('mockExam.featureStripAria', '模考能力')}>
        {overview.features.map((feature, index) => <span key={feature}>{localizedOverviewFeature(feature, index, locale)}</span>)}
      </section>

      <section className="mock-roadmap">
        <div>
          <p className="page-kicker">{t('mockExam.roadmapKicker', '90 天备考路线')}</p>
          <h2>{t('mockExam.roadmapTitle', '先测水平，再把练习压到真正失分点上。')}</h2>
        </div>
        <div className="mock-roadmap-grid">
          <article><strong>{t('mockExam.phaseBase', '基础学习期')}</strong><p>{t('mockExam.phaseBaseBody', '完成免费卷，定位高频薄弱知识点。')}</p></article>
          <article><strong>{t('mockExam.phaseDiagnostic', '模考诊断期')}</strong><p>{t('mockExam.phaseDiagnosticBody', '按科目套卷训练时间分配和题型稳定性。')}</p></article>
          <article><strong>{t('mockExam.phaseReview', '冲刺回顾期')}</strong><p>{t('mockExam.phaseReviewBody', '集中复盘错题、标记题和未答题。')}</p></article>
        </div>
      </section>
    </div>
  );
}

function SubjectPapersView({ subject, currentUser, isResolvingAuth, onNavigate }: { subject: string; currentUser: User | null; isResolvingAuth: boolean; onNavigate: (path: string) => void }) {
  const { locale, t } = useI18n();
  const currentUserId = currentUser?.id ?? null;
  const [detail, setDetail] = useState<MockExamSubjectDetail | null>(null);
  const [adaptiveSubject, setAdaptiveSubject] = useState<AdaptiveSubjectSummary | undefined>(undefined);
  const [attempts, setAttempts] = useState<MockExamAttemptHistory[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    if (isResolvingAuth) {
      setDetail(null);
      setAdaptiveSubject(undefined);
      setAttempts([]);
      setError(null);
      return () => {
        alive = false;
      };
    }
    const hasAuth = Boolean(currentUserId);
    setAdaptiveSubject(undefined);
    setAttempts([]);
    void getMockExamSubject(subject, { locale }, hasAuth)
      .catch((nextError) => hasAuth ? getMockExamSubject(subject, { locale }) : Promise.reject(nextError))
      .then((result) => { if (alive) setDetail(result); })
      .catch((nextError) => { if (alive) setError((nextError as Error).message || t('mockExam.subjectUnavailable', '科目模考暂时不可用。')); });
    void getAdaptivePracticeOverview(hasAuth)
      .then((result) => {
        if (alive) setAdaptiveSubject(result.subjects.find((item) => item.id === subject));
      })
      .catch(() => {
        if (alive) setAdaptiveSubject(undefined);
      });
    if (hasAuth) {
      void getMyMockExamAttempts()
        .then((result) => {
          if (alive) setAttempts(result.items.filter((item) => item.paper.subject === subject));
        })
        .catch(() => {
          if (alive) setAttempts([]);
        });
    }
    return () => { alive = false; };
  }, [subject, currentUserId, isResolvingAuth, locale, t]);

  if (error) return <ErrorState message={error} onBack={() => onNavigate(routes.cscaMockExam)} />;
  if (!detail) return <LoadingState label={t('mockExam.loadingSubject', '正在加载科目套卷')} />;

  const subjectLabel = localizedSubjectLabel(subject, locale, t);
  const subjectMockTitle = `CSCA ${joinSubjectPhrase(subjectLabel, t('mockExam.enterSubjectSuffix', '模考'), locale)}`;
  const fullPaperTitle = joinSubjectPhrase(subjectLabel, t('mockExam.fullPaper', '完整模考'), locale);
  const totalPapers = detail.papers.length;
  const firstPaper = detail.papers[0];
  const questionCount = firstPaper?.questionCount ?? 48;
  const durationMinutes = firstPaper?.durationMinutes ?? 60;
  const realStylePapers = detail.pastPapers.slice(0, 3);
  const subjectFocus = detail.subject.tags.slice(0, 4);
  const rawRecommendation = recommendationFromApi(detail.recommendation) ?? buildMockExamRecommendation(subjectLabel, detail.papers, attempts, adaptiveSubject);
  const recommendation = rawRecommendation ? {
    ...rawRecommendation,
    title: cleanMockExamDisplayText(rawRecommendation.title, locale),
    body: cleanMockExamDisplayText(rawRecommendation.body, locale),
    actionLabel: cleanMockExamDisplayText(rawRecommendation.actionLabel, locale)
  } : null;
  const recommendedPaperSlug = recommendation?.paper?.slug;

  return (
    <div className="page-stack brand-page mock-exam-page mock-subject-page">
      <section className="page-hero mock-subject-hero">
        <div>
          <p className="page-kicker">{subjectMockTitle}</p>
          <h1>{fullPaperTitle}</h1>
          <p className="page-body">{localizedMockSubjectDescription(subject, detail.subject.description, locale)} {t('mockExam.subjectBodySuffix', '全部发布套卷都已免费开放，适合按真实 CBT 流程练习限时作答、标记复查和报告复盘。')}</p>
        </div>
        <div className="mock-status-panel compact">
          <span>{t('mockExam.currentSubject', '当前科目')}</span>
          <strong>{subjectLabel}</strong>
          <div className="mock-chip-row">{detail.subject.tags.map((tag) => <span key={tag}>{localizedMockTag(tag, locale)}</span>)}</div>
        </div>
      </section>

      <section className="mock-subject-summary" aria-label={t('mockExam.subjectSummaryAria', '科目模考摘要')}>
        <article>
          <span>{t('mockExam.paperCount', '完整套卷')}</span>
          <strong>{totalPapers}</strong>
          <p>{t('mockExam.paperCountDetail', '全部可直接进入 CBT 流程')}</p>
        </article>
        <article>
          <span>{t('mockExam.paperSpec', '单套规格')}</span>
          <strong>{questionCount}/{durationMinutes}</strong>
          <p>{t('mockExam.paperSpecDetail', '题 / 分钟，还原限时节奏')}</p>
        </article>
        <article>
          <span>{t('mockExam.reportAbility', '提交后')}</span>
          <strong>{t('mockExam.instantReport', '即时')}</strong>
          <p>{t('mockExam.reportAbilityDetail', '分数、错题、未答和解析')}</p>
        </article>
      </section>

      {recommendation && (
        <section className="mock-adaptive-paper-band" aria-label={t('mockExam.adaptiveRecommendationAria', '系统推荐模考')}>
          <div>
            <p className="page-kicker">{t('mockExam.adaptiveRecommendationKicker', '系统推荐下一套')}</p>
            <h2>{recommendation.title}</h2>
            <p>{recommendation.body}</p>
            <div className="mock-adaptive-stats">
              <span>{t('mockExam.latestScore', '最近模考')} <b>{recommendation.scoreLabel}</b></span>
              <span>{t('mockExam.practiceMastery', '科目掌握度')} <b>{recommendation.masteryLabel}</b></span>
              <span>{t('mockExam.recommendationSource', '推荐依据')} <b>{recommendation.label}</b></span>
            </div>
          </div>
          <button type="button" onClick={() => onNavigate(recommendation.path)}>
            <Icon name="lucide:arrow-right" />
            {recommendation.actionLabel}
          </button>
        </section>
      )}

      <section className="mock-real-paper-band">
        <div className="mock-section-head">
          <div>
            <p className="page-kicker">{t('mockExam.realStyleKicker', '真题结构练习')}</p>
            <h2>{t('mockExam.realStyleTitle', '先用短入口熟悉真实考试的题面节奏。')}</h2>
          </div>
          <span>{t('mockExam.freeOpen', '免费开放')}</span>
        </div>
        <div className="mock-real-paper-grid">
          {realStylePapers.length ? realStylePapers.map((paper, index) => (
            <button key={paper.slug} type="button" className="mock-real-paper-card" onClick={() => onNavigate(pastPaperPath(paper.slug))}>
              <span>#{index + 1}</span>
              <strong>{localizedMockPaperTitle(paper.title, subjectLabel, index, locale, 'past')}</strong>
              <small>{paper.questionCount ?? 48} {t('mockExam.questions', '题')} · {paper.fileCount} {t('mockExam.fileCount', '份文件')} · {paper.isFree ? t('mockExam.freeOpen', '免费开放') : ''}</small>
            </button>
          )) : (
            <div className="mock-real-paper-empty">
              <strong>{t('mockExam.realPaperEmptyTitle', '真题资料正在整理')}</strong>
              <p>{t('mockExam.realPaperEmptyBody', '后台发布后会自动出现在这里，当前可以先使用下方在线模考。')}</p>
            </div>
          )}
        </div>
      </section>

      <section className="mock-section-head mock-paper-section-head">
        <div>
          <p className="page-kicker">{t('mockExam.fullPaperSectionKicker', '完整模考')}</p>
          <h2>{locale === 'zh-CN' ? `${totalPapers} 套${subjectLabel}在线模考` : `${totalPapers} ${t('mockExam.fullPaperSectionKicker', '完整模考')} ${subjectLabel}`}</h2>
        </div>
        <div className="mock-focus-pills">
          {subjectFocus.map((tag) => <span key={tag}>{localizedMockTag(tag, locale)}</span>)}
        </div>
      </section>

      <section className="mock-paper-grid" aria-label={t('mockExam.paperListAria', '套卷列表')}>
        {detail.papers.map((paper, index) => (
          <article key={paper.slug} className={['mock-paper-card', 'free', paper.slug === recommendedPaperSlug ? 'recommended' : ''].filter(Boolean).join(' ')}>
            <div className="mock-paper-topline">
              <span className="mock-paper-number">#{index + 1}</span>
              <b>{paper.slug === recommendedPaperSlug ? t('mockExam.recommendedPaper', '系统推荐') : t('mockExam.freeOpen', '免费开放')}</b>
            </div>
            <h2>{localizedMockPaperTitle(paper.title, subjectLabel, index, locale)}</h2>
            <p>{localizedMockPaperDescription(paper.description, subjectLabel, paper.questionCount, paper.durationMinutes, locale)}</p>
            <div className="mock-paper-meta">
              <span>{paper.questionCount} {t('mockExam.questions', '题')}</span>
              <span>{paper.durationMinutes} {t('mockExam.minutes', '分钟')}</span>
              <span>{t('mockExam.freeTry', '免费试做')}</span>
            </div>
            <button type="button" onClick={() => onNavigate(startPath(paper))}>{t('mockExam.startFree', '开始免费试做')}</button>
          </article>
        ))}
      </section>

      <section className="mock-bundle-panel mock-free-access-panel">
        <div>
          <p className="page-kicker">{t('mockExam.freeAccess', '免费开放')}</p>
          <h2>{locale === 'zh-CN' ? `${subjectLabel}在线模考全部免费开放` : `${subjectLabel} ${t('mockExam.fullPaperSectionKicker', '完整模考')} ${t('mockExam.freeOpen', '免费开放').toLowerCase()}`}</h2>
          <p>{t('mockExam.freeAccessBody', '当前版本不设置付费门槛，任意套卷都可以直接进入 CBT 模考流程，提交后查看分数、错题和解析。')}</p>
        </div>
        <strong>{t('mockExam.freeLabel', 'Free')}</strong>
      </section>

      <section className="mock-subject-flow" aria-label={t('mockExam.flowAria', '模考流程')}>
        <article>
          <span>01</span>
          <strong>{t('mockExam.flowStepOne', '进入套卷')}</strong>
          <p>{t('mockExam.flowStepOneBody', '从任意卡片开始，进入考前确认页后直接开考。')}</p>
        </article>
        <article>
          <span>02</span>
          <strong>{t('mockExam.flowStepTwo', '限时作答')}</strong>
          <p>{t('mockExam.flowStepTwoBody', '支持题号跳转、标记复查、自动保存和倒计时。')}</p>
        </article>
        <article>
          <span>03</span>
          <strong>{t('mockExam.flowStepThree', '复盘报告')}</strong>
          <p>{t('mockExam.flowStepThreeBody', '提交后查看得分、错题列表、解析和知识点诊断。')}</p>
        </article>
      </section>
    </div>
  );
}

function PaperStartView({ slug, currentUser, onNavigate }: { slug: string; currentUser: User | null; onNavigate: (path: string) => void }) {
  const { locale, t } = useI18n();
  const [start, setStart] = useState<MockExamStart | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [examLanguage, setExamLanguage] = useState(() => locale === 'en' ? 'en' : 'zh');

  useEffect(() => {
    let alive = true;
    void getMockExamStart(slug, { locale })
      .then((result) => { if (alive) setStart(result); })
      .catch((nextError) => { if (alive) setError((nextError as Error).message || t('mockExam.paperUnavailable', '套卷暂时不可用。')); });
    return () => { alive = false; };
  }, [slug, locale, t]);

  async function begin() {
    if (!start || start.locked || isStarting) return;
    setIsStarting(true);
    setError(null);
    try {
      const attempt = await createMockExamAttempt(start.paper.slug, Boolean(currentUser), { language: examLanguage });
      onNavigate(attemptPath(attempt.id));
    } catch (nextError) {
      setError((nextError as Error).message || t('mockExam.startFailed', '开始模考失败。'));
    } finally {
      setIsStarting(false);
    }
  }

  if (error && !start) return <ErrorState message={error} onBack={() => onNavigate(routes.cscaMockExam)} />;
  if (!start) return <LoadingState label={t('mockExam.loadingPaper', '正在加载套卷')} />;

  const subjectLabel = localizedSubjectLabel(start.paper.subject, locale, t);
  const languageLabel = localizedPaperLanguage(start.paper.language, locale);
  const backToSubjectLabel = locale === 'zh-CN' ? `← 返回${subjectLabel}套卷` : `← ${t('mockExam.backToPaperList', '返回套卷列表')} ${subjectLabel}`;
  const accessLabel = start.paper.isFree ? t('mockExam.freeTry', '免费试做') : start.paper.priceLabel ?? t('mockExam.locked', '锁定');

  return (
    <div className="page-stack brand-page mock-exam-page mock-start-page">
      <GhostButton className="mock-start-back" onClick={() => onNavigate(subjectPath(start.paper.subject))}>{backToSubjectLabel}</GhostButton>
      <section className={start.locked ? 'mock-start-card locked' : 'mock-start-card'}>
        <div className="mock-start-summary">
          <div className="mock-start-heading">
            <span className="mock-start-icon"><Icon name={start.locked ? 'lucide:shield-alert' : 'lucide:clipboard-check'} color={start.locked ? 'ff715e' : '315dff'} /></span>
            <div>
              <p className="page-kicker">{subjectLabel} / {languageLabel}</p>
              <h1>{localizedMockPaperTitle(start.paper.title, subjectLabel, 0, locale)}</h1>
            </div>
          </div>
          <p>{localizedMockPaperDescription(start.paper.description, subjectLabel, start.paper.questionCount, start.paper.durationMinutes, locale)}</p>
          <div className="mock-start-meta">
            <span>{start.paper.questionCount} {t('mockExam.questions', '题')}</span>
            <span>{start.paper.durationMinutes} {t('mockExam.minutes', '分钟')}</span>
            <span>{accessLabel}</span>
          </div>
          <div className="mock-start-facts" aria-label={t('mockExam.examSummaryAria', '考试摘要')}>
            <span><strong>{start.paper.questionCount}</strong> {t('mockExam.questionItems', '题目')}</span>
            <span><strong>{start.paper.durationMinutes}</strong> {t('mockExam.minutes', '分钟')}</span>
            <span><strong>{t('mockExam.auto', '自动')}</strong> {t('mockExam.save', '保存')}</span>
          </div>
        </div>
        <div className="mock-start-actions">
          {start.locked ? (
            <div className="mock-locked-note">
              <strong>{t('mockExam.lockedTitle', '这套卷暂未开放')}</strong>
              <p>{t('mockExam.lockedBody', '这套卷暂未开放。现在可以先完成免费卷，或通过咨询了解后续模考包安排。')}</p>
            </div>
          ) : (
            <>
              <div className="mock-language-choice" aria-label={t('mockExam.examLanguage', '考试语言')}>
                <strong>{t('mockExam.examLanguage', '考试语言')}</strong>
                <div>
                  <button type="button" className={examLanguage === 'zh' ? 'active' : ''} aria-pressed={examLanguage === 'zh'} onClick={() => setExamLanguage('zh')}>{t('mockExam.chineseLanguage', '中文')}</button>
                  <button type="button" className={examLanguage === 'en' ? 'active' : ''} aria-pressed={examLanguage === 'en'} onClick={() => setExamLanguage('en')}>English</button>
                </div>
              </div>
              <ul className="mock-rule-list">{start.rules.map((rule, index) => <li key={rule}>{localizedMockRule(rule, index, locale)}</li>)}</ul>
            </>
          )}
          {error && <p className="mock-inline-error">{error}</p>}
          <InlineActions>
            {!start.locked && <button type="button" onClick={begin} disabled={isStarting}>{isStarting ? t('mockExam.entering', '正在进入...') : t('mockExam.startPaper', '开始模考')}</button>}
            {start.locked && <button type="button" onClick={() => onNavigate(routes.me)}>{t('mockExam.consultBundle', '查看账号额度')}</button>}
            <GhostButton onClick={() => onNavigate(subjectPath(start.paper.subject))}>{t('mockExam.backToPaperList', '返回套卷列表')}</GhostButton>
          </InlineActions>
        </div>
      </section>
      <section className="mock-start-notes" aria-label={t('mockExam.paperNotesAria', '模考说明')}>
        <article>
          <strong>{t('mockExam.duringPaperTitle', '作答中')}</strong>
          <p>{t('mockExam.duringPaperBody', '支持标记复查、题号跳转和自动保存。')}</p>
        </article>
        <article>
          <strong>{t('mockExam.afterSubmitTitle', '交卷后')}</strong>
          <p>{t('mockExam.afterSubmitBody', '生成分数、错题、未答和逐题解析。')}</p>
        </article>
        <article>
          <strong>{t('mockExam.practicePurposeTitle', '练习定位')}</strong>
          <p>{t('mockExam.practicePurposeBody', '原创仿真模拟练习，用于熟悉节奏和查漏补缺。')}</p>
        </article>
      </section>
    </div>
  );
}

export function MockExamTakingView({ attemptId, onNavigate }: { attemptId: string; onNavigate: (path: string) => void }) {
  const { locale, t } = useI18n();
  const [detail, setDetail] = useState<MockExamAttemptDetail | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [marked, setMarked] = useState<number[]>([]);
  const [timeSpent, setTimeSpent] = useState<Record<string, number>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const attemptVersionRef = useRef<number | null>(null);

  useEffect(() => {
    let alive = true;
    void getMockExamAttempt(attemptId, { locale })
      .then((result) => {
        if (!alive) return;
        setDetail(result);
        setAnswers(result.attempt.answers ?? {});
        setMarked(Array.isArray(result.attempt.markedQuestions) ? result.attempt.markedQuestions : []);
        setTimeSpent(result.attempt.timeSpent ?? {});
        setCurrentIndex(Math.max(0, Math.min(result.questions.length - 1, (result.attempt.currentQuestion || 1) - 1)));
        attemptVersionRef.current = result.attempt.version;
        if (result.attempt.submittedAt) onNavigate(reportPath(result.attempt.id));
      })
      .catch((nextError) => { if (alive) setError(localizedApiError(nextError, t('mockExam.attemptUnavailable', '模考记录无法加载。'), locale)); });
    return () => { alive = false; };
  }, [attemptId, locale, onNavigate, t]);

  const currentQuestion = detail?.questions[currentIndex];
  const remainingSeconds = detail ? Math.max(0, Math.ceil((new Date(detail.attempt.dueAt).getTime() - now) / 1000)) : 0;
  const answeredCount = Object.keys(answers).filter((key) => answers[key]).length;
  const unansweredCount = detail ? Math.max(0, detail.questions.length - answeredCount) : 0;
  const progressPercent = detail?.questions.length ? Math.round((answeredCount / detail.questions.length) * 100) : 0;
  const totalSeconds = detail ? detail.attempt.paper.durationMinutes * 60 : 0;
  const elapsedSeconds = totalSeconds ? Math.max(0, totalSeconds - remainingSeconds) : 0;
  const currentQuestionSeconds = currentQuestion ? timeSpent[String(currentQuestion.id)] ?? 0 : 0;
  const groupSize = detail ? Math.max(1, Math.ceil(detail.questions.length / 3)) : 1;
  const groupIndex = Math.floor(currentIndex / groupSize);
  const groupStart = groupIndex * groupSize;
  const groupEnd = detail ? Math.min(detail.questions.length, groupStart + groupSize) : groupStart + groupSize;
  const groupQuestions = detail?.questions.slice(groupStart, groupEnd) ?? [];
  const groupSeconds = groupQuestions.reduce((sum, question) => sum + (timeSpent[String(question.id)] ?? 0), 0);
  const phaseStatus = remainingSeconds <= 300
    ? 'final'
    : remainingSeconds <= 900
      ? 'review'
      : elapsedSeconds >= totalSeconds * 0.5
        ? 'pace'
        : 'answer';
  const phaseText = phaseStatus === 'final'
    ? t('mockExam.phaseFinal', '最后 5 分钟：优先处理未答题，必要时交卷。')
    : phaseStatus === 'review'
      ? t('mockExam.phaseReviewPrompt', '最后 15 分钟：开始检查标记题和未答题。')
      : phaseStatus === 'pace'
        ? t('mockExam.phasePace', '后半程：注意取舍，避免单题耗时过长。')
        : t('mockExam.phaseAnswer', '作答阶段：先保证稳定推进，再标记不确定题。');

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!detail || !currentQuestion || detail.attempt.submittedAt) return;
    const timer = window.setInterval(() => {
      setTimeSpent((current) => ({ ...current, [String(currentQuestion.id)]: (current[String(currentQuestion.id)] ?? 0) + 5 }));
    }, 5000);
    return () => window.clearInterval(timer);
  }, [detail, currentQuestion]);

  useEffect(() => {
    if (!detail || detail.attempt.submittedAt) return;
    const timer = window.setTimeout(() => {
      void patchMockExamAttempt(detail.attempt.id, {
        answers,
        markedQuestions: marked,
        timeSpent,
        currentQuestion: currentIndex + 1,
        expectedVersion: attemptVersionRef.current ?? undefined
      })
        .then((nextAttempt) => { attemptVersionRef.current = nextAttempt.version; })
        .catch(() => undefined);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [answers, marked, timeSpent, currentIndex, detail]);

  useEffect(() => {
    if (!detail || remainingSeconds > 0 || isSubmitting) return;
    void finish();
  }, [detail, remainingSeconds, isSubmitting]);

  async function finish() {
    if (!detail || isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const saved = await patchMockExamAttempt(detail.attempt.id, { answers, markedQuestions: marked, timeSpent, currentQuestion: currentIndex + 1, expectedVersion: attemptVersionRef.current ?? undefined });
      attemptVersionRef.current = saved.version;
      const report = await submitMockExamAttempt(detail.attempt.id);
      onNavigate(reportPath(report.attempt.id));
    } catch (nextError) {
      setError(localizedApiError(nextError, t('mockExam.submitFailed', '交卷失败，请稍后重试。'), locale));
    } finally {
      setIsSubmitting(false);
      setConfirmOpen(false);
    }
  }

  function choose(question: MockExamQuestion, optionId: string) {
    setAnswers((current) => ({ ...current, [String(question.id)]: optionId }));
  }

  function goToNextUnanswered() {
    if (!detail) return;
    const afterCurrent = detail.questions.findIndex((question, index) => index > currentIndex && !answers[String(question.id)]);
    if (afterCurrent >= 0) {
      setCurrentIndex(afterCurrent);
      return;
    }
    const fromStart = detail.questions.findIndex((question) => !answers[String(question.id)]);
    if (fromStart >= 0) setCurrentIndex(fromStart);
  }

  if (error && !detail) return <div className="mock-taking-shell"><ErrorState message={error} onBack={() => onNavigate(routes.cscaMockExam)} /></div>;
  if (!detail || !currentQuestion) return <div className="mock-taking-shell"><LoadingState label={t('mockExam.loadingAttempt', '正在进入考试工作台')} /></div>;

  return (
    <div className="mock-taking-shell">
      <header className="mock-exam-bar">
        <GhostButton onClick={() => onNavigate(subjectPath(detail.attempt.paper.subject))}>{t('mockExam.exit', '退出')}</GhostButton>
        <div className="mock-exam-bar-main">
          <div className="mock-exam-title-row">
            <strong>{detail.attempt.paper.title}</strong>
            <span>{t('mockExam.questionPrefix', '第')} {currentIndex + 1} {t('mockExam.questionSuffix', '题')}</span>
          </div>
          <div className="mock-exam-progress" aria-label={t('mockExam.answeredProgress', `已答 ${answeredCount}/${detail.questions.length}`).replace('{answered}', String(answeredCount)).replace('{total}', String(detail.questions.length))}>
            <i style={{ width: `${progressPercent}%` }} />
          </div>
          <span>{t('mockExam.answered', '已答')} {answeredCount}/{detail.questions.length} · {t('mockExam.marked', '标记')} {marked.length} · {t('mockExam.unanswered', '未答')} {unansweredCount}</span>
        </div>
        <strong className={remainingSeconds < 300 ? 'time danger' : 'time'}>{formatSeconds(remainingSeconds)}</strong>
        <button type="button" className="mock-submit-button" onClick={() => setConfirmOpen(true)}>{t('mockExam.submitPaper', '交卷')}</button>
      </header>

      <section className={`mock-cbt-status ${phaseStatus}`} aria-label={t('mockExam.cbtStatusAria', 'CBT 计时状态')}>
        <div>
          <span>{t('mockExam.paperTimer', '整卷剩余')}</span>
          <strong>{formatSeconds(remainingSeconds)}</strong>
        </div>
        <div>
          <span>{t('mockExam.questionTimer', '当前题')}</span>
          <strong>{formatSeconds(currentQuestionSeconds)}</strong>
        </div>
        <div>
          <span>{t('mockExam.groupTimer', '当前题组')}</span>
          <strong>{formatSeconds(groupSeconds)}</strong>
          <small>{groupStart + 1}-{groupEnd}</small>
        </div>
        <p>{phaseText}</p>
      </section>

      <main className="mock-taking-layout">
        <aside className="mock-question-nav" aria-label={t('mockExam.questionNavAria', '题号导航')}>
          <div className="mock-question-nav-title">{t('mockExam.questionNav', '题号导航')}</div>
          {detail.questions.map((question, index) => {
            const selected = Boolean(answers[String(question.id)]);
            const isMarked = marked.includes(question.id);
            return (
              <button
                key={question.id}
                type="button"
                className={[index === currentIndex ? 'current' : '', selected ? 'answered' : 'unanswered', isMarked ? 'marked' : ''].filter(Boolean).join(' ')}
                onClick={() => setCurrentIndex(index)}
                title={`${t('mockExam.questionPrefix', '第')} ${index + 1} ${t('mockExam.questionSuffix', '题')}`}
              >
                {index + 1}
              </button>
            );
          })}
          <div className="mock-question-legend" aria-label={t('mockExam.questionLegendAria', '题号状态说明')}>
            <span><i className="current" />{t('mockExam.current', '当前')}</span>
            <span><i className="answered" />{t('mockExam.answered', '已答')}</span>
            <span><i className="marked" />{t('mockExam.marked', '标记')}</span>
            <span><i />{t('mockExam.unanswered', '未答')}</span>
          </div>
        </aside>

        <section className="mock-question-panel">
          <div className="mock-question-head">
            <div>
              <p className="page-kicker">{t('mockExam.questionPrefix', '第')} {currentIndex + 1} {t('mockExam.questionSuffix', '题')} / {t('mockExam.singleChoice', '单项选择')}</p>
              <h1><MathContent text={currentQuestion.prompt} /></h1>
            </div>
            <button
              type="button"
              className={marked.includes(currentQuestion.id) ? 'mock-mark active' : 'mock-mark'}
              onClick={() => setMarked((current) => current.includes(currentQuestion.id) ? current.filter((id) => id !== currentQuestion.id) : [...current, currentQuestion.id])}
            >
              {t('mockExam.markReview', '标记复查')}
            </button>
          </div>
          <div className="mock-options">
            {currentQuestion.options.map((option) => (
              <button
                key={option.id}
                type="button"
                className={answers[String(currentQuestion.id)] === option.id ? 'selected' : ''}
                onClick={() => choose(currentQuestion, option.id)}
                aria-pressed={answers[String(currentQuestion.id)] === option.id}
              >
                <b>{option.id}</b>
                <span><MathContent text={option.text} /></span>
                <em>{answers[String(currentQuestion.id)] === option.id ? t('mockExam.selected', '已选择') : ''}</em>
              </button>
            ))}
          </div>
          {error && <p className="mock-inline-error">{error}</p>}
          <div className="mock-question-actions">
            <GhostButton disabled={currentIndex === 0} onClick={() => setCurrentIndex((value) => Math.max(0, value - 1))}>{t('mockExam.previousQuestion', '上一题')}</GhostButton>
            <GhostButton disabled={unansweredCount === 0} onClick={goToNextUnanswered}>{t('mockExam.nextUnanswered', '下一未答')}</GhostButton>
            <button type="button" disabled={currentIndex === detail.questions.length - 1} onClick={() => setCurrentIndex((value) => Math.min(detail.questions.length - 1, value + 1))}>{t('mockExam.nextQuestion', '下一题')}</button>
          </div>
        </section>
      </main>

      {confirmOpen && (
        <ConfirmDialog
          title={t('mockExam.confirmSubmitTitle', '确认交卷')}
          body={t('mockExam.confirmSubmitBody', `已答 ${answeredCount}/${detail.questions.length} 题，未答 ${unansweredCount} 题，标记 ${marked.length} 题，剩余时间 ${formatSeconds(remainingSeconds)}。`)
            .replace('{answered}', String(answeredCount))
            .replace('{total}', String(detail.questions.length))
            .replace('{unanswered}', String(unansweredCount))
            .replace('{marked}', String(marked.length))
            .replace('{time}', formatSeconds(remainingSeconds))}
          confirmLabel={t('mockExam.confirmSubmit', '确认交卷')}
          cancelLabel={t('mockExam.continueAnswering', '继续答题')}
          isBusy={isSubmitting}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={finish}
        />
      )}
    </div>
  );
}

export function MockExamReportView({ attemptId, onNavigate, agentMode = false }: { attemptId: string; onNavigate: (path: string) => void; agentMode?: boolean }) {
  const { locale, t } = useI18n();
  const [report, setReport] = useState<MockExamReport | null>(null);
  const [filter, setFilter] = useState<'all' | 'wrong' | 'unanswered' | 'marked'>('all');
  const [openId, setOpenId] = useState<number | null>(null);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void getMockExamReport(attemptId, { locale })
      .then((result) => { if (alive) setReport(result); })
      .catch((nextError) => { if (alive) setError(localizedApiError(nextError, t('mockExam.reportUnavailable', '成绩报告无法加载。'), locale)); });
    return () => { alive = false; };
  }, [attemptId, locale, t]);

  const visibleItems = useMemo(() => {
    if (!report) return [];
    if (filter === 'wrong') return report.items.filter((item) => !item.isCorrect && !item.isUnanswered);
    if (filter === 'unanswered') return report.items.filter((item) => item.isUnanswered);
    if (filter === 'marked') return report.items.filter((item) => item.isMarked);
    return report.items;
  }, [filter, report]);

  const diagnostics = useMemo(() => {
    if (!report) return null;
    const scoredKnowledge = report.knowledgeStats.map((stat) => ({
      ...stat,
      correct: Math.max(0, stat.total - stat.wrong),
      rate: stat.total ? Math.round(((stat.total - stat.wrong) / stat.total) * 100) : 0
    }));
    const stable = scoredKnowledge.filter((stat) => stat.rate >= 80);
    const edge = scoredKnowledge.filter((stat) => stat.rate >= 60 && stat.rate < 80);
    const weak = scoredKnowledge.filter((stat) => stat.rate < 60);
    const timedItems = report.items.filter((item) => item.secondsSpent > 0);
    const fastest = timedItems.length ? Math.min(...timedItems.map((item) => item.secondsSpent)) : 0;
    const slowest = timedItems.length ? Math.max(...timedItems.map((item) => item.secondsSpent)) : 0;
    return { scoredKnowledge, stable, edge, weak, fastest, slowest };
  }, [report]);

  if (error) return <ErrorState message={error} onBack={() => onNavigate(routes.cscaMockExam)} />;
  if (!report) return <LoadingState label={t('mockExam.loadingReport', '正在生成成绩报告')} />;

  const subjectLabel = localizedSubjectLabel(report.attempt.paper.subject, locale, t);

  return (
    <div className="page-stack brand-page mock-exam-page mock-report-page">
      {!agentMode && <div className="mock-report-toolbar">
        <GhostButton onClick={() => onNavigate(subjectPath(report.attempt.paper.subject))}>← {t('mockExam.backToPaperList', '返回套卷列表')} {subjectLabel}</GhostButton>
        <button type="button" onClick={() => onNavigate(routes.cscaMockExam)}>{t('mockExam.practiceOtherSubjects', '继续练其它科目')}</button>
      </div>}
      <section className="mock-report-hero">
        <div className="mock-score-card">
          <p className="page-kicker">{t('mockExam.reportKicker', '模考成绩报告')} / {subjectLabel}</p>
          <h1>{report.summary.score}</h1>
          <span>{t('mockExam.pointsOutOf100', '分 / 100')}</span>
          <strong>{report.attempt.paper.title}</strong>
          <small>{t('mockExam.completedCount', '完成')} {report.items.length - report.summary.unansweredCount}/{report.items.length} {t('mockExam.questions', '题')}</small>
        </div>
        <dl>
          <div><dt>{t('mockExam.correct', '正确')}</dt><dd>{report.summary.correctCount}</dd></div>
          <div><dt>{t('mockExam.wrong', '错误')}</dt><dd>{report.summary.wrongCount}</dd></div>
          <div><dt>{t('mockExam.unanswered', '未答')}</dt><dd>{report.summary.unansweredCount}</dd></div>
          <div><dt>{t('mockExam.averageTime', '平均耗时')}</dt><dd>{formatSeconds(report.summary.averageSeconds)}</dd></div>
        </dl>
        <div className="mock-report-actions">
          <span>{subjectLabel}</span>
          <button type="button" onClick={() => setDiagnosticsOpen(true)}>
            <Icon name="lucide:receipt-text" />
            {t('mockExam.viewDiagnostics', '查看完整诊断报告')}
          </button>
          <GhostButton onClick={() => void navigator.clipboard?.writeText(window.location.href)}>
            {t('mockExam.share', '分享')}
          </GhostButton>
        </div>
      </section>

      <section className="mock-knowledge-panel">
        <div>
          <p className="page-kicker">{t('mockExam.knowledgeAnalysis', '知识点分析')}</p>
          <h2>{t('mockExam.knowledgeTitle', '优先回看错误集中的知识点。')}</h2>
        </div>
        <div className="mock-knowledge-list">
          {report.knowledgeStats.length ? report.knowledgeStats.map((stat) => (
            <span key={stat.tag}>{stat.tag}<b>{stat.wrong}/{stat.total}</b></span>
          )) : <p>{t('mockExam.noKnowledgeStats', '本次先按逐题解析复盘，重点回看错题和未答题。')}</p>}
        </div>
      </section>

      <section className="mock-review-panel">
        <div className="mock-review-head">
          <div>
            <p className="page-kicker">{t('mockExam.questionReviewKicker', '逐题复盘')}</p>
            <h2>{t('mockExam.questionReviewTitle', '题目回顾')}</h2>
          </div>
          <div className="mock-filter-tabs">
            <button type="button" className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>{t('mockExam.all', '全部')}({report.items.length})</button>
            <button type="button" className={filter === 'wrong' ? 'active' : ''} onClick={() => setFilter('wrong')}>{t('mockExam.wrongQuestions', '错题')}({report.summary.wrongCount})</button>
            <button type="button" className={filter === 'unanswered' ? 'active' : ''} onClick={() => setFilter('unanswered')}>{t('mockExam.unanswered', '未答')}({report.summary.unansweredCount})</button>
            <button type="button" className={filter === 'marked' ? 'active' : ''} onClick={() => setFilter('marked')}>{t('mockExam.marked', '标记')}</button>
          </div>
        </div>
        <div className="mock-review-list">
          {visibleItems.map((item) => (
            <article key={item.id} className={item.isUnanswered ? 'unanswered' : item.isCorrect ? 'correct' : 'wrong'}>
              <button type="button" className="mock-review-row" onClick={() => setOpenId((current) => current === item.id ? null : item.id)}>
                <span>{item.orderNumber}</span>
                <strong><MathContent text={item.prompt} /></strong>
                <em>{item.isUnanswered ? t('mockExam.unanswered', '未答') : `${item.selected} → ${item.correctAnswer}`}</em>
                <small>{item.isCorrect ? t('mockExam.correct', '正确') : item.isUnanswered ? t('mockExam.unanswered', '未答') : t('mockExam.wrongQuestions', '错题')}</small>
                <small>{formatSeconds(item.secondsSpent)}</small>
                <i>{openId === item.id ? t('mockExam.collapse', '收起') : t('mockExam.expand', '展开')}</i>
              </button>
              {openId === item.id && (
                <div className="mock-review-detail">
                  <div className="mock-review-question">
                    <strong>{t('mockExam.prompt', '题干')}</strong>
                    <p><MathContent text={item.prompt} /></p>
                  </div>
                  <div className="mock-review-options" aria-label={t('mockExam.optionReviewAria', '选项回顾')}>
                    <div className={item.isUnanswered ? 'mock-review-choice-summary unanswered' : item.isCorrect ? 'mock-review-choice-summary correct' : 'mock-review-choice-summary wrong'}>
                      <span>{item.isUnanswered ? t('mockExam.notAnswered', '未作答') : item.isCorrect ? t('mockExam.answerCorrect', '作答正确') : t('mockExam.answerWrong', '作答错误')}</span>
                      <b>{item.isUnanswered ? `${t('mockExam.correctAnswer', '正确答案')} ${item.correctAnswer}` : `${t('mockExam.yourAnswer', '你的答案')} ${item.selected} / ${t('mockExam.correctAnswer', '正确答案')} ${item.correctAnswer}`}</b>
                    </div>
                    {item.options.map((option) => (
                      <p key={option.id} className={[option.id === item.correctAnswer ? 'right' : '', option.id === item.selected && option.id !== item.correctAnswer ? 'picked-wrong' : ''].filter(Boolean).join(' ')}>
                        <b>{option.id}</b>
                        <span><MathContent text={option.text} /></span>
                        {option.id === item.correctAnswer && <em>{t('mockExam.correct', '正确')}</em>}
                        {option.id === item.selected && option.id !== item.correctAnswer && <em>{t('mockExam.yourAnswer', '你的答案')}</em>}
                      </p>
                    ))}
                  </div>
                  <div>
                    <strong>{t('mockExam.explanation', '解析')}</strong>
                    <p><MathContent text={item.explanation} /></p>
                    <span>{item.knowledgeTags.join(' / ')}</span>
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>
      </section>
      {diagnosticsOpen && diagnostics && (
        <div className="mock-diagnostics-backdrop" role="dialog" aria-modal="true" aria-labelledby="mock-diagnostics-title">
          <section className="mock-diagnostics-modal">
            <header className="mock-diagnostics-head">
              <div>
                <h2 id="mock-diagnostics-title">{t('mockExam.fullDiagnosticsTitle', 'CSCA 完整诊断报告')}</h2>
                <p>{report.summary.score}/100 · {subjectLabel} · {report.attempt.paper.title}</p>
              </div>
              <div className="mock-diagnostics-head-actions">
                <GhostButton onClick={() => window.print()}>{t('mockExam.printReport', '打印报告')}</GhostButton>
                <button type="button" className="mock-diagnostics-close" aria-label={t('mockExam.closeDiagnostics', '关闭诊断报告')} onClick={() => setDiagnosticsOpen(false)}>×</button>
              </div>
            </header>
            <div className="mock-diagnostics-body">
              <section className="mock-diagnostics-score">
                <div>
                  <span>{t('mockExam.thisScore', '本次得分')}</span>
                  <strong>{report.summary.score}<small>/ 100</small></strong>
                </div>
                <article><b>{diagnostics.stable.length}</b><span>{t('mockExam.stableBand', '稳得分项（≥80%）')}</span></article>
                <article><b>{diagnostics.edge.length}</b><span>{t('mockExam.edgeBand', '边缘项（60-79%）')}</span></article>
                <article><b>{diagnostics.weak.length}</b><span>{t('mockExam.weakBand', '薄弱项（<60%）')}</span></article>
              </section>
              <section className="mock-diagnostics-bands">
                {[
                  { label: t('mockExam.stableBand', '稳得分项（≥80%）'), items: diagnostics.stable, tone: 'good', empty: t('mockExam.stableEmpty', '本次没有 80% 以上的稳得分项，先从易错知识点补起。') },
                  { label: t('mockExam.edgeBand', '边缘项（60-79%）'), items: diagnostics.edge, tone: 'edge', empty: t('mockExam.edgeEmpty', '本次没有明显边缘项。') },
                  { label: t('mockExam.weakBand', '薄弱项（<60%）'), items: diagnostics.weak, tone: 'weak', empty: t('mockExam.weakEmpty', '本次没有 60% 以下的薄弱项，继续保持。') }
                ].map((band) => (
                  <article key={band.label} className={`mock-diagnostics-band ${band.tone}`}>
                    <header>
                      <strong>{band.label}</strong>
                      <b>{band.items.length}</b>
                    </header>
                    {band.items.length ? (
                      <div>
                        {band.items.slice(0, 4).map((item) => (
                          <span key={item.tag}>{item.tag}<em>{item.correct}/{item.total}</em></span>
                        ))}
                      </div>
                    ) : <p>{band.empty}</p>}
                  </article>
                ))}
              </section>
              <section className="mock-diagnostics-time">
                <h3><Icon name="lucide:clock-3" /> {t('mockExam.timeDiagnostics', '时间分配诊断')}</h3>
                <div>
                  <article><span>{t('mockExam.totalTime', '总用时')}</span><strong>{formatSeconds(report.summary.totalSeconds)}</strong></article>
                  <article><span>{t('mockExam.averagePerQuestion', '每题平均')}</span><strong>{formatSeconds(report.summary.averageSeconds)}</strong></article>
                  <article><span>{t('mockExam.fastest', '最快')}</span><strong>{formatSeconds(diagnostics.fastest)}</strong></article>
                  <article><span>{t('mockExam.slowest', '最慢')}</span><strong>{formatSeconds(diagnostics.slowest)}</strong></article>
                </div>
                <p>{t('mockExam.timeAdvice', '目标约 75 秒/题。若平均耗时明显偏短，建议复查粗心题；若偏长，优先训练题型识别和取舍节奏。')}</p>
              </section>
              {!agentMode && <section className="mock-diagnostics-plan">
                <h3>{t('mockExam.personalPlan', '专属备考方案')}</h3>
                <p>{t('mockExam.personalPlanBody', '距离下一次考试仍有准备窗口，建议按这份报告安排复盘：')}</p>
                <ol>
                  <li><b>{t('mockExam.planStepOneTitle', '第 1 步：补齐薄弱项')}</b><span>{t('mockExam.planStepOneBody', '每天 30 分钟复盘错题集中的知识点，先处理高频错误。')}</span></li>
                  <li><b>{t('mockExam.planStepTwoTitle', '第 2 步：稳定边缘项')}</b><span>{t('mockExam.planStepTwoBody', '用同类题做短组训练，避免会做但不稳定。')}</span></li>
                  <li><b>{t('mockExam.planStepThreeTitle', '第 3 步：整卷限时训练')}</b><span>{t('mockExam.planStepThreeBody', '每周完成一套 60 分钟模考，观察时间分配是否改善。')}</span></li>
                </ol>
                <div className="mock-diagnostics-plan-actions">
                  <button type="button" onClick={() => setDiagnosticsOpen(false)}>{t('mockExam.backToReview', '返回题目复盘')}</button>
                  <GhostButton onClick={() => onNavigate(subjectPath(report.attempt.paper.subject))}>{t('mockExam.continueSubject', '继续练本学科')}</GhostButton>
                </div>
              </section>}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export function CscaMockExamPage({ route, currentUser, isResolvingAuth, onNavigate }: { route: string; currentUser: User | null; isResolvingAuth: boolean; onNavigate: (path: string) => void }) {
  const parts = routeParts(route);
  const subject = parts[1];
  const leaf = parts[2];
  if (parts[1] === 'attempts' && parts[2] && parts[3] === 'report') {
    return <MockExamReportView attemptId={parts[2]} onNavigate={onNavigate} />;
  }
  if (parts[1] === 'attempts' && parts[2]) {
    return <MockExamTakingView attemptId={parts[2]} onNavigate={onNavigate} />;
  }
  if (subject && leaf) {
    return <PaperStartView slug={leaf} currentUser={currentUser} onNavigate={onNavigate} />;
  }
  if (subject) {
    return <SubjectPapersView subject={subject} currentUser={currentUser} isResolvingAuth={isResolvingAuth} onNavigate={onNavigate} />;
  }
  return <MockExamOverviewView onNavigate={onNavigate} />;
}

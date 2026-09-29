import { useEffect, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { Icon } from '../components/Icon';
import { MathContent } from '../components/MathContent';
import type { CscaExamSchedule } from '../content/csca-exam';
import type { HomeCopy } from '../content/public-site';
import { useI18n } from '../i18n/useI18n';
import type { School, User } from '../lib/api';
import { getHomeMiniMock, scoreHomeMiniMock } from '../lib/api-special-practice';
import type { HomeMiniMock, HomeMiniMockReport, SpecialPracticeSubject } from '../lib/api-types';
import { buildAuthRedirectUrl } from '../lib/app-navigation';
import { getStoredToken } from '../lib/auth';
import { routes } from '../lib/routes';
import '../styles/home.css';

type SubjectKey = 'math' | 'physics' | 'chem';
type MiniMockStatus = 'idle' | 'loading' | 'submitting';
type HomeMiniMockReportItem = HomeMiniMockReport['items'][number];
type HomeTranslate = (key: string, fallback?: string) => string;

const SUBJECT_META: Array<{
  key: SubjectKey;
  sign: string;
  href: string;
}> = [
  { key: 'math', sign: '∑', href: `${routes.agent}?mode=free&subject=math` },
  { key: 'physics', sign: 'λ', href: `${routes.agent}?mode=free&subject=physics` },
  { key: 'chem', sign: 'H', href: `${routes.agent}?mode=free&subject=chemistry` }
];

const MINI_MOCK_SUBJECTS: Record<SpecialPracticeSubject, { sign: string; path: string; className: string }> = {
  math: { sign: '∑', path: `${routes.agent}?mode=free&subject=math`, className: 'math' },
  physics: { sign: 'λ', path: `${routes.agent}?mode=free&subject=physics`, className: 'physics' },
  chemistry: { sign: 'H', path: `${routes.agent}?mode=free&subject=chemistry`, className: 'chem' }
};

function formatHomeText(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? `{${key}}`));
}
function subjectCopy(t: HomeTranslate) {
  return {
    math: {
      kicker: t('homeLite.visual.mathKicker', 'Math Lab'),
      title: t('homeLite.visual.mathTitle', '函数图像先出现，再进入选项判断。'),
      noteTitle: t('homeLite.visual.mathNoteTitle', '即时解析'),
      noteCopy: t('homeLite.visual.mathNoteCopy', '答完后马上看到关键错因，避免把同一种错误重复带到下一题。'),
      simTitle: t('homeLite.visual.mathSimTitle', '函数图像判读'),
      simStatus: t('homeLite.visual.mathSimStatus', '正在取样'),
      simMetrics: [
        [t('homeLite.visual.mathMetricOneLabel', '阈值线'), t('homeLite.visual.mathMetricOneValue', 'x = 2')],
        [t('homeLite.visual.mathMetricTwoLabel', '安全距离'), t('homeLite.visual.mathMetricTwoValue', 'd > 1')],
        [t('homeLite.visual.mathMetricThreeLabel', '结论'), t('homeLite.visual.mathMetricThreeValue', 'r > 1')]
      ],
      simHint: t('homeLite.visual.mathSimHint', '移动点沿函数曲线取样，直线距离转成选项判断。'),
      aria: t('homeLite.visual.mathAria', '数学函数曲线动画')
    },
    physics: {
      kicker: t('homeLite.visual.physicsKicker', 'Physics Lab'),
      title: t('homeLite.visual.physicsTitle', '先看见力和运动，再把公式代入题目。'),
      noteTitle: t('homeLite.visual.physicsNoteTitle', '概念预热'),
      noteCopy: t('homeLite.visual.physicsNoteCopy', '波形、力和轨迹先帮助建立直觉，再进入公式与题目条件。'),
      simTitle: t('homeLite.visual.physicsSimTitle', '波形与受力'),
      simStatus: t('homeLite.visual.physicsSimStatus', '同步运动'),
      simMetrics: [
        [t('homeLite.visual.physicsMetricOneLabel', '振幅'), t('homeLite.visual.physicsMetricOneValue', 'A ↑')],
        [t('homeLite.visual.physicsMetricTwoLabel', '频率'), t('homeLite.visual.physicsMetricTwoValue', 'f 稳定')],
        [t('homeLite.visual.physicsMetricThreeLabel', '合力'), t('homeLite.visual.physicsMetricThreeValue', 'F -> a')]
      ],
      simHint: t('homeLite.visual.physicsSimHint', '波峰、质点和力矢量同步变化，帮助判断运动关系。'),
      aria: t('homeLite.visual.physicsAria', '物理波形和力的动画')
    },
    chem: {
      kicker: t('homeLite.visual.chemKicker', 'Chemistry Lab'),
      title: t('homeLite.visual.chemTitle', '结构、键和反应关系，先连起来再记。'),
      noteTitle: t('homeLite.visual.chemNoteTitle', '结构复盘'),
      noteCopy: t('homeLite.visual.chemNoteCopy', '把分子结构和反应关系放在同一条学习线上，减少死记硬背感。'),
      simTitle: t('homeLite.visual.chemSimTitle', '结构与反应序'),
      simStatus: t('homeLite.visual.chemSimStatus', '键能对比'),
      simMetrics: [
        [t('homeLite.visual.chemMetricOneLabel', '原子半径'), t('homeLite.visual.chemMetricOneValue', 'R > Q > T')],
        [t('homeLite.visual.chemMetricTwoLabel', '键能'), t('homeLite.visual.chemMetricTwoValue', 'R-T 强')],
        [t('homeLite.visual.chemMetricThreeLabel', '稳定性'), t('homeLite.visual.chemMetricThreeValue', 'T > Q')]
      ],
      simHint: t('homeLite.visual.chemSimHint', '电子轨道和键线同步高亮，把结构关系转成性质判断。'),
      aria: t('homeLite.visual.chemAria', '化学分子结构动画')
    }
  };
}

function subjectName(subject: SpecialPracticeSubject | SubjectKey, t: HomeTranslate, fallback?: string) {
  if (subject === 'math') return t('homeLite.subjects.mathName', fallback ?? '数学');
  if (subject === 'physics') return t('homeLite.subjects.physicsName', fallback ?? '物理');
  return t('homeLite.subjects.chemName', fallback ?? '化学');
}

function HomeLink({
  href,
  onNavigate,
  className,
  children,
  ariaLabel,
  onIntent
}: {
  href: string;
  onNavigate: (path: string) => void;
  className?: string;
  children: ReactNode;
  ariaLabel?: string;
  onIntent?: () => void;
}) {
  const isHash = href.startsWith('#');
  return (
    <a
      href={href}
      className={className}
      aria-label={ariaLabel}
      onMouseEnter={onIntent}
      onFocus={onIntent}
      onTouchStart={onIntent}
      onClick={(event: MouseEvent<HTMLAnchorElement>) => {
        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        ) {
          return;
        }

        if (isHash) return;
        event.preventDefault();
        onNavigate(href);
      }}
    >
      {children}
    </a>
  );
}

function ScienceLabPreview({ subject }: { subject: SubjectKey }) {
  if (subject === 'math') {
    return (
      <svg viewBox="0 0 480 260" aria-hidden="true">
        <defs>
          <linearGradient id="homeLabMathTop" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#b8c8ff" /><stop offset="1" stopColor="#eff3ff" /></linearGradient>
          <linearGradient id="homeLabMathSide" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#315dff" /><stop offset="1" stopColor="#7895ff" /></linearGradient>
        </defs>
        <path className="lab-grid-line" d="M36 220H444M70 186H410M104 152H376M138 118H342M92 40V222M164 40V222M236 40V222M308 40V222M380 40V222" />
        <g className="lab-math-solid">
          <path fill="url(#homeLabMathTop)" d="M146 90 260 48 350 105 236 148Z" />
          <path fill="url(#homeLabMathSide)" d="M236 148 350 105 350 190 236 230Z" />
          <path fill="#dce5ff" d="M146 90 236 148 236 230 146 170Z" />
          <path className="lab-solid-edge" d="M146 90 260 48 350 105 350 190 236 230 146 170ZM146 90 236 148 350 105M236 148V230M260 48V132" />
        </g>
        <circle className="lab-pulse math" cx="260" cy="48" r="7" />
      </svg>
    );
  }
  if (subject === 'physics') {
    return (
      <svg viewBox="0 0 480 260" aria-hidden="true">
        <defs>
          <linearGradient id="homeLabPhysicsBlock" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#20d3b0" /><stop offset="1" stopColor="#087c66" /></linearGradient>
          <marker id="homeLabArrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0 0 8 4 0 8Z" fill="#315dff" /></marker>
        </defs>
        <path className="lab-grid-line" d="M28 208 150 130 448 130M28 208H448M80 174H430M134 140H412M84 172V224M154 130V224M224 130V224M294 130V224M364 130V224" />
        <g className="lab-physics-block">
          <path fill="#b8f1e5" d="M170 122 248 88 312 122 234 157Z" />
          <path fill="url(#homeLabPhysicsBlock)" d="M234 157 312 122 312 183 234 218Z" />
          <path fill="#e0faf4" d="M170 122 234 157 234 218 170 182Z" />
        </g>
        <path className="lab-force-arrow" markerEnd="url(#homeLabArrow)" d="M278 92 388 44" />
        <text className="lab-formula" x="355" y="38">F = ma</text>
        <path className="lab-motion-trace" d="M74 98C120 54 151 151 198 94S278 48 326 91" />
        <circle className="lab-pulse physics" cx="326" cy="91" r="7" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 480 260" aria-hidden="true">
      <defs>
        <radialGradient id="homeLabChemO"><stop stopColor="#fff" /><stop offset=".28" stopColor="#ff9a8b" /><stop offset="1" stopColor="#ef4f42" /></radialGradient>
        <radialGradient id="homeLabChemH"><stop stopColor="#fff" /><stop offset=".32" stopColor="#a9bbff" /><stop offset="1" stopColor="#315dff" /></radialGradient>
      </defs>
      <path className="lab-chem-orbit" d="M82 132C82 63 394 63 394 132S82 201 82 132Z" />
      <path className="lab-chem-orbit alt" d="M238 32C310 32 310 228 238 228S166 32 238 32Z" />
      <g className="lab-molecule">
        <path className="lab-bond" d="M222 134 158 185M254 134 320 185" />
        <circle fill="url(#homeLabChemO)" cx="238" cy="120" r="43" />
        <circle fill="url(#homeLabChemH)" cx="144" cy="198" r="29" />
        <circle fill="url(#homeLabChemH)" cx="336" cy="198" r="29" />
        <text x="238" y="127">O</text><text x="144" y="204">H</text><text x="336" y="204">H</text>
      </g>
      <circle className="lab-electron one" cx="90" cy="118" r="6" /><circle className="lab-electron two" cx="390" cy="145" r="6" />
    </svg>
  );
}

function SubjectVisual({ subject, ariaLabel }: { subject: SubjectKey; ariaLabel: string }) {
  if (subject === 'physics') {
    return (
      <svg className="home-science-svg" viewBox="0 0 760 520" role="img" aria-label={ariaLabel}>
        <path className="dash" d="M94 110H680M94 215H680M94 320H680M94 425H680" />
        <path className="axis" d="M86 390H696M126 444V78" />
        <path className="motion-trace" d="M130 314 C194 226 254 226 318 286 S450 342 548 256 S636 218 686 248" />
        <path className="wave" d="M112 262 C158 124 204 400 250 262 S342 262 388 262 S480 262 526 262 S618 262 664 262" />
        <path className="force" d="M178 360 L350 144" />
        <path className="force" d="M444 365 L612 214" />
        <path className="velocity-vector" d="M330 290 L405 236" />
        <circle className="particle" cx="224" cy="286" r="12" />
        <circle className="particle delay-1" cx="390" cy="248" r="9" />
        <circle className="particle delay-2" cx="566" cy="292" r="11" />
      </svg>
    );
  }

  if (subject === 'chem') {
    return (
      <svg className="home-science-svg" viewBox="0 0 760 520" role="img" aria-label={ariaLabel}>
        <ellipse className="orbit" cx="390" cy="264" rx="230" ry="80" />
        <ellipse className="orbit" cx="390" cy="264" rx="230" ry="80" transform="rotate(58 390 264)" />
        <ellipse className="orbit" cx="390" cy="264" rx="230" ry="80" transform="rotate(-58 390 264)" />
        <path className="bond" d="M388 262 L264 184M392 262 L526 178M390 268 L400 406" />
        <path className="reaction-line" d="M192 444 C292 382 466 382 594 430" />
        <circle className="atom atom-o" cx="390" cy="264" r="50" />
        <circle className="atom atom-h" cx="264" cy="184" r="30" />
        <circle className="atom atom-h" cx="526" cy="178" r="30" />
        <circle className="atom atom-c" cx="400" cy="406" r="34" />
        <circle className="bond-pulse" cx="390" cy="264" r="68" />
        <circle className="electron" cx="390" cy="184" r="7" />
        <circle className="electron" cx="574" cy="292" r="6" />
        <circle className="electron" cx="206" cy="300" r="6" />
      </svg>
    );
  }

  return (
    <svg className="home-science-svg" viewBox="0 0 760 520" role="img" aria-label={ariaLabel}>
      <path className="dash" d="M95 84H690M95 164H690M95 244H690M95 324H690M95 404H690" />
      <path className="dash" d="M160 58V444M280 58V444M400 58V444M520 58V444M640 58V444" />
      <path className="axis" d="M88 398H698M132 438V68" />
      <path className="threshold-line" d="M520 76V404" />
      <path className="distance-band" d="M520 338H632" />
      <path className="curve" d="M112 346 C178 185 242 154 312 238 C388 329 478 346 548 184 C590 88 638 82 690 126" />
      <path className="tangent" d="M232 286 L584 150" />
      <circle className="point" cx="314" cy="238" r="10" />
      <circle className="point" cx="548" cy="184" r="8" />
      <circle className="graph-probe" cx="520" cy="214" r="7" />
    </svg>
  );
}

function miniMockLanguage(locale: string) {
  return locale === 'zh-CN' ? 'zh' : 'en';
}

function miniMockMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function nextCscaWindow(schedule: CscaExamSchedule, locale: string) {
  const scheduledDate = new Date(`${schedule.nextExamDate}T00:00:00Z`);
  const now = new Date();
  if (Number.isFinite(scheduledDate.getTime()) && scheduledDate.getTime() >= now.getTime()) {
    return {
      label: new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(scheduledDate),
      confirmed: true
    };
  }

  const regularMonths = [0, 2, 3, 5, 11];
  const currentMonth = now.getUTCMonth();
  const nextMonth = regularMonths.find((month) => month > currentMonth);
  const year = nextMonth === undefined ? now.getUTCFullYear() + 1 : now.getUTCFullYear();
  const month = nextMonth ?? regularMonths[0];
  return {
    label: new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month, 1))),
    confirmed: false
  };
}

export function HomePage({
  copy,
  featuredSchools: _featuredSchools,
  currentUser,
  examSchedule,
  onGoToSchools: _onGoToSchools,
  onGoToConsulting: _onGoToConsulting,
  onNavigate,
  onOpenSchoolDetail: _onOpenSchoolDetail
}: {
  copy: HomeCopy;
  featuredSchools: School[];
  currentUser: User | null;
  examSchedule: CscaExamSchedule;
  onGoToSchools: () => void;
  onGoToConsulting: () => void;
  onNavigate: (path: string) => void;
  onOpenSchoolDetail: (schoolId: number) => void;
}) {
  const { locale, t } = useI18n();
  const nextExamWindow = nextCscaWindow(examSchedule, locale);
  const [subject, setSubject] = useState<SubjectKey>('math');
  const [miniMock, setMiniMock] = useState<HomeMiniMock | null>(null);
  const [miniMockReport, setMiniMockReport] = useState<HomeMiniMockReport | null>(null);
  const [miniMockStatus, setMiniMockStatus] = useState<MiniMockStatus>('loading');
  const [miniMockError, setMiniMockError] = useState('');
  const [miniMockSeed, setMiniMockSeed] = useState(() => new Date().toISOString().slice(0, 10));
  const [miniMockIndex, setMiniMockIndex] = useState(0);
  const [miniMockAnswers, setMiniMockAnswers] = useState<Record<string, string>>({});
  const [miniMockChecks, setMiniMockChecks] = useState<Record<string, HomeMiniMockReportItem>>({});
  const [miniMockChecking, setMiniMockChecking] = useState<Record<string, boolean>>({});
  const subjectCopies = subjectCopy(t);
  const subjects = SUBJECT_META.map((item) => ({
    ...item,
    name: subjectName(item.key, t),
    body: t(`homeLite.subjects.${item.key}Body`, item.key === 'math'
      ? '函数、图像、概率统计，适合用可视化理解。'
      : item.key === 'physics'
        ? '把力、波和运动画出来，题目更容易进入状态。'
        : '从结构、键和反应关系进入概念复盘。')
  }));
  const routeCards = [
    {
      title: t('homeLite.routes.mockTitle', '先完成一套在线模考'),
      body: t('homeLite.routes.mockBody', '按考试节奏完成一套题，快速了解当前水平、用时压力和优先复盘的知识点。'),
      action: t('homeLite.routes.mockAction', '开始模考'),
      href: routes.agent,
      icon: 'lucide:play',
      tag: t('homeLite.routes.mockTag', '入口 01'),
      className: 'major'
    },
    {
      title: t('homeLite.routes.practiceTitle', '科目训练'),
      body: t('homeLite.routes.practiceBody', '数学、物理、化学按知识点拆开练，短题组适合每天推进。'),
      action: t('homeLite.routes.practiceAction', '去训练'),
      href: `${routes.agent}?mode=free&subject=math`,
      icon: 'lucide:list-checks',
      tag: t('homeLite.routes.freeTag', '免费'),
      className: 'tall'
    },
    {
      title: t('homeLite.routes.studyTitle', '科目学习'),
      body: t('homeLite.routes.studyBody', '函数看曲线，物理看运动，化学看结构，先建立直觉再做题。'),
      action: t('homeLite.routes.studyAction', '探索科目'),
      href: `${routes.agent}?mode=free&subject=math`,
      icon: 'lucide:layers-3',
      tag: t('homeLite.routes.labTag', 'Lab'),
      className: ''
    },
    {
      title: t('homeLite.routes.reviewTitle', '错题复盘'),
      body: t('homeLite.routes.reviewBody', '同类错题进入复盘队列，下一轮优先推送变式训练。'),
      action: t('homeLite.routes.reviewAction', '查看路径'),
      href: `${routes.agent}?agentSection=weakness`,
      icon: 'lucide:route',
      tag: '',
      className: 'low'
    }
  ] as const;
  const activeSubject = subjectCopies[subject];
  const miniMockQuestions = miniMock?.questions ?? [];
  const miniMockReportItems = miniMockReport?.items ?? [];
  const activeMiniQuestion = miniMockReportItems[miniMockIndex] ?? miniMockQuestions[miniMockIndex] ?? null;
  const miniMockCheckedCount = miniMockQuestions.filter((question) => miniMockChecks[String(question.id)]).length;
  const miniMockCompleted = Boolean(miniMockQuestions.length && miniMockCheckedCount === miniMockQuestions.length);
  const miniMockCanSubmit = Boolean(miniMockCompleted && !miniMockReport);
  const miniMockActiveResult = activeMiniQuestion && miniMockReport
    ? miniMockReport.items.find((item) => item.id === activeMiniQuestion.id) ?? null
    : activeMiniQuestion
      ? miniMockChecks[String(activeMiniQuestion.id)] ?? null
    : null;
  const hasHomeAuth = Boolean(currentUser || getStoredToken());
  const miniMockSubjectRows = miniMockReport
    ? miniMockReport.subjectBreakdown ?? []
    : miniMock?.subjects?.map((item) => ({
      id: item.id,
      title: subjectName(item.id, t, item.title),
      total: item.questionCount,
      correctCount: 0,
      wrongCount: 0,
      unansweredCount: Math.max(0, item.questionCount - miniMockQuestions.filter((question) => question.subject === item.id && miniMockAnswers[String(question.id)]).length),
      accuracy: item.questionCount ? Math.round((miniMockQuestions.filter((question) => question.subject === item.id && miniMockAnswers[String(question.id)]).length / item.questionCount) * 100) : 0
    })) ?? [];
  useEffect(() => {
    let cancelled = false;
    setMiniMockStatus('loading');
    setMiniMockError('');
    setMiniMockReport(null);
    setMiniMockAnswers({});
    setMiniMockChecks({});
    setMiniMockChecking({});
    setMiniMockIndex(0);
    void getHomeMiniMock({ language: miniMockLanguage(locale), seed: miniMockSeed })
      .then((result) => {
        if (cancelled) return;
        setMiniMock(result);
      })
      .catch((error) => {
        if (cancelled) return;
        setMiniMock(null);
        setMiniMockError(miniMockMessage(error, t('homeLite.practice.loadErrorBody', '题库暂时没有响应，请稍后再试。')));
      })
      .finally(() => {
        if (!cancelled) setMiniMockStatus('idle');
      });
    return () => {
      cancelled = true;
    };
  }, [locale, miniMockSeed]);

  async function chooseMiniMockAnswer(questionId: number, optionId: string) {
    const key = String(questionId);
    if (miniMockReport || miniMockStatus !== 'idle' || miniMockChecks[key] || miniMockChecking[key]) return;
    setMiniMockAnswers((current) => ({ ...current, [String(questionId)]: optionId }));
    setMiniMockChecking((current) => ({ ...current, [key]: true }));
    setMiniMockError('');
    try {
      const report = await scoreHomeMiniMock({
        questionIds: [questionId],
        answers: { [key]: optionId },
        language: miniMockLanguage(locale)
      });
      const checked = report.items[0];
      if (checked) setMiniMockChecks((current) => ({ ...current, [key]: checked }));
    } catch (error) {
      setMiniMockAnswers((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      setMiniMockError(miniMockMessage(error, t('homeLite.practice.loadErrorBody', '题库暂时没有响应，请稍后再试。')));
    } finally {
      setMiniMockChecking((current) => ({ ...current, [key]: false }));
    }
  }

  async function submitMiniMock() {
    if (!miniMockCanSubmit || !miniMock) return;
    setMiniMockStatus('submitting');
    setMiniMockError('');
    try {
      const report = await scoreHomeMiniMock({
        questionIds: miniMock.questions.map((question) => question.id),
        answers: miniMockAnswers,
        language: miniMockLanguage(locale)
      });
      setMiniMockReport(report);
    } catch (error) {
      setMiniMockError(miniMockMessage(error, t('homeLite.practice.loadErrorBody', '题库暂时没有响应，请稍后再试。')));
    } finally {
      setMiniMockStatus('idle');
    }
  }

  useEffect(() => {
    if (!miniMockCanSubmit || miniMockStatus !== 'idle') return;
    void submitMiniMock();
  }, [miniMockCanSubmit, miniMockStatus]);

  function refreshMiniMock() {
    setMiniMockChecks({});
    setMiniMockChecking({});
    setMiniMockSeed(String(Date.now()));
  }

  function startOnlineMock() {
    if (!hasHomeAuth) {
      onNavigate(buildAuthRedirectUrl(routes.agent));
      return;
    }
    onNavigate(routes.agent);
  }

  useEffect(() => {
    const items = document.querySelectorAll<HTMLElement>('.home-page [data-animate]');
    if (!('IntersectionObserver' in window)) {
      items.forEach((item) => item.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.18, rootMargin: '0px 0px -8% 0px' });

    items.forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      const index = SUBJECT_META.findIndex((item) => item.key === subject);
      setSubject(SUBJECT_META[(index + 1) % SUBJECT_META.length].key);
    }, 5200);

    return () => window.clearInterval(timer);
  }, [subject]);

  return (
    <div className="home-page">
      <section className="home-csca-intro home-container" data-home-hero="csca-explained-first">
        <header className="home-csca-intro-head" data-animate="fade-up">
          <span className="home-eyebrow">{t('homeLite.intro.eyebrow', 'CSCA 做题训练')}</span>
          <h1>
            <span>{t('homeLite.intro.titleLine1', '第一次了解 CSCA？')}</span>
            <span className="home-accent-line">{t('homeLite.intro.titleLine2', '先把这场考试看明白。')}</span>
          </h1>
          <p>{t('homeLite.intro.body', '先看清考试结构、科目与时间，再用真实作答找到薄弱点，让每一轮训练都有明确下一步。')}</p>
        </header>

        <div className="home-csca-explainer" aria-label={t('homeLite.intro.factsAria', 'CSCA 考试关键信息')}>
          <article className="home-csca-definition" data-animate="fade-up">
            <span>{t('homeLite.intro.coreLabel', '一句话理解')}</span>
            <h2>{t('homeLite.intro.coreTitle', '覆盖数学、物理、化学的标准化学业能力测试')}</h2>
            <p>{t('homeLite.intro.coreBody', 'CSCAPilot 用模考、短题训练、错题复盘和独立验证，把考试要求转成可以持续执行的学习路径。')}</p>
            <div className="home-csca-impact-tags">
              <span><Icon name="lucide:scan-search" />{t('homeLite.intro.admissionSignal', '真实作答诊断')}</span>
              <span><Icon name="lucide:list-checks" />{t('homeLite.intro.scholarshipSignal', '三科专项训练')}</span>
              <span><Icon name="lucide:route" />{t('homeLite.intro.notOnlyFactor', 'Agent 安排下一步')}</span>
            </div>
          </article>

          <div className="home-csca-main-grid">
            <section className="home-csca-subject-board">
              <header>
                <div>
                  <span>{t('homeLite.intro.subjectsLabel', '考试内容')}</span>
                  <h2>{t('homeLite.intro.subjectsTitle', '你需要考哪些科目？')}</h2>
                </div>
                <p>{t('homeLite.intro.subjectsIntro', '数学、物理和化学分别训练；Agent 根据目标、题源和真实作答证据安排每轮题目。')}</p>
              </header>
              <div className="home-csca-subject-grid">
                <article className="math"><i>01</i><b>∑</b><span><small>{t('homeLite.intro.requiredBadge', '核心科目')}</small><strong>{t('homeLite.intro.mathTitle', '数学')}</strong><p>{t('homeLite.intro.mathRule', '函数、几何、概率与统计')}</p></span><em>{t('homeLite.intro.mathMeta', '60 分钟 · 48 题 · 100 分')}</em></article>
                <article className="chinese"><i>02</i><b>λ</b><span><small>{t('homeLite.intro.conditionalBadge', '理科训练')}</small><strong>{t('homeLite.intro.chineseTitle', '物理')}</strong><p>{t('homeLite.intro.chineseRule', '力学、电磁、热学与光学')}</p></span><em>{t('homeLite.intro.chineseMeta', '60 分钟 · 48 题 · 100 分')}</em></article>
                <article className="science"><i>03</i><b>H</b><span><small>{t('homeLite.intro.electiveBadge', '理科训练')}</small><strong>{t('homeLite.intro.scienceTitle', '化学')}</strong><p>{t('homeLite.intro.scienceRule', '物质结构、反应原理与有机基础')}</p></span><em>{t('homeLite.intro.scienceMeta', '60 分钟 · 48 题 · 100 分')}</em></article>
              </div>
            </section>

            <aside className="home-csca-schedule-panel">
              <div className="home-csca-next-window">
              <span>{t('homeLite.intro.nextExam', '下一场常规考试')}</span>
              <strong>{nextExamWindow.label}</strong>
              <small>{nextExamWindow.confirmed
                ? t('homeLite.intro.confirmedDate', '已公布日期')
                : t('homeLite.intro.pendingDate', '具体日期与报名时间待官方公布')}</small>
              <div className="home-csca-months" aria-label={t('homeLite.intro.frequencyValue', '每年 1、3、4、6、12 月')}>
                {['1', '3', '4', '6', '12'].map((month) => <b className={month === '12' ? 'active' : ''} key={month}>{month}{t('homeLite.intro.monthSuffix', '月')}</b>)}
              </div>
              </div>
              <div className="home-csca-logistics-facts">
                <span><Icon name="lucide:clock" /><small>{t('homeLite.intro.resultsLabel', '成绩公布')}</small><strong>{t('homeLite.intro.resultsValue', '网考 / 机考后 7 个工作日内')}</strong></span>
                <span><Icon name="lucide:badge-dollar-sign" /><small>{t('homeLite.intro.feesLabel', '考试费用')}</small><strong>{t('homeLite.intro.feesValue', '1 科 ¥450；2 科及以上 ¥700')}</strong></span>
              </div>
              <div className="home-csca-actions">
                <HomeLink href="#subjects" onNavigate={onNavigate} className="home-button primary">
                  <Icon name="lucide:book-open-check" />{t('homeLite.intro.checkSubjects', '查看我需要考哪些科目')}
                </HomeLink>
                <HomeLink href="#path" onNavigate={onNavigate} className="home-button">
                  <Icon name="lucide:calendar-clock" />{t('homeLite.intro.viewSchedule', '查看考试时间与报名信息')}
                </HomeLink>
                <p className="home-csca-source-note">
                  <Icon name="lucide:shield-check" />
                  <span>{t('homeLite.intro.requirementNote', '考试日期、费用和规则变化请以官方说明为准。')}</span>
                  <a href="https://csca.cn/about/examintro" target="_blank" rel="noreferrer">{t('homeLite.intro.officialSource', '查看官方说明')}</a>
                </p>
              </div>
            </aside>
          </div>

          <div className="home-csca-summary-grid">
            <article>
              <Icon name="lucide:graduation-cap" />
              <span><small>{t('homeLite.intro.audienceLabel', '适合谁使用')}</small><strong>{t('homeLite.intro.audienceValue', '正在准备 CSCA 的学生')}</strong><p>{t('homeLite.intro.audienceDescription', '从第一次诊断到考前复盘，都可以沿同一条学习路径推进。')}</p></span>
            </article>
            <article>
              <Icon name="lucide:file-check-2" />
              <span><small>{t('homeLite.intro.purposeLabel', '如何判断进步')}</small><strong>{t('homeLite.intro.purposeValue', '用真实作答持续校准薄弱点')}</strong><p>{t('homeLite.intro.purposeDescription', '每科独立记录覆盖、正确率、错题和验证结果，不用聊天次数代替掌握度。')}</p></span>
            </article>
            <article>
              <Icon name="lucide:globe-2" />
              <span><small>{t('homeLite.intro.formatLabel', '在哪里考试')}</small><strong>{t('homeLite.intro.formatValue', '居家网考为主，也有授权考点')}</strong><p>{t('homeLite.intro.formatDescription', '考点可采用集中机考或纸笔考试，实际形式以所在地区公告为准。')}</p></span>
            </article>
          </div>
        </div>
      </section>

      <div className="home-csca-bridge home-container" aria-hidden="true">
        <span>{t('homeLite.intro.bridge', '了解考试之后，下一步是先找到自己的薄弱点。')}</span>
        <i />
      </div>

      <section className="home-hero home-hero-prep home-container" data-home-hero="csca-mock-first">
        <div className="home-hero-grid">
          <div className="home-hero-copy" data-animate="slide-right">
            <span className="home-eyebrow">{copy.hero.kicker}</span>
            <h1><span className="home-headline-mark">{copy.hero.title}</span></h1>
            <p className="home-lead">{copy.hero.body}</p>
            <div className="home-button-row">
              <HomeLink href={routes.agent} onNavigate={onNavigate} className="home-button primary">
                <Icon name="lucide:play" />{t('homeLite.hero.startMock', '开始免费模考')}
              </HomeLink>
              <HomeLink href={`${routes.agent}?mode=free&subject=math`} onNavigate={onNavigate} className="home-button lime">
                <Icon name="lucide:list-checks" />{t('homeLite.hero.choosePractice', '进入科目训练')}
              </HomeLink>
            </div>
            <div className="home-micro-proof" aria-label={t('homeLite.hero.proofAria', '平台特点')}>
              {copy.proofPills.slice(0, 3).map((pill, index) => <span key={pill}><b>{String(index + 1).padStart(2, '0')}</b>{pill}</span>)}
            </div>
          </div>

          <aside className="home-hero-stage" aria-label={t('homeLite.visual.stageAria', '科目互动实验台')} data-animate="slide-left" style={{ '--delay': '120ms' } as CSSProperties}>
            <div className="home-kinetic-canvas">
              <div className="home-stage-label">
                <small>{activeSubject.kicker}</small>
                <strong>{activeSubject.title}</strong>
              </div>
              <div className="home-subject-visual active">
                <SubjectVisual subject={subject} ariaLabel={activeSubject.aria} />
              </div>
              <div className="home-floating-note note-a">
                <b>{activeSubject.noteTitle}</b>
                <span>{activeSubject.noteCopy}</span>
              </div>
              <div className="home-floating-note note-b">
                <b>{t('homeLite.visual.nextTitle', '下一步建议')}</b>
                <span>{t('homeLite.visual.nextBody', '模考结果会连到科目训练，不只停在一个总分。')}</span>
              </div>
              <div className={`home-sim-panel ${subject}`}>
                <header>
                  <span>{activeSubject.simTitle}</span>
                  <b>{activeSubject.simStatus}</b>
                </header>
                <div className="home-sim-readouts">
                  {activeSubject.simMetrics.map(([label, value]) => (
                    <span key={label}>
                      <small>{label}</small>
                      <b>{value}</b>
                    </span>
                  ))}
                </div>
                <p>{activeSubject.simHint}</p>
              </div>
            </div>

            <div className="home-subject-switcher" role="tablist" aria-label={t('homeLite.subjects.chooseAria', '选择科目')}>
              {subjects.map((item) => (
                <button
                  key={item.key}
                  className={subject === item.key ? 'home-subject-pill active' : 'home-subject-pill'}
                  type="button"
                  data-subject={item.key}
                  onClick={() => setSubject(item.key)}
                >
                  <span className="home-subject-sign">{item.sign}</span>
                  <span><b>{item.name}</b>{item.body}</span>
                </button>
              ))}
            </div>
          </aside>
        </div>
      </section>

      <section className="home-route-band home-container" id="routes">
        <div className="home-route-wrap">
          {routeCards.map((card, index) => (
            <HomeLink
              key={card.title}
              href={card.href}
              onNavigate={onNavigate}
              className={`home-route-card ${card.className}`}
            >
              <span className="home-route-top">
                <span className="home-route-icon"><Icon name={card.icon} /></span>
                {card.tag && <span className={index === 2 ? 'home-tag orange' : index === 1 ? 'home-tag green' : 'home-tag blue'}>{card.tag}</span>}
              </span>
              <span>
                {index === 0 ? <h2>{card.title}</h2> : <h3>{card.title}</h3>}
                <p>{card.body}</p>
              </span>
              <span className="home-arrow-link">{card.action}<Icon name="lucide:arrow-right" /></span>
            </HomeLink>
          ))}
        </div>
      </section>

      <section className="home-section home-science-lab-section home-container" id="science-lab" data-home-marker="home-science-lab">
        <div className="home-section-head">
          <div>
            <p className="home-section-kicker">{t('homeLite.lab.kicker', 'Interactive Science Lab')}</p>
            <h2>{t('homeLite.lab.title', '把抽象公式，变成可以观察和操作的过程。')}</h2>
          </div>
          <p>{t('homeLite.lab.body', '从空间几何、受力运动到分子结构，先建立直觉，再回到 CSCA 题目。首页只展示轻量预览，完整实验会在打开后加载。')}</p>
        </div>

        <div className="home-science-lab-grid">
          {([
            {
              key: 'math' as const,
              index: '01',
              title: t('homeLite.lab.mathTitle', '空间几何 3D'),
              body: t('homeLite.lab.mathBody', '旋转立体、切换辅助线，从不同视角理解线面关系与空间距离。'),
              meta: t('homeLite.lab.mathMeta', '可旋转 · 空间关系'),
              action: t('homeLite.lab.mathAction', '打开数学实验'),
              href: `${routes.agent}?mode=free&subject=math`
            },
            {
              key: 'physics' as const,
              index: '02',
              title: t('homeLite.lab.physicsTitle', '牛顿第二定律 3D'),
              body: t('homeLite.lab.physicsBody', '调节力和质量，实时观察加速度、速度与运动轨迹的变化。'),
              meta: t('homeLite.lab.physicsMeta', '实时参数 · F = ma'),
              action: t('homeLite.lab.physicsAction', '打开物理实验'),
              href: `${routes.agent}?mode=free&subject=physics`
            },
            {
              key: 'chem' as const,
              index: '03',
              title: t('homeLite.lab.chemTitle', '分子结构交互模型'),
              body: t('homeLite.lab.chemBody', '比较键型、Lewis 结构和空间构型，判断分子极性与性质。'),
              meta: t('homeLite.lab.chemMeta', '结构切换 · 键与极性'),
              action: t('homeLite.lab.chemAction', '打开化学实验'),
              href: `${routes.agent}?mode=free&subject=chemistry`
            }
          ]).map((lab) => (
            <HomeLink
              key={lab.key}
              href={lab.href}
              onNavigate={onNavigate}
              className={`home-science-lab-card ${lab.key}`}
              ariaLabel={`${lab.title} · ${lab.action}`}
            >
              <span className="home-science-lab-preview">
                <span className="home-science-lab-index">{lab.index}</span>
                <ScienceLabPreview subject={lab.key} />
                <span className="home-science-lab-live"><i />{t('homeLite.lab.interactive', '可交互')}</span>
              </span>
              <span className="home-science-lab-copy">
                <small>{lab.meta}</small>
                <strong>{lab.title}</strong>
                <span>{lab.body}</span>
                <b>{lab.action}<Icon name="lucide:arrow-up-right" /></b>
              </span>
            </HomeLink>
          ))}
        </div>
        <p className="home-science-lab-performance"><Icon name="lucide:gauge" />{t('homeLite.lab.performance', '轻量预览，打开实验后进入完整交互。')}</p>
      </section>

      <section className="home-section home-container" id="practice">
        <div className="home-section-head" data-animate>
          <div>
            <p className="home-section-kicker">{t('homeLite.practice.kicker', 'Mock Exam Surface')}</p>
            <h2>{copy.practice.title}</h2>
          </div>
          <p>{copy.practice.body}</p>
        </div>

        <div className="home-practice-board" data-mode={miniMockReport ? 'report' : 'answer'}>
          <article className="home-question-surface" data-animate="slide-right" data-home-marker="home-exam-slice">
            <div className="home-question-toolbar">
              <h3>{miniMockReport
                ? formatHomeText(t('homeLite.practice.reportHeading', '交卷报告 · 准备度 {score}'), { score: miniMockReport.summary.accuracy })
                : formatHomeText(t('homeLite.practice.quickHeading', '快速模考 · {done}/{total}'), { done: miniMockCheckedCount, total: miniMockQuestions.length || 12 })}</h3>
              <span className="home-timer">
                <Icon name={miniMockReport ? 'lucide:check-circle-2' : 'lucide:database'} />
                {miniMockReport ? t('homeLite.practice.completed', '已完成') : t('homeLite.practice.bankSample', '合格题库抽样')}
              </span>
            </div>
            <div className="home-question-body">
              <div className="home-mini-question-panel">
                {miniMockStatus === 'loading' && (
                  <div className="home-mini-empty">
                    <Icon name="lucide:loader-circle" />
                    <strong>{t('homeLite.practice.loadingTitle', '正在从合格题库抽题')}</strong>
                    <span>{t('homeLite.practice.loadingBody', '数学、物理、化学各 4 题。')}</span>
                  </div>
                )}

                {miniMockError && miniMockStatus !== 'loading' && (
                  <div className="home-mini-empty error">
                    <Icon name="lucide:circle-alert" />
                    <strong>{t('homeLite.practice.loadErrorTitle', '题库暂时不可用')}</strong>
                    <span>{miniMockError}</span>
                    <button type="button" className="home-mini-secondary" onClick={refreshMiniMock}>{t('homeLite.practice.retry', '重新抽题')}</button>
                  </div>
                )}

                {!miniMockError && miniMockStatus !== 'loading' && !activeMiniQuestion && (
                  <div className="home-mini-empty">
                    <Icon name="lucide:database-zap" />
                    <strong>{t('homeLite.practice.emptyTitle', '合格题库还没有足够题目')}</strong>
                    <span>{t('homeLite.practice.emptyBody', '这里不会再用假题补位，请先进入科目训练查看当前已发布题目。')}</span>
                    <HomeLink href={`${routes.agent}?mode=free&subject=math`} onNavigate={onNavigate} className="home-mini-secondary">{t('homeLite.practice.emptyAction', '查看科目训练')}</HomeLink>
                  </div>
                )}

                {activeMiniQuestion && (
                  <>
                    <div className="home-tag-row">
                      <span className={`home-tag ${MINI_MOCK_SUBJECTS[activeMiniQuestion.subject]?.className ?? ''}`}>
                        {subjectName(activeMiniQuestion.subject, t, activeMiniQuestion.subjectTitle)}
                      </span>
                      <span className="home-tag">{activeMiniQuestion.topic.module}</span>
                      <span className="home-tag green">{activeMiniQuestion.difficulty}</span>
                      <span className="home-tag blue">
                        {formatHomeText(t('homeLite.practice.questionProgress', 'Q{current} / {total}'), {
                          current: String(miniMockIndex + 1).padStart(2, '0'),
                          total: miniMockQuestions.length || miniMockReportItems.length
                        })}
                      </span>
                    </div>
                    <h2 className="home-stem"><MathContent text={activeMiniQuestion.prompt} /></h2>
                    <div className="home-choices">
                      {activeMiniQuestion.options.map((option) => {
                        const questionKey = String(activeMiniQuestion.id);
                        const selected = miniMockReport ? miniMockActiveResult?.selected : miniMockAnswers[questionKey];
                        const isSelected = selected === option.id;
                        const isRight = miniMockActiveResult?.correctAnswer === option.id;
                        const isWrong = Boolean(miniMockActiveResult && isSelected && !miniMockActiveResult.isCorrect);
                        const isChecking = Boolean(miniMockChecking[questionKey] && isSelected);
                        const className = [
                          'home-choice',
                          isSelected && !miniMockActiveResult ? 'active' : '',
                          isRight ? 'correct' : '',
                          isWrong ? 'wrong' : ''
                        ].filter(Boolean).join(' ');
                        return (
                          <button
                            key={option.id}
                            className={className}
                            type="button"
                            onClick={() => void chooseMiniMockAnswer(activeMiniQuestion.id, option.id)}
                            disabled={Boolean(miniMockReport) || miniMockStatus !== 'idle' || Boolean(miniMockActiveResult) || Boolean(miniMockChecking[questionKey])}
                          >
                            <strong>{option.id}</strong>
                            <span><MathContent text={option.text} /></span>
                            <small>{isChecking
                              ? t('homeLite.practice.checking', '判题中')
                              : isRight
                                ? t('homeLite.practice.correctAnswer', '正确答案')
                                : isWrong
                                  ? t('homeLite.practice.yourAnswer', '你的答案')
                                  : isSelected
                                    ? t('homeLite.practice.selected', '已选择')
                                    : ''}</small>
                          </button>
                        );
                      })}
                    </div>
                    {miniMockActiveResult ? (
                      <div className={miniMockActiveResult.isCorrect ? 'home-answer-note correct' : 'home-answer-note wrong'}>
                        <b>{miniMockActiveResult.isCorrect
                          ? t('homeLite.practice.correctPrefix', '答对了：')
                          : formatHomeText(t('homeLite.practice.wrongPrefix', '正确答案 {answer}：'), { answer: miniMockActiveResult.correctAnswer })}</b>
                        <MathContent text={miniMockActiveResult.explanation || t('homeLite.practice.noExplanation', '这道题暂时没有解析。')} />
                      </div>
                    ) : (
                      <div className="home-answer-note">
                        <b>{t('homeLite.practice.instantTitle', '选完马上看解析：')}</b>
                        {t('homeLite.practice.instantBody', '这里和真实科目训练保持一致，选择答案后立即判分并显示题库预设解析；全部答完后再生成三科总结。')}
                      </div>
                    )}
                    <div className="home-mini-controls">
                      <button type="button" className="home-mini-secondary" onClick={() => setMiniMockIndex((value) => Math.max(0, value - 1))} disabled={miniMockIndex === 0}>
                        <Icon name="lucide:arrow-left" />{t('homeLite.practice.previous', '上一题')}
                      </button>
                      <button type="button" className="home-mini-secondary" onClick={() => setMiniMockIndex((value) => Math.min((miniMockQuestions.length || miniMockReportItems.length) - 1, value + 1))} disabled={miniMockIndex >= (miniMockQuestions.length || miniMockReportItems.length) - 1}>
                        {t('homeLite.practice.next', '下一题')}<Icon name="lucide:arrow-right" />
                      </button>
                      {miniMockReport ? (
                        <button type="button" className="home-mini-primary" onClick={refreshMiniMock}><Icon name="lucide:refresh-cw" />{t('homeLite.practice.redo', '重做一组')}</button>
                      ) : (
                        <button type="button" className="home-mini-primary" onClick={startOnlineMock} disabled={!miniMockCompleted}>
                          <Icon name={miniMockCompleted ? 'lucide:play-circle' : 'lucide:send'} />
                          {miniMockCompleted
                            ? (hasHomeAuth ? t('homeLite.practice.enterMock', '进入在线模考') : t('homeLite.practice.loginEnterMock', '登录后进入模考'))
                            : formatHomeText(t('homeLite.practice.remaining', '还差 {count} 题'), { count: Math.max(0, miniMockQuestions.length - miniMockCheckedCount) })}
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>

              <aside className="home-question-map" aria-label={t('homeLite.practice.progressAria', '答题进度')}>
                <span className="home-map-title">{t('homeLite.practice.progressTitle', 'Progress map')}</span>
                <div className="home-map-grid">
                  {(miniMockReportItems.length ? miniMockReportItems : miniMockQuestions).map((question, index) => {
                    const result = miniMockReportItems.find((item) => item.id === question.id);
                    const className = [
                      index === miniMockIndex ? 'now' : '',
                      !miniMockReport && miniMockAnswers[String(question.id)] ? 'done' : '',
                      result?.isCorrect ? 'correct' : '',
                      result && !result.isCorrect ? 'wrong' : ''
                    ].filter(Boolean).join(' ');
                    return (
                      <button key={question.id} type="button" className={className} onClick={() => setMiniMockIndex(index)}>
                        {String(index + 1).padStart(2, '0')}
                      </button>
                    );
                  })}
                  {!miniMockQuestions.length && Array.from({ length: 12 }, (_, index) => (
                    <span key={index + 1}>
                      {String(index + 1).padStart(2, '0')}
                    </span>
                  ))}
                </div>
                <span className="home-tag lime">
                  {miniMockReport
                    ? t('homeLite.practice.readyMock', '可以进入在线模考')
                    : miniMockCanSubmit
                      ? t('homeLite.practice.generatingResult', '正在生成本轮结果')
                      : t('homeLite.practice.instantMap', '答完一题看一题解析')}
                </span>
              </aside>
            </div>
          </article>

          <aside className="home-insight-rail" aria-label={t('homeLite.practice.railAria', '学习反馈')} data-animate="slide-left" style={{ '--delay': '140ms' } as CSSProperties}>
            <div className="home-rail-card home-mini-score-card">
              <h3>{miniMockReport ? t('homeLite.practice.resultTitle', '本轮结果') : t('homeLite.practice.sampleTitle', '真实题库抽样')}</h3>
              <p>{miniMockReport
                ? formatHomeText(t('homeLite.practice.scoreSummary', '答对 {correct} 题，错 {wrong} 题，未答 {unanswered} 题。'), {
                  correct: miniMockReport.summary.correctCount,
                  wrong: miniMockReport.summary.wrongCount,
                  unanswered: miniMockReport.summary.unansweredCount
                })
                : t('homeLite.practice.sampleBody', '从已发布合格题库抽取 12 题，判题和解析都来自题库预设。')}</p>
              <div className="home-mini-score">
                <strong>{miniMockReport ? miniMockReport.summary.accuracy : miniMockCheckedCount}</strong>
                <span>{miniMockReport
                  ? t('homeLite.practice.scoreLabel', '准备度')
                  : formatHomeText(t('homeLite.practice.answeredLabel', '已答 / {total}'), { total: miniMockQuestions.length || 12 })}</span>
              </div>
              {miniMockReport && (
                <button type="button" className="home-mini-formal-cta" onClick={startOnlineMock}>
                  <Icon name={hasHomeAuth ? 'lucide:play-circle' : 'lucide:log-in'} />
                  {hasHomeAuth ? t('homeLite.practice.enterMock', '进入在线模考') : t('homeLite.practice.loginEnterMock', '登录后进入模考')}
                </button>
              )}
            </div>
            <div className="home-rail-card">
              <h3>{miniMockReport ? t('homeLite.practice.subjectAccuracy', '三科正确率') : t('homeLite.practice.subjectDistribution', '三科平均分布')}</h3>
              <p>{miniMockReport
                ? t('homeLite.practice.subjectAccuracyBody', '每科单独拆开，交卷后能看到该补哪一科。')
                : t('homeLite.practice.subjectDistributionBody', '默认数学、物理、化学各 4 题；题库不足时不会用假题填充。')}</p>
              <div className="home-subject-breakdown" aria-label={t('homeLite.practice.subjectDistributionAria', '三科分布')}>
                {miniMockSubjectRows.map((row) => {
                  const meta = MINI_MOCK_SUBJECTS[row.id];
                  return (
                    <div key={row.id} className={`home-subject-breakdown-row ${meta?.className ?? ''}`}>
                      <span>{meta?.sign}</span>
                      <b>{subjectName(row.id, t, row.title)}</b>
                      <i><em style={{ width: `${miniMockReport ? row.accuracy : Math.min(100, (row.total / Math.max(1, miniMock?.perSubjectTarget ?? 4)) * 100)}%` }} /></i>
                      <small>{miniMockReport
                        ? `${row.correctCount}/${row.total}`
                        : formatHomeText(t('homeLite.practice.questionCount', '{done}/{total} 题'), {
                          done: row.total,
                          total: miniMock?.perSubjectTarget ?? 4
                        })}</small>
                    </div>
                  );
                })}
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section className="home-section home-container" id="subjects">
        <div className="home-section-head" data-animate>
          <div>
            <p className="home-section-kicker">{t('homeLite.subjectSection.kicker', 'Subject Practice')}</p>
            <h2>{copy.subjects.title}</h2>
          </div>
          <p>{copy.subjects.body}</p>
        </div>

        <div className="home-subject-lanes">
          {[
            ['math', '∑', t('homeLite.subjectSection.mathTitle', '数学：从图像看规律'), t('homeLite.subjectSection.mathBody', '函数、几何、概率统计用曲线、坐标和变化趋势进入题目，先看规律，再进入计算。'), [t('homeLite.subjectSection.mathTag1', '函数图像'), t('homeLite.subjectSection.mathTag2', '几何关系'), t('homeLite.subjectSection.mathTag3', '概率统计')]],
            ['physics', 'λ', t('homeLite.subjectSection.physicsTitle', '物理：让运动先出现'), t('homeLite.subjectSection.physicsBody', '力、波、电磁和运动轨迹先被看见，公式不再只是一串孤立符号。'), [t('homeLite.subjectSection.physicsTag1', '力学'), t('homeLite.subjectSection.physicsTag2', '波形'), t('homeLite.subjectSection.physicsTag3', '电磁')]],
            ['chem', 'H', t('homeLite.subjectSection.chemTitle', '化学：从结构进入概念'), t('homeLite.subjectSection.chemBody', '分子结构、化学键、反应关系放在同一条题目线索里，减少死记硬背感。'), [t('homeLite.subjectSection.chemTag1', '结构与键'), t('homeLite.subjectSection.chemTag2', '反应关系'), t('homeLite.subjectSection.chemTag3', '溶液有机')]]
          ].map(([key, sign, title, body, tags]) => (
            <article key={key as string} className={`home-lane ${key}`} data-animate={key === 'physics' ? 'slide-left' : 'slide-right'}>
              <div className="home-lane-sign">{sign as string}</div>
              <div className="home-lane-copy">
                <h3>{title as string}</h3>
                <p>{body as string}</p>
              </div>
              <div className="home-lane-mini">
                {(tags as string[]).map((tag) => <span key={tag}>{tag}</span>)}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="home-section home-container" id="path">
        <div className="home-section-head" data-animate>
          <div>
            <p className="home-section-kicker">{t('homeLite.path.kicker', 'Learning Path')}</p>
            <h2>{copy.prep.title}</h2>
          </div>
          <p>{copy.prep.body}</p>
        </div>

        <div className="home-path-canvas" id="review" data-animate>
          {[
            ['01', t('homeLite.path.step1Title', '模考定位'), t('homeLite.path.step1Body', '先完成一套限时题，建立当前水平和时间分配感。')],
            ['02', t('homeLite.path.step2Title', '错因诊断'), t('homeLite.path.step2Body', '把错误归到知识点、题型和常见陷阱，而不是只展示分数。')],
            ['03', t('homeLite.path.step3Title', '科目复盘'), t('homeLite.path.step3Body', '系统把薄弱点推回短题组，练到同类题能稳定答对。')],
            ['04', t('homeLite.path.step4Title', '回到在线模考'), t('homeLite.path.step4Body', '复盘后再做一套在线模考，确认速度、准确率和题型稳定度。')]
          ].map(([num, title, body], index) => (
            <article key={num} className="home-path-step" data-animate="pop" style={{ '--delay': `${index * 130}ms` } as CSSProperties}>
              <span className="home-step-num">{num}</span>
              <span>
                <h3>{title}</h3>
                <p>{body}</p>
              </span>
            </article>
          ))}
        </div>
      </section>

      <section className="home-footer-cta home-container" data-animate>
        <div className="home-footer-cta-inner">
          <div className="home-footer-floaters" aria-hidden="true">
            <span className="home-footer-floater symbol one">∑</span>
            <span className="home-footer-floater symbol two" style={{ '--delay': '.6s' } as CSSProperties}>λ</span>
            <span className="home-footer-floater card three" style={{ '--delay': '.2s' } as CSSProperties}><b>{t('homeLite.footer.wrongFlow', '错题回流')}</b><span>{t('homeLite.footer.reviewQueue', 'review queue +4')}</span></span>
            <span className="home-footer-floater card four" style={{ '--delay': '.9s' } as CSSProperties}><b>{t('homeLite.footer.trainingAdvice', '训练建议')}</b><span>{t('homeLite.footer.nextDrill', 'next drill ready')}</span></span>
          </div>
          <span className="home-footer-launch-badge">{t('homeLite.footer.badge', 'Ready for next drill')}</span>
          <div>
            <h2>{copy.closing}</h2>
            <p>{copy.library.body}</p>
          </div>
          <div className="home-button-row">
            <HomeLink href={routes.agent} onNavigate={onNavigate} className="home-button primary"><Icon name="lucide:play" />{t('homeLite.footer.startMock', '开始模考')}</HomeLink>
            <HomeLink href={routes.agent} onNavigate={onNavigate} className="home-button"><Icon name="lucide:book-open-check" />{t('homeLite.footer.consulting', 'CSCA 备考')}</HomeLink>
          </div>
          <div className="home-footer-landing-pad" aria-hidden="true">
            <svg viewBox="0 0 360 126">
              <path className="home-orbit-line" d="M18 42 C88 118 168 116 226 58 S318 -4 344 84" />
              <circle className="home-orbit-dot" style={{ '--delay': '240ms' } as CSSProperties} cx="72" cy="78" r="7" fill="#315dff" />
              <circle className="home-orbit-dot" style={{ '--delay': '380ms' } as CSSProperties} cx="186" cy="88" r="7" fill="#13c7a3" />
              <circle className="home-orbit-dot" style={{ '--delay': '520ms' } as CSSProperties} cx="304" cy="42" r="7" fill="#ff715e" />
            </svg>
          </div>
        </div>
      </section>
    </div>
  );
}

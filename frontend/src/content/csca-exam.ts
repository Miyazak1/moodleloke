import type { PublicContentBlock } from '../lib/api-types';

export type CscaExamFee = {
  label: string;
  value: string;
  note?: string;
};

export type CscaExamSubject = {
  name: string;
  language: string;
  durationMinutes: number;
  questions: string;
  scoreRange: string;
  syllabusItems: string[];
};

export type CscaExamSession = {
  subject: string;
  startsAtBeijing: string;
  endsAtBeijing: string;
};

export type CscaExamSchedule = {
  title: string;
  subtitle: string;
  nextExamDate: string;
  registrationWindow: {
    start: string;
    end: string;
    timezone: string;
  };
  regularScheduleText: string;
  scoreReleaseText: string;
  examFormat: {
    mode: string;
    location: string;
    delivery: string;
    scoreRange: string;
  };
  fees: CscaExamFee[];
  subjects: CscaExamSubject[];
  sessions: CscaExamSession[];
  sourceUrl: string;
  sourceLabel: string;
  lastVerifiedAt: string;
  updatedAt?: string;
};

export const CSCA_EXAM_BLOCK_KEY = 'csca.exam.schedule';

export const DEFAULT_CSCA_EXAM_SCHEDULE: CscaExamSchedule = {
  title: '2026年 CSCA 考试安排',
  subtitle: '考试时间与费用',
  nextExamDate: '2026-06-27',
  registrationWindow: {
    start: '2026-04-01T12:00:00+08:00',
    end: '2026-04-09T12:00:00+08:00',
    timezone: 'Asia/Shanghai'
  },
  regularScheduleText: '2026年起每年5次：1月、3月、4月、6月、12月',
  scoreReleaseText: '居家网考和集中机考考后7个工作日内；纸笔考试考后14个工作日内',
  examFormat: {
    mode: '在线机考',
    location: '线上、线下考点',
    delivery: '按科目分时段完成',
    scoreRange: '每科 0-100 分'
  },
  fees: [
    { label: '单科报名', value: '¥450 CNY' },
    { label: '两科及以上', value: '¥700 CNY' },
    { label: '备注', value: '费用以报名系统公布为准' }
  ],
  subjects: [
    { name: '中文（文科）', language: '仅中文', durationMinutes: 90, questions: '50道选择题', scoreRange: '0-100', syllabusItems: ['现代汉语基础', '文学常识与运用', '阅读理解'] },
    { name: '中文（理科）', language: '仅中文', durationMinutes: 90, questions: '50道选择题', scoreRange: '0-100', syllabusItems: ['语言表达', '基础阅读', '学术中文'] },
    { name: '数学', language: '中文或英文', durationMinutes: 60, questions: '48道选择题', scoreRange: '0-100', syllabusItems: ['代数与函数', '解析几何', '概率与统计'] },
    { name: '物理', language: '中文或英文', durationMinutes: 60, questions: '48道选择题', scoreRange: '0-100', syllabusItems: ['力学', '电磁学', '热学与光学'] },
    { name: '化学', language: '中文或英文', durationMinutes: 60, questions: '48道选择题', scoreRange: '0-100', syllabusItems: ['物质结构', '化学反应原理', '有机化学基础'] }
  ],
  sessions: [
    { subject: '专业中文', startsAtBeijing: '2026-06-27T12:00:00+08:00', endsAtBeijing: '2026-06-27T13:30:00+08:00' },
    { subject: '物理', startsAtBeijing: '2026-06-27T15:00:00+08:00', endsAtBeijing: '2026-06-27T16:00:00+08:00' },
    { subject: '数学', startsAtBeijing: '2026-06-27T18:00:00+08:00', endsAtBeijing: '2026-06-27T19:00:00+08:00' },
    { subject: '化学', startsAtBeijing: '2026-06-27T20:30:00+08:00', endsAtBeijing: '2026-06-27T21:30:00+08:00' }
  ],
  sourceUrl: 'https://csca.cn/about/examintro',
  sourceLabel: 'CSCA 官方报名与考试信息',
  lastVerifiedAt: '2026-09-29'
};

function readString(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}
function readNumber(value: unknown, fallback: number) {
  const next = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(next) && next > 0 ? next : fallback;
}
function readRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function readArray<T>(value: unknown, fallback: T[], mapper: (value: unknown, index: number) => T) {
  return Array.isArray(value) && value.length ? value.map(mapper) : fallback;
}

function readStringArray(value: unknown, fallback: string[]) {
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : fallback;
}

export function mergeCscaExamScheduleFromBlocks(blocks: PublicContentBlock[]): CscaExamSchedule {
  const block = blocks.find((item) => item.key === CSCA_EXAM_BLOCK_KEY);
  if (!block) return DEFAULT_CSCA_EXAM_SCHEDULE;

  const body = readRecord(block.body);
  const fallback = DEFAULT_CSCA_EXAM_SCHEDULE;
  const registrationWindow = readRecord(body.registrationWindow);
  const examFormat = readRecord(body.examFormat);

  return {
    title: block.title || fallback.title,
    subtitle: block.subtitle || fallback.subtitle,
    nextExamDate: readString(body.nextExamDate, fallback.nextExamDate),
    registrationWindow: {
      start: readString(registrationWindow.start, fallback.registrationWindow.start),
      end: readString(registrationWindow.end, fallback.registrationWindow.end),
      timezone: readString(registrationWindow.timezone, fallback.registrationWindow.timezone)
    },
    regularScheduleText: readString(body.regularScheduleText, fallback.regularScheduleText),
    scoreReleaseText: readString(body.scoreReleaseText, fallback.scoreReleaseText),
    examFormat: {
      mode: readString(examFormat.mode, fallback.examFormat.mode),
      location: readString(examFormat.location, fallback.examFormat.location),
      delivery: readString(examFormat.delivery, fallback.examFormat.delivery),
      scoreRange: readString(examFormat.scoreRange, fallback.examFormat.scoreRange)
    },
    fees: readArray(body.fees, fallback.fees, (item, index) => {
      const record = readRecord(item);
      const fallbackItem = fallback.fees[index] ?? fallback.fees[0];
      return {
        label: readString(record.label, fallbackItem.label),
        value: readString(record.value, fallbackItem.value),
        note: readString(record.note, fallbackItem.note ?? '')
      };
    }),
    subjects: readArray(body.subjects, fallback.subjects, (item, index) => {
      const record = readRecord(item);
      const fallbackItem = fallback.subjects[index] ?? fallback.subjects[0];
      return {
        name: readString(record.name, fallbackItem.name),
        language: readString(record.language, fallbackItem.language),
        durationMinutes: readNumber(record.durationMinutes, fallbackItem.durationMinutes),
        questions: readString(record.questions, fallbackItem.questions),
        scoreRange: readString(record.scoreRange, fallbackItem.scoreRange),
        syllabusItems: readStringArray(record.syllabusItems, fallbackItem.syllabusItems)
      };
    }),
    sessions: readArray(body.sessions, fallback.sessions, (item, index) => {
      const record = readRecord(item);
      const fallbackItem = fallback.sessions[index] ?? fallback.sessions[0];
      return {
        subject: readString(record.subject, fallbackItem.subject),
        startsAtBeijing: readString(record.startsAtBeijing, fallbackItem.startsAtBeijing),
        endsAtBeijing: readString(record.endsAtBeijing, fallbackItem.endsAtBeijing)
      };
    }),
    sourceUrl: readString(body.sourceUrl, fallback.sourceUrl),
    sourceLabel: readString(body.sourceLabel, fallback.sourceLabel),
    lastVerifiedAt: readString(body.lastVerifiedAt, fallback.lastVerifiedAt),
    updatedAt: block.updatedAt
  };
}

export function formatChinaDate(value: string) {
  const date = new Date(`${value}T00:00:00+08:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Shanghai' }).format(date);
}

export function formatBeijingTimeRange(start: string, end: string) {
  const formatter = new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Shanghai' });
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return '';
  return `${formatter.format(startDate)} - ${formatter.format(endDate)}`;
}
export function formatDateTimeRange(start: string, end: string, timeZone = 'Asia/Shanghai') {
  const formatter = new Intl.DateTimeFormat('zh-CN', {
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone
  });
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return '';
  return `${formatter.format(startDate)} - ${formatter.format(endDate)}`;
}

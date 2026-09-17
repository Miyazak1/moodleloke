import type { StudentProfile } from '../lib/api-types';
import { useI18n } from '../i18n/useI18n';
import { Icon } from './Icon';

export type StudentProfileDraft = {
  genderCode: string;
  countryCode: string;
  educationStageCode: string;
  gradeCode: string;
  graduationYear: string;
  targetExamMonth: string;
  targetSubjectCodes: string[];
  preferredQuestionLanguageCode: string;
  examAttemptType: string;
  weeklyGoalDays: string;
  targetMajorCategoryCode: string;
};

export const EMPTY_STUDENT_PROFILE_DRAFT: StudentProfileDraft = {
  genderCode: '',
  countryCode: '',
  educationStageCode: '',
  gradeCode: '',
  graduationYear: '',
  targetExamMonth: '',
  targetSubjectCodes: [],
  preferredQuestionLanguageCode: '',
  examAttemptType: 'undecided',
  weeklyGoalDays: '',
  targetMajorCategoryCode: 'undecided'
};

export function studentProfileToDraft(profile: StudentProfile): StudentProfileDraft {
  return {
    genderCode: profile.genderCode ?? '',
    countryCode: profile.countryCode ?? '',
    educationStageCode: profile.educationStageCode ?? '',
    gradeCode: profile.gradeCode ?? '',
    graduationYear: profile.graduationYear ? String(profile.graduationYear) : '',
    targetExamMonth: profile.targetExamDate?.slice(0, 7) ?? '',
    targetSubjectCodes: profile.targetSubjectCodes ?? [],
    preferredQuestionLanguageCode: profile.preferredQuestionLanguageCode ?? '',
    examAttemptType: profile.examAttemptType ?? 'undecided',
    weeklyGoalDays: profile.weeklyGoalDays ? String(profile.weeklyGoalDays) : '',
    targetMajorCategoryCode: profile.targetMajorCategoryCode ?? 'undecided'
  };
}

export function studentProfileDraftPayload(draft: StudentProfileDraft) {
  return {
    genderCode: draft.genderCode || null,
    countryCode: draft.countryCode || null,
    educationStageCode: draft.educationStageCode || null,
    gradeCode: draft.gradeCode || null,
    graduationYear: draft.graduationYear ? Number(draft.graduationYear) : null,
    targetExamDate: draft.targetExamMonth || null,
    targetSubjectCodes: draft.targetSubjectCodes,
    preferredQuestionLanguageCode: draft.preferredQuestionLanguageCode || null,
    examAttemptType: draft.examAttemptType || null,
    weeklyGoalDays: draft.weeklyGoalDays ? Number(draft.weeklyGoalDays) : null,
    targetMajorCategoryCode: draft.targetMajorCategoryCode || null
  };
}

const COPY = {
  'zh-CN': {
    optional: '可选', required: '必填', gender: '性别', country: '当前居住国家或地区', stage: '教育阶段', grade: '当前年级', graduation: '预计高中毕业年份',
    exam: '预计考试月份', subjects: '备考科目', language: '题目与解析语言', attempt: '考试经历', weekly: '每周学习目标', major: '目标专业方向',
    select: '请选择', male: '男', female: '女', other: '其他', private: '不愿透露', middle: '初中', high: '高中在读', graduate: '高中毕业', foundation: '预科或语言项目', undergraduate: '本科阶段',
    first: '首次备考', retake: '再次备考', undecided: '尚未确定', chinese: '中文', english: '英文', bilingual: '中英双语', days: '每周 {count} 天',
    math: '数学', physics: '物理', chemistry: '化学', cs: '计算机科学', engineering: '工程', medicine: '医学', science: '自然科学', business: '商科'
  },
  en: {
    optional: 'Optional', required: 'Required', gender: 'Gender', country: 'Current country or region', stage: 'Education stage', grade: 'Current grade', graduation: 'Expected high school graduation year',
    exam: 'Expected exam month', subjects: 'CSCA subjects', language: 'Question and explanation language', attempt: 'Exam experience', weekly: 'Weekly study goal', major: 'Target major area',
    select: 'Select', male: 'Male', female: 'Female', other: 'Other', private: 'Prefer not to say', middle: 'Middle school', high: 'High school', graduate: 'High school graduate', foundation: 'Foundation or language program', undergraduate: 'Undergraduate',
    first: 'First attempt', retake: 'Retaking', undecided: 'Not decided', chinese: 'Chinese', english: 'English', bilingual: 'Chinese and English', days: '{count} days per week',
    math: 'Math', physics: 'Physics', chemistry: 'Chemistry', cs: 'Computer Science', engineering: 'Engineering', medicine: 'Medicine', science: 'Natural Sciences', business: 'Business'
  },
  vi: {
    optional: 'Không bắt buộc', required: 'Bắt buộc', gender: 'Giới tính', country: 'Quốc gia hoặc khu vực hiện tại', stage: 'Giai đoạn học tập', grade: 'Lớp hiện tại', graduation: 'Năm dự kiến tốt nghiệp THPT',
    exam: 'Tháng dự kiến thi', subjects: 'Môn ôn CSCA', language: 'Ngôn ngữ câu hỏi và giải thích', attempt: 'Kinh nghiệm thi', weekly: 'Mục tiêu học hằng tuần', major: 'Nhóm ngành mục tiêu',
    select: 'Chọn', male: 'Nam', female: 'Nữ', other: 'Khác', private: 'Không muốn tiết lộ', middle: 'THCS', high: 'Đang học THPT', graduate: 'Đã tốt nghiệp THPT', foundation: 'Dự bị hoặc ngôn ngữ', undergraduate: 'Đại học',
    first: 'Thi lần đầu', retake: 'Ôn thi lại', undecided: 'Chưa xác định', chinese: 'Tiếng Trung', english: 'Tiếng Anh', bilingual: 'Trung-Anh', days: '{count} ngày mỗi tuần',
    math: 'Toán', physics: 'Vật lý', chemistry: 'Hóa học', cs: 'Khoa học máy tính', engineering: 'Kỹ thuật', medicine: 'Y khoa', science: 'Khoa học tự nhiên', business: 'Kinh doanh'
  }
} as const;

const COUNTRY_CODES = ['CN', 'VN', 'ID', 'TH', 'MY', 'PH', 'KH', 'LA', 'MM', 'SG', 'PK', 'BD', 'IN', 'KZ', 'UZ', 'RU', 'US', 'GB', 'AU', 'CA'] as const;
const COUNTRY_LABELS = {
  'zh-CN': { CN: '中国', VN: '越南', ID: '印度尼西亚', TH: '泰国', MY: '马来西亚', PH: '菲律宾', KH: '柬埔寨', LA: '老挝', MM: '缅甸', SG: '新加坡', PK: '巴基斯坦', BD: '孟加拉国', IN: '印度', KZ: '哈萨克斯坦', UZ: '乌兹别克斯坦', RU: '俄罗斯', US: '美国', GB: '英国', AU: '澳大利亚', CA: '加拿大' },
  en: { CN: 'China', VN: 'Vietnam', ID: 'Indonesia', TH: 'Thailand', MY: 'Malaysia', PH: 'Philippines', KH: 'Cambodia', LA: 'Laos', MM: 'Myanmar', SG: 'Singapore', PK: 'Pakistan', BD: 'Bangladesh', IN: 'India', KZ: 'Kazakhstan', UZ: 'Uzbekistan', RU: 'Russia', US: 'United States', GB: 'United Kingdom', AU: 'Australia', CA: 'Canada' },
  vi: { CN: 'Trung Quốc', VN: 'Việt Nam', ID: 'Indonesia', TH: 'Thái Lan', MY: 'Malaysia', PH: 'Philippines', KH: 'Campuchia', LA: 'Lào', MM: 'Myanmar', SG: 'Singapore', PK: 'Pakistan', BD: 'Bangladesh', IN: 'Ấn Độ', KZ: 'Kazakhstan', UZ: 'Uzbekistan', RU: 'Nga', US: 'Hoa Kỳ', GB: 'Vương quốc Anh', AU: 'Úc', CA: 'Canada' }
} as const;

const GRADE_CODES = ['SCHOOL_G10', 'SCHOOL_G11', 'SCHOOL_G12', 'INTL_G9', 'INTL_G10', 'INTL_G11', 'INTL_G12', 'FOUNDATION', 'UNDERGRAD_PREP', 'GAP_YEAR'] as const;
const GRADE_LABELS = {
  'zh-CN': { SCHOOL_G10: '高一（10 年级）', SCHOOL_G11: '高二（11 年级）', SCHOOL_G12: '高三（12 年级）', INTL_G9: '国际课程 Year 10 / IGCSE 1', INTL_G10: '国际课程 Year 11 / IGCSE', INTL_G11: '国际课程 Year 12 / AS / IB DP1', INTL_G12: '国际课程 Year 13 / A Level / IB DP2', FOUNDATION: '预科', UNDERGRAD_PREP: '本科预备或语言阶段', GAP_YEAR: '间隔年或毕业申请阶段' },
  en: { SCHOOL_G10: 'Grade 10', SCHOOL_G11: 'Grade 11', SCHOOL_G12: 'Grade 12', INTL_G9: 'Year 10 / IGCSE 1', INTL_G10: 'Year 11 / IGCSE', INTL_G11: 'Year 12 / AS / IB DP1', INTL_G12: 'Year 13 / A Level / IB DP2', FOUNDATION: 'Foundation program', UNDERGRAD_PREP: 'University preparation or language program', GAP_YEAR: 'Gap year or application stage' },
  vi: { SCHOOL_G10: 'Lớp 10', SCHOOL_G11: 'Lớp 11', SCHOOL_G12: 'Lớp 12', INTL_G9: 'Year 10 / IGCSE 1', INTL_G10: 'Year 11 / IGCSE', INTL_G11: 'Year 12 / AS / IB DP1', INTL_G12: 'Year 13 / A Level / IB DP2', FOUNDATION: 'Chương trình dự bị', UNDERGRAD_PREP: 'Dự bị đại học hoặc khóa ngôn ngữ', GAP_YEAR: 'Gap year hoặc giai đoạn nộp hồ sơ' }
} as const;

type StudentProfileSection = 'basic' | 'basic-core' | 'basic-optional' | 'exam' | 'preferences' | 'agent-context' | 'plan' | 'all';

export function StudentProfileFields({ draft, onChange, section = 'all', showRequirementLabels = false }: { draft: StudentProfileDraft; onChange: (draft: StudentProfileDraft) => void; section?: StudentProfileSection; showRequirementLabels?: boolean }) {
  const { locale } = useI18n();
  const copy = COPY[locale];
  const set = (key: keyof StudentProfileDraft, value: string | string[]) => onChange({ ...draft, [key]: value });
  const option = (value: string, label: string) => <option key={value} value={value}>{label}</option>;
  const basic = section === 'basic' || section === 'all';
  const basicCore = basic || section === 'basic-core';
  const basicOptional = basic || section === 'basic-optional';
  const plan = section === 'plan' || section === 'all';
  const exam = plan || section === 'exam';
  const preferences = plan || section === 'preferences';
  const agentContext = section === 'agent-context';
  const required = showRequirementLabels ? <small className="field-requirement required">{copy.required}</small> : null;

  return (
    <div className="student-profile-fields">
      {basicCore && <>
        <label><span>{copy.stage}{required}</span><select required value={draft.educationStageCode} onChange={(event) => set('educationStageCode', event.target.value)}><option value="">{copy.select}</option>{option('middle_school', copy.middle)}{option('high_school', copy.high)}{option('high_school_graduate', copy.graduate)}{option('foundation', copy.foundation)}{option('undergraduate', copy.undergraduate)}{option('other', copy.other)}</select></label>
        <label><span>{copy.grade} <small>{copy.optional}</small></span><select value={draft.gradeCode} onChange={(event) => set('gradeCode', event.target.value)}><option value="">{copy.select}</option>{GRADE_CODES.map((value) => option(value, GRADE_LABELS[locale][value]))}</select></label>
      </>}
      {basicOptional && <>
        <label><span>{copy.gender} <small>{copy.optional}</small></span><select value={draft.genderCode} onChange={(event) => set('genderCode', event.target.value)}><option value="">{copy.select}</option>{option('male', copy.male)}{option('female', copy.female)}{option('other', copy.other)}{option('prefer_not_to_say', copy.private)}</select></label>
        <label><span>{copy.country} <small>{copy.optional}</small></span><select value={draft.countryCode} onChange={(event) => set('countryCode', event.target.value)}><option value="">{copy.select}</option>{COUNTRY_CODES.map((value) => option(value, COUNTRY_LABELS[locale][value]))}</select></label>
        <label><span>{copy.graduation} <small>{copy.optional}</small></span><input type="number" min="2020" max="2100" inputMode="numeric" value={draft.graduationYear} onChange={(event) => set('graduationYear', event.target.value)} placeholder="2027" /></label>
      </>}
      {exam && <>
        <fieldset className="student-profile-subjects"><legend>{copy.subjects}{required}</legend>{([['math', copy.math], ['physics', copy.physics], ['chemistry', copy.chemistry]] as const).map(([value, label]) => <label key={value}><input type="checkbox" value={value} checked={draft.targetSubjectCodes.includes(value)} onChange={(event) => set('targetSubjectCodes', event.target.checked ? [...draft.targetSubjectCodes, value] : draft.targetSubjectCodes.filter((item) => item !== value))} /><span><Icon name={value === 'math' ? 'lucide:sigma' : value === 'physics' ? 'lucide:atom' : 'lucide:flask-conical'} color="currentColor" />{label}</span></label>)}</fieldset>
        <label><span>{copy.exam} <small>{copy.optional}</small></span><input type="month" value={draft.targetExamMonth} onChange={(event) => set('targetExamMonth', event.target.value)} /></label>
      </>}
      {(exam || agentContext) && <>
        <label><span>{copy.language}{required}</span><select required value={draft.preferredQuestionLanguageCode} onChange={(event) => set('preferredQuestionLanguageCode', event.target.value)}><option value="">{copy.select}</option>{option('zh-CN', copy.chinese)}{option('en', copy.english)}{option('bilingual', copy.bilingual)}</select></label>
        <label><span>{copy.attempt} <small>{copy.optional}</small></span><select value={draft.examAttemptType} onChange={(event) => set('examAttemptType', event.target.value)}>{option('undecided', copy.undecided)}{option('first', copy.first)}{option('retake', copy.retake)}</select></label>
      </>}
      {preferences && <>
        <label><span>{copy.weekly} <small>{copy.optional}</small></span><select value={draft.weeklyGoalDays} onChange={(event) => set('weeklyGoalDays', event.target.value)}><option value="">{copy.select}</option>{[1, 2, 3, 4, 5, 6, 7].map((value) => option(String(value), copy.days.replace('{count}', String(value))))}</select></label>
      </>}
      {(preferences || agentContext) && <label><span>{copy.major} <small>{copy.optional}</small></span><select value={draft.targetMajorCategoryCode} onChange={(event) => set('targetMajorCategoryCode', event.target.value)}>{option('undecided', copy.undecided)}{option('computer_science', copy.cs)}{option('engineering', copy.engineering)}{option('medicine', copy.medicine)}{option('natural_sciences', copy.science)}{option('business', copy.business)}{option('other', copy.other)}</select></label>}
    </div>
  );
}

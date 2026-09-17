import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, SchoolStatus, SchoolType } from '@prisma/client';
import { recordAdminAudit } from '../admin-audit/admin-audit-log';
import { assertActorId, assertOptionalUrl, assertRecord, assertRequiredString, cleanNullableString } from '../common/validation';
import { PrismaService } from '../prisma/prisma.service';
import { PUBLIC_SCHOOL_DATA_EXCLUSION, buildPublishedSchoolWhere } from './schools.query';
import {
  AdminSchoolCreateInput,
  AdminSchoolCscaRuleInput,
  AdminSchoolCscaRuleUpdateInput,
  AdminSchoolDetail,
  AdminSchoolImportInput,
  AdminSchoolProgramInput,
  AdminSchoolProgramUpdateInput,
  AdminSchoolScholarshipInput,
  AdminSchoolScholarshipUpdateInput,
  AdminSchoolSummary,
  AdminSchoolUpdateInput,
  SchoolChangeLogRecord,
  SchoolProgramRecord,
  SchoolListFacets,
  SchoolListResult,
  SchoolRecord,
  SchoolSearchQuery
} from './schools.types';

const LAST_VERIFIED_AT = '2026-04-30';
type PublicLocale = 'zh-CN' | 'en';
const SCHOOL_NAME_EN_OVERRIDES: Record<string, string> = {
  '安徽大学': 'Anhui University',
  '北京大学': 'Peking University',
  '北京大学医学部': 'Peking University Health Science Center',
  '北京航空航天大学': 'Beihang University',
  '北京科技大学': 'University of Science and Technology Beijing',
  '北京理工大学': 'Beijing Institute of Technology',
  '北京师范大学': 'Beijing Normal University',
  '北京体育大学': 'Beijing Sport University',
  '北京语言大学': 'Beijing Language and Culture University',
  '清华大学': 'Tsinghua University',
  '大连交通大学': 'Dalian Jiaotong University',
  '大连理工大学': 'Dalian University of Technology',
  '电子科技大学': 'University of Electronic Science and Technology of China',
  '东华大学': 'Donghua University',
  '东南大学': 'Southeast University',
  '对外经济贸易大学': 'University of International Business and Economics',
  '复旦大学': 'Fudan University',
  '甘肃中医药大学': 'Gansu University of Chinese Medicine',
  '广东外语外贸大学': 'Guangdong University of Foreign Studies',
  '广西医科大学': 'Guangxi Medical University',
  '贵州医科大学': 'Guizhou Medical University',
  '哈尔滨工程大学': 'Harbin Engineering University',
  '哈尔滨工业大学深圳': 'Harbin Institute of Technology Shenzhen',
  '哈尔滨理工大学': 'Harbin University of Science and Technology',
  '河北经贸大学': 'Hebei University of Economics and Business',
  '华东师范大学': 'East China Normal University',
  '华东政法大学': 'East China University of Political Science and Law',
  '华中科技大学': 'Huazhong University of Science and Technology',
  '华中师范大学': 'Central China Normal University',
  '吉林大学': 'Jilin University',
  '暨南大学': 'Jinan University',
  '兰州大学': 'Lanzhou University',
  '辽宁中医药大学': 'Liaoning University of Traditional Chinese Medicine',
  '南京航空航天大学': 'Nanjing University of Aeronautics and Astronautics',
  '南京大学': 'Nanjing University',
  '南京理工大学': 'Nanjing University of Science and Technology',
  '南开大学': 'Nankai University',
  '南方科技大学': 'Southern University of Science and Technology',
  '青岛大学': 'Qingdao University',
  '厦门大学': 'Xiamen University',
  '山东师范大学': 'Shandong Normal University',
  '山东大学': 'Shandong University',
  '上海交通大学': 'Shanghai Jiao Tong University',
  '上海交通大学医学院': 'Shanghai Jiao Tong University School of Medicine',
  '上海外国语大学': 'Shanghai International Studies University',
  '上海政法学院': 'Shanghai University of Political Science and Law',
  '四川外国语大学': 'Sichuan International Studies University',
  '天津财经大学': 'Tianjin University of Finance and Economics',
  '天津大学': 'Tianjin University',
  '天津外国语大学': 'Tianjin Foreign Studies University',
  '同济大学': 'Tongji University',
  '西安交通大学': "Xi'an Jiaotong University",
  '西北工业大学': 'Northwestern Polytechnical University',
  '西南政法大学': 'Southwest University of Political Science and Law',
  '湘潭大学': 'Xiangtan University',
  '燕山大学': 'Yanshan University',
  '云南财经大学': 'Yunnan University of Finance and Economics',
  '云南民族大学': 'Yunnan Minzu University',
  '长安大学': "Chang'an University",
  '浙江大学': 'Zhejiang University',
  '浙江工商大学': 'Zhejiang Gongshang University',
  '浙江工业大学': 'Zhejiang University of Technology',
  '郑州大学': 'Zhengzhou University',
  '中国农业大学': 'China Agricultural University',
  '中国海洋大学': 'Ocean University of China',
  '中国科学技术大学': 'University of Science and Technology of China',
  '中国人民大学': 'Renmin University of China',
  '中国医科大学': 'China Medical University',
  '中南大学': 'Central South University',
  '中山大学': 'Sun Yat-sen University',
  '中央财经大学': 'Central University of Finance and Economics',
  '重庆大学': 'Chongqing University',
  '哈尔滨工业大学': 'Harbin Institute of Technology',
  '华南理工大学': 'South China University of Technology',
  '武汉大学': 'Wuhan University'
};

function resolveSchoolNameEn(nameZh: string, nameEn?: string | null) {
  return nameEn?.trim() || SCHOOL_NAME_EN_OVERRIDES[nameZh];
}

const SCHOOL_LOCATION_OVERRIDES: Record<string, string> = {
  '安徽大学': 'Hefei, East China',
  '北京大学': 'Beijing, North China',
  '北京大学医学部': 'Beijing, North China',
  '北京航空航天大学': 'Beijing, North China',
  '北京科技大学': 'Beijing, North China',
  '北京理工大学': 'Beijing, North China',
  '北京师范大学': 'Beijing, North China',
  '北京体育大学': 'Beijing, North China',
  '北京语言大学': 'Beijing, North China',
  '清华大学': 'Beijing, North China',
  '大连交通大学': 'Dalian, Northeast China',
  '大连理工大学': 'Dalian, Northeast China',
  '电子科技大学': 'Chengdu, Southwest China',
  '东华大学': 'Shanghai, East China',
  '东南大学': 'Nanjing, East China',
  '对外经济贸易大学': 'Beijing, North China',
  '复旦大学': 'Shanghai, East China',
  '甘肃中医药大学': 'Lanzhou, Northwest China',
  '广东外语外贸大学': 'Guangzhou, South China',
  '广西医科大学': 'Nanning, South China',
  '贵州医科大学': 'Guiyang, Southwest China',
  '哈尔滨工程大学': 'Harbin, Northeast China',
  '哈尔滨工业大学深圳': 'Shenzhen, South China',
  '哈尔滨理工大学': 'Harbin, Northeast China',
  '河北经贸大学': 'Shijiazhuang, North China',
  '华东师范大学': 'Shanghai, East China',
  '华东政法大学': 'Shanghai, East China',
  '华中科技大学': 'Wuhan, Central China',
  '华中师范大学': 'Wuhan, Central China',
  '吉林大学': 'Changchun, Northeast China',
  '暨南大学': 'Guangzhou, South China',
  '兰州大学': 'Lanzhou, Northwest China',
  '辽宁中医药大学': 'Shenyang, Northeast China',
  '南京航空航天大学': 'Nanjing, East China',
  '南京大学': 'Nanjing, East China',
  '南京理工大学': 'Nanjing, East China',
  '南开大学': 'Tianjin, North China',
  '南方科技大学': 'Shenzhen, South China',
  '青岛大学': 'Qingdao, East China',
  '厦门大学': 'Xiamen, East China',
  '山东师范大学': 'Jinan, East China',
  '山东大学': 'Jinan, East China',
  '上海交通大学': 'Shanghai, East China',
  '上海交通大学医学院': 'Shanghai, East China',
  '上海外国语大学': 'Shanghai, East China',
  '上海政法学院': 'Shanghai, East China',
  '四川外国语大学': 'Chongqing, Southwest China',
  '天津财经大学': 'Tianjin, North China',
  '天津大学': 'Tianjin, North China',
  '天津外国语大学': 'Tianjin, North China',
  '同济大学': 'Shanghai, East China',
  '西安交通大学': "Xi'an, Northwest China",
  '西北工业大学': "Xi'an, Northwest China",
  '西南政法大学': 'Chongqing, Southwest China',
  '湘潭大学': 'Xiangtan, Central China',
  '燕山大学': 'Qinhuangdao, North China',
  '云南财经大学': 'Kunming, Southwest China',
  '云南民族大学': 'Kunming, Southwest China',
  '长安大学': "Xi'an, Northwest China",
  '浙江大学': 'Hangzhou, East China',
  '浙江工商大学': 'Hangzhou, East China',
  '浙江工业大学': 'Hangzhou, East China',
  '郑州大学': 'Zhengzhou, Central China',
  '中国农业大学': 'Beijing, North China',
  '中国海洋大学': 'Qingdao, East China',
  '中国科学技术大学': 'Hefei, East China',
  '中国人民大学': 'Beijing, North China',
  '中国医科大学': 'Shenyang, Northeast China',
  '中南大学': 'Changsha, Central China',
  '中山大学': 'Guangzhou, South China',
  '中央财经大学': 'Beijing, North China',
  '重庆大学': 'Chongqing, Southwest China',
  '哈尔滨工业大学': 'Harbin, Northeast China',
  '华南理工大学': 'Guangzhou, South China',
  '武汉大学': 'Wuhan, Central China'
};

function resolveSchoolRegion(nameZh: string, region?: string | null) {
  return region?.trim() || SCHOOL_LOCATION_OVERRIDES[nameZh];
}

const SCHOOL_WEBSITE_OVERRIDES: Record<string, string> = {
  '安徽大学': 'https://www.ahu.edu.cn/',
  '北京大学': 'https://www.pku.edu.cn/',
  '北京大学医学部': 'http://www.bjmu.edu.cn/',
  '北京航空航天大学': 'https://www.buaa.edu.cn/',
  '北京科技大学': 'https://www.ustb.edu.cn/',
  '北京理工大学': 'https://www.bit.edu.cn/',
  '北京师范大学': 'https://www.bnu.edu.cn/',
  '北京体育大学': 'https://www.bsu.edu.cn/',
  '北京语言大学': 'https://www.blcu.edu.cn/',
  '清华大学': 'https://www.tsinghua.edu.cn/',
  '大连交通大学': 'https://www.djtu.edu.cn/',
  '大连理工大学': 'https://www.dlut.edu.cn/',
  '电子科技大学': 'https://www.uestc.edu.cn/',
  '东华大学': 'https://www.dhu.edu.cn/',
  '对外经济贸易大学': 'https://www.uibe.edu.cn/',
  '复旦大学': 'https://www.fudan.edu.cn/',
  '甘肃中医药大学': 'https://www.gszy.edu.cn/',
  '广东外语外贸大学': 'https://www.gdufs.edu.cn/',
  '广西医科大学': 'https://www.gxmu.edu.cn/',
  '贵州医科大学': 'https://www.gmc.edu.cn/',
  '哈尔滨工程大学': 'https://www.hrbeu.edu.cn/',
  '哈尔滨工业大学深圳': 'https://www.hitsz.edu.cn/',
  '哈尔滨理工大学': 'https://www.hrbust.edu.cn/',
  '河北经贸大学': 'https://www.hueb.edu.cn/',
  '华东师范大学': 'https://www.ecnu.edu.cn/',
  '华东政法大学': 'https://www.ecupl.edu.cn/',
  '华中科技大学': 'https://www.hust.edu.cn/',
  '华中师范大学': 'https://www.ccnu.edu.cn/',
  '吉林大学': 'https://www.jlu.edu.cn/',
  '暨南大学': 'https://www.jnu.edu.cn/',
  '辽宁中医药大学': 'https://www.lnutcm.edu.cn/',
  '南京大学': 'https://www.nju.edu.cn/',
  '南开大学': 'https://www.nankai.edu.cn/',
  '青岛大学': 'https://www.qdu.edu.cn/',
  '厦门大学': 'https://www.xmu.edu.cn/',
  '山东师范大学': 'https://www.sdnu.edu.cn/',
  '上海交通大学': 'https://www.sjtu.edu.cn/',
  '上海交通大学医学院': 'https://www.shsmu.edu.cn/',
  '上海外国语大学': 'https://www.shisu.edu.cn/',
  '上海政法学院': 'https://www.shupl.edu.cn/',
  '四川外国语大学': 'https://www.sisu.edu.cn/',
  '天津财经大学': 'https://www.tjufe.edu.cn/',
  '天津大学': 'https://www.tju.edu.cn/',
  '天津外国语大学': 'https://www.tjfsu.edu.cn/',
  '同济大学': 'https://www.tongji.edu.cn/',
  '西安交通大学': 'https://www.xjtu.edu.cn/',
  '西北工业大学': 'https://www.nwpu.edu.cn/',
  '西南政法大学': 'https://www.swupl.edu.cn/',
  '湘潭大学': 'https://www.xtu.edu.cn/',
  '燕山大学': 'https://www.ysu.edu.cn/',
  '云南财经大学': 'https://www.ynufe.edu.cn/',
  '云南民族大学': 'https://www.ynni.edu.cn/',
  '长安大学': 'https://www.chd.edu.cn/',
  '浙江大学': 'https://www.zju.edu.cn/',
  '浙江工商大学': 'https://www.zjgsu.edu.cn/',
  '浙江工业大学': 'https://www.zjut.edu.cn/',
  '郑州大学': 'https://www.zzu.edu.cn/',
  '中国海洋大学': 'https://www.ouc.edu.cn/',
  '中国科学技术大学': 'https://www.ustc.edu.cn/',
  '中国人民大学': 'https://www.ruc.edu.cn/',
  '中国医科大学': 'https://www.cmu.edu.cn/',
  '中南大学': 'https://www.csu.edu.cn/',
  '中央财经大学': 'https://www.cufe.edu.cn/',
  '武汉大学': 'https://www.whu.edu.cn/'
};

function resolveSchoolWebsite(nameZh: string, website?: string | null) {
  return website?.trim() || SCHOOL_WEBSITE_OVERRIDES[nameZh];
}

const FALLBACK_SCHOOLS: SchoolRecord[] = [
  {
    id: 1,
    nameZh: '浙江大学',
    nameEn: 'Zhejiang University',
    schoolType: '综合研究型',
    region: '华东 · 杭州',
    rank: 4,
    cscaRequired: true,
    cscaRequirement: '2026 本科申请要求提供有效 CSCA 成绩单；专业目录按授课语言列出对应 CSCA 科目。',
    cscaSubjects: ['中文授课：文科/理科中文 + 数学 + 对应理化科目', '英文授课：按项目选择英文试卷，MBBS 为数学 + 化学'],
    languageRequirement: '中文授课需 HSK；英文授课需 TOEFL/IELTS/同等英语证明。',
    applicationLevel: '2026 国际本科申请',
    tuitionSummary: '约 RMB 19,800-200,000/年，按专业目录执行。',
    applicationFee: '以浙大国际学院申请系统为准',
    officialWebsiteUrl: 'https://www.zju.edu.cn/',
    admissionsWebsiteUrl: 'https://iczu.zju.edu.cn/admissionsen/2024/1030/c68988a2981659/page.htm',
    sourceUrl: 'https://iczu.zju.edu.cn/admissionsen/2024/1030/c68988a2981659/page.htm',
    sourceLabel: '浙江大学 2026 本科申请指南',
    sourceNote: '校方页面明确 2026/2027 起本科国际生需提供有效 CSCA 成绩单。',
    verificationStatus: 'verified',
    lastVerifiedAt: LAST_VERIFIED_AT,
    qualityScore: 100,
    missingFields: [],
    completenessLabel: '核心字段完整',
    featuredPrograms: ['中文授课本科', 'MBBS', 'Global Communication and Management'],
    fitNotes: ['适合先用专业目录反推 CSCA 科目的学生', '英文授课和中文授课的试卷语种不同，需提前确认'],
    applicationPortalNotes: '先确认目标专业目录，再安排 CSCA 考试语种和科目。',
    campusHighlights: ['C9 综合研究型大学', '本科专业目录对 CSCA 科目说明较细'],
    status: 'published'
  }
];

const SCHOOL_INCLUDE = {
  programs: true,
  cscaRules: true,
  detailedScholarships: true,
  scholarshipLinks: { include: { scholarship: true }, orderBy: [{ sortOrder: 'asc' }, { scholarshipId: 'asc' }] }
} satisfies Prisma.SchoolInclude;

type DbSchool = Prisma.SchoolGetPayload<{ include: typeof SCHOOL_INCLUDE }>;
type DbSchoolProgram = DbSchool['programs'][number];
type DbSchoolCscaRule = DbSchool['cscaRules'][number];
type DbSchoolScholarship = DbSchool['detailedScholarships'][number];
type DbScholarshipLink = DbSchool['scholarshipLinks'][number];
type DbSchoolChangeLog = Awaited<ReturnType<PrismaService['schoolChangeLog']['findMany']>>[number];

function expectedVersionFrom(input: unknown) {
  if (input === undefined || input === null) return undefined;
  const record = assertRecord(input, '版本输入不正确。');
  if (record.expectedVersion === undefined || record.expectedVersion === null || record.expectedVersion === '') return undefined;
  const parsed = Number(record.expectedVersion);
  if (!Number.isInteger(parsed) || parsed < 1) throw new BadRequestException('版本号不正确。');
  return parsed;
}

function assertExpectedVersion(currentVersion: number, expectedVersion: number | undefined, label: string) {
  if (expectedVersion !== undefined && currentVersion !== expectedVersion) {
    throw staleVersionConflict(label, currentVersion);
  }
}

function staleVersionConflict(label: string, currentVersion: number) {
  return new ConflictException({ message: `${label} 已被其他管理员更新，请刷新后再继续。`, code: 'VERSION_CONFLICT', currentVersion });
}

function asStringArray(value: unknown): string[] | undefined {
  if (!value) return undefined;
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string' || typeof item === 'number') return String(item);
        if (typeof item === 'object' && item !== null) {
          const record = item as Record<string, unknown>;
          return firstText(
            typeof record.name === 'string' ? record.name : undefined,
            typeof record.nameZh === 'string' ? record.nameZh : undefined,
            typeof record.title === 'string' ? record.title : undefined,
            typeof record.label === 'string' ? record.label : undefined,
            typeof record.text === 'string' ? record.text : undefined
          );
        }
        return undefined;
      })
      .filter((item): item is string => Boolean(item && item.trim()));
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return asStringArray(parsed);
    } catch {
      return value ? [value] : undefined;
    }
  }
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).map(([key, item]) => `${key}: ${String(item)}`);
  }
  return undefined;
}

function publicSourceLabel(row: DbSchool, isVerified: boolean) {
  if (row.source === 'csca-reference-screenshot') return '参考页面';
  if (row.applicationSystemUrl) return '学校招生页面';
  if (row.officialWebsite) return '学校官方页面';
  if (row.sourceUrl) return isVerified ? '已核验公开来源' : '公开来源待核对';
  return '以学校官方页面为准';
}

function publicNestedSourceLabel(label: string | null | undefined, fallback: string) {
  if (!label) return fallback;
  if (/CSCA Academy 参考页|参考页面/.test(label)) return '参考页面';
  if (/sample|smoke|截图样例|参考站/i.test(label)) return fallback;
  return label;
}

function publicContentText(value: string | null | undefined) {
  return value
    ?.replace(/截图样例信息，?/g, '')
    .replace(/截图样例中的要求/g, '公开资料中的要求')
    .replace(/截图样例显示/g, '公开资料显示')
    .replace(/参考站截图样例/g, '公开参考资料')
    .trim() || undefined;
}

function firstText(...values: Array<string | null | undefined>) {
  return values.find((value) => value && value.trim().length > 0) ?? undefined;
}

function compactText(...values: Array<string | null | undefined>) {
  return values.filter((value): value is string => Boolean(value && value.trim().length > 0));
}

function compactLabel(value: string | undefined, fallback: string, maxLength = 22) {
  const normalized = value?.replace(/\s+/g, ' ').trim();
  if (!normalized) return fallback;
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized;
}

function parsePositiveInt(value: string | undefined, fallback: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(Math.floor(parsed), max);
}

function cleanQueryValue(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === 'all') return undefined;
  return trimmed;
}

function normalizeLocale(locale?: string): PublicLocale {
  return locale?.toLowerCase().startsWith('en') ? 'en' : 'zh-CN';
}

function normalizeKeyword(value: string | undefined) {
  return cleanQueryValue(value)?.toLocaleLowerCase();
}

function parseBooleanFilter(value: string | undefined) {
  const normalized = cleanQueryValue(value)?.toLocaleLowerCase();
  if (!normalized) return undefined;
  if (['true', '1', 'yes', 'required', '需要', '看重'].includes(normalized)) return true;
  if (['false', '0', 'no', 'not-required', 'optional', '未标记', '不明确'].includes(normalized)) return false;
  return undefined;
}

function parseStrictBoolean(value: string | undefined) {
  const normalized = cleanQueryValue(value)?.toLocaleLowerCase();
  if (!normalized) return false;
  return ['true', '1', 'yes', 'required', '需要', '看重'].includes(normalized);
}

function parseOptionalBoolean(value: string | undefined) {
  const normalized = cleanQueryValue(value)?.toLocaleLowerCase();
  if (!normalized) return undefined;
  if (['true', '1', 'yes', '有', '需要', 'required'].includes(normalized)) return true;
  if (['false', '0', 'no', '无', '没有', 'not-required'].includes(normalized)) return false;
  return undefined;
}

function includesText(value: string | undefined, keyword: string) {
  return Boolean(value?.toLocaleLowerCase().includes(keyword));
}

function containsChineseText(value: string | undefined) {
  return Boolean(value && /[\u3400-\u9fff]/.test(value));
}

function uniqueSorted(values: Array<string | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value)))).sort((a, b) =>
    a.localeCompare(b, 'zh-Hans-CN')
  );
}

function getApplicationLevelTokens(school: SchoolRecord) {
  return (school.applicationLevel ?? '')
    .split(/[\/,，、;；]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function addUniqueTag(tags: string[], value?: string, maxLength = 22) {
  const tag = compactLabel(value, '', maxLength);
  if (tag && !tags.includes(tag)) tags.push(tag);
}

function buildSubjectTagsFromText(text: string | undefined) {
  const tags: string[] = [];
  if (!text) return tags;
  if (/中文|汉语|文科/.test(text)) addUniqueTag(tags, '中文科目');
  if (/数学/.test(text)) addUniqueTag(tags, '数学');
  if (/物理/.test(text)) addUniqueTag(tags, '物理');
  if (/化学/.test(text)) addUniqueTag(tags, '化学');
  if (/生物/.test(text)) addUniqueTag(tags, '生物');
  if (/英语|英文/.test(text)) addUniqueTag(tags, '英文试卷');
  return tags;
}

function buildSubjectTags(input: { cscaRequired: boolean; cscaRequirement?: string; cscaRequirementNote?: string; undergradRequirements?: string }) {
  const sourceText = compactText(input.cscaRequirement, input.cscaRequirementNote, input.undergradRequirements).join(' ');
  const tags = buildSubjectTagsFromText(sourceText);
  if (!tags.length && input.cscaRequired) addUniqueTag(tags, '按专业确认');
  return tags.length ? tags : ['科目待确认'];
}

function buildLanguageTags(input: {
  hskRequirement?: string;
  hskNotes?: string;
  englishRequirement?: string;
  languageOfInstruction?: string[];
  hskMinLevel?: number | null;
  englishRequired?: boolean;
}) {
  const tags: string[] = [];
  const languageText = compactText(input.hskRequirement, input.hskNotes, input.englishRequirement, input.languageOfInstruction?.join(' / ')).join(' ');
  if (/免|豁免|无需|不需要/.test(languageText) && /HSK/i.test(languageText)) addUniqueTag(tags, '可免 HSK');
  if (input.hskMinLevel) addUniqueTag(tags, `HSK ${input.hskMinLevel}+`);
  else if (/HSK\s*([1-6])/i.test(languageText)) addUniqueTag(tags, `HSK ${languageText.match(/HSK\s*([1-6])/i)?.[1]}+`);
  else if (/HSK|汉语|中文/.test(languageText)) addUniqueTag(tags, '需中文能力');
  if (input.englishRequired || /IELTS|TOEFL|雅思|托福|英语|英文/i.test(languageText)) addUniqueTag(tags, '英语证明');
  input.languageOfInstruction?.forEach((language) => {
    if (/中文|汉语/.test(language)) addUniqueTag(tags, '中文授课');
    if (/英语|英文|English/i.test(language)) addUniqueTag(tags, '英文授课');
  });
  return tags.length ? tags : ['语言待确认'];
}

function buildTuitionBandLabel(value: string | undefined) {
  if (!value) return '费用待补充';
  const normalized = value.replace(/\s+/g, ' ').trim();
  const match = normalized.match(/(?:RMB|¥|￥)?\s*[\d,.]+(?:\s*[-–~]\s*(?:RMB|¥|￥)?\s*[\d,.]+)?/i);
  return compactLabel(match?.[0] || normalized, '费用待补充', 28);
}

function buildDerivedTags(input: {
  cscaRequired: boolean;
  subjectTags: string[];
  languageTags: string[];
  tuitionSummary?: string;
  hasEnglishPrograms: boolean;
  hasScholarships: boolean;
  isVerified: boolean;
}) {
  const tags: string[] = [];
  addUniqueTag(tags, input.cscaRequired ? '明确 CSCA' : 'CSCA 待确认');
  input.subjectTags.filter((tag) => tag !== '科目待确认').slice(0, 2).forEach((tag) => addUniqueTag(tags, tag));
  input.languageTags.filter((tag) => tag !== '语言待确认').slice(0, 2).forEach((tag) => addUniqueTag(tags, tag));
  if (input.tuitionSummary) addUniqueTag(tags, '有费用信息');
  if (input.hasEnglishPrograms) addUniqueTag(tags, '英文项目');
  if (input.hasScholarships) addUniqueTag(tags, '奖学金');
  if (input.isVerified) addUniqueTag(tags, '已核验');
  return tags.slice(0, 8);
}

function buildDecisionSummary(input: {
  cscaRequired: boolean;
  subjectTags: string[];
  languageTags: string[];
  tuitionBandLabel: string;
  isVerified: boolean;
}) {
  const csca = input.cscaRequired ? '明确需要关注 CSCA' : 'CSCA 状态需继续核对';
  const subject = input.subjectTags.slice(0, 2).join(' / ');
  const language = input.languageTags.slice(0, 2).join(' / ');
  const verified = input.isVerified ? '已核验来源' : '来源待核验';
  return `${csca}；科目：${subject}；语言：${language}；费用：${input.tuitionBandLabel}；${verified}。`;
}

function normalizeProgramStatus(value: string | undefined, fallback?: SchoolStatus) {
  if (value === undefined) return fallback ?? SchoolStatus.draft;
  if (value === SchoolStatus.draft || value === SchoolStatus.published || value === SchoolStatus.archived) return value;
  throw new BadRequestException('专业状态不正确。');
}

function parseOptionalNumber(value: number | string | null | undefined, fieldLabel: string) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new BadRequestException(`${fieldLabel}不正确。`);
  return Math.floor(parsed);
}

function toOptionalId(value: number | string | null | undefined) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
}

function readProgramSubjects(value: unknown): string[] | undefined {
  const subjects = asStringArray(value);
  return subjects?.flatMap((item) => item.split(/[，,、/＋+;；]/).map((part) => part.trim()).filter(Boolean));
}

function formatTuitionAmount(row: DbSchoolProgram) {
  if (row.tuitionText) return row.tuitionText;
  if (!row.tuitionAmount) return undefined;
  const period = row.tuitionPeriod ? `/${row.tuitionPeriod}` : '';
  return `${row.tuitionCurrency || 'RMB'} ${row.tuitionAmount}${period}`;
}

function getProgramDisplayGroup(row: DbSchoolProgram) {
  const language = row.teachingLanguage ?? '';
  if (/英文|英语|English/i.test(language)) {
    return { displayGroup: 'english_program', displayGroupLabel: '英文授课项目' };
  }
  if (/中文|汉语|Chinese/i.test(language)) {
    return { displayGroup: 'chinese_program', displayGroupLabel: '中文授课项目' };
  }
  return { displayGroup: 'general_program', displayGroupLabel: '本科项目' };
}

function extractApplicablePrograms(scope: string | null | undefined) {
  if (!scope) return undefined;
  if (/学校级|全校|本科项目|授课语言|申请判断|重要提示|中英文授课|中文授课理工类专业/.test(scope)) return undefined;
  const values = scope
    .split(/[、,，;；]/)
    .map((item) => item.replace(/等方向|等专业|方向|专业/g, '').trim())
    .filter((item) => item.length >= 2 && item.length <= 64)
    .filter((item) => !/申请|确认|要求|成绩|科目|语言/.test(item));
  return values.length ? Array.from(new Set(values)).slice(0, 18) : undefined;
}

function mapProgram(row: DbSchoolProgram) {
  const cscaSubjects = readProgramSubjects(row.cscaSubjects);
  const displayTuition = formatTuitionAmount(row);
  const hasScholarship = Boolean(row.scholarshipText?.trim());
  const displayGroup = getProgramDisplayGroup(row);
  return {
    id: row.id,
    schoolId: row.schoolId,
    nameZh: row.nameZh,
    nameEn: row.nameEn ?? undefined,
    degreeLevel: row.degreeLevel ?? undefined,
    durationYears: row.durationYears ?? undefined,
    fieldCategory: row.fieldCategory ?? undefined,
    teachingLanguage: row.teachingLanguage ?? undefined,
    cscaSubjects,
    cscaRequirement: row.cscaRequirement ?? undefined,
    hskRequirement: row.hskRequirement ?? undefined,
    englishRequirement: row.englishRequirement ?? undefined,
    tuitionAmount: row.tuitionAmount ?? undefined,
    tuitionCurrency: row.tuitionCurrency ?? undefined,
    tuitionPeriod: row.tuitionPeriod ?? undefined,
    tuitionText: row.tuitionText ?? undefined,
    scholarshipText: row.scholarshipText ?? undefined,
    openDate: row.openDate?.toISOString().slice(0, 10),
    deadlineDate: row.deadlineDate?.toISOString().slice(0, 10),
    deadlineLabel: row.deadlineLabel ?? undefined,
    applicationRound: row.applicationRound ?? undefined,
    applicationUrl: row.applicationUrl ?? undefined,
    applicationNote: publicContentText(row.applicationNote),
    sourceUrl: row.sourceUrl ?? undefined,
    sourceLabel: publicNestedSourceLabel(row.sourceLabel, '专业来源'),
    lastVerifiedAt: row.lastVerifiedAt?.toISOString().slice(0, 10),
    sortOrder: row.sortOrder,
    status: row.status,
    version: row.version,
    isVerified: Boolean(row.sourceUrl && row.lastVerifiedAt),
    hasScholarship,
    badgeText: hasScholarship ? compactLabel(row.scholarshipText ?? undefined, '有奖学金', 12) : undefined,
    displayTuition,
    displaySubjects: cscaSubjects,
    ...displayGroup
  };
}

function mapCscaRule(row: DbSchoolCscaRule) {
  const cscaSubjects = readProgramSubjects(row.cscaSubjects);
  return {
    id: row.id,
    schoolId: row.schoolId,
    programId: row.programId ?? undefined,
    title: row.title,
    category: row.category,
    scope: row.scope ?? undefined,
    cscaSubjects,
    languageCondition: row.languageCondition ?? undefined,
    description: publicContentText(row.description),
    importantNote: publicContentText(row.importantNote),
    applicablePrograms: extractApplicablePrograms(row.scope),
    sourceUrl: row.sourceUrl ?? undefined,
    sourceLabel: publicNestedSourceLabel(row.sourceLabel, '要求来源'),
    lastVerifiedAt: row.lastVerifiedAt?.toISOString().slice(0, 10),
    sortOrder: row.sortOrder,
    status: row.status,
    version: row.version,
    isVerified: Boolean(row.sourceUrl && row.lastVerifiedAt)
  };
}

function mapSchoolScholarship(row: DbSchoolScholarship) {
  const type = row.type || 'general';
  return {
    id: row.id,
    schoolId: row.schoolId,
    programId: row.programId ?? undefined,
    name: row.name,
    type,
    coverage: row.coverage ?? undefined,
    applicableDegree: row.applicableDegree ?? undefined,
    applicableProgram: row.applicableProgram ?? undefined,
    amountText: row.amountText ?? undefined,
    requirementText: row.requirementText ?? undefined,
    sourceUrl: row.sourceUrl ?? undefined,
    sourceLabel: publicNestedSourceLabel(row.sourceLabel, '奖学金来源'),
    lastVerifiedAt: row.lastVerifiedAt?.toISOString().slice(0, 10),
    sortOrder: row.sortOrder,
    status: row.status,
    version: row.version,
    isCsc: /csc|中国政府奖学金/i.test(type) || /中国政府奖学金|CSC/i.test(row.name),
    isVerified: Boolean(row.sourceUrl && row.lastVerifiedAt)
  };
}

function mapLinkedScholarship(link: DbScholarshipLink) {
  const row = link.scholarship;
  const type = row.type || 'other';
  return {
    id: row.id,
    scholarshipSlug: row.slug,
    schoolId: link.schoolId,
    name: row.title,
    type,
    coverage: row.coverage ?? undefined,
    applicableDegree: row.applicableDegree ?? undefined,
    applicableProgram: row.applicableProgram ?? undefined,
    amountText: row.amountText ?? undefined,
    requirementText: row.requirementText ?? undefined,
    deadlineDate: row.deadlineDate?.toISOString().slice(0, 10),
    deadlineLabel: row.deadlineLabel ?? undefined,
    applicationRound: row.applicationRound ?? undefined,
    sourceUrl: row.sourceUrl ?? undefined,
    sourceLabel: publicNestedSourceLabel(row.sourceLabel, '奖学金来源'),
    lastVerifiedAt: row.lastVerifiedAt?.toISOString().slice(0, 10),
    sortOrder: link.sortOrder,
    status: row.status,
    isCsc: /csc|government|中国政府奖学金/i.test(type) || /中国政府奖学金|CSC/i.test(row.title),
    isVerified: Boolean(row.sourceUrl && row.lastVerifiedAt)
  };
}

function activePrograms(programs: DbSchoolProgram[] | undefined) {
  return (programs ?? []).filter((program) => program.status !== SchoolStatus.archived);
}

function activeCscaRules(rules: DbSchoolCscaRule[] | undefined) {
  return (rules ?? []).filter((rule) => rule.status !== SchoolStatus.archived);
}

function activeScholarships(scholarships: DbSchoolScholarship[] | undefined) {
  return (scholarships ?? []).filter((scholarship) => scholarship.status !== SchoolStatus.archived);
}

function scholarshipDedupeKey(scholarship: ReturnType<typeof mapSchoolScholarship> | ReturnType<typeof mapLinkedScholarship>) {
  return [
    scholarship.name.trim().toLowerCase(),
    (scholarship.type || '').trim().toLowerCase(),
    (scholarship.applicableDegree || '').trim().toLowerCase(),
    (scholarship.applicableProgram || '').trim().toLowerCase()
  ].join('|');
}

function isUndergraduate(value?: string) {
  return Boolean(value && /本科|bachelor|undergraduate/i.test(value));
}

function isPostgraduate(value?: string) {
  return Boolean(value && /硕士|博士|研究生|master|doctoral|phd|postgraduate/i.test(value));
}

function summarizeProgramTuition(programs: ReturnType<typeof mapProgram>[]) {
  const amounts = programs.map((program) => program.tuitionAmount).filter((value): value is number => typeof value === 'number');
  if (amounts.length) {
    const min = Math.min(...amounts);
    const max = Math.max(...amounts);
    const currency = programs.find((program) => program.tuitionAmount)?.tuitionCurrency || 'RMB';
    return min === max ? `${currency} ${min}/年` : `${currency} ${min}-${max}/年`;
  }
  const text = programs.map((program) => program.tuitionText).find(Boolean);
  return compactLabel(text, '', 28) || undefined;
}

function summarizePrograms(programRows: DbSchoolProgram[] | undefined) {
  const programs = activePrograms(programRows).map(mapProgram).sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
  const programSubjectTags = uniqueSorted(programs.flatMap((program) => program.cscaSubjects ?? [])).slice(0, 8);
  const programQualityIssues: string[] = [];
  if (!programs.length) programQualityIssues.push('缺专业数据');
  if (programs.length && programs.some((program) => !(program.cscaSubjects?.length || program.cscaRequirement))) programQualityIssues.push('专业缺 CSCA 科目');
  if (programs.length && programs.some((program) => !(program.tuitionAmount || program.tuitionText))) programQualityIssues.push('专业缺学费');
  if (programs.length && programs.some((program) => !program.teachingLanguage)) programQualityIssues.push('专业缺授课语言');
  if (programs.length && programs.some((program) => !program.isVerified)) programQualityIssues.push('专业来源未核验');
  return {
    programs,
    programCount: programs.length,
    undergraduateProgramCount: programs.filter((program) => isUndergraduate(program.degreeLevel)).length,
    postgraduateProgramCount: programs.filter((program) => isPostgraduate(program.degreeLevel)).length,
    englishProgramCount: programs.filter((program) => /英语|英文|English/i.test(program.teachingLanguage ?? '')).length,
    programSubjectTags,
    programTuitionBandLabel: summarizeProgramTuition(programs),
    programQualityIssues
  };
}

function summarizeCscaRules(ruleRows: DbSchoolCscaRule[] | undefined) {
  return activeCscaRules(ruleRows).map(mapCscaRule).sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
}

function summarizeScholarships(scholarshipRows: DbSchoolScholarship[] | undefined, legacyScholarships?: string[], linkedRows?: DbScholarshipLink[]) {
  const linked = (linkedRows ?? [])
    .filter((link) => link.scholarship.status !== SchoolStatus.archived)
    .map(mapLinkedScholarship);
  const legacy = linked.length ? [] : activeScholarships(scholarshipRows).map(mapSchoolScholarship);
  const byScholarship = new Map<string, (typeof linked | typeof legacy)[number]>();
  for (const item of [...linked, ...legacy]) {
    const key = scholarshipDedupeKey(item);
    if (!byScholarship.has(key)) byScholarship.set(key, item);
  }
  const detailed = Array.from(byScholarship.values()).sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
  const cscScholarshipCount = detailed.filter((item) => item.isCsc).length;
  return {
    scholarshipsDetailed: detailed,
    scholarshipCount: detailed.length || legacyScholarships?.length || 0,
    cscScholarshipCount
  };
}

function summarizeUpcomingDeadlines(programs: ReturnType<typeof mapProgram>[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return programs
    .filter((program) => program.deadlineDate || program.deadlineLabel)
    .map((program) => {
      const deadline = program.deadlineDate ? new Date(`${program.deadlineDate}T00:00:00.000Z`) : null;
      const daysUntilDeadline = deadline && !Number.isNaN(deadline.getTime())
        ? Math.ceil((deadline.getTime() - today.getTime()) / 86400000)
        : undefined;
      const statusLabel = typeof daysUntilDeadline === 'number'
        ? daysUntilDeadline < 0
          ? '已截止'
          : daysUntilDeadline === 0
            ? '今日截止'
            : `还有 ${daysUntilDeadline} 天`
        : '日期待确认';
      return {
        programId: program.id,
        programName: program.nameZh,
        degreeLevel: program.degreeLevel,
        teachingLanguage: program.teachingLanguage,
        applicationRound: program.applicationRound,
        deadlineDate: program.deadlineDate,
        deadlineLabel: program.deadlineLabel,
        daysUntilDeadline,
        statusLabel
      };
    })
    .filter((item) => item.daysUntilDeadline === undefined || item.daysUntilDeadline >= 0)
    .sort((a, b) => (a.daysUntilDeadline ?? 99999) - (b.daysUntilDeadline ?? 99999) || a.programId - b.programId)
    .slice(0, 5);
}

function summarizeDeadline(row: DbSchool) {
  const rounds = compactText(
    row.round1Deadline ? `第一轮：${row.round1Deadline}` : undefined,
    row.round2Deadline ? `第二轮：${row.round2Deadline}` : undefined,
    row.round1CloseDate ? `第一轮截止：${row.round1CloseDate}` : undefined,
    row.round2CloseDate ? `第二轮截止：${row.round2CloseDate}` : undefined
  );
  return rounds.length ? rounds.join('；') : undefined;
}

function buildMissingFields(school: {
  cscaRequirement?: string;
  languageRequirement?: string;
  applicationLevel?: string;
  tuitionSummary?: string;
  sourceUrl?: string;
}) {
  const missing: string[] = [];
  if (!school.cscaRequirement) missing.push('CSCA 要求');
  if (!school.languageRequirement) missing.push('语言要求');
  if (!school.applicationLevel) missing.push('申请层级');
  if (!school.tuitionSummary) missing.push('费用概览');
  if (!school.sourceUrl) missing.push('来源链接');
  return missing;
}

function buildCompletenessLabel(missingFields: string[]) {
  if (missingFields.length === 0) return '核心字段完整';
  if (missingFields.length <= 2) return `待补 ${missingFields.length} 项`;
  return `待补 ${missingFields.length} 项核心信息`;
}

function readPlainObject(value: unknown) {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

function readDisplayMetadata(row: DbSchool) {
  return readPlainObject(readPlainObject(row.tuitionByCategory)?.display);
}

function readDisplayString(meta: Record<string, unknown> | undefined, key: string) {
  const value = meta?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readDisplayNumber(meta: Record<string, unknown> | undefined, key: string) {
  const value = meta?.[key];
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, Math.floor(value));
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.max(0, Math.floor(parsed));
  }
  return undefined;
}

function readDisplayStringArray(meta: Record<string, unknown> | undefined, key: string) {
  return asStringArray(meta?.[key]);
}

function readProgramDisplayGroups(meta: Record<string, unknown> | undefined, programSummary: ReturnType<typeof summarizePrograms>) {
  const rawGroups = meta?.programDisplayGroups;
  if (Array.isArray(rawGroups)) {
    const groups = rawGroups
      .map((item, index) => {
        const record = readPlainObject(item);
        if (!record) return undefined;
        const label = typeof record.label === 'string' ? record.label.trim() : '';
        const key = typeof record.key === 'string' && record.key.trim() ? record.key.trim() : `group-${index + 1}`;
        const total = typeof record.total === 'number' ? record.total : Number(record.total);
        const visibleCount = typeof record.visibleCount === 'number' ? record.visibleCount : Number(record.visibleCount);
        const hiddenNote = typeof record.hiddenNote === 'string' && record.hiddenNote.trim() ? record.hiddenNote.trim() : undefined;
        if (!label || !Number.isFinite(total)) return undefined;
        return {
          key,
          label,
          total: Math.max(0, Math.floor(total)),
          visibleCount: Number.isFinite(visibleCount) ? Math.max(0, Math.floor(visibleCount)) : undefined,
          hiddenNote
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
    if (groups.length) return groups;
  }

  const englishCount = programSummary.programs.filter((program) => /英文|英语|English/i.test(program.teachingLanguage ?? '')).length;
  const chineseCount = programSummary.programs.filter((program) => /中文|汉语|Chinese/i.test(program.teachingLanguage ?? '')).length;
  return [
    chineseCount ? { key: 'chinese_program', label: '中文授课项目', total: chineseCount, visibleCount: chineseCount } : undefined,
    englishCount ? { key: 'english_program', label: '英文授课项目', total: englishCount, visibleCount: englishCount } : undefined
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));
}

function readApplicationTimeline(meta: Record<string, unknown> | undefined, row: DbSchool) {
  const rawTimeline = meta?.applicationTimeline;
  if (Array.isArray(rawTimeline)) {
    const timeline = rawTimeline
      .map((item, index) => {
        const record = readPlainObject(item);
        if (!record) return undefined;
        const label = typeof record.label === 'string' ? record.label.trim() : '';
        const key = typeof record.key === 'string' && record.key.trim() ? record.key.trim() : `timeline-${index + 1}`;
        if (!label) return undefined;
        return {
          key,
          label,
          dateLabel: typeof record.dateLabel === 'string' && record.dateLabel.trim() ? record.dateLabel.trim() : undefined,
          startDate: typeof record.startDate === 'string' && record.startDate.trim() ? record.startDate.trim() : undefined,
          endDate: typeof record.endDate === 'string' && record.endDate.trim() ? record.endDate.trim() : undefined,
          description: typeof record.description === 'string' && record.description.trim() ? publicContentText(record.description) : undefined,
          statusLabel: typeof record.statusLabel === 'string' && record.statusLabel.trim() ? record.statusLabel.trim() : undefined
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
    if (timeline.length) return timeline;
  }

  const formatDateLike = (value: Date | string | null | undefined) => {
    if (!value) return undefined;
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    return value;
  };

  const fallback = [
    row.round1Deadline || row.round1CloseDate
      ? {
          key: 'round-1',
          label: '第一轮申请',
          dateLabel: row.round1Deadline ?? formatDateLike(row.round1CloseDate),
          startDate: formatDateLike(row.round1OpenDate),
          endDate: formatDateLike(row.round1CloseDate),
          description: publicContentText(row.applicationSteps)
        }
      : undefined,
    row.round2Deadline || row.round2CloseDate
      ? {
          key: 'round-2',
          label: '第二轮申请',
          dateLabel: row.round2Deadline ?? formatDateLike(row.round2CloseDate),
          startDate: formatDateLike(row.round2OpenDate),
          endDate: formatDateLike(row.round2CloseDate),
          description: publicContentText(row.applicationSteps)
        }
      : undefined
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));
  return fallback.length ? fallback : undefined;
}

function splitRegionLabel(region: string | null | undefined) {
  const parts = (region ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  return {
    city: parts[0] || region || undefined,
    regionLabel: parts.length > 1 ? parts.slice(1).join(', ') : region || undefined
  };
}

const CITY_SLUGS: Array<{ slug: string; cityZh: string; cityEn: string; aliases: string[] }> = [
  { slug: 'beijing', cityZh: '北京', cityEn: 'Beijing', aliases: ['beijing', '北京市'] },
  { slug: 'shanghai', cityZh: '上海', cityEn: 'Shanghai', aliases: ['shanghai', '上海市'] },
  { slug: 'tianjin', cityZh: '天津', cityEn: 'Tianjin', aliases: ['tianjin', '天津市'] },
  { slug: 'qingdao', cityZh: '青岛', cityEn: 'Qingdao', aliases: ['qingdao', '青岛市'] },
  { slug: 'nanjing', cityZh: '南京', cityEn: 'Nanjing', aliases: ['nanjing', '南京市'] },
  { slug: 'hangzhou', cityZh: '杭州', cityEn: 'Hangzhou', aliases: ['hangzhou', '杭州市'] },
  { slug: 'guangzhou', cityZh: '广州', cityEn: 'Guangzhou', aliases: ['guangzhou', '广州市'] },
  { slug: 'shenzhen', cityZh: '深圳', cityEn: 'Shenzhen', aliases: ['shenzhen', '深圳市'] },
  { slug: 'wuhan', cityZh: '武汉', cityEn: 'Wuhan', aliases: ['wuhan', '武汉市'] },
  { slug: 'chengdu', cityZh: '成都', cityEn: 'Chengdu', aliases: ['chengdu', '成都市'] },
  { slug: 'xian', cityZh: '西安', cityEn: "Xi'an", aliases: ['xian', "xi'an", '西安市'] },
  { slug: 'harbin', cityZh: '哈尔滨', cityEn: 'Harbin', aliases: ['harbin', '哈尔滨市'] },
  { slug: 'dalian', cityZh: '大连', cityEn: 'Dalian', aliases: ['dalian', '大连市'] },
  { slug: 'shenyang', cityZh: '沈阳', cityEn: 'Shenyang', aliases: ['shenyang', '沈阳市'] },
  { slug: 'jinan', cityZh: '济南', cityEn: 'Jinan', aliases: ['jinan', '济南市'] }
];

function resolveCityInfo(city: string | undefined, region: string | null | undefined) {
  const haystack = [city, region].filter(Boolean).join(' ').toLocaleLowerCase();
  const matched = CITY_SLUGS.find((item) => [item.cityZh, item.cityEn, ...item.aliases].some((alias) => haystack.includes(alias.toLocaleLowerCase())));
  if (!matched) return { city, cityZh: city, citySlug: undefined };
  return { city: matched.cityEn, cityZh: matched.cityZh, citySlug: matched.slug };
}

function cityInfoFromSlug(slug: string | null | undefined) {
  return slug ? CITY_SLUGS.find((item) => item.slug === slug) : undefined;
}

function resolvePersistedCityInfo(input: {
  citySlug?: string | null;
  cityZh?: string | null;
  city?: string;
  region?: string | null;
}) {
  const stored = cityInfoFromSlug(input.citySlug);
  if (stored) {
    return {
      city: stored.cityEn,
      cityZh: input.cityZh ?? stored.cityZh,
      citySlug: stored.slug
    };
  }
  return resolveCityInfo(input.city, input.region);
}

function buildDetailDisplay(row: DbSchool, programSummary: ReturnType<typeof summarizePrograms>, requiredSubjectTags: string[]) {
  const meta = readDisplayMetadata(row);
  const regionParts = splitRegionLabel(row.region);
  const displayProgramCount = readDisplayNumber(meta, 'displayProgramCount') ?? programSummary.programCount;
  const visibleProgramCount = readDisplayNumber(meta, 'visibleProgramCount') ?? programSummary.programCount;
  const displaySubjectTags = readDisplayStringArray(meta, 'displaySubjectTags') ?? requiredSubjectTags;
  return {
    city: readDisplayString(meta, 'city') ?? regionParts.city,
    regionLabel: readDisplayString(meta, 'regionLabel') ?? regionParts.regionLabel,
    livingCostLabel: readDisplayString(meta, 'livingCostLabel') ?? row.accommodationCost ?? undefined,
    displayProgramCount,
    displayUndergraduateCount: readDisplayNumber(meta, 'displayUndergraduateCount') ?? programSummary.undergraduateProgramCount,
    visibleProgramCount,
    hiddenProgramNote:
      readDisplayString(meta, 'hiddenProgramNote') ??
      (displayProgramCount > visibleProgramCount ? `已展示 ${visibleProgramCount} 个，另有 ${displayProgramCount - visibleProgramCount} 个以参考页为准` : undefined),
    displaySubjectTags: displaySubjectTags.filter((tag) => !/待确认/.test(tag)).slice(0, 10),
    programFieldTags:
      readDisplayStringArray(meta, 'programFieldTags') ??
      uniqueSorted(programSummary.programs.map((program) => program.fieldCategory).filter(Boolean)).slice(0, 10),
    programDisplayGroups: readProgramDisplayGroups(meta, programSummary),
    applicationTimeline: readApplicationTimeline(meta, row)
  };
}

function summarizeChanges(before: Record<string, unknown> | undefined, after: Record<string, unknown> | undefined) {
  const keys = Array.from(new Set([...(before ? Object.keys(before) : []), ...(after ? Object.keys(after) : [])]));
  return keys
    .filter((key) => JSON.stringify(before?.[key] ?? null) !== JSON.stringify(after?.[key] ?? null))
    .map((key) => `${key} 已更新`);
}

function mapSchool(row: DbSchool): SchoolRecord {
  const languageOfInstruction = asStringArray(row.languageOfInstruction);
  const admissionLevel = asStringArray(row.admissionLevel);
  const scholarships = asStringArray(row.scholarships);
  const programSummary = summarizePrograms(row.programs);
  const cscaRules = summarizeCscaRules(row.cscaRules);
  const scholarshipSummary = summarizeScholarships(row.detailedScholarships, scholarships, row.scholarshipLinks);
  const hskRequirement = firstText(row.hskRequirement, row.hskNotes, row.hskChineseConditional);
  const englishRequirement = firstText(row.englishRequirementNote);
  const cscaRequirement = firstText(row.cscaRequirement, row.cscaRequirementNote, row.undergradRequirements);
  const languageRequirement = firstText(hskRequirement, englishRequirement, languageOfInstruction?.join(' / '));
  const applicationLevel = admissionLevel?.join(' / ') || '本科/项目申请';
  const officialWebsite = resolveSchoolWebsite(row.nameZh, row.officialWebsite);
  const sourceUrl = row.sourceUrl || row.applicationSystemUrl || officialWebsite || undefined;
  const missingFields = buildMissingFields({
    cscaRequirement,
    languageRequirement,
    applicationLevel,
    tuitionSummary: row.tuitionSummary ?? undefined,
    sourceUrl
  });
  const verificationStatus = sourceUrl && row.lastVerifiedAt ? 'verified' : 'pending';
  const qualityScore = row.dataQualityScore ?? Math.max(0, 100 - missingFields.length * 15);
  const isVerified = verificationStatus === 'verified';
  const schoolSubjectTags = buildSubjectTags({
    cscaRequired: row.cscaRequired,
    cscaRequirement,
    cscaRequirementNote: row.cscaRequirementNote ?? undefined,
    undergradRequirements: row.undergradRequirements ?? undefined
  });
  const subjectTags = programSummary.programSubjectTags.length ? programSummary.programSubjectTags : schoolSubjectTags;
  const languageTags = buildLanguageTags({
    hskRequirement,
    hskNotes: row.hskNotes ?? undefined,
    englishRequirement,
    languageOfInstruction,
    hskMinLevel: row.hskMinLevel,
    englishRequired: row.englishRequired
  });
  const hasEnglishPrograms = Boolean(row.englishPrograms?.trim() || programSummary.englishProgramCount > 0 || languageTags.includes('英文授课'));
  const hasScholarships = Boolean(scholarships?.length || scholarshipSummary.scholarshipCount);
  const schoolTuitionBandLabel = row.tuitionSummary ? buildTuitionBandLabel(row.tuitionSummary) : undefined;
  const tuitionBandLabel = schoolTuitionBandLabel || programSummary.programTuitionBandLabel || '费用待补充';
  const requiredSubjectTags = uniqueSorted([
    ...subjectTags,
    ...programSummary.programSubjectTags,
    ...cscaRules.flatMap((rule) => rule.cscaSubjects ?? [])
  ]).filter((tag) => !/待确认/.test(tag)).slice(0, 10);
  const region = resolveSchoolRegion(row.nameZh, row.region);
  const detailDisplay = buildDetailDisplay({ ...row, region: region ?? row.region }, programSummary, requiredSubjectTags.length ? requiredSubjectTags : subjectTags);
  const cityInfo = resolvePersistedCityInfo({
    citySlug: row.citySlug,
    cityZh: row.cityZh,
    city: detailDisplay.city,
    region: region ?? row.region
  });
  const derivedTags = buildDerivedTags({
    cscaRequired: row.cscaRequired,
    subjectTags,
    languageTags,
    tuitionSummary: row.tuitionSummary ?? undefined,
    hasEnglishPrograms,
    hasScholarships,
    isVerified
  });
  const decisionSummary = buildDecisionSummary({
    cscaRequired: row.cscaRequired,
    subjectTags,
    languageTags,
    tuitionBandLabel,
    isVerified
  });
  const contactNotes = compactText(
    row.contactEmail ? `邮箱：${row.contactEmail}` : undefined,
    row.contactTel ? `电话：${row.contactTel}` : undefined,
    row.contactAddress ? `地址：${row.contactAddress}` : undefined
  );

  return {
    id: row.id,
    nameZh: row.nameZh,
    nameEn: resolveSchoolNameEn(row.nameZh, row.nameEn),
    schoolType: row.schoolType === 'partner' ? '合作院校' : '常规院校',
    region,
    city: cityInfo.city,
    cityZh: cityInfo.cityZh,
    citySlug: cityInfo.citySlug,
    regionLabel: detailDisplay.regionLabel,
    rank: row.rank ?? undefined,
    cscaRequired: row.cscaRequired,
    cscaRequirement,
    cscaSubjects: row.cscaRequired ? detailDisplay.displaySubjectTags : undefined,
    languageRequirement,
    applicationLevel,
    languageOfInstruction,
    hskRequirement,
    englishRequirement,
    deadlineSummary: summarizeDeadline(row),
    tuitionSummary: row.tuitionSummary ?? undefined,
    applicationFee: row.applicationFee ?? undefined,
    officialWebsiteUrl: officialWebsite,
    admissionsWebsiteUrl: row.applicationSystemUrl ?? undefined,
    sourceUrl,
    sourceLabel: publicSourceLabel(row, isVerified),
    sourceNote: isVerified ? '已核验公开来源' : '以学校官方页面为准',
    verificationStatus,
    lastVerifiedAt: row.lastVerifiedAt?.toISOString().slice(0, 10),
    qualityScore,
    missingFields,
    completenessLabel: programSummary.programQualityIssues.length ? `${buildCompletenessLabel(missingFields)} / ${programSummary.programQualityIssues[0]}` : buildCompletenessLabel(missingFields),
    featuredPrograms: asStringArray(row.programFields) || asStringArray(row.notablePrograms) || asStringArray(row.englishPrograms),
    scholarships,
    cscaRules,
    scholarshipsDetailed: scholarshipSummary.scholarshipsDetailed,
    upcomingDeadlines: summarizeUpcomingDeadlines(programSummary.programs),
    requiredSubjectTags: requiredSubjectTags.length ? requiredSubjectTags : subjectTags,
    quickFacts: {
      location: detailDisplay.city,
      region: detailDisplay.regionLabel,
      tuition: tuitionBandLabel,
      livingCost: detailDisplay.livingCostLabel,
      accommodation: firstText(row.accommodationCost, row.accommodationType),
      programCount: detailDisplay.displayProgramCount ?? programSummary.programCount,
      englishProgramCount: programSummary.englishProgramCount
    },
    detailDisplay,
    scholarshipCount: scholarshipSummary.scholarshipCount,
    cscScholarshipCount: scholarshipSummary.cscScholarshipCount,
    derivedTags,
    subjectTags,
    languageTags,
    tuitionBandLabel,
    hasEnglishPrograms,
    hasScholarships,
    isVerified,
    decisionSummary,
    programCount: programSummary.programCount,
    undergraduateProgramCount: programSummary.undergraduateProgramCount,
    postgraduateProgramCount: programSummary.postgraduateProgramCount,
    englishProgramCount: programSummary.englishProgramCount,
    programSubjectTags: programSummary.programSubjectTags,
    programTuitionBandLabel: programSummary.programTuitionBandLabel,
    programQualityIssues: programSummary.programQualityIssues,
    programs: programSummary.programs,
    fitNotes: [
      row.guaranteedAdmission ? '合作/保录取路径需重点确认服务边界。' : '常规申请路径，建议先核对公开要求。',
      row.cscaRequired ? '该校记录标记为需要关注 CSCA。' : '当前记录未标记强制 CSCA，仍建议核对最新招生简章。'
    ],
    applicationPortalNotes: row.applicationSteps ?? undefined,
    campusHighlights: asStringArray(row.campusFacilities) || scholarships,
    contactNotes: contactNotes.length ? contactNotes : undefined,
    status: row.status
  };
}

function mapAdminSchoolSummary(row: DbSchool): AdminSchoolSummary {
  const mapped = mapSchool(row);
  return {
    id: mapped.id,
    version: row.version,
    nameZh: mapped.nameZh,
    nameEn: mapped.nameEn,
    region: mapped.region,
    cscaRequired: mapped.cscaRequired,
    verificationStatus: mapped.verificationStatus ?? 'pending',
    status: mapped.status ?? 'draft',
    tuitionSummary: mapped.tuitionSummary,
    sourceUrl: mapped.sourceUrl,
    lastVerifiedAt: mapped.lastVerifiedAt,
    completenessLabel: mapped.completenessLabel,
    missingFields: [...(mapped.missingFields ?? []), ...(mapped.programQualityIssues ?? [])]
  };
}

function mapAdminSchoolDetail(row: DbSchool): AdminSchoolDetail {
  const mapped = mapSchool(row);
  return {
    id: mapped.id,
    version: row.version,
    nameZh: mapped.nameZh,
    nameEn: mapped.nameEn,
    rank: mapped.rank,
    schoolType: mapped.schoolType,
    region: mapped.region,
    cscaRequired: mapped.cscaRequired,
    cscaRequirement: mapped.cscaRequirement,
    languageRequirement: mapped.languageRequirement,
    tuitionSummary: mapped.tuitionSummary,
    applicationFee: mapped.applicationFee,
    officialWebsiteUrl: mapped.officialWebsiteUrl,
    admissionsWebsiteUrl: mapped.admissionsWebsiteUrl,
    sourceUrl: mapped.sourceUrl,
    source: row.source ?? undefined,
    sourceId: row.sourceId ?? undefined,
    derivedTags: mapped.derivedTags,
    languageOfInstruction: mapped.languageOfInstruction,
    scholarships: asStringArray(row.scholarships),
    englishPrograms: row.englishPrograms ?? undefined,
    programFields: asStringArray(row.programFields),
    cscaRequirementNote: row.cscaRequirementNote ?? undefined,
    programs: mapped.programs,
    cscaRules: mapped.cscaRules,
    scholarshipsDetailed: mapped.scholarshipsDetailed,
    verificationStatus: mapped.verificationStatus ?? 'pending',
    lastVerifiedAt: mapped.lastVerifiedAt,
    completenessLabel: mapped.completenessLabel,
    status: mapped.status ?? 'draft'
  };
}

function pickEditableSnapshot(row: DbSchool | Awaited<ReturnType<PrismaService['school']['update']>>) {
  return {
    id: row.id,
    version: row.version,
    nameZh: row.nameZh,
    nameEn: row.nameEn,
    region: row.region,
    citySlug: row.citySlug,
    cityZh: row.cityZh,
    cscaRequired: row.cscaRequired,
    cscaRequirement: row.cscaRequirement,
    languageRequirement: firstText(row.hskRequirement, row.englishRequirementNote),
    tuitionSummary: row.tuitionSummary,
    applicationFee: row.applicationFee,
    officialWebsiteUrl: row.officialWebsite,
    admissionsWebsiteUrl: row.applicationSystemUrl,
    source: row.source,
    sourceId: row.sourceId,
    sourceUrl: row.sourceUrl,
    lastVerifiedAt: row.lastVerifiedAt?.toISOString() ?? null,
    status: row.status
  };
}

function normalizeSchoolType(value: string | undefined) {
  if (!value || value === SchoolType.regular) return SchoolType.regular;
  if (value === 'partner') return SchoolType.partner;
  throw new BadRequestException('学校类型不正确。');
}

function normalizeSchoolStatus(value: string | undefined, fallback?: SchoolStatus) {
  if (value === undefined) return fallback ?? SchoolStatus.draft;
  if (value === SchoolStatus.draft || value === SchoolStatus.published || value === SchoolStatus.archived) return value;
  throw new BadRequestException('学校状态不正确。');
}

function parseVerifiedDate(value: string | null | undefined, fallback?: Date | null) {
  if (value === undefined) return fallback;
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException('核验日期格式不正确。');
  }
  return parsed;
}

function parseOptionalDate(value: string | null | undefined, fieldLabel: string, fallback?: Date | null) {
  if (value === undefined) return fallback;
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) throw new BadRequestException(`${fieldLabel}格式不正确。`);
  return parsed;
}

function cleanSchoolText(value: unknown, fieldLabel: string, maxLength = 5000) {
  return cleanNullableString(value, `${fieldLabel}不正确。`, maxLength);
}

function cleanCitySlug(value: unknown) {
  const slug = cleanNullableString(value, '城市 slug 不正确。', 120);
  if (!slug) return slug;
  if (!/^[a-z0-9-]+$/.test(slug)) throw new BadRequestException('城市 slug 只能包含小写字母、数字和短横线。');
  return slug;
}

function cleanStringArrayInput(value: unknown, fieldLabel: string) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.map((item) => String(item).trim()).filter(Boolean);
    } catch {
      return trimmed.split(/[，,;；\n]/).map((item) => item.trim()).filter(Boolean);
    }
  }
  throw new BadRequestException(`${fieldLabel}不正确。`);
}

function sanitizeSchoolInput(input: AdminSchoolUpdateInput, mode: 'create' | 'update'): AdminSchoolUpdateInput {
  const record = assertRecord(input, '学校输入不正确。');
  const next: AdminSchoolUpdateInput = {};
  if (mode === 'create') {
    next.nameZh = assertRequiredString(record.nameZh, '学校中文名不能为空。', 200);
  } else if (record.nameZh !== undefined) {
    next.nameZh = assertRequiredString(record.nameZh, '学校中文名不能为空。', 200);
  }
  if (record.nameEn !== undefined) next.nameEn = cleanSchoolText(record.nameEn, '英文名', 200);
  if (record.region !== undefined) next.region = cleanSchoolText(record.region, '地区', 120);
  if (record.citySlug !== undefined) next.citySlug = cleanCitySlug(record.citySlug);
  if (record.cityZh !== undefined) next.cityZh = cleanSchoolText(record.cityZh, '城市中文名', 120);
  if (record.schoolType !== undefined) next.schoolType = assertRequiredString(record.schoolType, '学校类型不正确。', 40);
  if (record.cscaRequired !== undefined) {
    if (typeof record.cscaRequired !== 'boolean') throw new BadRequestException('CSCA 状态不正确。');
    next.cscaRequired = record.cscaRequired;
  }
  if (record.cscaRequirement !== undefined) next.cscaRequirement = cleanSchoolText(record.cscaRequirement, 'CSCA 要求');
  if (record.languageRequirement !== undefined) next.languageRequirement = cleanSchoolText(record.languageRequirement, '语言要求');
  if (record.tuitionSummary !== undefined) next.tuitionSummary = cleanSchoolText(record.tuitionSummary, '费用概览');
  if (record.applicationFee !== undefined) next.applicationFee = cleanSchoolText(record.applicationFee, '申请费', 500);
  if (record.languageOfInstruction !== undefined) next.languageOfInstruction = cleanStringArrayInput(record.languageOfInstruction, '授课语言');
  if (record.scholarships !== undefined) next.scholarships = cleanStringArrayInput(record.scholarships, '奖学金');
  if (record.englishPrograms !== undefined) next.englishPrograms = cleanSchoolText(record.englishPrograms, '英文项目');
  if (record.programFields !== undefined) next.programFields = cleanStringArrayInput(record.programFields, '专业方向');
  if (record.cscaRequirementNote !== undefined) next.cscaRequirementNote = cleanSchoolText(record.cscaRequirementNote, 'CSCA 备注');
  if (record.source !== undefined) next.source = cleanSchoolText(record.source, '来源', 120);
  if (record.sourceId !== undefined) next.sourceId = cleanSchoolText(record.sourceId, '来源 ID', 160);
  if (record.sourceUrl !== undefined) next.sourceUrl = assertOptionalUrl(record.sourceUrl, '来源链接必须是有效 URL。');
  if (record.officialWebsiteUrl !== undefined) next.officialWebsiteUrl = assertOptionalUrl(record.officialWebsiteUrl, '学校官网必须是有效 URL。');
  if (record.admissionsWebsiteUrl !== undefined) next.admissionsWebsiteUrl = assertOptionalUrl(record.admissionsWebsiteUrl, '招生入口必须是有效 URL。');
  if (record.lastVerifiedAt !== undefined) {
    next.lastVerifiedAt = cleanNullableString(record.lastVerifiedAt, '核验日期格式不正确。', 20);
  }
  if (record.status !== undefined) next.status = assertRequiredString(record.status, '学校状态不正确。', 40) as AdminSchoolUpdateInput['status'];
  return next;
}

function sanitizeProgramInput(input: AdminSchoolProgramInput, mode: 'create' | 'update'): AdminSchoolProgramUpdateInput {
  const record = assertRecord(input, '专业输入不正确。');
  const next: AdminSchoolProgramUpdateInput = {};
  if (mode === 'create') {
    next.nameZh = assertRequiredString(record.nameZh, '专业中文名不能为空。', 240);
  } else if (record.nameZh !== undefined) {
    next.nameZh = assertRequiredString(record.nameZh, '专业中文名不能为空。', 240);
  }
  if (record.nameEn !== undefined) next.nameEn = cleanSchoolText(record.nameEn, '专业英文名', 240);
  if (record.degreeLevel !== undefined) next.degreeLevel = cleanSchoolText(record.degreeLevel, '学历层级', 80);
  if (record.durationYears !== undefined) next.durationYears = cleanSchoolText(record.durationYears, '学制', 80);
  if (record.fieldCategory !== undefined) next.fieldCategory = cleanSchoolText(record.fieldCategory, '学科方向', 160);
  if (record.teachingLanguage !== undefined) next.teachingLanguage = cleanSchoolText(record.teachingLanguage, '授课语言', 120);
  if (record.cscaSubjects !== undefined) next.cscaSubjects = cleanStringArrayInput(record.cscaSubjects, 'CSCA 科目');
  if (record.cscaRequirement !== undefined) next.cscaRequirement = cleanSchoolText(record.cscaRequirement, 'CSCA 要求');
  if (record.hskRequirement !== undefined) next.hskRequirement = cleanSchoolText(record.hskRequirement, 'HSK 要求');
  if (record.englishRequirement !== undefined) next.englishRequirement = cleanSchoolText(record.englishRequirement, '英语要求');
  if (record.tuitionAmount !== undefined) next.tuitionAmount = parseOptionalNumber(record.tuitionAmount as string | number | null, '学费金额');
  if (record.tuitionCurrency !== undefined) next.tuitionCurrency = cleanSchoolText(record.tuitionCurrency, '学费币种', 12);
  if (record.tuitionPeriod !== undefined) next.tuitionPeriod = cleanSchoolText(record.tuitionPeriod, '学费周期', 80);
  if (record.tuitionText !== undefined) next.tuitionText = cleanSchoolText(record.tuitionText, '学费说明');
  if (record.scholarshipText !== undefined) next.scholarshipText = cleanSchoolText(record.scholarshipText, '奖学金说明');
  if (record.openDate !== undefined) next.openDate = cleanNullableString(record.openDate, '开放日期格式不正确。', 20);
  if (record.deadlineDate !== undefined) next.deadlineDate = cleanNullableString(record.deadlineDate, '截止日期格式不正确。', 20);
  if (record.deadlineLabel !== undefined) next.deadlineLabel = cleanSchoolText(record.deadlineLabel, '截止说明', 160);
  if (record.applicationRound !== undefined) next.applicationRound = cleanSchoolText(record.applicationRound, '申请轮次', 120);
  if (record.applicationUrl !== undefined) next.applicationUrl = assertOptionalUrl(record.applicationUrl, '专业申请链接必须是有效 URL。');
  if (record.applicationNote !== undefined) next.applicationNote = cleanSchoolText(record.applicationNote, '专业申请备注');
  if (record.sourceUrl !== undefined) next.sourceUrl = assertOptionalUrl(record.sourceUrl, '专业来源链接必须是有效 URL。');
  if (record.sourceLabel !== undefined) next.sourceLabel = cleanSchoolText(record.sourceLabel, '专业来源标签', 240);
  if (record.lastVerifiedAt !== undefined) next.lastVerifiedAt = cleanNullableString(record.lastVerifiedAt, '专业核验日期格式不正确。', 20);
  if (record.sortOrder !== undefined) next.sortOrder = parseOptionalNumber(record.sortOrder as string | number | null, '排序') ?? 0;
  if (record.status !== undefined) next.status = assertRequiredString(record.status, '专业状态不正确。', 40) as AdminSchoolProgramUpdateInput['status'];
  return next;
}

function buildProgramData(input: AdminSchoolProgramUpdateInput, existing?: DbSchoolProgram) {
  return {
    nameZh: input.nameZh ?? existing?.nameZh,
    nameEn: input.nameEn === undefined ? existing?.nameEn : input.nameEn,
    degreeLevel: input.degreeLevel === undefined ? existing?.degreeLevel : input.degreeLevel,
    durationYears: input.durationYears === undefined ? existing?.durationYears : input.durationYears,
    fieldCategory: input.fieldCategory === undefined ? existing?.fieldCategory : input.fieldCategory,
    teachingLanguage: input.teachingLanguage === undefined ? existing?.teachingLanguage : input.teachingLanguage,
    cscaSubjects: input.cscaSubjects === undefined ? existing?.cscaSubjects : input.cscaSubjects,
    cscaRequirement: input.cscaRequirement === undefined ? existing?.cscaRequirement : input.cscaRequirement,
    hskRequirement: input.hskRequirement === undefined ? existing?.hskRequirement : input.hskRequirement,
    englishRequirement: input.englishRequirement === undefined ? existing?.englishRequirement : input.englishRequirement,
    tuitionAmount: input.tuitionAmount === undefined ? existing?.tuitionAmount : input.tuitionAmount,
    tuitionCurrency: input.tuitionCurrency === undefined ? existing?.tuitionCurrency : input.tuitionCurrency,
    tuitionPeriod: input.tuitionPeriod === undefined ? existing?.tuitionPeriod : input.tuitionPeriod,
    tuitionText: input.tuitionText === undefined ? existing?.tuitionText : input.tuitionText,
    scholarshipText: input.scholarshipText === undefined ? existing?.scholarshipText : input.scholarshipText,
    openDate: parseOptionalDate(input.openDate, '开放日期', existing?.openDate),
    deadlineDate: parseOptionalDate(input.deadlineDate, '截止日期', existing?.deadlineDate),
    deadlineLabel: input.deadlineLabel === undefined ? existing?.deadlineLabel : input.deadlineLabel,
    applicationRound: input.applicationRound === undefined ? existing?.applicationRound : input.applicationRound,
    applicationUrl: input.applicationUrl === undefined ? existing?.applicationUrl : input.applicationUrl,
    applicationNote: input.applicationNote === undefined ? existing?.applicationNote : input.applicationNote,
    sourceUrl: input.sourceUrl === undefined ? existing?.sourceUrl : input.sourceUrl,
    sourceLabel: input.sourceLabel === undefined ? existing?.sourceLabel : input.sourceLabel,
    lastVerifiedAt: parseVerifiedDate(input.lastVerifiedAt, existing?.lastVerifiedAt),
    sortOrder: input.sortOrder === undefined ? existing?.sortOrder ?? 0 : input.sortOrder,
    status: normalizeProgramStatus(input.status, existing?.status)
  };
}

function sanitizeCscaRuleInput(input: AdminSchoolCscaRuleInput, mode: 'create' | 'update'): AdminSchoolCscaRuleUpdateInput {
  const record = assertRecord(input, 'CSCA 规则输入不正确。');
  const next: AdminSchoolCscaRuleUpdateInput = {};
  if (mode === 'create') next.title = assertRequiredString(record.title, '规则标题不能为空。', 240);
  else if (record.title !== undefined) next.title = assertRequiredString(record.title, '规则标题不能为空。', 240);
  if (record.category !== undefined) next.category = assertRequiredString(record.category, '规则类别不能为空。', 80);
  if (record.scope !== undefined) next.scope = cleanSchoolText(record.scope, '适用范围', 240);
  if (record.programId !== undefined) next.programId = parseOptionalNumber(record.programId as string | number | null, '关联专业');
  if (record.cscaSubjects !== undefined) next.cscaSubjects = cleanStringArrayInput(record.cscaSubjects, 'CSCA 科目');
  if (record.languageCondition !== undefined) next.languageCondition = cleanSchoolText(record.languageCondition, '语言条件');
  if (record.description !== undefined) next.description = cleanSchoolText(record.description, '规则说明');
  if (record.importantNote !== undefined) next.importantNote = cleanSchoolText(record.importantNote, '重要提示');
  if (record.sourceUrl !== undefined) next.sourceUrl = assertOptionalUrl(record.sourceUrl, '规则来源链接必须是有效 URL。');
  if (record.sourceLabel !== undefined) next.sourceLabel = cleanSchoolText(record.sourceLabel, '规则来源标签', 240);
  if (record.lastVerifiedAt !== undefined) next.lastVerifiedAt = cleanNullableString(record.lastVerifiedAt, '规则核验日期格式不正确。', 20);
  if (record.sortOrder !== undefined) next.sortOrder = parseOptionalNumber(record.sortOrder as string | number | null, '排序') ?? 0;
  if (record.status !== undefined) next.status = assertRequiredString(record.status, '规则状态不正确。', 40) as AdminSchoolCscaRuleUpdateInput['status'];
  return next;
}

function buildCscaRuleData(input: AdminSchoolCscaRuleUpdateInput, existing?: DbSchoolCscaRule) {
  return {
    title: input.title ?? existing?.title,
    category: input.category ?? existing?.category ?? '其他',
    scope: input.scope === undefined ? existing?.scope : input.scope,
    programId: input.programId === undefined ? existing?.programId : toOptionalId(input.programId),
    cscaSubjects: input.cscaSubjects === undefined ? existing?.cscaSubjects : input.cscaSubjects,
    languageCondition: input.languageCondition === undefined ? existing?.languageCondition : input.languageCondition,
    description: input.description === undefined ? existing?.description : input.description,
    importantNote: input.importantNote === undefined ? existing?.importantNote : input.importantNote,
    sourceUrl: input.sourceUrl === undefined ? existing?.sourceUrl : input.sourceUrl,
    sourceLabel: input.sourceLabel === undefined ? existing?.sourceLabel : input.sourceLabel,
    lastVerifiedAt: parseVerifiedDate(input.lastVerifiedAt, existing?.lastVerifiedAt),
    sortOrder: input.sortOrder === undefined ? existing?.sortOrder ?? 0 : input.sortOrder,
    status: normalizeProgramStatus(input.status, existing?.status)
  };
}

function sanitizeScholarshipInput(input: AdminSchoolScholarshipInput, mode: 'create' | 'update'): AdminSchoolScholarshipUpdateInput {
  const record = assertRecord(input, '奖学金输入不正确。');
  const next: AdminSchoolScholarshipUpdateInput = {};
  if (mode === 'create') next.name = assertRequiredString(record.name, '奖学金名称不能为空。', 240);
  else if (record.name !== undefined) next.name = assertRequiredString(record.name, '奖学金名称不能为空。', 240);
  if (record.type !== undefined) next.type = cleanSchoolText(record.type, '奖学金类型', 80);
  if (record.programId !== undefined) next.programId = parseOptionalNumber(record.programId as string | number | null, '关联专业');
  if (record.coverage !== undefined) next.coverage = cleanSchoolText(record.coverage, '资助范围');
  if (record.applicableDegree !== undefined) next.applicableDegree = cleanSchoolText(record.applicableDegree, '适用学历', 160);
  if (record.applicableProgram !== undefined) next.applicableProgram = cleanSchoolText(record.applicableProgram, '适用专业', 240);
  if (record.amountText !== undefined) next.amountText = cleanSchoolText(record.amountText, '金额说明');
  if (record.requirementText !== undefined) next.requirementText = cleanSchoolText(record.requirementText, '申请要求');
  if (record.sourceUrl !== undefined) next.sourceUrl = assertOptionalUrl(record.sourceUrl, '奖学金来源链接必须是有效 URL。');
  if (record.sourceLabel !== undefined) next.sourceLabel = cleanSchoolText(record.sourceLabel, '奖学金来源标签', 240);
  if (record.lastVerifiedAt !== undefined) next.lastVerifiedAt = cleanNullableString(record.lastVerifiedAt, '奖学金核验日期格式不正确。', 20);
  if (record.sortOrder !== undefined) next.sortOrder = parseOptionalNumber(record.sortOrder as string | number | null, '排序') ?? 0;
  if (record.status !== undefined) next.status = assertRequiredString(record.status, '奖学金状态不正确。', 40) as AdminSchoolScholarshipUpdateInput['status'];
  return next;
}

function buildScholarshipData(input: AdminSchoolScholarshipUpdateInput, existing?: DbSchoolScholarship) {
  return {
    name: input.name ?? existing?.name,
    type: input.type === undefined ? existing?.type ?? 'general' : input.type || 'general',
    programId: input.programId === undefined ? existing?.programId : toOptionalId(input.programId),
    coverage: input.coverage === undefined ? existing?.coverage : input.coverage,
    applicableDegree: input.applicableDegree === undefined ? existing?.applicableDegree : input.applicableDegree,
    applicableProgram: input.applicableProgram === undefined ? existing?.applicableProgram : input.applicableProgram,
    amountText: input.amountText === undefined ? existing?.amountText : input.amountText,
    requirementText: input.requirementText === undefined ? existing?.requirementText : input.requirementText,
    sourceUrl: input.sourceUrl === undefined ? existing?.sourceUrl : input.sourceUrl,
    sourceLabel: input.sourceLabel === undefined ? existing?.sourceLabel : input.sourceLabel,
    lastVerifiedAt: parseVerifiedDate(input.lastVerifiedAt, existing?.lastVerifiedAt),
    sortOrder: input.sortOrder === undefined ? existing?.sortOrder ?? 0 : input.sortOrder,
    status: normalizeProgramStatus(input.status, existing?.status)
  };
}

function buildSchoolData(input: AdminSchoolUpdateInput, existing?: DbSchool) {
  const region = input.region === undefined ? existing?.region : input.region;
  const inferredCity = resolvePersistedCityInfo({
    citySlug: input.citySlug === undefined ? existing?.citySlug : input.citySlug,
    cityZh: input.cityZh === undefined ? existing?.cityZh : input.cityZh,
    region
  });
  return {
    nameZh: input.nameZh ?? existing?.nameZh,
    nameEn: input.nameEn === undefined ? existing?.nameEn : input.nameEn,
    region,
    citySlug: input.citySlug === undefined ? existing?.citySlug ?? inferredCity.citySlug : input.citySlug ?? inferredCity.citySlug,
    cityZh: input.cityZh === undefined ? existing?.cityZh ?? inferredCity.cityZh : input.cityZh ?? inferredCity.cityZh,
    schoolType: normalizeSchoolType(input.schoolType ?? existing?.schoolType),
    cscaRequired: input.cscaRequired ?? existing?.cscaRequired ?? false,
    cscaRequirement: input.cscaRequirement === undefined ? existing?.cscaRequirement : input.cscaRequirement,
    cscaRequirementNote: input.cscaRequirementNote === undefined ? existing?.cscaRequirementNote : input.cscaRequirementNote,
    hskRequirement: input.languageRequirement === undefined ? existing?.hskRequirement : input.languageRequirement,
    tuitionSummary: input.tuitionSummary === undefined ? existing?.tuitionSummary : input.tuitionSummary,
    applicationFee: input.applicationFee === undefined ? existing?.applicationFee : input.applicationFee,
    languageOfInstruction: input.languageOfInstruction === undefined ? existing?.languageOfInstruction : input.languageOfInstruction,
    scholarships: input.scholarships === undefined ? existing?.scholarships : input.scholarships,
    englishPrograms: input.englishPrograms === undefined ? existing?.englishPrograms : input.englishPrograms,
    programFields: input.programFields === undefined ? existing?.programFields : input.programFields,
    officialWebsite: input.officialWebsiteUrl === undefined ? existing?.officialWebsite : input.officialWebsiteUrl,
    applicationSystemUrl: input.admissionsWebsiteUrl === undefined ? existing?.applicationSystemUrl : input.admissionsWebsiteUrl,
    source: input.source === undefined ? existing?.source : input.source,
    sourceId: input.sourceId === undefined ? existing?.sourceId : input.sourceId,
    sourceUrl: input.sourceUrl === undefined ? existing?.sourceUrl : input.sourceUrl,
    lastVerifiedAt: parseVerifiedDate(input.lastVerifiedAt, existing?.lastVerifiedAt),
    status: normalizeSchoolStatus(input.status, existing?.status)
  };
}

function validatePublishReady(input: {
  nameZh?: string | null;
  schoolType?: string | null;
  cscaRequirement?: string | null;
  hskRequirement?: string | null;
  tuitionSummary?: string | null;
  sourceUrl?: string | null;
  lastVerifiedAt?: Date | null;
}) {
  const missing: string[] = [];
  if (!input.nameZh?.trim()) missing.push('中文名');
  if (!input.schoolType) missing.push('学校类型');
  if (!input.cscaRequirement?.trim()) missing.push('CSCA 要求');
  if (!input.hskRequirement?.trim()) missing.push('语言要求');
  if (!input.tuitionSummary?.trim()) missing.push('费用概览');
  if (!input.sourceUrl?.trim()) missing.push('来源链接');
  if (!input.lastVerifiedAt) missing.push('核验日期');
  if (missing.length) {
    throw new BadRequestException(`发布前请补齐：${missing.join('、')}。`);
  }
}

function buildFacets(schools: SchoolRecord[]): SchoolListFacets {
  return {
    regions: uniqueSorted(schools.map((school) => school.region)),
    schoolTypes: uniqueSorted(schools.map((school) => school.schoolType)),
    cscaOptions: [
      { value: 'true', label: '明确看 CSCA', count: schools.filter((school) => school.cscaRequired).length },
      { value: 'false', label: '未标记强制 CSCA', count: schools.filter((school) => !school.cscaRequired).length }
    ],
    applicationLevels: uniqueSorted(schools.flatMap(getApplicationLevelTokens))
  };
}

function buildAppliedFiltersSummary(query: SchoolSearchQuery) {
  const summary: string[] = [];
  const keyword = cleanQueryValue(query.keyword);
  const region = cleanQueryValue(query.region);
  const schoolType = cleanQueryValue(query.schoolType);
  const applicationLevel = cleanQueryValue(query.applicationLevel);
  const cscaRequired = parseBooleanFilter(query.cscaRequired);
  const sort = cleanQueryValue(query.sort);

  if (keyword) summary.push(`关键词：${keyword}`);
  if (region) summary.push(region);
  if (schoolType) summary.push(schoolType);
  if (typeof cscaRequired === 'boolean') {
    summary.push(cscaRequired ? '明确看 CSCA' : '未标记强制 CSCA');
  }
  if (applicationLevel) summary.push(applicationLevel);
  if (sort === 'csca') summary.push('排序：优先看 CSCA');
  if (sort === 'verified') summary.push('排序：优先已核验');
  if (sort === 'name') summary.push('排序：按学校名称');

  return summary;
}

function applyFilters(schools: SchoolRecord[], query: SchoolSearchQuery) {
  const keyword = normalizeKeyword(query.keyword);
  const region = cleanQueryValue(query.region);
  const schoolType = cleanQueryValue(query.schoolType);
  const cscaRequired = parseBooleanFilter(query.cscaRequired);
  const applicationLevel = cleanQueryValue(query.applicationLevel);
  const verifiedOnly = parseStrictBoolean(query.verifiedOnly);
  const quality = cleanQueryValue(query.quality);
  const language = normalizeKeyword(query.language);
  const subject = normalizeKeyword(query.subject);
  const hsk = cleanQueryValue(query.hsk);
  const hasTuition = parseOptionalBoolean(query.hasTuition);
  const hasScholarship = parseOptionalBoolean(query.hasScholarship);
  const hasEnglishPrograms = parseOptionalBoolean(query.hasEnglishPrograms);
  const degreeLevel = normalizeKeyword(query.degreeLevel);
  const teachingLanguage = normalizeKeyword(query.teachingLanguage);
  const programSubject = normalizeKeyword(query.programSubject);
  const fieldCategory = normalizeKeyword(query.fieldCategory);
  const hasProgramTuition = parseOptionalBoolean(query.hasProgramTuition);
  const hasUpcomingDeadline = parseOptionalBoolean(query.hasUpcomingDeadline);
  const hasCsc = parseOptionalBoolean(query.hasCsc);
  const hasCscaRules = parseOptionalBoolean(query.hasCscaRules);
  const hasDetailedScholarship = parseOptionalBoolean(query.hasDetailedScholarship);

  return schools.filter((school) => {
    if (region && school.region !== region) return false;
    if (schoolType && school.schoolType !== schoolType) return false;
    if (typeof cscaRequired === 'boolean' && school.cscaRequired !== cscaRequired) return false;
    if (applicationLevel && !getApplicationLevelTokens(school).includes(applicationLevel)) return false;
    if (verifiedOnly && school.verificationStatus !== 'verified') return false;
    if (quality === 'verified' && school.verificationStatus !== 'verified') return false;
    if (quality === 'pending' && school.verificationStatus !== 'pending') return false;
    if (quality === 'real' && school.verificationStatus === 'sample') return false;
    if (language && ![...(school.languageTags ?? []), ...(school.languageOfInstruction ?? []), school.languageRequirement].some((value) => includesText(value, language))) return false;
    if (subject && ![...(school.subjectTags ?? []), ...(school.cscaSubjects ?? []), school.cscaRequirement].some((value) => includesText(value, subject))) return false;
    if (hsk === 'exempt' && !(school.languageTags ?? []).some((tag) => /免 HSK/.test(tag))) return false;
    if (hsk === 'required' && !(school.languageTags ?? []).some((tag) => /HSK|中文能力/.test(tag))) return false;
    if (typeof hasTuition === 'boolean' && Boolean(school.tuitionSummary) !== hasTuition) return false;
    if (typeof hasScholarship === 'boolean' && Boolean(school.hasScholarships) !== hasScholarship) return false;
    if (typeof hasEnglishPrograms === 'boolean' && Boolean(school.hasEnglishPrograms) !== hasEnglishPrograms) return false;
    if (degreeLevel && !(school.programs ?? []).some((program) => includesText(program.degreeLevel, degreeLevel))) return false;
    if (teachingLanguage && !(school.programs ?? []).some((program) => includesText(program.teachingLanguage, teachingLanguage))) return false;
    if (programSubject && !(school.programs ?? []).some((program) => [...(program.cscaSubjects ?? []), program.cscaRequirement].some((value) => includesText(value, programSubject)))) return false;
    if (fieldCategory && !(school.programs ?? []).some((program) => includesText(program.fieldCategory, fieldCategory))) return false;
    if (typeof hasProgramTuition === 'boolean' && (school.programs ?? []).some((program) => Boolean(program.tuitionAmount || program.tuitionText)) !== hasProgramTuition) return false;
    if (typeof hasUpcomingDeadline === 'boolean' && Boolean(school.upcomingDeadlines?.length) !== hasUpcomingDeadline) return false;
    if (typeof hasCsc === 'boolean' && Boolean(school.cscScholarshipCount) !== hasCsc) return false;
    if (typeof hasCscaRules === 'boolean' && Boolean(school.cscaRules?.some((rule) => rule.status !== 'archived')) !== hasCscaRules) return false;
    if (typeof hasDetailedScholarship === 'boolean' && Boolean(school.scholarshipsDetailed?.some((item) => item.status !== 'archived')) !== hasDetailedScholarship) return false;
    if (!keyword) return true;

    return [
      school.nameZh,
      school.nameEn,
      school.region,
      school.schoolType,
      school.cscaRequirement,
      school.languageRequirement,
      school.applicationLevel,
      school.tuitionSummary,
      school.sourceLabel,
      school.decisionSummary,
      ...(school.featuredPrograms ?? []),
      ...(school.derivedTags ?? []),
      ...(school.subjectTags ?? []),
      ...(school.languageTags ?? []),
      ...(school.programs ?? []).flatMap((program) => [
        program.nameZh,
        program.nameEn,
        program.degreeLevel,
        program.fieldCategory,
        program.teachingLanguage,
        program.cscaRequirement,
        ...(program.cscaSubjects ?? [])
      ]),
      ...(school.cscaRules ?? []).flatMap((rule) => [
        rule.title,
        rule.category,
        rule.scope,
        rule.description,
        rule.importantNote,
        ...(rule.cscaSubjects ?? [])
      ]),
      ...(school.scholarshipsDetailed ?? []).flatMap((scholarship) => [
        scholarship.name,
        scholarship.type,
        scholarship.coverage,
        scholarship.amountText,
        scholarship.requirementText
      ])
    ].some((value) => includesText(value, keyword));
  });
}

function sortSchools(schools: SchoolRecord[], sort: string | undefined) {
  const next = [...schools];
  if (sort === 'name') {
    return next.sort((a, b) => a.nameZh.localeCompare(b.nameZh, 'zh-Hans-CN'));
  }
  if (sort === 'verified') {
    return next.sort((a, b) => {
      const score = (school: SchoolRecord) => (school.verificationStatus === 'verified' ? 0 : 1);
      return score(a) - score(b) || (a.rank ?? 9999) - (b.rank ?? 9999) || a.id - b.id;
    });
  }
  if (sort === 'csca') {
    return next.sort(
      (a, b) => Number(b.cscaRequired) - Number(a.cscaRequired) || (a.rank ?? 9999) - (b.rank ?? 9999) || a.id - b.id
    );
  }
  return next.sort((a, b) => (a.rank ?? 9999) - (b.rank ?? 9999) || a.id - b.id);
}

function localizeSchoolTag(value: string | undefined, locale: PublicLocale) {
  if (!value || locale !== 'en') return value;
  const exact: Record<string, string> = {
    '合作院校': 'Partner school',
    '常规院校': 'Regular school',
    '核心字段完整': 'Core fields complete',
    '科目待确认': 'Subjects pending',
    '语言待确认': 'Language pending',
    '按专业确认': 'Confirm by program',
    '中文科目': 'Chinese subject',
    '数学': 'Math',
    '物理': 'Physics',
    '化学': 'Chemistry',
    '生物': 'Biology',
    '英文试卷': 'English paper',
    '需中文能力': 'Chinese proficiency required',
    '英语证明': 'English proof',
    '中文授课': 'Chinese-taught',
    '英文授课': 'English-taught',
    '可免 HSK': 'HSK may be waived',
    '费用待补充': 'Tuition pending',
    '有费用信息': 'Tuition available',
    '英文项目': 'English programs',
    '奖学金': 'Scholarships',
    '已核验': 'Verified',
    '明确 CSCA': 'CSCA specified',
    'CSCA 待确认': 'CSCA pending',
    '学校招生页面': 'School admissions page',
    '学校官方页面': 'Official school page',
    '参考页面': 'Reference page',
    '参考页': 'Reference page',
    '截图参考信息': 'Reference page',
    '同步数据': 'Synced data',
    '已核验公开来源': 'Verified public source',
    '公开来源待核对': 'Public source pending review',
    '以学校官方页面为准': 'Confirm on the official school page',
    '专业来源': 'Program source',
    '要求来源': 'Requirement source',
    '奖学金来源': 'Scholarship source',
    '英文授课项目': 'English-taught programs',
    '中文授课项目': 'Chinese-taught programs',
    '本科项目': 'Undergraduate programs',
    '本科/项目申请': 'Undergraduate/program applications',
    '缺专业数据': 'Program data missing',
    '专业缺 CSCA 科目': 'Program CSCA subjects missing',
    '专业缺学费': 'Program tuition missing',
    '专业缺授课语言': 'Program teaching language missing',
    '专业来源未核验': 'Program source pending verification',
    '第一轮申请': 'Round 1 application',
    '第二轮申请': 'Round 2 application',
    'Chinese-English': 'Chinese and English'
  };
  if (exact[value]) return exact[value];
  if (/^HSK\s*[1-6]\+?$/.test(value)) return value;
  return value
    .replace(/核心字段完整/g, 'Core fields complete')
    .replace(/已展示\s*(\d+)\s*个，另有\s*(\d+)\s*个以参考页为准/g, 'Showing $1; $2 more depend on the reference page')
    .replace(/参考页面/g, 'reference page')
    .replace(/参考页/g, 'reference page')
    .replace(/截图参考信息/g, 'reference page')
    .replace(/同步数据/g, 'synced data')
    .replace(/待确认/g, 'Pending')
    .replace(/中文\(理科\)/g, 'Chinese (Science)')
    .replace(/中文\(文科\)/g, 'Chinese (Humanities)')
    .replace(/研究生/g, 'Postgraduate')
    .replace(/进修\/预科/g, 'Non-degree / Foundation')
    .replace(/邮箱：/g, 'Email: ')
    .replace(/电话：/g, 'Phone: ')
    .replace(/地址：/g, 'Address: ');
}

function localizeApplicationLevel(value: string, locale: PublicLocale) {
  if (locale !== 'en') return value;
  return value
    .replace(/本科/g, 'Undergraduate')
    .replace(/项目申请/g, 'Program applications');
}

function localizeFilterSummary(value: string, locale: PublicLocale) {
  if (locale !== 'en') return value;
  return value
    .replace(/^关键词：/, 'Keyword: ')
    .replace(/^地区：/, 'Region: ')
    .replace(/^类型：/, 'Type: ')
    .replace(/^申请层级：/, 'Application level: ')
    .replace(/^授课\/语言：/, 'Teaching/language: ')
    .replace(/^科目：/, 'Subject: ')
    .replace(/^学历：/, 'Degree: ')
    .replace(/^专业授课：/, 'Program language: ')
    .replace(/^专业科目：/, 'Program subject: ')
    .replace(/^学科：/, 'Field: ')
    .replace(/要求提供 CSCA/g, 'CSCA required')
    .replace(/暂未明确 CSCA/g, 'CSCA unclear')
    .replace(/有费用信息/g, 'Tuition available')
    .replace(/有奖学金/g, 'Scholarships available')
    .replace(/英文项目\/英文授课/g, 'English programs/teaching')
    .replace(/已核验来源/g, 'Verified source')
    .replace(/有专业学费/g, 'Program tuition available')
    .replace(/有即将截止项目/g, 'Upcoming deadlines')
    .replace(/有 CSC/g, 'CSC available')
    .replace(/有详细 CSCA 规则/g, 'Detailed CSCA rules')
    .replace(/有详细奖学金信息/g, 'Detailed scholarship info')
    .replace(/排序：优先看 CSCA/g, 'Sort: CSCA first')
    .replace(/排序：优先已核验/g, 'Sort: verified first')
    .replace(/排序：按学校名称/g, 'Sort: school name')
    .replace(/明确看 CSCA/g, 'CSCA specified')
    .replace(/未标记强制 CSCA/g, 'CSCA not marked as required');
}

function localizeFacets(facets: SchoolListFacets, locale: PublicLocale): SchoolListFacets {
  if (locale !== 'en') return facets;
  return {
    regions: facets.regions,
    schoolTypes: facets.schoolTypes.map((item) => localizeSchoolTag(item, locale) ?? item),
    applicationLevels: facets.applicationLevels.map((item) => localizeApplicationLevel(localizeSchoolTag(item, locale) ?? item, locale)),
    cscaOptions: facets.cscaOptions.map((option) => ({
      ...option,
      label: option.value === 'true' ? 'CSCA required' : 'CSCA unclear'
    }))
  };
}

function localizeDecisionSummary(school: SchoolRecord, locale: PublicLocale) {
  if (locale !== 'en') return school.decisionSummary;
  const csca = school.cscaRequired ? 'CSCA is specified' : 'CSCA status needs confirmation';
  const subject = school.subjectTags?.slice(0, 2).map((tag) => localizeSchoolTag(tag, locale)).join(' / ') || 'subjects pending';
  const language = school.languageTags?.slice(0, 2).map((tag) => localizeSchoolTag(tag, locale)).join(' / ') || 'language pending';
  const tuition = localizeSchoolTag(school.tuitionBandLabel, locale) || school.tuitionBandLabel || 'tuition pending';
  const verified = school.isVerified ? 'verified source' : 'source pending review';
  return `${csca}; subjects: ${subject}; language: ${language}; tuition: ${tuition}; ${verified}.`;
}

function localizePublicLongText(value: string | undefined, locale: PublicLocale, fallback?: string) {
  if (locale !== 'en') return value;
  if (!value) return fallback;
  return containsChineseText(value) ? fallback : value;
}

function localizeTimelineText(value: string | undefined, locale: PublicLocale, fallback?: string) {
  if (locale !== 'en') return value;
  if (!value) return fallback;
  if (!containsChineseText(value)) return value;

  const localized = value
    .replace(/入学考试/g, 'Entrance exam')
    .replace(/网申/g, 'online application')
    .replace(/登录/g, 'log in to')
    .replace(/登陆/g, 'log in to')
    .replace(/选“学生”/g, 'choose "Student"')
    .replace(/选“免笔试本科生”/g, 'choose "written-exam-exempt undergraduate"')
    .replace(/“考试入学本科生”/g, '"exam-entry undergraduate"')
    .replace(/填写并上传材料/g, 'complete the form and upload materials')
    .replace(/支付申请费/g, 'pay the application fee')
    .replace(/初审/g, 'initial review')
    .replace(/初试/g, 'first exam')
    .replace(/复试/g, 'second exam')
    .replace(/中文/g, 'Chinese')
    .replace(/英语/g, 'English')
    .replace(/数学/g, 'Math')
    .replace(/免笔试第一批/g, 'Written-exam exemption batch 1')
    .replace(/免笔试第二批/g, 'Written-exam exemption batch 2')
    .replace(/两批次/g, 'two batches')
    .replace(/预录取/g, 'pre-admission')
    .replace(/录取与入学/g, 'admission and enrollment')
    .replace(/材料模板与承诺书等见简章下载/g, 'download the admission brochure for material templates and commitment letters')
    .replace(/详见/g, 'See')
    .replace(/第\s*一\s*轮申请/g, 'Round 1 application')
    .replace(/第\s*二\s*轮申请/g, 'Round 2 application')
    .replace(/月底/g, 'late month')
    .replace(/月中/g, 'mid-month')
    .replace(/年/g, '-')
    .replace(/月/g, '-')
    .replace(/日/g, '')
    .replace(/（北京时间）/g, '(Beijing time)')
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    .replace(/、/g, ', ')
    .replace(/，/g, ', ')
    .replace(/。/g, '.')
    .replace(/；/g, '; ')
    .replace(/：/g, ': ')
    .replace(/→/g, ' -> ')
    .replace(/(\d{4})-(\d{1,2})-(\d{1,2})(\d{1,2}:\d{2})/g, '$1-$2-$3 $4')
    .replace(/\s+/g, ' ')
    .trim();

  return containsChineseText(localized) ? fallback : localized;
}

function localizeSchoolRequirement(school: SchoolRecord, locale: PublicLocale) {
  if (locale !== 'en') return school.cscaRequirement;
  const subjects = school.subjectTags?.slice(0, 4).map((tag) => localizeSchoolTag(tag, locale) ?? tag).join(' / ') || 'subjects pending';
  const language = school.languageTags?.slice(0, 3).map((tag) => localizeSchoolTag(tag, locale) ?? tag).join(' / ') || 'language pending';
  const status = school.cscaRequired ? 'This record marks CSCA as required.' : 'This record does not yet mark CSCA as mandatory.';
  return `${status} Confirm the target program page before applying. Subjects: ${subjects}. Language: ${language}.`;
}

function localizeDeadlineStatusLabel(label: string | undefined, locale: PublicLocale) {
  if (locale !== 'en') return label;
  if (!label) return label;
  return label
    .replace(/已截止/g, 'Closed')
    .replace(/今日截止/g, 'Closes today')
    .replace(/还有\s*(\d+)\s*天/g, '$1 days left')
    .replace(/日期待确认/g, 'Date pending')
    .replace(/待确认/g, 'Pending');
}

function localizeContactNote(note: string, locale: PublicLocale) {
  if (locale !== 'en') return note;
  const localized = localizeSchoolTag(note, locale) ?? note;
  if (/^Address:\s*/.test(localized) && containsChineseText(localized)) return 'Address: confirm on the official school page';
  return containsChineseText(localized) ? 'Confirm contact details on the official school page' : localized;
}

function localizeProgram(program: SchoolProgramRecord, locale: PublicLocale): SchoolProgramRecord {
  if (locale !== 'en') return program;
  return {
    ...program,
    degreeLevel: program.degreeLevel ? localizeApplicationLevel(localizeSchoolTag(program.degreeLevel, locale) ?? program.degreeLevel, locale) : undefined,
    fieldCategory: localizeSchoolTag(program.fieldCategory, locale) ?? localizePublicLongText(program.fieldCategory, locale),
    teachingLanguage: localizeSchoolTag(program.teachingLanguage, locale) ?? program.teachingLanguage,
    cscaSubjects: program.cscaSubjects?.map((tag) => localizeSchoolTag(tag, locale) ?? tag),
    cscaRequirement: localizePublicLongText(program.cscaRequirement, locale, 'Confirm CSCA subjects on the program page.'),
    hskRequirement: localizePublicLongText(program.hskRequirement, locale, 'Confirm language requirements on the program page.'),
    englishRequirement: localizePublicLongText(program.englishRequirement, locale, 'Confirm English proof requirements on the program page.'),
    tuitionText: localizePublicLongText(program.tuitionText, locale),
    scholarshipText: localizePublicLongText(program.scholarshipText, locale, 'Confirm scholarship information on the school scholarship page.'),
    applicationNote: localizePublicLongText(program.applicationNote, locale, 'Confirm application notes on the admissions page.'),
    displayGroupLabel: localizeSchoolTag(program.displayGroupLabel, locale),
    sourceLabel: localizeSchoolTag(program.sourceLabel, locale),
    displaySubjects: program.displaySubjects?.map((tag) => localizeSchoolTag(tag, locale) ?? tag),
    badgeText: localizeSchoolTag(program.badgeText, locale)
  };
}

function localizeSchoolRecord(school: SchoolRecord, locale: PublicLocale): SchoolRecord {
  if (locale !== 'en') return school;
  return {
    ...school,
    nameEn: school.nameEn ?? SCHOOL_NAME_EN_OVERRIDES[school.nameZh],
    schoolType: localizeSchoolTag(school.schoolType, locale) ?? school.schoolType,
    region: localizeSchoolTag(school.region, locale) ?? school.region,
    city: school.city && containsChineseText(school.city) ? school.cityZh ? localizeSchoolTag(school.cityZh, locale) : undefined : school.city,
    regionLabel: localizeSchoolTag(school.regionLabel, locale) ?? school.regionLabel,
    cscaRequirement: localizeSchoolRequirement(school, locale),
    cscaSubjects: school.cscaSubjects?.map((tag) => localizeSchoolTag(tag, locale) ?? tag),
    languageRequirement: localizePublicLongText(school.languageRequirement, locale, 'Confirm language requirements on the official school page.'),
    applicationLevel: school.applicationLevel ? localizeApplicationLevel(localizeSchoolTag(school.applicationLevel, locale) ?? school.applicationLevel, locale) : undefined,
    languageOfInstruction: school.languageOfInstruction?.map((tag) => localizeSchoolTag(tag, locale) ?? tag),
    hskRequirement: localizePublicLongText(school.hskRequirement, locale, 'Confirm HSK requirements on the official school page.'),
    englishRequirement: localizePublicLongText(school.englishRequirement, locale, 'Confirm English proof requirements on the official school page.'),
    deadlineSummary: localizePublicLongText(school.deadlineSummary, locale, 'Confirm deadlines on the admissions page.'),
    tuitionSummary: localizePublicLongText(school.tuitionSummary, locale),
    applicationFee: localizePublicLongText(school.applicationFee, locale, 'Confirm the application fee in the admissions system.'),
    sourceLabel: localizeSchoolTag(school.sourceLabel, locale),
    sourceNote: localizeSchoolTag(school.sourceNote, locale),
    completenessLabel: school.completenessLabel
      ?.split(' / ')
      .map((item) => localizeSchoolTag(item, locale) ?? item)
      .join(' / '),
    derivedTags: school.derivedTags?.map((tag) => localizeSchoolTag(tag, locale) ?? tag),
    subjectTags: school.subjectTags?.map((tag) => localizeSchoolTag(tag, locale) ?? tag),
    languageTags: school.languageTags?.map((tag) => localizeSchoolTag(tag, locale) ?? tag),
    tuitionBandLabel: localizeSchoolTag(school.tuitionBandLabel, locale),
    decisionSummary: localizeDecisionSummary(school, locale),
    programQualityIssues: school.programQualityIssues?.map((issue) => localizeSchoolTag(issue, locale) ?? issue),
    featuredPrograms: school.featuredPrograms?.map((tag) => localizePublicLongText(localizeApplicationLevel(localizeSchoolTag(tag, locale) ?? tag, locale), locale, 'Confirm program options on the school page')).filter(Boolean) as string[] | undefined,
    fitNotes: school.fitNotes?.map((tag) => localizePublicLongText(localizeApplicationLevel(localizeSchoolTag(tag, locale) ?? tag, locale), locale, 'Confirm fit notes on the official school page')).filter(Boolean) as string[] | undefined,
    requiredSubjectTags: school.requiredSubjectTags?.map((tag) => localizeSchoolTag(tag, locale) ?? tag),
    programs: school.programs?.map((program) => localizeProgram(program, locale)),
    cscaRules: school.cscaRules?.map((rule) => ({
      ...rule,
      title: localizePublicLongText(rule.title, locale, 'CSCA rule') ?? 'CSCA rule',
      category: localizeSchoolTag(rule.category, locale) ?? rule.category,
      scope: localizePublicLongText(rule.scope, locale, 'Confirm the applicable scope on the official page.'),
      cscaSubjects: rule.cscaSubjects?.map((tag) => localizeSchoolTag(tag, locale) ?? tag),
      languageCondition: localizePublicLongText(rule.languageCondition, locale, 'Confirm language conditions on the official page.'),
      description: localizePublicLongText(rule.description, locale, 'Confirm this CSCA rule on the official page.'),
      importantNote: localizePublicLongText(rule.importantNote, locale),
      applicablePrograms: rule.applicablePrograms?.map((tag) => localizePublicLongText(tag, locale, 'Program scope pending')).filter(Boolean) as string[] | undefined,
      sourceLabel: localizeSchoolTag(rule.sourceLabel, locale)
    })),
    scholarshipsDetailed: school.scholarshipsDetailed?.map((scholarship) => ({
      ...scholarship,
      name: localizePublicLongText(scholarship.name, locale, 'Scholarship') ?? 'Scholarship',
      coverage: localizePublicLongText(scholarship.coverage, locale, 'Confirm coverage in the scholarship description.'),
      applicableDegree: localizeApplicationLevel(localizeSchoolTag(scholarship.applicableDegree, locale) ?? scholarship.applicableDegree ?? '', locale) || undefined,
      applicableProgram: localizePublicLongText(scholarship.applicableProgram, locale),
      amountText: localizePublicLongText(scholarship.amountText, locale, 'Confirm the amount in the scholarship description.'),
      requirementText: localizePublicLongText(scholarship.requirementText, locale, 'Confirm requirements in the scholarship description.'),
      sourceLabel: localizeSchoolTag(scholarship.sourceLabel, locale)
    })),
    upcomingDeadlines: school.upcomingDeadlines?.map((deadline) => ({
      ...deadline,
      programName: localizePublicLongText(deadline.programName, locale, 'Program') ?? 'Program',
      degreeLevel: deadline.degreeLevel ? localizeApplicationLevel(localizeSchoolTag(deadline.degreeLevel, locale) ?? deadline.degreeLevel, locale) : undefined,
      teachingLanguage: localizeSchoolTag(deadline.teachingLanguage, locale) ?? deadline.teachingLanguage,
      applicationRound: localizePublicLongText(deadline.applicationRound, locale),
      deadlineLabel: localizePublicLongText(deadline.deadlineLabel, locale),
      statusLabel: localizeDeadlineStatusLabel(deadline.statusLabel, locale) ?? deadline.statusLabel
    })),
    quickFacts: school.quickFacts ? {
      ...school.quickFacts,
      location: localizePublicLongText(localizeSchoolTag(school.quickFacts.location, locale) ?? school.quickFacts.location, locale),
      region: localizePublicLongText(localizeSchoolTag(school.quickFacts.region, locale) ?? school.quickFacts.region, locale),
      tuition: localizeSchoolTag(school.quickFacts.tuition, locale) ?? localizePublicLongText(school.quickFacts.tuition, locale),
      livingCost: localizePublicLongText(school.quickFacts.livingCost, locale, 'Confirm living costs on the official school page.'),
      accommodation: localizePublicLongText(school.quickFacts.accommodation, locale, 'Confirm accommodation on the official school page.')
    } : undefined,
    detailDisplay: school.detailDisplay ? {
      ...school.detailDisplay,
      city: localizePublicLongText(localizeSchoolTag(school.detailDisplay.city, locale) ?? school.detailDisplay.city, locale),
      regionLabel: localizePublicLongText(localizeSchoolTag(school.detailDisplay.regionLabel, locale) ?? school.detailDisplay.regionLabel, locale),
      livingCostLabel: localizePublicLongText(school.detailDisplay.livingCostLabel, locale, 'Confirm living costs on the official school page.'),
      hiddenProgramNote: localizeSchoolTag(school.detailDisplay.hiddenProgramNote, locale),
      displaySubjectTags: school.detailDisplay.displaySubjectTags?.map((tag) => localizeSchoolTag(tag, locale) ?? tag),
      programFieldTags: school.detailDisplay.programFieldTags?.map((tag) => localizeSchoolTag(tag, locale) ?? tag),
      programDisplayGroups: school.detailDisplay.programDisplayGroups?.map((group) => ({
        ...group,
        label: localizeSchoolTag(group.label, locale) ?? group.label,
        hiddenNote: localizeSchoolTag(group.hiddenNote, locale)
      })),
      applicationTimeline: school.detailDisplay.applicationTimeline?.map((item) => ({
        ...item,
        label: localizeApplicationLevel(localizeSchoolTag(item.label, locale) ?? item.label, locale),
        dateLabel: localizeTimelineText(item.dateLabel, locale),
        description: localizeTimelineText(item.description, locale, 'Confirm timeline details on the admissions page.'),
        statusLabel: localizeDeadlineStatusLabel(item.statusLabel, locale)
      }))
    } : undefined,
    scholarships: school.scholarships?.map((item) => localizePublicLongText(item, locale, 'Confirm scholarship information on the school scholarship page.')).filter(Boolean) as string[] | undefined,
    applicationPortalNotes: localizePublicLongText(school.applicationPortalNotes, locale, 'Confirm application steps in the admissions system.'),
    campusHighlights: school.campusHighlights?.map((item) => localizePublicLongText(item, locale, 'Confirm campus information on the official school page.')).filter(Boolean) as string[] | undefined,
    contactNotes: school.contactNotes?.map((note) => localizeContactNote(note, locale))
  };
}

function buildListResult(schools: SchoolRecord[], query: SchoolSearchQuery, facetSource: SchoolRecord[] = schools): SchoolListResult {
  const locale = normalizeLocale(query.locale);
  const page = parsePositiveInt(query.page, 1, 999);
  const pageSize = parsePositiveInt(query.pageSize, 12, 50);
  const facets = localizeFacets(buildFacets(facetSource), locale);
  const filtered = sortSchools(applyFilters(schools, query), query.sort);
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;

  return {
    items: filtered.slice(start, start + pageSize).map((school) => localizeSchoolRecord(school, locale)),
    pagination: {
      page: safePage,
      pageSize,
      total,
      totalPages
    },
    facets,
    appliedFiltersSummary: buildAppliedFiltersSummary(query).map((item) => localizeFilterSummary(item, locale))
  };
}

@Injectable()
export class SchoolsService {
  private readonly logger = new Logger(SchoolsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listSchools(query: SchoolSearchQuery = {}): Promise<SchoolListResult> {
    try {
      const [schools, facetSchools] = await Promise.all([
        this.prisma.school.findMany({
          where: buildPublishedSchoolWhere({ ...query, keyword: undefined }),
          include: SCHOOL_INCLUDE,
          orderBy: [{ rank: 'asc' }, { id: 'asc' }]
        }),
        this.prisma.school.findMany({
          where: {
            status: 'published',
            ...PUBLIC_SCHOOL_DATA_EXCLUSION
          },
          include: SCHOOL_INCLUDE,
          orderBy: [{ rank: 'asc' }, { id: 'asc' }]
        })
      ]);
      return buildListResult(
        schools.map(mapSchool),
        query,
        facetSchools.map(mapSchool)
      );
    } catch (error) {
      this.logger.warn(`Falling back to in-memory schools: ${(error as Error).message}`);
      return buildListResult(FALLBACK_SCHOOLS, query);
    }
  }

  async listPublishedSchoolRecordsByIds(ids: number[]) {
    if (!ids.length) {
      return [];
    }

    const rows = await this.prisma.school.findMany({
      where: {
        id: { in: ids },
        status: 'published',
        ...PUBLIC_SCHOOL_DATA_EXCLUSION
      },
      include: SCHOOL_INCLUDE
    });
    const mapped = new Map(rows.map((row) => [row.id, mapSchool(row)] as const));
    return ids.map((id) => mapped.get(id)).filter((school): school is SchoolRecord => Boolean(school));
  }

  async getSchoolDetail(id: number, localeInput?: string) {
    const locale = normalizeLocale(localeInput);
    try {
      const school = await this.prisma.school.findFirst({
        where: {
          id,
          status: 'published',
          ...PUBLIC_SCHOOL_DATA_EXCLUSION
        },
        include: SCHOOL_INCLUDE
      });
      return school ? localizeSchoolRecord(mapSchool(school), locale) : null;
    } catch (error) {
      this.logger.warn(`Falling back to in-memory school detail: ${(error as Error).message}`);
      const fallback = FALLBACK_SCHOOLS.find((school) => school.id === id) ?? null;
      return fallback ? localizeSchoolRecord(fallback, locale) : null;
    }
  }

  async listAllPublishedSchoolRecords() {
    const schools = await this.prisma.school.findMany({
      where: {
        status: 'published',
        ...PUBLIC_SCHOOL_DATA_EXCLUSION
      },
      include: SCHOOL_INCLUDE,
      orderBy: [{ rank: 'asc' }, { id: 'asc' }]
    });
    return schools.map(mapSchool);
  }

  async listAdminSchools() {
    const rows = await this.prisma.school.findMany({
      include: SCHOOL_INCLUDE,
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }]
    });
    const items = rows.map(mapAdminSchoolSummary);
    return {
      items,
      summary: {
        total: items.length,
        published: items.filter((school) => school.status === 'published').length,
        verified: items.filter((school) => school.verificationStatus === 'verified').length
      }
    };
  }

  async getAdminSchool(id: number) {
    const row = await this.prisma.school.findUnique({ where: { id }, include: SCHOOL_INCLUDE });
    if (!row) {
      throw new NotFoundException('School not found');
    }
    return mapAdminSchoolDetail(row);
  }

  async createAdminSchool(input: AdminSchoolCreateInput, actorId: number) {
    const safeActorId = assertActorId(actorId);
    const data = buildSchoolData(sanitizeSchoolInput(input, 'create'));
    if (!data.nameZh?.trim()) {
      throw new BadRequestException('学校中文名不能为空。');
    }
    if (data.status === 'published') {
      validatePublishReady(data);
    }
    const created = await this.prisma.school.create({
      data: {
        nameZh: data.nameZh,
        nameEn: data.nameEn,
        region: data.region,
        citySlug: data.citySlug,
        cityZh: data.cityZh,
        schoolType: data.schoolType,
        cscaRequired: data.cscaRequired,
        cscaRequirement: data.cscaRequirement,
        cscaRequirementNote: data.cscaRequirementNote,
        hskRequirement: data.hskRequirement,
        tuitionSummary: data.tuitionSummary,
        applicationFee: data.applicationFee,
        languageOfInstruction: data.languageOfInstruction as never,
        scholarships: data.scholarships as never,
        englishPrograms: data.englishPrograms,
        programFields: Array.isArray(data.programFields) ? data.programFields.join('；') : data.programFields,
        officialWebsite: data.officialWebsite,
        applicationSystemUrl: data.applicationSystemUrl,
        source: data.source,
        sourceId: data.sourceId,
        sourceUrl: data.sourceUrl,
        lastVerifiedAt: data.lastVerifiedAt,
        status: data.status
      },
      include: SCHOOL_INCLUDE
    });
    const after = pickEditableSnapshot(created);
    await this.prisma.schoolChangeLog.create({
      data: {
        schoolId: created.id,
        actorId: safeActorId,
        action: 'admin.create',
        after: after as never
      }
    });
    await this.prisma.schoolSnapshot.create({
      data: {
        schoolId: created.id,
        version: 1,
        payload: after as never
      }
    });
    await recordAdminAudit(this.prisma, {
      actorId: safeActorId,
      module: 'schools',
      resourceType: 'school',
      resourceId: created.id,
      action: 'school.create',
      after
    });
    return mapAdminSchoolDetail(created);
  }

  async updateAdminSchool(id: number, input: AdminSchoolUpdateInput, actorId: number) {
    const safeActorId = assertActorId(actorId);
    const existing = await this.prisma.school.findUnique({ where: { id }, include: SCHOOL_INCLUDE });
    if (!existing) {
      throw new NotFoundException('School not found');
    }
    const expectedVersion = expectedVersionFrom(input);
    assertExpectedVersion(existing.version, expectedVersion, '院校');

    const before = pickEditableSnapshot(existing);
    const data = buildSchoolData(sanitizeSchoolInput(input, 'update'), existing);
    if (data.status === 'published') {
      validatePublishReady(data);
    }
    const updateResult = await this.prisma.school.updateMany({
      where: { id, version: existing.version },
      data: {
        nameZh: data.nameZh,
        nameEn: data.nameEn,
        region: data.region,
        citySlug: data.citySlug,
        cityZh: data.cityZh,
        schoolType: data.schoolType,
        cscaRequired: data.cscaRequired,
        cscaRequirement: data.cscaRequirement,
        cscaRequirementNote: data.cscaRequirementNote,
        hskRequirement: data.hskRequirement,
        tuitionSummary: data.tuitionSummary,
        applicationFee: data.applicationFee,
        languageOfInstruction: data.languageOfInstruction as never,
        scholarships: data.scholarships as never,
        englishPrograms: data.englishPrograms,
        programFields: Array.isArray(data.programFields) ? data.programFields.join('；') : data.programFields,
        officialWebsite: data.officialWebsite,
        applicationSystemUrl: data.applicationSystemUrl,
        source: data.source,
        sourceId: data.sourceId,
        sourceUrl: data.sourceUrl,
        lastVerifiedAt: data.lastVerifiedAt,
        status: data.status,
        version: { increment: 1 }
      }
    });
    if (updateResult.count !== 1) throw staleVersionConflict('院校', existing.version);
    const updated = await this.prisma.school.findUniqueOrThrow({ where: { id }, include: SCHOOL_INCLUDE });

    const after = pickEditableSnapshot(updated);
    const latestSnapshot = await this.prisma.schoolSnapshot.findFirst({
      where: { schoolId: id },
      orderBy: { version: 'desc' }
    });

    await this.prisma.schoolChangeLog.create({
      data: {
        schoolId: id,
        actorId: safeActorId,
        action: input.status === 'published' && existing.status !== 'published' ? 'admin.publish' : 'admin.update',
        before: before as never,
        after: after as never
      }
    });

    await this.prisma.schoolSnapshot.create({
      data: {
        schoolId: id,
        version: (latestSnapshot?.version ?? 0) + 1,
        payload: after as never
      }
    });

    await recordAdminAudit(this.prisma, {
      actorId: safeActorId,
      module: 'schools',
      resourceType: 'school',
      resourceId: id,
      action: input.status === 'published' && existing.status !== 'published' ? 'school.publish' : 'school.update',
      before,
      after
    });

    return mapAdminSchoolDetail(updated);
  }

  async archiveAdminSchool(id: number, actorId: number, input: AdminSchoolUpdateInput = {}) {
    return this.updateAdminSchool(id, { status: 'archived', expectedVersion: expectedVersionFrom(input) }, actorId);
  }

  async createAdminSchoolProgram(schoolId: number, input: AdminSchoolProgramInput, actorId: number) {
    const safeActorId = assertActorId(actorId);
    const school = await this.prisma.school.findUnique({ where: { id: schoolId }, select: { id: true, nameZh: true } });
    if (!school) throw new NotFoundException('School not found');
    const data = buildProgramData(sanitizeProgramInput(input, 'create'));
    if (!data.nameZh?.trim()) throw new BadRequestException('专业中文名不能为空。');
    const created = await this.prisma.schoolProgram.create({
      data: {
        schoolId,
        nameZh: data.nameZh,
        nameEn: data.nameEn,
        degreeLevel: data.degreeLevel,
        durationYears: data.durationYears,
        fieldCategory: data.fieldCategory,
        teachingLanguage: data.teachingLanguage,
        cscaSubjects: data.cscaSubjects as never,
        cscaRequirement: data.cscaRequirement,
        hskRequirement: data.hskRequirement,
        englishRequirement: data.englishRequirement,
        tuitionAmount: typeof data.tuitionAmount === 'number' ? data.tuitionAmount : null,
        tuitionCurrency: data.tuitionCurrency,
        tuitionPeriod: data.tuitionPeriod,
        tuitionText: data.tuitionText,
        scholarshipText: data.scholarshipText,
        openDate: data.openDate,
        deadlineDate: data.deadlineDate,
        deadlineLabel: data.deadlineLabel,
        applicationRound: data.applicationRound,
        applicationUrl: data.applicationUrl,
        applicationNote: data.applicationNote,
        sourceUrl: data.sourceUrl,
        sourceLabel: data.sourceLabel,
        lastVerifiedAt: data.lastVerifiedAt,
        sortOrder: typeof data.sortOrder === 'number' ? data.sortOrder : 0,
        status: data.status
      }
    });
    await this.prisma.schoolChangeLog.create({
      data: {
        schoolId,
        actorId: safeActorId,
        action: 'admin.program.create',
        after: { programId: created.id, nameZh: created.nameZh } as never
      }
    });
    await recordAdminAudit(this.prisma, {
      actorId: safeActorId,
      module: 'schools',
      resourceType: 'school_program',
      resourceId: created.id,
      action: 'school_program.create',
      after: { schoolId, programId: created.id, nameZh: created.nameZh }
    });
    return mapProgram(created);
  }

  async updateAdminSchoolProgram(schoolId: number, programId: number, input: AdminSchoolProgramUpdateInput, actorId: number) {
    const safeActorId = assertActorId(actorId);
    const existing = await this.prisma.schoolProgram.findFirst({ where: { id: programId, schoolId } });
    if (!existing) throw new NotFoundException('School program not found');
    const expectedVersion = expectedVersionFrom(input);
    assertExpectedVersion(existing.version, expectedVersion, '专业');
    const before = mapProgram(existing);
    const data = buildProgramData(sanitizeProgramInput(input, 'update'), existing);
    if (!data.nameZh?.trim()) throw new BadRequestException('专业中文名不能为空。');
    const updateResult = await this.prisma.schoolProgram.updateMany({
      where: { id: programId, schoolId, version: existing.version },
      data: {
        nameZh: data.nameZh,
        nameEn: data.nameEn,
        degreeLevel: data.degreeLevel,
        durationYears: data.durationYears,
        fieldCategory: data.fieldCategory,
        teachingLanguage: data.teachingLanguage,
        cscaSubjects: data.cscaSubjects as never,
        cscaRequirement: data.cscaRequirement,
        hskRequirement: data.hskRequirement,
        englishRequirement: data.englishRequirement,
        tuitionAmount: typeof data.tuitionAmount === 'number' ? data.tuitionAmount : null,
        tuitionCurrency: data.tuitionCurrency,
        tuitionPeriod: data.tuitionPeriod,
        tuitionText: data.tuitionText,
        scholarshipText: data.scholarshipText,
        openDate: data.openDate,
        deadlineDate: data.deadlineDate,
        deadlineLabel: data.deadlineLabel,
        applicationRound: data.applicationRound,
        applicationUrl: data.applicationUrl,
        applicationNote: data.applicationNote,
        sourceUrl: data.sourceUrl,
        sourceLabel: data.sourceLabel,
        lastVerifiedAt: data.lastVerifiedAt,
        sortOrder: typeof data.sortOrder === 'number' ? data.sortOrder : 0,
        status: data.status,
        version: { increment: 1 }
      }
    });
    if (updateResult.count !== 1) throw staleVersionConflict('专业', existing.version);
    const updated = await this.prisma.schoolProgram.findUniqueOrThrow({ where: { id: programId } });
    const after = mapProgram(updated);
    await this.prisma.schoolChangeLog.create({
      data: {
        schoolId,
        actorId: safeActorId,
        action: input.status === 'archived' && existing.status !== 'archived' ? 'admin.program.archive' : 'admin.program.update',
        before: before as never,
        after: after as never
      }
    });
    await recordAdminAudit(this.prisma, {
      actorId: safeActorId,
      module: 'schools',
      resourceType: 'school_program',
      resourceId: programId,
      action: input.status === 'archived' && existing.status !== 'archived' ? 'school_program.archive' : 'school_program.update',
      before,
      after
    });
    return after;
  }

  async archiveAdminSchoolProgram(schoolId: number, programId: number, actorId: number, input: AdminSchoolProgramUpdateInput = {}) {
    return this.updateAdminSchoolProgram(schoolId, programId, { status: 'archived', expectedVersion: expectedVersionFrom(input) }, actorId);
  }

  private async assertProgramBelongsToSchool(schoolId: number, programId: number | null | undefined) {
    if (!programId) return;
    const program = await this.prisma.schoolProgram.findFirst({ where: { id: programId, schoolId }, select: { id: true } });
    if (!program) throw new BadRequestException('关联专业不属于当前学校。');
  }

  async createAdminSchoolCscaRule(schoolId: number, input: AdminSchoolCscaRuleInput, actorId: number) {
    const safeActorId = assertActorId(actorId);
    const school = await this.prisma.school.findUnique({ where: { id: schoolId }, select: { id: true } });
    if (!school) throw new NotFoundException('School not found');
    const data = buildCscaRuleData(sanitizeCscaRuleInput(input, 'create'));
    if (!data.title?.trim()) throw new BadRequestException('规则标题不能为空。');
    await this.assertProgramBelongsToSchool(schoolId, data.programId);
    const created = await this.prisma.schoolCscaRule.create({
      data: {
        schoolId,
        programId: data.programId || null,
        title: data.title,
        category: data.category,
        scope: data.scope,
        cscaSubjects: data.cscaSubjects as never,
        languageCondition: data.languageCondition,
        description: data.description,
        importantNote: data.importantNote,
        sourceUrl: data.sourceUrl,
        sourceLabel: data.sourceLabel,
        lastVerifiedAt: data.lastVerifiedAt,
        sortOrder: typeof data.sortOrder === 'number' ? data.sortOrder : 0,
        status: data.status
      }
    });
    await this.prisma.schoolChangeLog.create({
      data: { schoolId, actorId: safeActorId, action: 'admin.csca_rule.create', after: { ruleId: created.id, title: created.title } as never }
    });
    await recordAdminAudit(this.prisma, {
      actorId: safeActorId,
      module: 'schools',
      resourceType: 'school_csca_rule',
      resourceId: created.id,
      action: 'school_csca_rule.create',
      after: { schoolId, ruleId: created.id, title: created.title }
    });
    return mapCscaRule(created);
  }

  async updateAdminSchoolCscaRule(schoolId: number, ruleId: number, input: AdminSchoolCscaRuleUpdateInput, actorId: number) {
    const safeActorId = assertActorId(actorId);
    const existing = await this.prisma.schoolCscaRule.findFirst({ where: { id: ruleId, schoolId } });
    if (!existing) throw new NotFoundException('School CSCA rule not found');
    const expectedVersion = expectedVersionFrom(input);
    assertExpectedVersion(existing.version, expectedVersion, 'CSCA 规则');
    const before = mapCscaRule(existing);
    const data = buildCscaRuleData(sanitizeCscaRuleInput(input, 'update'), existing);
    if (!data.title?.trim()) throw new BadRequestException('规则标题不能为空。');
    await this.assertProgramBelongsToSchool(schoolId, data.programId);
    const updateResult = await this.prisma.schoolCscaRule.updateMany({
      where: { id: ruleId, schoolId, version: existing.version },
      data: {
        programId: data.programId || null,
        title: data.title,
        category: data.category,
        scope: data.scope,
        cscaSubjects: data.cscaSubjects as never,
        languageCondition: data.languageCondition,
        description: data.description,
        importantNote: data.importantNote,
        sourceUrl: data.sourceUrl,
        sourceLabel: data.sourceLabel,
        lastVerifiedAt: data.lastVerifiedAt,
        sortOrder: typeof data.sortOrder === 'number' ? data.sortOrder : 0,
        status: data.status,
        version: { increment: 1 }
      }
    });
    if (updateResult.count !== 1) throw staleVersionConflict('CSCA 规则', existing.version);
    const updated = await this.prisma.schoolCscaRule.findUniqueOrThrow({ where: { id: ruleId } });
    const after = mapCscaRule(updated);
    await this.prisma.schoolChangeLog.create({
      data: { schoolId, actorId: safeActorId, action: input.status === 'archived' && existing.status !== 'archived' ? 'admin.csca_rule.archive' : 'admin.csca_rule.update', before: before as never, after: after as never }
    });
    await recordAdminAudit(this.prisma, {
      actorId: safeActorId,
      module: 'schools',
      resourceType: 'school_csca_rule',
      resourceId: ruleId,
      action: input.status === 'archived' && existing.status !== 'archived' ? 'school_csca_rule.archive' : 'school_csca_rule.update',
      before,
      after
    });
    return after;
  }

  async archiveAdminSchoolCscaRule(schoolId: number, ruleId: number, actorId: number, input: AdminSchoolCscaRuleUpdateInput = {}) {
    return this.updateAdminSchoolCscaRule(schoolId, ruleId, { status: 'archived', expectedVersion: expectedVersionFrom(input) }, actorId);
  }

  async createAdminSchoolScholarship(schoolId: number, input: AdminSchoolScholarshipInput, actorId: number) {
    const safeActorId = assertActorId(actorId);
    const school = await this.prisma.school.findUnique({ where: { id: schoolId }, select: { id: true } });
    if (!school) throw new NotFoundException('School not found');
    const data = buildScholarshipData(sanitizeScholarshipInput(input, 'create'));
    if (!data.name?.trim()) throw new BadRequestException('奖学金名称不能为空。');
    await this.assertProgramBelongsToSchool(schoolId, data.programId);
    const created = await this.prisma.schoolScholarship.create({
      data: {
        schoolId,
        programId: data.programId || null,
        name: data.name,
        type: data.type,
        coverage: data.coverage,
        applicableDegree: data.applicableDegree,
        applicableProgram: data.applicableProgram,
        amountText: data.amountText,
        requirementText: data.requirementText,
        sourceUrl: data.sourceUrl,
        sourceLabel: data.sourceLabel,
        lastVerifiedAt: data.lastVerifiedAt,
        sortOrder: typeof data.sortOrder === 'number' ? data.sortOrder : 0,
        status: data.status
      }
    });
    await this.prisma.schoolChangeLog.create({
      data: { schoolId, actorId: safeActorId, action: 'admin.scholarship.create', after: { scholarshipId: created.id, name: created.name } as never }
    });
    await recordAdminAudit(this.prisma, {
      actorId: safeActorId,
      module: 'schools',
      resourceType: 'school_scholarship',
      resourceId: created.id,
      action: 'school_scholarship.create',
      after: { schoolId, scholarshipId: created.id, name: created.name }
    });
    return mapSchoolScholarship(created);
  }

  async updateAdminSchoolScholarship(schoolId: number, scholarshipId: number, input: AdminSchoolScholarshipUpdateInput, actorId: number) {
    const safeActorId = assertActorId(actorId);
    const existing = await this.prisma.schoolScholarship.findFirst({ where: { id: scholarshipId, schoolId } });
    if (!existing) throw new NotFoundException('School scholarship not found');
    const expectedVersion = expectedVersionFrom(input);
    assertExpectedVersion(existing.version, expectedVersion, '院校奖学金');
    const before = mapSchoolScholarship(existing);
    const data = buildScholarshipData(sanitizeScholarshipInput(input, 'update'), existing);
    if (!data.name?.trim()) throw new BadRequestException('奖学金名称不能为空。');
    await this.assertProgramBelongsToSchool(schoolId, data.programId);
    const updateResult = await this.prisma.schoolScholarship.updateMany({
      where: { id: scholarshipId, schoolId, version: existing.version },
      data: {
        programId: data.programId || null,
        name: data.name,
        type: data.type,
        coverage: data.coverage,
        applicableDegree: data.applicableDegree,
        applicableProgram: data.applicableProgram,
        amountText: data.amountText,
        requirementText: data.requirementText,
        sourceUrl: data.sourceUrl,
        sourceLabel: data.sourceLabel,
        lastVerifiedAt: data.lastVerifiedAt,
        sortOrder: typeof data.sortOrder === 'number' ? data.sortOrder : 0,
        status: data.status,
        version: { increment: 1 }
      }
    });
    if (updateResult.count !== 1) throw staleVersionConflict('院校奖学金', existing.version);
    const updated = await this.prisma.schoolScholarship.findUniqueOrThrow({ where: { id: scholarshipId } });
    const after = mapSchoolScholarship(updated);
    await this.prisma.schoolChangeLog.create({
      data: { schoolId, actorId: safeActorId, action: input.status === 'archived' && existing.status !== 'archived' ? 'admin.scholarship.archive' : 'admin.scholarship.update', before: before as never, after: after as never }
    });
    await recordAdminAudit(this.prisma, {
      actorId: safeActorId,
      module: 'schools',
      resourceType: 'school_scholarship',
      resourceId: scholarshipId,
      action: input.status === 'archived' && existing.status !== 'archived' ? 'school_scholarship.archive' : 'school_scholarship.update',
      before,
      after
    });
    return after;
  }

  async archiveAdminSchoolScholarship(schoolId: number, scholarshipId: number, actorId: number, input: AdminSchoolScholarshipUpdateInput = {}) {
    return this.updateAdminSchoolScholarship(schoolId, scholarshipId, { status: 'archived', expectedVersion: expectedVersionFrom(input) }, actorId);
  }

  async importAdminSchools(input: AdminSchoolImportInput | AdminSchoolCreateInput[], actorId: number, options: { dryRun?: boolean } = {}) {
    const safeActorId = assertActorId(actorId);
    const items = Array.isArray(input) ? input : input.items;
    if (!Array.isArray(items)) {
      throw new BadRequestException('导入内容必须是数组，或包含 items 数组。');
    }

    const result = {
      created: 0,
      updated: 0,
      programsCreated: 0,
      programsUpdated: 0,
      cscaRulesCreated: 0,
      cscaRulesUpdated: 0,
      scholarshipsCreated: 0,
      scholarshipsUpdated: 0,
      skipped: 0,
      errors: [] as Array<{ index: number; message: string }>
    };

    for (const [index, item] of items.entries()) {
      try {
        if (!item.nameZh?.trim()) {
          result.skipped += 1;
          result.errors.push({ index, message: '缺少学校中文名。' });
          continue;
        }
        const source = item.source || 'admin-import';
        const sourceId = item.sourceId || item.nameZh;
        const existing = await this.prisma.school.findFirst({ where: { source, sourceId } });
        if (existing) {
          if (!options.dryRun) {
            const updated = await this.updateAdminSchool(existing.id, { ...item, source, sourceId }, safeActorId);
            const programResult = await this.importProgramsForSchool(updated.id, item.programs, safeActorId);
            const ruleResult = await this.importCscaRulesForSchool(updated.id, item.cscaRules, safeActorId);
            const scholarshipResult = await this.importScholarshipsForSchool(updated.id, item.scholarshipsDetailed, safeActorId);
            result.programsCreated += programResult.created;
            result.programsUpdated += programResult.updated;
            result.cscaRulesCreated += ruleResult.created;
            result.cscaRulesUpdated += ruleResult.updated;
            result.scholarshipsCreated += scholarshipResult.created;
            result.scholarshipsUpdated += scholarshipResult.updated;
          }
          result.updated += 1;
        } else {
          if (!options.dryRun) {
            const created = await this.createAdminSchool({ ...item, source, sourceId }, safeActorId);
            const programResult = await this.importProgramsForSchool(created.id, item.programs, safeActorId);
            const ruleResult = await this.importCscaRulesForSchool(created.id, item.cscaRules, safeActorId);
            const scholarshipResult = await this.importScholarshipsForSchool(created.id, item.scholarshipsDetailed, safeActorId);
            result.programsCreated += programResult.created;
            result.programsUpdated += programResult.updated;
            result.cscaRulesCreated += ruleResult.created;
            result.cscaRulesUpdated += ruleResult.updated;
            result.scholarshipsCreated += scholarshipResult.created;
            result.scholarshipsUpdated += scholarshipResult.updated;
          }
          result.created += 1;
        }
      } catch (error) {
        result.skipped += 1;
        result.errors.push({ index, message: (error as Error).message });
      }
    }

    if (!options.dryRun) {
      await recordAdminAudit(this.prisma, {
        actorId: safeActorId,
        module: 'schools',
        resourceType: 'school_import',
        action: 'school.import',
        after: result
      });
    }
    return result;
  }

  private async importProgramsForSchool(schoolId: number, programs: AdminSchoolProgramInput[] | undefined, actorId: number) {
    const result = { created: 0, updated: 0 };
    if (!Array.isArray(programs)) return result;
    for (const program of programs) {
      const safe = sanitizeProgramInput(program, 'create');
      const nameZh = safe.nameZh?.trim();
      if (!nameZh) continue;
      const existing = await this.prisma.schoolProgram.findFirst({
        where: {
          schoolId,
          nameZh,
          degreeLevel: safe.degreeLevel ?? null
        }
      });
      if (existing) {
        await this.updateAdminSchoolProgram(schoolId, existing.id, safe, actorId);
        result.updated += 1;
      } else {
        await this.createAdminSchoolProgram(schoolId, safe, actorId);
        result.created += 1;
      }
    }
    return result;
  }

  private async importCscaRulesForSchool(schoolId: number, rules: AdminSchoolCscaRuleInput[] | undefined, actorId: number) {
    const result = { created: 0, updated: 0 };
    if (!Array.isArray(rules)) return result;
    for (const rule of rules) {
      const safe = sanitizeCscaRuleInput(rule, 'create');
      const title = safe.title?.trim();
      if (!title) continue;
      const existing = await this.prisma.schoolCscaRule.findFirst({
        where: {
          schoolId,
          title,
          category: safe.category ?? '其他',
          scope: safe.scope ?? null
        }
      });
      if (existing) {
        await this.updateAdminSchoolCscaRule(schoolId, existing.id, safe, actorId);
        result.updated += 1;
      } else {
        await this.createAdminSchoolCscaRule(schoolId, safe, actorId);
        result.created += 1;
      }
    }
    return result;
  }

  private async importScholarshipsForSchool(schoolId: number, scholarships: AdminSchoolScholarshipInput[] | undefined, actorId: number) {
    const result = { created: 0, updated: 0 };
    if (!Array.isArray(scholarships)) return result;
    for (const scholarship of scholarships) {
      const safe = sanitizeScholarshipInput(scholarship, 'create');
      const name = safe.name?.trim();
      if (!name) continue;
      const existing = await this.prisma.schoolScholarship.findFirst({
        where: {
          schoolId,
          name,
          type: safe.type || 'general'
        }
      });
      if (existing) {
        await this.updateAdminSchoolScholarship(schoolId, existing.id, safe, actorId);
        result.updated += 1;
      } else {
        await this.createAdminSchoolScholarship(schoolId, safe, actorId);
        result.created += 1;
      }
    }
    return result;
  }

  async listSchoolChangeLogs(id: number): Promise<SchoolChangeLogRecord[]> {
    const school = await this.prisma.school.findUnique({ where: { id }, select: { id: true } });
    if (!school) {
      throw new NotFoundException('School not found');
    }

    const logs = await this.prisma.schoolChangeLog.findMany({
      where: { schoolId: id },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 20
    });
    const actorIds = Array.from(new Set(logs.map((log) => log.actorId).filter((value): value is number => typeof value === 'number')));
    const actors = actorIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, email: true, loginName: true }
        })
      : [];
    const actorMap = new Map(actors.map((actor) => [actor.id, actor.email ?? actor.loginName ?? `user-${actor.id}`] as const));

    return logs.map((log: DbSchoolChangeLog) => {
      const before = readPlainObject(log.before);
      const after = readPlainObject(log.after);
      return {
        id: log.id,
        action: log.action,
        actorId: log.actorId ?? undefined,
        actorEmail: log.actorId ? actorMap.get(log.actorId) : undefined,
        createdAt: log.createdAt.toISOString(),
        before,
        after,
        changes: summarizeChanges(before, after)
      };
    });
  }
}

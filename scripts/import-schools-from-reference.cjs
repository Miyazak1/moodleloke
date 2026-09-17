const fs = require('node:fs');
const path = require('node:path');
const { loadEnv } = require('./load-env.cjs');
const { PrismaClient } = require('../backend/node_modules/@prisma/client');

loadEnv(path.resolve(__dirname, '..'));

const DEFAULT_SOURCE = 'D:\\工作文件\\国内大学信息收集\\backend\\data\\schools_seed.json';
const sourceFile = process.env.SOURCE_SCHOOLS_JSON || DEFAULT_SOURCE;
const prisma = new PrismaClient();

function toInt(value) {
  if (value == null || value === '') return null;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function toFloat(value) {
  if (value == null || value === '') return null;
  const parsed = Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function toBool(value) {
  if (value === true || value === 1 || value === '1') return true;
  if (typeof value === 'string') {
    return ['true', 'yes', 'y', '需提供', 'required'].includes(value.trim().toLowerCase());
  }
  return false;
}

function asJson(value) {
  if (value == null || value === '') return undefined;
  if (Array.isArray(value) || typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return [String(value)];
  }
}

function clean(value) {
  if (value == null) return undefined;
  const text = String(value).trim();
  return text.length ? text : undefined;
}

const CITY_SLUGS = [
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

function resolveCityInfo(city, region) {
  const haystack = [city, region].filter(Boolean).join(' ').toLowerCase();
  return CITY_SLUGS.find((item) => [item.cityZh, item.cityEn, ...item.aliases].some((alias) => haystack.includes(alias.toLowerCase())));
}

function missingFieldsFor(mapped) {
  const missing = [];
  if (!mapped.cscaRequirement && !mapped.cscaRequirementNote && !mapped.undergradRequirements) missing.push('csca');
  if (!mapped.hskRequirement && !mapped.englishRequirementNote && !mapped.languageOfInstruction) missing.push('language');
  if (!mapped.admissionLevel) missing.push('applicationLevel');
  if (!mapped.tuitionSummary) missing.push('tuition');
  if (!mapped.sourceUrl) missing.push('sourceUrl');
  return missing;
}

function qualityScoreFor(mapped) {
  return Math.max(0, 100 - missingFieldsFor(mapped).length * 15);
}

function mapSchool(row) {
  const sourceUrl = clean(row.source_url || row.official_website || row.application_system_url);
  const cityInfo = resolveCityInfo(row.city, row.region);
  const mapped = {
    id: toInt(row.id) || undefined,
    nameZh: clean(row.name_zh) || '未命名学校',
    nameEn: clean(row.name_en),
    rank: toInt(row.rank),
    schoolType: row.school_type === 'partner' ? 'partner' : 'regular',
    citySlug: cityInfo?.slug,
    cityZh: cityInfo?.cityZh,
    guaranteedAdmission: toBool(row.guaranteed_admission),
    tierEn: clean(row.tier_en),
    region: clean(row.region),
    logoUrl: clean(row.logo_url),
    officialWebsite: clean(row.official_website),
    applicationSystemUrl: clean(row.application_system_url),
    admissionLevel: asJson(row.admission_level),
    hskRequirement: clean(row.hsk_requirement),
    hskNotes: clean(row.hsk_notes),
    cscaRequirement: clean(row.csca_requirement),
    cscaRequired: toBool(row.csca_required) || /需|要求|required|CSCA/i.test(row.csca_requirement || ''),
    cscaRequirementNote: clean(row.csca_requirement_note),
    undergradRequirements: clean(row.undergrad_requirements),
    postgradRequirements: clean(row.postgrad_requirements),
    preparatoryRequirements: clean(row.preparatory_requirements),
    languageOfInstruction: asJson(row.language_of_instruction),
    hskMinLevel: toInt(row.hsk_min_level),
    hskChineseMinLevel: toInt(row.hsk_chinese_min_level),
    hskChineseMinListening: toInt(row.hsk_chinese_min_listening),
    hskChineseMinReading: toInt(row.hsk_chinese_min_reading),
    hskChineseMinWriting: toInt(row.hsk_chinese_min_writing),
    hskChineseConditional: clean(row.hsk_chinese_conditional),
    hskEnglishRequired: toBool(row.hsk_english_required),
    hskkRequired: toBool(row.hskk_required),
    hskkChineseMinLevel: clean(row.hskk_chinese_min_level),
    hskkChineseConditional: clean(row.hskk_chinese_conditional),
    englishRequired: toBool(row.english_required),
    englishMinIelts: toFloat(row.english_min_ielts),
    englishMinToefl: toInt(row.english_min_toefl),
    englishRequirementNote: clean(row.english_requirement_note),
    round1Deadline: clean(row.round1_deadline),
    round2Deadline: clean(row.round2_deadline),
    round1OpenDate: clean(row.round1_open_date),
    round1CloseDate: clean(row.round1_close_date),
    round2OpenDate: clean(row.round2_open_date),
    round2CloseDate: clean(row.round2_close_date),
    applicationSteps: clean(row.application_steps),
    tuitionSummary: clean(row.tuition_summary),
    tuitionByCategory: asJson(row.tuition_by_category),
    applicationFee: clean(row.application_fee),
    insurance: clean(row.insurance),
    accommodationCost: clean(row.accommodation_cost),
    accommodationType: clean(row.accommodation_type),
    scholarships: asJson(row.scholarships),
    englishPrograms: clean(row.english_programs),
    notablePrograms: clean(row.notable_programs),
    campusFacilities: clean(row.campus_facilities),
    programFields: clean(row.program_fields),
    contactTel: clean(row.contact_tel),
    contactEmail: clean(row.contact_email),
    contactAddress: clean(row.contact_address),
    yearEstablished: toInt(row.year_established),
    studentCount: clean(row.student_count),
    studentsServed: toInt(row.students_served),
    under18GuardianRequired: toBool(row.under_18_guardian_required),
    under18RequirementNote: clean(row.under_18_requirement_note),
    status: 'published',
    source: 'domestic-university-reference',
    sourceId: row.id != null ? String(row.id) : undefined,
    sourceUrl,
    lastVerifiedAt: sourceUrl ? new Date() : null
  };
  mapped.dataQualityScore = qualityScoreFor(mapped);
  return mapped;
}

async function findExistingSchool(mapped) {
  if (mapped.id) {
    const byId = await prisma.school.findUnique({ where: { id: mapped.id } });
    if (byId) return byId;
  }
  if (mapped.sourceId) {
    const bySource = await prisma.school.findFirst({
      where: {
        source: mapped.source,
        sourceId: mapped.sourceId
      }
    });
    if (bySource) return bySource;
  }
  return prisma.school.findFirst({ where: { nameZh: mapped.nameZh } });
}

async function upsertSchoolRaw(row, mapped) {
  if (!mapped.sourceId) {
    await prisma.schoolRaw.create({
      data: {
        source: mapped.source,
        payload: row,
        processedAt: new Date()
      }
    });
    return 'created';
  }

  const existing = await prisma.schoolRaw.findFirst({
    where: {
      source: mapped.source,
      sourceId: mapped.sourceId
    }
  });

  if (existing) {
    await prisma.schoolRaw.update({
      where: { id: existing.id },
      data: {
        payload: row,
        processedAt: new Date()
      }
    });
    return 'updated';
  }

  await prisma.schoolRaw.create({
    data: {
      source: mapped.source,
      sourceId: mapped.sourceId,
      payload: row,
      processedAt: new Date()
    }
  });
  return 'created';
}

async function upsertSchool(mapped) {
  const existing = await findExistingSchool(mapped);
  const updateData = { ...mapped };
  delete updateData.id;

  if (existing) {
    await prisma.school.update({
      where: { id: existing.id },
      data: updateData
    });
    return 'updated';
  }

  await prisma.school.create({ data: mapped });
  return 'created';
}

async function main() {
  if (!fs.existsSync(sourceFile)) {
    throw new Error(`Reference school data not found: ${sourceFile}`);
  }

  const schools = JSON.parse(fs.readFileSync(sourceFile, 'utf8'));
  if (!Array.isArray(schools)) {
    throw new Error(`Reference school data must be an array: ${sourceFile}`);
  }

  const report = {
    status: 'ok',
    sourceFile: path.resolve(sourceFile),
    total: schools.length,
    schoolsCreated: 0,
    schoolsUpdated: 0,
    rawCreated: 0,
    rawUpdated: 0,
    missingCsca: 0,
    missingSource: 0,
    missingTuition: 0,
    verified: 0,
    pending: 0
  };

  for (const row of schools) {
    const mapped = mapSchool(row);
    const rawResult = await upsertSchoolRaw(row, mapped);
    const schoolResult = await upsertSchool(mapped);
    const missing = missingFieldsFor(mapped);

    if (rawResult === 'created') report.rawCreated += 1;
    if (rawResult === 'updated') report.rawUpdated += 1;
    if (schoolResult === 'created') report.schoolsCreated += 1;
    if (schoolResult === 'updated') report.schoolsUpdated += 1;
    if (missing.includes('csca')) report.missingCsca += 1;
    if (missing.includes('sourceUrl')) report.missingSource += 1;
    if (missing.includes('tuition')) report.missingTuition += 1;
    if (mapped.sourceUrl && mapped.lastVerifiedAt) report.verified += 1;
    else report.pending += 1;
  }

  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

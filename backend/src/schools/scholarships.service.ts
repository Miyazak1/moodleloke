import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SchoolStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type ScholarshipListQuery = {
  page?: string;
  pageSize?: string;
  keyword?: string;
  type?: string;
  fundingLevel?: string;
  country?: string;
  region?: string;
  locale?: string;
};

type PublicLocale = 'zh-CN' | 'en';

const TYPE_META: Record<string, { label: string; icon: string; tone: string; body: string; coverage: string; difficulty: string }> = {
  government: { label: '政府奖学金', icon: 'lucide:landmark', tone: 'blue', body: '官方 CSC 和双边政府资助奖学金，通常覆盖学费、住宿和津贴。', coverage: '学费+生活费+保险', difficulty: '高' },
  university: { label: '大学奖学金', icon: 'lucide:graduation-cap', tone: 'purple', body: '中国大学直接为国际学生提供的奖学金，从部分到全额学费覆盖不等。', coverage: '学费（部分/全额）', difficulty: '中' },
  provincial: { label: '省级奖学金', icon: 'lucide:map-pin', tone: 'orange', body: '中国各省为吸引国际人才而提供的地区政府奖学金。', coverage: '学费+部分生活费', difficulty: '低' },
  confucius: { label: '孔子学院奖学金', icon: 'lucide:book-open-check', tone: 'red', body: '面向中文和中国文化相关学习方向的奖学金。', coverage: '学费+生活津贴', difficulty: '中' },
  other: { label: '其他奖学金', icon: 'lucide:medal', tone: 'gray', body: '特殊项目奖学金，包括企业赞助、校际合作和文化交流项目。', coverage: '项目制资助', difficulty: '中' }
};

const TYPE_META_EN: Record<string, { label: string; body: string; coverage: string; difficulty: string }> = {
  government: { label: 'Government scholarship', body: 'Official CSC and bilateral government scholarships, often covering tuition, accommodation, and stipend.', coverage: 'Tuition + stipend + insurance', difficulty: 'High' },
  university: { label: 'University scholarship', body: 'Scholarships offered directly by Chinese universities for international students, ranging from partial to full tuition coverage.', coverage: 'Tuition, partial or full', difficulty: 'Medium' },
  provincial: { label: 'Provincial scholarship', body: 'Regional government scholarships offered by Chinese provinces and cities to attract international talent.', coverage: 'Tuition + partial stipend', difficulty: 'Low' },
  confucius: { label: 'Confucius Institute scholarship', body: 'Scholarships for Chinese language and China-related study tracks.', coverage: 'Tuition + living stipend', difficulty: 'Medium' },
  other: { label: 'Other scholarship', body: 'Special scholarship programs, including sponsorships, partnerships, and exchange projects.', coverage: 'Program-based funding', difficulty: 'Medium' }
};

const SCHOLARSHIP_INCLUDE = {
  schools: {
    include: {
      school: { select: { id: true, nameZh: true, nameEn: true, region: true, status: true } }
    },
    orderBy: [{ sortOrder: 'asc' }, { schoolId: 'asc' }]
  },
  programs: {
    include: {
      program: {
        select: {
          id: true,
          schoolId: true,
          nameZh: true,
          nameEn: true,
          degreeLevel: true,
          teachingLanguage: true,
          deadlineDate: true,
          deadlineLabel: true,
          school: { select: { id: true, nameZh: true, nameEn: true, status: true } }
        }
      }
    },
    orderBy: [{ sortOrder: 'asc' }, { programId: 'asc' }]
  }
} satisfies Prisma.ScholarshipInclude;

type ScholarshipRow = Prisma.ScholarshipGetPayload<{ include: typeof SCHOLARSHIP_INCLUDE }>;
type PublicScholarship = ReturnType<typeof mapScholarship>;

function asStringArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map((item) => String(item).trim()).filter(Boolean);
    } catch {
      return value.split(/[，,;；\n]/).map((item) => item.trim()).filter(Boolean);
    }
  }
  return [];
}

function asObjectArray<T extends Record<string, unknown>>(value: unknown): T[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter((item): item is T => Boolean(item) && typeof item === 'object' && !Array.isArray(item));
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.filter((item): item is T => Boolean(item) && typeof item === 'object' && !Array.isArray(item));
    } catch {
      return [];
    }
  }
  return [];
}

function asRecord<T extends Record<string, unknown>>(value: unknown): T | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  return value as T;
}

function normalizeLocale(locale?: string): PublicLocale {
  return locale?.toLowerCase().startsWith('en') ? 'en' : 'zh-CN';
}

function containsChineseText(value?: string | null) {
  return Boolean(value && /[\u3400-\u9fff]/.test(value));
}

const SCHOLARSHIP_EN_TEXT: Record<string, string> = {
  '中国政府 / 中国-东盟合作基金': 'Chinese Government / ASEAN-China Cooperation Fund',
  多所院校: 'Multiple schools',
  上海政法学院: 'Shanghai University of Political Science and Law',
  东北师范大学: 'Northeast Normal University',
  '中国-东盟菁英奖学金申请指南': 'ASEAN-China Young Leaders Scholarship Application Guide',
  '中国-东盟菁英奖学金': 'ASEAN-China Young Leaders Scholarship',
  '中国-东盟青年英才奖学金申请指南': 'ASEAN-China Young Leaders Scholarship Application Guide',
  '中国-东盟青年英才奖学金': 'ASEAN-China Young Leaders Scholarship',
  '“一带一路”沿线国家工会干部汉语研修奖学金申请指南': 'Belt and Road Countries Trade Union Cadre Chinese Language Training Scholarship Application Guide',
  '为增进中国工会同各国工会组织的友好关系，增进中国工人阶级同各国工人阶级的友谊，为世界和平、发展、合作、工人权益和社会进步贡献力量，中华全国总工会设立面向“一带一路”沿线国家工会干部的汉语研修奖学金项目。项目培养形式为全日制汉语研修，学习期限为一学年（12个月），授课语言为汉语，项目院校为北京语言大学。':
    'The All-China Federation of Trade Unions established this Chinese language training scholarship for trade union cadres from Belt and Road countries to strengthen friendly relations among trade union organizations and workers. The program is a full-time Chinese language training program at Beijing Language and Culture University, lasting one academic year (12 months), with Chinese as the teaching language.',
  '奖学金为全额资助，包含学费、住宿费、生活费、综合医疗保险以及一次性往返国际旅费。学费、住宿费和综合医疗保险由相关单位统筹支付；生活费由学校按月发放；一次性往返国际旅费用于购买首次来华和学成回国的本国至学校所在地城市国际机票（经济舱）。':
    'This is a fully funded scholarship covering tuition, accommodation, living stipend, comprehensive medical insurance, and one-time international round-trip travel expenses. Tuition, accommodation, and medical insurance are paid by the relevant organizations; the living stipend is paid monthly by the university; travel funding is used for economy-class international flights for the first trip to China and return after completing the program.',
  '汉语研修；一学年（12个月）；全日制；授课语言为汉语；项目院校为北京语言大学':
    'Chinese language training; one academic year (12 months); full-time; taught in Chinese; host university: Beijing Language and Culture University',
  '资助内容包括学费、住宿费、生活费、综合医疗保险和一次性往返国际旅费。截图页面列出项目相关金额：学费、住宿费、生活费、保险费及旅费等由奖学金覆盖，具体金额以官方页面和录取文件为准。':
    'Funding includes tuition, accommodation, living stipend, comprehensive medical insurance, and one-time international round-trip travel expenses. Exact amounts and payment arrangements follow the official page and admission documents.',
  奖学金介绍: 'Scholarship overview',
  '为增进中国工会同各国工会组织的友好关系，增进中国工人阶级同各国工人阶级的友谊，为世界和平、发展、合作、工人权益和社会进步贡献力量，中华全国总工会设立面向“一带一路”沿线国家工会干部的汉语研修奖学金项目。':
    'The All-China Federation of Trade Unions established this Chinese language training scholarship for trade union cadres from Belt and Road countries to strengthen friendly relations among trade union organizations and workers and support peace, development, cooperation, workers\' rights, and social progress.',
  '项目培养形式为全日制汉语研修，学习期限为一学年（12个月），授课语言为汉语，项目院校为北京语言大学。奖学金名额、受理时间和年度安排以官方通知为准。':
    'The program is full-time Chinese language training for one academic year (12 months). It is taught in Chinese and hosted by Beijing Language and Culture University. Quotas, application timing, and annual arrangements follow the official notice.',
  注意事项: 'Important notes',
  '奖学金生须按时来华注册，注册后由学校按月发放生活费': 'Scholarship students must register in China on time. After registration, the university pays the living stipend monthly.',
  '奖学金生须按时来华注册，注册后由学校按月发放生活费。': 'Scholarship students must register in China on time. After registration, the university pays the living stipend monthly.',
  '未按时报到、非因健康原因请假、休学或退学等情形，可能影响奖学金资格': 'Late registration, leave for non-health reasons, suspension, withdrawal, or similar situations may affect scholarship eligibility.',
  '未按时报到、非因健康原因请假、休学或退学等情形，可能影响奖学金资格。': 'Late registration, leave for non-health reasons, suspension, withdrawal, or similar situations may affect scholarship eligibility.',
  '申请人应确保申请材料真实、完整、有效，材料不完整或不符合要求可能不予受理': 'Applicants should ensure that application materials are authentic, complete, and valid. Incomplete or non-compliant materials may not be accepted.',
  '申请人应确保申请材料真实、完整、有效，材料不完整或不符合要求可能不予受理。': 'Applicants should ensure that application materials are authentic, complete, and valid. Incomplete or non-compliant materials may not be accepted.',
  '已获得中国政府其他奖学金资助者，原则上不可同时享受本项目资助': 'Applicants who already receive another Chinese Government Scholarship generally cannot receive this scholarship at the same time.',
  '已获得中国政府其他奖学金资助者，原则上不可同时享受本项目资助。': 'Applicants who already receive another Chinese Government Scholarship generally cannot receive this scholarship at the same time.',
  申请方式: 'Application method',
  '申请人须通过中国政府奖学金来华留学管理信息系统完成网上申请，并根据项目要求提交申请表和相关材料': 'Applicants must complete the online application through the Chinese Government Scholarship information system and submit the application form and required materials according to program requirements.',
  '申请人须通过中国政府奖学金来华留学管理信息系统完成网上申请，并根据项目要求提交申请表和相关材料。': 'Applicants must complete the online application through the Chinese Government Scholarship information system and submit the application form and required materials according to program requirements.',
  '具体受理、审核、录取、签证和来华手续以官方通知及项目院校要求为准': 'Acceptance, review, admission, visa, and arrival procedures follow the official notice and host university requirements.',
  '具体受理、审核、录取、签证和来华手续以官方通知及项目院校要求为准。': 'Acceptance, review, admission, visa, and arrival procedures follow the official notice and host university requirements.',
  来华签证: 'Visa for study in China',
  '已获得录取和奖学金资格的申请人，应按录取材料要求办理来华学习签证': 'Applicants who receive admission and scholarship qualification should apply for a study visa according to the admission materials.',
  '已获得录取和奖学金资格的申请人，应按录取材料要求办理来华学习签证。': 'Applicants who receive admission and scholarship qualification should apply for a study visa according to the admission materials.',
  '入境后注册、体检复查、居留许可等手续以学校和当地管理部门要求为准': 'After entering China, registration, medical recheck, residence permit, and related procedures follow university and local authority requirements.',
  '入境后注册、体检复查、居留许可等手续以学校和当地管理部门要求为准。': 'After entering China, registration, medical recheck, residence permit, and related procedures follow university and local authority requirements.',
  '报到注册、健康认证及居留许可': 'Registration, health verification, and residence permit',
  '奖学金生须按照录取通知书规定时间到校报到注册。来华后应按学校要求完成健康认证、保险确认和居留许可办理': 'Scholarship students must register at the university within the period stated in the admission notice. After arriving in China, they should complete health verification, insurance confirmation, and residence permit procedures as required by the university.',
  '奖学金生须按照录取通知书规定时间到校报到注册。来华后应按学校要求完成健康认证、保险确认和居留许可办理。': 'Scholarship students must register at the university within the period stated in the admission notice. After arriving in China, they should complete health verification, insurance confirmation, and residence permit procedures as required by the university.',
  '未能按期完成相关手续的，可能影响注册、奖学金发放或后续学习安排': 'Failure to complete required procedures on time may affect registration, scholarship payment, or later study arrangements.',
  '未能按期完成相关手续的，可能影响注册、奖学金发放或后续学习安排。': 'Failure to complete required procedures on time may affect registration, scholarship payment, or later study arrangements.',
  language: 'Chinese language training',
  '≤45 岁': 'No older than 45',
  '“一带一路”沿线国家优先': 'Priority for applicants from Belt and Road countries',
  身份要求: 'Identity requirement',
  '非中国籍公民，身心健康': 'Non-Chinese citizens in good physical and mental health',
  工作经历: 'Work experience',
  '须具备一定工会工作经验；已有对华交流经历者优先': 'Applicants should have trade union work experience. Experience in China-related exchange is preferred.',
  '未同时获得中国政府其他奖学金': 'Applicants may not receive another Chinese Government Scholarship at the same time',
  '《中国政府奖学金申请表》（中文或英文）': 'Chinese Government Scholarship application form, in Chinese or English',
  '经过公证的最高学历证明；非中文材料需附中文或英文译文': 'Notarized highest degree certificate. Documents not in Chinese should include a Chinese or English translation.',
  '学习成绩单；非中文材料需附中文或英文译文': 'Academic transcript. Documents not in Chinese should include a Chinese or English translation.',
  学习计划: 'Study plan',
  '来华学习或研究计划，不少于500字，用中文或英文书写': 'Study or research plan for study in China, at least 500 words, written in Chinese or English',
  监护材料: 'Guardian documents',
  '年龄不满18周岁的申请人须提交在华法定监护人相关法律文件': 'Applicants under 18 must submit legal documents for a guardian in China.',
  '来华学习时间超过6个月者须提交《外国人体格检查表》扫描件': 'Applicants studying in China for more than 6 months must submit a scanned Foreigner Physical Examination Form.',
  个人简历: 'Resume',
  '须体现申请人参与工会工作的经历；在校生和在职人员须提交相关证明': 'The resume should show the applicant\'s trade union work experience. Current students and employed applicants must submit relevant proof.',
  '登录中国政府奖学金来华留学管理信息系统完成网上申请': 'Complete the online application in the Chinese Government Scholarship information system.',
  '填写申请信息，选择对应项目类别并上传申请材料': 'Fill in the application information, choose the corresponding program category, and upload application materials.',
  '下载并提交申请表，按官方通知完成后续受理和审核': 'Download and submit the application form, then follow the official notice for acceptance and review.',
  '获得录取后按学校要求办理签证、报到注册及入学手续': 'After admission, complete visa, registration, and enrollment procedures according to university requirements.',
  住宿费: 'Accommodation fee',
  一次性往返国际旅费: 'One-time international round-trip travel expenses',
  其他费用: 'Other expenses',
  '由学校按月发放，具体标准以官方通知为准。': 'Paid monthly by the university; exact standards follow the official notice.',
  '用于购买首次来华和学成回国的国际机票（经济舱）。': 'Used for economy-class international airfare for the first trip to China and return after completing the program.',
  '未列明费用以官方页面及录取文件为准。': 'Unlisted expenses follow the official page and admission documents.',
  '上海政法学院“一带一路”奖学金': 'Shanghai University of Political Science and Law Belt and Road Scholarship',
  东北师范大学中国政府奖学金: 'Northeast Normal University Chinese Government Scholarship',
  '中国-东盟菁英奖学金（ACYLS）面向东盟成员国青年人才，支持申请人赴中国高校攻读硕士、博士学位，或参加短期研究项目。项目旨在促进中国与东盟教育、人文和学术交流。':
    'The ASEAN-China Young Leaders Scholarship (ACYLS) is open to young talents from ASEAN member states. It supports applicants pursuing master\'s or doctoral degrees at Chinese universities, or joining short-term research programs. The program promotes educational, cultural, and academic exchange between China and ASEAN.',
  '中国-东盟青年英才奖学金（ACYLS）面向东盟成员国青年人才，支持申请人赴中国高校攻读硕士、博士学位，或参加短期研究项目。项目旨在促进中国与东盟教育、人文和学术交流。':
    'The ASEAN-China Young Leaders Scholarship (ACYLS) is open to young talents from ASEAN member states. It supports applicants pursuing master\'s or doctoral degrees at Chinese universities, or joining short-term research programs. The program promotes educational, cultural, and academic exchange between China and ASEAN.',
  '全额资助通常包括学费及相关学校费用、校内住宿、综合医疗保险、生活津贴、一次性安置费和国际往返机票。具体发放、报销和年度评审要求以当年官方指南及录取高校通知为准。':
    'Full funding usually covers tuition and related school fees, on-campus accommodation, comprehensive medical insurance, living stipend, one-time settlement allowance, and international round-trip airfare. Exact disbursement, reimbursement, and annual review rules should follow the current official guide and the admitting university notice.',
  '硕士项目、博士项目、4-5 个月短期研究学者项目；建议选择英文授课项目。':
    'Master\'s programs, doctoral programs, and 4-5 month short-term research scholar programs. English-taught programs are recommended.',
  '硕士生生活津贴 4,000 元/月；博士生和研究学者生活津贴 5,000 元/月；一次性安置费 3,000 元/人。国际机票、住宿、学费和医保按项目规则执行。':
    'Master\'s students receive a living stipend of RMB 4,000 per month; doctoral students and research scholars receive RMB 5,000 per month. A one-time settlement allowance of RMB 3,000 per person is provided. International airfare, accommodation, tuition, and medical insurance follow program rules.',
  '申请人须为东盟成员国公民，身心健康，具备良好的英语能力，通常需达到 IELTS 6.0 或 TOEFL 80 分及以上。\n\n申请硕士项目者须具有本科学位且年龄不超过 45 岁；申请博士项目者须具有硕士学位且年龄不超过 45 岁；申请短期研究项目者须至少具有本科学位。\n\n申请人需具备至少一年政府机构、公共或私营机构、高校、智库或类似机构工作经验；具有中国-东盟事务、国际事务、来华学习或研究经历者更匹配项目定位。\n\n申请人不可同时获得其他中国政府奖学金，并须满足所申请中国高校的其他录取要求。':
    'Applicants must be citizens of ASEAN member states, be in good physical and mental health, and have strong English proficiency, usually IELTS 6.0 or TOEFL 80 or above.\n\nMaster\'s applicants must hold a bachelor\'s degree and be no older than 45; doctoral applicants must hold a master\'s degree and be no older than 45; short-term research applicants must hold at least a bachelor\'s degree.\n\nApplicants should have at least one year of work experience in government, public or private institutions, universities, think tanks, or similar organizations. Experience related to China-ASEAN affairs, international affairs, study in China, or China/ASEAN research is especially relevant.\n\nApplicants may not receive another Chinese Government Scholarship at the same time and must also meet the admission requirements of the Chinese university they apply to.',
  项目介绍: 'Program overview',
  '中国-东盟菁英奖学金（ASEAN-China Young Leaders Scholarship, ACYLS）是面向东盟成员国青年人才的全额资助项目，重点支持具有工作经验和发展潜力的申请人赴中国高校学习或研究。':
    'The ASEAN-China Young Leaders Scholarship (ACYLS) is a fully funded program for young talents from ASEAN member states. It prioritizes applicants with work experience and development potential who plan to study or conduct research at Chinese universities.',
  '中国-东盟青年英才奖学金（ASEAN-China Young Leaders Scholarship, ACYLS）是面向东盟成员国青年人才的全额资助项目，重点支持具有工作经验和发展潜力的申请人赴中国高校学习或研究。':
    'The ASEAN-China Young Leaders Scholarship (ACYLS) is a fully funded program for young talents from ASEAN member states. It prioritizes applicants with work experience and development potential who plan to study or conduct research at Chinese universities.',
  '项目支持硕士、博士和短期研究学者类别，帮助申请人在中国高校完成学位学习、短期研究或相关培养安排，促进中国与东盟在教育、人文和专业领域的交流。':
    'The program supports master\'s, doctoral, and short-term research scholar categories. It helps applicants complete degree study, short-term research, or related training at Chinese universities, while promoting exchange between China and ASEAN in education, culture, and professional fields.',
  支持类别与学习期限: 'Supported categories and study duration',
  '硕士研究生：学习及资助期限通常为 2-3 学年。': 'Master\'s students: study and funding duration is usually 2-3 academic years.',
  '博士研究生：学习及资助期限通常为 3-4 学年。': 'Doctoral students: study and funding duration is usually 3-4 academic years.',
  '研究学者：资助期限通常为 4-5 个月。': 'Research scholars: funding duration is usually 4-5 months.',
  '授课语言以英文项目为主，申请人英语水平需满足目标项目要求。': 'Programs are mainly English-taught, and applicants must meet the language requirements of the target program.',
  资助内容和标准: 'Funding coverage and standards',
  '学费及相关学校费用由项目按规则承担。': 'Tuition and related school fees are covered according to program rules.',
  '提供校内住宿，通常为单人间安排，具体以接收高校实际安排为准。': 'On-campus accommodation is provided, usually in a single room, subject to the host university\'s actual arrangement.',
  '硕士生生活津贴 4,000 元/月；博士生和研究学者生活津贴 5,000 元/月。': 'Master\'s students receive RMB 4,000 per month; doctoral students and research scholars receive RMB 5,000 per month.',
  '一次性安置费 3,000 元/人。': 'A one-time settlement allowance of RMB 3,000 per person is provided.',
  '包含综合医疗保险。': 'Comprehensive medical insurance is included.',
  '提供国际往返机票资助；学位生和研究学者的报销规则、额度和时间点以官方指南及高校通知为准。':
    'International round-trip airfare support is provided. Reimbursement rules, amounts, and timing for degree students and research scholars follow the official guide and university notice.',
  申请资格: 'Eligibility',
  '申请人须为东盟成员国公民，身心健康。': 'Applicants must be citizens of ASEAN member states and be in good physical and mental health.',
  '英语水平良好，通常需 IELTS 6.0 或 TOEFL 80 分及以上。': 'Applicants should have strong English proficiency, usually IELTS 6.0 or TOEFL 80 or above.',
  '硕士申请人须具有本科学位且年龄不超过 45 岁。': 'Master\'s applicants must hold a bachelor\'s degree and be no older than 45.',
  '博士申请人须具有硕士学位且年龄不超过 45 岁。': 'Doctoral applicants must hold a master\'s degree and be no older than 45.',
  '短期研究项目申请人须至少具有本科学位。': 'Short-term research applicants must hold at least a bachelor\'s degree.',
  '至少具备一年相关工作经验，优先考虑中国-东盟事务、国际事务、来华学习或中国/东盟相关研究经历。':
    'Applicants should have at least one year of relevant work experience. Experience in China-ASEAN affairs, international affairs, study in China, or China/ASEAN-related research is preferred.',
  '不得同时享受其他中国政府奖学金，并须满足申请高校的录取要求。': 'Applicants may not receive another Chinese Government Scholarship at the same time and must meet the admission requirements of the chosen university.',
  申请流程: 'Application process',
  '登录中国政府奖学金来华留学管理信息系统完成线上申请，并按要求上传材料。': 'Complete the online application in the Chinese Government Scholarship information system and upload the required materials.',
  '根据申请材料清单准备文件，并按本国 ACYLS 联络点或 AUN 秘书处要求提交纸质或补充材料。':
    'Prepare documents according to the application materials list, and submit paper or supplementary materials as required by the ACYLS contact point in your country or the AUN Secretariat.',
  '各国联络点或 AUN 秘书处完成资格审核后提交推荐名单。': 'National contact points or the AUN Secretariat review eligibility and submit recommended candidates.',
  '国家留学基金委和项目联合委员会推进高校匹配、录取确认和结果通知。': 'The China Scholarship Council and the joint program committee coordinate university matching, admission confirmation, and result notification.',
  '获奖者收到录取材料后按要求办理签证、报到注册、体检复核和居留许可。': 'Awardees should apply for a visa, register at the university, complete medical review, and obtain a residence permit as required after receiving admission materials.',
  时间线: 'Timeline',
  '1-3 月：申请人完成线上申请，并向本国联络点或 AUN 秘书处提交材料。': 'January-March: applicants complete the online application and submit materials to their national contact point or the AUN Secretariat.',
  '3-4 月：联络点/AUN 进行审核推荐，项目联合委员会审议名单。': 'March-April: contact points or AUN review and recommend applicants; the joint program committee reviews the list.',
  '5-7 月：国家留学基金委与指定高校完成录取匹配。': 'May-July: the China Scholarship Council and designated universities complete admission matching.',
  '7 月底前后：通知最终结果并寄送录取材料。': 'Around late July: final results are announced and admission documents are sent.',
  '8-9 月：获奖者准备来华手续，并按录取高校要求报到注册。': 'August-September: awardees prepare to come to China and register according to the admitting university\'s requirements.',
  学费及学校费用: 'Tuition and school fees',
  校内住宿: 'On-campus accommodation',
  住宿: 'Accommodation',
  生活津贴: 'Living stipend',
  '硕士 4,000 元/月；博士和研究学者 5,000 元/月。': 'RMB 4,000 per month for master\'s students; RMB 5,000 per month for doctoral students and research scholars.',
  一次性安置费: 'One-time settlement allowance',
  '3,000 元/人。': 'RMB 3,000 per person.',
  综合医疗保险: 'Comprehensive medical insurance',
  国际往返机票: 'International round-trip airfare',
  '按项目规则购买或报销经济舱机票。': 'Economy-class airfare is purchased or reimbursed according to program rules.',
  签证费: 'Visa fee',
  '目标国家/地区': 'Target countries/regions',
  东盟成员国: 'ASEAN member states',
  学历层次: 'Degree levels',
  '硕士、博士、短期研究学者': 'Master\'s, doctoral, and short-term research scholar',
  年龄限制: 'Age limit',
  '硕士/博士申请人不超过 45 岁': 'Master\'s and doctoral applicants must be no older than 45',
  语言要求: 'Language requirement',
  'IELTS 6.0 或 TOEFL 80 分及以上，或满足高校英文项目要求': 'IELTS 6.0 or TOEFL 80 or above, or meet the English-taught program requirements of the university',
  工作经验: 'Work experience',
  '至少一年政府机构、公共/私营机构、高校、智库或类似机构工作经验': 'At least one year of work experience in government, public/private institutions, universities, think tanks, or similar organizations',
  奖学金限制: 'Scholarship restriction',
  不可同时获得其他中国政府奖学金: 'May not receive another Chinese Government Scholarship at the same time',
  申请表: 'Application form',
  '中国政府奖学金申请表（在线填写后下载/提交）': 'Chinese Government Scholarship application form (complete online, then download/submit)',
  护照: 'Passport',
  有效普通护照个人信息页扫描件: 'Scanned copy of the personal information page of a valid ordinary passport',
  学历证明: 'Degree certificate',
  '最高学历证明；预毕业申请人提交在读或预毕业证明': 'Highest degree certificate; pre-graduation applicants should submit a study certificate or pre-graduation certificate',
  成绩单: 'Academic transcript',
  '完整学习成绩单；非中文或英文材料需附认证翻译件': 'Complete academic transcripts; materials not in Chinese or English require certified translations',
  '学习/研究计划': 'Study/research plan',
  '按所申请层次和高校要求提交英文或中文学习计划/研究计划': 'Submit a study or research plan in English or Chinese according to the chosen degree level and university requirements',
  推荐信: 'Recommendation letters',
  研究生项目通常需提交教授或副教授推荐信: 'Graduate programs usually require recommendation letters from professors or associate professors',
  语言证明: 'Language certificate',
  'IELTS、TOEFL 或目标高校认可的英语能力证明': 'IELTS, TOEFL, or other English proficiency proof recognized by the target university',
  体检表: 'Physical examination form',
  '来华学习超过 6 个月者需提交《外国人体格检查表》': 'Applicants studying in China for more than 6 months must submit the Foreigner Physical Examination Form',
  简历: 'Resume',
  包含高中后教育背景和工作经历的简历: 'Resume including education after high school and work experience',
  无犯罪记录: 'Non-criminal record',
  '通常需提交 6 个月内开具的无犯罪记录证明': 'Usually requires a non-criminal record certificate issued within the past 6 months',
  '第 1 步': 'Step 1',
  '第 2 步': 'Step 2',
  '第 3 步': 'Step 3',
  '第 4 步': 'Step 4',
  '第 5 步': 'Step 5',
  '第 6 步': 'Step 6',
  '访问 Campus China / CGSIS，选择学生奖学金申请入口。': 'Visit Campus China / CGSIS and choose the student scholarship application entry.',
  '选择 Type A 项目类别，并填写 ACYLS 对应受理机构编号。': 'Select Type A program category and fill in the receiving agency code for ACYLS.',
  '填写个人信息、申请类别、院校志愿、语言能力和学习计划。': 'Fill in personal information, application category, university preferences, language ability, and study plan.',
  上传申请材料并提交系统申请: 'Upload application materials and submit the system application.',
  '上传申请材料并提交系统申请。': 'Upload application materials and submit the system application.',
  '按本国联络点或 AUN 秘书处要求提交纸质材料或补充材料。': 'Submit paper or supplementary materials as required by your national contact point or the AUN Secretariat.',
  '等待推荐、院校匹配、录取确认和最终结果通知。': 'Wait for recommendation, university matching, admission confirmation, and final result notification.',
  联系方式: 'Contact',
  '申请人也应咨询本国 ACYLS 联络点或 AUN 秘书处，确认当年受理要求': 'Applicants should also consult their national ACYLS contact point or the AUN Secretariat to confirm current-year handling requirements.',
  '申请人也应咨询本国 ACYLS 联络点或 AUN 秘书处，确认当年受理要求。': 'Applicants should also consult their national ACYLS contact point or the AUN Secretariat to confirm current-year handling requirements.',
  前往申请: 'Open application',
  '查看官方 2026 通知': 'View official 2026 notice',
  查看项目指南: 'View program guide',
  '中华人民共和国驻东盟使团 / ASEAN-China Young Leaders Scholarship 2026': 'Mission of the People\'s Republic of China to ASEAN / ASEAN-China Young Leaders Scholarship 2026',
  '2026 年 3 月 1 日': 'March 1, 2026',
  '2026/2027 学年': '2026/2027 academic year'
};

function localizeScholarshipShortText(value: string | undefined, locale: PublicLocale, fallback?: string) {
  if (locale !== 'en') return value;
  if (!value) return fallback;
  if (SCHOLARSHIP_EN_TEXT[value]) return SCHOLARSHIP_EN_TEXT[value];
  const exact: Record<string, string> = {
    政府奖学金: 'Government scholarship',
    大学奖学金: 'University scholarship',
    省级奖学金: 'Provincial scholarship',
    孔子学院奖学金: 'Confucius Institute scholarship',
    其他奖学金: 'Other scholarship',
    全额资助: 'Full funding',
    部分资助: 'Partial funding',
    待确认: 'Pending',
    学费: 'Tuition',
    住宿: 'Accommodation',
    生活费: 'Living stipend',
    医疗保险: 'Medical insurance',
    机票: 'Flights',
    签证费: 'Visa fee',
    本科: 'Bachelor',
    学士: 'Bachelor',
    硕士: 'Master',
    博士: 'Doctoral',
    研究生: 'Graduate',
    外国公民: 'Foreign citizens',
    高中毕业: 'High school graduate',
    东盟国家: 'ASEAN countries',
    一带一路国家: 'Belt and Road countries',
    不限: 'Open to all',
    以官方奖学金页面为准: 'Confirm on the official scholarship page',
    奖学金来源: 'Scholarship source',
    学校招生页面: 'School admissions page'
  };
  if (exact[value]) return exact[value];
  const localized = value
    .replace(/“一带一路”沿线国家工会干部汉语研修奖学金申请指南/g, 'Belt and Road Countries Trade Union Cadre Chinese Language Training Scholarship Application Guide')
    .replace(/上海政法学院“一带一路”奖学金/g, 'Shanghai University of Political Science and Law Belt and Road Scholarship')
    .replace(/东北师范大学中国政府奖学金/g, 'Northeast Normal University Chinese Government Scholarship')
    .replace(/三峡大学/g, 'China Three Gorges University')
    .replace(/上海中医药大学/g, 'Shanghai University of Traditional Chinese Medicine')
    .replace(/上海政法学院/g, 'Shanghai University of Political Science and Law')
    .replace(/东北师范大学/g, 'Northeast Normal University')
    .replace(/多所院校/g, 'Multiple schools')
    .replace(/中国-东盟青年英才奖学金申请指南/g, 'ASEAN-China Young Leaders Scholarship Application Guide')
    .replace(/中国-东盟青年英才奖学金/g, 'ASEAN-China Young Leaders Scholarship')
    .replace(/中国-东盟菁英奖学金申请指南/g, 'ASEAN-China Young Leaders Scholarship Application Guide')
    .replace(/中国-东盟菁英奖学金/g, 'ASEAN-China Young Leaders Scholarship')
    .replace(/外国International students/g, 'International students')
    .replace(/留学生/g, 'International students')
    .replace(/国际学生/g, 'International students')
    .replace(/外国公民/g, 'Foreign citizens')
    .replace(/本科/g, 'Bachelor')
    .replace(/硕士/g, 'Master')
    .replace(/博士/g, 'Doctoral')
    .replace(/研究生/g, 'Graduate')
    .replace(/全额资助/g, 'Full funding')
    .replace(/部分资助/g, 'Partial funding')
    .replace(/学费/g, 'Tuition')
    .replace(/住宿/g, 'Accommodation')
    .replace(/生活费/g, 'Living stipend')
    .replace(/医疗保险/g, 'Medical insurance')
    .replace(/机票/g, 'Flights')
    .replace(/签证费/g, 'Visa fee')
    .replace(/奖学金/g, 'scholarship')
    .replace(/招生页面/g, 'admissions page')
    .replace(/来源/g, 'source')
    .replace(/，/g, ', ')
    .replace(/。/g, '.')
    .replace(/；/g, '; ')
    .replace(/：/g, ': ')
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    .replace(/、/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();
  return containsChineseText(localized) ? fallback : localized || fallback;
}

function localizeScholarshipLongText(value: string | undefined, locale: PublicLocale, fallback: string) {
  if (locale !== 'en') return value;
  if (!value) return fallback;
  if (SCHOLARSHIP_EN_TEXT[value]) return SCHOLARSHIP_EN_TEXT[value];
  const localized = localizeScholarshipShortText(value, locale, fallback) ?? fallback;
  return containsChineseText(localized) ? fallback : localized;
}

function hasChineseInValue(value: unknown): boolean {
  if (typeof value === 'string') return containsChineseText(value);
  if (Array.isArray(value)) return value.some(hasChineseInValue);
  if (!value || typeof value !== 'object') return false;
  return Object.values(value).some(hasChineseInValue);
}

function hasPlaceholderText(value: unknown): boolean {
  if (typeof value === 'string') return /Confirm this|Confirm the|Confirm eligibility|Confirm contact|Section \d+|Item \d+|Funding benefit/i.test(value);
  if (Array.isArray(value)) return value.some(hasPlaceholderText);
  if (!value || typeof value !== 'object') return false;
  return Object.values(value).some(hasPlaceholderText);
}

function humanizeScholarshipSlug(slug: string) {
  return slug
    .replace(/^scholarship-\d+$/, 'Scholarship')
    .split('-')
    .filter(Boolean)
    .map((part) => (part.length <= 3 ? part.toUpperCase() : `${part.charAt(0).toUpperCase()}${part.slice(1)}`))
    .join(' ') || 'Scholarship';
}

function englishFundingLevel(level: PublicScholarship['fundingLevel']) {
  if (level === 'full') return 'full funding';
  if (level === 'partial') return 'partial funding';
  return 'funding with details to confirm';
}

function buildEnglishSummary(item: PublicScholarship, title: string, typeLabel: string) {
  const school = localizeScholarshipShortText(item.schoolNameEn || item.schoolName, 'en', 'the listed school') || 'the listed school';
  const degree = localizeScholarshipShortText(item.applicableDegree, 'en', 'eligible students') || 'eligible students';
  return `${title} is a ${typeLabel.toLowerCase()} offered through ${school} for ${degree}. It provides ${englishFundingLevel(item.fundingLevel)}. Use the current official source for final requirements, eligible programs, and application steps.`;
}

function buildEnglishCoverage(item: PublicScholarship) {
  const benefits = item.benefits
    .map((benefit) => localizeScholarshipShortText(benefit, 'en', ''))
    .filter((benefit): benefit is string => Boolean(benefit && !containsChineseText(benefit)));
  if (benefits.length) return `Funding may include ${benefits.join(', ')}. Exact coverage and renewal rules follow the official scholarship notice.`;
  return `This scholarship provides ${englishFundingLevel(item.fundingLevel)}. Exact coverage and renewal rules follow the official scholarship notice.`;
}

function buildEnglishProgramScope(item: PublicScholarship) {
  const degree = localizeScholarshipShortText(item.applicableDegree, 'en', '');
  const program = localizeScholarshipShortText(item.applicableProgram || item.programNameEn || item.programName, 'en', '');
  const parts = [degree, program].filter((part): part is string => Boolean(part && !containsChineseText(part)));
  return parts.join(' · ') || 'Eligible programs are listed in the current official scholarship notice.';
}

function buildEnglishBodySections(item: PublicScholarship, title: string, typeLabel: string) {
  return [
    {
      title: 'Scholarship overview',
      paragraphs: [
        buildEnglishSummary(item, title, typeLabel),
        buildEnglishCoverage(item)
      ]
    },
    {
      title: 'Application guidance',
      items: [
        `Check whether your degree level and program match this ${typeLabel.toLowerCase()}.`,
        'Prepare identity, academic, language, recommendation, and health materials according to the official notice.',
        'Submit the application through the official school, CSC, or scholarship system listed in the source section.',
        'Use the latest official scholarship page as the final reference for deadlines, eligibility, and award rules.'
      ]
    }
  ];
}

const ASEAN_CHINA_SCHOOLS_EN = [
  '1. Peking University | Beijing',
  '2. Tsinghua University | Beijing',
  '3. Renmin University of China | Beijing',
  '4. Beijing Normal University | Beijing',
  '5. China Agricultural University | Beijing',
  '6. Beijing Foreign Studies University | Beijing',
  '7. Beijing Language and Culture University | Beijing',
  '8. University of Science and Technology Beijing | Beijing',
  '9. Beijing Jiaotong University | Beijing',
  '10. Communication University of China | Beijing',
  '11. Central University of Finance and Economics | Beijing',
  '12. University of International Business and Economics | Beijing',
  '13. Nankai University | Tianjin',
  '14. Tianjin University | Tianjin',
  '15. Fudan University | Shanghai',
  '16. Shanghai Jiao Tong University | Shanghai',
  '17. Tongji University | Shanghai',
  '18. East China University of Science and Technology | Shanghai',
  '19. Shanghai University of Finance and Economics | Shanghai',
  '20. Nanjing University | Nanjing',
  '21. Zhejiang University | Hangzhou',
  '22. Xiamen University | Xiamen',
  '23. Wuhan University | Wuhan',
  '24. Huazhong University of Science and Technology | Wuhan',
  '25. Hunan University | Changsha',
  '26. Sichuan University | Chengdu',
  '27. Beihang University | Beijing',
  '28. Beijing Institute of Technology | Beijing',
  '29. China Foreign Affairs University | Beijing',
  '30. Shanghai University | Shanghai',
  '31. Guangxi University | Nanning',
  '32. Guizhou University | Guiyang',
  '33. Yunnan University | Kunming'
];

const ASEAN_CHINA_REQUIREMENT_TEXT_EN = [
  'Part I. Introduction to the ASEAN-China Young Leaders Scholarship',
  'To enhance mutual understanding and friendship between the people of China and ASEAN countries, and in response to the call by leaders of China and ASEAN member states to strengthen people-to-people exchange and educational cooperation, the Chinese Government established the ASEAN-China Young Leaders Scholarship. The program further strengthens the people-to-people foundation of China-ASEAN relations and helps build a closer community with a shared future.',
  'The ASEAN-China Young Leaders Scholarship is designed for young professionals from ASEAN member states who have work experience. The program is funded by the Chinese Government through the ASEAN-China Cooperation Fund.',
  'The scholarship supports citizens of ASEAN member states to study in China for master\'s or doctoral degrees, short-term advanced study, or short-term group training programs. It fully funds the related study or training expenses in China.',
  '',
  'Part II. ASEAN-China Young Leaders Scholarship Admissions Guide',
  '',
  '1. Funding categories, duration, and teaching language',
  'Funding categories: outstanding young professionals from ASEAN member states with work experience who come to China for master\'s or doctoral degree study, short-term advanced study, or short-term group training programs.',
  'Funding duration: each student category receives the corresponding funding period. Scholarship students must complete their studies within the funding period, as follows:',
  'Funding category',
  'Academic study duration',
  'Scholarship funding duration',
  'Master\'s students',
  '2-3 academic years',
  '2-3 academic years',
  'Doctoral students',
  '3-4 academic years',
  '3-4 academic years',
  'Advanced-study students',
  '5-6 months',
  '5-6 months',
  'Teaching language: English. Applicants should in principle choose English-taught programs, and their English proficiency must meet the requirements of the admitting university and relevant major.',
  '',
  '2. Funding coverage and annual review',
  'Full scholarship coverage includes tuition, accommodation, living expenses, international travel, one-time settlement allowance, and comprehensive insurance.',
  'Annual review: the China Scholarship Council and admitting universities conduct annual reviews of scholarship students\' academic performance and conduct to decide whether they continue to receive the scholarship. Students who fail the annual review will be expelled or lose scholarship eligibility.',
  '',
  '3. Application channel and timeline',
  'Applicants should apply within the required period through their national ACYLS focal points. Excellent lecturers and staff members from ASEAN elite universities may apply through the ASEAN University Network Secretariat (AUN). The application period is usually from early January to March. Please consult the competent department in your country for the specific deadline.',
  '',
  '4. Eligibility',
  '1. Applicants must be non-Chinese citizens of ASEAN member states, including Brunei, Cambodia, Indonesia, Laos, Malaysia, Myanmar, the Philippines, Singapore, Thailand, and Vietnam.',
  '2. Applicants must be in good physical and mental health.',
  '3. Applicants should have interest in and goodwill toward China and Chinese culture.',
  '4. Academic degree and age requirements:',
  'Applicants for master\'s degree study must hold a bachelor\'s degree and be no older than 45.',
  'Applicants for doctoral degree study must hold a master\'s degree and be no older than 45.',
  'Applicants coming to China as advanced-study students must hold at least a bachelor\'s degree.',
  '5. Applicants must have at least one year of work experience in a government department, public or private institution, university, think tank, or similar social organization.',
  '6. Applicants with work or study experience in China, or experience in China-related exchange or China-ASEAN relations, are preferred.',
  '7. Applicants must have strong English proficiency, such as IELTS 6.0 or TOEFL 80 or above.',
  '8. Applicants must not receive another Chinese Government Scholarship at the same time.',
  '9. Applicants must meet other admission requirements of the relevant program at the admitting university.',
  '',
  '5. Application process',
  '1. Applicants must log in to the Chinese Government Scholarship Information System for Study in China at http://www.campuschina.org, enter the system through the relevant icon, complete the online application, upload application materials, and submit the application online.',
  '2. Applicants must prepare materials according to the application materials list and submit paper materials within the required period to the competent department in their country or to the AUN Secretariat. ASEAN national authorities and the AUN Secretariat review applicant qualifications and submit recommended candidates to the Joint Committee in Jakarta, which determines the final recommended candidates.',
  '3. The China Scholarship Council only accepts applications recommended by the Joint Committee in Jakarta and does not accept individual applications. The China Scholarship Council may make necessary adjustments to applicants\' chosen universities.',
  '',
  '6. Application materials',
  'Applicants must provide authentic and valid documents according to the requirements of the Chinese Government Scholarship Information System for Study in China and upload clear scans. Materials that do not meet these requirements may affect admission results.',
  'When submitting applications to their national competent department or the AUN Secretariat, applicants must also submit materials according to the relevant local requirements.',
  '',
  '7. Program universities and majors',
  'The ASEAN-China Young Leaders Scholarship is currently implemented by 33 Chinese universities. Applicants must choose 1 to 3 preferred universities from the designated Chinese host universities. The China Scholarship Council will arrange admission according to applicants\' preferred universities and majors.',
  '',
  '8. Admission and notification',
  '1. The China Scholarship Council forwards approved applications to the preferred universities for admission arrangement. It may adjust applicants\' selected universities and majors according to scholarship funding requirements, university capacity, program duration requirements, and applicant conditions, and the university determines the admission result.',
  '2. The China Scholarship Council will notify candidates of scholarship results before July 31. Admitting universities will issue the Admission Notice and Confirmation Form for Study in China (JW201).',
  '3. After coming to China, scholarship recipients may not in principle request changes to the admitting university, major, or study duration stated in the Admission Notice.',
  '4. Scholarship eligibility will not be reserved for students who cannot come to China within the admitted period.',
  'Note: applicants should ensure that the current contact information in the Chinese Government Scholarship Information System for Study in China is accurate, detailed, and valid.',
  '',
  '9. Changes to admitting university, major, or study duration',
  'After coming to China, scholarship students may not in principle change their admitting university, major, or study duration. If a change is truly necessary due to special reasons, the student must submit an application to the China Scholarship Council and may make the change only after approval by the Joint Committee in Jakarta.',
  '',
  '10. Admission timeline',
  'Early January-March',
  'Applicants consult the student dispatching authority of their national education ministry, complete the online application, and submit the application.',
  'March-April',
  'The national competent education authority submits recommended candidates and materials to the Joint Committee in Jakarta, which conducts review.',
  'May-June',
  'The China Scholarship Council arranges admission with program universities.',
  'Late July',
  'After confirmation by the Joint Committee in Jakarta, the China Scholarship Council notifies candidates of the admission results and sends admission materials.',
  'August',
  'Scholarship recipients receive admission materials and complete procedures for coming to China.',
  'September',
  'Scholarship recipients register at the university.',
  '',
  'Part III. Program University List',
  ...ASEAN_CHINA_SCHOOLS_EN,
  '',
  'Part IV. Application Materials List',
  '1. Chinese Government Scholarship Application Form, in Chinese or English.',
  '2. Notarized highest diploma. Documents in languages other than Chinese or English must include notarized Chinese or English translations.',
  '3. Academic transcripts. Documents in languages other than Chinese or English must include notarized Chinese or English translations.',
  '4. Study or research plan in China. Advanced-study students should submit at least 500 words, and graduate students at least 800 words, written in Chinese or English.',
  '5. Recommendation letters. Applicants for master\'s or doctoral degree study, or applicants coming as advanced-study students, must submit two recommendation letters, including one employer recommendation and one academic recommendation, written in Chinese or English.',
  '6. Applicants under 18 must submit legal documents for a guardian in China.',
  '7. English proficiency proof, such as IELTS 6.0, TOEFL 80 or above, or an equivalent internationally recognized English proficiency test.',
  '8. Applicants studying in China for more than 6 months must submit a scanned Foreigner Physical Examination Form. The original should be kept by the applicant. The form is uniformly printed by China\'s health and quarantine authorities, and the attached template should be completed in English. Applicants must strictly complete all required examination items. Forms with missing items, no photo, photo without a seal across it, or no physician/hospital signature and seal are invalid. Because the examination result is valid for 6 months, applicants should arrange the examination time accordingly.',
  '9. Resume, including personal background and study and work experience after high school, uploaded in the system under other supporting materials.',
  '',
  'Part V. Chinese Government Scholarship Information System Workflow',
  'Step 1: Visit the Study in China website and click the Chinese Government Scholarship Information System for Study in China icon to enter the application system.',
  'Study in China website: http://www.campuschina.org',
  'Step 2: Program category and agency number are required fields in the Chinese Government Scholarship Information System for Study in China. Select Type A as the program category and enter agency number 0025.',
  'After the applicant enters the agency number, the system automatically displays the corresponding receiving department. Program category and agency number are linked. If entered incorrectly, the scholarship receiving department will not receive the online application.',
  'Step 3: Complete all application information in the left-side list and upload supplementary materials. Ensure all information and materials are correct, authentic, and valid.',
  'Discipline category and major are linked. Applicants can select the corresponding major only after choosing the correct discipline category. If in doubt, download the major reference table from the Help menu.',
  'Step 4: Carefully check all information and supplementary materials before submission.',
  'Step 5: Before the application is accepted, applicants may click Withdraw and Modify Application to revise a submitted application. After withdrawal, the application must be edited and submitted again, otherwise it cannot be accepted.',
  'Step 6: Click Print Application to download the application form.',
  'Step 7: Submit application materials according to the requirements of the national ACYLS focal point.',
  'Note: Firefox or IE 11 is recommended. If using IE, disable Compatibility View mode.',
  'Applicants must complete all application information in Chinese or English.',
  '',
  'Part VI. Notes for Coming to China',
  '1. Visa for study in China',
  'Candidates who have obtained admission and scholarship qualification must apply for a study visa at a Chinese embassy, consulate, or other Chinese visa authority abroad with copies of the Admission Notice, Confirmation Form for Study in China (JW201), the original Foreigner Physical Examination Form, and a valid ordinary passport. Those whose study period in China exceeds 6 months must apply for an X1 visa; those whose study period is less than 6 months may apply for an X2 visa. Anyone entering China with other types of passport or visa, or without the required documents, will not be registered by the university and cannot apply for residence procedures in China.',
  'Applicants are responsible for all expenses incurred for visa application.',
  '',
  '2. Registration, health verification, and residence permit',
  'Registration: scholarship recipients must register at the designated university within the registration period stated in the Admission Notice, bringing the Admission Notice, Confirmation Form for Study in China (JW201), Foreigner Physical Examination Form, and other documents. If unable to register on time, the student should request leave directly from the university. Those who fail to register after the deadline without university approval will be treated as voluntarily giving up student status, and scholarship eligibility will be cancelled.',
  'Health verification: scholarship students whose study period in China exceeds 6 months must, after arrival, bring their passport, Admission Notice, Foreigner Physical Examination Form, blood test report, and other documents to the local health and quarantine authority where the university is located for health verification. Those whose Foreigner Physical Examination Form is not accepted will be required to undergo another physical examination. Students who refuse examination or are found to have diseases prohibited from entry under Chinese law will be required to leave China within a specified period.',
  'Residence permit: after arriving in China, scholarship students must apply for a residence permit at the local public security authority within the time limit set by the visa authority, using their passport, Admission Notice, Confirmation Form for Study in China (JW201), valid health verification, and compliant photos.',
  '',
  '3. International travel funding',
  '1. For master\'s and doctoral students, the ASEAN-China Young Leaders Scholarship provides round-trip international travel funding for first arrival in China and return after graduation, and one round trip for home visit at the end of each funded academic year except the graduation year. Students must buy economy-class tickets according to relevant rules and apply to the university for reimbursement with original receipts.',
  '2. For advanced-study students, the scholarship provides one-time round-trip international travel funding. Students must buy economy-class tickets according to relevant rules and apply to the university for reimbursement with original receipts.',
  '3. For participants in short-term group training programs, the scholarship provides one-time round-trip international travel funding. Economy-class tickets are purchased uniformly by the host university.'
].join('\n');

function localizeAseanChinaYoungLeadersScholarship(item: PublicScholarship): PublicScholarship {
  return {
    ...item,
    title: 'ASEAN-China Young Leaders Scholarship Application Guide',
    schoolName: 'Multiple schools',
    schoolNameEn: 'Multiple schools',
    typeLabel: TYPE_META_EN.other.label,
    summary: 'The ASEAN-China Young Leaders Scholarship is funded by the Chinese Government through the ASEAN-China Cooperation Fund. It supports young professionals from ASEAN member states with work experience to pursue master\'s or doctoral degrees, short-term advanced study, or short-term group training in China.',
    coverage: 'Full scholarship coverage includes tuition, accommodation, living expenses, international travel, one-time settlement allowance, and comprehensive insurance.',
    applicableDegree: 'Master, doctoral, advanced study',
    applicableProgram: 'Master\'s degree, doctoral degree, short-term advanced study, or short-term group training. Applicants should in principle choose English-taught programs.',
    amountText: 'Master\'s and doctoral students may receive round-trip international travel funding for first arrival in China and return after graduation, plus home-visit travel at the end of each funded academic year except the graduation year. Advanced-study students receive one-time round-trip travel funding. Short-term group training participants receive one-time round-trip international travel funding.',
    requirementText: ASEAN_CHINA_REQUIREMENT_TEXT_EN,
    bodySections: [
      {
        title: 'Scholarship details',
        paragraphs: [
          'The scholarship is designed for young professionals from ASEAN member states who have work experience. It is funded by the Chinese Government through the ASEAN-China Cooperation Fund.',
          'It supports master\'s or doctoral degree study, short-term advanced study, and short-term group training programs in China.'
        ]
      },
      {
        title: 'Funding categories, duration, and teaching language',
        items: [
          'Master\'s students: 2-3 academic years.',
          'Doctoral students: 3-4 academic years.',
          'Advanced-study students: 5-6 months.',
          'Teaching language: English. Applicants should in principle choose English-taught programs.'
        ]
      },
      {
        title: 'Eligibility',
        items: [
          'Non-Chinese citizens of ASEAN member states in good physical and mental health.',
          'Interest in and goodwill toward China and Chinese culture.',
          'Master\'s applicants must hold a bachelor\'s degree and be no older than 45; doctoral applicants must hold a master\'s degree and be no older than 45; advanced-study applicants must hold at least a bachelor\'s degree.',
          'At least one year of work experience in a government department, public or private institution, university, think tank, or similar social organization.',
          'Experience in China, China-related exchange, or China-ASEAN relations is preferred.',
          'Strong English proficiency, such as IELTS 6.0 or TOEFL 80 or above.',
          'Applicants must not receive another Chinese Government Scholarship at the same time.'
        ]
      },
      {
        title: 'Program universities',
        items: ASEAN_CHINA_SCHOOLS_EN
      }
    ],
    benefitItems: [
      { key: 'tuition', label: 'Tuition', included: true },
      { key: 'accommodation', label: 'Accommodation', included: true },
      { key: 'stipend', label: 'Living expenses', included: true },
      { key: 'travel', label: 'International travel', included: true },
      { key: 'settlement', label: 'One-time settlement allowance', included: true },
      { key: 'insurance', label: 'Comprehensive insurance', included: true }
    ],
    eligibilityItems: [
      { label: 'Degree levels', value: 'Master, doctoral, advanced study' },
      { label: 'Age limit', value: 'Master\'s and doctoral applicants must be no older than 45' },
      { label: 'Target countries/regions', value: 'ASEAN member states: Brunei, Cambodia, Indonesia, Laos, Malaysia, Myanmar, the Philippines, Singapore, Thailand, and Vietnam' },
      { label: 'Language requirement', value: 'English proficiency such as IELTS 6.0 or TOEFL 80 or above; English-taught programs are expected in principle' },
      { label: 'Work experience', value: 'At least one year in a government department, public/private institution, university, think tank, or similar organization' },
      { label: 'Scholarship restriction', value: 'Applicants must not receive another Chinese Government Scholarship at the same time' }
    ],
    applicationMaterials: [
      { label: 'Application form', value: 'Chinese Government Scholarship Application Form, in Chinese or English' },
      { label: 'Degree certificate', value: 'Notarized highest diploma; documents in other languages require notarized Chinese or English translations' },
      { label: 'Academic transcript', value: 'Academic transcripts; documents in other languages require notarized Chinese or English translations' },
      { label: 'Study/research plan', value: 'At least 500 words for advanced-study students and at least 800 words for graduate students, written in Chinese or English' },
      { label: 'Recommendation letters', value: 'Two letters: one employer recommendation and one academic recommendation' },
      { label: 'Guardian documents', value: 'Applicants under 18 must submit legal documents for a guardian in China' },
      { label: 'Language certificate', value: 'IELTS 6.0, TOEFL 80 or above, or equivalent English proficiency proof' },
      { label: 'Physical examination form', value: 'Applicants studying in China for more than 6 months must submit a scanned Foreigner Physical Examination Form' },
      { label: 'Resume', value: 'Personal background plus study and work experience after high school' }
    ],
    applicationSteps: [
      { label: 'Step 1', value: 'Visit http://www.campuschina.org and enter the Chinese Government Scholarship Information System for Study in China' },
      { label: 'Step 2', value: 'Select Type A as the program category and enter agency number 0025' },
      { label: 'Step 3', value: 'Complete the online application information and upload supplementary materials' },
      { label: 'Step 4', value: 'Check all information and materials carefully before submission' },
      { label: 'Step 5', value: 'If needed before acceptance, withdraw and modify the submitted application, then submit again' },
      { label: 'Step 6', value: 'Print the application form' },
      { label: 'Step 7', value: 'Submit application materials according to the requirements of the national ACYLS focal point' }
    ],
    contactInfo: item.contactInfo ? {
      ...item.contactInfo,
      label: 'Contact',
      note: 'Check the official application page for current application details and material requirements.'
    } : undefined,
    actionLinks: item.actionLinks.map((link) => ({
      ...link,
      label: link.kind === 'primary' ? 'Open application' : link.kind === 'source' ? 'Open official source' : localizeScholarshipShortText(typeof link.label === 'string' ? link.label : undefined, 'en', 'Open link') ?? 'Open link'
    })),
    deadlineLabel: 'July 31',
    applicationRound: 'Check the official application page for current-year application information and material requirements',
    targetRegions: item.targetRegions.map((region) => region === 'ASEAN' ? 'ASEAN' : region),
    benefits: ['Tuition', 'Accommodation', 'Living expenses', 'International travel', 'One-time settlement allowance', 'Comprehensive insurance'],
    sourceLabel: 'Study in China / Chinese Government Scholarship Information System for Study in China',
    tags: ['Other scholarship', 'Full funding', 'Master, doctoral, advanced study']
  };
}

const RUC_BELT_ROAD_REQUIREMENT_TEXT_EN = [
  '1. Scholarship content',
  'To support the recruitment and training of international students and encourage outstanding international students to study in China, Renmin University of China established the International Students Belt and Road Scholarship in 2017.',
  'The scholarship is a one-time award. Standards are: first prize, RMB 80,000 per person; second prize, RMB 40,000 per person; third prize, RMB 20,000 per person.',
  '',
  '2. Open programs',
  'English-taught master\'s programs. If the annual scholarship funding is not fully used, the scope may be expanded to other degree programs open to international students.',
  '',
  '3. Applicant eligibility',
  'International students applying for degree programs whose nationality is from Belt and Road countries.',
  '',
  '4. Application period',
  'September to October each year.',
  '',
  '5. Application process',
  '1. Eligible students complete the Renmin University of China International Students Belt and Road Scholarship Application Form within the required period and submit it to the admitting school for comments.',
  '2. Each school evaluates applicants based on application materials and interview results, signs recommendations according to its scholarship quota, specifies the recommendation order, and submits the summarized candidate list.',
  '3. The International Office reviews candidate materials and publishes the final awardee list.',
  '',
  '6. Application materials',
  '1. Renmin University of China International Students Belt and Road Scholarship Application Form.',
  '2. Recommendation comments from the school.',
  '',
  '7. Receiving department',
  'International Students Office, International Office',
  '',
  '8. Contact',
  '010-62512698, fangruting_ruc@163.com'
].join('\n');

function localizeRenminBeltRoadScholarship(item: PublicScholarship): PublicScholarship {
  return {
    ...item,
    title: 'Renmin University of China International Students Belt and Road Scholarship',
    schoolName: 'Renmin University of China',
    schoolNameEn: 'Renmin University of China',
    typeLabel: TYPE_META_EN.university.label,
    summary: 'Renmin University of China established this International Students Belt and Road Scholarship in 2017 to attract and encourage outstanding international students to study in China. It is mainly for English-taught master\'s programs.',
    coverage: 'One-time award: first prize RMB 80,000 per person; second prize RMB 40,000 per person; third prize RMB 20,000 per person.',
    applicableDegree: 'Master',
    applicableProgram: 'English-taught master\'s programs; if annual scholarship funding is not fully used, the scope may expand to other degree programs open to international students.',
    amountText: 'First prize: RMB 80,000 per person; second prize: RMB 40,000 per person; third prize: RMB 20,000 per person.',
    requirementText: RUC_BELT_ROAD_REQUIREMENT_TEXT_EN,
    bodySections: [
      {
        title: 'Scholarship content',
        paragraphs: [
          'Renmin University of China established this scholarship in 2017 to support international student recruitment and training and encourage outstanding international students to study in China.',
          'The scholarship is a one-time award: first prize RMB 80,000 per person; second prize RMB 40,000 per person; third prize RMB 20,000 per person.'
        ]
      },
      { title: 'Open programs', paragraphs: ['English-taught master\'s programs. If the annual scholarship funding is not fully used, the scope may be expanded to other degree programs open to international students.'] },
      { title: 'Applicant eligibility', paragraphs: ['International students applying for degree programs whose nationality is from Belt and Road countries.'] },
      { title: 'Application period', paragraphs: ['September to October each year.'] },
      {
        title: 'Application process',
        items: [
          'Eligible students complete the scholarship application form within the required period and submit it to the admitting school for comments.',
          'Each school evaluates applicants based on application materials and interview results, signs recommendations according to its scholarship quota, specifies the recommendation order, and submits the candidate list.',
          'The International Office reviews candidate materials and publishes the final awardee list.'
        ]
      },
      { title: 'Application materials', items: ['Renmin University of China International Students Belt and Road Scholarship Application Form', 'Recommendation comments from the school.'] },
      { title: 'Receiving department', paragraphs: ['International Students Office, International Office'] },
      { title: 'Contact', paragraphs: ['010-62512698, fangruting_ruc@163.com'] }
    ],
    benefitItems: [
      { key: 'tuition', label: 'Tuition', included: false },
      { key: 'accommodation', label: 'Accommodation', included: false },
      { key: 'stipend', label: 'Living expenses', included: false },
      { key: 'medical-insurance', label: 'Medical insurance', included: false },
      { key: 'flight', label: 'Flights', included: false },
      { key: 'settlement', label: 'Settlement allowance', included: false }
    ],
    eligibilityItems: [
      { label: 'Degree level', value: 'Master' },
      { label: 'Target countries/regions', value: 'Belt and Road countries' }
    ],
    applicationMaterials: [
      { label: 'Application form', value: 'Renmin University of China International Students Belt and Road Scholarship Application Form' },
      { label: 'Recommendation', value: 'Recommendation comments from the school' }
    ],
    applicationSteps: [
      { label: 'Step 1', value: 'Complete the scholarship application form within the required period and submit it to the admitting school for comments' },
      { label: 'Step 2', value: 'The school evaluates application materials and interview results, ranks candidates, and submits the candidate list' },
      { label: 'Step 3', value: 'The International Office reviews candidate materials and publishes the final awardee list' }
    ],
    contactInfo: item.contactInfo ? {
      ...item.contactInfo,
      label: 'Contact',
      name: 'International Students Office, International Office'
    } : undefined,
    actionLinks: item.actionLinks.map((link) => ({
      ...link,
      label: link.kind === 'primary' ? 'View university details' : link.kind === 'source' ? 'Open official source' : localizeScholarshipShortText(typeof link.label === 'string' ? link.label : undefined, 'en', 'Open link') ?? 'Open link'
    })),
    deadlineLabel: 'September to October each year',
    applicationRound: 'Annual application period: September to October',
    targetCountries: ['Belt and Road Countries'],
    targetRegions: ['Belt and Road'],
    benefits: ['One-time award'],
    sourceLabel: 'Renmin University of China International Students Office',
    tags: ['University scholarship', 'Partial funding', 'Master']
  };
}

const RUC_FOREIGN_STUDENT_REQUIREMENT_TEXT_EN = [
  '1. Scholarship content',
  'Renmin University of China Foreign Student Scholarship includes four award categories: Academic Performance Award, Academic Progress Award, Social Activity Award, and Outstanding Student Leader Award. It encourages and recognizes current international students who study diligently, actively participate in activities, and improve their overall personal qualities. The scholarship is reviewed once each academic year and is a one-time award.',
  'Academic Performance Award standards:',
  'First prize: RMB 3,000 per person.',
  'Second prize: RMB 2,000 per person.',
  'Third prize: RMB 1,000 per person.',
  'Academic Progress Award: RMB 1,000 per person.',
  'Social Activity Award: RMB 1,000 per person.',
  'Outstanding Student Leader Award: RMB 2,000 per person.',
  '',
  '2. Eligible programs',
  'All degree programs.',
  '',
  '3. Applicant eligibility',
  'All non-graduating degree students currently enrolled.',
  '1. First-, second-, and third-year bachelor\'s students; first-year master\'s students in two-year programs; first- and second-year master\'s students in three-year programs; and first-year doctoral students.',
  '2. Applicants for the Academic Performance Award must submit grades (GPA) ranking in the top 20% among international students in the same grade of their school.',
  '3. Applicants must have no visa overstay and no bad record of violating laws, university rules, or disciplinary regulations.',
  '',
  '4. Application period',
  'Early April each year.',
  '',
  '5. Application process',
  '1. Eligible students complete the Renmin University of China Foreign Student Scholarship Application Form within the required period.',
  '2. The school reviews scholarship application eligibility.',
  '3. The International Students Office rechecks applicant eligibility, organizes review work, and publishes the awardee list.',
  '',
  '6. Application materials',
  '1. Renmin University of China Foreign Student Scholarship Application Form.',
  '2. Student transcript.',
  '3. Recommendation comments from the school.',
  '',
  '7. Receiving department',
  'International Students Office, International Office',
  '',
  '8. Contact',
  '010-62512359, huangjunruc@163.com'
].join('\n');

function localizeRenminForeignStudentScholarship(item: PublicScholarship): PublicScholarship {
  return {
    ...item,
    title: 'Renmin University of China Foreign Student Scholarship',
    schoolName: 'Renmin University of China',
    schoolNameEn: 'Renmin University of China',
    typeLabel: TYPE_META_EN.university.label,
    summary: 'Renmin University of China Foreign Student Scholarship recognizes current non-graduating international degree students through academic performance, academic progress, social activity, and outstanding student leader awards.',
    coverage: 'One-time awards: Academic Performance Award first prize RMB 3,000, second prize RMB 2,000, third prize RMB 1,000; Academic Progress Award RMB 1,000; Social Activity Award RMB 1,000; Outstanding Student Leader Award RMB 2,000.',
    applicableDegree: 'Bachelor, master, doctoral',
    applicableProgram: 'All degree programs.',
    amountText: 'Academic Performance Award: first prize RMB 3,000, second prize RMB 2,000, third prize RMB 1,000; Academic Progress Award RMB 1,000; Social Activity Award RMB 1,000; Outstanding Student Leader Award RMB 2,000.',
    requirementText: RUC_FOREIGN_STUDENT_REQUIREMENT_TEXT_EN,
    bodySections: [
      {
        title: 'Scholarship content',
        paragraphs: [
          'The scholarship includes Academic Performance Award, Academic Progress Award, Social Activity Award, and Outstanding Student Leader Award.',
          'It is reviewed once each academic year and is a one-time award.'
        ],
        items: [
          'Academic Performance Award first prize: RMB 3,000 per person.',
          'Academic Performance Award second prize: RMB 2,000 per person.',
          'Academic Performance Award third prize: RMB 1,000 per person.',
          'Academic Progress Award: RMB 1,000 per person.',
          'Social Activity Award: RMB 1,000 per person.',
          'Outstanding Student Leader Award: RMB 2,000 per person.'
        ]
      },
      { title: 'Eligible programs', paragraphs: ['All degree programs.'] },
      {
        title: 'Applicant eligibility',
        paragraphs: ['All non-graduating degree students currently enrolled.'],
        items: [
          'First-, second-, and third-year bachelor\'s students; first-year master\'s students in two-year programs; first- and second-year master\'s students in three-year programs; and first-year doctoral students.',
          'Applicants for the Academic Performance Award must rank in the top 20% by GPA among international students in the same grade of their school.',
          'No visa overstay and no bad record of violating laws, university rules, or disciplinary regulations.'
        ]
      },
      { title: 'Application period', paragraphs: ['Early April each year.'] },
      {
        title: 'Application process',
        items: [
          'Eligible students complete the scholarship application form within the required period.',
          'The school reviews scholarship application eligibility.',
          'The International Students Office rechecks eligibility, organizes review work, and publishes the awardee list.'
        ]
      },
      { title: 'Application materials', items: ['Renmin University of China Foreign Student Scholarship Application Form', 'Student transcript', 'Recommendation comments from the school.'] },
      { title: 'Receiving department', paragraphs: ['International Students Office, International Office'] },
      { title: 'Contact', paragraphs: ['010-62512359, huangjunruc@163.com'] }
    ],
    benefitItems: [
      { key: 'tuition', label: 'Tuition', included: false },
      { key: 'accommodation', label: 'Accommodation', included: false },
      { key: 'stipend', label: 'Living expenses', included: false },
      { key: 'medical-insurance', label: 'Medical insurance', included: false },
      { key: 'flight', label: 'Flights', included: false },
      { key: 'settlement', label: 'Settlement allowance', included: false }
    ],
    eligibilityItems: [
      { label: 'Degree levels', value: 'Bachelor, master, doctoral' }
    ],
    applicationMaterials: [
      { label: 'Application form', value: 'Renmin University of China Foreign Student Scholarship Application Form' },
      { label: 'Transcript', value: 'Student transcript' },
      { label: 'Recommendation', value: 'Recommendation comments from the school' }
    ],
    applicationSteps: [
      { label: 'Step 1', value: 'Eligible students complete the application form within the required period' },
      { label: 'Step 2', value: 'The school reviews scholarship application eligibility' },
      { label: 'Step 3', value: 'The International Students Office rechecks eligibility, organizes review work, and publishes the awardee list' }
    ],
    contactInfo: item.contactInfo ? {
      ...item.contactInfo,
      label: 'Contact',
      name: 'International Students Office, International Office'
    } : undefined,
    actionLinks: item.actionLinks.map((link) => ({
      ...link,
      label: link.kind === 'primary' ? 'View university details' : link.kind === 'source' ? 'Open official source' : localizeScholarshipShortText(typeof link.label === 'string' ? link.label : undefined, 'en', 'Open link') ?? 'Open link'
    })),
    deadlineLabel: 'Early April each year',
    applicationRound: 'Annual application period: early April',
    targetCountries: ['International students'],
    targetRegions: ['Global'],
    benefits: ['One-time award'],
    sourceLabel: 'Renmin University of China International Students Office',
    tags: ['University scholarship', 'Partial funding', 'Bachelor, master, doctoral']
  };
}

function localizeInfoItems(items: Array<Record<string, unknown>>, locale: PublicLocale, fallbackBody: string) {
  if (locale !== 'en') return items;
  return items
    .map((item) => ({
      ...item,
      label: localizeScholarshipShortText(typeof item.label === 'string' ? item.label : undefined, locale, ''),
      value: localizeScholarshipLongText(typeof item.value === 'string' ? item.value : undefined, locale, fallbackBody),
      body: localizeScholarshipLongText(typeof item.body === 'string' ? item.body : undefined, locale, fallbackBody)
    }))
    .filter((item) => {
      const label = typeof item.label === 'string' ? item.label.trim() : '';
      const value = typeof item.value === 'string' ? item.value.trim() : '';
      const body = typeof item.body === 'string' ? item.body.trim() : '';
      return Boolean(label && (value || body) && !hasChineseInValue(item) && !hasPlaceholderText(item));
    });
}

function localizeBodySections(items: Array<Record<string, unknown>>, locale: PublicLocale) {
  if (locale !== 'en') return items;
  return items.map((item, index) => ({
    ...item,
    title: localizeScholarshipShortText(typeof item.title === 'string' ? item.title : undefined, locale, 'Scholarship details'),
    body: localizeScholarshipLongText(typeof item.body === 'string' ? item.body : undefined, locale, ''),
    paragraphs: Array.isArray(item.paragraphs)
      ? item.paragraphs.map((paragraph) => localizeScholarshipLongText(typeof paragraph === 'string' ? paragraph : undefined, locale, '')).filter(Boolean)
      : undefined,
    items: Array.isArray(item.items)
      ? item.items.map((entry) => localizeScholarshipLongText(typeof entry === 'string' ? entry : undefined, locale, '')).filter(Boolean)
      : undefined
  }));
}

function parsePositiveInt(value: string | undefined, fallback: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(Math.floor(parsed), max);
}

function isGovernment(row: ScholarshipRow) {
  return /government|csc|中国政府奖学金/i.test(`${row.type} ${row.title}`);
}

function normalizeType(row: ScholarshipRow) {
  if (isGovernment(row)) return 'government';
  if (/university|大学|校长|校级/i.test(`${row.type} ${row.title}`)) return 'university';
  if (/provincial|municipal|省|市政府|上海市|北京市/i.test(`${row.type} ${row.title}`)) return 'provincial';
  if (/confucius|孔子|国际中文/i.test(`${row.type} ${row.title}`)) return 'confucius';
  return 'other';
}

function normalizeFunding(row: Pick<ScholarshipRow, 'fundingLevel' | 'coverage' | 'amountText' | 'title'>) {
  const level = row.fundingLevel?.trim().toLowerCase();
  if (level === 'full' || level === 'partial') return level;
  const text = [row.coverage, row.amountText, row.title].filter(Boolean).join(' ');
  if (/全额|全奖|100%|学费.{0,8}住宿.{0,8}生活费|生活费.{0,8}住宿.{0,8}学费|医疗保险/.test(text)) return 'full';
  if (/部分|减免|补贴|津贴|奖助/.test(text)) return 'partial';
  return 'unknown';
}

function inferBenefits(row: Pick<ScholarshipRow, 'benefits' | 'coverage' | 'amountText'>) {
  const stored = asStringArray(row.benefits);
  if (stored.length) return stored;
  const text = [row.coverage, row.amountText].filter(Boolean).join(' ');
  return [
    /学费|tuition/i.test(text) ? '学费' : '',
    /住宿|宿舍|accommodation/i.test(text) ? '住宿' : '',
    /生活费|津贴|stipend|allowance/i.test(text) ? '生活费' : '',
    /保险|医疗|insurance/i.test(text) ? '医疗保险' : ''
  ].filter(Boolean);
}

function mapLinkedSchools(row: ScholarshipRow) {
  return row.schools
    .filter((link) => link.school.status === SchoolStatus.published)
    .map((link) => ({
      id: link.school.id,
      nameZh: link.school.nameZh,
      nameEn: link.school.nameEn ?? undefined,
      region: link.school.region ?? undefined
    }));
}

function mapLinkedPrograms(row: ScholarshipRow) {
  return row.programs
    .filter((link) => link.program.school.status === SchoolStatus.published)
    .map((link) => ({
      id: link.program.id,
      schoolId: link.program.schoolId,
      schoolName: link.program.school.nameZh,
      nameZh: link.program.nameZh,
      nameEn: link.program.nameEn ?? undefined,
      degreeLevel: link.program.degreeLevel ?? undefined,
      teachingLanguage: link.program.teachingLanguage ?? undefined
    }));
}

function mapScholarship(row: ScholarshipRow) {
  const type = normalizeType(row);
  const fundingLevel = normalizeFunding(row);
  const targetCountries = asStringArray(row.targetCountries);
  const targetRegions = asStringArray(row.targetRegions);
  const benefits = inferBenefits(row);
  const schools = mapLinkedSchools(row);
  const programs = mapLinkedPrograms(row);
  const firstSchool = schools[0];
  const firstProgram = programs[0];
  const deadline = row.programs.find((link) => link.program.deadlineLabel || link.program.deadlineDate)?.program;
  const scholarshipDeadline = row.deadlineLabel || row.deadlineDate?.toISOString().slice(0, 10);
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    schoolId: firstSchool?.id ?? 0,
    schoolName: firstSchool?.nameZh ?? row.providerName ?? '多所院校',
    schoolNameEn: firstSchool?.nameEn ?? row.providerNameEn ?? undefined,
    schoolRegion: firstSchool?.region ?? row.providerLocation ?? undefined,
    schools,
    schoolCount: schools.length,
    programId: firstProgram?.id,
    programName: firstProgram?.nameZh,
    programNameEn: firstProgram?.nameEn,
    programs,
    type,
    typeLabel: TYPE_META[type]?.label ?? '其他奖学金',
    fundingLevel,
    coverage: row.coverage ?? undefined,
    applicableDegree: row.applicableDegree ?? undefined,
    applicableProgram: row.applicableProgram ?? undefined,
    amountText: row.amountText ?? undefined,
    requirementText: row.requirementText ?? undefined,
    bodySections: asObjectArray(row.bodySections),
    benefitItems: asObjectArray(row.benefitItems),
    eligibilityItems: asObjectArray(row.eligibilityItems),
    applicationMaterials: asObjectArray(row.applicationMaterials),
    applicationSteps: asObjectArray(row.applicationSteps),
    contactInfo: asRecord(row.contactInfo),
    actionLinks: asObjectArray(row.actionLinks),
    deadlineDate: row.deadlineDate?.toISOString().slice(0, 10),
    deadlineLabel: row.deadlineLabel ?? undefined,
    applicationRound: row.applicationRound ?? undefined,
    targetCountries,
    targetRegions,
    benefits,
    deadline: scholarshipDeadline || deadline?.deadlineLabel || deadline?.deadlineDate?.toISOString().slice(0, 10),
    sourceUrl: row.sourceUrl ?? undefined,
    sourceLabel: row.sourceLabel ?? undefined,
    lastVerifiedAt: row.lastVerifiedAt?.toISOString().slice(0, 10),
    sortOrder: row.sortOrder,
    tags: [
      TYPE_META[type]?.label ?? '其他奖学金',
      fundingLevel === 'full' ? '全额资助' : fundingLevel === 'partial' ? '部分资助' : '',
      row.applicableDegree ?? ''
    ].filter(Boolean),
    summary: row.summary || row.requirementText || row.coverage || row.amountText || '该奖学金面向符合条件的国际学生开放，具体申请条件以官方说明为准。'
  };
}

function localizeScholarship(item: PublicScholarship, locale: PublicLocale): PublicScholarship {
  if (locale !== 'en') return item;
  if (item.slug === 'asean-china-young-leaders-scholarship') return localizeAseanChinaYoungLeadersScholarship(item);
  if (item.slug === 'renmin-university-belt-and-road-scholarship' || item.title === '中国人民大学国际学生“一带一路”奖学金') return localizeRenminBeltRoadScholarship(item);
  if (item.slug === 'renmin-university-foreign-student-scholarship' || item.title === '中国人民大学外国留学生奖学金') return localizeRenminForeignStudentScholarship(item);
  const meta = TYPE_META_EN[item.type] ?? TYPE_META_EN.other;
  const title = localizeScholarshipShortText(item.title, locale, humanizeScholarshipSlug(item.slug)) ?? humanizeScholarshipSlug(item.slug);
  const schoolNameEn = item.schoolNameEn || localizeScholarshipShortText(item.schoolName, locale, 'Applicable schools') || 'Applicable schools';
  const programNameEn = item.programNameEn || localizeScholarshipShortText(item.programName, locale, 'Program') || 'Program';
  const coverage = localizeScholarshipLongText(item.coverage, locale, buildEnglishCoverage(item));
  const applicableProgram = localizeScholarshipLongText(item.applicableProgram || programNameEn, locale, buildEnglishProgramScope(item));
  const amountText = localizeScholarshipLongText(item.amountText, locale, 'Award amount, stipend, and renewal rules follow the current official scholarship notice.');
  const requirementText = localizeScholarshipLongText(item.requirementText, locale, 'Eligibility requirements, required materials, and application steps follow the current official scholarship notice.');
  const bodySections = localizeBodySections(item.bodySections, locale);
  const benefitItems = item.benefitItems
    .map((benefit) => ({
      ...benefit,
      label: localizeScholarshipShortText(typeof benefit.label === 'string' ? benefit.label : undefined, locale, '') ?? '',
      note: localizeScholarshipLongText(typeof benefit.note === 'string' ? benefit.note : undefined, locale, '')
    }))
    .filter((benefit) => Boolean(benefit.label && !containsChineseText(benefit.label) && !hasPlaceholderText(benefit.label)));
  const eligibilityItems = localizeInfoItems(item.eligibilityItems, locale, '');
  const applicationMaterials = localizeInfoItems(item.applicationMaterials, locale, '');
  const applicationSteps = localizeInfoItems(item.applicationSteps, locale, '');
  const benefits = item.benefits
    .map((benefit) => localizeScholarshipShortText(benefit, locale, ''))
    .filter((benefit): benefit is string => Boolean(benefit && !containsChineseText(benefit) && !hasPlaceholderText(benefit)));
  const summary = localizeScholarshipLongText(item.summary, locale, buildEnglishSummary(item, title, meta.label)) ?? '';
  const localized: PublicScholarship = {
    ...item,
    title,
    schoolName: schoolNameEn,
    schoolNameEn,
    schoolRegion: localizeScholarshipShortText(item.schoolRegion, locale),
    schools: item.schools.map((school) => ({
      ...school,
      nameZh: school.nameEn || localizeScholarshipShortText(school.nameZh, locale, 'Applicable school') || 'Applicable school',
      region: localizeScholarshipShortText(school.region, locale)
    })),
    programName: programNameEn,
    programNameEn,
    programs: item.programs.map((program) => ({
      ...program,
      schoolName: localizeScholarshipShortText(program.schoolName, locale, 'School') ?? 'School',
      nameZh: program.nameEn || localizeScholarshipShortText(program.nameZh, locale, 'Program') || 'Program',
      degreeLevel: localizeScholarshipShortText(program.degreeLevel, locale),
      teachingLanguage: localizeScholarshipShortText(program.teachingLanguage, locale)
    })),
    typeLabel: meta.label,
    coverage,
    applicableDegree: localizeScholarshipShortText(item.applicableDegree, locale, 'Degree pending'),
    applicableProgram,
    amountText,
    requirementText,
    bodySections: hasChineseInValue(bodySections) || hasPlaceholderText(bodySections) ? buildEnglishBodySections(item, title, meta.label) : bodySections,
    benefitItems: hasChineseInValue(benefitItems) || hasPlaceholderText(benefitItems) ? [] : benefitItems,
    eligibilityItems: hasChineseInValue(eligibilityItems) || hasPlaceholderText(eligibilityItems) ? [] : eligibilityItems,
    applicationMaterials: hasChineseInValue(applicationMaterials) || hasPlaceholderText(applicationMaterials) ? [] : applicationMaterials,
    applicationSteps: hasChineseInValue(applicationSteps) || hasPlaceholderText(applicationSteps) ? [] : applicationSteps,
    contactInfo: item.contactInfo ? {
      ...item.contactInfo,
      label: localizeScholarshipShortText(typeof item.contactInfo.label === 'string' ? item.contactInfo.label : undefined, locale, 'Contact'),
      name: localizeScholarshipShortText(typeof item.contactInfo.name === 'string' ? item.contactInfo.name : undefined, locale),
      note: localizeScholarshipLongText(typeof item.contactInfo.note === 'string' ? item.contactInfo.note : undefined, locale, '')
    } : undefined,
    actionLinks: item.actionLinks.map((link) => ({
      ...link,
      label: localizeScholarshipShortText(typeof link.label === 'string' ? link.label : undefined, locale, link.kind === 'source' ? 'Open official source' : 'Open link') ?? (link.kind === 'source' ? 'Open official source' : 'Open link')
    })),
    deadlineLabel: localizeScholarshipLongText(item.deadlineLabel, locale, 'Deadline pending'),
    applicationRound: localizeScholarshipLongText(item.applicationRound, locale, 'Application round pending'),
    targetCountries: item.targetCountries.map((country) => localizeScholarshipShortText(country, locale, country) ?? country),
    targetRegions: item.targetRegions.map((region) => localizeScholarshipShortText(region, locale, region) ?? region),
    benefits,
    deadline: localizeScholarshipLongText(item.deadline, locale, 'Deadline pending'),
    sourceLabel: localizeScholarshipShortText(item.sourceLabel, locale, 'Official scholarship page'),
    tags: [
      meta.label,
      item.fundingLevel === 'full' ? 'Full funding' : item.fundingLevel === 'partial' ? 'Partial funding' : '',
      localizeScholarshipShortText(item.applicableDegree, locale, '')
    ].filter((tag): tag is string => Boolean(tag)),
    summary
  };
  return hasChineseInValue(localized) || hasPlaceholderText(localized) ? {
    ...localized,
    bodySections: buildEnglishBodySections(item, title, meta.label),
    eligibilityItems: [],
    applicationMaterials: [],
    applicationSteps: [],
    benefitItems: [],
    contactInfo: undefined,
    sourceLabel: containsChineseText(localized.sourceLabel) ? 'Official scholarship page' : localized.sourceLabel,
    deadlineLabel: containsChineseText(localized.deadlineLabel) ? 'Deadline pending' : localized.deadlineLabel,
    applicationRound: containsChineseText(localized.applicationRound) ? 'Application round pending' : localized.applicationRound,
    applicableProgram: containsChineseText(localized.applicableProgram) ? buildEnglishProgramScope(item) : localized.applicableProgram,
    amountText: containsChineseText(localized.amountText) || hasPlaceholderText(localized.amountText) ? 'Award amount, stipend, and renewal rules follow the current official scholarship notice.' : localized.amountText,
    requirementText: containsChineseText(localized.requirementText) || hasPlaceholderText(localized.requirementText) ? 'Eligibility requirements, required materials, and application steps follow the current official scholarship notice.' : localized.requirementText,
    coverage: containsChineseText(localized.coverage) ? buildEnglishCoverage(item) : localized.coverage,
    summary: containsChineseText(localized.summary) ? buildEnglishSummary(item, title, meta.label) : localized.summary
  } : localized;
}

function matchesQuery(item: PublicScholarship, query: ScholarshipListQuery) {
  const keyword = query.keyword?.trim().toLowerCase();
  if (keyword) {
    const haystack = [
      item.title,
      item.schoolName,
      item.schoolNameEn,
      item.schools.map((school) => `${school.nameZh} ${school.nameEn ?? ''}`).join(' '),
      item.programs.map((program) => `${program.nameZh} ${program.nameEn ?? ''}`).join(' '),
      item.typeLabel,
      item.summary,
      item.coverage,
      item.requirementText,
      item.targetCountries.join(' ')
    ].join(' ').toLowerCase();
    if (!haystack.includes(keyword)) return false;
  }
  if (query.type && query.type !== 'all' && item.type !== query.type) return false;
  if (query.fundingLevel && query.fundingLevel !== 'all' && item.fundingLevel !== query.fundingLevel) return false;
  if (query.country && query.country !== 'all' && !item.targetCountries.some((country) => country.toLowerCase() === query.country?.toLowerCase())) return false;
  if (query.region && query.region !== 'all' && !item.targetRegions.some((region) => region.toLowerCase() === query.region?.toLowerCase())) return false;
  return true;
}

function buildStats(items: PublicScholarship[]) {
  return {
    total: items.length,
    fullFunding: items.filter((item) => item.fundingLevel === 'full').length,
    government: items.filter((item) => item.type === 'government').length,
    countries: new Set(items.flatMap((item) => item.targetCountries)).size,
    types: new Set(items.map((item) => item.type)).size
  };
}

function normalizeComparable(value: string | undefined | null) {
  return (value ?? '').trim().toLowerCase();
}

function overlapScore(left: string[], right: string[], weight: number) {
  if (!left.length || !right.length) return 0;
  const rightSet = new Set(right.map(normalizeComparable).filter(Boolean));
  return left.reduce((score, value) => score + (rightSet.has(normalizeComparable(value)) ? weight : 0), 0);
}

function sharedTokenScore(left: string | undefined, right: string | undefined, weight: number) {
  const leftTokens = new Set(normalizeComparable(left).split(/[\s/、，,;；（）()]+/).filter((token) => token.length >= 2));
  if (!leftTokens.size) return 0;
  return normalizeComparable(right).split(/[\s/、，,;；（）()]+/).filter((token) => token.length >= 2 && leftTokens.has(token)).length * weight;
}

function scholarshipRelationScore(source: PublicScholarship, candidate: PublicScholarship) {
  let score = 0;
  const sourceSchoolIds = source.schools.map((school) => school.id);
  const candidateSchoolIds = candidate.schools.map((school) => school.id);
  score += overlapScore(sourceSchoolIds.map(String), candidateSchoolIds.map(String), 30);
  if (!sourceSchoolIds.length && source.schoolName && normalizeComparable(source.schoolName) === normalizeComparable(candidate.schoolName)) score += 30;
  if (source.type === candidate.type) score += 12;
  if (source.fundingLevel === candidate.fundingLevel) score += 8;
  if (source.applicableDegree && source.applicableDegree === candidate.applicableDegree) score += 8;
  score += overlapScore(source.targetCountries, candidate.targetCountries, 7);
  score += overlapScore(source.targetRegions, candidate.targetRegions, 4);
  score += overlapScore(source.benefits, candidate.benefits, 3);
  score += sharedTokenScore(source.applicableProgram, candidate.applicableProgram, 2);
  score += sharedTokenScore(source.title, candidate.title, 1);
  return score;
}

@Injectable()
export class ScholarshipsService {
  constructor(private readonly prisma: PrismaService) {}

  private async listPublishedRows() {
    return this.prisma.scholarship.findMany({
      where: { status: SchoolStatus.published },
      include: SCHOLARSHIP_INCLUDE,
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }]
    });
  }

  async listScholarships(query: ScholarshipListQuery = {}) {
    const locale = normalizeLocale(query.locale);
    const page = parsePositiveInt(query.page, 1, 999);
    const pageSize = parsePositiveInt(query.pageSize, 12, 48);
    const allItems = (await this.listPublishedRows()).map(mapScholarship);
    const filtered = allItems.filter((item) => matchesQuery(item, query));
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const currentPage = Math.min(page, totalPages);
    const offset = (currentPage - 1) * pageSize;
    const countryStats = this.buildCountryStats(allItems, locale);
    return {
      items: filtered.slice(offset, offset + pageSize).map((item) => localizeScholarship(item, locale)),
      pagination: {
        page: currentPage,
        pageSize,
        total: filtered.length,
        totalPages
      },
      facets: {
        types: this.buildTypeStats(allItems, locale),
        countries: countryStats.countries,
        regions: countryStats.regions,
        fundingLevels: [
          { value: 'full', label: locale === 'en' ? 'Full funding' : '全额资助', count: allItems.filter((item) => item.fundingLevel === 'full').length },
          { value: 'partial', label: locale === 'en' ? 'Partial funding' : '部分资助', count: allItems.filter((item) => item.fundingLevel === 'partial').length },
          { value: 'unknown', label: locale === 'en' ? 'Pending' : '待确认', count: allItems.filter((item) => item.fundingLevel === 'unknown').length }
        ]
      },
      stats: buildStats(allItems)
    };
  }

  private buildTypeStats(items: PublicScholarship[], locale: PublicLocale = 'zh-CN') {
    const keys = ['government', 'university', 'provincial', 'confucius', 'other'] as const;
    return keys.map((key) => ({
      key,
      title: locale === 'en' ? TYPE_META_EN[key].label : TYPE_META[key].label,
      icon: TYPE_META[key].icon,
      tone: TYPE_META[key].tone,
      body: locale === 'en' ? TYPE_META_EN[key].body : TYPE_META[key].body,
      coverage: locale === 'en' ? TYPE_META_EN[key].coverage : TYPE_META[key].coverage,
      difficulty: locale === 'en' ? TYPE_META_EN[key].difficulty : TYPE_META[key].difficulty,
      count: items.filter((item) => item.type === key).length,
      full: items.filter((item) => item.type === key && item.fundingLevel === 'full').length
    }));
  }

  async listTypes(localeInput?: string) {
    const locale = normalizeLocale(localeInput);
    const items = (await this.listPublishedRows()).map(mapScholarship);
    return {
      items: [
        ...this.buildTypeStats(items, locale),
        {
          key: 'full',
          title: locale === 'en' ? 'Full scholarships' : '全额奖学金',
          icon: 'lucide:badge-dollar-sign',
          tone: 'green',
          body: locale === 'en' ? 'Fully funded scholarships that usually cover tuition, accommodation, and living stipend.' : '100%资助的奖学金，通常覆盖学费、住宿和生活费。',
          coverage: locale === 'en' ? 'Tuition + accommodation + stipend' : '学费+住宿+津贴',
          difficulty: locale === 'en' ? 'High' : '高',
          count: items.filter((item) => item.fundingLevel === 'full').length,
          full: items.filter((item) => item.fundingLevel === 'full').length
        }
      ],
      stats: buildStats(items)
    };
  }

  private buildCountryStats(items: PublicScholarship[], locale: PublicLocale = 'zh-CN') {
    const countryMap = new Map<string, { code: string; name: string; region: string; count: number }>();
    const regionMap = new Map<string, number>();
    for (const item of items) {
      item.targetCountries.forEach((country, index) => {
        const region = item.targetRegions[index] || item.targetRegions[0] || '其他';
        const existing = countryMap.get(country) || {
          code: country,
          name: localizeScholarshipShortText(country, locale, country) ?? country,
          region: localizeScholarshipShortText(region, locale, region) ?? region,
          count: 0
        };
        existing.count += 1;
        countryMap.set(country, existing);
        const regionName = localizeScholarshipShortText(region, locale, region) ?? region;
        regionMap.set(regionName, (regionMap.get(regionName) || 0) + 1);
      });
    }
    const countries = Array.from(countryMap.values()).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-Hans-CN'));
    const regions = Array.from(regionMap.entries()).map(([region, count]) => ({ region, count })).sort((a, b) => b.count - a.count);
    return { countries, regions };
  }

  async listCountries(localeInput?: string) {
    const locale = normalizeLocale(localeInput);
    const items = (await this.listPublishedRows()).map(mapScholarship);
    const { countries, regions } = this.buildCountryStats(items, locale);
    return {
      hotCountries: countries.slice(0, 7),
      countries,
      regions,
      stats: buildStats(items)
    };
  }

  async getScholarship(slug: string, localeInput?: string) {
    const locale = normalizeLocale(localeInput);
    const row = await this.prisma.scholarship.findFirst({
      where: {
        slug,
        status: SchoolStatus.published
      },
      include: SCHOLARSHIP_INCLUDE
    });
    if (!row) throw new NotFoundException('Scholarship not found');
    const item = mapScholarship(row);
    const candidateRows = await this.prisma.scholarship.findMany({
      where: {
        id: { not: row.id },
        status: SchoolStatus.published
      },
      include: SCHOLARSHIP_INCLUDE,
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }]
    });
    const similar = candidateRows
      .map(mapScholarship)
      .map((candidate) => ({ candidate, score: scholarshipRelationScore(item, candidate) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || a.candidate.sortOrder - b.candidate.sortOrder || a.candidate.id - b.candidate.id)
      .slice(0, 6)
      .map((entry) => entry.candidate);
    const localizedItem = localizeScholarship(item, locale);
    return {
      item: localizedItem,
      schools: localizedItem.schools,
      programs: localizedItem.programs,
      similar: similar.map((candidate) => localizeScholarship(candidate, locale))
    };
  }
}

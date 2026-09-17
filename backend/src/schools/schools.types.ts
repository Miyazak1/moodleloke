export type VerificationStatus = 'verified' | 'pending' | 'sample';
export type SchoolLifecycleStatus = 'draft' | 'published' | 'archived';

export type SchoolProgramRecord = {
  id: number;
  schoolId: number;
  nameZh: string;
  nameEn?: string;
  degreeLevel?: string;
  durationYears?: string;
  fieldCategory?: string;
  teachingLanguage?: string;
  cscaSubjects?: string[];
  cscaRequirement?: string;
  hskRequirement?: string;
  englishRequirement?: string;
  tuitionAmount?: number;
  tuitionCurrency?: string;
  tuitionPeriod?: string;
  tuitionText?: string;
  scholarshipText?: string;
  openDate?: string;
  deadlineDate?: string;
  deadlineLabel?: string;
  applicationRound?: string;
  applicationUrl?: string;
  applicationNote?: string;
  sourceUrl?: string;
  sourceLabel?: string;
  lastVerifiedAt?: string;
  sortOrder: number;
  status: SchoolLifecycleStatus;
  isVerified?: boolean;
  hasScholarship?: boolean;
  badgeText?: string;
  displayTuition?: string;
  displaySubjects?: string[];
  displayGroup?: string;
  displayGroupLabel?: string;
};

export type SchoolCscaRuleRecord = {
  id: number;
  schoolId: number;
  programId?: number;
  title: string;
  category: string;
  scope?: string;
  cscaSubjects?: string[];
  languageCondition?: string;
  description?: string;
  importantNote?: string;
  applicablePrograms?: string[];
  sourceUrl?: string;
  sourceLabel?: string;
  lastVerifiedAt?: string;
  sortOrder: number;
  status: SchoolLifecycleStatus;
  isVerified?: boolean;
};

export type SchoolProgramDisplayGroup = {
  key: string;
  label: string;
  total: number;
  visibleCount?: number;
  hiddenNote?: string;
};

export type SchoolApplicationTimelineItem = {
  key: string;
  label: string;
  dateLabel?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
  statusLabel?: string;
};

export type SchoolScholarshipRecord = {
  id: number;
  schoolId: number;
  programId?: number;
  name: string;
  type: string;
  coverage?: string;
  applicableDegree?: string;
  applicableProgram?: string;
  amountText?: string;
  requirementText?: string;
  deadlineDate?: string;
  deadlineLabel?: string;
  applicationRound?: string;
  scholarshipSlug?: string;
  sourceUrl?: string;
  sourceLabel?: string;
  lastVerifiedAt?: string;
  sortOrder: number;
  status: SchoolLifecycleStatus;
  isCsc?: boolean;
  isVerified?: boolean;
};

export type SchoolUpcomingDeadline = {
  programId: number;
  programName: string;
  degreeLevel?: string;
  teachingLanguage?: string;
  applicationRound?: string;
  deadlineDate?: string;
  deadlineLabel?: string;
  daysUntilDeadline?: number;
  statusLabel: string;
};

export type SchoolQuickFacts = {
  location?: string;
  region?: string;
  tuition?: string;
  livingCost?: string;
  accommodation?: string;
  programCount: number;
  englishProgramCount: number;
};

export type SchoolDetailDisplay = {
  city?: string;
  regionLabel?: string;
  livingCostLabel?: string;
  displayProgramCount?: number;
  displayUndergraduateCount?: number;
  visibleProgramCount?: number;
  hiddenProgramNote?: string;
  displaySubjectTags?: string[];
  programFieldTags?: string[];
  programDisplayGroups?: SchoolProgramDisplayGroup[];
  applicationTimeline?: SchoolApplicationTimelineItem[];
};

export type SchoolProgramSummary = {
  programCount: number;
  undergraduateProgramCount: number;
  postgraduateProgramCount: number;
  englishProgramCount: number;
  programSubjectTags: string[];
  programTuitionBandLabel?: string;
  programQualityIssues?: string[];
};

export type SchoolRecord = {
  id: number;
  nameZh: string;
  nameEn?: string;
  schoolType: string;
  region?: string;
  city?: string;
  cityZh?: string;
  citySlug?: string;
  regionLabel?: string;
  rank?: number;
  cscaRequired: boolean;
  cscaRequirement?: string;
  cscaSubjects?: string[];
  languageRequirement?: string;
  applicationLevel?: string;
  languageOfInstruction?: string[];
  hskRequirement?: string;
  englishRequirement?: string;
  deadlineSummary?: string;
  tuitionSummary?: string;
  applicationFee?: string;
  officialWebsiteUrl?: string;
  admissionsWebsiteUrl?: string;
  sourceUrl?: string;
  sourceLabel?: string;
  sourceNote?: string;
  verificationStatus?: VerificationStatus;
  lastVerifiedAt?: string;
  qualityScore?: number;
  missingFields?: string[];
  completenessLabel?: string;
  featuredPrograms?: string[];
  scholarships?: string[];
  fitNotes?: string[];
  derivedTags?: string[];
  subjectTags?: string[];
  languageTags?: string[];
  tuitionBandLabel?: string;
  hasEnglishPrograms?: boolean;
  hasScholarships?: boolean;
  isVerified?: boolean;
  decisionSummary?: string;
  programCount?: number;
  undergraduateProgramCount?: number;
  postgraduateProgramCount?: number;
  englishProgramCount?: number;
  programSubjectTags?: string[];
  programTuitionBandLabel?: string;
  programQualityIssues?: string[];
  programs?: SchoolProgramRecord[];
  cscaRules?: SchoolCscaRuleRecord[];
  scholarshipsDetailed?: SchoolScholarshipRecord[];
  upcomingDeadlines?: SchoolUpcomingDeadline[];
  requiredSubjectTags?: string[];
  quickFacts?: SchoolQuickFacts;
  detailDisplay?: SchoolDetailDisplay;
  scholarshipCount?: number;
  cscScholarshipCount?: number;
  applicationPortalNotes?: string;
  campusHighlights?: string[];
  contactNotes?: string[];
  status?: SchoolLifecycleStatus;
};

export type SchoolSearchQuery = {
  locale?: string;
  keyword?: string;
  region?: string;
  schoolType?: string;
  cscaRequired?: string;
  applicationLevel?: string;
  page?: string;
  pageSize?: string;
  sort?: string;
  verifiedOnly?: string;
  quality?: string;
  language?: string;
  subject?: string;
  hsk?: string;
  hasTuition?: string;
  hasScholarship?: string;
  hasEnglishPrograms?: string;
  degreeLevel?: string;
  teachingLanguage?: string;
  programSubject?: string;
  fieldCategory?: string;
  hasProgramTuition?: string;
  hasUpcomingDeadline?: string;
  hasCsc?: string;
  hasCscaRules?: string;
  hasDetailedScholarship?: string;
};

export type SchoolListFacets = {
  regions: string[];
  schoolTypes: string[];
  cscaOptions: Array<{ value: 'true' | 'false'; label: string; count: number }>;
  applicationLevels: string[];
};

export type SchoolListResult = {
  items: SchoolRecord[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  facets: SchoolListFacets;
  appliedFiltersSummary: string[];
};

export type AdminSchoolSummary = {
  id: number;
  version: number;
  nameZh: string;
  nameEn?: string;
  region?: string;
  cscaRequired: boolean;
  verificationStatus: VerificationStatus;
  status: SchoolLifecycleStatus;
  tuitionSummary?: string;
  sourceUrl?: string;
  lastVerifiedAt?: string;
  completenessLabel?: string;
  missingFields?: string[];
};

export type AdminSchoolDetail = AdminSchoolSummary & {
  rank?: number;
  schoolType: string;
  cscaRequirement?: string;
  languageRequirement?: string;
  applicationFee?: string;
  officialWebsiteUrl?: string;
  admissionsWebsiteUrl?: string;
  source?: string;
  sourceId?: string;
  derivedTags?: string[];
  languageOfInstruction?: string[];
  scholarships?: string[];
  englishPrograms?: string;
  programFields?: string[];
  cscaRequirementNote?: string;
  programs?: SchoolProgramRecord[];
  cscaRules?: SchoolCscaRuleRecord[];
  scholarshipsDetailed?: SchoolScholarshipRecord[];
};

export type AdminSchoolUpdateInput = {
  expectedVersion?: number;
  nameZh?: string;
  nameEn?: string | null;
  schoolType?: 'regular' | 'partner' | string;
  region?: string | null;
  citySlug?: string | null;
  cityZh?: string | null;
  cscaRequired?: boolean;
  cscaRequirement?: string | null;
  languageRequirement?: string | null;
  tuitionSummary?: string | null;
  sourceUrl?: string | null;
  source?: string | null;
  sourceId?: string | null;
  officialWebsiteUrl?: string | null;
  admissionsWebsiteUrl?: string | null;
  applicationFee?: string | null;
  languageOfInstruction?: string[] | string | null;
  scholarships?: string[] | string | null;
  englishPrograms?: string | null;
  programFields?: string[] | string | null;
  cscaRequirementNote?: string | null;
  programs?: AdminSchoolProgramInput[];
  cscaRules?: AdminSchoolCscaRuleInput[];
  scholarshipsDetailed?: AdminSchoolScholarshipInput[];
  lastVerifiedAt?: string | null;
  status?: SchoolLifecycleStatus;
};

export type AdminSchoolCreateInput = AdminSchoolUpdateInput & {
  nameZh: string;
  schoolType?: 'regular' | 'partner' | string;
};

export type AdminSchoolImportInput = {
  items?: AdminSchoolCreateInput[];
};

export type AdminSchoolProgramInput = {
  expectedVersion?: number;
  nameZh?: string | null;
  nameEn?: string | null;
  degreeLevel?: string | null;
  durationYears?: string | null;
  fieldCategory?: string | null;
  teachingLanguage?: string | null;
  cscaSubjects?: string[] | string | null;
  cscaRequirement?: string | null;
  hskRequirement?: string | null;
  englishRequirement?: string | null;
  tuitionAmount?: number | string | null;
  tuitionCurrency?: string | null;
  tuitionPeriod?: string | null;
  tuitionText?: string | null;
  scholarshipText?: string | null;
  openDate?: string | null;
  deadlineDate?: string | null;
  deadlineLabel?: string | null;
  applicationRound?: string | null;
  applicationUrl?: string | null;
  applicationNote?: string | null;
  sourceUrl?: string | null;
  sourceLabel?: string | null;
  lastVerifiedAt?: string | null;
  sortOrder?: number | string | null;
  status?: SchoolLifecycleStatus;
};

export type AdminSchoolProgramUpdateInput = AdminSchoolProgramInput;

export type AdminSchoolCscaRuleInput = {
  expectedVersion?: number;
  title?: string | null;
  category?: string | null;
  scope?: string | null;
  programId?: number | string | null;
  cscaSubjects?: string[] | string | null;
  languageCondition?: string | null;
  description?: string | null;
  importantNote?: string | null;
  sourceUrl?: string | null;
  sourceLabel?: string | null;
  lastVerifiedAt?: string | null;
  sortOrder?: number | string | null;
  status?: SchoolLifecycleStatus;
};

export type AdminSchoolCscaRuleUpdateInput = AdminSchoolCscaRuleInput;

export type AdminSchoolScholarshipInput = {
  expectedVersion?: number;
  name?: string | null;
  type?: string | null;
  programId?: number | string | null;
  coverage?: string | null;
  applicableDegree?: string | null;
  applicableProgram?: string | null;
  amountText?: string | null;
  requirementText?: string | null;
  sourceUrl?: string | null;
  sourceLabel?: string | null;
  lastVerifiedAt?: string | null;
  sortOrder?: number | string | null;
  status?: SchoolLifecycleStatus;
};

export type AdminSchoolScholarshipUpdateInput = AdminSchoolScholarshipInput;

export type SchoolChangeLogRecord = {
  id: number;
  action: string;
  actorId?: number;
  actorEmail?: string;
  createdAt: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  changes: string[];
};

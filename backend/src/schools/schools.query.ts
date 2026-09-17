import { Prisma, SchoolStatus, SchoolType } from '@prisma/client';
import { SchoolSearchQuery } from './schools.types';

function cleanQueryValue(value: string | undefined) {
  const next = value?.trim();
  return next || undefined;
}

function parseBooleanFilter(value: string | undefined) {
  const normalized = cleanQueryValue(value)?.toLocaleLowerCase();
  if (!normalized) return undefined;
  if (['true', '1', 'yes', 'required', '需要', '看重'].includes(normalized)) return true;
  if (['false', '0', 'no', 'not-required', 'optional', '未标记', '不明确'].includes(normalized)) return false;
  return undefined;
}

function normalizeSchoolType(value: string | undefined): SchoolType | undefined {
  const normalized = cleanQueryValue(value);
  if (!normalized) return undefined;
  if (normalized === SchoolType.partner || normalized === '合作院校') return SchoolType.partner;
  if (normalized === SchoolType.regular || normalized === '常规院校') return SchoolType.regular;
  return undefined;
}

function verifiedWhere() {
  return {
    sourceUrl: { not: null },
    lastVerifiedAt: { not: null }
  } satisfies Prisma.SchoolWhereInput;
}

function doesNotContainSmoke(field: 'nameZh') {
  return {
    NOT: { [field]: { contains: 'smoke', mode: Prisma.QueryMode.insensitive } }
  } satisfies Prisma.SchoolWhereInput;
}

function nullableDoesNotContainSmoke(field: 'source' | 'sourceId' | 'nameEn' | 'cscaRequirement' | 'cscaRequirementNote') {
  return {
    OR: [{ [field]: null }, { NOT: { [field]: { contains: 'smoke', mode: Prisma.QueryMode.insensitive } } }]
  } satisfies Prisma.SchoolWhereInput;
}

export const PUBLIC_SCHOOL_DATA_EXCLUSION = {
  AND: [
    nullableDoesNotContainSmoke('source'),
    nullableDoesNotContainSmoke('sourceId'),
    doesNotContainSmoke('nameZh'),
    nullableDoesNotContainSmoke('nameEn'),
    nullableDoesNotContainSmoke('cscaRequirement'),
    nullableDoesNotContainSmoke('cscaRequirementNote')
  ]
} satisfies Prisma.SchoolWhereInput;

export function buildPublishedSchoolWhere(query: SchoolSearchQuery = {}): Prisma.SchoolWhereInput {
  const keyword = cleanQueryValue(query.keyword);
  const region = cleanQueryValue(query.region);
  const schoolType = normalizeSchoolType(query.schoolType);
  const cscaRequired = parseBooleanFilter(query.cscaRequired);
  const verifiedOnly = parseBooleanFilter(query.verifiedOnly);
  const quality = cleanQueryValue(query.quality);

  const where: Prisma.SchoolWhereInput = {
    status: SchoolStatus.published,
    ...PUBLIC_SCHOOL_DATA_EXCLUSION
  };

  if (region) where.region = region;
  if (schoolType) where.schoolType = schoolType;
  if (typeof cscaRequired === 'boolean') where.cscaRequired = cscaRequired;
  if (verifiedOnly || quality === 'verified') Object.assign(where, verifiedWhere());
  if (quality === 'pending') {
    where.OR = [
      { sourceUrl: null },
      { lastVerifiedAt: null }
    ];
  }
  if (keyword) {
    const contains = { contains: keyword, mode: Prisma.QueryMode.insensitive };
    where.OR = [
      ...(where.OR ?? []),
      { nameZh: contains },
      { nameEn: contains },
      { region: contains },
      { cscaRequirement: contains },
      { cscaRequirementNote: contains },
      { hskRequirement: contains },
      { hskNotes: contains },
      { tuitionSummary: contains },
      { source: contains }
    ];
  }

  return where;
}

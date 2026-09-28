export type AccountAssetSectionKey = 'practice' | 'wrongQuestions' | 'mockExams';
export type AccountSectionKey = 'overview' | 'learning' | 'settings' | AccountAssetSectionKey;

export type AccountWrongQuestionFilters = {
  subject: string;
  module: string;
  topicSlug: string;
  knowledgeTag: string;
  patternType: string;
  dueOnly: boolean;
};

export const ACCOUNT_SECTION_KEYS: AccountSectionKey[] = ['overview', 'learning', 'practice', 'wrongQuestions', 'mockExams', 'settings'];

export function emptyAccountWrongQuestionFilters(): AccountWrongQuestionFilters {
  return { subject: '', module: '', topicSlug: '', knowledgeTag: '', patternType: '', dueOnly: false };
}

export function readAccountWrongQuestionFilters(): AccountWrongQuestionFilters {
  if (typeof window === 'undefined') return emptyAccountWrongQuestionFilters();
  const params = new URLSearchParams(window.location.search);
  return {
    subject: params.get('subject') ?? '',
    module: params.get('module') ?? '',
    topicSlug: params.get('topicSlug') ?? '',
    knowledgeTag: params.get('knowledgeTag') ?? '',
    patternType: params.get('patternType') ?? '',
    dueOnly: params.get('due') === '1'
  };
}

export function readAccountSection(): AccountSectionKey {
  if (typeof window === 'undefined') return 'overview';
  const section = new URLSearchParams(window.location.search).get('section');
  return ACCOUNT_SECTION_KEYS.includes(section as AccountSectionKey) ? section as AccountSectionKey : 'overview';
}

export function writeAccountUrlState(
  section: AccountSectionKey,
  filters: AccountWrongQuestionFilters,
  mode: 'push' | 'replace' = 'push'
) {
  if (typeof window === 'undefined') return;

  const nextUrl = new URL(window.location.href);
  if (section === 'overview') nextUrl.searchParams.delete('section');
  else nextUrl.searchParams.set('section', section);

  if (section === 'practice' || section === 'wrongQuestions') {
    const filterEntries: [keyof AccountWrongQuestionFilters, string][] = [
      ['subject', 'subject'],
      ['module', 'module'],
      ['topicSlug', 'topicSlug'],
      ['knowledgeTag', 'knowledgeTag'],
      ['patternType', 'patternType']
    ];
    filterEntries.forEach(([filterKey, paramKey]) => {
      const value = filters[filterKey];
      if (typeof value === 'string' && value) nextUrl.searchParams.set(paramKey, value);
      else nextUrl.searchParams.delete(paramKey);
    });
    if (filters.dueOnly) nextUrl.searchParams.set('due', '1');
    else nextUrl.searchParams.delete('due');
  } else {
    ['subject', 'module', 'topicSlug', 'knowledgeTag', 'patternType', 'due'].forEach((paramKey) => {
      nextUrl.searchParams.delete(paramKey);
    });
  }

  const nextPath = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
  const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (nextPath === currentPath) return;
  window.history[mode === 'replace' ? 'replaceState' : 'pushState']({}, '', nextPath);
}


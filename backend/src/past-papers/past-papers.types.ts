export type PastPaperSubject = 'math' | 'physics' | 'chemistry';
export type PastPaperCategory = 'past-paper' | 'mock-paper';
export type ResourceBundleSubjectScope = PastPaperSubject | 'mixed';

export type PastPaperInput = {
  slug?: string;
  title?: string;
  category?: string;
  subject?: string;
  examYear?: number | string | null;
  examMonth?: string | null;
  sessionLabel?: string | null;
  language?: string | null;
  description?: string | null;
  questionCount?: number | string | null;
  pageCount?: number | string | null;
  hasAnswers?: boolean;
  hasSolutions?: boolean;
  coverUrl?: string | null;
  isFree?: boolean;
  isPublished?: boolean;
  isFeatured?: boolean;
  sortOrder?: number | string | null;
  sourceDocumentId?: number | string | null;
  expectedVersion?: number;
};

export type PastPaperFileInput = {
  kind?: string;
  label?: string;
  fileUrl?: string;
  originalFilename?: string | null;
  mimeType?: string | null;
  fileSizeBytes?: number | string | null;
  checksum?: string | null;
};

export type ResourceBundleInput = {
  slug?: string;
  title?: string;
  category?: string;
  subjectScope?: string;
  language?: string | null;
  description?: string | null;
  coverUrl?: string | null;
  highlights?: string[] | string | null;
  tags?: string[] | string | null;
  isFeatured?: boolean;
  isPublished?: boolean;
  sortOrder?: number | string | null;
  expectedVersion?: number;
};

export type ResourceBundleItemInput = {
  pastPaperId?: number | string;
  label?: string | null;
  sortOrder?: number | string | null;
};

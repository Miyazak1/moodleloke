import type { ReactNode } from 'react';
import '../styles/admin.css';
import '../styles/admin-work.css';
import { AdminAuthGate } from './AdminAuthGate';
import { AdminConsoleShell, type AdminSectionKey } from './admin/AdminConsoleShell';
import type { User } from '../lib/api';

type AdminPageShellProps = {
  current: AdminSectionKey;
  currentUser?: User | null;
  kicker: string;
  title: ReactNode;
  body: ReactNode;
  children: ReactNode;
  className?: string;
  heroClassName?: string;
  heroAside?: ReactNode;
  allowAccess?: boolean;
  shellMode?: 'admin' | 'organization';
  showAuthGate?: boolean;
  onGoToAuth: () => void;
  onGoToAudit?: () => void;
  onGoToAiOperations?: () => void;
  onGoToContent?: () => void;
  onGoToCityGuides?: () => void;
  onGoToTimelineWindows?: () => void;
  onGoToSchools?: () => void;
  onGoToScholarships?: () => void;
  onGoToMockExams?: () => void;
  onGoToPastPapers?: () => void;
  onGoToSpecialPractice?: () => void;
  onGoToOrganizations?: () => void;
  onGoToUsers?: () => void;
};

export function AdminPageShell({
  current,
  currentUser,
  kicker,
  title,
  body,
  children,
  className = '',
  heroClassName = '',
  heroAside,
  allowAccess,
  shellMode = 'admin',
  showAuthGate = true,
  onGoToAuth,
  onGoToAudit,
  onGoToAiOperations,
  onGoToContent,
  onGoToCityGuides,
  onGoToTimelineWindows,
  onGoToSchools,
  onGoToScholarships,
  onGoToMockExams,
  onGoToPastPapers,
  onGoToSpecialPractice,
  onGoToOrganizations,
  onGoToUsers
}: AdminPageShellProps) {
  const hasAdminAccess = allowAccess ?? currentUser?.role === 'admin';

  return (
    <AdminConsoleShell
      current={current}
      currentUser={currentUser}
      mode={shellMode}
      kicker={kicker}
      title={title}
      body={body}
      className={className}
      heroClassName={heroClassName}
      heroAside={heroAside}
      onGoToAudit={onGoToAudit}
      onGoToAiOperations={onGoToAiOperations}
      onGoToContent={onGoToContent}
      onGoToCityGuides={onGoToCityGuides}
      onGoToTimelineWindows={onGoToTimelineWindows}
      onGoToSchools={onGoToSchools}
      onGoToScholarships={onGoToScholarships}
      onGoToMockExams={onGoToMockExams}
      onGoToPastPapers={onGoToPastPapers}
      onGoToSpecialPractice={onGoToSpecialPractice}
      onGoToOrganizations={onGoToOrganizations}
      onGoToUsers={onGoToUsers}
    >
      {showAuthGate && <AdminAuthGate currentUser={currentUser} onGoToAuth={onGoToAuth} />}
      {hasAdminAccess && children}
    </AdminConsoleShell>
  );
}

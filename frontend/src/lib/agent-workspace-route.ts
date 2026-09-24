export type AgentPracticeWorkspace = {
  artifactId?: string;
  verificationId?: string;
  contextId: string;
  roundId: number;
  phase: 'practice' | 'report';
  taskType?: string;
  subject?: string;
};

export type AgentMockExamWorkspace = {
  artifactId: string;
  contextId: string;
  attemptId: number;
  phase: 'taking' | 'report';
  subject?: string;
  paperTitle?: string;
};

export type AgentPastPaperWorkspaceRoute = {
  slug: string;
  contextId?: string;
  questionId?: number;
};

export type AgentJourneySection = 'today' | 'progress' | 'weakness' | 'resources' | 'qa' | 'settings';

export type AgentWorkspaceRoute =
  | { kind: 'practice'; workspace: AgentPracticeWorkspace; teachingDeliveryId?: string }
  | { kind: 'mock_exam'; workspace: AgentMockExamWorkspace }
  | { kind: 'past_paper'; workspace: AgentPastPaperWorkspaceRoute }
  | { kind: 'teaching'; deliveryId: string }
  | null;

function positiveInteger(value: string | null) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function contextIdFrom(params: URLSearchParams) {
  return params.get('agentContextId');
}

export function parseAgentWorkspaceRoute(search: string): AgentWorkspaceRoute {
  const params = new URLSearchParams(search);
  const contextId = contextIdFrom(params);
  const pastPaperSlug = params.get('agentPastPaper');
  if (pastPaperSlug) {
    const questionId = positiveInteger(params.get('agentQuestionId'));
    return {
      kind: 'past_paper',
      workspace: {
        slug: pastPaperSlug,
        ...(contextId ? { contextId } : {}),
        ...(questionId ? { questionId } : {})
      }
    };
  }

  const mockExamAttemptId = positiveInteger(params.get('agentMockExamAttemptId'));
  const artifactId = params.get('agentArtifactId');
  if (mockExamAttemptId && artifactId && contextId) {
    return {
      kind: 'mock_exam',
      workspace: {
        artifactId,
        contextId,
        attemptId: mockExamAttemptId,
        phase: params.get('agentView') === 'mock-report' ? 'report' : 'taking',
        subject: params.get('agentSubject') || undefined
      }
    };
  }

  const roundId = positiveInteger(params.get('agentRoundId'));
  const verificationId = params.get('agentInterventionVerificationId') || undefined;
  if (roundId && contextId && (artifactId || verificationId)) {
    return {
      kind: 'practice',
      workspace: {
        artifactId: artifactId || undefined,
        verificationId,
        contextId,
        roundId,
        phase: params.get('agentView') === 'report' ? 'report' : 'practice',
        taskType: params.get('agentTaskType') || undefined,
        subject: params.get('agentSubject') || undefined
      },
      teachingDeliveryId: params.get('agentTeachingDeliveryId') || undefined
    };
  }

  const deliveryId = params.get('agentTeachingDeliveryId');
  return deliveryId ? { kind: 'teaching', deliveryId } : null;
}

export function serializeAgentWorkspaceRoute(route: AgentWorkspaceRoute) {
  const params = new URLSearchParams();
  if (!route) return '';
  if (route.kind === 'practice') {
    const { workspace } = route;
    params.set('agentContextId', workspace.contextId);
    if (workspace.artifactId) params.set('agentArtifactId', workspace.artifactId);
    if (workspace.verificationId) params.set('agentInterventionVerificationId', workspace.verificationId);
    params.set('agentRoundId', String(workspace.roundId));
    params.set('agentView', workspace.phase);
    if (workspace.taskType) params.set('agentTaskType', workspace.taskType);
    if (workspace.subject) params.set('agentSubject', workspace.subject);
    if (route.teachingDeliveryId) params.set('agentTeachingDeliveryId', route.teachingDeliveryId);
  } else if (route.kind === 'mock_exam') {
    const { workspace } = route;
    params.set('agentContextId', workspace.contextId);
    params.set('agentArtifactId', workspace.artifactId);
    params.set('agentMockExamAttemptId', String(workspace.attemptId));
    params.set('agentView', workspace.phase === 'report' ? 'mock-report' : 'mock-exam');
    params.set('agentTaskType', 'mock_exam');
    if (workspace.subject) params.set('agentSubject', workspace.subject);
  } else if (route.kind === 'past_paper') {
    params.set('agentPastPaper', route.workspace.slug);
    if (route.workspace.contextId) params.set('agentContextId', route.workspace.contextId);
    if (route.workspace.questionId) params.set('agentQuestionId', String(route.workspace.questionId));
  } else {
    params.set('agentTeachingDeliveryId', route.deliveryId);
  }
  return params.toString();
}

export function replaceAgentWorkspaceRoute(route: AgentWorkspaceRoute) {
  if (typeof window === 'undefined') return;
  const query = serializeAgentWorkspaceRoute(route);
  window.history.replaceState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
}

export function replaceAgentJourneySectionRoute(section: AgentJourneySection, conversationId?: string | null) {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams();
  if (section !== 'today') params.set('agentSection', section);
  if (section === 'qa' && conversationId) params.set('conversation', conversationId);
  window.history.replaceState({}, '', `${window.location.pathname}${params.size ? `?${params.toString()}` : ''}`);
}

export function canonicalizeAgentWorkspaceRoute() {
  if (typeof window === 'undefined') return null;
  const route = parseAgentWorkspaceRoute(window.location.search);
  if (route) replaceAgentWorkspaceRoute(route);
  return route;
}

export type AgentHostLocale = 'zh-CN' | 'en' | 'vi';

export type AgentHostIdentity = Readonly<{
  id: string;
  email: string;
  role: string;
  displayName?: string;
  emailVerified: boolean;
}>;

export type AgentHostErrorCode =
  | 'auth_required'
  | 'email_unverified'
  | 'feature_disabled'
  | 'workspace_stale'
  | 'workspace_forbidden'
  | 'question_supply_unavailable';

export type AgentHostSnapshot = Readonly<{
  contractVersion: 'cscalite-agent-host-v1';
  identity: AgentHostIdentity | null;
  isResolvingAuth: boolean;
  locale: AgentHostLocale;
  features: Readonly<{
    agentWeb: boolean;
    practiceWrite: boolean;
    studentRuntimeQuestionGeneration: false;
  }>;
}>;

export type AgentHostRequestOptions = RequestInit & Readonly<{
  withAuth?: boolean;
  skipAuthRefresh?: boolean;
  preserveAuthOnUnauthorized?: boolean;
}>;

export type AgentHostBridge = Readonly<{
  navigate: (path: string) => void;
  requestAuthentication: (returnTo: string) => void;
  getSnapshot: () => AgentHostSnapshot;
  requestJson: <T>(path: string, options?: AgentHostRequestOptions) => Promise<T>;
}>;

export function createAgentHostBridge(input: AgentHostBridge): AgentHostBridge {
  return Object.freeze({
    navigate: input.navigate,
    requestAuthentication: input.requestAuthentication,
    getSnapshot: input.getSnapshot,
    requestJson: input.requestJson
  });
}

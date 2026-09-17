import { PrismaService } from '../prisma/prisma.service';
import { getRequestId } from '../common/request-context';

export type AdminAuditLogInput = {
  actorId?: number;
  module: string;
  resourceType: string;
  resourceId?: string | number;
  action: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  requestId?: string;
  actorSummary?: Record<string, unknown>;
};

function withAuditContext(value: Record<string, unknown> | null | undefined, input: AdminAuditLogInput) {
  const requestId = input.requestId ?? getRequestId();
  const actorSummary = input.actorSummary ?? (input.actorId ? { id: input.actorId } : undefined);
  if (!requestId && !actorSummary) return value ?? undefined;
  return {
    ...(value ?? {}),
    _audit: {
      ...(requestId ? { requestId } : {}),
      ...(actorSummary ? { actor: actorSummary } : {})
    }
  };
}

export async function recordAdminAudit(prisma: PrismaService, input: AdminAuditLogInput) {
  return prisma.adminAuditLog.create({
    data: {
      actorId: input.actorId,
      module: input.module,
      resourceType: input.resourceType,
      resourceId: input.resourceId === undefined ? null : String(input.resourceId),
      action: input.action,
      before: (input.before ?? undefined) as never,
      after: withAuditContext(input.after, input) as never
    }
  });
}

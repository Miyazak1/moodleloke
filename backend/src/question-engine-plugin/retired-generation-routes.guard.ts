import { CanActivate, ExecutionContext, GoneException, Injectable } from '@nestjs/common';

/** Retired generation controls cannot be revived by old clients or env flags. */
@Injectable()
export class RetiredGenerationRoutesGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{ method: string; originalUrl?: string; url?: string; body?: { action?: string } }>();
    if (request.method === 'GET') return true;
    const path = (request.originalUrl ?? request.url ?? '').split('?')[0];
    if (/\/(?:cancel|pause|archive|cleanup)$/.test(path)) return true;
    const retired = /\/(?:blueprints\/(?:[^/]+\/generate|generate-batch)|generation-jobs\/(?:enqueue|process|[^/]+\/retry)|pregeneration\/run|adaptive-replenishment\/run|subject-practice-(?:production-runs|observation-tasks|observation-runtime-probe)|subject-practice-auto-production-settings|misconceptions\/[^/]+\/variant|questions\/[^/]+\/approve)(?:\/|$)/.test(path)
      || (/\/questions\/bulk/.test(path) && /approve|generate/.test(String(request.body?.action ?? '')));
    if (retired) throw new GoneException({ code: 'LEGACY_QUESTION_GENERATION_RETIRED', message: '旧出题接入已停用；正式出题仅支持数学 1.43。现有三科题库与练习继续可用。' });
    return true;
  }
}

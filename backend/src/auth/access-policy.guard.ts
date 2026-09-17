import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { User as PrismaUser } from '@prisma/client';
import { ACCESS_POLICY_KEY, type AccessLevel } from './access-policy';
import { AuthService } from './auth.service';

type AuthenticatedRequest = {
  headers: {
    authorization?: string;
  };
  user?: PrismaUser;
};

@Injectable()
export class AccessPolicyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService
  ) {}

  async canActivate(context: ExecutionContext) {
    const level = this.reflector.getAllAndOverride<AccessLevel>(ACCESS_POLICY_KEY, [
      context.getHandler(),
      context.getClass()
    ]) ?? 'public';
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (level === 'public') return true;
    if (level === 'optionalUser') {
      request.user = await this.authService.getOptionalUser(request.headers.authorization) ?? undefined;
      return true;
    }
    if (level === 'user') {
      request.user = await this.authService.getRequiredUser(request.headers.authorization);
      return true;
    }
    if (level === 'verifiedUser' || level === 'organizationAdmin') {
      request.user = await this.authService.getRequiredVerifiedUser(request.headers.authorization);
      return true;
    }
    if (level === 'admin') {
      request.user = await this.authService.getRequiredAdmin(request.headers.authorization);
      return true;
    }
    request.user = await this.authService.getRequiredVerifiedUser(request.headers.authorization);
    return true;
  }
}


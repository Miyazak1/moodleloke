import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { User as PrismaUser } from '@prisma/client';
import { AuthService } from './auth.service';

type AuthenticatedRequest = {
  headers: {
    authorization?: string;
  };
  user?: PrismaUser;
};

@Injectable()
export class RequiredUserGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    request.user = await this.authService.getRequiredUser(request.headers.authorization);
    return true;
  }
}

@Injectable()
export class RequiredAdminGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    request.user = await this.authService.getRequiredAdmin(request.headers.authorization);
    return true;
  }
}

@Injectable()
export class OptionalUserGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    request.user = await this.authService.getOptionalUser(request.headers.authorization) ?? undefined;
    return true;
  }
}

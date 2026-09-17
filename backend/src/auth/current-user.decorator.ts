import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User as PrismaUser } from '@prisma/client';

export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): PrismaUser | undefined => {
  const request = context.switchToHttp().getRequest<{ user?: PrismaUser }>();
  return request.user;
});
